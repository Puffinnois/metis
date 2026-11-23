import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { StatsSelect } from '@/components/stats/controls'
import { FavouriteStar } from '@/components/stats/FavouriteStar'
import type { Heat } from '@/lib/stats/format'
import type { OtherRow } from '@/lib/stats/otherPlayers'
import { RAIL_POSITIONS, railMetrics, type RailPosition, type RailRow } from '@/lib/stats/player'
import {
  hiddenNote,
  MORE_HEADING,
  railCount,
  type MoreRow,
  type MoreRows
} from '@/lib/stats/playerSearch'
import { cn, scrollToNearest } from '@/lib/utils'
import type { MetricInfo, StatsTeam } from '@shared/stats/types'

/** Rows the rail shows at first, and each "Show more" adds. */
const PAGE = 25

const NO_MORE: MoreRows = { rows: [], hidden: 0 }

const CHIP: Record<Heat, string> = {
  h3: 'bg-good-s text-good font-semibold',
  h2: 'bg-good-s text-good font-semibold',
  h1: 'bg-panel-2 text-fg',
  n: 'bg-panel-2 text-fg',
  l1: 'bg-panel-2 text-fg',
  l2: 'bg-bad-s text-bad font-semibold',
  l3: 'bg-bad-s text-bad font-semibold'
}

/**
 * A row's star (D49) sits beside its button, never inside it, over the 16 px column every row keeps
 * for it after the rank: 12 px of padding, the 24 px rank and an 8 px gap from the row's left edge.
 */
const STAR_AT = 'absolute top-1/2 left-11 -translate-y-1/2'

/** The row the keys rest on, short of opening it: the hover's shade, with the selection's edge. */
const CURSOR = 'bg-hover shadow-[inset_2px_0_0_var(--cobalt)]'

const POSITION_LABELS: Record<RailPosition, string> = { ALL: 'All', G: 'G', F: 'F', C: 'C' }

/**
 * The list beside a player: a position, a search, a team, a rank-by metric, those who qualify best
 * first with the value in a shaded chip. ↑ / ↓ (or J / K) move the selection. A search also finds every
 * other player with a page in the league, below the ranked rows and unranked (T1304.5), then the
 * paired league's linked players who have no page in this league, under their league's name, never
 * ranked among them (T1304.4). The keys reach those rows too: they rest on one and Enter opens it,
 * since opening one changes the season or the league, where a ranked row changes only the player.
 */
