/**
 * The categories a reader finds statistics by, by what each measures (D52,
 * `docs/reference/stat-categories.md`). A metric states its categories where it is defined, one
 * sub-group in each (`MetricDef.categories`), the first its primary one. The family stays the source.
 *
 * Offense and Defense are umbrellas: they hold every statistic of one end of the floor, and their
 * sub-groups are headings over the specific categories' sub-groups of that end.
 */

export interface CategoryGroup {
  id: string
  label: string
  /** One sentence a reader could predict the sub-group's contents from. */
  definition: string
}

export interface Category {
  id: string
  label: string
  definition: string
  groups: readonly CategoryGroup[]
}

const g = <I extends string>(
  id: I,
  label: string,
  definition: string
): { id: I; label: string; definition: string } => ({
  id,
  label,
  definition
})

/** A play type's sub-group: one per type, its defense after the eleven on offense. */
const PLAY_TYPE_GROUPS: readonly [string, string][] = [
  ['iso', 'Isolation'],
  ['transition', 'Transition'],
  ['pnr_bh', 'Pick-and-roll ball handler'],
  ['pnr_roll', 'Pick-and-roll roll man'],
  ['post_up', 'Post-up'],
  ['spot_up', 'Spot-up'],
  ['handoff', 'Handoff'],
  ['cut', 'Cut'],
  ['off_screen', 'Off screen'],
  ['putback', 'Putbacks'],
  ['misc', 'Miscellaneous']
]
const DEFENDED_PLAY_TYPES = [
  'iso',
  'pnr_bh',
  'pnr_roll',
  'post_up',
  'spot_up',
  'handoff',
  'off_screen'
]

