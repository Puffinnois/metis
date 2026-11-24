import {
  CATEGORIES,
  isUmbrella,
  isUmbrellaCategory,
  placementParts,
  type Category,
  type CategoryGroup,
  type Placement
} from '@shared/stats/categories'
import type { MetricInfo } from '@shared/stats/types'
import { MAX_COLUMNS, pickable, type TabDef } from './leaderboard'

/**
 * The categories as a board or a picker offers them (D52, `docs/reference/stat-categories.md`): only
 * what the league on screen has for the kind of row (`pickable`), a category or sub-group with nothing
 * left out. Shared by the leaderboard's tabs and chips, its column picker and any other metric picker.
 */

/** One preset of a category's tab: its metrics, at most 40 (`MAX_COLUMNS`), or narrower views. */
export interface CategoryView {
  /** A placement (`shooting.threes`), an umbrella's heading (`offense.shooting`), or `key`. */
  key: string
  label: string
  metrics: string[]
  /** An umbrella's heading over 40 metrics opens the specific sub-groups of its end instead. */
  children?: CategoryView[]
}

/** The key of a category's first view: its headline metrics. */
export const KEY_VIEW = 'key'

const ALL = CATEGORIES as readonly Category[]

/** Whether a team metric is its opponents' (`opp_`): whose box score its columns come from. */
export const isOpponents = (m: Pick<MetricInfo, 'id'>): boolean => m.id.startsWith('opp_')

/** The categories about what a side does with the ball, whose team switch follows the end. */
const WITH_THE_BALL = new Set(['scoring', 'shooting', 'playmaking'])

/**
 * The side of a team's category a metric shows on: `offense` for the Team side, `defense` for the
 * Opponents side. In Scoring, Shooting and Playmaking it is the metric's end of the floor, so the
 * team's shots blocked (`opp_blk`) and its turnovers lost to steals (`opp_stl`) read beside its own
 * field goals and turnovers; in the categories whose acts happen at both ends (Rebounding, Fouls and
 * the rest) it is whose box score the columns come from.
 */
export function teamSide(
  m: Pick<MetricInfo, 'id' | 'categories'>,
  category: string
): 'offense' | 'defense' {
  const end = m.categories?.find(isUmbrella)
  if (WITH_THE_BALL.has(category) && end) return end.startsWith('offense.') ? 'offense' : 'defense'
  return isOpponents(m) ? 'defense' : 'offense'
}

/**
 * The metrics a tab offers, in the catalogue's order. A team's specific category shows one side at a
 * time, the Team side (the `offense` tab) or the Opponents side (`defense`, `teamSide`); an umbrella
 * shows its end, whoever's columns hold it, so Defense holds the team's steals and the opponents'
 * scoring together.
 */
function offered(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  category: string
): (MetricInfo & { categories: readonly Placement[] })[] {
  const ok = new Set(pickable(catalogue, tab).map((m) => m.id))
  const umbrella = isUmbrellaCategory(category)
  return catalogue.filter(
    (m): m is MetricInfo & { categories: readonly Placement[] } =>
      ok.has(m.id) &&
      (m.categories ?? []).some((p) => p.startsWith(`${category}.`)) &&
      (tab.entity !== 'team' || umbrella || teamSide(m, category) === tab.id)
  )
}

/** The categories a tab has metrics of, in the registry's order: the board's tabs after Overview. */
export function boardCategories(catalogue: readonly MetricInfo[], tab: TabDef): Category[] {
  const ok = pickable(catalogue, tab)
  const held = new Set(ok.flatMap((m) => (m.categories ?? []).map((p) => p.split('.')[0])))
  // A team's tabs are the same on either side, so a switch never hides one: a category with
  // metrics on one side only reads empty on the other (`categoryViews` gives none).
  const sides: TabDef[] =
    tab.entity === 'team'
      ? [
          { ...tab, id: 'offense' },
          { ...tab, id: 'defense' }
        ]
      : [tab]
  return ALL.filter(
    (c) => held.has(c.id) && sides.some((t) => offered(catalogue, t, c.id).length > 0)
  )
}

/** Whether a category's tab needs the team or opponents switch: a team's specific category. */
export const hasSides = (tab: TabDef, category: string): boolean =>
  tab.entity === 'team' && !isUmbrellaCategory(category)

