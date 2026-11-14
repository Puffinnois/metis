import { GameFlowChart } from '@/components/stats/GameFlowChart'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StatsSelect } from '@/components/stats/controls'
import { Loading, MiniTable, NavButton, SectionHead } from '@/components/stats/parts'
import { useNoteContext } from '@/lib/dev/noteContext'
import {
  BOX_HEAD,
  boxQueries,
  boxSides,
  compareRows,
  defaultDay,
  eloView,
  gameDays,
  gameHeader,
  noBoxNote,
  periodTable,
  railGames,
  stepDay,
  type BoxSide,
  type GameHeader,
  type GamesState,
  type HeaderSide,
  type RailGame
} from '@/lib/stats/games'
import {
  gamePairSides,
  GAME_PAIR_HEAD,
  GAME_PAIR_LIMIT,
  gamePairCount,
  type GamePairSide
} from '@/lib/stats/matchups'
import {
  careerRows,
  coverageText,
  OFFICIAL_HEAD,
  OFFICIAL_MEASURES,
  OFFICIAL_NOTES,
  seasonRows,
  type OfficialRow
} from '@/lib/stats/officials'
import {
  fullDay,
  moveToSeason,
  queryScope,
  seasonOf,
  seasonTypes,
  shortDay,
  typeLabel,
  type StatsScope
} from '@/lib/stats/scope'
import {
  useGameDetail,
  useGameMatchups,
  useOfficialCareer,
  useOfficialsSeason,
  useSeasonGames,
  useStatsQueries,
  type StatsData
} from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import { seasonLabel } from '@shared/stats/seasons'
import type { GameType, StatsGame } from '@shared/stats/types'

