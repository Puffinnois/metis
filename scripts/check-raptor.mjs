// Checks FiveThirtyEight's RAPTOR (D54) on a real load: how many of the files' player-seasons are
// linked to an NBA id, season by season and by how, that no id is linked twice, and every RAPTOR
// metric read through the engine against its column in the by-player files on every linked
// player-season (regular season and playoffs together, as those files count them). Prints a sample
// of links to check by hand. Read only, through the built worker.
// usage: node scripts/check-raptor.mjs <folder>     (build first: npm run build)
import { openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
if (!folder) {
  console.error('usage: node scripts/check-raptor.mjs <folder>')
  process.exit(1)
}
const FIRST = 1994
const LAST = 2022
const { read, query, close } = openStatsWorker(folder, { league: 'nba' })

// Each metric, the file and column it must equal, and the possessions that file weighs it by.
const CHECKS = [
  ['raptor_total', 'historical', 'raptor_total'],
  ['raptor_offense', 'historical', 'raptor_offense'],
  ['raptor_defense', 'historical', 'raptor_defense'],
  ['raptor_war', 'historical', 'war_total'],
  ['raptor_predator', 'historical', 'predator_total'],
  ['raptor_predator_offense', 'historical', 'predator_offense'],
  ['raptor_predator_defense', 'historical', 'predator_defense'],
  ['raptor_pace_impact', 'historical', 'pace_impact'],
  ['raptor_box_total', 'modern', 'raptor_box_total'],
  ['raptor_box_offense', 'modern', 'raptor_box_offense'],
  ['raptor_box_defense', 'modern', 'raptor_box_defense'],
  ['raptor_onoff_total', 'modern', 'raptor_onoff_total'],
  ['raptor_onoff_offense', 'modern', 'raptor_onoff_offense'],
  ['raptor_onoff_defense', 'modern', 'raptor_onoff_defense']
]
// The files print about 10 significant digits, so a value equals its source to that precision.
const TOLERANCE = 1e-8

const n = (x) => (x === null || x === undefined ? null : Number(x))

console.log('## Players linked, by season\n')
const rates = await read(`
  SELECT r.season, count(*) AS rows, count(t.bref_id) AS linked,
         round(100.0 * count(t.bref_id) / count(*), 1) AS pct,
         coalesce(sum(r.mp) FILTER (WHERE t.bref_id IS NULL), 0) AS unlinked_minutes
  FROM (SELECT DISTINCT player_id, season, mp FROM src_raptor_historical_player
        WHERE season BETWEEN ${FIRST} AND ${LAST}) r
  LEFT JOIN (SELECT DISTINCT bref_id, season FROM pub_player_raptor) t
    ON t.bref_id = r.player_id AND t.season = r.season
  GROUP BY 1 ORDER BY 1`)
console.log('| Season | Player-seasons | Linked | % | Minutes not linked |')
console.log('| --- | --- | --- | --- | --- |')
let rows = 0
let linked = 0
for (const r of rates) {
  rows += n(r.rows)
  linked += n(r.linked)
  console.log(
    `| ${r.season - 1}-${String(r.season).slice(2)} | ${r.rows} | ${r.linked} | ${r.pct} | ${r.unlinked_minutes} |`
  )
}
console.log(`| All | ${rows} | ${linked} | ${((100 * linked) / rows).toFixed(1)} | |\n`)

const how = await read(`SELECT link, count(DISTINCT (bref_id, season)) AS n FROM pub_player_raptor
  GROUP BY 1 ORDER BY 2 DESC`)
console.log(`Linked by: ${how.map((h) => `${h.link} ${h.n}`).join(', ')}`)
const twice = await read(`
  SELECT (SELECT count(*) FROM (SELECT bref_id FROM pub_player_raptor GROUP BY 1
            HAVING count(DISTINCT player_id) > 1)) AS bref_twice,
         (SELECT count(*) FROM (SELECT player_id FROM pub_player_raptor GROUP BY 1
            HAVING count(DISTINCT bref_id) > 1)) AS nba_twice`)
console.log(
  `Basketball-Reference ids linked to two NBA ids: ${twice[0].bref_twice}; NBA ids linked to two Basketball-Reference ids: ${twice[0].nba_twice}\n`
)

console.log('## Each metric through the engine against the by-player files\n')
const brefOf = new Map(
  (await read('SELECT DISTINCT player_id, bref_id FROM pub_player_raptor')).map((r) => [
    String(r.player_id),
    r.bref_id
  ])
)
const published = { historical: new Map(), modern: new Map() }
for (const [file, table] of [
  ['historical', 'src_raptor_historical_player'],
  ['modern', 'src_raptor_modern_player']
]) {
  for (const r of await read(`SELECT * FROM ${table} WHERE season BETWEEN ${FIRST} AND ${LAST}`)) {
    published[file].set(`${r.player_id}:${r.season}`, r)
  }
}
// A season type RAPTOR counts with no box-score line in Metis (a few playoff minutes, mostly): the
// engine starts from the lines, so that row has nothing to join and the season reads the others.
const missingType = new Set(
  (
    await read(`SELECT DISTINCT t.player_id, t.season FROM pub_player_raptor t
      WHERE NOT EXISTS (SELECT 1 FROM player_season ps WHERE ps.player_id = t.player_id
        AND ps.season = t.season AND ps.game_type = t.game_type AND ps.team_id IS NULL)`)
  ).map((r) => `${r.player_id}:${r.season}`)
)
const tally = new Map(
  CHECKS.map(([id]) => [id, { compared: 0, equal: 0, missing: 0, worst: 0, off: [] }])
)
for (let season = FIRST; season <= LAST; season++) {
  const result = await query({
    entity: 'player',
    metrics: CHECKS.map(([id]) => id),
    scope: { seasons: [season], gameTypes: ['regular', 'playoffs'] },
    limit: 5000
  })
  for (const row of result.rows) {
    const bref = brefOf.get(String(row.id))
    if (!bref) continue
    for (const [id, file, column] of CHECKS) {
      const source = published[file].get(`${bref}:${season}`)
      const value = n(row.values[id]?.value)
      if (!source || source[column] === null || value === null) continue
      const t = tally.get(id)
      const diff = Math.abs(value - Number(source[column]))
      t.compared++
      if (diff <= TOLERANCE * Math.max(1, Math.abs(Number(source[column])))) t.equal++
      else if (missingType.has(`${row.id}:${season}`)) t.missing++
      else {
        if (t.off.length < 3) t.off.push(`${bref} ${season}: ${value} against ${source[column]}`)
        t.worst = Math.max(t.worst, diff)
      }
    }
  }
}
console.log(
  '| Metric | Compared | Equal (to 1e-8 of the value) | A season type with no line in Metis | Other | Largest other |'
)
console.log('| --- | --- | --- | --- | --- | --- |')
for (const [id, t] of tally) {
  const other = t.compared - t.equal - t.missing
  const worst = other ? t.worst.toExponential(1) : '–'
  console.log(`| \`${id}\` | ${t.compared} | ${t.equal} | ${t.missing} | ${other} | ${worst} |`)
}
for (const [id, t] of tally) for (const o of t.off) console.log(`- ${id}: ${o}`)

console.log('\n## A sample of links to check by hand\n')
const sample = await read(`
  WITH l AS (SELECT DISTINCT p.bref_id, p.season, p.player_id, p.link FROM pub_player_raptor p)
  SELECT l.link, l.bref_id, s.player_name, pl.name AS metis_name, l.season, s.mp,
         (SELECT sum(minutes) FROM player_season ps WHERE ps.player_id = l.player_id
            AND ps.season = l.season AND ps.team_id IS NULL
            AND ps.game_type IN ('regular', 'playoffs')) AS metis_minutes
  FROM l JOIN src_raptor_historical_player s ON s.player_id = l.bref_id AND s.season = l.season
  JOIN player pl ON pl.player_id = l.player_id
  QUALIFY row_number() OVER (PARTITION BY l.link ORDER BY hash(l.bref_id || l.season)) <= 8
  ORDER BY l.link, l.season`)
for (const s of sample) {
  console.log(
    `- ${s.link}: ${s.player_name} (${s.bref_id}) = ${s.metis_name}, ${s.season}, ${s.mp} min against ${s.metis_minutes}`
  )
}

console.log('\n## The most minutes not linked\n')
const missed = await read(`
  SELECT r.player_name, r.player_id, r.season, r.mp FROM src_raptor_historical_player r
  WHERE r.season BETWEEN ${FIRST} AND ${LAST} AND NOT EXISTS (
    SELECT 1 FROM pub_player_raptor t WHERE t.bref_id = r.player_id AND t.season = r.season)
  ORDER BY r.mp DESC LIMIT 15`)
for (const m of missed) console.log(`- ${m.player_name} (${m.player_id}), ${m.season}: ${m.mp} min`)
await close()
