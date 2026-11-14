import type { MetricDef } from '../types'
import { FIRST_SEASON, metric, type Opts } from './define'

/**
 * Reference sections 5 and 14.1 to 14.2: Dean Oliver's individual ratings, PER, Win Shares, BPM and
 * VORP, computed by Metis from its own box scores by the methods Basketball-Reference documents
 * (Plan T1005). They read `player_composite` and `team_composite`, one row per team and season type,
 * so they answer for whole seasons only: the regular season and the playoffs, each computed against
 * its own league, and any group of whole seasons, since every value is stored as parts that add up.
 */
const METIS =
  'Computed by Metis from the published method, from 1993-94; it can differ from the publisher’s own figure.'

const shared: Partial<Opts> = {
  family: 'box_composites',
  kind: 'model',
  sources: ["Computed by Metis from the box scores, by Basketball-Reference's published methods"],
  firstSeason: FIRST_SEASON,
  model: 'player_composite'
}

/** A value weighted by minutes: PER, BPM. */
const perMinute = (num: string, o: Partial<Opts> = {}): Opts => ({
  ...shared,
  value: `{${num}} / nullif({cmp_minutes}, 0)`,
  sample: 'minutes',
  minSample: 1000,
  ...o
})

/** A season total that adds up over seasons and teams: Win Shares, VORP. */
const total = (column: string, o: Partial<Opts> = {}): Opts => ({
  ...shared,
  value: `{${column}}`,
  sample: 'minutes',
  aggregation: 'sum',
  totalOnly: true,
  ...o
})

const team: Partial<Opts> = {
  entity: 'team',
  side: 'offense',
  model: 'team_composite',
  sample: 'box_games',
  minSample: undefined
}

