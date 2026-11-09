import { beforeAll, describe, expect, it } from 'vitest'
import { COMPONENTS, grainsOf } from '@main/stats/engine/registry'
import { CATALOGUE, componentsOf, coverageReason, covers, TOKEN } from '@shared/stats/catalogue'
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

/** One published row: a different value in every column, so a metric reading the wrong one fails. */
const PUBLISHED_ROW: Record<string, number> = {
  games: 50,
  minutes: 2000,
  possessions: 4000,
  ...Object.fromEntries(
    [...new Set(DASHBOARD_COLUMNS.map(([, c]) => c))].map((c, i) => [c, 1000 + 37 * i])
  )
}

Object.assign(EXPECTED, {
  ...Object.fromEntries(
    DASHBOARD_COLUMNS.map(([id, c, by]) => [
      id,
      by === '-' ? PUBLISHED_ROW[c] : PUBLISHED_ROW[c] / PUBLISHED_ROW[by]
    ])
  ),
  nba_pace40: (40 * PUBLISHED_ROW.pace) / PUBLISHED_ROW.minutes / 48,
  team_nba_pace40: (40 * PUBLISHED_ROW.pace) / PUBLISHED_ROW.minutes / 48
})

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
      // A published metric has only the season, and `grainsOf` checks its table holds the components.
      if (m.published) {
        expect(grainsOf(m), m.id).toEqual(['season'])
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
})

describe('every formula, against a value worked by hand', () => {
  let db: StatsDb
  let values: Record<string, number | null>

  beforeAll(async () => {
    db = await openTestDb()
    const columns = CATALOGUE.map(
      (m) =>
        `(${fill(m, m.published ? PUBLISHED_ROW : m.entity === 'player' ? PLAYER_ROW : TEAM_ROW)})::DOUBLE AS "${m.id}"`
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
