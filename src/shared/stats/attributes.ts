import { LEAGUES, seasonLabel, type LeagueId } from '../leagues'
import type { Entity } from './types'

/**
 * The attribute registry (D51): every fact about who a player or a team is that a board can be
 * filtered on. Attributes are not metrics: they are not summed over games, have no sample and no
 * rank, and are not in the metric catalogue. Each is one column of a built table in the league's file
 * (`src/main/stats/derived/attributes.ts`), or worked out from one when read (age). Coverage is stated
 * per league as the metrics state theirs: the first season whose rows hold values, or why the league
 * has none. The coverage measured per season on a real load is in `docs/reference/stats-database.md`,
 * "Attributes and filters".
 */

export type AttributeType = 'number' | 'text' | 'date' | 'enum' | 'flag'

/** How a number reads: a length in inches, pounds, years, seconds, repetitions, a season, seats. */
export type AttributeUnit =
  'inches' | 'pounds' | 'years' | 'seconds' | 'percent' | 'reps' | 'season' | 'seats' | 'count'

export const ATTRIBUTE_GROUPS = [
  'Personal',
  'Body',
  'Draft',
  'Career',
  'Season',
  'Combine',
  'Team',
  'Arena'
] as const
export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number]

/**
 * Where an attribute is read: the table of who a player is (`player_attributes`, by player), the
 * table of a player's seasons (`player_season_attributes`, by player and the row's season), or the
 * team's (`team_attributes`, by team and the row's season).
 */
export type AttributeTable = 'player' | 'playerSeason' | 'team'

/** Where an attribute has values in one league: from a season (to one, where it stops). */
export interface AttributeCoverage {
  firstSeason: number
  lastSeason?: number
}

/** Why a league has no values for an attribute, in a sentence. */
export interface AttributeGap {
  unavailable: string
}

export interface AttributeDef {
  id: string
  label: string
  /** One sentence, for a person. */
  description: string
  entity: Entity
  type: AttributeType
  unit?: AttributeUnit
  group: AttributeGroup
  table: AttributeTable
  /** The column of its table; for a computed attribute, the column it is worked out from. */
  column: string
  /** Worked out when read: `age`, in whole years at the season's reference day (`AGE_REFERENCE`). */
  computed?: 'age'
  /** An enumeration's values as the table holds them. */
  values?: readonly string[]
  /** What it is read from, in order where more than one source publishes it. */
  sources: string[]
  leagues: Record<LeagueId, AttributeCoverage | AttributeGap>
}

/**
 * The day a season's age is counted on, in the season's final year: January 31 in the NBA and the
 * colleges, July 1 in the WNBA. Basketball-Reference's glossary, the record keeper the app's other
 * conventions are checked against, gives its Age as "player age on January 31 of the given season"
 * (read 2026-11-23): mid-season for the NBA (2025-26: January 31, 2026). Its WNBA pages count a later
 * day, read on five players' pages the same day: Diana Taurasi (born June 11) is 38 in 2020 and Nneka
 * Ogwumike (born July 2) 29, so the day falls from June 11 to July 1; Arike Ogunbowale (March 2, 23
 * in 2020), Breanna Stewart (August 27, 25) and Sabrina Ionescu (December 6, 22) agree. July 1 is
 * taken, inside that window; which day of it is not proven. Sports-Reference's college pages give a
 * class, not an age, so the colleges take the NBA's day, mid-season as theirs is.
 */
export const AGE_REFERENCE: Record<LeagueId, { month: number; day: number }> = {
  nba: { month: 1, day: 31 },
  wnba: { month: 7, day: 1 },
  ncaam: { month: 1, day: 31 },
  ncaaw: { month: 1, day: 31 }
}

/** A season's reference day for age, YYYY-MM-DD, in its final year. */
export function ageReferenceDay(league: LeagueId, season: number): string {
  const r = AGE_REFERENCE[league]
  return `${season}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`
}

const PRO_ONLY = 'The college files hold no draft: it is the professional league’s.'
const NBA_ONLY = 'The draft combine is published for the NBA only.'
const NO_BIO = 'No college file publishes it.'
const COLLEGE_ONLY = 'Published by stats.ncaa.org’s college rosters only.'
const NO_COACH = 'No college file publishes the coaching staff.'
const NO_CITY =
  'ESPN’s location for a college is the school’s name, not a city; the arena’s city is given.'
