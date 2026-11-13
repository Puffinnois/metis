import { beforeAll, describe, expect, it } from 'vitest'
import { gameTable } from '@main/stats/derived/gameTables'
import { OPP_SHOT_COMPONENTS, SHOT_COMPONENTS } from '@main/stats/derived/shots'
import { COMPONENTS, grainsOf } from '@main/stats/engine/registry'
import { CATALOGUE, componentsOf, coverageReason, covers, TOKEN } from '@shared/stats/catalogue'
import { PLAY_TYPE_SIDES } from '@shared/stats/playTypes'
import { SAMPLE_LABELS } from '@shared/stats/samples'
import { seasonLabel } from '@shared/stats/seasons'
import type { StatsDb } from '@main/stats/db'
import type { MetricDef } from '@shared/stats/types'
import { openTestDb } from '../../fixtures/stats'

/** One side's box score, in round numbers that keep each formula's parts apart. */
interface Side {
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  pts: number
}

const PLAYER: Side = {
  fgm: 20,
  fga: 40,
  fg3m: 5,
  fg3a: 16,
  ftm: 8,
  fta: 10,
  oreb: 3,
  dreb: 9,
  reb: 12,
  ast: 10,
  stl: 4,
  blk: 2,
  tov: 5,
  pf: 6,
  pts: 53
}
const TEAM: Side = {
  fgm: 80,
  fga: 170,
  fg3m: 25,
  fg3a: 70,
  ftm: 35,
  fta: 45,
  oreb: 20,
  dreb: 70,
  reb: 90,
  ast: 50,
  stl: 15,
  blk: 10,
  tov: 25,
  pf: 40,
  pts: 220
}
const OPP: Side = {
  fgm: 75,
  fga: 180,
  fg3m: 20,
  fg3a: 60,
  ftm: 30,
  fta: 40,
  oreb: 25,
  dreb: 60,
  reb: 85,
  ast: 40,
  stl: 12,
  blk: 8,
  tov: 30,
  pf: 42,
  pts: 200
}

const prefixed = (s: Side, p: string): Record<string, number> =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [`${p}${k}`, v]))

const tsa = (s: Side): number => s.fga + 0.44 * s.fta
const possOf = (s: Side): number => s.fga + 0.44 * s.fta - s.oreb + s.tov
const pieOf = (s: Side): number =>
  s.pts +
  s.fgm +
  s.ftm -
  s.fga -
  s.fta +
  s.dreb +
  0.5 * s.oreb +
  s.ast +
  s.stl +
  0.5 * s.blk -
  s.pf -
  s.tov

const SECONDS = 3600
const MINUTES = 60
const TEAM_SECONDS = 28800
const TEAM_MINUTES = 480
const POSS_SYM = 0.5 * (possOf(TEAM) + possOf(OPP))
const PIE_TOTAL = pieOf(TEAM) + pieOf(OPP)
const POSS_BREF = 180.5
const ON_POSS = 22.5

/** The stored components of a player's row. */
const PLAYER_ROW: Record<string, number> = {
  games: 2,
  starts: 1,
  wins: 1,
  losses: 1,
  seconds: SECONDS,
  minutes: MINUTES,
  ...prefixed(PLAYER, ''),
  ...prefixed(TEAM, 'tm_'),
  ...prefixed(OPP, 'opp_'),
  tm_seconds: TEAM_SECONDS,
  plus_minus: 7,
  dd2: 2,
  td3: 1,
  qd4: 0,
  five_by_five: 0,
  pie_total: PIE_TOTAL,
  x_ast_den: 30,
  x_orb_den: 12,
  x_drb_den: 16,
  x_trb_den: 28,
  x_stl_den: 22,
  x_blk_den: 15,
  x_usg_den: 40,
  on_poss: ON_POSS
}

/** The stored components of a team's row. */
const TEAM_ROW: Record<string, number> = {
  games: 3,
  box_games: 2,
  starts_known: 2,
  wins: 2,
  losses: 1,
  points_for: 310,
  points_against: 290,
  seconds: TEAM_SECONDS,
  minutes: TEAM_MINUTES,
  ...prefixed(TEAM, ''),
  ...prefixed(OPP, 'opp_'),
  poss: possOf(TEAM),
  opp_poss: possOf(OPP),
  poss_sym: POSS_SYM,
  poss_bref: POSS_BREF,
  paint_pts: 90,
  fast_break_pts: 30,
  turnover_pts: 25,
  opp_paint_pts: 80,
  opp_fast_break_pts: 20,
  opp_turnover_pts: 18,
  starter_pts: 150,
  bench_pts: 70,
  pie_total: PIE_TOTAL
}

