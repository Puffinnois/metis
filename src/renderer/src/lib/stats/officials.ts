import { seasonLabel } from '@shared/stats/seasons'
import type {
  StatsCrewCoverage,
  StatsOfficialCareer,
  StatsOfficialsSeason,
  StatsOfficiatingTotals
} from '@shared/stats/types'
import { fmtStat } from './format'

/**
 * Officials on the Games screen: a season's officials and one official's seasons, each line beside
 * the league's figure for the same seasons and season types. The numbers describe the games an
 * official worked, as the box scores record them: both teams' fouls and free throws, points, and how
 * often the home side won. They do not say who made a call, and nothing here ranks officials: the
 * list is in order of games worked, then name.
 */

/** Below this many games, an official's rates swing widely from game to game. */
export const FEW_GAMES = 20

interface Measure {
  id: string
  /** The column head. */
  short: string
  /** What it is, for the head's hover. */
  title: string
  value: (t: StatsOfficiatingTotals) => number | null
  unit: 'count' | 'number' | 'pct'
  decimals: number
}

const perGame = (x: number, t: StatsOfficiatingTotals): number | null =>
  t.games > 0 ? x / t.games : null

/** The rates, in the order the tables show them. Each divides its totals when read. */
export const OFFICIAL_MEASURES: readonly Measure[] = [
  {
    id: 'games',
    short: 'G',
    title: 'Games worked with both box scores',
    value: (t) => t.games,
    unit: 'count',
    decimals: 0
  },
  {
    id: 'fouls',
    short: 'PF/G',
    title: 'Personal fouls per game, both teams',
    value: (t) => perGame(t.homeFouls + t.awayFouls, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'fta',
    short: 'FTA/G',
    title: 'Free-throw attempts per game, both teams',
    value: (t) => perGame(t.homeFta + t.awayFta, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'home_fouls',
    short: 'Home PF',
    title: 'Fouls per game by the home team',
    value: (t) => perGame(t.homeFouls, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'away_fouls',
    short: 'Away PF',
    title: 'Fouls per game by the away team',
    value: (t) => perGame(t.awayFouls, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'home_fta',
    short: 'Home FTA',
    title: 'Free-throw attempts per game by the home team',
    value: (t) => perGame(t.homeFta, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'away_fta',
    short: 'Away FTA',
    title: 'Free-throw attempts per game by the away team',
    value: (t) => perGame(t.awayFta, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'pts',
    short: 'PTS/G',
    title: 'Points per game, both teams',
    value: (t) => perGame(t.homePts + t.awayPts, t),
    unit: 'number',
    decimals: 1
  },
  {
    id: 'home_win',
    short: 'Home W%',
    title: 'Share of the games the home team won',
    value: (t) => perGame(t.homeWins, t),
    unit: 'pct',
    decimals: 1
  }
]

export const OFFICIAL_HEAD = OFFICIAL_MEASURES.map((m) => m.short)

/** A total's cells as the table shows them; blank, not zero, where there is no rate to read. */
export function officialCells(t: StatsOfficiatingTotals, rates: boolean): string[] {
  return OFFICIAL_MEASURES.map((m) =>
    m.id === 'games' || rates
      ? fmtStat(m.value(t), { unit: m.unit, decimals: m.decimals })
      : fmtStat(null, { unit: m.unit, decimals: m.decimals })
  )
}

export interface OfficialRow {
  key: string
  /** An official's id; null for the league's line. */
  id: string | null
  name: string
  jersey: string | null
  cells: string[]
  /** "Few games": a note beside a line with fewer than `FEW_GAMES`. */
  note: string | null
  league: boolean
}

const fewNote = (games: number, rates: boolean): string | null =>
  rates && games > 0 && games < FEW_GAMES ? `${games} games: few` : null

/** A season's table: the league first, then every official by games worked, then name. */
export function seasonRows(s: StatsOfficialsSeason): OfficialRow[] {
  const rates = s.reason === null
  return [
    {
      key: 'league',
      id: null,
      name: 'League',
      jersey: null,
      cells: officialCells(s.league, rates),
      note: null,
      league: true
    },
    ...s.officials.map((o) => ({
      key: o.id,
      id: o.id,
      name: o.name,
      jersey: o.jersey,
      cells: officialCells(o.totals, rates),
      note: fewNote(o.totals.games, rates),
      league: false
    }))
  ]
}

/** An official's table: each season, newest first, with the league's line for it just below. */
export function careerRows(c: StatsOfficialCareer): OfficialRow[] {
  return c.seasons.flatMap((s) => {
    const rates = s.reason === null
    return [
      {
        key: `${s.season}`,
        id: c.id,
        name: seasonLabel(s.season),
        jersey: null,
        cells: officialCells(s.totals, rates),
        note: s.reason ?? fewNote(s.totals.games, rates),
        league: false
      },
      {
        key: `${s.season}-league`,
        id: null,
        name: 'League',
        jersey: null,
        cells: officialCells(s.league, rates),
        note: null,
        league: true
      }
    ]
  })
}

/** "1,319 of 1,322 games have a crew listed; crews of 3 on 1,242, 4 on 77." */
export function coverageText(c: StatsCrewCoverage): string {
  const n = (x: number): string => x.toLocaleString('en-US')
  if (c.games === 0) return 'No games played in scope.'
  const sizes = Object.entries(c.crewSizes)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([size, games]) => `${size} on ${n(games)}`)
  const head = `${n(c.withCrew)} of ${n(c.games)} games have a crew listed`
  return sizes.length ? `${head}; crews of ${sizes.join(', ')}.` : `${head}.`
}

/** What the tables describe, said once under them. */
export const OFFICIAL_NOTES = [
  'Each line adds up the box scores of the games an official worked: fouls and free throws are both teams’, as recorded, so they describe the games, not who made each call.',
  'Every official of a crew counts the same game. The league line is every game of the same seasons and season types, for the ordinary spread.',
  `Lines of fewer than ${FEW_GAMES} games are marked: over few games a rate moves a long way with one game.`
]
