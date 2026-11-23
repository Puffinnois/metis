import { heatOf, type Heat } from '@/lib/stats/format'
import type { Favourite } from '@shared/favourites'
import type { GameType, StatsGame, StatsQuery, StatsResult } from '@shared/stats/types'

/**
 * The Favourites page (D50, Plan T1601.4): one day for the whole page, a section a league, a row a
 * favourite with that day's line tinted against their own games of the season. The pure logic is here;
 * `useFavouritesSection` reads a league's data, and `StatsFavourites` draws it.
 * `docs/reference/stats-screens.md`, "Favourites", states the rules.
 */

/** Game types that count on the page: never the All-Star Game or the preseason (D12). */
export const NOT_COUNTED: readonly GameType[] = ['all-star', 'preseason']
export const counts = (g: StatsGame): boolean => !NOT_COUNTED.includes(g.type)

/** The player stats a row shows, in order; the shooting ones are made–attempted pairs. */
export const PLAYER_COUNTS = ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov'] as const
export const PLAYER_PAIRS = [
  ['FG', 'fgm', 'fga'],
  ['3P', 'fg3m', 'fg3a'],
  ['FT', 'ftm', 'fta']
] as const
export const PLAYER_METRICS = [
  ...PLAYER_COUNTS,
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'plus_minus'
] as const
/** Read where the league has them: a player listed Out of a game gets a row (T1206). */
export const OUT_METRICS = ['games_out_injury', 'games_out_other'] as const

/** A team row's stats: counts, then two shooting pairs. */
export const TEAM_METRICS = [
  'team_pts',
  'opp_pts',
  'team_point_diff',
  'team_fgm',
  'team_fga',
  'team_fg3m',
  'team_fg3a',
  'team_reb',
  'team_ast',
  'team_tov'
] as const

/**
 * The attempts a shooting cell needs to be tinted by its percentage, in that game and in each game
 * it is set against: 5 field goals, 3 threes, 3 free throws. Fewer is too small a sample to colour.
 */
export const SHOT_MINIMUM: Record<string, number> = {
  fga: 5,
  fg3a: 3,
  fta: 3,
  team_fga: 5,
  team_fg3a: 3
}

/** The fewest games of their own a cell is set against before it is tinted. */
export const MIN_GAMES = 5

/** One game of a player or team, from the engine's rows by game and the schedule. */
export interface GameLine {
  game: string
  date: string
  type: GameType
  /** The team's id for that game (a player's, from their team's code). */
  team: string | null
  values: Record<string, number | null>
  /** Listed Out of the game with no box-score line (T1206): the reason's kind. */
  out: 'injury' | 'other' | null
}

/** The engine's rows by game, each placed on its date and type and the team's id, by subject. */
export function gameLines(
  result: StatsResult | null,
  games: ReadonlyMap<string, StatsGame>,
  entity: 'player' | 'team'
): Map<string, GameLine[]> {
  const out = new Map<string, GameLine[]>()
  for (const r of result?.rows ?? []) {
    const g = games.get(String(r.group.game ?? ''))
    if (!g || !counts(g)) continue
    const team =
      entity === 'team'
        ? r.id
        : r.team === g.home.code
          ? g.home.id
          : r.team === g.away.code
            ? g.away.id
            : null
    const values = Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, v.value]))
    const outKind = r.noLine
      ? (values.games_out_injury ?? 0) > 0
        ? 'injury'
        : (values.games_out_other ?? 0) > 0
          ? 'other'
          : null
      : null
    const line: GameLine = {
      game: g.id,
      date: g.date,
      type: g.type,
      team,
      values,
      out: outKind
    }
    out.set(r.id, [...(out.get(r.id) ?? []), line])
  }
  for (const lines of out.values())
    lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

/**
 * A line of a game played: not a games-out row, and some value of the box score. A team's line holds
 * `team_` columns, a player's their own, so any value counts.
 */
const played = (l: GameLine): boolean =>
  l.out === null &&
  Object.entries(l.values).some(([k, v]) => v !== null && !k.startsWith('games_out'))

/**
 * The team a player is on on a day: their latest game's team on or before it, or, before their first
 * game of the season, that game's team. Null with no game in the season.
 */
export function teamOn(lines: readonly GameLine[], day: string): string | null {
  const on = lines.filter((l) => l.team !== null && played(l))
  if (!on.length) return null
  const before = on.filter((l) => l.date <= day)
  return (before.at(-1) ?? on[0]).team
}