/** Each formula the three sides share, written out again by hand from the reference. */
const SHARED: Record<string, (s: Side) => number> = {
  fgm: (s) => s.fgm,
  fga: (s) => s.fga,
  fg_pct: (s) => s.fgm / s.fga,
  fg_miss: (s) => s.fga - s.fgm,
  fg2m: (s) => s.fgm - s.fg3m,
  fg2a: (s) => s.fga - s.fg3a,
  fg2_pct: (s) => (s.fgm - s.fg3m) / (s.fga - s.fg3a),
  fg3m: (s) => s.fg3m,
  fg3a: (s) => s.fg3a,
  fg3_pct: (s) => s.fg3m / s.fg3a,
  ftm: (s) => s.ftm,
  fta: (s) => s.fta,
  ft_pct: (s) => s.ftm / s.fta,
  ft_miss: (s) => s.fta - s.ftm,
  oreb: (s) => s.oreb,
  dreb: (s) => s.dreb,
  reb: (s) => s.reb,
  ast: (s) => s.ast,
  tov: (s) => s.tov,
  stl: (s) => s.stl,
  blk: (s) => s.blk,
  pf: (s) => s.pf,
  efg_pct: (s) => (s.fgm + 0.5 * s.fg3m) / s.fga,
  tsa,
  ts_pct: (s) => s.pts / (2 * tsa(s)),
  pts_per_tsa: (s) => s.pts / tsa(s),
  fg_pts_per_fga: (s) => (2 * s.fgm + s.fg3m) / s.fga,
  pts_per_fga: (s) => s.pts / s.fga,
  fg3a_rate: (s) => s.fg3a / s.fga,
  fg2a_rate: (s) => (s.fga - s.fg3a) / s.fga,
  fta_rate: (s) => s.fta / s.fga,
  ftm_per_fga: (s) => s.ftm / s.fga,
  ast_tov: (s) => s.ast / s.tov,
  ast_ratio: (s) => s.ast / (tsa(s) + s.ast + s.tov),
  tov_pct: (s) => s.tov / (tsa(s) + s.tov),
  pts_2pt: (s) => 2 * (s.fgm - s.fg3m),
  pts_3pt: (s) => 3 * s.fg3m,
  pts_ft: (s) => s.ftm,
  share_pts_2pt: (s) => (2 * (s.fgm - s.fg3m)) / s.pts,
  share_pts_3pt: (s) => (3 * s.fg3m) / s.pts,
  share_pts_ft: (s) => s.ftm / s.pts,
  eff: (s) => s.pts + s.reb + s.ast + s.stl + s.blk - (s.fga - s.fgm) - (s.fta - s.ftm) - s.tov,
  gmsc: (s) =>
    s.pts +
    0.4 * s.fgm -
    0.7 * s.fga -
    0.4 * (s.fta - s.ftm) +
    0.7 * s.oreb +
    0.3 * s.dreb +
    s.stl +
    0.7 * s.ast +
    0.7 * s.blk -
    0.4 * s.pf -
    s.tov
}

const share = (c: keyof Side): number => PLAYER[c] / TEAM[c]

/** What each metric should read on these rows: a worked value for every id in the catalogue. */
const EXPECTED: Record<string, number> = {
  ...Object.fromEntries(Object.entries(SHARED).map(([id, f]) => [id, f(PLAYER)])),
  ...Object.fromEntries(Object.entries(SHARED).map(([id, f]) => [`team_${id}`, f(TEAM)])),
  ...Object.fromEntries(Object.entries(SHARED).map(([id, f]) => [`opp_${id}`, f(OPP)])),

  gp: 2,
  gs: 1,
  min: 60,
  w: 1,
  l: 1,
  win_pct: 0.5,
  pts: 53,
  plus_minus: 7,
  dd2: 2,
  td3: 1,
  qd4: 0,
  five_by_five: 0,
  ast_pct: 10 / 30,
  orb_pct: 3 / 12,
  drb_pct: 9 / 16,
  trb_pct: 12 / 28,
  stl_pct: 4 / 22,
  blk_pct: 2 / 15,
  usg_pct: (tsa(PLAYER) + PLAYER.tov) / 40,
  player_on_poss: ON_POSS,
  pie: pieOf(PLAYER) / PIE_TOTAL,
  share_pts: share('pts'),
  share_fgm: share('fgm'),
  share_fga: share('fga'),
  share_fg3m: share('fg3m'),
  share_fg3a: share('fg3a'),
  share_ftm: share('ftm'),
  share_fta: share('fta'),
  share_oreb: share('oreb'),
  share_dreb: share('dreb'),
  share_reb: share('reb'),
  share_ast: share('ast'),
  share_tov: share('tov'),
  share_stl: share('stl'),
  share_blk: share('blk'),
  share_pf: share('pf'),

  team_gp: 3,
  team_w: 2,
  team_l: 1,
  team_win_pct: 2 / 3,
  team_pts: 310,
  opp_pts: 290,
  team_point_diff: 20,
  team_ast_share: TEAM.ast / TEAM.fgm,
  opp_ast_share: OPP.ast / OPP.fgm,
  team_orb_pct: TEAM.oreb / (TEAM.oreb + OPP.dreb),
  team_drb_pct: TEAM.dreb / (TEAM.dreb + OPP.oreb),
  team_trb_pct: TEAM.reb / (TEAM.reb + OPP.reb),
  team_poss: possOf(TEAM),
  opp_poss: possOf(OPP),
  team_poss_sym: POSS_SYM,
  team_poss_bref: POSS_BREF,
  team_ortg: (100 * TEAM.pts) / POSS_SYM,
  team_drtg: (100 * OPP.pts) / POSS_SYM,
  team_nrtg: (100 * (TEAM.pts - OPP.pts)) / POSS_SYM,
  team_pace: (48 * POSS_SYM) / (TEAM_MINUTES / 5),
  team_pace40: (40 * POSS_SYM) / (TEAM_MINUTES / 5),
  team_ppp: TEAM.pts / POSS_SYM,
  opp_ppp: OPP.pts / POSS_SYM,
  team_paint_pts: 90,
  opp_paint_pts: 80,
  team_fast_break_pts: 30,
  opp_fast_break_pts: 20,
  team_turnover_pts: 25,
  opp_turnover_pts: 18,
  team_share_pts_paint: 90 / TEAM.pts,
  opp_share_pts_paint: 80 / OPP.pts,
  team_share_pts_fb: 30 / TEAM.pts,
  opp_share_pts_fb: 20 / OPP.pts,
  team_share_pts_tov: 25 / TEAM.pts,
  opp_share_pts_tov: 18 / OPP.pts,
  team_starter_pts: 150,
  team_bench_pts: 70,
  team_pie: pieOf(TEAM) / PIE_TOTAL
}

