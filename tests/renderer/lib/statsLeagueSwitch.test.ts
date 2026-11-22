import { afterEach, describe, expect, it } from 'vitest'
import {
  offeredSwitch,
  offerSwitch,
  playerSwitch,
  switchLine,
  switchTarget,
  withdrawSwitch
} from '@/lib/stats/leagueSwitch'
import type { StatsOtherCareer, StatsOtherSeason } from '@shared/stats/types'

const season = (s: Partial<StatsOtherSeason> & { season: number }): StatsOtherSeason => ({
  gameType: null,
  teams: [],
  teamsInOrder: true,
  games: null,
  starts: null,
  minutes: null,
  pts: null,
  reb: null,
  oreb: null,
  ast: null,
  stl: null,
  blk: null,
  tov: null,
  pf: null,
  fgm: null,
  fga: null,
  fg3m: null,
  fg3a: null,
  ftm: null,
  fta: null,
  ...s
})

/** Cooper Flagg read from his NBA page: his Duke season in Metis's own lines. */
const FLAGG: StatsOtherCareer = {
  league: 'ncaam',
  link: { method: 'id', playerId: '5041939', espnId: 5041939, name: 'Cooper Flagg' },
  draft: null,
  source: { kind: 'metis', label: "Metis's own season lines" },
  seasons: [
    season({ season: 2025, gameType: 'regular', games: 32, pts: 604 }),
    season({ season: 2025, gameType: 'nit', games: 5, pts: 90 })
  ],
  reason: null
}

/** A draftee read from the college page: a link, no NBA game. */
const DRAFTEE: StatsOtherCareer = {
  ...FLAGG,
  league: 'nba',
  link: { method: 'name+college', playerId: '1643519', espnId: null, name: 'Jayden Quaintance' },
  seasons: []
}

afterEach(() => {
  const was = offeredSwitch()
  if (was) withdrawSwitch(was)
})

describe('the league menu’s move to the same player (T1304.4)', () => {
  it('opens the player’s page in the paired league on the Overview, in their last season there', () => {
    expect(playerSwitch('nba', '1642843', FLAGG, 'ready')).toEqual({
      from: 'nba',
      player: '1642843',
      to: 'ncaam',
      name: 'Cooper Flagg',
      location: {
        league: 'ncaam',
        screen: 'player',
        team: null,
        player: { id: '5041939', position: null },
        season: 2025,
        playerTab: 'overview'
      }
    })
  })

  it('offers nothing where the menu should switch as before', () => {
    // The paired league off, loading, or the downloads not read yet.
    expect(playerSwitch('nba', '1642843', FLAGG, 'off')).toBeNull()
    expect(playerSwitch('nba', '1642843', FLAGG, 'notBuilt')).toBeNull()
    expect(playerSwitch('nba', '1642843', FLAGG, undefined)).toBeNull()
    // The read not in yet, or no link (LeBron James).
    expect(playerSwitch('nba', '2544', null, 'ready')).toBeNull()
    expect(
      playerSwitch(
        'nba',
        '2544',
        {
          league: 'ncaam',
          link: null,
          draft: null,
          source: null,
          seasons: [],
          reason: { kind: 'no-link', text: 'No linked NCAA Men career.' }
        },
        'ready'
      )
    ).toBeNull()
    // A draftee with no game in the other league has no page there.
    expect(playerSwitch('ncaam', '5105', DRAFTEE, 'ready')).toBeNull()
    // Only ESPN names them there: no id to open.
    expect(
      playerSwitch('nba', '1', { ...FLAGG, link: { ...FLAGG.link!, playerId: null } }, 'ready')
    ).toBeNull()
  })

  it('takes the move only for the paired league, from the page that offered it', () => {
    const move = playerSwitch('nba', '1642843', FLAGG, 'ready')
    expect(switchTarget(move, 'nba', 'ncaam')).toEqual(move?.location)
    // NBA to WNBA from Flagg's page: as before.
    expect(switchTarget(move, 'nba', 'wnba')).toBeNull()
    // A move offered on another league's page is never taken from this one.
    expect(switchTarget(move, 'wnba', 'ncaam')).toBeNull()
    expect(switchTarget(null, 'nba', 'ncaam')).toBeNull()
    expect(switchLine(move, 'nba', 'ncaam')).toBe('Cooper Flagg’s page')
    expect(switchLine(move, 'nba', 'ncaaw')).toBeNull()
  })

  it('keeps one move, withdrawn only by the page that offered it', () => {
    const flagg = playerSwitch('nba', '1642843', FLAGG, 'ready')!
    const other = { ...flagg, player: '1' }
    offerSwitch(flagg)
    offerSwitch(other)
    // The page left after the next one offered its move: the newer stays.
    withdrawSwitch(flagg)
    expect(offeredSwitch()).toBe(other)
    withdrawSwitch(other)
    expect(offeredSwitch()).toBeNull()
  })
})
