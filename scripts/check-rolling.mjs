#!/usr/bin/env node
// Checks SportsDataverse's rolling windows (T1703.2) on a real load, through the built worker, read
// only: every metric, one season at a time, against its column in the source on every filled window
// (`qualified`), and no value on every unfilled one.
// usage: node scripts/check-rolling.mjs <folder> [--league=nba|wnba]
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
const league = leagueArg()
const { read, query, close } = openStatsWorker(folder, { league })
const source = league === 'wnba' ? 'src_wnba_rolling_windows' : 'src_nba_rolling_windows'
const WINDOWS = [
  ['fg50', 'fg_pct', 50],
  ['fg200', 'fg_pct', 200],
  ['fg3_50', 'fg3_pct', 50],
  ['fg3_200', 'fg3_pct', 200]
]
const VALUES = {
  cur: 'cur',
  prev: 'prev',
  start: 'season_start',
  career: 'career_baseline',
  dprev: 'delta_prev',
  dseason: 'delta_season',
  dcareer: 'delta_career'
}
const metrics = WINDOWS.flatMap(([k]) => Object.keys(VALUES).map((v) => `rw_${k}_${v}`))
const seasons = (await read(`SELECT DISTINCT season FROM ${source} ORDER BY 1`)).map(
  (r) => r.season
)
const tally = {
  compared: 0,
  equal: 0,
  nullWhenUnfilled: 0,
  unfilled: 0,
  valueWhenUnfilled: 0,
  missing: 0
}
const off = []
for (const season of seasons) {
  const src = new Map()
  for (const r of await read(
    `SELECT * FROM ${source} WHERE season = ${season} AND entity_type = 'player'`
  )) {
    src.set(`${r.entity_id}:${r.metric}:${r.window_n}`, r)
  }
  const result = await query({
    entity: 'player',
    metrics,
    scope: { seasons: [season] },
    limit: 5000
  })
  for (const row of result.rows) {
    for (const [k, metric, n] of WINDOWS) {
      const s = src.get(`${row.id}:${metric}:${n}`)
      if (!s) continue
      for (const [v, col] of Object.entries(VALUES)) {
        const value = row.values[`rw_${k}_${v}`]?.value ?? null
        if (!s.qualified) {
          tally.unfilled++
          if (value === null) tally.nullWhenUnfilled++
          else tally.valueWhenUnfilled++
          continue
        }
        if (s[col] === null) continue
        tally.compared++
        if (value !== null && Math.abs(value - Number(s[col])) <= 1e-12) tally.equal++
        else if (value === null) tally.missing++
        else if (off.length < 5)
          off.push(`${row.id} ${season} rw_${k}_${v}: ${value} against ${s[col]}`)
      }
    }
  }
}
console.log(`${league}: ${seasons[0]} to ${seasons.at(-1)}`)
console.log(
  `filled windows: ${tally.equal} of ${tally.compared} values equal to the source${tally.missing ? `, ${tally.missing} with no value` : ''}`
)
console.log(
  `unfilled windows: ${tally.nullWhenUnfilled} of ${tally.unfilled} values read nothing${tally.valueWhenUnfilled ? `, ${tally.valueWhenUnfilled} read a value` : ''}`
)
for (const o of off) console.log(`- ${o}`)
await close()