/** A day's games on a date rail, and a game: its header, scores by period, comparison and box score. */
export function StatsGames({
  data,
  scope,
  onScope,
  state,
  onState,
  onOpenTeam,
  onOpenPlayer
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  state: GamesState
  onState: (state: GamesState) => void
  onOpenTeam: (team: string) => void
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const { value: games, error } = useSeasonGames(scope.season, data.version)
  const through = data.status?.through?.date ?? null
  const named = games?.find((g) => g.id === state.game) ?? null
  const days = useMemo(() => (games ? gameDays(games) : []), [games])
  const date =
    state.date !== null && days.includes(state.date)
      ? state.date
      : (named?.date ?? (games ? defaultDay(games) : null))
  const rail = games ? railGames(games, date, through) : []
  const game: StatsGame | null =
    named && named.date === date
      ? named
      : (games?.find((g) => g.id === rail[0]?.id && g.date === date) ?? null)
  useNoteContext(
    'game',
    game ? { label: `${game.away.code} @ ${game.home.code}`, data: { id: game.id } } : null
  )

  const goDay = (d: string | null): void => {
    if (d !== null) onState({ date: d, game: null })
  }
  const officialsOn = state.officials === true && !state.official
  const gameTypes = queryScope(scope, 'player').gameTypes ?? ['regular']
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        aria-label="Games"
        className="flex min-h-0 w-[240px] shrink-0 flex-col border-r border-line"
      >
        <div className="flex shrink-0 flex-col gap-[9px] border-b border-line px-3.5 pt-3 pb-2.5">
          <StatsSelect
            title="Season"
            value={scope.season}
            options={data.seasons.map((s) => ({ value: s.season, label: seasonLabel(s.season) }))}
            onChange={(s) => {
              onScope(moveToSeason(scope, s, data.seasons))
              onState({ date: null, game: null })
            }}
            className="w-full"
          />
          <div className="flex items-center gap-1.5">
            <NavButton
              title="The day before"
              disabled={stepDay(days, date, -1) === null}
              onClick={() => goDay(stepDay(days, date, -1))}
            >
              <ChevronLeft className="size-3.5" />
            </NavButton>
            <StatsSelect
              title="Day"
              value={date ?? ''}
              options={days.map((d) => ({ value: d, label: shortDay(d) }))}
              onChange={goDay}
              className="min-w-0 flex-1"
            />
            <NavButton
              title="The day after"
              disabled={stepDay(days, date, 1) === null}
              onClick={() => goDay(stepDay(days, date, 1))}
            >
              <ChevronRight className="size-3.5" />
            </NavButton>
          </div>
          <span className="font-mono text-[11px] leading-none text-fg-3">
            {rail.length} {rail.length === 1 ? 'GAME' : 'GAMES'}
            {date ? ` · ${fullDay(date).toUpperCase()}` : ''}
          </span>
          <button
            type="button"
            aria-pressed={officialsOn}
            onClick={() =>
              onState({ date, game: state.game, officials: !officialsOn, official: null })
            }
            className={cn(
              'cursor-pointer self-start text-[12px] font-medium hover:text-cobalt',
              officialsOn ? 'text-cobalt' : 'text-fg-2'
            )}
          >
            Officials of {seasonLabel(scope.season)}
          </button>
        </div>
        <div
          role="list"
          aria-label="The day’s games"
          className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]"
        >
          {rail.map((r) => (
            <RailItem
              key={r.id}
              game={r}
              on={r.id === game?.id}
              onClick={() => onState({ date, game: r.id })}
            />
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {state.official ? (
          <OfficialCareer
            key={state.official}
            official={state.official}
            data={data}
            gameTypes={gameTypes}
            typesLabel={typeLabel(scope.seasonType)}
            onBack={() => onState({ ...state, official: null })}
            backLabel={state.officials ? 'Officials' : 'The game'}
          />
        ) : state.officials ? (
          <OfficialsSeason
            data={data}
            scope={scope}
            onScope={onScope}
            gameTypes={gameTypes}
            onOpen={(id) => onState({ ...state, official: id })}
          />
        ) : error || !games ? (
          <Loading error={error} />
        ) : !game ? (
          <div className="py-20 text-center text-[13px] text-fg-3">
            No games on the schedule for {seasonLabel(scope.season)}.
          </div>
        ) : (
          <GameBody
            key={game.id}
            game={game}
            games={games}
            data={data}
            through={through}
            onOpenTeam={onOpenTeam}
            onOpenPlayer={onOpenPlayer}
            onOpenOfficial={(id) => onState({ date, game: game.id, official: id })}
          />
        )}
      </div>
    </div>
  )
}

function RailItem({
  game: g,
  on,
  onClick
}: {
  game: RailGame
  on: boolean
  onClick: () => void
}): React.JSX.Element {
  const line = (team: string, score: string, won: boolean, lost: boolean): React.JSX.Element => (
    <span
      className={cn(
        'flex justify-between gap-2 font-mono text-[12.5px] leading-none tabular-nums',
        won && 'font-semibold',
        lost && 'text-fg-3'
      )}
    >
      <span>{team}</span>
      <span>{score}</span>
    </span>
  )
  return (
    <button
      type="button"
      role="listitem"
      aria-current={on ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer flex-col gap-[5px] border-b border-line-2 py-[9px] pr-3.5 pl-4 text-left',
        on ? 'bg-sel' : 'hover:bg-hover'
      )}
    >
      {line(g.away, g.awayScore, g.awayWon, g.played && !g.awayWon)}
      {line(g.home, g.homeScore, g.homeWon, g.played && !g.homeWon)}
      {(g.tag || g.note) && (
        <span className="font-mono text-[10.5px] leading-none text-fg-3">
          {[g.tag, g.note].filter(Boolean).join(' · ')}
        </span>
      )}
    </button>
  )
}

function GameBody({
  game,
  games,
  data,
  through,
  onOpenTeam,
  onOpenPlayer,
  onOpenOfficial
}: {
  game: StatsGame
  games: StatsGame[]
  data: StatsData
  through: string | null
  onOpenTeam: (team: string) => void
  onOpenPlayer: (id: string) => void
  onOpenOfficial: (id: string) => void
}): React.JSX.Element {
  const { value: detail } = useGameDetail(game.id, data.version)
  const queries = useMemo(() => (game.hasBox ? boxQueries(game) : null), [game])
  const { results, error } = useStatsQueries(queries, data.version)
  const header = gameHeader(game, games, detail, through)
  const periods = periodTable(game, detail)
  const elo = eloView(game, detail)
  const players = results?.get('players')
  const teams = results?.get('teams')
  const sides = players && teams ? boxSides(game, players, teams, data.byId) : null
  const compare = teams ? compareRows(game, teams, data.byId) : []
  return (
    <div className="flex flex-col gap-[22px] px-8 pt-[22px] pb-8">
      <Header view={header} onOpenTeam={onOpenTeam} />
      {detail && game.played && (
        <p className="m-0 text-center text-[12px] text-fg-3" aria-label="Officials">
          {detail.officials.length > 0 ? (
            <>
              Officials:{' '}
              {detail.officials.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    title={`Open ${o.name}’s seasons`}
                    onClick={() => onOpenOfficial(o.id)}
                    className="cursor-pointer hover:text-cobalt"
                  >
                    {o.name}
                  </button>
                </span>
              ))}
            </>
          ) : (
            'The NBA’s file lists no officials for this game.'
          )}
        </p>
      )}
      {periods && (
        <section className="flex max-w-[520px] flex-col gap-2 self-center">
          <MiniTable
            label="Score by period"
            columns={`56px ${periods.head.map(() => '34px').join(' ')}`}
            head={['', ...periods.head]}
            rows={[
              { key: 'away', code: game.away.code, cells: periods.away },
              { key: 'home', code: game.home.code, cells: periods.home }
            ].map((r) => ({
              key: r.key,
              cells: [
                <span key="c" className="font-semibold">
                  {r.code}
                </span>,
                ...r.cells.map((c, i) => (
                  <span key={i} className={cn(i === r.cells.length - 1 && 'font-semibold')}>
                    {c}
                  </span>
                ))
              ]
            }))}
          />
        </section>
      )}
      {elo && (
        <section className="flex max-w-[520px] flex-col gap-2 self-center" aria-label="Elo">
          {elo.rows.length > 0 && (
            <MiniTable
              label="Elo"
              columns="150px 64px 64px"
              head={['Elo', game.away.code, game.home.code]}
              rows={elo.rows.map((r) => ({
                key: r.label,
                cells: [
                  <span key="l" className="font-sans text-[12.5px] text-fg-2">
                    {r.label}
                  </span>,
                  <span key="a">{r.away}</span>,
                  <span key="h">{r.home}</span>
                ]
              }))}
            />
          )}
          <p className="m-0 text-center text-[12px] text-fg-3">{elo.note}</p>
        </section>
      )}
      {game.played && (
        <GameFlowChart
          game={game.id}
          home={game.home.code}
          away={game.away.code}
          version={data.version}
        />
      )}
      {!game.hasBox ? (
        <div className="rounded-[8px] bg-panel-2 px-4 py-3 text-[13px] text-fg-2">
          {noBoxNote(game, through)}
        </div>
      ) : !sides ? (
        <Loading error={error} />
      ) : (
        <>
          {sides.map((s) => (
            <Box key={s.code} side={s} onOpenPlayer={onOpenPlayer} onOpenTeam={onOpenTeam} />
          ))}
          <section className="flex max-w-[640px] flex-col gap-2 self-center" aria-label="The teams">
            <SectionHead title="The teams" />
            <MiniTable
              label="The teams"
              columns="minmax(200px,1fr) 72px 72px 150px"
              head={['', game.away.code, game.home.code, '']}
              left={[3]}
              rows={compare.map((r) => ({
                key: r.metric,
                cells: [
                  <span key="l" className="font-sans text-[12.5px] text-fg-2">
                    {r.label}
                  </span>,
                  <span key="a" className={cn(r.edge === 'away' && 'font-semibold')}>
                    {r.away}
                  </span>,
                  <span key="h" className={cn(r.edge === 'home' && 'font-semibold')}>
                    {r.home}
                  </span>,
                  <span key="m" className="pl-3 font-sans text-[11.5px] text-fg-3">
                    {r.missing ?? ''}
                  </span>
                ]
              }))}
            />
          </section>
        </>
      )}
      {game.played && <GameMatchups game={game} data={data} onOpenPlayer={onOpenPlayer} />}
    </div>
  )
}

