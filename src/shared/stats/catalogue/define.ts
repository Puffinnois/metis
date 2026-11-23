import { opponentsOf, type Placement } from '../categories'
import { NCAA_TEAM_SPLITS } from '../ncaaSplits'
import type { MetricDef } from '../types'

/**
 * A metric's fields beyond its words: `value` and `sample` are required, the rest have defaults.
 * `opponents` states the opponents' categories where a helper making both sides cannot derive them
 * from the team's (`opponentsOf`): a team's steals are Defense, its opponents' are its Offense.
 */
export type Opts = Partial<Omit<MetricDef, 'id' | 'label' | 'short' | 'description'>> &
  Pick<MetricDef, 'value' | 'sample'> & { opponents?: readonly Placement[] }

/** The opponents' categories of a metric whose team side states `o.categories`. */
export const opponentCategories = (o: Partial<Opts>): readonly Placement[] | undefined =>
  o.opponents ?? (o.categories ? opponentsOf(o.categories) : undefined)

/** Box scores start here: 1993-94. */
export const FIRST_SEASON = 1994
/** The NBA's own data starts here: 1996-97. */
export const NBA_FIRST_SEASON = 1997

/**
 * The NBA's statistical minimums for its leaders since 2013-14, per 82 games (D33,
 * `docs/reference/nba-qualifying-minimums.md`): games for the per-game leaders, makes for the
 * shooting percentages. They scale with the games in scope, as the league scales them in a shortened
 * season.
 */
export const NBA_MINIMUMS = { games: 58, fgm: 300, fg3m: 82, ftm: 125 } as const

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
  opts: Opts
): MetricDef {
  // `opponents` is for the helpers that make both sides, not a field of the metric.
  const o = { ...opts }
  delete o.opponents
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
  'turnover_pts',
  // The college leagues' stats.ncaa.org splits, kept for both sides of a team's game.
  ...NCAA_TEAM_SPLITS
])

const TOKEN = /\{([a-z0-9_]+)\}/g

const swapName = (c: string): string =>
  c.startsWith('opp_') && TWO_SIDED.has(c.slice(4)) ? c.slice(4) : TWO_SIDED.has(c) ? `opp_${c}` : c

/** The same formula from the other team's side: `{fga}` becomes `{opp_fga}`, and back. */
export const swapSides = (sql: string): string =>
  sql.replace(TOKEN, (_, c: string) => `{${swapName(c)}}`)

/** "Opponent effective field-goal percentage", but "Opponent Game Score": a name keeps its capitals. */
const lowerFirst = (label: string): string =>
  /^[A-Z][a-z]*\b(?! [A-Z])/.test(label) ? label[0].toLowerCase() + label.slice(1) : label

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
    qualifyBy: undefined,
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
        categories: opponentCategories(o),
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