/**
 * The NBA's dashboards (`catalogue/dashboards.ts`): each metric, the published column it reads, and
 * what that column is stored over. A rate is stored times its minutes or possessions, so it reads back
 * as the column over that divisor; a count reads as it is.
 */
const DASHBOARD_COLUMNS = `
  nba_ortg off_rating possessions; nba_drtg def_rating possessions; nba_nrtg net_rating possessions
  nba_e_ortg e_off_rating possessions; nba_e_drtg e_def_rating possessions
  nba_e_nrtg e_net_rating possessions; nba_pace pace minutes; nba_e_pace e_pace minutes
  nba_ast_pct ast_pct minutes; nba_ast_to ast_to minutes; nba_ast_ratio ast_ratio minutes
  nba_oreb_pct oreb_pct minutes; nba_dreb_pct dreb_pct minutes; nba_reb_pct reb_pct minutes
  nba_efg_pct efg_pct minutes; nba_ts_pct ts_pct minutes; nba_pie pie minutes
  nba_tov_ratio tm_tov_pct minutes; nba_e_tov_ratio e_tov_pct minutes
  nba_usg_pct usg_pct minutes; nba_e_usg_pct e_usg_pct minutes; nba_poss possessions -
  team_nba_ortg off_rating possessions; team_nba_drtg def_rating possessions
  team_nba_nrtg net_rating possessions; team_nba_e_ortg e_off_rating possessions
  team_nba_e_drtg e_def_rating possessions; team_nba_e_nrtg e_net_rating possessions
  team_nba_pace pace minutes; team_nba_e_pace e_pace minutes; team_nba_ast_pct ast_pct minutes
  team_nba_ast_to ast_to minutes; team_nba_ast_ratio ast_ratio minutes
  team_nba_oreb_pct oreb_pct minutes; team_nba_dreb_pct dreb_pct minutes
  team_nba_reb_pct reb_pct minutes; team_nba_efg_pct efg_pct minutes; team_nba_ts_pct ts_pct minutes
  team_nba_pie pie minutes; team_nba_tov_pct tm_tov_pct minutes; team_nba_poss possessions -
  team_nba_fta_rate fta_rate minutes; opp_nba_efg_pct opp_efg_pct minutes
  opp_nba_fta_rate opp_fta_rate minutes; opp_nba_tov_pct opp_tov_pct minutes
  opp_nba_oreb_pct opp_oreb_pct minutes
  nba_pts_off_tov pts_off_tov -; nba_pts_2_nd_chance pts_2_nd_chance -; nba_pts_fb pts_fb -
  nba_pts_paint pts_paint -; nba_on_opp_pts_off_tov opp_pts_off_tov -
  nba_on_opp_pts_2_nd_chance opp_pts_2_nd_chance -; nba_on_opp_pts_fb opp_pts_fb -
  nba_on_opp_pts_paint opp_pts_paint -; nba_blka blka -; nba_pfd pfd -
  team_nba_pts_off_tov pts_off_tov -; team_nba_pts_2_nd_chance pts_2_nd_chance -
  team_nba_pts_fb pts_fb -; team_nba_pts_paint pts_paint -; opp_nba_pts_off_tov opp_pts_off_tov -
  opp_nba_pts_2_nd_chance opp_pts_2_nd_chance -; opp_nba_pts_fb opp_pts_fb -
  opp_nba_pts_paint opp_pts_paint -
  nba_share_fga_2pt pct_fga_2_pt minutes; nba_share_fga_3pt pct_fga_3_pt minutes
  nba_share_pts_2pt pct_pts_2_pt minutes; nba_share_pts_mid pct_pts_2_pt_mr minutes
  nba_share_pts_3pt pct_pts_3_pt minutes; nba_share_pts_ft pct_pts_ft minutes
  nba_share_pts_fb pct_pts_fb minutes; nba_share_pts_off_tov pct_pts_off_tov minutes
  nba_share_pts_paint pct_pts_paint minutes; nba_share_ast_2pm pct_ast_2_pm minutes
  nba_share_uast_2pm pct_uast_2_pm minutes; nba_share_ast_3pm pct_ast_3_pm minutes
  nba_share_uast_3pm pct_uast_3_pm minutes; nba_share_ast_fgm pct_ast_fgm minutes
  nba_share_uast_fgm pct_uast_fgm minutes
  team_nba_share_fga_2pt pct_fga_2_pt minutes; team_nba_share_fga_3pt pct_fga_3_pt minutes
  team_nba_share_pts_2pt pct_pts_2_pt minutes; team_nba_share_pts_mid pct_pts_2_pt_mr minutes
  team_nba_share_pts_3pt pct_pts_3_pt minutes; team_nba_share_pts_ft pct_pts_ft minutes
  team_nba_share_pts_fb pct_pts_fb minutes; team_nba_share_pts_off_tov pct_pts_off_tov minutes
  team_nba_share_pts_paint pct_pts_paint minutes; team_nba_share_ast_2pm pct_ast_2_pm minutes
  team_nba_share_uast_2pm pct_uast_2_pm minutes; team_nba_share_ast_3pm pct_ast_3_pm minutes
  team_nba_share_uast_3pm pct_uast_3_pm minutes; team_nba_share_ast_fgm pct_ast_fgm minutes
  team_nba_share_uast_fgm pct_uast_fgm minutes
  nba_share_fgm pct_fgm minutes; nba_share_fga pct_fga minutes; nba_share_fg3m pct_fg3_m minutes
  nba_share_fg3a pct_fg3_a minutes; nba_share_ftm pct_ftm minutes; nba_share_fta pct_fta minutes
  nba_share_oreb pct_oreb minutes; nba_share_dreb pct_dreb minutes; nba_share_reb pct_reb minutes
  nba_share_ast pct_ast minutes; nba_share_tov pct_tov minutes; nba_share_stl pct_stl minutes
  nba_share_blk pct_blk minutes; nba_share_blka pct_blka minutes; nba_share_pf pct_pf minutes
  nba_share_pfd pct_pfd minutes; nba_share_pts pct_pts minutes
  nba_def_ws def_ws -`
  .split(/[;\n]/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 3)

