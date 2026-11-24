import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { Loading, MiniTable, Notes, SectionHead, TABLE_SCROLL } from '@/components/stats/parts'
import {
  ANYONE,
  DEFAULT_MIN_MINUTES,
  DEFAULT_SORT,
  LINEUP_GROUPS,
  lineupGameType,
  lineupGap,
  lineupNotes,
  lineupPlayers,
  lineupRows,
  MIN_MINUTES,
  shortName,
  sizeWords,
  UNIT_LIMIT,
  unitCount,
  type LineupGroup,
  type LineupSort
} from '@/lib/stats/lineups'
import type { StatsScope } from '@/lib/stats/scope'
import { currentLeague, inLeague } from '@/lib/stats/league'
import { UNIT_SIZES } from '@/lib/stats/onCourt'
import { useLineups, type StatsData } from '@/lib/stats/useStats'
import { lineupColumns } from '@shared/stats/lineups'
import type { BoardMode } from '@shared/stats/types'
import { cn } from '@/lib/utils'
import { DerivedUnits } from './StatsOnCourt'

const GROUP_OPTIONS = LINEUP_GROUPS.map((g) => ({ value: g.id, label: g.label }))
type Source = 'published' | 'derived'
const SOURCES: { value: Source; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'derived', label: 'From possessions' }
]

const FLOORS = MIN_MINUTES.map((m) => ({
  value: m,
  label: m === 0 ? 'Any minutes' : `${m}+ minutes`
}))

/**
 * The team's units: the NBA's published groups of two to five, or Metis's own count from the plays,
 * every group of two to five in every loaded season. Each is labelled as what it is.
 */
