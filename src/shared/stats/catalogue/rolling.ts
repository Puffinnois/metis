import type { Placement } from '../categories'
import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * SportsDataverse's rolling windows (T1703.2, reference entry 285; `main/stats/derived/rollingWindows.ts`):
 * a player's FG% and 3P% over their last 50 and last 200 attempts as of the season's last shot, with
 * the window before it, the season's first window, the career baseline and the three changes, as the
 * dataset publishes them. A window the player has not filled reads no value. A state at the season's
 * end, read one season at a time.
 */
const SOURCES = [
  "SportsDataverse's rolling windows (nba_stats_rolling_windows, from the play by play)"
]
const TABLE = 'pub_player_rolling'
const FIRST = 1997
const WHOSE =
  'SportsDataverse’s figure, as published; a window the player has not filled reads no value.'
const STATE =
  'As of the season’s last shot, one season at a time; the season under way, as of the latest file.'
const COLLEGE =
  "Not published for college basketball: SportsDataverse's rolling windows cover the NBA and the WNBA."

interface Window {
  key: string
  stat: 'FG%' | '3P%'
  words: string
  window: 50 | 200
  categories: Placement[]
}

const WINDOWS: Window[] = [
  {
    key: 'fg50',
    stat: 'FG%',
    words: 'field-goal percentage',
    window: 50,
    categories: ['shooting.recent_form', 'offense.shooting']
  },
  {
    key: 'fg200',
    stat: 'FG%',
    words: 'field-goal percentage',
    window: 200,
    categories: ['shooting.recent_form', 'offense.shooting']
  },
  {
    key: 'fg3_50',
    stat: '3P%',
    words: 'three-point percentage',
    window: 50,
    categories: ['shooting.recent_form', 'offense.shooting']
  },
  {
    key: 'fg3_200',
    stat: '3P%',
    words: 'three-point percentage',
    window: 200,
    categories: ['shooting.recent_form', 'offense.shooting']
  }
]

const base = (w: Window, value: string, o: Partial<Opts> = {}): Opts => ({
  value: ratio(`rw_${w.key}_${value}`, `rw_${w.key}_q`),
  sample: `rw_${w.key}_q`,
  // A filled window is the minimum: the dataset's own `qualified`.
  minSample: 1,
  family: 'shooting',
  kind: 'derived',
  unit: 'pct',
  decimals: 1,
  sources: SOURCES,
  firstSeason: FIRST,
  published: TABLE,
  oneSeason: true,
  tier: 'extended',
  categories: w.categories,
  leagues: {
    nba: { firstSeason: FIRST },
    wnba: { firstSeason: FIRST },
    ncaam: { firstSeason: FIRST, unavailable: COLLEGE },
    ncaaw: { firstSeason: FIRST, unavailable: COLLEGE }
  },
  ...o
})

const attempts = (w: Window): string =>
  w.stat === 'FG%' ? 'field-goal attempts' : 'three-point attempts'
const sdv = (label: string): string => `${label} (SportsDataverse)`

export const ROLLING_METRICS: MetricDef[] = WINDOWS.flatMap((w) => {
  const n = w.window
  const short = (s: string): string => `${w.stat} ${s}`
  const id = (s: string): string => `rw_${w.key}_${s}`
  return [
    metric(
      id('cur'),
      sdv(`${w.stat}, last ${n} attempts`),
      short(`L${n}`),
      `The player's ${w.words} over their last ${n} ${attempts(w)}. ${STATE} ${WHOSE}`,
      base(w, 'cur')
    ),
    metric(
      id('prev'),
      sdv(`${w.stat}, the ${n} attempts before`),
      short(`prev${n}`),
      `The player's ${w.words} over the ${n} ${attempts(w)} before their last ${n}. ${STATE} ${WHOSE}`,
      base(w, 'prev')
    ),
    metric(
      id('start'),
      sdv(`${w.stat}, the season's first ${n} attempts`),
      short(`1st${n}`),
      `The player's ${w.words} over their first ${n} ${attempts(w)} of the season. ${STATE} ${WHOSE}`,
      base(w, 'start')
    ),
    metric(
      id('career'),
      sdv(`${w.stat}, career baseline (${n}-attempt windows)`),
      short(`car${n}`),
      `The player's career ${w.words}, the baseline the ${n}-attempt windows are set against. ${STATE} ${WHOSE}`,
      base(w, 'career')
    ),
    metric(
      id('dprev'),
      sdv(`${w.stat} change, last ${n} against the ${n} before`),
      short(`L${n} Δprev`),
      `The last ${n} ${attempts(w)}' ${w.words} less the ${n} before: above zero, shooting better lately. ${STATE} ${WHOSE}`,
      base(w, 'dprev')
    ),
    metric(
      id('dseason'),
      sdv(`${w.stat} change, last ${n} against the season's first ${n}`),
      short(`L${n} Δszn`),
      `The last ${n} ${attempts(w)}' ${w.words} less the season's first ${n}. ${STATE} ${WHOSE}`,
      base(w, 'dseason')
    ),
    metric(
      id('dcareer'),
      sdv(`${w.stat} change, last ${n} against the career`),
      short(`L${n} Δcar`),
      `The last ${n} ${attempts(w)}' ${w.words} less the career baseline. ${STATE} ${WHOSE}`,
      base(w, 'dcareer')
    )
  ]
})

/** What the rolling windows' samples count, in words. */
export const ROLLING_SAMPLE_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  WINDOWS.map((w) => [`rw_${w.key}_q`, `filled ${w.window}-attempt window`])
)
