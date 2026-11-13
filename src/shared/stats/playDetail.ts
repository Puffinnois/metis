/**
 * Play-derived statistics (reference section 16, and the technicals, flagrants, ejections and fouls
 * drawn of section 3, and the game flow of section 13): the rules, as data, shared by the builder's
 * SQL (`src/main/stats/derived/playDetail.ts`), the game-flow read and the screens. Each rule is stated
 * here once; the measured spellings and their seasons are in `docs/reference/nba-data-sources.md`,
 * "Play-derived stats".
 *
 * The NBA's play by play is the source (its `sub_type`, kept in `play_nba.subtype`), except fouls
 * drawn: the NBA's feed never names the fouled player, ESPN's does from 2005-06 to 2016-17.
 */

/** The NBA's play by play starts here, 1996-97. */
export const PLAY_DETAIL_FIRST_SEASON = 1997

/** ESPN names the player who drew a foul in these seasons only (`athlete_id_2`, measured). */
export const FOULS_DRAWN_FIRST_SEASON = 2006
export const FOULS_DRAWN_LAST_SEASON = 2017

export interface PlayKind {
  key: string
  label: string
  /** The feed's spellings, every era's, exactly as published (trimmed). */
  subtypes: readonly string[]
}

/**
 * Turnover kinds. Disjoint, so they add up to the turnovers; a spelling not listed falls in `other`
 * and is reported by the check as unmapped. Eras: an offensive foul's turnover is "Foul" to 2016-17
 * and "Offensive Foul Turnover" after (both from 2003-04 to 2016-17, the second on a few dozen a
 * season); a bad pass out of bounds is spelled apart only from 2015-16, so it stays a bad pass, and a
 * ball lost out of bounds stays a lost ball.
 */
export const TURNOVER_KINDS: readonly PlayKind[] = [
  {
    key: 'bad_pass',
    label: 'Bad pass',
    subtypes: ['Bad Pass', 'Out of Bounds - Bad Pass Turnover', 'Stolen Pass Turnover']
  },
  {
    key: 'lost_ball',
    label: 'Lost ball',
    subtypes: ['Lost Ball', 'Out of Bounds Lost Ball Turnover', 'Poss Lost Ball Turnover']
  },
  {
    key: 'off_foul',
    label: 'Offensive foul',
    subtypes: [
      'Foul',
      'Offensive Foul Turnover',
      'Illegal Screen Turnover',
      'Illegal Pick',
      'Swinging Elbows Turnover'
    ]
  },
  { key: 'travel', label: 'Traveling', subtypes: ['Traveling'] },
  { key: 'shot_clock', label: 'Shot clock', subtypes: ['Shot Clock Turnover'] },
  {
    key: 'out_of_bounds',
    label: 'Stepped out of bounds',
    subtypes: [
      'Step Out of Bounds Turnover',
      'Out Of Bounds',
      'Player Out of Bounds Violation Turnover'
    ]
  },
  {
    key: 'violation',
    label: 'Other violation',
    subtypes: [
      '3 Second Violation',
      '5 Second Violation',
      '8 Second Violation',
      '10 Second Violaton',
      'Backcourt Turnover',
      'Offensive Goaltending',
      'Discontinue Dribble',
      'Double Dribble',
      'Palming Turnover',
      'Lane Violation',
      'Kicked Ball Violation',
      'Jump Ball Violation',
      'Inbound Turnover',
      '5 Second Inbound Turnover',
      'Isolation Violation',
      'Illegal Assist Turnover',
      'Basket from Below Turnover',
      'Punched Ball Turnover',
      'Excess Timeout Turnover',
      'Too Many Players Turnover',
      'Opposite Basket Turnover',
      'Double Personal Turnover',
      'Post Up Turnover'
    ]
  },
  { key: 'other', label: 'Other', subtypes: [] }
]

/**
 * Personal-foul kinds: the fouls the box score counts in PF (the play tables' `pf` flag), disjoint, so
 * they add up to it. A spelling not listed falls in `other`. Blocking fouls (2010-11 to 2017-18) go
 * with their kind: on a shooter, shooting; else non-shooting.
 */
