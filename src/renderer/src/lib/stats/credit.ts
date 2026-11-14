/**
 * The "Data and credit" text on the Data screen (Plan T1101). It lives here, not in the screen, so a
 * test can check that every fact the credit owes is said. The dataset's producers license it under
 * CC BY 4.0, which asks for credit, a link to the licence and a note of any changes; the second
 * sentence of the lead is that note. What was read and why is in `docs/reference/data-rights.md`.
 */

/** A run of text, or a link inside it. */
export type CreditSegment = string | { text: string; url: string }

export const DATASET_URL = 'https://github.com/sportsdataverse/sportsdataverse-data'
export const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/'

export const CREDIT_TITLE = 'Data and credit'

export const CREDIT_LEAD: CreditSegment[] = [
  'NBA data is published by ',
  { text: 'SportsDataverse', url: DATASET_URL },
  ' under ',
  { text: 'CC BY 4.0', url: CC_BY_URL },
  ', from ESPN and the NBA’s stats site. Metis downloads it to this computer, reshapes it into its own tables and computes stats from it. It shares nothing.'
]

/** Whose each number is, in the order a reader meets them. */
export const CREDIT_WHOSE: { label: string; text: string }[] = [
  {
    label: 'As published',
    text: 'Box scores, play by play, shots, tracking, hustle, play types, matchups, lineups and standings, as ESPN and the NBA publish them.'
  },
  {
    label: 'SportsDataverse’s calculations',
    text: 'Possessions and who was on the floor, from the play by play, and the impact models (RAPM, SPM, BPM, WAR), labelled “(SportsDataverse)”.'
  },
  {
    label: 'Computed by Metis',
    text: 'Formulas over the box scores, SRS, Elo, the adjusted ratings, the season forecast, PER, Win Shares, BPM, VORP, Oliver’s ratings, the league indexes (TS+) and stability, from published methods. Each says so in its description.'
  }
]

export const CREDIT_NOTES: string[] = [
  'Metis is not affiliated with or endorsed by the NBA, ESPN or SportsDataverse. Team and player names, and the NBA and ESPN names, belong to their owners.',
  'Metis is open source under the Apache License 2.0. That covers the app, not the data, which keeps its own terms.'
]

const plain = (segments: CreditSegment[]): string =>
  segments.map((s) => (typeof s === 'string' ? s : s.text)).join('')

/** The whole credit as one string, as a reader sees it on the screen. */
export function creditText(): string {
  return [
    CREDIT_TITLE,
    plain(CREDIT_LEAD),
    ...CREDIT_WHOSE.map((w) => `${w.label}: ${w.text}`),
    ...CREDIT_NOTES
  ].join('\n')
}
