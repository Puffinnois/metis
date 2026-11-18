import { afterEach, describe, expect, it } from 'vitest'
import { perGameQualifier } from '@/lib/stats/boards'
import { presetsIn } from '@/lib/stats/chart'
import { defaultColumns } from '@/lib/stats/compare'
import { shownTab, shownTabs } from '@/lib/stats/dashboard'
import { defaultBoard, familiesOf, familyColumns, pickable, tabOf } from '@/lib/stats/leaderboard'
import { inLeague, setLeague } from '@/lib/stats/league'
import { playSplitNotes } from '@/lib/stats/splits'
import { PLAYER_DASH_TABS, TAB_SECTIONS } from '@/lib/stats/player'
import { halvesNote, LEAGUES, type League } from '@shared/leagues'
import { CATALOGUE, metricIn } from '@shared/stats/catalogue'
import { sampleLabel } from '@shared/stats/samples'
import type { MetricDef, MetricInfo } from '@shared/stats/types'

/** What the screens say and offer on either league, read from the registry (Plan T1301.9). */
afterEach(() => setLeague('nba'))

/** The catalogue as a league's renderer receives it. */
function catalogueIn(league: League): MetricInfo[] {
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
const NBA = catalogueIn(LEAGUES.nba)
const WNBA = catalogueIn(LEAGUES.wnba)
const byId = (c: MetricInfo[]): Map<string, MetricInfo> => new Map(c.map((m) => [m.id, m]))

describe('the home’s per-game minimum, in the season on screen', () => {
  it('asks 58 of 82 in a full NBA season and scales a shortened one', () => {
    expect(perGameQualifier(2026, LEAGUES.nba)).toBe('Per game: 58 games of 82 to qualify')
    expect(perGameQualifier(1999, LEAGUES.nba)).toBe('Per game: 35 games of 50 to qualify')
  })

  it('asks 31 of a 44-game WNBA season and 24 of a 34-game one, saying whose rule it is', () => {
    expect(perGameQualifier(2026, LEAGUES.wnba)).toBe(
      "Per game: 31 games of 44 to qualify, the NBA's minimum scaled, until the WNBA's own are read"
    )
    expect(perGameQualifier(2010, LEAGUES.wnba)).toMatch(/^Per game: 24 games of 34 to qualify/)
  })
})

describe('copy that names a source, in the league on screen', () => {
  it('names the league and its shot file’s seasons', () => {
    const note = 'From the {league}’s shot chart file, {shotsFrom}'
    expect(inLeague(note, LEAGUES.nba)).toBe('From the NBA’s shot chart file, 1996-97 on')
    expect(inLeague(note, LEAGUES.wnba)).toBe(
      'From the WNBA’s shot chart file, 1997 on, located from 2011'
    )
  })

  it('says the splits come from the league’s play by play, and where games were in halves', () => {
    setLeague('wnba')
    const notes = playSplitNotes({ season: 2005, seasonType: 'regular', range: { kind: 'season' } })
    expect(notes[0]).toContain("from the WNBA's play by play")
    expect(notes[1]).toBe(
      "Games to 2005 were in two halves: the 4th quarter's rules read the second half."
    )
    expect(
      playSplitNotes({ season: 2006, seasonType: 'regular', range: { kind: 'season' } })
    ).toHaveLength(1)
    expect(halvesNote(LEAGUES.nba, [1997, 2026])).toBeNull()
  })
})

describe('what a league does not have is not offered', () => {
  it('hides the WNBA’s Tracking, Play types and Matchups tabs, and keeps the NBA’s', () => {
    const wnba = shownTabs(PLAYER_DASH_TABS, TAB_SECTIONS, byId(WNBA)).map((t) => t.id)
    expect(wnba).not.toContain('tracking')
    expect(wnba).not.toContain('play_types')
    expect(wnba).not.toContain('matchups')
    expect(wnba).toContain('shots')
    expect(wnba).toContain('profile')
    expect(shownTabs(PLAYER_DASH_TABS, TAB_SECTIONS, byId(NBA))).toEqual(PLAYER_DASH_TABS)
    // Before the catalogue answers, every tab.
    expect(shownTabs(PLAYER_DASH_TABS, TAB_SECTIONS, new Map())).toEqual(PLAYER_DASH_TABS)
    // A tab asked for that the league does not show opens the first.
    const tabs = shownTabs(PLAYER_DASH_TABS, TAB_SECTIONS, byId(WNBA))
    expect(shownTab('tracking', tabs)).toBe('overview')
    expect(shownTab('shots', tabs)).toBe('shots')
  })

  it('never opens a preset or a default on a metric the league does not show', () => {
    const tab = tabOf('player', 'ALL')
    expect(pickable(WNBA, tab).some((m) => m.unavailable)).toBe(false)
    expect(familiesOf(WNBA, tab)).not.toContain('tracking')
    expect(familiesOf(NBA, tab)).toContain('tracking')
    // The Box-score ratings preset opened on BPM, which the WNBA does not show.
    const ratings = familyColumns(WNBA, tab, 'box_composites')
    expect(ratings).not.toContain('bpm')
    expect(familyColumns(NBA, tab, 'box_composites')[0]).toBe('bpm')
    const w = byId(WNBA)
    expect(defaultBoard('player', 'ALL', w).columns.every((id) => !w.get(id)?.unavailable)).toBe(
      true
    )
    expect(defaultColumns('player', WNBA).every((id) => !w.get(id)?.unavailable)).toBe(true)
    expect(presetsIn('player', w).map((p) => p.label)).not.toContain('Drives vs points per drive')
    expect(presetsIn('player', byId(NBA))).toHaveLength(4)
  })
})
