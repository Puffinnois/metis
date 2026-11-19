import { useMemo } from 'react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { MetricHead } from '@/components/stats/MetricCard'
import { Loading, MiniTable, Notes, SectionHead } from '@/components/stats/parts'
import { useScreenState } from '@/lib/stats/session'
import { moveToSeason, type StatsScope } from '@/lib/stats/scope'
import {
  forecastCells,
  forecastNote,
  forecastQuery,
  HEAD_METRICS,
  standingsColumns,
  standingsHead,
  standingsNotes,
  standingsTables,
  standingsViews,
  strengthCells,
  strengthQuery,
  type StandingsView
} from '@/lib/stats/standings'
import { useStandings, useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { inProgress as seasonInProgress } from '@/lib/stats/trends'
import { currentLeague, seasonLabel } from '@/lib/stats/league'

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
  const [view, setView] = useScreenState<StandingsView>('standings', 'view', 'conference')
  const { value: rows, error } = useStandings(scope.season, data.version)
  // Metis's own columns, beside the published ones; blank until they answer.
  const sq = useMemo(() => strengthQuery(scope.season), [scope.season])
  const strength = strengthCells(useStatsQuery(sq, data.version, { keepLast: false }).result)
  // The season forecast, for the season in progress only (`forecastQuery` says why): not one the
  // league has finished, though the data runs through it (the WNBA's in November).
  const inProgress = seasonInProgress(scope.season, data.status)
  // A league with no models fitted (the college leagues until T1302.8) has no forecast to show.
  const forecasts = currentLeague().models !== null
  const fq = useMemo(
    () => (inProgress && forecasts ? forecastQuery(scope.season) : null),
    [inProgress, forecasts, scope.season]
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
            {currentLeague().standingsWords ??
              `Regular season, as the ${currentLeague().name} publishes it`}
            {inProgress ? ', to date' : ''}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatsSelect
            title="Season"
            value={scope.season}
            options={data.seasons.map((s) => ({ value: s.season, label: seasonLabel(s.season) }))}
            onChange={(s) => onScope(moveToSeason(scope, s, data.seasons))}
          />
          {standingsViews(rows).length > 1 && (
            <Segmented
              label="Conference or division"
              value={view}
              options={[
                { value: 'conference' as const, label: 'Conference' },
                { value: 'division' as const, label: 'Division' }
              ]}
              onChange={setView}
            />
          )}
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
                  columns={standingsColumns(forecast, rows)}
                  minWidth={forecast ? 1400 : 1200}
                  head={standingsHead(forecast, rows).map((h) =>
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
              ...(forecast ? [forecastNote(forecast.runs, scope.season)] : [])
            ]}
          />
        </div>
      )}
    </div>
  )
}
