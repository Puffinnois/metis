import { afterEach, describe, expect, it } from 'vitest'
import { against, fmtCount, highsView, type HighsView } from '@/lib/stats/highs'
import { setLeague } from '@/lib/stats/league'
import { LEAGUES, type League } from '@shared/leagues'
import { CATALOGUE, metricIn } from '@shared/stats/catalogue'
import { GAME_COUNTS } from '@shared/stats/highs'
import type { GameCount, MetricInfo, StatsPlayerGame } from '@shared/stats/types'

const catalogue = (league: League): ReadonlyMap<string, MetricInfo> =>
  new Map(CATALOGUE.map((d) => [d.id, metricIn(d, league) as unknown as MetricInfo]))

let n = 0
function game(
  season: number,
  counts: Partial<Record<GameCount, number | null>>,
  over: Partial<StatsPlayerGame> = {}
): StatsPlayerGame {
  n++
  return {
    gameId: `g${n}`,
    date: `${season - 1}-11-${String((n % 28) + 1).padStart(2, '0')}`,
    season,
    gameType: 'regular',
    team: 'LAL',
    opponentId: '1',
    opponent: 'BOS',
    home: true,
    won: true,
    counts: GAME_COUNTS.map((c) => (c in counts ? (counts[c] ?? null) : 0)),
    ...over
  }
}

const view = (
  games: StatsPlayerGame[],
  over: Partial<Parameters<typeof highsView>[0]> = {}
): HighsView =>
  highsView({
    games,
    types: ['regular'],
    counted: LEAGUES.nba.countedTypes,
    season: 2026,
    latest: 2026,
    byId: catalogue(LEAGUES.nba),
    ...over
  })
const high = (v: HighsView, id: string): HighsView['highs'][number] =>
  v.highs.find((r) => r.id === id)!
const streak = (v: HighsView, id: string): HighsView['streaks'][number] =>
  v.streaks.find((r) => r.id === id)!

afterEach(() => setLeague('nba'))

describe('the Highs tab', () => {
  it('gives the season’s and the career’s high, each with its game', () => {
    n = 0
    const games = [game(2025, { pts: 41 }), game(2026, { pts: 30 }), game(2026, { pts: 30 })]
    const points = high(view(games), 'pts')
    expect(points.label).toBe('Points')
    expect(points.season).toMatchObject({ text: '30', gameId: games[2].gameId })
    expect(points.season.note).toBe('Nov 4, 2025 vs BOS · 2 times')
    expect(points.career).toMatchObject({ text: '41', gameId: games[0].gameId })
  })

  it('keeps to the page’s season type', () => {
    n = 0
    const games = [game(2026, { pts: 20 }), game(2026, { pts: 50 }, { gameType: 'playoffs' })]
    expect(high(view(games), 'pts').career.text).toBe('20')
    expect(high(view(games, { types: ['playoffs'] }), 'pts').career.text).toBe('50')
    expect(high(view(games, { types: ['regular', 'playoffs'] }), 'pts').season.text).toBe('50')
  })

  it('says a season has no games, and keeps the career', () => {
    n = 0
    const v = view([game(2024, { pts: 25 })])
    expect(high(v, 'pts').season).toMatchObject({ text: '—', title: 'No games in 2025-26.' })
    expect(streak(v, 'pts20').season).toMatchObject({ text: '—', title: 'No games in 2025-26.' })
    expect(high(v, 'pts').career.text).toBe('25')
  })

  it('reads a count no line has by its reason, never 0', () => {
    n = 0
    const before = view([game(1996, { plus_minus: null })], { season: 1996, latest: 2026 })
    expect(high(before, 'plus_minus').season.text).toBe('—')
    expect(high(before, 'plus_minus').season.title).toBe('Recorded from 1996-97.')
    setLeague('ncaam')
    const college = view([game(2026, { plus_minus: null })], { byId: catalogue(LEAGUES.ncaam) })
    expect(high(college, 'plus_minus').career.text).toBe('—')
    expect(high(college, 'plus_minus').career.title).toMatch(/college box scores/)
  })

  it('notes a count part of the career lacks, and from when it is kept', () => {
    n = 0
    const v = view([
      game(1996, { plus_minus: null }),
      game(1997, { plus_minus: 12 }),
      game(2026, { plus_minus: 3 })
    ])
    expect(high(v, 'plus_minus').career).toMatchObject({ text: '+12' })
    expect(v.notes).toEqual([
      'Plus-minus: 1 of 3 career games have no count (recorded from 1996-97).'
    ])
  })

  it('runs the current streak over seasons, and the season’s within it', () => {
    n = 0
    const v = view([
      game(2025, { pts: 5 }),
      game(2025, { pts: 22 }),
      game(2026, { pts: 25 }),
      game(2026, { pts: 20 })
    ])
    expect(streak(v, 'pts20').season.text).toBe('2')
    expect(streak(v, 'pts20').now.text).toBe('3')
    expect(streak(v, 'pts20').career.text).toBe('3')
    expect(streak(v, 'pts30').now).toMatchObject({ text: '0', title: 'Not in their last game' })
    expect(streak(v, 'pts30').season.text).toBe('0')
  })

  it('has no current streak for a player with no game in the latest season', () => {
    n = 0
    const v = view([game(2024, { pts: 25 })])
    expect(streak(v, 'pts20').now).toMatchObject({ text: '—', title: 'No game in 2025-26.' })
    expect(streak(v, 'pts20').career.text).toBe('1')
  })

  it('counts a player as playing by any counted game, so a playoff streak stands', () => {
    n = 0
    const games = [game(2025, { pts: 30 }, { gameType: 'playoffs' }), game(2026, { pts: 2 })]
    expect(streak(view(games, { types: ['playoffs'] }), 'pts20').now.text).toBe('1')
  })

  it('counts the threshold games by season with the career under them', () => {
    n = 0
    const v = view([game(2025, { pts: 31 }), game(2026, { pts: 20, reb: 11 }), game(2026, {})])
    expect(v.thresholds.map((r) => [r.label, r.games, r.here])).toEqual([
      ['2024-25', 1, false],
      ['2025-26', 2, true],
      ['Career', 3, false]
    ])
    const at = (row: number, id: string): string =>
      v.thresholds[row].cells[['pts10', 'pts20', 'pts30'].indexOf(id)].text
    expect([at(0, 'pts30'), at(1, 'pts20'), at(1, 'pts30'), at(2, 'pts20')]).toEqual([
      '1',
      '1',
      '0',
      '2'
    ])
    expect(v.thresholds[1].cells[11]).toMatchObject({ text: '1' })
    expect(v.bySeason[2].cells[0]).toMatchObject({ text: '31' })
  })

  it('writes minutes, a plus-minus and an opponent as a box score does', () => {
    expect(fmtCount(2116, 'seconds')).toBe('35:16')
    expect(fmtCount(2400, 'seconds')).toBe('40:00')
    expect([
      fmtCount(12, 'plus_minus'),
      fmtCount(-3, 'plus_minus'),
      fmtCount(0, 'plus_minus')
    ]).toEqual(['+12', '−3', '0'])
    expect(against(game(2026, {}, { home: false }))).toBe('@ BOS')
    expect(against(game(2026, {}, { opponent: null }))).toBe('')
  })
})