/** Core first, then the rest read from games before those published per season: 12 at most. */
function headline(
  metrics: readonly (MetricInfo & { categories: readonly Placement[] })[],
  category: Category
): string[] {
  const core = metrics.filter((m) => m.tier === 'core')
  const rest = metrics.filter((m) => m.tier !== 'core')
  const fill = [
    ...rest.filter((m) => m.grains.includes('game')),
    ...rest.filter((m) => !m.grains.includes('game'))
  ].slice(0, Math.max(0, 12 - core.length))
  // Twelve at most: a category with many core metrics (Shooting) shows the rest in its sub-groups.
  // Read in sub-group order, so the column headings run Field goals, Threes, Free throws once each.
  const order = (m: { categories: readonly Placement[] }): number =>
    category.groups.findIndex((g) => g.id === within(m, category.id)?.group.id)
  return [...core, ...fill]
    .slice(0, 12)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => order(a.m) - order(b.m) || a.i - b.i)
    .map(({ m }) => m.id)
}

/** Whose Key stats a tab reads: a player's, a team's own (and an umbrella's), or its opponents'. */
export type KeyKind = 'player' | 'team' | 'opponents'

/**
 * Key stats chosen, not derived (the manager's reviews of T1702.3 and T1702.4), in this order: how a
 * reader reads that category. A metric the league lacks is skipped and the next taken, 12 at most. A
 * category or kind that states none keeps the derived list (`headline`). Offense's and Defense's are
 * stated for both kinds: a team's rating and four factors lead at both ends. An entry that is a list
 * takes the first of its metrics the league has: one place, several sources.
 */
export const KEY_STATS: Readonly<Record<string, Partial<Record<KeyKind, readonly KeyEntry[]>>>> = {
  offense: {
    team: [
      'team_ortg',
      'team_pts',
      'team_efg_pct',
      'team_ts_pct',
      'team_tov_pct',
      'team_orb_pct',
      'team_fta_rate',
      'team_fg_pct',
      'team_fg3m',
      'team_fg3_pct',
      'team_ast',
      'sdv_adj_o'
    ],
    player: [
      'pts',
      'ts_pct',
      'efg_pct',
      'fg_pct',
      'fg3m',
      'fg3_pct',
      'ft_pct',
      'ast',
      'ast_pct',
      'tov_pct',
      'usg_pct',
      // Then the offensive model the league has, before the on-court rating, so the twelfth is a
      // model where there is one.
      'sdv_o_rapm',
      'sdv_ncaa_orapm',
      'onc_ortg'
    ]
  },
  defense: {
    team: [
      'team_drtg',
      'opp_pts',
      'opp_efg_pct',
      'opp_ts_pct',
      'opp_tov_pct',
      'team_drb_pct',
      'opp_fta_rate',
      'opp_fg_pct',
      'opp_fg3_pct',
      'team_stl',
      'team_blk',
      'sdv_adj_d'
    ],
    player: [
      'stl',
      'blk',
      'stl_pct',
      'blk_pct',
      'dreb',
      'drb_pct',
      'def_rim_fg_pct',
      'deflections',
      'contested_shots',
      // Then the defensive models the league has, and the on-court rating last, as for Offense.
      'sdv_d_rapm',
      'sdv_ncaa_drapm',
      'sdv_dbpm',
      'sdv_box_dbpm',
      'onc_drtg'
    ]
  },
  // A player's overall value: the plus-minus model, the box-score models and their totals, then the
  // on-court numbers, BOBAN and the composites. SportsDataverse's BPM comes before Metis's own.
  impact: {
    player: [
      'sdv_rapm',
      'sdv_ncaa_rapm',
      'sdv_bpm',
      'sdv_box_bpm',
      'bpm',
      'per',
      'ws',
      'ws_48',
      'vorp',
      'onoff_net',
      'onc_net',
      // The colleges have plus-minus from play by play only.
      ['plus_minus', 'onc_plus_minus'],
      'sdv_boban_skill',
      'gmsc',
      'pie'
    ]
  },
  // What a reader means by fouls first: committed, then drawn, then technicals and flagrants. The
  // offensive-foul turnovers and their share stay in their sub-group.
  fouls: {
    player: [
      'pf',
      'pbp_pf_shooting',
      'pbp_pf_offensive',
      'nba_pfd',
      'pbp_fd',
      'pbp_fd_shooting',
      'pbp_and1',
      'fta_rate',
      'pbp_tech',
      'pbp_flagrant'
    ],
    team: [
      'team_pf',
      'team_pbp_pf_shooting',
      'team_pbp_pf_offensive',
      'team_pbp_fd',
      'team_pbp_fd_shooting',
      'team_pbp_and1',
      'team_fta_rate',
      'team_pbp_tech',
      'team_pbp_flagrant'
    ],
    opponents: [
      'opp_pf',
      'opp_pbp_pf_shooting',
      'opp_pbp_pf_offensive',
      'opp_pbp_fd',
      'opp_pbp_fd_shooting',
      'opp_pbp_and1',
      'opp_fta_rate',
      'opp_pbp_tech',
      'opp_pbp_flagrant'
    ]
  },
  // Points, by shot, by situation (the NBA's dashboards, the colleges' transition and putbacks), the
  // share of the team's points, and one assisted share last.
  scoring: {
    player: [
      'pts',
      'pts_2pt',
      'pts_3pt',
      'pts_ft',
      'nba_pts_paint',
      'nba_pts_fb',
      'ncaa_trans_pts',
      'nba_pts_off_tov',
      'nba_pts_2_nd_chance',
      'ncaa_putbacks',
      'share_pts',
      'nba_share_ast_fgm',
      'ncaa_assisted_pct'
    ]
  },
  // A team's own shooting, then the shot chart's rim and mid-range percentages (the colleges' box
  // splits of the same zones would read as a second "Mid FG%"). The shots blocked by its opponents
  // stay in Field goals.
  shooting: {
    team: [
      'team_fg_pct',
      'team_fg3m',
      'team_fg3_pct',
      'team_ft_pct',
      'team_fta_rate',
      'team_efg_pct',
      'team_ts_pct',
      'team_fg3a_rate',
      'team_shot_ra_fg_pct',
      'team_shot_mid_fg_pct'
    ]
  }
}

