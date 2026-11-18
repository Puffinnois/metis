import { LEAGUES } from '../../leagues'
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

/**
 * Families no WNBA release publishes at all (`wnba-data-sources.md`, "Tables"), with the reasons the
 * registry gives, so the metrics and the reads behind their tabs say the same.
 */
const NOT_PUBLISHED: Partial<Record<MetricFamily, string>> = LEAGUES.wnba.unpublished

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
  if (parts.some((p) => DRAWN.includes(p.replace(/^opp_/, '')))) {
    return { firstSeason: Math.max(firstSeason, DRAWN_FROM), missingSeasons: AFTER_DRAWN }
  }
  if (def.entity === 'team' && parts.some((p) => p === 'tov' || p === 'opp_tov')) {
    return {
      firstSeason,
      seasonNotes: [{ seasons: NO_TEAM_TURNOVERS, note: NO_TEAM_TURNOVERS_NOTE }]
    }
  }
  return { firstSeason }
}

/**
 * The seasons whose game-log team rows leave out the team's own turnovers (a shot-clock violation, an
 * eight-second count), which they count from 2004: 1998, 1999, 2001 and 2002. Where a team row falls
 * short of its players (most games of 1997, 2000 and 2003), the build adds the team's own from the play
 * by play (`gameWnba.ts`), so those seasons count them (`wnba-agreement.md`, "Team rows against their
 * players").
 */
const NO_TEAM_TURNOVERS = [1998, 1999, 2001, 2002]
const NO_TEAM_TURNOVERS_NOTE =
  "the league's team rows leave out the team's own turnovers, so a team's turnovers and turnover rate read lower."

/**
 * Fouls drawn, from ESPN's play by play, the only one naming the fouled player: its WNBA file does from
 * 2006 to 2017 (85 % of fouls), 2 to 37 a season outside them. A team's fouls drawn equal the other
 * side's box-score fouls on 81 to 98 % of team-games in those seasons, but 47 % in 2011 and 25 % in
 * 2012, which are left out (`wnba-data-sources.md`, "Play-derived stats").
 */
const DRAWN = ['fd', 'fd_shooting']
const DRAWN_FROM = 2006
const AFTER_DRAWN = [2011, 2012, ...Array.from({ length: 2040 - 2017 }, (_, i) => 2018 + i)]
