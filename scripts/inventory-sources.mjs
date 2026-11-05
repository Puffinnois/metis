#!/usr/bin/env node
// Lists every NBA Parquet file in the sportsdataverse-data releases and writes the list to
// tests/fixtures/nba-inventory.tsv, where a test compares it with src/main/stats/sources.ts.
// Development only: it needs the GitHub CLI signed in, since a release listing takes more calls
// than GitHub's anonymous allowance. The app itself never lists a release.
//
// Run it, then `npx vitest run tests/main/stats/sources.test.ts`: a failure names what changed.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'sportsdataverse/sportsdataverse-data'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/nba-inventory.tsv')

function gh(path, jq) {
  const output = execFileSync('gh', ['api', '--paginate', path, '--jq', jq], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  return output.split('\n').filter(Boolean)
}

const releases = gh(
  `repos/${REPO}/releases?per_page=100`,
  '.[] | select(.tag_name|test("nba";"i")) | select(.tag_name|test("wnba";"i")|not) | [.id,.tag_name] | @tsv'
).map((line) => line.split('\t'))

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
