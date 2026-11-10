#!/usr/bin/env node

// Checks the Lineups tab's read against the NBA's raw lineup files on a real load, through the built

// worker: for every team, season (2007-08 to 2025-26), season type and dashboard, the units the read

// returns against the file's rows, on every column the tab shows. Also times the read, and compares a

// team's units' minutes with the minutes it played.

//

// A stored value must equal the raw one exactly (it is only cast to DOUBLE). A percentage the tab

// works out from its parts is compared with the published one, which is rounded to three decimals,

// so it may differ by 0.0005. Games must match, and minutes are the file's `sum_time_played` / 3000.

//

// usage: node scripts/check-lineups.mjs <folder holding stats.duckdb> [out.md]

import { readFileSync, writeFileSync } from 'node:fs'

import { dirname, join, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'

import ts from 'typescript'

import { openStatsWorker } from './lib/stats-worker.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))

if (!folder) {
  console.error('usage: node scripts/check-lineups.mjs <folder> [out.md]')

  process.exit(2)
}

// The catalogue has no imports, so it can be read here without bundling.

const catalogue = ts.transpileModule(
  readFileSync(join(ROOT, 'src/shared/stats/lineups.ts'), 'utf8'),

  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText

const { LINEUP_GROUPS, LINEUP_STORED, lineupColumns } = await import(
  `data:text/javascript,${encodeURIComponent(catalogue)}`
)

const { read, lineups, close } = openStatsWorker(folder)

const FIRST = 2008

const LAST = 2026

// The published digits are a/b rounded to three decimals, and a half lands on either side by float error.

const PCT_TOLERANCE = 0.0005 + 1e-9

const TYPES = { regular: 'Regular Season', playoffs: 'Playoffs' }

/** A BIGINT may arrive as text. */

const num = (x) => (x === null || x === undefined ? null : Number(x))

const idsOf = (groupId) =>
  groupId

    .split('-')

    .filter(Boolean)

    .map(Number)

    .sort((a, b) => a - b)

    .join('-')

// 1. The raw files, by unit.

const raw = {}

for (const g of LINEUP_GROUPS) {
  const cols = LINEUP_STORED.filter((c) => c.group === g.id).map((c) => c.source)

  const published = lineupColumns(g.id)
    .filter((c) => c.of)

    .map((c) => c.id)

  const rows = await read(`SELECT season, season_type, team_id, group_id, gp, sum_time_played,

      ${[...new Set([...cols, ...published])].join(', ')}

    FROM src_dash_lineups_${g.id} WHERE group_quantity = 5 AND season BETWEEN ${FIRST} AND ${LAST}`)

  raw[g.id] = new Map(
    rows.map((r) => [
      `${r.season}|${r.season_type === 'Playoffs' ? 'playoffs' : 'regular'}|${r.team_id}|${idsOf(r.group_id)}`,

      r
    ])
  )
}

// 2. The read, for every team-season, type and dashboard.

const teams = await read(`SELECT DISTINCT season, game_type, team_id FROM pub_lineups

  WHERE season BETWEEN ${FIRST} AND ${LAST} ORDER BY 1, 2, 3`)

const per = new Map() // season -> counters

const byColumn = new Map()

const times = []

let slowest = { ms: 0 }

const counter = (season) => {
  if (!per.has(season)) {
    per.set(season, {
      units: 0, // units the read returned across all dashboards' reads of the base group

      rows: 0, // raw rows over all dashboards

      missing: 0, // raw rows the read did not return

      extra: 0, // units with a measure the raw file does not hold

      values: 0,

      bad: 0,

      pcts: 0,

      pctBad: 0,

      games: 0,

      gamesBad: 0
    })
  }

  return per.get(season)
}

for (const t of teams) {
  for (const g of LINEUP_GROUPS) {
    const at = Date.now()

    const result = await lineups(String(t.team_id), t.season, t.game_type, g.id)

    const ms = Date.now() - at

    times.push(ms)

    if (ms > slowest.ms) slowest = { ms, ...t, group: g.id, units: result.units.length }

    const c = counter(t.season)

    const stored = LINEUP_STORED.filter((x) => x.group === g.id)

    const worked = lineupColumns(g.id).filter((x) => x.of)

    const seen = new Set()

    for (const u of result.units) {
      const key = `${t.season}|${t.game_type}|${t.team_id}|${u.players
        .map((p) => p.id)
        .sort((a, b) => a - b)
        .join('-')}`

      const row = raw[g.id].get(key)

      if (g.id === 'base') {
        c.units++

        // Games and minutes come from whichever file lists the unit.

        const any = LINEUP_GROUPS.map((x) => raw[x.id].get(key)).find(Boolean)

        c.games++

        if (
          !any ||
          num(u.games) !== num(any.gp) ||
          Math.abs(u.minutes - num(any.sum_time_played) / 3000) > 1e-9
        ) {
          c.gamesBad++
        }
      }

      if (!row) {
        if (stored.some((x) => u.values[x.id] !== null && u.values[x.id] !== undefined)) c.extra++

        continue
      }

      seen.add(key)

      for (const col of stored) {
        c.values++

        const want = num(row[col.source])

        const got = num(u.values[col.id])

        if (got !== want) {
          c.bad++

          byColumn.set(col.id, (byColumn.get(col.id) ?? 0) + 1)
        }
      }

      for (const col of worked) {
        const [a, b] = col.of

        const top = num(a === 'games' ? u.games : u.values[a])

        const den = num(b === 'games' ? u.games : u.values[b])

        const published = num(row[col.id])

        if (published === null || published === undefined || !den) continue

        c.pcts++

        if (Math.abs(top / den - published) > PCT_TOLERANCE) {
          c.pctBad++

          byColumn.set(col.id, (byColumn.get(col.id) ?? 0) + 1)
        }
      }
    }

    for (const key of raw[g.id].keys()) {
      if (!key.startsWith(`${t.season}|${t.game_type}|${t.team_id}|`)) continue

      c.rows++

      if (!seen.has(key)) c.missing++
    }
  }
}

// 3. A team's units' minutes against the minutes it played. At any moment one unit is on the floor,

// so the units' minutes should add up to the team's elapsed time, which is a fifth of the player

// minutes. The regular season lists only part of the units; the playoffs list all of them.

const shares = {}

for (const type of ['regular', 'playoffs']) {
  const sums = await read(`WITH u AS (

      SELECT season, team_id, sum(minutes) AS unit_minutes, count(*) AS units

      FROM pub_lineups WHERE game_type = '${type}' AND fgm IS NOT NULL GROUP BY 1, 2),

    g AS (SELECT season, team_id, sum(seconds) / 60.0 AS player_minutes

      FROM team_game WHERE game_type = '${type}' AND seconds > 0 GROUP BY 1, 2)

    SELECT u.season, u.team_id, u.units, u.unit_minutes * 5 / g.player_minutes AS share

    FROM u JOIN g USING (season, team_id) WHERE u.season BETWEEN ${FIRST} AND ${LAST}`)

  const bySeason = new Map()

  for (const r of sums) {
    const list = bySeason.get(r.season) ?? []

    list.push(r.share)

    bySeason.set(r.season, list)
  }

  shares[type] = bySeason
}

const label = (s) => `${s - 1}-${String(s % 100).padStart(2, '0')}`

const pc = (a, b) => (b ? `${((100 * (b - a)) / b).toFixed(2)} %` : '–')

const q = (list, p) =>
  [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(p * list.length))]

const out = [
  '# Lineup checks',

  '',

  `Written by \`scripts/check-lineups.mjs\`. Stored values must equal the raw file exactly; percentages worked out on read may differ from the published ones by half a printed digit (0.0005).`,

  '',

  '| Season | Units | Raw rows | Not returned | Extra | Values | Match | Percentages | Match | Games and minutes |',

  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
]

const total = {
  units: 0,
  rows: 0,
  missing: 0,
  extra: 0,
  values: 0,
  bad: 0,
  pcts: 0,
  pctBad: 0,
  games: 0,
  gamesBad: 0
}

for (const [season, c] of [...per].sort((a, b) => a[0] - b[0])) {
  out.push(
    `| ${label(season)} | ${c.units} | ${c.rows} | ${c.missing} | ${c.extra} | ${c.values} | ${pc(c.bad, c.values)} | ${c.pcts} | ${pc(c.pctBad, c.pcts)} | ${pc(c.gamesBad, c.games)} |`
  )

  for (const k of Object.keys(total)) total[k] += c[k]
}

out.push(
  `| **All** | ${total.units} | ${total.rows} | ${total.missing} | ${total.extra} | ${total.values} | ${pc(total.bad, total.values)} | ${total.pcts} | ${pc(total.pctBad, total.pcts)} | ${pc(total.gamesBad, total.games)} |`,

  '',

  `Mismatches by column: ${JSON.stringify(Object.fromEntries(byColumn))}`,

  '',

  `Reads: ${times.length}, median ${q(times, 0.5)} ms, 95th percentile ${q(times, 0.95)} ms, slowest ${slowest.ms} ms (${JSON.stringify(slowest)}).`,

  '',

  "Units' minutes times 5 over the player minutes the team played, from the base file's units:"
)

for (const [type, bySeason] of Object.entries(shares)) {
  out.push(
    '',

    type === 'regular'
      ? 'Regular season (the NBA lists the 2,000 units with the most minutes):'
      : 'Playoffs (all units listed):',

    '',

    '| Season | Teams | Median | Lowest | Highest |',

    '| --- | --- | --- | --- | --- |',

    ...[...bySeason]
      .sort((x, y) => x[0] - y[0])
      .map(
        ([s2, l]) =>
          `| ${label(s2)} | ${l.length} | ${(100 * q(l, 0.5)).toFixed(1)} % | ${(100 * Math.min(...l)).toFixed(1)} % | ${(100 * Math.max(...l)).toFixed(1)} % |`
      )
  )
}

console.log(out.join('\n'))

if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')

await close()
