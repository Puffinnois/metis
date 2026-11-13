#!/usr/bin/env node
// Times the query engine on a loaded stats database: what a screen asks for, each run a few times.
// Build first. Prints the median and worst in milliseconds, inside the worker.
//
// With --plays, the play level's reads instead (Plan T907), each cold in a new worker, then warm.
//
// usage: node scripts/engine-speed.mjs <folder holding stats.duckdb> [season] [--plays]
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const folder = resolve(process.argv[2] ?? '')
const season = Number(process.argv.slice(3).find((a) => !a.startsWith('--')) ?? 2026)
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

// The play level (Plan T907): every Stage 9 read at its worst realistic scope, as the screens ask
// it. A case is a query, or a function of the worker that makes the screen's calls at once and
// waits for all of them, as the screen does.
const SEASONS_PLAYS = Array.from({ length: season - 1996 }, (_, i) => 1997 + i)
const CURRY = '201939'
const LEBRON = '2544'
const OKC = '1610612760'
const BOS = '1610612738'
const regular = { gameTypes: ['regular'] }
const SPLIT_METRICS = ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov'].concat([
  'fg_pct',
  'fg3_pct',
  'ft_pct',
  'ts_pct',
  'plus_minus'
])
const TEAM_SPLIT_METRICS = ['team_pts', 'opp_pts', 'team_ortg', 'team_drtg', 'team_nrtg']
  .concat(['team_pace', 'team_efg_pct', 'opp_efg_pct', 'team_tov_pct', 'team_orb_pct'])
  .concat(['team_fta_rate'])
const PLAY_SPLITS = ['q1', 'q2', 'q3', 'q4', 'h1', 'h2', 'ot', 'clutch', 'ahead', 'tied']
  .concat(['behind', 'within5', 'ahead10', 'behind10', 'end2', 'last2', 'last1', 'garbage'])
  .concat(['nogarbage'])
const GAME_SPLITS = [{ home: true }, { home: false }, { result: 'win' }, { result: 'loss' }]
  .concat([{ allStarBreak: 'before' }, { allStarBreak: 'after' }, { restDays: [0, 0] }])
  .concat([{ restDays: [1, 1] }, { restDays: [2, 400] }, { conferences: ['east'] }])
  .concat([{ conferences: ['west'] }])
const SHOT_ZONES = ['ra_fg_pct', 'paint_fg_pct', 'mid_fg_pct', 'c3_fg_pct', 'atb3_fg_pct']
  .concat(['ra_freq', 'mid_freq', 'c3_freq', 'atb3_freq', 'ra_fg_rel', 'avg_dist', 'pps_above'])
  .map((m) => `shot_${m}`)
const ON_OFF = ['onc_min', 'onc_poss', 'onc_plus_minus', 'onc_ortg', 'onc_drtg', 'onc_net']
  .concat(['offc_ortg', 'offc_drtg', 'offc_net', 'onoff_ortg', 'onoff_drtg', 'onoff_net'])
  .concat(['onc_pace'])
const ON_RATES = ['onc_usg_pct', 'usg_pct', 'onc_ast_pct', 'ast_pct', 'onc_orb_pct', 'orb_pct']
  .concat(['onc_drb_pct', 'drb_pct', 'onc_trb_pct', 'trb_pct', 'onc_stl_pct', 'stl_pct'])
  .concat(['onc_blk_pct', 'blk_pct'])
const all = (calls) => Promise.all(calls).then((r) => ({ total: r.length }))
// A dashboard's Splits tab: the whole line, each game split, each play split, months, opponents.
const splitsTab = (entity, id, metrics, splits) => (w) => {
  const base = { seasons: [season], ...(entity === 'player' ? { players: [id] } : { teams: [id] }) }
  const q = (scope, extra = {}) =>
    w.query({ entity, metrics, scope, limit: 40, transform: 'perGame', ...extra })
  return all([
    q(base),
    ...GAME_SPLITS.map((p) => q({ ...base, ...p }, { limit: 1 })),
    ...splits.map((split) => q({ ...base, split }, { limit: 1 })),
    q(base, { groupBy: ['month'] }),
    q(base, { groupBy: ['opponent'] })
  ])
}
const shots =
  (entity, id, seasons, extra = {}) =>
  (w) =>
    w.call('shots', { request: { entity, id, seasons, scope: regular, ...extra } })
const units =
  (team, seasons, size, scope = regular) =>
  (w) =>
    all(seasons.map((s) => w.call('onCourtUnits', { team, season: s, scope, size })))
const lastSeasons = (n) => Array.from({ length: n }, (_, i) => season - n + 1 + i)

