import { currentLeague, seasonLabel } from '@/lib/stats/league'
import { fullDay } from '@/lib/stats/scope'
import { coverageReason } from '@shared/stats/coverage'
import {
  highOf,
  HIGHS,
  streakOf,
  STREAKS,
  tallyOf,
  THRESHOLDS,
  type Feat,
  type High,
  type Run
} from '@shared/stats/highs'
import type { GameCount, GameType, MetricInfo, StatsPlayerGame } from '@shared/stats/types'

/*
 * The player page's Highs tab (Plan T1703.3): highs, streaks and threshold games as the screen reads
 * them, from the game lines. A season is the whole season in the page's season type; a career is every
 * season of that type. What no line can say reads its reason, never 0.
 */

/** A cell: what it shows, why or from when on hover, and the game it opens. */
export interface HighCell {
  text: string
  /** Beside the value: the date and opponent, or the dates of a run. */
  note: string
  title: string
  gameId: string | null
}

export interface HighRow {
  id: string
  label: string
  season: HighCell
  career: HighCell
}

export interface StreakRow extends HighRow {
  /** The run the last game stands in, for a player with a game in the latest season. */
  now: HighCell
}

/** A season's line of a table by season; the last is the career's. */
export interface SeasonRow {
  key: string
  label: string
  games: number
  cells: HighCell[]
  /** The season in the page's scope. */
  here: boolean
}

export interface HighsView {
  /** What the career column is called, and what it lacks, where the data starts after it. */
  career: string
  careerNote: string | null
  highs: HighRow[]
  streaks: StreakRow[]
  thresholds: SeasonRow[]
  bySeason: SeasonRow[]
  /** What the numbers lack, in sentences. */
  notes: string[]
  games: { season: number; career: number }
}

/** The heads of the two tables by season. */
export const THRESHOLD_HEADS = THRESHOLDS.map((f) => ({ id: f.id, label: f.short, title: f.label }))
export const SEASON_HIGHS = HIGHS.map((h) => h.metric)

const BLANK: HighCell = { text: '—', note: '', title: '', gameId: null }

/** A count as a box score writes it: minutes with their seconds, a plus-minus signed. */
export function fmtCount(value: number, count: GameCount): string {
  if (count === 'seconds') {
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
  }
  if (count === 'plus_minus') {
    return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
  }
  return String(value)
}

/** "vs BOS", "@ BOS"; a neutral or unnamed side reads what is known. */
export const against = (g: StatsPlayerGame): string =>
  g.opponent === null ? '' : `${g.home === false ? '@' : 'vs'} ${g.opponent}`

const dated = (g: StatsPlayerGame): string =>
  [fullDay(g.date), against(g)].filter((x) => x !== '').join(' ')

/** Why a count has no value over some seasons: the metric's own coverage, else that no line has it. */
function gap(
  metrics: readonly string[],
  byId: ReadonlyMap<string, MetricInfo>,
  seasons: readonly number[]
): string {
  for (const id of metrics) {
    const info = byId.get(id)
    if (info?.unavailable) return info.unavailable
    const reason = info ? coverageReason(info, seasons, currentLeague()) : null
    if (reason) return reason
  }
  return 'No box-score line of these games has it.'
}

const seasonsOf = (games: readonly StatsPlayerGame[]): number[] => [
  ...new Set(games.map((g) => g.season))
]

interface Scope {
  games: readonly StatsPlayerGame[]
  /** Why there is nothing to read where there are no games. */
  none: string
}

function highCell(
  { games, none }: Scope,
  count: GameCount,
  metric: string,
  byId: ReadonlyMap<string, MetricInfo>
): HighCell {
  if (games.length === 0) return { ...BLANK, title: none }
  const high = highOf(games, count)
  if (!high) return { ...BLANK, title: gap([metric], byId, seasonsOf(games)) }
  // Nothing of it in any game: no game is the best of them.
  if (high.value === 0 && count !== 'plus_minus') {
    return { ...BLANK, text: '0', title: `None in these games${lacking(high)}` }
  }
  return {
    text: fmtCount(high.value, count),
    note: `${dated(high.game)}${high.times > 1 ? ` · ${high.times} times` : ''}`,
    title: `${high.times > 1 ? 'The latest of them: open' : 'Open'} this game${lacking(high)}`,
    gameId: high.game.gameId
  }
}

const lacking = (x: Pick<High, 'unknown'>): string =>
  x.unknown > 0 ? `. ${x.unknown} ${x.unknown === 1 ? 'game has' : 'games have'} no count` : ''

function runCell(run: Run | null, title: string): HighCell {
  if (!run) return { ...BLANK, text: '0', title }
  const { from, to, length } = run
  return {
    text: String(length),
    note: length === 1 ? dated(from) : `${fullDay(from.date)} – ${fullDay(to.date)}`,
    title: title || 'Open its last game',
    gameId: to.gameId
  }
}

/** A feat's coverage over some games: null where at least one line can say. */
function featGap(games: Scope, feat: Feat, byId: ReadonlyMap<string, MetricInfo>): HighCell | null {
  if (games.games.length === 0) return { ...BLANK, title: games.none }
  if (tallyOf(games.games, feat).known > 0) return null
  return { ...BLANK, title: gap(feat.metrics, byId, seasonsOf(games.games)) }
}

