import { describe, expect, it } from 'vitest'
import { hiddenNote, INDEX_ROWS, moreRows, moreTarget, playerIndex } from '@/lib/stats/playerSearch'
import { LEAGUES } from '@shared/leagues'
import type { StatsIndexedPlayer } from '@shared/stats/types'

/** NCAA Men's index as the worker orders it: the newest season first, then by name. */
const NCAAM: StatsIndexedPlayer[] = [
  { id: '5142718', name: 'Jayden Quaintance', lastSeason: 2026, team: 'UK' },
  { id: '4432573', name: 'Cooper Flagg', lastSeason: 2025, team: 'DUKE' },
  { id: '77', name: 'Ace Flaggstaff', lastSeason: 2023, team: null },
  { id: '78', name: 'Luka Šamanić', lastSeason: 2024, team: 'GT' }
]
const none = new Set<string>()

describe('the search beyond the ranked rows (T1304.5)', () => {
  it('finds anyone with a page in the league, in any season, with their last team and season', () => {
    const { rows, hidden } = moreRows(playerIndex(NCAAM), 'Flagg', none, LEAGUES.ncaam)
    expect(rows).toEqual([
      {
        id: '4432573',
        name: 'Cooper Flagg',
        detail: 'DUKE · 2024-25',
        season: 2025,
        title: 'Open Cooper Flagg’s page, 2024-25'
      },
      {
        id: '77',
        name: 'Ace Flaggstaff',
        detail: '2022-23',
        season: 2023,
        title: 'Open Ace Flaggstaff’s page, 2022-23'
      }
    ])
    expect(hidden).toBe(0)
  })

  it('leaves out those the ranked rows already list', () => {
    const { rows } = moreRows(playerIndex(NCAAM), 'flagg', new Set(['4432573']), LEAGUES.ncaam)
    expect(rows.map((r) => r.name)).toEqual(['Ace Flaggstaff'])
  })

  it('matches as the rail does: any case, accents ignored, a full name', () => {
    const index = playerIndex(NCAAM)
    expect(moreRows(index, 'jayden quaintance', none, LEAGUES.ncaam).rows[0].id).toBe('5142718')
    expect(moreRows(index, 'SAMANIC', none, LEAGUES.ncaam).rows[0].id).toBe('78')
  })

  it('waits for two letters and for the index', () => {
    expect(moreRows(playerIndex(NCAAM), 'f', none, LEAGUES.ncaam).rows).toEqual([])
    expect(moreRows(null, 'flagg', none, LEAGUES.ncaam).rows).toEqual([])
  })

  it('lists a page of rows and counts the rest', () => {
    const many = Array.from({ length: INDEX_ROWS + 7 }, (_, i) => ({
      id: String(i),
      name: `Smith ${i}`,
      lastSeason: 2026,
      team: 'X'
    }))
    const { rows, hidden } = moreRows(playerIndex(many), 'smith', none, LEAGUES.wnba)
    expect(rows).toHaveLength(INDEX_ROWS)
    expect(rows[0].detail).toBe('X · 2026')
    expect(hidden).toBe(7)
    expect(hiddenNote(hidden)).toBe('7 more. Type more of the name.')
    expect(hiddenNote(0)).toBeNull()
  })
})

describe('where a row of the search opens', () => {
  it('moves within the rail in the season on screen, and opens another season’s page', () => {
    expect(moreTarget({ id: '5142718', season: 2026 }, LEAGUES.ncaam, 2026)).toBeNull()
    expect(moreTarget({ id: '4432573', season: 2025 }, LEAGUES.ncaam, 2026)).toEqual({
      league: 'ncaam',
      screen: 'player',
      team: null,
      player: { id: '4432573', position: null },
      season: 2025
    })
  })
})
