import type { StatsDb } from '@main/stats/db'

/**
 * One game in both play-by-play feeds, in each feed's own shape: Houston at Oklahoma City, opening
 * night of 2025-26, cut to the plays that exercise each counting rule. The rows follow the real
 * files (`src_nba_pbp`, `src_espn_pbp`); the descriptions are the feeds' own wording, shortened.
 */
export const OKC = 1610612760
export const HOU = 1610612745
export const GAME = '0022500001'
export const ESPN_GAME = 401809234

export const HOLMGREN = 1631096
export const DORT = 1629652
export const WALLACE = 1641717
export const SENGUN = 1630578
export const SMITH = 1631095
export const DURANT = 201142
export const THOMPSON = 1641708

/** ESPN's athlete ids are its own; `player_ids` maps them. */
const ESPN_ATHLETES: Record<number, number> = {
  [HOLMGREN]: 4433255,
  [DORT]: 4397020,
  [WALLACE]: 4683678,
  [SENGUN]: 4871144,
  [SMITH]: 4432166,
  [DURANT]: 3202,
  [THOMPSON]: 4683682
}
export const espnId = (player: number): number => ESPN_ATHLETES[player]

const NAMES: Record<number, [string, string, string]> = {
  // player_name, player_name_i, the full name in `player`.
  [HOLMGREN]: ['Holmgren', 'C. Holmgren', 'Chet Holmgren'],
  [DORT]: ['Dort', 'L. Dort', 'Luguentz Dort'],
  [WALLACE]: ['Wallace', 'C. Wallace', 'Cason Wallace'],
  [SENGUN]: ['Sengun', 'A. Sengun', 'Alperen Sengun'],
  // The feed's name now carries a suffix the old descriptions leave out.
  [SMITH]: ['Smith Jr.', 'J. Smith Jr.', 'Jabari Smith Jr.'],
  [DURANT]: ['Durant', 'K. Durant', 'Kevin Durant'],
  // An accent the descriptions leave out.
  [THOMPSON]: ['Thómpson', 'A. Thómpson', 'Amen Thómpson']
}

/** The identity tables the plays are keyed to, as the derived layer builds them. */
export async function createIdentity(db: StatsDb, swapEspnSides = false): Promise<void> {
  await db.exec(`CREATE TABLE game (game_id VARCHAR, nba_game_id VARCHAR, espn_game_id BIGINT,
    season INTEGER, game_type VARCHAR, game_date DATE, home_team_id BIGINT, away_team_id BIGINT,
    home_score BIGINT, away_score BIGINT, played BOOLEAN, source VARCHAR)`)
  // In some games ESPN's home side is the game table's away side.
  const [home, away, hs, as] = swapEspnSides ? [HOU, OKC, 6, 3] : [OKC, HOU, 3, 6]
  await db.exec(`INSERT INTO game VALUES ('${GAME}', '${GAME}', ${ESPN_GAME}, 2026, 'regular',
    DATE '2025-10-21', ${home}, ${away}, ${hs}, ${as}, true, 'nba')`)
  await db.exec(`CREATE TABLE team (season INTEGER, team_id BIGINT, espn_team_id INTEGER,
    code VARCHAR, name VARCHAR, conference VARCHAR, division VARCHAR)`)
  await db.exec(`INSERT INTO team VALUES (2026, ${OKC}, 25, 'OKC', 'Thunder', 'West', 'Northwest'),
    (2026, ${HOU}, 10, 'HOU', 'Rockets', 'West', 'Southwest')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR, espn_athlete_id BIGINT,
    method VARCHAR, first_season INTEGER, last_season INTEGER)`)
  await db.exec(
    `CREATE TABLE player_ids (espn_athlete_id BIGINT, player_id BIGINT, method VARCHAR)`
  )
  for (const [id, [, , full]] of Object.entries(NAMES)) {
    await db.exec(
      `INSERT INTO player VALUES (${id}, '${full}', ${espnId(Number(id))}, 'nba', 2020, 2026)`
    )
    await db.exec(`INSERT INTO player_ids VALUES (${espnId(Number(id))}, ${id}, 'crosswalk')`)
  }
}

