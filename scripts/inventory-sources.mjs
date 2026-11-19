#!/usr/bin/env node
// Lists every Parquet file of one league in the sportsdataverse-data releases and writes the list to
// tests/fixtures/<league>-inventory.tsv, where a test compares it with SOURCES_BY_LEAGUE in
// src/main/stats/sources.ts. `--league=wnba` for the WNBA, `ncaam` and `ncaaw` for NCAA Division I;
// the NBA's by default. Every season is listed, those before a league's first season too.
// Development only: it needs the GitHub CLI signed in, since a release listing takes more calls
// than GitHub's anonymous allowance. The app itself never lists a release.
//
// Run it, then `npx vitest run tests/main/stats/sources.test.ts`: a failure names what changed.
//
//   node scripts/inventory-sources.mjs --league=wnba
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'sportsdataverse/sportsdataverse-data'
// The release prefixes of each league, as `releases.prefixes` in src/shared/leagues.ts states them.
const PREFIXES = {
  nba: ['espn_nba_', 'nba_stats_', 'nba_'],
  wnba: ['espn_wnba_', 'wnba_stats_', 'wnba_'],
  ncaam: ['espn_mens_college_basketball_', 'ncaa_mbb_', 'mbb_'],
  ncaaw: ['espn_womens_college_basketball_', 'ncaa_wbb_', 'wbb_']
}
const league =
  process.argv.find((a) => a.startsWith('--league='))?.slice('--league='.length) ?? 'nba'
if (!(league in PREFIXES)) {
  console.error(`unknown league "${league}": ${Object.keys(PREFIXES).join(', ')}`)
  process.exit(1)
}
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  `../tests/fixtures/${league}-inventory.tsv`
)

function gh(path, jq) {
  const output = execFileSync('gh', ['api', '--paginate', path, '--jq', jq], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  return output.split('\n').filter(Boolean)
}

const releases = gh(`repos/${REPO}/releases?per_page=100`, '.[] | [.id,.tag_name] | @tsv')
  .map((line) => line.split('\t'))
  .filter(([, tag]) => PREFIXES[league].some((prefix) => tag.startsWith(prefix)))

const files = []
let bytes = 0
for (const [id, tag] of releases) {
  const assets = gh(
    `repos/${REPO}/releases/${id}/assets?per_page=100`,
    '.[] | [.name,.size] | @tsv'
  )
  for (const asset of assets) {
    const [name, size] = asset.split('\t')
    if (!name.endsWith('.parquet')) continue
    files.push(`${tag}\t${name}`)
    bytes += Number(size)
  }
}
files.sort()

const before = existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean) : []
const added = files.filter((f) => !before.includes(f))
const removed = before.filter((f) => !files.includes(f))
writeFileSync(OUT, `${files.join('\n')}\n`)

console.log(`${releases.length} releases, ${files.length} files, ${Math.round(bytes / 1048576)} MB`)
console.log(`${added.length} added, ${removed.length} removed since the last list`)
for (const f of [...added.map((a) => `+ ${a}`), ...removed.map((r) => `- ${r}`)].slice(0, 40)) {
  console.log(f.replace('\t', '/'))
}
