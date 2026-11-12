import { seasonLabel } from '@shared/stats/seasons'
import type {
  StatsOnCourtLine,
  StatsOnCourtScope,
  StatsOnCourtUnit,
  StatsQuery,
  StatsWithOrWithout
} from '@shared/stats/types'
import { fmtClock, fmtStat } from './format'
import { queryScope, type StatsScope } from './scope'

/**
 * On and off the floor, counted from the play by play (Plan T904): the player dashboard's On/off tab,
 * the team dashboard's, and the Lineups tab's "From possessions" source. Every number here is a sum
 * of plays divided on the screen; possessions are SportsDataverse's count, not the NBA's, and the
 * players on the floor its lineup of each play, so each is marked derived.
 */

/** The NBA's play by play, and the lineups with it, start in 1996-97. */
export const ON_COURT_FIRST_SEASON = 1997

export const DERIVED_NOTE =
  'Counted from the play by play: possessions and who was on the floor are derived by SportsDataverse, not official.'

/** Why a season cannot be answered; null when it can. */
export function onCourtGap(scope: StatsScope): string | null {
  return scope.season < ON_COURT_FIRST_SEASON
    ? `Counted from ${seasonLabel(ON_COURT_FIRST_SEASON)}, when the NBA's play by play starts.`
    : null
}

/** The games a read covers. The last N games are the team's, whoever the subject is. */
export function onCourtScope(scope: StatsScope): StatsOnCourtScope {
  const q = queryScope(scope, 'team')
  return {
    gameTypes: q.gameTypes ?? ['regular'],
    ...(q.dates ? { dates: q.dates } : {}),
    ...(q.lastN !== undefined ? { lastN: q.lastN } : {})
  }
}

/** A line's numbers, each null when what it divides by is zero. */
export interface LineNumbers {
  games: number
  minutes: number
  poss: number
  pts: number
  oppPts: number
  plusMinus: number
  ortg: number | null
  drtg: number | null
  net: number | null
  pace: number | null
  efg: number | null
  oppEfg: number | null
  tovPct: number | null
  orbPct: number | null
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null)
const get = (l: StatsOnCourtLine, k: string): number => Number(l[k] ?? 0)

export function lineNumbers(l: StatsOnCourtLine): LineNumbers {
  const ortg = div(100 * get(l, 'pts'), get(l, 'poss'))
  const drtg = div(100 * get(l, 'opp_pts'), get(l, 'opp_poss'))
  return {
    games: l.games,
    minutes: l.secs / 60,
    poss: get(l, 'poss'),
    pts: get(l, 'pts'),
    oppPts: get(l, 'opp_pts'),
    plusMinus: get(l, 'pts') - get(l, 'opp_pts'),
    ortg,
    drtg,
    net: ortg !== null && drtg !== null ? ortg - drtg : null,
    pace: div(2880 * ((get(l, 'poss') + get(l, 'opp_poss')) / 2), l.secs),
    efg: div(get(l, 'fgm') + 0.5 * get(l, 'fg3m'), get(l, 'fga')),
    oppEfg: div(get(l, 'opp_fgm') + 0.5 * get(l, 'opp_fg3m'), get(l, 'opp_fga')),
    tovPct: div(get(l, 'tov'), get(l, 'poss')),
    orbPct: div(get(l, 'oreb'), get(l, 'oreb') + get(l, 'opp_dreb'))
  }
}

/** A column of a line table: its head, its title, how it reads a line, how it is written. */
interface LineColumn {
  label: string
  title: string
  of: (n: LineNumbers) => number | null
  unit: 'count' | 'rating' | 'pct' | 'number' | 'clock'
  decimals: number
}