/** A team's counted game on a day, if any. */
export function teamGameOn(
  team: string | null,
  day: string,
  games: readonly StatsGame[]
): StatsGame | null {
  if (team === null) return null
  return (
    games.find((g) => g.date === day && counts(g) && (g.home.id === team || g.away.id === team)) ??
    null
  )
}

/**
 * The days a league's favourites had a game: a favourite team's, or the team a favourite player was
 * on that day. Only games played, the days loaded: a game still to come is no day of the page (D31).
 * Dates as the schedule writes them, in order.
 */
export function favouriteDays(
  playerLogs: ReadonlyMap<string, GameLine[]>,
  teamIds: readonly string[],
  games: readonly StatsGame[]
): string[] {
  const days = new Set<string>()
  const teams = new Set(teamIds)
  for (const g of games) {
    if (!counts(g) || !g.played) continue
    if (teams.has(g.home.id ?? '') || teams.has(g.away.id ?? '')) days.add(g.date)
  }
  for (const lines of playerLogs.values()) {
    for (const g of games) {
      if (!counts(g) || !g.played || days.has(g.date)) continue
      const team = teamOn(lines, g.date)
      if (team !== null && (g.home.id === team || g.away.id === team)) days.add(g.date)
    }
  }
  return [...days].sort()
}

/** The page's day: the one chosen, else the latest with a favourite's game in any section loaded. */
export function pageDay(
  chosen: string | null,
  sectionDays: readonly (readonly string[])[]
): string | null {
  if (chosen !== null) return chosen
  const all = sectionDays.flat()
  return all.length ? all.reduce((a, b) => (a > b ? a : b)) : null
}

/** Every day with a favourite's game, across the sections, in order. */
export const allDays = (sectionDays: readonly (readonly string[])[]): string[] =>
  [...new Set(sectionDays.flat())].sort()

/** The day before or after with a favourite's game, skipping the empty ones; null past the ends. */
export function stepFavouriteDay(
  days: readonly string[],
  day: string | null,
  by: -1 | 1
): string | null {
  if (day === null) return null
  if (by < 0) return [...days].reverse().find((d) => d < day) ?? null
  return days.find((d) => d > day) ?? null
}

/** A cell's tint against the subject's own games: its heat, and the words its title gives. */
export interface Tint {
  heat: Heat
  /** 0–100 among the games set against, or null when it is not tinted. */
  percentile: number | null
  /** "4th highest of 16 games". */
  place: string | null
  /** The season average of the games set against. */
  average: number | null
}

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/**
 * Where a game's value sits among the subject's own games of the season and season type up to that
 * day, that game included (policy 6, the stated rule): its percentile is the share of the other games
 * it beats, a tie counting half, so the best game is 100 and the worst 0; lower is better for
 * turnovers and points allowed. Not tinted with fewer than `MIN_GAMES` games, or with no value.
 */
export function tintOf(
  value: number | null,
  values: readonly (number | null)[],
  direction: 'higher' | 'lower'
): Tint {
  const all = values.filter((v): v is number => v !== null)
  const average = all.length ? all.reduce((t, v) => t + v, 0) / all.length : null
  if (value === null || all.length < MIN_GAMES) {
    return { heat: 'n', percentile: null, place: null, average }
  }
  const others = all.length - 1
  const below = all.filter((v) => v < value).length
  const equal = all.filter((v) => v === value).length - 1
  const raw = (100 * (below + equal / 2)) / others
  const percentile = direction === 'lower' ? 100 - raw : raw
  const higher = all.filter((v) => v > value).length
  const lower = all.filter((v) => v < value).length
  const place =
    direction === 'lower'
      ? `${ordinal(lower + 1)} lowest of ${all.length} games`
      : `${ordinal(higher + 1)} highest of ${all.length} games`
  return { heat: heatOf(percentile, direction), percentile, place, average }
}

/** A shooting cell's tint by its percentage, among the games with the attempts the minimum asks. */
export function shotTint(
  made: number | null,
  attempts: number | null,
  pairs: readonly { made: number | null; attempts: number | null }[],
  minimum: number
): Tint {
  const pct = (m: number | null, a: number | null): number | null =>
    m !== null && a !== null && a >= minimum ? m / a : null
  const value = pct(made, attempts)
  const values = pairs.map((p) => pct(p.made, p.attempts))
  return tintOf(value, values, 'higher')
}

