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
  gameTable: TABLE,
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

export const ON_COURT: MetricDef[] = [
  metric(
    'onc_min',
    'Minutes on court, from plays',
    'MIN (plays)',
    `Minutes on the floor as the play by play's lineups count them, beside the box score's minutes. ${DERIVED}`,
    base({
      value: '{minutes}',
      sample: 'games',
      aggregation: 'sum',
      unit: 'count',
      direction: 'neutral'
    })
  ),
  metric(
    'onc_poss',
    'Possessions on court',
    'Poss (on)',
    `The team's possessions with the player on the floor, as SportsDataverse counts them: actual possessions, not an estimate. ${DERIVED}`,
    base({
      value: '{on_poss}',
      sample: 'games',
      aggregation: 'sum',
      unit: 'count',
      decimals: 0,
      direction: 'neutral'
    })
  ),
  metric(
    'onc_plus_minus',
    'Plus-minus, from plays',
    '+/- (plays)',
    `Points scored less points allowed with the player on the floor, counted from the plays. Free throws count for the players on the floor at the foul, as the box score's plus-minus counts them. ${DERIVED}`,
    base({
      value: '{on_pts} - {on_opp_pts}',
      sample: 'games',
      aggregation: 'sum',
      unit: 'count',
      decimals: 0
    })
  ),
  metric(
    'onc_ortg',
    'Offensive rating, on court',
    'ORtg on',
    `Points the team scored per 100 of its possessions with the player on the floor. ${DERIVED}`,
    rating(ortg('on'), 'on_poss', { tier: 'core' })
  ),
  metric(
    'onc_drtg',
    'Defensive rating, on court',
    'DRtg on',
    `Points the opponents scored per 100 of their possessions with the player on the floor. Lower is better. ${DERIVED}`,
    rating(drtg('on'), 'on_opp_poss', { direction: 'lower', tier: 'core' })
  ),
  metric(
    'onc_net',
    'Net rating, on court',
    'Net on',
    `Offensive less defensive rating with the player on the floor. ${DERIVED}`,
    rating(net('on'), 'on_poss', { tier: 'core' })
  ),
  metric(
    'offc_ortg',
    'Offensive rating, off court',
    'ORtg off',
    `Points the team scored per 100 possessions with the player on the bench. ${OFF_GAMES} ${DERIVED}`,
    rating(ortg('off'), 'off_poss')
  ),
  metric(
    'offc_drtg',
    'Defensive rating, off court',
    'DRtg off',
    `Points the opponents scored per 100 possessions with the player on the bench. ${OFF_GAMES} ${DERIVED}`,
    rating(drtg('off'), 'off_opp_poss', { direction: 'lower' })
  ),
  metric(
    'offc_net',
    'Net rating, off court',
    'Net off',
    `Offensive less defensive rating with the player on the bench. ${OFF_GAMES} ${DERIVED}`,
    rating(net('off'), 'off_poss')
  ),
  metric(
    'onoff_ortg',
    'Offensive rating, on less off',
    'ORtg on-off',
    `Offensive rating on court less off court: above zero, the team scored better with the player on the floor. Not adjusted for teammates or opponents. ${OFF_GAMES} ${DERIVED}`,
    rating(diff(ortg('on'), ortg('off')), 'on_poss')
  ),
  metric(
    'onoff_drtg',
    'Defensive rating, on less off',
    'DRtg on-off',
    `Defensive rating on court less off court: below zero, the opponents scored less with the player on the floor. ${OFF_GAMES} ${DERIVED}`,
    rating(diff(drtg('on'), drtg('off')), 'on_opp_poss', { direction: 'lower' })
  ),
  metric(
    'onoff_net',
    'Net rating, on less off',
    'Net on-off',
    `Net rating on court less off court. Not adjusted for teammates or opponents. ${OFF_GAMES} ${DERIVED}`,
    rating(diff(net('on'), net('off')), 'on_poss', { tier: 'core' })
  ),
  metric(
    'onc_pace',
    'Pace, on court',
    'Pace on',
    `Possessions per 48 minutes with the player on the floor, both teams' averaged: actual possessions over the time on the floor. ${DERIVED}`,
    base({
      value: '2880 * ({on_poss} + {on_opp_poss}) / 2.0 / nullif({on_secs}, 0)',
      sample: 'on_poss',
      minSample: MIN_POSS,
      direction: 'neutral'
    })
  ),
  metric(
    'onc_efg_pct',
    'Effective field-goal percentage, on court',
    'eFG% on',
    `The team's effective field-goal percentage with the player on the floor. ${DERIVED}`,
    base({
      value: '({on_fgm} + 0.5 * {on_fg3m}) / nullif({on_fga}, 0)',
      sample: 'on_fga',
      minSample: 1500,
      unit: 'pct'
    })
  ),
  metric(
    'onc_opp_efg_pct',
    'Opponent effective field-goal percentage, on court',
    'Opp eFG% on',
    `The opponents' effective field-goal percentage with the player on the floor. Lower is better. ${DERIVED}`,
    base({
      value: '({on_opp_fgm} + 0.5 * {on_opp_fg3m}) / nullif({on_opp_fga}, 0)',
      sample: 'on_opp_fga',
      minSample: 1500,
      unit: 'pct',
      direction: 'lower'
    })
  ),
  metric(
    'onc_tm_tov_pct',
    'Team turnover percentage, on court',
    'TM TOV% on',
    `The team's turnovers per possession with the player on the floor; a player's turnovers, as in the box score. ${DERIVED}`,
    base({
      value: ratio('on_tov', 'on_poss'),
      sample: 'on_poss',
      minSample: MIN_POSS,
      unit: 'pct',
      direction: 'lower'
    })
  ),
  metric(
    'onc_tm_orb_pct',
    'Team offensive rebound percentage, on court',
    'TM ORB% on',
    `The share of the team's missed shots it rebounded with the player on the floor; a player's rebounds, as in the box score. ${DERIVED}`,
    base({
      value: '{on_oreb} / nullif({on_oreb} + {on_opp_dreb}, 0)',
      sample: 'on_poss',
      minSample: MIN_POSS,
      unit: 'pct'
    })
  ),
  metric(
    'onc_usg_pct',
    'Usage, on court',
    'USG% on',
    `The share of the team's plays the player finished while on the floor: their field-goal attempts, 0.44 of their free-throw attempts and their turnovers over the team's on the floor. The actual count of what the usage percentage estimates from minutes. ${DERIVED}`,
    share('({p_fga} + 0.44 * {p_fta} + {p_tov}) / nullif({on_fga} + 0.44 * {on_fta} + {on_tov}, 0)')
  ),
  metric(
    'onc_ast_pct',
    'Assist percentage, on court',
    'AST% on',
    `The share of teammates' made shots the player assisted while on the floor: the actual count of what the assist percentage estimates. ${DERIVED}`,
    share('{p_ast} / nullif({on_fgm} - {p_fgm}, 0)')
  ),
  metric(
    'onc_orb_pct',
    'Offensive rebound percentage, on court',
    'ORB% on',
    `The share of the team's missed shots the player rebounded while on the floor: the actual count of what the offensive rebound percentage estimates. ${DERIVED}`,
    share('{p_oreb} / nullif({on_oreb} + {on_opp_dreb}, 0)')
  ),
  metric(
    'onc_drb_pct',
    'Defensive rebound percentage, on court',
    'DRB% on',
    `The share of the opponents' missed shots the player rebounded while on the floor. ${DERIVED}`,
    share('{p_dreb} / nullif({on_dreb} + {on_opp_oreb}, 0)')
  ),
  metric(
    'onc_trb_pct',
    'Total rebound percentage, on court',
    'TRB% on',
    `The share of all rebounds the player took while on the floor. ${DERIVED}`,
    share(
      '({p_oreb} + {p_dreb}) / nullif({on_oreb} + {on_dreb} + {on_opp_oreb} + {on_opp_dreb}, 0)'
    )
  ),
  metric(
    'onc_stl_pct',
    'Steal percentage, on court',
    'STL% on',
    `The player's steals per opponent possession while on the floor: the actual count of what the steal percentage estimates. ${DERIVED}`,
    share(ratio('p_stl', 'on_opp_poss'))
  ),
  metric(
    'onc_blk_pct',
    'Block percentage, on court',
    'BLK% on',
    `The share of the opponents' two-point attempts the player blocked while on the floor. ${DERIVED}`,
    share('{p_blk} / nullif({on_opp_fga} - {on_opp_fg3a}, 0)')
  )
]

/** What the on-court samples count, for a column's sample. */
export const ON_COURT_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  on_poss: 'possessions on court',
  on_opp_poss: 'opponent possessions on court',
  off_poss: 'possessions off court',
  off_opp_poss: 'opponent possessions off court',
  on_fga: 'team shots on court',
  on_opp_fga: 'opponent shots on court'
}
