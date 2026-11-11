import type {
  GameSide,
  MetricInfo,
  StatsGame,
  StatsGameDetail,
  StatsQuery,
  StatsResult,
  StatsRow
} from '@shared/stats/types'
import { fmtClock, fmtStat } from './format'
import { typeTag } from './player'
import { fullDay, shortDay } from './scope'
import { teamGames } from './team'

/** Games: a day's games on a date rail, in place of the template's weeks, and a game's box score. */

/** The screen's own choices, kept for the session. */
export interface GamesState {
  /** Null: the day of the game named, else the latest day played. */
  date: string | null
  /** Null: the day's first game. */
  game: string | null
  /** The season's officials in place of the game: their rates beside the league's. */
  officials?: boolean
  /** One official's seasons in place of the game; it wins over `officials`. */
  official?: string | null
}

export const DEFAULT_GAMES: GamesState = { date: null, game: null }

const COUNTS: readonly StatsGame['type'][] = ['regular', 'play-in', 'playoffs', 'cup-final']

/** Every day with a game, in order. */
export const gameDays = (games: readonly StatsGame[]): string[] => [
  ...new Set(games.map((g) => g.date))
]

/** The latest day a game that counts was played; else any game; else the schedule's first day. */
export function defaultDay(games: readonly StatsGame[]): string | null {
  const played = games.filter((g) => g.played)
  const counted = played.filter((g) => COUNTS.includes(g.type))
  return (counted.at(-1) ?? played.at(-1) ?? games[0])?.date ?? null
}

/** The day before or after, among days with a game; null at either end. */
export function stepDay(days: readonly string[], date: string | null, step: -1 | 1): string | null {
  const i = date === null ? -1 : days.indexOf(date)
  return i < 0 ? null : (days[i + step] ?? null)
}

const overtime = (n: number | null): string =>
  n === null || n === 0 ? '' : n === 1 ? '/OT' : `/${n}OT`

/** "Final", "Final/2OT", "Not played" for a day gone with no score, "Scheduled" for one to come. */
export function gameStatus(g: StatsGame, through: string | null): string {
  if (g.played) return `Final${overtime(g.overtimes)}`
  return through !== null && g.date <= through ? 'Not played' : 'Scheduled'
}

export interface RailGame {
  id: string
  away: string
  home: string
  awayScore: string
  homeScore: string
  awayWon: boolean
  homeWon: boolean
  played: boolean
  /** Not the regular season: "Playoffs". */
  tag: string | null
  /** "OT"; "Not played". */
  note: string | null
}

/** A day's games, in the order the schedule lists them. */
export function railGames(
  games: readonly StatsGame[],
  date: string | null,
  through: string | null
): RailGame[] {
  return games
    .filter((g) => g.date === date)
    .map((g) => {
      const status = gameStatus(g, through)
      const home = g.home.score ?? 0
      const away = g.away.score ?? 0
      return {
        id: g.id,
        away: g.away.code,
        home: g.home.code,
        awayScore: g.played ? String(away) : '',
        homeScore: g.played ? String(home) : '',
        awayWon: g.played && away > home,
        homeWon: g.played && home > away,
        played: g.played,
        tag: typeTag(g.type),
        note: g.played ? status.replace('Final/', '').replace('Final', '') || null : status
      }
    })
}

export interface HeaderSide {
  id: string | null
  code: string
  name: string
  score: string
  /** The loser's score reads quieter. */
  lost: boolean
  /** Before this game, in the same kind of game: "34-12". */
  record: string | null
  /** Up to five results before this game, oldest first. */
  form: { result: 'W' | 'L'; title: string }[]
}

export interface GameHeader {
  away: HeaderSide
  home: HeaderSide
  status: string
  /** "Jan 5, 2026 · Playoffs · NBA Finals - Game 5". */
  line: string
  /** "TD Garden, Boston · 18,984". */
  place: string | null
}

const FORM = 5

function headerSide(
  side: GameSide,
  other: GameSide,
  game: StatsGame,
  games: readonly StatsGame[]
): HeaderSide {
  const before =
    side.id === null
      ? []
      : teamGames(games, side.id).filter(
          (g) => g.type === game.type && g.date < game.date && g.result !== null
        )
  const wins = before.filter((g) => g.result === 'W').length
  return {
    id: side.id,
    code: side.code,
    name: side.name,
    score: game.played ? String(side.score ?? 0) : '',
    lost: game.played && (side.score ?? 0) < (other.score ?? 0),
    record: before.length ? `${wins}-${before.length - wins}` : null,
    form: before.slice(-FORM).map((g) => ({
      result: g.result as 'W' | 'L',
      title: `${shortDay(g.date)}: ${g.result} ${g.pointsFor}–${g.pointsAgainst} ${g.home ? 'vs' : 'at'} ${g.opponent.code}`
    }))
  }
}