/** A Key stats entry: a metric, or several for one place of which the first the league has is taken. */
export type KeyEntry = string | readonly string[]

/** The kind a tab's Key stats are stated for. */
export const keyKind = (tab: TabDef, category: string): KeyKind =>
  tab.entity === 'player'
    ? 'player'
    : isUmbrellaCategory(category) || tab.id !== 'defense'
      ? 'team'
      : 'opponents'

/** The chosen Key stats a tab offers, 12 at most, or null where the category states none. */
function chosenKeyStats(
  metrics: readonly MetricInfo[],
  tab: TabDef,
  category: string
): string[] | null {
  const list = KEY_STATS[category]?.[keyKind(tab, category)]
  if (!list) return null
  const offered = (id: string): boolean => metrics.some((m) => m.id === id)
  const ids = list
    .map((e) => (typeof e === 'string' ? (offered(e) ? e : null) : (e.find(offered) ?? null)))
    .filter((id): id is string => id !== null)
    .slice(0, 12)
  return ids.length > 0 ? ids : null
}

/** The placement a metric has in a category, and that placement's parts. */
function within(
  m: { categories: readonly Placement[] },
  category: string
): { p: Placement; group: CategoryGroup } | null {
  const p = m.categories.find((x) => x.startsWith(`${category}.`))
  const parts = p ? placementParts(p) : null
  return p && parts ? { p, group: parts.group } : null
}

/** Metrics grouped by their placement in a category, in the registry's order of its sub-groups. */
function byGroup(
  metrics: readonly (MetricInfo & { categories: readonly Placement[] })[],
  category: Category
): CategoryView[] {
  return category.groups
    .map((g) => ({
      key: `${category.id}.${g.id}`,
      label: g.label,
      metrics: metrics.filter((m) => within(m, category.id)?.group.id === g.id).map((m) => m.id)
    }))
    .filter((v) => v.metrics.length > 0)
}

/**
 * A category's presets on a tab. A specific category: its headline, then each sub-group. An umbrella:
 * its chosen Key stats (`KEY_STATS`), then each of its headings; one over 40
 * metrics holds the specific sub-groups of that end as children, so
 * Offense › Shooting › Corner threes is Shooting's corner threes on offense. Every view is at most 40
 * metrics (the tests hold it in every league).
 */
export function categoryViews(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  categoryId: string
): CategoryView[] {
  const category = ALL.find((c) => c.id === categoryId)
  if (!category) return []
  const metrics = offered(catalogue, tab, categoryId)
  if (!isUmbrellaCategory(categoryId)) {
    const groups = byGroup(metrics, category)
    const key = chosenKeyStats(metrics, tab, categoryId) ?? headline(metrics, category)
    // One sub-group needs no headline beside it, nor does a category the headline would hold whole
    // (a player's Playing time in the colleges): one section of each metric, not two.
    return groups.length > 1 && key.length < metrics.length
      ? [{ key: KEY_VIEW, label: 'Key stats', metrics: key }, ...groups]
      : groups
  }
  const key: CategoryView = {
    key: KEY_VIEW,
    label: 'Key stats',
    metrics: chosenKeyStats(metrics, tab, categoryId) ?? []
  }
  const headings = byGroup(metrics, category).map((view) => {
    if (view.metrics.length <= MAX_COLUMNS) return view
    const ids = new Set(view.metrics)
    const inHeading = metrics.filter((m) => ids.has(m.id))
    // The specific category of the heading's metrics: each one's first placement outside the umbrellas.
    const specific = new Map<string, Placement[]>()
    for (const m of inHeading) {
      const p = m.categories.find((x) => !isUmbrella(x))
      if (p) specific.set(m.id, [p])
    }
    const children = ALL.filter((c) => !isUmbrellaCategory(c.id)).flatMap((c) =>
      byGroup(
        inHeading.filter((m) => specific.get(m.id)?.[0].startsWith(`${c.id}.`)),
        c
      ).map((v) => ({
        ...v,
        label: c.id === view.key.split('.')[1] ? v.label : `${c.label} › ${v.label}`
      }))
    )
    return { ...view, children }
  })
  return key.metrics.length > 0 ? [key, ...headings] : headings
}

