import { describe, expect, it } from 'vitest'
import { perGameQualifier } from '@/lib/stats/boards'
import { LEAGUES } from '@shared/leagues'

/** What the screens say on either league, read from the registry (Plan T1301.9). */

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
