import { searchKey } from '@/lib/stats/leaderboard'

/*
 * Finding a team by typing (Plan T1705): the list a team chooser shows and what typing leaves of it.
 * A college league has 365 teams, too many to scroll; a league of thirty reads as the select it was.
 */

/** A team in a chooser's list. */
export interface TeamChoice {
  /** What choosing it gives: the team's id, or its code where a screen keeps codes. */
  value: string
  /** The team's id, for its favourite mark; null for a row that is no team ("All teams"). */
  id: string | null
  code: string
  /** Its name, which holds its city or school ("Oklahoma City Thunder", "Duke Blue Devils"). */
  name: string
  /** Where it plays, quiet beside the name. */
  conference: string | null
}

interface NamedTeam {
  id: string
  code: string
  name: string
  conference?: string | null
}

/** The teams as a chooser lists them, in the order given. */
export const teamChoices = (teams: readonly NamedTeam[], by: 'id' | 'code' = 'id'): TeamChoice[] =>
  teams.map((t) => ({
    value: t[by],
    id: t.id,
    code: t.code,
    name: t.name,
    conference: t.conference ?? null
  }))

/** The first row of a filter: every team, in the same list. */
export const ALL_TEAMS: TeamChoice = {
  value: '',
  id: null,
  code: '',
  name: 'All teams',
  conference: null
}

/** The same folding with punctuation read as a space: "Arkansas-Pine Bluff" as two words. */
const wordsKey = (text: string): string =>
  searchKey(text.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ')).trim()

/** Both foldings of a text, so "st johns" and "pine bluff" find a name written with punctuation. */
const keysOf = (text: string): string[] => [searchKey(text), wordsKey(text)]

/**
 * The choices a search leaves, in the list's own order: those whose name or code holds what is typed,
 * accents, case and punctuation aside. The "All teams" row is listed while nothing is typed.
 */
export function matchTeams(choices: readonly TeamChoice[], search: string): TeamChoice[] {
  if (!search.trim()) return [...choices]
  const needles = keysOf(search.trim()).filter((n) => n !== '')
  return choices.filter(
    (c) =>
      c.id !== null &&
      keysOf(`${c.code} ${c.name}`).some((key) => needles.some((n) => key.includes(n)))
  )
}

/**
 * The match Enter takes, by its place in the list, which keeps its order: the team of that very code,
 * else the first whose code or a word of whose name starts with what is typed, else the first. With
 * nothing typed, the team chosen now.
 */
export function bestMatch(
  matches: readonly TeamChoice[],
  search: string,
  value: string | null
): number {
  const needle = wordsKey(search.trim())
  if (!needle) {
    return Math.max(
      matches.findIndex((c) => c.value === value),
      0
    )
  }
  const code = matches.findIndex((c) => wordsKey(c.code) === needle)
  if (code >= 0) return code
  const word = matches.findIndex((c) =>
    ` ${wordsKey(`${c.code} ${c.name}`)}`.includes(` ${needle}`)
  )
  return Math.max(word, 0)
}

/** How many rows Page Up and Page Down move. */
export const PAGE_ROWS = 8

/** The row a key moves to, held to the list; null for a key that does not move. */
export function movedTo(key: string, at: number, count: number): number | null {
  const step: Record<string, number> = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: PAGE_ROWS,
    PageUp: -PAGE_ROWS
  }
  const by = step[key]
  if (by === undefined || count === 0) return null
  return Math.max(0, Math.min(count - 1, at + by))
}
