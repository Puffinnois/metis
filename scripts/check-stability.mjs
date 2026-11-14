#!/usr/bin/env node
// Checks metric stability, shrinkage and the league indexes (Plan T1006) on a real load, through the
// built worker, and writes the report the data doc quotes:
//
// 1. Recounts: for a dozen metrics across families, the year-to-year and split-half correlations
//    recomputed here by SQL written apart from the builder (the box-score, shot, published and
//    composite tables read directly, qualification by the same rules: the leaderboard's 1,000
//    minutes over 82 games for players, the metric's own sample, both scaled to the season's games,
//    halves at half of it), against `metric_stability`.
// 2. Coverage: how many metrics have each label, and how many none with which reason, by family.
// 3. Sanity: where the metrics known to be stable or noisy rank among all measured, and three-point
//    percentage on low volume (50 to 150 attempts, scaled), which the leaderboard's 200 leaves out.
// 4. Pooling across positions: the year-to-year r within each position (weighted by pairs) against
//    the pooled r, for the families where positions differ most.
// 5. TS+: known player-seasons through the engine against the definition by SQL, and the league's
//    own index (the players' TS+ weighted by their true shooting attempts) per season.
// 6. Speed: the catalogue with its stability, and index and shrunk reads, each under 500 ms.
//
// Tolerance: correlations equal within 1e-9 with the same pairs; indexes within 1e-9.
//
// usage: node scripts/check-stability.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-stability.mjs <folder> [out.md]')
  process.exit(2)
}

const { read, query, call, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const f = (x, d = 3) => (x === null || x === undefined ? '–' : Number(x).toFixed(d))
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  ''
]
const out = ['# Metric stability: checks', '']
const problems = []

const stored = new Map(
  (
    await read(
      `SELECT * FROM metric_stability WHERE season = (SELECT max(season) FROM metric_stability)`
    )
  ).map((r) => [r.metric_id, r])
)
const through = [...stored.values()][0]?.through
if (!through) {
  console.error('no metric_stability rows: run a refresh first')
  process.exit(1)
}
out.push(`Measured through ${label(through)}, ${stored.size} metrics.`, '')

// 1. Recounts. Each spec reads its own table; `v` and `s` are SQL over the row's sums.
const FAC = `fac AS (
  SELECT season, count(*)::DOUBLE / count(DISTINCT team_id) / 82 AS f
  FROM team_game WHERE game_type = 'regular' GROUP BY season)`
const playerGames = (first) => `g AS (
  SELECT *, row_number() OVER (PARTITION BY player_id, season ORDER BY game_date, game_id) % 2 AS half
  FROM player_game WHERE game_type = 'regular' AND season BETWEEN ${first} AND ${through})`
const teamGames = (first) => `g AS (
  SELECT *, row_number() OVER (PARTITION BY team_id, season ORDER BY game_date, game_id) % 2 AS half
  FROM team_game WHERE game_type = 'regular' AND season BETWEEN ${first} AND ${through})`

/** A box-score metric of players: its value and sample over sums of `player_game`. */
const box = (id, v, s, min, first = 1994) => ({ id, kind: 'player', v, s, min, first })
const SPECS = [
  box('pts', 'sum(pts) / nullif(sum(games), 0)', 'sum(games)', 0),
  box('ft_pct', 'sum(ftm) / nullif(sum(fta), 0)', 'sum(fta)', 125),
  box('fg3_pct', 'sum(fg3m) / nullif(sum(fg3a), 0)', 'sum(fg3a)', 200),
  box('ts_pct', 'sum(pts) / nullif(2 * (sum(fga) + 0.44 * sum(fta)), 0)', 'sum(fga)', 500),
  box(
    'usg_pct',
    '(sum(fga) + 0.44 * sum(fta) + sum(tov)) / nullif(sum(x_usg_den), 0)',
    'sum(minutes)',
    1000
  ),
  box('trb_pct', 'sum(reb) / nullif(sum(x_trb_den), 0)', 'sum(minutes)', 1000),
  { id: 'shot_ra_fg_pct', kind: 'shots', first: 1997, min: 100 },
  { id: 'drives', kind: 'published', table: 'pub_player_drives', column: 'drives', first: 2014 },
  {
    id: 'deflections',
    kind: 'published',
    table: 'pub_player_hustle',
    column: 'deflections',
    first: 2017
  },
  { id: 'per', kind: 'composite', first: 1994 },
  {
    id: 'team_ortg',
    kind: 'team',
    v: '100 * sum(pts) / nullif(sum(poss_sym), 0)',
    s: 'sum(poss_sym)',
    first: 1994
  },
  {
    id: 'opp_fg3_pct',
    kind: 'team',
    v: 'sum(opp_fg3m) / nullif(sum(opp_fg3a), 0)',
    s: 'sum(opp_fg3a)',
    first: 1994
  }
]

