import { describe, expect, it } from 'vitest'
import {
  absentNote,
  allDays,
  favouriteDays,
  gameLines,
  gameWords,
  listingWords,
  MIN_GAMES,
  orderRows,
  pageDay,
  pageLeagues,
  pageSubtitle,
  PLAIN,
  plainTint,
  playerState,
  recordAfter,
  sectionQueries,
  sectionSeason,
  seasonSoFar,
  shotTint,
  stepFavouriteDay,
  teamOn,
  throughNote,
  tintOf,
  topScorer,
  type GameLine
} from '@/lib/stats/favouritesPage'
import { currentLeague, seasonLabel, setLeague } from '@/lib/stats/league'
import type { Favourite } from '@shared/favourites'
import type { MetricValue, StatsGame, StatsResult, StatsRow } from '@shared/stats/types'

/** The Favourites page's logic (D50, Plan T1601.4). */
const BOS = '1'
const LAL = '2'
const MIA = '3'

const game = (
  id: string,
  date: string,
  home: string,
  away: string,
  over: Partial<StatsGame> = {}
): StatsGame => ({
  id,
  season: 2027,
  type: 'regular',
  date,
  home: { id: home, code: { 1: 'BOS', 2: 'LAL', 3: 'MIA' }[home] ?? home, name: home, score: 100 },
  away: { id: away, code: { 1: 'BOS', 2: 'LAL', 3: 'MIA' }[away] ?? away, name: away, score: 90 },
  played: true,
  hasBox: true,
  overtimes: 0,
  ...over
})

const GAMES = [
  game('g1', '2026-11-01', BOS, LAL),
  game('g2', '2026-11-03', MIA, BOS),
  game('g3', '2026-11-05', LAL, MIA),
  game('g4', '2026-11-07', BOS, MIA),
  game('asg', '2026-11-08', LAL, BOS, { type: 'all-star' }),
  game('g5', '2026-11-09', LAL, BOS, {
    played: false,
    home: { id: LAL, code: 'LAL', name: LAL, score: null },
    away: { id: BOS, code: 'BOS', name: BOS, score: null }
  })
]

const line = (
  gameId: string,
  team: string,
  values: Record<string, number | null>,
  over: Partial<GameLine> = {}
): GameLine => {
  const g = GAMES.find((x) => x.id === gameId)!
  return { game: gameId, date: g.date, type: g.type, team, values, out: null, ...over }
}

const fav = (id: string, kind: 'player' | 'team', starredAt: string): Favourite => ({
  league: 'nba',
  kind,
  id,
  name: `Fav ${id}`,
  starredAt,
  from: null
})

describe('the day', () => {
  // A player traded from Boston to Miami after Nov 3: Boston's days, then Miami's.
  const traded = [line('g1', BOS, { min: 30, pts: 20 }), line('g4', MIA, { min: 30, pts: 25 })]

  it('counts a favourite team’s days and a favourite player’s team’s days, played games only', () => {
    expect(favouriteDays(new Map(), [LAL], GAMES)).toEqual(['2026-11-01', '2026-11-05'])
    // Before the trade they were on Boston (Nov 1, Nov 3), after it on Miami (Nov 5, Nov 7). The
    // All-Star Game and the game not played yet are no days of the page.
    expect(favouriteDays(new Map([['p', traded]]), [], GAMES)).toEqual([
      '2026-11-01',
      '2026-11-03',
      '2026-11-07'
    ])
  })

  it('opens on the latest day with a favourite’s game in any section, unless one is chosen', () => {
    expect(pageDay(null, [['2026-11-01', '2026-11-05'], ['2026-11-03']])).toBe('2026-11-05')
    expect(pageDay('2026-11-01', [['2026-11-05']])).toBe('2026-11-01')
    expect(pageDay(null, [])).toBeNull()
    expect(
      allDays([
        ['2026-11-05', '2026-11-01'],
        ['2026-11-01', '2026-11-03']
      ])
    ).toEqual(['2026-11-01', '2026-11-03', '2026-11-05'])
  })

  it('steps to the day before or after with a favourite’s game, skipping empty days', () => {
    const days = ['2026-11-01', '2026-11-05', '2026-11-09']
    expect(stepFavouriteDay(days, '2026-11-05', -1)).toBe('2026-11-01')
    expect(stepFavouriteDay(days, '2026-11-05', 1)).toBe('2026-11-09')
    // From a day with none, to the nearest with one.
    expect(stepFavouriteDay(days, '2026-11-03', 1)).toBe('2026-11-05')
    expect(stepFavouriteDay(days, '2026-11-01', -1)).toBeNull()
    expect(stepFavouriteDay(days, '2026-11-09', 1)).toBeNull()
  })

  it('puts a player on their latest game’s team, or their first game’s before it', () => {
    expect(teamOn(traded, '2026-10-30')).toBe(BOS)
    expect(teamOn(traded, '2026-11-03')).toBe(BOS)
    expect(teamOn(traded, '2026-11-07')).toBe(MIA)
    expect(teamOn([], '2026-11-07')).toBeNull()
  })
})

