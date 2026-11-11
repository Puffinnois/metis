import { useState } from 'react'
import type { BandPoint, TrendPoint } from '@/lib/stats/trends'
import { seasonLabel } from '@shared/stats/seasons'

const COLOR = 'var(--s1)'

/** Round tick steps: 1, 2, 2.5, 5 × a power of ten. */
function ticks(lo: number, hi: number, n = 4): number[] {
  const raw = (hi - lo || 1) / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) {
    out.push(Number(v.toFixed(6)))
  }
  return out
}

/** The axis has room for about sixteen season labels. */
const labelEvery = (seasons: number): number => Math.max(1, Math.ceil(seasons / 16))

/**
 * Trends' chart: a metric by season. Behind the line, the league that season: its qualified pool's
 * 10th–90th and 25th–75th percentiles and its median, dashed. A season not qualified is a hollow
 * point; a season not played or not recorded is a gap, never a zero or a line drawn across it. Where
 * a metric starts inside the span, a rule marks the start with the metric's own reason. A
 * lower-is-better metric runs upside down, so up is always better. Built from the template's season
 * chart, without its comparison lines.
 */
export function TrendChart({
  points,
  band,
  format,
  label,
  flip = false,
  coverage,
  hoverInfo
}: {
  points: TrendPoint[]
  band: BandPoint[]
  format: (v: number) => string
  label: string
  flip?: boolean
  /** Where the metric starts inside the span, and why the seasons before are blank. */
  coverage: { season: number; note: string } | null
  hoverInfo: (season: number) => { title: string; lines: string[] } | null
}): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const seasons = points.map((p) => p.season)
  const values = [...points.map((p) => p.value), ...band.flatMap((b) => [b.p10, b.p90])].filter(
    (v): v is number => v !== null
  )
  if (!seasons.length || !values.length) {
    return (
      <div className="py-16 text-center text-[13px] text-fg-3">
        {coverage?.note ?? 'No seasons to chart.'}
      </div>
    )
  }
  const W = 1200
  const H = 340
  const [L, R, T, B] = [56, 20, 26, 40]
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1
  lo -= pad
  hi += pad
  const ys = ticks(lo, hi)
  lo = Math.min(lo, ys[0])
  hi = Math.max(hi, ys[ys.length - 1])
  const step = (W - L - R) / seasons.length
  const x = (i: number): number => L + step * (i + 0.5)
  const y = (v: number): number => {
    const t = (v - lo) / (hi - lo || 1)
    return T + (flip ? t : 1 - t) * (H - T - B)
  }
  const line = (vs: (number | null)[]): string => {
    let d = ''
    let pen = false
    vs.forEach((v, i) => {
      if (v === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }
  /** A band as areas, one per run of seasons that have it. */
  const area = (
    top: (b: BandPoint) => number | null,
    bottom: (b: BandPoint) => number | null
  ): string => {
    const runs: number[][] = []
    band.forEach((b, i) => {
      if (top(b) === null || bottom(b) === null) return
      const last = runs[runs.length - 1]
      if (last && last[last.length - 1] === i - 1) last.push(i)
      else runs.push([i])
    })
    return runs
      .map((run) => {
        // A one-season run gets a little width, so it shows.
        const xs = run.length === 1 ? [x(run[0]) - step * 0.2, x(run[0]) + step * 0.2] : null
        const upper = run.map(
          (i, k) =>
            `${k ? 'L' : 'M'}${(xs ? xs[0] : x(i)).toFixed(1)} ${y(top(band[i])!).toFixed(1)}`
        )
        if (xs) upper.push(`L${xs[1].toFixed(1)} ${y(top(band[run[0]])!).toFixed(1)}`)
        const lower = [...run]
          .reverse()
          .map((i) => `L${(xs ? xs[1] : x(i)).toFixed(1)} ${y(bottom(band[i])!).toFixed(1)}`)
        if (xs) lower.push(`L${xs[0].toFixed(1)} ${y(bottom(band[run[0]])!).toFixed(1)}`)
        return `${upper.join('')}${lower.join('')}Z`
      })
      .join('')
  }
  const every = labelEvery(seasons.length)
  const startAt = coverage ? seasons.indexOf(coverage.season) : -1
  const info = hover !== null ? hoverInfo(seasons[hover]) : null
  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-4 px-2 text-[11.5px] text-fg-3">
        <span className="flex items-center gap-1.5 text-fg-2">
          <span className="size-2 rounded-full bg-s1" />
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 border-t-[1.5px] border-dashed border-fg-3" />
          League median
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3.5 rounded-[2px] bg-fg-3/25" />
          25th–75th
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3.5 rounded-[2px] bg-fg-3/10" />
          10th–90th
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border-[1.5px] border-s1" />
          Not qualified
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={label}
          className="block overflow-visible"
          onMouseLeave={() => setHover(null)}
        >
          {ys.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line-2)" strokeWidth={1} />
              <text
                x={L - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-fg-3 font-mono text-[10.5px]"
              >
                {format(v)}
              </text>
            </g>
          ))}
          <path
            d={area(
              (b) => b.p90,
              (b) => b.p10
            )}
            fill="var(--fg-3)"
            fillOpacity={0.08}
            data-band="outer"
          />
          <path
            d={area(
              (b) => b.p75,
              (b) => b.p25
            )}
            fill="var(--fg-3)"
            fillOpacity={0.16}
            data-band="inner"
          />
          <path
            d={line(band.map((b) => b.median))}
            fill="none"
            stroke="var(--fg-3)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            data-median=""
          />
          {startAt > 0 && coverage && (
            <g data-coverage-start={coverage.season}>
              <line
                x1={x(startAt) - step / 2}
                x2={x(startAt) - step / 2}
                y1={T - 6}
                y2={H - B}
                stroke="var(--warn)"
                strokeDasharray="3 3"
              />
              <text
                x={x(startAt) - step / 2 + 6}
                y={T - 10}
                textAnchor={startAt > seasons.length * 0.7 ? 'end' : 'start'}
                className="fill-warn text-[11px] font-medium"
              >
                {coverage.note}
              </text>
            </g>
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--line)" />
          )}
          <path
            d={line(points.map((p) => p.value))}
            fill="none"
            stroke={COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
            data-line=""
          />
          {points.map((p, i) =>
            p.value === null ? null : (
              <circle
                key={p.season}
                cx={x(i)}
                cy={y(p.value)}
                r={hover === i ? 6 : 4.5}
                fill={p.qualified ? COLOR : 'var(--panel)'}
                stroke={COLOR}
                strokeWidth={2}
                data-point={p.season}
                {...(p.qualified ? {} : { 'data-hollow': '' })}
              />
            )
          )}
          {seasons.map((season, i) => (
            <g key={season}>
              {i % every === 0 && (
                <text
                  x={x(i)}
                  y={H - B + 18}
                  textAnchor="middle"
                  className="fill-fg-2 font-mono text-[10.5px]"
                >
                  {seasonLabel(season)}
                </text>
              )}
              <rect
                x={x(i) - step / 2}
                y={T}
                width={step}
                height={H - T}
                fill="transparent"
                data-season={season}
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
        </svg>
        {info && hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 flex w-[260px] flex-col gap-1 rounded-[9px] bg-panel px-3 py-2.5 text-[11.5px] shadow-[0_0_0_1px_var(--line),0_10px_28px_var(--shadow-c)]"
            style={
              x(hover) > W * 0.62
                ? { right: `${(1 - (x(hover) - 18) / W) * 100}%` }
                : { left: `${((x(hover) + 18) / W) * 100}%` }
            }
          >
            <span className="font-semibold text-fg">{info.title}</span>
            {info.lines.map((l) => (
              <span key={l} className="text-fg-2">
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
