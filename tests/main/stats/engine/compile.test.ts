import { describe, expect, it } from 'vitest'
import { compileQuery, StatsQueryError } from '@main/stats/engine/compile'
import type { StatsQuery } from '@shared/stats/types'

const CTX = { currentSeason: 2027 }
const base: StatsQuery = { entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } }
const compile = (q: Partial<StatsQuery>): ReturnType<typeof compileQuery> =>
  compileQuery({ ...base, ...q } as StatsQuery, CTX)
const scope = (s: Partial<StatsQuery['scope']>): Partial<StatsQuery> => ({
  scope: { seasons: [2026], ...s }
})
const refuses = (q: Partial<StatsQuery>, message: string | RegExp): void => {
  expect(() => compile(q)).toThrow(StatsQueryError)
  expect(() => compile(q)).toThrow(message)
}

describe('compileQuery', () => {
  it('refuses what the catalogue does not allow, with a readable message', () => {
    refuses({ metrics: ['nope'] }, 'unknown metric "nope"')
    refuses({ metrics: ['team_ortg'] }, '"team_ortg" is a team metric, not a player one')
    refuses({ metrics: [] }, 'metrics must list 1–40 catalogue ids')
    refuses({ metrics: ['pts', 'pts'] }, 'metrics must not repeat')
    refuses({ scope: { seasons: [1993] } }, 'scope.seasons must be whole numbers from 1994 to 2027')
    refuses(scope({ dates: ['2026-02-01', '2026-01-01'] }), 'scope.dates must be [from, to]')
    refuses(scope({ dates: ['February', '2026-01-01'] }), /is not valid/)
    refuses(scope({ positions: ['XX' as 'G'] }), /unknown position "XX"/)
    refuses(scope({ teams: ['1; DROP TABLE game'] }), /is not valid/)
    refuses(scope({ games: ["x'; DROP TABLE game"] }), /is not valid/)
    refuses(scope({ gameTypes: ['finals' as 'regular'] }), /unknown game type "finals"/)
    refuses(scope({ gameTypes: [] }), 'scope.gameTypes must be a non-empty list')
    refuses(scope({ months: [13] }), 'scope.months must be whole numbers from 1 to 12')
    refuses(scope({ restDays: [3, 1] }), 'scope.restDays must be [min, max]')
    refuses(scope({ lastN: 0 }), 'scope.lastN must be whole numbers from 1 to 200')
    refuses(scope({ lastNOf: 'week' as 'team' }), 'scope.lastNOf must be appearances or team')
    refuses(scope({ allStarBreak: 'during' as 'before' }), 'scope.allStarBreak must be')
    refuses(scope({ result: 'tie' as 'win' }), 'scope.result must be win or loss')
    refuses(scope({ home: 'yes' as never }), 'scope.home must be true or false')
    refuses({ groupBy: ['week' as 'season'] }, 'cannot group by "week"')
    refuses({ transform: 'perWeek' as 'raw' }, 'transform must be one of')
    refuses({ sort: { metric: 'reb', dir: 'desc' } }, 'sort.metric must be one of the metrics')
    refuses({ sort: null as never }, 'sort must be { metric, dir }')
    refuses({ limit: 5001 }, 'limit must be whole numbers from 1 to 5000')
    refuses({ scope: { seasons: [2026], weeks: [1, 2] } as never }, 'unknown scope field "weeks"')
    refuses({ metric: 'pts' } as never, 'unknown query field "metric"')
  })

  it('refuses a player filter on a team query', () => {
    const team = { entity: 'team' as const, metrics: ['team_ortg'] }
    refuses({ ...team, ...scope({ starter: true }) }, 'scope.starter is for players')
    refuses({ ...team, ...scope({ positions: ['G'] }) }, 'scope.positions is for players')
    refuses({ ...team, ...scope({ players: ['1'] }) }, 'scope.players is for players')
    refuses({ ...team, ...scope({ lastN: 5, lastNOf: 'team' }) }, 'scope.lastNOf is for players')
  })

  it('reads the season tables unless a filter splits a season', () => {
    expect(compile({}).grain).toBe('season')
    expect(compile({ groupBy: ['season'] }).grain).toBe('season')
    expect(compile(scope({ positions: ['G'] })).grain).toBe('season')
    // A team's games are in the season table too: a traded player has a row per team.
    expect(compile(scope({ teams: ['1610612738'] })).grain).toBe('season')
    for (const s of [
      { dates: ['2026-01-01', '2026-02-01'] },
      { lastN: 5 },
      { opponents: ['1610612738'] },
      { conferences: ['east'] },
      { divisions: ['pacific'] },
      { months: [1] },
      { home: true },
      { allStarBreak: 'after' },
      { restDays: [0, 0] },
      { starter: false },
      { result: 'win' }
    ] as Partial<StatsQuery['scope']>[]) {
      expect(compile(scope(s)).grain, JSON.stringify(s)).toBe('game')
    }
    expect(compile({ groupBy: ['team'] }).grain).toBe('game')
    expect(compile({}).sql).toContain('FROM player_season w')
    expect(compile({ groupBy: ['game'] }).sql).toContain('FROM player_game w')
  })

  it("reads exactly one kind of a player's season rows, so a trade is never counted twice", () => {
    expect(compile({}).sql).toContain('w.team_id IS NULL')
    const oneTeam = compile(scope({ teams: ['1610612738'] }))
    expect(oneTeam.sql).not.toContain('w.team_id IS NULL')
    expect(oneTeam.sql).toContain('w.team_id IN')
  })

  it('binds every value the query carries, and splices none into the SQL', () => {
    const c = compile(
      scope({
        seasons: [2025, 2026],
        teams: ['1610612738'],
        positions: ['G'],
        dates: ['2026-01-05', '2026-02-01'],
        conferences: ['east']
      })
    )
    for (const v of ['1610612738', '2026-01-05', "'east'", "'G'"]) expect(c.sql).not.toContain(v)
    expect(c.params).toEqual(
      expect.arrayContaining([1610612738, '2026-01-05', '2026-02-01', 'east', 'G', 2025, 2026])
    )
  })

  it('defaults to the regular season, and never counts All-Star or preseason unless asked', () => {
    expect(compile({}).params).toContain('regular')
    expect(compile({}).params).not.toContain('all-star')
    expect(compile({}).params).not.toContain('preseason')
    expect(compile(scope({ gameTypes: ['playoffs', 'play-in'] })).params).toEqual(
      expect.arrayContaining(['playoffs', 'play-in'])
    )
  })

  it('scales the qualification sample to the team games a row covers', () => {
    expect(compile({}).rowGames(82, 1)).toBe(82)
    expect(compile(scope({ seasons: [2025, 2026] })).rowGames(164, 2)).toBe(164)
    expect(compile({ groupBy: ['season'] }).rowGames(66, 1)).toBe(66)
    expect(compile({ groupBy: ['game'] }).rowGames(82, 1)).toBe(1)
    expect(compile(scope({ lastN: 10 })).rowGames(82, 1)).toBe(10)
    expect(compile(scope({ lastN: 10 })).rowGames(4, 1)).toBe(4)
    expect(compile({ groupBy: ['opponent'] }).rowGames(87, 1)).toBeCloseTo(3, 6)
    expect(compile({ groupBy: ['month'] }).rowGames(84, 1)).toBeCloseTo(14, 6)
    // A row per season qualifies against its own season's games, a short one too.
    expect(compile(scope({ seasons: [2012, 2026] })).bySeason).toBe(false)
    expect(compile({ ...scope({ seasons: [2012, 2026] }), groupBy: ['season'] }).bySeason).toBe(
      true
    )
    expect(compile({ groupBy: ['season', 'game'] }).bySeason).toBe(false)
  })

  it('notes the coverage and estimates the answer depends on', () => {
    const notes = (q: Partial<StatsQuery>): string[] => compile(q).notes
    expect(notes({ metrics: ['plus_minus'], ...scope({ seasons: [1996, 1997] }) })).toEqual([
      'Plus-minus: starts in 1996-97.'
    ])
    expect(
      notes({
        entity: 'team',
        metrics: ['team_paint_pts'],
        ...scope({ seasons: [2017, 2018] })
      })
    ).toEqual(['Points in the paint: not in the source for 2017-18.'])
    expect(notes(scope({ allStarBreak: 'before' }))).toEqual([
      'A season with no All-Star Game on the schedule has no games before or after one.'
    ])
    expect(notes(scope({ seasons: [2006], starter: false }))).toEqual([
      'Who started is unknown for some games from 2001-02 to 2005-06.'
    ])
    expect(notes(scope({ starter: false }))).toEqual([])
    expect(notes({ transform: 'per100' })).toEqual([
      "Per 100 uses the team's estimated possessions, times the player's share of its minutes."
    ])
  })
})
