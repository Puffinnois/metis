import {
  LINEUP_GROUPS,
  LINEUPS_FIRST_SEASON,
  LINEUPS_WHOLE_SEASONS,
  lineupColumns,
  type LineupColumn,
  type LineupGroup
} from '@shared/stats/lineups'
import { seasonLabel } from '@shared/stats/seasons'
import type { BoardMode, GameType, StatsLineupUnit } from '@shared/stats/types'
import { fmtClock, fmtStat } from './format'
import type { StatsScope } from './scope'

/**
 * The team dashboard's Lineups tab: the NBA's published five-man units, one dashboard's measures at
 * a time. A unit is a whole season of a team's games, so a date range or the last games cannot be
 * answered, and the dashboard's scope is one season: nothing is added up across seasons.
 */

export { LINEUP_GROUPS, LINEUPS_FIRST_SEASON, type LineupGroup }

/** How many units a list shows before "all". */
export const UNIT_LIMIT = 15

/** The floors the minimum-minutes control offers; a unit under one is hidden, not lost. */
export const MIN_MINUTES = [0, 10, 25, 50, 100, 200]

/** Where the control starts: most of a regular season's units are a few minutes' work. */
export const DEFAULT_MIN_MINUTES = 25

/** Why the lineups cannot answer this scope; null when they can. */
export function lineupGap(scope: StatsScope): string | null {
  if (scope.season < LINEUPS_FIRST_SEASON)
    return `Recorded from ${seasonLabel(LINEUPS_FIRST_SEASON)}.`
  if (scope.range.kind !== 'season') return LINEUPS_WHOLE_SEASONS
  if (scope.seasonType === 'counted') {
    return 'The NBA publishes the regular season and the playoffs apart: pick one.'
  }
  if (scope.seasonType !== 'regular' && scope.seasonType !== 'playoffs') {
    return 'The NBA publishes lineups for the regular season and the playoffs only.'
  }
  return null
}

/** The season type a read asks for; the gap is checked first. */
export const lineupGameType = (scope: StatsScope): GameType =>
  scope.seasonType === 'playoffs' ? 'playoffs' : 'regular'

/** "T. Mann": the NBA's own form, and short enough for five names in a row. */
export function shortName(name: string): string {
  if (/^[A-Z]\. /.test(name) || /^Player \d+$/.test(name)) return name
  const parts = name.trim().split(/\s+/)
  return parts.length < 2 ? name : `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

export interface LineupCell {
  text: string
  /** Why the cell is blank; absent when it holds a value. */
  reason?: string
}

const NO_UNIT = 'The NBA’s file for these measures does not list this unit.'
const NO_POSSESSIONS = 'The NBA does not publish possessions for this unit.'
const NO_MINUTES = 'The unit has no minutes.'
const PER: Partial<Record<BoardMode, number>> = { per36: 36, per48: 48, per100: 100 }

/** A unit's number for a column in a mode, with the reason when it has none. */
export function unitValue(
  unit: StatsLineupUnit,
  col: LineupColumn,
  mode: BoardMode
): { value: number | null; reason?: string } {
  const get = (id: string): number | null =>
    id === 'games' ? unit.games : (unit.values[id] ?? null)
  if (col.of) {
    const [a, b] = col.of.map(get)
    // No attempts is no percentage, not 0 %.
    if (a === null || b === null) return { value: null, reason: NO_UNIT }
    return b === 0 ? { value: null, reason: 'No attempts.' } : { value: a / b }
  }
  const raw = unit.values[col.id] ?? null
  if (raw === null) return { value: null, reason: NO_UNIT }
  if (col.kind === 'value' || mode === 'raw') return { value: raw }
  if (mode === 'perGame') {
    return unit.games ? { value: raw / unit.games } : { value: null, reason: NO_UNIT }
  }
  if (mode === 'per100') {
    const poss = unit.values.possessions ?? null
    return poss ? { value: (raw / poss) * 100 } : { value: null, reason: NO_POSSESSIONS }
  }
  return unit.minutes
    ? { value: (raw / unit.minutes) * (PER[mode] ?? 1) }
    : { value: null, reason: NO_MINUTES }
}

/** How a column's value is written; a rescaled count shows a decimal. */
export function cellText(value: number | null, col: LineupColumn, mode: BoardMode): string {
  const rescaled = col.kind === 'sum' && mode !== 'raw'
  return fmtStat(value, {
    unit: col.unit,
    decimals: rescaled ? Math.max(1, col.decimals) : col.decimals
  })
}

export interface LineupRow {
  key: string
  players: { id: string; name: string }[]
  games: string
  minutes: string
  cells: LineupCell[]
  /** What the row sorts by: the games, the minutes, then each cell's number. */
  numbers: (number | null)[]
}

export type LineupSort = { by: number; dir: 'asc' | 'desc' }

/** Units of at least `minMinutes`, in the order asked, each with its cells for the group. */
export function lineupRows(
  units: StatsLineupUnit[],
  group: LineupGroup,
  mode: BoardMode,
  minMinutes: number,
  sort: LineupSort
): LineupRow[] {
  const columns = lineupColumns(group)
  const rows = units
    .filter((u) => (u.minutes ?? 0) >= minMinutes)
    .map((u): LineupRow => {
      const values = columns.map((c) => unitValue(u, c, mode))
      return {
        key: u.players.map((p) => p.id).join('-'),
        players: u.players,
        games: fmtStat(u.games, { unit: 'count', decimals: 0 }),
        minutes: fmtClock(u.minutes),
        cells: values.map((v, i) =>
          v.value === null
            ? { text: '—', reason: v.reason }
            : { text: cellText(v.value, columns[i], mode) }
        ),
        numbers: [u.games, u.minutes, ...values.map((v) => v.value)]
      }
    })
  const sign = sort.dir === 'asc' ? 1 : -1
  return rows.sort((a, b) => {
    const x = a.numbers[sort.by]
    const y = b.numbers[sort.by]
    // A blank sorts last whichever way the column runs.
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    return (x - y) * sign
  })
}

/** The sort a group opens on: the most minutes first. */
export const DEFAULT_SORT: LineupSort = { by: 1, dir: 'desc' }

/** "15 of 82 units", or "9 units" when the list shows them all. */
export function unitCount(shown: number, total: number): string {
  const units = total === 1 ? 'unit' : 'units'
  return shown < total ? `${shown} of ${total} ${units}` : `${total} ${units}`
}

/** What a list says about the units the NBA leaves out. */
export function lineupNotes(
  scope: StatsScope,
  floorMinutes: number | null,
  mode: BoardMode
): string[] {
  const notes: string[] = []
  if (scope.seasonType === 'regular') {
    notes.push(
      floorMinutes === null
        ? 'The NBA lists only the 2,000 units of a regular season with the most minutes, so a team’s list can be short.'
        : `The NBA lists only the 2,000 units of a regular season with the most minutes: this season, ${fmtClock(floorMinutes)} or more, so a team’s list can be short.`
    )
    notes.push(
      'Each file ranks its own 2,000 units, so a unit one file lists can be missing from another: its cells read —.'
    )
  }
  if (mode === 'per100')
    notes.push('Per 100 divides by the possessions the Advanced file publishes.')
  return notes
}
