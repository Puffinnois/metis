#!/usr/bin/env node
// Checks the shot tables (Plan T903) on a real load, through the built worker, and writes the report
// the data doc quotes. Per season:
//
// 1. Zone sums equal shot totals: on every player-game and team-game row, attempts and makes summed
//    over the zones, over the distance bands and over the types equal the row's shots; and every
//    player-game and team-game in `shot_nba` has a row with the same attempts and makes.
// 2. The zones recounted here from the coordinates, by the rule written out again below, against the
//    tables' zones; the published value against where the three-point line is. The NBA's file has
//    no zone column to compare with (checked: no table of a full load has one).
// 3. The shot rows against the box scores: FGA, FGM, 3PA and 3PM, per team-game and player-game,
//    per season type; the corner and above-the-break threes with the backcourt ones summing to 3PA.
// 4. ESPN's shots against the box scores, apart: reported, never merged.
// 5. The league's FG% by distance from the shots against the dataset's curves.
// 6. Shot types: the share no rule maps.
//
// Tolerance: "exact" means equal; nothing is tuned. Only counted game types with a box score.
//
// usage: node scripts/check-shots.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-shots.mjs <folder> [out.md]')
  process.exit(2)
}

const { read, call, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map((_, i) => (i < 1 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  ''
]
const COUNTED = "('regular', 'play-in', 'playoffs', 'cup-final')"
const ZONES = ['ra', 'paint', 'mid', 'c3l', 'c3r', 'atb3', 'back', 'unk']
const BANDS = ['lt8', 'd8_16', 'd16_24', 'd24p']
const TYPES = ['dunk', 'tip', 'layup', 'hook', 'floater', 'jumper', 'other']
const sum = (keys, m, p = '') => keys.map((k) => `${p}${k}_${m}`).join(' + ')

// The zone rule written out again, by hand, so a slip in the app's SQL shows here.
const ZONE = `CASE
  WHEN abs(x) > 500 OR y < -100 OR y > 940 OR x IS NULL OR y IS NULL THEN 'unk'
  WHEN y > 422.5 THEN 'back'
  WHEN coalesce(value = 3, (abs(x) >= 220 AND y <= 92.5) OR x*x + y*y >= 237.5*237.5)
    THEN CASE WHEN y <= 92.5 THEN (CASE WHEN x < 0 THEN 'c3l' ELSE 'c3r' END) ELSE 'atb3' END
  WHEN x*x + y*y <= 1600 THEN 'ra'
  WHEN abs(x) <= 80 AND y <= 142.5 THEN 'paint'
  ELSE 'mid' END`

const out = ['# Shot tables: checks', '']
const timed = async (sql) => {
  const at = Date.now()
  const rows = await read(sql)
  return { rows, ms: Date.now() - at }
}

// 1. Zone sums.
{
  const parts = (p) =>
    ['fga', 'fgm']
      .flatMap((m) => [
        `count(*) FILTER (WHERE ${sum(ZONES, m, p)} <> ${p}shots_${m}) AS z_${p}${m}`,
        `count(*) FILTER (WHERE ${sum(BANDS, m, p)} <> ${p}shots_${m}) AS b_${p}${m}`,
        `count(*) FILTER (WHERE ${sum(TYPES, m, p)} <> ${p}shots_${m}) AS t_${p}${m}`
      ])
      .join(', ')
  const pg = await read(`SELECT season, count(*)::INTEGER AS n, ${parts('')}
    FROM shot_player_game GROUP BY season ORDER BY season`)
  const tg = await read(`SELECT season, count(*)::INTEGER AS n, ${parts('')}, ${parts('opp_')}
    FROM shot_team_game GROUP BY season ORDER BY season`)
  // Every player-game of the shot rows has a row with the same attempts and makes.
  const raw = await read(`WITH s AS (
      SELECT season, game_id, player_id, count(*) AS fga, count(*) FILTER (WHERE made) AS fgm
      FROM shot_nba WHERE player_id IS NOT NULL GROUP BY ALL)
    SELECT s.season, count(*)::INTEGER AS n,
           count(*) FILTER (WHERE t.shots_fga IS DISTINCT FROM s.fga
                              OR t.shots_fgm IS DISTINCT FROM s.fgm)::INTEGER AS off
    FROM s LEFT JOIN (SELECT game_id, player_id, sum(shots_fga) AS shots_fga,
                             sum(shots_fgm) AS shots_fgm
                      FROM shot_player_game GROUP BY ALL) t USING (game_id, player_id)
    GROUP BY s.season ORDER BY s.season`)
  const rawBy = new Map(raw.map((r) => [r.season, r]))
  const tgBy = new Map(tg.map((r) => [r.season, r]))
  out.push('## 1. Zone sums equal shot totals', '')
  out.push(
    'Rows whose zones, bands or types do not add up to their shots (attempts or makes), and shot-row player-games whose table row differs.',
    ''
  )
  out.push(
    ...table(
      [
        'Season',
        'Player-games',
        'Off (zones, bands, types)',
        'Team-games',
        'Off (both sides)',
        'Shot rows → table off'
      ],
      pg.map((r) => {
        const t = tgBy.get(r.season)
        const offP = ['z_', 'b_', 't_'].reduce((a, k) => a + r[`${k}fga`] + r[`${k}fgm`], 0)
        const offT = t
          ? ['z_', 'b_', 't_'].reduce(
              (a, k) => a + t[`${k}fga`] + t[`${k}fgm`] + t[`${k}opp_fga`] + t[`${k}opp_fgm`],
              0
            )
          : '–'
        return [
          label(r.season),
          COUNT.format(r.n),
          offP,
          t ? COUNT.format(t.n) : '–',
          offT,
          `${rawBy.get(r.season)?.off ?? '–'} of ${COUNT.format(rawBy.get(r.season)?.n ?? 0)}`
        ]
      })
    )
  )
}

// 2. The zones recounted, and the value against the line.
{
  const re = await read(`WITH s AS (SELECT season, ${ZONE} AS zone, value, x, y FROM shot_nba)
    SELECT season, ${ZONES.map((z) => `count(*) FILTER (WHERE zone = '${z}')::INTEGER AS ${z}`).join(', ')},
           count(*) FILTER (WHERE value = 3 AND x*x + y*y < 237.5*237.5 AND abs(x) < 220)::INTEGER AS three_inside,
           count(*) FILTER (WHERE value = 2 AND ((abs(x) >= 225 AND y <= 92.5) OR x*x + y*y >= 245*245))::INTEGER AS two_outside,
           count(*)::INTEGER AS n
    FROM s GROUP BY season ORDER BY season`)
  const tb = await read(`SELECT season, ${ZONES.map((z) => `sum(${z}_fga)::INTEGER AS ${z}`).join(', ')}
    FROM shot_team_game GROUP BY season ORDER BY season`)
  const tbBy = new Map(tb.map((r) => [r.season, r]))
  out.push('## 2. Zones recounted from the coordinates', '')
  out.push(
    'The NBA’s file publishes no zone. Here the zones are recounted by the rule written out again in this script, against the tables (team-games, own shots). "3 inside" is a three whose point is inside the arc and the corner lines; "2 outside" a two more than half a foot beyond them. 1996-97 had a 22-foot line all round, so its threes inside the arc are expected.',
    ''
  )
  out.push(
    ...table(
      ['Season', 'Shots', ...ZONES.map((z) => `${z} %`), 'Recount = table', '3 inside', '2 outside'],
      re.map((r) => {
        const t = tbBy.get(r.season)
        const same = t && ZONES.every((z) => t[z] === r[z])
        return [
          label(r.season),
          COUNT.format(r.n),
          ...ZONES.map((z) => pct(r[z], r.n)),
          same ? 'yes' : 'NO',
          r.three_inside,
          r.two_outside
        ]
      })
    )
  )
}

// 3. Shot rows against the box scores.
{
  const team = await read(`WITH s AS (
      SELECT game_id, team_id, count(*) AS fga, count(*) FILTER (WHERE made) AS fgm,
             count(*) FILTER (WHERE value = 3) AS fg3a, count(*) FILTER (WHERE value = 3 AND made) AS fg3m
      FROM shot_nba GROUP BY ALL),
    z AS (SELECT game_id, team_id, c3l_fga + c3r_fga + atb3_fga AS c_atb, shots_fg3a FROM shot_team_game)
    SELECT t.season, t.game_type, count(*)::INTEGER AS n,
           count(*) FILTER (WHERE s.fga = t.fga)::INTEGER AS fga,
           count(*) FILTER (WHERE s.fgm = t.fgm)::INTEGER AS fgm,
           count(*) FILTER (WHERE s.fg3a = t.fg3a)::INTEGER AS fg3a,
           count(*) FILTER (WHERE s.fg3m = t.fg3m)::INTEGER AS fg3m,
           count(*) FILTER (WHERE s.fga = t.fga AND s.fgm = t.fgm AND s.fg3a = t.fg3a
                              AND s.fg3m = t.fg3m)::INTEGER AS all4,
           coalesce(sum(z.c_atb), 0)::INTEGER AS c_atb, coalesce(sum(z.shots_fg3a), 0)::INTEGER AS fg3a_rows
    FROM team_game t
    LEFT JOIN s USING (game_id, team_id) LEFT JOIN z USING (game_id, team_id)
    WHERE t.season >= 1997 AND t.game_type IN ${COUNTED} AND t.fga IS NOT NULL
    GROUP BY 1, 2 ORDER BY 2 DESC, 1`)
  const player = await read(`WITH s AS (
      SELECT game_id, player_id, count(*) AS fga, count(*) FILTER (WHERE made) AS fgm,
             count(*) FILTER (WHERE value = 3) AS fg3a, count(*) FILTER (WHERE value = 3 AND made) AS fg3m
      FROM shot_nba WHERE player_id IS NOT NULL GROUP BY ALL)
    SELECT p.season, p.game_type, count(*)::INTEGER AS n,
           count(*) FILTER (WHERE coalesce(s.fga, 0) = p.fga AND coalesce(s.fgm, 0) = p.fgm
                              AND coalesce(s.fg3a, 0) = p.fg3a AND coalesce(s.fg3m, 0) = p.fg3m)::INTEGER AS all4
    FROM player_game p LEFT JOIN s USING (game_id, player_id)
    WHERE p.season >= 1997 AND p.game_type IN ${COUNTED} AND p.fga IS NOT NULL
    GROUP BY 1, 2 ORDER BY 2 DESC, 1`)
  const backThrees = await read(`SELECT season,
      count(*) FILTER (WHERE value = 3 AND ${ZONE} = 'back')::INTEGER AS back3,
      count(*) FILTER (WHERE value = 3 AND ${ZONE} = 'unk')::INTEGER AS unk3
    FROM shot_nba WHERE game_type = 'regular' GROUP BY season`)
  const b3 = new Map(backThrees.map((r) => [r.season, r]))
  const pBy = new Map(player.map((r) => [`${r.season}|${r.game_type}`, r]))
  out.push('## 3. Shot rows against the box scores', '')
  out.push(
    'Team-games exact on each count, all four together, and player-games exact on all four; then the corner and above-the-break threes, with the threes from beyond half court (and off the court), against the threes in the rows.',
    ''
  )
  out.push(
    ...table(
      [
        'Season',
        'Type',
        'Team-games',
        'FGA %',
        'FGM %',
        '3PA %',
        '3PM %',
        'All four %',
        'Player-games all four %',
        'Corner + ATB + back = 3PA'
      ],
      team.map((r) => {
        const p = pBy.get(`${r.season}|${r.game_type}`)
        const extra = b3.get(r.season)
        return [
          label(r.season),
          r.game_type,
          COUNT.format(r.n),
          pct(r.fga, r.n),
          pct(r.fgm, r.n),
          pct(r.fg3a, r.n),
          pct(r.fg3m, r.n),
          pct(r.all4, r.n),
          p ? pct(p.all4, p.n) : '–',
          r.game_type === 'regular' && extra
            ? `${COUNT.format(r.c_atb)} + ${extra.back3} + ${extra.unk3} of ${COUNT.format(r.fg3a_rows)}`
            : ''
        ]
      })
    )
  )
}

// 4. ESPN's shots against the box scores, apart.
{
  const espn = await read(`WITH s AS (
      SELECT game_id, team_id, count(*) FILTER (WHERE NOT free_throw) AS fga,
             count(*) FILTER (WHERE NOT free_throw AND made) AS fgm
      FROM shot_espn GROUP BY ALL)
    SELECT t.season, count(*)::INTEGER AS n, count(s.game_id)::INTEGER AS held,
           count(*) FILTER (WHERE s.fga = t.fga)::INTEGER AS fga,
           count(*) FILTER (WHERE s.fgm = t.fgm)::INTEGER AS fgm
    FROM team_game t LEFT JOIN s USING (game_id, team_id)
    WHERE t.season >= 2002 AND t.game_type = 'regular' AND t.fga IS NOT NULL
    GROUP BY 1 ORDER BY 1`)
  out.push('## 4. ESPN’s shots against the box scores (regular season, not read by any metric)', '')
  out.push(
    'ESPN’s shot file counts heaves and its own field-goal rows; it is reported here and never merged with the NBA’s.',
    ''
  )
  out.push(
    ...table(
      ['Season', 'Team-games', 'With ESPN shots', 'FGA exact %', 'FGM exact %'],
      espn.map((r) => [
        label(r.season),
        COUNT.format(r.n),
        COUNT.format(r.held),
        pct(r.fga, r.n),
        pct(r.fgm, r.n)
      ])
    )
  )
}

// 5. The league by distance: the shots against the dataset's curves.
{
  const cmp = await read(`WITH c AS (
      SELECT season, x_lo, x_hi, attempts, successes, rate FROM src_nba_metric_curves
      WHERE entity_type = 'league' AND metric = 'fg_pct_by_shot_distance'),
    s AS (SELECT season, sqrt(x*x + y*y) / 10 AS d, made FROM shot_nba),
    j AS (SELECT c.season, c.x_lo, c.attempts, c.rate,
                 count(s.d)::INTEGER AS a, avg(s.made::INTEGER) AS r
          FROM c LEFT JOIN s ON s.season = c.season AND s.d >= c.x_lo AND s.d < c.x_hi
          GROUP BY ALL)
    SELECT season, sum(attempts)::INTEGER AS c_att, sum(a)::INTEGER AS s_att,
           max(abs(rate - r)) FILTER (WHERE attempts >= 1000) AS max_diff,
           sum(abs(rate - r) * attempts) / sum(attempts) AS mean_diff
    FROM j GROUP BY season ORDER BY season`)
  out.push('## 5. League FG% by distance: shots against the dataset’s curves', '')
  out.push(
    'The curves bin by the exact distance (floor of the coordinates’ distance in feet) over every season type; the shots here are binned the same way, all season types. The differences are in percentage points: the largest over bins of 1,000 attempts or more, and the mean weighted by attempts. The metrics’ league figure is recomputed from the regular-season shots by zone, band and type, which the curves cannot give.',
    ''
  )
  out.push(
    ...table(
      ['Season', 'Curve attempts', 'Shot rows', 'Largest diff (pts)', 'Mean diff (pts)'],
      cmp.map((r) => [
        label(r.season),
        COUNT.format(r.c_att),
        COUNT.format(r.s_att),
        r.max_diff === null ? '–' : (100 * r.max_diff).toFixed(2),
        r.mean_diff === null ? '–' : (100 * r.mean_diff).toFixed(2)
      ])
    )
  )
}

// 6. League rates by zone, and the types no rule maps.
{
  const lg = await read(`SELECT season, ${['ra', 'paint', 'mid', 'c3l', 'c3r', 'atb3']
    .map((z) => `sum(${z}_fgm) / nullif(sum(${z}_fga), 0) AS ${z}`)
    .join(', ')}, sum(other_fga)::INTEGER AS other, sum(shots_fga)::INTEGER AS n
    FROM shot_team_game WHERE game_type = 'regular' GROUP BY season ORDER BY season`)
  out.push('## 6. League FG% by zone (regular season) and unmapped types', '')
  out.push(
    ...table(
      ['Season', 'RA', 'Paint', 'Mid', 'L corner 3', 'R corner 3', 'ATB 3', 'Type unmapped'],
      lg.map((r) => [
        label(r.season),
        ...['ra', 'paint', 'mid', 'c3l', 'c3r', 'atb3'].map((z) =>
          r[z] === null ? '–' : (100 * r[z]).toFixed(1)
        ),
        `${r.other} (${pct(r.other, r.n)} %)`
      ])
    )
  )
}

// 7. Speed of the reads, warm, median of five.
{
  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const time = async (fn) => {
    await fn()
    const xs = []
    for (let i = 0; i < 5; i++) {
      const at = Date.now()
      await fn()
      xs.push(Date.now() - at)
    }
    return median(xs)
  }
  const scope = { gameTypes: ['regular'] }
  const top = await timed(
    `SELECT player_id FROM shot_player_game WHERE season = 2026 GROUP BY 1 ORDER BY sum(shots_fga) DESC LIMIT 1`
  )
  const busy = String(top.rows[0]?.player_id ?? '201939')
  const reads = [
    [
      'A player’s chart, 2025-26',
      () => call('shots', { request: { entity: 'player', id: busy, seasons: [2026], scope } })
    ],
    [
      'A player’s chart, Dec 2025',
      () =>
        call('shots', {
          request: {
            entity: 'player',
            id: busy,
            seasons: [2026],
            scope: { ...scope, dates: ['2025-12-01', '2025-12-31'] }
          }
        })
    ],
    [
      'A team’s chart, 2025-26',
      () =>
        call('shots', {
          request: { entity: 'team', id: '1610612738', seasons: [2026], scope, side: 'offense' }
        })
    ],
    [
      'A team’s chart against, 2025-26',
      () =>
        call('shots', {
          request: { entity: 'team', id: '1610612738', seasons: [2026], scope, side: 'defense' }
        })
    ],
    [
      'A career chart (capped), 1996-97 on',
      () =>
        call('shots', {
          request: {
            entity: 'player',
            id: '2544',
            seasons: Array.from({ length: 31 }, (_, i) => 1997 + i),
            scope
          }
        })
    ],
    [
      'Leaderboard, ten zone metrics, 2025-26',
      () =>
        call('query', {
          query: {
            entity: 'player',
            metrics: [
              'shot_ra_fg_pct',
              'shot_paint_fg_pct',
              'shot_mid_fg_pct',
              'shot_c3_fg_pct',
              'shot_atb3_fg_pct',
              'shot_ra_freq',
              'shot_mid_freq',
              'shot_atb3_freq',
              'shot_ra_fg_rel',
              'shot_avg_dist'
            ],
            scope: { seasons: [2026] },
            limit: 100
          }
        })
    ],
    [
      'The same over a date range',
      () =>
        call('query', {
          query: {
            entity: 'player',
            metrics: ['shot_ra_fg_pct', 'shot_mid_freq', 'shot_atb3_freq', 'shot_ra_fg_rel'],
            scope: { seasons: [2026], dates: ['2025-12-01', '2025-12-31'] },
            limit: 100
          }
        })
    ],
    [
      'Team board, both sides, 2025-26',
      () =>
        call('query', {
          query: {
            entity: 'team',
            metrics: ['team_shot_ra_fg_pct', 'opp_shot_ra_fg_pct', 'team_shot_c3_freq', 'opp_shot_c3_freq'],
            scope: { seasons: [2026] }
          }
        })
    ]
  ]
  const rows = []
  for (const [what, fn] of reads) rows.push([what, await time(fn)])
  out.push('## 7. Speed of the reads (warm, median of five, ms)', '')
  out.push(...table(['Read', 'ms'], rows))
}

await close()
const text = out.join('\n')
if (mdFile) writeFileSync(mdFile, text)
console.log(text)
