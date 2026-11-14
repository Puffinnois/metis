import type { GameType } from '@shared/stats/types'
import { column } from '../derived/sql'
import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { ELO, runSeason, seasonStart, type EloGame } from './elo'

/** Plan T1002: Elo, a team's rating before and after every game, and the games still to come. */
export const ELO_GAME_TABLE = 'elo_game'
/** Expected wins by Elo, a sum over the games played. */
export const ELO_WINS_TABLE = 'elo_wins'

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

export const TEAM_ELO_TABLES: readonly ModelTable[] = [
  {
    table: ELO_GAME_TABLE,
    entity: 'team',
    kind: 'state',
    grain: 'game',
    // One row per team and game on the schedule: the games played, and in the season in progress
    // those still to come (not played, so no engine read reaches them).
    columns: [
      ...keys,
      ['opponent_id', 'BIGINT'],
      ['home', 'BOOLEAN'],
      ['neutral', 'BOOLEAN'],
      ['played', 'BOOLEAN'],
      // Before the game: both ratings, the home court in this team's favour (+100 at home, −100 away,
      // 0 at a neutral site), its win probability and expected margin.
      ['elo_pre', 'DOUBLE'],
      ['opp_elo_pre', 'DOUBLE'],
      ['home_court', 'DOUBLE'],
      ['win_prob', 'DOUBLE'],
      ['exp_margin', 'DOUBLE'],
      // After the game: both ratings. Null for a game not played.
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

const ESPN = 'src_espn_schedule'

/**
 * Whether a game has no home court, read from ESPN's schedule (`nba-data-sources.md`, "Elo"):
 * its `neutral_site` mark (games abroad from 2012-13, the Cup's semifinals and final from 2024-25);
 * the Cup final and the 2023-24 semifinals, which it does not mark; and the 2020 bubble at Lake Buena
 * Vista, which it does not mark either. Games abroad before 2012-13 carry no mark and keep home court.
 */
function neutralSql(espn: boolean): string {
  if (!espn) return `game_type = 'cup-final'`
  return `(coalesce(neutral_site, false) OR game_type = 'cup-final'
    OR coalesce(notes ILIKE '%semifinal%' AND (notes ILIKE '%cup%' OR notes ILIKE '%tournament%'), false)
    OR coalesce(city = 'Lake Buena Vista', false))`
}

/**
 * The season's games between two named teams of the types Elo rates: those played, with their margin,
 * and in the season in progress those not played yet. A game ESPN's schedule is not linked to (one far
 * ahead) is matched to it by its sides and date, for its neutral mark.
 */
async function seasonGames(ctx: ModelContext): Promise<GameRow[]> {
  const types = ELO_GAME_TYPES.map((t) => `'${t}'`).join(', ')
  const has = ctx.have.tables.has(ESPN)
  const espn = has
    ? `espn AS (
        SELECT DISTINCT ON (game_id) game_id, home_id, away_id, game_date::DATE AS game_date,
               ${column(ctx.have, ESPN, 's', 'neutral_site', 'BOOLEAN')} AS neutral_site,
               ${column(ctx.have, ESPN, 's', 'notes_headline', 'VARCHAR')} AS notes,
               ${column(ctx.have, ESPN, 's', 'venue_address_city', 'VARCHAR')} AS city
        FROM ${ESPN} s
        WHERE season BETWEEN ${ctx.season - 1} AND ${ctx.season + 1}
        ORDER BY game_id, (season = file_season) DESC, file_season DESC
      ),`
    : ''
  const join = has
    ? `LEFT JOIN espn e ON e.game_id = g.espn_game_id
       LEFT JOIN team th ON th.team_id = g.home_team_id AND th.season = g.season
       LEFT JOIN team ta ON ta.team_id = g.away_team_id AND ta.season = g.season
       LEFT JOIN espn f ON g.espn_game_id IS NULL AND f.home_id = th.espn_team_id
         AND f.away_id = ta.espn_team_id AND abs(date_diff('day', f.game_date, g.game_date)) <= 1`
    : ''
  const x = has
    ? `x AS (SELECT g.*, coalesce(e.neutral_site, f.neutral_site) AS neutral_site,
                    coalesce(e.notes, f.notes) AS notes, coalesce(e.city, f.city) AS city
             FROM g ${join}
             QUALIFY row_number() OVER (PARTITION BY g.game_id
               ORDER BY abs(date_diff('day', f.game_date, g.game_date)) NULLS LAST) = 1)`
    : `x AS (SELECT * FROM g)`
  return ctx.db.all<GameRow>(
    `WITH ${espn} g AS (
       SELECT game_id, espn_game_id, season, game_type, game_date, home_team_id, away_team_id,
              played, home_score, away_score
       FROM game
       WHERE season = ? AND game_type IN (${types})
         AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
         AND ((played AND home_score IS NOT NULL AND away_score IS NOT NULL
               AND home_score <> away_score) OR (NOT played AND season = ?))
     ), ${x}
     SELECT game_id, strftime(game_date, '%Y-%m-%d') AS game_date, game_type,
            home_team_id AS home, away_team_id AS away,
            CASE WHEN played THEN (home_score - away_score)::DOUBLE END AS margin,
            ${neutralSql(has)} AS neutral
     FROM x
     ORDER BY game_date, game_id`,
    [ctx.season, ctx.current]
  )
}

/** Each team's rating after its last game of a season, from this table, as the step wrote it. */
async function finalRatings(ctx: ModelContext, season: number): Promise<Map<number, number>> {
  const rows = await ctx.db.all<{ team_id: number; elo: number }>(
    `SELECT team_id, arg_max(elo, (game_date, game_id)) AS elo
     FROM ${ELO_GAME_TABLE} WHERE season = ? AND played GROUP BY team_id`,
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
      elo.push({
        ...game,
        team_id: team,
        opponent_id: opp,
        home,
        neutral,
        played: r.played,
        elo_pre: pre,
        opp_elo_pre: oppPre,
        // + 0 turns a neutral site's −0 into 0.
        home_court: sign * r.homeCourt + 0,
        win_prob: winProb,
        exp_margin: sign * r.homeMargin + 0,
        elo: post,
        opp_elo: oppPost
      })
      if (r.played) wins.push({ ...game, team_id: team, elo_exp_wins: winProb })
    }
  }
  return { [ELO_GAME_TABLE]: elo, [ELO_WINS_TABLE]: wins }
}

/** A change in one season moves every rating after it: recompute from the earliest one changed. */
function seasons(changed: readonly number[], played: readonly number[]): number[] {
  if (changed.length === 0) return []
  const from = Math.min(...changed)
  return played.filter((s) => s >= from)
}

export const TEAM_ELO: ModelBuilder = {
  name: 'team_elo',
  version: 2,
  tables: TEAM_ELO_TABLES,
  seasons,
  build
}
