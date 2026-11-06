import { StatsSelect } from '@/components/stats/controls'
import {
  LAST_N,
  moveToSeason,
  seasonOf,
  seasonTypes,
  typeLabel,
  type StatsRange,
  type StatsScope
} from '@/lib/stats/scope'
import { seasonLabel } from '@shared/stats/seasons'
import type { Entity, StatsSeason } from '@shared/stats/types'

const DATE_INPUT =
  'h-7 cursor-pointer rounded-[6px] border border-line bg-panel px-1.5 text-[12.5px] text-fg'

/** The controls every stats screen shares: season, season type, and a date range or the last N games. */
export function ScopeBar({
  scope,
  seasons,
  entity = 'player',
  onChange
}: {
  scope: StatsScope
  seasons: StatsSeason[]
  /** Last N of the team's games is a choice for players only. */
  entity?: Entity
  onChange: (scope: StatsScope) => void
}): React.JSX.Element {
  const season = seasonOf(seasons, scope.season)
  const r = scope.range
  const setRange = (range: StatsRange): void => onChange({ ...scope, range })
  const pickRange = (kind: StatsRange['kind']): void => {
    if (kind === 'season') setRange({ kind })
    if (kind === 'last') setRange({ kind, n: 10, of: 'appearances' })
    if (kind === 'dates' && season) {
      setRange({ kind, from: season.firstDate, to: season.lastDate })
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-3">
      <StatsSelect
        title="Season"
        value={scope.season}
        options={seasons.map((s) => ({ value: s.season, label: seasonLabel(s.season) }))}
        onChange={(s) => onChange(moveToSeason(scope, s, seasons))}
      />
      <StatsSelect
        title="Season type"
        value={scope.seasonType}
        options={seasonTypes(season).map((t) => ({ value: t, label: typeLabel(t) }))}
        onChange={(seasonType) => onChange({ ...scope, seasonType })}
      />
      <StatsSelect
        title="Range"
        value={r.kind}
        options={[
          { value: 'season' as const, label: 'Whole season' },
          { value: 'dates' as const, label: 'Dates' },
          { value: 'last' as const, label: 'Last games' }
        ]}
        onChange={pickRange}
      />
      {r.kind === 'dates' && (
        <>
          <input
            type="date"
            aria-label="From date"
            title="From date"
            className={DATE_INPUT}
            value={r.from}
            min={season?.firstDate}
            max={r.to}
            onChange={(e) => e.target.value && setRange({ ...r, from: e.target.value })}
          />
          <span>to</span>
          <input
            type="date"
            aria-label="To date"
            title="To date"
            className={DATE_INPUT}
            value={r.to}
            min={r.from}
            max={season?.lastDate}
            onChange={(e) => e.target.value && setRange({ ...r, to: e.target.value })}
          />
        </>
      )}
      {r.kind === 'last' && (
        <>
          <StatsSelect
            title="How many games"
            value={r.n}
            options={LAST_N.map((n) => ({ value: n, label: String(n) }))}
            onChange={(n) => setRange({ ...r, n })}
          />
          {entity === 'player' && (
            <StatsSelect
              title="Whose games"
              value={r.of}
              options={[
                { value: 'appearances' as const, label: 'Their games' },
                { value: 'team' as const, label: "Their team's games" }
              ]}
              onChange={(of) => setRange({ ...r, of })}
            />
          )}
        </>
      )}
    </div>
  )
}
