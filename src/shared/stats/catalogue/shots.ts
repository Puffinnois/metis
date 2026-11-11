import { SHOT_BANDS, SHOT_TYPES, SHOT_ZONE_GROUPS, SHOT_ZONES, SHOTS_FIRST_SEASON } from '../shots'
import type { MetricDef } from '../types'
import { metric, type Opts } from './define'

/**
 * Reference section 7: shots by zone, distance band and type, from the NBA's shot file, 1996-97 on.
 * Counted per player-game and team-game (`src/main/stats/derived/shots.ts`), so any season, date range
 * or game filter reads exactly, and every rate is divided when read.
 *
 * Source: the NBA's shots only. ESPN's shots are another coordinate frame with a coarser grid; they are
 * checked against the box scores (`nba-data-sources.md`) and never added in.
 *
 * Relative to league: each attempt is compared with the league's regular-season rate for its zone,
 * band or type in the same season, recomputed from the shots (not read from the dataset's distance
 * curves, which mix every season type and have no zones; the two are compared in the data report).
 * "FG% vs league" is the makes above that rate per attempt, in percentage points; "points per shot vs
 * league" the points above it per attempt. Location only: it says nothing of the defender or the clock.
 *
 * Not available, with the reason: catch-and-shoot and pull-up splits by zone, closest-defender
 * distance, dribbles, touch time, the shot clock and contested shots are tracking context no table has
 * at the shot level (checked on a full load); the season tracking files' catch-and-shoot and pull-up
 * totals are in the Tracking family. Shot quality models are section 15's and not published.
 */

const SOURCES = ["The NBA's shot chart file"]
const TABLES = { player: 'shot_player_game', team: 'shot_team_game' } as const
/** The table stores expected makes and points in thousandths. */
const SCALE = 1000

/**
 * Column heads, short enough that an opponent's ("Opp LC3 FG%+") fits: the zone, band or type in at
 * most five characters, the measure in at most four.
 */
const HEAD: Record<string, string> = {
  ra: 'RA',
  paint: 'Paint',
  mid: 'Mid',
  c3: 'C3',
  c3l: 'LC3',
  c3r: 'RC3',
  atb3: 'ATB3',
  back: 'BC',
  lt8: '<8',
  d8_16: '8-16',
  d16_24: '16-24',
  d24p: '24+',
  dunk: 'Dunk',
  tip: 'Tip',
  layup: 'Layup',
  hook: 'Hook',
  floater: 'Float',
  jumper: 'Jump'
}

interface Bucket {
  key: string
  label: string
  short: string
  /** The attempts a player needs over 82 games for a rate here to qualify. */
  min: number
}

const ZONE_MIN: Record<string, number> = {
  ra: 100,
  paint: 75,
  mid: 75,
  c3: 50,
  c3l: 25,
  c3r: 25,
  atb3: 100,
  back: 5
}

const ZONES: Bucket[] = [...SHOT_ZONES.filter((z) => z.key !== 'unk'), ...SHOT_ZONE_GROUPS].map(
  (z) => ({ key: z.key, label: z.label, short: HEAD[z.key], min: ZONE_MIN[z.key] })
)
// The combined corner reads beside the two corners.
ZONES.splice(
  ZONES.findIndex((z) => z.key === 'c3l'),
  0,
  ...ZONES.splice(
    ZONES.findIndex((z) => z.key === 'c3'),
    1
  )
)

const BANDS: Bucket[] = SHOT_BANDS.map((b) => ({
  key: b.key,
  label: b.label,
  short: HEAD[b.key],
  min: 100
}))

const TYPE_MIN: Record<string, number> = {
  dunk: 25,
  tip: 25,
  layup: 100,
  hook: 50,
  floater: 50,
  jumper: 200
}

const TYPES: Bucket[] = SHOT_TYPES.filter((t) => t.key !== 'other').map((t) => ({
  key: t.key,
  label: t.label,
  short: HEAD[t.key],
  min: TYPE_MIN[t.key]
}))

/** The share of all attempts a frequency needs to be read over: a season's worth of shots. */
const FREQ_MIN = 300

/** Which side a metric reads and how it is named: the player, the team, or the team's opponents. */
interface Side {
  entity: 'player' | 'team'
  /** Component prefix: `opp_` for the shots a team faced. */
  c: string
  id: (rest: string) => string
  label: (text: string) => string
  short: (text: string) => string
  side?: 'offense' | 'defense'
  /** The direction of a measure where more is better for the shooter. */
  up: MetricDef['direction']
}

const lowerFirst = (text: string): string =>
  /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text

