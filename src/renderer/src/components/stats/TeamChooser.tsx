import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import { ChevronDown, Search } from 'lucide-react'
import { FavouriteMark } from '@/components/stats/FavouriteStar'
import { bestMatch, matchTeams, movedTo, type TeamChoice } from '@/lib/stats/teamSearch'
import { cn, scrollToNearest } from '@/lib/utils'

/**
 * Choosing a team (Plan T1705): the one control wherever a team is picked from a list. It opens on the
 * whole list, in the list's order, with a search at its top that ranks what it finds; the arrows and
 * Enter choose, Escape closes and leaves the choice. Closed, it looks like the selects beside it, and opens as one does: on a
 * click, an arrow, or a letter, which starts the search.
 */
export function TeamChooser({
  title,
  value,
  choices,
  onChange,
  label,
  placeholder = 'Choose a team',
  className
}: {
  /** What the choice is for; names the control. */
  title: string
  /** The value chosen now; null where a pick adds a team rather than changing one. */
  value: string | null
  choices: readonly TeamChoice[]
  onChange: (value: string) => void
  /** The closed control's words, where not the chosen team's code: a team the list lacks. */
  label?: string
  placeholder?: string
  className?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(0)
  // Counts the keys' moves, so the list scrolls to a row a key reached and never under the mouse.
  const [step, setStep] = useState(0)
  const list = useId()
  const matches = useMemo(() => matchTeams(choices, search), [choices, search])
  const at = Math.min(active, matches.length - 1)
  const chosen = choices.find((c) => c.value === value)
  const shown = chosen ? chosen.code || chosen.name : (label ?? placeholder)
  const optionId = (i: number): string => `${list}-${i}`

  const start = (text: string): void => {
    setSearch(text)
    setActive(bestMatch(matchTeams(choices, text), text, value))
  }
  const openWith = (text: string): void => {
    start(text)
    setOpen(true)
  }
  const pick = (c: TeamChoice | undefined): void => {
    if (!c) return
    setOpen(false)
    if (c.value !== value) onChange(c.value)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) openWith('')
        else setOpen(false)
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          title={title}
          aria-label={`${title}: ${shown}`}
          aria-haspopup="listbox"
          data-team-chooser={title}
          data-value={value ?? ''}
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || open) return
            // A key meant for the control is not the rail's, which the control sits in.
            e.stopPropagation()
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              openWith('')
            } else if (e.key.length === 1 && e.key !== ' ') {
              e.preventDefault()
              openWith(e.key)
            }
          }}
          className={cn(
            'flex h-7 cursor-pointer items-center justify-between gap-1 rounded-[6px] border border-line bg-panel px-2 text-left text-[12.5px] text-fg',
            className
          )}
        >
          <span className={cn('truncate', !chosen && label === undefined && 'text-fg-3')}>
            {shown}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-fg-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          aria-label={title}
          // React's events pass through the portal to the rail, which moves on the same keys.
          onKeyDown={(e) => e.stopPropagation()}
          className="z-50 flex max-h-[min(420px,var(--radix-popover-content-available-height))] w-[340px] flex-col rounded-[10px] bg-panel shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <label className="flex h-9 shrink-0 items-center gap-2 border-b border-line-2 px-3 text-fg-3">
            <Search aria-hidden="true" className="size-3.5 shrink-0" />
            <input
              autoFocus
              role="combobox"
              aria-label={`Search: ${title}`}
              aria-expanded
              aria-controls={list}
              aria-autocomplete="list"
              aria-activedescendant={matches.length ? optionId(at) : undefined}
              value={search}
              placeholder="Name, city, school or code"
              // Opened by a letter, the next one goes after it.
              onFocus={(e) => e.currentTarget.setSelectionRange(search.length, search.length)}
              onChange={(e) => start(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                const next = movedTo(e.key, at, matches.length)
                if (next !== null) {
                  e.preventDefault()
                  setActive(next)
                  setStep((n) => n + 1)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  pick(matches[at])
                } else if (e.key === 'Tab') setOpen(false)
              }}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg-3"
            />
          </label>
          {matches.length === 0 ? (
            <p role="status" className="m-0 px-3 py-3 text-[12.5px] text-fg-3">
              No team matches
            </p>
          ) : (
            <TeamList
              key={list}
              id={list}
              title={title}
              matches={matches}
              value={value}
              at={at}
              revealed={`${search}|${step}`}
              optionId={optionId}
              onActive={setActive}
              onPick={pick}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function TeamList({
  id,
  title,
  matches,
  value,
  at,
  revealed,
  optionId,
  onActive,
  onPick
}: {
  id: string
  title: string
  matches: readonly TeamChoice[]
  value: string | null
  at: number
  /** Changes when the row the keys rest on is to be scrolled to: on opening, a search, a key. */
  revealed: string
  optionId: (i: number) => string
  onActive: (i: number) => void
  onPick: (c: TeamChoice) => void
}): React.JSX.Element {
  const rows = useRef<HTMLDivElement | null>(null)
  const opened = useRef(false)
  useLayoutEffect(() => {
    const box = rows.current
    const row = box?.querySelector<HTMLElement>('[data-active]')
    if (!box || !row) return
    if (opened.current) scrollToNearest(row)
    // On opening, the team chosen now sits in the middle, its neighbours on either side.
    else box.scrollTop = row.offsetTop - box.offsetTop - (box.clientHeight - row.offsetHeight) / 2
    opened.current = true
  }, [revealed])
  return (
    <div
      ref={rows}
      id={id}
      role="listbox"
      aria-label={title}
      className="max-h-[372px] min-h-0 flex-1 overflow-auto p-1"
    >
      {matches.map((c, i) => (
        <div
          key={c.value}
          id={optionId(i)}
          role="option"
          aria-selected={c.value === value}
          data-active={i === at || undefined}
          data-value={c.value}
          onMouseMove={() => i !== at && onActive(i)}
          // The search keeps the focus.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className={cn(
            'flex h-[30px] cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[12.5px]',
            // The row Enter takes: an edge as well as a shade, since the shade is faint in the dark.
            i === at && 'bg-panel-2 shadow-[inset_2px_0_0_var(--cobalt)]'
          )}
        >
          {c.id !== null && (
            <span className="w-[52px] shrink-0 truncate font-mono text-[11.5px] text-fg-2">
              {c.code}
            </span>
          )}
          <span
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 text-fg',
              c.value === value && 'font-semibold'
            )}
          >
            <span className="truncate">{c.name}</span>
            <FavouriteMark kind="team" id={c.id} />
          </span>
          {c.conference && (
            <span className="max-w-[90px] shrink-0 truncate text-[11px] text-fg-3">
              {c.conference}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
