import { describe, expect, it } from 'vitest'
import { ON_COURT, ON_COURT_SAMPLE_LABELS } from '@shared/stats/catalogue/onCourt'

/** The team's and the opponents' rates on and off the floor (T1703.3, audit entry 275). */
const by = new Map(ON_COURT.map((m) => [m.id, m]))
const of = (id: string): (typeof ON_COURT)[number] => {
  const m = by.get(id)
  if (!m) throw new Error(`no ${id}`)
  return m
}

const RATES = [
  'efg_pct',
  'ts_pct',
  'fg3a_rate',
  'fta_rate',
  'tm_tov_pct',
  'tm_orb_pct',
  'tm_drb_pct',
  'tm_trb_pct'
]
const AGAINST = ['opp_efg_pct', 'opp_ts_pct', 'opp_fg3a_rate', 'opp_fta_rate', 'opp_tov_pct']

describe('the rates on and off the floor', () => {
  it('has every rate on, off and on less off, each once', () => {
    for (const r of [...RATES, ...AGAINST]) {
      for (const floor of ['onc', 'offc', 'onoff']) {
        expect(
          ON_COURT.filter((m) => m.id === `${floor}_${r}`),
          `${floor}_${r}`
        ).toHaveLength(1)
      }
    }
    // The opponents' rebounding is one less the team's, so it is not a metric of its own.
    expect(by.has('onc_opp_orb_pct')).toBe(false)
  })

  it('reads a difference as on less off, with the samples of the side it is read from', () => {
    expect(of('onoff_tm_tov_pct').value).toBe(
      '({on_tov} / nullif({on_poss}, 0)) - ({off_tov} / nullif({off_poss}, 0))'
    )
    expect(of('offc_efg_pct').sample).toBe('off_fga')
    expect(of('onoff_efg_pct').sample).toBe('on_fga')
    expect(of('offc_opp_tov_pct').sample).toBe('off_opp_poss')
    // Every sample has words.
    for (const r of [...RATES, ...AGAINST]) {
      for (const floor of ['onc', 'offc', 'onoff']) {
        expect(ON_COURT_SAMPLE_LABELS, `${floor}_${r}`).toHaveProperty(of(`${floor}_${r}`).sample)
      }
    }
  })

  it('says which way is better for each side', () => {
    const want: Record<string, string> = {
      efg_pct: 'higher',
      ts_pct: 'higher',
      fg3a_rate: 'neutral',
      fta_rate: 'higher',
      tm_tov_pct: 'lower',
      tm_drb_pct: 'higher',
      opp_efg_pct: 'lower',
      opp_ts_pct: 'lower',
      opp_fg3a_rate: 'neutral',
      opp_fta_rate: 'lower',
      opp_tov_pct: 'higher'
    }
    for (const [id, d] of Object.entries(want)) {
      for (const floor of ['onc', 'offc', 'onoff'])
        expect(of(`${floor}_${id}`).direction, id).toBe(d)
    }
  })

  it('says a turnover or a rebound is one credited to a player, and off means their own games', () => {
    for (const id of ['tm_tov_pct', 'opp_tov_pct']) {
      for (const floor of ['onc', 'offc', 'onoff'])
        expect(of(`${floor}_${id}`).description, id).toContain('Turnovers credited to a player')
    }
    for (const id of ['tm_orb_pct', 'tm_drb_pct', 'tm_trb_pct']) {
      for (const floor of ['onc', 'offc', 'onoff'])
        expect(of(`${floor}_${id}`).description, id).toContain('Rebounds credited to a player')
    }
    for (const r of [...RATES, ...AGAINST]) {
      expect(of(`onc_${r}`).description).not.toContain('games they missed')
      expect(of(`offc_${r}`).description).toContain('not games they missed')
      expect(of(`onoff_${r}`).description).toContain('not games they missed')
    }
  })

  it('places them in Impact, and in Offense or Defense by whose line it is', () => {
    expect(of('offc_ts_pct').categories).toEqual(['impact.on_off', 'offense.impact'])
    expect(of('offc_opp_ts_pct').categories).toEqual(['impact.on_off', 'defense.impact'])
    expect(of('onoff_tm_drb_pct').categories).toEqual(['impact.on_off', 'defense.impact'])
    expect(of('onoff_tm_trb_pct').categories).toEqual(['impact.on_off'])
    for (const id of ['onc_efg_pct', 'onc_opp_efg_pct', 'onc_tm_tov_pct', 'onc_tm_orb_pct'])
      expect(of(id).categories?.[0]).toBe('impact.on_off')
  })
})