const SIDES: Side[] = [
  {
    entity: 'player',
    c: '',
    id: (r) => `shot_${r}`,
    label: (t) => t,
    short: (t) => t,
    up: 'higher'
  },
  {
    entity: 'team',
    c: '',
    id: (r) => `team_shot_${r}`,
    label: (t) => t,
    short: (t) => t,
    side: 'offense',
    up: 'higher'
  },
  {
    entity: 'team',
    c: 'opp_',
    id: (r) => `opp_shot_${r}`,
    label: (t) => `Opponent ${lowerFirst(t)}`,
    short: (t) => `Opp ${t}`,
    side: 'defense',
    up: 'lower'
  }
]

/** The base of every metric here, for one side. */
function base(s: Side, { min, ...o }: Opts & { min?: number }): Opts {
  const team = s.entity === 'team'
  return {
    family: 'shots',
    entity: s.entity,
    side: s.side,
    sources: SOURCES,
    firstSeason: SHOTS_FIRST_SEASON,
    built: TABLES[s.entity],
    tier: 'extended',
    kind: 'derived',
    // Teams always qualify.
    minSample: team ? undefined : min,
    ...o,
    ...(team && o.sample === 'games' ? { sample: 'box_games', perGameBy: 'box_games' } : {})
  }
}

const flip = (s: Side, d: MetricDef['direction']): MetricDef['direction'] =>
  s.up === 'lower' && d !== 'neutral' ? (d === 'higher' ? 'lower' : 'higher') : d

/** The measures of one bucket, for one side. `measures` picks which. */
function bucketMetrics(s: Side, b: Bucket, what: string, measures: readonly string[]): MetricDef[] {
  const c = (m: string): string => `{${s.c}${b.key}_${m}}`
  const fga = `${s.c}${b.key}_fga`
  const fgm = `${s.c}${b.key}_fgm`
  const out: MetricDef[] = []
  const add = (
    m: string,
    label: string,
    short: string,
    description: string,
    o: Opts & { min?: number }
  ): void => {
    if (!measures.includes(m)) return
    out.push(metric(s.id(`${b.key}_${m}`), s.label(label), s.short(short), description, base(s, o)))
  }
  const faced = s.c ? ' taken against the team' : ''
  add('fga', `${b.label} attempts`, `${b.short} FGA`, `Field-goal attempts ${what}${faced}.`, {
    value: c('fga'),
    sample: 'games',
    kind: 'recorded',
    aggregation: 'sum',
    unit: 'count',
    decimals: 0,
    direction: 'neutral'
  })
  add('fgm', `${b.label} makes`, `${b.short} FGM`, `Field goals made ${what}${faced}.`, {
    value: c('fgm'),
    sample: 'games',
    kind: 'recorded',
    aggregation: 'sum',
    unit: 'count',
    decimals: 0,
    direction: flip(s, 'higher')
  })
  add(
    'fg_pct',
    `${b.label} FG%`,
    `${b.short} FG%`,
    `Field-goal percentage ${what}${faced}: makes over attempts.`,
    {
      value: `${c('fgm')} / nullif(${c('fga')}, 0)`,
      sample: fga,
      min: b.min,
      unit: 'pct',
      decimals: 1,
      direction: flip(s, 'higher')
    }
  )
  add(
    'freq',
    `${b.label} frequency`,
    `${b.short} Frq`,
    `The share of all field-goal attempts${faced} taken ${what}.`,
    {
      value: `${c('fga')} / nullif({${s.c}shots_fga}, 0)`,
      sample: `${s.c}shots_fga`,
      min: FREQ_MIN,
      unit: 'pct',
      decimals: 1,
      direction: 'neutral'
    }
  )
  add(
    'pps',
    `${b.label} points per shot`,
    `${b.short} PPS`,
    `Points per field-goal attempt ${what}${faced}.`,
    {
      value: `${c('pts')} / nullif(${c('fga')}, 0)`,
      sample: fga,
      min: b.min,
      unit: 'number',
      decimals: 2,
      direction: flip(s, 'higher')
    }
  )
  add(
    'efg_pct',
    `${b.label} eFG%`,
    `${b.short} eFG%`,
    `Effective field-goal percentage ${what}${faced}: a three counts as one and a half makes, which is points over twice the attempts.`,
    {
      value: `${c('pts')} / nullif(2 * ${c('fga')}, 0)`,
      sample: fga,
      min: b.min,
      unit: 'pct',
      decimals: 1,
      direction: flip(s, 'higher')
    }
  )
  add(
    'fg_rel',
    `${b.label} FG% vs league`,
    `${b.short} FG%+`,
    `Field-goal percentage ${what}${faced} above the league's that season, in points: the makes over what the league's regular-season rate ${what} would give the same attempts, per attempt.`,
    {
      value: `(${c('fgm')} - ${c('xfgm')} / ${SCALE}.0) / nullif(${c('fga')}, 0)`,
      sample: fga,
      min: b.min,
      unit: 'pct',
      decimals: 1,
      direction: flip(s, 'higher')
    }
  )
  add(
    'pps_rel',
    `${b.label} points per shot vs league`,
    `${b.short} PPS+`,
    `Points per attempt ${what}${faced} above what the league's regular-season rate there that season would give.`,
    {
      value: `(${c('pts')} - ${c('xpts')} / ${SCALE}.0) / nullif(${c('fga')}, 0)`,
      sample: fga,
      min: b.min,
      unit: 'number',
      decimals: 2,
      direction: flip(s, 'higher')
    }
  )
  add(
    'ast_pct',
    `${b.label} assisted share`,
    `${b.short} Ast%`,
    `The share of field goals made ${what}${faced} that were assisted, by the assist the play by play names.`,
    {
      value: `${c('ast')} / nullif(${c('fgm')}, 0)`,
      sample: fgm,
      min: Math.ceil(b.min / 2),
      unit: 'pct',
      decimals: 1,
      direction: 'neutral'
    }
  )
  return out
}

