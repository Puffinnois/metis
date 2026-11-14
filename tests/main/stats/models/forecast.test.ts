import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { inspect } from '@main/stats/derived/sql'
import {
  FORECAST_TABLE,
  FORECAST_TABLES,
  makeForecastBuilder,
  snapshotDays
} from '@main/stats/models/forecast'
import { openTestDb } from '../../../fixtures/stats'

/**
 * A league of thirty (ids 1 to 30; 1 to 15 in the East, divisions of five) playing each other once,
 * a round a day by the circle method, so every team plays every day: 29 days, 435 games. The lower id
 * wins at home or away by five, so team 1 goes 29-0. Elo is flat within a season: 1650 for team 1,
 * ten points less each id.
 */
const TEAMS = Array.from({ length: 30 }, (_, i) => i + 1)
const day = (r: number): string => {
  const d = new Date(Date.UTC(2025, 10, 1 + r))
  return d.toISOString().slice(0, 10)
}

function rounds(): [number, number][][] {
  const ring = [...TEAMS]
  const out: [number, number][][] = []
  for (let r = 0; r < 29; r++) {
    const games: [number, number][] = []
    for (let i = 0; i < 15; i++)
      games.push(r % 2 ? [ring[i], ring[29 - i]] : [ring[29 - i], ring[i]])
    out.push(games)
    ring.splice(1, 0, ring.pop()!)
  }
  return out
}

let db: StatsDb

async function addSeason(season: number, playedRounds = 29): Promise<void> {
  for (const t of TEAMS) {
    await db.exec('INSERT INTO team VALUES (?, ?, ?, ?)', [
      season,
      t,
      t <= 15 ? 'east' : 'west',
      `d${Math.floor((t - 1) / 5)}`
    ])
  }
  let n = 0
  for (const [r, games] of rounds().entries()) {
    for (const [home, away] of games) {
      const id = `${season}-${n++}`
      const played = r < playedRounds
      const margin = home < away ? 5 : -5
      await db.exec('INSERT INTO game VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        id,
        season,
        'regular',
        day(r),
        home,
        away,
        played ? 100 + Math.max(margin, 0) : null,
        played ? 100 + Math.max(-margin, 0) : null,
        played
      ])
      for (const [t, o, isHome] of [
        [home, away, true],
        [away, home, false]
      ] as const) {
        const pre = 1660 - 10 * t
        // Elo (T1002): a game played in elo_game, one to come in elo_schedule.
        const values = [season, t, id, day(r), o, isHome, pre, 1660 - 10 * o]
        if (played)
          await db.exec(
            `INSERT INTO elo_game (season, game_type, team_id, game_id, game_date, opponent_id, home,
               neutral, elo_pre, opp_elo_pre, home_court, win_prob, exp_margin, elo, opp_elo)
             VALUES (?, 'regular', ?, ?, ?, ?, ?, false, ?, ?, 0, 0.5, 0, ?, ?)`,
            [...values, pre, 1660 - 10 * o]
          )
        else
          await db.exec(
            `INSERT INTO elo_schedule (season, game_type, team_id, game_id, game_date, opponent_id,
               home, neutral, elo_pre, opp_elo_pre, home_court, win_prob, exp_margin)
             VALUES (?, 'regular', ?, ?, ?, ?, ?, false, ?, ?, 0, 0.5, 0)`,
            values
          )
      }
    }
  }
}

beforeEach(async () => {
  db = await openTestDb()
  await db.exec(
    'CREATE OR REPLACE TABLE team (season INTEGER, team_id BIGINT, conference VARCHAR, division VARCHAR)'
  )
  await db.exec(`CREATE OR REPLACE TABLE game (game_id VARCHAR, season INTEGER, game_type VARCHAR,
    game_date DATE, home_team_id BIGINT, away_team_id BIGINT, home_score BIGINT, away_score BIGINT,
    played BOOLEAN)`)
})

const builder = makeForecastBuilder({ current: 60, past: 40 })
const run = async (season: number, current: number): Promise<Record<string, unknown>[]> => {
  const rows = await builder.build({ db, have: await inspect(db), season, current })
  return [...rows[FORECAST_TABLE]]
}
const iso = (x: unknown): string => String(x)

