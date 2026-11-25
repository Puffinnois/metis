import type { Placement } from '../categories'
import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * Reference sections 4, 5 and 12: what the team did with a player on the floor and off it, counted
 * from the play by play (`derived/onCourt.ts`), and the actual on-court rates that the box score can
 * only estimate from minutes. Each is named apart from its estimate: "Usage, on court" beside
 * "Usage percentage".
 *
 * Off the floor means the rest of the player's own games, not every game of the team. Possessions
 * are SportsDataverse's count from the NBA's play by play, not the NBA's own, and who was on the
 * floor is its lineup of each play: both are derived, not official, and checked against the box
 * score's minutes and plus-minus in `nba-data-sources.md`.
 */

const SOURCES = ["SportsDataverse's lineups and possessions, from the NBA's play by play"]
const TABLE = 'player_on_court'
/** The NBA's play by play, and its lineups, start in 1996-97. */
const FIRST = 1997

const DERIVED = 'Derived from the play by play, not official.'
const OFF_GAMES = 'Off the floor counts the rest of their own games, not games they missed.'

/** About 25 minutes a game over 82 games, as a possession count. */
const MIN_POSS = 2000
const MIN_MINUTES = 1000

const base = (o: Opts): Opts => ({
  family: 'on_court',
  kind: 'derived',
  sources: SOURCES,
  firstSeason: FIRST,
  built: TABLE,
  ...o
})

const rating = (value: string, sample: string, o: Partial<Opts> = {}): Opts =>
  base({ value, sample, minSample: MIN_POSS, unit: 'rating', decimals: 1, ...o })

/** A share of what the team did while the player was on the floor, read as a fraction. */
const share = (value: string, o: Partial<Opts> = {}): Opts =>
  base({ value, sample: 'minutes', minSample: MIN_MINUTES, unit: 'pct', ...o })

const per100 = (pts: string, poss: string): string => `100 * {${pts}} / nullif({${poss}}, 0)`
const ortg = (side: 'on' | 'off'): string => per100(`${side}_pts`, `${side}_poss`)
const drtg = (side: 'on' | 'off'): string => per100(`${side}_opp_pts`, `${side}_opp_poss`)
const net = (side: 'on' | 'off'): string => `${ortg(side)} - ${drtg(side)}`

/** On less off, read as one number: NULL when either side has no possessions. */
const diff = (on: string, off: string): string => `(${on}) - (${off})`

/** A team's turnovers and rebounds count those credited to a player, on either side of the floor. */
const PLAYER_TURNOVERS =
  "Turnovers credited to a player: a team's own, such as a shot clock, are in neither side."
const PLAYER_REBOUNDS = "Rebounds credited to a player: a team's own are in neither side."

type Floor = 'on' | 'off'

interface LineRate {
  /** The end of the id: `offc_efg_pct`, `onoff_opp_efg_pct`. */
  id: string
  /** The team's own id where it has another one: `tm_tov_pct` beside the opponents' `tov_pct`. */
  team?: string
  label: string
  short: string
  /** What it is, in a sentence, from the side in the possessive. */
  what: (side: string) => string
  /** The formula, from a count of the line and a count of the other team's. */
  value: (own: (c: string) => string, other: (c: string) => string) => string
  sample: string
  minSample: number
  unit: 'pct' | 'number'
  decimals: number
  direction: 'higher' | 'lower' | 'neutral'
  /** Said after the sentence, where a count needs it. */
  note?: string
  /** The team's line alone, where the opponents' would be one less it. */
  teamOnly?: boolean
  /** The category beside "On court": offense for the team's line unless it says another. */
  category?: Placement | null
}