export const BOX_COMPOSITES: MetricDef[] = [
  metric(
    'per',
    'Player Efficiency Rating',
    'PER',
    `John Hollinger's per-minute rating of everything in the box score, adjusted for pace and scaled so the league's average player reads 15. ${METIS}`,
    perMinute('per_num', { tier: 'core' })
  ),
  metric(
    'ows',
    'Offensive Win Shares',
    'OWS',
    `Wins credited to the player's offense: points produced above a baseline on the possessions used, divided by the points a win cost that season. ${METIS}`,
    total('ows')
  ),
  metric(
    'dws',
    'Defensive Win Shares',
    'DWS',
    `Wins credited to the player's defense, from their individual defensive rating and their share of the team's minutes. ${METIS}`,
    total('dws')
  ),
  metric(
    'ws',
    'Win Shares',
    'WS',
    `Offensive and defensive Win Shares together: the team's wins shared out by the box score. ${METIS}`,
    total('ws', { tier: 'core' })
  ),
  metric(
    'ws_48',
    'Win Shares per 48 minutes',
    'WS/48',
    `Win Shares per 48 minutes played; the league average is about 0.100. ${METIS}`,
    perMinute('ws', { value: '48 * {ws} / nullif({cmp_minutes}, 0)', decimals: 3 })
  ),
  metric(
    'bpm',
    'Box Plus/Minus',
    'BPM',
    `Points per 100 possessions above an average player, version 2.0: the box score weighed by estimated position and role, then adjusted so the team's players add up to its rating. ${METIS}`,
    perMinute('bpm_num', { tier: 'core' })
  ),
  metric(
    'obpm',
    'Offensive Box Plus/Minus',
    'OBPM',
    `The offensive part of BPM, from its own regression. ${METIS}`,
    perMinute('obpm_num')
  ),
  metric(
    'dbpm',
    'Defensive Box Plus/Minus',
    'DBPM',
    `BPM less offensive BPM. ${METIS}`,
    perMinute('bpm_num', { value: '({bpm_num} - {obpm_num}) / nullif({cmp_minutes}, 0)' })
  ),
  metric(
    'vorp',
    'Value Over Replacement Player',
    'VORP',
    `Points per 100 team possessions above a replacement player (BPM −2.0), times the share of the team's minutes played and its games out of 82. ${METIS}`,
    total('vorp', { tier: 'core' })
  ),
  metric(
    'pprod',
    'Points produced',
    'PProd',
    `Dean Oliver's estimate of the points a player's scoring possessions were worth, their assists and offensive rebounds included. ${METIS}`,
    total('pprod', { totalOnly: false, decimals: 0 })
  ),
  metric(
    'poss_used',
    'Possessions used',
    'TotPoss',
    `Dean Oliver's possessions a player ended: scoring possessions, missed shots the team did not rebound, missed free throws and turnovers. ${METIS}`,
    total('tot_poss', { totalOnly: false, decimals: 0, tier: 'extended' })
  ),
  metric(
    'scoring_poss',
    'Scoring possessions',
    'ScPoss',
    `Dean Oliver's possessions a player ended with a score, in part credited to assists and offensive rebounds. ${METIS}`,
    total('sc_poss', { totalOnly: false, decimals: 0 })
  ),
  metric(
    'floor_pct',
    'Floor percentage',
    'Floor%',
    `The share of the possessions a player used that scored. ${METIS}`,
    perMinute('sc_poss', { value: '{sc_poss} / nullif({tot_poss}, 0)', unit: 'pct' })
  ),
  metric(
    'ortg_ind',
    'Individual offensive rating',
    'ORtg',
    `Dean Oliver's points produced per 100 possessions used: the player's own efficiency, not the team's on the floor. ${METIS}`,
    perMinute('pprod', {
      value: '100 * {pprod} / nullif({tot_poss}, 0)',
      unit: 'rating',
      decimals: 0
    })
  ),
  metric(
    'drtg_ind',
    'Individual defensive rating',
    'DRtg',
    `Dean Oliver's points allowed per 100 possessions, from the team's defense and the player's stops; lower is better. ${METIS}`,
    perMinute('drtg_num', {
      value: '{drtg_num} / nullif({d_poss}, 0)',
      unit: 'rating',
      decimals: 0,
      direction: 'lower'
    })
  ),
  metric(
    'stops',
    'Stops',
    'Stops',
    `Dean Oliver's defensive stops: steals, blocks and defensive rebounds kept, and a share of the team's forced misses and turnovers. ${METIS}`,
    total('stops', { totalOnly: false, decimals: 0 })
  ),
  metric(
    'stop_pct',
    'Stop percentage',
    'Stop%',
    `Stops per defensive possession while on the floor. ${METIS}`,
    perMinute('stops', { value: '{stops} / nullif({d_poss}, 0)', unit: 'pct' })
  ),
  metric(
    'bpm_position',
    'BPM position estimate',
    'Pos',
    `BPM's estimate of where a player played, from 1 (point guard) to 5 (center), from their share of the team's rebounds, steals, fouls, assists and blocks. ${METIS}`,
    perMinute('position_num', { decimals: 2, direction: 'neutral', tier: 'stored' })
  ),
  metric(
    'bpm_role',
    'BPM offensive role',
    'Role',
    `BPM's estimate of a player's offensive role, from 1 (creates shots) to 5 (receives them), from their share of the team's assists and points above a shooting threshold. ${METIS}`,
    perMinute('role_num', { decimals: 2, direction: 'neutral', tier: 'stored' })
  ),
  metric(
    'team_ws',
    'Win Shares',
    'WS',
    `The players' Win Shares added up; set beside the team's wins, they need not be equal. ${METIS}`,
    total('ws', { ...team, tier: 'core' })
  ),
  metric(
    'team_ows',
    'Offensive Win Shares',
    'OWS',
    `The players' offensive Win Shares added up. ${METIS}`,
    total('ows', team)
  ),
  metric(
    'team_dws',
    'Defensive Win Shares',
    'DWS',
    `The players' defensive Win Shares added up. ${METIS}`,
    total('dws', team)
  ),
  metric(
    'team_vorp',
    'Value Over Replacement Player',
    'VORP',
    `The players' VORP added up. ${METIS}`,
    total('vorp', team)
  ),
  metric(
    'team_pprod',
    'Points produced',
    'PProd',
    `The players' points produced added up, set beside the team's points. ${METIS}`,
    total('pprod', { ...team, totalOnly: false, decimals: 0 })
  )
]
