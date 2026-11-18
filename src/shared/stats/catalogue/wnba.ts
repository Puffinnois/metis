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

/** The metric's coverage in the WNBA, from the components it reads (`componentsOf`). */
export function wnbaCoverage(def: MetricDef, parts: readonly string[]): MetricCoverage {
  const unavailable = NOT_PUBLISHED[def.family] ?? SAME_AS[def.id]
  if (unavailable) return { firstSeason: FIRST, unavailable }
  let firstSeason = FIRST
  for (const [columns, from] of LATER) {
    if (parts.some((p) => columns.includes(p))) firstSeason = Math.max(firstSeason, from)
  }
  return { firstSeason }
}
