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
  /**
   * The pieces in a season played in two halves (the WNBA to 2005, `League.periods`): period 1 and 2
   * are the halves and 3 on the overtimes. Null where the split has no answer then (a quarter), left
   * out where its pieces name no period and read the same. The 4th quarter's rules read the last 10
   * minutes of the second half, a 4th quarter's length in that league.
   */
  halves?: SplitPiece[] | null
  /** The same moment from the other side: ahead for one team is behind for the other. */
  mirror?: string
}

const Q4_ON: [number, number | null] = [4, null]
/** The second half and every overtime, in a season played in halves. */
const H2_ON: [number, number | null] = [2, null]

/**
 * A split's pieces in a season with `regulation` periods: its own in four quarters, its `halves` in two
 * halves. None where it has no answer in that format.
 */
export function splitPiecesIn(s: SplitDef, regulation: number): SplitPiece[] {
  if (regulation !== 2 || s.halves === undefined) return s.pieces
  return s.halves ?? []
}

/**
 * A split's rule in the league's words: in a league played in two halves every season (the NCAA men,
 * D38) the halves are halves, not quarters added up, and the 4th quarter's rules read the 2nd half.
 */
export function splitRuleIn(s: SplitDef, halvesOnly: boolean): string {
  if (!halvesOnly) return s.rule
  if (s.id === 'h1') return 'The first half.'
  if (s.id === 'h2') return 'The second half, without overtime.'
  return s.rule
    .replaceAll('the 4th quarter', 'the 2nd half')
    .replaceAll('The 4th quarter', 'The 2nd half')
}

/** Whether a split has an answer in a season with `regulation` periods: no quarters in halves. */
export const splitAnswersIn = (s: SplitDef, regulation: number): boolean =>
  splitPiecesIn(s, regulation).length > 0

export const SPLITS: readonly SplitDef[] = [
  {
    id: 'q1',
    label: '1st quarter',
    group: 'period',
    rule: 'The first quarter.',
    pieces: [{ periods: [1, 1] }],
    halves: null
  },
  {
    id: 'q2',
    label: '2nd quarter',
    group: 'period',
    rule: 'The second quarter.',
    pieces: [{ periods: [2, 2] }],
    halves: null
  },
  {
    id: 'q3',
    label: '3rd quarter',
    group: 'period',
    rule: 'The third quarter.',
    pieces: [{ periods: [3, 3] }],
    halves: null
  },
  {
    id: 'q4',
    label: '4th quarter',
    group: 'period',
    rule: 'The fourth quarter.',
    pieces: [{ periods: [4, 4] }],
    halves: null
  },
  {
    id: 'h1',
    label: '1st half',
    group: 'period',
    rule: 'The first and second quarters.',
    pieces: [{ periods: [1, 2] }],
    halves: [{ periods: [1, 1] }]
  },
  {
    id: 'h2',
    label: '2nd half',
    group: 'period',
    rule: 'The third and fourth quarters, without overtime.',
    pieces: [{ periods: [3, 4] }],
    halves: [{ periods: [2, 2] }]
  },
  {
    id: 'ot',
    label: 'Overtime',
    group: 'period',
    rule: 'Every overtime period.',
    pieces: [{ periods: [5, null] }],
    halves: [{ periods: [3, null] }]
  },
  {
    id: 'clutch',
    label: 'Clutch',
    group: 'clutch',
    rule: 'The last 5 minutes of the 4th quarter or overtime, the score within 5.',
    pieces: [{ periods: Q4_ON, clock: [0, 300], absMax: 5 }],
    halves: [{ periods: H2_ON, clock: [0, 300], absMax: 5 }]
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
    pieces: [{ periods: Q4_ON, clock: [0, 120] }],
    halves: [{ periods: H2_ON, clock: [0, 120] }]
  },
  {
    id: 'last1',
    label: 'Last minute of the game',
    group: 'late',
    rule: 'The last minute of the 4th quarter and of each overtime, whatever the score.',
    pieces: [{ periods: Q4_ON, clock: [0, 60] }],
    halves: [{ periods: H2_ON, clock: [0, 60] }]
  },
  {
    id: 'garbage',
    label: 'Garbage time',
    group: 'garbage',
    rule: 'The 4th quarter with a margin of 25+ and over 9 minutes left, 20+ with 6 to 9, or 10+ with 6 or less.',
    pieces: [
      { periods: [4, 4], clock: [540, 720], absMin: 25 },
      { periods: [4, 4], clock: [360, 540], absMin: 20 },
      { periods: [4, 4], clock: [0, 360], absMin: 10 }
    ],
    halves: [
      { periods: [2, 2], clock: [540, 600], absMin: 25 },
      { periods: [2, 2], clock: [360, 540], absMin: 20 },
      { periods: [2, 2], clock: [0, 360], absMin: 10 }
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
    ],
    halves: [
      { periods: [1, 1] },
      { periods: [3, null] },
      { periods: [2, 2], clock: [600, 1200] },
      { periods: [2, 2], clock: [540, 600], absMax: 24 },
      { periods: [2, 2], clock: [360, 540], absMax: 19 },
      { periods: [2, 2], clock: [0, 360], absMax: 9 }
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

/** How the screens group the splits, each group with its rule in one short line. */
export const SPLIT_GROUPS: readonly { group: SplitGroup; title: string; note: string }[] = [
  {
    group: 'period',
    title: 'By quarter',
    note: 'Each period of the game. The 2nd half leaves overtime out.'
  },
  {
    group: 'clutch',
    title: 'Clutch',
    note: 'The last 5 minutes of the 4th quarter or overtime, the score within 5.'
  },
  {
    group: 'late',
    title: 'Last minutes',
    note: 'The last 2 minutes of every period, then of the 4th quarter and each overtime, whatever the score.'
  },
  {
    group: 'score',
    title: 'By the score',
    note: "By the score before each play, from the team's side. Within 5 holds at any time."
  },
  {
    group: 'garbage',
    title: 'Garbage time',
    note: 'The 4th quarter with a margin of 25+ and over 9 minutes left, 20+ with 6 to 9, or 10+ with 6 or less.'
  }
]