describe('a player’s row', () => {
  const lines = [
    line('g1', BOS, { min: 30, pts: 20 }),
    line('g2', BOS, { min: null, pts: null, games_out_injury: 1 }, { out: 'injury' })
  ]

  it('has each state: played, did not play with its reason, no game, not played yet, absent', () => {
    expect(playerState(lines, '2026-11-01', GAMES)).toMatchObject({
      kind: 'played',
      game: { id: 'g1' }
    })
    expect(playerState(lines, '2026-11-03', GAMES)).toMatchObject({
      kind: 'dnp',
      game: { id: 'g2' },
      reason: 'Listed Out: injury or illness'
    })
    // Boston has no game on Nov 5.
    expect(playerState(lines, '2026-11-05', GAMES)).toEqual({ kind: 'nogame', team: BOS })
    // Boston's Nov 9 game is on the schedule, not played in the data loaded.
    expect(playerState(lines, '2026-11-09', GAMES)).toMatchObject({
      kind: 'pending',
      game: { id: 'g5' }
    })
    // A team that played and a player with no line nor a listing: did not play, no reason.
    expect(playerState([line('g1', BOS, { min: 30, pts: 20 })], '2026-11-07', GAMES)).toMatchObject(
      {
        kind: 'dnp',
        reason: null
      }
    )
    // No game in the season at all: counted at the foot, not listed.
    expect(playerState([], '2026-11-01', GAMES)).toEqual({ kind: 'absent' })
  })

  it('sets a line against the same season type up to that day, the line included', () => {
    const po = { ...line('g4', BOS, { pts: 40 }), type: 'playoffs' as const }
    const all = [
      line('g1', BOS, { pts: 10 }),
      line('g2', BOS, { pts: 20 }),
      po,
      line('g4', BOS, { pts: 30 })
    ]
    expect(seasonSoFar(all, all[1]).map((l) => l.values.pts)).toEqual([10, 20])
    expect(seasonSoFar(all, all[3]).map((l) => l.values.pts)).toEqual([10, 20, 30])
  })

  it('sets a team’s line against its own played games, its columns being the team’s', () => {
    const team = [
      line('g1', BOS, { team_pts: 100 }),
      line('g2', BOS, { team_pts: 90 }),
      line('g4', BOS, { team_pts: 110 })
    ]
    expect(seasonSoFar(team, team[2]).map((l) => l.values.team_pts)).toEqual([100, 90, 110])
  })

  it('words a listing’s reason, the report’s own', () => {
    expect(listingWords({ status: 'Out', reason: 'Injury/Illness - Low Back Tightness' })).toBe(
      'Listed Out: Injury/Illness - Low Back Tightness'
    )
    expect(listingWords({ status: 'Out', reason: null })).toBe('Listed Out')
    expect(listingWords(null)).toBeNull()
  })

  it('counts the favourites with no game in the season at the section’s foot', () => {
    expect(absentNote(0, 'nba', 2027)).toBeNull()
    expect(absentNote(1, 'nba', 2027)).toBe('1 favourite has no game in 2026-27')
    expect(absentNote(3, 'nba', 2027)).toBe('3 favourites have no game in 2026-27')
  })

  it('words a section’s season in its own league, not the league on screen', () => {
    const was = currentLeague().id
    try {
      // The NBA on screen: its label would write the WNBA's 2026 as "2025-26", which the page showed.
      setLeague('nba')
      expect(seasonLabel(2026)).toBe('2025-26')
      expect(sectionSeason('wnba', 2026)).toBe('2026')
      expect(sectionSeason('nba', 2026)).toBe('2025-26')
      expect(absentNote(2, 'wnba', 2026)).toBe('2 favourites have no game in 2026')
      // And the other way round, the WNBA on screen.
      setLeague('wnba')
      expect(sectionSeason('nba', 2027)).toBe('2026-27')
      expect(sectionSeason('ncaaw', 2026)).toBe('2025-26')
      expect(absentNote(1, 'nba', 2027)).toBe('1 favourite has no game in 2026-27')
    } finally {
      setLeague(was)
    }
  })
})

