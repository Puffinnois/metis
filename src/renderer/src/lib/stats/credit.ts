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
/** The NBA's terms (section 9) ask any display of its statistics to credit NBA.com prominently. */
export const NBA_STATS_URL = 'https://www.nba.com/stats'
/** ESPN is the other source, credited the same way (D31). */
export const ESPN_NBA_URL = 'https://www.espn.com/nba/'
/**
 * The WNBA's sources, credited as the NBA's are (data-rights.md, "The WNBA's releases"): the league's
 * own site and ESPN. Links only: Metis never requests either.
 */
export const WNBA_STATS_URL = 'https://www.wnba.com/stats'
export const ESPN_WNBA_URL = 'https://www.espn.com/wnba/'
/**
 * NCAA Division I's sources (data-rights.md, "The NCAA's releases"): ESPN's college pages and the
 * NCAA's statistics site. Only ESPN's files carry CC BY 4.0; the stats.ncaa.org files state no licence
 * (D41). Links only: Metis never requests either.
 */
export const ESPN_NCAA_URL = 'https://www.espn.com/mens-college-basketball/'
export const NCAA_STATS_URL = 'https://stats.ncaa.org'

export const CREDIT_TITLE = 'Data and credit'

export const CREDIT_LEAD: CreditSegment[] = [
  'NBA data is published by ',
  { text: 'SportsDataverse', url: DATASET_URL },
  ' under ',
  { text: 'CC BY 4.0', url: CC_BY_URL },
  ', from ',
  { text: 'ESPN', url: ESPN_NBA_URL },
  ' and ',
  { text: 'NBA.com', url: NBA_STATS_URL },
  '. WNBA data is published by ',
  { text: 'SportsDataverse', url: DATASET_URL },
  ' under ',
  { text: 'CC BY 4.0', url: CC_BY_URL },
  ', from ',
  { text: 'ESPN', url: ESPN_WNBA_URL },
  ' and ',
  { text: 'WNBA.com', url: WNBA_STATS_URL },
  '. NCAA Division I data is published by ',
  { text: 'SportsDataverse', url: DATASET_URL },
  ', from ',
  { text: 'ESPN', url: ESPN_NCAA_URL },
  ', its files under ',
  { text: 'CC BY 4.0', url: CC_BY_URL },
  ', and from the NCAA’s ',
  { text: 'stats.ncaa.org', url: NCAA_STATS_URL },
  ', whose files state no licence. Metis downloads it to this computer, reshapes it into its own tables and computes stats from it. It shares nothing.'
]

/** Whose each number is, in the order a reader meets them. */
export const CREDIT_WHOSE: { label: string; text: string }[] = [
  {
    label: 'As published',
    text: 'Box scores, play by play, shots, tracking, hustle, play types, matchups, lineups and standings, as ESPN, NBA.com, WNBA.com and stats.ncaa.org publish them.'
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
  'Metis is not affiliated with or endorsed by the NBA, the WNBA, the NCAA, ESPN or SportsDataverse. Team, school and player names, and the NBA, WNBA, NCAA and ESPN names, belong to their owners.',
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