/** Who guarded whom in the game, by the side defending, from the NBA's game matchups. */
function GameMatchups({
  game,
  data,
  onOpenPlayer
}: {
  game: StatsGame
  data: StatsData
  onOpenPlayer: (id: string) => void
}): React.JSX.Element | null {
  const { value, error } = useGameMatchups(game.id, data.version)
  const [all, setAll] = useState(false)
  if (!value) return error ? <Loading error={error} /> : null
  const sides = gamePairSides(
    value.pairs,
    { id: game.away.id, code: game.away.code },
    { id: game.home.id, code: game.home.code },
    all ? null : GAME_PAIR_LIMIT
  )
  const more = sides.some((s) => s.total > GAME_PAIR_LIMIT)
  return (
    <section className="flex flex-col gap-3" aria-label="Who guarded whom">
      <SectionHead title="Who guarded whom" />
      {value.reason || value.pairs.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">
          {value.reason ?? 'The NBA’s file has no matchups for this game.'}
        </p>
      ) : (
        <>
          {sides.map((s) => (
            <GamePairs key={s.code} side={s} onOpenPlayer={onOpenPlayer} />
          ))}
          {more && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
            >
              {all ? 'Show fewer' : 'Show every pair'}
            </button>
          )}
          <p className="m-0 text-[12px] text-fg-3">
            From the NBA’s game matchups: what the player on offense did while that defender was
            assigned, longest first. Assignment is tracked moment by moment, so help and switches
            sit in it too.
          </p>
        </>
      )}
    </section>
  )
}