describe('the tint against their own games', () => {
  it('places the game among their games of the season, a tie counting half', () => {
    // 31 in 16 games where 3 were higher and 12 lower: it beats 12 of the other 15.
    const values = [40, 35, 33, 31, ...Array.from({ length: 12 }, (_, i) => 10 + i)]
    const t = tintOf(31, values, 'higher')
    expect(t.percentile).toBeCloseTo((100 * 12) / 15, 6)
    expect(t.place).toBe('4th highest of 16 games')
    expect(t.heat).toBe('h2')
    expect(t.average).toBeCloseTo(values.reduce((a, b) => a + b, 0) / 16, 6)
    // The best game is 100, the worst 0; a tie counts half.
    expect(tintOf(40, values, 'higher').percentile).toBe(100)
    expect(tintOf(10, values, 'higher').percentile).toBe(0)
    expect(tintOf(5, [5, 5, 5, 5, 5], 'higher').percentile).toBe(50)
  })

  it('reads lower as better for turnovers', () => {
    const t = tintOf(1, [1, 3, 4, 5, 6], 'lower')
    expect(t.percentile).toBe(100)
    expect(t.place).toBe('1st lowest of 5 games')
    expect(t.heat).toBe('h3')
  })

  it('is not tinted with fewer than 5 games, or with no value', () => {
    expect(MIN_GAMES).toBe(5)
    expect(tintOf(30, [30, 20, 10, 25], 'higher')).toMatchObject({ heat: 'n', percentile: null })
    expect(tintOf(null, [30, 20, 10, 25, 5], 'higher')).toMatchObject({
      heat: 'n',
      percentile: null
    })
  })

  it('tints a shooting cell by its percentage only with the attempts the minimum asks', () => {
    const games = [
      { made: 5, attempts: 10 },
      { made: 4, attempts: 10 },
      { made: 6, attempts: 10 },
      { made: 3, attempts: 10 },
      { made: 2, attempts: 2 },
      { made: 7, attempts: 10 }
    ]
    // 7 of 10 is the best of the five games of 5+ attempts; the 2 of 2 is left out.
    expect(shotTint(7, 10, games, 5)).toMatchObject({
      percentile: 100,
      place: '1st highest of 5 games'
    })
    expect(shotTint(2, 2, games, 5)).toMatchObject({ heat: 'n', percentile: null })
  })
})

describe('the rows’ words and order', () => {
  it('writes the game from the team’s side, and the record after it', () => {
    expect(gameWords(GAMES[0], BOS)).toBe('W 100–90 vs LAL')
    expect(gameWords(GAMES[0], LAL)).toBe('L 90–100 @ BOS')
    expect(gameWords(GAMES[5], BOS)).toBe('@ LAL')
    // Boston: won Nov 1 at home, lost Nov 3 at Miami (90–100), won Nov 7.
    expect(recordAfter(BOS, GAMES[1], GAMES)).toBe('1-1')
    expect(recordAfter(BOS, GAMES[3], GAMES)).toBe('2-1')
  })

  it('lists players then teams, played then did not play then no game, each in starred order', () => {
    const rows = [
      { favourite: fav('t1', 'team', '1'), state: { kind: 'played' }, row: 1 },
      { favourite: fav('p3', 'player', '5'), state: { kind: 'nogame' }, row: 2 },
      { favourite: fav('p2', 'player', '4'), state: { kind: 'played' }, row: 3 },
      { favourite: fav('p1', 'player', '3'), state: { kind: 'dnp' }, row: 4 },
      { favourite: fav('p4', 'player', '2'), state: { kind: 'played' }, row: 5 },
      { favourite: fav('p5', 'player', '6'), state: { kind: 'pending' }, row: 6 }
    ]
    expect(orderRows(rows).map((r) => r.favourite.id)).toEqual(['p4', 'p2', 'p1', 'p5', 'p3', 't1'])
  })

  it('says the day shown and, apart, through when the data runs', () => {
    const words = (d: string): string => d
    expect(pageSubtitle('2026-11-08', '2026-11-21', true, words)).toBe(
      'Games of 2026-11-08 · data through 2026-11-21, not live'
    )
    expect(pageSubtitle(null, '2026-11-21', false, words)).toBe(
      'Finding the latest day… · data through 2026-11-21, not live'
    )
    expect(pageSubtitle(null, null, true, words)).toBe('No day with a favourite’s game · not live')
  })

  it('shows minutes and +/− plain, with the season average for the title', () => {
    expect([...PLAIN].sort()).toEqual(['min', 'plus_minus'])
    expect(plainTint([30, 34, null, 38])).toEqual({
      heat: 'n',
      percentile: null,
      place: null,
      average: 34
    })
  })

  it('says a section’s data stops before the page’s day', () => {
    const words = (d: string): string => d
    expect(throughNote('WNBA', '2026-10-10', '2026-11-21', words)).toBe(
      'WNBA data through 2026-10-10'
    )
    expect(throughNote('NBA', '2026-11-21', '2026-11-21', words)).toBeNull()
  })

  it('orders the sections with the league on screen first, and marks one not downloaded', () => {
    const favs = { nba: [1], ncaam: [1], wnba: [] as number[], ncaaw: [1] }
    expect(
      pageLeagues('ncaam', ['nba', 'wnba', 'ncaam', 'ncaaw'] as const, favs, (l) => l !== 'ncaaw')
    ).toEqual([
      { league: 'ncaam', downloaded: true },
      { league: 'nba', downloaded: true },
      { league: 'ncaaw', downloaded: false }
    ])
  })
})

