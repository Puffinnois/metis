/**
 * Reference section 11: the NBA's play types, from Synergy's tagging, for players, from 2015-16. Every
 * type is published on offense; seven are published on defense too, for the defender. The dataset has
 * no team play types.
 */

/** The first season the play-type files hold: 2015-16. */
export const PLAY_TYPES_FIRST_SEASON = 2016

/** From 2023-24, a player's type with fewer than 10 possessions has no row (measured). */
export const PLAY_TYPES_MIN_ROW_SEASON = 2024

export type PlayTypeSide = 'offense' | 'defense'

export interface PlayType {
  /** In metric and component ids: `iso`, and `d_iso` for its defense. */
  key: string
  /** As the source spells it in `play_type`, compared without case. */
  source: string
  label: string
  short: string
  /** What the play is, for a person. */
  description: string
  defense: boolean
}

export const PLAY_TYPES: readonly PlayType[] = [
  {
    key: 'iso',
    source: 'Isolation',
    label: 'Isolation',
    short: 'Iso',
    description: 'One player attacks a single defender while the others stay away.',
    defense: true
  },
  {
    key: 'transition',
    source: 'Transition',
    label: 'Transition',
    short: 'Trans',
    description:
      'The offense attacks before the defense is set. Not the same as fast-break points.',
    defense: false
  },
  {
    key: 'pnr_bh',
    source: 'PRBallHandler',
    label: 'Pick-and-roll ball handler',
    short: 'PnR',
    description: 'The ball handler finishes a play off a ball screen.',
    defense: true
  },
  {
    key: 'pnr_roll',
    source: 'PRRollMan',
    label: 'Pick-and-roll roll man',
    short: 'Roll',
    description: 'The screener finishes after rolling, slipping or popping.',
    defense: true
  },
  {
    key: 'post_up',
    source: 'Postup',
    label: 'Post-up',
    short: 'Post',
    description: 'The play finishes from a post-up, back to the basket.',
    defense: true
  },
  {
    key: 'spot_up',
    source: 'Spotup',
    label: 'Spot-up',
    short: 'Spot',
    description:
      'The play starts from a spot-up chance and may include a drive. Not only catch-and-shoot jumpers.',
    defense: true
  },
  {
    key: 'handoff',
    source: 'Handoff',
    label: 'Handoff',
    short: 'HO',
    description: 'The play finishes through a handoff.',
    defense: true
  },
  {
    key: 'cut',
    source: 'Cut',
    label: 'Cut',
    short: 'Cut',
    description: 'A move toward the basket without the ball finishes the play.',
    defense: false
  },
  {
    key: 'off_screen',
    source: 'OffScreen',
    label: 'Off screen',
    short: 'OffSc',
    description: 'The player comes off an off-ball screen to finish the play.',
    defense: true
  },
  {
    key: 'putback',
    source: 'OffRebound',
    label: 'Putback',
    short: 'Putbk',
    description:
      'A shot straight after an offensive rebound. Not every second-chance point is a putback.',
    defense: false
  },
  {
    key: 'misc',
    source: 'Misc',
    label: 'Miscellaneous',
    short: 'Misc',
    description: 'Plays tagged outside the other types.',
    defense: false
  }
]

/** A type and side's key: `iso` on offense, `d_iso` on defense. */
export const playTypeKey = (t: PlayType, side: PlayTypeSide): string =>
  side === 'defense' ? `d_${t.key}` : t.key

/** Every type with the sides it is published for. */
export const PLAY_TYPE_SIDES: readonly { type: PlayType; side: PlayTypeSide; key: string }[] = [
  ...PLAY_TYPES.map((type) => ({ type, side: 'offense' as const, key: type.key })),
  ...PLAY_TYPES.filter((t) => t.defense).map((type) => ({
    type,
    side: 'defense' as const,
    key: playTypeKey(type, 'defense')
  }))
]

/** What each sample a play-type metric reads counts, in words. */
export function playTypeSampleLabels(): Record<string, string> {
  return Object.fromEntries(
    PLAY_TYPE_SIDES.flatMap(({ type, side, key }) => {
      const what = type.label.toLowerCase()
      return side === 'offense'
        ? [
            [`${key}_poss`, `${what} possessions`],
            [`${key}_fga`, `field-goal attempts on ${what} plays`],
            [`${key}_all_poss`, 'possessions with a play type']
          ]
        : [
            [`${key}_poss`, `${what} possessions defended`],
            [`${key}_fga`, `field-goal attempts defended on ${what} plays`],
            [`${key}_all_poss`, 'possessions with a play type defended']
          ]
    })
  )
}
