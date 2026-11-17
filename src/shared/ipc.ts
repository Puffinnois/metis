import type { LeagueId } from './leagues'
import type { DevNote, NewNote, NoteError, NoteStatus } from './devNotes'
import type { LineupGroup } from './stats/lineups'
import type {
  StatsAssistRequest,
  StatsAssistNetwork,
  StatsGameFlow,
  StatsShotRequest,
  StatsShotChart,
  LeaderboardBoard,
  MetricInfo,
  StatsDataReport,
  StatsGame,
  StatsGameDetail,
  StatsLineups,
  StatsMatchups,
  StatsMatchupScope,
  StatsGameMatchups,
  StatsOfficialCareer,
  StatsOnCourtScope,
  StatsOnCourtUnits,
  StatsWithOrWithout,
  StatsOfficialsSeason,
  GameType,
  StatsProfile,
  StatsAvailability,
  StatsCoach,
  StatsPlayerInfo,
  StatsQuery,
  StatsResult,
  StatsSeason,
  StatsStanding,
  StatsStatus,
  StatsView
} from './stats/types'
import type { UpdateState } from './types'

/** What the preload script exposes to the renderer as `window.api`. */
export interface Api {
  update: {
    state(): Promise<UpdateState>
    /** Silent install + relaunch; no-op unless the state is `ready`. */
    install(): Promise<void>
    /** Fires on every state change; returns the unsubscribe function. */
    onChange(listener: (state: UpdateState) => void): () => void
  }
  app: {
    version(): Promise<string>
  }
  /** The developer tools; only the mode itself works when it is off. */
  dev: {
    mode(): Promise<boolean>
    /** Stores the choice; every window hears it through `onModeChanged`. */
    setMode(on: boolean): Promise<void>
    onModeChanged(listener: (on: boolean) => void): () => void
    /** The window as it looks now, as a PNG data URL (the renderer hides its dev overlays first). */
    capture(): Promise<string>
    /** A renderer error for the recent-errors buffer; fire and forget. */
    reportError(error: { message: string; stack: string | null }): void
    /** The errors a note would attach now, newest first. */
    recentErrors(): Promise<NoteError[]>
    notes: {
      /** Newest first. */
      list(): Promise<DevNote[]>
      save(note: NewNote): Promise<DevNote>
      setStatus(id: string, status: NoteStatus): Promise<void>
      remove(id: string): Promise<void>
      /** A note's image (its path relative to the folder) as a data URL; null when it is gone. */
      image(path: string): Promise<string | null>
      /** The notes folder in use. */
      folder(): Promise<string>
      openFolder(): Promise<void>
      /** Asks for a folder; resolves to it, null if cancelled. */
      chooseFolder(): Promise<string | null>
      /** Copies the notes' sections, image paths made absolute, to the clipboard. */
      copy(ids: string[]): Promise<void>
    }
  }
  /** Every call names its league first (D35): the renderer holds the current one in one place. */
  stats: {
    /** What the database holds, for the nav's status line. */
    status(league: LeagueId): Promise<StatsStatus>
    /** What is loaded, for the Data panel. */
    data(league: LeagueId): Promise<StatsDataReport>
    /** Stops a running load and holds off any other, across launches, until `resume`. */
    pause(league: LeagueId): Promise<void>
    resume(league: LeagueId): Promise<void>
    /** One query of the catalogue; rejects with a readable message. */
    query(league: LeagueId, query: StatsQuery): Promise<StatsResult>
    catalogue(league: LeagueId): Promise<MetricInfo[]>
    /** What each season holds, newest first; empty until the first tables are built. */
    seasons(league: LeagueId): Promise<StatsSeason[]>
    /** Who a player is; null for an id nobody has. */
    player(league: LeagueId, id: string): Promise<StatsPlayerInfo | null>
    /** Every game on a season's schedule, by date; empty until the tables are built. */
    games(league: LeagueId, season: number): Promise<StatsGame[]>
    game(league: LeagueId, id: string): Promise<StatsGameDetail | null>
    /** The published standings of a season; empty before they start, in 1995-96. */
    standings(league: LeagueId, season: number): Promise<StatsStanding[]>
    /**
     * A player's matchups in a season, from 2017-18: the pair file for a whole regular season, the game
     * matchups for any other scope; empty lists outside them.
     */
    matchups(
      league: LeagueId,
      player: string,
      season: number,
      scope?: StatsMatchupScope
    ): Promise<StatsMatchups>
    /** Who guarded whom in a game, or the reason there is nothing to show. */
    gameMatchups(league: LeagueId, game: string): Promise<StatsGameMatchups>
    /** Every official of a season and season types, beside the league's totals. */
    officialsSeason(
      league: LeagueId,
      season: number,
      gameTypes: GameType[]
    ): Promise<StatsOfficialsSeason | null>
    /** One official's seasons, each beside the league's totals. */
    officialCareer(
      league: LeagueId,
      official: string,
      gameTypes: GameType[]
    ): Promise<StatsOfficialCareer | null>
    /** A team's groups of two to five players on the floor, counted from the plays, from 1996-97. */
    onCourtUnits(
      league: LeagueId,
      team: string,
      season: number,
      scope: StatsOnCourtScope,
      size: number
    ): Promise<StatsOnCourtUnits>
    /** A player's team with a teammate on and off the floor, counted from the plays. */
    withOrWithout(
      league: LeagueId,
      player: string,
      teammate: string | null,
      season: number,
      scope: StatsOnCourtScope
    ): Promise<StatsWithOrWithout>
    /** A team's published five-man units, from 2007-08; empty outside them. */
    lineups(
      league: LeagueId,
      team: string,
      season: number,
      gameType: string,
      group: LineupGroup
    ): Promise<StatsLineups>
    /** A player's bio, draft and combines; what the data does not hold reads as null or empty. */
    profile(league: LeagueId, player: string): Promise<StatsProfile>
    /** Players' status on the latest official injury report; those it does not list are left out. */
    availability(league: LeagueId, players: string[]): Promise<StatsAvailability[]>
    /** A team's head and assistant coaches for a season; empty when the file has none. */
    coaches(league: LeagueId, team: string, season: number): Promise<StatsCoach[]>
    /** The shots a chart draws for a player or team in a scope, or why there are none. */
    shots(league: LeagueId, request: StatsShotRequest): Promise<StatsShotChart>
    /** Who assisted whom for a team or a player in a scope, or why there is none. */
    assists(league: LeagueId, request: StatsAssistRequest): Promise<StatsAssistNetwork>
    /** One game's scoring in order and its flow, or why there is none. */
    gameFlow(league: LeagueId, game: string): Promise<StatsGameFlow>
    views(league: LeagueId): Promise<StatsView[]>
    /** Saves under a name; the same name, in any case, replaces. Rejects with a readable message. */
    saveView(league: LeagueId, name: string, board: LeaderboardBoard): Promise<StatsView>
    deleteView(league: LeagueId, id: number): Promise<void>
    /** Asks where to save; resolves to the path, null if cancelled. */
    exportCsv(fileName: string, csv: string): Promise<string | null>
    /**
     * Fires as a league's refresh progresses and when it ends, with the league; returns the
     * unsubscribe function.
     */
    onChanged(listener: (league: LeagueId) => void): () => void
  }
}

