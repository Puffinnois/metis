import { describe, expect, it } from 'vitest'
import { SOURCES_BY_LEAGUE } from '../../src/main/stats/sources'
// @ts-expect-error: a plain script module with no types
import { loadSourceRegistry } from '../../scripts/lib/source-registry.mjs'

// The measuring scripts (load-report.mjs, check-source-rows.mjs) read the source registry under plain
// Node. Its import of the league registry, by the `@shared` alias, broke them once (T1304.2) with no
// test noticing; this reads it the scripts' way and compares it with the app's.
describe('the source registry read by the scripts', () => {
  it('loads under plain Node with every league, equal to the app’s', async () => {
    const registry = await loadSourceRegistry()
    expect(Object.keys(registry.SOURCES_BY_LEAGUE).sort()).toEqual(
      Object.keys(SOURCES_BY_LEAGUE).sort()
    )
    for (const [league, sources] of Object.entries(SOURCES_BY_LEAGUE)) {
      expect(registry.SOURCES_BY_LEAGUE[league].map((s: { id: string }) => s.id)).toEqual(
        sources.map((s) => s.id)
      )
    }
    expect(registry.LOAD_TIERS).toEqual(['core', 'published', 'events', 'plays'])
  })
})