const ZONE_MEASURES = [
  'fga',
  'fgm',
  'fg_pct',
  'freq',
  'pps',
  'efg_pct',
  'fg_rel',
  'pps_rel',
  'ast_pct'
]
const BAND_MEASURES = ['fga', 'fgm', 'fg_pct', 'freq', 'pps', 'efg_pct', 'fg_rel', 'pps_rel']
const TYPE_MEASURES = ['fga', 'fgm', 'fg_pct', 'freq', 'fg_rel']

const where = {
  zone: (b: Bucket): string =>
    b.key === 'back' ? 'from beyond half court' : `from the ${lowerFirst(b.label)}`,
  band: (b: Bucket): string => `from ${lowerFirst(b.label)}`,
  type: (b: Bucket): string => (b.key === 'jumper' ? 'on jump shots' : `on ${lowerFirst(b.label)}s`)
}

/** The overall measures: average distance, and points above what the league's zone rates give. */
function overall(s: Side): MetricDef[] {
  const c = (n: string): string => `{${s.c}${n}}`
  const faced = s.c ? ' taken against the team' : ''
  return [
    metric(
      s.id('avg_dist'),
      s.label('Average shot distance'),
      s.short('Shot dist'),
      `The average distance of field-goal attempts${faced}, in feet, as the NBA records it.`,
      base(s, {
        value: `${c('dist_sum')} / nullif(${c('dist_n')}, 0)`,
        sample: `${s.c}dist_n`,
        min: FREQ_MIN,
        unit: 'number',
        decimals: 1,
        direction: 'neutral'
      })
    ),
    metric(
      s.id('pts_above'),
      s.label('Points above league by location'),
      s.short('Pts+ loc'),
      `Points from field goals${faced} above what the league's regular-season rate in each zone that season would give the same attempts. Location only: not a shot-quality model.`,
      base(s, {
        value: `${c('shots_pts')} - ${c('shots_xpts')} / ${SCALE}.0`,
        sample: 'games',
        aggregation: 'sum',
        unit: 'number',
        decimals: 1,
        direction: flip(s, 'higher')
      })
    ),
    metric(
      s.id('pps_above'),
      s.label('Points per shot above league by location'),
      s.short('PPS+ loc'),
      `Points per field-goal attempt${faced} above what the league's regular-season rate in each zone that season would give.`,
      base(s, {
        value: `(${c('shots_pts')} - ${c('shots_xpts')} / ${SCALE}.0) / nullif(${c('shots_fga')}, 0)`,
        sample: `${s.c}shots_fga`,
        min: FREQ_MIN,
        unit: 'number',
        decimals: 2,
        direction: flip(s, 'higher')
      })
    )
  ]
}

export const SHOTS: MetricDef[] = SIDES.flatMap((s) => [
  ...ZONES.flatMap((b) => bucketMetrics(s, b, where.zone(b), ZONE_MEASURES)),
  ...BANDS.flatMap((b) => bucketMetrics(s, b, where.band(b), BAND_MEASURES)),
  ...TYPES.flatMap((b) => bucketMetrics(s, b, where.type(b), TYPE_MEASURES)),
  ...overall(s)
])

/** What each sample counts, for the column heads: "212 restricted-area attempts". */
export const SHOT_SAMPLE_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  ['', 'opp_'].flatMap((p) => {
    const against = p ? ' faced' : ''
    return [
      [`${p}shots_fga`, `field-goal attempts${against}`],
      [`${p}dist_n`, `field-goal attempts${against}`],
      ...(
        [
          [ZONES, where.zone],
          [BANDS, where.band],
          [TYPES, where.type]
        ] as const
      ).flatMap(([buckets, at]) =>
        buckets.flatMap((b) => [
          [`${p}${b.key}_fga`, `attempts${against} ${at(b)}`],
          [`${p}${b.key}_fgm`, `makes${against} ${at(b)}`]
        ])
      )
    ]
  })
)
