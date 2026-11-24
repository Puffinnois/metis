import { describe, expect, it } from 'vitest'
import {
  boardCategories,
  categoryViews,
  hasSides,
  KEY_VIEW,
  UMBRELLA_KEY_STATS,
  parentOf,
  pickerGroups,
  teamSide,
  viewOf
} from '@/lib/stats/categoryViews'
import { MAX_COLUMNS, tabOf } from '@/lib/stats/leaderboard'
import { LEAGUE_IDS, LEAGUES, type League } from '@shared/leagues'
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
const WNBA = catalogueInfo(LEAGUES.wnba)
const players = tabOf('player', 'ALL')
const team = tabOf('team', 'offense')
const opponents = tabOf('team', 'defense')
const ids = (c: { id: string }[]): string[] => c.map((x) => x.id)

describe("a board's category tabs (D52)", () => {
  it('offers only the categories the league has for the kind of row', () => {
    expect(ids(boardCategories(NBA, players))).toEqual([
      'offense',
      'defense',
      'scoring',
      'shooting',
      'playmaking',
      'rebounding',
      'fouls',
      'hustle',
      'play_types',
      'impact',
      // BOBAN's projections (T1703.2) are the NBA's and the WNBA's first player metrics here.
      'predictive',
      'results',
      'playing_time',
      // Fantasy points (T1703.2), as ordinary metrics.
      'fantasy'
    ])
    // No hustle or play types in the WNBA; teams have no playing time.
    const wnba = ids(boardCategories(WNBA, players))
    expect(wnba).not.toContain('hustle')
    expect(wnba).not.toContain('play_types')
    expect(ids(boardCategories(NBA, team))).toContain('predictive')
    expect(ids(boardCategories(NBA, team))).not.toContain('playing_time')
  })

  it("splits a team's specific category by side, and not an umbrella", () => {
    expect(hasSides(team, 'shooting')).toBe(true)
    expect(hasSides(team, 'defense')).toBe(false)
    expect(hasSides(players, 'shooting')).toBe(false)
    const own = categoryViews(NBA, team, 'shooting').flatMap((v) => v.metrics)
    const theirs = categoryViews(NBA, opponents, 'shooting').flatMap((v) => v.metrics)
    // The team's own, and the opponents' acts that are the team's offense (its shots blocked).
    expect([...new Set(own.filter((id) => id.startsWith('opp_')))]).toEqual(['opp_blk'])
    expect(theirs.length).toBeGreaterThan(0)
    expect(theirs.every((id) => id.startsWith('opp_'))).toBe(true)
    // Defense holds the team's steals and the opponents' scoring together, on either tab.
    const defense = categoryViews(NBA, team, 'defense').flatMap((v) => [
      ...v.metrics,
      ...(v.children ?? []).flatMap((c) => c.metrics)
    ])
    expect(defense).toContain('team_stl')
    expect(defense).toContain('opp_pts')
    expect(defense).not.toContain('opp_stl')
  })

  it('opens Offense and Defense on their chosen key stats, as each league has them', () => {
    // Every id of the lists exists in the catalogue, so none is silently skipped.
    const ids = new Set(CATALOGUE.map((m) => m.id))
    for (const end of Object.values(UMBRELLA_KEY_STATS))
      for (const list of Object.values(end))
        for (const id of list) expect(ids.has(id), id).toBe(true)
    const first = {
      'team offense': [
        'team_ortg',
        'team_pts',
        'team_efg_pct',
        'team_ts_pct',
        'team_tov_pct',
        'team_orb_pct'
      ],
      'team defense': [
        'team_drtg',
        'opp_pts',
        'opp_efg_pct',
        'opp_ts_pct',
        'opp_tov_pct',
        'team_drb_pct'
      ],
      'player offense': ['pts', 'ts_pct', 'efg_pct', 'fg_pct', 'fg3m', 'fg3_pct'],
      'player defense': ['stl', 'blk', 'stl_pct', 'blk_pct', 'dreb', 'drb_pct']
    }
    for (const id of LEAGUE_IDS) {
      const catalogue = catalogueInfo(LEAGUES[id])
      for (const [label, six] of Object.entries(first)) {
        const [kind, end] = label.split(' ')
        const key = categoryViews(catalogue, kind === 'team' ? team : players, end)[0]
        expect(key.key, `${id} ${label}`).toBe(KEY_VIEW)
        expect(key.metrics.slice(0, 6), `${id} ${label}`).toEqual(six)
        expect(key.metrics.length).toBeLessThanOrEqual(12)
      }
    }
    // The NBA players' defence: rim FG% allowed, deflections and contests, then the rating and models.
    expect(categoryViews(NBA, players, 'defense')[0].metrics.slice(6)).toEqual([
      'def_rim_fg_pct',
      'deflections',
      'contested_shots',
      'onc_drtg',
      'sdv_d_rapm',
      'sdv_dbpm'
    ])
    // A league without tracking takes the next: the colleges' defensive RAPM and box model.
    const ncaam = categoryViews(catalogueInfo(LEAGUES.ncaam), players, 'defense')[0].metrics
    expect(ncaam).not.toContain('def_rim_fg_pct')
    expect(ncaam).toEqual(expect.arrayContaining(['onc_drtg', 'sdv_ncaa_drapm', 'sdv_box_dbpm']))
    expect(categoryViews(catalogueInfo(LEAGUES.ncaam), team, 'offense')[0].metrics).toContain(
      'sdv_adj_o'
    )
  })

  it('leads a specific category with its key stats, then each sub-group in order', () => {
    const views = categoryViews(NBA, players, 'rebounding')
    expect(views.map((v) => v.key)).toEqual([
      KEY_VIEW,
      'rebounding.offensive',
      'rebounding.defensive',
      'rebounding.all',
      'rebounding.box_outs'
    ])
    expect(views[0].metrics).toContain('reb')
    expect(views[1].metrics).toContain('oreb')
    expect(views[1].metrics).not.toContain('dreb')
  })

  it("opens an umbrella's heading over 40 metrics on the specific sub-groups of its end", () => {
    const views = categoryViews(NBA, players, 'offense')
    const shooting = views.find((v) => v.key === 'offense.shooting')
    expect(shooting?.children?.map((c) => c.key)).toContain('shooting.corner_threes')
    expect(shooting?.children?.find((c) => c.key === 'shooting.threes')?.label).toBe('Threes')
    const corner = shooting?.children?.find((c) => c.key === 'shooting.corner_threes')
    expect(corner?.metrics).toContain('shot_c3_fg_pct')
    expect(viewOf(views, 'offense.shooting')?.key).toBe(shooting?.children?.[0].key)
    expect(viewOf(views, 'shooting.corner_threes')?.key).toBe('shooting.corner_threes')
    expect(parentOf(views, 'shooting.corner_threes')?.key).toBe('offense.shooting')
    expect(viewOf(views, 'no such view')?.key).toBe(viewOf(views, undefined)?.key)
  })

  it.each(LEAGUE_IDS)('keeps every view to 40 metrics or fewer in the %s', (id) => {
    const catalogue = catalogueInfo(LEAGUES[id])
    const tabs = [players, tabOf('player', 'G'), team, opponents]
    let views = 0
    for (const tab of tabs)
      for (const c of boardCategories(catalogue, tab))
        for (const v of categoryViews(catalogue, tab, c.id))
          for (const shown of v.children ?? [v]) {
            views++
            expect(shown.metrics.length, `${tab.id} ${shown.key}`).toBeLessThanOrEqual(MAX_COLUMNS)
            expect(shown.metrics.length, `${tab.id} ${shown.key}`).toBeGreaterThan(0)
          }
    expect(views).toBeGreaterThan(20)
  })

  it('reaches every metric of a category from its views, without a search', () => {
    for (const tab of [players, team, opponents])
      for (const c of boardCategories(NBA, tab)) {
        const reached = new Set(
          categoryViews(NBA, tab, c.id).flatMap((v) =>
            (v.children ?? [v]).flatMap((x) => x.metrics)
          )
        )
        const listed = pickerGroups(NBA, tab, c.id).flatMap((g) =>
          g.metrics
            // A team's specific category shows the side on screen.
            .filter((m) => !hasSides(tab, c.id) || teamSide(m, c.id) === tab.id)
            .map((m) => m.id)
        )
        for (const m of listed) expect(reached.has(m), `${tab.id} ${c.id} ${m}`).toBe(true)
      }
  })
})

