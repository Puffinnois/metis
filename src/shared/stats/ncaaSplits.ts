/**
 * The names of stats.ncaa.org's counts the college leagues keep beside ESPN's box scores (D40): the
 * shot zones, putbacks, blocks by zone, the transition and assisted splits and the possessions. The
 * main process builds them (`src/main/stats/derived/ncaaSplits.ts`); the catalogue reads them.
 */
export const NCAA_PLAYER_SPLITS = [
  'ncaa_games',
  'ncaa_seconds',
  'ncaa_fgm',
  'ncaa_fga',
  'ncaa_fg3m',
  'ncaa_fg3a',
  'ncaa_ftm',
  'ncaa_fta',
  'ncaa_pts',
  'ncaa_tov',
  'ncaa_rimm',
  'ncaa_rima',
  'ncaa_midm',
  'ncaa_mida',
  'ncaa_pbackm',
  'ncaa_pbacka',
  'ncaa_blk_rim',
  'ncaa_blk_mid',
  'ncaa_blk_three',
  'ncaa_fgm_trans',
  'ncaa_fga_trans',
  'ncaa_fg3m_trans',
  'ncaa_fg3a_trans',
  'ncaa_rimm_trans',
  'ncaa_rima_trans',
  'ncaa_ftm_trans',
  'ncaa_fta_trans',
  'ncaa_pts_trans',
  'ncaa_tov_trans',
  'ncaa_fgm_ast',
  'ncaa_fg3m_ast',
  'ncaa_rimm_ast',
  'ncaa_midm_ast',
  'ncaa_pts_ast',
  'ncaa_poss',
  // T1703.2: the transition splits Metis did not read, and the half-court ones (D53).
  'ncaa_orb_trans',
  'ncaa_drb_trans',
  'ncaa_ast_trans',
  'ncaa_stl_trans',
  'ncaa_blk_trans',
  'ncaa_midm_trans',
  'ncaa_mida_trans',
  'ncaa_pts_half',
  'ncaa_fgm_half',
  'ncaa_fga_half',
  'ncaa_fg3m_half',
  'ncaa_fg3a_half',
  'ncaa_ftm_half',
  'ncaa_fta_half',
  'ncaa_rimm_half',
  'ncaa_rima_half',
  'ncaa_midm_half',
  'ncaa_mida_half',
  'ncaa_orb_half',
  'ncaa_drb_half',
  'ncaa_ast_half',
  'ncaa_stl_half',
  'ncaa_blk_half',
  'ncaa_tov_half'
] as const

export type NcaaSplit = (typeof NCAA_PLAYER_SPLITS)[number]

/**
 * The team's own: its players' summed, but the possessions are the team box's and the seconds are not
 * kept. `team_game` holds each for the opponent too (`opp_`).
 */
export const NCAA_TEAM_SPLITS: readonly string[] = [
  ...NCAA_PLAYER_SPLITS.filter((c) => c !== 'ncaa_seconds'),
  // The team box's own: the offence's time on the ball, in seconds (T1703.2). The opponent's is the
  // team's on defence, which the box also publishes (`d_mins`, equal on every game).
  'ncaa_off_seconds'
]

/** The source tables they come from, for a build that leaves the `ncaa_*` releases out (D41). */
export const NCAA_PLAYER_BOX = 'src_ncaa_player_box'
export const NCAA_TEAM_BOX = 'src_ncaa_team_box'
