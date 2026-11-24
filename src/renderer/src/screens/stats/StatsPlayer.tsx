import { AssistNetwork } from '@/components/stats/AssistNetwork'
import { CategoryTabs } from '@/components/stats/CategoryBar'
import { CategorySections } from '@/components/stats/CategorySections'
import { CareerStrip } from '@/components/stats/CareerStrip'
import { FavouriteName, FavouriteStar } from '@/components/stats/FavouriteStar'
import { MetricHead } from '@/components/stats/MetricCard'
import { ShotChart } from '@/components/stats/ShotChart'
import { useScreenState } from '@/lib/stats/session'
import { shotRequest } from '@/lib/stats/shotChart'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  TabRow,
  TABLE_SCROLL
} from '@/components/stats/parts'
import { PlayerRail } from '@/components/stats/PlayerRail'
import { playSplitDefs, playSplitTableNotes } from '@/lib/stats/splits'
import { CompareButton } from '@/screens/stats/StatsCompare'
import { StatusChip } from '@/components/stats/StatusChip'
import { statusTag } from '@/lib/stats/availability'
import { ScopeBar } from '@/components/stats/ScopeBar'
import { StatSection, StatSections } from '@/components/stats/StatLines'
import { useNoteContext } from '@/lib/dev/noteContext'
import {
  dashboardModes,
  sectionMetrics,
  sectionViews,
  shownTab,
  shownTabs
} from '@/lib/stats/dashboard'
import {
  categoryOfTab,
  categoryTab,
  pageSections,
  type PageSection
} from '@/lib/stats/categoryPage'
import { boardCategories } from '@/lib/stats/categoryViews'
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
  playerTabOf,
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
import { currentLeague, seasonLabel, useLeague } from '@/lib/stats/league'
import { downloadOf, leagueHolds, useLeagueDownloads } from '@/lib/stats/downloads'
import { offerSwitch, playerSwitch, withdrawSwitch } from '@/lib/stats/leagueSwitch'
import { otherHeading, otherRows, type OtherRow } from '@/lib/stats/otherPlayers'
import { moreRows, moreTarget, playerIndex, type MoreRow } from '@/lib/stats/playerSearch'
import { rowQualifier } from '@/lib/stats/qualifying'
import {
  useAvailability,
  useMatchups,
  usePlayerInfo,
  useProfile,
  useSeasonGames,
  useOtherCareer,
  useOtherPlayers,
  usePlayerIndex,
  useStatsQueries,
  useStatsQuery,
  type ReadState,
  type StatsData
} from '@/lib/stats/useStats'
import { stripHint, type StripHint } from '@/lib/stats/careerStrip'
import { useFavourites } from '@/lib/stats/favourites'
import { cn } from '@/lib/utils'
import { WithOrWithout } from './StatsOnCourt'
import type {
  BoardMode,
  StatsMatchupPair,
  StatsOtherCareer,
  StatsPlayerInfo,
  StatsResult,
  StatsRow
} from '@shared/stats/types'
import { leagueOf, pairedLeague, type LeagueId } from '@shared/leagues'
import type { NavLocation } from '@/lib/navHistory'

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
  /** The career strip's ways out: the Data panel on the other league, and that league's page. */
  onOpenData?: (league: LeagueId) => void
  onOpenPage?: (location: NavLocation) => void
  /** The page's read of the other career, and the header hint's ask to show the strip. */
  career: ReadState<StatsOtherCareer>
  seekStrip: number
  /** The page's own reads are done (the career table is in): the other career may be read. */
  onSettled: () => void
}

