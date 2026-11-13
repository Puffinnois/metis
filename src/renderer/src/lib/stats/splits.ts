import { seasonLabel } from '@shared/stats/seasons'
import { SPLIT_GROUPS, SPLITS, SPLITS_FIRST_SEASON } from '@shared/stats/splits'
import type { BoardMode, StatsQuery, StatsResult, StatsSeason } from '@shared/stats/types'
import { splitDefs, splitNotes, type SplitDef } from './player'
import { queryScope, type StatsScope } from './scope'

/**
 * The splits within each game, counted from the play by play (`src/shared/stats/splits.ts`), as the
 * dashboards' Splits tabs and the leaderboards' Moments control show them.
 */

/** One row per split, grouped as `SPLIT_GROUPS` orders them, each group with its rule. */
export function playSplitDefs(): SplitDef[] {
  return SPLIT_GROUPS.flatMap(({ group, title, note }) =>
    SPLITS.filter((s) => s.group === group).map((s) => ({
      key: `play-${s.id}`,
      group: title,
      label: s.label,
      patch: { split: s.id },
      note
    }))
  )
}

/** What the play splits leave out, said once under the table. */
export function playSplitNotes(scope: StatsScope): string[] {
  if (scope.season < SPLITS_FIRST_SEASON) {
    return [
      `Quarters, clutch, the score and the last minutes are counted from the play by play, from ${seasonLabel(SPLITS_FIRST_SEASON)}.`
    ]
  }
  return [
    "Quarters, clutch, the score, the last minutes and garbage time are counted from the NBA's play by play. Plus-minus is not."
  ]
}

/** The leaderboards' Moments control: the whole game, or one split. */
export const MOMENTS: { value: string; label: string }[] = [
  { value: '', label: 'Whole game' },
  ...SPLITS.map((s) => ({ value: s.id, label: s.label }))
]

/** A team's Splits tab: the ratings and the four factors, for and against. */
export const TEAM_SPLIT_METRICS = [
  'team_pts',
  'opp_pts',
  'team_ortg',
  'team_drtg',
  'team_nrtg',
  'team_pace',
  'team_efg_pct',
  'opp_efg_pct',
  'team_tov_pct',
  'team_orb_pct',
  'team_fta_rate'
]

/** The game splits a team can have: not started or off the bench, which are a player's. */
export function teamSplitDefs(season: StatsSeason | undefined): SplitDef[] {
  return [...splitDefs(season).filter((d) => d.patch.starter === undefined), ...playSplitDefs()]
}

/** One query per split, one for the months and one for the opponents, all for this team. */
export function teamSplitQueries(
  team: string,
  defs: readonly SplitDef[],
  scope: StatsScope,
  mode: BoardMode
): Map<string, StatsQuery> {
  const base = { ...queryScope(scope, 'team'), teams: [team] }
  const query = (extra: Partial<StatsQuery>): StatsQuery => ({
    entity: 'team',
    metrics: TEAM_SPLIT_METRICS,
    scope: base,
    transform: mode,
    sort: { metric: 'team_pts', dir: 'desc' },
    limit: 40,
    ...extra
  })
  return new Map<string, StatsQuery>([
    ['all', query({})],
    ...defs.map((d): [string, StatsQuery] => [
      d.key,
      query({ scope: { ...base, ...d.patch }, limit: 1 })
    ]),
    ['months', query({ groupBy: ['month'] })],
    ['opponents', query({ groupBy: ['opponent'] })]
  ])
}

/** The splits' notes, then what the play splits leave out. */
export function playSplitTableNotes(
  results: ReadonlyMap<string, StatsResult>,
  scope: StatsScope
): string[] {
  return [...splitNotes(results, scope), ...playSplitNotes(scope)]
}