export function gameHeader(
  game: StatsGame,
  games: readonly StatsGame[],
  detail: StatsGameDetail | null,
  through: string | null
): GameHeader {
  const venue = [detail?.venue, detail?.city].filter(Boolean).join(', ')
  const crowd = detail?.attendance ? detail.attendance.toLocaleString('en-US') : ''
  const place = [venue, crowd].filter(Boolean).join(' · ')
  return {
    away: headerSide(game.away, game.home, game, games),
    home: headerSide(game.home, game.away, game, games),
    status: gameStatus(game, through),
    line: [fullDay(game.date), typeTag(game.type), detail?.note].filter(Boolean).join(' · '),
    place: place || null
  }
}

export interface PeriodTable {
  head: string[]
  away: string[]
  home: string[]
}

const periodName = (i: number): string => (i < 4 ? String(i + 1) : i === 4 ? 'OT' : `${i - 3}OT`)

/** The score by period, with the final at the end. Null when the source has none. */
export function periodTable(game: StatsGame, detail: StatsGameDetail | null): PeriodTable | null {
  const p = detail?.periods
  if (!p) return null
  const cells = (xs: number[], score: number | null): string[] => [
    ...xs.map(String),
    String(score ?? '')
  ]
  return {
    head: [...p.home.map((_, i) => periodName(i)), 'T'],
    away: cells(p.away, game.away.score),
    home: cells(p.home, game.home.score)
  }
}

/** Why a game has no box score. */
export function noBoxNote(game: StatsGame, through: string | null): string {
  if (!game.played) {
    return through !== null && game.date <= through
      ? 'This game was not played.'
      : 'This game has not been played yet.'
  }
  if (game.type === 'preseason') return 'Preseason games have no box score in either source.'
  if (game.type === 'all-star') return 'Neither source has a box score for this All-Star game.'
  return 'Neither source has a box score for this game, only the final score.'
}

/** A player's line, as a box score lists it. */
export const BOX_METRICS = [
  'gs',
  'min',
  'pts',
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'plus_minus'
]

export const BOX_HEAD = [
  'MIN',
  'FG',
  '3P',
  'FT',
  'OREB',
  'DREB',
  'REB',
  'AST',
  'STL',
  'BLK',
  'TOV',
  'PF',
  '+/-',
  'PTS'
]

/** A team's totals: the same columns, then the rates and kinds of points the comparison reads. */
const TEAM_TOTALS = [
  'team_fgm',
  'team_fga',
  'team_fg3m',
  'team_fg3a',
  'team_ftm',
  'team_fta',
  'team_oreb',
  'team_dreb',
  'team_reb',
  'team_ast',
  'team_stl',
  'team_blk',
  'team_tov',
  'team_pf',
  'team_pts'
]

export const COMPARE_METRICS = [
  'team_fg_pct',
  'team_fg3_pct',
  'team_ft_pct',
  'team_reb',
  'team_ast',
  'team_tov',
  'team_stl',
  'team_blk',
  'team_paint_pts',
  'team_fast_break_pts',
  'team_turnover_pts',
  'team_bench_pts'
]

/** One game by its id: a date and teams would not do, since All-Star round robins play twice a day. */
export function boxQueries(game: StatsGame): Map<string, StatsQuery> {
  const scope = { seasons: [game.season], gameTypes: [game.type], games: [game.id] }
  return new Map<string, StatsQuery>([
    [
      'players',
      {
        entity: 'player',
        metrics: BOX_METRICS,
        scope,
        groupBy: ['team'],
        transform: 'raw',
        sort: { metric: 'min', dir: 'desc' },
        limit: 60
      }
    ],
    [
      'teams',
      {
        entity: 'team',
        metrics: [...new Set([...TEAM_TOTALS, ...COMPARE_METRICS])],
        scope,
        transform: 'raw',
        limit: 2
      }
    ]
  ])
}

export interface BoxRow {
  id: string
  name: string
  position: string | null
  cells: string[]
}

export interface BoxSide {
  id: string | null
  code: string
  name: string
  starters: BoxRow[]
  bench: BoxRow[]
  /** Nobody is flagged: who started is not listed for this game, so everyone is in one list. */
  startersKnown: boolean
  totals: string[]
  /** What the players' lines add to, against the final score. Null when they agree. */
  shortfall: string | null
}

