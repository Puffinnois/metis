import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * DARKO as its maker publishes it (D55): Kostya Medvedovsky's daily plus-minus model, read from the
 * boards the owner of this copy downloads by hand from darko.app (`main/stats/darkoImport.ts`). Off
 * for everyone else, where they read "Not loaded on this copy". Not SportsDataverse's: the dataset's
 * three `sdv_darko_*` metrics stay as they are, unavailable since it dropped its columns.
 *
 * DARKO is a player's state on a date, so each metric reads the season's latest imported board, one
 * season at a time; the boards before it are the rating history's (T1704).
 */
const SOURCES = ["DARKO (Kostya Medvedovsky, darko.app), imported by hand by this copy's owner"]
const TABLE = 'pub_player_darko_dpm'
const FIRST = 1997
const WHOSE =
  "Kostya Medvedovsky's published value, from the board this copy's owner downloaded from darko.app; Metis did not compute it."
const STATE =
  'Read at the season’s latest imported board, one season at a time; a season with no board imported has none.'

const dk = (label: string): string => `${label} (DARKO)`
const head = (short: string): string => `${short} DARKO`

const darko = (column: string, o: Partial<Opts> = {}): Opts => ({
  value: ratio(column, 'dk_rows'),
  sample: 'dk_rows',
  // One board a player-season: the minimum is that it exists.
  minSample: 1,
  family: 'darko',
  kind: 'model',
  unit: 'rating',
  decimals: 1,
  sources: SOURCES,
  firstSeason: FIRST,
  published: TABLE,
  oneSeason: true,
  ...o
})

export const DARKO_METRICS: MetricDef[] = [
  metric(
    'darko_dpm',
    dk('DPM'),
    head('DPM'),
    `Daily plus-minus: the points per 100 possessions DARKO expects the player to add over an average one, offence and defence together, as of the board's date. ${WHOSE} ${STATE}`,
    { ...darko('dk_dpm'), categories: ['impact.pm_models', 'predictive.player_projections'] }
  ),
  metric(
    'darko_o_dpm',
    dk('Offensive DPM'),
    head('ODPM'),
    `The offensive part of DPM. ${WHOSE} ${STATE}`,
    { ...darko('dk_o_dpm'), categories: ['impact.pm_models', 'offense.impact'] }
  ),
  metric(
    'darko_d_dpm',
    dk('Defensive DPM'),
    head('DDPM'),
    `The defensive part of DPM. ${WHOSE} ${STATE}`,
    { ...darko('dk_d_dpm'), categories: ['impact.pm_models', 'defense.impact'] }
  ),
  metric(
    'darko_box_dpm',
    dk('Box DPM'),
    head('BoxDPM'),
    `The part of DPM from the box score. ${WHOSE} ${STATE}`,
    { ...darko('dk_box_dpm'), categories: ['impact.box_models'] }
  ),
  metric(
    'darko_on_off_dpm',
    dk('On/off DPM'),
    head('OnOffDPM'),
    `The part of DPM from the team's margin with the player on the floor and off it. ${WHOSE} ${STATE}`,
    { ...darko('dk_on_off_dpm'), categories: ['impact.pm_models'] }
  ),
  metric(
    'darko_x_minutes',
    dk('Projected minutes'),
    head('xMIN'),
    `The minutes a game DARKO projects for the player. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_minutes', { unit: 'minutes', direction: 'neutral' }),
      categories: ['predictive.player_projections']
    }
  ),
  metric(
    'darko_x_pace',
    dk('Projected pace'),
    head('xPace'),
    `The pace DARKO projects with the player on the floor. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_pace', { unit: 'pace', direction: 'neutral' }),
      categories: ['predictive.player_projections']
    }
  ),
  metric(
    'darko_x_pts_100',
    dk('Projected points per 100 possessions'),
    head('xPTS/100'),
    `The points per 100 possessions DARKO projects for the player. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_pts_100', { unit: 'number' }),
      categories: ['predictive.player_projections']
    }
  ),
  metric(
    'darko_x_ast_100',
    dk('Projected assists per 100 possessions'),
    head('xAST/100'),
    `The assists per 100 possessions DARKO projects for the player. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_ast_100', { unit: 'number' }),
      categories: ['predictive.player_projections']
    }
  ),
  metric(
    'darko_x_fg_pct',
    dk('Projected field-goal percentage'),
    head('xFG%'),
    `The field-goal percentage DARKO projects for the player. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_fg_pct', { unit: 'pct', decimals: 1 }),
      categories: ['predictive.player_projections']
    }
  ),
  metric(
    'darko_x_fg3_pct',
    dk('Projected three-point percentage'),
    head('x3P%'),
    `The three-point percentage DARKO projects for the player. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_fg3_pct', { unit: 'pct', decimals: 1 }),
      categories: ['predictive.player_projections']
    }
  ),
  metric(
    'darko_x_ft_pct',
    dk('Projected free-throw percentage'),
    head('xFT%'),
    `The free-throw percentage DARKO projects for the player. ${WHOSE} ${STATE}`,
    {
      ...darko('dk_x_ft_pct', { unit: 'pct', decimals: 1 }),
      categories: ['predictive.player_projections']
    }
  )
]

/** What the DARKO sample counts, in words. */
export const DARKO_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  dk_rows: 'imported DARKO board'
}
