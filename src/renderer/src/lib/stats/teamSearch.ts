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

/** The league's files write its conferences small ("west"). */
const titled = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** The teams as a chooser lists them, in the order given. */
export const teamChoices = (teams: readonly NamedTeam[], by: 'id' | 'code' = 'id'): TeamChoice[] =>
  teams.map((t) => ({
    value: t[by],
    id: t.id,
    code: t.code,
    name: t.name,
    conference: t.conference ? titled(t.conference) : null
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
 * The choices a search leaves: those whose name or code holds what is typed, accents, case and
 * punctuation aside. First those whose code, name or a word of the name starts with it ("mont" for
 * Montana), then those that only hold it (Belmont), each in the list's own order. With nothing typed
 * the list is as it was, the "All teams" row included; that row is no team, so no search finds it.
 */
export function matchTeams(choices: readonly TeamChoice[], search: string): TeamChoice[] {
  if (!search.trim()) return [...choices]
  const needles = keysOf(search.trim()).filter((n) => n !== '')
  const starts: TeamChoice[] = []
  const holds: TeamChoice[] = []
  for (const c of choices) {
    if (c.id === null) continue
    const keys = keysOf(`${c.code} ${c.name}`).map((k) => ` ${k}`)
    if (keys.some((k) => needles.some((n) => k.includes(` ${n}`)))) starts.push(c)
    else if (keys.some((k) => needles.some((n) => k.includes(n)))) holds.push(c)
  }
  return [...starts, ...holds]
}

/**
 * The match Enter takes, by its place among them: the team of that very code ("unc" for North Carolina,
 * though UNC Asheville is listed before it), else the first. With nothing typed, the team chosen now.
 */
export function bestMatch(
  matches: readonly TeamChoice[],
  search: string,
  value: string | null
): number {
  const needle = wordsKey(search.trim())
  const at = needle
    ? matches.findIndex((c) => wordsKey(c.code) === needle)
    : matches.findIndex((c) => c.value === value)
  return Math.max(at, 0)
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