const NO_EXPERIENCE = 'College rosters give a class, not seasons of experience.'
const NO_DIVISION =
  'Published for the college leagues, whose teams play inside and outside Division I.'

/** Coverage from each league's first loaded season, its own (`League.firstSeason`). */
const every = (): Record<LeagueId, AttributeCoverage> => ({
  nba: { firstSeason: LEAGUES.nba.firstSeason },
  wnba: { firstSeason: LEAGUES.wnba.firstSeason },
  ncaam: { firstSeason: LEAGUES.ncaam.firstSeason },
  ncaaw: { firstSeason: LEAGUES.ncaaw.firstSeason }
})

const pros = (
  nba: number,
  wnba: number,
  college: string,
  extra: Partial<Record<'nba' | 'wnba', Partial<AttributeCoverage>>> = {}
): Record<LeagueId, AttributeCoverage | AttributeGap> => ({
  nba: { firstSeason: nba, ...extra.nba },
  wnba: { firstSeason: wnba, ...extra.wnba },
  ncaam: { unavailable: college },
  ncaaw: { unavailable: college }
})

const colleges = (pro: string): Record<LeagueId, AttributeCoverage | AttributeGap> => ({
  nba: { unavailable: pro },
  wnba: { unavailable: pro },
  ncaam: { firstSeason: LEAGUES.ncaam.firstSeason },
  ncaaw: { firstSeason: LEAGUES.ncaaw.firstSeason }
})

const nbaOnly = (first: number): Record<LeagueId, AttributeCoverage | AttributeGap> => ({
  nba: { firstSeason: first },
  wnba: { unavailable: NBA_ONLY },
  ncaam: { unavailable: NBA_ONLY },
  ncaaw: { unavailable: NBA_ONLY }
})

const player = (
  def: Omit<AttributeDef, 'entity' | 'table'> & { table?: AttributeTable }
): AttributeDef => ({ entity: 'player', table: 'player', ...def })

const season = (def: Omit<AttributeDef, 'entity' | 'table'>): AttributeDef => ({
  entity: 'player',
  table: 'playerSeason',
  ...def
})

const team = (def: Omit<AttributeDef, 'entity' | 'table'>): AttributeDef => ({
  entity: 'team',
  table: 'team',
  ...def
})

const ROSTER = 'The league’s rosters (NBA, WNBA)'
const NCAA_ROSTER = 'stats.ncaa.org’s team rosters (colleges)'
const ESPN_CORE = 'ESPN’s athlete file'
const ESPN_ROSTER = 'ESPN’s rosters'
const BIO = 'The league’s player bio (NBA, WNBA)'
const DRAFT = 'The league’s draft (NBA, WNBA)'
const COMBINE = 'The NBA’s draft combine'

/** A combine measure, from the anthropometric or the athletic testing table. */
const combine = (
  id: string,
  column: string,
  label: string,
  description: string,
  unit: AttributeUnit
): AttributeDef =>
  player({
    id,
    label,
    description,
    type: 'number',
    unit,
    group: 'Combine',
    column,
    sources: [COMBINE],
    leagues: nbaOnly(2001)
  })