function GamePairs({
  side,
  onOpenPlayer
}: {
  side: GamePairSide
  onOpenPlayer: (id: string) => void
}): React.JSX.Element {
  const person = (id: string, name: string, extra: string | null): React.JSX.Element => (
    <button
      type="button"
      title={`Open ${name}’s dashboard`}
      onClick={() => onOpenPlayer(id)}
      className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left font-sans text-[13px] font-medium hover:text-cobalt"
    >
      <span className="truncate">{name}</span>
      {extra && <span className="shrink-0 font-mono text-[10.5px] text-fg-3">{extra}</span>}
    </button>
  )
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[13.5px] leading-none font-semibold">{side.code} on defense</span>
        <span className="text-[12px] leading-none text-fg-3">
          {gamePairCount(side.rows.length, side.total)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <MiniTable
          label={`${side.code} on defense`}
          columns={`minmax(150px,1.3fr) minmax(150px,1.3fr) repeat(${GAME_PAIR_HEAD.length - 2}, minmax(44px,1fr))`}
          minWidth={880}
          left={[1]}
          head={GAME_PAIR_HEAD}
          rows={side.rows.map((r) => ({
            key: r.key,
            cells: [
              <span key="d">{person(r.defId, r.defName, null)}</span>,
              <span key="o">{person(r.offId, r.offName, r.offPosition)}</span>,
              ...r.cells
            ]
          }))}
        />
      </div>
    </div>
  )
}

const OFFICIAL_COLUMNS = `minmax(180px,1.6fr) ${OFFICIAL_HEAD.map(() => 'minmax(58px,1fr)').join(' ')} minmax(110px,1fr)`

/** An official table: the head's hover says what each column is. */
function OfficialTable({
  label,
  rows,
  onOpen
}: {
  label: string
  rows: OfficialRow[]
  onOpen?: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <MiniTable
        label={label}
        columns={OFFICIAL_COLUMNS}
        minWidth={1000}
        left={[OFFICIAL_HEAD.length + 1]}
        head={[
          '',
          ...OFFICIAL_MEASURES.map((m) => (
            <span key={m.id} title={m.title}>
              {m.short}
            </span>
          )),
          ''
        ]}
        rows={rows.map((r) => ({
          key: r.key,
          strong: r.league,
          ...(onOpen && r.id && !r.league
            ? { title: `Open ${r.name}’s seasons`, onOpen: () => onOpen(r.id as string) }
            : {}),
          cells: [
            <span key="n" className="flex min-w-0 items-center gap-2 font-sans text-[13px]">
              <span className={cn('truncate', !r.league && 'font-medium')}>{r.name}</span>
              {r.jersey && (
                <span className="shrink-0 font-mono text-[10.5px] text-fg-3">#{r.jersey}</span>
              )}
            </span>,
            ...r.cells,
            <span key="x" className="pl-2 font-sans text-[11.5px] font-normal text-fg-3">
              {r.note ?? ''}
            </span>
          ]
        }))}
      />
    </div>
  )
}