describe('the reads', () => {
  const value = (v: number | null): MetricValue => ({
    value: v,
    raw: v,
    sample: null,
    qualified: false,
    percentile: null,
    rank: null
  })
  const row = (
    id: string,
    gameId: string,
    team: string,
    vals: Record<string, number | null>,
    over: Partial<StatsRow> = {}
  ): StatsRow => ({
    id,
    name: `Player ${id}`,
    team,
    position: 'G',
    group: { game: gameId },
    games: 1,
    values: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, value(v)])),
    ...over
  })
  const result = (rows: StatsRow[]): StatsResult => ({
    grain: 'game',
    columns: [],
    rows,
    total: rows.length,
    notes: [],
    ms: 1
  })
  const byGame = new Map(GAMES.map((g) => [g.id, g]))

  it('places each row by game, on the team its code names, and drops the games that do not count', () => {
    const logs = gameLines(
      result([
        row('7', 'g4', 'MIA', { pts: 25 }),
        row('7', 'g1', 'BOS', { pts: 20 }),
        row('7', 'asg', 'LAL', { pts: 50 }),
        row('7', 'g2', 'BOS', { pts: null, games_out_other: 1 }, { noLine: true })
      ]),
      byGame,
      'player'
    )
    expect(logs.get('7')!.map((l) => [l.game, l.team, l.out])).toEqual([
      ['g1', BOS, null],
      ['g2', BOS, 'other'],
      ['g4', MIA, null]
    ])
  })

  it('asks for every favourite, 64 to a query, by game, every counted type', () => {
    const ids = Array.from({ length: 70 }, (_, i) => String(i))
    const q = sectionQueries(2027, ['regular', 'playoffs'], ids, ['1'], true)
    expect(q.players.map((x) => x.scope.players?.length)).toEqual([64, 6])
    expect(q.players[0]).toMatchObject({
      groupBy: ['game'],
      scope: { seasons: [2027], gameTypes: ['regular', 'playoffs'] }
    })
    expect(q.players[0].metrics).toContain('games_out_injury')
    expect(sectionQueries(2027, ['regular'], ids, [], false).players[0].metrics).not.toContain(
      'games_out_injury'
    )
    expect(q.teams).toHaveLength(1)
    expect(q.teams[0].metrics).toContain('team_point_diff')
  })

  it('names the top scorer of a team in a game, first by name on a tie', () => {
    const r = result([
      row('a', 'g1', 'BOS', { pts: 30 }),
      row('b', 'g1', 'BOS', { pts: 31 }),
      row('c', 'g1', 'LAL', { pts: 40 }),
      row('d', 'g1', 'BOS', { pts: 31 }, { name: 'Abe' })
    ])
    expect(topScorer(r, GAMES[0], BOS)).toEqual({ name: 'Abe', pts: 31 })
    expect(topScorer(r, GAMES[0], LAL)).toEqual({ name: 'Player c', pts: 40 })
    expect(topScorer(null, GAMES[0], BOS)).toBeNull()
  })
})