/** The qualified rows of a spec, whole seasons (`halves` false) or halves, as a CTE `q`. */
function qualified(spec, halves) {
  const k = halves ? 0.5 : 1
  const h = halves ? 'half, ' : ''
  const minutes = `mins >= 1000 * f * ${k}`
  if (spec.kind === 'player') {
    return `${FAC}, ${playerGames(spec.first)},
      s AS (SELECT player_id AS id, season, ${h} sum(minutes) AS mins, ${spec.v} AS v, ${spec.s} AS n
            FROM g GROUP BY ALL),
      q AS (SELECT s.* FROM s JOIN fac USING (season)
            WHERE ${minutes} AND n > 0 AND n >= ${spec.min} * f * ${k} AND v IS NOT NULL)`
  }
  if (spec.kind === 'shots') {
    return `${FAC}, ${playerGames(spec.first)},
      z AS (SELECT player_id, game_id, sum(ra_fgm) AS m, sum(ra_fga) AS a FROM shot_player_game
            WHERE game_type = 'regular' GROUP BY ALL),
      s AS (SELECT g.player_id AS id, g.season, ${h ? 'g.half, ' : ''} sum(g.minutes) AS mins,
                   coalesce(sum(z.m), 0) / nullif(coalesce(sum(z.a), 0), 0) AS v, coalesce(sum(z.a), 0) AS n
            FROM g LEFT JOIN z USING (player_id, game_id) GROUP BY ALL),
      q AS (SELECT s.* FROM s JOIN fac USING (season)
            WHERE ${minutes} AND n > 0 AND n >= ${spec.min} * f * ${k} AND v IS NOT NULL)`
  }
  if (spec.kind === 'published') {
    return `${FAC}, ${playerGames(spec.first)},
      m AS (SELECT player_id AS id, season, sum(minutes) AS mins FROM g GROUP BY ALL),
      p AS (SELECT player_id AS id, season, sum(${spec.column}) / nullif(sum(games), 0) AS v,
                   sum(games) AS n
            FROM ${spec.table} WHERE game_type = 'regular' GROUP BY ALL),
      q AS (SELECT p.*, m.mins FROM p JOIN m USING (id, season) JOIN fac USING (season)
            WHERE ${minutes} AND n > 0 AND v IS NOT NULL)`
  }
  if (spec.kind === 'composite') {
    return `${FAC}, ${playerGames(spec.first)},
      m AS (SELECT player_id AS id, season, sum(minutes) AS mins FROM g GROUP BY ALL),
      p AS (SELECT player_id AS id, season, sum(per_num) / nullif(sum(cmp_minutes), 0) AS v
            FROM player_composite WHERE game_type = 'regular' GROUP BY ALL),
      q AS (SELECT p.*, m.mins FROM p JOIN m USING (id, season) JOIN fac USING (season)
            WHERE ${minutes} AND v IS NOT NULL)`
  }
  return `${teamGames(spec.first)},
    q AS (SELECT team_id AS id, season, ${h} ${spec.v} AS v, ${spec.s} AS n FROM g GROUP BY ALL
          HAVING n > 0 AND v IS NOT NULL)`
}

const recounts = []
for (const spec of SPECS) {
  const [yy] = await read(`WITH ${qualified(spec, false)}
    SELECT corr(a.v, b.v) AS r, count(*)::INTEGER AS n
    FROM q a JOIN q b ON b.id = a.id AND b.season = a.season + 1`)
  const halvable = ['player', 'shots', 'team'].includes(spec.kind)
  const [hh] = halvable
    ? await read(`WITH ${qualified(spec, true)}
        SELECT corr(a.v, b.v) AS r, count(*)::INTEGER AS n
        FROM q a JOIN q b ON b.id = a.id AND b.season = a.season AND a.half = 1 AND b.half = 0`)
    : [{ r: null, n: 0 }]
  const sb = hh.r === null ? null : hh.r > 0 ? (2 * hh.r) / (1 + hh.r) : hh.r
  const t = stored.get(spec.id)
  const ok =
    t &&
    t.pairs === yy.n &&
    Math.abs((t.year_to_year ?? NaN) - yy.r) < 1e-9 &&
    (sb === null
      ? t.split_half === null
      : t.half_pairs === hh.n && Math.abs(t.split_half - sb) < 1e-9)
  if (!ok) problems.push(`${spec.id}: the table and the recount differ`)
  recounts.push([
    spec.id,
    f(t?.year_to_year),
    f(yy.r),
    `${t?.pairs ?? '–'} / ${yy.n}`,
    f(t?.split_half),
    f(sb),
    `${t?.half_pairs ?? '–'} / ${hh.n}`,
    f(t?.prior, 0),
    t?.reliability ?? '–',
    ok ? 'yes' : '**no**'
  ])
}
out.push(
  '## 1. Year to year and split half, recounted by SQL',
  '',
  ...table(
    [
      'Metric',
      'Year to year',
      'Recount',
      'Pairs (table / recount)',
      'Split half',
      'Recount',
      'Halves',
      'Prior',
      'Label',
      'Equal'
    ],
    recounts
  )
)