const LINE_RATES: LineRate[] = [
  {
    id: 'efg_pct',
    label: 'effective field-goal percentage',
    short: 'eFG%',
    what: (side) => `${side} effective field-goal percentage`,
    value: (o) => `(${o('fgm')} + 0.5 * ${o('fg3m')}) / nullif(${o('fga')}, 0)`,
    sample: 'fga',
    minSample: 1500,
    unit: 'pct',
    decimals: 1,
    direction: 'higher'
  },
  {
    id: 'ts_pct',
    label: 'true shooting percentage',
    short: 'TS%',
    what: (side) =>
      `${side} true shooting percentage (points over twice the sum of shots and 0.44 of free throws)`,
    value: (o) => `${o('pts')} / nullif(2 * (${o('fga')} + 0.44 * ${o('fta')}), 0)`,
    sample: 'fga',
    minSample: 1500,
    unit: 'pct',
    decimals: 1,
    direction: 'higher'
  },
  {
    id: 'fg3a_rate',
    label: 'three-point attempt rate',
    short: '3PAr',
    what: (side) => `${side} three-point attempts per field-goal attempt`,
    value: (o) => `${o('fg3a')} / nullif(${o('fga')}, 0)`,
    sample: 'fga',
    minSample: 1500,
    unit: 'pct',
    decimals: 1,
    direction: 'neutral'
  },
  {
    id: 'fta_rate',
    label: 'free-throw attempt rate',
    short: 'FTr',
    what: (side) => `${side} free-throw attempts per field-goal attempt`,
    value: (o) => `${o('fta')} / nullif(${o('fga')}, 0)`,
    sample: 'fga',
    minSample: 1500,
    unit: 'number',
    decimals: 3,
    direction: 'higher'
  },
  {
    id: 'tov_pct',
    team: 'tm_tov_pct',
    label: 'turnover percentage',
    short: 'TOV%',
    what: (side) => `${side} turnovers per possession`,
    value: (o) => `${o('tov')} / nullif(${o('poss')}, 0)`,
    sample: 'poss',
    minSample: MIN_POSS,
    unit: 'pct',
    decimals: 1,
    direction: 'lower',
    note: PLAYER_TURNOVERS
  },
  {
    id: 'orb_pct',
    team: 'tm_orb_pct',
    label: 'offensive rebound percentage',
    short: 'ORB%',
    what: () => "The share of the team's missed shots it rebounded",
    value: (o, x) => `${o('oreb')} / nullif(${o('oreb')} + ${x('dreb')}, 0)`,
    sample: 'poss',
    minSample: MIN_POSS,
    unit: 'pct',
    decimals: 1,
    direction: 'higher',
    note: PLAYER_REBOUNDS,
    teamOnly: true
  },
  {
    id: 'drb_pct',
    team: 'tm_drb_pct',
    label: 'defensive rebound percentage',
    short: 'DRB%',
    what: () => "The share of the opponents' missed shots the team rebounded",
    value: (o, x) => `${o('dreb')} / nullif(${o('dreb')} + ${x('oreb')}, 0)`,
    sample: 'poss',
    minSample: MIN_POSS,
    unit: 'pct',
    decimals: 1,
    direction: 'higher',
    note: PLAYER_REBOUNDS,
    teamOnly: true,
    category: 'defense.impact'
  },
  {
    id: 'trb_pct',
    team: 'tm_trb_pct',
    label: 'total rebound percentage',
    short: 'TRB%',
    what: () => 'The share of all rebounds the team took',
    value: (o, x) =>
      `(${o('oreb')} + ${o('dreb')}) / nullif(${o('oreb')} + ${o('dreb')} + ${x('oreb')} + ${x('dreb')}, 0)`,
    sample: 'poss',
    minSample: MIN_POSS,
    unit: 'pct',
    decimals: 1,
    direction: 'higher',
    note: PLAYER_REBOUNDS,
    teamOnly: true,
    category: null
  }
]

const flip = (d: LineRate['direction']): LineRate['direction'] =>
  d === 'higher' ? 'lower' : d === 'lower' ? 'higher' : d

const upperFirst = (s: string): string => s[0].toUpperCase() + s.slice(1)

/**
 * The team's and the opponents' rates with the player on the floor and off it, and on less off, where
 * the catalogue lacks them (audit entry 275). Each is worked from the counts `player_on_court` keeps
 * for both sides of the floor, so the four sides add up to the team's own line exactly.
 */