export const IPC = {
  updateState: 'update:state',
  updateInstall: 'update:install',
  updateChanged: 'update:changed',
  appVersion: 'app:version',
  devMode: 'dev:mode',
  devSetMode: 'dev:setMode',
  devChanged: 'dev:changed',
  devCapture: 'dev:capture',
  devReportError: 'dev:reportError',
  devRecentErrors: 'dev:recentErrors',
  devNotesList: 'dev:notesList',
  devNotesSave: 'dev:notesSave',
  devNotesSetStatus: 'dev:notesSetStatus',
  devNotesRemove: 'dev:notesRemove',
  devNotesImage: 'dev:notesImage',
  devNotesFolder: 'dev:notesFolder',
  devNotesOpenFolder: 'dev:notesOpenFolder',
  devNotesChooseFolder: 'dev:notesChooseFolder',
  devNotesCopy: 'dev:notesCopy',
  statsStatus: 'stats:status',
  statsChanged: 'stats:changed',
  statsData: 'stats:data',
  statsPause: 'stats:pause',
  statsResume: 'stats:resume',
  statsQuery: 'stats:query',
  statsCatalogue: 'stats:catalogue',
  statsSeasons: 'stats:seasons',
  statsPlayer: 'stats:player',
  statsGames: 'stats:games',
  statsGame: 'stats:game',
  statsStandings: 'stats:standings',
  statsMatchups: 'stats:matchups',
  statsGameMatchups: 'stats:game-matchups',
  statsOfficialsSeason: 'stats:officials-season',
  statsOfficialCareer: 'stats:official-career',
  statsOnCourtUnits: 'stats:on-court-units',
  statsWithOrWithout: 'stats:with-or-without',
  statsLineups: 'stats:lineups',
  statsProfile: 'stats:profile',
  statsAvailability: 'stats:availability',
  statsCoaches: 'stats:coaches',
  statsShots: 'stats:shots',
  statsAssists: 'stats:assists',
  statsGameFlow: 'stats:gameFlow',
  statsViews: 'stats:views',
  statsSaveView: 'stats:saveView',
  statsDeleteView: 'stats:deleteView',
  statsExportCsv: 'stats:exportCsv'
} as const
