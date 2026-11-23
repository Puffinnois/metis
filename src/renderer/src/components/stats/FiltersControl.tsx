import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { Filter, X } from 'lucide-react'
import { StatsButton, StatsSelect } from '@/components/stats/controls'
import {
  conditionId,
  conditionKey,
  conditionText,
  filterGroups,
  fromShown,
  isComplete,
  itemKey,
  itemsByKey,
  MAX_FILTERS,
  newCondition,
  OP_WORDS,
  OPS_BY_TYPE,
  toShown,
  type FilterItem
} from '@/lib/stats/filters'
import { cn } from '@/lib/utils'
import type { BoardMode, FilterOp, MetricInfo, StatsFilter } from '@shared/stats/types'

/**
 * The Filters control of a leaderboard (T1701.2, D51): a button that opens the conditions, each
 * editable, and below them every attribute and metric the board can be filtered on, grouped and
 * searchable. An attribute the league does not have is listed, greyed, with its reason. Its own
 * component, beside the column picker, so either can change without the other.
 */
export function FiltersControl({
  items,
  filters,
  byId,
  mode,
  onChange
}: {
  items: readonly FilterItem[]
  filters: readonly StatsFilter[]
  byId: ReadonlyMap<string, MetricInfo>
  mode: BoardMode
  onChange: (filters: StatsFilter[]) => void
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const itemOf = useMemo(() => itemsByKey(items), [items])
  const groups = useMemo(() => filterGroups(items, search), [items, search])
  const full = filters.length >= MAX_FILTERS
  const set = (i: number, f: StatsFilter): void =>
    onChange(filters.map((x, j) => (j === i ? f : x)))
  const remove = (i: number): void => onChange(filters.filter((_, j) => j !== i))
  const finished = filters.filter(isComplete).length

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <StatsButton title="Filter the rows by who they are or what they did">
          <Filter className="size-3.5" />
          Filters
          {filters.length > 0 && (
            <span className="font-mono text-[11px] text-fg-3" data-filter-count="">
              {finished}
            </span>
          )}
        </StatsButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Filters"
          className="z-50 flex max-h-[min(620px,var(--radix-popover-content-available-height))] w-[420px] flex-col rounded-[10px] bg-panel shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          {filters.length > 0 && (
            <div className="flex max-h-[45%] shrink-0 flex-col gap-2 overflow-auto border-b border-line-2 p-2.5">
              {filters.map((f, i) => (
                <ConditionEditor
                  key={`${conditionId(f)}-${i}`}
                  filter={f}
                  item={itemOf.get(conditionKey(f))}
                  metric={f.metric ? byId.get(f.metric) : undefined}
                  mode={mode}
                  onChange={(next) => set(i, next)}
                  onRemove={() => remove(i)}
                />
              ))}
              <button
                type="button"
                onClick={() => onChange([])}
                className="h-6 cursor-pointer self-end rounded-[6px] px-2 text-[12px] font-medium text-fg-2 hover:bg-hover hover:text-fg"
              >
                Clear all
              </button>
            </div>
          )}
          <div className="border-b border-line-2 p-2.5">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attributes and statistics"
              aria-label="Search filters"
              className="h-7 w-full rounded-[6px] border border-line bg-panel px-2 text-[12.5px] text-fg outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-1">
            {groups.map(({ group, items: list }) => (
              <div key={group}>
                <div className="sticky top-0 bg-panel px-3 pt-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-fg-3 uppercase">
                  {group}
                </div>
                {list.map((item) => (
                  <button
                    key={itemKey(item)}
                    type="button"
                    disabled={full || item.reason !== null}
                    title={item.reason ?? item.description}
                    data-filter-item={item.id}
                    onClick={() => {
                      onChange([...filters, newCondition(item)])
                      setSearch('')
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-baseline gap-2 px-3 py-1 text-left text-[12.5px] hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent',
                      item.reason ? 'text-fg-3' : 'text-fg'
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto shrink-0 truncate text-[11px] text-fg-3">
                      {item.reason ? 'Not in this league' : (item.subgroup ?? '')}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && (
              <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">Nothing matches.</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** One condition: its operator and its value, in the board's units. */
function ConditionEditor({
  filter,
  item,
  metric,
  mode,
  onChange,
  onRemove
}: {
  filter: StatsFilter
  item: FilterItem | undefined
  metric: MetricInfo | undefined
  mode: BoardMode
  onChange: (f: StatsFilter) => void
  onRemove: () => void
}): React.JSX.Element {
  const type = item?.type ?? 'number'
  const ops = OPS_BY_TYPE[type]
  const setOp = (op: FilterOp): void => {
    const keep = ['atLeast', 'atMost'].includes(op) && ['atLeast', 'atMost'].includes(filter.op)
    const base = filter.attribute ? { attribute: filter.attribute } : { metric: filter.metric }
    onChange({
      ...base,
      op,
      ...(keep && filter.value !== undefined ? { value: filter.value } : {})
    })
  }
  const setValue = (value: StatsFilter['value'] | undefined): void => {
    const base = filter.attribute ? { attribute: filter.attribute } : { metric: filter.metric }
    onChange({ ...base, op: filter.op, ...(value !== undefined ? { value } : {}) })
  }
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-[8px] border p-2',
        isComplete(filter) ? 'border-line' : 'border-dashed border-line'
      )}
      data-condition={conditionId(filter)}
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-[12.5px] font-semibold text-fg">
          {item?.label ?? conditionId(filter)}
        </span>
        {item?.reason && <span className="truncate text-[11px] text-bad">{item.reason}</span>}
        <button
          type="button"
          aria-label={`Remove the filter on ${item?.label ?? conditionId(filter)}`}
          onClick={onRemove}
          className="ml-auto flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] text-fg-3 hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatsSelect
          title={`How ${item?.label ?? 'it'} compares`}
          value={filter.op}
          options={ops.map((op) => ({ value: op, label: OP_WORDS[op] }))}
          onChange={setOp}
          className="h-6 text-[12px]"
        />
        {item && <ValueInput filter={filter} item={item} onValue={setValue} />}
      </div>
      <div className="text-[11.5px] text-fg-3">{conditionText(filter, item, metric, mode)}</div>
    </div>
  )
}

const inputClass =
  'h-6 w-[88px] rounded-[5px] border border-line bg-panel px-1.5 font-mono text-[12px] text-fg outline-none'

/** The value an operator needs: a number or two, a date or two, texts, the enumeration's values. */
function ValueInput({
  filter,
  item,
  onValue
}: {
  filter: StatsFilter
  item: FilterItem
  onValue: (value: StatsFilter['value'] | undefined) => void
}): React.JSX.Element | null {
  const v = filter.value as unknown
  const shownNumber = (x: unknown): string =>
    typeof x === 'number' ? String(toShown(x, item)) : ''
  // What is typed, kept as typed until it reads: a half-typed range is not yet a condition.
  const [lo, setLo] = useState(
    Array.isArray(v)
      ? shownOf(v[0], item)
      : typeof v === 'number' || typeof v === 'string'
        ? shownOf(v, item)
        : ''
  )
  const [hi, setHi] = useState(Array.isArray(v) ? shownOf(v[1], item) : '')
  const [words, setWords] = useState(
    Array.isArray(v) ? (v as string[]).join(', ') : typeof v === 'string' ? v : ''
  )
  const date = item.type === 'date'
  const parse = (text: string): number | string | undefined => {
    if (date) return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined
    const n = Number(text.replace(',', '.'))
    return text.trim() !== '' && Number.isFinite(n) ? fromShown(n, item) : undefined
  }
  const unit = item.unit === 'pct' ? '%' : null
  switch (filter.op) {
    case 'atLeast':
    case 'atMost':
      return (
        <Bound
          text={lo || shownNumber(v)}
          date={date}
          unit={unit}
          label={item.label}
          onText={(t) => {
            setLo(t)
            onValue(parse(t) as number | string | undefined)
          }}
        />
      )
    case 'between': {
      const both = (a: string, b: string): void => {
        const x = parse(a)
        const y = parse(b)
        onValue(
          x !== undefined && y !== undefined && typeof x === typeof y
            ? ([x, y] as [number, number] | [string, string])
            : undefined
        )
      }
      return (
        <>
          <Bound
            text={lo}
            date={date}
            unit={null}
            label={`${item.label}, from`}
            onText={(t) => {
              setLo(t)
              both(t, hi)
            }}
          />
          <span className="text-[12px] text-fg-3">to</span>
          <Bound
            text={hi}
            date={date}
            unit={unit}
            label={`${item.label}, to`}
            onText={(t) => {
              setHi(t)
              both(lo, t)
            }}
          />
        </>
      )
    }
    case 'anyOf':
    case 'noneOf':
      if (item.values) {
        const chosen = new Set(Array.isArray(v) ? (v as string[]) : [])
        return (
          <div className="flex flex-wrap gap-1">
            {item.values.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={chosen.has(value)}
                onClick={() => {
                  const next = chosen.has(value)
                    ? [...chosen].filter((x) => x !== value)
                    : [...chosen, value]
                  onValue(next.length > 0 ? next : undefined)
                }}
                className={cn(
                  'h-6 cursor-pointer rounded-[5px] border px-1.5 text-[12px]',
                  chosen.has(value)
                    ? 'border-cobalt bg-cobalt text-on-cobalt'
                    : 'border-line bg-panel text-fg-2 hover:text-fg'
                )}
              >
                {value}
              </button>
            ))}
          </div>
        )
      }
      return (
        <input
          value={words}
          placeholder="Comma between values"
          aria-label={`${item.label}, values`}
          onChange={(e) => {
            setWords(e.target.value)
            const list = e.target.value
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
            onValue(list.length > 0 ? list : undefined)
          }}
          className={cn(inputClass, 'w-[220px] font-sans')}
        />
      )
    case 'contains':
      return (
        <input
          value={words}
          aria-label={`${item.label}, text`}
          onChange={(e) => {
            setWords(e.target.value)
            onValue(e.target.value.trim() ? e.target.value : undefined)
          }}
          className={cn(inputClass, 'w-[220px] font-sans')}
        />
      )
    default:
      return null
  }
}

/** A value as the input first shows it: a number in the board's units, a date as written. */
function shownOf(x: unknown, item: FilterItem): string {
  if (typeof x === 'number') return String(toShown(x, item))
  return typeof x === 'string' ? x : ''
}

function Bound({
  text,
  date,
  unit,
  label,
  onText
}: {
  text: string
  date: boolean
  unit: string | null
  label: string
  onText: (text: string) => void
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <input
        type={date ? 'date' : 'text'}
        inputMode={date ? undefined : 'decimal'}
        value={text}
        aria-label={label}
        onChange={(e) => onText(e.target.value)}
        className={cn(inputClass, date && 'w-[130px]')}
      />
      {unit && <span className="text-[12px] text-fg-3">{unit}</span>}
    </span>
  )
}

/**
 * The board's conditions as chips under its toolbar: each in words, an unfinished one dashed, and a
 * button to remove it.
 */
export function FilterChips({
  filters,
  items,
  byId,
  mode,
  onChange
}: {
  filters: readonly StatsFilter[]
  items: readonly FilterItem[]
  byId: ReadonlyMap<string, MetricInfo>
  mode: BoardMode
  onChange: (filters: StatsFilter[]) => void
}): React.JSX.Element | null {
  const itemOf = useMemo(() => itemsByKey(items), [items])
  if (filters.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {filters.map((f, i) => {
        const item = itemOf.get(conditionKey(f))
        const text = conditionText(f, item, f.metric ? byId.get(f.metric) : undefined, mode)
        const off = !isComplete(f) || item?.reason
        return (
          <span
            key={`${conditionId(f)}-${i}`}
            data-chip={conditionId(f)}
            title={item?.reason ?? text}
            className={cn(
              'flex h-6 items-center gap-1 rounded-full border pr-1 pl-2.5 text-[12px]',
              off ? 'border-dashed border-line text-fg-3' : 'border-line bg-panel text-fg'
            )}
          >
            {text}
            <button
              type="button"
              aria-label={`Remove ${text}`}
              onClick={() => onChange(filters.filter((_, j) => j !== i))}
              className="flex size-4 cursor-pointer items-center justify-center rounded-full text-fg-3 hover:bg-hover hover:text-fg"
            >
              <X className="size-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