export const FOUL_KINDS: readonly PlayKind[] = [
  { key: 'shooting', label: 'Shooting', subtypes: ['Shooting', 'Shooting Block'] },
  {
    key: 'personal',
    label: 'Non-shooting',
    subtypes: [
      'Personal',
      'Personal Block',
      'Double Personal',
      'Away From Play',
      'Inbound',
      'Elbow',
      'Punching'
    ]
  },
  { key: 'offensive', label: 'Offensive', subtypes: ['Offensive', 'Offensive Charge'] },
  { key: 'loose_ball', label: 'Loose ball', subtypes: ['Loose Ball'] },
  { key: 'take', label: 'Take', subtypes: ['Personal Take'] },
  { key: 'transition_take', label: 'Transition take', subtypes: ['Transition Take'] },
  { key: 'clear_path', label: 'Clear path', subtypes: ['Clear Path'] },
  { key: 'flagrant1', label: 'Flagrant 1', subtypes: ['Flagrant Type 1'] },
  { key: 'flagrant2', label: 'Flagrant 2', subtypes: ['Flagrant Type 2'] },
  { key: 'other', label: 'Other', subtypes: [] }
]

/**
 * Technical fouls, which the box score leaves out of PF. Defensive three seconds is a technical too,
 * counted apart. A double technical is one row naming one player: the other is not credited.
 */
export const TECHNICAL_SUBTYPES: readonly string[] = [
  'Technical',
  'Double Technical',
  'Delay Technical',
  'Hanging Technical',
  'Taunting Technical',
  'Non-Unsportsmanlike Technical',
  'Excess Timeout Technical',
  'Too Many Players Technical',
  'Flopping',
  'Bench'
]
export const DEFENSE_THREE_SECONDS = 'Defense 3 Second'

/** ESPN's shooting fouls, blocking fouls on a shooter among them. */
export const ESPN_SHOOTING_FOUL_TYPES: readonly string[] = ['Shooting Foul', 'Shooting Block']

/** ESPN's foul types that name the fouled player as the second athlete (doubles name a second fouler). */
export const ESPN_DRAWN_FOUL_TYPES: readonly string[] = [
  'Shooting Foul',
  // From 2010-11 ESPN spells charges and blocking fouls as types of their own.
  'Shooting Block',
  'Personal Block',
  'Offensive Charge',
  'Personal Foul',
  'Offensive Foul',
  'Loose Ball Foul',
  'Personal Take Foul',
  'Transition Take Foul',
  'Away from Play Foul',
  'Clear Path Foul',
  'Inbound Foul',
  'Flagrant Foul Type 1',
  'Flagrant Foul Type 2',
  'Punching Foul',
  'Elbow Foul'
]

/**
 * An and-one: a made field goal and, at the same period and clock, a "Free Throw 1 of 1" by the same
 * shooter and a shooting foul by the other team. Counted on the free throw, so each is counted once;
 * converted when that free throw went in.
 */
export const AND_ONE_FREE_THROW = 'Free Throw 1 of 1'
export const AND_ONE_FOULS: readonly string[] = ['Shooting', 'Shooting Block']

/** A shooting-foul trip of two or three free throws, counted on its first. */
export const TRIP_FREE_THROWS = { two: 'Free Throw 1 of 2', three: 'Free Throw 1 of 3' } as const

/** The kind a spelling falls in; `other` when no kind lists it. */
export function kindOf(kinds: readonly PlayKind[], subtype: string | null): string {
  const s = subtype?.trim() ?? ''
  return kinds.find((k) => k.subtypes.includes(s))?.key ?? 'other'
}

/** Whether a spelling is listed anywhere, so a check can report the ones that are not. */
export function isMapped(kinds: readonly PlayKind[], subtype: string | null): boolean {
  const s = subtype?.trim() ?? ''
  return kinds.some((k) => k.subtypes.includes(s))
}

// ---------------------------------------------------------------------------------------------------
// Game flow (reference sections 13 and 16)

/** A scoring play, in order: the seconds since the tip-off, the side that scored, and the score after. */
export interface FlowPoint {
  t: number
  home: boolean
  pts: number
  /** A field goal, not a free throw. */
  fg: boolean
  homeScore: number
  awayScore: number
}