/** A favourite player's state on the page's day. */
export type PlayerState =
  | { kind: 'played'; line: GameLine; game: StatsGame }
  | { kind: 'dnp'; game: StatsGame; reason: string | null; team: string | null }
  /** The team's game that day is on the schedule but not played in the data loaded (D31). */
  | { kind: 'pending'; game: StatsGame; team: string | null }
  | { kind: 'nogame'; team: string | null }
  /** No game in the league in the season of the page's day: counted at the section's foot. */
  | { kind: 'absent' }

export function playerState(
  lines: readonly GameLine[],
  day: string,
  games: readonly StatsGame[]
): PlayerState {
  const playedLines = lines.filter(played)
  if (!playedLines.length) return { kind: 'absent' }
  const today = playedLines.find((l) => l.date === day)
  const team = teamOn(lines, day)
  const game = today
    ? (games.find((g) => g.id === today.game) ?? null)
    : teamGameOn(team, day, games)
  if (today && game) return { kind: 'played', line: today, game }
  if (game && !game.played) return { kind: 'pending', game, team }
  if (game) {
    const out = lines.find((l) => l.game === game.id && l.out !== null)
    const reason =
      out?.out === 'injury'
        ? 'Listed Out: injury or illness'
        : out?.out === 'other'
          ? 'Listed Out: another reason'
          : null
    return { kind: 'dnp', game, reason, team }
  }
  return { kind: 'nogame', team }
}

/** The games a line is set against for the tint: the same season type, up to and including the day. */
export function seasonSoFar(lines: readonly GameLine[], line: GameLine): GameLine[] {
  return lines.filter((l) => played(l) && l.type === line.type && l.date <= line.date)
}

/** "W 110–102 vs BOS", from the side of the team with this id. */
export function gameWords(g: StatsGame, team: string | null): string {
  const home = g.home.id === team
  const us = home ? g.home : g.away
  const them = home ? g.away : g.home
  const where = home ? 'vs' : '@'
  if (!g.played || us.score === null || them.score === null) return `${where} ${them.code}`
  const result = us.score > them.score ? 'W' : 'L'
  return `${result} ${us.score}–${them.score} ${where} ${them.code}`
}

/** A team's record after a game: its wins and losses in that season type, the game included. */
export function recordAfter(team: string, game: StatsGame, games: readonly StatsGame[]): string {
  let w = 0
  let l = 0
  for (const g of games) {
    if (!g.played || g.type !== game.type || g.date > game.date) continue
    if (g.date === game.date && g.id !== game.id) continue
    const home = g.home.id === team
    if (!home && g.away.id !== team) continue
    const us = home ? g.home.score : g.away.score
    const them = home ? g.away.score : g.home.score
    if (us === null || them === null) continue
    if (us > them) w++
    else l++
  }
  return `${w}-${l}`
}

/**
 * The order of a section's rows (D49): players then teams; played, then did not play, then a game not
 * in the data yet, then no game.
 */
const STATE_ORDER: Record<string, number> = { played: 0, dnp: 1, pending: 2, nogame: 3 }

export interface Ordered<T> {
  favourite: Favourite
  state: { kind: string }
  row: T
}

/** Players then teams, by state, each group in the order they were starred; never by a stat. */
export function orderRows<T>(rows: readonly Ordered<T>[]): Ordered<T>[] {
  const index = new Map(rows.map((r, i) => [r, i]))
  return [...rows].sort((a, b) => {
    const kind = (a.favourite.kind === 'player' ? 0 : 1) - (b.favourite.kind === 'player' ? 0 : 1)
    if (kind) return kind
    const state = (STATE_ORDER[a.state.kind] ?? 3) - (STATE_ORDER[b.state.kind] ?? 3)
    if (state) return state
    const starred = a.favourite.starredAt.localeCompare(b.favourite.starredAt)
    return starred || index.get(a)! - index.get(b)!
  })
}

/** The line at a section's foot for the favourites with no game in the season of the page's day. */
export function absentNote(n: number, season: string): string | null {
  if (n === 0) return null
  return n === 1
    ? `1 favourite has no game in ${season}`
    : `${n} favourites have no game in ${season}`
}

/** The section's data note, when its data stops before the page's day. */
export function throughNote(
  league: string,
  through: string | null,
  day: string | null,
  words: (d: string) => string
): string | null {
  if (through === null || day === null || through >= day) return null
  return `${league} data through ${words(through)}`
}

/** A scope lists at most 64 players or teams: the page's queries are batched by it. */
const A_QUERY = 64

/**
 * The page's queries for a league's season: the favourite players' games and the favourite teams'
 * games, by game, every counted type of the season (the schedule says which). As few as the engine
 * allows: one a 64 players or teams.
 */