describe('snapshotDays', () => {
  it('takes the day of each twentieth of the games, and the latest in the season in progress', () => {
    const dates = Array.from(
      { length: 40 },
      (_, i) => `d${String(Math.floor(i / 4)).padStart(2, '0')}`
    )
    // Forty games of a season of 40, four a day: the day of the 2nd, 4th, … game.
    expect(snapshotDays(dates, 40, false)).toEqual(Array.from({ length: 10 }, (_, i) => `d0${i}`))
    // Ten of a season of 100 played: the fifth and the tenth game, and the latest day.
    expect(snapshotDays(dates.slice(0, 10), 100, true)).toEqual(['d01', 'd02'])
    expect(snapshotDays(dates.slice(0, 9), 100, true)).toEqual(['d01', 'd02'])
  })
})

// Each case writes a thirty-team season row by row and runs the simulation: slower than most tests.
describe('the season forecast builder', { timeout: 30_000 }, () => {
  it('forecasts a past season twenty times, each snapshot adding up across the league', async () => {
    await addSeason(2026)
    const rows = await run(2026, 2027)
    const days = [...new Set(rows.map((r) => iso(r.as_of)))].sort()
    expect(days).toHaveLength(20)
    expect(rows).toHaveLength(600)
    expect(rows.every((r) => r.runs === 40 && r.game_type === 'regular')).toBe(true)
    for (const d of days) {
      const snap = rows.filter((r) => iso(r.as_of) === d)
      const sum = (k: string): number => snap.reduce((s, r) => s + Number(r[k]), 0)
      expect(sum('p_playoffs')).toBeCloseTo(16, 9)
      expect(sum('p_title')).toBeCloseTo(1, 9)
      expect(sum('p_top6')).toBeCloseTo(12, 9)
      // Every team plays every day, so each row sits on that day's game.
      expect(snap.every((r) => iso(r.game_date) === d)).toBe(true)
    }
    // After the last day the record is known: team 1 is 29-0 and the East's first six are in.
    const last = rows.filter((r) => iso(r.as_of) === days[19])
    const team = (t: number): Record<string, unknown> => last.find((r) => r.team_id === t)!
    expect(team(1)).toMatchObject({ proj_w: 29, proj_l: 0, p_top6: 1, p_playoffs: 1, mean_seed: 1 })
    // Team 15 beats only the fifteen ids above it, all in the West: last in the East.
    expect(team(15)).toMatchObject({ proj_w: 15, p_playoffs: 0, mean_seed: 15 })
    expect(team(30).proj_l).toBe(29)
  })

  it('fills the season in progress to 82 games, and keeps the earlier snapshots it can', async () => {
    await addSeason(2027, 15)
    const rows = await run(2027, 2027)
    expect(rows.every((r) => r.runs === 60)).toBe(true)
    // 225 of 435 listed games played: the tenth twentieth (218) is the last one reached.
    const days = [...new Set(rows.map((r) => iso(r.as_of)))].sort()
    expect(days).toHaveLength(10)
    expect(days.at(-1)).toBe(day(14))
    // Each team's 29 listed games and 53 against an opponent not named yet.
    for (const r of rows) expect(Number(r.proj_w) + Number(r.proj_l)).toBeCloseTo(82, 9)

    // Written back, a snapshot before the latest is kept as it stood; the latest is recomputed.
    const cols = FORECAST_TABLES[0].columns.map(([c]) => c)
    for (const r of rows) {
      await db.exec(
        `INSERT INTO ${FORECAST_TABLE} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => (c === 'proj_w' ? 999 : (r[c] as never)))
      )
    }
    const again = await run(2027, 2027)
    expect(again.filter((r) => iso(r.as_of) === days[0]).every((r) => r.proj_w === 999)).toBe(true)
    expect(again.filter((r) => iso(r.as_of) === days.at(-1)).some((r) => r.proj_w === 999)).toBe(
      false
    )
  })

  it('writes nothing before 1995-96 or for a league that cannot fill a bracket', async () => {
    await addSeason(1995)
    expect(await run(1995, 2027)).toEqual([])
    await addSeason(2026)
    await db.exec('DELETE FROM team WHERE season = 2026 AND team_id > 12')
    expect(await run(2026, 2027)).toEqual([])
  })
})
