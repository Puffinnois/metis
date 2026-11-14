import type { MetricDef } from '../types'

/**
 * League indexes (Plan T1006): a rate against the league in the same scope, 100 the league's own rate,
 * Basketball-Reference's `+` family (TS+, eFG+). One mechanism, `MetricDef.index`: an entry reads its
 * rate's formula and the engine divides it by the league's, the league's sums over the same games
 * (data policy 3), so a date range, the playoffs or a split each have their own 100. A rate where lower
 * is better is mirrored so that above 100 is still better. Each entry is in this family, so the picker
 * offers them together, and its stability is measured like any metric's.
 */

/** The rates indexed, with the index's short label. A team's offense and defense use the same. */
const PLAYER_INDEXES: [string, string][] = [
  ['ts_pct', 'TS+'],
  ['efg_pct', 'eFG+'],
  ['fg_pct', 'FG%+'],
  ['fg2_pct', '2P%+'],
  ['fg3_pct', '3P%+'],
  ['ft_pct', 'FT%+'],
  ['fg3a_rate', '3PAr+'],
  ['fta_rate', 'FTr+'],
  ['tov_pct', 'TOV%+'],
  ['ast_pct', 'AST%+'],
  ['orb_pct', 'ORB%+'],
  ['drb_pct', 'DRB%+'],
  ['trb_pct', 'TRB%+'],
  ['stl_pct', 'STL%+'],
  ['blk_pct', 'BLK%+'],
  ['usg_pct', 'USG%+']
]

/** The team rates: both sides of each shooting and four-factor rate, and the team's rebounding. */
const TEAM_INDEXES: [string, string][] = [
  ...[
    'ts_pct',
    'efg_pct',
    'fg_pct',
    'fg2_pct',
    'fg3_pct',
    'ft_pct',
    'fg3a_rate',
    'fta_rate',
    'tov_pct'
  ]
    .map((id) => PLAYER_INDEXES.find(([p]) => p === id)!)
    .flatMap(([id, short]): [string, string][] => [
      [`team_${id}`, short],
      [`opp_${id}`, `Opp ${short}`]
    ]),
  ['team_orb_pct', 'ORB%+'],
  ['team_drb_pct', 'DRB%+'],
  ['team_trb_pct', 'TRB%+']
]

const DIRECTION_WORDS: Record<MetricDef['direction'], string> = {
  higher: 'Above 100 is better.',
  lower:
    'Mirrored, since a lower rate is better: 100 × (2 − rate / league), so above 100 is better.',
  neutral: 'Neither side is better.'
}

/** The index of one rate, read from its own entry. */
function indexOf(base: MetricDef, short: string): MetricDef {
  return {
    ...base,
    id: `${base.id}_plus`,
    label: `${base.label} index`,
    short,
    description: `${base.label} as a share of the league's in the same scope, times 100: 100 is the league, the league's own totals over the same games divided, not an average of players. ${DIRECTION_WORDS[base.direction]}`,
    family: 'indexes',
    unit: 'number',
    decimals: 0,
    direction: base.direction === 'neutral' ? 'neutral' : 'higher',
    tier: 'extended',
    index: base.id
  }
}

/** The index entries for the catalogue's rates; a rate missing from it is left out. */
export function leagueIndexes(catalogue: readonly MetricDef[]): MetricDef[] {
  const byId = new Map(catalogue.map((m) => [m.id, m]))
  return [...PLAYER_INDEXES, ...TEAM_INDEXES].flatMap(([id, short]) => {
    const base = byId.get(id)
    return base && base.aggregation === 'ratio' ? [indexOf(base, short)] : []
  })
}
