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

/**
 * The headings an umbrella's headline draws on, in turn: what a reader looks for first at that end.
 * Fouls, hustle on offense, play types, matchups and the opponents' passing stay in their own chips.
 */
const HEADLINE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  offense: [
    'scoring',
    'shooting',
    'playmaking',
    'turnovers',
    'rebounding',
    'usage',
    'ratings',
    'impact'
  ],
  defense: [
    'steals_blocks',
    'defended_shots',
    'rebounding',
    'hustle',
    'ratings',
    'impact',
    'scoring_allowed',
    'shooting_allowed',
    'turnovers_forced'
  ]
}

/**
 * An umbrella's headline: its core metrics first, one from each of its headline headings a round, then
 * the rest the same way (those read from games first), so Defense opens on steals,
 * blocks, rim defence, defensive rebounds, deflections and the defensive ratings and models rather
 * than twelve of one kind: 12 at most, read in sub-group order.
 */
function umbrellaHeadline(
  metrics: readonly (MetricInfo & { categories: readonly Placement[] })[],
  category: Category
): string[] {
  const picked: string[] = []
  // Core metrics first, one from each heading a round; then the rest the same way, those read from
  // games before the published dashboards.
  for (const pass of [
    (m: MetricInfo): boolean => m.tier === 'core',
    (m: MetricInfo): boolean => m.tier !== 'core'
  ]) {
    const queues = (HEADLINE_GROUPS[category.id] ?? []).map((g) =>
      metrics
        .filter((m) => pass(m) && within(m, category.id)?.group.id === g)
        .map((m, i) => ({ m, i }))
        .sort(
          (x, y) =>
            Number(!x.m.grains.includes('game')) - Number(!y.m.grains.includes('game')) || x.i - y.i
        )
        .map(({ m }) => m.id)
    )
    for (let round = 0; picked.length < 12 && queues.some((q) => q.length > round); round++)
      for (const q of queues) if (q[round] && picked.length < 12) picked.push(q[round])
  }
  const order = (id: string): number => {
    const m = metrics.find((x) => x.id === id)
    return m ? category.groups.findIndex((g) => g.id === within(m, category.id)?.group.id) : 0
  }
  return picked
    .map((id, i) => ({ id, i }))
    .sort((x, y) => order(x.id) - order(y.id) || x.i - y.i)
    .map((x) => x.id)
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
 * its headline across its sub-groups (`umbrellaHeadline`), then each of its headings; one over 40
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
    // One sub-group needs no headline beside it.
    return groups.length > 1
      ? [{ key: KEY_VIEW, label: 'Key stats', metrics: headline(metrics, category) }, ...groups]
      : groups
  }
  const key: CategoryView = {
    key: KEY_VIEW,
    label: 'Key stats',
    metrics: umbrellaHeadline(metrics, category)
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
