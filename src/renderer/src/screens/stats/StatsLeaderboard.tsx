import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { CategoryTabs, ViewChips } from '@/components/stats/CategoryBar'
import { ColumnPicker } from '@/components/stats/ColumnPicker'
import { CheckToggle, Segmented, StatsButton, StatsSelect } from '@/components/stats/controls'
import { HeatLegend, LeaderTable } from '@/components/stats/LeaderTable'
import { ScopeBar } from '@/components/stats/ScopeBar'
import { ViewsMenu } from '@/components/stats/ViewsMenu'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { useScreenState } from '@/lib/stats/session'
import {
  boardCategories,
  categoryViews,
  hasSides,
  parentOf,
  viewOf,
  type CategoryView
} from '@/lib/stats/categoryViews'
import {
  bestFirst,
  boardModes,
  csvFileName,
  defaultBoard,
  engineSort,
  leaderboardCsv,
  leaderboardQuery,
  boardRows,
  placesFor,
  unlistedByName,
  unlistedNote,
  type LeaderboardOpen,
  modeWords,
  rankWithinTab,
  shrunkPatch,
  tabOf,
  tabsOf
} from '@/lib/stats/leaderboard'
import { rangeLabel, scopeLabel, seasonOf, type StatsScope } from '@/lib/stats/scope'
import { momentsIn } from '@/lib/stats/splits'
import { useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import { currentLeague, seasonLabel } from '@/lib/stats/league'
import { favouritesEmpty, useFavourites } from '@/lib/stats/favourites'
import { leaderboardQualifier } from '@/lib/stats/qualifying'
import type { Entity, LeaderboardBoard, StatsView } from '@shared/stats/types'

/** Rows rendered at a time; "Show more" adds as many. */
const PAGE = 50

export type { LeaderboardOpen }

/**
 * A tab per category (D52) over the position groups or a team's side, a category's presets as chips,
 * the column picker, saved views and CSV.
 */
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
  const [own, setOwn] = useScreenState<{ nonce: number | null; board: LeaderboardBoard } | null>(
    entity === 'player' ? 'players' : 'teams',
    'board',
    null
  )
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
  // The favourites filter (T1601.3): the league's favourites at their rank on the whole board. Those
  // the board did not fetch (past its 1,000 rows) are placed by the engine (`placesFor`).
  const favourites = useFavourites()
  const favSet = entity === 'player' ? favourites.players : favourites.teams
  const placesQuery = useMemo(() => {
    const places = result && query ? placesFor(result, board, favSet, query.sort?.metric) : null
    return places && query ? { ...query, places } : null
  }, [result, query, board, favSet])
  const placed = useStatsQuery(placesQuery, data.version, { keepLast: false }).result
  const ranked = useMemo(() => {
    if (!result) return []
    const extras = placesQuery ? (placed?.rows ?? []) : []
    // One pool for the percentiles: the fetched rows, and the favourites placed past them.
    const merged = rankWithinTab({ ...result, rows: [...result.rows, ...extras] }, tab)
    return boardRows(
      { ...merged, rows: merged.rows.slice(0, result.rows.length) },
      board,
      search,
      opened?.selected ?? null,
      board.favourites ? favSet : null,
      merged.rows.slice(result.rows.length)
    )
  }, [result, placed, placesQuery, tab, board, search, opened?.selected, favSet])
  const unlisted = useMemo(
    () =>
      result && placesQuery
        ? unlistedNote(unlistedByName(result, board, favSet, placed?.rows ?? []))
        : null,
    [result, placesQuery, board, favSet, placed]
  )
  const rows = useMemo(() => ranked.map((x) => x.row), [ranked])
  const ranks = useMemo(() => ranked.map((x) => x.rank), [ranked])
  // The selected row is on screen, however far down it ranks.
  const shown = Math.max(limit, rows.findIndex((r) => r.id === selected) + 1)
  // The category tab: one the league has for this kind of row, else Overview (every view saved
  // before categories, and a category the league switched to lacks).
  const categories = boardCategories(data.catalogue, tab)
  const category = categories.some((c) => c.id === board.category) ? (board.category ?? '') : ''
  const presets = category ? categoryViews(data.catalogue, tab, category) : []
  const view = category ? viewOf(presets, board.view) : null
  const parent = view ? (parentOf(presets, view.key)?.key ?? null) : null
  const same = (ids: readonly string[]): boolean =>
    ids.length === board.columns.length && ids.every((id, i) => board.columns[i] === id)
  const custom = view
    ? !same(view.metrics)
    : !same(defaultBoard(entity, board.tab, data.byId).columns)
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
      favourites: board.favourites ?? false,
      team: board.team,
      split: board.split ?? null,
      category: '',
      view: ''
    })
  }
  /** A preset's columns, keeping the sort when its column stays, else best first by the first. */
  const showView = (
    v: CategoryView | null,
    patch: Partial<LeaderboardBoard> & { category: string }
  ): void => {
    if (!v) {
      switchTab(patch.tab ?? board.tab)
      return
    }
    const keep = v.metrics.includes(board.sort.by)
    update({
      ...patch,
      view: v.key,
      columns: v.metrics,
      sort: keep ? board.sort : { by: v.metrics[0], dir: bestFirst(data.byId.get(v.metrics[0])) }
    })
  }
  const pickCategory = (id: string): void => {
    if (!id) {
      switchTab(board.tab)
      return
    }
    showView(viewOf(categoryViews(data.catalogue, tab, id), undefined), { category: id })
  }
  const pickView = (key: string): void => showView(viewOf(presets, key), { category })
  /** A position keeps the columns; a team's side shows the same preset from the other side. */
  const pickTab = (id: string): void => {
    if (entity === 'player') {
      update({ tab: id })
      return
    }
    if (!category) {
      switchTab(id)
      return
    }
    const next = categoryViews(data.catalogue, tabOf(entity, id), category)
    // A side with nothing in the category keeps the columns and says so under the tabs.
    if (next.length === 0) update({ tab: id })
    else showView(viewOf(next, view?.key), { category, tab: id })
  }

  async function exportCsv(): Promise<void> {
    setNotice(null)
    try {
      const path = await api.stats.exportCsv(
        csvFileName(board, scope, rangeLabel(scope, entity)),
        leaderboardCsv(rows, board, data.byId, ranks)
      )
      if (path) setNotice(`Saved ${rows.length} rows to ${path}`)
    } catch (err) {
      setNotice(errorMessage(err))
    }
  }

  const title = `${seasonLabel(scope.season)} ${tab.title} leaderboard`
  const qualifyNote = tab.qualifier ? leaderboardQualifier() : 'Every team qualifies'
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

      <div className="flex flex-col gap-2.5">
        <div className="border-b border-line">
          <CategoryTabs categories={categories} value={category} onChange={pickCategory} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {(entity === 'player' || !category || hasSides(tab, category)) && (
              <Segmented
                label={entity === 'player' ? 'Position' : 'Team or opponents'}
                value={tab.id}
                options={tabsOf(entity).map((t) => ({
                  value: t.id,
                  // A team's category reads its own columns or its opponents'; Overview keeps the
                  // ends it always had.
                  label:
                    entity === 'team' && category
                      ? t.id === 'offense'
                        ? 'Team'
                        : 'Opponents'
                      : t.label
                }))}
                onChange={pickTab}
              />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* T1701's Filters control sits here, first of the board's tools (D51). */}
            <ColumnPicker
              tab={tab}
              catalogue={data.catalogue}
              columns={board.columns}
              onChange={(columns) => update({ columns })}
              onReset={() =>
                update({
                  columns: view ? view.metrics : defaultBoard(entity, board.tab, data.byId).columns
                })
              }
              category={category}
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
        {category && presets.length === 0 && (
          <div className="text-[12.5px] text-fg-3" data-view-empty="">
            No {tab.id === 'defense' ? "opponents'" : "team's own"} metrics in{' '}
            {categories.find((c) => c.id === category)?.label}.
          </div>
        )}
        <ViewChips
          views={presets}
          active={view?.key ?? null}
          parent={parent}
          custom={custom}
          onPick={pickView}
        />
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          label="Totals or rates"
          value={board.mode}
          options={boardModes()}
          onChange={(mode) => update({ mode })}
        />
        <StatsSelect
          title="Moments of the game"
          value={board.split ?? ''}
          options={momentsIn()}
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
        <CheckToggle
          on={board.favourites ?? false}
          onChange={(on) => update({ favourites: on })}
          title="Only your favourites, each at its rank on the whole board"
        >
          Favourites
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
            ranks={ranks.slice(0, shown)}
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
        {result && !loading && rows.length === 0 && board.favourites && (
          <div className="py-16 text-center text-[13px] text-fg-3">
            {favouritesEmpty(
              currentLeague().name,
              entity,
              favSet.size,
              favourites.players.size + favourites.teams.size,
              search
            )}
          </div>
        )}
        {result && !loading && rows.length === 0 && !board.favourites && (
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
          {unlisted && (
            <div className="truncate text-fg-2" data-unlisted="">
              {unlisted}
            </div>
          )}
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
