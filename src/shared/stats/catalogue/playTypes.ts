import {
  PLAY_TYPE_SIDES,
  PLAY_TYPES_FIRST_SEASON,
  type PlayType,
  type PlayTypeSide
} from '../playTypes'
import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * Reference section 11: the NBA's play types, from Synergy's tagging, players only, from 2015-16. Season
 * totals with no game behind them, so they answer whole seasons only, per game over the player's games
 * on that side of the ball. Each type is counted where the play ended, not where it started.
 *
 * Points per possession and field-goal percentage are rebuilt from their parts, so seasons together
 * are exact. The other rates come without their parts and are stored times what they divide by
 * (`derived/publishedTables.ts`). The published percentile is not read: Metis ranks its own pools.
 */
const SOURCES = ["The NBA's play types (Synergy)"]

const WEIGHTED =
  'Over more than one season, the published values are weighted by possessions, since the NBA does not publish their parts. Before 2023-24 they are often rounded to two places.'

const FROM_2024 =
  'From 2023-24, a type with fewer than 10 possessions in a season is not published, so it reads blank.'

interface Measure {
  id: string
  /** The words after the type's name: "Isolation points per possession". */
  label: string
  short: string
  description: (what: string, side: PlayTypeSide) => string
  opts: (key: string, side: PlayTypeSide) => Partial<Opts> & Pick<Opts, 'value' | 'sample'>
}

const lower = (d: MetricDef['direction'], side: PlayTypeSide): MetricDef['direction'] =>
  side === 'offense' || d === 'neutral' ? d : d === 'higher' ? 'lower' : 'higher'

/** A rate the NBA publishes without its parts, read back over possessions. */
const weighted =
  (part: string, direction: MetricDef['direction']): Measure['opts'] =>
  (key, side) => ({
    value: ratio(`${key}_${part}_w`, `${key}_poss`),
    sample: `${key}_poss`,
    unit: 'pct',
    minSample: 50,
    direction: lower(direction, side)
  })

/** "their isolation plays", or "the isolation plays they defended". */
const plays = (what: string, side: PlayTypeSide): string =>
  side === 'offense' ? `their ${what} plays` : `the ${what} plays they defended`

