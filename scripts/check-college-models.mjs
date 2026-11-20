#!/usr/bin/env node
// Checks Metis's ratings and models on a college league (Plan T1302.8), on a real load whose models step
// has run, read through the built worker and its engine:
//
// 1. SRS against Sports Reference's school pages, every Division I team-season (pages read beforehand
//    with a plain client into --probe: `sr-<men|women>-<season>.html`, and the team map
//    `sr-school-map.tsv` T1302.4 made).
// 2. PER, Win Shares and WS per 40 of each season's ten leaders on Sports Reference's leaders pages
//    (`sr-leaders-<men|women>-<season>.html`) against the engine's.
// 3. Elo's calibration out of sample: the constants were fitted on 2021-22 to 2024-25
//    (`scripts/fit-college-models.mjs`), so 2025-26's games are scored by tenths of the home side's
//    probability, with the Brier score and log loss against the home side's rate of the fitted seasons.
// 4. The adjusted ratings and SRS against SportsDataverse's published adjusted efficiency margin:
//    Spearman's rank correlation per season, over Division I teams.
// 5. Each season's top ten by the adjusted net rating and by Elo after the last game, beside the
//    team's NCAA tournament from the `game` table.
// 6. Model metrics through the engine against the tables, two seasons; stability's labels.
//
// usage: node scripts/check-college-models.mjs <folder holding stats-<league>.duckdb> [out.md]
//   --league=<ncaam|ncaaw> --probe=<folder> . Build first (`npm run build`).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { leagueArg, openStatsWorker } from './lib/stats-worker.mjs'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const [folderArg, mdArg] = args
const leagueId = leagueArg()
const PROBE = process.argv.find((a) => a.startsWith('--probe='))?.slice(8)
if (!folderArg || !PROBE) {
  console.error(
    'usage: node scripts/check-college-models.mjs <folder> [out.md] --league=<id> --probe=<folder>'
  )
  process.exit(2)
}
const gender = leagueId === 'ncaaw' ? 'women' : 'men'
const { read, query, close } = openStatsWorker(resolve(folderArg), { league: leagueId })

