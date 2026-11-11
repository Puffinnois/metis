#!/usr/bin/env node
// Times the query engine on a loaded stats database: what a screen asks for, each run a few times.
// Build first. Prints the median and worst in milliseconds, inside the worker.
//
// usage: node scripts/engine-speed.mjs <folder holding stats.duckdb> [season]
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const folder = resolve(process.argv[2] ?? '')
const season = Number(process.argv[3] ?? 2026)
if (!process.argv[2]) {
  console.error('usage: node scripts/engine-speed.mjs <folder> [season]')
  process.exit(2)
}

const PLAYER_COLUMNS = [
  'min',
  'pts',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'fg_pct',
  'fg3_pct',
  'ft_pct'
]
const ALL_PLAYER = [
  ...PLAYER_COLUMNS,
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'pf',
  'plus_minus',
  'efg_pct',
  'ts_pct',
  'usg_pct',
  'ast_pct',
  'trb_pct',
  'stl_pct',
  'blk_pct',
  'tov_pct',
  'fg3a_rate',
  'fta_rate',
  'ast_tov',
  'eff',
  'gmsc',
  'pie',
  'dd2',
  'td3',
  'share_pts',
  'share_reb',
  'share_ast',
  'orb_pct'
]
const player = (scope, extra = {}) => ({
  entity: 'player',
  metrics: PLAYER_COLUMNS,
  scope: { seasons: [season], ...scope },
  limit: 1000,
  ...extra
})
const team = (scope, extra = {}) => ({
  entity: 'team',
  metrics: [
    'team_w',
    'team_l',
    'team_pts',
    'opp_pts',
    'team_ortg',
    'team_drtg',
    'team_nrtg',
    'team_pace'
  ],
  scope: { seasons: [season], ...scope },
  limit: 100,
  ...extra
})

const CASES = [
  ['A leaderboard: ten columns, one season', player({})],
  ['The same, per game', player({}, { transform: 'perGame' })],
  ['40 columns', player({}, { metrics: ALL_PLAYER.slice(0, 40) })],
  ['A home board', player({ qualifiedOnly: true }, { metrics: ['pts'], transform: 'perGame' })],
  ['A team leaderboard', team({})],
  ['A date range', player({ dates: [`${season - 1}-12-01`, `${season}-01-31`] })],
  ['Last 10 appearances', player({ lastN: 10 })],
  ["Last 10 of the team's games", player({ lastN: 10, lastNOf: 'team' })],
  ['Home games', player({ home: true })],
  ['Against one conference', player({ conferences: ['west'] })],
  ['Off the bench', player({ starter: false })],
  ['Back-to-backs', player({ restDays: [0, 0] })],
  ['After the All-Star break', player({ allStarBreak: 'after' })],
  ['In wins', player({ result: 'win' })],
  ['One month', player({ months: [1] })],
  ['By month', player({}, { groupBy: ['month'], limit: 5000 })],
  ['By opponent', player({}, { groupBy: ['opponent'], limit: 5000 })],
  ['One player by game', player({ players: ['2544'] }, { groupBy: ['game'] })],
  [
    'Every season: by season, one player',
    player(
      { seasons: Array.from({ length: season - 1993 }, (_, i) => 1994 + i), players: ['2544'] },
      { groupBy: ['season'] }
    )
  ],
  [
    'Every season: one leaderboard',
    player({ seasons: Array.from({ length: season - 1993 }, (_, i) => 1994 + i) })
  ],
  [
    'Every season by season: all players',
    player(
      { seasons: Array.from({ length: season - 1993 }, (_, i) => 1994 + i) },
      { groupBy: ['season'], limit: 5000 }
    )
  ],
  // Explore, as its tabs ask (lib/stats/chart.ts, compare.ts, trends.ts).
  [
    'Chart: a preset, every player',
    player(
      {},
      {
        metrics: ['usg_pct', 'ts_pct', 'min'],
        transform: 'perGame',
        sort: { metric: 'min', dir: 'desc' },
        limit: 5000
      }
    )
  ],
  [
    'Chart: a box-score axis, a tracking axis, size and colour',
    player(
      {},
      {
        metrics: ['pts', 'drives', 'ast', 'ts_pct', 'min'],
        transform: 'perGame',
        sort: { metric: 'min', dir: 'desc' },
        limit: 5000
      }
    )
  ],
  [
    'Chart: teams',
    team(
      {},
      { metrics: ['team_ortg', 'team_drtg', 'team_win_pct'], transform: 'perGame', limit: 5000 }
    )
  ],
  [
    'Compare: a season of players, 23 rows',
    player({}, { metrics: ALL_PLAYER.slice(0, 23), transform: 'perGame' })
  ],
  [
    'Compare: three players over every season',
    player(
      {
        seasons: Array.from({ length: season - 1993 }, (_, i) => 1994 + i),
        players: ['2544', '201939', '1629029']
      },
      { metrics: ALL_PLAYER.slice(0, 23), transform: 'perGame', limit: 3 }
    )
  ],
  [
    'Trends: one player by season',
    player(
      { seasons: Array.from({ length: season - 1993 }, (_, i) => 1994 + i), players: ['2544'] },
      { metrics: ['pts', 'min'], groupBy: ['season'], transform: 'perGame' }
    )
  ],
  [
    'Trends: the pool, 14 seasons by season',
    player(
      { seasons: Array.from({ length: 14 }, (_, i) => season - 13 + i), qualifiedOnly: true },
      {
        metrics: ['pts', 'min'],
        groupBy: ['season'],
        transform: 'perGame',
        sort: { metric: 'min', dir: 'desc' },
        limit: 5000
      }
    )
  ],
  [
    'Trends: every team by season',
    team(
      { seasons: Array.from({ length: season - 1993 }, (_, i) => 1994 + i) },
      { metrics: ['team_nrtg'], groupBy: ['season'], limit: 5000 }
    )
  ]
]

const { query, close } = openStatsWorker(folder)
const RUNS = 5
const rows = []
for (const [label, q] of CASES) {
  const times = []
  let n = 0
  for (let i = 0; i < RUNS; i++) {
    const at = performance.now()
    const r = await query(q)
    times.push(performance.now() - at)
    n = r.total
  }
  times.sort((a, b) => a - b)
  rows.push({ label, rows: n, median: Math.round(times[2]), worst: Math.round(times[RUNS - 1]) })
}
await close()
console.log('| Query | Rows | Median ms | Worst ms |')
console.log('| --- | --- | --- | --- |')
for (const r of rows) console.log(`| ${r.label} | ${r.rows} | ${r.median} | ${r.worst} |`)
console.log(`worst of all: ${Math.max(...rows.map((r) => r.worst))} ms`)
