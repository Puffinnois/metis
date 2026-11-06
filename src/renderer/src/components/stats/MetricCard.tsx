import { HoverCard } from 'radix-ui'
import { familyLabel, kindLabel } from '@/lib/stats/format'
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
