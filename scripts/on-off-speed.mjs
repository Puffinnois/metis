#!/usr/bin/env node
// Times the on-court reads and queries (Plan T904) on a loaded profile, in the worker, warm: the median
// and the worst of seven runs each. Build first; run it on a copy, never the app's own data.
//
// usage: node scripts/on-off-speed.mjs <folder holding stats.duckdb> [season] [team id] [player id]
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, seasonArg = '2026', team = '1610612760', player = '1628983'] = process.argv.slice(2)
if (!folder) {
  console.error('usage: node scripts/on-off-speed.mjs <folder> [season] [team id] [player id]')
  process.exit(2)
}
const season = Number(seasonArg)
const w = openStatsWorker(resolve(folder))
const regular = { gameTypes: ['regular'] }
const ON_OFF = [
  'onc_min',
  'onc_poss',
  'onc_plus_minus',
  'onc_ortg',
  'onc_drtg',
  'onc_net',
  'offc_ortg',
  'offc_drtg',
  'offc_net',
  'onoff_ortg',
  'onoff_drtg',
  'onoff_net',
  'onc_pace'
]
const RATES = [
  'onc_usg_pct',
  'usg_pct',
  'onc_ast_pct',
  'ast_pct',
  'onc_orb_pct',
  'orb_pct',
  'onc_drb_pct',
  'drb_pct',
  'onc_trb_pct',
  'trb_pct',
  'onc_stl_pct',
  'stl_pct',
  'onc_blk_pct',
  'blk_pct'
]
const CASES = [
  [
    'On/off tab: 13 metrics over every guard',
    () =>
      w.query({
        entity: 'player',
        metrics: ON_OFF,
        scope: { seasons: [season], positions: ['G'] },
        limit: 5000
      })
  ],
  [
    'On/off tab: 14 actual and estimated rates',
    () =>
      w.query({
        entity: 'player',
        metrics: RATES,
        scope: { seasons: [season], positions: ['G'] },
        limit: 5000
      })
  ],
  [
    'On/off tab, a month',
    () =>
      w.query({
        entity: 'player',
        metrics: ON_OFF,
        scope: {
          seasons: [season],
          positions: ['G'],
          dates: [`${season}-01-01`, `${season}-01-31`]
        },
        limit: 5000
      })
  ],
  [
    'A leaderboard: net on-off and ten box-score columns',
    () =>
      w.query({
        entity: 'player',
        metrics: [
          'onoff_net',
          'onc_net',
          'pts',
          'reb',
          'ast',
          'stl',
          'blk',
          'tov',
          'fg_pct',
          'fg3_pct',
          'ft_pct',
          'minutes'
        ],
        scope: { seasons: [season] }
      })
  ],
  [
    'Every season, net on-off by season',
    () =>
      w.query({
        entity: 'player',
        metrics: ['onoff_net', 'onc_net'],
        scope: {
          seasons: Array.from({ length: season - 1996 }, (_, i) => 1997 + i),
          qualifiedOnly: true
        },
        groupBy: ['season'],
        limit: 5000
      })
  ],
  [
    "The team's On/off tab",
    () =>
      w.query({
        entity: 'player',
        metrics: ON_OFF.slice(0, 10),
        scope: { seasons: [season], teams: [team] },
        limit: 40
      })
  ],
  ['Units of five', () => w.call('onCourtUnits', { team, season, scope: regular, size: 5 })],
  ['Units of four', () => w.call('onCourtUnits', { team, season, scope: regular, size: 4 })],
  ['Units of three', () => w.call('onCourtUnits', { team, season, scope: regular, size: 3 })],
  ['Units of two', () => w.call('onCourtUnits', { team, season, scope: regular, size: 2 })],
  [
    'Units of five, the last 10 games',
    () => w.call('onCourtUnits', { team, season, scope: { ...regular, lastN: 10 }, size: 5 })
  ],
  [
    'With or without, the first teammate',
    () => w.call('withOrWithout', { player, teammate: null, season, scope: regular })
  ]
]
console.log('| Read | Rows | Median ms | Worst ms |\n| --- | --- | --- | --- |')
for (const [label, run] of CASES) {
  const times = []
  let rows = 0
  await run()
  for (let i = 0; i < 7; i++) {
    const at = performance.now()
    const r = await run()
    times.push(performance.now() - at)
    rows = r?.rows?.length ?? r?.units?.length ?? (r?.splits ? 4 : 0)
  }
  times.sort((a, b) => a - b)
  console.log(
    `| ${label} | ${rows.toLocaleString('en-US')} | ${Math.round(times[3])} | ${Math.round(times[6])} |`
  )
}
await w.close()
