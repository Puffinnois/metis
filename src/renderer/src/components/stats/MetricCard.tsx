import { HoverCard } from 'radix-ui'
import { familyLabel, kindLabel } from '@/lib/stats/format'
import {
  STABILITY_BARS,
  STABILITY_WORDS,
  stabilityLevel,
  stabilityLines,
  stabilityTitle
} from '@/lib/stats/stability'
import { cn } from '@/lib/utils'
import { seasonLabel } from '@shared/stats/seasons'
import type { MetricInfo } from '@shared/stats/types'

const sampleWords = (info: MetricInfo): string =>
  info.minSample
    ? `${info.minSample.toLocaleString('en-US')} ${info.sampleLabel} over 82 games to qualify`
    : info.sampleLabel

const whoWords = (info: MetricInfo): string => {
  if (info.entity === 'player') return 'Players'
  return info.side === 'defense' ? 'Team defense' : 'Team offense'
}

const sinceWords = (info: MetricInfo): string => {
  const since = seasonLabel(info.firstSeason)
  return info.missingSeasons?.length
    ? `${since}, except ${info.missingSeasons.map(seasonLabel).join(', ')}`
    : since
}

/**
 * Three bars filled by how much the metric carries over from one season to the next (Plan T1006):
 * three high, two medium, one low, none not measured. Beside every column head that shows a metric.
 */
export function StabilityMark({
  info,
  className
}: {
  info: MetricInfo
  className?: string
}): React.JSX.Element {
  const level = stabilityLevel(info)
  const filled = STABILITY_BARS[level]
  return (
    // Hidden from screen readers, which would read it into every column head's name: the card the
    // head opens says the same in words.
    <span
      aria-hidden="true"
      title={stabilityTitle(info)}
      data-stability={level}
      data-stability-words={STABILITY_WORDS[level]}
      className={cn('inline-flex shrink-0 items-end gap-[1.5px]', className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-[2.5px] rounded-[1px]',
            i < filled ? 'bg-current' : 'bg-current opacity-25',
            level === 'none' && 'opacity-25'
          )}
          style={{ height: `${4 + i * 2.5}px` }}
        />
      ))}
    </span>
  )
}

/**
 * A metric's short label with its stability mark, for a table's column head; hover for the card. A
 * metric the catalogue does not have reads its id.
 */
export function MetricHead({
  id,
  info,
  missing
}: {
  id: string
  info: MetricInfo | undefined
  missing?: string | null
}): React.JSX.Element {
  if (!info) return <>{id}</>
  return (
    <MetricHover info={info} missing={missing}>
      <span className="inline-flex cursor-default items-center gap-1" data-metric-head={info.id}>
        {info.short}
        <StabilityMark info={info} />
      </span>
    </MetricHover>
  )
}

/** The catalogue entry of a metric. */
export function MetricCardBody({
  info,
  missing,
  className = 'w-[300px]'
}: {
  info: MetricInfo
  /** Why the column is empty in this scope, if it is. */
  missing?: string | null
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-2 text-[12px] leading-[1.4] text-fg-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-fg">{info.label}</span>
        <span className="shrink-0 rounded-[4px] bg-cobalt-soft px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-cobalt">
          {familyLabel(info.family)}
        </span>
      </div>
      <p className="m-0 text-fg">{info.description}</p>
      {missing && <p className="m-0 text-warn">{missing}</p>}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px]">
        <dt className="text-fg-3">For</dt>
        <dd className="m-0">{whoWords(info)}</dd>
        <dt className="text-fg-3">Kind</dt>
        <dd className="m-0">{kindLabel(info.kind)}</dd>
        <dt className="text-fg-3">Sample</dt>
        <dd className="m-0">{sampleWords(info)}</dd>
        <dt className="text-fg-3">Since</dt>
        <dd className="m-0">{sinceWords(info)}</dd>
        <dt className="text-fg-3">Source</dt>
        <dd className="m-0">{info.sources.join(', ')}</dd>
        <dt className="flex items-center gap-1 text-fg-3">
          Stability <StabilityMark info={info} />
        </dt>
        <dd className="m-0" data-testid="stability-lines">
          {stabilityLines(info).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </dd>
      </dl>
    </div>
  )
}

/** Hovering `children` (a column head) shows the metric's card. */
export function MetricHover({
  info,
  missing,
  children
}: {
  info: MetricInfo
  missing?: string | null
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <HoverCard.Root openDelay={350} closeDelay={80}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 rounded-[10px] bg-panel p-3 shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <MetricCardBody info={info} missing={missing} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