/** The view a board shows: its saved one, else the first; a parent with children shows its first. */
export function viewOf(
  views: readonly CategoryView[],
  key: string | undefined
): CategoryView | null {
  for (const v of views) {
    if (v.key === key) return v.children?.[0] ?? v
    const child = v.children?.find((c) => c.key === key)
    if (child) return child
  }
  const first = views[0]
  return first ? (first.children?.[0] ?? first) : null
}

/** The heading a view sits under, for an umbrella's second row of chips. */
export const parentOf = (views: readonly CategoryView[], key: string): CategoryView | null =>
  views.find((v) => v.key === key || v.children?.some((c) => c.key === key)) ?? null

/** A sub-group of the picker: its metrics on the tab, in the catalogue's order. */
export interface PickerGroup {
  category: Category
  group: CategoryGroup
  metrics: MetricInfo[]
}

/**
 * What a metric picker lists (the leaderboard's columns, T1701's filters): every metric the tab offers,
 * under each category and sub-group it sits in, in the registry's order; with a category chosen, that
 * category's alone. A team picker lists both sides, the team's own first.
 */
export function pickerGroups(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  category = ''
): PickerGroup[] {
  const ok = pickable(catalogue, tab)
  const out: PickerGroup[] = []
  for (const c of ALL) {
    if (category && c.id !== category) continue
    for (const g of c.groups) {
      const p = `${c.id}.${g.id}`
      const metrics = ok.filter((m) => m.categories?.includes(p as Placement))
      if (metrics.length) out.push({ category: c, group: g, metrics })
    }
  }
  return out
}

/** A select's or list's group: "Shooting › Threes" and the metrics listed there. */
export interface MetricGroup {
  key: string
  label: string
  category: Category
  group: CategoryGroup
  metrics: MetricInfo[]
}

/**
 * `pickerGroups` for a select or a list that shows each metric once (Explore's axes, Trends'
 * metric, Compare's rows, T1701's filters): every metric under its primary placement only, in the
 * registry's order, those `keep` turns down left out.
 */
export function primaryGroups(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  keep: (m: MetricInfo) => boolean = () => true
): MetricGroup[] {
  return pickerGroups(catalogue, tab)
    .map((g) => ({
      key: `${g.category.id}.${g.group.id}`,
      label: `${g.category.label} › ${g.group.label}`,
      category: g.category,
      group: g.group,
      metrics: g.metrics.filter(
        (m) => m.categories?.[0] === `${g.category.id}.${g.group.id}` && keep(m)
      )
    }))
    .filter((g) => g.metrics.length > 0)
}

/** The group a metric is listed under in `primaryGroups`: "Shooting › Threes". */
export function primaryLabel(info: Pick<MetricInfo, 'categories'> | undefined): string | null {
  const p = info?.categories?.[0]
  const parts = p ? placementParts(p) : null
  return parts ? `${parts.category.label} › ${parts.group.label}` : null
}

/**
 * Where a board opens on one metric (the home's "All →"): its primary category, the side of a team's
 * category it shows on (`teamSide`), and the first view of that category holding it, Key stats when
 * they do. Null when the metric has no category the tab offers.
 */
export function boardForMetric(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  metric: string
): { category: string; tab: string; view: CategoryView } | null {
  const info = catalogue.find((m) => m.id === metric)
  const category = info?.categories?.[0]?.split('.')[0]
  if (!info || !category) return null
  const side =
    tab.entity === 'team' && !isUmbrellaCategory(category) ? teamSide(info, category) : tab.id
  const on: TabDef = { ...tab, id: side }
  for (const v of categoryViews(catalogue, on, category))
    for (const shown of v.children ?? [v])
      if (shown.metrics.includes(metric)) return { category, tab: side, view: shown }
  return null
}
