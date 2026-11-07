import { useState } from 'react'
import type { ChartSeries } from '@/lib/stats/dashboard'

const COLOR = 'var(--s1)'

/** Round tick steps: 1, 2, 2.5, 5 × a power of ten. */
function ticks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1
  const raw = span / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) {
    out.push(Number(v.toFixed(6)))
  }
  return out
}

/** The axis has room for about eight dates, however many games there are. */
const labelEvery = (games: number): number => Math.max(1, Math.ceil(games / 8))

/**
 * A value per game: a line with a dot a game, a dashed line at the average, a zero line when the
 * values cross it, and a hover naming the game. Built from the template's weekly chart: NBA seasons
 * have too many games to label each one.
 */
export function GameChart({
  series,
  format,
  height = 190,
  width = 720,
  label
}: {
  series: ChartSeries
  format: (v: number) => string
  height?: number
  /** The viewBox width: a wide chart keeps its height. */
  width?: number
  /** What the chart shows, for screen readers. */
  label: string
}): React.JSX.Element {
  const [hovered, setHover] = useState<number | null>(null)
  const points = series.points
  // The games can shrink under a resting mouse: drop a stale index.
  const hover = hovered !== null && hovered < points.length ? hovered : null
  const values = points.map((p) => p.value).filter((v): v is number => v !== null)
  if (!values.length) {
    return (
      <div className="flex items-center justify-center text-[13px] text-fg-3" style={{ height }}>
        No games in this range.
      </div>
    )
  }
  const W = width
  const H = height
  const [L, R, T, B, PX] = [44, 18, 12, 26, 10]
  let lo = Math.min(...values, 0)
  let hi = Math.max(...values, 0)
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08
  lo -= lo < 0 ? pad : 0
  hi += pad
  const ys = ticks(lo, hi)
  lo = Math.min(lo, ys[0])
  hi = Math.max(hi, ys[ys.length - 1])
  const x = (i: number): number =>
    points.length === 1
      ? (L + W - R) / 2
      : L + PX + (i / (points.length - 1)) * (W - L - R - PX * 2)
  const y = (v: number): number => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B)
  let line = ''
  let pen = false
  points.forEach((p, i) => {
    if (p.value === null) {
      pen = false
      return
    }
    line += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`
    pen = true
  })
  const average = values.reduce((a, b) => a + b, 0) / values.length
  const every = labelEvery(points.length)
  const pick = (e: React.MouseEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / (box.width || 1)) * W
    let best = 0
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    })
    setHover(best)
  }
  const shown = hover === null ? null : points[hover]
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={label}
          className="block overflow-visible"
          onMouseMove={pick}
          onMouseLeave={() => setHover(null)}
        >
          {ys.map((v) => (
            <g key={v}>
              <line
                x1={L}
                x2={W - R}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? 'var(--fg-3)' : 'var(--line-2)'}
                strokeWidth={1}
              />
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
          {points.map((p, i) =>
            i % every === 0 ? (
              <text
                key={p.key}
                x={x(i)}
                y={H - 6}
                textAnchor="middle"
                className="fill-fg-3 font-mono text-[10.5px]"
              >
                {p.label}
              </text>
            ) : null
          )}
          <line
            x1={L}
            x2={W - R}
            y1={y(average)}
            y2={y(average)}
            stroke="var(--fg-3)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={T}
              y2={H - B}
              stroke="var(--fg-3)"
              strokeDasharray="3 3"
            />
          )}
          <path
            d={line}
            fill="none"
            stroke={COLOR}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) =>
            p.value === null ? null : (
              <circle
                key={p.key}
                cx={x(i)}
                cy={y(p.value)}
                r={hover === i ? 4.5 : points.length > 30 ? 2 : 3}
                fill={COLOR}
                stroke="var(--panel)"
                strokeWidth={1}
              />
            )
          )}
        </svg>
        {shown && hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col gap-1 rounded-[8px] bg-panel px-2.5 py-2 text-[11.5px] shadow-[0_0_0_1px_var(--line),0_6px_18px_var(--shadow-c)]"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <span className="font-semibold whitespace-nowrap">{shown.title}</span>
            <span className="flex gap-3 whitespace-nowrap text-fg-2">
              {series.label}
              <span className="ml-auto font-mono text-fg">
                {shown.value === null ? 'No value' : format(shown.value)}
              </span>
            </span>
          </div>
        )}
      </div>
      <figcaption className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
        <span className="w-3.5 border-t-[1.5px] border-dashed border-fg-3" />
        Average {format(average)}
      </figcaption>
    </figure>
  )
}
