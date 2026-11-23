#!/usr/bin/env node
// Prints the categories of the catalogue from the code (D52, `docs/reference/stat-categories.md`), so
// a placement can be checked without the app: the counts per category and sub-group in each league,
// players and teams (the team's own / its opponents'), and with --metrics every metric's placements.
//
// usage: node scripts/stat-categories.mjs [--metrics] [--category=<id>] [--id=<metric>]
//   --metrics        every metric: id, label, family (the source), leagues, categories
//   --category=<id>  only the metrics, or counts, of one category
//   --id=<metric>    one metric, in every league
//
// Each league reads the catalogue as its screens do (`catalogueInfo`): a metric counts where it is
// not unavailable. No database is opened.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const listMetrics = process.argv.includes('--metrics')
const onlyCategory = arg('category')
const onlyId = arg('id')

// Vite loads the TypeScript sources as the app's build reads them, with the same aliases.
const server = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@shared': join(ROOT, 'src/shared'), '@main': join(ROOT, 'src/main') } }
})
try {
  const { catalogueInfo } = await server.ssrLoadModule('/src/main/stats/engine/registry.ts')
  const { LEAGUE_IDS, LEAGUES } = await server.ssrLoadModule('/src/shared/leagues.ts')
  const { CATEGORIES, isUmbrella } = await server.ssrLoadModule('/src/shared/stats/categories.ts')

  const byLeague = Object.fromEntries(LEAGUE_IDS.map((l) => [l, catalogueInfo(LEAGUES[l])]))
  const base = byLeague[LEAGUE_IDS[0]]
  const GAMES = new Set(['gp', 'team_gp'])
  const shown = (m) => !m.unavailable && m.tier !== 'stored' && !GAMES.has(m.id)
  const side = (m) => (m.entity === 'player' ? 'player' : m.id.startsWith('opp_') ? 'opp' : 'team')
  const leaguesOf = (i) =>
    LEAGUE_IDS.filter((l) => shown(byLeague[l][i]))
      .map((l) => LEAGUES[l].name)
      .join(', ') || 'none'

  if (onlyId || listMetrics) {
    base.forEach((m, i) => {
      if (onlyId && m.id !== onlyId) return
      const cats = m.categories ?? []
      if (onlyCategory && !cats.some((p) => p.startsWith(`${onlyCategory}.`))) return
      console.log([m.id, m.label, m.family, leaguesOf(i), cats.join(' ') || '(stored)'].join('\t'))
    })
  } else {
    const count = (l, pred) => byLeague[l].filter((m) => shown(m) && pred(m)).length
    const cell = (l, p) => {
      const has = (m) => (m.categories ?? []).some((x) => x === p || x.startsWith(`${p}.`))
      const players = count(l, (m) => side(m) === 'player' && has(m))
      const team = count(l, (m) => side(m) === 'team' && has(m))
      const opp = count(l, (m) => side(m) === 'opp' && has(m))
      return `${players}  ${team}/${opp}`
    }
    console.log(['Category or sub-group', ...LEAGUE_IDS.map((l) => LEAGUES[l].name)].join('\t'))
    for (const c of CATEGORIES) {
      if (onlyCategory && c.id !== onlyCategory) continue
      console.log([c.label, ...LEAGUE_IDS.map((l) => cell(l, c.id))].join('\t'))
      for (const g of c.groups) {
        const p = `${c.id}.${g.id}`
        const row = LEAGUE_IDS.map((l) => cell(l, p))
        if (row.every((r) => r === '0  0/0')) continue
        // An umbrella's sub-group is a heading; the views over 40 are the specific ones beneath it.
        const over =
          !isUmbrella(p) && row.some((r) => r.split(/\s+|\//).some((n) => Number(n) > 40))
        console.log([`  ${g.label}${over ? '  OVER 40' : ''}`, ...row].join('\t'))
      }
    }
    const unplaced = base.filter((m) => m.tier !== 'stored' && !m.categories?.length)
    console.log(
      `\n${base.length} metrics, ${base.filter((m) => m.tier === 'stored').length} stored, ${unplaced.length} unplaced${unplaced.length ? `: ${unplaced.map((m) => m.id).join(', ')}` : ''}.`
    )
    console.log('Each cell: players  team/opponents, metrics shown in the league.')
  }
} finally {
  await server.close()
}
