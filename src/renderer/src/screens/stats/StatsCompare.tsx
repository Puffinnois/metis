import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ColumnPicker } from '@/components/stats/ColumnPicker'
import { Segmented, StatsButton, StatsSelect } from '@/components/stats/controls'
import { MetricHover } from '@/components/stats/MetricCard'
import { Loading, Notes } from '@/components/stats/parts'
import { ScopeBar } from '@/components/stats/ScopeBar'
import { PercentileBar } from '@/components/stats/StatLines'
import {
  addFamily,
  candidatesQuery,
  compareColumns,
  compareQuery,
  compareScopeLabel,
  compareTab,
  compareView,
  defaultColumns,
  fillSlots,
  leaders,
  playerCandidates,
  poolNote,
  rangeNote,
  rankedResult,
  searchCandidates,
  setColumns,
  setEntity,
  setSlot,
  slotCard,
  spanOptions,
  spanSeasons,
  teamCandidates,
  type Candidate,
  type CompareRow,
  type CompareState
} from '@/lib/stats/compare'
import { DASHBOARD_MODES } from '@/lib/stats/dashboard'
import { familyLabel } from '@/lib/stats/format'
import { familiesOf } from '@/lib/stats/leaderboard'
import type { StatsScope } from '@/lib/stats/scope'
import { usePlayerInfo, useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import type { Entity, MetricFamily, StatsResult } from '@shared/stats/types'

/** A comparison is about these three: never another set's numbers while their own load. */
const FRESH = { keepLast: false }
const GRID = 'grid grid-cols-[minmax(170px,220px)_repeat(3,minmax(0,1fr))] gap-x-4'
const ORDINAL = ['first', 'second', 'third']

export interface CompareProps {
  data: StatsData
  scope: StatsScope
  /** Shows the scope bar; left out when the screen around Compare has its own. */
  onScope?: (scope: StatsScope) => void
  state: CompareState
  /** Updates from the state as it is then: a late default never undoes a newer choice. */
  onState: (update: (state: CompareState) => CompareState) => void
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
}

/** A dashboard header's way to Compare, with its player or team in the first open slot. */
export function CompareButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <StatsButton onClick={onClick} title="Compare side by side with other players or teams">
      Compare
    </StatsButton>
  )
}

/**
 * Compare: three slots side by side, all players or all teams, one row per metric with the best value
 * in bold. One season ranks each slot among the same pool as the dashboards; several are read whole.
 */
