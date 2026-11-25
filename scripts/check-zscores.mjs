#!/usr/bin/env node
// Recounts the z-scores a college board asks of the engine (Plan T1703.3) on a real load: every row of
// the board is fetched, the mean and sample standard deviation of each metric's pool worked out again
// from the rows with a percentile, per position, and each row's score compared, for one season and
// every mode. Times the board with the scores and without. Read only. Build first: npm run build.
// usage: node scripts/check-zscores.mjs <folder> [season] [--league=ncaam|ncaaw]
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder, seasonArg] = positional()
const league = leagueArg()
const season = Number(seasonArg ?? 2026)
if (!folder) {
  console.error('usage: node scripts/check-zscores.mjs <folder> [season] [--league=ncaam]')
  process.exit(1)
}
const { query, close } = openStatsWorker(folder, { league })
const METRICS = ['min', 'pts', 'reb', 'ast', 'tov', 'stl', 'blk', 'fg_pct', 'ts_pct', 'fg3m', 'usg_pct']

for (const transform of ['perGame', 'raw', 'per40', 'per100']) {
  const base = {
    entity: 'player',
    metrics: METRICS,
    scope: { seasons: [season], gameTypes: ['regular'] },
    transform,
    sort: { metric: 'min', dir: 'desc' },
    limit: 5000,
    rankAmong: 'min'
  }
  const r = await query({ ...base, zScores: true })
  const c = { rows: 0, equal: 0, differ: 0, blank: 0, pool: 0 }
  const worst = []
  for (const metric of METRICS) {
    const pools = new Map()
    for (const row of r.rows) {
      const v = row.values[metric]
      if (v.percentile === null || v.value === null) continue
      const k = row.position ?? ''
      if (!pools.has(k)) pools.set(k, [])
      pools.get(k).push(v.value)
    }
    const stats = new Map(
      [...pools].map(([k, xs]) => {
        const mean = xs.reduce((a, x) => a + x, 0) / xs.length
        const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1))
        return [k, { mean, sd, n: xs.length }]
      })
    )
    for (const row of r.rows) {
      const v = row.values[metric]
      if (v.percentile === null || v.value === null) {
        if (v.z) c.blank++
        continue
      }
      c.rows++
      const s = stats.get(row.position ?? '')
      const want = (v.value - s.mean) / s.sd
      if (!v.z || v.z.score === null || s.n !== v.z.n) c.blank++
      else if (Math.abs(v.z.score - want) <= 1e-9 * Math.max(1, Math.abs(want))) c.equal++
      else {
        c.differ++
        if (worst.length < 4) worst.push(`${row.id} ${metric}: engine ${v.z.score}, recount ${want}`)
      }
    }
  }
  // Of a league's players not fetched, nothing is known: the engine ranked among every one.
  console.log(
    `${league} ${season} ${transform}: ${r.rows.length} rows of ${r.total}, ${c.rows} scored, ${c.equal} equal, ${c.differ} differing, ${c.blank} blank`
  )
  for (const w of worst) console.log('  ', w)
  if (r.rows.length < r.total) console.log('  the board is larger than the fetch: scores are the engine’s')
  for (const extra of [{}, { zScores: true }]) {
    const ms = []
    for (let i = 0; i < 9; i++) ms.push((await query({ ...base, limit: 1000, ...extra })).ms)
    ms.sort((a, b) => a - b)
    console.log(`  1,000-row board ${extra.zScores ? 'with' : 'without'} scores: median ${ms[4]} ms, worst ${ms[8]}`)
  }
}
await close()
