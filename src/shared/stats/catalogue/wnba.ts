import { SHOT_BANDS, SHOT_ZONE_GROUPS, SHOT_ZONES } from '../shots'
import type { MetricCoverage, MetricDef, MetricFamily } from '../types'

/**
 * Every metric's coverage in the WNBA (`MetricDef.leagues.wnba`), from what
 * `docs/reference/wnba-data-sources.md` measured. Written as rules over what a metric reads rather than
 * once per metric, so a metric added to the catalogue states its WNBA coverage too. Whether the
 * WNBA's refresh builds a metric's table yet is not stated here: it is read from the league's
 * `builds` (`notBuiltYet` in `coverage.ts`), so the parts that build the published tables, the plays
 * and the models (T1301.7, T1301.8) lift those reasons by adding their step.
 */

/** The WNBA's first season: the game logs hold every player-game and team-game from 1997. */
const FIRST = 1997

/** Components a source has only from a later season, and that season. */
const LATER: readonly [readonly string[], number][] = [
  // The game logs' plus-minus: null on every line of 1997-2007 but 0 to 62 a season.
  [['plus_minus'], 2008],
  // Who started: ESPN's flags from 2002 (its 2002 lines are zeros, but the flags are there), the
  // league's 2026 box scores; nothing before 2002.
  [['starts', 'starter_pts', 'bench_pts', 'starts_known'], 2002],
  // ESPN's points in the paint, on the fast break and off turnovers: from 2023.
  [
    [
      'paint_pts',
      'fast_break_pts',
      'turnover_pts',
      'opp_paint_pts',
      'opp_fast_break_pts',
      'opp_turnover_pts'
    ],
    2023
  ]
]

/** Families no WNBA release publishes at all (`wnba-data-sources.md`, "Tables"). */
const NOT_PUBLISHED: Partial<Record<MetricFamily, string>> = {
  tracking: 'Not published for the WNBA: no release holds player tracking.',
  hustle: 'Not published for the WNBA: no release holds hustle stats.',
  play_types: 'Not published for the WNBA: no release holds play types.',
  matchups: 'Not published for the WNBA: no release holds matchups.',
  availability:
    "Not published for the WNBA: it has no official injury report, and ESPN's injury snapshots start in September 2026."
}

/** Metrics that say the same as another in a 40-minute league. */
const SAME_AS: Record<string, string> = {
  team_pace40: "The WNBA's pace is per 40 minutes already: see Pace."
}

/**
 * Published tables the league's files hold no column for. The impact file's DARKO columns: the
 * WNBA's has none, and its `boban_*` columns are SportsDataverse's own rating, which Metis does not
 * read under DARKO's name (`nba-data-sources.md`, "The impact file's `boban_*` columns").
 */
const NOT_IN_FILE: Record<string, string> = {
  pub_player_darko:
    "Not in the WNBA's impact file: it has no DARKO columns. Its BOBAN columns are SportsDataverse's own rating, not DARKO, and are not read yet."
}

/**
 * Shots have a location on every shot from 2011; before, 20 to 30 % sit at (0, 0) with no distance
 * (`wnba-data-sources.md`, "Traps"), so a zone, a distance band or a rate by zone would read the
 * located shots as if they were all. Counts by type and the totals are whole from 1997, as is the count
 * of shots with no location.
 */
const LOCATED_FROM = 2011
const LOCATED_BUCKETS = [
  ...SHOT_ZONES.map((z) => z.key).filter((k) => k !== 'unk'),
  ...SHOT_ZONE_GROUPS.map((g) => g.key),
  ...SHOT_BANDS.map((b) => b.key)
]
const located = (part: string): boolean => {
  const bare = part.replace(/^opp_/, '')
  // The league's rate by zone is what a shot's expected points read, and distances need a location.
  if (['dist_sum', 'dist_n', 'shots_xpts'].includes(bare)) return true
  return LOCATED_BUCKETS.some((k) => bare.startsWith(`${k}_`))
}

/** The metric's coverage in the WNBA, from the components it reads (`componentsOf`). */
export function wnbaCoverage(def: MetricDef, parts: readonly string[]): MetricCoverage {
  const unavailable =
    NOT_PUBLISHED[def.family] ??
    SAME_AS[def.id] ??
    (def.published ? NOT_IN_FILE[def.published] : undefined)
  if (unavailable) return { firstSeason: FIRST, unavailable }
  let firstSeason = FIRST
  for (const [columns, from] of LATER) {
    if (parts.some((p) => columns.includes(p))) firstSeason = Math.max(firstSeason, from)
  }
  if (def.family === 'shots' && parts.some(located)) {
    firstSeason = Math.max(firstSeason, LOCATED_FROM)
  }
  return { firstSeason }
}
