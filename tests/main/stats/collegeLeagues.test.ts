import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { catalogueInfo } from '@main/stats/engine/registry'
import { LEFT_OUT_REASON, leftOutGap } from '@main/stats/leftOut'
import { offlineStats, type StatsReads } from '@main/stats/offline'
import { openStatsService, type StatsService } from '@main/stats/service'
import { NCAA_STATS_RELEASES, SOURCES_BY_LEAGUE } from '@main/stats/sources'
import { refreshStats, STATS_DERIVED_STEP } from '@main/stats/sync'
import { LEAGUES, modelsOf, recipeOf, type League } from '@shared/leagues'
import {
  CATALOGUE,
  coverageReason,
  METRICS,
  notBuiltYet,
  notInLeague
} from '@shared/stats/catalogue'
import { metricIn } from '@shared/stats/catalogue'
import type { StatsQuery } from '@shared/stats/types'
import { openTestDb, tempDir } from '../../fixtures/stats'

/**
 * The college leagues before their later built tables: their sources load (T1302.3), their game, team
 * and player tables (T1302.4) and their game and season tables (T1302.5) are built, but no published
 * tables, plays or models yet. Those recipes and the models are null behind accessors that throw
 * (`recipeOf`, `modelsOf`), so every read a screen makes, with the league off or turned on, must
 * answer with a reason and never reach one: a read that did would reject with the accessor's error.
 */
const COLLEGE: League[] = [LEAGUES.ncaam, LEAGUES.ncaaw]
const NOW = new Date('2026-11-18T12:00:00Z')

/** Every read a screen makes, once each, with arguments of the right shape. */
async function readEverything(reads: StatsReads, query = true): Promise<void> {
  const asked: StatsQuery = {
    entity: 'player',
    metrics: ['pts', 'reb'],
    scope: { seasons: [2026] }
  }
  await reads.status()
  await reads.data()
  await reads.catalogue()
  await reads.seasons()
  await reads.player('1')
  await reads.games(2026)
  await reads.game('1')
  await reads.standings(2026)
  await reads.matchups('1', 2026)
  await reads.gameMatchups('1')
  await reads.officialsSeason(2026, ['regular'])
  await reads.officialCareer('1', ['regular'])
  const onCourt = { gameTypes: ['regular'] } as never
  await reads.onCourtUnits('1', 2026, onCourt, 5)
  await reads.withOrWithout('1', null, 2026, onCourt)
  await reads.lineups('1', 2026, 'regular', 'top' as never)
  await reads.profile('1')
  await reads.availability(['1'])
  await reads.coaches('1', 2026)
  await reads.shots({ player: '1', seasons: [2026], gameTypes: ['regular'] } as never)
  await reads.assists({ player: '1', seasons: [2026], gameTypes: ['regular'] } as never)
  await reads.gameFlow('1')
  // The engine answers a query with the league's reason, never an error.
  if (query) await reads.query(asked)
}

let service: StatsService | null = null
afterEach(async () => {
  await service?.close()
  service = null
})