/** Every official of the season in scope, beside the league's line for the same games. */
function OfficialsSeason({
  data,
  scope,
  onScope,
  gameTypes,
  onOpen
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  gameTypes: GameType[]
  onOpen: (id: string) => void
}): React.JSX.Element {
  const { value, error } = useOfficialsSeason(scope.season, gameTypes, data.version)
  const types = seasonTypes(seasonOf(data.seasons, scope.season)).filter((t) => t !== 'all-star')
  return (
    <div className="flex flex-col gap-4 px-8 pt-[22px] pb-8">
      <div className="flex items-center gap-3">
        <h1 className="m-0 text-[20px] leading-none font-semibold tracking-[-0.01em]">
          Officials of {seasonLabel(scope.season)}
        </h1>
        <StatsSelect
          title="Season type"
          value={scope.seasonType}
          options={types.map((t) => ({ value: t, label: typeLabel(t) }))}
          onChange={(t) => onScope({ ...scope, seasonType: t })}
        />
      </div>
      {!value ? (
        <Loading error={error} />
      ) : (
        <>
          <p className="m-0 text-[12.5px] text-fg-3">
            {value.reason ?? coverageText(value.coverage)}
          </p>
          {value.officials.length === 0 ? (
            <p className="m-0 text-[12.5px] text-fg-3">No officials listed in scope.</p>
          ) : (
            <OfficialTable label="Officials" rows={seasonRows(value)} onOpen={onOpen} />
          )}
          <OfficialNotes />
        </>
      )}
    </div>
  )
}

/** One official's seasons, newest first, each with the league's line below it. */
function OfficialCareer({
  official,
  data,
  gameTypes,
  typesLabel,
  onBack,
  backLabel
}: {
  official: string
  data: StatsData
  gameTypes: GameType[]
  typesLabel: string
  onBack: () => void
  backLabel: string
}): React.JSX.Element {
  const { value, error } = useOfficialCareer(official, gameTypes, data.version)
  return (
    <div className="flex flex-col gap-4 px-8 pt-[22px] pb-8">
      <button
        type="button"
        onClick={onBack}
        className="flex cursor-pointer items-center gap-1 self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
      >
        <ChevronLeft className="size-3.5" />
        {backLabel}
      </button>
      {!value ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="flex items-baseline gap-2.5">
            <h1 className="m-0 text-[20px] leading-none font-semibold tracking-[-0.01em]">
              {value.name}
            </h1>
            {value.jersey && (
              <span className="font-mono text-[12px] text-fg-3">#{value.jersey}</span>
            )}
            <span className="text-[12px] text-fg-3">Official · {typesLabel}</span>
          </div>
          {value.seasons.length === 0 ? (
            <p className="m-0 text-[12.5px] text-fg-3">No games in these season types.</p>
          ) : (
            <OfficialTable label="Seasons" rows={careerRows(value)} />
          )}
          <OfficialNotes />
        </>
      )}
    </div>
  )
}

function OfficialNotes(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {OFFICIAL_NOTES.map((n) => (
        <p key={n} className="m-0 text-[12px] text-fg-3">
          {n}
        </p>
      ))}
    </div>
  )
}