const out = []
const say = (...lines) => {
  for (const l of lines) {
    console.log(l)
    out.push(l)
  }
}
const table = (headers, rows) => {
  say(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`)
  for (const r of rows) say(`| ${r.join(' | ')} |`)
  say('')
}
const f = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : x.toFixed(d))
const label = (s) => `${s - 1}-${String(s % 100).padStart(2, '0')}`
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '–')

const done = (
  await read(`SELECT DISTINCT season FROM game WHERE played AND season NOT IN
    (SELECT season FROM game WHERE NOT played) ORDER BY season`)
).map((r) => Number(r.season))
const counted = (
  await read(`SELECT DISTINCT game_type FROM game WHERE game_type <> 'preseason'`)
).map((r) => r.game_type)

/** An engine query of teams or players; rows by id. */
async function engine(entity, metrics, season, extra = {}) {
  const r = await query({
    entity,
    metrics,
    scope: { seasons: [season], ...extra },
    limit: 5000,
    ranks: false
  })
  return {
    reasons: r.columns.map((c) => c.reason),
    rows: new Map(
      r.rows.map((row) => [
        row.id,
        Object.fromEntries(metrics.map((m) => [m, row.values[m]?.value ?? null]))
      ])
    )
  }
}

const spearman = (a, b) => {
  const rank = (v) => {
    const order = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0])
    const r = new Array(v.length)
    for (let i = 0; i < order.length;) {
      let j = i
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
      for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2
      i = j + 1
    }
    return r
  }
  const ra = rank(a)
  const rb = rank(b)
  const n = a.length
  const m = (n - 1) / 2
  let s = 0
  let sa = 0
  let sb = 0
  for (let i = 0; i < n; i++) {
    s += (ra[i] - m) * (rb[i] - m)
    sa += (ra[i] - m) ** 2
    sb += (rb[i] - m) ** 2
  }
  return s / Math.sqrt(sa * sb)
}

const name = (await read(`SELECT team_id, any_value(name) AS name FROM team GROUP BY 1`)).reduce(
  (m, r) => m.set(String(r.team_id), r.name),
  new Map()
)
const divisionI = async (season) =>
  new Set(
    (await read(`SELECT team_id FROM team WHERE season = ${season} AND division_i`)).map((r) =>
      String(r.team_id)
    )
  )

say(`# ${leagueId === 'ncaaw' ? 'NCAA Women' : 'NCAA Men'}: ratings and models, checked`, '')
say(
  `On \`${folderArg}\`, by \`scripts/check-college-models.mjs\`, through the built worker and its engine.`,
  ''
)

// ---- 1. SRS against Sports Reference.
const slugOf = new Map()
const idOfSlug = new Map()
for (const line of readFileSync(join(PROBE, 'sr-school-map.tsv'), 'utf8')
  .trim()
  .split('\n')
  .slice(1)) {
  const [id, slug] = line.split('\t')
  slugOf.set(id, slug)
  idOfSlug.set(slug, id)
}
function srPage(season) {
  const file = join(PROBE, `sr-${gender}-${season}.html`)
  if (!existsSync(file)) return null
  const html = readFileSync(file, 'utf8')
  const rows = new Map()
  for (const tr of html.split('<tr')) {
    const slug = tr.match(
      /href=["']\/cbb\/schools\/([a-z0-9-]+)\/(?:men|women)\/\d+\.html["']>([^<]*)<\/a>/
    )
    const srs = tr.match(/data-stat="srs" >(-?[0-9.]+)/)
    const sos = tr.match(/data-stat="sos" >(-?[0-9.]+)/)
    if (slug && srs)
      rows.set(slug[1], { srs: Number(srs[1]), sos: sos ? Number(sos[1]) : null, display: slug[2] })
  }
  return rows
}
say('## SRS against Sports Reference', '')
say(
  "Metis's SRS after each team's last game (every counted game between Division I teams), read through the engine, against the SRS on Sports Reference's school pages, Division I teams matched by T1302.4's map. Tolerance stated before the run: within 0.5 a game on 95 % of team-seasons.",
  ''
)
const srsRows = []
const srsDiffs = []
const displayToSlug = new Map()
for (const season of done) {
  const sr = srPage(season)
  if (!sr) continue
  for (const [slug, v] of sr) displayToSlug.set(v.display, slug)
  const d1 = await divisionI(season)
  const { rows } = await engine('team', ['team_srs', 'team_sos'], season)
  const diffs = []
  let unmatched = 0
  for (const id of d1) {
    const ours = rows.get(id)?.team_srs
    const theirs = sr.get(slugOf.get(id))
    if (ours === null || ours === undefined || !theirs) {
      unmatched++
      continue
    }
    diffs.push({ id, season, ours, theirs: theirs.srs, d: ours - theirs.srs })
  }
  srsDiffs.push(...diffs)
  const abs = diffs.map((x) => Math.abs(x.d)).sort((a, b) => a - b)
  // Sports Reference's Division I ratings do not average zero; Metis's are centred on the division.
  // With each season's mean gap taken out, what is left is the ratings' own difference.
  const offset = diffs.reduce((s, x) => s + x.d, 0) / diffs.length
  const centred = diffs.map((x) => Math.abs(x.d - offset)).sort((a, b) => a - b)
  const theirMean = diffs.reduce((s, x) => s + x.theirs, 0) / diffs.length
  srsRows.push([
    label(season),
    diffs.length,
    unmatched,
    f(theirMean),
    f(offset),
    pct(abs.filter((x) => x <= 0.5).length, abs.length),
    pct(centred.filter((x) => x <= 0.1).length, centred.length),
    pct(centred.filter((x) => x <= 0.5).length, centred.length),
    f(centred[Math.floor(centred.length / 2)]),
    f(centred.at(-1)),
    f(
      spearman(
        diffs.map((x) => x.ours),
        diffs.map((x) => x.theirs)
      ),
      4
    )
  ])
}
table(
  [
    'Season',
    'Teams',
    'Unmatched',
    "SR's mean",
    'Mean gap',
    'Within 0.5 as published',
    'Centred, within 0.1',
    'Centred, within 0.5',
    'Centred, median gap',
    'Centred, largest',
    'Rank r'
  ],
  srsRows
)
// The largest gaps once each season's mean gap is taken out.
const offsets = new Map()
for (const x of srsDiffs) {
  const o = offsets.get(x.season) ?? { s: 0, n: 0 }
  o.s += x.d
  o.n++
  offsets.set(x.season, o)
}
const left = (x) => x.d - offsets.get(x.season).s / offsets.get(x.season).n
const worst = [...srsDiffs].sort((a, b) => Math.abs(left(b)) - Math.abs(left(a))).slice(0, 8)
say("The largest gaps once each season's mean gap is taken out:", '')
table(
  ['Season', 'Team', 'Metis', 'Sports Reference', 'Gap', 'Centred gap'],
  worst.map((x) => [label(x.season), name.get(x.id), f(x.ours), f(x.theirs), f(x.d), f(left(x))])
)

// ---- 2. PER, WS and WS/40 of the leaders.
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z]/g, '')
function leaders(season, stat) {
  const file = join(PROBE, `sr-leaders-${gender}-${season}.html`)
  if (!existsSync(file)) return []
  const html = readFileSync(file, 'utf8')
  const i = html.indexOf(`id="leaders_${stat}"`)
  if (i < 0) return []
  const block = html.slice(i, html.indexOf('</div>\n\n<div id="leaders_', i + 10))
  return [
    ...block.matchAll(
      /<a href='\/cbb\/players\/[^']*'>([^<]*)<\/a> <small>([^<]*)<\/small><\/span>\s*<span class="value">\s*(-?[0-9.]+)/g
    )
  ].map((m) => ({ player: m[1], school: m[2], value: Number(m[3]) }))
}
say('## PER, Win Shares and WS/40 against Sports Reference', '')
say(
  "Each season's ten leaders on Sports Reference's leaders page, matched by name (and school where two share a name), against the engine's value over every counted game of the season. Tolerance stated before the run: PER within 0.5, Win Shares within 0.3, WS/40 within 0.01.",
  ''
)
const players = new Map()
for (const season of done) {
  const rows =
    await read(`SELECT p.player_id, any_value(p.name) AS name, list(DISTINCT pg.team_id) AS teams,
      sum(pg.minutes) AS mp
    FROM player_game pg JOIN player p USING (player_id)
    WHERE pg.season = ${season} AND pg.game_type <> 'preseason' GROUP BY 1`)
  const byName = new Map()
  for (const r of rows) {
    const k = norm(r.name ?? '')
    byName.set(k, [...(byName.get(k) ?? []), r])
  }
  players.set(season, byName)
}
const compRows = []
const tallies = { per: [0, 0], ws: [0, 0], ws_per_40: [0, 0] }
const TOL = { per: 0.5, ws: 0.3, ws_per_40: 0.01 }
const METRIC = { per: 'per', ws: 'ws', ws_per_40: 'ws_48' }
let missing = 0
for (const season of done) {
  for (const stat of ['per', 'ws', 'ws_per_40']) {
    const list = leaders(season, stat)
    const ids = []
    for (const l of list) {
      const cands = players.get(season).get(norm(l.player)) ?? []
      let pick = cands
      // Two players of one name (an Angel Reese at LSU, another at LSU Shreveport, outside Division I):
      // a leader plays the most minutes of them.
      if (cands.length > 1) pick = [...cands].sort((a, b) => b.mp - a.mp)
      ids.push(pick[0] ? String(pick[0].player_id) : null)
    }
    const wanted = ids.filter((x) => x !== null)
    const { rows } = await engine('player', [METRIC[stat]], season, { players: wanted })
    list.forEach((l, i) => {
      const v = ids[i] === null ? null : (rows.get(ids[i])?.[METRIC[stat]] ?? null)
      if (v === null) missing++
      const ok = v !== null && Math.abs(v - l.value) <= TOL[stat] + 1e-9
      tallies[stat][0] += ok ? 1 : 0
      tallies[stat][1]++
      // And within twice the tolerance, to show how near the misses are.
      tallies[stat][2] =
        (tallies[stat][2] ?? 0) +
        (v !== null && Math.abs(v - l.value) <= 2 * TOL[stat] + 1e-9 ? 1 : 0)
      const d = stat === 'ws_per_40' ? 3 : 1
      if (i < 3)
        compRows.push([
          label(season),
          stat === 'ws_per_40' ? 'WS/40' : stat.toUpperCase(),
          l.player,
          l.school,
          f(l.value, d),
          f(v, d),
          ok ? 'yes' : 'no'
        ])
    })
  }
}
table(
  ['Stat', 'Leaders', 'Within tolerance', 'Within twice it'],
  Object.entries(tallies).map(([k, [a, b, c]]) => [
    k === 'ws_per_40' ? 'WS/40' : k.toUpperCase(),
    b,
    `${a} (${pct(a, b)})`,
    `${c} (${pct(c, b)})`
  ])
)
say(`${missing} leaders had no value from the engine (no match by name).`, '')
say("Each season's top three:", '')
table(
  ['Season', 'Stat', 'Player', 'School', 'Sports Reference', 'Metis', 'Within tolerance'],
  compRows
)

