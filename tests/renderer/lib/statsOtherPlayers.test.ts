import { describe, expect, it } from 'vitest'
import { otherHeading, otherRows } from '@/lib/stats/otherPlayers'
import { LEAGUES } from '@shared/leagues'
import type { StatsOtherPlayer } from '@shared/stats/types'

/** WNBA draftees with no WNBA game, as the links file reads them from the WNBA. */
const PLAYERS: StatsOtherPlayer[] = [
  {
    league: 'ncaaw',
    playerId: '4433402',
    name: 'Abbey Hsu',
    lastSeason: 2024,
    team: 'Columbia Lions'
  },
  { league: 'ncaaw', playerId: '4398987', name: 'Helena Pueyo', lastSeason: 2024, team: null },
  { league: 'ncaaw', playerId: null, name: 'Ali Patberg', lastSeason: null, team: null }
]

describe('the search’s rows of the paired league (T1304.4)', () => {
  it('finds a name without accents or case, from two letters', () => {
    expect(otherRows(PLAYERS, 'HSU', 'ready', true).map((r) => r.name)).toEqual(['Abbey Hsu'])
    expect(otherRows(PLAYERS, 'pueyó', 'ready', true).map((r) => r.name)).toEqual(['Helena Pueyo'])
    // One letter would list them all; nothing typed lists nothing.
    expect(otherRows(PLAYERS, 'a', 'ready', true)).toEqual([])
    expect(otherRows(PLAYERS, '  ', 'ready', true)).toEqual([])
    expect(otherRows(PLAYERS, 'zz', 'ready', true)).toEqual([])
  })

  it('opens the player’s page on the Overview in their last season, where that league is ready', () => {
    expect(otherRows(PLAYERS, 'hsu', 'ready', true)).toEqual([
      {
        key: 'ncaaw:4433402',
        name: 'Abbey Hsu',
        league: 'ncaaw',
        leagueName: 'NCAA Women',
        detail: 'Columbia Lions, 2023-24',
        open: {
          league: 'ncaaw',
          screen: 'player',
          team: null,
          player: { id: '4433402', position: null },
          season: 2024,
          playerTab: 'overview'
        },
        data: null,
        title: 'Open Abbey Hsu’s NCAA Women page, 2023-24'
      }
    ])
    expect(otherRows(PLAYERS, 'pueyo', 'ready', true)[0].detail).toBe('2023-24')
  })

  it('opens the Data panel on that league where it is not downloaded or still loading', () => {
    const off = otherRows(PLAYERS, 'hsu', 'off', false)[0]
    expect(off).toMatchObject({ open: null, data: 'ncaaw', detail: 'not downloaded' })
    expect(off.title).toBe('Download NCAA Women in the Data panel for Abbey Hsu’s page')
    expect(otherRows(PLAYERS, 'hsu', 'off', true)[0]).toMatchObject({
      open: null,
      data: 'ncaaw',
      detail: 'loading'
    })
    expect(otherRows(PLAYERS, 'hsu', 'notBuilt', true)[0].detail).toBe('loading')
    // Ready, but only ESPN names them there: no page to open.
    expect(otherRows(PLAYERS, 'patberg', 'ready', true)[0]).toMatchObject({
      open: null,
      data: 'ncaaw'
    })
  })

  it('lists nothing before the read or the downloads are in', () => {
    expect(otherRows(null, 'hsu', 'ready', true)).toEqual([])
    expect(otherRows(PLAYERS, 'hsu', undefined, true)).toEqual([])
  })

  it('heads them with their league and why they are there', () => {
    expect(otherHeading(LEAGUES.ncaaw, LEAGUES.wnba)).toBe('NCAA Women · No WNBA games')
    expect(otherHeading(LEAGUES.ncaam, LEAGUES.nba)).toBe('NCAA Men · No NBA games')
  })
})