const MEASURES: Measure[] = [
  {
    id: 'poss',
    label: 'possessions',
    short: 'Poss',
    description: (what, side) =>
      side === 'offense'
        ? `Plays the player finished as ${what}.`
        : `Plays of this type the player defended, counted where they ended.`,
    opts: (key) => ({
      value: `{${key}_poss}`,
      sample: 'games',
      kind: 'recorded',
      aggregation: 'sum',
      unit: 'count',
      decimals: 0,
      direction: 'neutral'
    })
  },
  {
    id: 'freq',
    label: 'frequency',
    short: 'Freq',
    description: (what, side) =>
      side === 'offense'
        ? `The share of the player's plays with a type that were ${what}.`
        : `The share of the plays with a type the player defended that were ${what}.`,
    opts: (key) => ({
      value: ratio(`${key}_freq_poss`, `${key}_all_poss`),
      sample: `${key}_all_poss`,
      unit: 'pct',
      minSample: 500,
      direction: 'neutral'
    })
  },
  {
    id: 'pts',
    label: 'points',
    short: 'PTS',
    description: (what, side) =>
      side === 'offense'
        ? `Points from ${what} plays, free throws included.`
        : `Points allowed on ${what} plays the player defended, free throws included.`,
    opts: (key, side) => ({
      value: `{${key}_pts}`,
      sample: 'games',
      kind: 'recorded',
      aggregation: 'sum',
      unit: 'count',
      decimals: 0,
      direction: side === 'offense' ? 'higher' : 'neutral'
    })
  },
  {
    id: 'ppp',
    label: 'points per possession',
    short: 'PPP',
    description: (what, side) =>
      side === 'offense'
        ? `Points per ${what} play.`
        : `Points allowed per ${what} play the player defended.`,
    opts: (key, side) => ({
      value: ratio(`${key}_pts`, `${key}_poss`),
      sample: `${key}_poss`,
      unit: 'number',
      decimals: 2,
      minSample: 50,
      direction: lower('higher', side)
    })
  },
  {
    id: 'fgm',
    label: 'field goals made',
    short: 'FGM',
    description: (what, side) =>
      side === 'offense'
        ? `Field goals made on ${what} plays.`
        : `Field goals made against the player on ${what} plays.`,
    opts: (key) => ({
      value: `{${key}_fgm}`,
      sample: 'games',
      kind: 'recorded',
      aggregation: 'sum',
      unit: 'count',
      decimals: 0,
      direction: 'neutral'
    })
  },
  {
    id: 'fga',
    label: 'field-goal attempts',
    short: 'FGA',
    description: (what, side) =>
      side === 'offense'
        ? `Field-goal attempts on ${what} plays.`
        : `Field-goal attempts against the player on ${what} plays.`,
    opts: (key) => ({
      value: `{${key}_fga}`,
      sample: 'games',
      kind: 'recorded',
      aggregation: 'sum',
      unit: 'count',
      decimals: 0,
      direction: 'neutral'
    })
  },
  {
    id: 'fg_pct',
    label: 'FG%',
    short: 'FG%',
    description: (what, side) =>
      side === 'offense'
        ? `Field goals made over attempts on ${what} plays.`
        : `Field goals made over attempts against the player on ${what} plays.`,
    opts: (key, side) => ({
      value: ratio(`${key}_fgm`, `${key}_fga`),
      sample: `${key}_fga`,
      unit: 'pct',
      minSample: 40,
      direction: lower('higher', side)
    })
  },
  {
    id: 'efg_pct',
    label: 'eFG%',
    short: 'eFG%',
    description: (what, side) =>
      `Field-goal percentage with a three worth one and a half twos, on ${what} plays${side === 'defense' ? ' the player defended' : ''}. The NBA does not publish the threes, so its figure is read as published, weighted by attempts over more than one season.`,
    opts: (key, side) => ({
      value: ratio(`${key}_efg_w`, `${key}_fga`),
      sample: `${key}_fga`,
      unit: 'pct',
      minSample: 40,
      direction: lower('higher', side)
    })
  },
  {
    id: 'ft_freq',
    label: 'free-throw frequency',
    short: 'FT Fr',
    description: (what, side) =>
      `The share of ${plays(what, side)} that ended with free throws. ${WEIGHTED}`,
    opts: weighted('ft', 'higher')
  },
  {
    id: 'tov_freq',
    label: 'turnover frequency',
    short: 'TOV Fr',
    description: (what, side) =>
      `The share of ${plays(what, side)} that ended in a turnover. ${WEIGHTED}`,
    opts: weighted('tov', 'lower')
  },
  {
    id: 'sf_freq',
    label: 'shooting-foul frequency',
    short: 'SF Fr',
    description: (what, side) =>
      `The share of ${plays(what, side)} that drew a shooting foul. ${WEIGHTED}`,
    opts: weighted('sf', 'higher')
  },
  {
    id: 'and1_freq',
    label: 'and-one frequency',
    short: '+1 Fr',
    description: (what, side) =>
      `The share of ${plays(what, side)} that ended in a made shot and a foul. ${WEIGHTED}`,
    opts: weighted('and1', 'higher')
  },
  {
    id: 'score_freq',
    label: 'score frequency',
    short: 'Sc Fr',
    description: (what, side) =>
      `The share of ${plays(what, side)} that scored at least a point. Not the same as points per possession. ${WEIGHTED}`,
    opts: weighted('score', 'higher')
  }
]

/** `pt_iso_ppp`, and `pt_d_iso_ppp` for its defense. */
export const playTypeMetricId = (key: string, measure: string): string => `pt_${key}_${measure}`

function metricsOf(type: PlayType, side: PlayTypeSide, key: string): MetricDef[] {
  const name = side === 'offense' ? type.label : `${type.label} defense`
  const short = side === 'offense' ? type.short : `D ${type.short}`
  const what = type.label.toLowerCase()
  return MEASURES.map((m) =>
    metric(
      playTypeMetricId(key, m.id),
      `${name} ${m.label}`,
      `${short} ${m.short}`,
      `${m.description(what, side)} ${type.description}${m.id === 'poss' ? ` ${FROM_2024}` : ''}`,
      {
        family: 'play_types',
        sources: SOURCES,
        firstSeason: PLAY_TYPES_FIRST_SEASON,
        published: `pub_player_pt_${key}`,
        ...m.opts(key, side)
      }
    )
  )
}

/** The preset: how often and how well, for the six commonest offensive types. */
const CORE = new Set(
  ['iso', 'pnr_bh', 'pnr_roll', 'post_up', 'spot_up', 'transition'].flatMap((k) => [
    playTypeMetricId(k, 'freq'),
    playTypeMetricId(k, 'ppp')
  ])
)

export const PLAY_TYPES: MetricDef[] = PLAY_TYPE_SIDES.flatMap(({ type, side, key }) =>
  metricsOf(type, side, key)
).map((m) => (CORE.has(m.id) ? { ...m, tier: 'core' } : m))
