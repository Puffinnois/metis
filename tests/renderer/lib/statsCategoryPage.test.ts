import { describe, expect, it } from 'vitest'
import { BOARDS } from '@/lib/stats/boards'
import {
  categoryOfTab,
  categoryTab,
  OLD_PLAYER_TABS,
  OLD_TEAM_TABS,
  openAtFirst,
  pageSections,
  rescalesAny,
  valuedCount
} from '@/lib/stats/categoryPage'
import {
  boardCategories,
  boardForMetric,
  pickerGroups,
  primaryGroups
} from '@/lib/stats/categoryViews'
import { MAX_COLUMNS, tabOf } from '@/lib/stats/leaderboard'
import { playerTabOf } from '@/lib/stats/player'
import { teamTabOf } from '@/lib/stats/team'
import { LEAGUES, type League } from '@shared/leagues'
import { CATALOGUE, metricIn } from '@shared/stats/catalogue'
import { sampleLabel } from '@shared/stats/samples'
import type { MetricDef, MetricInfo } from '@shared/stats/types'

/** The catalogue as a league's renderer receives it: a metric the league lacks reads unavailable. */
function catalogueInfo(league: League): MetricInfo[] {
  return CATALOGUE.map((d) => {
    const def = metricIn(d, league)
    const info: Partial<MetricDef> = { ...def }
    delete info.value
    delete info.sample
    return {
      ...(info as Omit<MetricDef, 'value' | 'sample'>),
      grains: def.published ? ['season'] : ['game', 'season'],
      sampleLabel: sampleLabel(def.sample),
      qualifyLabel: sampleLabel(def.qualifyBy ?? def.sample),
      stability: null
    }
  })
}

const NBA = catalogueInfo(LEAGUES.nba)
const NCAAM = catalogueInfo(LEAGUES.ncaam)
const players = tabOf('player', 'ALL')
const team = tabOf('team', 'offense')
const opponents = tabOf('team', 'defense')

describe('a page by category (D52, T1702.4)', () => {
  it('names a category tab and reads it back', () => {
    expect(categoryTab('shooting')).toBe('cat:shooting')
    expect(categoryOfTab('cat:shooting')).toBe('shooting')
    expect(categoryOfTab('log')).toBeNull()
  })

  it('opens an old tab id on the category that holds its metrics', () => {
    expect(playerTabOf('shots')).toBe('cat:shooting')
    expect(playerTabOf('matchups')).toBe('cat:defense')
    expect(playerTabOf('tracking')).toBe('cat:hustle')
    expect(playerTabOf('log')).toBe('log')
    expect(teamTabOf('offense')).toBe('cat:offense')
    expect(teamTabOf('plays')).toBe('cat:playmaking')
    expect(teamTabOf('schedule')).toBe('schedule')
    for (const t of [...Object.values(OLD_PLAYER_TABS), ...Object.values(OLD_TEAM_TABS)])
      expect(t.startsWith('cat:')).toBe(true)
  })

  it('reaches every metric of a category on its tab, each section one query of 40 or fewer', () => {
    for (const catalogue of [NBA, NCAAM]) {
      // A player's tab holds the whole category; a team's, its two sides together.
      for (const [kind, sides] of [
        [players, [players]],
        [team, [team, opponents]]
      ] as const)
        for (const c of boardCategories(catalogue, kind)) {
          const sections = sides.flatMap((t) => pageSections(catalogue, t, c.id))
          for (const s of sections) expect(s.metrics.length).toBeLessThanOrEqual(MAX_COLUMNS)
          const on = new Set(sections.flatMap((s) => s.metrics))
          for (const g of pickerGroups(catalogue, kind, c.id))
            for (const m of g.metrics)
              expect(on.has(m.id), `${kind.entity} ${c.id} ${m.id}`).toBe(true)
        }
    }
  })

  it("names an umbrella's long heading by its sub-group, and opens a short tab whole", () => {
    const offense = pageSections(NBA, players, 'offense')
    expect(offense.some((s) => s.title === 'Shooting › Threes')).toBe(true)
    expect(offense[0].key).toBe('key')
    expect([...openAtFirst(offense)]).toEqual(offense.slice(0, 2).map((s) => s.key))
    const rebounding = pageSections(NCAAM, players, 'rebounding')
    expect(openAtFirst(rebounding).size).toBe(rebounding.length)
  })
})

describe("the home's boards open on their metric's category", () => {
  it('opens each board on a view holding its metric', () => {
    for (const b of BOARDS) {
      const at = boardForMetric(NBA, tabOf(b.entity, b.tab), b.metric)
      expect(at, b.metric).not.toBeNull()
      expect(at!.view.metrics).toContain(b.metric)
      expect(at!.category).toBe(NBA.find((m) => m.id === b.metric)!.categories![0].split('.')[0])
    }
    expect(boardForMetric(NBA, team, 'team_nrtg')?.category).toBe('results')
    // An opponents' metric leads with its end, so it opens on that umbrella.
    expect(boardForMetric(NBA, team, 'opp_tov')?.category).toBe('defense')
    expect(boardForMetric(NBA, team, 'team_fg_pct')?.tab).toBe('offense')
  })
})

describe('a select or list shows each metric once', () => {
  it('lists every offered metric once, under its primary placement', () => {
    const groups = primaryGroups(NBA, players)
    const ids = groups.flatMap((g) => g.metrics.map((m) => m.id))
    expect(new Set(ids).size).toBe(ids.length)
    const offered = new Set(pickerGroups(NBA, players).flatMap((g) => g.metrics.map((m) => m.id)))
    expect(new Set(ids)).toEqual(offered)
    expect(groups.find((g) => g.metrics.some((m) => m.id === 'dreb'))?.label).toBe(
      'Rebounding › Defensive'
    )
  })
})

describe("a section's count of values", () => {
  it('counts the metrics that hold a value for the page’s player or team', () => {
    const section = { key: 'k', title: 'Key stats', metrics: ['a', 'b', 'c'] }
    const result = {
      rows: [{ id: 'p', values: { a: { value: 1 }, b: { value: null } } }]
    } as unknown as Parameters<typeof valuedCount>[1]
    expect(valuedCount(section, result, 'p')).toBe(1)
    expect(valuedCount(section, result, 'someone else')).toBe(0)
  })
})

describe('the mode control', () => {
  it('is left out of a tab of published values only, a player’s Predictive', () => {
    const nba = catalogueInfo(LEAGUES.nba)
    const players = tabOf('player', 'ALL')
    expect(rescalesAny(nba, players, 'predictive')).toBe(false)
    expect(rescalesAny(nba, players, 'scoring')).toBe(true)
    expect(rescalesAny(catalogueInfo(LEAGUES.wnba), players, 'predictive')).toBe(false)
  })
})