// ---- 3. Elo out of sample.
const TEST = done.at(-1)
const fitted = await read(`SELECT e.win_prob AS p, (e.elo > e.elo_pre) AS won, e.neutral
  FROM elo_game e WHERE e.home AND e.season BETWEEN ${done[1]} AND ${TEST - 1}`)
const homeRows = fitted.filter((r) => !r.neutral)
const homeRate = homeRows.filter((r) => r.won).length / homeRows.length
const test = await read(`SELECT e.win_prob AS p, (e.elo > e.elo_pre) AS won, e.neutral, e.game_type
  FROM elo_game e WHERE e.home AND e.season = ${TEST}`)
const brier = (rows, p = (r) => r.p) =>
  rows.reduce((s, r) => s + (p(r) - (r.won ? 1 : 0)) ** 2, 0) / rows.length
const logLoss = (rows, p = (r) => r.p) =>
  -rows.reduce((s, r) => s + Math.log(r.won ? p(r) : 1 - p(r)), 0) / rows.length
const base = (r) => (r.neutral ? 0.5 : homeRate)
say('## Elo, out of sample', '')
say(
  `The constants were fitted on ${label(done[0])} to ${label(TEST - 1)}; ${label(TEST)}'s ${test.length} games between Division I teams, read from the built \`elo_game\` table (a win is a rating that rose). Brier ${f(brier(test), 4)} and log loss ${f(logLoss(test), 4)}, against the home side's rate of ${label(done[1])} to ${label(TEST - 1)} at a home court (${f(100 * homeRate, 1)} %) and a coin at a neutral site: ${f(brier(test, base), 4)} and ${f(logLoss(test, base), 4)}. The postseason alone (${test.filter((r) => r.game_type !== 'regular').length} games): log loss ${f(logLoss(test.filter((r) => r.game_type !== 'regular')), 4)}.`,
  ''
)
const tenths = Array.from({ length: 10 }, () => ({ n: 0, p: 0, w: 0 }))
for (const r of test) {
  const t = tenths[Math.min(9, Math.floor(r.p * 10))]
  t.n++
  t.p += r.p
  t.w += r.won ? 1 : 0
}
table(
  ['Home side given', 'Games', 'Given', 'Won'],
  tenths.map((t, i) => [
    `${i * 10}–${i * 10 + 10} %`,
    t.n,
    t.n ? f((100 * t.p) / t.n, 1) : '–',
    t.n ? f((100 * t.w) / t.n, 1) : '–'
  ])
)

