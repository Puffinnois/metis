import { useEffect, useRef } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { downloadOf, leagueHolds, menuNote, useLeagueDownloads } from '@/lib/stats/downloads'
import type { NavLocation } from '@/lib/navHistory'
import { setLeague, useLeague } from '@/lib/stats/league'
import { switchLine, switchTarget, useOfferedSwitch } from '@/lib/stats/leagueSwitch'
import { cn } from '@/lib/utils'
import { LEAGUE_IDS, LEAGUES, type LeagueId } from '@shared/leagues'

// The shell is built again for the league picked, so the menu's button is a new one: it takes the
// focus back, and a keyboard user stays where they were.
let refocus = false

/**
 * The league menu beside the mark (D35): the league on screen by name, never by colour (D17), and
 * every league in the registry, with a note on one that is off or has no tables built yet: its real
 * state, from the download setting. Picking one switches every screen to it. On a linked player's
 * page, the paired league opens that player's page there instead, and its item says so (T1304.4).
 */
export function LeagueMenu({
  onOpenPage
}: {
  /** Opens a page of any league, switching to it first (`openPage` in `App.tsx`). */
  onOpenPage?: (location: NavLocation) => void
}): React.JSX.Element {
  const league = useLeague()
  const downloads = useLeagueDownloads()
  const offered = useOfferedSwitch()
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!refocus) return
    refocus = false
    button.current?.focus()
  }, [])

  const pick = (id: string): void => {
    if (id === league.id) return
    refocus = true
    // One move either way, so Back has one page to return to: the player's page in the paired
    // league, or the league as before.
    const to = onOpenPage ? switchTarget(offered, league.id, id as LeagueId) : null
    if (to && onOpenPage) onOpenPage(to)
    else setLeague(id as LeagueId)
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          ref={button}
          type="button"
          title="Switch league"
          aria-label={`League: ${league.name}`}
          className="flex h-[26px] cursor-pointer items-center gap-1 rounded-[6px] border border-line px-2 text-[12.5px] leading-none font-semibold text-fg hover:bg-hover data-[state=open]:bg-hover"
        >
          {league.name}
          <ChevronDown className="size-3.5 text-fg-3" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex min-w-[260px] flex-col rounded-[10px] bg-panel py-1 text-[12.5px] shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-fg-3">
            League
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={league.id} onValueChange={pick}>
            {LEAGUE_IDS.map((id) => {
              const l = LEAGUES[id]
              const note = downloads && menuNote(leagueHolds(l, downloadOf(downloads, id)))
              // The second line names the player's page where the item opens it, in the full
              // name's place, so the item keeps its size.
              const opens = onOpenPage ? switchLine(offered, league.id, id) : null
              return (
                <DropdownMenu.RadioItem
                  key={id}
                  value={id}
                  title={opens ? `Opens ${opens} in ${l.name}` : undefined}
                  className={cn(
                    'flex h-9 cursor-pointer items-center gap-2.5 pr-3 pl-3 outline-none select-none',
                    'data-[highlighted]:bg-hover'
                  )}
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center">
                    <DropdownMenu.ItemIndicator>
                      <Check className="size-3.5 text-fg" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="leading-none font-semibold text-fg">{l.name}</span>
                    <span
                      className={cn(
                        'truncate text-[11.5px] leading-none',
                        opens ? 'text-fg-2' : 'text-fg-3'
                      )}
                    >
                      {opens ?? l.fullName}
                    </span>
                  </span>
                  {note !== null && (
                    <span className="shrink-0 text-[11px] leading-none text-fg-3">{note}</span>
                  )}
                </DropdownMenu.RadioItem>
              )
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