/**
 * Player tracking (`catalogue/tracking.ts`): each metric, the column it reads and what it divides by,
 * a tracked count or the minutes. Written out by hand so a formula over the wrong part fails.
 */
const TRACKING_COLUMNS = `
  dist_miles dist_miles -; dist_miles_off dist_miles_off -; dist_miles_def dist_miles_def -
  avg_speed avg_speed minutes; avg_speed_off avg_speed_off minutes
  avg_speed_def avg_speed_def minutes
  touches touches -; front_ct_touches front_ct_touches -; time_of_poss time_of_poss -
  sec_per_touch avg_sec_per_touch touches; drib_per_touch avg_drib_per_touch touches
  pts_per_touch points touches
  drives drives -; drive_fgm drive_fgm -; drive_fga drive_fga -; drive_fg_pct drive_fgm drive_fga
  drive_ftm drive_ftm -; drive_fta drive_fta -; drive_ft_pct drive_ftm drive_fta
  drive_pts drive_pts -; drive_pts_per_drive drive_pts drives
  drive_passes drive_passes -; drive_passes_pct drive_passes drives; drive_ast drive_ast -
  drive_ast_pct drive_ast drives; drive_tov drive_tov -; drive_tov_pct drive_tov drives
  drive_pf drive_pf -; drive_pf_pct drive_pf drives
  passes_made passes_made -; passes_received passes_received -; potential_ast potential_ast -
  secondary_ast secondary_ast -; ft_ast ft_ast -; ast_pts_created ast_pts_created -
  ast_adj ast_adj -; ast_per_pass ast passes_made; ast_adj_per_pass ast_adj passes_made
  potential_ast_conv ast potential_ast
  catch_shoot_fgm catch_shoot_fgm -; catch_shoot_fga catch_shoot_fga -
  catch_shoot_fg_pct catch_shoot_fgm catch_shoot_fga; catch_shoot_fg3m catch_shoot_fg3_m -
  catch_shoot_fg3a catch_shoot_fg3_a -; catch_shoot_fg3_pct catch_shoot_fg3_m catch_shoot_fg3_a
  catch_shoot_pts catch_shoot_pts -
  pull_up_fgm pull_up_fgm -; pull_up_fga pull_up_fga -; pull_up_fg_pct pull_up_fgm pull_up_fga
  pull_up_fg3m pull_up_fg3_m -; pull_up_fg3a pull_up_fg3_a -
  pull_up_fg3_pct pull_up_fg3_m pull_up_fg3_a; pull_up_pts pull_up_pts -
  eff_catch_shoot_pts catch_shoot_pts -; eff_pull_up_pts pull_up_pts -
  eff_catch_shoot_fg_pct catch_shoot_fg_pct minutes; eff_pull_up_fg_pct pull_up_fg_pct minutes
  eff_efg_pct eff_fg_pct minutes
  def_rim_fgm def_rim_fgm -; def_rim_fga def_rim_fga -; def_rim_fg_pct def_rim_fgm def_rim_fga
  ${['reb', 'oreb', 'dreb']
    .map(
      (r) =>
        `${r}_contest ${r}_contest -; ${r}_uncontest ${r}_uncontest -; ${r}_chances ${r}_chances -;` +
        `${r}_chance_defer ${r}_chance_defer -; ${r}_contest_pct ${r}_contest ${r};` +
        `${r}_chance_pct ${r} ${r}_chances; avg_${r}_dist avg_${r}_dist ${r}`
    )
    .join('\n')}
  ${['elbow', 'post', 'paint']
    .map((a) => {
      const t = `${a}_touch`
      return (
        `${a}_touches ${a}_touches -; ${t}_fg_pct ${t}_fgm ${t}_fga; ${t}_ft_pct ${t}_ftm ${t}_fta;` +
        `${t}_pts_per_touch ${t}_pts ${a}_touches; ${t}_pass_pct ${t}_passes ${a}_touches;` +
        `${t}_ast_pct ${t}_ast ${a === 'elbow' ? `${t}_passes` : `${a}_touches`};` +
        `${t}_tov_pct ${t}_tov ${a}_touches; ${t}_foul_pct ${t}_fouls ${a}_touches;` +
        ['fgm', 'fga', 'ftm', 'fta', 'pts', 'passes', 'ast', 'tov', 'fouls']
          .map((c) => `${t}_${c} ${t}_${c} -`)
          .join(';')
      )
    })
    .join('\n')}`
  .split(/[;\n]/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 3)