export const ATTRIBUTES: readonly AttributeDef[] = [
  // Personal
  player({
    id: 'age',
    label: 'Age',
    description:
      'Age in whole years on the season’s reference day (January 31; July 1 in the WNBA), from the birth date.',
    type: 'number',
    unit: 'years',
    group: 'Personal',
    column: 'birth_date',
    computed: 'age',
    sources: [ROSTER, ESPN_CORE],
    leagues: every()
  }),
  player({
    id: 'birthDate',
    label: 'Birth date',
    description: 'The date of birth, from the league’s roster, else ESPN’s athlete file.',
    type: 'date',
    group: 'Personal',
    column: 'birth_date',
    sources: [ROSTER, ESPN_CORE, ESPN_ROSTER],
    leagues: every()
  }),
  player({
    id: 'birthCity',
    label: 'Birthplace',
    description: 'The city of birth, as ESPN publishes it.',
    type: 'text',
    group: 'Personal',
    column: 'birth_city',
    sources: [ESPN_CORE, ESPN_ROSTER],
    leagues: every()
  }),
  player({
    id: 'birthState',
    label: 'Birth state',
    description: 'The state or province of birth, as ESPN abbreviates it.',
    type: 'text',
    group: 'Personal',
    column: 'birth_state',
    sources: [ESPN_CORE, ESPN_ROSTER],
    leagues: every()
  }),
  player({
    id: 'birthCountry',
    label: 'Birth country',
    description: 'The country of birth, as ESPN names it ("USA", "France").',
    type: 'text',
    group: 'Personal',
    column: 'birth_country',
    sources: [ESPN_CORE, ESPN_ROSTER],
    leagues: every()
  }),
  player({
    id: 'country',
    label: 'Country',
    description:
      'The country the league lists the player under, which can differ from the country of birth.',
    type: 'text',
    group: 'Personal',
    column: 'country',
    sources: [BIO],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, NO_BIO)
  }),
  player({
    id: 'school',
    label: 'School',
    description: 'The last school or club before the league, as the league’s roster gives it.',
    type: 'text',
    group: 'Personal',
    column: 'school',
    sources: [ROSTER, BIO],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, NO_BIO)
  }),
  player({
    id: 'hometown',
    label: 'Hometown',
    description: 'The hometown on the college roster ("Newport, ME").',
    type: 'text',
    group: 'Personal',
    column: 'hometown',
    sources: [NCAA_ROSTER],
    leagues: colleges(COLLEGE_ONLY)
  }),
  player({
    id: 'highSchool',
    label: 'High school',
    description: 'The high school or academy on the college roster.',
    type: 'text',
    group: 'Personal',
    column: 'high_school',
    sources: [NCAA_ROSTER],
    leagues: colleges(COLLEGE_ONLY)
  }),

  // Body
  player({
    id: 'height',
    label: 'Height',
    description: 'Height in inches as last published: the league’s or college roster, else ESPN.',
    type: 'number',
    unit: 'inches',
    group: 'Body',
    column: 'height_in',
    sources: [ROSTER, NCAA_ROSTER, ESPN_CORE, ESPN_ROSTER],
    leagues: every()
  }),
  player({
    id: 'weight',
    label: 'Weight',
    description: 'Weight in pounds as last published: the league’s roster, else ESPN.',
    type: 'number',
    unit: 'pounds',
    group: 'Body',
    column: 'weight_lb',
    sources: [ROSTER, ESPN_CORE, ESPN_ROSTER],
    leagues: every()
  }),
  season({
    id: 'seasonHeight',
    label: 'Height that season',
    description: 'Height in inches as published for the season.',
    type: 'number',
    unit: 'inches',
    group: 'Body',
    column: 'height_in',
    sources: [ROSTER, NCAA_ROSTER, ESPN_ROSTER, ESPN_CORE],
    leagues: every()
  }),
  season({
    id: 'seasonWeight',
    label: 'Weight that season',
    description: 'Weight in pounds as published for the season.',
    type: 'number',
    unit: 'pounds',
    group: 'Body',
    column: 'weight_lb',
    sources: [ROSTER, ESPN_ROSTER, ESPN_CORE],
    leagues: every()
  }),

  // Draft
  player({
    id: 'draftYear',
    label: 'Draft year',
    description: 'The year of the draft that took them, from the league’s draft, else ESPN.',
    type: 'number',
    unit: 'season',
    group: 'Draft',
    column: 'draft_year',
    sources: [DRAFT, ESPN_CORE],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, PRO_ONLY)
  }),
  player({
    id: 'draftRound',
    label: 'Draft round',
    description: 'The round they were drafted in.',
    type: 'number',
    group: 'Draft',
    column: 'draft_round',
    sources: [DRAFT, ESPN_CORE],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, PRO_ONLY)
  }),
  player({
    id: 'draftPick',
    label: 'Overall pick',
    description: 'The pick they were drafted with, counted over the whole draft.',
    type: 'number',
    group: 'Draft',
    column: 'draft_overall_pick',
    sources: [DRAFT, ESPN_CORE],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, PRO_ONLY)
  }),
  player({
    id: 'draftRoundPick',
    label: 'Pick in round',
    description: 'The pick they were drafted with, counted within the round.',
    type: 'number',
    group: 'Draft',
    column: 'draft_round_pick',
    sources: [DRAFT],
    leagues: pros(1997, 1997, PRO_ONLY)
  }),
  player({
    id: 'draftTeam',
    label: 'Drafted by',
    description: 'The code of the team that drafted them, as the draft lists it.',
    type: 'text',
    group: 'Draft',
    column: 'draft_team_code',
    sources: [DRAFT],
    leagues: pros(1997, 1997, PRO_ONLY)
  }),
  player({
    id: 'draftFrom',
    label: 'Drafted from',
    description: 'The college, school or club they were drafted from.',
    type: 'text',
    group: 'Draft',
    column: 'draft_organization',
    sources: [DRAFT],
    leagues: pros(1997, 1997, PRO_ONLY)
  }),
  player({
    id: 'draftFromType',
    label: 'Drafted from (kind)',
    description: 'What kind of place they were drafted from: a college, a high school or a club.',
    type: 'enum',
    group: 'Draft',
    column: 'draft_organization_type',
    values: ['College/University', 'High School', 'Other Team/Club'],
    sources: [DRAFT],
    leagues: pros(1997, 1997, PRO_ONLY)
  }),
  player({
    id: 'undrafted',
    label: 'Undrafted',
    description:
      'Not taken in a draft: the league’s bio says so, or no draft lists them though they entered after its files begin.',
    type: 'flag',
    group: 'Draft',
    column: 'undrafted',
    sources: [DRAFT, BIO, ESPN_CORE],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, PRO_ONLY)
  }),

  // Career
  player({
    id: 'firstSeason',
    label: 'First season',
    description: 'The first season they played in the loaded data.',
    type: 'number',
    unit: 'season',
    group: 'Career',
    column: 'first_season',
    sources: ['The box scores'],
    leagues: every()
  }),
  player({
    id: 'lastSeason',
    label: 'Last season',
    description: 'The last season they played in the loaded data.',
    type: 'number',
    unit: 'season',
    group: 'Career',
    column: 'last_season',
    sources: ['The box scores'],
    leagues: every()
  }),
  player({
    id: 'seasonsPlayed',
    label: 'Seasons played',
    description: 'How many seasons they played a counted game in, in the loaded data.',
    type: 'number',
    unit: 'count',
    group: 'Career',
    column: 'seasons_played',
    sources: ['The box scores'],
    leagues: every()
  }),
  season({
    id: 'seasonNumber',
    label: 'Season number',
    description:
      'Which of their seasons this is, 1 for the first; unknown for a player already playing in the league’s first loaded season.',
    type: 'number',
    unit: 'count',
    group: 'Career',
    column: 'season_number',
    sources: ['The box scores'],
    leagues: {
      nba: { firstSeason: LEAGUES.nba.firstSeason + 1 },
      wnba: { firstSeason: LEAGUES.wnba.firstSeason + 1 },
      ncaam: { firstSeason: LEAGUES.ncaam.firstSeason + 1 },
      ncaaw: { firstSeason: LEAGUES.ncaaw.firstSeason + 1 }
    }
  }),
  season({
    id: 'experience',
    label: 'Experience',
    description:
      'Seasons of experience before this one as the league’s roster gives it: 0 for a rookie.',
    type: 'number',
    unit: 'years',
    group: 'Career',
    column: 'experience',
    sources: [ROSTER],
    leagues: pros(1997, LEAGUES.wnba.firstSeason, NO_EXPERIENCE)
  }),

  // Season
  season({
    id: 'team',
    label: 'Team',
    description: 'The code of their last team that season.',
    type: 'text',
    group: 'Season',
    column: 'team_code',
    sources: ['The box scores', ROSTER],
    leagues: every()
  }),
  season({
    id: 'jersey',
    label: 'Jersey',
    description: 'The jersey number that season, as published ("0" and "00" differ).',
    type: 'text',
    group: 'Season',
    column: 'jersey',
    sources: [ROSTER, NCAA_ROSTER, ESPN_ROSTER, ESPN_CORE],
    leagues: every()
  }),
  season({
    id: 'listedPosition',
    label: 'Listed position',
    description: 'The position the roster lists that season ("G", "F-C"), as published.',
    type: 'text',
    group: 'Season',
    column: 'position',
    sources: [ROSTER, NCAA_ROSTER, ESPN_ROSTER, ESPN_CORE],
    leagues: every()
  }),
  season({
    id: 'class',
    label: 'Class',
    description: 'The college class that season: freshman, sophomore, junior or senior.',
    type: 'enum',
    group: 'Season',
    column: 'class',
    values: ['Fr.', 'So.', 'Jr.', 'Sr.'],
    sources: [NCAA_ROSTER, ESPN_ROSTER],
    leagues: colleges('A college player’s class; the professional leagues have none.')
  }),
  season({
    id: 'howAcquired',
    label: 'How acquired',
    description: 'How the team came to have them, as the roster words it ("Signed on 07/26/26").',
    type: 'text',
    group: 'Season',
    column: 'how_acquired',
    sources: [ROSTER],
    leagues: pros(2013, 2009, NO_BIO)
  }),

  // Combine
  player({
    id: 'combineYear',
    label: 'Combine year',
    description: 'The year of the last draft combine they attended.',
    type: 'number',
    unit: 'season',
    group: 'Combine',
    column: 'combine_year',
    sources: [COMBINE],
    leagues: nbaOnly(2001)
  }),
  player({
    id: 'combinePosition',
    label: 'Combine position',
    description: 'The position listed at that combine ("PG-SG").',
    type: 'text',
    group: 'Combine',
    column: 'combine_position',
    sources: [COMBINE],
    leagues: nbaOnly(2001)
  }),
  combine(
    'heightNoShoes',
    'combine_height_wo_shoes',
    'Height without shoes',
    'Measured at the combine, in inches.',
    'inches'
  ),
  combine(
    'heightShoes',
    'combine_height_w_shoes',
    'Height with shoes',
    'Measured at the combine, in inches.',
    'inches'
  ),
  combine(
    'combineWeight',
    'combine_weight_lb',
    'Combine weight',
    'Weighed at the combine, in pounds.',
    'pounds'
  ),
  combine(
    'wingspan',
    'combine_wingspan',
    'Wingspan',
    'Fingertip to fingertip, arms spread, in inches.',
    'inches'
  ),
  combine(
    'standingReach',
    'combine_standing_reach',
    'Standing reach',
    'Reach standing flat-footed, in inches.',
    'inches'
  ),
  combine(
    'bodyFat',
    'combine_body_fat_pct',
    'Body fat',
    'Body fat as a percentage of weight.',
    'percent'
  ),
  combine(
    'handLength',
    'combine_hand_length',
    'Hand length',
    'Palm to fingertip, in inches.',
    'inches'
  ),
  combine(
    'handWidth',
    'combine_hand_width',
    'Hand width',
    'Thumb to little finger spread, in inches.',
    'inches'
  ),
  combine(
    'standingVertical',
    'combine_standing_vertical_leap',
    'Standing vertical',
    'A jump from standing, in inches.',
    'inches'
  ),
  combine(
    'maxVertical',
    'combine_max_vertical_leap',
    'Max vertical',
    'A jump with a running start, in inches.',
    'inches'
  ),
  combine(
    'laneAgility',
    'combine_lane_agility_time',
    'Lane agility',
    'The lane agility drill, in seconds.',
    'seconds'
  ),
  combine(
    'shuttleRun',
    'combine_modified_lane_agility_time',
    'Shuttle run',
    'The modified lane agility drill, in seconds.',
    'seconds'
  ),
  combine(
    'sprint',
    'combine_three_quarter_sprint',
    'Three-quarter sprint',
    'A sprint of three quarters of the court, in seconds.',
    'seconds'
  ),
  combine('benchPress', 'combine_bench_press', 'Bench press', 'Repetitions of 185 pounds.', 'reps'),

  // Teams
  team({
    id: 'conference',
    label: 'Conference',
    description: 'The team’s conference that season.',
    type: 'text',
    group: 'Team',
    column: 'conference',
    sources: ['The league’s team groups'],
    leagues: every()
  }),
  team({
    id: 'division',
    label: 'Division',
    description: 'The team’s division that season, where the league has divisions.',
    type: 'text',
    group: 'Team',
    column: 'division',
    sources: ['The league’s team groups'],
    leagues: {
      nba: { firstSeason: LEAGUES.nba.firstSeason },
      wnba: { unavailable: 'The WNBA plays in conferences, without divisions.' },
      // A few conferences still had divisions in 2021-22 (11 % of the men's teams, 7 % of the women's).
      ncaam: { firstSeason: 2022, lastSeason: 2022 },
      ncaaw: { firstSeason: 2022, lastSeason: 2022 }
    }
  }),
  team({
    id: 'city',
    label: 'City',
    description: 'The team’s city, as the league names it.',
    type: 'text',
    group: 'Team',
    column: 'city',
    sources: ['The league’s team crosswalk', 'ESPN’s schedule'],
    leagues: pros(LEAGUES.nba.firstSeason, LEAGUES.wnba.firstSeason, NO_CITY)
  }),
  team({
    id: 'headCoach',
    label: 'Head coach',
    description: 'The head coach that season; several are joined by " / ".',
    type: 'text',
    group: 'Team',
    column: 'head_coach',
    sources: ['The league’s coaches'],
    leagues: pros(1997, LEAGUES.wnba.firstSeason, NO_COACH)
  }),
  team({
    id: 'teamFirstSeason',
    label: 'First season',
    description: 'The team’s first season in the loaded data.',
    type: 'number',
    unit: 'season',
    group: 'Team',
    column: 'first_season',
    sources: ['The league’s teams'],
    leagues: every()
  }),
  team({
    id: 'divisionI',
    label: 'Division I',
    description: 'The team is in Division I that season.',
    type: 'flag',
    group: 'Team',
    column: 'division_i',
    sources: ['The groups file'],
    leagues: colleges(NO_DIVISION)
  }),
  team({
    id: 'arena',
    label: 'Arena',
    description:
      'Where the team played most of its home games that season, as ESPN’s schedule names it.',
    type: 'text',
    group: 'Arena',
    column: 'arena',
    sources: ['ESPN’s schedule'],
    leagues: every()
  }),
  team({
    id: 'arenaCity',
    label: 'Arena city',
    description: 'The city of that arena.',
    type: 'text',
    group: 'Arena',
    column: 'arena_city',
    sources: ['ESPN’s schedule'],
    leagues: every()
  }),
  team({
    id: 'arenaState',
    label: 'Arena state',
    description: 'The state or province of that arena.',
    type: 'text',
    group: 'Arena',
    column: 'arena_state',
    sources: ['ESPN’s schedule'],
    leagues: every()
  }),
  team({
    id: 'arenaCapacity',
    label: 'Arena capacity',
    description: 'The seats of that arena, where ESPN’s schedule gives them.',
    type: 'number',
    unit: 'seats',
    group: 'Arena',
    column: 'arena_capacity',
    sources: ['ESPN’s schedule'],
    leagues: {
      nba: { firstSeason: 2002, lastSeason: 2019 },
      wnba: { firstSeason: 2002, lastSeason: 2023 },
      ncaam: { firstSeason: 2022, lastSeason: 2023 },
      ncaaw: { firstSeason: 2022, lastSeason: 2023 }
    }
  })
]

export const ATTRIBUTE_BY_ID: ReadonlyMap<string, AttributeDef> = new Map(
  ATTRIBUTES.map((a) => [a.id, a])
)

/** An attribute's coverage in a league: its seasons, or why it has none. */
export function attributeCoverage(
  a: AttributeDef,
  league: LeagueId
): AttributeCoverage | AttributeGap {
  return a.leagues[league]
}

/**
 * Why an attribute has no value for any of these seasons in a league, or null when some season has
 * one: "Published from 1996-97." or the league's reason.
 */
export function attributeGap(a: AttributeDef, league: LeagueId, seasons: number[]): string | null {
  const c = a.leagues[league]
  if ('unavailable' in c) return c.unavailable
  const l = LEAGUES[league]
  if (
    seasons.some((s) => s >= c.firstSeason && (c.lastSeason === undefined || s <= c.lastSeason))
  ) {
    return null
  }
  return c.lastSeason === undefined
    ? `${a.label}: published from ${seasonLabel(l, c.firstSeason)}.`
    : `${a.label}: published from ${seasonLabel(l, c.firstSeason)} to ${seasonLabel(l, c.lastSeason)}.`
}
