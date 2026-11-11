import { useMemo } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { CheckToggle, Segmented, StatsSelect } from '@/components/stats/controls'
import { Loading, Notes } from '@/components/stats/parts'
import { PctChip, PickSwatch, Scatter, type DotCard } from '@/components/stats/Scatter'
import {
  axisLabel,
  CATEGORIES,
  categoryColour,
  chartAxes,
  chartExtras,
  chartMetrics,
  chartQuery,
  chartRows,
  chartSubtitle,
  chartTab,
  chartTitle,
  chartValue,
  chartView,
  compareSubjects,
  CONFERENCE_COLOUR,
  corners,
  fewNote,
  isCategory,
  MAX_PICKS,
  POSITION_COLOUR,
  PRESETS,
  resetChart,
  scaled,
  scales,
  shortName,
  whoWords,
  type ChartDot,
  type ChartState,
  type ChartView
} from '@/lib/stats/chart'
import { DASHBOARD_MODES } from '@/lib/stats/dashboard'
import type { ExploreSubject } from '@/lib/stats/explore'
import { heatColor } from '@/lib/stats/format'
import { RAIL_POSITIONS } from '@/lib/stats/player'
import { seasonOf, type StatsScope } from '@/lib/stats/scope'
import { useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import type { MetricInfo } from '@shared/stats/types'

export interface ChartProps {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  state: ChartState
  onState: (update: (state: ChartState) => ChartState) => void
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
  /** The points picked on the chart, opened in Compare. */
  onCompare: (subjects: ExploreSubject[]) => void
}

const FRESH = { keepLast: false }
const LABEL = 'font-mono text-[11px] tracking-[0.04em] text-fg-3 uppercase'
const POSITION_LABELS: Record<string, string> = { ALL: 'All', G: 'G', F: 'F', C: 'C' }
const CATEGORY_WORDS: Record<string, string> = { G: 'Guard', F: 'Forward', C: 'Center' }

/**
 * Any metric against any other for the players at a position or the teams, in the scope bar's
 * scope: presets, size and colour, filters, a scatter and its table. A dot opens its dashboard;
 * shift-click picks up to three for Compare.
 */
export function StatsChart({
  data,
  scope,
  onScope,
  state,
  onState,
  onOpenPlayer,
  onOpenTeam,
  onCompare
}: ChartProps): React.JSX.Element {
  const { entity, position, mode } = state
  const isPlayer = entity === 'player'
  const axes = chartAxes(state)
  const extras = chartExtras(state, axes)
  const info = (id: string): MetricInfo | undefined => data.byId.get(id)
  const X = info(axes.x)
  const Y = info(axes.y)
  const q = useMemo(
    () => chartQuery({ entity, position, mode }, [axes.x, axes.y, ...extras], scope),
    // The metrics' text keys the query: a new array each render runs nothing again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, position, mode, axes.x, axes.y, extras.join(), scope]
  )
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  const teams = useMemo(
    () => seasonOf(data.seasons, scope.season)?.teams ?? [],
    [data.seasons, scope.season]
  )
  const view = useMemo(
    () => (result ? chartView(result, state, data.byId, teams) : null),
    [result, state, data.byId, teams]
  )
  const groups = useMemo(() => chartMetrics(data.catalogue, entity), [data.catalogue, entity])

  const set = (next: Partial<ChartState>): void => onState((s) => ({ ...s, ...next }))
  const reset = (next: Partial<ChartState>): void => onState((s) => resetChart(s, next))
  const who = whoWords(state)
  const fmt = (id: string) => (v: number | null) => chartValue(info(id), v, mode)
  const open = (d: ChartDot): void => (isPlayer ? onOpenPlayer(d.id) : onOpenTeam(d.id))
  // The picks still plotted: a pick that left the chart is neither shown nor compared.
  const picks = view?.kind === 'ready' ? view.picks : []
  const live = picks.map((p) => p.id)
  // Gone as of this render; a pick made since (two quick clicks) is kept.
  const gone = view?.kind === 'ready' ? state.picks.filter((id) => !live.includes(id)) : []
  const pick = (d: ChartDot): void =>
    onState((s) => {
      if (s.picks.includes(d.id)) return { ...s, picks: s.picks.filter((id) => id !== d.id) }
      const kept = s.picks.filter((id) => !gone.includes(id))
      return kept.length < MAX_PICKS ? { ...s, picks: [...kept, d.id] } : s
    })

  const tab = chartTab(state)
  const qualifier = tab.qualifier ? info(tab.qualifier)?.sampleLabel : null
  const footnote = isPlayer
    ? `Qualified: enough ${qualifier ?? 'minutes'} for the games in scope, as on the leaderboards, and each axis’s own sample.`
    : 'Qualified: each axis’s own sample; every team plays enough.'
  const wholeSeason = scope.range.kind === 'season'
  const useSeason = (): void => onScope({ ...scope, range: { kind: 'season' } })
  const category = isPlayer ? POSITION_COLOUR : CONFERENCE_COLOUR

  const metricOptions = (only?: (m: MetricInfo) => boolean): React.JSX.Element[] =>
    groups.map((g) => (
      <optgroup key={g.family} label={g.label}>
        {g.metrics
          .filter((m) => !only || only(m))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {axisLabel(m, m.id)}
            </option>
          ))}
      </optgroup>
    ))
  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    children: React.ReactNode
  ): React.JSX.Element => (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full min-w-0 cursor-pointer rounded-[6px] border border-line bg-panel px-1.5 text-[12.5px] text-fg"
    >
      {children}
    </select>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3.5">
        <Segmented
          label="Players or teams"
          value={entity}
          options={[
            { value: 'player', label: 'Players' },
            { value: 'team', label: 'Teams' }
          ]}
          onChange={(e) => reset({ entity: e })}
        />
        {isPlayer && (
          <Segmented
            label="Position"
            value={position}
            options={RAIL_POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS[p] }))}
            onChange={(p) => set({ position: p, picks: [] })}
          />
        )}
        <Segmented
          label="Totals or per game"
          value={mode}
          options={DASHBOARD_MODES}
          onChange={(m) => set({ mode: m })}
        />
      </div>
      <div className="flex min-w-0 gap-6">
        <aside className="flex w-[280px] shrink-0 flex-col gap-5 border-r border-line pr-5">
          <section className="flex flex-col gap-2">
            <span className={LABEL}>Presets</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS[entity].map((p) => {
                const on = p.x === axes.x && p.y === axes.y
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ x: p.x, y: p.y, picks: [] })}
                    className={cn(
                      'h-[26px] cursor-pointer rounded-[13px] px-3 text-[12px] font-medium',
                      on
                        ? 'bg-cobalt-soft text-cobalt shadow-[inset_0_0_0_1px_var(--cobalt)]'
                        : 'text-fg-2 shadow-[inset_0_0_0_1px_var(--line)] hover:text-fg'
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <span className={LABEL}>Axes</span>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="flex items-center gap-2 text-[12px] text-fg-2">
                  <span className="w-3 font-mono text-fg-3">Y</span>
                  {select('Y axis', axes.y, (y) => set({ x: axes.x, y }), metricOptions())}
                </label>
                <label className="flex items-center gap-2 text-[12px] text-fg-2">
                  <span className="w-3 font-mono text-fg-3">X</span>
                  {select('X axis', axes.x, (x) => set({ x, y: axes.y }), metricOptions())}
                </label>
              </div>
              <button
                type="button"
                title="Swap the axes"
                aria-label="Swap the axes"
                onClick={() => set({ x: axes.y, y: axes.x })}
                className="flex h-[68px] w-[30px] cursor-pointer items-center justify-center rounded-[6px] border border-line bg-panel text-fg-2 hover:bg-hover hover:text-fg"
              >
                <ArrowUpDown className="size-3.5" />
              </button>
            </div>
          </section>
          <section className="grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>Size by</span>
              {select(
                'Size by',
                state.size ?? '',
                (v) => set({ size: v || null }),
                <>
                  <option value="">None</option>
                  {metricOptions((m) => scaled([m]).length > 0)}
                </>
              )}
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>Colour by</span>
              {select(
                'Colour by',
                state.colour ?? '',
                (v) => set({ colour: v || null }),
                <>
                  <option value="">None</option>
                  <option value={category}>{isPlayer ? 'Position' : 'Conference'}</option>
                  {metricOptions((m) => scaled([m]).length > 0)}
                </>
              )}
            </label>
            {state.colour && <ColourKey colour={state.colour} />}
          </section>
          <section className="flex flex-col gap-2">
            <span className={LABEL}>Filter</span>
            <StatsSelect
              title="Team"
              value={state.team ?? ''}
              options={[
                { value: '', label: 'All teams' },
                ...[...teams]
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((t) => ({ value: isPlayer ? t.code : t.id, label: `${t.code} · ${t.name}` }))
              ]}
              onChange={(t) => set({ team: t || null })}
              className="w-full"
            />
            <div className="flex flex-wrap gap-1.5">
              <CheckToggle
                on={state.qualifiedOnly}
                onChange={(qualifiedOnly) => set({ qualifiedOnly })}
              >
                Qualified only
              </CheckToggle>
            </div>
            <label className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line bg-panel px-2 text-fg-3">
              <Search className="size-3.5 shrink-0" />
              <input
                type="search"
                aria-label={isPlayer ? 'Find a player' : 'Find a team'}
                placeholder={isPlayer ? 'Find a player' : 'Find a team'}
                value={state.search}
                onChange={(e) => set({ search: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg-3"
              />
            </label>
          </section>
          <p className="m-0 text-[11.5px] leading-[1.45] text-pretty text-fg-3">
            {footnote}
            {view?.kind === 'ready' && ` ${view.qualified} ${who} qualify on both axes.`}
          </p>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="m-0 text-[22px] leading-tight font-bold tracking-[-0.02em]">
                {chartTitle(X, axes.x, Y, axes.y)}
              </h1>
              <span className="text-[12.5px] text-fg-2">{chartSubtitle(state, scope)}</span>
            </div>
            <Picks
              entity={entity}
              picks={picks}
              onClear={() => set({ picks: [] })}
              onCompare={() => onCompare(compareSubjects(entity, live))}
            />
          </div>
          {error ? (
            <Loading error={error} />
          ) : !view ? (
            <Loading />
          ) : view.kind === 'missing' ? (
            <Empty title={view.text}>
              {!wholeSeason && (
                <EmptyButton primary onClick={useSeason}>
                  Use the whole season
                </EmptyButton>
              )}
            </Empty>
          ) : view.kind === 'few' ? (
            <Empty title="Too few qualifiers to chart">
              <p className="m-0 max-w-[560px] text-[12.5px] text-fg-2">
                {fewNote(view.qualified, state, scope)}
              </p>
              <div className="flex gap-2">
                {!wholeSeason && (
                  <EmptyButton primary onClick={useSeason}>
                    Use the whole season
                  </EmptyButton>
                )}
                {state.qualifiedOnly && view.all > view.qualified && (
                  <EmptyButton onClick={() => set({ qualifiedOnly: false })}>
                    Show all {view.all} {who}
                  </EmptyButton>
                )}
              </div>
            </Empty>
          ) : (
            <Ready
              state={state}
              view={view}
              axes={axes}
              extras={extras}
              info={info}
              fmt={fmt}
              who={who}
              notes={result?.notes ?? []}
              onSort={(by) =>
                set({
                  sort: { by, dir: state.sort.by === by ? (state.sort.dir === 1 ? -1 : 1) : 1 }
                })
              }
              onOpen={open}
              onPick={pick}
            />
          )}
        </section>
      </div>
    </div>
  )
}

/** A metric's colour scale, or the category's key. */
function ColourKey({ colour }: { colour: string }): React.JSX.Element {
  if (isCategory(colour)) {
    return (
      <div className="col-span-2 flex flex-wrap gap-3 text-[11.5px] text-fg-2" data-key="">
        {[...CATEGORIES[colour], null].map((c) => (
          <span key={c ?? 'none'} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: categoryColour(colour, c) }}
            />
            {c === null ? 'Not listed' : (CATEGORY_WORDS[c] ?? c)}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="col-span-2 flex flex-col gap-1">
      <span
        className="h-1.5 rounded-[3px]"
        style={{
          background: `linear-gradient(90deg, ${heatColor(0, false)}, ${heatColor(0.5, false)}, ${heatColor(1, false)})`
        }}
      />
      <span className="flex justify-between font-mono text-[10.5px] text-fg-3">
        <span>0</span>
        <span>50th</span>
        <span>100</span>
      </span>
    </div>
  )
}

function Picks({
  entity,
  picks,
  onClear,
  onCompare
}: {
  entity: ChartState['entity']
  picks: { id: string; name: string }[]
  onClear: () => void
  onCompare: () => void
}): React.JSX.Element {
  if (!picks.length) {
    return (
      <span className="text-[12px] text-fg-3">
        Click a dot to open the dashboard · Shift-click up to {MAX_PICKS} to compare
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {picks.map((p, k) => (
        <span key={p.id} className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
          <PickSwatch slot={k} />
          {entity === 'team' ? p.name : shortName(entity, p)}
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="h-7 cursor-pointer rounded-[6px] px-2 text-[12.5px] text-fg-2 hover:bg-hover hover:text-fg"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onCompare}
        className="h-7 cursor-pointer rounded-[6px] bg-cobalt px-3 text-[12.5px] font-semibold text-on-cobalt hover:opacity-90"
      >
        Compare these →
      </button>
    </div>
  )
}

function Empty({
  title,
  children
}: {
  title: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-line px-6 text-center"
    >
      <span className="text-[15px] font-semibold text-fg">{title}</span>
      {children}
    </div>
  )
}

function EmptyButton({
  primary = false,
  onClick,
  children
}: {
  primary?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 cursor-pointer rounded-[6px] px-3 text-[12.5px] font-semibold',
        primary
          ? 'bg-cobalt text-on-cobalt hover:opacity-90'
          : 'border border-line bg-panel text-fg hover:bg-hover'
      )}
    >
      {children}
    </button>
  )
}

function Ready({
  state,
  view,
  axes,
  extras,
  info,
  fmt,
  who,
  notes,
  onSort,
  onOpen,
  onPick
}: {
  state: ChartState
  view: Extract<ChartView, { kind: 'ready' }>
  axes: { x: string; y: string }
  extras: string[]
  info: (id: string) => MetricInfo | undefined
  fmt: (id: string) => (v: number | null) => string
  who: string
  notes: string[]
  onSort: (by: string) => void
  onOpen: (d: ChartDot) => void
  onPick: (d: ChartDot) => void
}): React.JSX.Element {
  const { entity } = state
  const isPlayer = entity === 'player'
  const X = info(axes.x)
  const Y = info(axes.y)
  const s = scales(view.domain, { x: X?.direction === 'lower', y: Y?.direction === 'lower' })
  const metrics = [axes.x, axes.y, ...extras]
  const card = (d: ChartDot): DotCard => ({
    title: d.name,
    sub: isPlayer ? `${d.team ?? '—'} · ${d.position ?? '—'}` : `${d.team ?? d.id}`,
    lines: metrics.map((m) => ({
      label: info(m)?.label ?? m,
      text: fmt(m)(d.values[m] ?? null),
      chip: <PctChip percentile={d.percentiles[m] ?? null} qualified={d.qualified} />
    })),
    sample: `${d.games} G${d.sample !== null ? ` · ${Math.round(d.sample).toLocaleString('en-US')} ${Y?.sampleLabel ?? ''}` : ''}`
  })
  const rows = chartRows(view.dots, state.sort, axes)
  const cols: { by: string; label: string }[] = [
    { by: 'x', label: X?.label ?? axes.x },
    { by: 'y', label: Y?.label ?? axes.y },
    ...extras.map((m) => ({ by: m, label: info(m)?.label ?? m }))
  ]
  const arrow = (by: string): string =>
    state.sort.by === by ? (state.sort.dir === 1 ? ' ↓' : ' ↑') : ''
  const r = view.r === null ? '—' : `${view.r >= 0 ? '+' : '−'}${Math.abs(view.r).toFixed(2)}`
  const grid = cn(
    'grid items-center gap-3',
    isPlayer
      ? 'grid-cols-[32px_minmax(160px,1.6fr)_48px_repeat(var(--n),minmax(0,1fr))]'
      : 'grid-cols-[32px_minmax(160px,1.6fr)_repeat(var(--n),minmax(0,1fr))]'
  )
  const style = { '--n': cols.length } as React.CSSProperties
  return (
    <>
      <div className="rounded-[10px] bg-panel px-2 pt-3 pb-1 shadow-[0_0_0_1px_var(--line)]">
        <Scatter
          entity={entity}
          dots={view.dots}
          scales={s}
          mean={view.mean}
          corners={corners(X, axes.x, Y, axes.y)}
          xLabel={axisLabel(X, axes.x)}
          yLabel={axisLabel(Y, axes.y)}
          format={{ x: (v) => fmt(axes.x)(v), y: (v) => fmt(axes.y)(v) }}
          size={state.size}
          colour={state.colour}
          card={card}
          onOpen={onOpen}
          onPick={onPick}
          label={`${Y?.label ?? axes.y} against ${X?.label ?? axes.x}`}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-3 font-mono text-[11.5px] text-fg-3">
        <span data-summary="">
          r <span className="font-semibold text-fg">{r}</span> as plotted · n{' '}
          <span className="font-semibold text-fg">{view.dots.length}</span>{' '}
          {state.qualifiedOnly ? `qualified ${who}` : who} shown
        </span>
        <span>
          Dashed lines: qualified mean, {fmt(axes.x)(view.mean.x)} and {fmt(axes.y)(view.mean.y)}
        </span>
      </div>
      {view.truncated && (
        <p className="m-0 text-[12px] text-warn">
          The engine returned {view.truncated.shown.toLocaleString('en-US')} of{' '}
          {view.truncated.total.toLocaleString('en-US')} rows: the chart leaves the rest out.
        </p>
      )}
      <div className="flex flex-col" style={style} role="table" aria-label="Chart table">
        <div
          role="row"
          className={cn(grid, 'h-[34px] border-b border-fg-3 text-[11.5px] font-medium text-fg-3')}
        >
          <span role="columnheader">#</span>
          <button
            type="button"
            role="columnheader"
            onClick={() => onSort('name')}
            className="cursor-pointer text-left hover:text-fg"
          >
            {isPlayer ? 'Player' : 'Team'}
            {arrow('name')}
          </button>
          {isPlayer && <span role="columnheader">Team</span>}
          {cols.map((c) => (
            <button
              key={c.by}
              type="button"
              role="columnheader"
              onClick={() => onSort(c.by)}
              className={cn(
                'cursor-pointer truncate text-right hover:text-fg',
                state.sort.by === c.by && 'text-fg'
              )}
            >
              {c.label}
              {arrow(c.by)}
            </button>
          ))}
        </div>
        {rows.map((d, i) => (
          <div
            key={d.id}
            role="row"
            data-row={d.id}
            className={cn(
              grid,
              'h-[34px] border-b border-line-2 text-[12.5px]',
              d.matched && 'bg-cobalt-soft',
              !d.qualified && 'opacity-55'
            )}
          >
            <span className="font-mono text-[11.5px] text-fg-3">{i + 1}</span>
            <button
              type="button"
              onClick={(e) => (e.shiftKey ? onPick(d) : onOpen(d))}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left font-medium text-fg hover:text-cobalt"
            >
              {d.pick >= 0 && <PickSwatch slot={d.pick} />}
              <span className="truncate">{isPlayer ? d.name : `${d.team} · ${d.name}`}</span>
            </button>
            {isPlayer && (
              <span className="font-mono text-[11.5px] font-semibold text-fg-2">
                {d.team ?? '—'}
              </span>
            )}
            {cols.map((c) => {
              const m = c.by === 'x' ? axes.x : c.by === 'y' ? axes.y : c.by
              return (
                <span
                  key={c.by}
                  className="flex items-center justify-end gap-2 font-mono tabular-nums"
                >
                  {fmt(m)(d.values[m] ?? null)}
                  <PctChip percentile={d.percentiles[m] ?? null} qualified={d.qualified} />
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <Notes notes={notes} />
    </>
  )
}
