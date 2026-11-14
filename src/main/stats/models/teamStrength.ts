import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { srsByDay, type Fixture, type MarginGame } from './srs'

/** Plan T1001: SRS and schedule strength, as of every game day of the regular season. */
export const TEAM_STRENGTH_TABLE = 'team_strength'

/** Why a scope with no regular-season game has no SRS. */
export const REGULAR_SEASON_SOLVED = 'Solved on the regular season.'

export const TEAM_STRENGTH_TABLES: readonly ModelTable[] = [
  {
    table: TEAM_STRENGTH_TABLE,
    entity: 'team',
    kind: 'state',
    grain: 'game',
    columns: [
      ['season', 'INTEGER'],
      ['game_type', 'VARCHAR'],
      ['team_id', 'BIGINT'],
      ['game_id', 'VARCHAR'],
      ['game_date', 'DATE'],
      // The season so far, after this game day.
      ['srs_games', 'INTEGER'],
      ['mov', 'DOUBLE'],
      ['sos', 'DOUBLE'],
      ['srs', 'DOUBLE'],
      // The schedule after this game day: its games, and their opponents' average SRS as of the day.
      ['games_left', 'INTEGER'],
      ['sos_left', 'DOUBLE']
    ],
    components: ['srs_games', 'mov', 'sos', 'srs', 'games_left', 'sos_left'],
    gameTypes: ['regular'],
    typesReason: REGULAR_SEASON_SOLVED
  }
]

interface GameRow {
  game_id: string
  game_date: string
  home: number
  away: number
  /** Null for a game not played. */
  margin: number | null
}

/**
 * The season's regular-season games between two named teams: those played, with their margin, and
 * those still to come. A played game needs both scores. The game table's type already leaves out the
 * All-Star games ESPN files as regular season and the Cup final, which is not a regular-season game
 * (`nba-data-sources.md`, the traps).
 */
async function regularGames(ctx: ModelContext): Promise<GameRow[]> {
  return ctx.db.all<GameRow>(
    `SELECT game_id, strftime(game_date, '%Y-%m-%d') AS game_date, home_team_id AS home,
            away_team_id AS away,
            CASE WHEN played THEN (home_score - away_score)::DOUBLE END AS margin
     FROM game
     WHERE season = ? AND game_type = 'regular' AND home_team_id IS NOT NULL
       AND away_team_id IS NOT NULL
       AND (NOT played OR (home_score IS NOT NULL AND away_score IS NOT NULL))
     ORDER BY game_date, game_id`,
    [ctx.season]
  )
}

/** A game of the season in progress still to come, whatever its listed date (a postponed one). */
const TO_COME = '9999-12-31'

async function build(ctx: ModelContext): Promise<ModelRows> {
  const all = await regularGames(ctx)
  const games = all.filter((g) => g.margin !== null)
  // The schedule left: the games played after each day, and in the season in progress those still to
  // come. A past season's game never played was cancelled (Boston at Indiana, 2013), so not left.
  const fixtures: Fixture<number>[] = all
    .filter((g) => g.margin !== null || ctx.season === ctx.current)
    .map((g) => ({ date: g.margin === null ? TO_COME : g.game_date, home: g.home, away: g.away }))
  // A team plays once a day; the game of each team's day names its row.
  const gameOf = new Map<string, string>()
  for (const g of games) {
    gameOf.set(`${g.game_date}|${g.home}`, g.game_id)
    gameOf.set(`${g.game_date}|${g.away}`, g.game_id)
  }
  const margins: MarginGame<number>[] = games.map((g) => ({
    date: g.game_date,
    home: g.home,
    away: g.away,
    margin: g.margin!
  }))
  const rows = srsByDay(margins, fixtures).map((r) => ({
    season: ctx.season,
    game_type: 'regular',
    team_id: r.team,
    game_id: gameOf.get(`${r.date}|${r.team}`),
    game_date: r.date,
    srs_games: r.games,
    mov: r.mov,
    sos: r.sos,
    srs: r.srs,
    games_left: r.gamesLeft,
    sos_left: r.sosLeft
  }))
  return { [TEAM_STRENGTH_TABLE]: rows }
}

export const TEAM_STRENGTH: ModelBuilder = {
  name: 'team_strength',
  version: 2,
  tables: TEAM_STRENGTH_TABLES,
  build
}