const PLAY_CASES = [
  // Splits (T902).
  ...['clutch', 'q4', 'garbage', 'ahead10', 'last2'].map((split) => [
    `Leaderboard of ten columns under ${split}`,
    player({ split })
  ]),
  [
    'A split by season over every season, all players (clutch)',
    player({ seasons: SEASONS_PLAYS, split: 'clutch' }, { groupBy: ['season'], limit: 5000 })
  ],
  [
    "The player's Splits tab (Curry, 31 queries)",
    splitsTab('player', CURRY, SPLIT_METRICS, PLAY_SPLITS)
  ],
  [
    "The team's Splits tab (Boston, 30 queries)",
    splitsTab('team', BOS, TEAM_SPLIT_METRICS, PLAY_SPLITS)
  ],
  // Shots (T903).
  ['Shot chart: a season (Curry)', shots('player', CURRY, [season])],
  ['Shot chart: a career (LeBron, every season)', shots('player', LEBRON, SEASONS_PLAYS)],
  ["Shot chart: a team's shots against", shots('team', BOS, [season], { side: 'defense' })],
  ['Zone leaderboard (the preset, 12 columns)', player({}, { metrics: SHOT_ZONES })],
  [
    'Zone leaderboard over every season',
    player({ seasons: SEASONS_PLAYS }, { metrics: SHOT_ZONES })
  ],
  // On/off and units (T904).
  [
    'On/off tab: both sections (every guard)',
    (w) =>
      all(
        [ON_OFF, ON_RATES].map((metrics) =>
          w.query({
            entity: 'player',
            metrics,
            scope: { seasons: [season], positions: ['G'] },
            limit: 5000
          })
        )
      )
  ],
  [
    'On/off by season over a career (LeBron)',
    player({ seasons: SEASONS_PLAYS, players: [LEBRON] }, { metrics: ON_OFF, groupBy: ['season'] })
  ],
  ["The team's On/off tab", player({ teams: [OKC] }, { metrics: ON_OFF.slice(0, 10), limit: 40 })],
  ...[2, 3, 4, 5].map((size) => [`Units of ${size}, a team-season`, units(OKC, [season], size)]),
  ...[2, 3, 4, 5].map((size) => [
    `Units of ${size}, ten seasons`,
    units(OKC, lastSeasons(10), size)
  ]),
  [
    'With or without, the first teammate',
    (w) => w.call('withOrWithout', { player: CURRY, teammate: null, season, scope: regular })
  ],
  // Matchups and officials (T906).
  ['Game matchups on a game page', (w) => w.call('gameMatchups', { game: GAME })],
  [
    'Matchups over a date range (LeBron, January)',
    (w) =>
      w.call('matchups', {
        player: LEBRON,
        season,
        scope: { ...regular, dates: [`${season}-01-01`, `${season}-01-31`] }
      })
  ],
  ["A season's officials", (w) => w.call('officialsSeason', { season, gameTypes: ['regular'] })]
]
let GAME = ''

const plays = process.argv.includes('--plays')
const RUNS = 5
const rows = []
if (plays) {
  // Each case first in a worker of its own (cold: the first read of a session), then warm.
  {
    const w = openStatsWorker(folder)
    const [g] = await w.read(
      `SELECT game_id FROM game WHERE game_date = DATE '${season}-01-15' AND played ORDER BY game_id LIMIT 1`
    )
    GAME = g?.game_id ?? ''
    await w.close()
  }
  for (const [label, c] of PLAY_CASES) {
    const run = (w) => (typeof c === 'function' ? c(w) : w.query(c))
    const w = openStatsWorker(folder)
    await w.read('SELECT 1')
    let at = performance.now()
    let r
    try {
      r = await run(w)
    } catch (err) {
      rows.push({
        label,
        rows: `error: ${err.message.slice(0, 80)}`,
        cold: '-',
        median: '-',
        worst: '-'
      })
      await w.close()
      continue
    }
    const cold = performance.now() - at
    const times = []
    for (let i = 0; i < RUNS; i++) {
      at = performance.now()
      r = await run(w)
      times.push(performance.now() - at)
    }
    await w.close()
    times.sort((a, b) => a - b)
    const n = r?.total ?? r?.rows?.length ?? r?.units?.length ?? r?.shots?.length ?? r?.length ?? ''
    rows.push({
      label,
      rows: n,
      cold: Math.round(cold),
      median: Math.round(times[2]),
      worst: Math.round(times[RUNS - 1])
    })
  }
  console.log('| Read | Rows | Cold ms | Warm median ms | Warm worst ms |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const r of rows)
    console.log(`| ${r.label} | ${r.rows} | ${r.cold} | ${r.median} | ${r.worst} |`)
  const ms = rows.flatMap((r) => [r.cold, r.worst]).filter((x) => typeof x === 'number')
  console.log(`worst of all: ${Math.max(...ms)} ms`)
  process.exit(0)
}

const { query, close } = openStatsWorker(folder)
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
