import { seasonLabel } from './seasons'

/**
 * The NBA's official injury reports (reference 18.3). A report is a list, per team and per game, of
 * the players with a status; the file holds every version published for a game, hundreds of
 * thousands of rows a season that repeat each other.
 *
 * It starts on 2018-12-17, so 2018-19 has a report for only 63 % of its team-games. The first season
 * with a report for nearly every game is 2019-20 (98 to 99.7 % of regular-season team-games, measured
 * in `nba-data-sources.md`), and that is where the counts start: a season with a third of its games
 * unreported would read as healthier than it was.
 */
export const AVAILABILITY_FIRST_SEASON = 2020

/** The statuses a report prints, from the most to the least serious. */
export const REPORT_STATUSES = ['Out', 'Doubtful', 'Questionable', 'Probable', 'Available'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** Why the games-missed counts have no value before the reports start. */
export const AVAILABILITY_REASON = `Recorded from ${seasonLabel(AVAILABILITY_FIRST_SEASON)}.`

export const AVAILABILITY_SOURCES = ["The NBA's official injury reports"]

/** What the availability counts count, in words: "412 games out". */
export const AVAILABILITY_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  games_out_injury: 'games out for injury or illness',
  games_out_other: 'games out for other reasons'
}

/**
 * Whether an Out was for an injury or illness. A report gives a category and a reason: 2018-19 files
 * the category apart ("Injury/Illness", "G League Team") and prints the injury as the reason, and
 * from 2019-20 the reason carries both ("Injury/Illness - Left Knee; Sprain"). Where there is a
 * category it decides; without one, a reason that names a G League assignment, rest, a suspension and
 * the like is not an injury, and any other free text is ("Concussion Protocol"). The SQL in
 * `derived/availability.ts` is the same rule.
 */
export const NOT_INJURY =
  /^(-|g league|not with team|personal|rest|coach|league suspension|team suspension|trade pending|health and safety|return to competition|ineligible)/i

/**
 * A staff row's role: the file's `coach_type` holds head coaches (and interims), the assistants under
 * many titles, and the trainers and strength staff, who are left out.
 */
export function coachRole(title: string | null): 'head' | 'assistant' | null {
  if (!title) return null
  if (/^(interim )?head coach$/i.test(title)) return 'head'
  if (/trainer|strength|conditioning|director/i.test(title)) return null
  return /coach/i.test(title) ? 'assistant' : null
}

export function isInjuryReason(category: string | null, reason: string | null): boolean {
  if (category !== null) return category === 'Injury/Illness'
  return !NOT_INJURY.test((reason ?? '').trim() || '-')
}