export const CATEGORIES = [
  {
    id: 'offense',
    label: 'Offense',
    definition:
      "Everything a player or team does with the ball, and for a team what its opponents' defense did to it.",
    groups: [
      g('scoring', 'Scoring', 'The Scoring category at this end.'),
      g('shooting', 'Shooting', 'The Shooting category at this end.'),
      g('playmaking', 'Playmaking', 'Passing, creation and ball handling.'),
      g('turnovers', 'Turnovers', 'Turnovers, and for a team the steals its opponents made.'),
      g('rebounding', 'Rebounding', 'Offensive rebounds, and the misses the opponents rebounded.'),
      g('fouls_drawn', 'Fouls drawn', 'Fouls drawn, free-throw rate, and the opponents’ fouls.'),
      g('usage', 'Usage', "The share of the team's plays a player finishes."),
      g('hustle', 'Hustle', 'Offensive box outs and loose balls, screen assists.'),
      g('play_types', 'Play types', 'The play types on offense.'),
      g('impact', 'Impact', 'The offensive part of a model, an on-court or individual rating.'),
      g('ratings', 'Ratings', "A team's offensive rating, adjusted or not.")
    ]
  },
  {
    id: 'defense',
    label: 'Defense',
    definition:
      'Everything a player or team does without the ball, and for a team everything its opponents did with it.',
    groups: [
      g('steals_blocks', 'Steals and blocks', 'Steals and blocks, their rates and shares.'),
      g('defended_shots', 'Defended shots', 'Contested shots and the shots defended at the rim.'),
      g('matchups', 'Matchups', 'What the players a defender was assigned to did, while assigned.'),
      g('rebounding', 'Rebounding', "Defensive rebounds, and the opponents' offensive rebounds."),
      g(
        'fouls',
        'Fouls and violations',
        'Fouls committed on defense, the defensive violations, and the fouls the opponents drew.'
      ),
      g('hustle', 'Hustle', 'Deflections, charges drawn, defensive loose balls and box outs.'),
      g('play_types', 'Play types', 'The play types defended.'),
      g('impact', 'Impact', 'The defensive part of a model, an on-court or individual rating.'),
      g('scoring_allowed', 'Scoring allowed', "The opponents' scoring."),
      g('shooting_allowed', 'Shooting allowed', "The opponents' shooting."),
      g('playmaking_allowed', 'Playmaking allowed', "The opponents' passing."),
      g('turnovers_forced', 'Turnovers forced', "The opponents' turnovers."),
      g('ratings', 'Ratings', "A team's defensive rating, adjusted or not.")
    ]
  },
  {
    id: 'scoring',
    label: 'Scoring',
    definition:
      'Points: how many, from which shots, in which situations, and how the baskets came.',
    groups: [
      g('points', 'Points', 'Points scored.'),
      g(
        'by_shot',
        'Points by shot',
        "Points from twos, threes and free throws, and each one's share."
      ),
      g(
        'by_situation',
        'Points by situation',
        'Points in the paint, on the fast break, off turnovers, second chances, transition, putbacks, and off a tracking dashboard.'
      ),
      g('assisted', 'Assisted and unassisted', 'How the made shots came, assisted or not.'),
      g('starters_bench', 'Starters and bench', "A team's points by its starters and its bench."),
      g('team_share', 'Share of team', "A player's share of the team's points.")
    ]
  },
  {
    id: 'shooting',
    label: 'Shooting',
    definition:
      'Shots taken and made: attempts, makes and percentages, by kind of shot, zone, distance and situation, free throws included.',
    groups: [
      g('field_goals', 'Field goals', 'Field goals made, attempted, missed and blocked, and FG%.'),
      g('twos', 'Twos', 'Two-point makes, attempts and percentage.'),
      g('threes', 'Threes', 'Three-point makes, attempts and percentage.'),
      g(
        'free_throws',
        'Free throws',
        'Free throws made, attempted and missed, FT%, free-throw rate, and-ones and trips.'
      ),
      g(
        'efficiency',
        'Efficiency',
        'Shooting that counts the three and the free throw: eFG%, TS%.'
      ),
      g('selection', 'Shot selection', 'Where the attempts come from: attempt rates and distance.'),
      g('team_share', 'Share of team', "A player's share of the team's makes and attempts."),
      g('rim_paint', 'Restricted area and paint', 'Shots from the restricted area and the paint.'),
      g('mid_range', 'Mid-range', 'Shots from mid-range.'),
      g('corner_threes', 'Corner threes', 'Threes from either corner.'),
      g(
        'above_break',
        'Above the break and backcourt',
        'Threes above the break and from the backcourt.'
      ),
      g('distances', 'Distances', 'Shots by distance band.'),
      g('shot_types', 'Shot types', 'Dunks, tips, layups, hooks, floaters and jump shots.'),
      g('catch_pull', 'Catch-and-shoot and pull-up', 'The tracking dashboards of those shots.'),
      g(
        'drives_touches',
        'Drives and touches',
        'Shots off drives and elbow, post and paint touches.'
      ),
      g(
        'transition_putbacks',
        'Transition and putbacks',
        'Shooting in transition and on putbacks.'
      ),
      g(
        'recent_form',
        'Recent form',
        'FG% and 3P% over the last 50 and 200 attempts, and their changes.'
      )
    ]
  },
  {
    id: 'playmaking',
    label: 'Playmaking',
    definition:
      'Making plays for others and keeping the ball: passes and assists, the shots created beyond them, handling the ball, and turnovers.',
    groups: [
      g('passing', 'Passing', 'Assists, the assist rates and ratios, and passes.'),
      g('creation', 'Creation', 'Shots made for others beyond the assist, and drives.'),
      g('ball_handling', 'Ball handling', 'Touches, time of possession, dribbles.'),
      g('turnovers', 'Turnovers', 'Turnovers, their rates and kinds.')
    ]
  },
  {
    id: 'rebounding',
    label: 'Rebounding',
    definition:
      'Rebounds at either end: how many, what share of the chances, contested or not, and the box outs behind them.',
    groups: [
      g('offensive', 'Offensive', 'Offensive rebounds, their rates, chances and contests.'),
      g('defensive', 'Defensive', 'Defensive rebounds, their rates, chances and contests.'),
      g('all', 'All rebounds', 'Rebounds at both ends together.'),
      g('box_outs', 'Box outs', 'Box outs, and the rebounds after them.')
    ]
  },
  {
    id: 'fouls',
    label: 'Fouls',
    definition:
      'Fouls and violations: those committed, those drawn, and the flagrants, technicals and ejections.',
    groups: [
      g('committed', 'Committed', 'Personal fouls and their kinds.'),
      g('drawn', 'Drawn', 'Fouls drawn, free-throw rate, and-ones and trips, charges drawn.'),
      g('violations', 'Violations', 'Defensive three seconds, goaltending, kicked balls.'),
      g(
        'flagrant_technical',
        'Flagrants, technicals and ejections',
        'Flagrant and technical fouls, ejections.'
      )
    ]
  },
  {
    id: 'hustle',
    label: 'Hustle and movement',
    definition:
      'Effort and activity: the hustle plays the NBA counts and how far and how fast a player moved.',
    groups: [
      g('contests', 'Contests', 'Contested shots, twos and threes.'),
      g('loose_balls', 'Loose balls and deflections', 'Loose balls recovered and deflections.'),
      g('charges', 'Charges', 'Charges drawn.'),
      g('screens', 'Screens', 'Screen assists and their points.'),
      g('box_outs', 'Box outs', 'Box outs, and the rebounds after them.'),
      g('movement', 'Movement', 'Distance run and average speed.')
    ]
  },
  {
    id: 'play_types',
    label: 'Play types',
    definition:
      "How a player's plays ended, by the kind of play, on offense and on defense: possessions, frequency and results of each.",
    groups: [
      ...PLAY_TYPE_GROUPS.map(([id, label]) => g(id, label, `${label} plays the player finished.`)),
      ...DEFENDED_PLAY_TYPES.map((id) => {
        const label = PLAY_TYPE_GROUPS.find(([k]) => k === id)?.[1] ?? id
        return g(`d_${id}`, `${label} defense`, `${label} plays the player defended.`)
      })
    ]
  },
  {
    id: 'impact',
    label: 'Impact',
    definition:
      "How much a player adds to the team's results: the margin with them on the floor and off it, and the all-in-one models and composites.",
    groups: [
      g('on_court', 'On court', 'The team with the player on the floor and off it.'),
      g('pm_models', 'Plus-minus models', 'RAPM and its kin, fitted on possessions.'),
      g('box_models', 'Box-score models', 'PER, Win Shares, BPM, VORP, SPM, WAR.'),
      g('composites', 'Box-score composites', 'Efficiency (EFF), Game Score, PIE.'),
      g(
        'individual',
        'Individual ratings',
        "Dean Oliver's individual ratings, stops, points produced."
      ),
      g(
        'all_around',
        'All-around production',
        'Production across categories: games of 10 in two or more (double-doubles and beyond) and the combined counts (points, rebounds and assists together).'
      )
    ]
  },
  {
    id: 'predictive',
    label: 'Predictive',
    definition:
      "Numbers that look ahead: a season's forecast for a team, a projection for a player, each named as its maker's estimate.",
    groups: [
      g('season_forecast', 'Season forecast', 'Projected record, playoff and title odds, seeds.'),
      g('player_projections', 'Player projections', 'A player projected ahead.')
    ]
  },
  {
    id: 'results',
    label: 'Results and strength',
    definition:
      'Winning and how strong a team is: record, margin, ratings, pace, ratings adjusted for opponents, Elo, Pythagorean record, schedule, game flow and forecast.',
    groups: [
      g('record', 'Record', 'Wins, losses and win percentage.'),
      g('margin', 'Margin', 'Point differential and margin of victory.'),
      g('ratings', 'Ratings', 'Offensive, defensive and net ratings, points per possession.'),
      g('pace', 'Pace and possessions', 'Pace and the possession estimates.'),
      g(
        'adjusted',
        'Adjusted ratings',
        'Ratings adjusted for opponents and home court, SRS, schedule.'
      ),
      g('elo', 'Elo', 'The Elo rating and the wins it expects.'),
      g('pythagorean', 'Pythagorean', 'The Pythagorean record and the wins over it.'),
      g('schedule', 'Schedule', 'Games left and their strength.'),
      g('game_flow', 'Game flow', 'Leads, ties, runs and droughts.'),
      g('forecast', 'Forecast', 'The season forecast.'),
      g('rankings', 'Rankings and seeds', 'Rankings, quadrants, polls and seeds.')
    ]
  },
  {
    id: 'playing_time',
    label: 'Playing time',
    definition:
      'How much a player was on the floor: games, starts, minutes, possessions, and the games they missed.',
    groups: [
      g('games_minutes', 'Games and minutes', 'Games, starts and minutes.'),
      g('possessions', 'Possessions', 'Possessions played.'),
      g('games_missed', 'Games missed', 'Games out for injury or illness, and for other reasons.')
    ]
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    definition:
      'Fantasy points under the common scoring systems, as ordinary metrics; nothing about rosters or advice.',
    groups: [g('points', 'Points', 'Fantasy points, one metric a scoring system.')]
  }
] as const satisfies readonly Category[]

