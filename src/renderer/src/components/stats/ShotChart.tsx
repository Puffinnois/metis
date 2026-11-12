import { useState } from 'react'
import { Segmented } from '@/components/stats/controls'
import { Loading, MiniTable, SectionHead } from '@/components/stats/parts'
import {
  chartGap,
  chartSummary,
  courtLines,
  onChart,
  pctText,
  relText,
  shadeFill,
  toView,
  VIEW,
  ZONE_LABELS,
  zonePaths,
  zoneShades,
  type ZoneShade
} from '@/lib/stats/shotChart'
import { useShots } from '@/lib/stats/useStats'
import type { StatsShotRequest } from '@shared/stats/types'

type Mode = 'zones' | 'shots'

const MODES: { value: Mode; label: string }[] = [
  { value: 'zones', label: 'Zones' },
  { value: 'shots', label: 'Shots' }
]

const PATHS = zonePaths()
const LINES = courtLines()

/**
 * A half court drawn to scale, with the shots of the dashboard's scope: as marks, makes and misses, or
 * as zones shaded by their FG% against what the league's rate would give the same attempts. Under it,
 * the zones' figures. It reads the shot rows through its own call, since a chart needs rows, not sums.
 */
export function ShotChart({
  request,
  version,
  title = 'Shot chart'
}: {
  request: StatsShotRequest | null
  version: string | null
  title?: string
}): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('zones')
  const { value, error } = useShots(request, version)
  if (!value) {
    return (
      <section className="flex flex-col gap-2.5">
        <SectionHead title={title} />
        <Loading error={error} />
      </section>
    )
  }
  const gap = chartGap(value)
  const shades = zoneShades(value)
  return (
    <section
      className="flex flex-col gap-3"
      aria-label={title}
      data-shot-total={value.total}
      data-shot-drawn={value.shots.length}
    >
      <SectionHead title={title} note={gap ? undefined : chartSummary(value)} />
      {gap ? (
        <p className="m-0 text-[12.5px] text-fg-3" role="status">
          {gap}
        </p>
      ) : (
        <>
          <div className="self-start">
            <Segmented label="Chart" value={mode} options={MODES} onChange={setMode} />
          </div>
          <div className="flex flex-wrap items-start gap-6">
            <svg
              viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
              className="w-full max-w-[460px] shrink-0 rounded-[8px] bg-panel"
              role="img"
              aria-label={`${title}: ${chartSummary(value)}`}
            >
              {mode === 'zones' ? <Zones shades={shades} /> : <Marks request={value} />}
              {LINES.map((d, i) => (
                <path key={i} d={d} fill="none" stroke="var(--fg-3)" strokeWidth={2} />
              ))}
            </svg>
            <ZoneTable shades={shades} total={value.total} />
          </div>
          <Legend mode={mode} />
        </>
      )}
    </section>
  )
}

function Zones({ shades }: { shades: ZoneShade[] }): React.JSX.Element {
  return (
    <g>
      {shades.map((z) => (
        <path
          key={z.zone}
          d={PATHS[z.zone]}
          fillRule="evenodd"
          fill={shadeFill(z.level)}
          data-zone={z.zone}
        >
          <title>{`${z.label}: ${z.fgm} of ${z.fga}, ${pctText(z.pct)}, ${relText(z.rel)} vs league`}</title>
        </path>
      ))}
      {shades.map((z) => {
        const at = ZONE_LABELS[z.zone]
        const { cx, cy } = toView(at.x, at.y)
        return (
          <text
            key={z.zone}
            x={cx}
            y={cy}
            textAnchor="middle"
            className="fill-fg font-mono"
            fontSize={z.zone.startsWith('c3') ? 15 : 19}
          >
            <tspan x={cx} dy="-0.2em">
              {pctText(z.pct)}
            </tspan>
            <tspan x={cx} dy="1.15em" className="fill-fg-2" fontSize={13}>
              {`${z.fgm}/${z.fga}`}
            </tspan>
          </text>
        )
      })}
    </g>
  )
}

function Marks({
  request
}: {
  request: { shots: { x: number; y: number; made: boolean }[] }
}): React.JSX.Element {
  const drawn = request.shots.filter(onChart)
  // Misses first, so the makes sit on top.
  const ordered = [...drawn.filter((s) => !s.made), ...drawn.filter((s) => s.made)]
  return (
    <g>
      {ordered.map((s, i) => {
        const { cx, cy } = toView(s.x, s.y)
        return s.made ? (
          <circle key={i} cx={cx} cy={cy} r={4.5} fill="var(--cobalt)" fillOpacity={0.75} />
        ) : (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={4}
            fill="none"
            stroke="var(--bad)"
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        )
      })}
    </g>
  )
}

function ZoneTable({ shades, total }: { shades: ZoneShade[]; total: number }): React.JSX.Element {
  return (
    <div className="min-w-[320px] flex-1">
      <MiniTable
        label="Shots by zone"
        columns="minmax(130px, 1fr) 52px 52px 60px 56px 64px"
        head={['Zone', 'FGM', 'FGA', 'FG%', 'Freq', 'vs lg']}
        rows={shades.map((z) => ({
          key: z.zone,
          cells: [
            z.label,
            z.fgm,
            z.fga,
            pctText(z.pct),
            pctText(total > 0 ? z.fga / total : null),
            relText(z.rel)
          ]
        }))}
      />
    </div>
  )
}

function Legend({ mode }: { mode: Mode }): React.JSX.Element {
  return mode === 'zones' ? (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
      <span>Below the league</span>
      {([-3, -2, -1, 0, 1, 2, 3] as const).map((l) => (
        <span
          key={l}
          className="inline-block h-3 w-5 rounded-[3px]"
          style={{ background: shadeFill(l) }}
        />
      ))}
      <span>Above the league</span>
      <span className="ml-3">
        Shaded by FG% against the league’s regular-season rate in each zone that season. A zone with
        fewer than 5 attempts is not shaded.
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-fg-3">
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" aria-hidden>
          <circle cx="6" cy="6" r="4.5" fill="var(--cobalt)" />
        </svg>
        Made
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" aria-hidden>
          <circle cx="6" cy="6" r="4" fill="none" stroke="var(--bad)" strokeWidth="1.5" />
        </svg>
        Missed
      </span>
      <span>From the NBA’s shot chart file; ESPN’s shots are not mixed in.</span>
    </div>
  )
}
