import { useRef, useState } from 'react'
import { Segmented } from '@/components/stats/controls'
import { Loading, SectionHead } from '@/components/stats/parts'
import { seasonLabel } from '@/lib/stats/league'
import {
  emptyLine,
  fmtDate,
  fmtRating,
  monthTicks,
  nearestPoint,
  offeredParts,
  pointLines,
  RATING_PARTS,
  RATING_RANGES,
  ratingAxis,
  seasonRuns,
  seriesName,
  importsNote,
  labelsPoints,
  marksPoints,
  showsPoints,
  valueDomain,
  shownSeries,
  stopNote,
  type RatingHistory,
  type RatingPart,
  type RatingRange
} from '@/lib/stats/ratingHistory'
import { axisTicks, labelEvery } from '@/lib/stats/trends'

/** A series' colour by its place in the list, the comparison palette. */
const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)']
const colorOf = (i: number): string => COLORS[i % COLORS.length]

const TITLE = 'Ratings over time'

/**
 * A player's ratings over time (Plan T1704): one line a series, each named with its maker, by date,
 * over the season in scope or the career. Within a season a series is joined point to point; across
 * a summer it is not, and each season of a career gets an equal stretch so the off-seasons are gaps.
 * A snapshot series shows its points, so a few imports read as a few points. Built on Trends' chart:
 * its value ticks, season labels, palette and hover card; the axis is a date, not a season.
 */