type Categories = typeof CATEGORIES
export type CategoryId = Categories[number]['id']

/**
 * A metric's place in one category: `shooting.threes`. The play types' groups are built from a list,
 * so their ids are typed loosely (`play_types.${string}`) and checked by the tests.
 */
type PlacementOf<C> = C extends { id: infer I extends string; groups: readonly (infer G)[] }
  ? I extends 'play_types'
    ? `play_types.${string}`
    : G extends { id: infer S extends string }
      ? `${I}.${S}`
      : never
  : never
export type Placement = PlacementOf<Categories[number]>

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id)

export const categoryOf = (id: string): Category | undefined =>
  (CATEGORIES as readonly Category[]).find((c) => c.id === id)

/** The category and the sub-group a placement names. */
export function placementParts(p: Placement): { category: Category; group: CategoryGroup } | null {
  const [c, s] = p.split('.')
  const category = categoryOf(c)
  const group = category?.groups.find((x) => x.id === s)
  return category && group ? { category, group } : null
}

const UMBRELLAS = new Set<string>(['offense', 'defense'])
export const isUmbrella = (p: Placement): boolean => UMBRELLAS.has(p.split('.')[0])

/** Offense and Defense: a category over every statistic of one end. */
export const isUmbrellaCategory = (id: string): boolean => UMBRELLAS.has(id)

