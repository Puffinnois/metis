import { describe, expect, it } from 'vitest'
import { catalogueInfo } from '@main/stats/engine/registry'
import { LEAGUE_IDS, LEAGUES } from '@shared/leagues'
import { isUmbrella } from '@shared/stats/categories'

/** At most 40 metrics a query (`MAX_COLUMNS` on the leaderboard). */
const MAX = 40

/** The games columns are the row's own, so no board offers them (`appliesTo`). */
const GAMES = new Set(['gp', 'team_gp'])

describe('a category is shown one sub-group at a time (D52)', () => {
  it.each(LEAGUE_IDS)(
    'holds every sub-group to %s metrics or fewer for one kind and side',
    (id) => {
      const counts = new Map<string, number>()
      for (const m of catalogueInfo(LEAGUES[id])) {
        if (m.unavailable || m.tier === 'stored' || GAMES.has(m.id)) continue
        const side = m.entity === 'player' ? 'player' : m.id.startsWith('opp_') ? 'opp' : 'team'
        // An umbrella's sub-group is a heading over the specific sub-groups of its end, which are
        // what a view shows, so its own count is not a view's.
        for (const p of (m.categories ?? []).filter((x) => !isUmbrella(x))) {
          const key = `${p} ${side}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
      const over = [...counts].filter(([, n]) => n > MAX)
      expect(over).toEqual([])
      expect(counts.size).toBeGreaterThan(0)
    }
  )
})