export function RatingHistoryChart({
  history,
  error,
  season,
  latest
}: {
  history: RatingHistory | null
  error?: string | null
  /** The season in scope, by its final year. */
  season: number
  /** The league's latest season, to say where a series stops. */
  latest: number | null
}): React.JSX.Element {
  const [range, setRange] = useState<RatingRange>('career')
  const [asked, setPart] = useState<RatingPart>('total')
  const [hover, setHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  if (!history) {
    return (
      <section className="flex flex-col gap-2.5" aria-label={TITLE}>
        <SectionHead title={TITLE} />
        <Loading error={error ?? null} />
      </section>
    )
  }
  const parts = offeredParts(history)
  const part = parts.includes(asked) ? asked : 'total'
  const shown = shownSeries(history, range, season, part)
  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Range"
        value={range}
        options={RATING_RANGES.map((r) => ({ value: r.id, label: r.label }))}
        onChange={(v) => {
          setRange(v)
          setHover(null)
        }}
      />
      {parts.length > 1 && (
        <Segmented
          label="Part"
          value={part}
          options={RATING_PARTS.filter((p) => parts.includes(p.id)).map((p) => ({
            value: p.id,
            label: p.label
          }))}
          onChange={setPart}
        />
      )}
    </div>
  )
  if (shown.length === 0) {
    return (
      <section className="flex flex-col gap-3" aria-label={TITLE} data-rating-history="empty">
        <SectionHead title={TITLE} />
        {history.series.length > 0 && head}
        <p className="m-0 text-[12.5px] text-fg-3" role="status">
          {emptyLine(history, range, season)}
        </p>
      </section>
    )
  }

  const axis = ratingAxis(shown)
  const W = 1200
  const H = 320
  const [L, R, T, B] = [56, 20, 18, 40]
  const values = shown.flatMap((s) => s.points.map((p) => p[part] as number))
  const domain = valueDomain(values)
  let { lo, hi } = domain
  const ys = axisTicks(lo, hi)
  lo = Math.min(lo, ys[0])
  hi = Math.max(hi, ys[ys.length - 1])
  const x = (date: string, s: number): number => L + axis.x(date, s) * (W - L - R)
  const y = (v: number): number => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B)
  const every = labelEvery(axis.seasons.length)

  const near =
    hover === null
      ? []
      : shown
          .map((s, i) => ({ s, i, p: nearestPoint(s, axis, hover) }))
          .filter((n): n is typeof n & { p: NonNullable<typeof n.p> } => n.p !== null)
  const hoverX = near.length ? x(near[0].p.date, near[0].p.season) : null
  const onMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    const at = (((e.clientX - box.left) / box.width) * W - L) / (W - L - R)
    setHover(at)
  }

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={TITLE}
      data-rating-history={shown.map((s) => s.series.id).join(' ')}
    >
      <SectionHead title={TITLE} note="Zero is the league's average player" />
      {head}
      <figure className="m-0 flex flex-col gap-2">
        <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 px-2 text-[11.5px] text-fg-3">
          {shown.map((s, i) => {
            const stop = stopNote(s.series, latest)
            return (
              <span
                key={s.series.id}
                className="flex items-center gap-1.5"
                data-series={s.series.id}
              >
                <span
                  className={showsPoints(s.series) ? 'size-2 rounded-full' : 'h-[3px] w-3.5'}
                  style={{ background: colorOf(i) }}
                />
                <span className="text-fg-2">{seriesName(s.series)}</span>
                {importsNote(s.series, s.points) && (
                  <span data-series-imports="">· {importsNote(s.series, s.points)}</span>
                )}
                {stop && <span data-series-stop="">· {stop}</span>}
              </span>
            )
          })}
        </figcaption>
        <div className="relative">
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`${TITLE}: ${shown.map((s) => seriesName(s.series)).join(', ')}`}
            className="block overflow-visible"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {ys.map((v) => (
              <g key={v}>
                <line
                  x1={L}
                  x2={W - R}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--line-2)"
                  strokeWidth={1}
                />
                <text
                  x={L - 8}
                  y={y(v) + 4}
                  textAnchor="end"
                  className="fill-fg-3 font-mono text-[10.5px]"
                >
                  {fmtRating(v)}
                </text>
              </g>
            ))}
            {domain.zero && (
              // Zero is the league's average player: a little stronger than the grid, named once.
              <g data-average="">
                <line
                  x1={L}
                  x2={W - R}
                  y1={y(0)}
                  y2={y(0)}
                  stroke="var(--fg-3)"
                  strokeWidth={1.25}
                />
                <text
                  x={W - R}
                  y={y(0) - 5}
                  textAnchor="end"
                  className="fill-fg-3 text-[10.5px] font-medium"
                >
                  average
                </text>
              </g>
            )}
            {range === 'career'
              ? axis.seasons.map((s, i) => (
                  <g key={s.season} data-axis-season={s.season}>
                    {i > 0 && (
                      <line
                        x1={L + (s.start - (s.start - axis.seasons[i - 1].end) / 2) * (W - L - R)}
                        x2={L + (s.start - (s.start - axis.seasons[i - 1].end) / 2) * (W - L - R)}
                        y1={T}
                        y2={H - B}
                        stroke="var(--line-2)"
                        strokeDasharray="2 3"
                      />
                    )}
                    {i % every === 0 && (
                      <text
                        x={L + ((s.start + s.end) / 2) * (W - L - R)}
                        y={H - B + 18}
                        textAnchor="middle"
                        className="fill-fg-2 font-mono text-[10.5px]"
                      >
                        {seasonLabel(s.season)}
                      </text>
                    )}
                  </g>
                ))
              : monthTicks(axis.seasons[0]).map((m) => (
                  <text
                    key={m.date}
                    x={x(m.date, axis.seasons[0].season)}
                    y={H - B + 18}
                    textAnchor="middle"
                    className="fill-fg-2 font-mono text-[10.5px]"
                  >
                    {m.label}
                  </text>
                ))}
            {hoverX !== null && (
              <line x1={hoverX} x2={hoverX} y1={T} y2={H - B} stroke="var(--line)" />
            )}
            {shown.map((s, i) => {
              const dots = showsPoints(s.series)
              const marks = marksPoints(s.series, range, axis.seasons.length)
              return (
                <g key={s.series.id} data-series-line={s.series.id}>
                  {seasonRuns(s.points).map((run) => (
                    <path
                      key={run[0].date}
                      d={run
                        .map(
                          (p, k) =>
                            `${k ? 'L' : 'M'}${x(p.date, p.season).toFixed(1)} ${y(p[part] as number).toFixed(1)}`
                        )
                        .join('')}
                      fill="none"
                      stroke={colorOf(i)}
                      strokeWidth={dots ? 1.5 : 2}
                      strokeDasharray={dots ? '3 3' : undefined}
                      strokeLinejoin="miter"
                    />
                  ))}
                  {s.points.map((p) =>
                    marks || near.some((n) => n.i === i && n.p === p) ? (
                      <circle
                        key={p.date}
                        cx={x(p.date, p.season)}
                        cy={y(p[part] as number)}
                        r={dots ? 4.5 : near.some((n) => n.p === p) ? 4 : 2.5}
                        fill={colorOf(i)}
                        stroke="var(--panel)"
                        strokeWidth={1.5}
                        data-point={p.date}
                      />
                    ) : null
                  )}
                  {/* One or two imports are labelled where they stand, so they read as dated values. */}
                  {labelsPoints(s.series, s.points) &&
                    s.points.map((p) => (
                      <text
                        key={`label-${p.date}`}
                        x={x(p.date, p.season) + (x(p.date, p.season) > W * 0.7 ? -9 : 9)}
                        y={y(p[part] as number) - 8}
                        textAnchor={x(p.date, p.season) > W * 0.7 ? 'end' : 'start'}
                        className="text-[11px] font-medium"
                        style={{ fill: colorOf(i) }}
                        data-point-label={p.date}
                      >
                        {fmtRating(p[part] as number)} · {fmtDate(p.date)}
                      </text>
                    ))}
                </g>
              )
            })}
          </svg>
          {hoverX !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-2 z-10 flex w-[280px] flex-col gap-2 rounded-[9px] bg-panel px-3 py-2.5 text-[11.5px] shadow-[0_0_0_1px_var(--line),0_10px_28px_var(--shadow-c)]"
              style={
                hoverX > W * 0.62
                  ? { right: `${(1 - (hoverX - 18) / W) * 100}%` }
                  : { left: `${((hoverX + 18) / W) * 100}%` }
              }
            >
              {near.map((n) => {
                const [name, ...rest] = pointLines(n.s.series, n.p, part)
                return (
                  <div key={n.s.series.id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 font-semibold text-fg">
                      <span className="size-2 rounded-full" style={{ background: colorOf(n.i) }} />
                      {name}
                    </span>
                    {rest.map((l) => (
                      <span key={l} className="text-fg-2">
                        {l}
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </figure>
      {/* What each series covers and lacks, as the read words it. */}
      <div className="flex flex-col gap-0.5 text-[12px] text-fg-3" data-series-notes="">
        {shown.map((s) => (
          <p key={s.series.id} className="m-0">
            <span className="text-fg-2">{seriesName(s.series)}.</span> {s.series.notes.join(' ')}
          </p>
        ))}
      </div>
    </section>
  )
}