function Header({
  view,
  onOpenTeam
}: {
  view: GameHeader
  onOpenTeam: (team: string) => void
}): React.JSX.Element {
  const side = (s: HeaderSide, home: boolean): React.JSX.Element => {
    const body = (
      <>
        <span className={cn('flex flex-col gap-[7px]', home ? 'items-start' : 'items-end')}>
          <span className="text-[34px] leading-[0.9] font-bold tracking-[-0.04em]">{s.code}</span>
          <span className="text-[12.5px] leading-none text-fg-2">{s.name}</span>
          {s.record && (
            <span className="font-mono text-[11px] leading-none text-fg-3">
              {s.record} before this game
            </span>
          )}
          {s.form.length > 0 && (
            <span className="flex gap-[3px]">
              {s.form.map((f, i) => (
                <span
                  key={i}
                  title={f.title}
                  className={cn(
                    'flex size-[17px] items-center justify-center rounded-[4px] font-mono text-[10px] font-semibold',
                    f.result === 'W' ? 'bg-good-s text-good' : 'bg-bad-s text-bad'
                  )}
                >
                  {f.result}
                </span>
              ))}
            </span>
          )}
        </span>
        {s.score && (
          <span
            data-score={s.code}
            className={cn(
              'font-cond text-[64px] leading-[0.8] font-extrabold tabular-nums',
              s.lost && 'text-fg-3'
            )}
          >
            {s.score}
          </span>
        )}
      </>
    )
    const style = cn(
      'flex items-center gap-[22px]',
      home ? 'flex-row-reverse justify-end text-left' : 'justify-end text-right'
    )
    return s.id ? (
      <button
        type="button"
        title={`Open the ${s.name} dashboard`}
        onClick={() => s.id && onOpenTeam(s.id)}
        className={cn(style, 'cursor-pointer')}
      >
        {body}
      </button>
    ) : (
      <div className={style}>{body}</div>
    )
  }
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-7 border-b border-line pb-5">
      {side(view.away, false)}
      <div className="flex min-w-[190px] flex-col items-center gap-2 text-center">
        <h1 className="m-0 rounded-[5px] bg-panel-2 px-[9px] py-[5px] font-mono text-[11px] leading-none font-semibold text-fg-2">
          {view.status}
        </h1>
        <span className="text-[12px] leading-[1.35] text-fg-3">{view.line}</span>
        {view.place && <span className="text-[12px] leading-[1.35] text-fg-3">{view.place}</span>}
      </div>
      {side(view.home, true)}
    </header>
  )
}

const BOX_COLUMNS = `minmax(190px,1.6fr) ${BOX_HEAD.map((h) =>
  h === 'FG' || h === '3P' || h === 'FT' ? 'minmax(46px,1fr)' : 'minmax(38px,1fr)'
).join(' ')}`

function Box({
  side,
  onOpenPlayer,
  onOpenTeam
}: {
  side: BoxSide
  onOpenPlayer: (id: string) => void
  onOpenTeam: (team: string) => void
}): React.JSX.Element {
  const player = (
    r: BoxSide['starters'][number]
  ): React.ComponentProps<typeof MiniTable>['rows'][number] => ({
    key: r.id,
    title: `Open ${r.name}’s dashboard`,
    onOpen: () => onOpenPlayer(r.id),
    cells: [
      <span key="n" className="flex min-w-0 items-center gap-2 font-sans text-[13px] font-medium">
        <span className="truncate">{r.name}</span>
        {r.position && (
          <span className="shrink-0 font-mono text-[10.5px] font-normal text-fg-3">
            {r.position}
          </span>
        )}
      </span>,
      ...r.cells.map((c, i) => (
        <span key={i} className={cn(i === r.cells.length - 1 && 'font-semibold')}>
          {c}
        </span>
      ))
    ]
  })
  const divider = (
    key: string,
    label: string
  ): React.ComponentProps<typeof MiniTable>['rows'][number] => ({
    key,
    cells: [
      <span
        key="l"
        className="font-sans text-[11px] font-semibold tracking-[0.04em] text-fg-3 uppercase"
      >
        {label}
      </span>
    ]
  })
  return (
    <section className="flex flex-col gap-2" aria-label={`${side.code} box score`}>
      <div className="flex items-baseline gap-2">
        {side.id ? (
          <button
            type="button"
            onClick={() => side.id && onOpenTeam(side.id)}
            className="cursor-pointer text-[15px] leading-none font-semibold tracking-[-0.01em] hover:text-cobalt"
          >
            {side.name}
          </button>
        ) : (
          <span className="text-[15px] leading-none font-semibold">{side.name}</span>
        )}
        <span className="text-[12px] leading-none text-fg-3">
          {side.startersKnown ? 'Box score' : 'Box score · who started is not listed'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <MiniTable
          label={`${side.code} box score`}
          columns={BOX_COLUMNS}
          minWidth={960}
          head={['Player', ...BOX_HEAD]}
          rows={[
            ...(side.startersKnown ? [divider('s', 'Starters')] : []),
            ...side.starters.map(player),
            ...(side.bench.length ? [divider('b', 'Bench')] : []),
            ...side.bench.map(player),
            {
              key: 'totals',
              strong: true,
              cells: [
                <span key="t" className="font-sans">
                  Totals
                </span>,
                ...side.totals
              ]
            }
          ]}
        />
      </div>
      {side.shortfall && <div className="text-[12px] text-warn">{side.shortfall}</div>}
    </section>
  )
}