/** Hustle (`catalogue/hustle.ts`): players' and teams' counts read the same columns. */
const HUSTLE_COLUMNS = `
  ${[
    ['contested_shots', 'contested_shots'],
    ['contested_shots_2pt', 'contested_shots_2_pt'],
    ['contested_shots_3pt', 'contested_shots_3_pt'],
    ['deflections', 'deflections'],
    ['charges_drawn', 'charges_drawn'],
    ['screen_assists', 'screen_assists'],
    ['screen_ast_pts', 'screen_ast_pts'],
    ['loose_balls', 'loose_balls_recovered'],
    ['off_loose_balls', 'off_loose_balls_recovered'],
    ['def_loose_balls', 'def_loose_balls_recovered'],
    ['box_outs', 'box_outs'],
    ['off_box_outs', 'off_boxouts'],
    ['def_box_outs', 'def_boxouts']
  ]
    .map(([id, c]) => `${id} ${c} -; team_${id} ${c} -`)
    .join(';')}
  off_loose_balls_pct off_loose_balls_recovered loose_balls_recovered
  team_off_loose_balls_pct off_loose_balls_recovered loose_balls_recovered
  off_box_outs_pct off_boxouts box_outs; team_off_box_outs_pct off_boxouts box_outs
  box_out_team_rebs box_out_player_team_rebs -; box_out_rebs box_out_player_rebs -
  box_out_team_reb_pct pct_box_outs_team_reb box_outs; box_out_reb_pct pct_box_outs_reb box_outs`
  .split(/[;\n]/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 3)

/**
 * Play types (`catalogue/playTypes.ts`): for each type and side, every measure and the columns it
 * divides. Written out per measure, so a formula over the wrong part fails.
 */
const PLAY_TYPE_COLUMNS = PLAY_TYPE_SIDES.flatMap(({ key: k }) =>
  [
    ['poss', `${k}_poss`, '-'],
    ['freq', `${k}_freq_poss`, `${k}_all_poss`],
    ['pts', `${k}_pts`, '-'],
    ['ppp', `${k}_pts`, `${k}_poss`],
    ['fgm', `${k}_fgm`, '-'],
    ['fga', `${k}_fga`, '-'],
    ['fg_pct', `${k}_fgm`, `${k}_fga`],
    ['efg_pct', `${k}_efg_w`, `${k}_fga`],
    ['ft_freq', `${k}_ft_w`, `${k}_poss`],
    ['tov_freq', `${k}_tov_w`, `${k}_poss`],
    ['sf_freq', `${k}_sf_w`, `${k}_poss`],
    ['and1_freq', `${k}_and1_w`, `${k}_poss`],
    ['score_freq', `${k}_score_w`, `${k}_poss`]
  ].map(([m, c, by]) => [`pt_${k}_${m}`, c, by])
)

/**
 * Matchups (`catalogue/matchups.ts`): a defender's counts, their rates, and the shares by position. The
 * points per 100 are worked out below.
 */
const MATCHUP_COLUMNS = `
  matchup_min matchup_minutes -; matchup_poss possessions -; matchup_pts player_pts -
  matchup_team_pts team_pts -; matchup_fgm matchup_fgm -; matchup_fga matchup_fga -
  matchup_fg_pct matchup_fgm matchup_fga; matchup_fg3m matchup_fg3_m -; matchup_fg3a matchup_fg3_a -
  matchup_fg3_pct matchup_fg3_m matchup_fg3_a; matchup_ftm matchup_ftm -; matchup_fta matchup_fta -
  matchup_ast matchup_ast -; matchup_tov matchup_tov -; matchup_blk matchup_blk -; matchup_sfl sfl -
  ${['g', 'f', 'c']
    .map(
      (p) =>
        `matchup_${p}_time_pct pos_${p}_minutes pos_all_minutes;` +
        `matchup_${p}_fg_pct pos_${p}_fgm pos_${p}_fga`
    )
    .join(';')}`
  .split(/[;\n]/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 3)

/** The matchup points per 100 partial possessions, and the columns they divide. */
const MATCHUP_PER_100 = [
  ['matchup_pts_per_100', 'player_pts', 'possessions'],
  ...['g', 'f', 'c'].map((p) => [`matchup_${p}_pts_per_100`, `pos_${p}_pts`, `pos_${p}_poss`])
]

/**
 * SportsDataverse's impact models (`catalogue/impact.ts`): each stored times what it was fitted on, so
 * it reads back over that; WAR is added up; DARKO is stored times games.
 */
const IMPACT_COLUMNS = `
  sdv_rapm rapm impact_poss; sdv_o_rapm o_rapm off_poss; sdv_d_rapm d_rapm def_poss
  sdv_adj_rapm adj_rapm impact_poss; sdv_o_adj_rapm o_adj_rapm off_poss
  sdv_d_adj_rapm d_adj_rapm def_poss; sdv_spm spm minutes; sdv_ospm ospm minutes
  sdv_dspm dspm minutes; sdv_bpm bpm minutes; sdv_obpm obpm minutes; sdv_dbpm dbpm minutes
  sdv_war war -; sdv_darko_skill darko_filtered_skill games
  sdv_darko_next darko_projected_rating games; sdv_darko_sd darko_projected_sd games`
  .split(/[;\n]/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 3)

/** Games out (`catalogue/availability.ts`): counts of games, summed as published. */
const AVAILABILITY_COLUMNS = [
  ['games_out_injury', 'games_out_injury', '-'],
  ['games_out_other', 'games_out_other', '-']
]

/** One published row: a different value in every column, so a metric reading the wrong one fails. */
const PUBLISHED_ROW: Record<string, number> = {
  games: 50,
  minutes: 2000,
  possessions: 4000,
  ...Object.fromEntries(
    [
      ...new Set(
        [
          ...DASHBOARD_COLUMNS,
          ...TRACKING_COLUMNS,
          ...HUSTLE_COLUMNS,
          ...PLAY_TYPE_COLUMNS,
          ...MATCHUP_COLUMNS,
          ...MATCHUP_PER_100,
          ...IMPACT_COLUMNS,
          ...AVAILABILITY_COLUMNS
        ]
          .flatMap(([, c, by]) => [c, by])
          .filter((c) => !['-', 'games', 'minutes', 'possessions'].includes(c))
      )
    ].map((c, i) => [c, 1000 + 37 * i])
  )
}

