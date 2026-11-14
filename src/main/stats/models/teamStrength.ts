import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { srsByDay, type MarginGame } from './srs'

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
      ['srs', 'DOUBLE']
    ],
    components: ['srs_games', 'mov', 'sos', 'srs'],
    gameTypes: ['regular'],
    typesReason: REGULAR_SEASON_SOLVED
  }
]

interface GameRow {
  game_id: string
  game_date: string
  home: number
  away: number
  margin: number
}

/**
 * The season's regular-season games with a score. The game table's type already leaves out the
 * All-Star games ESPN files as regular season and the Cup final, which is not a regular-season game
 * (`nba-data-sources.md`, the traps).
 */
async function regularGames(ctx: ModelContext): Promise<GameRow[]> {
  return ctx.db.all<GameRow>(
    `SELECT game_id, strftime(game_date, '%Y-%m-%d') AS game_date, home_team_id AS home,
            away_team_id AS away, (home_score - away_score)::DOUBLE AS margin
     FROM game
     WHERE played AND season = ? AND game_type = 'regular' AND home_team_id IS NOT NULL
       AND away_team_id IS NOT NULL AND home_score IS NOT NULL AND away_score IS NOT NULL
     ORDER BY game_date, game_id`,
    [ctx.season]
  )
}

async function build(ctx: ModelContext): Promise<ModelRows> {
  const games = await regularGames(ctx)
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
    margin: g.margin
  }))
  const rows = srsByDay(margins).map((r) => ({
    season: ctx.season,
    game_type: 'regular',
    team_id: r.team,
    game_id: gameOf.get(`${r.date}|${r.team}`),
    game_date: r.date,
    srs_games: r.games,
    mov: r.mov,
    sos: r.sos,
    srs: r.srs
  }))
  return { [TEAM_STRENGTH_TABLE]: rows }
}

export const TEAM_STRENGTH: ModelBuilder = {
  name: 'team_strength',
  version: 1,
  tables: TEAM_STRENGTH_TABLES,
  build
}
