import { useEffect, useMemo, useRef } from 'react'
import { MiniTable, Notes, SectionHead } from '@/components/stats/parts'
import type { NavLocation } from '@/lib/navHistory'
import { careerStrip, ownLines, stripQuery, type StripRow } from '@/lib/stats/careerStrip'
import { downloadOf, leagueHolds, useLeagueDownloads } from '@/lib/stats/downloads'
import { useLeague } from '@/lib/stats/league'
import { seasonOf } from '@/lib/stats/scope'
import { useStatsQuery, type ReadState, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import { leagueOf, type LeagueId } from '@shared/leagues'
import type { StatsOtherCareer } from '@shared/stats/types'

const HEAD = ['League', 'Season', 'Team', 'G', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK']
const PCT_HEAD = ['FG%', '3P%', 'FT%']
const COLUMNS = `104px 64px minmax(150px,1.6fr) 36px repeat(6, minmax(44px,1fr)) repeat(3, minmax(54px,1fr))`

/**
 * A player's college and professional careers as one (T1304.3), under their career by season. It
 * renders nothing until its reads are in, and nothing at all for a player with no link and no reason,
 * so the page above never moves for it. `lib/stats/careerStrip.ts` holds what it says.
 */
export function CareerStrip({
  data,
  player,
  playerName,
  career,
  seek = 0,
  onOpenData,
  onOpenPage
}: {
  data: StatsData
  player: string
  playerName: string
  /** The page's one read of the links file, shared with the header's hint. */
  career: ReadState<StatsOtherCareer>
  /** Raised by the header's hint: the strip scrolls into view and takes the focus. */
  seek?: number
  /** The Data panel, opened on the other league's section. */
  onOpenData?: (league: LeagueId) => void
  /** A page of the other league: that player's, in the row's season. */
  onOpenPage?: (location: NavLocation) => void
}): React.JSX.Element | null {
  const league = useLeague()
  const downloads = useLeagueDownloads()
  const seasons = useMemo(() => data.seasons.map((s) => s.season), [data.seasons])
  // The page's own seasons are asked for only once the read finds a link: most players have none,
  // and their page then costs one read of the links file and no query of the league's own.
  const linked = Boolean(career.value?.link)
  const q = useMemo(
    () => (linked && seasons.length ? stripQuery(player, seasons, league) : null),
    [linked, player, seasons, league]
  )
  const own = useStatsQuery(q, data.version, { keepLast: false })
  const view = useMemo(() => {
    if (!career.value || !downloads || (linked && !own.result)) return null
    const other = career.value.league
    const download = other ? downloadOf(downloads, other) : undefined
    return careerStrip({
      league,
      playerName,
      own: ownLines(
        linked ? own.result : null,
        (season, code) =>
          seasonOf(data.seasons, season)?.teams.find((t) => t.code === code)?.name ?? null
      ),
      career: career.value,
      otherHolds: other ? leagueHolds(leagueOf(other), download) : undefined,
      otherOn: download?.on ?? false,
      byId: data.byId
    })
  }, [career.value, linked, own.result, downloads, league, playerName, data.seasons, data.byId])

  // The hint asked for the strip: scrolled to once it is drawn, and only once per ask.
  const section = useRef<HTMLElement>(null)
  const sought = useRef(0)
  const drawn = view !== null && view.kind !== 'none'
  useEffect(() => {
    if (!drawn || seek === 0 || seek === sought.current) return
    sought.current = seek
    section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    section.current?.focus({ preventScroll: true })
  }, [drawn, seek])

  // A read that fails leaves the page as it was: the strip is extra, never in the way.
  if (!view || view.kind === 'none') return null
  if (view.kind === 'reason') {
    return (
      <section
        ref={section}
        tabIndex={-1}
        aria-label={view.title}
        className="flex scroll-mt-4 flex-col gap-2.5 outline-none"
      >
        <SectionHead title={view.title} />
        <p className="m-0 text-[12.5px] text-fg-3">{view.text}</p>
      </section>
    )
  }
  const action = view.action
  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-label={view.title}
      className="flex scroll-mt-4 flex-col gap-2.5 outline-none"
    >
      <SectionHead title={view.title} note={view.note} />
      <div className="overflow-x-auto">
        <MiniTable
          label={view.title}
          columns={COLUMNS}
          minWidth={900}
          head={[...HEAD, ...PCT_HEAD]}
          left={[1, 2]}
          rows={view.rows.map((r) => ({
            key: r.key,
            title: r.title,
            spill: r.kind === 'draft',
            onOpen: r.open && onOpenPage ? () => r.open && onOpenPage(r.open) : undefined,
            cells: cells(r)
          }))}
        />
      </div>
      <Notes notes={view.notes} />
      {action?.kind === 'download' && onOpenData && (
        <button
          type="button"
          onClick={() => onOpenData(action.league)}
          className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
        >
          {action.label} →
        </button>
      )}
      {action?.kind === 'downloading' && <p className="m-0 text-[12px] text-fg-3">{action.text}</p>}
    </section>
  )
}

function cells(r: StripRow): React.ReactNode[] {
  const leagueCell = r.own ? (
    // The league on screen: what this page is about, marked as the header marks the player.
    <span
      key="l"
      className="rounded-[4px] bg-cobalt px-[5px] py-[2px] font-mono text-[11px] font-semibold whitespace-nowrap text-on-cobalt"
    >
      {r.leagueName}
      <span className="sr-only">, this page</span>
    </span>
  ) : (
    <span key="l" className="font-sans text-[12.5px] font-medium whitespace-nowrap">
      {r.leagueName}
      {/* A row that opens the other league's page says so, as the app's text links do. */}
      {r.open && (
        <span aria-hidden="true" className="ml-1 text-fg-3">
          →
        </span>
      )}
    </span>
  )
  if (r.kind === 'draft') {
    return [
      leagueCell,
      <span key="s" className="text-fg-2">
        {r.season}
      </span>,
      <span key="t" className="font-sans text-fg-2">
        {r.team}
      </span>,
      // The pick runs on over the empty cells after it.
      <span key="g" className="block text-left font-sans whitespace-nowrap text-fg-2">
        {r.games}
      </span>,
      ...Array.from({ length: HEAD.length - 4 + PCT_HEAD.length }, () => '')
    ]
  }
  return [
    leagueCell,
    <span key="s" className={cn('font-sans text-[13px]', !r.own && 'font-medium')}>
      {r.season}
    </span>,
    <span key="t" className="font-sans text-fg-2">
      {r.team}
    </span>,
    <span key="g" className="text-fg-2">
      {r.games}
    </span>,
    ...r.cells.map((c, i) => (
      <span key={i} className={cn(c === '—' && 'text-fg-3')}>
        {c}
      </span>
    ))
  ]
}