function lineRates(): MetricDef[] {
  const out: MetricDef[] = []
  for (const r of LINE_RATES) {
    for (const whose of r.teamOnly ? (['team'] as const) : (['team', 'opp'] as const)) {
      const formula = (floor: Floor): string => {
        const own = whose === 'opp' ? 'opp_' : ''
        const other = whose === 'opp' ? '' : 'opp_'
        return r.value(
          (c) => `{${floor}_${own}${c}}`,
          (c) => `{${floor}_${other}${c}}`
        )
      }
      const sampleOf = (floor: Floor): string =>
        `${floor}_${whose === 'opp' ? 'opp_' : ''}${r.sample}`
      // "Team" where the same words also name the player's own rate.
      const words =
        whose === 'opp'
          ? `Opponent ${r.label}`
          : r.id === 'efg_pct'
            ? upperFirst(r.label)
            : `Team ${r.label}`
      const shortOf = (tail: string): string =>
        `${whose === 'opp' || r.id === 'efg_pct' ? '' : 'TM '}${r.short} ${whose === 'opp' ? 'vs ' : ''}${tail}`
      const what = r.what(whose === 'opp' ? "The opponents'" : "The team's")
      const direction = whose === 'opp' ? flip(r.direction) : r.direction
      const category =
        r.category === undefined
          ? whose === 'opp'
            ? 'defense.impact'
            : 'offense.impact'
          : r.category
      const categories: Placement[] = ['impact.on_off', ...(category ? [category] : [])]
      const note = r.note ? `${r.note} ` : ''
      const id = whose === 'opp' ? `opp_${r.id}` : (r.team ?? r.id)
      const make = (
        key: string,
        label: string,
        short: string,
        text: string,
        value: string,
        floor: Floor
      ): void => {
        out.push(
          metric(key, label, short, text, {
            ...base({
              value,
              sample: sampleOf(floor),
              minSample: r.minSample,
              unit: r.unit,
              decimals: r.decimals,
              direction
            }),
            categories
          })
        )
      }
      make(
        `onc_${id}`,
        `${words}, on court`,
        shortOf('on'),
        `${what} with the player on the floor. ${note}${DERIVED}`,
        formula('on'),
        'on'
      )
      make(
        `offc_${id}`,
        `${words}, off court`,
        shortOf('off'),
        `${what} with the player on the bench. ${note}${OFF_GAMES} ${DERIVED}`,
        formula('off'),
        'off'
      )
      make(
        `onoff_${id}`,
        `${words}, on less off`,
        shortOf('on-off'),
        `${what} with the player on the floor less the same with them on the bench. Not adjusted for teammates or opponents. ${note}${OFF_GAMES} ${DERIVED}`,
        diff(formula('on'), formula('off')),
        'on'
      )
    }
  }
  return out
}

