import { useEffect, useRef } from 'react'
import { MetricHover, StabilityMark } from '@/components/stats/MetricCard'
import { cellTitle, fmtStat, heatOf, type Heat } from '@/lib/stats/format'
import { columnGroups, qualifies, type TabDef } from '@/lib/stats/leaderboard'
import { rawLine } from '@/lib/stats/stability'
import { cn } from '@/lib/utils'
import type { LeaderboardBoard, MetricInfo, StatsResultColumn, StatsRow } from '@shared/stats/types'

const HEAT: Record<Heat, string> = {
  h3: 'bg-h3 font-semibold',
  h2: 'bg-h2',
  h1: 'bg-h1',
  n: '',
  l1: 'bg-l1',
  l2: 'bg-l2',
  l3: 'bg-l3 font-semibold'
}

/** The percentile legend, under the table. */
export function HeatLegend(): React.JSX.Element {
  const steps: [Heat, string][] = [
    ['l3', '≤10'],
    ['l2', '25'],
    ['l1', '40'],
    ['n', '50'],
    ['h1', '60'],
    ['h2', '75'],
    ['h3', '≥90']
  ]
  return (
    <div className="flex items-center gap-2">
      <span>Percentile</span>
      <div className="flex font-mono text-[10.5px] leading-none font-medium text-fg">
        {steps.map(([h, label]) => (
          <span
            key={h}
            className={cn(
              'w-[30px] py-1 text-center',
              HEAT[h],
              h === 'n' && 'shadow-[inset_0_0_0_1px_var(--line)]'
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

const arrow = (dir: 'asc' | 'desc'): string => (dir === 'asc' ? '▲' : '▼')

/**
 * The leaderboard table: a sticky header in two rows (groups, labels) and a sticky identity column;
 * each value shaded by its percentile within the position, its hover saying the rank and sample; rows
 * below the qualifying sample greyed and marked NQ.
 */
export function LeaderTable({
  rows,
  board,
  tab,
  columns,
  byId,
  selected,
  onSelect,
  onOpen,
  onSort
}: {
  rows: StatsRow[]
  board: LeaderboardBoard
  tab: TabDef
  /** The result's columns: why a metric has nothing in this scope, if it has not. */
  columns: StatsResultColumn[]
  byId: ReadonlyMap<string, MetricInfo>
  selected: string | null
  onSelect: (id: string) => void
  /** A name opens its dashboard. */
  onOpen?: (id: string) => void
  onSort: (by: string) => void
}): React.JSX.Element {
  const player = board.entity === 'player'
  const groups = columnGroups(board.columns, tab, byId)
  const resultCol = new Map(columns.map((c) => [c.id, c]))
  // A shrunk column ranks every row with a sample, the ones below the qualifier too.
  const shrunkCol = new Set(columns.filter((c) => c.shrunk).map((c) => c.id))
  const selectedRef = useRef<HTMLTableRowElement | null>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'center' })
  }, [selected])

  const nameSorted = board.sort.by === 'name'
  return (
    <table className="min-w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-[4] h-6 bg-panel" />
          <th className="sticky top-0 z-[3] h-6 bg-panel" />
          {groups.map((g, i) => (
            <th
              key={`${g.label}-${i}`}
              colSpan={g.span}
              className="sticky top-0 z-[3] h-6 bg-panel px-2 pb-[5px] text-left align-bottom text-[11px] leading-none font-medium tracking-[0.06em] whitespace-nowrap text-fg-3 uppercase shadow-[inset_1px_0_0_var(--line)]"
            >
              {g.label}
            </th>
          ))}
          <th className="sticky top-0 z-[2] w-full bg-panel" />
        </tr>
        <tr>
          <th className="sticky top-6 left-0 z-[4] h-7 border-b border-fg-3 bg-panel p-0 align-middle">
            <div
              className={cn(
                'grid items-center gap-x-2 pr-2.5 pl-3 text-left font-mono text-[11px] leading-none font-medium text-fg-3',
                player
                  ? 'w-[300px] grid-cols-[34px_minmax(0,1fr)_42px_28px]'
                  : 'w-[240px] grid-cols-[34px_minmax(0,1fr)]'
              )}
            >
              <span>#</span>
              <button
                type="button"
                onClick={() => onSort('name')}
                className={cn(
                  'cursor-pointer justify-self-start uppercase',
                  nameSorted ? 'font-semibold text-fg' : 'hover:text-fg'
                )}
              >
                {player ? 'Player' : 'Team'} {nameSorted && arrow(board.sort.dir)}
              </button>
              {player && <span>TEAM</span>}
              {player && <span>POS</span>}
            </div>
          </th>
          <th
            title="Games played"
            className="sticky top-6 z-[2] h-7 border-b border-fg-3 bg-panel px-2 text-right align-middle font-mono text-[11px] leading-none font-medium text-fg-2"
          >
            G
          </th>
          {board.columns.map((id) => {
            const info = byId.get(id)
            const on = board.sort.by === id
            const missing = resultCol.get(id)?.reason ?? null
            const label = info?.short ?? id
            const head = (
              <th
                key={id}
                aria-sort={on ? (board.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                onClick={() => onSort(id)}
                className={cn(
                  'sticky top-6 z-[2] h-7 cursor-pointer border-b border-fg-3 px-2 text-right align-middle font-mono text-[11px] leading-none whitespace-nowrap',
                  on
                    ? 'bg-cobalt-soft font-semibold text-cobalt'
                    : 'bg-panel font-medium text-fg-2 hover:text-fg',
                  missing && !on && 'text-fg-3 opacity-60'
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  {shrunkCol.has(id) && (
                    <span
                      title="Shrunk toward the league by its prior"
                      data-shrunk="true"
                      className="rounded-[3px] bg-cobalt-soft px-[3px] py-[1px] text-[9px] leading-none font-semibold text-cobalt"
                    >
                      <span aria-hidden="true">S</span>
                      <span className="sr-only">shrunk</span>
                    </span>
                  )}
                  {info && <StabilityMark info={info} />}
                  {on && <span className="text-[8px]">{arrow(board.sort.dir)}</span>}
                </span>
              </th>
            )
            return info ? (
              <MetricHover key={id} info={info} missing={missing}>
                {head}
              </MetricHover>
            ) : (
              head
            )
          })}
          <th className="sticky top-6 z-[2] w-full border-b border-fg-3 bg-panel" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const ok = qualifies(r, tab)
          const isSel = r.id === selected
          return (
            <tr
              key={r.id}
              ref={isSel ? selectedRef : undefined}
              aria-selected={isSel}
              onClick={() => onSelect(r.id)}
              className={cn('cursor-default', isSel ? 'bg-sel' : 'bg-panel hover:bg-hover')}
            >
              <td className="sticky left-0 z-[1] h-[30px] border-b border-line-2 bg-inherit p-0 align-middle">
                <div
                  className={cn(
                    'grid items-center gap-x-2 pr-2.5 pl-3',
                    player
                      ? 'w-[300px] grid-cols-[34px_minmax(0,1fr)_42px_28px]'
                      : 'w-[240px] grid-cols-[34px_minmax(0,1fr)]'
                  )}
                >
                  <span className="font-mono text-[12px] leading-none text-fg-3">{i + 1}</span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {onOpen ? (
                      <button
                        type="button"
                        title={`Open ${r.name}’s dashboard`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpen(r.id)
                        }}
                        className="cursor-pointer truncate text-left text-[13px] leading-[1.1] font-medium hover:text-cobalt"
                      >
                        {r.name}
                      </button>
                    ) : (
                      <span className="truncate text-[13px] leading-[1.1] font-medium">
                        {r.name}
                      </span>
                    )}
                    {!ok && (
                      <span
                        title="Below the qualifying sample"
                        className="shrink-0 font-mono text-[10px] leading-none font-medium text-fg-3"
                      >
                        NQ
                      </span>
                    )}
                  </div>
                  {player && (
                    <span className="font-mono text-[12px] leading-none text-fg-2">{r.team}</span>
                  )}
                  {player && (
                    <span className="font-mono text-[11.5px] leading-none font-semibold text-fg-2">
                      {r.position}
                    </span>
                  )}
                </div>
              </td>
              <td className="border-b border-line-2 px-2 text-right font-mono text-[12.5px] leading-[30px] text-fg-2">
                {r.games}
              </td>
              {board.columns.map((id) => {
                const v = r.values[id]
                const info = byId.get(id)
                if (!v || !info) {
                  return (
                    <td key={id} className="border-b border-line-2 px-2 text-right text-fg-3">
                      —
                    </td>
                  )
                }
                const shrunk = shrunkCol.has(id)
                const ranked = shrunk || (ok && v.qualified)
                const heat = ranked ? heatOf(v.percentile, info.direction) : 'n'
                const reason = resultCol.get(id)?.reason
                const raw = shrunk ? rawLine(v, info) : null
                const title = reason ?? cellTitle(v, info, player ? r.position : null)
                return (
                  <td
                    key={id}
                    title={raw ? `${raw}\n${title}` : title}
                    className="border-b border-line-2 p-0 text-right align-middle font-mono text-[12.5px] leading-[30px] whitespace-nowrap"
                  >
                    <div
                      className={cn(
                        'px-2',
                        HEAT[heat],
                        ((!ok && !shrunk) || v.value === null) && 'text-fg-3'
                      )}
                    >
                      {fmtStat(v.value, info, board.mode)}
                    </div>
                  </td>
                )
              })}
              <td className="border-b border-line-2" />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