/** The worked-out ones: eFG% counts a three as one and a half makes, chances leave out deferred ones. */
const efgOf = (p: string): number =>
  (PUBLISHED_ROW[`${p}_fgm`] + 0.5 * PUBLISHED_ROW[`${p}_fg3_m`]) / PUBLISHED_ROW[`${p}_fga`]
const adjChanceOf = (r: string): number =>
  PUBLISHED_ROW[r] / (PUBLISHED_ROW[`${r}_chances`] - PUBLISHED_ROW[`${r}_chance_defer`])

Object.assign(EXPECTED, {
  ...Object.fromEntries(
    [
      ...DASHBOARD_COLUMNS,
      ...TRACKING_COLUMNS,
      ...HUSTLE_COLUMNS,
      ...PLAY_TYPE_COLUMNS,
      ...MATCHUP_COLUMNS,
      ...IMPACT_COLUMNS,
      ...AVAILABILITY_COLUMNS
    ].map(([id, c, by]) => [
      id,
      by === '-' ? PUBLISHED_ROW[c] : PUBLISHED_ROW[c] / PUBLISHED_ROW[by]
    ])
  ),
  ...Object.fromEntries(
    MATCHUP_PER_100.map(([id, c, by]) => [id, (100 * PUBLISHED_ROW[c]) / PUBLISHED_ROW[by]])
  ),
  nba_pace40: (40 * PUBLISHED_ROW.pace) / PUBLISHED_ROW.minutes / 48,
  team_nba_pace40: (40 * PUBLISHED_ROW.pace) / PUBLISHED_ROW.minutes / 48,
  catch_shoot_efg_pct: efgOf('catch_shoot'),
  pull_up_efg_pct: efgOf('pull_up'),
  reb_chance_pct_adj: adjChanceOf('reb'),
  oreb_chance_pct_adj: adjChanceOf('oreb'),
  dreb_chance_pct_adj: adjChanceOf('dreb')
})

/**
 * One player's line in `player_on_court` (`catalogue/onCourt.ts`): the team on and off the floor and
 * the player's own counts, in round numbers that keep each formula's parts apart.
 */
const ON_COURT_ROW: Record<string, number> = {
  games: 60,
  minutes: 1500,
  on_secs: 90000,
  on_poss: 3000,
  on_opp_poss: 2990,
  on_pts: 3450,
  on_opp_pts: 3300,
  on_fgm: 1250,
  on_fga: 2600,
  on_fg3m: 400,
  on_fg3a: 1100,
  on_fta: 700,
  on_tov: 420,
  on_oreb: 300,
  on_dreb: 900,
  on_opp_oreb: 280,
  on_opp_dreb: 950,
  on_opp_fgm: 1200,
  on_opp_fga: 2550,
  on_opp_fg3m: 380,
  on_opp_fg3a: 1050,
  off_poss: 1000,
  off_opp_poss: 1010,
  off_pts: 1100,
  off_opp_pts: 1120,
  p_fgm: 300,
  p_fga: 600,
  p_fta: 200,
  p_tov: 90,
  p_ast: 250,
  p_oreb: 40,
  p_dreb: 180,
  p_stl: 45,
  p_blk: 30
}

const ON_DRTG = (100 * 3300) / 2990
const OFF_DRTG = (100 * 1120) / 1010

Object.assign(EXPECTED, {
  onc_min: 1500,
  onc_poss: 3000,
  onc_plus_minus: 150,
  onc_ortg: 115,
  onc_drtg: ON_DRTG,
  onc_net: 115 - ON_DRTG,
  offc_ortg: 110,
  offc_drtg: OFF_DRTG,
  offc_net: 110 - OFF_DRTG,
  onoff_ortg: 5,
  onoff_drtg: ON_DRTG - OFF_DRTG,
  onoff_net: 115 - ON_DRTG - (110 - OFF_DRTG),
  onc_pace: (2880 * (3000 + 2990)) / 2 / 90000,
  onc_efg_pct: (1250 + 200) / 2600,
  onc_opp_efg_pct: (1200 + 190) / 2550,
  onc_tm_tov_pct: 420 / 3000,
  onc_tm_orb_pct: 300 / (300 + 950),
  onc_usg_pct: (600 + 0.44 * 200 + 90) / (2600 + 0.44 * 700 + 420),
  onc_ast_pct: 250 / (1250 - 300),
  onc_orb_pct: 40 / (300 + 950),
  onc_drb_pct: 180 / (900 + 280),
  onc_trb_pct: (40 + 180) / (300 + 900 + 280 + 950),
  onc_stl_pct: 45 / 2990,
  onc_blk_pct: 30 / (2550 - 1050)
})

/**
 * Shot zones (`catalogue/shots.ts`): every count of the shot tables, both sides, a different number
 * each, so a formula over the wrong count fails. The expected makes and points are stored in
 * thousandths.
 */
const SHOT_ROW: Record<string, number> = Object.fromEntries(
  [...SHOT_COMPONENTS, ...OPP_SHOT_COMPONENTS].map((c, i) => [
    c,
    /x(fgm|pts)$/.test(c) ? 50_000 + 1_013 * i : 100 + 7 * i
  ])
)

/** Each measure of a zone, band or type, written out from reference section 7. */
const SHOT_MEASURES: Record<
  string,
  (r: (m: string) => number, all: (m: string) => number) => number
