import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { ColumnPicker } from '@/components/stats/ColumnPicker'
import { CheckToggle, Segmented, StatsButton, StatsSelect } from '@/components/stats/controls'
import { HeatLegend, LeaderTable } from '@/components/stats/LeaderTable'
import { ScopeBar } from '@/components/stats/ScopeBar'
import { ViewsMenu } from '@/components/stats/ViewsMenu'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { familyLabel } from '@/lib/stats/format'
import {
  bestFirst,
  BOARD_MODES,
  csvFileName,
  defaultBoard,
  engineSort,
  familiesOf,
  familyColumns,
  familyOf,
  leaderboardCsv,
  leaderboardQuery,
  leaderRows,
  modeWords,
  rankWithinTab,
  shrunkPatch,
  tabOf,
  tabsOf
} from '@/lib/stats/leaderboard'
import { rangeLabel, scopeLabel, seasonOf, type StatsScope } from '@/lib/stats/scope'
import { MOMENTS } from '@/lib/stats/splits'
import { useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import { seasonLabel } from '@shared/stats/seasons'
import type { Entity, LeaderboardBoard, MetricFamily, StatsView } from '@shared/stats/types'

/** Rows rendered at a time; "Show more" adds as many. */
const PAGE = 50

/** What opens a leaderboard: a board's "All →", a row, a saved view. The nonce re-applies it. */
export interface LeaderboardOpen {
  board: LeaderboardBoard
  selected: string | null
  nonce: number
}

/** A tab per position group or end of the floor, filters, column presets, saved views and CSV. */
export function StatsLeaderboard({
  entity,
  data,
  scope,
  onScope,
  open,
  views,
  onSaveView,
  onDeleteView,
  onOpenView,
  onOpenRow
}: {
  entity: Entity
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  open: LeaderboardOpen | null
  views: StatsView[]
  onSaveView: (name: string, board: LeaderboardBoard) => Promise<void>
  onDeleteView: (view: StatsView) => Promise<void>
  onOpenView: (view: StatsView) => void
  /** A name opens its dashboard. */
  onOpenRow?: (id: string) => void
}): React.JSX.Element {
  // The board on screen: the one opened (until the user changes it), else the default tab's.
  const [own, setOwn] = useState<{ nonce: number | null; board: LeaderboardBoard } | null>(null)
  const opened = open && open.board.entity === entity ? open : null
  const board =
    own && own.nonce === (opened?.nonce ?? null)
      ? own.board
      : (opened?.board ?? defaultBoard(entity, tabsOf(entity)[0].id, data.byId))
  const setBoard = (b: LeaderboardBoard): void => setOwn({ nonce: opened?.nonce ?? null, board: b })
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<{ nonce: number | null; id: string } | null>(null)
  const selected =
    picked && picked.nonce === (opened?.nonce ?? null) ? picked.id : (opened?.selected ?? null)
  const [limit, setLimit] = useState(PAGE)
  const [notice, setNotice] = useState<string | null>(null)

  const tab = tabOf(entity, board.tab)
  const query = useMemo(
    () =>
      data.byId.size > 0 && board.columns.length > 0
        ? leaderboardQuery(board, scope, data.byId)
        : null,
    [board, scope, data.byId]
  )
  const { result, loading, error } = useStatsQuery(query, data.version)
  const rows = useMemo(
    () => (result ? leaderRows(rankWithinTab(result, tab), board, search, opened?.selected) : []),
    [result, tab, board, search, opened?.selected]
  )
  // The selected row is on screen, however far down it ranks.
  const shown = Math.max(limit, rows.findIndex((r) => r.id === selected) + 1)
  const families = familiesOf(data.catalogue, tab)
  const preset = familyOf(board, data.catalogue, data.byId)
  const teams = seasonOf(data.seasons, scope.season)?.teams ?? []

  const update = (patch: Partial<LeaderboardBoard>): void => {
    const next = { ...board, ...patch }
    // The sorted column was removed: sort as the engine now does.
    if (next.sort.by !== 'name' && !next.columns.includes(next.sort.by)) {
      const { metric, dir } = engineSort(next, data.byId)
      next.sort = { by: metric, dir }
    }
    setBoard(next)
    setLimit(PAGE)
  }
  const sortBy = (by: string): void => {
    const dir =
      board.sort.by === by
        ? board.sort.dir === 'asc'
          ? 'desc'
          : 'asc'
        : by === 'name'
          ? 'asc'
          : bestFirst(data.byId.get(by))
    update({ sort: { by, dir } })
  }
  const switchTab = (id: string): void => {
    const next = defaultBoard(entity, id, data.byId)
    update({
      ...next,
      mode: board.mode,
      qualifiedOnly: board.qualifiedOnly,
      shrunk: board.shrunk ?? false,
      team: board.team,
      split: board.split ?? null
    })
  }
  const setFamily = (family: MetricFamily | 'default' | 'custom'): void => {
    if (family === 'custom') return
    if (family === 'default') {
      update({ columns: defaultBoard(entity, board.tab, data.byId).columns })
      return
    }
    const columns = familyColumns(data.catalogue, tab, family)
    const keep = columns.includes(board.sort.by)
    update({
      columns,
      sort: keep ? board.sort : { by: columns[0], dir: bestFirst(data.byId.get(columns[0])) }
    })
  }

  async function exportCsv(): Promise<void> {
    setNotice(null)
    try {
      const path = await api.stats.exportCsv(
        csvFileName(board, scope, rangeLabel(scope, entity)),
        leaderboardCsv(rows, board, data.byId)
      )
      if (path) setNotice(`Saved ${rows.length} rows to ${path}`)
    } catch (err) {
      setNotice(errorMessage(err))
    }
  }

  const title = `${seasonLabel(scope.season)} ${tab.title} leaderboard`
  const qualifyNote = tab.qualifier
    ? `Qualified: 1,000 minutes over 82 games, scaled to the games in range`
    : 'Every team qualifies'
  const sortLabel =
    board.sort.by === 'name' ? 'name' : (data.byId.get(board.sort.by)?.label ?? board.sort.by)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-8 pt-[22px] pb-4">
      <header className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-[7px]">
          <h1 className="m-0 truncate text-[26px] leading-[1.1] font-semibold tracking-[-0.025em] first-letter:uppercase">
            {title}
          </h1>
          <div className="text-[13px] text-fg-3">
            {scopeLabel(scope, entity)} · {qualifyNote}
            {board.shrunk ? ' · Shrunk rates (S) rank every row' : ''} · Shading is percentile
            within {entity === 'player' ? 'position' : 'the league'}
          </div>
        </div>
        <ScopeBar scope={scope} seasons={data.seasons} entity={entity} onChange={onScope} />
      </header>

      <div className="flex items-end justify-between gap-4 border-b border-line">
        <div role="tablist" className="flex gap-[22px]">
          {tabsOf(entity).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                'h-8 cursor-pointer text-[13.5px] leading-none',
                t.id === tab.id
                  ? 'font-semibold text-fg shadow-[inset_0_-2px_0_var(--fg)]'
                  : 'font-medium text-fg-3 hover:text-fg'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <StatsSelect
            title="Metric family"
            value={preset}
            options={[
              { value: 'default' as const, label: 'Columns: this tab' },
              ...families.map((f) => ({ value: f, label: `Columns: ${familyLabel(f)}` })),
              ...(preset === 'custom'
                ? [{ value: 'custom' as const, label: 'Columns: your own' }]
                : [])
            ]}
            onChange={setFamily}
          />
          <ColumnPicker
            tab={tab}
            catalogue={data.catalogue}
            columns={board.columns}
            onChange={(columns) => update({ columns })}
            onReset={() => update({ columns: defaultBoard(entity, board.tab, data.byId).columns })}
          />
          <ViewsMenu
            views={views}
            onOpen={onOpenView}
            onSave={(name) => onSaveView(name, board)}
            onDelete={onDeleteView}
          />
          <StatsButton
            title="Save this table as CSV"
            onClick={() => void exportCsv()}
            disabled={!rows.length}
          >
            <Download className="size-3.5" />
            CSV
          </StatsButton>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          label="Totals or rates"
          value={board.mode}
          options={BOARD_MODES}
          onChange={(mode) => update({ mode })}
        />
        <StatsSelect
          title="Moments of the game"
          value={board.split ?? ''}
          options={MOMENTS}
          onChange={(split) => update({ split: split || null })}
          className="w-[170px]"
        />
        {tab.qualifier && (
          <CheckToggle
            on={board.qualifiedOnly}
            onChange={(qualifiedOnly) => update({ qualifiedOnly })}
          >
            Qualified only
          </CheckToggle>
        )}
        <CheckToggle
          on={board.shrunk ?? false}
          onChange={(on) => update(shrunkPatch(on))}
          title="Each rate with a measured prior pulled toward the league by it, so a small sample can rank. Hover a value for its raw figure."
        >
          Shrunk rates
        </CheckToggle>
        {entity === 'player' && (
          <StatsSelect
            title="Team"
            value={board.team ?? ''}
            options={[
              { value: '', label: 'All teams' },
              ...teams.map((t) => ({ value: t.id, label: t.code }))
            ]}
            onChange={(t) => update({ team: t || null })}
            className="w-[110px]"
          />
        )}
        <label className="flex h-7 w-[180px] items-center gap-[7px] rounded-[7px] border border-line bg-panel px-2.5 text-fg-3">
          <Search className="size-3.5 shrink-0" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setLimit(PAGE)
            }}
            placeholder={entity === 'player' ? 'Player' : 'Team'}
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none"
          />
        </label>
      </div>

      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-auto rounded-[8px] border border-line bg-panel transition-opacity duration-150',
          loading && result && 'opacity-60'
        )}
      >
        {result && (
          <LeaderTable
            rows={rows.slice(0, shown)}
            board={board}
            tab={tab}
            columns={result.columns}
            byId={data.byId}
            selected={selected}
            onSelect={(id) => setPicked({ nonce: opened?.nonce ?? null, id })}
            onOpen={onOpenRow}
            onSort={sortBy}
          />
        )}
        {!result && loading && (
          <div className="py-16 text-center text-[13px] text-fg-3">Loading the table…</div>
        )}
        {error && <div className="py-16 text-center text-[13px] text-bad">{error}</div>}
        {result && !loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="text-[14px] font-medium text-fg-2">
              No {entity === 'player' ? 'players' : 'teams'} match.
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                update({ team: null, qualifiedOnly: false })
              }}
              className="h-7 cursor-pointer rounded-[6px] bg-cobalt px-3 text-[12.5px] font-semibold text-on-cobalt"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-start justify-between gap-4 text-[12px] text-fg-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-3">
            <span>
              <span className="font-semibold text-fg">{Math.min(shown, rows.length)}</span> of{' '}
              {rows.length} · sorted by {sortLabel} · {modeWords(board.mode)}
            </span>
            {rows.length > shown && (
              <button
                type="button"
                onClick={() => setLimit(shown + PAGE)}
                className="h-6 cursor-pointer rounded-[6px] border border-line bg-panel px-2 text-[12px] font-medium text-fg hover:bg-hover"
              >
                Show {Math.min(PAGE, rows.length - shown)} more
              </button>
            )}
          </div>
          {notice && <div className="truncate text-fg-2">{notice}</div>}
          {result?.notes.map((n) => (
            <div key={n} className="truncate">
              {n}
            </div>
          ))}
        </div>
        <HeatLegend />
      </footer>
    </div>
  )
}
