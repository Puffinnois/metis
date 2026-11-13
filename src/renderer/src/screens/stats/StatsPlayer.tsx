import { AssistNetwork } from '@/components/stats/AssistNetwork'
import { ShotChart } from '@/components/stats/ShotChart'
import { shotRequest } from '@/lib/stats/shotChart'
import { useMemo, useState } from 'react'
import { Segmented } from '@/components/stats/controls'
import { GameChart } from '@/components/stats/GameChart'
import {
  Initials,
  Loading,
  MiniTable,
  Notes,
  ResultChip,
  SectionHead,
  SplitTables,
  TabRow
} from '@/components/stats/parts'
import { PlayerRail } from '@/components/stats/PlayerRail'
import { playSplitDefs, playSplitTableNotes } from '@/lib/stats/splits'
import { CompareButton } from '@/screens/stats/StatsCompare'
import { StatusChip } from '@/components/stats/StatusChip'
import { statusTag } from '@/lib/stats/availability'
import { ScopeBar } from '@/components/stats/ScopeBar'
import { StatSection, StatSections } from '@/components/stats/StatLines'
import { useNoteContext } from '@/lib/dev/noteContext'
import { DASHBOARD_MODES, sectionMetrics, sectionViews } from '@/lib/stats/dashboard'
import type { ExploreSubject } from '@/lib/stats/explore'
import { amongWords, fmtStat } from '@/lib/stats/format'
import { qualifies, tabOf } from '@/lib/stats/leaderboard'
import {
  careerQuery,
  careerRows,
  careerTotal,
  gameSeries,
  LINE_METRICS,
  LOG_COLUMNS,
  logDifferences,
  logQuery,
  logRows,
  logTotalCells,
  logTotalQuery,
  OVERVIEW_SECTION,
  PLAYER_DASH_TABS,
  playerFacts,
  poolSize,
  positionQuery,
  railQuery,
  railRows,
  rankedPool,
  selfQuery,
  SPLIT_METRICS,
  splitDefs,
  splitName,
  splitQueries,
  splitTable,
  TAB_SECTIONS,
  tileViews,
  type LineRow,
  type PlayerTab,
  type RailPosition
} from '@/lib/stats/player'
import {
  matchupScope,
  pairCount,
  pairGap,
  pairRows,
  pairsNote,
  PAIR_HEAD,
  PAIR_LIMIT
} from '@/lib/stats/matchups'
import {
  bioFacts,
  combineNote,
  combineSections,
  combineYears,
  draftView,
  noCombine,
  type Fact
} from '@/lib/stats/profile'
import { rangeLabel, scopeLabel, seasonOf, typeLabel, type StatsScope } from '@/lib/stats/scope'
import { seasonLabel } from '@shared/stats/seasons'
import {
  useAvailability,
  useMatchups,
  usePlayerInfo,
  useProfile,
  useSeasonGames,
  useStatsQueries,
  useStatsQuery,
  type StatsData
} from '@/lib/stats/useStats'
import { cn } from '@/lib/utils'
import { WithOrWithout } from './StatsOnCourt'
import type { BoardMode, StatsMatchupPair, StatsPlayerInfo, StatsRow } from '@shared/stats/types'

/** The dashboard is about one player: never another player's answers while their own load. */
const FRESH = { keepLast: false }

interface TabProps {
  data: StatsData
  scope: StatsScope
  player: string
  /** Their position group in scope: what they are ranked among. */
  position: string | null
  info: StatsPlayerInfo | null
  mode: BoardMode
  onOpenGame: (game: string) => void
  onOpenPlayer: (player: string) => void
}

