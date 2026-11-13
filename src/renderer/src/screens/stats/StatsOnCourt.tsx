import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { Loading, MiniTable, Notes, SectionHead } from '@/components/stats/parts'
import { shortName } from '@/lib/stats/lineups'
import {
  DEFAULT_MIN_POSSESSIONS,
  DEFAULT_UNIT_SORT,
  DERIVED_NOTE,
  LINE_COLUMNS,
  MIN_POSSESSIONS,
  onCourtGap,
  onCourtScope,
  teamOnOffQuery,
  TEAM_ON_OFF_METRICS,
  UNIT_SIZES,
  unitRows,
  wowyRows,
  type UnitSort
} from '@/lib/stats/onCourt'
import { fmtStat } from '@/lib/stats/format'
import type { StatsScope } from '@/lib/stats/scope'
import {
  useOnCourtUnits,
  useStatsQuery,
  useWithOrWithout,
  type StatsData
} from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'

const UNIT_LIMIT = 15
const FLOORS = MIN_POSSESSIONS.map((m) => ({
  value: m,
  label: m === 0 ? 'Any possessions' : `${m}+ possessions`
}))
const LINE_GRID = `repeat(${LINE_COLUMNS.length}, minmax(52px,1fr))`

/** The Lineups tab's "From possessions" source: every group of two to five the plays put on the floor. */
export function DerivedUnits({
  data,
  scope,
  team,
  onOpenPlayer
}: {
  data: StatsData
  scope: StatsScope
  team: string
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const gap = onCourtGap(scope)
  const [size, setSize] = useState('5')
  const [floor, setFloor] = useState(DEFAULT_MIN_POSSESSIONS)
  const [sort, setSort] = useState<UnitSort>(DEFAULT_UNIT_SORT)
  const [all, setAll] = useState(false)
  const read = useMemo(() => onCourtScope(scope), [scope])
  const { value, error } = useOnCourtUnits(
    gap ? null : team,
    scope.season,
    read,
    Number(size),
    data.version
  )
  if (gap) return <p className="m-0 text-[12.5px] text-fg-3">{gap}</p>
  const rows = value ? unitRows(value.units, floor, sort) : []
  const shown = all ? rows : rows.slice(0, UNIT_LIMIT)
  const sortBy = (by: number): void =>
    setSort((s) =>
      s.by === by ? { by, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { by, dir: 'desc' }
    )
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <Segmented label="Players" value={size} options={UNIT_SIZES} onChange={setSize} />
        <StatsSelect
          title="Minimum possessions"
          value={floor}
          options={FLOORS}
          onChange={setFloor}
        />
      </div>
      {!value ? (
        <Loading error={error} />
      ) : rows.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          {value.units.length === 0
            ? 'No group of these players in these games.'
            : `No group has played ${floor} possessions. Lower the minimum to see them.`}
        </p>
      ) : (
        <>
          <p className="m-0 text-[12px] text-fg-3">
            {shown.length < rows.length
              ? `${shown.length} of ${rows.length} groups`
              : `${rows.length} groups`}
          </p>
          <div className="overflow-x-auto">
            <MiniTable
              label="Derived lineups"
              columns={`minmax(${size === '5' ? 330 : 220}px,2.4fr) ${LINE_GRID}`}
              minWidth={360 + LINE_COLUMNS.length * 62}
              head={[
                'Players',
                ...LINE_COLUMNS.map((c, i) => (
                  <button
                    type="button"
                    key={c.label}
                    title={c.title}
                    onClick={() => sortBy(i)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap hover:text-fg',
                      sort.by === i && 'font-semibold text-fg'
                    )}
                  >
                    {c.label}
                    {sort.by === i &&
                      (sort.dir === 'desc' ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUp className="size-3" />
                      ))}
                  </button>
                ))
              ]}
              rows={shown.map((r) => ({
                key: r.key,
                cells: [
                  <span
                    key="p"
                    className="flex min-w-0 flex-wrap gap-x-2.5 font-sans text-[12.5px]"
                  >
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
                  ...r.cells
                ]
              }))}
            />
          </div>
          {rows.length > UNIT_LIMIT && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
            >
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
      <Notes
        notes={[
          DERIVED_NOTE,
          size === '5'
            ? 'Every unit of five distinct players the lineups know, in every season from 1996-97.'
            : 'A group counts whatever the rest of the floor was, so groups overlap: their minutes add up to more than the team’s.'
        ]}
      />
    </>
  )
}

/** The player dashboard's with-or-without: their team with a picked teammate on and off the floor. */
export function WithOrWithout({
  data,
  scope,
  player,
  playerName,
  onOpenPlayer
}: {
  data: StatsData
  scope: StatsScope
  player: string
  playerName: string
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const gap = onCourtGap(scope)
  const [mate, setMate] = useState<string | null>(null)
  const read = useMemo(() => onCourtScope(scope), [scope])
  const { value, error } = useWithOrWithout(
    gap ? null : player,
    mate,
    scope.season,
    read,
    data.version
  )
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title="With or without" note="Their team, in the games both played" />
      {gap ? (
        <p className="m-0 text-[12.5px] text-fg-3">{gap}</p>
      ) : !value ? (
        <Loading error={error} />
      ) : value.teammates.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          No teammate on the floor with them in these games.
        </p>
      ) : (
        <>
          <StatsSelect
            title="Teammate"
            value={value.teammate ?? ''}
            options={value.teammates.map((t) => ({
              value: t.id,
              label: `${t.name} · ${fmtStat(t.minutes, { unit: 'count', decimals: 0 })} min together`
            }))}
            onChange={(id) => setMate(id)}
            className="self-start"
          />
          <div className="overflow-x-auto">
            <MiniTable
              label="With or without"
              columns={`minmax(220px,2fr) ${LINE_GRID}`}
              minWidth={260 + LINE_COLUMNS.length * 62}
              head={['On the floor', ...LINE_COLUMNS.map((c) => c.label)]}
              rows={wowyRows(value, playerName).map((r) => ({
                key: r.key,
                cells: [
                  <span key="l" className="font-sans text-[12.5px] font-medium">
                    {r.label}
                  </span>,
                  ...(r.cells ?? LINE_COLUMNS.map(() => '—'))
                ]
              }))}
            />
          </div>
          {value.teammate && (
            <button
              type="button"
              onClick={() => onOpenPlayer(value.teammate ?? '')}
              className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
            >
              Open the teammate’s dashboard
            </button>
          )}
          <Notes notes={[DERIVED_NOTE]} />
        </>
      )}
    </section>
  )
}