interface NbaRow {
  action: number
  team: number
  person: number
  type: string
  sub?: string
  text: string
  value?: number
  home?: number
  away?: number
}

const ON_COURT: Record<number, number[]> = {
  [OKC]: [HOLMGREN, DORT, WALLACE, 1628983, 1628392],
  [HOU]: [SENGUN, SMITH, DURANT, THOMPSON, 203500]
}

/**
 * The NBA's feed. Steals and blocks are their own rows, with the action number of the turnover or
 * the miss; team rows have `team_id` 0 and the team's id as the person; rebounds carry the player's
 * running counts, two of Wallace's out of order and two of Smith's written with the same counts.
 */
const NBA_ROWS: NbaRow[] = [
  { action: 2, team: 0, person: 0, type: 'period', sub: 'start', text: 'Start of 1st Period' },
  {
    action: 4,
    team: OKC,
    person: HOLMGREN,
    type: 'Jump Ball',
    text: 'Jump Ball Holmgren vs. Adams: Tip to Dort'
  },
  {
    action: 8,
    team: HOU,
    person: SENGUN,
    type: 'Missed Shot',
    sub: 'Jump Shot',
    text: "MISS Sengun 25' 3PT Jump Shot",
    value: 3
  },
  {
    action: 9,
    team: OKC,
    person: WALLACE,
    type: 'Rebound',
    sub: 'Unknown',
    text: 'Wallace REBOUND (Off:0 Def:1)'
  },
  {
    action: 10,
    team: OKC,
    person: HOLMGREN,
    type: 'Made Shot',
    sub: 'Cutting Layup Shot',
    text: "Holmgren 1' Cutting Layup Shot (2 PTS) (Dort 1 AST)",
    value: 2,
    home: 2,
    away: 0
  },
  {
    action: 12,
    team: HOU,
    person: SMITH,
    type: 'Foul',
    sub: 'Shooting',
    text: 'Smith Jr. S.FOUL (P1.T1) (E.Dalen)'
  },
  {
    action: 14,
    team: OKC,
    person: HOLMGREN,
    type: 'Free Throw',
    sub: 'Free Throw 1 of 1',
    text: 'Holmgren Free Throw 1 of 1 (3 PTS)',
    home: 3,
    away: 0
  },
  {
    action: 15,
    team: HOU,
    person: THOMPSON,
    type: 'Missed Shot',
    sub: 'Jump Shot',
    text: 'MISS Thompson 3PT Jump Shot',
    value: 3
  },
  { action: 16, team: 0, person: HOU, type: 'Rebound', sub: 'Unknown', text: 'Rockets Rebound' },
  {
    action: 17,
    team: 0,
    person: HOU,
    type: 'Turnover',
    sub: 'Shot Clock Turnover',
    text: 'Rockets Turnover: Shot Clock (T#1)'
  },
  {
    action: 25,
    team: OKC,
    person: DORT,
    type: 'Turnover',
    sub: 'Bad Pass',
    text: 'Dort Bad Pass Turnover (P1.T1)'
  },
  { action: 25, team: HOU, person: SENGUN, type: '', text: 'Sengun STEAL (1 STL)' },
  {
    action: 30,
    team: OKC,
    person: DORT,
    type: 'Missed Shot',
    sub: 'Driving Layup Shot',
    text: "MISS Dort 2' Driving Layup",
    value: 2
  },
  { action: 30, team: HOU, person: SENGUN, type: '', text: 'Sengun BLOCK (1 BLK)' },
  {
    action: 31,
    team: HOU,
    person: SENGUN,
    type: 'Rebound',
    sub: 'Unknown',
    text: 'Sengun REBOUND (Off:0 Def:1)'
  },
  {
    action: 33,
    team: HOU,
    person: SMITH,
    type: 'Foul',
    sub: 'Technical',
    text: 'Smith Jr. T.FOUL (P0.T2)'
  },
  {
    action: 35,
    team: HOU,
    person: DURANT,
    type: 'Free Throw',
    sub: 'Free Throw 1 of 2',
    text: 'MISS Durant Free Throw 1 of 2'
  },
  {
    action: 36,
    team: HOU,
    person: DURANT,
    type: 'Free Throw',
    sub: 'Free Throw 2 of 2',
    text: 'Durant Free Throw 2 of 2 (1 PTS)',
    home: 3,
    away: 1
  },
  {
    action: 40,
    team: HOU,
    person: SMITH,
    type: 'Rebound',
    sub: 'Unknown',
    text: 'Smith Jr. REBOUND (Off:2 Def:0)'
  },
  {
    action: 41,
    team: HOU,
    person: SMITH,
    type: 'Rebound',
    sub: 'Unknown',
    text: 'Smith Jr. REBOUND (Off:2 Def:0)'
  },
  {
    action: 42,
    team: HOU,
    person: DURANT,
    type: 'Made Shot',
    sub: 'Dunk Shot',
    text: "Durant 1' Dunk (2 PTS) (Smith 1 AST)",
    value: 2,
    home: 3,
    away: 3
  },
  {
    action: 44,
    team: OKC,
    person: WALLACE,
    type: 'Rebound',
    sub: 'Unknown',
    text: 'Wallace REBOUND (Off:2 Def:1)'
  },
  {
    action: 45,
    team: OKC,
    person: WALLACE,
    type: 'Rebound',
    sub: 'Unknown',
    text: 'Wallace REBOUND (Off:1 Def:1)'
  },
  {
    action: 47,
    team: HOU,
    person: DURANT,
    type: 'Made Shot',
    sub: 'Jump Shot',
    text: "Durant 26' 3PT Jump Shot (4 PTS) (Thompson 1 AST)",
    value: 3,
    home: 3,
    away: 6
  },
  {
    action: 49,
    team: HOU,
    person: SENGUN,
    type: 'Heave',
    sub: 'Heave',
    text: "MISS Sengun 60' Heave",
    value: 3
  },
  { action: 50, team: 0, person: 0, type: 'period', sub: 'end', text: 'End of 1st Period' }
]

