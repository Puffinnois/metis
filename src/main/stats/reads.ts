import type {
  GameSide,
  GameType,
  StatsGame,
  StatsGameDetail,
  StatsLineups,
  StatsLineupUnit,
  StatsMatchupPair,
  StatsMatchups,
  StatsMatchupScope,
  PositionGroup,
  StatsBio,
  StatsCombine,
  StatsPlayerInfo,
  StatsProfile,
  StatsStanding
} from '@shared/stats/types'
import {
  COMBINE_BY_ID,
  COMBINE_MEASURES,
  COMBINE_TABLES,
  eventYear,
  type CombineMeasure,
  type CombineTable
} from '@shared/stats/profile'
import type { StatsDb } from './db'
import { lineupReadIds, LINEUP_GROUPS, type LineupGroup } from '@shared/stats/lineups'
import { LINEUPS } from './derived/lineups'
import { MATCHUP_PAIRS } from './derived/matchupPairs'
import { column, inspect, per, type Have } from './derived/sql'
import { readOfficials } from './availabilityReads'
import { readScopedMatchups } from './matchupReads'

/**
 * What the dashboards read beside the query engine: who a player is, the schedule, a game's facts and
 * the published standings. Each is a plain read of one thing, and a table not loaded yet reads as
 * nothing, so a screen can say what is missing.
 */

/** A published text column, trimmed: the source pads some with spaces and leaves others empty. */
const text = (have: Have, table: string, alias: string, name: string): string =>
  `nullif(trim(${column(have, table, alias, name, 'VARCHAR')}), '')`

export async function readPlayer(db: StatsDb, id: string): Promise<StatsPlayerInfo | null> {
  const have = await inspect(db)
  if (!have.tables.has('player') || !/^-?[0-9]{1,12}$/.test(id)) return null
  const key = Number(id)
  const person = await db.get<{ name: string }>('SELECT name FROM player WHERE player_id = ?', [
    key
  ])
  if (!person) return null
  const seasons = have.tables.has('player_season')
    ? await db.all<{
        season: number
        position: string | null
        team_id: number | null
        code: string | null
      }>(
        `WITH s AS (
           SELECT season, mode(position) AS position, arg_max(last_team_id, last_date) AS team_id
           FROM player_season
           WHERE player_id = ? AND team_id IS NULL AND game_type NOT IN ('all-star', 'preseason')
           GROUP BY 1
         )
         SELECT s.season, s.position, s.team_id, t.code
         FROM s LEFT JOIN team t ON t.team_id = s.team_id AND t.season = s.season
         ORDER BY s.season`,
        [key]
      )
    : []
  const r = 'src_nba_rosters'
  const roster = have.tables.has(r)
    ? await db.get<{
        number: string | null
        height: string | null
        weight: string | null
        birth_date: string | null
        school: string | null
      }>(
        `SELECT ${text(have, r, 'r', 'num')} AS number, ${text(have, r, 'r', 'height')} AS height,
                ${text(have, r, 'r', 'weight')} AS weight,
                ${text(have, r, 'r', 'birth_date')} AS birth_date,
                ${text(have, r, 'r', 'school')} AS school
         FROM ${r} r WHERE r.player_id = ? ORDER BY r.season DESC LIMIT 1`,
        [key]
      )
    : null
  const latest = seasons.at(-1)
  return {
    id,
    name: person.name,
    position: seasons.findLast((s) => s.position)?.position ?? null,
    team: latest?.team_id ? { id: String(latest.team_id), code: latest.code } : null,
    seasons: seasons.map((s) => s.season),
    number: roster?.number ?? null,
    height: roster?.height ?? null,
    weight: roster?.weight ?? null,
    birthDate: roster?.birth_date ?? null,
    school: roster?.school ?? null
  }
}

/**
 * A player's profile: the roster's bio from the latest season that lists them, their draft, and every
 * combine they went to, each measure ranked within its position group. A table not loaded reads as
 * nothing, and a test a player has no result for stays null: the combine prints a blank for one not
 * taken, never a 0.
 */
