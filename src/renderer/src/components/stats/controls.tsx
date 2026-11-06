import { cn } from '@/lib/utils'

/** The stats screens' controls: Geist 12–12.5px, 6–7px radius, hairline borders. */

export function StatsSelect<V extends string | number>({
  value,
  options,
  onChange,
  title,
  className
}: {
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
  title: string
  className?: string
}): React.JSX.Element {
  return (
    <select
      value={String(value)}
      title={title}
      aria-label={title}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value)
        if (picked) onChange(picked.value)
      }}
      className={cn(
        'h-7 cursor-pointer rounded-[6px] border border-line bg-panel px-1.5 text-[12.5px] text-fg',
        className
      )}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Totals / Per game, and other short switches. */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
  label: string
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-0.5 rounded-[7px] bg-panel-2 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-6 cursor-pointer rounded-[5px] px-2.5 text-[12px] font-medium whitespace-nowrap',
            o.value === value
              ? 'bg-panel text-fg shadow-[0_0_0_1px_var(--line)]'
              : 'text-fg-2 hover:text-fg'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A checkbox-styled toggle button ("Qualified only"). */
export function CheckToggle({
  on,
  onChange,
  children,
  title
}: {
  on: boolean
  onChange: (on: boolean) => void
  children: React.ReactNode
  title?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={() => onChange(!on)}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-[7px] rounded-[7px] border border-line bg-panel px-2.5 text-[12.5px] font-medium',
        on ? 'text-fg' : 'text-fg-2'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-3.5 items-center justify-center rounded-[4px] text-[10px] leading-none',
          on ? 'bg-cobalt text-on-cobalt' : 'border-[1.5px] border-line'
        )}
      >
        {on ? '✓' : ''}
      </span>
      {children}
    </button>
  )
}

/** A quiet bordered button (Columns, Views, CSV). */
export function StatsButton({
  children,
  onClick,
  title,
  disabled,
  className,
  ...rest
}: React.ComponentProps<'button'>): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] border border-line bg-panel px-2.5 text-[12.5px] font-medium text-fg hover:bg-hover disabled:cursor-default disabled:opacity-50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
