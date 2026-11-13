/**
 * Shot zones, distance bands and shot types (reference section 7), defined once: the builder writes
 * them into SQL (`src/main/stats/derived/shots.ts`), the shot chart draws them, and the tests check
 * both on the boundary points.
 *
 * Everything here is in the NBA's legacy shot-chart frame, the one `shot_nba` keeps: tenths of a
 * foot, the basket's centre at (0, 0), `y` growing away from the baseline towards half court. The
 * published distance is that point's distance from the basket rounded to the foot, on every shot
 * from 1996-97 (measured). The NBA's file has no zone column, so zones come from the coordinates and
 * the published shot value; ESPN's shots are another frame and are never classified here.
 */

/** The court in the NBA's frame, as the NBA's own shot charts draw it. */
export const COURT = {
  /** Half the court's width: 50 feet. */
  halfWidth: 250,
  baselineY: -47.5,
  /** The half-court line, 47 feet from the baseline. */
  halfCourtY: 422.5,
  rimRadius: 7.5,
  backboardY: -7.5,
  backboardHalfWidth: 30,
  /** The lane: 16 feet wide, to the free-throw line 19 feet from the baseline. */
  laneHalfWidth: 80,
  laneTopY: 142.5,
  freeThrowRadius: 60,
  /** The restricted-area arc: 4 feet from the basket. */
  restrictedRadius: 40,
  /** The three-point line: 22 feet in the corners, an arc of 23 feet 9 inches above them. */
  cornerX: 220,
  /** Where the corner zone ends, 14 feet from the baseline. */
  cornerTopY: 92.5,
  arcRadius: 237.5
} as const

/**
 * A coordinate off any court: the 2001-02 file has a few points thousands of tenths away. Such a shot
 * keeps its attempt, in a zone of its own, so the zones still add up to the attempts.
 */
export const OFF_COURT = { maxAbsX: 500, minY: -100, maxY: 940 } as const

export const SHOT_ZONES = [
  { key: 'ra', label: 'Restricted area', short: 'RA' },
  { key: 'paint', label: 'Paint outside the restricted area', short: 'Paint' },
  { key: 'mid', label: 'Mid-range', short: 'Mid' },
  { key: 'c3l', label: 'Left corner three', short: 'L corner 3' },
  { key: 'c3r', label: 'Right corner three', short: 'R corner 3' },
  { key: 'atb3', label: 'Above-the-break three', short: 'ATB 3' },
  { key: 'back', label: 'Backcourt', short: 'Backcourt' },
  { key: 'unk', label: 'Location unknown', short: 'Unknown' }
] as const
export type ShotZone = (typeof SHOT_ZONES)[number]['key']

/**
 * Zones read together: both corners, counted before any rate is taken (reference section 7). Stored as
 * its own counts so a corner three's rate qualifies on corner attempts; never added to the zones' sum.
 */
export const SHOT_ZONE_GROUPS = [
  { key: 'c3', label: 'Corner three', short: 'Corner 3', of: ['c3l', 'c3r'] }
] as const

/**
 * The NBA's own distance ranges, on the published distance in whole feet: less than 8 feet, 8 to 16,
 * 16 to 24, 24 and beyond (a backcourt shot is in the last).
 */
export const SHOT_BANDS = [
  { key: 'lt8', label: 'Less than 8 feet', short: '<8 ft', min: 0, max: 7 },
  { key: 'd8_16', label: '8 to 16 feet', short: '8–16 ft', min: 8, max: 15 },
  { key: 'd16_24', label: '16 to 24 feet', short: '16–24 ft', min: 16, max: 23 },
  { key: 'd24p', label: '24 feet and beyond', short: '24+ ft', min: 24, max: null }
] as const
export type ShotBand = (typeof SHOT_BANDS)[number]['key']

/**
 * Shot types from the NBA's `sub_type` text ("Driving Floating Bank Jump Shot"), mapped once: the first
 * rule whose pattern the text contains, ignoring case, wins. A dunk is a dunk however it came
 * (alley-oop, putback, tip); a tip that is not a dunk is a tip, also when the feed writes it "Tip
 * Layup Shot" (from 2015-16) where it wrote "Tip Shot" before; finger rolls are layups; a floater
 * before a jumper, so "Floating Jump shot" is a floater; pull-ups, step-backs, fadeaways, turnarounds
 * and bank shots are jump shots. A text no rule matches, or none, is "other".
 */
export const SHOT_TYPES = [
  { key: 'dunk', label: 'Dunk', short: 'Dunk', pattern: 'dunk' },
  { key: 'tip', label: 'Tip', short: 'Tip', pattern: 'tip' },
  { key: 'layup', label: 'Layup', short: 'Layup', pattern: 'layup|finger roll' },
  { key: 'hook', label: 'Hook', short: 'Hook', pattern: 'hook' },
  { key: 'floater', label: 'Floater', short: 'Floater', pattern: 'float' },
  { key: 'jumper', label: 'Jump shot', short: 'Jumper', pattern: 'jump|fadeaway|bank|pull' },
  { key: 'other', label: 'Other or unrecorded', short: 'Other', pattern: null }
] as const
export type ShotType = (typeof SHOT_TYPES)[number]['key']

/** The zone of a shot: off the court, beyond half court, then by its value and where it was taken. */
export function shotZone(x: number | null, y: number | null, value: number | null): ShotZone {
  if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return 'unk'
  if (Math.abs(x) > OFF_COURT.maxAbsX || y < OFF_COURT.minY || y > OFF_COURT.maxY) return 'unk'
  if (y > COURT.halfCourtY) return 'back'
  const r = Math.hypot(x, y)
  // The published value decides two or three; a shot without one, by where the line is.
  const three =
    value === null
      ? (Math.abs(x) >= COURT.cornerX && y <= COURT.cornerTopY) || r >= COURT.arcRadius
      : value === 3
  if (three) {
    if (y <= COURT.cornerTopY) return x < 0 ? 'c3l' : 'c3r'
    return 'atb3'
  }
  if (r <= COURT.restrictedRadius) return 'ra'
  if (Math.abs(x) <= COURT.laneHalfWidth && y <= COURT.laneTopY) return 'paint'
  return 'mid'
}

/** The band of a published distance in feet; from the coordinates when the distance is missing. */
export function shotBand(
  distance: number | null,
  x: number | null = null,
  y: number | null = null
): ShotBand | null {
  const feet = distance ?? (x !== null && y !== null ? Math.round(Math.hypot(x, y) / 10) : null)
  if (feet === null || !Number.isFinite(feet)) return null
  return SHOT_BANDS.find((b) => feet >= b.min && (b.max === null || feet <= b.max))?.key ?? null
}

/** The type of a shot from its `sub_type` text. */
export function shotType(subtype: string | null): ShotType {
  if (subtype) {
    for (const t of SHOT_TYPES) {
      if (t.pattern !== null && new RegExp(t.pattern, 'i').test(subtype)) return t.key
    }
  }
  return 'other'
}

/** Shots appear from here: the NBA's shot file starts with 1996-97. */
export const SHOTS_FIRST_SEASON = 1997

/** A chart never asks for more rows than this; a larger scope says how many it left out. */
export const SHOT_CHART_LIMIT = 20000

/** Fewer attempts than this and a chart says so instead of shading zones. */
export const SHOT_CHART_MIN = 20