/** Rail, header, and one set of tabs for every position. */
export function StatsPlayer({
  data,
  scope,
  onScope,
  player,
  onPlayer,
  tab: asked,
  onTab,
  onOpenTeam,
  onOpenGame,
  onOpenLeaderboard,
  onCompare,
  onTrend,
  onOpenData,
  onOpenPage
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
  onOpenData?: (league: LeagueId) => void
  onOpenPage?: (location: NavLocation) => void
}): React.JSX.Element {
  const {
    value: info,
    error: infoError,
    loading: infoLoading
  } = usePlayerInfo(player, data.version)
  const [mode, setMode] = useScreenState<BoardMode>('player', 'mode', 'perGame')
  // A tab whose every metric the league lacks is not offered; one asked for elsewhere opens the first.
  const tabs = shownTabs(PLAYER_DASH_TABS, TAB_SECTIONS, data.byId)
  // The categories the league has for players (D52), in a strip under the page's own tabs; a category
  // it lacks, or an old tab id (Shots, Tracking), reads as the category that holds those metrics.
  const categories = useMemo(
    () => boardCategories(data.catalogue, tabOf('player', 'ALL')),
    [data.catalogue]
  )
  const wanted = playerTabOf(asked)
  const wantedCategory = categoryOfTab(wanted)
  const tab: PlayerTab = wantedCategory
    ? categories.some((c) => c.id === wantedCategory)
      ? wanted
      : 'overview'
    : shownTab(wanted, tabs)
  const category = categoryOfTab(tab)
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
  // The other career, read once the page's own reads are done: the career table in (the Overview),
  // or a moment after the header on another tab. Asked any sooner, the links file's read ran beside
  // the career query and could slow it. The header's hint and the strip share the one read.
  const [settledFor, setSettledFor] = useState<string | null>(null)
  const headerIn = info !== null && self.result !== null
  useEffect(() => {
    if (!headerIn) return
    const timer = setTimeout(() => setSettledFor(player), 1200)
    return () => clearTimeout(timer)
  }, [headerIn, player])
  const settle = useMemo(() => () => setSettledFor(player), [player])
  const career = useOtherCareer(settledFor === player ? player : null)
  const hint = stripHint(career.value)
  // The paired league, as the strip, the league menu and the search treat it.
  const leagueId = useLeague().id
  const downloads = useLeagueDownloads()
  const other = pairedLeague(leagueId)
  const otherDownload = other && downloads ? downloadOf(downloads, other) : undefined
  const otherHolds = other && downloads ? leagueHolds(leagueOf(other), otherDownload) : undefined
  // The league menu's move to this player's page in the paired league, offered once the read is in
  // (T1304.4): until then the menu switches as it always has, and never waits on the read.
  const move = useMemo(
    () => playerSwitch(leagueId, player, career.value, otherHolds),
    [leagueId, player, career.value, otherHolds]
  )
  useEffect(() => {
    if (!move) return
    offerSwitch(move)
    return () => withdrawSwitch(move)
  }, [move])
  // The search's rows of the paired league: read once the search is first used.
  const [wantOthers, setWantOthers] = useState(false)
  const others = useOtherPlayers(wantOthers)
  const otherOn = otherDownload?.on ?? false
  const elsewhere = useMemo(
    () =>
      other
        ? {
            heading: otherHeading(leagueOf(other), leagueOf(leagueId)),
            rows: (search: string) => otherRows(others.value, search, otherHolds, otherOn),
            onWant: () => setWantOthers(true),
            onOpen: (row: OtherRow) => {
              if (row.open) onOpenPage?.(row.open)
              else if (row.data) onOpenData?.(row.data)
            }
          }
        : undefined,
    [other, leagueId, others.value, otherHolds, otherOn, onOpenPage, onOpenData]
  )
  // The search's rows of this league beyond the ranked ones: everyone with a page here, read once the
  // search is first used (T1304.5).
  const [wantIndex, setWantIndex] = useState(false)
  const indexRead = usePlayerIndex(wantIndex, data.version)
  const index = useMemo(
    () => (indexRead.value ? playerIndex(indexRead.value) : null),
    [indexRead.value]
  )
  const more = useMemo(
    () => ({
      rows: (search: string, listed: ReadonlySet<string>) =>
        moreRows(index, search, listed, leagueOf(leagueId)),
      onWant: () => setWantIndex(true),
      onOpen: (row: MoreRow) => {
        const to = moreTarget(row, leagueOf(leagueId), scope.season)
        if (to && onOpenPage) onOpenPage(to)
        else onPlayer(row.id)
      }
    }),
    [index, leagueId, scope.season, onOpenPage, onPlayer]
  )
  const [seekStrip, setSeekStrip] = useState(0)
  const showStrip = (): void => {
    onTab('overview')
    setSeekStrip((n) => n + 1)
  }
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
        more={more}
        elsewhere={elsewhere}
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
              hint={hint}
              onHint={showStrip}
            />
            <TabRow label="Player dashboard" tabs={tabs} value={tab} onChange={onTab}>
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
            <div className="-mt-3 border-b border-line">
              <CategoryTabs
                categories={categories}
                value={category ?? ''}
                withOverview={false}
                label="Stats by category"
                onChange={(id) => onTab(categoryTab(id))}
              />
            </div>
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
                  options={dashboardModes()}
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
              onOpenData={onOpenData}
              onOpenPage={onOpenPage}
              career={career}
              seekStrip={seekStrip}
              onSettled={settle}
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
  if (tab === 'on_off') return <OnOff {...props} />
  const category = categoryOfTab(tab)
  return category ? <CategoryTab {...props} category={category} /> : null
}

