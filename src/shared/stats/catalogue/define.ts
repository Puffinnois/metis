import type { MetricDef } from '../types'

/** A metric's fields beyond its words: `value` and `sample` are required, the rest have defaults. */
export type Opts = Partial<Omit<MetricDef, 'id' | 'label' | 'short' | 'description'>> &
  Pick<MetricDef, 'value' | 'sample'>

/** Box scores start here: 1993-94. */
export const FIRST_SEASON = 1994
/** The NBA's own data starts here: 1996-97. */
export const NBA_FIRST_SEASON = 1997

export const BOX_SOURCES = ["The NBA's box scores from 1996-97", "ESPN's box scores before them"]
export const NBA_SOURCES = ["The NBA's box scores"]
export const ESPN_TEAM_SOURCES = ["ESPN's team box scores"]

/** `{a} / {b}`, NULL when the denominator is 0: DuckDB would divide to Infinity. */
export const ratio = (a: string, b: string): string => `{${a}} / nullif({${b}}, 0)`

export function metric(
  id: string,
  label: string,
  short: string,
  description: string,
  o: Opts
): MetricDef {
  return {
    id,
    label,
    short,
    description,
    family: 'traditional',
    entity: 'player',
    kind: 'derived',
    aggregation: 'ratio',
    unit: 'number',
    decimals: 1,
    direction: 'higher',
    sources: BOX_SOURCES,
    firstSeason: FIRST_SEASON,
    tier: 'extended',
    ...o
  }
}

/** A counted event: summed, can be shown per game. */
export const count = (component: string, o: Partial<Opts> = {}): Opts => ({
  value: `{${component}}`,
  sample: 'games',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  ...o
})

/** A share, read as a fraction: 0.35 reads 35.0 %. */
export const share = (a: string, b: string, sample: string, o: Partial<Opts> = {}): Opts => ({
  value: ratio(a, b),
  sample,
  unit: 'pct',
  ...o
})

/** The components `team_game` holds for both sides, as `fga` and `opp_fga`. */
const TWO_SIDED = new Set([
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'pts',
  'poss',
  'paint_pts',
  'fast_break_pts',
  'turnover_pts'
])

const TOKEN = /\{([a-z0-9_]+)\}/g

const swapName = (c: string): string =>
  c.startsWith('opp_') && TWO_SIDED.has(c.slice(4)) ? c.slice(4) : TWO_SIDED.has(c) ? `opp_${c}` : c

/** The same formula from the other team's side: `{fga}` becomes `{opp_fga}`, and back. */
export const swapSides = (sql: string): string =>
  sql.replace(TOKEN, (_, c: string) => `{${swapName(c)}}`)

const lowerFirst = (label: string): string =>
  /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label

const flipped = (d: MetricDef['direction']): MetricDef['direction'] =>
  d === 'higher' ? 'lower' : d === 'lower' ? 'higher' : d

/**
 * A team's metric and the same one for its opponents. Counts are per game of a box score, since a few
 * old games have only a score. Teams always qualify, so no minimum carries over.
 */
export function teamSides(
  id: string,
  label: string,
  short: string,
  description: string,
  o: Opts
): MetricDef[] {
  const shared: Partial<Opts> = {
    ...o,
    entity: 'team',
    minSample: undefined,
    perGameBy: o.perGameBy ?? (o.aggregation === 'sum' ? 'box_games' : undefined)
  }
  const sample = o.sample === 'games' ? 'box_games' : o.sample
  return [
    metric(`team_${id}`, label, short, description, {
      ...shared,
      value: o.value,
      sample,
      side: 'offense'
    }),
    metric(
      `opp_${id}`,
      `Opponent ${lowerFirst(label)}`,
      `Opp ${short}`,
      `${description} For the team's opponents.`,
      {
        ...shared,
        value: swapSides(o.value),
        sample: swapName(sample),
        side: 'defense',
        direction: flipped(o.direction ?? 'higher')
      }
    )
  ]
}

/** A metric for players, teams and their opponents, from the same formula. */
export function allSides(
  id: string,
  label: string,
  short: string,
  description: string,
  o: Opts
): MetricDef[] {
  return [metric(id, label, short, description, o), ...teamSides(id, label, short, description, o)]
}