export async function readProfile(db: StatsDb, id: string): Promise<StatsProfile> {
  const none: StatsProfile = {
    bio: null,
    draft: null,
    draftYears: null,
    combines: [],
    combineYears: null
  }
  if (!/^-?[0-9]{1,12}$/.test(id)) return none
  const have = await inspect(db)
  const key = Number(id)
  const [bio, draft, combine] = await Promise.all([
    readBio(db, have, key),
    readDraft(db, have, key),
    readCombines(db, have, key)
  ])
  return { ...none, bio, ...draft, ...combine }
}

async function readBio(db: StatsDb, have: Have, key: number): Promise<StatsBio | null> {
  const r = 'src_nba_rosters'
  if (!have.tables.has(r)) return null
  const named = have.tables.has('team')
  const row = await db.get<{
    season: number
    team_id: number | null
    code: string | null
    number: string | null
    position: string | null
    height: string | null
    weight: string | null
    birth_date: string | null
    age: number | null
    exp: string | null
    school: string | null
    how_acquired: string | null
  }>(
    `SELECT r.season, ${column(have, r, 'r', 'team_id', 'BIGINT')} AS team_id,
            ${named ? 't.code' : 'NULL::VARCHAR'} AS code,
            ${text(have, r, 'r', 'num')} AS number, ${text(have, r, 'r', 'position')} AS position,
            ${text(have, r, 'r', 'height')} AS height, ${text(have, r, 'r', 'weight')} AS weight,
            ${text(have, r, 'r', 'birth_date')} AS birth_date,
            ${column(have, r, 'r', 'age', 'DOUBLE')} AS age, ${text(have, r, 'r', 'exp')} AS exp,
            ${text(have, r, 'r', 'school')} AS school,
            ${text(have, r, 'r', 'how_acquired')} AS how_acquired
     FROM ${r} r
     ${named ? 'LEFT JOIN team t ON t.team_id = r.team_id AND t.season = r.season' : ''}
     WHERE r.player_id = ?
     ORDER BY r.season DESC LIMIT 1`,
    [key]
  )
  if (!row) return null
  return {
    season: row.season,
    team: row.team_id ? { id: String(row.team_id), code: row.code } : null,
    number: row.number,
    position: row.position,
    height: row.height,
    weight: row.weight,
    birthDate: row.birth_date,
    age: row.age,
    experience: row.exp,
    school: row.school,
    howAcquired: row.how_acquired
  }
}

async function readDraft(
  db: StatsDb,
  have: Have,
  key: number
): Promise<Pick<StatsProfile, 'draft' | 'draftYears'>> {
  const d = 'src_nba_draft'
  if (!have.tables.has(d)) return { draft: null, draftYears: null }
  const years = await db.get<{ first: number | null; last: number | null }>(
    `SELECT min(season) AS first, max(season) AS last FROM ${d}`
  )
  const row = await db.get<{
    season: number
    round: number | null
    round_pick: number | null
    overall_pick: number | null
    team_id: number | null
    code: string | null
    team_name: string | null
    organization: string | null
    organization_type: string | null
  }>(
    `SELECT d.season, ${column(have, d, 'd', 'round_number')} AS round,
            ${column(have, d, 'd', 'round_pick')} AS round_pick,
            ${column(have, d, 'd', 'overall_pick')} AS overall_pick,
            ${column(have, d, 'd', 'team_id', 'BIGINT')} AS team_id,
            ${text(have, d, 'd', 'team_abbreviation')} AS code,
            nullif(trim(concat_ws(' ', ${text(have, d, 'd', 'team_city')},
                                       ${text(have, d, 'd', 'team_name')})), '') AS team_name,
            ${text(have, d, 'd', 'organization')} AS organization,
            ${text(have, d, 'd', 'organization_type')} AS organization_type
     FROM ${d} d WHERE d.person_id = ?
     ORDER BY d.season DESC LIMIT 1`,
    [key]
  )
  return {
    draftYears:
      years?.first && years.last
        ? { first: eventYear(years.first), last: eventYear(years.last) }
        : null,
    draft: row
      ? {
          year: eventYear(row.season),
          round: row.round,
          roundPick: row.round_pick,
          overallPick: row.overall_pick,
          team: row.team_id
            ? { id: String(row.team_id), code: row.code, name: row.team_name }
            : null,
          organization: row.organization,
          organizationType: row.organization_type
        }
      : null
  }
}

