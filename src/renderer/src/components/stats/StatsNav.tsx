import { DevChip } from '@/components/dev/DevChip'
import { BackButton, Mark, VersionTag } from '@/components/edition'
import { UpdatePill } from '@/components/UpdatePill'
import { freshness } from '@/lib/stats/scope'
import { NAV_ITEMS, type StatsScreen } from '@/lib/stats/screens'
import { cn } from '@/lib/utils'
import type { StatsStatus } from '@shared/stats/types'
import type { UpdateState } from '@shared/types'

interface StatsNavProps {
  current: StatsScreen
  onNavigate: (screen: StatsScreen) => void
  status: StatsStatus | null
  update: UpdateState
  version: string | null
  /** Back to the page before; off when there is none. */
  canGoBack?: boolean
  onBack?: () => void
  onOpenUpdate: () => void
  onToggleTheme: () => void
}

/** The nav: 52px, mark + "Metis", the screens, the status line, theme. */
export function StatsNav({
  current,
  onNavigate,
  status,
  update,
  version,
  canGoBack = false,
  onBack,
  onOpenUpdate,
  onToggleTheme
}: StatsNavProps): React.JSX.Element {
  return (
    <nav className="flex h-[52px] shrink-0 items-center gap-[30px] border-b border-line px-6">
      <div className="flex items-center gap-[9px]">
        <BackButton enabled={canGoBack} onBack={onBack} />
        <Mark />
        <span className="text-[15px] leading-none font-semibold tracking-[-0.01em]">Metis</span>
        <VersionTag version={version} />
        <DevChip />
      </div>
      <div className="flex gap-[22px] self-stretch text-[13.5px] leading-none font-medium">
        {NAV_ITEMS.map(({ id, label }) => {
          // Players and Teams open the dashboards; the leaderboards are under them.
          const on =
            current === id ||
            (id === 'team' && current === 'teams') ||
            (id === 'player' && current === 'players')
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onNavigate(id)}
              className={cn(
                'flex cursor-pointer items-center',
                on ? 'text-fg shadow-[inset_0_-2px_0_var(--cobalt)]' : 'text-fg-2 hover:text-fg'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="ml-auto flex items-center gap-3.5 text-[13px] leading-none font-medium text-fg-2">
        <button
          type="button"
          title="See what is loaded"
          aria-current={current === 'data' ? 'page' : undefined}
          onClick={() => onNavigate('data')}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 text-[12px] font-normal text-fg-3 hover:text-fg',
            status && (!status.available || status.noRoom) && 'text-bad'
          )}
        >
          {status?.busy && <span className="size-1.5 animate-pulse rounded-full bg-cobalt" />}
          {freshness(status)}
        </button>
        <UpdatePill state={update} onOpen={onOpenUpdate} />
        <button
          type="button"
          title="Switch theme"
          aria-label="Switch theme"
          onClick={onToggleTheme}
          className="flex size-[30px] cursor-pointer items-center justify-center rounded-[7px] border border-line text-fg-2 hover:bg-hover hover:text-fg"
        >
          <span className="size-[13px] rounded-full border-[1.5px] border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]" />
        </button>
      </div>
    </nav>
  )
}
