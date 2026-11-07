#!/usr/bin/env node
// Compares what the window showed with the raw standings files, on every column of every row, for the
// seasons scripts/stage6-team-steps.json visits. Build first, and save drive.mjs's output to a file.
//
// usage: node scripts/check-standings.mjs <drive.mjs output> <folder holding stats.duckdb>
import { readFileSync } from 'node:fs'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [outFile, folder] = process.argv.slice(2)
const lines = readFileSync(outFile, 'utf8')
  .split('\n')
  .filter((l) => /^eval: "S[0-9]{4} /.test(l))
const { read, close } = openStatsWorker(folder)
const dash = (x) => (x === null || x === undefined || x === '' ? '—' : String(x).trim())
const pct = (x) => {
  const t = Number(x).toFixed(3)
  return t.startsWith('0') ? t.slice(1) : t
}
const gb = (x) => (x === 0 ? '—' : Number(x).toFixed(1).replace(/\.0$/, ''))
const pts = (x) => Number(x).toFixed(1)
const diff = (x) => {
  const text = Math.abs(x).toFixed(1)
  return x > 0 ? `+${text}` : x < 0 && Number(text) !== 0 ? `−${text}` : text
}
let bad = 0
for (const line of lines) {
  const body = JSON.parse(line.slice(6))
  const season = Number(body.slice(1, 5))
  const shown = JSON.parse(body.slice(6))
  const table = season === 1996 ? 'src_dash_standings' : 'src_nba_standings'
  const raw = await read(`SELECT * FROM ${table} WHERE season = ${season}`)
  let rows = 0
  let same = 0
  for (const [label, cells] of shown) {
    const conference = label.split(' ')[0]
    const expected = raw
      .filter((r) => r.conference === conference)
      .sort((a, b) => a.playoff_rank - b.playoff_rank)
    for (const text of cells) {
      rows++
      const [rank, name] = text.split('|')
      const r = expected.find((x) => `${x.team_city} ${x.team_name}` === name)
      if (!r) {
        console.log(season, 'NOT IN SOURCE', name)
        bad++
        continue
      }
      // 2003-04's conference and division records repeat the overall one: the screen dashes them.
      const repeats = season === 2004
      const want = [
        r.playoff_rank,
        name,
        r.wins,
        r.losses,
        pct(r.win_pct),
        gb(r.conference_games_back),
        dash(r.home),
        dash(r.road),
        repeats ? '—' : dash(r.division_record),
        repeats ? '—' : dash(r.conference_record),
        dash(r.l10),
        dash(r.str_current_streak),
        pts(r.points_pg),
        pts(r.opp_points_pg),
        diff(r.diff_points_pg)
      ].join('|')
      if (want === text) same++
      else {
        bad++
        console.log(season, 'DIFFERS\n  shown', text, '\n  want ', want, rank)
      }
    }
  }
  console.log(
    `${season}: ${same} of ${rows} rows match ${table} on every column; ${raw.length} teams in the source`
  )
  if (rows !== raw.length) bad++
}
await close()
console.log(bad ? `${bad} problems` : 'no problems')
process.exit(bad ? 1 : 0)