// 2. Coverage by family.
const catalogue = await call('catalogue', {})
const families = new Map()
const reasons = new Map()
for (const m of catalogue) {
  const s = stored.get(m.id)
  const key = `${m.entity === 'team' ? 'Team ' : ''}${m.family}`
  const row = families.get(key) ?? { high: 0, medium: 0, low: 0, none: 0, prior: 0 }
  row[s?.reliability ?? 'none']++
  if (s?.prior !== null && s?.prior !== undefined) row.prior++
  families.set(key, row)
  if (!s?.reliability) {
    const why = s?.reason ?? 'not in the table'
    reasons.set(why, [...(reasons.get(why) ?? []), m.id])
  }
  if (!s) problems.push(`${m.id}: no row in metric_stability`)
}
const totals = { high: 0, medium: 0, low: 0, none: 0, prior: 0 }
const famRows = [...families].sort().map(([k, v]) => {
  for (const x of Object.keys(totals)) totals[x] += v[x]
  return [k, v.high, v.medium, v.low, v.none, v.prior]
})
famRows.push(['**All**', totals.high, totals.medium, totals.low, totals.none, totals.prior])
out.push(
  '## 2. Coverage: labels by family',
  '',
  ...table(['Family', 'High', 'Medium', 'Low', 'None', 'With a prior'], famRows),
  'Metrics with no label, by reason:',
  '',
  ...[...reasons].map(([why, ids]) => `- ${why} (${ids.length}): ${ids.join(', ')}`),
  ''
)

// 3. Sanity: rank among all measured metrics of the same entity.
const measured = catalogue.filter((m) => stored.get(m.id)?.year_to_year != null)
// Efficiency rates alone: a share made or a points rate, not a volume, a role or a count.
const EFFICIENCY = (x) =>
  x.aggregation === 'ratio' &&
  ['traditional', 'shooting', 'shots'].includes(x.family) &&
  /_(pct|fg_pct|efg_pct)$/.test(x.id) &&
  !/(share|rate|freq|ast_pct|orb_pct|drb_pct|trb_pct|stl_pct|blk_pct|usg_pct|tov_pct)$/.test(x.id)
const rankOf = (id, keep = () => true) => {
  const m = catalogue.find((x) => x.id === id)
  const pool = measured
    .filter((x) => x.entity === m.entity && keep(x))
    .map((x) => stored.get(x.id).year_to_year)
  const r = stored.get(id)?.year_to_year
  if (r === null || r === undefined) return '–'
  const below = pool.filter((x) => x < r).length
  return `${Math.round((100 * below) / Math.max(1, pool.length - 1))}`
}
const [low3] = await read(`WITH ${FAC}, ${playerGames(1994)},
  s AS (SELECT player_id AS id, season, sum(minutes) AS mins, sum(fg3m) / nullif(sum(fg3a), 0) AS v,
               sum(fg3a) AS n FROM g GROUP BY ALL),
  q AS (SELECT s.* FROM s JOIN fac USING (season)
        WHERE mins >= 1000 * f AND n >= 50 * f AND n < 150 * f AND v IS NOT NULL)
  SELECT corr(a.v, b.v) AS r, count(*)::INTEGER AS n FROM q a JOIN q b
  ON b.id = a.id AND b.season = a.season + 1`)