// ---- 4. Against SportsDataverse's published ratings.
say("## Against SportsDataverse's published ratings", '')
say(
  "Spearman's rank correlation over Division I teams, per season, of Metis's adjusted net rating and SRS after the last game with SportsDataverse's adjusted efficiency margin (its `*_ratings` file, published for every game of the season), each read through the engine. A check, not a correction: the two sit side by side under their own names.",
  ''
)
const corr = []
for (const season of done) {
  const d1 = await divisionI(season)
  const { rows, reasons } = await engine(
    'team',
    ['team_adj_nrtg', 'team_srs', 'sdv_adj_em', 'team_elo'],
    season,
    {
      gameTypes: counted
    }
  )
  const keep = [...rows.entries()].filter(
    ([id, v]) => d1.has(id) && v.team_adj_nrtg !== null && v.sdv_adj_em !== null
  )
  corr.push([
    label(season),
    keep.length,
    f(
      spearman(
        keep.map(([, v]) => v.team_adj_nrtg),
        keep.map(([, v]) => v.sdv_adj_em)
      ),
      3
    ),
    f(
      spearman(
        keep.map(([, v]) => v.team_srs),
        keep.map(([, v]) => v.sdv_adj_em)
      ),
      3
    ),
    f(
      spearman(
        keep.filter(([, v]) => v.team_elo !== null).map(([, v]) => v.team_elo),
        keep.filter(([, v]) => v.team_elo !== null).map(([, v]) => v.sdv_adj_em)
      ),
      3
    ),
    reasons[3] ?? ''
  ])
}
table(['Season', 'Teams', 'Adjusted net', 'SRS', 'Elo', 'Elo reason'], corr)

