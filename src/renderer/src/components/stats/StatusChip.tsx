import { cn } from '@/lib/utils'
import type { StatusTag } from '@/lib/stats/availability'

const TONE: Record<StatusTag['tone'], string> = {
  bad: 'bg-bad-s text-bad',
  warn: 'bg-warn-s text-warn',
  good: 'bg-good-s text-good',
  neutral: 'text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]'
}

/**
 * A player's status on the latest official injury report. The full line (status, reason, date) in the
 * header; just the status in a table, with the line on hover.
 */
export function StatusChip({
  tag,
  compact = false
}: {
  tag: StatusTag
  compact?: boolean
}): React.JSX.Element {
  return (
    <span
      title={tag.title}
      aria-label={`Injury report: ${tag.text}`}
      className={cn(
        'inline-block rounded-[4px] px-1.5 py-[3px] font-mono text-[11px] leading-none font-semibold whitespace-nowrap',
        TONE[tag.tone]
      )}
    >
      {compact ? tag.status : tag.text}
    </span>
  )
}
