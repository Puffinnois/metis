#!/usr/bin/env node
// Times the reads and the one mixed board that Stage 7 added, in the built worker on a loaded database:
// each run seven times, median and worst in milliseconds. Build first. Point it at a copy of a gate
// profile: the worker bootstraps new tables when it opens a database.
//
// usage: node scripts/read-speed.mjs <folder holding stats.duckdb> [season]
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const folder = resolve(process.argv[2] ?? '')
const season = Number(process.argv[3] ?? 2026)
if (!process.argv[2]) {
  console.error('usage: node scripts/read-speed.mjs <folder> [season]')
  process.exit(2)
}
const { read, query, call, lineups, close } = openStatsWorker(folder)

const RUNS = 7
const rows = []
async function time(label, run) {
  const ms = []
  let size = ''
  for (let i = 0; i < RUNS; i++) {
    const at = performance.now()
    const result = await run()
    ms.push(Math.round(performance.now() - at))
    size = Array.isArray(result) ? `${result.length}` : ''
  }
  const sorted = [...ms].sort((a, b) => a - b)
  rows.push(`| ${label} | ${size} | ${sorted[Math.floor(RUNS / 2)]} | ${sorted[RUNS - 1]} |`)
}

// The team with the most units in the season, and players who have something to show.
const [{ team_id: team }] = await read(`SELECT team_id, count(*) n FROM pub_lineups
  WHERE season = ${season} AND game_type = 'regular' GROUP BY 1 ORDER BY 2 DESC LIMIT 1`)
const players = (
  await read(`SELECT DISTINCT player_id FROM pub_player_availability WHERE season = 2027 LIMIT 30`)
).map((r) => String(r.player_id))
const [{ game_id: game }] = await read(`SELECT game_id FROM game WHERE season = ${season}
  AND game_type = 'regular' AND game_id IN (SELECT game_id FROM src_nba_officials) LIMIT 1`)

for (const group of ['base', 'advanced', 'fourfactors', 'misc', 'scoring', 'opponent']) {
  await time(`stats.lineups, ${group} (the team with most units)`, () =>
    lineups(String(team), season, 'regular', group)
  )
}
await time('stats.profile, Grayson Allen', () => call('profile', { player: '1628960' }))
await time('stats.profile, Nikola Jokić', () => call('profile', { player: '203999' }))
await time('stats.matchups, LeBron James', () => call('matchups', { player: '2544', season }))
await time('stats.matchups, Nikola Jokić (most pairs)', () =>
  call('matchups', { player: '203999', season })
)
await time(`stats.availability, ${players.length} players`, () => call('availability', { players }))
await time('stats.coaches, Lakers 2026-27', () =>
  call('coaches', { team: '1610612747', season: 2027 })
)
await time('stats.game (box score with officials)', () => call('game', { game: String(game) }))
const MIXED = [
  'pts',
  'pie',
  'usg_pct',
  'dist_miles',
  'deflections',
  'pt_iso_ppp',
  'matchup_min',
  'sdv_rapm',
  'games_out_injury'
]
await time('A leaderboard with one column from each new family', () =>
  query({
    entity: 'player',
    metrics: MIXED,
    scope: { seasons: [season], gameTypes: ['regular'] },
    limit: 5000
  }).then((r) => r.rows)
)
await close()
console.log('| Read | Rows | Median ms | Worst ms |\n| --- | --- | --- | --- |')
console.log(rows.join('\n'))