function tallyCell(scope: Scope, feat: Feat, byId: ReadonlyMap<string, MetricInfo>): HighCell {
  const missing = featGap(scope, feat, byId)
  if (missing) return missing
  const t = tallyOf(scope.games, feat)
  return {
    text: String(t.games),
    note: '',
    title: `${t.games} of ${t.known} games: ${feat.label.toLowerCase()}${lacking(t)}`,
    gameId: null
  }
}

/**
 * Whether a player's games before the data are missing: yes when the draft says they were drafted
 * before it, maybe when nothing says either way and their first game is in its first season.
 */
export function careerStart(
  games: readonly StatsPlayerGame[],
  draftYear: number | null
): 'whole' | 'before' | 'maybe' {
  const league = currentLeague()
  if (!league.playedBefore || games.length === 0) return 'whole'
  // The draft before the first season's is the season's own rookies': 1993 for 1993-94. A college
  // player's draft is the league they went on to, and says nothing of when they came to college.
  if (draftYear !== null && !league.loadedWindow) {
    return draftYear < league.firstSeason - 1 ? 'before' : 'whole'
  }
  return games[0].season === league.firstSeason ? 'maybe' : 'whole'
}

/** What to call the career: a name that says where it starts when the data starts after it. */
export const careerName = (start: 'whole' | 'before' | 'maybe'): string =>
  start === 'before' ? `Since ${seasonLabel(currentLeague().firstSeason)}` : 'Career'

/** The line that says which games a career lacks; null when it lacks none. */
export function careerNote(
  start: 'whole' | 'before' | 'maybe',
  draftYear: number | null
): string | null {
  const first = seasonLabel(currentLeague().firstSeason)
  if (start === 'before') {
    return `Drafted in ${draftYear}: the data starts in ${first}, so the games before it are not here.`
  }
  return start === 'maybe'
    ? `The data starts in ${first}: games before it, if any, are not here.`
    : null
}

/** Everything the tab shows, from the player's game lines in date order. */
export function highsView({
  games,
  types,
  counted,
  season,
  latest,
  byId,
  career: start = 'whole',
  draftYear = null
}: {
  games: readonly StatsPlayerGame[]
  /** The game types of the page's season type. */
  types: readonly GameType[]
  /** The types that count for the league: whether the player is still playing is read over them. */
  counted: readonly GameType[]
  season: number
  /** The league's latest season in the data. */
  latest: number | null
  byId: ReadonlyMap<string, MetricInfo>
  /** Whether games before the data are missing (`careerStart`), and the year the draft lists. */
  career?: ReturnType<typeof careerStart>
  draftYear?: number | null
}): HighsView {
  const all = games.filter((g) => types.includes(g.gameType))
  const here: Scope = {
    games: all.filter((g) => g.season === season),
    none: `No games in ${seasonLabel(season)}.`
  }
  const career: Scope = { games: all, none: 'No games.' }
  const last = games.filter((g) => counted.includes(g.gameType)).at(-1)
  const playing = last !== undefined && last.season === latest
  const label = (metric: string): string => byId.get(metric)?.label ?? metric

  const highs = HIGHS.map(({ count, metric }) => ({
    id: metric,
    label: label(metric),
    season: highCell(here, count, metric, byId),
    career: highCell(career, count, metric, byId)
  }))

  const streaks = STREAKS.map((feat): StreakRow => {
    const inSeason = streakOf(here.games, feat)
    const ever = streakOf(all, feat)
    const missing = featGap(career, feat, byId)
    const now: HighCell = missing
      ? missing
      : playing
        ? runCell(
            ever.last,
            ever.last ? 'Through their last game: open it' : 'Not in their last game'
          )
        : { ...BLANK, title: latest === null ? '' : `No game in ${seasonLabel(latest)}.` }
    return {
      id: feat.id,
      label: feat.label,
      season: featGap(here, feat, byId) ?? runCell(inSeason.longest, ''),
      now,
      career: missing ?? runCell(ever.longest, '')
    }
  })

  const played = seasonsOf(all).sort((a, b) => a - b)
  const rows = <T>(cells: (scope: Scope) => T[]): (Omit<SeasonRow, 'cells'> & { cells: T[] })[] => [
    ...played.map((s) => {
      const list = all.filter((g) => g.season === s)
      return {
        key: String(s),
        label: seasonLabel(s),
        games: list.length,
        cells: cells({ games: list, none: '' }),
        here: s === season
      }
    }),
    {
      key: 'career',
      label: careerName(start),
      games: all.length,
      cells: cells(career),
      here: false
    }
  ]

  const notes = HIGHS.flatMap(({ count, metric }) => {
    const unknown = highOf(all, count)?.unknown ?? 0
    if (unknown === 0) return []
    const info = byId.get(metric)
    const since =
      info && played.length > 0 && info.firstSeason > played[0]
        ? ` (recorded from ${seasonLabel(info.firstSeason)})`
        : ''
    return [`${label(metric)}: ${unknown} of ${all.length} career games have no count${since}.`]
  })

  return {
    career: careerName(start),
    careerNote: careerNote(start, draftYear),
    highs,
    streaks,
    thresholds: rows((scope) => THRESHOLDS.map((f) => tallyCell(scope, f, byId))),
    bySeason: rows((scope) => HIGHS.map((h) => highCell(scope, h.count, h.metric, byId))),
    notes,
    games: { season: here.games.length, career: all.length }
  }
}