/** The team dashboard's On/off tab: each player's team numbers on and off the floor. */
export function TeamOnOff({
  data,
  scope,
  team,
  onOpenPlayer
}: {
  data: StatsData
  scope: StatsScope
  team: string
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const gap = onCourtGap(scope)
  const q = useMemo(() => teamOnOffQuery(team, scope), [team, scope])
  const { result, error } = useStatsQuery(gap ? null : q, data.version)
  const columns = result?.columns ?? []
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title="On and off the floor" note="Each player’s team, with them on and off" />
      {gap ? (
        <p className="m-0 text-[12.5px] text-fg-3">{gap}</p>
      ) : !result ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <MiniTable
              label="On and off"
              columns={`minmax(170px,1.6fr) repeat(${TEAM_ON_OFF_METRICS.length}, minmax(56px,1fr))`}
              minWidth={200 + TEAM_ON_OFF_METRICS.length * 66}
              head={[
                'Player',
                ...columns.map((c) => (
                  <span key={c.id} title={c.label}>
                    {c.short}
                  </span>
                ))
              ]}
              rows={result.rows
                .filter((r) => (r.values.onc_min?.value ?? 0) > 0)
                .map((r) => ({
                  key: r.id,
                  title: `Open ${r.name}’s dashboard`,
                  onOpen: () => onOpenPlayer(r.id),
                  cells: [
                    <span key="n" className="font-sans text-[13px] font-medium">
                      {r.name}
                    </span>,
                    ...columns.map((c) => {
                      const v = r.values[c.id]?.value ?? null
                      if (c.id === 'onc_min')
                        return <span key={c.id}>{fmtStat(v, { unit: 'count', decimals: 0 })}</span>
                      return (
                        <span key={c.id}>{fmtStat(v, { unit: c.unit, decimals: c.decimals })}</span>
                      )
                    })
                  ]
                }))}
            />
          </div>
          <Notes
            notes={[
              DERIVED_NOTE,
              'Off the floor counts the rest of each player’s own games, not games they missed.',
              ...result.notes
            ]}
          />
        </>
      )}
    </section>
  )
}
