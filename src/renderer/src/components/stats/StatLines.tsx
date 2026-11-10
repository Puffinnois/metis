import { MetricHover } from '@/components/stats/MetricCard'
import type { SectionView, StatLine } from '@/lib/stats/dashboard'
import { heatColor } from '@/lib/stats/format'
import { cn } from '@/lib/utils'

/** A track, a fill to the percentile, the number in a pill. */
export function PercentileBar({
  percentile,
  neutral = false
}: {
  /** 0–100. */
  percentile: number
  neutral?: boolean
}): React.JSX.Element {
  const n = Math.round(percentile)
  const color = heatColor(n / 100, neutral)
  const strong = !neutral && Math.abs(n - 50) > 18
  return (
    <div className="relative h-[22px]" role="img" aria-label={`${n} percentile`}>
      <div className="absolute inset-x-0 top-[10px] h-[2px] rounded-[1px] bg-line" />
      <div
        className="absolute top-[9px] left-0 h-1 rounded-[2px]"
        style={{ width: `${n}%`, background: color }}
      />
      <div
        className="absolute top-0 h-[22px] w-[26px] rounded-[11px] text-center font-mono text-[11px] leading-[22px] font-semibold"
        style={{
          left: `calc(${n}% - 13px)`,
          // A neutral pill is quiet: panel fill, ink text, since white on grey would be too faint.
          background: neutral ? 'var(--panel-2)' : color,
          boxShadow: neutral ? '0 0 0 1px var(--line), 0 0 0 3px var(--panel)' : undefined,
          color: strong ? '#fff' : 'var(--fg)'
        }}
      >
        {n}
      </div>
    </div>
  )
}

function Line({ line }: { line: StatLine }): React.JSX.Element {
  const label = (
    <span
      tabIndex={0}
      className={cn(
        'min-w-0 cursor-default truncate text-[12.5px] text-fg-2 outline-none',
        line.missing && 'text-fg-3'
      )}
    >
      {line.label}
    </span>
  )
  return (
    <div
      className="grid h-[34px] grid-cols-[minmax(150px,1fr)_76px_minmax(110px,150px)_64px] items-center gap-3.5 border-t border-line-2"
      data-metric={line.metric}
    >
      {line.info ? (
        <MetricHover info={line.info} missing={line.missing}>
          {label}
        </MetricHover>
      ) : (
        label
      )}
      <span
        title={line.title || undefined}
        className={cn(
          'text-right font-mono text-[12.5px] font-medium tabular-nums',
          line.value === '—' && 'text-fg-3'
        )}
      >
        {line.value}
      </span>
      {line.percentile !== null ? (
        <>
          <div className="px-[13px]">
            <PercentileBar
              percentile={line.percentile}
              neutral={line.neutral ?? line.info?.direction === 'neutral'}
            />
          </div>
          <span className="text-right text-[11.5px] whitespace-nowrap text-fg-2">
            {line.rank ?? ''}
          </span>
        </>
      ) : (
        <span className="col-span-2 px-[13px] text-[11.5px] text-fg-3">
          {line.missing ?? (line.value !== '—' ? 'Below the qualifying sample' : '')}
        </span>
      )}
    </div>
  )
}

/** A titled list of stat lines: the value, its percentile and its rank. */
export function StatSection({ section }: { section: SectionView }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[15px] leading-none font-semibold tracking-[-0.01em]">
          {section.title}
        </h2>
        {section.note && (
          <span className="text-right text-[11.5px] leading-none text-fg-3">{section.note}</span>
        )}
      </div>
      <div className="flex flex-col border-b border-line-2">
        {section.lines.map((l) => (
          <Line key={l.metric} line={l} />
        ))}
      </div>
    </section>
  )
}

/** Sections in two columns, as far as the window allows. */
export function StatSections({ sections }: { sections: SectionView[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(480px,1fr))] items-start gap-x-10 gap-y-7">
      {sections.map((s) => (
        <StatSection key={s.title} section={s} />
      ))}
    </div>
  )
}