const sql = (s: string): string => `'${s.replaceAll("'", "''")}'`

export async function createNbaPbp(db: StatsDb, drop: string[] = []): Promise<void> {
  const columns: [string, string, (r: NbaRow, i: number) => string][] = [
    ['game_id', 'VARCHAR', () => sql(GAME)],
    ['order_index', 'BIGINT', (_, i) => String(i)],
    ['action_number', 'BIGINT', (r) => String(r.action)],
    ['period', 'BIGINT', () => '1'],
    [
      'clock',
      'VARCHAR',
      (_, i) => sql(`PT${String(11 - Math.floor(i / 3)).padStart(2, '0')}M00.00S`)
    ],
    ['seconds_remaining', 'DOUBLE', (_, i) => String((11 - Math.floor(i / 3)) * 60)],
    ['team_id', 'BIGINT', (r) => String(r.team)],
    ['person_id', 'BIGINT', (r) => String(r.person)],
    ['player_name', 'VARCHAR', (r) => sql(r.team > 0 ? (NAMES[r.person]?.[0] ?? '') : '')],
    ['player_name_i', 'VARCHAR', (r) => sql(r.team > 0 ? (NAMES[r.person]?.[1] ?? '') : '')],
    [
      'location',
      'VARCHAR',
      (r) =>
        sql(
          r.team === OKC || r.person === OKC ? 'h' : r.team === HOU || r.person === HOU ? 'v' : ''
        )
    ],
    ['action_type', 'VARCHAR', (r) => sql(r.type)],
    ['sub_type', 'VARCHAR', (r) => sql(r.sub ?? '')],
    ['description', 'VARCHAR', (r) => sql(r.text)],
    ['shot_value', 'BIGINT', (r) => String(r.value ?? 0)],
    ['score_home', 'VARCHAR', (r) => sql(r.home === undefined ? '' : String(r.home))],
    ['score_away', 'VARCHAR', (r) => sql(r.away === undefined ? '' : String(r.away))],
    ['possession_number', 'BIGINT', (_, i) => String(1 + Math.floor(i / 4))],
    ...[0, 1, 2, 3, 4].map(
      (k) =>
        [
          `off_player_${k + 1}`,
          'BIGINT',
          (r: NbaRow) => String(ON_COURT[r.team]?.[k] ?? 'NULL')
        ] as [string, string, (r: NbaRow, i: number) => string]
    ),
    ['season', 'INTEGER', () => '2026'],
    ['file_season', 'INTEGER', () => '2026']
  ]
  const kept = columns.filter(([name]) => !drop.includes(name))
  await db.exec(`CREATE TABLE src_nba_pbp (${kept.map(([n, t]) => `${n} ${t}`).join(', ')})`)
  await db.exec(
    `INSERT INTO src_nba_pbp VALUES ${NBA_ROWS.map(
      (r, i) => `(${kept.map(([, , v]) => v(r, i)).join(', ')})`
    ).join(',\n')}`
  )
}

