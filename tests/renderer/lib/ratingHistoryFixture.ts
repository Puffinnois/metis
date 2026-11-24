import type { RatingHistory, RatingPoint, RatingSeries } from '@/lib/stats/ratingHistory'

/**
 * A long career's ratings, made up but shaped like the read: SportsDataverse's weekly expected
 * impact from 2006-07 to 2025-26 (opening night, then every 7 days to early April), and three DARKO
 * snapshots imported in 2026-27. Values follow a smooth arc so a test can reason about them.
 */
const iso = (t: number): string => new Date(t).toISOString().slice(0, 10)

function weekly(first: number, last: number): RatingPoint[] {
  const out: RatingPoint[] = []
  for (let season = first; season <= last; season++) {
    const open = Date.UTC(season - 1, 9, 24)
    const arc = 6 - Math.abs(season - 2013) * 0.4
    for (let w = 0; w < 24; w++) {
      const off = arc * 0.7 + Math.sin((season * 31 + w) / 4) * 0.5
      const def = arc * 0.3 + Math.cos((season * 17 + w) / 5) * 0.4
      out.push({
        date: iso(open + w * 7 * 86_400_000),
        season,
        total: Math.round((off + def) * 100) / 100,
        off: Math.round(off * 100) / 100,
        def: Math.round(def * 100) / 100,
        basis: w === 0 ? 'Opening night: the seasons before only' : `Games before this date`
      })
    }
  }
  return out
}

export const EXPECTED: RatingSeries = {
  id: 'sdv_current_impact',
  label: 'Expected impact',
  maker: 'SportsDataverse',
  unit: 'Points per 100 possessions',
  grain: 'weekly',
  points: weekly(2007, 2026),
  notes: ['Published weekly from 2006-07 to 2025-26.']
}

export const DARKO: RatingSeries = {
  id: 'darko_dpm',
  label: 'DPM',
  maker: 'DARKO',
  unit: 'Points per 100 possessions',
  grain: 'snapshot',
  points: [
    { date: '2026-11-03', season: 2027, total: 2.1, off: 1.8, def: 0.3, basis: 'Imported board' },
    { date: '2026-11-12', season: 2027, total: 2.4, off: 2.0, def: 0.4, basis: 'Imported board' },
    { date: '2026-11-24', season: 2027, total: 2.2, off: 2.1, def: 0.1, basis: 'Imported board' }
  ],
  notes: ['From the boards imported by hand, one point an import.']
}

export const LONG_CAREER: RatingHistory = { series: [EXPECTED, DARKO], notes: [] }

export const NONE_IN_LEAGUE: RatingHistory = {
  series: [],
  notes: [
    'No rating over time for the WNBA: SportsDataverse publishes its expected impact for the NBA only, and no DARKO board has been imported.'
  ]
}
