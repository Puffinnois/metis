import { cn } from '@/lib/utils'
import type { CategoryView } from '@/lib/stats/categoryViews'

/**
 * The leaderboard's category tabs (D52): Overview, then each category the league has for the kind of
 * row. They wrap to a second line on a narrow window rather than hide any.
 */
export function CategoryTabs({
  categories,
  value,
  onChange,
  withOverview = true,
  label = 'Categories'
}: {
  categories: { id: string; label: string }[]
  /** The category on screen; empty for Overview. */
  value: string
  onChange: (id: string) => void
  /** A page keeps its Overview in its own tab row above. */
  withOverview?: boolean
  label?: string
}): React.JSX.Element {
  const tabs = withOverview ? [{ id: '', label: 'Overview' }, ...categories] : categories
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-[14px]">
      {tabs.map((t) => (
        <button
          key={t.id || 'overview'}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          data-category={t.id || 'overview'}
          onClick={() => onChange(t.id)}
          className={cn(
            'h-8 cursor-pointer text-[13px] leading-none whitespace-nowrap',
            t.id === value
              ? 'font-semibold text-fg shadow-[inset_0_-2px_0_var(--fg)]'
              : 'font-medium text-fg-3 hover:text-fg'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Chip({
  label,
  on,
  onClick,
  title,
  dataKey
}: {
  label: string
  on: boolean
  onClick?: () => void
  title?: string
  dataKey?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!onClick}
      title={title}
      data-view={dataKey}
      onClick={onClick}
      className={cn(
        'h-6 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap',
        onClick ? 'cursor-pointer' : 'cursor-default',
        on
          ? 'bg-cobalt-soft text-cobalt shadow-[0_0_0_1px_var(--cobalt)]'
          : 'text-fg-2 shadow-[0_0_0_1px_var(--line)] hover:text-fg'
      )}
    >
      {label}
    </button>
  )
}

/**
 * A category's presets as chips, each filling the board with its metrics (at most 40). An umbrella's
 * heading over 40 metrics shows its specific sub-groups on a second line. "Your columns" marks a board
 * whose columns the user changed from the preset's.
 */
export function ViewChips({
  views,
  active,
  parent,
  custom,
  onPick
}: {
  views: CategoryView[]
  /** The view shown, a child of `parent` if it has one. */
  active: string | null
  parent: string | null
  custom: boolean
  onPick: (key: string) => void
}): React.JSX.Element | null {
  if (views.length === 0 && !custom) return null
  const open = views.find((v) => v.key === parent && v.children)
  const count = (v: CategoryView): string =>
    v.children
      ? `${v.metrics.length} metrics in ${v.children.length} groups`
      : `${v.metrics.length} metrics`
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-view-chips="">
      <div className="flex flex-wrap items-center gap-1.5">
        {views.map((v) => (
          <Chip
            key={v.key}
            dataKey={v.key}
            label={v.label}
            title={count(v)}
            on={!custom && (v.key === active || v.key === parent)}
            onClick={() => onPick(v.key)}
          />
        ))}
        {custom && <Chip label="Your columns" on title="Columns you chose" />}
      </div>
      {open?.children && (
        <div className="flex flex-wrap items-center gap-1.5 pl-3" data-view-children={open.key}>
          <span className="text-[11.5px] text-fg-3">{open.label} ›</span>
          {open.children.map((c) => (
            <Chip
              key={c.key}
              dataKey={c.key}
              label={c.label}
              title={count(c)}
              on={!custom && c.key === active}
              onClick={() => onPick(c.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