export function PlayerRail({
  position,
  onPosition,
  metric,
  onMetric,
  rows,
  teams,
  team,
  onTeam,
  loading,
  error,
  range,
  byId,
  selected,
  onSelect,
  more,
  elsewhere
}: {
  position: RailPosition
  onPosition: (position: RailPosition) => void
  metric: string
  onMetric: (metric: string) => void
  /** Filtered by the search the rail keeps. */
  rows: (search: string) => RailRow[]
  teams: StatsTeam[]
  /** An NBA team id, or every team. */
  team: string | null
  onTeam: (team: string | null) => void
  loading: boolean
  error: string | null
  range: string
  byId: ReadonlyMap<string, MetricInfo>
  selected: string | null
  onSelect: (id: string) => void
  /** The league's players a search finds that the ranked rows do not hold, and opening one. */
  more?: {
    rows: (search: string, listed: ReadonlySet<string>) => MoreRows
    /** The search is used: the league's player index is read then, not with the page. */
    onWant: () => void
    onOpen: (row: MoreRow) => void
  }
  /** The paired league's rows a search finds, and what choosing one does. */
  elsewhere?: {
    heading: string
    rows: (search: string) => OtherRow[]
    /** The search is used: its rows of the other league are read then, not with the page. */
    onWant: () => void
    onOpen: (row: OtherRow) => void
  }
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const shownRows = rows(search)
  const found = more ? more.rows(search, new Set(shownRows.map((r) => r.id))) : NO_MORE
  const otherRows = elsewhere ? elsewhere.rows(search) : []
  // The selected player is listed, however far down they rank.
  const shown = Math.max(limit, shownRows.findIndex((r) => r.id === selected) + 1)
  const listed = shownRows.some((r) => r.id === selected)
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (listed) selectedRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, listed])

  // Every row the keys reach, in the order shown: the ranked rows (a step selects the player, as it
  // always has), then the unranked and the other league's (a step rests on the row, Enter opens it).
  const steps: { key: string; ranked?: string; open?: () => void }[] = [
    ...shownRows.map((r) => ({ key: `r:${r.id}`, ranked: r.id })),
    ...found.rows.map((r) => ({ key: `m:${r.id}`, open: () => more?.onOpen(r) })),
    ...otherRows.map((r) => ({ key: `o:${r.key}`, open: () => elsewhere?.onOpen(r) }))
  ]
  // The row the keys rest on, other than a ranked one; forgotten once the rows change under it.
  const [cursor, setCursor] = useState<string | null>(null)
  const resting = cursor !== null && steps.some((s) => s.key === cursor) ? cursor : null
  const cursorRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (resting && cursorRef.current) scrollToNearest(cursorRef.current)
  }, [resting])

  const move = (d: number): void => {
    if (!steps.length) return
    const at = resting
      ? steps.findIndex((s) => s.key === resting)
      : steps.findIndex((s) => s.ranked === selected)
    const next = steps[at === -1 ? 0 : Math.max(0, Math.min(steps.length - 1, at + d))]
    if (next.ranked === undefined) setCursor(next.key)
    else {
      setCursor(null)
      if (next.ranked !== selected) onSelect(next.ranked)
    }
  }
  const onKey = (e: React.KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'SELECT') return
    // In the search box the arrows and Enter still serve the list; J and K are letters there.
    const typing = tag === 'INPUT'
    if (e.key === 'ArrowDown' || (!typing && e.key === 'j')) {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp' || (!typing && e.key === 'k')) {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' && resting && (typing || e.target === e.currentTarget)) {
      e.preventDefault()
      steps.find((s) => s.key === resting)?.open?.()
    }
  }
  const restRef =
    (key: string) =>
    (el: HTMLButtonElement | null): void => {
      if (el && key === resting) cursorRef.current = el
    }
  const code = teams.find((t) => t.id === team)?.code
  return (
    <aside
      aria-label="Players"
      tabIndex={0}
      onKeyDown={onKey}
      className="flex min-h-0 w-[300px] shrink-0 flex-col border-r border-line outline-none"
    >
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-line px-3.5 pt-3.5 pb-3">
        <div
          role="radiogroup"
          aria-label="Position"
          className="flex gap-0.5 rounded-[7px] bg-panel-2 p-0.5"
        >
          {RAIL_POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={p === position}
              onClick={() => {
                setLimit(PAGE)
                onPosition(p)
              }}
              className={cn(
                'h-6 flex-1 cursor-pointer rounded-[5px] font-mono text-[11.5px] leading-none',
                p === position
                  ? 'bg-panel font-semibold text-fg shadow-[0_0_0_1px_var(--line)]'
                  : 'font-medium text-fg-2 hover:text-fg'
              )}
            >
              {POSITION_LABELS[p]}
            </button>
          ))}
        </div>
        <label className="flex h-7 min-w-0 items-center gap-1.5 rounded-[6px] border border-line bg-panel px-2 text-fg-3">
          <Search className="size-[13px] shrink-0" />
          <input
            value={search}
            onFocus={() => {
              more?.onWant()
              elsewhere?.onWant()
            }}
            onChange={(e) => {
              setSearch(e.target.value)
              setLimit(PAGE)
              setCursor(null)
              more?.onWant()
              elsewhere?.onWant()
            }}
            placeholder="Player"
            aria-label="Search players"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none"
          />
        </label>
        <div className="flex gap-1.5">
          <StatsSelect
            title="Team"
            value={team ?? ''}
            options={[
              { value: '', label: 'All teams' },
              ...teams.map((t) => ({ value: t.id, label: t.code }))
            ]}
            onChange={(t) => {
              setLimit(PAGE)
              onTeam(t || null)
            }}
            className="min-w-0 flex-1"
          />
          <StatsSelect
            title="Rank by"
            value={metric}
            options={railMetrics(byId)}
            onChange={onMetric}
            className="w-[150px]"
          />
        </div>
      </div>
      <div className="flex shrink-0 justify-between gap-3 border-b border-line-2 px-3.5 py-2 font-mono text-[11px] leading-none text-fg-3">
        {/* One line that never wraps: it counts what is listed, the rows found beyond the ranked
            ones included, so it never reads 0 over a list. */}
        <span className="min-w-0 truncate whitespace-nowrap">
          {railCount(shownRows.length, found.rows.length + otherRows.length, code, range)}
        </span>
        <span className="shrink-0">{byId.get(metric)?.short ?? ''}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {error && <div className="px-3.5 py-6 text-[12.5px] text-bad">{error}</div>}
        {loading && !shownRows.length && (
          <div className="py-10 text-center text-[13px] text-fg-3">Loading…</div>
        )}
        {shownRows.slice(0, shown).map((r) => {
          const on = r.id === selected
          return (
            <div key={r.id} className="group/fav relative">
              <button
                ref={on ? selectedRef : undefined}
                type="button"
                aria-current={on ? 'true' : undefined}
                onClick={() => onSelect(r.id)}
                className={cn(
                  'grid h-10 w-full cursor-pointer grid-cols-[24px_16px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-line-2 pr-3.5 pl-3 text-left',
                  on ? 'bg-sel' : 'hover:bg-hover'
                )}
              >
                <span className="text-right font-mono text-[11.5px] text-fg-3">
                  {r.rank ?? 'NQ'}
                </span>
                <span aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-[13px] leading-[1.1] font-medium">{r.name}</span>
                  <span className="flex items-center gap-[5px] font-mono text-[11px] leading-none text-fg-3">
                    {r.position && <span className="font-semibold text-fg-2">{r.position}</span>}
                    {r.team}
                  </span>
                </span>
                <span
                  title={r.title || undefined}
                  className={cn(
                    'min-w-11 rounded-[5px] px-[7px] py-1 text-right font-mono text-[12px] leading-none',
                    CHIP[r.heat]
                  )}
                >
                  {r.value}
                </span>
              </button>
              <FavouriteStar kind="player" id={r.id} name={r.name} reveal className={STAR_AT} />
            </div>
          )
        })}
        {shownRows.length > shown && (
          <div className="px-3.5 py-3">
            <button
              type="button"
              onClick={() => setLimit(shown + PAGE)}
              className="h-7 w-full cursor-pointer rounded-[6px] border border-line bg-panel text-[12px] font-medium hover:bg-hover"
            >
              Show {Math.min(PAGE, shownRows.length - shown)} more
            </button>
          </div>
        )}
        {!loading &&
          !error &&
          shownRows.length === 0 &&
          found.rows.length === 0 &&
          otherRows.length === 0 && (
            <div className="px-3.5 py-10 text-center text-[12.5px] text-fg-3">
              {search
                ? 'No player by that name.'
                : code
                  ? `No qualified ${code} player in this range.`
                  : 'No qualified player in this range.'}
            </div>
          )}
        {more && found.rows.length > 0 && (
          <div role="group" aria-label={MORE_HEADING}>
            <div className="border-b border-line-2 px-3.5 pt-3 pb-2 font-mono text-[11px] leading-none text-fg-3">
              {MORE_HEADING.toUpperCase()}
            </div>
            {found.rows.map((r) => {
              const key = `m:${r.id}`
              return (
                <div key={key} className="group/fav relative">
                  <button
                    ref={restRef(key)}
                    type="button"
                    title={r.title}
                    aria-label={r.title}
                    aria-current={r.id === selected ? 'true' : undefined}
                    data-cursor={key === resting ? 'true' : undefined}
                    onClick={() => more.onOpen(r)}
                    className={cn(
                      'grid h-10 w-full cursor-pointer grid-cols-[24px_16px_minmax(0,1fr)] items-center gap-x-2 border-b border-line-2 pr-3.5 pl-3 text-left',
                      r.id === selected ? 'bg-sel' : key === resting ? CURSOR : 'hover:bg-hover'
                    )}
                  >
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="truncate text-[13px] leading-[1.1] font-medium">
                        {r.name}
                      </span>
                      <span className="truncate font-mono text-[11px] leading-none text-fg-3">
                        {r.detail}
                      </span>
                    </span>
                  </button>
                  <FavouriteStar kind="player" id={r.id} name={r.name} reveal className={STAR_AT} />
                </div>
              )
            })}
            {found.hidden > 0 && (
              <div className="border-b border-line-2 px-3.5 py-2.5 text-[11.5px] leading-none text-fg-3">
                {hiddenNote(found.hidden)}
              </div>
            )}
          </div>
        )}
        {elsewhere && otherRows.length > 0 && (
          <div role="group" aria-label={elsewhere.heading}>
            <div className="border-b border-line-2 px-3.5 pt-3 pb-2 font-mono text-[11px] leading-none text-fg-3">
              {elsewhere.heading.toUpperCase()}
            </div>
            {otherRows.map((r) => (
              <button
                key={r.key}
                ref={restRef(`o:${r.key}`)}
                type="button"
                title={r.title}
                aria-label={r.title}
                data-cursor={`o:${r.key}` === resting ? 'true' : undefined}
                onClick={() => elsewhere.onOpen(r)}
                className={cn(
                  'grid h-10 w-full cursor-pointer grid-cols-[24px_16px_minmax(0,1fr)] items-center gap-x-2 border-b border-line-2 pr-3.5 pl-3 text-left',
                  `o:${r.key}` === resting ? CURSOR : 'hover:bg-hover'
                )}
              >
                {/* The star's column kept, so names line up; no star, since the row is another
                    league's player and a star is given on their own league's page. */}
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-[13px] leading-[1.1] font-medium">{r.name}</span>
                  <span className="flex min-w-0 items-center gap-[5px] font-mono text-[11px] leading-none text-fg-3">
                    <span className="shrink-0 font-semibold text-fg-2">{r.leagueName}</span>
                    <span className="truncate">{r.detail}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
