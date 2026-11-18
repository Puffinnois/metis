#!/usr/bin/env node
// Checks the WNBA's qualifying rule (D37) by the leaders it gives: for each season, the engine's
// leader among qualified players in eight categories against Basketball-Reference's season page,
// read with a plain client in T1301.1 and kept outside the repository. B-R qualifies by its own
// requirements (20 games, 85 field goals made and the rest, `wnba-data-sources.md`, "Qualifying
// minimums"), not the league's, so a different leader is a difference of rules to read, not an error.
//
// usage: node scripts/check-wnba-leaders.mjs <folder holding stats-wnba.duckdb> <folder of B-R pages>
// Build first with `npm run build`. Prints a Markdown table.
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, bref] = process.argv.slice(2).map((p) => resolve(p))
if (!folder || !bref) {
  console.error('usage: node scripts/check-wnba-leaders.mjs <folder> <B-R pages folder>')
  process.exit(2)
}

/** B-R's leaders box, the engine's metric, and how the value is written. */
const CATEGORIES = [
  ['pts_per_g', 'pts', 'perGame', 1],
  ['trb_per_g', 'reb', 'perGame', 1],
  ['ast_per_g', 'ast', 'perGame', 1],
  ['stl_per_g', 'stl', 'perGame', 1],
  ['blk_per_g', 'blk', 'perGame', 1],
  ['fg_pct', 'fg_pct', 'raw', 3],
  ['fg3_pct', 'fg3_pct', 'raw', 3],
  ['ft_pct', 'ft_pct', 'raw', 3]
]

const key = (name) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

/** The first place of a leaders box: its name and value as B-R prints them. */
function brLeader(html, box) {
  const at = html.indexOf(`id="leaders_${box}"`)
  if (at < 0) return null
  const part = html.slice(at, at + 4000)
  const who = /<span class="who"><a [^>]*>([^<]+)<\/a>/.exec(part)
  const value = /<span class="value">\s*([0-9.]+)<\/span>/.exec(part)
  return who && value ? { name: who[1].replace(/&#39;/g, "'"), value: Number(value[1]) } : null
}

const { query, close } = openStatsWorker(folder, { league: 'wnba' })
const rows = []
const totals = Object.fromEntries(CATEGORIES.map(([box]) => [box, [0, 0]]))
for (let season = 1997; season <= 2026; season++) {
  const file = join(bref, `${season}.html`)
  if (!existsSync(file)) continue
  const html = readFileSync(file, 'utf8')
  const cells = [season]
  for (const [box, metric, transform, decimals] of CATEGORIES) {
    const theirs = brLeader(html, box)
    const result = await query({
      entity: 'player',
      metrics: [metric],
      transform,
      scope: { seasons: [season], qualifiedOnly: true },
      sort: { metric, dir: 'desc' },
      limit: 1
    })
    const ours = result.rows[0]
    const value = ours?.values[metric].value
    const same = theirs && ours && key(theirs.name) === key(ours.name)
    totals[box][1]++
    if (same) totals[box][0]++
    const ourValue = value == null ? '–' : value.toFixed(decimals).replace(/^0\./, '.')
    cells.push(
      same
        ? 'same'
        : `${ours ? `${ours.name} ${ourValue}` : '–'} / ${theirs ? `${theirs.name} ${theirs.value}` : '–'}`
    )
  }
  rows.push(cells)
}
await close()

const heads = ['Season', ...CATEGORIES.map(([box]) => box)]
console.log(`| ${heads.join(' | ')} |`)
console.log(`| ${heads.map(() => '---').join(' | ')} |`)
for (const r of rows) console.log(`| ${r.join(' | ')} |`)
console.log(
  `| Same leader | ${CATEGORIES.map(([box]) => `${totals[box][0]} of ${totals[box][1]}`).join(' | ')} |`
)
