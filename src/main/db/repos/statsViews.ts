import { PER_MINUTE, type LeagueId } from '@shared/leagues'
import type { LeaderboardBoard, StatsView } from '@shared/stats/types'
import type { Db } from '../connection'

interface ViewRow {
  id: number
  name: string
  board_json: string
  updated_at: string
}

const MODES = ['raw', 'perGame', ...Object.keys(PER_MINUTE), 'per100']

const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64

/** A board from the renderer or the database: its shape, not its metrics (the screen drops unknown ones). */
export function isBoard(b: unknown): b is LeaderboardBoard {
  if (!b || typeof b !== 'object') return false
  const x = b as Record<string, unknown>
  const sort = x.sort as Record<string, unknown> | null | undefined
  return (
    (x.entity === 'player' || x.entity === 'team') &&
    text(x.tab) &&
    Array.isArray(x.columns) &&
    x.columns.length > 0 &&
    x.columns.length <= 40 &&
    x.columns.every(text) &&
    !!sort &&
    text(sort.by) &&
    (sort.dir === 'asc' || sort.dir === 'desc') &&
    MODES.includes(x.mode as string) &&
    typeof x.qualifiedOnly === 'boolean' &&
    (x.team === null || text(x.team)) &&
    (x.favourites === undefined || typeof x.favourites === 'boolean') &&
    (x.filters === undefined || isFilterList(x.filters))
  )
}

const OPS = [
  'between',
  'atLeast',
  'atMost',
  'anyOf',
  'noneOf',
  'contains',
  'is',
  'isNot',
  'hasValue',
  'hasNone'
]

/** A board's filters (D51): at most 20 conditions of the engine's shape; the engine checks the rest. */
function isFilterList(v: unknown): boolean {
  if (!Array.isArray(v) || v.length > 20) return false
  const scalar = (y: unknown): boolean =>
    (typeof y === 'number' && Number.isFinite(y)) || (typeof y === 'string' && y.length <= 80)
  return v.every((f) => {
    if (!f || typeof f !== 'object') return false
    const c = f as Record<string, unknown>
    const on = [c.attribute, c.metric].filter((x) => x !== undefined)
    const value =
      c.value === undefined ||
      scalar(c.value) ||
      (Array.isArray(c.value) && c.value.length <= 64 && c.value.every(scalar))
    return on.length === 1 && text(on[0]) && OPS.includes(c.op as string) && value
  })
}

/** A row's view, or null when its board does not parse (never the whole list's failure). */
function toView(r: ViewRow): StatsView | null {
  let board: unknown
  try {
    board = JSON.parse(r.board_json)
  } catch {
    return null
  }
  return isBoard(board) ? { id: r.id, name: r.name, board, updatedAt: r.updated_at } : null
}

/** A league's saved views, by name (D35: each league keeps its own). */
export function listStatsViews(db: Db, league: LeagueId): StatsView[] {
  return (
    db
      .prepare(
        `SELECT id, name, board_json, updated_at FROM stats_views WHERE league = ?
         ORDER BY name COLLATE NOCASE`
      )
      .all(league) as unknown as ViewRow[]
  )
    .map(toView)
    .filter((v): v is StatsView => v !== null)
}

/** Saves a league's view under `name`; its view of the same name (any case) is replaced. */
export function saveStatsView(
  db: Db,
  league: LeagueId,
  name: string,
  board: LeaderboardBoard,
  now: string
): StatsView {
  if (!isBoard(board)) throw new Error('This view cannot be saved: its table settings are invalid')
  const trimmed = (typeof name === 'string' ? name : '').trim()
  if (!trimmed) throw new Error('A view needs a name')
  if (trimmed.length > 60) throw new Error('A view name is at most 60 characters')
  const row = db
    .prepare(
      `INSERT INTO stats_views (league, name, board_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(league, name) DO UPDATE SET name = excluded.name, board_json = excluded.board_json,
         updated_at = excluded.updated_at
       RETURNING id, name, board_json, updated_at`
    )
    .get(league, trimmed, JSON.stringify(board), now, now) as unknown as ViewRow
  return toView(row)!
}

/** Deletes a view of this league only: an id from another league's list deletes nothing. */
export function deleteStatsView(db: Db, league: LeagueId, id: number): void {
  db.prepare('DELETE FROM stats_views WHERE id = ? AND league = ?').run(id, league)
}