export function LineupsTab(props: {
  data: StatsData
  scope: StatsScope
  team: string
  mode: BoardMode
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const [source, setSource] = useState<Source>('published')
  return (
    <div className="flex flex-col gap-3">
      <Segmented label="Source" value={source} options={SOURCES} onChange={setSource} />
      {source === 'published' ? (
        <PublishedLineups {...props} />
      ) : (
        <section className="flex flex-col gap-3">
          <SectionHead
            title="Lineups"
            note="Counted from the play by play: derived, not official"
          />
          <DerivedUnits
            data={props.data}
            scope={props.scope}
            team={props.team}
            onOpenPlayer={props.onOpenPlayer}
          />
        </section>
      )}
    </div>
  )
}

/** The team's units of one size for the season in scope, one dashboard's measures at a time. */
function PublishedLineups({
  data,
  scope,
  team,
  mode,
  onOpenPlayer
}: {
  data: StatsData
  scope: StatsScope
  team: string
  mode: BoardMode
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const gap = lineupGap(scope)
  const [group, setGroup] = useState<LineupGroup>('base')
  const [floor, setFloor] = useState(DEFAULT_MIN_MINUTES)
  const [size, setSize] = useState('5')
  const [withPlayer, setWithPlayer] = useState(ANYONE)
  const { value, error } = useLineups(
    gap ? null : team,
    scope.season,
    lineupGameType(scope),
    group,
    Number(size),
    data.version
  )
  // Only the sizes the file holds: five alone before the smaller groups are built, and for a league
  // whose units come from its own lineups.
  const sizes = UNIT_SIZES.filter((o) => value?.sizes.includes(Number(o.value)))
  // A player's pairs, trios and units: the players the list names, kept while the size changes.
  const players = lineupPlayers(value?.units ?? [])
  const shownWith = players.some((p) => p.value === withPlayer) ? withPlayer : ANYONE
  return (
    <section className="flex flex-col gap-3">
      <SectionHead
        title="Lineups"
        note={
          gap
            ? undefined
            : inLeague(
                `${sizeWords(Number(size)).replace(/^./, (c) => c.toUpperCase())}, as the {league} publishes them`
              )
        }
      />
      {gap ? (
        <p className="m-0 text-[12.5px] text-fg-3">{gap}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {sizes.length > 1 && (
              <Segmented label="Players" value={size} options={sizes} onChange={setSize} />
            )}
            <Segmented label="Measures" value={group} options={GROUP_OPTIONS} onChange={setGroup} />
            <StatsSelect
              title="Minimum minutes"
              value={floor}
              options={FLOORS}
              onChange={setFloor}
            />
            <StatsSelect
              title="With player"
              value={shownWith}
              options={players}
              onChange={setWithPlayer}
            />
          </div>
          {!value ? (
            <Loading error={error} />
          ) : (
            <UnitTable
              // A group has its own columns, so its sort starts again.
              key={group}
              group={group}
              size={Number(size)}
              withPlayer={shownWith}
              mode={mode}
              floor={floor}
              scope={scope}
              value={value}
              onOpenPlayer={onOpenPlayer}
            />
          )}
        </>
      )}
    </section>
  )
}

function UnitTable({
  group,
  size,
  withPlayer,
  mode,
  floor,
  scope,
  value,
  onOpenPlayer
}: {
  group: LineupGroup
  size: number
  withPlayer: string
  mode: BoardMode
  floor: number
  scope: StatsScope
  value: NonNullable<ReturnType<typeof useLineups>['value']>
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const [sort, setSort] = useState<LineupSort>(DEFAULT_SORT)
  const [all, setAll] = useState(false)
  const columns = lineupColumns(group)
  const rows = lineupRows(value.units, group, mode, floor, sort, withPlayer)
  const shown = all ? rows : rows.slice(0, UNIT_LIMIT)
  const sortBy = (by: number): void =>
    setSort((s) =>
      s.by === by ? { by, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { by, dir: 'desc' }
    )
  const head = (label: string, title: string, by: number): React.ReactNode => (
    <button
      type="button"
      key={by}
      title={title}
      onClick={() => sortBy(by)}
      className={cn(
        'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap hover:text-fg',
        sort.by === by && 'font-semibold text-fg'
      )}
    >
      {label}
      {sort.by === by &&
        (sort.dir === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </button>
  )
  return (
    <>
      <p className="m-0 text-[12px] text-fg-3">{unitCount(shown.length, rows.length, size)}</p>
      {value.units.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          The {currentLeague().name} lists no {sizeWords(size)} for this team in this season.
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          No {size === 5 ? 'unit' : 'group'}
          {withPlayer === ANYONE ? '' : ' with this player'} has played {floor} minutes. Lower the
          minimum to see them.
        </p>
      ) : (
        <div className={TABLE_SCROLL}>
          <MiniTable
            label="Lineups"
            columns={`minmax(${size === 5 ? 330 : 220}px,2.4fr) 32px 56px repeat(${columns.length}, minmax(52px,1fr))`}
            minWidth={460 + columns.length * 62}
            head={[
              'Players',
              head('G', 'Games', 0),
              head('MIN', 'Minutes together', 1),
              ...columns.map((c, i) => head(c.label, c.title, i + 2))
            ]}
            left={[]}
            rows={shown.map((r) => ({
              key: r.key,
              cells: [
                <span key="p" className="flex min-w-0 flex-wrap gap-x-2.5 font-sans text-[12.5px]">
                  {r.players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={`Open ${p.name}’s dashboard`}
                      onClick={() => onOpenPlayer(p.id)}
                      className="cursor-pointer font-medium whitespace-nowrap hover:text-cobalt"
                    >
                      {shortName(p.name)}
                    </button>
                  ))}
                </span>,
                <span key="g" className="text-fg-2">
                  {r.games}
                </span>,
                r.minutes,
                ...r.cells.map((c, i) => (
                  <span key={i} title={c.reason} className={c.reason ? 'text-fg-3' : undefined}>
                    {c.text}
                  </span>
                ))
              ]
            }))}
          />
        </div>
      )}
      {rows.length > UNIT_LIMIT && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
        >
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
      <Notes notes={lineupNotes(scope, value.floorMinutes, mode, size)} />
    </>
  )
}
