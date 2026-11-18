import { describe, expect, it } from 'vitest'
import { CATALOGUE, METRICS, metricIn, notBuiltYet, tablesOf } from '@shared/stats/catalogue'
import { coverageReason } from '@shared/stats/coverage'
import { LEAGUES, type League } from '@shared/leagues'
import type { MetricDef } from '@shared/stats/types'

const nba = LEAGUES.nba
const wnba = LEAGUES.wnba
const m = (id: string): MetricDef => METRICS.get(id)!
const inWnba = (id: string): MetricDef => metricIn(m(id), wnba)

describe('the catalogue in the WNBA', () => {
  it('states every metric’s WNBA coverage', () => {
    expect(CATALOGUE.filter((d) => d.leagues?.wnba === undefined).map((d) => d.id)).toEqual([])
  })

  it('reads box-score metrics from 1997, each later source from its first season', () => {
    expect(inWnba('pts').firstSeason).toBe(1997)
    expect(inWnba('pts').unavailable).toBeUndefined()
    expect(inWnba('team_fg_pct').firstSeason).toBe(1997)
    // The game logs' plus-minus from 2008; who started from 2002 (ESPN's flags); ESPN's points by
    // kind from 2023.
    expect(inWnba('plus_minus').firstSeason).toBe(2008)
    expect(inWnba('gs').firstSeason).toBe(2002)
    expect(inWnba('team_bench_pts').firstSeason).toBe(2002)
    expect(inWnba('team_paint_pts').firstSeason).toBe(2023)
    expect(inWnba('opp_fast_break_pts').firstSeason).toBe(2023)
    expect(inWnba('team_share_pts_tov').firstSeason).toBe(2023)
    // The NBA's gap in ESPN's 2018 file is the NBA's alone.
    expect(inWnba('team_paint_pts').missingSeasons).toBeUndefined()
    expect(coverageReason(inWnba('plus_minus'), [2007], wnba)).toBe('Recorded from 2008.')
    expect(coverageReason(inWnba('plus_minus'), [2007, 2008], wnba)).toBeNull()
  })

  it('says why a family no WNBA release publishes has nothing', () => {
    for (const family of ['tracking', 'hustle', 'play_types', 'matchups'] as const) {
      const def = CATALOGUE.find((d) => d.family === family)!
      expect(metricIn(def, wnba).unavailable).toMatch(
        /^Not published for the WNBA: no release holds/
      )
      expect(metricIn(def, nba).unavailable).toBeUndefined()
    }
    const out = CATALOGUE.find((d) => d.family === 'availability')!
    expect(metricIn(out, wnba).unavailable).toMatch(/no official injury report/)
  })

  it('reads a table a later part builds as not built yet, from the league’s builds', () => {
    const published = CATALOGUE.find((d) => d.family === 'composite' && d.published)!
    const model = m('ws')
    const shots = CATALOGUE.find((d) => d.family === 'shots')!
    const plays = CATALOGUE.find((d) => d.family === 'plays')!
    expect(tablesOf(published)).toBe('published')
    expect(tablesOf(model)).toBe('models')
    expect(tablesOf(shots)).toBe('plays')
    expect(tablesOf(plays)).toBe('plays')
    expect(tablesOf(m('pts'))).toBe('derived')
    // The WNBA's entry as it was before T1301.7: its identity and game tables only.
    const before: League = { ...wnba, builds: ['identity', 'derived'] }
    expect(metricIn(published, before).unavailable).toBe(
      'Not built for the WNBA yet: its published season stats come in a later version.'
    )
    expect(metricIn(model, before).unavailable).toBe(notBuiltYet(before, 'models'))
    expect(metricIn(shots, before).unavailable).toBe(notBuiltYet(before, 'plays'))
    // T1301.7 adds the published tables and the plays: their reasons lift, the models' stays.
    expect(metricIn(published, wnba).unavailable).toBeUndefined()
    expect(metricIn(shots, wnba).unavailable).toBeUndefined()
    expect(metricIn(plays, wnba).unavailable).toBeUndefined()
    expect(metricIn(model, wnba).unavailable).toBe(notBuiltYet(wnba, 'models'))
    // A part that adds its step lifts the reason, with nothing else changed.
    const later: League = { ...wnba, builds: [...wnba.builds, 'models'] }
    expect(metricIn(published, later).unavailable).toBeUndefined()
    expect(metricIn(model, later).unavailable).toBeUndefined()
    expect(metricIn(shots, later).unavailable).toBeUndefined()
    // The NBA builds them all: the same objects as written.
    for (const def of [published, model, shots, plays, m('pts')]) {
      expect(metricIn(def, nba)).toBe(def)
    }
  })

  it('reads a metric the WNBA says another way with its reason', () => {
    expect(inWnba('team_pace40').unavailable).toBe(
      "The WNBA's pace is per 40 minutes already: see Pace."
    )
    expect(metricIn(m('team_pace40'), nba).unavailable).toBeUndefined()
  })
})

describe('a formula that holds the game length', () => {
  it('reads pace per 40 in the WNBA, per 48 in the NBA as written', () => {
    const pace = m('team_pace')
    expect(metricIn(pace, nba)).toBe(pace)
    expect(pace.value).toBe('48 * {poss_sym} / nullif({minutes} / 5.0, 0)')
    expect(inWnba('team_pace').value).toBe('40 * {poss_sym} / nullif({minutes} / 5.0, 0)')
    expect(inWnba('team_pace').description).toMatch(/per 40 minutes/)
    expect(inWnba('team_pace').description).not.toMatch(/48/)
  })

  it('reads seconds in a game as the league’s, and the words with them', () => {
    expect(inWnba('onc_pace').value).toBe(
      '2400 * ({on_poss} + {on_opp_poss}) / 2.0 / nullif({on_secs}, 0)'
    )
    expect(inWnba('ws_48')).toMatchObject({
      label: 'Win Shares per 40 minutes',
      short: 'WS/40',
      value: '40 * {ws} / nullif({cmp_minutes}, 0)'
    })
    // An id is a key, never rewritten.
    expect(inWnba('ws_48').id).toBe('ws_48')
  })

  it('leaves every other metric’s words and formula as written', () => {
    // The Pythagorean exponent and the WNBA's own words for its playoff format are the other changes.
    const other = (d: (typeof CATALOGUE)[number]): boolean =>
      !d.gameLength && !d.pythagorean && !d.leagues?.wnba?.words
    for (const def of CATALOGUE.filter(other)) {
      const read = metricIn(def, wnba)
      expect([read.value, read.label, read.short]).toEqual([def.value, def.label, def.short])
    }
  })
})