describe('the college leagues before their data', () => {
  it('have their identity and game recipes, no models, and the accessors refuse to read the rest', () => {
    for (const league of COLLEGE) {
      // The game, team and player tables (T1302.4) and the game and season tables (T1302.5); every
      // later table still reads its reason.
      expect(league.builds).toEqual(['identity', 'derived'])
      expect(recipeOf(league, 'identity')).toBe('college')
      expect(recipeOf(league, 'derived')).toBe('college')
      expect(SOURCES_BY_LEAGUE[league.id].length).toBeGreaterThan(0)
      expect(() => modelsOf(league)).toThrow(`the ${league.name} has no ratings or models yet`)
      for (const kind of ['published', 'plays'] as const) {
        expect(() => recipeOf(league, kind)).toThrow(`the ${league.name} has no ${kind} recipe yet`)
      }
    }
    // The NBA's and the WNBA's are named, read without a check.
    expect(modelsOf(LEAGUES.nba).elo.k).toBe(20)
    expect(recipeOf(LEAGUES.wnba, 'identity')).toBe('wnba')
  })

  it('answer every screen’s read with their reason while off, reaching no accessor', async () => {
    for (const league of COLLEGE) {
      const reads = offlineStats(league)
      await readEverything(reads)
      expect((await reads.status()).noData).toBe(league.noData)
      const result = await reads.query({
        entity: 'player',
        metrics: ['pts'],
        scope: { seasons: [2026] }
      })
      expect(result.notes).toEqual([league.noData])
      // Every release waits, but ESPN's play by play, which this build leaves out (D42).
      const families = (await reads.data()).families
      expect(families).toHaveLength(29)
      expect(families.filter((f) => f.state === 'left-out').map((f) => f.label)).toEqual([
        'Play by play (ESPN)'
      ])
      expect(families.every((f) => f.state === 'left-out' || f.state === 'waiting')).toBe(true)
    }
  })

  it('read their catalogue and every metric’s words with no models', () => {
    for (const league of COLLEGE) {
      expect(catalogueInfo(league).length).toBe(CATALOGUE.length)
      for (const def of CATALOGUE) {
        expect(() => metricIn(def, league)).not.toThrow()
        // The source switch, asked with a release left out, names nothing of tables not built.
        expect(leftOutGap(def, true, ['ncaa_mbb_pbp'], league)).toBeNull()
      }
    }
  })

  it('answer every read once turned on, the file empty, those of tables not built with the reason', async () => {
    for (const league of COLLEGE) {
      const dir = tempDir()
      mkdirSync(join(dir, 'tmp'))
      service = await openStatsService({
        league: league.id,
        dataDir: dir,
        tempDir: join(dir, 'tmp')
      })
      const s = service
      // Before the first load builds the season tables, a query says so, as the NBA's does.
      await expect(
        s.query({ entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } })
      ).rejects.toThrow(league.notBuilt)
      await readEverything(s, false)
      expect(await s.games(2026)).toEqual([])
      // The plays and the published tables come in later parts: their reads give that reason.
      const plays = notBuiltYet(league, 'plays')
      const shots = await s.shots({
        entity: 'player',
        id: '1',
        seasons: [2026],
        scope: { gameTypes: ['regular'] }
      })
      expect(shots.reason).toBe(plays)
      expect((await s.gameFlow('1')).reason).toBe(plays)
      expect((await s.gameMatchups('1')).reason).toBe(notBuiltYet(league, 'published'))
      await service.close()
      service = null
    }
  })

  it('read every metric outside the window as loaded from 2021-22 (D39)', () => {
    for (const league of COLLEGE) {
      const pts = metricIn(METRICS.get('pts')!, league)
      expect(coverageReason(pts, [2021], league)).toBe('Loaded from 2021-22.')
      expect(coverageReason(pts, [2022], league)).toBeNull()
      // A metric that starts later in the window keeps its own words: ESPN's paint points.
      const paint = metricIn(METRICS.get('team_paint_pts')!, league)
      expect(paint.firstSeason).toBe(2024)
      expect(coverageReason(paint, [2023], league)).toBe('Recorded from 2023-24.')
      expect(coverageReason(paint, [2020], league)).toBe('Loaded from 2021-22.')
      // ESPN's college box scores have no plus-minus: it says so.
      expect(metricIn(METRICS.get('plus_minus')!, league).unavailable).toMatch(/plus-minus/)
    }
    // The NBA's words are as they were.
    expect(coverageReason(METRICS.get('plus_minus')!, [1990], LEAGUES.nba)).toBe(
      'Recorded from 1996-97.'
    )
  })

  it('give the stats.ncaa.org splits their reason when those releases are left out (D41)', () => {
    const splits = CATALOGUE.filter((m) => m.reads?.length)
    expect(splits.length).toBeGreaterThan(30)
    for (const league of COLLEGE) {
      for (const m of splits) {
        const def = metricIn(m, league)
        expect(def.unavailable).toBeUndefined()
        expect(leftOutGap(def, false, [], league)).toBeNull()
        expect(leftOutGap(def, false, NCAA_STATS_RELEASES, league)).toBe(LEFT_OUT_REASON)
      }
      // A box-score metric reads ESPN's, which always loads.
      expect(
        leftOutGap(metricIn(METRICS.get('pts')!, league), false, NCAA_STATS_RELEASES, league)
      ).toBeNull()
    }
    // The splits are the colleges' alone.
    for (const m of splits) {
      expect(metricIn(m, LEAGUES.nba).unavailable).toBe(notInLeague(LEAGUES.nba))
      expect(metricIn(m, LEAGUES.wnba).unavailable).toBe(notInLeague(LEAGUES.wnba))
    }
  })

  it('refresh with nothing to download and no step to build, with no error', async () => {
    for (const league of COLLEGE) {
      const db = await openTestDb()
      const result = await refreshStats(
        {
          db,
          league,
          downloads: { fetchFile: async () => ({ kind: 'missing' }), removeFile: async () => {} },
          now: () => NOW
        },
        {},
        SOURCES_BY_LEAGUE[league.id]
      )
      expect(result.steps.filter((s) => s.status === 'error')).toEqual([])
      // Its game tables are not in its entry: the step says they are skipped, with the reason.
      const derived = result.steps.find((s) => s.source === STATS_DERIVED_STEP)
      expect(derived?.status).not.toBe('error')
    }
  })
})