const SANITY = [
  ['ft_pct', 'Free-throw percentage', 'among the most stable'],
  ['usg_pct', 'Usage percentage', 'among the most stable'],
  ['fg3a_rate', 'Three-point attempt rate', 'stable (a choice, not a skill)'],
  ['ts_pct', 'True shooting percentage', 'stable'],
  ['fg3_pct', 'Three-point percentage (200 attempts and up)', 'middling'],
  ['shot_c3_fg_pct', 'Corner three FG%', 'among the least'],
  ['opp_fg3_pct', 'Opponent three-point percentage (teams)', 'among the least'],
  ['team_ortg', 'Offensive rating (teams)', 'stable'],
  ['team_drtg', 'Defensive rating (teams)', 'stable']
]
out.push(
  '## 3. Against what is well known',
  '',
  ...table(
    [
      'Metric',
      'Year to year',
      'Pairs',
      'Percentile among measured',
      'Among efficiency rates',
      'Expected'
    ],
    [
      ...SANITY.map(([id, name, expect]) => [
        name,
        f(stored.get(id)?.year_to_year),
        stored.get(id)?.pairs ?? '–',
        rankOf(id),
        EFFICIENCY(catalogue.find((x) => x.id === id)) ? rankOf(id, EFFICIENCY) : '–',
        expect
      ]),
      [
        'Three-point percentage, 50 to 150 attempts (SQL, not a catalogue metric)',
        f(low3.r),
        low3.n,
        '–',
        '–',
        'among the least'
      ]
    ]
  ),
  `Efficiency rates: the ${measured.filter((x) => x.entity === 'player' && EFFICIENCY(x)).length} measured player shooting percentages (made over attempted, true and effective shooting, by zone). Volume, role and share metrics carry over more than any of them, so "among the most stable" is read against these.`,
  ''
)

// 4. Pooling across positions.
const POOL = [
  ['trb_pct', 'sum(reb) / nullif(sum(x_trb_den), 0)', 'sum(minutes)', 1000],
  ['ast_pct', 'sum(ast) / nullif(sum(x_ast_den), 0)', 'sum(minutes)', 1000],
  ['blk_pct', 'sum(blk) / nullif(sum(x_blk_den), 0)', 'sum(minutes)', 1000],
  [
    'usg_pct',
    '(sum(fga) + 0.44 * sum(fta) + sum(tov)) / nullif(sum(x_usg_den), 0)',
    'sum(minutes)',
    1000
  ],
  ['fg3a_rate', 'sum(fg3a) / nullif(sum(fga), 0)', 'sum(fga)', 500],
  ['ft_pct', 'sum(ftm) / nullif(sum(fta), 0)', 'sum(fta)', 125],
  ['ts_pct', 'sum(pts) / nullif(2 * (sum(fga) + 0.44 * sum(fta)), 0)', 'sum(fga)', 500]
]
const poolRows = []
for (const [id, v, s, min] of POOL) {
  const rows = await read(`WITH ${FAC}, ${playerGames(1994)},
    s AS (SELECT player_id AS id, season, mode(position) AS pos, sum(minutes) AS mins, ${v} AS v,
                 ${s} AS n FROM g GROUP BY player_id, season),
    q AS (SELECT s.* FROM s JOIN fac USING (season)
          WHERE mins >= 1000 * f AND n > 0 AND n >= ${min} * f AND v IS NOT NULL)
    SELECT a.pos, corr(a.v, b.v) AS r, count(*)::INTEGER AS n FROM q a JOIN q b
    ON b.id = a.id AND b.season = a.season + 1 GROUP BY ROLLUP (a.pos) ORDER BY a.pos NULLS LAST`)
  const pooled = rows.find((r) => r.pos === null)
  const within = rows.filter((r) => r.pos !== null && r.n >= 50)
  const weighted =
    within.reduce((acc, r) => acc + r.r * r.n, 0) / within.reduce((acc, r) => acc + r.n, 0)
  poolRows.push([
    id,
    f(pooled.r),
    f(weighted),
    within.map((r) => `${r.pos} ${f(r.r, 2)}`).join(', '),
    f(pooled.r - weighted)
  ])
}
out.push(
  '## 4. Pooled across positions, against within each',
  '',
  ...table(['Metric', 'Pooled', 'Within positions', 'By position', 'Inflation'], poolRows)
)