export const ON_COURT: MetricDef[] = [
  metric(
    'onc_min',
    'Minutes on court, from plays',
    'MIN (plays)',
    `Minutes on the floor as the play by play's lineups count them, beside the box score's minutes. ${DERIVED}`,
    {
      ...base({
        value: '{minutes}',
        sample: 'games',
        aggregation: 'sum',
        unit: 'count',
        direction: 'neutral'
      }),
      categories: ['playing_time.games_minutes', 'impact.on_court']
    }
  ),
  metric(
    'onc_poss',
    'Possessions on court',
    'Poss (on)',
    `The team's possessions with the player on the floor, as SportsDataverse counts them: actual possessions, not an estimate. ${DERIVED}`,
    {
      ...base({
        value: '{on_poss}',
        sample: 'games',
        aggregation: 'sum',
        unit: 'count',
        decimals: 0,
        direction: 'neutral'
      }),
      categories: ['playing_time.possessions', 'impact.on_court']
    }
  ),
  metric(
    'onc_pts',
    'Points for, on court',
    'PTS for on',
    `Points the team scored with the player on the floor, counted from the plays. ${DERIVED}`,
    {
      ...base({
        value: '{on_pts}',
        sample: 'games',
        aggregation: 'sum',
        unit: 'count',
        decimals: 0
      }),
      categories: ['impact.on_court', 'offense.impact']
    }
  ),
  metric(
    'onc_opp_pts',
    'Points against, on court',
    'PTS vs on',
    `Points the opponents scored with the player on the floor, counted from the plays. Not points the player gave up alone. ${DERIVED}`,
    {
      ...base({
        value: '{on_opp_pts}',
        sample: 'games',
        aggregation: 'sum',
        unit: 'count',
        decimals: 0,
        direction: 'lower'
      }),
      categories: ['impact.on_court', 'defense.impact']
    }
  ),
  metric(
    'onc_plus_minus',
    'Plus-minus, from plays',
    '+/- (plays)',
    `Points scored less points allowed with the player on the floor, counted from the plays. Free throws count for the players on the floor at the foul, as the box score's plus-minus counts them. ${DERIVED}`,
    {
      ...base({
        value: '{on_pts} - {on_opp_pts}',
        sample: 'games',
        aggregation: 'sum',
        unit: 'count',
        decimals: 0
      }),
      categories: ['impact.on_court']
    }
  ),
  metric(
    'onc_ortg',
    'Offensive rating, on court',
    'ORtg on',
    `Points the team scored per 100 of its possessions with the player on the floor. ${DERIVED}`,
    {
      ...rating(ortg('on'), 'on_poss', { tier: 'core' }),
      categories: ['impact.on_court', 'offense.impact']
    }
  ),
  metric(
    'onc_drtg',
    'Defensive rating, on court',
    'DRtg on',
    `Points the opponents scored per 100 of their possessions with the player on the floor. Lower is better. ${DERIVED}`,
    {
      ...rating(drtg('on'), 'on_opp_poss', { direction: 'lower', tier: 'core' }),
      categories: ['impact.on_court', 'defense.impact']
    }
  ),
  metric(
    'onc_net',
    'Net rating, on court',
    'Net on',
    `Offensive less defensive rating with the player on the floor. ${DERIVED}`,
    { ...rating(net('on'), 'on_poss', { tier: 'core' }), categories: ['impact.on_court'] }
  ),
  metric(
    'offc_ortg',
    'Offensive rating, off court',
    'ORtg off',
    `Points the team scored per 100 possessions with the player on the bench. ${OFF_GAMES} ${DERIVED}`,
    { ...rating(ortg('off'), 'off_poss'), categories: ['impact.on_court', 'offense.impact'] }
  ),
  metric(
    'offc_drtg',
    'Defensive rating, off court',
    'DRtg off',
    `Points the opponents scored per 100 possessions with the player on the bench. ${OFF_GAMES} ${DERIVED}`,
    {
      ...rating(drtg('off'), 'off_opp_poss', { direction: 'lower' }),
      categories: ['impact.on_court', 'defense.impact']
    }
  ),
  metric(
    'offc_net',
    'Net rating, off court',
    'Net off',
    `Offensive less defensive rating with the player on the bench. ${OFF_GAMES} ${DERIVED}`,
    { ...rating(net('off'), 'off_poss'), categories: ['impact.on_court'] }
  ),
  metric(
    'onoff_ortg',
    'Offensive rating, on less off',
    'ORtg on-off',
    `Offensive rating on court less off court: above zero, the team scored better with the player on the floor. Not adjusted for teammates or opponents. ${OFF_GAMES} ${DERIVED}`,
    {
      ...rating(diff(ortg('on'), ortg('off')), 'on_poss'),
      categories: ['impact.on_court', 'offense.impact']
    }
  ),
  metric(
    'onoff_drtg',
    'Defensive rating, on less off',
    'DRtg on-off',
    `Defensive rating on court less off court: below zero, the opponents scored less with the player on the floor. ${OFF_GAMES} ${DERIVED}`,
    {
      ...rating(diff(drtg('on'), drtg('off')), 'on_opp_poss', { direction: 'lower' }),
      categories: ['impact.on_court', 'defense.impact']
    }
  ),
  metric(
    'onoff_net',
    'Net rating, on less off',
    'Net on-off',
    `Net rating on court less off court. Not adjusted for teammates or opponents. ${OFF_GAMES} ${DERIVED}`,
    {
      ...rating(diff(net('on'), net('off')), 'on_poss', { tier: 'core' }),
      categories: ['impact.on_court']
    }
  ),
  metric(
    'onc_pace',
    'Pace, on court',
    'Pace on',
    `Possessions per 48 minutes with the player on the floor, both teams' averaged: actual possessions over the time on the floor. ${DERIVED}`,
    {
      ...base({
        value: '2880 * ({on_poss} + {on_opp_poss}) / 2.0 / nullif({on_secs}, 0)',
        gameLength: true,
        sample: 'on_poss',
        minSample: MIN_POSS,
        direction: 'neutral'
      }),
      categories: ['impact.on_court']
    }
  ),
  ...lineRates(),
  metric(
    'onc_usg_pct',
    'Usage, on court',
    'USG% on',
    `The share of the team's plays the player finished while on the floor: their field-goal attempts, 0.44 of their free-throw attempts and their turnovers over the team's on the floor. The actual count of what the usage percentage estimates from minutes. ${DERIVED}`,
    {
      ...share(
        '({p_fga} + 0.44 * {p_fta} + {p_tov}) / nullif({on_fga} + 0.44 * {on_fta} + {on_tov}, 0)'
      ),
      categories: ['offense.usage']
    }
  ),
  metric(
    'onc_ast_pct',
    'Assist percentage, on court',
    'AST% on',
    `The share of teammates' made shots the player assisted while on the floor: the actual count of what the assist percentage estimates. ${DERIVED}`,
    {
      ...share('{p_ast} / nullif({on_fgm} - {p_fgm}, 0)'),
      categories: ['playmaking.passing', 'offense.playmaking']
    }
  ),
  metric(
    'onc_orb_pct',
    'Offensive rebound percentage, on court',
    'ORB% on',
    `The share of the team's missed shots the player rebounded while on the floor: the actual count of what the offensive rebound percentage estimates. ${DERIVED}`,
    {
      ...share('{p_oreb} / nullif({on_oreb} + {on_opp_dreb}, 0)'),
      categories: ['rebounding.offensive', 'offense.rebounding']
    }
  ),
  metric(
    'onc_drb_pct',
    'Defensive rebound percentage, on court',
    'DRB% on',
    `The share of the opponents' missed shots the player rebounded while on the floor. ${DERIVED}`,
    {
      ...share('{p_dreb} / nullif({on_dreb} + {on_opp_oreb}, 0)'),
      categories: ['rebounding.defensive', 'defense.rebounding']
    }
  ),
  metric(
    'onc_trb_pct',
    'Total rebound percentage, on court',
    'TRB% on',
    `The share of all rebounds the player took while on the floor. ${DERIVED}`,
    {
      ...share(
        '({p_oreb} + {p_dreb}) / nullif({on_oreb} + {on_dreb} + {on_opp_oreb} + {on_opp_dreb}, 0)'
      ),
      categories: ['rebounding.all']
    }
  ),
  metric(
    'onc_stl_pct',
    'Steal percentage, on court',
    'STL% on',
    `The player's steals per opponent possession while on the floor: the actual count of what the steal percentage estimates. ${DERIVED}`,
    { ...share(ratio('p_stl', 'on_opp_poss')), categories: ['defense.steals_blocks'] }
  ),
  metric(
    'onc_blk_pct',
    'Block percentage, on court',
    'BLK% on',
    `The share of the opponents' two-point attempts the player blocked while on the floor. ${DERIVED}`,
    {
      ...share('{p_blk} / nullif({on_opp_fga} - {on_opp_fg3a}, 0)'),
      categories: ['defense.steals_blocks']
    }
  )
]

/** What the on-court samples count, for a column's sample. */
export const ON_COURT_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  on_poss: 'possessions on court',
  on_opp_poss: 'opponent possessions on court',
  off_poss: 'possessions off court',
  off_opp_poss: 'opponent possessions off court',
  on_fga: 'team shots on court',
  on_opp_fga: 'opponent shots on court',
  off_fga: 'team shots off court',
  off_opp_fga: 'opponent shots off court'
}
