import { useMemo } from 'react'
import { flowFacts, flowGeometry, FLOW_FRAME } from '@/lib/stats/gameFlow'
import { useGameFlow } from '@/lib/stats/useStats'
import { Loading, MiniTable, SectionHead } from './parts'

/**
 * A game's flow: the home side's margin over the game clock, shaded on the side that leads, with
 * the period breaks and each lead change marked; then the counts the chart is made of.
 */
export function GameFlowChart({
  game,
  home,
  away,
  version
}: {
  game: string
  home: string
  away: string
  version: string | null
}): React.JSX.Element {
  const { value, error } = useGameFlow(game, version)
  const geo = useMemo(
    () => (value && value.points.length > 0 ? flowGeometry(value) : null),
    [value]
  )
  if (!value) return <Loading error={error} />
  const f = FLOW_FRAME
  const zero = geo ? geo.y(0) : 0
  return (
    <section className="flex flex-col gap-3" aria-label="Game flow">
      <SectionHead title="Game flow" note="The margin through the game, from the play by play" />
      {value.reason || !geo || !value.summary ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          {value.reason ?? 'No scoring plays for this game.'}
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${f.width} ${f.height}`}
            className="w-full max-w-[860px] self-center"
            role="img"
            aria-label={`Margin chart: ${home} above the line, ${away} below`}
          >
            <defs>
              <clipPath id="flow-above">
                <rect x={0} y={0} width={f.width} height={zero} />
              </clipPath>
              <clipPath id="flow-below">
                <rect x={0} y={zero} width={f.width} height={f.height - zero} />
              </clipPath>
            </defs>
            {geo.ticks.map((t) => (
              <g key={t.y}>
                <line
                  x1={f.left}
                  x2={f.width - f.right}
                  y1={t.y}
                  y2={t.y}
                  className={t.label === '0' ? 'stroke-fg-3' : 'stroke-line-2'}
                  strokeWidth={1}
                />
                <text
                  x={f.left - 6}
                  y={t.y + 4}
                  textAnchor="end"
                  fontSize={10}
                  className="fill-fg-3 font-mono"
                >
                  {t.label}
                </text>
              </g>
            ))}
            {geo.periods.map((p) => (
              <g key={p.label}>
                <line
                  x1={p.x}
                  x2={p.x}
                  y1={f.top}
                  y2={f.height - f.bottom}
                  className="stroke-line"
                  strokeDasharray="2 3"
                />
                <text x={p.x + 4} y={f.height - 8} fontSize={10} className="fill-fg-3 font-mono">
                  {p.label}
                </text>
              </g>
            ))}
            <text x={f.left + 4} y={f.top + 10} fontSize={10} className="fill-fg-2 font-sans">
              {home} ahead
            </text>
            <text
              x={f.left + 4}
              y={f.height - f.bottom - 4}
              fontSize={10}
              className="fill-fg-2 font-sans"
            >
              {away} ahead
            </text>
            <path d={geo.area} clipPath="url(#flow-above)" className="fill-cobalt/20" />
            <path d={geo.area} clipPath="url(#flow-below)" className="fill-bad/20" />
            <path d={geo.path} fill="none" className="stroke-fg" strokeWidth={1.25} />
            {geo.changes.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={2.5} className="fill-fg" />
            ))}
          </svg>
          <FlowFacts home={home} away={away} facts={flowFacts(value.summary)} />
        </>
      )}
    </section>
  )
}

function FlowFacts({
  home,
  away,
  facts
}: {
  home: string
  away: string
  facts: ReturnType<typeof flowFacts>
}): React.JSX.Element {
  return (
    <div className="flex max-w-[640px] flex-col gap-2 self-center">
      <p className="m-0 text-center text-[12.5px] text-fg-2" aria-label="Lead changes and ties">
        {facts.shared.join(' · ')}
      </p>
      <MiniTable
        label="Flow by team"
        columns="minmax(220px,1fr) 110px 110px"
        head={['', away, home]}
        rows={facts.sides.map((s) => ({
          key: s.label,
          cells: [
            <span key="l" className="font-sans text-[12.5px] text-fg-2">
              {s.label}
            </span>,
            s.away,
            s.home
          ]
        }))}
      />
      <p className="m-0 text-[11.5px] text-fg-3">
        A run ends at any point by the other side, a free throw included. A tie is a score that
        levels the game; 0-0 at the tip is not one. Times are game clock.
      </p>
    </div>
  )
}