const num = (r: StatsRow | undefined, id: string): number | null => r?.values[id]?.value ?? null

const pair = (r: StatsRow | undefined, made: string, tried: string): string =>
  r ? `${num(r, made) ?? '—'}-${num(r, tried) ?? '—'}` : '—'

function boxCells(r: StatsRow, byId: ReadonlyMap<string, MetricInfo>): string[] {
  const whole = (id: string): string =>
    fmtStat(num(r, id), byId.get(id) ?? { unit: 'count', decimals: 0 })
  return [
    fmtClock(num(r, 'min')),
    pair(r, 'fgm', 'fga'),
    pair(r, 'fg3m', 'fg3a'),
    pair(r, 'ftm', 'fta'),
    whole('oreb'),
    whole('dreb'),
    whole('reb'),
    whole('ast'),
    whole('stl'),
    whole('blk'),
    whole('tov'),
    whole('pf'),
    whole('plus_minus'),
    whole('pts')
  ]
}

const sum = (rows: readonly StatsRow[], id: string): number =>
  rows.reduce((a, r) => a + (num(r, id) ?? 0), 0)

function boxSide(
  side: GameSide,
  players: readonly StatsRow[],
  team: StatsRow | undefined,
  byId: ReadonlyMap<string, MetricInfo>
): BoxSide {
  const own = players.filter((r) => String(r.group.team) === side.id)
  const row = (r: StatsRow): BoxRow => ({
    id: r.id,
    name: r.name,
    position: r.position,
    cells: boxCells(r, byId)
  })
  const flagged = own.filter((r) => (num(r, 'gs') ?? 0) > 0)
  const known = flagged.length > 0
  const whole = (id: string): string =>
    fmtStat(num(team, id), byId.get(id) ?? { unit: 'count', decimals: 0 })
  const added = sum(own, 'pts')
  const score = num(team, 'team_pts')
  const minutes = sum(own, 'min')
  return {
    id: side.id,
    code: side.code,
    name: side.name,
    starters: known ? flagged.map(row) : own.map(row),
    bench: known ? own.filter((r) => (num(r, 'gs') ?? 0) === 0).map(row) : [],
    startersKnown: known,
    totals: [
      fmtClock(minutes),
      pair(team, 'team_fgm', 'team_fga'),
      pair(team, 'team_fg3m', 'team_fg3a'),
      pair(team, 'team_ftm', 'team_fta'),
      whole('team_oreb'),
      whole('team_dreb'),
      whole('team_reb'),
      whole('team_ast'),
      whole('team_stl'),
      whole('team_blk'),
      whole('team_tov'),
      whole('team_pf'),
      '',
      whole('team_pts')
    ],
    shortfall:
      score !== null && added !== score
        ? `The players’ lines add to ${added}; the final score is ${score}.`
        : null
  }
}

export function boxSides(
  game: StatsGame,
  players: StatsResult,
  teams: StatsResult,
  byId: ReadonlyMap<string, MetricInfo>
): [BoxSide, BoxSide] {
  const team = (side: GameSide): StatsRow | undefined => teams.rows.find((r) => r.id === side.id)
  return [
    boxSide(game.away, players.rows, team(game.away), byId),
    boxSide(game.home, players.rows, team(game.home), byId)
  ]
}

export interface CompareRow {
  metric: string
  label: string
  away: string
  home: string
  /** The better side, for emphasis; null level or with no better side. */
  edge: 'away' | 'home' | null
  /** Why a stat has no value: "Recorded from 2008-09." */
  missing: string | null
}

/** The two teams side by side. */
export function compareRows(
  game: StatsGame,
  teams: StatsResult,
  byId: ReadonlyMap<string, MetricInfo>
): CompareRow[] {
  const away = teams.rows.find((r) => r.id === game.away.id)
  const home = teams.rows.find((r) => r.id === game.home.id)
  return COMPARE_METRICS.map((metric) => {
    const info = byId.get(metric)
    const a = num(away, metric)
    const h = num(home, metric)
    const lower = info?.direction === 'lower'
    const edge =
      a === null || h === null || a === h || info?.direction === 'neutral'
        ? null
        : a > h !== lower
          ? 'away'
          : 'home'
    const f = info ?? { unit: 'number' as const, decimals: 1 }
    return {
      metric,
      label: info?.label ?? metric,
      away: fmtStat(a, f),
      home: fmtStat(h, f),
      edge,
      missing: teams.columns.find((c) => c.id === metric)?.reason ?? null
    }
  })
}
