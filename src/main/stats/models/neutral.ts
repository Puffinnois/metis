import { column, type Have } from '../derived/sql'

/**
 * Which games had no home court, for every model that gives one (Elo, Plan T1002; adjusted ratings,
 * Plan T1004). Read from ESPN's schedule (`docs/reference/nba-data-sources.md`, "Elo", and the trap
 * on `neutral_site`):
 *
 * - its `neutral_site` mark: games abroad from 2012-13, the Cup's semifinals from 2024-25 and its
 *   finals from 2023-24;
 * - the Cup final by the game's type, and the Cup semifinals by ESPN's note (2023-24's are unmarked);
 * - the 2020 bubble by its city, Lake Buena Vista (unmarked).
 *
 * The 11 games abroad before 2012-13 carry no mark anywhere in the data and keep home court, as do the
 * Raptors' 2020-21 season in Tampa and the Spurs' games in Austin, which were home games.
 */
export const BUBBLE_CITY = 'Lake Buena Vista'

const ESPN = 'src_espn_schedule'

/**
 * A query of every game in `game` (of the seasons given, by final year) with whether it was played
 * at a neutral site: columns `game_id VARCHAR, neutral BOOLEAN`, one row per game. Join it on
 * `game_id`. A game ESPN's schedule is not linked to (one far ahead) is matched by its sides and
 * date. Without ESPN's schedule only the Cup final is neutral.
 */
export function neutralSitesSql(have: Have, seasons?: { from: number; to: number }): string {
  const within = (expr: string, pad: number): string =>
    seasons
      ? `${expr} BETWEEN ${Math.trunc(seasons.from) - pad} AND ${Math.trunc(seasons.to) + pad}`
      : 'true'
  if (!have.tables.has(ESPN)) {
    return `SELECT game_id, game_type = 'cup-final' AS neutral FROM game WHERE ${within('season', 0)}`
  }
  return `WITH espn AS (
      SELECT DISTINCT ON (game_id) game_id, home_id, away_id, game_date::DATE AS game_date,
             ${column(have, ESPN, 's', 'neutral_site', 'BOOLEAN')} AS neutral_site,
             ${column(have, ESPN, 's', 'notes_headline', 'VARCHAR')} AS notes,
             ${column(have, ESPN, 's', 'venue_address_city', 'VARCHAR')} AS city
      FROM ${ESPN} s
      WHERE ${within('season', 1)}
      ORDER BY game_id, (season = file_season) DESC, file_season DESC
    ), marked AS (
      SELECT g.game_id, g.game_type,
             coalesce(e.neutral_site, f.neutral_site) AS neutral_site,
             coalesce(e.notes, f.notes) AS notes, coalesce(e.city, f.city) AS city
      FROM game g
      LEFT JOIN espn e ON e.game_id = g.espn_game_id
      LEFT JOIN team th ON th.team_id = g.home_team_id AND th.season = g.season
      LEFT JOIN team ta ON ta.team_id = g.away_team_id AND ta.season = g.season
      LEFT JOIN espn f ON g.espn_game_id IS NULL AND f.home_id = th.espn_team_id
        AND f.away_id = ta.espn_team_id AND abs(date_diff('day', f.game_date, g.game_date)) <= 1
      WHERE ${within('g.season', 0)}
      QUALIFY row_number() OVER (PARTITION BY g.game_id
        ORDER BY abs(date_diff('day', f.game_date, g.game_date)) NULLS LAST) = 1
    )
    SELECT game_id,
           coalesce(neutral_site, false) OR game_type = 'cup-final'
             OR coalesce(notes ILIKE '%semifinal%' AND (notes ILIKE '%cup%' OR notes ILIKE '%tournament%'), false)
             OR coalesce(city = '${BUBBLE_CITY}', false) AS neutral
    FROM marked`
}