const COMBINE_ALIAS: Record<CombineTable, string> = {
  anthro: 'a',
  drills: 'd',
  spot_up: 's',
  on_the_move: 'o'
}

/** A measure's value, makes and attempts in the wide row, before the ratios and sums. */
function combineParts(
  have: Have,
  m: CombineMeasure
): { value: string; made: string; attempts: string } | null {
  const s = m.source
  if (!('table' in s)) return null
  const t = COMBINE_TABLES[s.table]
  const at = COMBINE_ALIAS[s.table]
  const num = (name: string): string => column(have, t, at, name, 'DOUBLE')
  if ('spots' in s) {
    // A drill's total counts the spots shot; with none shot it has no total, not 0 of 0.
    const add = (part: string): string =>
      `list_sum(list_filter([${s.spots.map((c) => num(`${c}_${part}`)).join(', ')}], x -> x IS NOT NULL))`
    const made = add('made')
    const attempts = add('attempt')
    return { value: per(made, attempts), made, attempts }
  }
  if (m.unit === 'shots') {
    const made = num(`${s.column}_made`)
    const attempts = num(`${s.column}_attempt`)
    return { value: per(made, attempts), made, attempts }
  }
  return { value: num(s.column), made: 'NULL::DOUBLE', attempts: 'NULL::DOUBLE' }
}

/** A combine position's group: the first listed, as in `position_group` (Plan T504). */
const combineGroup = (p: string): string => `CASE split_part(${p}, '-', 1)
    WHEN 'PG' THEN 'G' WHEN 'SG' THEN 'G' WHEN 'G' THEN 'G'
    WHEN 'SF' THEN 'F' WHEN 'PF' THEN 'F' WHEN 'F' THEN 'F'
    WHEN 'C' THEN 'C' END`

