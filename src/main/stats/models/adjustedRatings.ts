import { adjustedByDay, type EfficiencyGame } from './adjusted'
import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { REGULAR_SEASON_SOLVED } from './teamStrength'

/** Plan T1004: offense and defense per 100 possessions, adjusted for opponent and site. */
export const ADJUSTED_TABLE = 'adjusted_rating'

export const ADJUSTED_TABLES: readonly ModelTable[] = [
  {
    table: ADJUSTED_TABLE,
    entity: 'team',
    kind: 'state',
    grain: 'game',
    columns: [
      ['season', 'INTEGER'],
      ['game_type', 'VARCHAR'],
      ['team_id', 'BIGINT'],
      ['game_id', 'VARCHAR'],
      ['game_date', 'DATE'],
      // The season so far, after this game day: the team's possessions, its ratings, and the league's.
      ['adj_poss', 'DOUBLE'],
      ['adj_ortg', 'DOUBLE'],
      ['adj_drtg', 'DOUBLE'],
      ['adj_nrtg', 'DOUBLE'],
      ['adj_league', 'DOUBLE'],
      ['adj_home', 'DOUBLE']
    ],
    components: ['adj_poss', 'adj_ortg', 'adj_drtg', 'adj_nrtg', 'adj_league', 'adj_home'],
    gameTypes: ['regular'],
    typesReason: REGULAR_SEASON_SOLVED
  }
]

/**
 * The 2019-20 regular season resumed in Orlando on July 30, 2020, with every game at one site and no
 * crowd. ESPN does not flag those 88 games as neutral, so they are marked here.
 */
const RESTART = { season: 2020, from: '2020-07-30' }

interface GameRow extends EfficiencyGame<number> {
  game_id: string
}

/**
 * The season's regular-season games with a box score on both sides: the points and the possessions
 * the plain ratings divide by (`team_game.poss_sym`, one count for both teams). A neutral site is
 * ESPN's flag, read when its schedule has the column.
 */
async function games(ctx: ModelContext): Promise<GameRow[]> {
  const flagged = ctx.have.columns.get('src_espn_schedule')?.has('neutral_site')
  const neutral = flagged
    ? `coalesce((SELECT bool_or(e.neutral_site) FROM src_espn_schedule e
                 WHERE e.game_id = g.espn_game_id), false)`
    : 'false'
  return ctx.db.all<GameRow>(
    `SELECT g.game_id, strftime(g.game_date, '%Y-%m-%d') AS date, g.home_team_id AS home,
            g.away_team_id AS away, h.pts::DOUBLE AS "homePts", a.pts::DOUBLE AS "awayPts",
            h.poss_sym::DOUBLE AS poss,
            ${neutral} OR (g.season = ${RESTART.season} AND g.game_date >= DATE '${RESTART.from}')
              AS neutral
     FROM game g
     JOIN team_game h ON h.game_id = g.game_id AND h.team_id = g.home_team_id
     JOIN team_game a ON a.game_id = g.game_id AND a.team_id = g.away_team_id
     WHERE g.season = ? AND g.game_type = 'regular' AND g.played
       AND h.pts IS NOT NULL AND a.pts IS NOT NULL AND h.poss_sym > 0
     ORDER BY g.game_date, g.game_id`,
    [ctx.season]
  )
}

async function build(ctx: ModelContext): Promise<ModelRows> {
  const list = await games(ctx)
  // A team plays once a day; the game of each team's day names its row.
  const gameOf = new Map<string, string>()
  for (const g of list) {
    gameOf.set(`${g.date}|${g.home}`, g.game_id)
    gameOf.set(`${g.date}|${g.away}`, g.game_id)
  }
  const rows = adjustedByDay(list).map((r) => ({
    season: ctx.season,
    game_type: 'regular',
    team_id: r.team,
    game_id: gameOf.get(`${r.date}|${r.team}`),
    game_date: r.date,
    adj_poss: r.poss,
    adj_ortg: r.ortg,
    adj_drtg: r.drtg,
    adj_nrtg: r.net,
    adj_league: r.league,
    adj_home: r.homeCourt
  }))
  return { [ADJUSTED_TABLE]: rows }
}

export const ADJUSTED_RATINGS: ModelBuilder = {
  name: 'adjusted_rating',
  version: 1,
  tables: ADJUSTED_TABLES,
  build
}
