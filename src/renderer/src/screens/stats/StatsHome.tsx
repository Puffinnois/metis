import { useState } from 'react'
import { Segmented } from '@/components/stats/controls'
import { ScopeBar } from '@/components/stats/ScopeBar'
import {
  BOARD_ROWS,
  BOARDS,
  boardQuery,
  boardView,
  type BoardDef,
  type BoardRow
} from '@/lib/stats/boards'
import { scopeLabel, type StatsScope } from '@/lib/stats/scope'
import { useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import type { StatsView } from '@shared/stats/types'

function Bar({ fraction, lead }: { fraction: number; lead: boolean }): React.JSX.Element {
  return (
    <div className="h-[3px] overflow-hidden rounded-[2px] bg-line-2">
      <div
        className={cn('h-full rounded-[2px]', lead ? 'bg-cobalt' : 'bg-fg-3 opacity-50')}
        style={{ width: `${Math.max(3, fraction * 100)}%` }}
      />
    </div>
  )
}

function Row({ row, onOpen }: { row: BoardRow; onOpen: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid h-[38px] w-full cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2.5 pr-3.5 pl-2.5 text-left hover:bg-hover"
    >
      <span
        className={cn(
          'text-right',
          row.lead
            ? 'font-cond text-[18px] leading-none font-extrabold text-cobalt'
            : 'font-mono text-[11.5px] leading-none text-fg-3'
        )}
      >
        {row.rank}
      </span>
      <div className="flex min-w-0 flex-col gap-[5px]">
        <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="truncate text-[13px] leading-[1.1] font-medium">{row.name}</span>
          {row.team && row.team !== row.name && (
            <span className="shrink-0 font-mono text-[10.5px] leading-none text-fg-3">
              {row.team}
            </span>
          )}
        </div>
        <Bar fraction={row.fraction} lead={row.lead} />
      </div>
      <span
        className={cn(
          'font-mono text-[12.5px] leading-none',
          row.lead ? 'font-semibold text-fg' : 'text-fg-2'
        )}
      >
        {row.value}
      </span>
    </button>
  )
}

function Board({
  board,
  data,
  scope,
  perGame,
  onOpen
}: {
  board: BoardDef
  data: StatsData
  scope: StatsScope
  perGame: boolean
  onOpen: (board: BoardDef, rowId: string | null) => void
}): React.JSX.Element {
  const info = data.byId.get(board.metric)
  const { result, loading, error } = useStatsQuery(
    info ? boardQuery(board, scope, perGame) : null,
    data.version
  )
  const view = result && info ? boardView(result, info, perGame) : null
  return (
    <section className="flex min-w-0 flex-col rounded-[10px] bg-panel shadow-[0_0_0_1px_var(--line)]">
      <div className="flex h-11 items-center justify-between gap-2 border-b border-line-2 pr-2.5 pl-3.5">
        <div className="flex min-w-0 items-baseline gap-[7px] overflow-hidden whitespace-nowrap">
          {board.entity === 'team' && (
            <span className="font-mono text-[11.5px] leading-none font-semibold text-fg-3">
              Teams
            </span>
          )}
          <span
            className="truncate text-[13.5px] leading-none font-semibold tracking-[-0.01em]"
            title={info?.description}
          >
            {board.title}
          </span>
          {view?.sub && (
            <span className="font-mono text-[11px] leading-none text-fg-3">{view.sub}</span>
          )}
        </div>
        <button
          type="button"
          title="Open the full board"
          aria-label={`Open the full ${board.title} board`}
          onClick={() => onOpen(board, null)}
          className="h-6 shrink-0 cursor-pointer rounded-[5px] px-[7px] text-[11.5px] font-medium text-fg-3 hover:bg-hover hover:text-cobalt"
        >
          All →
        </button>
      </div>
      <div
        className={cn(
          'flex flex-col pt-1 pb-1.5 transition-opacity duration-150',
          loading && view && 'opacity-60'
        )}
      >
        {error ? (
          <div className="px-3.5 py-6 text-center text-[12.5px] text-bad">{error}</div>
        ) : !view ? (
          Array.from({ length: BOARD_ROWS }, (_, i) => (
            <div key={i} className="flex h-[38px] items-center px-3.5">
              <div className="h-2.5 w-full animate-pulse rounded bg-panel-2" />
            </div>
          ))
        ) : view.rows.length === 0 ? (
          <div className="px-3.5 py-6 text-center text-[12.5px] text-fg-3">Nobody qualifies</div>
        ) : (
          view.rows.map((r) => <Row key={r.id} row={r} onOpen={() => onOpen(board, r.id)} />)
        )}
      </div>
    </section>
  )
}

/** The home: eight boards, top six each. A board's "All →" or a row opens the full leaderboard. */
export function StatsHome({
  data,
  scope,
  onScope,
  views,
  onOpenBoard,
  onOpenView
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  views: StatsView[]
  onOpenBoard: (board: BoardDef, rowId: string | null, perGame: boolean) => void
  onOpenView: (view: StatsView) => void
}): React.JSX.Element {
  const [perGame, setPerGame] = useState(true)
  return (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-7">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] leading-none font-bold tracking-[-0.03em]">
            Leaderboards
          </h1>
          <div className="text-[13px] text-fg-2">
            {scopeLabel(scope)}
            {perGame && (
              <span className="text-fg-3"> · Per game: 70 % of the games to qualify</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScopeBar scope={scope} seasons={data.seasons} onChange={onScope} />
          <Segmented
            label="Totals or per game"
            value={perGame ? 'per' : 'tot'}
            options={[
              { value: 'per', label: 'Per game' },
              { value: 'tot', label: 'Totals' }
            ]}
            onChange={(v) => setPerGame(v === 'per')}
          />
        </div>
      </header>
      {views.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
          <span>Saved views</span>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onOpenView(v)}
              className="h-6 cursor-pointer rounded-[5px] bg-panel px-2 text-[12px] font-medium text-fg shadow-[0_0_0_1px_var(--line)] hover:text-cobalt"
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        {BOARDS.map((b) => (
          <Board
            key={b.key}
            board={b}
            data={data}
            scope={scope}
            perGame={perGame}
            onOpen={(board, rowId) => onOpenBoard(board, rowId, perGame)}
          />
        ))}
      </div>
    </div>
  )
}
