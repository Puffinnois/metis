import { NCAA_PLAYER_SPLITS, NCAA_TEAM_SPLITS, type NcaaSplit } from '@shared/stats/ncaaSplits'

/**
 * stats.ncaa.org's counts that ESPN's box scores do not have, kept beside ESPN's on the college
 * leagues' `player_game` and `team_game` under their own names (D40, data policy 5): the shot zones
 * (at the rim, mid-range, three), putbacks, blocks by zone, the transition and assisted splits, and
 * the possessions. ESPN's counts stay the box score; these never replace or blend with them, so a rate
 * here divides stats.ncaa.org's counts by stats.ncaa.org's own (`ncaa_fga`, `ncaa_fgm`), never by
 * ESPN's. Each is the player box's column (`src_ncaa_player_box`), summed: rim, mid-range and three
 * attempts add up to the field-goal attempts on every line of the window (measured at T1302.5).
 *
 * `ncaa_games` counts the games with a stats.ncaa.org line, the divisor of a per-game split, since a
 * line can be missing where ESPN's is not (8 to 12 % of its players are not linked by the crosswalk,
 * most then matched by box score at T1302.4).
 */

/** Each column and the player box's column it sums. */
export const NCAA_PLAYER_COLUMNS: Readonly<Record<NcaaSplit, string>> = {
  ncaa_games: '1',
  ncaa_seconds: 'round(b.mins * 60)',
  ncaa_fgm: 'b.fgm',
  ncaa_fga: 'b.fga',
  ncaa_fg3m: 'b.tpm',
  ncaa_fg3a: 'b.tpa',
  ncaa_ftm: 'b.ftm',
  ncaa_fta: 'b.fta',
  ncaa_pts: 'b.pts',
  ncaa_tov: 'b.tov',
  ncaa_rimm: 'b.rimm',
  ncaa_rima: 'b.rima',
  ncaa_midm: 'b.midm',
  ncaa_mida: 'b.mida',
  ncaa_pbackm: 'b.pbackm',
  ncaa_pbacka: 'b.pbacka',
  ncaa_blk_rim: 'b.blk_rim',
  ncaa_blk_mid: 'b.blk_mid',
  ncaa_blk_three: 'b.blk_three',
  ncaa_fgm_trans: 'b.fgm_trans',
  ncaa_fga_trans: 'b.fga_trans',
  ncaa_fg3m_trans: 'b.tpm_trans',
  ncaa_fg3a_trans: 'b.tpa_trans',
  ncaa_rimm_trans: 'b.rimm_trans',
  ncaa_rima_trans: 'b.rima_trans',
  ncaa_ftm_trans: 'b.ftm_trans',
  ncaa_fta_trans: 'b.fta_trans',
  ncaa_pts_trans: 'b.pts_trans',
  ncaa_tov_trans: 'b.tov_trans',
  ncaa_fgm_ast: 'b.fgm_ast',
  ncaa_fg3m_ast: 'b.tpm_ast',
  ncaa_rimm_ast: 'b.rimm_ast',
  ncaa_midm_ast: 'b.midm_ast',
  ncaa_pts_ast: 'b.pts_ast',
  // The possessions the player was on the floor for, stats.ncaa.org's estimate.
  ncaa_poss: 'b.o_poss',
  // The rest of the transition splits, and the half-court ones (T1703.2). Half-court and transition
  // add up to the line's total on 99.95 % of lines (measured on every line of 2021-22 to 2026-27).
  // The unassisted splits are not read: each is the total less the assisted, on every line.
  ncaa_orb_trans: 'b.orb_trans',
  ncaa_drb_trans: 'b.drb_trans',
  ncaa_ast_trans: 'b.ast_trans',
  ncaa_stl_trans: 'b.stl_trans',
  ncaa_blk_trans: 'b.blk_trans',
  ncaa_midm_trans: 'b.midm_trans',
  ncaa_mida_trans: 'b.mida_trans',
  ncaa_pts_half: 'b.pts_half',
  ncaa_fgm_half: 'b.fgm_half',
  ncaa_fga_half: 'b.fga_half',
  ncaa_fg3m_half: 'b.tpm_half',
  ncaa_fg3a_half: 'b.tpa_half',
  ncaa_ftm_half: 'b.ftm_half',
  ncaa_fta_half: 'b.fta_half',
  ncaa_rimm_half: 'b.rimm_half',
  ncaa_rima_half: 'b.rima_half',
  ncaa_midm_half: 'b.midm_half',
  ncaa_mida_half: 'b.mida_half',
  ncaa_orb_half: 'b.orb_half',
  ncaa_drb_half: 'b.drb_half',
  ncaa_ast_half: 'b.ast_half',
  ncaa_stl_half: 'b.stl_half',
  ncaa_blk_half: 'b.blk_half',
  ncaa_tov_half: 'b.tov_half'
}

/** The columns `player_game` and `player_season` carry in the college leagues. */
export const NCAA_PLAYER_SUMS: readonly string[] = NCAA_PLAYER_SPLITS

/**
 * The team's own columns, each the sum of its players' lines, every line of the team's whether or
 * not its player is linked to ESPN's; `ncaa_poss` is the team box's possessions (`o_poss`) instead,
 * and the seconds are not kept, since a team's are the game's. `team_game` holds each for the
 * opponent as well (`opp_`).
 */
export const NCAA_TEAM_OWN: readonly string[] = NCAA_TEAM_SPLITS

/** Every column `team_game` and `team_season` carry in the college leagues. */
export const NCAA_TEAM_SUMS: readonly string[] = [
  ...NCAA_TEAM_OWN,
  ...NCAA_TEAM_OWN.map((c) => `opp_${c}`)
]

/** A count kept as a whole number; the possessions are an estimate, the seconds published to a hundredth. */
export const isNcaaWhole = (column: string): boolean =>
  column !== 'ncaa_poss' && column !== 'ncaa_off_seconds'
