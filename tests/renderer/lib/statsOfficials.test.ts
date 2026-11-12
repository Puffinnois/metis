import { describe, expect, it } from 'vitest'
import {
  careerRows,
  coverageText,
  FEW_GAMES,
  officialCells,
  OFFICIAL_HEAD,
  OFFICIAL_NOTES,
  seasonRows
} from '@/lib/stats/officials'
import type { StatsOfficiatingTotals, StatsOfficialsSeason } from '@shared/stats/types'

const totals = (
  games: number,
  o: Partial<StatsOfficiatingTotals> = {}
): StatsOfficiatingTotals => ({
  games,
  homeFouls: 20 * games,
  awayFouls: 21 * games,
  homeFta: 22 * games,
  awayFta: 23 * games,
  homePts: 115 * games,
  awayPts: 112 * games,
  homeWins: Math.round(games * 0.55),
  ...o
})

const SEASON: StatsOfficialsSeason = {
  season: 2026,
  coverage: { games: 1230, withCrew: 1230, crewSizes: { 3: 1200, 4: 30 } },
  league: totals(1230),
  officials: [
    { id: '10', name: 'Ed Malloy', jersey: '7', totals: totals(60, { homeWins: 30 }) },
    { id: '12', name: 'Aaron Smith', jersey: null, totals: totals(8, { homeWins: 2 }) }
  ],
  reason: null
}

describe('officials’ rates', () => {
  it('divide each total by the games, one cell per column', () => {
    const cells = officialCells(totals(10, { homeWins: 6 }), true)
    expect(cells).toHaveLength(OFFICIAL_HEAD.length)
    expect(cells).toEqual(['10', '41.0', '45.0', '20.0', '21.0', '22.0', '23.0', '227.0', '60.0%'])
  })

  it('leave the rates blank, not zero, where they are not read, and keep the games', () => {
    expect(officialCells(totals(3), false)).toEqual(['3', '—', '—', '—', '—', '—', '—', '—', '—'])
    expect(officialCells(totals(0), true)[1]).toBe('—')
  })

  it('put the league first, then the officials as read, marking a line of few games', () => {
    const rows = seasonRows(SEASON)
    expect(rows.map((r) => [r.name, r.league, r.note])).toEqual([
      ['League', true, null],
      ['Ed Malloy', false, null],
      ['Aaron Smith', false, '8 games: few']
    ])
    expect(rows[1].cells[8]).toBe('50.0%')
    expect(FEW_GAMES).toBe(20)
  })

  it('give a season with no rates its games but no rates, and no few-games note', () => {
    const rows = seasonRows({ ...SEASON, reason: 'Crews are listed for 1 of 2 games …' })
    expect(rows[2].cells.slice(1).every((c) => c === '—')).toBe(true)
    expect(rows[2].note).toBeNull()
  })

  it('list an official’s seasons, each with the league’s line below it and its reason', () => {
    const rows = careerRows({
      id: '10',
      name: 'Ed Malloy',
      jersey: '7',
      seasons: [
        {
          season: 2026,
          totals: totals(60),
          league: totals(1230),
          coverage: SEASON.coverage,
          reason: null
        },
        {
          season: 2003,
          totals: totals(2),
          league: totals(1277),
          coverage: { games: 1277, withCrew: 22, crewSizes: { 3: 22 } },
          reason: 'Crews are listed for 22 of 1277 games in 2002-03; rates start in 2003-04.'
        }
      ]
    })
    expect(rows.map((r) => [r.name, r.league])).toEqual([
      ['2025-26', false],
      ['League', true],
      ['2002-03', false],
      ['League', true]
    ])
    expect(rows[2].note).toMatch(/^Crews are listed for 22/)
    expect(rows[3].cells[1]).toBe('—')
  })

  it('say how many games have a crew, and the crews’ sizes', () => {
    expect(coverageText(SEASON.coverage)).toBe(
      '1,230 of 1,230 games have a crew listed; crews of 3 on 1,200, 4 on 30.'
    )
    expect(coverageText({ games: 2, withCrew: 0, crewSizes: {} })).toBe(
      '0 of 2 games have a crew listed.'
    )
    expect(coverageText({ games: 0, withCrew: 0, crewSizes: {} })).toBe('No games played in scope.')
  })

  it('state facts, with no word that ranks officials or suggests favour', () => {
    const copy = [...OFFICIAL_NOTES, ...OFFICIAL_HEAD].join(' ').toLowerCase()
    for (const word of ['best', 'worst', 'bias', 'favor', 'favour', 'rank', 'strict', 'lenient']) {
      expect(copy).not.toContain(word)
    }
  })
})
