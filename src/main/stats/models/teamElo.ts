import type { GameType } from '@shared/stats/types'
import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { ELO, runSeason, seasonStart, type EloGame } from './elo'
import { neutralSitesSql } from './neutral'

/** Plan T1002: Elo, a team's rating before and after every game played. */
export const ELO_GAME_TABLE = 'elo_game'
/** Expected wins by Elo, a sum over the games played. */
export const ELO_WINS_TABLE = 'elo_wins'
/** The games of the season in progress still to come, rated with the latest ratings. */
export const ELO_SCHEDULE_TABLE = 'elo_schedule'

/**
 * Every type of game played between two teams of the league counts: the regular season, the play-in,
 * the playoffs and the Cup final. All-Star and preseason games never do.
 */
export const ELO_GAME_TYPES: readonly GameType[] = ['regular', 'play-in', 'playoffs', 'cup-final']

export const ELO_TYPES_REASON = 'Rated on games between teams of the league, not this type.'

const keys: ModelTable['columns'] = [
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['team_id', 'BIGINT'],
  ['game_id', 'VARCHAR'],
  ['game_date', 'DATE']
]

/**
 * Before a game: the sides, both ratings, the home court in this team's favour (+80 at home, −80 away,
 * 0 at a neutral site), its win probability and expected margin.
 */
const before: ModelTable['columns'] = [
  ['opponent_id', 'BIGINT'],
  ['home', 'BOOLEAN'],
  ['neutral', 'BOOLEAN'],
  ['elo_pre', 'DOUBLE'],
  ['opp_elo_pre', 'DOUBLE'],
  ['home_court', 'DOUBLE'],
  ['win_prob', 'DOUBLE'],
  ['exp_margin', 'DOUBLE']
]

export const TEAM_ELO_TABLES: readonly ModelTable[] = [
  {
    table: ELO_GAME_TABLE,
    entity: 'team',
    kind: 'state',
    grain: 'game',
    // One row per team and game played, never a game to come: the engine reads a state at the last row
    // in scope, and a game not played would be that row with no rating.
    columns: [
      ...keys,
      ...before,
      // After the game: both ratings.
      ['elo', 'DOUBLE'],
      ['opp_elo', 'DOUBLE']
    ],
    components: ['elo', 'elo_pre', 'win_prob'],
    gameTypes: ELO_GAME_TYPES,
    typesReason: ELO_TYPES_REASON
  },
  {
    table: ELO_WINS_TABLE,
    entity: 'team',
    kind: 'sum',
    grain: 'game',
    // One row per team and game played: the win probability before it, so added over any scope it is
    // the games Elo expected the team to win.
    columns: [...keys, ['elo_exp_wins', 'DOUBLE']],
    components: ['elo_exp_wins'],
    gameTypes: ELO_GAME_TYPES,
    typesReason: ELO_TYPES_REASON
  },
  {
    table: ELO_SCHEDULE_TABLE,
    entity: 'team',
    // No metric names it, so the engine never reads it: the game page and the season simulation
    // (Plan T1003) do. One row per team and game of the season in progress not played yet, rated with
    // the ratings after every game played, whatever its listed date.
    kind: 'sum',
    grain: 'game',
    columns: [...keys, ...before],
    components: []
  }
]

interface GameRow {
  game_id: string
  game_date: string
  game_type: string
  home: number
  away: number
  margin: number | null
  neutral: boolean
}

/**
 * The season's games between two named teams of the types Elo rates: those played, with their margin,
 * and in the season in progress those not played yet, each with whether it had no home court
 * (`neutralSitesSql`, shared with the other models).
 */
