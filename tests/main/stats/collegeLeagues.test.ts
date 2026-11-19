import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { catalogueInfo } from '@main/stats/engine/registry'
import { leftOutGap } from '@main/stats/leftOut'
import { offlineStats, type StatsReads } from '@main/stats/offline'
import { openStatsService, type StatsService } from '@main/stats/service'
import { SOURCES_BY_LEAGUE } from '@main/stats/sources'
import { refreshStats, STATS_DERIVED_STEP } from '@main/stats/sync'
import { LEAGUES, modelsOf, recipeOf, type League } from '@shared/leagues'
import { CATALOGUE } from '@shared/stats/catalogue'
import { metricIn } from '@shared/stats/catalogue'
import type { StatsQuery } from '@shared/stats/types'
import { openTestDb, tempDir } from '../../fixtures/stats'

/**
 * The college leagues before their built tables (Plan T1302.2): their sources load (T1302.3), but no
 * built tables, no recipes and no models yet. Their recipes and models are null behind accessors that throw (`recipeOf`, `modelsOf`), so
 * every read a screen makes, with the league off or turned on with its file empty, must answer with
 * the league's reason and never reach one: a read that did would reject with the accessor's error.
 */
const COLLEGE: League[] = [LEAGUES.ncaam, LEAGUES.ncaaw]
const NOW = new Date('2026-11-18T12:00:00Z')

/** Every read a screen makes, once each, with arguments of the right shape. */
async function readEverything(reads: StatsReads): Promise<void> {
  const query: StatsQuery = {
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
  await reads.query(query)
}

let service: StatsService | null = null
afterEach(async () => {
  await service?.close()
  service = null
})

describe('the college leagues before their data', () => {
  it('have only their identity recipe, no models, and the accessors refuse to read the rest', () => {
    for (const league of COLLEGE) {
      // The game, team and player tables (T1302.4); every later table still reads its reason.
      expect(league.builds).toEqual(['identity'])
      expect(recipeOf(league, 'identity')).toBe('college')
      expect(SOURCES_BY_LEAGUE[league.id].length).toBeGreaterThan(0)
      expect(() => modelsOf(league)).toThrow(`the ${league.name} has no ratings or models yet`)
      for (const kind of ['derived', 'published', 'plays'] as const) {
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

  it('answer every read with their reason once turned on, the file empty', async () => {
    for (const league of COLLEGE) {
      const dir = tempDir()
      mkdirSync(join(dir, 'tmp'))
      service = await openStatsService({
        league: league.id,
        dataDir: dir,
        tempDir: join(dir, 'tmp')
      })
      const s = service
      const result = await s.query({
        entity: 'player',
        metrics: ['pts'],
        scope: { seasons: [2026] }
      })
      expect(result.notes).toEqual([league.notBuilt])
      await readEverything(s)
      expect(await s.games(2026)).toEqual([])
      expect((await s.status()).noData).toBe(league.notBuilt)
      await service.close()
      service = null
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