> = {
  fga: (r) => r('fga'),
  fgm: (r) => r('fgm'),
  fg_pct: (r) => r('fgm') / r('fga'),
  freq: (r, all) => r('fga') / all('shots_fga'),
  pps: (r) => r('pts') / r('fga'),
  efg_pct: (r) => r('pts') / (2 * r('fga')),
  fg_rel: (r) => (r('fgm') - r('xfgm') / 1000) / r('fga'),
  pps_rel: (r) => (r('pts') - r('xpts') / 1000) / r('fga'),
  ast_pct: (r) => r('ast') / r('fgm')
}

function shotExpected(id: string): number {
  const [, side, rest] = /^(team_shot_|opp_shot_|shot_)(.+)$/.exec(id) ?? []
  const p = side === 'opp_shot_' ? 'opp_' : ''
  const all = (c: string): number => SHOT_ROW[`${p}${c}`]
  if (rest === 'avg_dist') return all('dist_sum') / all('dist_n')
  if (rest === 'pts_above') return all('shots_pts') - all('shots_xpts') / 1000
  if (rest === 'pps_above') return (all('shots_pts') - all('shots_xpts') / 1000) / all('shots_fga')
  const measure = Object.keys(SHOT_MEASURES)
    .sort((a, b) => b.length - a.length)
    .find((m) => rest.endsWith(`_${m}`))
  if (!measure) throw new Error(`${id}: no measure`)
  const key = rest.slice(0, -(measure.length + 1))
  return SHOT_MEASURES[measure]((m) => SHOT_ROW[`${p}${key}_${m}`], all)
}

Object.assign(
  EXPECTED,
  Object.fromEntries(
    CATALOGUE.filter((m) => m.family === 'shots').map((m) => [m.id, shotExpected(m.id)])
  )
)

const fill = (m: MetricDef, row: Record<string, number>): string =>
  m.value.replace(TOKEN, (_, c: string) => {
    if (!(c in row)) throw new Error(`${m.id}: no ${c} in the worked row`)
    return `${row[c]}`
  })

describe('the metric catalogue', () => {
  it('has unique ids, for players and teams', () => {
    const ids = CATALOGUE.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CATALOGUE.filter((m) => m.entity === 'player').length).toBeGreaterThan(70)
    expect(CATALOGUE.filter((m) => m.entity === 'team').length).toBeGreaterThan(90)
  })

  it('computes every metric from components the tables hold, at the grains it has', () => {
    for (const m of CATALOGUE) {
      // A built table holds the counts, the box scores the rest, at both grains.
      if (m.built) {
        const built = gameTable(m.built)
        expect(grainsOf(m), m.id).toEqual(['game', 'season'])
        for (const c of componentsOf(m)) {
          expect(
            built?.components.includes(c) || COMPONENTS[m.entity].has(c),
            `${m.id}: ${c}`
          ).toBe(true)
        }
        continue
      }
      // A published metric has only the season, and `grainsOf` checks its table holds the components;
      // one a game table holds too answers at the game grain from it.
      if (m.published) {
        const games = gameTable(m.publishedGames)
        expect(grainsOf(m), m.id).toEqual(games ? ['game', 'season'] : ['season'])
        for (const c of games ? componentsOf(m) : []) {
          expect(games?.components, `${m.id}: ${c}`).toContain(c)
        }
        continue
      }
      expect(grainsOf(m), m.id).toEqual(['game', 'season'])
      for (const c of componentsOf(m)) expect(COMPONENTS[m.entity], `${m.id}: ${c}`).toContain(c)
    }
  })

  it('states the fields of reference section 19.4 on every metric', () => {
    for (const m of CATALOGUE) {
      expect(m.description, m.id).toMatch(/^[A-Z].+[.)]$/)
      expect(m.label.length, m.id).toBeGreaterThan(1)
      expect(m.short.length, m.id).toBeLessThanOrEqual(14)
      expect(['recorded', 'derived', 'estimated', 'model'], m.id).toContain(m.kind)
      expect(['sum', 'ratio'], m.id).toContain(m.aggregation)
      expect(m.sources.length, m.id).toBeGreaterThan(0)
      expect(m.firstSeason, m.id).toBeGreaterThanOrEqual(1994)
      if (m.entity === 'team') expect(m.side, m.id).toBeDefined()
      if (m.entity === 'team') expect(m.minSample, m.id).toBeUndefined()
    }
  })

  it('gives every player rate a minimum to qualify', () => {
    const none = CATALOGUE.filter(
      (m) =>
        m.entity === 'player' && m.aggregation === 'ratio' && m.sample !== 'games' && !m.minSample
    ).map((m) => m.id)
    expect(none).toEqual([])
  })

  it('names what every sample counts', () => {
    const unnamed = CATALOGUE.filter((m) => !SAMPLE_LABELS[m.sample]).map(
      (m) => `${m.id}: ${m.sample}`
    )
    expect(unnamed).toEqual([])
  })

  it("flips an opponent's direction, and reads their side of the game", () => {
    const m = (id: string): MetricDef => CATALOGUE.find((x) => x.id === id)!
    expect(m('team_efg_pct')).toMatchObject({ direction: 'higher', side: 'offense' })
    expect(m('opp_efg_pct')).toMatchObject({
      direction: 'lower',
      side: 'defense',
      label: 'Opponent effective field-goal percentage',
      sample: 'opp_fga'
    })
    expect(m('team_tov')).toMatchObject({ direction: 'lower' })
    expect(m('opp_tov')).toMatchObject({ direction: 'higher', sample: 'box_games' })
    expect(m('opp_fga').value).toBe('{opp_fga}')
  })

  it('divides a team’s counts by its box scores, and its points by its games', () => {
    const m = (id: string): MetricDef => CATALOGUE.find((x) => x.id === id)!
    expect(m('team_ast').perGameBy).toBe('box_games')
    expect(m('team_pts').perGameBy).toBeUndefined()
    expect(m('team_bench_pts').perGameBy).toBe('starts_known')
  })

  it('says on every impact model’s column head and label that it is SportsDataverse’s', () => {
    const impact = CATALOGUE.filter((m) => m.family === 'impact')
    expect(impact).toHaveLength(16)
    for (const m of impact) {
      expect(m.short, m.id).toMatch(/ SDV$/)
      expect(m.label, m.id).toMatch(/\(SportsDataverse\)$/)
      expect(m.description, m.id).toContain('SportsDataverse’s own calculation')
      expect(m.sources, m.id).toEqual(["SportsDataverse's impact models"])
    }
    // DARKO is one regular season's state, so it answers for one season at a time.
    expect(impact.filter((m) => m.oneSeason).map((m) => m.id)).toEqual([
      'sdv_darko_skill',
      'sdv_darko_next',
      'sdv_darko_sd'
    ])
    expect(impact.filter((m) => m.oneSeason).every((m) => m.published === 'pub_player_darko')).toBe(
      true
    )
    // The dataset dropped DARKO's columns in November 2026: the three answer with that reason.
    for (const m of impact.filter((x) => x.oneSeason)) {
      expect(m.unavailable, m.id).toBe('The dataset no longer publishes DARKO.')
      expect(m.description, m.id).toContain('November 2026')
    }
  })

  it('reads a play type on defense from the defender’s side', () => {
    const m = (id: string): MetricDef => CATALOGUE.find((x) => x.id === id)!
    expect(m('pt_iso_ppp')).toMatchObject({ direction: 'higher', published: 'pub_player_pt_iso' })
    expect(m('pt_d_iso_ppp')).toMatchObject({
      direction: 'lower',
      label: 'Isolation defense points per possession',
      published: 'pub_player_pt_d_iso',
      sample: 'd_iso_poss'
    })
    expect(m('pt_iso_tov_freq').direction).toBe('lower')
    expect(m('pt_d_iso_tov_freq').direction).toBe('higher')
    expect(m('pt_d_iso_freq').direction).toBe('neutral')
    // Seven types are published on defense, eleven on offense, each with thirteen measures.
    const ppp = CATALOGUE.filter((x) => x.family === 'play_types' && x.id.endsWith('_ppp'))
    expect(ppp.filter((x) => x.id.startsWith('pt_d_'))).toHaveLength(7)
    expect(CATALOGUE.filter((x) => x.family === 'play_types')).toHaveLength(18 * 13)
  })
})