// ---- 5. Top ten beside the NCAA tournament.
say('## Top ten, beside the NCAA tournament', '')
say(
  "Each season's ten best Division I teams by the adjusted net rating and by Elo after their last game (every counted game, the postseason included, so the ratings have seen the tournament), with how far each went in the NCAA tournament (`game_type` playoffs: First Four, Round of 64, 32, Sweet 16, Elite Eight, Final Four, final). Elo's first season is its burn-in and reads its reason.",
  ''
)
const ROUNDS = [
  ['Final', 1],
  ['Final Four', 2],
  ['Elite Eight', 4],
  ['Sweet 16', 8],
  ['Round of 32', 16],
  ['Round of 64', 32],
  ['First Four', 4]
]
for (const season of done) {
  const games =
    await read(`SELECT game_id, home_team_id AS h, away_team_id AS a, home_score AS hs, away_score AS as_
    FROM game WHERE season = ${season} AND game_type = 'playoffs' AND played ORDER BY game_date DESC, game_id DESC`)
  const reached = new Map()
  let i = 0
  for (const [round, n] of ROUNDS) {
    for (let k = 0; k < n && i < games.length; k++, i++) {
      const g = games[i]
      for (const t of [g.h, g.a]) if (!reached.has(String(t))) reached.set(String(t), round)
      if (round === 'Final') reached.set(String(g.hs > g.as_ ? g.h : g.a), 'Champion')
    }
  }
  const { rows } = await engine('team', ['team_adj_nrtg', 'team_elo'], season, {
    gameTypes: counted
  })
  const d1 = await divisionI(season)
  const list = [...rows.entries()].filter(([id]) => d1.has(id))
  const top = (k) =>
    list
      .filter(([, v]) => v[k] !== null)
      .sort((a, b) => b[1][k] - a[1][k])
      .slice(0, 10)
  const adj = top('team_adj_nrtg')
  const elo = top('team_elo')
  say(`### ${label(season)}`, '')
  table(
    ['Rank', 'Adjusted net', '', 'NCAA tournament', 'Elo', '', 'NCAA tournament'],
    Array.from({ length: 10 }, (_, r) => [
      r + 1,
      adj[r] ? name.get(adj[r][0]) : '–',
      adj[r] ? f(adj[r][1].team_adj_nrtg, 1) : '',
      adj[r] ? (reached.get(adj[r][0]) ?? 'Not in the field') : '',
      elo[r] ? name.get(elo[r][0]) : '(burn-in)',
      elo[r] ? f(elo[r][1].team_elo, 0) : '',
      elo[r] ? (reached.get(elo[r][0]) ?? 'Not in the field') : ''
    ])
  )
  const champ = [...reached.entries()].find(([, r]) => r === 'Champion')?.[0]
  const rankOf = (l, id) =>
    l
      .filter(([, v]) => v !== null)
      .sort((a, b) => b[1] - a[1])
      .findIndex(([t]) => t === id) + 1
  if (champ) {
    say(
      `Champion: ${name.get(champ)}, ranked ${rankOf(
        list.map(([id, v]) => [id, v.team_adj_nrtg]),
        champ
      )} by the adjusted net rating and ${
        rankOf(
          list.map(([id, v]) => [id, v.team_elo]),
          champ
        ) || '–'
      } by Elo.`,
      ''
    )
  }
}

