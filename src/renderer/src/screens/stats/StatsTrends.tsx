import { useId, useState } from 'react'
import { Segmented } from '@/components/stats/controls'
import { Loading } from '@/components/stats/parts'
import { TrendChart } from '@/components/stats/TrendChart'
import { DASHBOARD_MODES } from '@/lib/stats/dashboard'
import { familyLabel, fmtStat, isRescaled } from '@/lib/stats/format'
import { typeLabel, type StatsScope } from '@/lib/stats/scope'
import {
  careerSpan,
  coverageStart,
  hoverLines,
  mergePool,
  poolNote,
  poolParts,
  refineParts,
  playerOptions,
  playerSearchQuery,
  poolQueries,
  scopeNote,
  subjectQuery,
  teamOptions,
  teamsBySeason,
  teamsQuery,
  trendBand,
  trendLine,
  trendMetric,
  trendMetrics,
  trendNotes,
  trendRows,
  trendSeasons,
  type SearchOption,
  trendSubject,
  type TrendSubject,
  type TrendRow,
  type TrendsState
} from '@/lib/stats/trends'
import { useStatsQueries, useStatsQuery, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import { seasonLabel } from '@shared/stats/seasons'
import { coverageReason } from '@shared/stats/coverage'

const FRESH = { keepLast: false }

/** A search box over a datalist: picking a name opens it. */
function Search({
  options,
  placeholder,
  onPick
}: {
  options: SearchOption[]
  placeholder: string
  onPick: (id: string) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const list = useId()
  return (
    <>
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        list={list}
        value={text}
        onChange={(e) => {
          const hit = options.find((o) => o.label === e.target.value)
          if (hit) {
            onPick(hit.id)
            setText('')
          } else setText(e.target.value)
        }}
        className="h-7 w-[240px] rounded-[6px] border border-line bg-panel px-2.5 text-[12.5px] text-fg placeholder:text-fg-3"
      />
      <datalist id={list}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
    </>
  )
}

export interface TrendsProps {
  data: StatsData
  scope: StatsScope
  state: TrendsState
  onState: (update: (state: TrendsState) => TrendsState) => void
  /** Who Trends shows when nobody is picked: the player or team a dashboard showed last. */
  fallback: TrendSubject | null
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
}

/**
 * Trends: one metric by season across a player's career or a team's history in the data, against
 * the league each season (its qualified pool's median and middle bands), each season ranked in its
 * own pool, with the metric's coverage stated. The scope bar's season type applies; its season and
 * range do not, since a career is every season.
 */
export function StatsTrends({
  data,
  scope,
  state,
  onState,
  fallback,
  onOpenPlayer,
  onOpenTeam
}: TrendsProps): React.JSX.Element {
  const subjectNow = trendSubject(state, fallback)
  const entity = subjectNow?.entity ?? state.entity
  const id = subjectNow?.id ?? null
  const isPlayer = entity === 'player'
  // A choice here keeps the subject shown (a new metric is theirs), even if the dashboards move on.
  const set = (next: Partial<TrendsState>): void =>
    onState((s) => ({ ...s, subject: subjectNow, ...next }))

  // The React compiler memoizes these; the queries are keyed on their text, so a new object with
  // the same text runs nothing again.
  const groups = trendMetrics(entity, data.catalogue)
  const metric = trendMetric(state.metric, entity, data.byId, data.catalogue)
  const info = metric ? data.byId.get(metric) : undefined
  const mode = info && isRescaled(info, state.mode) ? state.mode : 'raw'
  const seasons = trendSeasons(data.status)

  // Nothing to search before the catalogue is in.
  const { result: everyone } = useStatsQuery(
    isPlayer && data.catalogue.length ? playerSearchQuery(seasons) : null,
    data.version
  )
  const options = isPlayer ? playerOptions(everyone) : teamOptions(data.seasons)

  const subjectQ = id && metric ? subjectQuery(entity, id, metric, seasons, scope, mode) : null
  const { result: subject, error: subjectError } = useStatsQuery(subjectQ, data.version, FRESH)
  const span = careerSpan(subject, seasons)
  // The pool in parts; a part cut off at the row limit is asked for again in halves (kept for
  // this subject, metric and scope only).
  const poolKey = JSON.stringify([entity, metric, mode, scope.seasonType, span])
  const [refined, setRefined] = useState<{ key: string; parts: number[][] } | null>(null)
  const parts = refined?.key === poolKey ? refined.parts : poolParts(entity, span)
  const poolQs = metric && parts.length ? poolQueries(entity, metric, parts, scope, mode) : null
  const { results: poolResults, error: poolError } = useStatsQueries(poolQs, data.version)
  const halves = poolResults ? refineParts(parts, poolResults) : null
  if (halves) setRefined({ key: poolKey, parts: halves })
  const pool = halves ? null : mergePool(poolResults)
  const teamsQ = isPlayer && id && span.length ? teamsQuery(id, span, scope) : null
  const { result: teamRows } = useStatsQuery(teamsQ, data.version, FRESH)
  const teams = teamsBySeason(teamRows)

  const f = {
    unit: info?.unit ?? 'number',
    decimals: info?.decimals ?? 1,
    aggregation: info?.aggregation,
    totalOnly: info?.totalOnly,
    perGameOnly: info?.perGameOnly
  }
  const fmt = (v: number): string => fmtStat(v, f, mode)
  const rows = pool?.rows ?? []
  const unavailable = pool?.unavailable ?? new Set<number>()
  const points = metric
    ? trendLine(subject, rows, id ?? '', metric, span, entity, info, teams, unavailable)
    : []
  const band = metric ? trendBand(rows, metric, span, entity, unavailable) : []
  const column = subject?.columns.find((c) => c.id === metric)
  const notes = [
    ...trendNotes(info, span, mode, data.status, column?.reason ?? null),
    ...[poolNote(unavailable)].filter((n): n is string => n !== null)
  ]
  const start = coverageStart(info, span)
  const startNote =
    start !== null && info
      ? coverageReason(
          info,
          span.filter((s) => s < start)
        )
      : null
  const table = trendRows(points, info, mode)
  const name =
    [...(subject?.rows ?? [])].reverse().find((r) => r.name)?.name ??
    options.find((o) => o.id === id)?.label.split(' · ')[isPlayer ? 0 : 1] ??
    id ??
    ''
  const error = subjectError ?? poolError
  const ranked = points.filter((p) => p.rank !== null).length
  const lower = info?.direction === 'lower'

  return (
    <div className="flex flex-col gap-4" data-subject={id ? `${entity}:${id}` : ''}>
      <div className="flex flex-wrap items-center gap-3.5">
        <Segmented
          label="Players or teams"
          value={entity}
          options={[
            { value: 'player', label: 'Players' },
            { value: 'team', label: 'Teams' }
          ]}
          onChange={(e) => set({ entity: e, subject: null, metric: null, follow: false })}
        />
        <Search
          options={options}
          placeholder={isPlayer ? 'Find a player' : 'Find a team'}
          onPick={(x) => set({ subject: { entity, id: x } })}
        />
        <select
          aria-label="Metric"
          title="Metric"
          value={metric ?? ''}
          onChange={(e) => set({ metric: e.target.value })}
          className="h-7 max-w-[280px] cursor-pointer rounded-[6px] border border-line bg-panel px-1.5 text-[12.5px] font-medium text-fg"
        >
          {groups.map((g) => (
            <optgroup key={g.family} label={familyLabel(g.family)}>
              {g.metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {info && isRescaled(info, 'perGame') && (
          <Segmented
            label="Totals or rates"
            value={state.mode}
            options={DASHBOARD_MODES.filter((m) => m.value === 'raw' || isRescaled(info, m.value))}
            onChange={(m) => set({ mode: m })}
          />
        )}
      </div>
      <p className="m-0 text-[11.5px] text-fg-3" data-scope-note="">
        {scopeNote(typeLabel(scope.seasonType))}
      </p>
      {!id ? (
        <div className="py-16 text-center text-[13px] text-fg-3">
          {isPlayer ? 'Find a player to see their seasons.' : 'Find a team to see its seasons.'}
        </div>
      ) : error ? (
        <Loading error={error} />
      ) : !subject || (span.length > 0 && !pool) ? (
        <Loading />
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="flex items-baseline gap-3">
              <h1 className="m-0 truncate text-[24px] leading-none font-bold tracking-[-0.03em]">
                {name}
              </h1>
              <button
                type="button"
                onClick={() => (isPlayer ? onOpenPlayer(id) : onOpenTeam(id))}
                className="cursor-pointer text-[12px] font-medium text-cobalt hover:underline"
              >
                {isPlayer ? 'Player dashboard →' : 'Team dashboard →'}
              </button>
            </div>
            <div className="text-[12.5px] text-fg-2">
              {span.length
                ? `${seasonLabel(span[0])} to ${seasonLabel(span[span.length - 1])} · ${typeLabel(scope.seasonType)}`
                : `No games in the ${typeLabel(scope.seasonType).toLowerCase()} since ${seasonLabel(seasons[0])}.`}
            </div>
          </div>
          {span.length > 0 && (
            <div className="rounded-[10px] bg-panel px-2 pt-3 pb-1 shadow-[0_0_0_1px_var(--line)]">
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-2 pb-1">
                <span className="text-[11.5px] font-medium text-fg-2">
                  {info?.label}
                  {lower ? ' ↓ lower is better' : ''} · by season
                  {ranked > 0 ? ` · ranked among qualified ${isPlayer ? 'players' : 'teams'}` : ''}
                </span>
                {notes.length > 0 && (
                  <span className="text-[11px] font-medium text-warn" data-trend-notes="">
                    {notes.join(' ')}
                  </span>
                )}
              </div>
              <TrendChart
                points={points}
                band={band}
                format={fmt}
                label={`${info?.label ?? metric} by season`}
                flip={lower}
                coverage={start !== null && startNote ? { season: start, note: startNote } : null}
                hoverInfo={(season) => {
                  const p = points.find((x) => x.season === season)
                  return p
                    ? hoverLines(p, entity, fmt, band.find((b) => b.season === season) ?? null)
                    : null
                }}
              />
            </div>
          )}
          {span.length > 0 && (
            <SeasonTable rows={table} label={info?.label ?? ''} isPlayer={isPlayer} />
          )}
        </>
      )}
    </div>
  )
}

function SeasonTable({
  rows,
  label,
  isPlayer
}: {
  rows: TrendRow[]
  label: string
  isPlayer: boolean
}): React.JSX.Element {
  const cols = isPlayer
    ? 'grid-cols-[64px_minmax(0,1fr)_40px_64px_minmax(0,1fr)_minmax(0,1.2fr)]'
    : 'grid-cols-[64px_40px_minmax(0,1fr)_minmax(0,1.2fr)]'
  const head = [
    'Season',
    ...(isPlayer ? ['Team'] : []),
    'G',
    ...(isPlayer ? ['Min'] : []),
    label,
    'Rank'
  ]
  return (
    <div
      className="overflow-hidden rounded-[10px] bg-panel shadow-[0_0_0_1px_var(--line)]"
      role="table"
      aria-label="Seasons"
    >
      <div
        role="row"
        className={cn(
          'grid h-8 items-center gap-2.5 border-b border-line px-3.5 font-mono text-[11px] tracking-[0.04em] text-fg-3 uppercase',
          cols
        )}
      >
        {head.map((h, i) => (
          <span
            key={i}
            role="columnheader"
            className={cn('truncate', i > (isPlayer ? 1 : 0) && 'text-right')}
          >
            {h}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.season}
          role="row"
          data-season-row={r.season}
          className={cn(
            'grid h-[32px] items-center gap-2.5 border-b border-line-2 px-3.5 last:border-b-0',
            cols,
            (!r.qualified || !r.played) && 'text-fg-3'
          )}
        >
          <span role="cell" className="font-mono text-[12px] font-semibold">
            {r.label}
          </span>
          {isPlayer && (
            <span role="cell" className="truncate font-mono text-[11.5px] text-fg-2">
              {r.teams}
            </span>
          )}
          <span role="cell" className="text-right font-mono text-[12px]">
            {r.games}
          </span>
          {isPlayer && (
            <span role="cell" className="text-right font-mono text-[12px]">
              {r.minutes}
            </span>
          )}
          <span
            role="cell"
            className="text-right font-mono text-[12.5px] font-semibold tabular-nums"
          >
            {r.value}
          </span>
          <span role="cell" className="truncate text-right text-[12px]">
            {r.rank}
          </span>
        </div>
      ))}
    </div>
  )
}
