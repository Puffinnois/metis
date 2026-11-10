import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { Loading, MiniTable, Notes, SectionHead } from '@/components/stats/parts'
import {
  DEFAULT_MIN_MINUTES,
  DEFAULT_SORT,
  LINEUP_GROUPS,
  lineupGameType,
  lineupGap,
  lineupNotes,
  lineupRows,
  MIN_MINUTES,
  shortName,
  UNIT_LIMIT,
  unitCount,
  type LineupGroup,
  type LineupSort
} from '@/lib/stats/lineups'
import type { StatsScope } from '@/lib/stats/scope'
import { useLineups, type StatsData } from '@/lib/stats/useStats'
import { lineupColumns } from '@shared/stats/lineups'
import type { BoardMode } from '@shared/stats/types'
import { cn } from '@/lib/utils'

const GROUP_OPTIONS = LINEUP_GROUPS.map((g) => ({ value: g.id, label: g.label }))
const FLOORS = MIN_MINUTES.map((m) => ({
  value: m,
  label: m === 0 ? 'Any minutes' : `${m}+ minutes`
}))

/** The team's five-man units for the season in scope, one dashboard's measures at a time. */
export function LineupsTab({
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
  const { value, error } = useLineups(
    gap ? null : team,
    scope.season,
    lineupGameType(scope),
    group,
    data.version
  )
  return (
    <section className="flex flex-col gap-3">
      <SectionHead
        title="Lineups"
        note={gap ? undefined : 'Five-man units, as the NBA publishes them'}
      />
      {gap ? (
        <p className="m-0 text-[12.5px] text-fg-3">{gap}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Segmented label="Measures" value={group} options={GROUP_OPTIONS} onChange={setGroup} />
            <StatsSelect
              title="Minimum minutes"
              value={floor}
              options={FLOORS}
              onChange={setFloor}
            />
          </div>
          {!value ? (
            <Loading error={error} />
          ) : (
            <UnitTable
              // A group has its own columns, so its sort starts again.
              key={group}
              group={group}
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
  mode,
  floor,
  scope,
  value,
  onOpenPlayer
}: {
  group: LineupGroup
  mode: BoardMode
  floor: number
  scope: StatsScope
  value: NonNullable<ReturnType<typeof useLineups>['value']>
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const [sort, setSort] = useState<LineupSort>(DEFAULT_SORT)
  const [all, setAll] = useState(false)
  const columns = lineupColumns(group)
  const rows = lineupRows(value.units, group, mode, floor, sort)
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
      <p className="m-0 text-[12px] text-fg-3">{unitCount(shown.length, rows.length)}</p>
      {value.units.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          The NBA lists no five-man units for this team in this season.
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          No unit has played {floor} minutes. Lower the minimum to see them.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <MiniTable
            label="Lineups"
            columns={`minmax(330px,2.4fr) 32px 56px repeat(${columns.length}, minmax(52px,1fr))`}
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
      <Notes notes={lineupNotes(scope, value.floorMinutes, mode)} />
    </>
  )
}
