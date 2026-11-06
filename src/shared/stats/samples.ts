/** What each metric's sample counts, in words: "412 field-goal attempts". */
export const SAMPLE_LABELS: Readonly<Record<string, string>> = {
  games: 'games',
  box_games: 'games with a box score',
  starts_known: 'games with the starters known',
  minutes: 'minutes',
  fga: 'field-goal attempts',
  fgm: 'field goals made',
  fg3a: '3-point attempts',
  fta: 'free-throw attempts',
  opp_fga: 'field-goal attempts faced',
  opp_fgm: 'field goals made against',
  opp_fg3a: '3-point attempts faced',
  opp_fta: 'free-throw attempts faced',
  pts: 'points',
  opp_pts: 'points allowed',
  poss_sym: 'estimated possessions',
  on_poss: 'estimated possessions played',
  tov: 'turnovers',
  opp_tov: 'turnovers forced',
  reb: 'rebounds',
  oreb: 'offensive rebounds',
  dreb: 'defensive rebounds',
  opp_oreb: 'offensive rebounds allowed',
  opp_dreb: 'defensive rebounds allowed',
  paint_pts: 'points in the paint',
  fast_break_pts: 'fast-break points',
  turnover_pts: 'points off turnovers',
  opp_paint_pts: 'points in the paint allowed',
  opp_fast_break_pts: 'fast-break points allowed',
  opp_turnover_pts: 'points off turnovers allowed'
}

/** The words for a sample component; its name, spaced, for one not listed. */
export function sampleLabel(component: string): string {
  return SAMPLE_LABELS[component] ?? component.replaceAll('_', ' ')
}
