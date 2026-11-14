import { useMemo, useState } from 'react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { MetricHead } from '@/components/stats/MetricCard'
import { Loading, MiniTable, Notes, SectionHead } from '@/components/stats/parts'
import { moveToSeason, type StatsScope } from '@/lib/stats/scope'
import {
  forecastCells,
  forecastNote,
  forecastQuery,
  HEAD_METRICS,
  standingsHead,
  standingsNotes,
  standingsTables,
  strengthCells,
  strengthQuery,
  type StandingsView
} from '@/lib/stats/standings'
import { useStandings, useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { seasonLabel } from '@shared/stats/seasons'

const COLUMNS =
  '24px minmax(190px,1.6fr) 32px 32px 44px 40px 52px 52px 52px 52px 44px 44px 48px 48px 48px 56px 52px 52px 52px'
/** The forecast's three: the projected record and two odds (Plan T1003). */
const FORECAST_COLUMNS = ' 56px 64px 56px'

/** The published standings of a season, by conference or by division. */
export function StatsStandings({
  data,
  scope,
  onScope,
  onOpenTeam
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  onOpenTeam: (team: string) => void
}): React.JSX.Element {
  const [view, setView] = useState<StandingsView>('conference')
  const { value: rows, error } = useStandings(scope.season, data.version)
  // Metis's own columns, beside the published ones; blank until they answer.
  const sq = useMemo(() => strengthQuery(scope.season), [scope.season])
  const strength = strengthCells(useStatsQuery(sq, data.version, { keepLast: false }).result)
  // The season forecast, for the season in progress only (`forecastQuery` says why).
  const inProgress = scope.season === data.status?.through?.season
  const fq = useMemo(
    () => (inProgress ? forecastQuery(scope.season) : null),
    [inProgress, scope.season]
  )
  const forecast = forecastCells(useStatsQuery(fq, data.version, { keepLast: false }).result)
  return (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-8">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] leading-none font-bold tracking-[-0.03em]">
            {seasonLabel(scope.season)} standings
          </h1>
          <div className="text-[13px] text-fg-2">
            Regular season, as the NBA publishes it
            {scope.season === data.status?.through?.season ? ', to date' : ''}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatsSelect
            title="Season"
            value={scope.season}
            options={data.seasons.map((s) => ({ value: s.season, label: seasonLabel(s.season) }))}
            onChange={(s) => onScope(moveToSeason(scope, s, data.seasons))}
          />
          <Segmented
            label="Conference or division"
            value={view}
            options={[
              { value: 'conference' as const, label: 'Conference' },
              { value: 'division' as const, label: 'Division' }
            ]}
            onChange={setView}
          />
        </div>
      </header>
      {!rows ? (
        <Loading error={error} />
      ) : (
        <div className="flex flex-col gap-6">
          {standingsTables(rows, view, strength, forecast).map((t) => (
            <section key={t.title} className="flex flex-col gap-1">
              <SectionHead title={t.title} />
              <div className="overflow-x-auto">
                <MiniTable
                  label={`${t.title} standings`}
                  columns={forecast ? COLUMNS + FORECAST_COLUMNS : COLUMNS}
                  minWidth={forecast ? 1400 : 1200}
                  head={standingsHead(forecast).map((h) =>
                    HEAD_METRICS[h] ? (
                      <MetricHead key={h} id={h} label={h} info={data.byId.get(HEAD_METRICS[h])} />
                    ) : (
                      h
                    )
                  )}
                  left={[1]}
                  rows={t.rows.map((r) => ({
                    key: r.key,
                    title: `Open the ${r.name}`,
                    onOpen: () => onOpenTeam(r.teamId),
                    cells: [
                      <span key="r" className="text-fg-3">
                        {r.rank}
                      </span>,
                      <span key="n" className="font-sans text-[13px] font-medium">
                        {r.name}
                      </span>,
                      ...r.cells
                    ]
                  }))}
                />
              </div>
            </section>
          ))}
          <Notes
            notes={[
              ...standingsNotes(scope.season, rows),
              ...(forecast ? [forecastNote(forecast.runs)] : [])
            ]}
          />
        </div>
      )}
    </div>
  )
}
