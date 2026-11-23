// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  boardRows,
  defaultBoard,
  leaderboardCsv,
  placesFor,
  tabOf,
  unlistedByName,
  unlistedNote
} from '@/lib/stats/leaderboard'
import { chartView, DEFAULT_CHART, type ChartState } from '@/lib/stats/chart'
import {
  favouriteGameTeams,
  favouriteRail,
  playerTeamQueries,
  type RailGame
} from '@/lib/stats/games'
import { favouritesEmpty } from '@/lib/stats/favourites'
import type {
  LeaderboardBoard,
  MetricValue,
  StatsResult,
  StatsResultColumn,
  StatsRow
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

/** The favourites filters (T1601.3): the board's ranks kept, the chart's field kept, the games rule. */
const BY_ID = new Map(catalogueFixture().map((m) => [m.id, m]))

const value = (v: number | null, qualified = true, sample = 100): MetricValue => ({
  value: v,
  raw: v,
  sample,
  qualified,
  percentile: null,
  rank: null
})

const row = (id: string, over: Partial<StatsRow> = {}): StatsRow => ({
  id,
  name: `Player ${id}`,
  team: 'BOS',
  position: 'G',
  group: {},
  games: 10,
  values: {},
  ...over
})

const column = (id: string, over: Partial<StatsResultColumn> = {}): StatsResultColumn => ({
  id,
  label: id,
  short: id,
  unit: 'count',
  decimals: 0,
  direction: 'higher',
  seasons: [2026],
  reason: null,
  ...over
})

const result = (rows: StatsRow[], total = rows.length, columns = [column('pts')]): StatsResult => ({
  grain: 'season',
  columns,
  rows,
  total,
  notes: [],
  ms: 1
})

const board = (over: Partial<LeaderboardBoard> = {}): LeaderboardBoard => ({
  ...defaultBoard('player', 'ALL', BY_ID),
  columns: ['pts'],
  sort: { by: 'pts', dir: 'desc' },
  ...over
})

// The engine's order: points, best first. Player c is below the minutes the tab asks.
const a = row('a', { values: { min: value(2000), pts: value(100) } })
const b = row('b', { values: { min: value(1500), pts: value(80) } })
const c = row('c', { values: { min: value(100, false), pts: value(70) } })
const d = row('d', { values: { min: value(1200), pts: value(60) } })
const rows = [a, b, c, d]
const shown = (x: { row: StatsRow; rank: number | null }[]): [string, number | null][] =>
  x.map((r) => [r.row.id, r.rank])

describe('the leaderboard filtered to favourites', () => {
  it('keeps each favourite at its rank on the whole board, gaps and all', () => {
    const fav = new Set(['b', 'd'])
    // Unfiltered and qualified only: a 1, b 2, d 3 (c does not stand).
    expect(shown(boardRows(result(rows), board(), '', null, fav))).toEqual([
      ['a', 1],
      ['b', 2],
      ['d', 3]
    ])
    expect(shown(boardRows(result(rows), board({ favourites: true }), '', null, fav))).toEqual([
      ['b', 2],
      ['d', 3]
    ])
  })

  it('follows "Qualified only" as any row does', () => {
    const fav = new Set(['c', 'd'])
    // On: c does not stand, so only d, ranked among the standing rows.
    expect(shown(boardRows(result(rows), board({ favourites: true }), '', null, fav))).toEqual([
      ['d', 3]
    ])
    // Off: every row is listed, and ranked among them all, as the board does.
    expect(
      shown(
        boardRows(result(rows), board({ favourites: true, qualifiedOnly: false }), '', null, fav)
      )
    ).toEqual([
      ['c', 3],
      ['d', 4]
    ])
  })

  it('keeps the ranks under a search too, filtered or not', () => {
    const fav = new Set(['b', 'd'])
    expect(shown(boardRows(result(rows), board(), 'player d', null, fav))).toEqual([['d', 3]])
    expect(
      shown(boardRows(result(rows), board({ favourites: true }), 'player b', null, fav))
    ).toEqual([['b', 2]])
  })

  it('places a favourite the board did not fetch by the engine’s answer', () => {
    const fav = new Set(['b', 'x', 'y'])
    const fetched = result(rows, 9000)
    const x = row('x', {
      values: { min: value(900), pts: value(5) },
      place: { all: 1501, standing: 1204 }
    })
    const y = row('y', {
      values: { min: value(10, false), pts: value(4) },
      place: { all: 1600, standing: null }
    })
    expect(shown(boardRows(fetched, board({ favourites: true }), '', null, fav, [x, y]))).toEqual([
      ['b', 2],
      ['x', 1204]
    ])
    expect(
      shown(
        boardRows(fetched, board({ favourites: true, qualifiedOnly: false }), '', null, fav, [x, y])
      )
    ).toEqual([
      ['b', 2],
      ['x', 1501],
      ['y', 1600]
    ])
    // A placed row that is not a favourite, or was fetched after all, is not added again.
    expect(
      shown(
        boardRows(fetched, board({ favourites: true }), '', null, new Set(['b']), [
          x,
          { ...b, place: { all: 2, standing: 2 } }
        ])
      )
    ).toEqual([['b', 2]])
  })

  it('asks the engine only for favourites past the fetched rows, standing as the board stands', () => {
    const fav = new Set(['b', 'x'])
    expect(placesFor(result(rows, 9000), board({ favourites: true }), fav)).toEqual({
      ids: ['x'],
      standing: tabOf('player', 'ALL').qualifier
    })
    // Nothing to ask: the filter off, every row fetched, every favourite fetched.
    expect(placesFor(result(rows, 9000), board(), fav)).toBeNull()
    expect(placesFor(result(rows), board({ favourites: true }), fav)).toBeNull()
    expect(placesFor(result(rows, 9000), board({ favourites: true }), new Set(['b']))).toBeNull()
    // Sorted by name, it is asked as the engine orders the board, to count who cannot be listed.
    const own = result(rows, 9000, [column('pts', { ownQualifier: true })])
    expect(
      placesFor(own, board({ favourites: true, sort: { by: 'name', dir: 'asc' } }), fav, 'pts')
    ).toEqual({ ids: ['x'], standing: 'pts' })
    // A metric with the NBA's own minimum stands by it; a games-out count lists every sample.
    expect(placesFor(own, board({ favourites: true }), fav)?.standing).toBe('pts')
    const adds = result(rows, 9000, [column('pts', { addsRows: true })])
    expect(placesFor(adds, board({ favourites: true }), fav)).toMatchObject({ orSample: true })
  })

  it('exports the ranks as shown', () => {
    const fav = new Set(['b', 'd'])
    const r = boardRows(result(rows), board({ favourites: true }), '', null, fav)
    const csv = leaderboardCsv(
      r.map((x) => x.row),
      board({ favourites: true }),
      BY_ID,
      r.map((x) => x.rank)
    )
    const lines = csv.trim().split('\r\n')
    expect(lines.slice(1).map((l) => l.split(',').slice(0, 2))).toEqual([
      ['2', 'Player b'],
      ['3', 'Player d']
    ])
  })
})

describe('the chart filtered to favourites', () => {
  const dots = Array.from({ length: 12 }, (_, i) =>
    row(String(i), {
      values: {
        min: value(1500),
        ts_pct: value(0.5 + i / 100),
        usg_pct: value(0.2 + i / 100)
      }
    })
  )
  const chartResult = result(dots, dots.length, [
    column('ts_pct'),
    column('usg_pct'),
    column('min')
  ])
  const state: ChartState = { ...DEFAULT_CHART, x: 'usg_pct', y: 'ts_pct' }

  it('shows only the favourites, the axes and the means the whole field’s', () => {
    const all = chartView(chartResult, state, BY_ID)
    const fav = chartView(
      chartResult,
      { ...state, favourites: true },
      BY_ID,
      [],
      new Set(['3', '9'])
    )
    if (all.kind !== 'ready' || fav.kind !== 'ready') throw new Error('not ready')
    expect(fav.dots.map((d) => d.id)).toEqual(['3', '9'])
    expect(fav.domain).toEqual(all.domain)
    expect(fav.mean).toEqual(all.mean)
    // A dot stays where it was, its percentiles among the whole field.
    const before = all.dots.find((d) => d.id === '3')!
    expect(fav.dots[0]).toMatchObject({ x: before.x, y: before.y, percentiles: before.percentiles })
    expect(fav.favourites).toEqual({ shown: 2, of: 12 })
    expect(all.favourites).toBeNull()
  })

  it('shows none, and says how many it could, with no favourite in the field', () => {
    const none = chartView(chartResult, { ...state, favourites: true }, BY_ID, [], new Set())
    if (none.kind !== 'ready') throw new Error('not ready')
    expect(none.dots).toEqual([])
    expect(none.favourites).toEqual({ shown: 0, of: 12 })
  })
})

describe('the games filtered to favourites', () => {
  const teams = [
    { id: '1', code: 'BOS', name: 'Boston', conference: 'east', division: 'atlantic' },
    { id: '2', code: 'LAL', name: 'Los Angeles', conference: 'west', division: 'pacific' },
    { id: '3', code: 'OKC', name: 'Oklahoma City', conference: 'west', division: 'northwest' }
  ]
  const game = (id: string, away: string | null, home: string | null): RailGame => ({
    id,
    away: 'A',
    home: 'H',
    awayId: away,
    homeId: home,
    awayScore: '',
    homeScore: '',
    awayWon: false,
    homeWon: false,
    played: false,
    tag: null,
    note: null
  })

  it('keeps a favourite team’s games and those of each favourite player’s latest team', () => {
    // A favourite team (LAL) and a player whose latest game in scope was for OKC.
    const kept = favouriteGameTeams(new Set(['2']), ['OKC', null, 'XYZ'], teams)
    expect([...kept].sort()).toEqual(['2', '3'])
    const day = [
      game('g1', '1', '2'),
      game('g2', '3', '9'),
      game('g3', '1', '9'),
      game('g4', null, null)
    ]
    expect(favouriteRail(day, kept).map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(favouriteRail(day, new Set())).toEqual([])
  })
})

describe('what a filtered screen says with nothing to show', () => {
  it('names the league and how to add one, or says none is in scope', () => {
    expect(favouritesEmpty('NBA', 'player', 0, 0)).toBe(
      'No favourites in the NBA. Star a player or a team to keep them here.'
    )
    // Favourite players in the league, but no team: the Teams board says which kind is missing.
    expect(favouritesEmpty('NCAA Men', 'team', 0, 2)).toBe(
      'No favourite teams in the NCAA Men. Star a team to keep it here.'
    )
    expect(favouritesEmpty('NBA', 'player', 0, 1)).toBe(
      'No favourite players in the NBA. Star a player to keep them here.'
    )
    expect(favouritesEmpty('NCAA Men', 'team', 2, 3)).toBe('No favourite team in this scope.')
    expect(favouritesEmpty('NBA', 'player', 2, 2, 'zzz')).toBe('No favourite matches.')
    expect(favouritesEmpty('NBA', 'game', 3, 3)).toBe('No game of a favourite on this day.')
  })
})

describe('the review’s three cases (T1601.3)', () => {
  it('ranks fetched and placed rows by one rule; a row kept below the qualifier moves none', () => {
    const fav = new Set(['b', 'd', 'x'])
    const fetched = result(rows, 9000)
    const x = row('x', {
      values: { min: value(900), pts: value(5) },
      place: { all: 1501, standing: 1204 }
    })
    // c is kept (opened from the home) though it does not stand: no rank, and d stays 3rd, as the
    // engine counts d among the standing rows.
    expect(shown(boardRows(fetched, board(), '', 'c', fav))).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', null],
      ['d', 3]
    ])
    expect(shown(boardRows(fetched, board({ favourites: true }), '', 'c', fav, [x]))).toEqual([
      ['b', 2],
      ['d', 3],
      ['x', 1204]
    ])
  })

  it('takes the team and the position from the engine’s answer: a placed row off the team is not answered', () => {
    // The places query is the board's own, so its scope.teams narrows the placed rows as it narrows the
    // fetched ones (the engine test "counts within the board's team and position"). The board adds
    // only what was answered: on the team, x is there; off it, the engine answers nothing for y.
    const fav = new Set(['b', 'x', 'y'])
    const onTeam = row('x', {
      team: 'OKC',
      values: { min: value(900), pts: value(5) },
      place: { all: 41, standing: 33 }
    })
    const okc = result([b], 300)
    expect(
      shown(
        boardRows(okc, board({ favourites: true, team: '1610612760' }), '', null, fav, [onTeam])
      )
    ).toEqual([
      ['b', 1],
      ['x', 33]
    ])
  })

  it('lists no placed favourite under a name sort, and counts them for the line it shows', () => {
    const fav = new Set(['b', 'x', 'y'])
    const fetched = result(rows, 9000)
    const byName = board({ favourites: true, sort: { by: 'name', dir: 'asc' } })
    const x = row('x', { place: { all: 1501, standing: 1204 } })
    const y = row('y', { place: { all: 1600, standing: null } })
    expect(shown(boardRows(fetched, byName, '', null, fav, [x, y]))).toEqual([['b', 2]])
    // y does not stand with "Qualified only" on, so would not be listed under any sort either.
    expect(unlistedByName(fetched, byName, fav, [x, y])).toBe(1)
    expect(unlistedByName(fetched, { ...byName, qualifiedOnly: false }, fav, [x, y])).toBe(2)
    expect(unlistedByName(fetched, board({ favourites: true }), fav, [x, y])).toBe(0)
    expect(unlistedNote(1)).toBe('1 favourite is past the first 1,000 rows and not listed by name.')
    expect(unlistedNote(2)).toBe(
      '2 favourites are past the first 1,000 rows and not listed by name.'
    )
    expect(unlistedNote(0)).toBeNull()
  })

  it('reads every favourite player’s team for Games, in batches of 64, up to 500', () => {
    const scope = { seasons: [2027] }
    const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => String(1000 + i))
    const batches = playerTeamQueries(ids(130), scope)
    expect(batches.map((q) => q.scope.players?.length)).toEqual([64, 64, 2])
    expect(batches.flatMap((q) => q.scope.players)).toEqual(ids(130))
    expect(
      batches.every((q) => q.limit === q.scope.players?.length && q.scope.seasons[0] === 2027)
    ).toBe(true)
    const capped = playerTeamQueries(ids(600), scope)
    expect(capped.flatMap((q) => q.scope.players)).toHaveLength(500)
    expect(Math.max(...capped.map((q) => q.scope.players?.length ?? 0))).toBe(64)
    expect(playerTeamQueries([], scope)).toEqual([])
  })
})