export function sectionQueries(
  season: number,
  gameTypes: readonly GameType[],
  players: readonly string[],
  teams: readonly string[],
  withOut: boolean
): { players: StatsQuery[]; teams: StatsQuery[] } {
  const batch = (ids: readonly string[]): string[][] => {
    const out: string[][] = []
    for (let i = 0; i < ids.length; i += A_QUERY) out.push(ids.slice(i, i + A_QUERY))
    return out
  }
  const scope = { seasons: [season], gameTypes: [...gameTypes] }
  return {
    players: batch(players).map((ids) => ({
      entity: 'player' as const,
      metrics: [...PLAYER_METRICS, ...(withOut ? OUT_METRICS : [])],
      scope: { ...scope, players: ids },
      groupBy: ['game' as const],
      limit: 5000,
      ranks: false
    })),
    teams: batch(teams).map((ids) => ({
      entity: 'team' as const,
      metrics: [...TEAM_METRICS],
      scope: { ...scope, teams: ids },
      groupBy: ['game' as const],
      limit: 5000,
      ranks: false
    }))
  }
}

/** The query for the top scorer of each favourite team's game on the day: points by player, by game. */
export function topScorerQuery(
  season: number,
  gameIds: readonly string[],
  gameTypes: readonly GameType[]
): StatsQuery | null {
  if (!gameIds.length) return null
  return {
    entity: 'player',
    metrics: ['pts'],
    scope: { seasons: [season], gameTypes: [...gameTypes], games: [...gameIds] },
    groupBy: ['game'],
    sort: { metric: 'pts', dir: 'desc' },
    limit: 5000,
    ranks: false
  }
}

/** The game's top scorer for a team: the most points among that team's players; first by name on a tie. */
export function topScorer(
  result: StatsResult | null,
  game: StatsGame,
  team: string
): { name: string; pts: number } | null {
  const code = game.home.id === team ? game.home.code : game.away.code
  const rows = (result?.rows ?? []).filter(
    (r) => String(r.group.game) === game.id && r.team === code && r.values.pts?.value !== null
  )
  if (!rows.length) return null
  const best = [...rows].sort(
    (a, b) =>
      (b.values.pts?.value ?? 0) - (a.values.pts?.value ?? 0) || a.name.localeCompare(b.name)
  )[0]
  return { name: best.name, pts: best.values.pts?.value ?? 0 }
}

/**
 * The page's sections (D50): the leagues with favourites, the league on screen first, then the others
 * in the league menu's order; each with whether its stats file is there to read. A league whose file
 * is not downloaded lists its favourites by their stored names.
 */
export function pageLeagues<L extends string>(
  current: L,
  order: readonly L[],
  favourites: Partial<Record<L, readonly unknown[]>>,
  hasFile: (league: L) => boolean
): { league: L; downloaded: boolean }[] {
  return [current, ...order.filter((l) => l !== current)]
    .filter((l) => (favourites[l] ?? []).length > 0)
    .map((league) => ({ league, downloaded: hasFile(league) }))
}

/**
 * A "Did not play" reason from the injury report's last listing before the game (T1206's source):
 * "Listed Out: Injury/Illness - Low Back Tightness". Null with no listing: the data gives no reason.
 */
export function listingWords(
  listing: { status: string; reason: string | null } | null
): string | null {
  if (!listing) return null
  return listing.reason ? `Listed ${listing.status}: ${listing.reason}` : `Listed ${listing.status}`
}

/**
 * The page's line under its title: the day shown and, apart, through when the league on screen's data
 * runs, so a day stepped back never reads as the latest. "Games of Nov 8, 2026 · data through Nov 21,
 * 2026, not live".
 */
export function pageSubtitle(
  day: string | null,
  through: string | null,
  loaded: boolean,
  words: (d: string) => string
): string {
  const first = day
    ? `Games of ${words(day)}`
    : loaded
      ? 'No day with a favourite’s game'
      : 'Finding the latest day…'
  return `${first} · ${through ? `data through ${words(through)}, ` : ''}not live`
}

/** The cells shown plain, never tinted: more minutes is no better game, and +/− is the team's. */
export const PLAIN = new Set(['min', 'plus_minus'])

/** A plain cell's tint: none, with the season average for its title. */
export function plainTint(values: readonly (number | null)[]): Tint {
  const all = values.filter((v): v is number => v !== null)
  return {
    heat: 'n',
    percentile: null,
    place: null,
    average: all.length ? all.reduce((t, v) => t + v, 0) / all.length : null
  }
}