async function seasonGames(ctx: ModelContext): Promise<GameRow[]> {
  const types = ELO_GAME_TYPES.map((t) => `'${t}'`).join(', ')
  const neutral = neutralSitesSql(ctx.have, { from: ctx.season, to: ctx.season })
  return ctx.db.all<GameRow>(
    `SELECT g.game_id, strftime(g.game_date, '%Y-%m-%d') AS game_date, g.game_type,
            g.home_team_id AS home, g.away_team_id AS away,
            CASE WHEN g.played THEN (g.home_score - g.away_score)::DOUBLE END AS margin,
            coalesce(n.neutral, false) AS neutral
     FROM game g LEFT JOIN (${neutral}) n USING (game_id)
     WHERE g.season = ? AND g.game_type IN (${types})
       AND g.home_team_id IS NOT NULL AND g.away_team_id IS NOT NULL
       AND ((g.played AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL
             AND g.home_score <> g.away_score) OR (NOT g.played AND g.season = ?))
     ORDER BY g.game_date, g.game_id`,
    [ctx.season, ctx.current]
  )
}

/** Each team's rating after its last game of a season, from this table, as the step wrote it. */
async function finalRatings(ctx: ModelContext, season: number): Promise<Map<number, number>> {
  const rows = await ctx.db.all<{ team_id: number; elo: number }>(
    `SELECT team_id, arg_max(elo, (game_date, game_id)) AS elo
     FROM ${ELO_GAME_TABLE} WHERE season = ? GROUP BY team_id`,
    [season]
  )
  return new Map(rows.map((r) => [Number(r.team_id), r.elo]))
}

async function build(ctx: ModelContext): Promise<ModelRows> {
  const rows = await seasonGames(ctx)
  const teams = [...new Set(rows.flatMap((g) => [g.home, g.away]).map(Number))]
  // The season before, as this step left it: computed first, since seasons run in order. With none
  // (the first season held), every team starts at 1500.
  const last = await finalRatings(ctx, ctx.season - 1)
  const start =
    last.size > 0 ? seasonStart(last, teams) : new Map(teams.map((t) => [t, ELO.start as number]))
  const typeOf = new Map(rows.map((g) => [g.game_id, g.game_type]))
  const games: EloGame<number>[] = rows.map((g) => ({
    game_id: g.game_id,
    date: g.game_date,
    home: Number(g.home),
    away: Number(g.away),
    neutral: g.neutral,
    margin: g.margin
  }))
  const { rows: rated } = runSeason(games, start)
  const elo: Record<string, unknown>[] = []
  const wins: Record<string, unknown>[] = []
  const schedule: Record<string, unknown>[] = []
  for (const r of rated) {
    const game = {
      season: ctx.season,
      game_type: typeOf.get(r.game_id),
      game_id: r.game_id,
      game_date: r.date
    }
    const neutral = r.homeCourt === 0
    const sides = [
      [r.home, r.away, true, r.homePre, r.awayPre, r.homePost, r.awayPost, 1],
      [r.away, r.home, false, r.awayPre, r.homePre, r.awayPost, r.homePost, -1]
    ] as const
    for (const [team, opp, home, pre, oppPre, post, oppPost, sign] of sides) {
      const winProb = sign === 1 ? r.homeWin : 1 - r.homeWin
      const side = {
        ...game,
        team_id: team,
        opponent_id: opp,
        home,
        neutral,
        elo_pre: pre,
        opp_elo_pre: oppPre,
        // + 0 turns a neutral site's −0 into 0.
        home_court: sign * r.homeCourt + 0,
        win_prob: winProb,
        exp_margin: sign * r.homeMargin + 0
      }
      if (r.played) {
        elo.push({ ...side, elo: post, opp_elo: oppPost })
        wins.push({ ...game, team_id: team, elo_exp_wins: winProb })
      } else {
        schedule.push(side)
      }
    }
  }
  return { [ELO_GAME_TABLE]: elo, [ELO_WINS_TABLE]: wins, [ELO_SCHEDULE_TABLE]: schedule }
}

/** A change in one season moves every rating after it: recompute from the earliest one changed. */
function seasons(changed: readonly number[], played: readonly number[]): number[] {
  if (changed.length === 0) return []
  const from = Math.min(...changed)
  return played.filter((s) => s >= from)
}

export const TEAM_ELO: ModelBuilder = {
  name: 'team_elo',
  version: 4,
  tables: TEAM_ELO_TABLES,
  seasons,
  build
}