async function readCombines(
  db: StatsDb,
  have: Have,
  key: number
): Promise<Pick<StatsProfile, 'combines' | 'combineYears'>> {
  const parts = (Object.keys(COMBINE_TABLES) as CombineTable[]).filter((t) =>
    have.tables.has(COMBINE_TABLES[t])
  )
  if (parts.length === 0) return { combines: [], combineYears: null }
  // Every attendee once, from whichever tables are loaded; `-1` stands for several without an id, so
  // the name is part of the key.
  const keys = parts
    .map(
      (t) =>
        `SELECT season, player_id, player_name,
                ${text(have, COMBINE_TABLES[t], 'x', 'position')} AS position
         FROM ${COMBINE_TABLES[t]} x`
    )
    .join(' UNION ALL ')
  const years = await db.get<{ first: number | null; last: number | null }>(
    `SELECT min(season) AS first, max(season) AS last FROM (${keys})`
  )
  const combineYears =
    years?.first && years.last
      ? { first: eventYear(years.first), last: eventYear(years.last) }
      : null
  if (key <= 0) return { combines: [], combineYears }
  const joins = parts
    .map((t) => {
      const at = COMBINE_ALIAS[t]
      return `LEFT JOIN ${COMBINE_TABLES[t]} ${at} ON ${at}.season = k.season
        AND ${at}.player_id = k.player_id AND ${at}.player_name = k.player_name`
    })
    .join('\n')
  const base = COMBINE_MEASURES.flatMap((m) => {
    const p = combineParts(have, m)
    return p
      ? [`${p.value} AS "v:${m.id}"`, `${p.made} AS "m:${m.id}"`, `${p.attempts} AS "a:${m.id}"`]
      : []
  })
  const derived = COMBINE_MEASURES.flatMap((m) => {
    const s = m.source
    if ('ratio' in s) return [`${per(`"v:${s.ratio[0]}"`, `"v:${s.ratio[1]}"`)} AS "v:${m.id}"`]
    if ('sum' in s) return [`"v:${s.sum[0]}" + "v:${s.sum[1]}" AS "v:${m.id}"`]
    return []
  })
  // From the 2021 combine on, a shooting drill is published as one total under its first spot's
  // columns, with the other spots empty for everyone: then it is the drill's total, not that spot.
  const drills = COMBINE_MEASURES.flatMap((m) =>
    'spots' in m.source
      ? [{ id: m.id, first: m.source.spots[0], rest: m.source.spots.slice(1) }]
      : []
  )
  const shapes = drills.map(
    (d) =>
      `count("a:${d.first}") > 0 AND ${d.rest.map((c) => `count("a:${c}")`).join(' + ')} = 0
         AS "w:${d.id}"`
  )
  const firsts = drills.flatMap((d) =>
    ['v', 'm', 'a'].map(
      (part) =>
        `CASE WHEN sh."w:${d.id}" THEN NULL ELSE w."${part}:${d.first}" END AS "${part}:${d.first}"`
    )
  )
  const values = COMBINE_MEASURES.map((m) => {
    const shots = m.unit === 'shots'
    return `{'id': '${m.id}', 'value': "v:${m.id}"::DOUBLE,
             'made': ${shots ? `"m:${m.id}"` : 'NULL'}::DOUBLE,
             'attempts': ${shots ? `"a:${m.id}"` : 'NULL'}::DOUBLE,
             'low': ${m.better === 'lower'}}`
  })
  const rows = await db.all<{
    season: number
    position: string | null
    grp: PositionGroup | null
    measure: string
    value: number | null
    made: number | null
    attempts: number | null
    held: boolean
    percentile: number | null
    rank: number | null
    pool: number
  }>(
    `WITH k AS (
       SELECT season, player_id, player_name, any_value(position) AS position
       FROM (${keys}) GROUP BY 1, 2, 3
     ), wide AS (
       SELECT k.season, k.player_id, k.player_name, k.position, ${combineGroup('k.position')} AS grp,
              ${base.join(',\n')}
       FROM k ${joins}
     ), shape AS (
       SELECT season${shapes.length ? `, ${shapes.join(', ')}` : ''} FROM wide GROUP BY 1
     ), spots AS (
       SELECT w.*${firsts.length ? ` REPLACE (${firsts.join(', ')})` : ''}
       FROM wide w JOIN shape sh ON sh.season = w.season
     ), whole AS (
       SELECT *${derived.length ? `, ${derived.join(', ')}` : ''} FROM spots
     ), long AS (
       SELECT season, player_id, player_name, position, grp, unnest([${values.join(',\n')}]) AS u
       FROM whole
     ), flat AS (
       SELECT season, player_id, player_name, position, grp, u.id AS measure, u.value, u.made,
              u.attempts, u.low
       FROM long
     ), held AS (
       SELECT season, measure, bool_or(value IS NOT NULL) AS held FROM flat GROUP BY 1, 2
     ), measured AS (
       -- The better side sorts high, so a fast time is a high percentile.
       SELECT *, CASE WHEN low THEN -value ELSE value END AS sort FROM flat
       WHERE value IS NOT NULL AND grp IS NOT NULL
     ), ranked AS (
       -- Mid-rank: tied players share the middle of their ranks.
       SELECT season, player_id, player_name, measure,
              100 * (rank() OVER (PARTITION BY measure, grp ORDER BY sort) - 1
                     + (count(*) OVER (PARTITION BY measure, grp, sort) - 1) / 2)
                / nullif(count(*) OVER (PARTITION BY measure, grp) - 1, 0) AS percentile,
              rank() OVER (PARTITION BY measure, grp ORDER BY sort DESC) AS rank
       FROM measured
     ), pools AS (
       SELECT measure, grp, count(*) AS pool FROM measured GROUP BY 1, 2
     )
     SELECT f.season, f.position, f.grp, f.measure, f.value, f.made, f.attempts, h.held,
            r.percentile, r.rank::INTEGER AS rank, coalesce(p.pool, 0)::INTEGER AS pool
     FROM flat f
     JOIN held h ON h.season = f.season AND h.measure = f.measure
     LEFT JOIN ranked r ON r.season = f.season AND r.player_id = f.player_id
       AND r.player_name = f.player_name AND r.measure = f.measure
     LEFT JOIN pools p ON p.measure = f.measure AND p.grp = f.grp
     WHERE f.player_id = $1
     ORDER BY f.season DESC`,
    [key]
  )
  const combines = new Map<number, StatsCombine>()
  for (const r of rows) {
    let c = combines.get(r.season)
    if (!c) {
      c = { year: eventYear(r.season), position: r.position, group: r.grp, values: {} }
      combines.set(r.season, c)
    }
    const better = COMBINE_BY_ID.get(r.measure)?.better ?? null
    c.values[r.measure] = {
      value: r.value,
      made: r.made,
      attempts: r.attempts,
      percentile: r.percentile,
      rank: better === null ? null : r.rank,
      pool: r.pool,
      held: r.held
    }
  }
  return { combines: [...combines.values()], combineYears }
}

