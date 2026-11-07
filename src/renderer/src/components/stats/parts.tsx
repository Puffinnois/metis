import { cn } from '@/lib/utils'

/** The dashboards' small pieces: loading lines, section heads, mono tables. */

export function Loading({ error }: { error?: string | null }): React.JSX.Element {
  return error ? (
    <div className="py-12 text-center text-[13px] text-bad">{error}</div>
  ) : (
    <div className="py-12 text-center text-[13px] text-fg-3">Loading…</div>
  )
}

export function SectionHead({ title, note }: { title: string; note?: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="m-0 text-[15px] leading-none font-semibold tracking-[-0.01em]">{title}</h2>
      {note && <span className="text-[12px] leading-none text-fg-3">{note}</span>}
    </div>
  )
}

export interface MiniRow {
  key: string
  cells: React.ReactNode[]
  /** Makes the whole row a button: a game, or a player. */
  onOpen?: () => void
  title?: string
  /** A total under the rows. */
  strong?: boolean
}

/** A small mono table: a header under a rule, then rows. Numbers align right. */
export function MiniTable({
  columns,
  head,
  rows,
  left = [],
  label,
  minWidth
}: {
  columns: string
  head: React.ReactNode[]
  rows: MiniRow[]
  /** Columns read left to right (text); the first always is. */
  left?: number[]
  /** For screen readers, and how a check finds the table. */
  label?: string
  /** Wider than the window can show: its parent scrolls. */
  minWidth?: number
}): React.JSX.Element {
  const align = (i: number): string => (i === 0 || left.includes(i) ? 'text-left' : 'text-right')
  return (
    <div
      className="flex flex-col font-mono text-[12.5px] tabular-nums"
      style={minWidth ? { minWidth } : undefined}
      role="table"
      aria-label={label}
    >
      <div
        role="row"
        className="grid h-7 items-end gap-x-3 border-b border-fg-3 pb-[7px] text-[11px] text-fg-3"
        style={{ gridTemplateColumns: columns }}
      >
        {head.map((h, i) => (
          <span key={i} role="columnheader" className={cn(align(i), i === 0 && 'font-sans')}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((r) => {
        const style = cn(
          'grid h-[34px] items-center gap-x-3 border-b border-line-2',
          r.strong && 'border-t border-fg-3 font-semibold'
        )
        const cells = r.cells.map((c, i) => (
          <span key={i} role="cell" className={cn('min-w-0 truncate', align(i))}>
            {c}
          </span>
        ))
        return r.onOpen ? (
          <button
            key={r.key}
            type="button"
            role="row"
            title={r.title}
            onClick={r.onOpen}
            className={cn(style, 'w-full cursor-pointer text-left hover:bg-hover')}
            style={{ gridTemplateColumns: columns }}
          >
            {cells}
          </button>
        ) : (
          <div
            key={r.key}
            role="row"
            title={r.title}
            className={style}
            style={{ gridTemplateColumns: columns }}
          >
            {cells}
          </div>
        )
      })}
    </div>
  )
}

export function NavButton({
  title,
  onClick,
  disabled,
  children
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex size-[26px] cursor-pointer items-center justify-center rounded-[6px] border border-line bg-panel text-fg-2 hover:bg-hover hover:text-fg disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** A won, lost or unplayed game's result, as a soft chip. */
export function ResultChip({
  result,
  score
}: {
  result: 'W' | 'L' | null
  score: string | null
}): React.JSX.Element {
  return score ? (
    <span
      className={cn(
        'rounded-[4px] px-[5px] py-0.5 text-[11px] font-semibold whitespace-nowrap',
        result === 'W' && 'bg-good-s text-good',
        result === 'L' && 'bg-bad-s text-bad'
      )}
    >
      {score}
    </span>
  ) : (
    <span className="text-[11.5px] text-fg-3">—</span>
  )
}

/** A player's initials in a circle: Metis fetches no photos, so nothing here calls out. */
export function Initials({ name, size = 64 }: { name: string; size?: number }): React.JSX.Element {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      role="img"
      aria-label={name}
      className="flex shrink-0 items-center justify-center rounded-full bg-panel-2 font-semibold text-fg-3 shadow-[0_0_0_1px_var(--line)]"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {letters}
    </div>
  )
}

/** A tab row, as on the leaderboards. */
export function TabRow<T extends string>({
  label,
  tabs,
  value,
  onChange,
  children
}: {
  label: string
  tabs: { id: T; label: string }[]
  value: T
  onChange: (tab: T) => void
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line">
      <div
        role="tablist"
        aria-label={label}
        className="flex min-w-0 gap-[22px] overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === value}
            onClick={() => onChange(t.id)}
            className={cn(
              'h-8 cursor-pointer text-[13.5px] leading-none whitespace-nowrap',
              t.id === value
                ? 'font-semibold text-fg shadow-[inset_0_-2px_0_var(--fg)]'
                : 'font-medium text-fg-3 hover:text-fg'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}

/** Caveats under a table: what the answer depends on. */
export function Notes({ notes }: { notes: string[] }): React.JSX.Element | null {
  if (!notes.length) return null
  return (
    <div className="flex flex-col gap-1 text-[12px] text-fg-3">
      {notes.map((n) => (
        <div key={n}>{n}</div>
      ))}
    </div>
  )
}
