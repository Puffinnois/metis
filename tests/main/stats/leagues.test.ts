import { describe, expect, it } from 'vitest'
import { StatsDb } from '@main/stats/db'
import { offlineStats, STATS_ARE_OFF } from '@main/stats/offline'
import {
  elapsedSeconds,
  elapsedSql,
  LEAGUES,
  periodLengthSql,
  periodStartSeconds,
  periodStartSql,
  type League
} from '@shared/leagues'
import { coverageIn, coverageReason, metricIn, METRICS } from '@shared/stats/catalogue'
import type { MetricDef } from '@shared/stats/types'

const { nba, wnba } = LEAGUES

describe('the registry’s clock in SQL', () => {
  it('counts the same seconds as the registry’s own functions, in both formats', async () => {
    const db = await StatsDb.open(':memory:')
    const cases: [League, number, number, number][] = [
      [nba, 2026, 1, 720],
      [nba, 2026, 4, 0],
      [nba, 2026, 6, 120],
      [wnba, 2004, 1, 600],
      [wnba, 2004, 2, 0],
      [wnba, 2004, 3, 30],
      [wnba, 2006, 4, 100],
      [wnba, 2026, 5, 0]
    ]
    for (const [league, season, period, clock] of cases) {
      const row = await db.get<{ t: number; p0: number; len: number }>(
        `SELECT ${elapsedSql(league, 's', 'p', 'c')} AS t, ${periodStartSql(league, 's', 'p')} AS p0,
                ${periodLengthSql(league, 's', 'p')} AS len
         FROM (SELECT ${season} AS s, ${period} AS p, ${clock} AS c)`
      )
      expect(row?.t).toBe(elapsedSeconds(league, season, period, clock))
      expect(row?.p0).toBe(periodStartSeconds(league, season, period))
      const era = league.periods.filter((e) => season >= e.from).at(-1)!
      expect(row?.len).toBe(period <= era.periods ? era.minutes * 60 : league.overtimeMinutes * 60)
    }
    db.close()
  })

  it('writes the NBA’s clock as before leagues: one format, no CASE over the season', () => {
    expect(elapsedSql(nba, 'season', 'period', 'clock')).toBe(
      `CASE WHEN period <= 4 THEN (period - 1) * 720 + 720 - clock
        ELSE 2880 + (period - 5) * 300 + 300 - clock END`
    )
    expect(elapsedSql(wnba, 'season', 'period', 'clock')).toContain('WHEN season >= 2006')
  })
})

describe('a metric’s coverage per league', () => {
  const pts = METRICS.get('pts')!
  const stated: MetricDef = { ...pts, leagues: { wnba: { firstSeason: 2008 } } }
  const absent: MetricDef = { ...pts, leagues: { nba: null } }

  it('reads the metric’s own fields in the NBA and its stated coverage elsewhere', () => {
    expect(metricIn(pts, nba)).toBe(pts)
    expect(coverageIn(pts, nba)).toEqual({ firstSeason: 1994 })
    expect(coverageIn(pts, wnba)).toBeNull()
    expect(coverageIn(stated, wnba)).toEqual({ firstSeason: 2008 })
    expect(metricIn(stated, wnba)).toMatchObject({ firstSeason: 2008 })
    expect(metricIn(stated, wnba).unavailable).toBeUndefined()
    expect(metricIn(pts, wnba).unavailable).toBe('Not recorded for the WNBA.')
    expect(metricIn(absent, nba).unavailable).toBe('Not recorded for the NBA.')
  })

  it('labels a gap as the league writes its seasons', () => {
    expect(coverageReason(metricIn(stated, wnba), [2007], wnba)).toBe('Recorded from 2008.')
    expect(coverageReason({ firstSeason: 1997 }, [1996], nba)).toBe('Recorded from 1996-97.')
  })
})

describe('a league with no worker', () => {
  it('answers a league with no data with its reason, never an error', async () => {
    const reads = offlineStats(wnba)
    expect(await reads.status()).toMatchObject({ available: false, noData: wnba.noData })
    const result = await reads.query({
      entity: 'player',
      metrics: ['pts'],
      scope: { seasons: [2026] }
    })
    expect(result.rows).toEqual([])
    expect(result.notes).toEqual([wnba.noData])
    expect((await reads.catalogue()).every((m) => m.unavailable)).toBe(true)
    expect(await reads.seasons()).toEqual([])
    expect((await reads.shots({} as never)).reason).toBe(wnba.noData)
    await expect(reads.data()).rejects.toThrow(wnba.noData)
  })

  it('says the stats are off for a league whose worker did not start', async () => {
    const reads = offlineStats(nba)
    expect((await reads.status()).noData).toBeUndefined()
    await expect(
      reads.query({ entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } })
    ).rejects.toThrow(STATS_ARE_OFF)
    expect(await reads.catalogue()).toEqual([])
  })
})