describe('every formula, against a value worked by hand', () => {
  let db: StatsDb
  let values: Record<string, number | null>

  beforeAll(async () => {
    db = await openTestDb()
    const columns = CATALOGUE.map(
      (m) =>
        `(${fill(m, m.published ? PUBLISHED_ROW : m.family === 'on_court' ? ON_COURT_ROW : m.built ? SHOT_ROW : m.entity === 'player' ? PLAYER_ROW : TEAM_ROW)})::DOUBLE AS "${m.id}"`
    )
    values = (await db.get<Record<string, number | null>>(`SELECT ${columns.join(', ')}`)) ?? {}
  })

  it('has a worked value for every metric, and none for a metric that is gone', () => {
    const ids = CATALOGUE.map((m) => m.id)
    expect(ids.filter((id) => !(id in EXPECTED))).toEqual([])
    expect(Object.keys(EXPECTED).filter((id) => !ids.includes(id))).toEqual([])
  })

  it.each(CATALOGUE.map((m) => [m.id] as const))('%s', (id) => {
    expect(values[id]).toBeCloseTo(EXPECTED[id], 6)
  })

  it('reads a ratio with nothing under it as null, not Infinity', async () => {
    const zeros = (m: MetricDef): string => m.value.replace(TOKEN, () => '0')
    const ratios = CATALOGUE.filter((m) => m.aggregation === 'ratio')
    const row = await db.get<Record<string, number | null>>(
      `SELECT ${ratios.map((m) => `(${zeros(m)})::DOUBLE AS "${m.id}"`).join(', ')}`
    )
    expect(ratios.filter((m) => row?.[m.id] !== null).map((m) => m.id)).toEqual([])
  })
})

describe('coverage', () => {
  const plusMinus = { firstSeason: 1997 }
  const paint = { firstSeason: 2009, missingSeasons: [2018] }

  it('knows the seasons a metric has', () => {
    expect(covers(plusMinus, 1996)).toBe(false)
    expect(covers(plusMinus, 1997)).toBe(true)
    expect(covers(paint, 2017)).toBe(true)
    expect(covers(paint, 2018)).toBe(false)
  })

  it('gives a reason only when no season in scope has it', () => {
    expect(coverageReason(plusMinus, [1996])).toBe('Recorded from 1996-97.')
    expect(coverageReason(plusMinus, [1996, 1997])).toBeNull()
    expect(coverageReason(paint, [2018])).toBe('Not in the source for 2017-18.')
    expect(coverageReason(paint, [2008])).toBe('Recorded from 2008-09.')
  })

  it('writes a season as the screens do', () => {
    expect(seasonLabel(2026)).toBe('2025-26')
    expect(seasonLabel(2000)).toBe('1999-00')
    expect(seasonLabel(1994)).toBe('1993-94')
  })
})