/**
 * The same act seen from the other team: what a team's opponents did with the ball is the team's
 * Defense, and what they did on defense is its Offense. The umbrella moves to the other end and leads,
 * so an opponents' metric is described under the team's end; the specific categories stay.
 */
const OTHER_END: Readonly<Record<string, Placement>> = {
  'offense.scoring': 'defense.scoring_allowed',
  'offense.shooting': 'defense.shooting_allowed',
  'offense.playmaking': 'defense.playmaking_allowed',
  'offense.turnovers': 'defense.turnovers_forced',
  'offense.rebounding': 'defense.rebounding',
  'offense.fouls_drawn': 'defense.fouls',
  'offense.hustle': 'defense.hustle',
  'offense.play_types': 'defense.play_types',
  'offense.impact': 'defense.impact',
  'offense.ratings': 'defense.ratings',
  'defense.rebounding': 'offense.rebounding',
  'defense.fouls': 'offense.fouls_drawn',
  'defense.hustle': 'offense.hustle',
  'defense.defended_shots': 'offense.shooting',
  'defense.impact': 'offense.impact',
  'defense.ratings': 'offense.ratings',
  'defense.scoring_allowed': 'offense.scoring',
  'defense.shooting_allowed': 'offense.shooting',
  'defense.turnovers_forced': 'offense.turnovers'
}

export function opponentsOf(own: readonly Placement[]): Placement[] {
  const umbrella = own.find(isUmbrella)
  const rest = own.filter((p) => !isUmbrella(p))
  if (!umbrella) return rest
  const other = OTHER_END[umbrella]
  if (!other) throw new Error(`no other end for ${umbrella}: state the opponents' categories`)
  return [other, ...rest]
}