export function StatsCompare({
  data,
  scope,
  onScope,
  state,
  onState,
  onOpenPlayer,
  onOpenTeam
}: CompareProps): React.JSX.Element {
  const { entity, slots, mode } = state
  const columns = useMemo(() => compareColumns(state, data.catalogue), [state, data.catalogue])
  const list = useMemo(
    () => spanSeasons(state.span, scope, data.seasons),
    [state.span, scope, data.seasons]
  )
  const many = list.length > 1
  const q = useMemo(() => compareQuery(state, columns, scope, list), [state, columns, scope, list])
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  const ranked = useMemo(
    () => (result ? rankedResult(result, entity, many) : null),
    [result, entity, many]
  )

  // On the first visit, the open slots take the leaders in scope, once.
  useEffect(() => {
    if (!state.autofill || many || !ranked) return
    const picks = leaders(ranked, entity)
    onState((s) =>
      s.autofill && s.entity === entity
        ? { ...s, slots: fillSlots(s.slots, picks), autofill: false }
        : s
    )
  }, [state.autofill, many, ranked, entity, onState])

  // Over several seasons a player's own seasons say which metrics cover them.
  const infos = [
    usePlayerInfo(entity === 'player' ? slots[0] : null, data.version),
    usePlayerInfo(entity === 'player' ? slots[1] : null, data.version),
    usePlayerInfo(entity === 'player' ? slots[2] : null, data.version)
  ]
  const slotSeasons = slots.map((id, k) => {
    if (!id || !many) return null
    if (entity === 'team') return list
    const own = infos[k].value?.seasons
    return own ? own.filter((s) => list.includes(s)) : null
  })
  const view = compareView(ranked, slots, columns, data.byId, mode, entity, slotSeasons)
  const filled = slots.filter((s) => s !== null).length

  const [searching, setSearching] = useState(false)
  const cq = useMemo(
    () => (entity === 'player' && many && searching ? candidatesQuery(scope, list) : null),
    [entity, many, searching, scope, list]
  )
  const pool = useStatsQuery(cq, data.version)
  const candidates = useMemo(
    () =>
      entity === 'team'
        ? teamCandidates(data.seasons, list)
        : playerCandidates(many ? pool.result : ranked),
    [entity, data.seasons, list, many, pool.result, ranked]
  )

  const tab = compareTab(entity)
  const families = familiesOf(data.catalogue, tab)
  const update = (f: (s: CompareState) => CompareState): void => onState(f)
  const what = entity === 'team' ? 'team' : 'player'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2.5">
        {onScope && (
          <ScopeBar scope={scope} seasons={data.seasons} entity={entity} onChange={onScope} />
        )}
        <Segmented
          label="Players or teams"
          value={entity}
          options={[
            { value: 'player' as Entity, label: 'Players' },
            { value: 'team' as Entity, label: 'Teams' }
          ]}
          onChange={(e) => update((s) => setEntity(s, e))}
        />
        <StatsSelect
          title="Seasons compared"
          value={state.span}
          options={spanOptions(scope, data.seasons)}
          onChange={(span) => update((s) => ({ ...s, span }))}
        />
        <Segmented
          label="Totals or rates"
          value={mode}
          options={DASHBOARD_MODES}
          onChange={(m) => update((s) => ({ ...s, mode: m }))}
        />
        <div className="ml-auto flex items-center gap-2">
          <StatsSelect
            title="Add a family of rows"
            value=""
            options={[
              { value: '', label: 'Add a family…' },
              ...families.map((f) => ({ value: f, label: familyLabel(f) }))
            ]}
            onChange={(f) =>
              f &&
              update((s) =>
                setColumns(s, addFamily(columns, f as MetricFamily, entity, data.catalogue))
              )
            }
          />
          <ColumnPicker
            tab={tab}
            catalogue={data.catalogue}
            columns={columns}
            onChange={(c) => update((s) => setColumns(s, c))}
            onReset={() => update((s) => setColumns(s, defaultColumns(s.entity, data.catalogue)))}
          />
        </div>
      </div>

      <div className={cn(GRID, 'items-stretch')}>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <h1 className="m-0 text-[26px] leading-none font-bold tracking-[-0.03em]">Compare</h1>
          <div className="text-[12.5px] text-fg-2">{compareScopeLabel(scope, list, entity)}</div>
          <div className="text-[12px] leading-[1.4] text-pretty text-fg-3">
            {poolNote(entity, list, ranked)}
          </div>
        </div>
        {slots.map((id, k) => (
          <SlotCard
            key={k}
            slot={k}
            id={id}
            entity={entity}
            result={ranked}
            fallback={
              entity === 'player'
                ? (infos[k].value?.name ?? null)
                : (candidates.find((c) => c.id === id)?.name ?? null)
            }
            leads={filled > 1 && id ? `Leads ${view.leads[k]} of ${view.counted}` : ''}
            candidates={candidates}
            exclude={slots}
            loadingCandidates={entity === 'player' && many && pool.loading}
            onSearch={setSearching}
            onPick={(v) => update((s) => setSlot(s, k, v))}
            onRemove={() => update((s) => setSlot(s, k, null))}
            onOpen={() => id && (entity === 'team' ? onOpenTeam(id) : onOpenPlayer(id))}
            what={what}
          />
        ))}
      </div>

      {error ? (
        <Loading error={error} />
      ) : filled === 0 ? (
        <div className="py-10 text-center text-[13px] text-fg-3">Add a {what} to compare.</div>
      ) : !ranked ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-col" aria-label="Comparison">
            {view.groups.map((g) => (
              <div key={g.label} className="flex flex-col">
                <div
                  className={cn(
                    GRID,
                    'h-[34px] items-end border-b border-fg-3 pb-[7px] font-mono text-[11px] leading-none tracking-[0.04em] text-fg-3 uppercase'
                  )}
                >
                  <span className="text-fg">{g.label}</span>
                  <span className="col-span-3">{many ? 'Value' : 'Value · percentile · rank'}</span>
                </div>
                {g.rows.map((r) => (
                  <MetricRow key={r.metric} row={r} />
                ))}
              </div>
            ))}
          </div>
          <Notes
            notes={[...(rangeNote(scope, list) ? [rangeNote(scope, list)!] : []), ...ranked.notes]}
          />
        </>
      )}
    </div>
  )
}

function Swatch({ slot }: { slot: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-[3px]"
      style={{ background: `var(--s${slot + 1})` }}
    />
  )
}

