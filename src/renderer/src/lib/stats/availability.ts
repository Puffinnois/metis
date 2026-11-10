import type { StatsAvailability, StatsCoach, StatsOfficial } from '@shared/stats/types'
import { shortDay } from './scope'

/**
 * The dashboards' availability, in words. A status is what the NBA's latest injury report printed for
 * the player: it says nothing about whether they will play.
 */

/** An injury as the report words it, said plainly: "Injury/Illness - Left Ankle; Sprain" → "left ankle sprain". */
export function reasonText(reason: string | null): string | null {
  if (!reason) return null
  const parts = reason
    .replace(/^injury\/illness\s*-\s*/i, '')
    .split(';')
    .map((p) => p.trim())
    // The report prints "N/a" where a field has nothing to say.
    .filter((p) => p !== '' && !/^n\/a$/i.test(p))
  if (parts.length === 0) return null
  const words = parts
    .join(' ')
    // Lower-case the capitals of a title, but not an acronym such as ACL.
    .split(' ')
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(' ')
  return words === '-' ? null : words
}

export type TagTone = 'bad' | 'warn' | 'good' | 'neutral'

export interface StatusTag {
  status: string
  tone: TagTone
  /** "Out · left ankle sprain · report of Nov 9". */
  text: string
  /** What the tag is and is not, for the hover card. */
  title: string
}

const TONES: Record<string, TagTone> = {
  Out: 'bad',
  Doubtful: 'bad',
  Questionable: 'warn',
  Probable: 'good',
  Available: 'good'
}

/** The tag for a player on the latest report; null when the report does not list them. */
export function statusTag(a: StatsAvailability | null | undefined): StatusTag | null {
  if (!a) return null
  const reason = reasonText(a.reason)
  const date = `report of ${shortDay(a.reportDate)}`
  const next = a.gameDate ? ` for the game of ${shortDay(a.gameDate)}` : ''
  return {
    status: a.status,
    tone: TONES[a.status] ?? 'neutral',
    text: [a.status, reason, date].filter(Boolean).join(' · '),
    title: `The NBA’s latest official injury report${next}. A status as published, not a prediction of whether they play.`
  }
}

/** The tag of each player listed, by id. */
export function tagsById(list: readonly StatsAvailability[] | null): Map<string, StatusTag> {
  const out = new Map<string, StatusTag>()
  for (const a of list ?? []) {
    const tag = statusTag(a)
    if (tag) out.set(a.playerId, tag)
  }
  return out
}

/** A team's staff for the header: the head coach (more than one when it changed), then assistants. */
export function coachLines(coaches: readonly StatsCoach[] | null): {
  head: string | null
  assistants: string | null
} {
  const names = (role: StatsCoach['role']): string[] =>
    (coaches ?? []).filter((c) => c.role === role).map((c) => c.name)
  const head = names('head')
  const assistants = names('assistant')
  return {
    head: head.length ? head.join(' and ') : null,
    assistants: assistants.length ? assistants.join(', ') : null
  }
}

/** "Officials: Zach Zarba, Eric Dalen, Jason Goldenberg"; null when the file has none for the game. */
export function officialsText(officials: readonly StatsOfficial[] | null): string | null {
  return officials && officials.length ? officials.map((o) => o.name).join(', ') : null
}