// ---- 6. Through the engine against the tables.
say('## Through the engine, against the tables', '')
const eq = []
for (const season of [done[1], TEST]) {
  const { rows } = await engine('team', ['team_srs', 'team_elo', 'team_adj_nrtg'], season, {
    gameTypes: counted
  })
  const t = await read(`SELECT s.team_id, s.srs, e.elo, a.adj_nrtg FROM
      (SELECT team_id, arg_max(srs, (game_date, game_id)) AS srs FROM team_strength WHERE season = ${season} GROUP BY 1) s
      LEFT JOIN (SELECT team_id, arg_max(elo, (game_date, game_id)) AS elo FROM elo_game WHERE season = ${season} GROUP BY 1) e USING (team_id)
      LEFT JOIN (SELECT team_id, arg_max(adj_nrtg, (game_date, game_id)) AS adj_nrtg FROM adjusted_rating WHERE season = ${season} GROUP BY 1) a USING (team_id)`)
  let same = 0
  for (const r of t) {
    const v = rows.get(String(r.team_id))
    if (
      v &&
      Math.abs(v.team_srs - r.srs) < 1e-9 &&
      Math.abs((v.team_elo ?? NaN) - (r.elo ?? NaN)) < 1e-9 &&
      Math.abs(v.team_adj_nrtg - r.adj_nrtg) < 1e-9
    )
      same++
  }
  const pt = await read(`SELECT player_id, sum(per_num) / sum(cmp_minutes) AS per, sum(ws) AS ws
    FROM player_composite WHERE season = ${season} AND team_id IS NOT NULL GROUP BY 1`)
  // Named 64 at a time (the engine's limit), so every player is read, not only a board's rows.
  const p = { rows: new Map() }
  for (let i = 0; i < pt.length; i += 64) {
    const ids = pt.slice(i, i + 64).map((r) => String(r.player_id))
    const part = await engine('player', ['per', 'ws'], season, { gameTypes: counted, players: ids })
    for (const [k, v] of part.rows) p.rows.set(k, v)
  }
  let psame = 0
  for (const r of pt) {
    const v = p.rows.get(String(r.player_id))
    if (v && Math.abs(v.per - r.per) < 1e-9 && Math.abs(v.ws - r.ws) < 1e-9) psame++
  }
  eq.push([label(season), `${same} of ${t.length}`, `${psame} of ${pt.length}`])
}
table(['Season', 'Teams: SRS, Elo and adjusted net equal', 'Players: PER and WS equal'], eq)

const stab = await read(`SELECT reliability, count(*) AS n FROM metric_stability
  WHERE season = (SELECT max(season) FROM metric_stability) GROUP BY 1 ORDER BY 2 DESC`)
const through = await read(`SELECT max(through) AS t, max(pairs) AS p FROM metric_stability`)
say('## Stability', '')
say(
  `Measured through ${label(Number(through[0].t))} on the league's own seasons, players across transfers one player (ESPN's athlete id). Labels: ${stab.map((r) => `${r.reliability ?? 'not measured'} ${r.n}`).join(', ')}; the most pairs a metric had: ${through[0].p}.`,
  ''
)
const some =
  await read(`SELECT metric_id, year_to_year, pairs, split_half, reliability FROM metric_stability
  WHERE season = (SELECT max(season) FROM metric_stability)
    AND metric_id IN ('pts', 'per', 'ws', 'fg3_pct', 'ts_pct', 'team_srs', 'team_adj_nrtg', 'team_elo', 'usg_pct')
  ORDER BY metric_id`)
table(
  ['Metric', 'Year to year', 'Pairs', 'Split half', 'Label'],
  some.map((r) => [
    r.metric_id,
    f(r.year_to_year, 3),
    r.pairs,
    f(r.split_half, 3),
    r.reliability ?? '–'
  ])
)
const transfers = await read(`WITH s AS (
    SELECT player_id, season, list(DISTINCT team_id) AS teams FROM player_game
    WHERE game_type <> 'preseason' GROUP BY 1, 2)
  SELECT count(*) AS n FROM s a JOIN s b ON b.player_id = a.player_id AND b.season = a.season + 1
  WHERE NOT list_has_any(a.teams, b.teams)`)
say(
  `Player-season pairs across a transfer (a player whose next season was for another team): ${transfers[0].n}, each one player's pair.`,
  ''
)

if (mdArg) writeFileSync(resolve(mdArg), out.join('\n') + '\n')
await close()
