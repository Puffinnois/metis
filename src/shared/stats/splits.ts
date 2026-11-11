/**
 * Splits of a game counted from the NBA's play by play (reference section 12): quarters and halves,
 * clutch, the score, the last minutes, garbage time. Each is a rule on a moment of the game: its
 * period, the seconds left on the clock and the margin, from the side of the team the stat belongs
 * to. The rules are data here, so the builder, the engine and the screens read the same numbers.
 *
 * Which moment decides: a play counts in a split by the score before it, so the shot that takes a
 * five-point game to seven is still clutch, and the free throw after it is not. Time counts by the
 * score while the clock runs, which is the score after the last play.
 */

/** The NBA's play by play starts in 1996-97: a split has no answer before it. */
export const SPLITS_FIRST_SEASON = 1997

/**
 * One window of a split. A moment is in it when its period is in `periods` (both ends inclusive, no
 * upper end for every overtime), its clock in `clock` (seconds left, `(from, to]`, or `[0, to]` when
 * `from` is 0), and the team's margin between `margin` ends (inclusive), within `absMax` of a tie and at least `absMin` from it.
 * A field left out does not restrict.
 */
export interface SplitPiece {
  periods?: [number, number | null]
  clock?: [number, number]
  margin?: [number | null, number | null]
  absMax?: number
  absMin?: number
}

export type SplitGroup = 'period' | 'clutch' | 'score' | 'late' | 'garbage'

export interface SplitDef {
  id: string
  /** As a menu lists it. */
  label: string
  group: SplitGroup
  /** The rule, in one short line for the screen. */
  rule: string
  /** A moment is in the split when it is in any piece. */
  pieces: SplitPiece[]
  /** The same moment from the other side: ahead for one team is behind for the other. */
  mirror?: string
}

const Q4_ON: [number, number | null] = [4, null]

export const SPLITS: readonly SplitDef[] = [
  {
    id: 'q1',
    label: '1st quarter',
    group: 'period',
    rule: 'The first quarter.',
    pieces: [{ periods: [1, 1] }]
  },
  {
    id: 'q2',
    label: '2nd quarter',
    group: 'period',
    rule: 'The second quarter.',
    pieces: [{ periods: [2, 2] }]
  },
  {
    id: 'q3',
    label: '3rd quarter',
    group: 'period',
    rule: 'The third quarter.',
    pieces: [{ periods: [3, 3] }]
  },
  {
    id: 'q4',
    label: '4th quarter',
    group: 'period',
    rule: 'The fourth quarter.',
    pieces: [{ periods: [4, 4] }]
  },
  {
    id: 'h1',
    label: '1st half',
    group: 'period',
    rule: 'The first and second quarters.',
    pieces: [{ periods: [1, 2] }]
  },
  {
    id: 'h2',
    label: '2nd half',
    group: 'period',
    rule: 'The third and fourth quarters, without overtime.',
    pieces: [{ periods: [3, 4] }]
  },
  {
    id: 'ot',
    label: 'Overtime',
    group: 'period',
    rule: 'Every overtime period.',
    pieces: [{ periods: [5, null] }]
  },
  {
    id: 'clutch',
    label: 'Clutch',
    group: 'clutch',
    rule: "The NBA's rule: the last 5 minutes of the 4th quarter or overtime, the score within 5.",
    pieces: [{ periods: Q4_ON, clock: [0, 300], absMax: 5 }]
  },
  {
    id: 'ahead',
    label: 'Ahead',
    group: 'score',
    rule: 'While the team leads.',
    pieces: [{ margin: [1, null] }],
    mirror: 'behind'
  },
  {
    id: 'tied',
    label: 'Tied',
    group: 'score',
    rule: 'While the score is tied.',
    pieces: [{ margin: [0, 0] }]
  },
  {
    id: 'behind',
    label: 'Behind',
    group: 'score',
    rule: 'While the team trails.',
    pieces: [{ margin: [null, -1] }],
    mirror: 'ahead'
  },
  {
    id: 'within5',
    label: 'Within 5',
    group: 'score',
    rule: 'While the score is within 5 points either way, at any time.',
    pieces: [{ absMax: 5 }]
  },
  {
    id: 'ahead10',
    label: 'Ahead by 10+',
    group: 'score',
    rule: 'While the team leads by 10 points or more.',
    pieces: [{ margin: [10, null] }],
    mirror: 'behind10'
  },
  {
    id: 'behind10',
    label: 'Behind by 10+',
    group: 'score',
    rule: 'While the team trails by 10 points or more.',
    pieces: [{ margin: [null, -10] }],
    mirror: 'ahead10'
  },
  {
    id: 'end2',
    label: 'Last 2 min of a period',
    group: 'late',
    rule: 'The last 2 minutes of every quarter and overtime, whatever the score.',
    pieces: [{ clock: [0, 120] }]
  },
  {
    id: 'last2',
    label: 'Last 2 min of the game',
    group: 'late',
    rule: 'The last 2 minutes of the 4th quarter and of each overtime, whatever the score.',
    pieces: [{ periods: Q4_ON, clock: [0, 120] }]
  },
  {
    id: 'last1',
    label: 'Last minute of the game',
    group: 'late',
    rule: 'The last minute of the 4th quarter and of each overtime, whatever the score.',
    pieces: [{ periods: Q4_ON, clock: [0, 60] }]
  },
  {
    id: 'garbage',
    label: 'Garbage time',
    group: 'garbage',
    rule: 'The 4th quarter with a lead of 25+ and over 9 minutes left, 20+ with 6 to 9, or 10+ with 6 or less.',
    pieces: [
      { periods: [4, 4], clock: [540, 720], absMin: 25 },
      { periods: [4, 4], clock: [360, 540], absMin: 20 },
      { periods: [4, 4], clock: [0, 360], absMin: 10 }
    ]
  },
  {
    id: 'nogarbage',
    label: 'Without garbage time',
    group: 'garbage',
    rule: 'Everything but garbage time.',
    pieces: [
      { periods: [1, 3] },
      { periods: [5, null] },
      { periods: [4, 4], clock: [540, 720], absMax: 24 },
      { periods: [4, 4], clock: [360, 540], absMax: 19 },
      { periods: [4, 4], clock: [0, 360], absMax: 9 }
    ]
  }
]

export const SPLIT_IDS: readonly string[] = SPLITS.map((s) => s.id)

export const splitById = (id: string | undefined): SplitDef | undefined =>
  id === undefined ? undefined : SPLITS.find((s) => s.id === id)

/** The split as the other team sees the same moments. */
export const mirrorOf = (s: SplitDef): string => s.mirror ?? s.id

/** Whether a moment is in a piece: the rule in plain code, for tests and the screens' copy. */
export function inPiece(p: SplitPiece, period: number, clock: number, margin: number): boolean {
  if (p.periods && (period < p.periods[0] || (p.periods[1] !== null && period > p.periods[1]))) {
    return false
  }
  if (p.clock) {
    const [from, to] = p.clock
    if (clock > to || (from > 0 && clock <= from)) return false
  }
  if (p.margin) {
    const [lo, hi] = p.margin
    if ((lo !== null && margin < lo) || (hi !== null && margin > hi)) return false
  }
  if (p.absMax !== undefined && Math.abs(margin) > p.absMax) return false
  if (p.absMin !== undefined && Math.abs(margin) < p.absMin) return false
  return true
}

export const inSplit = (s: SplitDef, period: number, clock: number, margin: number): boolean =>
  s.pieces.some((p) => inPiece(p, period, clock, margin))