function SlotCard({
  slot,
  id,
  entity,
  result,
  fallback,
  leads,
  candidates,
  exclude,
  loadingCandidates,
  onSearch,
  onPick,
  onRemove,
  onOpen,
  what
}: {
  slot: number
  id: string | null
  entity: Entity
  result: StatsResult | null
  fallback: string | null
  leads: string
  candidates: Candidate[]
  exclude: readonly (string | null)[]
  loadingCandidates: boolean
  onSearch: (open: boolean) => void
  onPick: (id: string) => void
  onRemove: () => void
  onOpen: () => void
  what: string
}): React.JSX.Element {
  const search = (placeholder: string): React.JSX.Element => (
    <SlotSearch
      label={`${id ? 'Replace' : 'Add'} the ${ORDINAL[slot]} ${what}`}
      placeholder={placeholder}
      candidates={candidates}
      exclude={exclude}
      loading={loadingCandidates}
      onOpen={onSearch}
      onPick={onPick}
    />
  )
  if (!id) {
    return (
      <div
        className="flex min-w-0 flex-col justify-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-line px-4 py-3.5"
        data-slot={slot}
      >
        <div className="flex items-center gap-2 text-[13px] font-medium text-fg-2">
          <Swatch slot={slot} />
          Add a {ORDINAL[slot]} {what}
        </div>
        {search(`Search ${what === 'team' ? 'teams' : 'players'}`)}
      </div>
    )
  }
  const c = slotCard(result, id, entity, fallback)
  const facts = [
    c.team && entity === 'player' ? c.team : null,
    c.position,
    result ? `${c.games} G` : null
  ].filter(Boolean)
  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 rounded-[10px] bg-panel px-4 pt-3.5 pb-3 shadow-[0_0_0_1px_var(--line)]"
      data-slot={slot}
    >
      <div className="flex items-center gap-2 text-[12px] leading-none text-fg-2">
        <Swatch slot={slot} />
        <span className="truncate font-mono text-[11.5px]">{facts.join(' · ')}</span>
        {entity === 'player' && result && !c.qualified && c.games > 0 && (
          <span
            title="Below the minutes the leaderboards ask, so no percentiles"
            className="rounded-[4px] px-[5px] py-[3px] font-mono text-[10.5px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]"
          >
            NQ
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${c.name}`}
          title="Remove from the comparison"
          className="ml-auto flex size-[22px] cursor-pointer items-center justify-center rounded-[5px] text-fg-3 hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpen}
        title={entity === 'team' ? 'Open the team dashboard' : 'Open the player dashboard'}
        className="min-w-0 cursor-pointer truncate text-left text-[22px] leading-[1.1] font-bold tracking-[-0.03em] hover:text-cobalt"
      >
        {c.name}
      </button>
      <div className="flex justify-end font-mono text-[11px] text-fg-3">{leads}</div>
      {search(`Replace with…`)}
    </div>
  )
}

/** A search that lists matches under it; a click or Enter puts the first in the slot. */
function SlotSearch({
  label,
  placeholder,
  candidates,
  exclude,
  loading,
  onOpen,
  onPick
}: {
  label: string
  placeholder: string
  candidates: Candidate[]
  exclude: readonly (string | null)[]
  loading: boolean
  onOpen: (open: boolean) => void
  onPick: (id: string) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const matches = open ? searchCandidates(candidates, text, exclude) : []
  const pick = (id: string): void => {
    onPick(id)
    setText('')
    setOpen(false)
    onOpen(false)
  }
  return (
    <div className="relative">
      <input
        value={text}
        aria-label={label}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          onOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          // Typing searches even when the window had no focus to give the input.
          onOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) pick(matches[0].id)
          if (e.key === 'Escape') setOpen(false)
        }}
        className="h-7 w-full rounded-[6px] border border-line bg-paper px-2 text-[12.5px] text-fg outline-none"
      />
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-8 z-40 m-0 max-h-[280px] list-none overflow-auto rounded-[8px] bg-panel p-1 shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          {matches.map((m) => (
            <li key={m.id} role="option" aria-selected={false}>
              <button
                type="button"
                // Before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(m.id)
                }}
                className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 text-left text-[12.5px] hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate text-fg">{m.name}</span>
                <span className="font-mono text-[11px] text-fg-3">{m.detail}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-2 text-[12px] text-fg-3">
              {loading ? 'Loading…' : 'No match.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function MetricRow({ row }: { row: CompareRow }): React.JSX.Element {
  const label = (
    <span
      tabIndex={0}
      className={cn(
        'min-w-0 cursor-default truncate text-[12.5px] text-fg-2 outline-none',
        row.missing && 'text-fg-3'
      )}
    >
      {row.label}
    </span>
  )
  return (
    <div
      className={cn(GRID, 'h-[36px] items-center border-b border-line-2')}
      data-metric={row.metric}
    >
      <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
        {row.info ? (
          <MetricHover info={row.info} missing={row.missing}>
            {label}
          </MetricHover>
        ) : (
          label
        )}
        {row.sub && <span className="font-mono text-[10.5px] text-fg-3">{row.sub}</span>}
      </div>
      {row.cells.map((c, k) =>
        c === null ? (
          <span key={k} />
        ) : (
          <div
            key={k}
            title={c.title || undefined}
            data-cell={k}
            className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-3"
          >
            <span
              className={cn(
                'font-mono tabular-nums',
                c.lead ? 'text-[13.5px] font-bold text-fg' : 'text-[13px] text-fg-2',
                c.text === '—' && 'text-fg-3'
              )}
              data-lead={c.lead || undefined}
            >
              {c.text}
            </span>
            {c.percentile !== null ? (
              <div className="px-[13px]">
                <PercentileBar
                  percentile={c.percentile}
                  neutral={row.info?.direction === 'neutral'}
                />
              </div>
            ) : (
              <span className="truncate text-[11.5px] text-fg-3">
                {k === 0 && row.missing ? row.missing : ''}
              </span>
            )}
            <span className="text-right font-mono text-[11px] text-fg-3">{c.rank ?? ''}</span>
          </div>
        )
      )}
    </div>
  )
}
