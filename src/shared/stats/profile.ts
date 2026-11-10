/**
 * The draft combine, as the player dashboard's Profile tab reads it (reference section 17). Four of
 * the NBA's five combine tables hold the measures: measurements, athletic testing, spot-up shooting,
 * and shooting off the dribble and on the move. The fifth, `draftcombinestats`, repeats the other four
 * column for column on every row, its shooting written as "3-5", so nothing is read from it alone.
 *
 * Each measure is ranked among the players of the same position group at every combine in the data,
 * as the template ranks its combine: the position's first listed group (`SG-SF` is a guard, as in
 * Plan T504), mid-rank percentiles so a common measure is not ranked as the lowest of its ties.
 */

export type CombineTable = 'anthro' | 'drills' | 'spot_up' | 'on_the_move'

/** The source table of each part, as loaded. */
export const COMBINE_TABLES: Record<CombineTable, string> = {
  anthro: 'src_nba_combine_anthro',
  drills: 'src_nba_combine_drills',
  spot_up: 'src_nba_combine_spot_up',
  on_the_move: 'src_nba_combine_on_the_move'
}

export const COMBINE_SECTIONS = [
  'Measurements',
  'Proportions',
  'Athletic testing',
  'Spot-up shooting',
  'Shooting off the dribble',
  'Shooting on the move'
] as const
export type CombineSection = (typeof COMBINE_SECTIONS)[number]

/**
 * How a value reads: a length in feet and inches, inches, pounds, a percentage of body weight,
 * seconds, repetitions, a ratio, or shots made of those taken.
 */
export type CombineUnit =
  'length' | 'inches' | 'lb' | 'body_fat' | 'seconds' | 'reps' | 'ratio' | 'shots'

export interface CombineMeasure {
  id: string
  label: string
  section: CombineSection
  unit: CombineUnit
  /** The better side; null for a measurement, which is neither good nor bad. */
  better: 'higher' | 'lower' | null
  /**
   * Where the value comes from: a published column, the spots of a shooting drill (made and attempted
   * added up), or two other measures.
   */
  source:
    | { table: CombineTable; column: string }
    | { table: CombineTable; spots: string[] }
    | { ratio: [string, string] }
    | { sum: [string, string] }
}

const anthro = (id: string, label: string, unit: CombineUnit, column = id): CombineMeasure => ({
  id,
  label,
  section: 'Measurements',
  unit,
  better: null,
  source: { table: 'anthro', column }
})

const drill = (
  id: string,
  label: string,
  unit: CombineUnit,
  better: 'higher' | 'lower'
): CombineMeasure => ({
  id,
  label,
  section: 'Athletic testing',
  unit,
  better,
  source: { table: 'drills', column: id }
})

const SPOTS: [string, string][] = [
  ['corner_left', 'left corner'],
  ['break_left', 'left wing'],
  ['top_key', 'top of the key'],
  ['break_right', 'right wing'],
  ['corner_right', 'right corner']
]
const DISTANCES: [string, string][] = [
  ['fifteen', '15 feet'],
  ['college', 'College three'],
  ['nba', 'NBA three']
]

/** A drill's total over its spots, then each spot. */
function shooting(
  section: CombineSection,
  table: CombineTable,
  prefix: string,
  distance: [string, string],
  spots: [string, string][]
): CombineMeasure[] {
  const [key, name] = distance
  const columns = spots.map(([spot]) => `${prefix}${key}_${spot}`)
  const shot = (id: string, label: string, source: CombineMeasure['source']): CombineMeasure => ({
    id,
    label,
    section,
    unit: 'shots',
    better: 'higher',
    source
  })
  return [
    shot(`${prefix}${key}`, `${name}, all shots`, { table, spots: columns }),
    ...spots.map(([, where], i) =>
      shot(columns[i], `${name}, ${where}`, { table, column: columns[i] })
    )
  ]
}

const OFF_DRIBBLE_SPOTS = SPOTS.filter(([s]) => s.startsWith('break') || s === 'top_key')

export const COMBINE_MEASURES: CombineMeasure[] = [
  anthro('height_wo_shoes', 'Height without shoes', 'length'),
  anthro('height_w_shoes', 'Height with shoes', 'length'),
  anthro('weight', 'Weight', 'lb'),
  anthro('wingspan', 'Wingspan', 'length'),
  anthro('standing_reach', 'Standing reach', 'length'),
  anthro('body_fat_pct', 'Body fat', 'body_fat'),
  anthro('hand_length', 'Hand length', 'inches'),
  anthro('hand_width', 'Hand width', 'inches'),
  {
    id: 'wingspan_to_height',
    label: 'Wingspan to height',
    section: 'Proportions',
    unit: 'ratio',
    better: null,
    source: { ratio: ['wingspan', 'height_wo_shoes'] }
  },
  {
    id: 'reach_to_height',
    label: 'Standing reach to height',
    section: 'Proportions',
    unit: 'ratio',
    better: null,
    source: { ratio: ['standing_reach', 'height_wo_shoes'] }
  },
  {
    id: 'standing_vertical_reach',
    label: 'Reach on a standing jump',
    section: 'Proportions',
    unit: 'length',
    better: 'higher',
    source: { sum: ['standing_reach', 'standing_vertical_leap'] }
  },
  {
    id: 'max_vertical_reach',
    label: 'Reach on a running jump',
    section: 'Proportions',
    unit: 'length',
    better: 'higher',
    source: { sum: ['standing_reach', 'max_vertical_leap'] }
  },
  drill('standing_vertical_leap', 'Standing vertical leap', 'inches', 'higher'),
  drill('max_vertical_leap', 'Max vertical leap', 'inches', 'higher'),
  drill('lane_agility_time', 'Lane agility', 'seconds', 'lower'),
  drill('modified_lane_agility_time', 'Shuttle run', 'seconds', 'lower'),
  drill('three_quarter_sprint', 'Three-quarter-court sprint', 'seconds', 'lower'),
  drill('bench_press', 'Bench press', 'reps', 'higher'),
  ...DISTANCES.flatMap((d) => shooting('Spot-up shooting', 'spot_up', '', d, SPOTS)),
  ...DISTANCES.slice(0, 2).flatMap((d) =>
    shooting('Shooting off the dribble', 'on_the_move', 'off_drib_', d, OFF_DRIBBLE_SPOTS)
  ),
  ...['fifteen', 'college'].map((key): CombineMeasure => ({
    id: `on_move_${key}`,
    label: key === 'fifteen' ? '15 feet' : 'College three',
    section: 'Shooting on the move',
    unit: 'shots',
    better: 'higher',
    source: { table: 'on_the_move', column: `on_move_${key}` }
  }))
]

export const COMBINE_BY_ID: ReadonlyMap<string, CombineMeasure> = new Map(
  COMBINE_MEASURES.map((m) => [m.id, m])
)

/** A draft or combine file's label is the season after it: the 2025 draft is in file `2026`. */
export const eventYear = (season: number): number => season - 1
