import { MATCHUP_COUNTS, MATCHUPS_FIRST_SEASON } from './publishedTables'
import { column, type Have } from './sql'

/**
 * Who guarded whom over a season: one row per pair of offensive player and defender, from the NBA's
 * pair file. It is published for the regular season only. The player dashboard lists a player's pairs
 * from it; the defenders' totals in the catalogue add the same rows up.
 */
export const MATCHUP_PAIRS = 'pub_matchup_pairs'

const SOURCE = 'src_nba_season_matchups'

/** The pair file's numbers, as the table names them. */
export const PAIR_COLUMNS = ['games', 'minutes', 'partial_poss', ...MATCHUP_COUNTS] as const

export function matchupPairsBootstrap(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS ${MATCHUP_PAIRS} (
       season INTEGER, off_player_id BIGINT, def_player_id BIGINT,
       ${PAIR_COLUMNS.map((c) => `${c} DOUBLE`).join(', ')})`
  ]
}

/** The table, from the pair file's rows of totals. What is missing reads as NULL. */
export function matchupPairsSql(have: Have): string {
  const held = have.columns.get(SOURCE)
  const num = (name: string): string => column(have, SOURCE, 's', name, 'DOUBLE')
  const read: Record<(typeof PAIR_COLUMNS)[number], string> = {
    games: num('gp'),
    minutes: `${num('matchup_time_sec')} / 60`,
    partial_poss: num('partial_poss'),
    ...(Object.fromEntries(MATCHUP_COUNTS.map((c) => [c, num(c)])) as Record<
      (typeof MATCHUP_COUNTS)[number],
      string
    >)
  }
  const season = column(have, SOURCE, 's', 'season')
  const where = [`${season} >= ${MATCHUPS_FIRST_SEASON}`]
  if (held?.has('per_mode')) where.push("lower(s.per_mode) = 'totals'")
  return `CREATE OR REPLACE TABLE ${MATCHUP_PAIRS} AS
    SELECT ${season} AS season,
           ${column(have, SOURCE, 's', 'off_player_id', 'BIGINT')} AS off_player_id,
           ${column(have, SOURCE, 's', 'def_player_id', 'BIGINT')} AS def_player_id,
           ${PAIR_COLUMNS.map((c) => `${read[c]} AS ${c}`).join(', ')}
    FROM ${held ? SOURCE : '(SELECT 1)'} s
    WHERE ${held ? where.join(' AND ') : 'false'}`
}
