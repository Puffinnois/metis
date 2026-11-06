import type { LeaderboardBoard, StatsView } from '@shared/stats/types'
import type { Db } from '../connection'

interface ViewRow {
  id: number
  name: string
  board_json: string
  updated_at: string
}

const MODES = ['raw', 'perGame', 'per36', 'per48', 'per100']

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
    (x.team === null || text(x.team))
  )
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

/** Every saved view, by name. */
export function listStatsViews(db: Db): StatsView[] {
  return (
    db
      .prepare(
        'SELECT id, name, board_json, updated_at FROM stats_views ORDER BY name COLLATE NOCASE'
      )
      .all() as unknown as ViewRow[]
  )
    .map(toView)
    .filter((v): v is StatsView => v !== null)
}

/** Saves a view under `name`; a view of the same name (any case) is replaced. */
export function saveStatsView(
  db: Db,
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
      `INSERT INTO stats_views (name, board_json, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET name = excluded.name, board_json = excluded.board_json,
         updated_at = excluded.updated_at
       RETURNING id, name, board_json, updated_at`
    )
    .get(trimmed, JSON.stringify(board), now, now) as unknown as ViewRow
  return toView(row)!
}

export function deleteStatsView(db: Db, id: number): void {
  db.prepare('DELETE FROM stats_views WHERE id = ?').run(id)
}