/**
 * A category's tab (D52): its sections ranked among the qualified players of the position, each
 * folding and reading its own metrics. Shooting opens on the shot chart, Playmaking ends on who the
 * player feeds and who feeds them, Defense on the matchup pairs, as the Shots, Play by play and
 * Matchups tabs did.
 */
function CategoryTab(props: TabProps & { category: string }): React.JSX.Element {
  const { data, scope, player, position, mode, category, onOpenPlayer } = props
  const sections = useMemo(
    () => pageSections(data.catalogue, tabOf('player', 'ALL'), category),
    [data.catalogue, category]
  )
  const query = useCallback(
    (metrics: string[]) => positionQuery(metrics, position, scope, mode),
    [position, scope, mode]
  )
  const view = useCallback(
    (section: PageSection, result: StatsResult) =>
      sectionViews([section], rankedPool(result, position), player, data.byId, mode, position),
    [position, player, data.byId, mode]
  )
  const note = useCallback(
    (result: StatsResult) =>
      `Percentiles and ranks among ${poolSize(rankedPool(result, position), position)} qualified ${amongWords(position)}.`,
    [position]
  )
  const shots = useMemo(() => shotRequest('player', player, scope), [player, scope])
  return (
    <div className="flex flex-col gap-7">
      {category === 'shooting' && <ShotChart request={shots} version={data.version} />}
      <CategorySections
        key={category}
        sections={sections}
        subject={player}
        query={query}
        view={view}
        note={note}
        version={data.version}
      />
      {category === 'playmaking' && (
        <AssistNetwork
          entity="player"
          id={player}
          scope={scope}
          version={data.version}
          onOpenPlayer={onOpenPlayer}
        />
      )}
      {category === 'defense' && !currentLeague().unpublished.matchups && (
        <MatchupPairs {...props} />
      )}
    </div>
  )
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
          note={
            value.bio
              ? `${currentLeague().name} roster, ${seasonLabel(value.bio.season)}`
              : undefined
          }
          facts={value.bio ? bioFacts(value.bio) : []}
          empty={`No ${currentLeague().name} roster lists them.`}
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
          <p className="m-0 text-[12.5px] text-fg-3">
            {currentLeague().unpublished.combine ?? noCombine(value)}
          </p>
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

/** The pairs behind the matchup totals: who they guarded, and who guarded them. */
function MatchupPairs(props: TabProps): React.JSX.Element {
  const { data, scope, player, onOpenPlayer } = props
  // A league that publishes no matchups says so here, as each metric of the tab does.
  const gap = currentLeague().unpublished.matchups ?? pairGap(scope)
  const { value, error } = useMatchups(
    gap ? null : player,
    scope.season,
    matchupScope(scope),
    data.version
  )
  return (
    <div className="flex flex-col gap-7">
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
  const favourites = useFavourites()
  const [all, setAll] = useState(false)
  const rows = pairRows(pairs, all ? null : PAIR_LIMIT)
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title={title} note={pairCount(rows.length, pairs.length)} />
      {pairs.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">{empty}</p>
      ) : (
        <div className={TABLE_SCROLL}>
          <MiniTable
            label={title}
            columns={`minmax(150px,1.6fr) 32px repeat(${PAIR_HEAD.length - 2}, minmax(52px,1fr))`}
            minWidth={760}
            head={PAIR_HEAD}
            rows={rows.map((r) => ({
              key: r.key,
              title: `Open ${r.name}’s dashboard`,
              onOpen: () => onOpenPlayer(r.key),
              favourite: favourites.isFavourite('player', r.key),
              cells: [
                <FavouriteName
                  key="n"
                  kind="player"
                  id={r.key}
                  className="font-sans text-[13px] font-medium"
                >
                  {r.name}
                </FavouriteName>,
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
  onCompare,
  hint,
  onHint
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  info: StatsPlayerInfo
  row: StatsRow | null
  onOpenTeam: (team: string) => void
  onCompare?: () => void
  /** The way to the career strip, at the end of the facts line; null for a player with no link. */
  hint: StripHint | null
  onHint: () => void
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
                title={`Below ${rowQualifier()}, scaled to the games in range`}
                className="rounded-[4px] px-1.5 py-[3px] font-mono text-[11px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]"
              >
                Not qualified
              </span>
            )}
            {tag && <StatusChip tag={tag} />}
            {/* The way to the career strip, once the read finds a link: last on the line, with no
                width of its own (basis 0), so it never wraps the line or moves what is on it; it takes
                the room left and is cut, whole on hover, where there is too little. */}
            {hint && (
              <span className="flex min-w-0 flex-[1_1_0] items-center gap-2">
                <span className="text-fg-3">·</span>
                <button
                  type="button"
                  title={`${hint.text}. ${hint.title}`}
                  onClick={onHint}
                  className="min-w-0 cursor-pointer truncate text-left underline decoration-line underline-offset-[3px] hover:text-cobalt"
                >
                  {hint.text} ↓
                </button>
              </span>
            )}
          </div>
          <div className="flex items-end gap-1.5">
            <h1 className="m-0 flex flex-col gap-0.5">
              {first && (
                <span className="text-[20px] leading-none font-normal tracking-[-0.01em] text-fg-2">
                  {first}
                </span>
              )}
              <span className="text-[40px] leading-none font-bold tracking-[-0.035em]">{last}</span>
            </h1>
            <FavouriteStar kind="player" id={info.id} name={info.name} size="lg" />
          </div>
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
  played,
  onOpenData,
  onOpenPage,
  career,
  seekStrip,
  onSettled
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
      {/* The strip comes after the career table, once that is in, so neither moves the other. */}
      <Career data={data} scope={scope} player={player} mode={mode} onReady={onSettled}>
        <CareerStrip
          data={data}
          player={player}
          playerName={info?.name ?? 'This player'}
          career={career}
          seek={seekStrip}
          onOpenData={onOpenData}
          onOpenPage={onOpenPage}
        />
      </Career>
    </div>
  )
}

/** By season, with a line for the seasons inside the career with no games. */
function Career({
  data,
  scope,
  player,
  mode,
  children,
  onReady
}: Pick<TabProps, 'data' | 'scope' | 'player' | 'mode'> & {
  /** Shown under the table once it is in: the career strip. */
  children?: React.ReactNode
  /** Told once the table's answers are in. */
  onReady?: () => void
}): React.JSX.Element {
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
  const ready = results !== null
  useEffect(() => {
    if (ready) onReady?.()
  }, [ready, onReady])
  if (!results) return <Loading error={error} />
  const rows = careerRows(results.get('seasons') ?? null, data.byId, mode)
  const played = rows.find((r) => !r.gap)?.key
  const total = careerTotal(
    results.get('career') ?? null,
    data.byId,
    mode,
    played === undefined ? null : Number(played)
  )
  const head = LINE_METRICS.map((id) => <MetricHead key={id} id={id} info={data.byId.get(id)} />)
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
          // A season missed whole says its games out, over the empty cells: no stats, never zeros.
          <span
            key={id}
            title={(i === 0 && r.outTitle) || undefined}
            className="block text-left whitespace-nowrap text-fg-3"
          >
            {i === 0 ? (r.out ?? 'No games') : ''}
          </span>
        ))
      : r.cells.map((c, i) => (
          <span key={i} title={c.title || undefined} className={cn(c.text === '—' && 'text-fg-3')}>
            {c.text}
          </span>
        )))
  ]
  return (
    <>
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
        <div className={cn(TABLE_SCROLL, rows.length === 0 && 'hidden')}>
          <MiniTable
            label="Career by season"
            columns={`minmax(72px,1fr) 44px 40px ${head.map(() => 'minmax(52px,1fr)').join(' ')}`}
            minWidth={1010}
            head={['Season', 'Team', 'G', ...head]}
            left={[1]}
            rows={[
              ...rows.map((r) => ({
                key: r.key,
                cells: cells(r),
                ...(r.out ? { spill: true, title: r.outTitle } : {})
              })),
              ...(total ? [{ key: total.key, cells: cells(total), strong: true }] : [])
            ]}
          />
        </div>
      </section>
      {children}
    </>
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
      <div className={TABLE_SCROLL}>
        <MiniTable
          label="Game log"
          columns={`52px 64px 42px 104px ${LOG_COLUMNS.map((c) =>
            // "100.0%" and "11-23" need more room than a count.
            c.pair || c.metric?.endsWith('_pct') ? 'minmax(52px,1fr)' : 'minmax(40px,1fr)'
          ).join(' ')}`}
          minWidth={1340}
          head={[
            'Date',
            'Opp',
            'Team',
            'Result',
            ...LOG_COLUMNS.map((c) =>
              c.metric ? (
                <MetricHead key={c.label} id={c.label} info={data.byId.get(c.metric)} />
              ) : (
                c.label
              )
            )
          ]}
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
                  <FavouriteName kind="team" id={r.opponentId}>
                    {r.opponent}
                  </FavouriteName>
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
  const head = SPLIT_METRICS.map((id) => <MetricHead key={id} id={id} info={data.byId.get(id)} />)
  return (
    <div className="flex flex-col gap-6">
      <SplitTables groups={groups} head={head} />
      <Notes notes={playSplitTableNotes(results, scope)} />
    </div>
  )
}