/** Rail, header, and one set of tabs for every position. */
export function StatsPlayer({
  data,
  scope,
  onScope,
  player,
  onPlayer,
  tab,
  onTab,
  onOpenTeam,
  onOpenGame,
  onOpenLeaderboard,
  onCompare,
  onTrend
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  player: string
  onPlayer: (player: string) => void
  tab: PlayerTab
  onTab: (tab: PlayerTab) => void
  onOpenTeam: (team: string) => void
  onOpenGame: (game: string) => void
  onOpenLeaderboard: () => void
  /** Compare with these players or teams: Explore's Compare tab. */
  onCompare?: (subjects: ExploreSubject[]) => void
  /** This dashboard's player or team over their seasons in Trends, on a metric or the one shown. */
  onTrend?: (metric?: string) => void
}): React.JSX.Element {
  const {
    value: info,
    error: infoError,
    loading: infoLoading
  } = usePlayerInfo(player, data.version)
  const [mode, setMode] = useState<BoardMode>('perGame')
  const [railPosition, setRailPosition] = useState<RailPosition>('ALL')
  const [railTeam, setRailTeam] = useState<string | null>(null)
  const [metric, setMetric] = useState('pts')
  const teams = seasonOf(data.seasons, scope.season)?.teams ?? []
  // A team of another season is not in this one's list.
  const shownTeam = teams.some((t) => t.id === railTeam) ? railTeam : null
  const rq = useMemo(
    () => railQuery(railPosition, shownTeam, metric, scope, mode, data.byId),
    [railPosition, shownTeam, metric, scope, mode, data.byId]
  )
  const rail = useStatsQuery(rq, data.version)
  const sq = useMemo(() => selfQuery(player, scope), [player, scope])
  const self = useStatsQuery(sq, data.version, FRESH)
  const row = self.result?.rows.find((r) => r.id === player) ?? null
  const position = row?.position ?? info?.position ?? null
  useNoteContext('player', {
    label: info?.name ?? player,
    data: { id: player, name: info?.name ?? null, position, tab }
  })

  return (
    <div className="flex min-h-0 flex-1">
      <PlayerRail
        position={railPosition}
        onPosition={setRailPosition}
        metric={metric}
        onMetric={setMetric}
        rows={(search) =>
          rail.result ? railRows(rail.result, metric, data.byId, mode, search, player) : []
        }
        teams={teams}
        team={shownTeam}
        onTeam={setRailTeam}
        loading={rail.loading}
        error={rail.error}
        range={rangeLabel(scope)}
        byId={data.byId}
        selected={player}
        onSelect={onPlayer}
      />
      <div className="min-w-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {infoError || self.error ? (
          <Loading error={infoError ?? self.error} />
        ) : !info && !infoLoading ? (
          <div className="py-20 text-center text-[13px] text-fg-3">
            This player is not in the data.
          </div>
        ) : !info || !self.result ? (
          <Loading />
        ) : (
          <div className="flex flex-col gap-5 px-8 pt-[22px] pb-8">
            <Header
              data={data}
              scope={scope}
              onScope={onScope}
              info={info}
              row={row}
              onOpenTeam={onOpenTeam}
              onCompare={onCompare && (() => onCompare([{ entity: 'player', id: player }]))}
            />
            <TabRow label="Player dashboard" tabs={PLAYER_DASH_TABS} value={tab} onChange={onTab}>
              <div className="mb-2 flex shrink-0 items-center gap-4">
                {onTrend && (
                  <button
                    type="button"
                    onClick={() => onTrend()}
                    className="cursor-pointer text-[12.5px] font-medium whitespace-nowrap text-fg-2 hover:text-cobalt"
                  >
                    Trends →
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="cursor-pointer text-[12.5px] font-medium whitespace-nowrap text-fg-2 hover:text-cobalt"
                >
                  Player leaderboards →
                </button>
              </div>
            </TabRow>
            {row === null && tab !== 'profile' && (
              <div className="rounded-[8px] bg-panel-2 px-4 py-3 text-[13px] text-fg-2">
                {info.name} played no games in {scopeLabel(scope)}.
              </div>
            )}
            {tab !== 'log' && tab !== 'profile' && (row !== null || tab === 'overview') && (
              <div className="self-start">
                <Segmented
                  label="Totals or rates"
                  value={mode}
                  options={DASHBOARD_MODES}
                  onChange={setMode}
                />
              </div>
            )}
            <TabBody
              key={`${player}:${tab}`}
              tab={tab}
              played={row !== null}
              data={data}
              scope={scope}
              player={player}
              position={position}
              info={info}
              mode={mode}
              onOpenGame={onOpenGame}
              onOpenPlayer={onPlayer}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function TabBody({
  tab,
  played,
  ...props
}: TabProps & { tab: PlayerTab; played: boolean }): React.JSX.Element | null {
  if (tab === 'overview') return <Overview {...props} played={played} />
  // The profile is about the player, not a season: it shows whatever is in scope.
  if (tab === 'profile') return <Profile {...props} />
  if (!played) return null
  if (tab === 'log') return <GameLog {...props} />
  if (tab === 'splits') return <Splits {...props} />
  if (tab === 'matchups') return <Matchups {...props} />
  if (tab === 'shots') return <Shots {...props} />
  if (tab === 'plays') return <Plays {...props} />
  if (tab === 'on_off') return <OnOff {...props} />
  return <LinesTab {...props} tab={tab} />
}

/** Bio, draft and combine, side by side, then the combine's sections with their percentiles. */
function Profile({ data, player }: TabProps): React.JSX.Element {
  const { value, error } = useProfile(player, data.version)
  const [picked, setPicked] = useState<number | null>(null)
  if (!value) return <Loading error={error} />
  const draft = draftView(value)
  const years = combineYears(value)
  const combine = value.combines.find((c) => c.year === picked) ?? value.combines[0] ?? null
  const parts = combine ? combineSections(combine, years) : []
  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-x-10 gap-y-7">
        <FactList
          title="Bio"
          note={value.bio ? `NBA roster, ${seasonLabel(value.bio.season)}` : undefined}
          facts={value.bio ? bioFacts(value.bio) : []}
          empty="No NBA roster lists them."
        />
        <FactList title="Draft" facts={draft.facts} empty={draft.note ?? ''} />
      </div>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHead
            title="Draft combine"
            note={
              combine ? `${combine.year} · ${combine.position ?? 'No position listed'}` : undefined
            }
          />
          {value.combines.length > 1 && combine && (
            <Segmented
              label="Combine year"
              value={String(combine.year)}
              options={value.combines.map((c) => ({
                value: String(c.year),
                label: String(c.year)
              }))}
              onChange={(y) => setPicked(Number(y))}
            />
          )}
        </div>
        {combine ? (
          <>
            <StatSections sections={parts.flatMap((p) => (p.section ? [p.section] : []))} />
            <Notes
              notes={[
                combineNote(combine, years),
                ...parts.flatMap((p) => (p.absent ? [p.absent] : []))
              ]}
            />
          </>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-3">{noCombine(value)}</p>
        )}
      </section>
    </div>
  )
}

function FactList({
  title,
  note,
  facts,
  empty
}: {
  title: string
  note?: string
  facts: Fact[]
  empty: string
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <SectionHead title={title} note={note} />
      {facts.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">{empty}</p>
      ) : (
        <dl className="m-0 flex flex-col border-b border-line-2">
          {facts.map((f) => (
            <div
              key={f.label}
              className="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center gap-3.5 border-t border-line-2"
            >
              <dt className="text-[12.5px] text-fg-2">{f.label}</dt>
              <dd className="m-0 text-[12.5px] font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

/** Their team's numbers on and off the floor, the actual on-court rates, then with or without a teammate. */
function OnOff(props: TabProps): React.JSX.Element {
  const { data, scope, player, info, onOpenPlayer } = props
  return (
    <div className="flex flex-col gap-7">
      <LinesTab {...props} tab="on_off" />
      <WithOrWithout
        data={data}
        scope={scope}
        player={player}
        playerName={info?.name ?? 'They'}
        onOpenPlayer={onOpenPlayer}
      />
    </div>
  )
}

/** The shot chart for the scope, then the shot metrics, ranked among the player's position. */
function Shots(props: TabProps): React.JSX.Element {
  const { data, scope, player } = props
  const request = useMemo(() => shotRequest('player', player, scope), [player, scope])
  return (
    <div className="flex flex-col gap-7">
      <ShotChart request={request} version={data.version} />
      <LinesTab {...props} tab="shots" />
    </div>
  )
}

/** The play-derived counts, then who the player feeds and who feeds them. */
function Plays(props: TabProps): React.JSX.Element {
  const { data, scope, player, onOpenPlayer } = props
  return (
    <div className="flex flex-col gap-7">
      <LinesTab {...props} tab="plays" />
      <AssistNetwork
        entity="player"
        id={player}
        scope={scope}
        version={data.version}
        onOpenPlayer={onOpenPlayer}
      />
    </div>
  )
}

/** The defender's totals, then the pairs behind them: who they guarded, and who guarded them. */
function Matchups(props: TabProps): React.JSX.Element {
  const { data, scope, player, onOpenPlayer } = props
  const gap = pairGap(scope)
  const { value, error } = useMatchups(
    gap ? null : player,
    scope.season,
    matchupScope(scope),
    data.version
  )
  return (
    <div className="flex flex-col gap-7">
      <LinesTab {...props} tab="matchups" />
      {gap ? (
        <section className="flex flex-col gap-2.5">
          <SectionHead title="Pairs" />
          <p className="m-0 text-[12.5px] text-fg-3">{gap}</p>
        </section>
      ) : !value ? (
        <Loading error={error} />
      ) : (
        <>
          <PairTable
            title="Who they guarded most"
            pairs={value.guarded}
            empty="No matchups as a defender in these games."
            onOpenPlayer={onOpenPlayer}
          />
          <PairTable
            title="Who guarded them most"
            pairs={value.guardedBy}
            empty="No matchups on offense in these games."
            onOpenPlayer={onOpenPlayer}
          />
          <Notes notes={[pairsNote(value.source)]} />
        </>
      )}
    </div>
  )
}

function PairTable({
  title,
  pairs,
  empty,
  onOpenPlayer
}: {
  title: string
  pairs: StatsMatchupPair[]
  empty: string
  onOpenPlayer: (player: string) => void
}): React.JSX.Element {
  const [all, setAll] = useState(false)
  const rows = pairRows(pairs, all ? null : PAIR_LIMIT)
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title={title} note={pairCount(rows.length, pairs.length)} />
      {pairs.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <MiniTable
            label={title}
            columns={`minmax(150px,1.6fr) 32px repeat(${PAIR_HEAD.length - 2}, minmax(52px,1fr))`}
            minWidth={760}
            head={PAIR_HEAD}
            rows={rows.map((r) => ({
              key: r.key,
              title: `Open ${r.name}’s dashboard`,
              onOpen: () => onOpenPlayer(r.key),
              cells: [
                <span key="n" className="font-sans text-[13px] font-medium">
                  {r.name}
                </span>,
                ...r.cells
              ]
            }))}
          />
        </div>
      )}
      {pairs.length > PAIR_LIMIT && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
        >
          {all ? 'Show fewer' : `Show all ${pairs.length}`}
        </button>
      )}
    </section>
  )
}

function Header({
  data,
  scope,
  onScope,
  info,
  row,
  onOpenTeam,
  onCompare
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  info: StatsPlayerInfo
  row: StatsRow | null
  onOpenTeam: (team: string) => void
  onCompare?: () => void
}): React.JSX.Element {
  const { first, last } = splitName(info.name)
  const code = row?.team ?? info.team?.code ?? null
  // Their team that season, not their team now: a player who moved since.
  const teamId =
    seasonOf(data.seasons, scope.season)?.teams.find((t) => t.code === code)?.id ??
    (row ? null : (info.team?.id ?? null))
  const position = row?.position ?? info.position
  const qualified = row ? qualifies(row, tabOf('player', 'ALL')) : true
  const ids = useMemo(() => [info.id], [info.id])
  const { value: availability } = useAvailability(ids, data.version)
  const tag = statusTag(availability?.[0])
  return (
    <header className="flex items-end justify-between gap-6">
      <div className="flex min-w-0 items-end gap-4">
        <Initials name={info.name} size={72} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] leading-none font-medium text-fg-2">
            {position && (
              <span className="rounded-[4px] bg-cobalt px-[7px] py-1 font-mono text-[11.5px] font-semibold text-on-cobalt">
                {position}
              </span>
            )}
            {code &&
              (teamId ? (
                <button
                  type="button"
                  title="Open the team’s dashboard"
                  onClick={() => onOpenTeam(teamId)}
                  className="cursor-pointer underline decoration-line underline-offset-[3px] hover:text-cobalt"
                >
                  {code}
                </button>
              ) : (
                <span>{code}</span>
              ))}
            <span className="text-fg-3">·</span>
            <span>
              {row ? `${row.games} ${row.games === 1 ? 'game' : 'games'}` : 'No games'} ·{' '}
              {rangeLabel(scope)}
            </span>
            {row && !qualified && (
              <span
                title="Below 1,000 minutes over 82 games, scaled to the games in range"
                className="rounded-[4px] px-1.5 py-[3px] font-mono text-[11px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]"
              >
                Not qualified
              </span>
            )}
            {tag && <StatusChip tag={tag} />}
          </div>
          <h1 className="m-0 flex flex-col gap-0.5">
            {first && (
              <span className="text-[20px] leading-none font-normal tracking-[-0.01em] text-fg-2">
                {first}
              </span>
            )}
            <span className="text-[40px] leading-none font-bold tracking-[-0.035em]">{last}</span>
          </h1>
          <span className="text-[12px] leading-[1.35] text-fg-3">
            {playerFacts(info).join(' · ')}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onCompare && <CompareButton onClick={onCompare} />}
        <ScopeBar scope={scope} seasons={data.seasons} onChange={onScope} />
      </div>
    </header>
  )
}

/** The tiles, the percentile rankings, points by game, and the career by season. */
function Overview({
  data,
  scope,
  player,
  position,
  info,
  mode,
  played
}: TabProps & { played: boolean }): React.JSX.Element {
  const q = useMemo(
    () => (played ? positionQuery(OVERVIEW_SECTION.metrics, position, scope, mode) : null),
    [played, position, scope, mode]
  )
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  const gq = useMemo(
    () => (played ? { ...logQuery(player, scope), metrics: ['pts'] } : null),
    [played, player, scope]
  )
  const { result: byGame } = useStatsQuery(gq, data.version, FRESH)
  const { value: games } = useSeasonGames(scope.season, data.version)
  const ranked = result ? rankedPool(result, position) : null
  const pool = ranked ? poolSize(ranked, position) : 0
  const tiles = ranked ? tileViews(ranked, player, data.byId, mode, position) : []
  const view = ranked
    ? sectionViews([OVERVIEW_SECTION], ranked, player, data.byId, mode, position)[0]
    : null
  const series = gameSeries(byGame, games, 'pts', 'Points')
  const fmt = (x: number): string => fmtStat(x, { unit: 'number', decimals: 1 })
  return (
    <div className="flex flex-col gap-7">
      {played && (
        <>
          {error && <Loading error={error} />}
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[10px] bg-line shadow-[0_0_0_1px_var(--line)]">
            {tiles.map((t) => (
              <div
                key={t.metric}
                className="flex flex-col gap-2 bg-panel px-4 py-3.5"
                title={t.title || undefined}
              >
                <span className="text-[12px] leading-[1.2] font-medium text-fg-3">{t.label}</span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-cond text-[40px] leading-[0.85] font-extrabold tabular-nums">
                    {t.value}
                  </span>
                  {t.chip && (
                    <span
                      className={cn(
                        'rounded-[4px] px-1.5 py-[3px] font-mono text-[11px] leading-none',
                        t.tone === 'good' && 'bg-good-s font-semibold text-good',
                        t.tone === 'bad' && 'bg-bad-s font-semibold text-bad',
                        t.tone === 'mid' && 'font-medium text-fg-3'
                      )}
                    >
                      {t.chip}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-8">
            {view ? (
              <StatSection
                section={{ ...view, note: `Among ${pool} qualified ${amongWords(position)}` }}
              />
            ) : (
              <span />
            )}
            <section className="flex flex-col gap-2.5">
              <SectionHead title="Points by game" note={rangeLabel(scope)} />
              <GameChart
                series={series}
                format={fmt}
                label={`${info?.name ?? 'Player'} points by game`}
              />
            </section>
          </div>
          <Notes notes={result?.notes ?? []} />
        </>
      )}
      <Career data={data} scope={scope} player={player} mode={mode} />
    </div>
  )
}

/** By season, with a line for the seasons inside the career with no games. */
function Career({
  data,
  scope,
  player,
  mode
}: Pick<TabProps, 'data' | 'scope' | 'player' | 'mode'>): React.JSX.Element {
  const seasons = useMemo(() => data.seasons.map((s) => s.season), [data.seasons])
  const queries = useMemo(
    () =>
      seasons.length
        ? new Map([
            ['seasons', careerQuery(player, seasons, scope, mode, true)],
            ['career', careerQuery(player, seasons, scope, mode, false)]
          ])
        : null,
    [player, seasons, scope, mode]
  )
  const { results, error } = useStatsQueries(queries, data.version)
  if (!results) return <Loading error={error} />
  const rows = careerRows(results.get('seasons') ?? null, data.byId, mode)
  const played = rows.find((r) => !r.gap)?.key
  const total = careerTotal(
    results.get('career') ?? null,
    data.byId,
    mode,
    played === undefined ? null : Number(played)
  )
  const head = LINE_METRICS.map((id) => data.byId.get(id)?.short ?? id)
  const cells = (r: LineRow): React.ReactNode[] => [
    <span key="l" className="font-sans text-[13px] font-medium">
      {r.label}
    </span>,
    <span key="t" className="text-fg-2">
      {r.team ?? ''}
    </span>,
    <span key="g" className="text-fg-2">
      {r.games}
    </span>,
    ...(r.gap
      ? LINE_METRICS.map((id, i) => (
          <span key={id} className="text-fg-3">
            {i === 0 ? 'No games' : ''}
          </span>
        ))
      : r.cells.map((c, i) => (
          <span key={i} title={c.title || undefined} className={cn(c.text === '—' && 'text-fg-3')}>
            {c.text}
          </span>
        )))
  ]
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead
        title="Career by season"
        note={`${typeLabel(scope.seasonType)} · their last team that season`}
      />
      {rows.length === 0 && (
        <p className="m-0 text-[12.5px] text-fg-3">
          No games in {typeLabel(scope.seasonType).toLowerCase()} in any season.
        </p>
      )}
      <div className={cn('overflow-x-auto', rows.length === 0 && 'hidden')}>
        <MiniTable
          label="Career by season"
          columns={`minmax(72px,1fr) 44px 40px ${head.map(() => 'minmax(52px,1fr)').join(' ')}`}
          minWidth={1010}
          head={['Season', 'Team', 'G', ...head]}
          left={[1]}
          rows={[
            ...rows.map((r) => ({ key: r.key, cells: cells(r) })),
            ...(total ? [{ key: total.key, cells: cells(total), strong: true }] : [])
          ]}
        />
      </div>
    </section>
  )
}

/** A stat tab: its sections, ranked among the qualified players of their position. */
function LinesTab({
  data,
  scope,
  player,
  position,
  mode,
  tab
}: TabProps & { tab: keyof typeof TAB_SECTIONS }): React.JSX.Element {
  const sections = TAB_SECTIONS[tab]
  const q = useMemo(
    () => positionQuery(sectionMetrics(sections), position, scope, mode),
    [sections, position, scope, mode]
  )
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  if (!result) return <Loading error={error} />
  const ranked = rankedPool(result, position)
  return (
    <div className="flex flex-col gap-5">
      <StatSections sections={sectionViews(sections, ranked, player, data.byId, mode, position)} />
      <Notes
        notes={[
          `Percentiles and ranks among ${poolSize(ranked, position)} qualified ${amongWords(position)}.`,
          ...result.notes
        ]}
      />
    </div>
  )
}

/** Every game in scope, newest first, and the total it adds up to. */
function GameLog({ data, scope, player, onOpenGame }: TabProps): React.JSX.Element {
  const lq = useMemo(() => logQuery(player, scope), [player, scope])
  const tq = useMemo(() => logTotalQuery(player, scope), [player, scope])
  const { result, error } = useStatsQuery(lq, data.version, FRESH)
  const { result: total } = useStatsQuery(tq, data.version, FRESH)
  const { value: games } = useSeasonGames(scope.season, data.version)
  if (!result) return <Loading error={error} />
  const rows = logRows(result, games, data.byId)
  const whole = total?.rows[0]
  const off = total ? logDifferences(result, whole) : []
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title="Game log" note={`${rows.length} games · ${scopeLabel(scope)}`} />
      <div className="overflow-x-auto">
        <MiniTable
          label="Game log"
          columns={`52px 64px 42px 104px ${LOG_COLUMNS.map((c) =>
            // "100.0%" and "11-23" need more room than a count.
            c.pair || c.metric?.endsWith('_pct') ? 'minmax(52px,1fr)' : 'minmax(40px,1fr)'
          ).join(' ')}`}
          minWidth={1340}
          head={['Date', 'Opp', 'Team', 'Result', ...LOG_COLUMNS.map((c) => c.label)]}
          left={[1, 2, 3]}
          rows={[
            ...rows.map((r) => ({
              key: r.key,
              title: r.type ? `${r.type}: open this game` : 'Open this game',
              onOpen: () => onOpenGame(r.key),
              cells: [
                <span key="d" className="text-fg-3">
                  {r.date}
                </span>,
                <span key="o" className="font-semibold whitespace-nowrap">
                  {r.opponent}
                  {!r.started && <span className="ml-1 font-normal text-fg-3">·</span>}
                </span>,
                <span key="t" className="text-fg-2">
                  {r.team ?? ''}
                </span>,
                <ResultChip key="s" result={r.result} score={r.score} />,
                ...r.cells.map((c, i) => <span key={i}>{c}</span>)
              ]
            })),
            ...(whole
              ? [
                  {
                    key: 'total',
                    strong: true,
                    cells: [
                      <span key="d" className="font-sans">
                        Total
                      </span>,
                      '',
                      '',
                      <span key="g" className="text-left font-normal text-fg-2">
                        {whole.games} games
                      </span>,
                      ...logTotalCells(whole, data.byId)
                    ]
                  }
                ]
              : [])
          ]}
        />
      </div>
      <Notes
        notes={[
          '· marks a game off the bench, or one whose starters the source does not list.',
          ...(off.length ? [`The games do not add up to the total on: ${off.join(', ')}.`] : []),
          ...result.notes
        ]}
      />
    </section>
  )
}

/**
 * Home and road, wins and losses and the rest from the engine's filters; quarters, clutch, the score,
 * the last minutes and garbage time from the play by play; then by month and by opponent.
 */
function Splits({ data, scope, player, mode }: TabProps): React.JSX.Element {
  const season = seasonOf(data.seasons, scope.season)
  const defs = useMemo(() => [...splitDefs(season), ...playSplitDefs()], [season])
  const queries = useMemo(
    () => splitQueries(player, defs, scope, mode),
    [player, defs, scope, mode]
  )
  const { results, error } = useStatsQueries(queries, data.version)
  if (!results) return <Loading error={error} />
  const groups = splitTable(results, defs, season, data.byId, mode)
  const head = SPLIT_METRICS.map((id) => data.byId.get(id)?.short ?? id)
  return (
    <div className="flex flex-col gap-6">
      <SplitTables groups={groups} head={head} />
      <Notes notes={playSplitTableNotes(results, scope)} />
    </div>
  )
}
