import { useContext, useEffect, useState } from 'react'
import { StatsNav } from '@/components/stats/StatsNav'
import { api } from '@/lib/api'
import { TURN_ON, useLeague } from '@/lib/stats/league'
import { useNoteScreen } from '@/lib/dev/noteContext'
import { errorMessage } from '@/lib/format'
import type { NavLocation } from '@/lib/navHistory'
import type { BoardDef } from '@/lib/stats/boards'
import type { ChartState } from '@/lib/stats/chart'
import { compareWith, type CompareState } from '@/lib/stats/compare'
import { lastSubject, type ExploreSubject, type ExploreTab } from '@/lib/stats/explore'
import type { GamesState } from '@/lib/stats/games'
import {
  bestFirst,
  defaultBoard,
  normalizeBoard,
  type LeaderboardOpen
} from '@/lib/stats/leaderboard'
import { defaultPlayer, railQuery, type PlayerTab } from '@/lib/stats/player'
import { defaultScope, seasonOf, seasonScope, type StatsScope } from '@/lib/stats/scope'
import { NAV_ITEMS, type StatsScreen } from '@/lib/stats/screens'
import {
  createSessionStore,
  freshSession,
  keepSession,
  locationOf,
  SessionContext,
  sessionOf,
  showScreen
} from '@/lib/stats/session'
import { defaultTeam, defaultTeamQuery, type TeamTab } from '@/lib/stats/team'
import { trendsFor, type TrendsState } from '@/lib/stats/trends'
import { useStatsData, useStatsQuery } from '@/lib/stats/useStats'
import { downloadOf, leagueHolds, useLeagueDownloads } from '@/lib/stats/downloads'
import { StatsData } from '@/screens/stats/StatsData'
import { FirstRunLeagues } from '@/components/stats/FirstRunLeagues'
import { StatsExplore } from '@/screens/stats/StatsExplore'
import { StatsGames } from '@/screens/stats/StatsGames'
import { StatsGlossary } from '@/screens/stats/StatsGlossary'
import { StatsHome } from '@/screens/stats/StatsHome'
import { StatsLeaderboard } from '@/screens/stats/StatsLeaderboard'
import { StatsPlayer } from '@/screens/stats/StatsPlayer'
import { StatsStandings } from '@/screens/stats/StatsStandings'
import { StatsTeam } from '@/screens/stats/StatsTeam'
import type { LeaderboardBoard, StatsStatus, StatsView } from '@shared/stats/types'
import type { League, LeagueId } from '@shared/leagues'
import type { UpdateState } from '@shared/types'

/**
 * A page to open: Back, or a dev note's "Go there"; a new nonce opens it again. Its league is the one
 * on screen by the time it opens: Back to a page of the other league switches to it first.
 */
export interface StatsFocus {
  location: NavLocation
  nonce: number
}

interface StatsAppProps {
  update: UpdateState
  version: string | null
  onOpenUpdate: () => void
  onToggleTheme: () => void
  focus?: StatsFocus | null
  /** Every page shown, for Back. */
  onLocation?: (location: NavLocation) => void
  canGoBack?: boolean
  onBack?: () => void
  /** The focus is open: the shell is built again for each league and must not open it twice. */
  onFocused?: () => void
  /** A page of any league, switching to it first: a career strip's row of the other league. */
  onOpenPage?: (location: NavLocation) => void
}

/**
 * What an empty screen says. A game date appears with the first box score, long before the load is
 * done, so it does not mean the data is in: what is running decides, and a stopped load says so.
 */
function emptyScreenNote(status: StatsStatus | null, league: League): string {
  // A league with no data yet (the registry's `hasData`): its reason, never an error.
  if (status?.noData) return status.noData
  if (status?.builtAt) return 'This screen is not built yet.'
  if (status?.noRoom)
    return `Not enough disk space to load ${league.name} data. See the Data panel.`
  if (status?.paused) return 'Loading is paused. Resume it in the Data panel.'
  if (status?.busy) {
    return `${league.name} data is loading. Screens open once the box scores are in and their tables are built.`
  }
  if (status?.through) return 'The tables are not built yet. Metis tries again on its next refresh.'
  return `No stats yet: ${league.name} data has not been loaded.`
}

