import {
  CATEGORIES,
  placementParts,
  type Category,
  type CategoryGroup,
  type Placement
} from '@shared/stats/categories'
import type { MetricInfo } from '@shared/stats/types'

/**
 * One sub-group of the Glossary (D52): the metrics described there, whose primary category it is, and
 * those it also holds, described under their primary category and named here with a link.
 */
export interface GlossarySection {
  category: Category
  group: CategoryGroup
  described: MetricInfo[]
  alsoHere: MetricInfo[]
}

/** "Shooting › Threes". */
export function placementLabel(p: Placement): string {
  const parts = placementParts(p)
  return parts ? `${parts.category.label} › ${parts.group.label}` : p
}

/** Where a metric sits, its primary category first: "Shooting › Threes, Offense › Shooting". */
export const placementsWords = (info: Pick<MetricInfo, 'categories'>): string =>
  (info.categories ?? []).map(placementLabel).join(', ')

/** The category a metric is described under. */
export const primaryCategory = (info: Pick<MetricInfo, 'categories'>): string | undefined =>
  info.categories?.[0]?.split('.')[0]

/** The categories that hold any of these metrics, in the registry's order, for the filter. */
export function categoriesOf(metrics: readonly Pick<MetricInfo, 'categories'>[]): Category[] {
  const held = new Set(metrics.flatMap((m) => (m.categories ?? []).map((p) => p.split('.')[0])))
  return (CATEGORIES as readonly Category[]).filter((c) => held.has(c.id))
}

/**
 * The Glossary's sections, in the registry's order of categories and sub-groups, empty ones left out.
 * With no category chosen every metric appears once, under its primary category; with one chosen,
 * every metric it holds appears in its sub-group, described there or linked to where it is. `metrics`
 * arrive in the order to show them (by name, or most stable first), which each section keeps.
 */
export function glossarySections(
  metrics: readonly MetricInfo[],
  category: string
): GlossarySection[] {
  const sections = new Map<string, GlossarySection>()
  const add = (p: Placement, m: MetricInfo, described: boolean): void => {
    const parts = placementParts(p)
    if (!parts) return
    let s = sections.get(p)
    if (!s) {
      s = { ...parts, described: [], alsoHere: [] }
      sections.set(p, s)
    }
    ;(described ? s.described : s.alsoHere).push(m)
  }
  for (const m of metrics) {
    const placed = m.categories ?? []
    if (!category) {
      if (placed[0]) add(placed[0], m, true)
      continue
    }
    const here = placed.find((p) => p.split('.')[0] === category)
    if (here) add(here, m, here === placed[0])
  }
  const order = (CATEGORIES as readonly Category[]).flatMap((c) =>
    c.groups.map((g) => `${c.id}.${g.id}`)
  )
  return [...sections.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([, s]) => s)
}
