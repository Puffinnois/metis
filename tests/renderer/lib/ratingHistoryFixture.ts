import type { RatingHistory, RatingPoint, RatingSeries } from '@shared/stats/types'

/**
 * A long career's ratings, made up but shaped like the read (T1704.1): SportsDataverse's weekly
 * expected impact from 2006-07 to 2025-26 (opening night, then every 7 days to early April), and
 * three DARKO snapshots imported in 2026-27. Values walk week to week around an arc over the career.
 */
const iso = (t: number): string => new Date(t).toISOString().slice(0, 10)
const DAY = 86_400_000

/** A repeatable pseudo-random step in [-0.5, 0.5). */
function stepper(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 48271) % 2147483647
    return s / 2147483647 - 0.5
  }
}

function weekly(first: number, last: number): RatingPoint[] {
  const out: RatingPoint[] = []
  const step = stepper(23)
  for (let season = first; season <= last; season++) {
    const open = Date.UTC(season - 1, 9, 24)
    const arc = 6 - Math.abs(season - 2013) * 0.4
    let offense = arc * 0.7
    let defense = arc * 0.3
    for (let w = 0; w < 24; w++) {
      // Early weeks move most: fewer games behind each estimate.
      const size = w < 6 ? 0.5 : 0.18
      offense += step() * size
      defense += step() * size * 0.6
      out.push({
        date: iso(open + w * 7 * DAY),
        season,
        total: Math.round((offense + defense) * 100) / 100,
        offense: Math.round(offense * 100) / 100,
        defense: Math.round(defense * 100) / 100,
        // Opening night is before the season's first game: no game of the season behind it.
        possessions: w === 0 ? null : w * 230,
        lastGame: w === 0 ? null : iso(open + (w * 7 - 1) * DAY)
      })
    }
  }
  return out
}

export const EXPECTED: RatingSeries = {
  id: 'sdv_expected_impact',
  label: 'Expected impact (SportsDataverse)',
  maker: 'SportsDataverse',
  unit: 'rating',
  grain: 'weekly',
  points: weekly(2007, 2026),
  notes: ['Weekly from 2006-07 to 2025-26.']
}

const imported = (date: string, total: number, offense: number, defense: number): RatingPoint => ({
  date,
  season: 2027,
  total,
  offense,
  defense,
  possessions: null,
  lastGame: null
})

export const DARKO: RatingSeries = {
  id: 'darko_dpm',
  label: 'DPM (DARKO)',
  maker: 'Kostya Medvedovsky (DARKO)',
  unit: 'rating',
  grain: 'snapshot',
  points: [
    imported('2026-11-03', 2.1, 1.8, 0.3),
    imported('2026-11-12', 2.4, 2.0, 0.4),
    imported('2026-11-24', 2.2, 2.1, 0.1)
  ],
  notes: ['From the boards imported by hand, one point an import.']
}

export const LONG_CAREER: RatingHistory = {
  playerId: '2544',
  series: [EXPECTED, DARKO],
  reason: null
}

export const NONE_IN_LEAGUE: RatingHistory = {
  playerId: '1',
  series: [],
  reason:
    'Not published for the WNBA: SportsDataverse publishes its expected impact for the NBA only.'
}