describe("a team metric's side (the review of T1702.3)", () => {
  const side = (id: string, category: string): string =>
    teamSide(
      NBA.find((m) => m.id === id)!,
      category
    )
  const shown = (tab: ReturnType<typeof tabOf>, category: string): string[] =>
    categoryViews(NBA, tab, category).flatMap((v) => v.metrics)
  const sub = (category: string, group: string, tab: ReturnType<typeof tabOf>): string[] =>
    categoryViews(NBA, tab, category).find((v) => v.key === `${category}.${group}`)?.metrics ?? []

  it('follows the end in the categories about the ball: Scoring, Shooting, Playmaking', () => {
    // The team's own shots blocked and turnovers lost to steals read beside its field goals and turnovers.
    expect(side('opp_blk', 'shooting')).toBe('offense')
    expect(side('opp_stl', 'playmaking')).toBe('offense')
    expect(side('opp_tov', 'playmaking')).toBe('defense')
    expect(side('opp_fg_pct', 'shooting')).toBe('defense')
    expect(sub('shooting', 'field_goals', team)).toEqual(
      expect.arrayContaining(['team_fg_pct', 'opp_blk'])
    )
    expect(sub('shooting', 'field_goals', opponents)).toContain('opp_fg_pct')
    expect(shown(opponents, 'shooting')).not.toContain('opp_blk')
    expect(sub('playmaking', 'turnovers', team)).toEqual(
      expect.arrayContaining(['team_tov', 'opp_stl'])
    )
    expect(sub('playmaking', 'turnovers', opponents)).toContain('opp_tov')
    expect(shown(opponents, 'playmaking')).not.toContain('opp_stl')
  })

  it('stays whose box score it is where the acts happen at both ends', () => {
    expect(side('opp_dreb', 'rebounding')).toBe('defense')
    expect(side('team_dreb', 'rebounding')).toBe('offense')
    expect(side('opp_pf', 'fouls')).toBe('defense')
    expect(side('team_stl', 'defense')).toBe('offense')
  })
})

describe('the metric picker by category', () => {
  it('lists a metric under each category it sits in, a category chosen alone', () => {
    const all = pickerGroups(NBA, players)
    const where = all.filter((g) => g.metrics.some((m) => m.id === 'dreb'))
    expect(where.map((g) => `${g.category.id}.${g.group.id}`)).toEqual([
      'defense.rebounding',
      'rebounding.defensive'
    ])
    const one = pickerGroups(NBA, players, 'fouls')
    expect(new Set(one.map((g) => g.category.id))).toEqual(new Set(['fouls']))
    expect(pickerGroups(WNBA, players).some((g) => g.category.id === 'play_types')).toBe(false)
  })
})
