import { describe, expect, it } from 'vitest'
import { sourceSeasons } from '@main/stats/service'
import { openTestDb } from '../../fixtures/stats'

describe('the seasons each source holds a file of', () => {
  it('reads a release of many files into one table as holding a season any of its files has', async () => {
    const db = await openTestDb()
    const row = (source: string, season: number): string =>
      `('${source}', ${season}, 1, 10, '2026-11-24T05:00:00Z', false)`
    await db.exec(`INSERT INTO source_state (source, season, version, rows_written, fetched_at, sealed)
      VALUES ${[
        row('nba_current_impact', 2025),
        row('nba_current_impact', 2026),
        row('nba_play_types/regular-season_transition_offensive_totals', 2025),
        row('nba_play_types/playoffs_isolation_defensive_totals', 2026)
      ].join(', ')}`)
    const held = await sourceSeasons(db)
    expect([...(held.seasons.get('src_nba_current_impact') ?? [])]).toEqual([2025, 2026])
    expect([...(held.seasons.get('src_nba_play_types') ?? [])].sort()).toEqual([2025, 2026])
    // Each file keeps its own row too.
    expect([
      ...(held.seasons.get('src_nba_play_types/playoffs_isolation_defensive_totals') ?? [])
    ]).toEqual([2026])
    await db.close()
  })
})
