import { useMemo } from 'react'
import { Loading, MiniTable, SectionHead, TABLE_SCROLL } from '@/components/stats/parts'
import {
  highsView,
  SEASON_HIGHS,
  THRESHOLD_HEADS,
  type HighCell,
  type SeasonRow
} from '@/lib/stats/highs'
import { currentLeague, seasonLabel } from '@/lib/stats/league'
import { queryScope, typeLabel, type StatsScope } from '@/lib/stats/scope'
import { usePlayerGames, type StatsData } from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'

/** A value with the game it was in, a button that opens it. */
function Value({
  cell,
  strong,
  onOpenGame
}: {
  cell: HighCell
  strong?: boolean
  onOpenGame: (game: string) => void
}): React.JSX.Element {
  const body = (
    <>
      <span className={cn('w-[46px] shrink-0 text-right', strong && 'font-semibold text-fg')}>
        {cell.text}
      </span>
      {/* A value that is not there reads its reason in place. */}
      <span className="truncate font-sans text-[12px] text-fg-3">
        {cell.note || (cell.text === '—' ? cell.title : '')}
      </span>
    </>
  )
  const className = 'flex w-full min-w-0 items-baseline gap-2.5 text-left'
  return cell.gameId === null ? (
    <span className={className} title={cell.title}>
      {body}
    </span>
  ) : (
    <button
      type="button"
      title={cell.title}
      onClick={() => onOpenGame(cell.gameId!)}
      className={cn(className, 'cursor-pointer hover:text-cobalt')}
    >
      {body}
    </button>
  )
}

/** A narrow number in a table by season. */
function Small({
  cell,
  onOpenGame
}: {
  cell: HighCell
  onOpenGame: (game: string) => void
}): React.JSX.Element {
  const title = [cell.note, cell.title].filter((x) => x !== '').join('. ')
  return cell.gameId === null ? (
    <span title={title} className={cn((cell.text === '0' || cell.text === '—') && 'text-fg-3')}>
      {cell.text}
    </span>
  ) : (
    <button
      type="button"
      title={title}
      onClick={() => onOpenGame(cell.gameId!)}
      className="cursor-pointer hover:text-cobalt"
    >
      {cell.text}
    </button>
  )
}

/**
 * The Highs tab (Plan T1703.3): the player's season and career highs, their streaks, and how many games
 * they had over each threshold, by season and career. Worked out from the game lines when read.
 */
export function PlayerHighs({
  data,
  scope,
  player,
  onOpenGame
}: {
  data: StatsData
  scope: StatsScope
  player: string
  onOpenGame: (game: string) => void
}): React.JSX.Element {
  const { value, error } = usePlayerGames(player, data.version)
  const latest = data.seasons.length ? Math.max(...data.seasons.map((s) => s.season)) : null
  const view = useMemo(
    () =>
      value &&
      highsView({
        games: value.games,
        types: queryScope(scope, 'player').gameTypes ?? [],
        counted: currentLeague().countedTypes,
        season: scope.season,
        latest,
        byId: data.byId
      }),
    [value, scope, latest, data.byId]
  )
  if (!view) return <Loading error={error} />
  if (value?.reason) return <Loading error={value.reason} />
  const type = typeLabel(scope.seasonType)
  const season = seasonLabel(scope.season)
  if (view.games.career === 0) {
    return (
      <p className="m-0 text-[12.5px] text-fg-3" role="status">
        No games in this season type: {type}.
      </p>
    )
  }
  const short = (metric: string): string => data.byId.get(metric)?.short ?? metric
  const table = (
    label: string,
    heads: { key: string; label: string; title: string }[],
    rows: SeasonRow[]
  ): React.JSX.Element => (
    <div className={TABLE_SCROLL}>
      <MiniTable
        label={label}
        columns={`60px 40px ${heads.map(() => 'minmax(46px,1fr)').join(' ')}`}
        minWidth={112 + heads.length * 58}
        head={[
          'Season',
          'G',
          ...heads.map((h) => (
            <span key={h.key} title={h.title}>
              {h.label}
            </span>
          ))
        ]}
        rows={rows.map((r) => ({
          key: r.key,
          strong: r.key === 'career',
          cells: [
            <span key="s" className={cn('font-sans', r.here && 'font-semibold text-cobalt')}>
              {r.label}
            </span>,
            <span key="g" className="text-fg-3">
              {r.games}
            </span>,
            ...r.cells.map((c, i) => <Small key={i} cell={c} onOpenGame={onOpenGame} />)
          ]
        }))}
      />
    </div>
  )
  return (
    <div className="flex flex-col gap-7" data-highs="">
      {scope.range.kind !== 'season' && (
        <p className="m-0 text-[12.5px] text-fg-3">
          Whole seasons: the date range and last games do not apply here.
        </p>
      )}
      <section className="flex flex-col gap-2.5">
        <SectionHead
          title="Highs"
          note={`${type} · ${view.games.season} games in ${season}, ${view.games.career} in the career`}
        />
        <MiniTable
          label="Highs"
          columns="150px minmax(0,1fr) minmax(0,1fr)"
          left={[1, 2]}
          head={['', season, 'Career']}
          rows={view.highs.map((r) => ({
            key: r.id,
            cells: [
              <span key="l" className="font-sans text-fg-2">
                {r.label}
              </span>,
              <Value key="s" cell={r.season} strong onOpenGame={onOpenGame} />,
              <Value key="c" cell={r.career} strong onOpenGame={onOpenGame} />
            ]
          }))}
        />
      </section>
      <section className="flex flex-col gap-2.5">
        <SectionHead title="Streaks" note={`Games in a row · ${type}`} />
        <MiniTable
          label="Streaks"
          columns="150px repeat(3,minmax(0,1fr))"
          left={[1, 2, 3]}
          head={['', `Longest in ${season}`, 'Current', 'Longest of the career']}
          rows={view.streaks.map((r) => ({
            key: r.id,
            cells: [
              <span key="l" className="font-sans text-fg-2">
                {r.label}
              </span>,
              <Value key="s" cell={r.season} strong onOpenGame={onOpenGame} />,
              <Value key="n" cell={r.now} strong onOpenGame={onOpenGame} />,
              <Value key="c" cell={r.career} strong onOpenGame={onOpenGame} />
            ]
          }))}
        />
        <p className="m-0 text-[12px] text-fg-3">
          A streak counts the games they played: one they missed does not end it. The current and
          the career&rsquo;s run on from one season to the next.
        </p>
      </section>
      <section className="flex flex-col gap-2.5">
        <SectionHead title="Games over a threshold" note={`By season · ${type}`} />
        {table(
          'Games over a threshold',
          THRESHOLD_HEADS.map((h) => ({ key: h.id, label: h.label, title: h.title })),
          view.thresholds
        )}
      </section>
      <section className="flex flex-col gap-2.5">
        <SectionHead title="Highs by season" note={type} />
        {table(
          'Highs by season',
          SEASON_HIGHS.map((m) => ({
            key: m,
            label: short(m),
            title: data.byId.get(m)?.label ?? m
          })),
          view.bySeason
        )}
        {view.notes.length > 0 && (
          <p className="m-0 text-[12px] text-fg-3">{view.notes.join(' ')}</p>
        )}
      </section>
    </div>
  )
}