export interface FlowSide {
  /** The largest margin this side led by; 0 when it never led. */
  largestLead: number
  /** Seconds with this side ahead. */
  timeLeading: number
  /** The most points it scored with none by the other side between. */
  bestRun: number
  /** The longest stretch, in seconds, without a point; and without a field goal. */
  drought: number
  droughtFg: number
}

export interface FlowSummary {
  leadChanges: number
  timesTied: number
  /** Seconds level, 0-0 at the start included. */
  timeTied: number
  /** The game's length in seconds: 2,880 and 300 an overtime. */
  length: number
  home: FlowSide
  away: FlowSide
}

/**
 * The rules, stated exactly (the builder's SQL applies the same ones, and a test holds them equal):
 * - The score changes only on a scoring play; the state after it holds until the next one, or the end.
 * - A tie is a scoring play that levels the score. 0-0 at the tip is not a tie, though its time
 *   counts as time tied.
 * - A lead change is a scoring play that puts a side ahead when the other side led last, whether or
 *   not a tie came between; the first lead of the game is not a change.
 * - A run is the points one side scores with none by the other between: any point ends it, a free
 *   throw included. It carries over a period break.
 * - A drought is the longest time without a point (or a field goal), from the tip-off, between scores,
 *   and from the last score to the end. Time is the game clock, not the time the clock was stopped.
 */
export function flowSummary(points: readonly FlowPoint[], length: number): FlowSummary {
  let leadChanges = 0
  let timesTied = 0
  let lastLeader = 0
  const lead = { home: 0, away: 0 }
  const time = { home: 0, away: 0, tied: 0 }
  const run = { home: 0, away: 0 }
  const runNow = { side: null as boolean | null, pts: 0 }
  const last = { home: 0, away: 0, homeFg: 0, awayFg: 0 }
  const dry = { home: 0, away: 0, homeFg: 0, awayFg: 0 }
  const first = points.length > 0 ? points[0].t : length
  time.tied += Math.max(0, first)
  points.forEach((p, i) => {
    const m = p.homeScore - p.awayScore
    const s = Math.sign(m)
    if (s === 0) timesTied += 1
    else {
      if (lastLeader !== 0 && s !== lastLeader) leadChanges += 1
      lastLeader = s
    }
    if (m > lead.home) lead.home = m
    if (-m > lead.away) lead.away = -m
    const end = i + 1 < points.length ? points[i + 1].t : length
    const span = Math.max(0, end - p.t)
    if (s > 0) time.home += span
    else if (s < 0) time.away += span
    else time.tied += span
    if (runNow.side === p.home) runNow.pts += p.pts
    else {
      runNow.side = p.home
      runNow.pts = p.pts
    }
    const side = p.home ? 'home' : 'away'
    if (runNow.pts > run[side]) run[side] = runNow.pts
    dry[side] = Math.max(dry[side], p.t - last[side])
    last[side] = p.t
    if (p.fg) {
      const k = p.home ? 'homeFg' : 'awayFg'
      dry[k] = Math.max(dry[k], p.t - last[k])
      last[k] = p.t
    }
  })
  const side = (h: boolean): FlowSide => {
    const k = h ? 'home' : 'away'
    const kf = h ? 'homeFg' : 'awayFg'
    return {
      largestLead: lead[k],
      timeLeading: time[k],
      bestRun: run[k],
      drought: Math.max(dry[k], length - last[k]),
      droughtFg: Math.max(dry[kf], length - last[kf])
    }
  }
  return {
    leadChanges,
    timesTied,
    timeTied: time.tied,
    length,
    home: side(true),
    away: side(false)
  }
}

/** Seconds of a game that reached this period: 12-minute quarters, 5-minute overtimes. */
export const gameLength = (lastPeriod: number): number =>
  lastPeriod <= 4 ? 2880 : 2880 + (lastPeriod - 4) * 300

/** Seconds since the tip-off at this period and clock, as `elapsedSql` in the play tables. */
export const elapsedAt = (period: number, clock: number): number =>
  period <= 4 ? (period - 1) * 720 + 720 - clock : 2880 + (period - 5) * 300 + 300 - clock