interface GameRow {
  game_id: string
  season: number
  game_type: GameType
  date: string
  played: boolean
  has_box: boolean
  overtimes: number | null
  home_id: number | null
  home_code: string | null
  home_name: string | null
  home_score: number | null
  away_id: number | null
  away_code: string | null
  away_name: string | null
  away_score: number | null
}

const side = (
  id: number | null,
  code: string | null,
  name: string | null,
  score: number | null,
  played: boolean
): GameSide => ({
  id: id === null ? null : String(id),
  code: code ?? 'TBD',
  name: name ?? code ?? 'To be decided',
  score: played ? score : null
})

/**
 * A season's schedule. A side with no row in `team` is an All-Star team or a touring club, so its
 * name comes from the schedule that lists it. Overtime is read from the team's minutes: 240 in
 * regulation and 25 more per period.
 */
export async function readGames(db: StatsDb, season: number): Promise<StatsGame[]> {
  const have = await inspect(db)
  if (!have.tables.has('game') || !have.tables.has('team_game')) return []
  const n = 'src_nba_schedule'
  const e = 'src_espn_schedule'
  const nba = have.tables.has(n)
    ? `SELECT game_id, any_value(home_team_abbreviation) AS home_code, any_value(home_team_name) AS home_name,
              any_value(away_team_abbreviation) AS away_code, any_value(away_team_name) AS away_name
       FROM ${n} WHERE season = $1 GROUP BY 1`
    : `SELECT NULL::VARCHAR AS game_id, NULL::VARCHAR AS home_code, NULL::VARCHAR AS home_name,
              NULL::VARCHAR AS away_code, NULL::VARCHAR AS away_name`
  const espn = have.tables.has(e)
    ? `SELECT game_id, any_value(home_abbreviation) AS home_code, any_value(home_display_name) AS home_name,
              any_value(away_abbreviation) AS away_code, any_value(away_display_name) AS away_name
       FROM ${e} WHERE game_id IN (SELECT espn_game_id FROM game WHERE season = $1) GROUP BY 1`
    : `SELECT NULL::BIGINT AS game_id, NULL::VARCHAR AS home_code, NULL::VARCHAR AS home_name,
              NULL::VARCHAR AS away_code, NULL::VARCHAR AS away_name`
  const rows = await db.all<GameRow>(
    `WITH box AS (
       SELECT game_id, sum(box_games) AS box, max(seconds) AS seconds FROM team_game
       WHERE season = $1 GROUP BY 1
     ), nba AS (${nba}), espn AS (${espn})
     SELECT g.game_id, g.season, g.game_type, g.game_date::VARCHAR AS date, g.played,
            coalesce(b.box, 0) > 0 AS has_box,
            CASE WHEN coalesce(b.box, 0) > 0
                 THEN greatest(0, round((b.seconds / 60.0 - 240) / 25))::INTEGER END AS overtimes,
            g.home_team_id AS home_id, coalesce(h.code, n.home_code, e.home_code) AS home_code,
            coalesce(h.name, n.home_name, e.home_name) AS home_name, g.home_score,
            g.away_team_id AS away_id, coalesce(a.code, n.away_code, e.away_code) AS away_code,
            coalesce(a.name, n.away_name, e.away_name) AS away_name, g.away_score
     FROM game g
     LEFT JOIN team h ON h.team_id = g.home_team_id AND h.season = g.season
     LEFT JOIN team a ON a.team_id = g.away_team_id AND a.season = g.season
     LEFT JOIN box b ON b.game_id = g.game_id
     LEFT JOIN nba n ON n.game_id = g.nba_game_id
     LEFT JOIN espn e ON e.game_id = g.espn_game_id
     WHERE g.season = $1
     ORDER BY g.game_date, g.game_id`,
    [season]
  )
  return rows.map((r) => ({
    id: r.game_id,
    season: r.season,
    type: r.game_type,
    date: r.date,
    played: r.played,
    hasBox: r.has_box,
    overtimes: r.overtimes,
    home: side(r.home_id, r.home_code, r.home_name, r.home_score, r.played),
    away: side(r.away_id, r.away_code, r.away_name, r.away_score, r.played)
  }))
}