/** The app's shell: the nav, the status of the stats database, and the screen. */
export function StatsApp({
  update,
  version,
  onOpenUpdate,
  onToggleTheme,
  focus = null,
  onLocation,
  canGoBack = false,
  onBack,
  onFocused,
  onOpenPage
}: StatsAppProps): React.JSX.Element {
  // The shell is built for one league (App keys it by the league on screen), so all of this is that
  // league's, and comes back as it was left when the league does (`lib/stats/session.ts`).
  const leagueEntry = useLeague()
  const league = leagueEntry.id
  const downloads = useLeagueDownloads()
  const data = useStatsData()
  const outer = useContext(SessionContext)
  const [own] = useState(createSessionStore)
  const store = outer ?? own
  const [kept] = useState(() => sessionOf(store, league) ?? freshSession())
  // The screen is the app's: a switch keeps it.
  const [screen, setScreen] = useState<StatsScreen>(store.screen)
  const [focused, setFocused] = useState<number | null>(null)
  // The player dashboard: the player chosen this session, else the league's leading scorer.
  const [player, setPlayer] = useState<string | null>(kept.player)
  const [playerTab, setPlayerTab] = useState<PlayerTab>(kept.playerTab)
  // The team dashboard: the team chosen this session, else the best record in scope.
  const [team, setTeam] = useState<string | null>(kept.team)
  const [teamTab, setTeamTab] = useState<TeamTab>(kept.teamTab)
  // Games: the day and game chosen, kept for the session.
  const [games, setGames] = useState<GamesState>(kept.games)
  // Explore: its tab and each tab's state, kept for the session.
  const [exploreTab, setExploreTab] = useState<ExploreTab>(kept.exploreTab)
  const [chart, setChart] = useState<ChartState>(kept.chart)
  const [compare, setCompare] = useState<CompareState>(kept.compare)
  const [trends, setTrends] = useState<TrendsState>(kept.trends)
  const [lastShown, setLastShown] = useState<ExploreSubject | null>(kept.lastShown)
  // A season asked for with a page opened from another (a strip's row): applied once the league's
  // seasons are read, so the type it falls back to is that season's own.
  const [askedSeason, setAskedSeason] = useState<number | null>(null)
  if (focus && focus.nonce !== focused && focus.location.league === league) {
    setFocused(focus.nonce)
    setScreen(focus.location.screen)
    if (focus.location.player) setPlayer(focus.location.player.id)
    if (focus.location.team) setTeam(focus.location.team)
    if (focus.location.game) setGames({ date: null, game: focus.location.game })
    if (focus.location.season !== undefined) setAskedSeason(focus.location.season)
  }
  useEffect(() => {
    if (focus && focus.nonce === focused) onFocused?.()
  }, [focus, focused, onFocused])
  const [chosen, setChosen] = useState<StatsScope | null>(kept.chosen)
  const scope = chosen ?? defaultScope(data.seasons, data.status)
  if (askedSeason !== null && data.seasons.length > 0) {
    setAskedSeason(null)
    const asked = seasonOf(data.seasons, askedSeason)
    if (asked) setChosen(seasonScope(asked))
  }
  // The Data panel, opened on one league's section (a strip's "Download … for the full profile").
  const [dataLeague, setDataLeague] = useState<LeagueId | null>(null)
  const openData = (other: LeagueId): void => {
    setDataLeague(other)
    setScreen('data')
  }
  const [open, setOpen] = useState<LeaderboardOpen | null>(kept.open)
  const [views, setViews] = useState<StatsView[]>([])
  const [viewsError, setViewsError] = useState<string | null>(null)

  // The league keeps all of it for when it is back on screen.
  useEffect(() => {
    keepSession(store, league, {
      chosen,
      player,
      playerTab,
      team,
      teamTab,
      games,
      exploreTab,
      chart,
      compare,
      trends,
      lastShown,
      open
    })
  })
  useEffect(() => showScreen(store, screen), [store, screen])

  // Saved views are the league's own (D35): the list is the league on screen's, and one opens there.
  useEffect(() => {
    if (!data.version) return
    void api.stats
      .views(league)
      .then(setViews)
      .catch((err) => setViewsError(errorMessage(err)))
  }, [data.version, league])

  // The query hook keys on the query's text, so a new object each render runs nothing again.
  const leaders = useStatsQuery(
    player === null && screen === 'player' && data.byId.size > 0
      ? railQuery('ALL', null, 'pts', scope, 'perGame', data.byId)
      : null,
    data.version
  )
  const shownPlayer = player ?? defaultPlayer(leaders.result)
  // Once on screen, the default is the player: a new season or range does not switch it.
  if (player === null && screen === 'player' && shownPlayer !== null) setPlayer(shownPlayer)
  const openPlayer = (id: string): void => {
    setPlayer(id)
    setScreen('player')
  }

  const bestTeam = useStatsQuery(
    team === null && screen === 'team' && data.byId.size > 0 ? defaultTeamQuery(scope) : null,
    data.version
  )
  const shownTeam =
    team ??
    (bestTeam.loading ? null : defaultTeam(bestTeam.result, seasonOf(data.seasons, scope.season)))
  if (team === null && screen === 'team' && shownTeam !== null) setTeam(shownTeam)
  const openTeam = (id: string): void => {
    setTeam(id)
    setScreen('team')
  }

  const openGame = (id: string): void => {
    setGames({ date: null, game: id })
    setScreen('games')
  }

  // Explore's entries from other screens: Compare with these players or teams, or Trends on one,
  // optionally on a metric. Each tab's own file says how it takes them in.
  const openCompare = (subjects: ExploreSubject[]): void => {
    setCompare((c) => compareWith(c, subjects))
    setExploreTab('compare')
    setScreen('explore')
  }
  const openTrends = (subject: ExploreSubject, metric?: string): void => {
    setTrends((t) => trendsFor(t, subject, metric))
    setExploreTab('trends')
    setScreen('explore')
  }
  // Trends opens on the player or team a dashboard showed last.
  const shown = lastSubject(lastShown, screen, shownPlayer, shownTeam)
  if (shown !== lastShown) setLastShown(shown)

  const locationPlayer = screen === 'player' ? shownPlayer : null
  const locationTeam = screen === 'team' ? shownTeam : null
  const locationGame = screen === 'games' ? games.game : null
  useEffect(() => {
    onLocation?.(
      locationOf(league, screen, { player: locationPlayer, team: locationTeam, game: locationGame })
    )
  }, [league, screen, locationPlayer, locationTeam, locationGame, onLocation])

  useNoteScreen(screen)

  const openBoard = (board: LeaderboardBoard, selected: string | null): void => {
    setOpen((o) => ({ board, selected, nonce: (o?.nonce ?? 0) + 1 }))
    setScreen(board.entity === 'player' ? 'players' : 'teams')
  }
  const openFromHome = (b: BoardDef, rowId: string | null, perGame: boolean): void => {
    if (rowId !== null) {
      if (b.entity === 'player') openPlayer(rowId)
      else openTeam(rowId)
      return
    }
    const base = defaultBoard(b.entity, b.tab, data.byId)
    const columns = base.columns.includes(b.metric) ? base.columns : [b.metric, ...base.columns]
    openBoard(
      {
        ...base,
        columns,
        mode: perGame ? 'perGame' : 'raw',
        sort: { by: b.metric, dir: bestFirst(data.byId.get(b.metric)) }
      },
      rowId
    )
  }
  const openView = (v: StatsView): void => openBoard(normalizeBoard(v.board, data.byId), null)
  const saveView = async (name: string, board: LeaderboardBoard): Promise<void> => {
    const saved = await api.stats.saveView(league, name, board)
    setViews((vs) =>
      [...vs.filter((v) => v.id !== saved.id), saved].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      )
    )
  }
  const deleteView = async (view: StatsView): Promise<void> => {
    await api.stats.deleteView(league, view.id)
    setViews((vs) => vs.filter((v) => v.id !== view.id))
  }

  // A league with no data, or with its files loaded and no tables built from them, is not a fault:
  // every screen says why (its status carries the reason). One that is off links to the Data panel,
  // where it is turned on.
  const noData = data.status?.noData ?? null
  const holds = downloads && leagueHolds(leagueEntry, downloadOf(downloads, league))
  const unavailable = data.status !== null && !data.status.available && noData === null
  const error = data.error ?? viewsError
  // The tables and their catalogue are read once they are built, so a screen waits for all of it.
  const ready = data.version !== null && data.catalogue.length > 0 && data.seasons.length > 0
  const label =
    screen === 'data' ? 'Data' : (NAV_ITEMS.find((i) => i.id === screen)?.label ?? 'Leaderboards')
  const empty = (
    <div className="py-20 text-center">
      <h1 className="text-[15px] font-semibold">{label}</h1>
      <p className="mt-2 text-[13px] text-fg-3">{emptyScreenNote(data.status, leagueEntry)}</p>
      {noData !== null && holds === 'off' && (
        <button
          type="button"
          onClick={() => setScreen('data')}
          className="mt-3 cursor-pointer text-[13px] font-medium text-cobalt hover:underline"
        >
          {TURN_ON.label}
        </button>
      )}
    </div>
  )
  const playerBoard = screen === 'players'
  const teamBoard = screen === 'teams'
  return (
    <SessionContext.Provider value={store}>
      <div className="flex h-full flex-col bg-paper text-fg">
        <FirstRunLeagues />
        <StatsNav
          current={screen}
          onNavigate={setScreen}
          canGoBack={canGoBack}
          onBack={onBack}
          status={data.status}
          update={update}
          version={version}
          onOpenUpdate={onOpenUpdate}
          onToggleTheme={onToggleTheme}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          {unavailable || error ? (
            <div className="py-20 text-center text-[13px] text-bad">
              {error ?? 'The stats database could not be opened on this computer.'}
            </div>
          ) : screen === 'data' ? (
            // Every league's data, where a league is turned on: it opens whatever the league holds.
            <StatsData focus={dataLeague} onFocused={() => setDataLeague(null)} />
          ) : noData !== null ? (
            empty
          ) : !ready ? (
            empty
          ) : screen === 'home' ? (
            <StatsHome
              data={data}
              scope={scope}
              onScope={setChosen}
              views={views}
              onOpenBoard={openFromHome}
              onOpenView={openView}
            />
          ) : screen === 'player' ? (
            shownPlayer !== null ? (
              <StatsPlayer
                data={data}
                scope={scope}
                onScope={setChosen}
                player={shownPlayer}
                onPlayer={setPlayer}
                tab={playerTab}
                onTab={setPlayerTab}
                onOpenTeam={openTeam}
                onOpenGame={openGame}
                onOpenLeaderboard={() => setScreen('players')}
                onCompare={openCompare}
                onTrend={(metric) => openTrends({ entity: 'player', id: shownPlayer }, metric)}
                onOpenData={openData}
                onOpenPage={onOpenPage}
              />
            ) : (
              <div className="py-20 text-center text-[13px] text-fg-3">
                {leaders.error ?? (leaders.loading ? 'Loading…' : 'Nobody played in this range.')}
              </div>
            )
          ) : screen === 'team' ? (
            shownTeam !== null ? (
              <StatsTeam
                data={data}
                scope={scope}
                onScope={setChosen}
                team={shownTeam}
                onTeam={setTeam}
                tab={teamTab}
                onTab={setTeamTab}
                onOpenLeaderboard={() => setScreen('teams')}
                onOpenPlayer={openPlayer}
                onOpenGame={openGame}
                onCompare={openCompare}
                onTrend={(metric) => openTrends({ entity: 'team', id: shownTeam }, metric)}
              />
            ) : (
              <div className="py-20 text-center text-[13px] text-fg-3">
                {bestTeam.error ?? 'Loading…'}
              </div>
            )
          ) : screen === 'games' ? (
            <StatsGames
              data={data}
              scope={scope}
              onScope={setChosen}
              state={games}
              onState={setGames}
              onOpenTeam={openTeam}
              onOpenPlayer={openPlayer}
            />
          ) : screen === 'standings' ? (
            <StatsStandings data={data} scope={scope} onScope={setChosen} onOpenTeam={openTeam} />
          ) : playerBoard || teamBoard ? (
            <StatsLeaderboard
              key={playerBoard ? 'player' : 'team'}
              entity={playerBoard ? 'player' : 'team'}
              data={data}
              scope={scope}
              onScope={setChosen}
              open={open}
              views={views}
              onSaveView={saveView}
              onDeleteView={deleteView}
              onOpenView={openView}
              onOpenRow={playerBoard ? openPlayer : openTeam}
            />
          ) : screen === 'explore' ? (
            <StatsExplore
              data={data}
              scope={scope}
              onScope={setChosen}
              tab={exploreTab}
              onTab={setExploreTab}
              chart={chart}
              onChart={setChart}
              compare={compare}
              onCompare={setCompare}
              trends={trends}
              onTrends={setTrends}
              trendsFallback={lastShown}
              openCompare={openCompare}
              onOpenPlayer={openPlayer}
              onOpenTeam={openTeam}
            />
          ) : screen === 'glossary' ? (
            <StatsGlossary catalogue={data.catalogue} />
          ) : (
            empty
          )}
        </main>
      </div>
    </SessionContext.Provider>
  )
}
