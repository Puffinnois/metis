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
 * WNBA's has none; its `boban_*` columns are read as BOBAN, under its own name. Nor does it publish
 * the NBA file's box prior and REML RAPM.
 */
const NOT_IN_FILE: Record<string, string> = {
  pub_player_darko:
    "Not in the WNBA's impact file: it has no DARKO columns. Its BOBAN columns are SportsDataverse's own model of the same kind, not DARKO: see the BOBAN metrics.",
  pub_player_impact_prior: "Not in the WNBA's impact file: it publishes no box prior or REML RAPM.",
  pub_player_current_impact:
    "Not published for the WNBA: SportsDataverse's current-impact file covers the NBA alone.",
  pub_player_expected_impact:
    "Not published for the WNBA: SportsDataverse's current-impact file covers the NBA alone."
}

/**
 * Shots have a location on every shot from 2011; before, 20 to 30 % sit at (0, 0) with no distance
 * (`wnba-data-sources.md`, "Traps"), so a zone, a distance band or a rate by zone would read the
 * located shots as if they were all. Counts by type and the totals are whole from 1997, as is the count
 * of shots with no location.
 */
const LOCATED_FROM = LEAGUES.wnba.shotsLocatedFrom
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

/**
 * The models (T1301.8), from the registry's fitted values (`League.models`): Elo and the forecast read
 * from the first season past Elo's burn-in; the forecast has no play-in, no top six and no round
 * leaving eight teams, and its last four are semifinals; the adjusted ratings skip the seasons too
 * even to rate; BPM and what follows from it read the registry's reason when it is not shown.
 */
const MODELS = LEAGUES.wnba.models
const ELO_TABLES = ['elo_game', 'elo_wins']
const NO_PLAY_IN = 'The WNBA has no play-in.'
const MODEL_UNAVAILABLE: Record<string, string> = {
  team_top6_pct: NO_PLAY_IN,
  team_play_in_pct: NO_PLAY_IN,
  team_round2_pct:
    'The WNBA sends eight teams to its playoffs at most, so reaching the last eight is reaching the playoffs: see Playoff odds.'
}
const MODEL_WORDS: Record<string, MetricCoverage['words']> = {
  team_playoff_pct: {
    description:
      "The share of runs in which the team reaches the playoffs: four teams in 1997 and 1998, six in 1999, eight since. A model's odds, as of the last game in scope."
  },
  team_conf_finals_pct: {
    label: 'Semifinal odds',
    short: 'SF%',
    description:
      "The share of runs in which the team reaches the last four: its conference's finals to 2015, the semifinals since. A model's odds, as of the last game in scope."
  },
  team_mean_seed: {
    description:
      "The team's mean seed over the runs: its place in its conference to 2015, in the league since (in 1997 and 1998 the conference winners seeded first), as of the last game in scope."
  },
  team_pyth_pct: {
    description: `The winning percentage the points scored and allowed point to: points for to the power ${MODELS.pythagoreanExponent}, over points for and against each to that power (the exponent fitted on the WNBA's seasons; the NBA's is 14).`
  },
  team_elo: {
    description:
      'A rating carried from game to game, 1500 an average team: 100 points better wins 64 % of the time on a neutral floor. FiveThirtyEight’s Elo with the values fitted for the NBA, which the WNBA’s own seasons did not improve on, playoffs included, as of the last game in scope.'
  }
}
const BPM_METRICS = ['bpm', 'obpm', 'dbpm', 'vorp', 'team_vorp', 'bpm_position', 'bpm_role']

function modelCoverage(def: MetricDef): MetricCoverage | null {
  if (!def.model) return null
  const words = MODEL_WORDS[def.id]
  const withWords = (c: MetricCoverage): MetricCoverage => (words ? { ...c, words } : c)
  const unavailable =
    MODEL_UNAVAILABLE[def.id] ??
    (BPM_METRICS.includes(def.id) ? (MODELS.bpmUnavailable ?? undefined) : undefined)
  if (unavailable) return { firstSeason: FIRST, unavailable }
  if (ELO_TABLES.includes(def.model)) return withWords({ firstSeason: MODELS.elo.firstSeason })
  if (def.model === 'team_forecast') return withWords({ firstSeason: MODELS.forecastFirstSeason })
  if (def.model === 'adjusted_rating' && MODELS.adjustedThin.length > 0) {
    return {
      firstSeason: FIRST,
      missingSeasons: [...MODELS.adjustedThin],
      missingReason: `Not shown for ${MODELS.adjustedThin.join(' and ')}: the teams were so even that the two halves of the season disagree on their order, so an adjusted rating would be noise.`
    }
  }
  return withWords({ firstSeason: FIRST })
}

/** The metric's coverage in the WNBA, from the components it reads (`componentsOf`). */
export function wnbaCoverage(def: MetricDef, parts: readonly string[]): MetricCoverage {
  const unavailable =
    NOT_PUBLISHED[def.family] ??
    SAME_AS[def.id] ??
    (def.published ? NOT_IN_FILE[def.published] : undefined)
  if (unavailable) return { firstSeason: FIRST, unavailable }
  const model = modelCoverage(def)
  if (model) return model
  const words = MODEL_WORDS[def.id]
  if (words) return { firstSeason: FIRST, words }
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
