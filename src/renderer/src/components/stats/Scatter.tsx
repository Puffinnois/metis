import { useState } from 'react'
import {
  categoryColour,
  dotRadius,
  isCategory,
  labelItems,
  placeLabels,
  PLOT,
  type ChartDot,
  type Scales
} from '@/lib/stats/chart'
import { heatColor } from '@/lib/stats/format'
import type { Entity } from '@shared/stats/types'

const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)']

/** What the hover card says about a dot. */
export interface DotCard {
  title: string
  sub: string
  lines: { label: string; text: string; chip: React.ReactNode }[]
  sample: string
}

/**
 * The chart's scatter: gridlines, the qualified means dashed with the corners' words, a dot per row
 * (sized by a percentile, coloured by a percentile or a category when asked), rings for the searched,
 * the hovered and the picked, labels placed without collisions, and a hover card. A click opens the
 * dashboard; a shift-click picks the dot for Compare.
 */
export function Scatter({
  entity,
  dots,
  scales: s,
  mean,
  corners,
  xLabel,
  yLabel,
  format,
  size,
  colour,
  card,
  onOpen,
  onPick,
  label
}: {
  entity: Entity
  dots: readonly ChartDot[]
  scales: Scales
  mean: { x: number; y: number }
  corners: { tl: string; tr: string; bl: string; br: string }
  xLabel: string
  yLabel: string
  format: { x: (v: number) => string; y: (v: number) => string }
  size: string | null
  colour: string | null
  card: (dot: ChartDot) => DotCard
  onOpen: (dot: ChartDot) => void
  onPick: (dot: ChartDot) => void
  label: string
}): React.JSX.Element {
  const [hover, setHover] = useState<string | null>(null)
  const { width: W, height: H, left: L, right: R, top: T, bottom: B } = PLOT
  const at = (d: ChartDot): { cx: number; cy: number; r: number } => ({
    cx: s.x(d.x),
    cy: s.y(d.y),
    r: dotRadius(entity, d, size)
  })
  const labels = placeLabels(labelItems(entity, dots, at), entity === 'team' ? 6.6 : 6.3)
  const hovered = dots.find((d) => d.id === hover) ?? null
  const ring = (d: ChartDot): string | null =>
    d.pick >= 0 ? SERIES[d.pick] : d.id === hover ? 'var(--cobalt)' : d.matched ? 'var(--fg)' : null
  const fill = (d: ChartDot): string =>
    colour === null
      ? 'var(--cobalt)'
      : isCategory(colour)
        ? categoryColour(colour, d.category)
        : d.percentiles[colour] === null || d.percentiles[colour] === undefined
          ? 'var(--fg-3)'
          : heatColor((d.percentiles[colour] ?? 50) / 100, false)
  // Hovered last, over every other dot.
  const order = hovered ? [...dots.filter((d) => d.id !== hover), hovered] : dots
  const corner = 'fill-fg-3 text-[11px]'
  const info = hovered ? card(hovered) : null
  const hx = hovered ? s.x(hovered.x) : 0
  const hy = hovered ? s.y(hovered.y) : 0
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={label}
        className="block overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        {s.xTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={s.x(v)} x2={s.x(v)} y1={T} y2={H - B} stroke="var(--line-2)" />
            <text
              x={s.x(v)}
              y={H - B + 16}
              textAnchor="middle"
              className="fill-fg-3 font-mono text-[10.5px]"
            >
              {format.x(v)}
            </text>
          </g>
        ))}
        {s.yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={s.y(v)} y2={s.y(v)} stroke="var(--line-2)" />
            <text
              x={L - 8}
              y={s.y(v) + 4}
              textAnchor="end"
              className="fill-fg-3 font-mono text-[10.5px]"
            >
              {format.y(v)}
            </text>
          </g>
        ))}
        <text x={L} y={T - 12} className="fill-fg-2 text-[11.5px] font-medium">
          ↑ {yLabel}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" className="fill-fg-2 text-[11.5px] font-medium">
          {xLabel} →
        </text>
        <g stroke="var(--fg-3)" strokeOpacity={0.7} strokeDasharray="4 4" data-means="">
          <line x1={s.x(mean.x)} x2={s.x(mean.x)} y1={T} y2={H - B} />
          <line x1={L} x2={W - R} y1={s.y(mean.y)} y2={s.y(mean.y)} />
        </g>
        <text x={W - R - 6} y={T + 14} textAnchor="end" className={`${corner} font-medium`}>
          {corners.tr}
        </text>
        <text x={L + 6} y={T + 14} className={corner}>
          {corners.tl}
        </text>
        <text x={W - R - 6} y={H - B - 8} textAnchor="end" className={corner}>
          {corners.br}
        </text>
        <text x={L + 6} y={H - B - 8} className={corner}>
          {corners.bl}
        </text>
        {order.map((d) => {
          const { cx, cy, r } = at(d)
          const rim = ring(d)
          // Special dots are opaque; coloured ones nearly; the rest let the crowd show through.
          const opacity = rim !== null ? 1 : colour !== null ? 0.85 : entity === 'team' ? 0.62 : 0.5
          return (
            <g
              key={d.id}
              data-dot={d.id}
              className="cursor-pointer"
              onMouseEnter={() => setHover(d.id)}
              onClick={(e) => (e.shiftKey ? onPick(d) : onOpen(d))}
            >
              {rim && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + (d.pick >= 0 ? 4 : 3.75)}
                  fill="none"
                  stroke={rim}
                  strokeWidth={d.pick >= 0 ? 4 : 3.5}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill(d)}
                fillOpacity={opacity}
                stroke="var(--panel)"
                strokeWidth={rim !== null ? 2 : 1}
              />
            </g>
          )
        })}
        {labels.map((l) => (
          <text
            key={l.id}
            x={l.left + 1}
            y={l.top + 10}
            stroke="var(--panel)"
            strokeWidth={3}
            paintOrder="stroke"
            pointerEvents="none"
            className={
              entity === 'team'
                ? 'fill-fg font-mono text-[10.5px] font-semibold'
                : l.kind === 'strong'
                  ? 'fill-fg text-[11px] font-semibold'
                  : 'fill-fg-3 text-[11px]'
            }
          >
            {l.text}
          </text>
        ))}
      </svg>
      {info && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 flex w-[236px] flex-col gap-1.5 rounded-[9px] bg-panel px-3 py-2.5 text-[11.5px] shadow-[0_0_0_1px_var(--line),0_10px_28px_var(--shadow-c)]"
          style={{
            top: `${(Math.max(T, hy - 40) / H) * 100}%`,
            ...(hx > L + (W - L - R) * 0.6
              ? { right: `${(1 - (hx - 16) / W) * 100}%` }
              : { left: `${((hx + 16) / W) * 100}%` })
          }}
        >
          <span className="text-[13px] font-semibold text-fg">{info.title}</span>
          <span className="font-mono text-[11px] text-fg-3">{info.sub}</span>
          {info.lines.map((x) => (
            <span key={x.label} className="flex items-center justify-between gap-2 text-fg-2">
              <span className="truncate">{x.label}</span>
              <span className="flex items-center gap-1.5 font-mono text-fg">
                {x.text}
                {x.chip}
              </span>
            </span>
          ))}
          <span className="text-fg-3">{info.sample}</span>
          <span className="text-cobalt">Click to open ↗</span>
        </div>
      )}
    </div>
  )
}

/** A pick's swatch: its series colour, as its ring on the scatter. */
export function PickSwatch({ slot }: { slot: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: SERIES[slot % SERIES.length] }}
    />
  )
}

/** A percentile pill: green at 75 and over, red at 25 and under; NQ below the qualifier. */
export function PctChip({
  percentile,
  qualified
}: {
  percentile: number | null
  qualified: boolean
}): React.JSX.Element {
  if (percentile === null) {
    return (
      <span className="flex h-[18px] min-w-[30px] items-center justify-center rounded-[4px] px-1 font-mono text-[10.5px] font-semibold text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]">
        {qualified ? '—' : 'NQ'}
      </span>
    )
  }
  const n = Math.round(percentile)
  return (
    <span
      className={
        'flex h-[18px] min-w-[30px] items-center justify-center rounded-[4px] px-1 font-mono text-[10.5px] font-semibold ' +
        (n >= 75 ? 'bg-good-s text-good' : n <= 25 ? 'bg-bad-s text-bad' : 'text-fg-3')
      }
    >
      {n}
    </span>
  )
}