interface EspnRow {
  type: string
  text: string
  team: number | null
  a1?: number
  a2?: number
  shooting?: boolean
  scoring?: boolean
  value?: number
  attempted?: number
  x?: number
  y?: number
  home: number
  away: number
}

/**
 * ESPN's feed. The second athlete is the assist, the blocker or the stealer. `points_attempted` is
 * empty, as before 2023-24, so threes come from the description, a make's value or the coordinates;
 * the made free throw has a `score_value` of 0, as from 2012-13 into 2019-20.
 */
const ESPN_ROWS: EspnRow[] = [
  {
    type: 'Jump Ball',
    text: 'Chet Holmgren vs. Steven Adams (Luguentz Dort gains possession)',
    team: OKC,
    a1: HOLMGREN,
    home: 0,
    away: 0
  },
  {
    type: 'Jump Shot',
    text: 'Alperen Sengun misses 25-foot three point jumper',
    team: HOU,
    a1: SENGUN,
    shooting: true,
    value: 0,
    x: 45,
    y: 15,
    home: 0,
    away: 0
  },
  {
    type: 'Defensive Rebound',
    text: 'Cason Wallace defensive rebound',
    team: OKC,
    a1: WALLACE,
    home: 0,
    away: 0
  },
  {
    type: 'Layup Shot',
    text: 'Chet Holmgren makes 1-foot layup (Luguentz Dort assists)',
    team: OKC,
    a1: HOLMGREN,
    a2: DORT,
    shooting: true,
    scoring: true,
    value: 2,
    x: 25,
    y: 1,
    home: 2,
    away: 0
  },
  {
    type: 'Shooting Foul',
    text: 'Jabari Smith Jr. shooting foul',
    team: HOU,
    a1: SMITH,
    a2: HOLMGREN,
    home: 2,
    away: 0
  },
  {
    type: 'Free Throw - 1 of 1',
    text: 'Chet Holmgren makes free throw 1 of 1',
    team: OKC,
    a1: HOLMGREN,
    shooting: true,
    scoring: true,
    value: 0,
    home: 3,
    away: 0
  },
  {
    type: 'Jump Shot',
    text: 'Amen Thompson misses jumper',
    team: HOU,
    a1: THOMPSON,
    shooting: true,
    value: 0,
    x: 2,
    y: 3,
    home: 3,
    away: 0
  },
  {
    type: 'Offensive Rebound',
    text: 'Rockets offensive team rebound',
    team: HOU,
    home: 3,
    away: 0
  },
  {
    type: 'Bad Pass\nTurnover',
    text: 'Luguentz Dort bad pass\nturnover (Alperen Sengun steals)',
    team: OKC,
    a1: DORT,
    a2: SENGUN,
    home: 3,
    away: 0
  },
  {
    type: 'Driving Layup Shot',
    text: "Alperen Sengun blocks Luguentz Dort 's 2-foot driving layup",
    team: OKC,
    a1: DORT,
    a2: SENGUN,
    shooting: true,
    value: 0,
    x: 25,
    y: 2,
    home: 3,
    away: 0
  },
  {
    type: 'Technical Foul',
    text: 'Jabari Smith Jr. technical foul',
    team: HOU,
    a1: SMITH,
    home: 3,
    away: 0
  },
  {
    type: 'Heave Jump Shot',
    text: 'Kevin Durant misses 60-foot heave',
    team: HOU,
    a1: DURANT,
    shooting: true,
    value: 0,
    x: 25,
    y: 60,
    home: 3,
    away: 0
  },
  { type: 'Traveling', text: 'Kevin Durant traveling', team: HOU, a1: DURANT, home: 3, away: 0 },
  {
    type: 'Jump Shot',
    text: 'Kevin Durant makes 26-foot three point jumper (Amen Thompson assists)',
    team: HOU,
    a1: DURANT,
    a2: THOMPSON,
    shooting: true,
    scoring: true,
    value: 3,
    x: 25,
    y: 26,
    home: 3,
    away: 3
  },
  { type: 'End Period', text: 'End of the 1st Quarter', team: null, home: 3, away: 3 }
]

