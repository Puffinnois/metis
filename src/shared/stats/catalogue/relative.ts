import type { MetricDef } from '../types'
import { swapSides } from './define'

/**
 * Shooting against the league (T1703.3, reference 74, 76 and 77): a rate less the league's, in
 * percentage points, and the points a player's or a team's shooting brings beyond what the league
 * average would bring on the same attempts. The league is the same scope's, as the indexes read it
 * (`MetricDef.relative`): its sums over the same games, so a date range or the playoffs has its own.
 */
const TSA = '{fga} + 0.44 * {fta}'

interface Base {
  /** The rate read against the league: a player metric's id, its team's and opponents' prefixed. */
  rate: string
  id: string
  label: string
  short: string
  addId: string
  addLabel: string
  addShort: string
  /** What the rate counts, over which weight: the points, over the points at a rate of 1. */
  counts: string
  weight: string
  words: string
}

const BASES: Base[] = [
  {
    rate: 'ts_pct',
    id: 'rts_pct',
    label: 'Relative true shooting percentage',
    short: 'rTS%',
    addId: 'ts_add',
    addLabel: 'True-shooting points added',
    addShort: 'TS Add',
    counts: '{pts}',
    weight: `2 * (${TSA})`,
    words: 'true shooting'
  },
  {
    rate: 'efg_pct',
    id: 'refg_pct',
    label: 'Relative effective field-goal percentage',
    short: 'reFG%',
    addId: 'fg_add',
    addLabel: 'Field-goal points added',
    addShort: 'FG Add',
    counts: '2 * {fgm} + {fg3m}',
    weight: '2 * {fga}',
    words: 'effective field-goal percentage'
  }
]

/** The rate's entry less the league's, and the points added, for one side (`prefix` of its ids). */
function entriesOf(
  b: Base,
  base: MetricDef,
  prefix: '' | 'team_' | 'opp_',
  words: { label: (s: string) => string; short: (s: string) => string; side: string }
): MetricDef[] {
  const swap = prefix === 'opp_' ? swapSides : (s: string): string => s
  return [
    {
      ...base,
      id: `${prefix}${b.id}`,
      label: words.label(b.label),
      short: words.short(b.short),
      description: `${base.label} less the league's in the same scope, in percentage points: 0 is the league, its own totals over the same games divided, not an average of players. ${words.side}`.trim(),
      tier: 'extended',
      index: base.id,
      relative: 'difference'
    },
    {
      ...base,
      id: `${prefix}${b.addId}`,
      label: words.label(b.addLabel),
      short: words.short(b.addShort),
      description: `The points scored beyond what the league's ${b.words} in the same scope would bring on the same attempts: 2 × attempts × (rate − league's rate), a total. 0 is the league. ${words.side}`.trim(),
      value: swap(b.counts),
      weight: swap(b.weight),
      sample: prefix === '' ? 'games' : 'box_games',
      // A few old games have only a score, so a team's count is per game of a box score.
      perGameBy: prefix === '' ? undefined : 'box_games',
      minSample: undefined,
      qualifyBy: undefined,
      unit: 'number',
      decimals: 1,
      kind: 'derived',
      aggregation: 'sum',
      tier: 'extended',
      index: base.id,
      relative: 'added'
    }
  ]
}

/** The entries read against the league, for players, teams and their opponents. */
export function LEAGUE_RELATIVE(catalogue: readonly MetricDef[]): MetricDef[] {
  const byId = new Map(catalogue.map((m) => [m.id, m]))
  return BASES.flatMap((b) => {
    const player = byId.get(b.rate)
    const team = byId.get(`team_${b.rate}`)
    const opp = byId.get(`opp_${b.rate}`)
    if (!player || !team || !opp) return []
    const same = (s: string): string => s
    return [
      ...entriesOf(b, player, '', { label: same, short: same, side: '' }),
      ...entriesOf(b, team, 'team_', { label: same, short: same, side: '' }),
      ...entriesOf(b, opp, 'opp_', {
        label: (s) => `Opponent ${s[0].toLowerCase()}${s.slice(1)}`,
        short: (s) => `Opp ${s}`,
        side: "For the team's opponents: lower is better for the team."
      })
    ]
  })
}