// 5. TS+.
const PEOPLE = [
  ['Stephen Curry', 2016],
  ['LeBron James', 2013],
  ["Shaquille O'Neal", 2000],
  ['Steve Nash', 2007],
  ['Nikola Jokić', 2024],
  ['Rudy Gobert', 2022],
  ['Michael Jordan', 1996],
  ['Allen Iverson', 2001]
]
const tsRows = []
for (const [name, season] of PEOPLE) {
  const [p] = await read(
    `SELECT player_id FROM player WHERE name = '${name.replaceAll("'", "''")}' LIMIT 1`
  )
  if (!p) {
    tsRows.push([name, label(season), '–', '–', '–', 'not found'])
    continue
  }
  const [sql] = await read(`WITH lg AS (
      SELECT sum(pts) / (2 * (sum(fga) + 0.44 * sum(fta))) AS ts FROM player_game
      WHERE season = ${season} AND game_type = 'regular'),
    me AS (SELECT sum(pts) / (2 * (sum(fga) + 0.44 * sum(fta))) AS ts FROM player_game
      WHERE season = ${season} AND game_type = 'regular' AND player_id = ${p.player_id})
    SELECT me.ts, lg.ts AS league, 100 * me.ts / lg.ts AS plus FROM me, lg`)
  const r = await query({
    entity: 'player',
    metrics: ['ts_pct_plus', 'ts_pct'],
    scope: { seasons: [season], players: [String(p.player_id)] }
  })
  const engine = r.rows[0]?.values.ts_pct_plus.value
  const ok = Math.abs(engine - sql.plus) < 1e-9
  if (!ok) problems.push(`TS+ ${name} ${season}: engine ${engine} against ${sql.plus}`)
  tsRows.push([
    name,
    label(season),
    f(sql.ts * 100, 1),
    f(sql.league * 100, 1),
    f(engine, 1),
    ok ? 'yes' : '**no**'
  ])
}
const leagueRows = []
for (const season of [1994, 2005, 2016, through]) {
  const r = await query({
    entity: 'player',
    metrics: ['ts_pct_plus', 'tsa'],
    scope: { seasons: [season] },
    limit: 5000
  })
  let w = 0
  let sum = 0
  for (const row of r.rows) {
    const plus = row.values.ts_pct_plus.value
    const tsa = row.values.tsa.value
    if (plus === null || !tsa) continue
    sum += plus * tsa
    w += tsa
  }
  const mean = sum / w
  if (Math.abs(mean - 100) > 1e-9) problems.push(`league TS+ ${season}: ${mean}`)
  leagueRows.push([label(season), r.rows.length, f(mean, 9)])
}
out.push(
  '## 5. TS+ against its definition',
  '',
  ...table(['Player', 'Season', 'TS%', 'League TS%', 'TS+ (engine)', 'Equal'], tsRows),
  "The league's own index, every player's TS+ weighted by true shooting attempts:",
  '',
  ...table(['Season', 'Players', 'Weighted TS+'], leagueRows)
)

// 6. Speed.
const speed = []
const timed = async (name, fn) => {
  const t = Date.now()
  const r = await fn()
  const ms = Date.now() - t
  if (ms > 500) problems.push(`${name}: ${ms} ms`)
  speed.push([name, ms, r?.ms ?? '–'])
}
await timed('Catalogue with stability (1st)', () => call('catalogue', {}))
await timed('Catalogue with stability (again)', () => call('catalogue', {}))
await timed('TS+, eFG+, FT%+, 3P%+ board, 2025-26', () =>
  query({
    entity: 'player',
    metrics: ['ts_pct_plus', 'efg_pct_plus', 'ft_pct_plus', 'fg3_pct_plus', 'min'],
    scope: { seasons: [2026] },
    limit: 1000
  })
)
await timed('Shrunk board: PTS, TS%, 3P%, FT%, USG%, 2025-26', () =>
  query({
    entity: 'player',
    metrics: ['pts', 'ts_pct', 'fg3_pct', 'ft_pct', 'usg_pct', 'min'],
    scope: { seasons: [2026] },
    shrunk: true,
    limit: 1000
  })
)
await timed('Shrunk board, January 2016 (a date range)', () =>
  query({
    entity: 'player',
    metrics: ['ts_pct', 'fg3_pct', 'ft_pct', 'min'],
    scope: { seasons: [2016], dates: ['2016-01-01', '2016-01-31'] },
    shrunk: true,
    limit: 1000
  })
)
await timed('TS+ by season over every season, one player', () =>
  query({
    entity: 'player',
    metrics: ['ts_pct_plus'],
    scope: {
      seasons: Array.from({ length: through - 1993 }, (_, i) => 1994 + i),
      players: ['2544']
    },
    groupBy: ['season']
  })
)
await timed('Team indexes, both sides, 2025-26', () =>
  query({
    entity: 'team',
    metrics: ['team_ts_pct_plus', 'opp_ts_pct_plus', 'team_tov_pct_plus', 'opp_tov_pct_plus'],
    scope: { seasons: [2026] }
  })
)
out.push(
  '## 6. Speed',
  '',
  ...table(['Read', 'Wall ms', 'Engine ms'], speed),
  problems.length ? `**Problems:**\n\n${problems.map((p) => `- ${p}`).join('\n')}` : 'No problems.',
  ''
)

const md = out.join('\n')
if (mdFile) writeFileSync(mdFile, md)
console.log(md)
await close()
process.exit(problems.length ? 1 : 0)