const ESPN_TEAM: Record<number, number> = { [OKC]: 25, [HOU]: 10 }

export async function createEspnPbp(db: StatsDb, drop: string[] = []): Promise<void> {
  const n = (v: number | undefined | null): string =>
    v === undefined || v === null ? 'NULL' : String(v)
  const columns: [string, string, (r: EspnRow, i: number) => string][] = [
    ['id', 'BIGINT', (_, i) => String(4018092340000 + i)],
    ['game_play_number', 'INTEGER', (_, i) => String(i + 1)],
    ['type_id', 'INTEGER', () => '0'],
    ['type_text', 'VARCHAR', (r) => sql(r.type)],
    ['text', 'VARCHAR', (r) => sql(r.text)],
    ['away_score', 'INTEGER', (r) => String(r.away)],
    ['home_score', 'INTEGER', (r) => String(r.home)],
    ['period_number', 'INTEGER', () => '1'],
    ['clock_minutes', 'INTEGER', (_, i) => String(11 - Math.floor(i / 3))],
    ['clock_seconds', 'DOUBLE', () => '0'],
    ['scoring_play', 'BOOLEAN', (r) => String(r.scoring ?? false)],
    ['score_value', 'INTEGER', (r) => n(r.value ?? 0)],
    ['team_id', 'INTEGER', (r) => n(r.team === null ? null : ESPN_TEAM[r.team])],
    ['athlete_id_1', 'INTEGER', (r) => n(r.a1 && espnId(r.a1))],
    ['athlete_id_2', 'INTEGER', (r) => n(r.a2 && espnId(r.a2))],
    ['shooting_play', 'BOOLEAN', (r) => String(r.shooting ?? false)],
    ['coordinate_x_raw', 'DOUBLE', (r) => n(r.x)],
    ['coordinate_y_raw', 'DOUBLE', (r) => n(r.y)],
    ['points_attempted', 'INTEGER', (r) => n(r.attempted)],
    ['game_id', 'INTEGER', () => String(ESPN_GAME)],
    ['season', 'INTEGER', () => '2026'],
    ['season_type', 'INTEGER', () => '2'],
    ['home_team_id', 'INTEGER', () => '25'],
    ['away_team_id', 'INTEGER', () => '10'],
    ['file_season', 'INTEGER', () => '2026']
  ]
  const kept = columns.filter(([name]) => !drop.includes(name))
  await db.exec(`CREATE TABLE src_espn_pbp (${kept.map(([n2, t]) => `${n2} ${t}`).join(', ')})`)
  await db.exec(
    `INSERT INTO src_espn_pbp VALUES ${ESPN_ROWS.map(
      (r, i) => `(${kept.map(([, , v]) => v(r, i)).join(', ')})`
    ).join(',\n')}`
  )
}