/** ESPN writes a game's periods as text in Python's form: `[{'period': 1, 'value': 23.0} {…}]`. */
export function parsePeriods(published: string | null): number[] {
  if (!published) return []
  return [...published.matchAll(/'value': (-?[0-9.]+)/g)].map((m) => Number(m[1]))
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export async function readGame(db: StatsDb, id: string): Promise<StatsGameDetail | null> {
  const have = await inspect(db)
  const e = 'src_espn_schedule'
  if (!have.tables.has('game')) return null
  const officials = await readOfficials(db, id)
  // The crew comes from the NBA's file, so a game ESPN's schedule lacks can still have one.
  const bare: StatsGameDetail = {
    id,
    venue: null,
    city: null,
    attendance: null,
    note: null,
    periods: null,
    officials
  }
  if (!have.tables.has(e)) return officials.length ? bare : null
  const r = await db.get<{
    venue: string | null
    city: string | null
    attendance: number | null
    note: string | null
    home_lines: string | null
    away_lines: string | null
    home_score: number | null
    away_score: number | null
  }>(
    `SELECT ${text(have, e, 'e', 'venue_full_name')} AS venue,
            ${text(have, e, 'e', 'venue_address_city')} AS city,
            ${column(have, e, 'e', 'attendance', 'DOUBLE')} AS attendance,
            ${text(have, e, 'e', 'notes_headline')} AS note,
            ${text(have, e, 'e', 'home_linescores')} AS home_lines,
            ${text(have, e, 'e', 'away_linescores')} AS away_lines,
            g.home_score, g.away_score
     FROM game g JOIN ${e} e ON e.game_id = g.espn_game_id
     WHERE g.game_id = ? LIMIT 1`,
    [id]
  )
  if (!r) return officials.length ? bare : null
  const home = parsePeriods(r.home_lines)
  const away = parsePeriods(r.away_lines)
  // Periods that do not add up to the score would contradict the header, so they are not shown.
  const agree = home.length > 0 && sum(home) === r.home_score && sum(away) === r.away_score
  return {
    id,
    venue: r.venue,
    city: r.city,
    attendance: r.attendance && r.attendance > 0 ? r.attendance : null,
    note: r.note,
    periods: agree ? { home, away } : null,
    officials
  }
}

/**
 * The published standings. The NBA's file is in the core tier and holds 1996-97 on. The league
 * dashboards' agrees with it on the record, rank, games back and streak, and only it reaches 1995-96.
 */
export async function readStandings(db: StatsDb, season: number): Promise<StatsStanding[]> {
  const have = await inspect(db)
  for (const t of ['src_nba_standings', 'src_dash_standings']) {
    if (!have.tables.has(t)) continue
    const num = (name: string, type = 'INTEGER'): string => column(have, t, 's', name, type)
    const txt = (name: string): string => text(have, t, 's', name)
    const rows = await db.all<{
      team_id: number
      code: string | null
      name: string
      conference: string | null
      division: string | null
      conference_rank: number | null
      division_rank: number | null
      wins: number
      losses: number
      record: string | null
      win_pct: number | null
      conference_gb: number | null
      division_gb: number | null
      home: string | null
      road: string | null
      conference_record: string | null
      division_record: string | null
      last10: string | null
      streak: string | null
      ppg: number | null
      allowed: number | null
      diff: number | null
    }>(
      `SELECT s.team_id, tm.code,
              coalesce(nullif(trim(concat_ws(' ', ${txt('team_city')}, ${txt('team_name')})), ''), tm.name)
                AS name,
              ${txt('conference')} AS conference, ${txt('division')} AS division,
              ${num('playoff_rank')} AS conference_rank, ${num('division_rank')} AS division_rank,
              ${num('wins')} AS wins, ${num('losses')} AS losses, ${txt('record')} AS record,
              ${num('win_pct', 'DOUBLE')} AS win_pct,
              ${num('conference_games_back', 'DOUBLE')} AS conference_gb,
              ${num('division_games_back', 'DOUBLE')} AS division_gb,
              ${txt('home')} AS home, ${txt('road')} AS road,
              ${txt('conference_record')} AS conference_record,
              ${txt('division_record')} AS division_record,
              ${txt('l10')} AS last10, ${txt('str_current_streak')} AS streak,
              ${num('points_pg', 'DOUBLE')} AS ppg, ${num('opp_points_pg', 'DOUBLE')} AS allowed,
              ${num('diff_points_pg', 'DOUBLE')} AS diff
       FROM ${t} s LEFT JOIN team tm ON tm.team_id = s.team_id AND tm.season = s.season
       WHERE s.season = ?
       ORDER BY conference, conference_rank`,
      [season]
    )
    if (rows.length > 0) {
      // In 2003-04 the file repeats the overall record as both of these, for every team.
      const repeats = (column_: 'conference_record' | 'division_record'): boolean =>
        rows.length > 1 && rows.every((r) => r[column_] === r.record)
      const noConference = repeats('conference_record')
      const noDivision = repeats('division_record')
      return rows.map((r) => ({
        teamId: String(r.team_id),
        code: r.code,
        name: r.name,
        conference: r.conference,
        division: r.division,
        conferenceRank: r.conference_rank,
        divisionRank: r.division_rank,
        wins: r.wins,
        losses: r.losses,
        winPct: r.win_pct,
        conferenceGamesBack: r.conference_gb,
        divisionGamesBack: r.division_gb,
        home: r.home,
        road: r.road,
        conferenceRecord: noConference ? null : r.conference_record,
        divisionRecord: noDivision ? null : r.division_record,
        last10: r.last10,
        streak: r.streak,
        pointsPerGame: r.ppg,
        allowedPerGame: r.allowed,
        differential: r.diff
      }))
    }
  }
  return []
}

/** A whole regular season, which the pair file answers. */
const wholeRegularSeason = (scope: StatsMatchupScope | undefined): boolean =>
  !scope ||
  (scope.gameTypes.length === 1 &&
    scope.gameTypes[0] === 'regular' &&
    scope.dates === undefined &&
    scope.lastN === undefined)

/**
 * A player's matchups in a season, each list longest first: the players they guarded and the players
 * who guarded them. A whole regular season reads the NBA's pair file; any other scope (the playoffs, a
 * date range, the last games) adds up the game matchups over the player's games in it
 * (`readScopedMatchups`). Both start in 2017-18; before it both lists are empty.
 */
export async function readMatchups(
  db: StatsDb,
  id: string,
  season: number,
  scope?: StatsMatchupScope
): Promise<StatsMatchups> {
  if (!wholeRegularSeason(scope)) return readScopedMatchups(db, id, season, scope!)
  const none: StatsMatchups = { guarded: [], guardedBy: [], source: 'season' }
  const have = await inspect(db)
  if (!have.tables.has(MATCHUP_PAIRS) || !/^-?[0-9]{1,12}$/.test(id) || !Number.isInteger(season)) {
    return none
  }
  const key = Number(id)
  const named = have.tables.has('player')
  const rows = await db.all<{
    guarded: boolean
    other: string
    name: string | null
    games: number | null
    minutes: number | null
    partial_poss: number | null
    pts: number | null
    fgm: number | null
    fga: number | null
    fg3m: number | null
    fg3a: number | null
    ftm: number | null
    fta: number | null
    ast: number | null
    tov: number | null
    blk: number | null
  }>(
    `WITH p AS (
       SELECT p.*, p.def_player_id = $1 AS guarded,
              CASE WHEN p.def_player_id = $1 THEN p.off_player_id ELSE p.def_player_id END AS other
       FROM ${MATCHUP_PAIRS} p
       WHERE p.season = $2 AND (p.def_player_id = $1 OR p.off_player_id = $1)
     )
     SELECT p.guarded, p.other::VARCHAR AS other, ${named ? 'pl.name' : 'NULL::VARCHAR'} AS name,
            p.games, p.minutes, p.partial_poss, p.player_pts AS pts, p.matchup_fgm AS fgm,
            p.matchup_fga AS fga, p.matchup_fg3_m AS fg3m, p.matchup_fg3_a AS fg3a,
            p.matchup_ftm AS ftm, p.matchup_fta AS fta, p.matchup_ast AS ast,
            p.matchup_tov AS tov, p.matchup_blk AS blk
     FROM p ${named ? 'LEFT JOIN player pl ON pl.player_id = p.other' : ''}
     ORDER BY p.minutes DESC NULLS LAST, p.other`,
    [key, season]
  )
  const pair = (r: (typeof rows)[number]): StatsMatchupPair => ({
    id: r.other,
    name: r.name ?? `Player ${r.other}`,
    games: r.games,
    minutes: r.minutes,
    partialPoss: r.partial_poss,
    pts: r.pts,
    fgm: r.fgm,
    fga: r.fga,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm: r.ftm,
    fta: r.fta,
    ast: r.ast,
    tov: r.tov,
    blk: r.blk
  })
  return {
    guarded: rows.filter((r) => r.guarded).map(pair),
    guardedBy: rows.filter((r) => !r.guarded).map(pair),
    source: 'season'
  }
}

/** The names of a unit's five players in the NBA's own file: "D. Sabonis - D. Acuff Jr.". */
const sourceNames = (names: string | null): string[] => {
  const parts = names?.split(' - ') ?? []
  return parts.length === 5 ? parts : []
}

/**
 * A team's five-man units for a season and season type, most minutes first, with the measures of one
 * of the NBA's dashboards. Published for whole seasons only, from 2007-08; outside that, or for
 * anything but the regular season and the playoffs, the list is empty. A name comes from the player
 * table, and from the NBA's own file for a player the table does not know.
 */
export async function readLineups(
  db: StatsDb,
  team: string,
  season: number,
  gameType: string,
  group: LineupGroup
): Promise<StatsLineups> {
  const none: StatsLineups = { units: [], floorMinutes: null }
  const have = await inspect(db)
  const held = have.columns.get(LINEUPS)
  if (
    !held ||
    !/^-?[0-9]{1,12}$/.test(team) ||
    !Number.isInteger(season) ||
    !['regular', 'playoffs'].includes(gameType) ||
    !LINEUP_GROUPS.some((g) => g.id === group)
  ) {
    return none
  }
  const ids = [...new Set([...lineupReadIds(group), 'possessions'])].filter((id) => held.has(id))
  const rows = await db.all<Record<string, number | string | null>>(
    `SELECT p1, p2, p3, p4, p5, names, games, minutes${ids.map((id) => `, ${id}`).join('')}
     FROM ${LINEUPS}
     WHERE season = $1 AND game_type = $2 AND team_id = $3
     ORDER BY minutes DESC NULLS LAST, p1, p2, p3, p4, p5`,
    [season, gameType, Number(team)]
  )
  if (rows.length === 0) return none
  const floor = await db.get<{ floor: number | null }>(
    `SELECT min(minutes) AS floor FROM ${LINEUPS}
     WHERE season = $1 AND game_type = $2 AND fgm IS NOT NULL`,
    [season, gameType]
  )
  const slots = ['p1', 'p2', 'p3', 'p4', 'p5']
  const wanted = [...new Set(rows.flatMap((r) => slots.map((s) => String(r[s]))))]
  const known = new Map<string, string>()
  if (have.tables.has('player') && wanted.length) {
    const named = await db.all<{ id: string; name: string | null }>(
      `SELECT player_id::VARCHAR AS id, name FROM player WHERE player_id IN (${wanted.join(', ')})`
    )
    for (const p of named) if (p.name) known.set(p.id, p.name)
  }
  const units = rows.map((r): StatsLineupUnit => {
    const fallback = sourceNames(r.names as string | null)
    return {
      players: slots.map((s, i) => {
        const id = String(r[s])
        return { id, name: known.get(id) ?? fallback[i] ?? `Player ${id}` }
      }),
      games: r.games as number | null,
      minutes: r.minutes as number | null,
      values: Object.fromEntries(ids.map((id) => [id, r[id] as number | null]))
    }
  })
  return { units, floorMinutes: floor?.floor ?? null }
}