export const LINE_COLUMNS: LineColumn[] = [
  { label: 'G', title: 'Games', of: (n) => n.games, unit: 'count', decimals: 0 },
  { label: 'MIN', title: 'Minutes on the floor', of: (n) => n.minutes, unit: 'clock', decimals: 0 },
  { label: 'POSS', title: 'Possessions', of: (n) => n.poss, unit: 'count', decimals: 0 },
  {
    label: '+/-',
    title: 'Points scored less allowed',
    of: (n) => n.plusMinus,
    unit: 'count',
    decimals: 0
  },
  {
    label: 'ORtg',
    title: 'Points per 100 possessions',
    of: (n) => n.ortg,
    unit: 'rating',
    decimals: 1
  },
  {
    label: 'DRtg',
    title: 'Points allowed per 100 possessions',
    of: (n) => n.drtg,
    unit: 'rating',
    decimals: 1
  },
  {
    label: 'NET',
    title: 'Offensive less defensive rating',
    of: (n) => n.net,
    unit: 'rating',
    decimals: 1
  },
  {
    label: 'PACE',
    title: 'Possessions per 48 minutes',
    of: (n) => n.pace,
    unit: 'number',
    decimals: 1
  },
  {
    label: 'eFG%',
    title: 'Effective field-goal percentage',
    of: (n) => n.efg,
    unit: 'pct',
    decimals: 1
  },
  {
    label: 'OPP eFG%',
    title: "Opponents' effective field-goal percentage",
    of: (n) => n.oppEfg,
    unit: 'pct',
    decimals: 1
  },
  {
    label: 'TOV%',
    title: 'Turnovers per possession',
    of: (n) => n.tovPct,
    unit: 'pct',
    decimals: 1
  },
  {
    label: 'ORB%',
    title: 'Share of own misses rebounded',
    of: (n) => n.orbPct,
    unit: 'pct',
    decimals: 1
  }
]

export const cellOf = (c: LineColumn, n: LineNumbers): string => {
  const v = c.of(n)
  if (c.unit === 'clock') return fmtClock(v)
  if (v === null) return '—'
  const text = fmtStat(v, { unit: c.unit === 'rating' ? 'number' : c.unit, decimals: c.decimals })
  return c.label === '+/-' && v > 0 ? `+${text}` : text
}

/** The four with-or-without splits, in the order they read. */
export function wowyRows(
  value: StatsWithOrWithout,
  playerName: string
): { key: string; label: string; cells: string[] | null }[] {
  const mate = value.teammates.find((t) => t.id === value.teammate)?.name ?? 'the teammate'
  const s = value.splits
  const row = (
    key: string,
    label: string,
    l: StatsOnCourtLine | null | undefined
  ): { key: string; label: string; cells: string[] | null } => ({
    key,
    label,
    cells: l ? LINE_COLUMNS.map((c) => cellOf(c, lineNumbers(l))) : null
  })
  return [
    row('both', `${playerName} and ${mate}`, s?.both),
    row('player', `${playerName} without ${mate}`, s?.playerOnly),
    row('mate', `${mate} without ${playerName}`, s?.teammateOnly),
    row('neither', 'Neither', s?.neither)
  ]
}

/** The minimum-possessions control of the derived units. */
export const MIN_POSSESSIONS = [0, 25, 50, 100, 250, 500]
export const DEFAULT_MIN_POSSESSIONS = 50

export const UNIT_SIZES = [
  { value: '5', label: 'Five' },
  { value: '4', label: 'Four' },
  { value: '3', label: 'Three' },
  { value: '2', label: 'Two' }
]

export interface UnitRow {
  key: string
  players: { id: string; name: string }[]
  cells: string[]
  numbers: (number | null)[]
}

export type UnitSort = { by: number; dir: 'asc' | 'desc' }

/** Units of at least `minPoss` possessions, sorted, with their cells: the minutes first by default. */
export function unitRows(units: StatsOnCourtUnit[], minPoss: number, sort: UnitSort): UnitRow[] {
  const rows = units
    .filter((u) => Number(u.line.poss ?? 0) >= minPoss)
    .map((u): UnitRow => {
      const n = lineNumbers(u.line)
      return {
        key: u.players.map((p) => p.id).join('-'),
        players: u.players,
        cells: LINE_COLUMNS.map((c) => cellOf(c, n)),
        numbers: LINE_COLUMNS.map((c) => c.of(n))
      }
    })
  const sign = sort.dir === 'asc' ? 1 : -1
  return rows.sort((a, b) => {
    const x = a.numbers[sort.by]
    const y = b.numbers[sort.by]
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    return (x - y) * sign
  })
}

export const DEFAULT_UNIT_SORT: UnitSort = { by: 1, dir: 'desc' }

/** The team dashboard's On/off table: each player's numbers for the team. */
export const TEAM_ON_OFF_METRICS = [
  'onc_min',
  'onc_poss',
  'onc_plus_minus',
  'onc_ortg',
  'onc_drtg',
  'onc_net',
  'offc_net',
  'onoff_ortg',
  'onoff_drtg',
  'onoff_net'
]

export function teamOnOffQuery(team: string, scope: StatsScope): StatsQuery {
  return {
    entity: 'player',
    metrics: TEAM_ON_OFF_METRICS,
    scope: { ...queryScope(scope, 'player'), teams: [team] },
    sort: { metric: 'onc_min', dir: 'desc' },
    limit: 40
  }
}
