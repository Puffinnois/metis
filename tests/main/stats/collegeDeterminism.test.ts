import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { buildPlays } from '@main/stats/derived/playBuilders'
import { buildPublished } from '@main/stats/derived/published'
import { buildIdentity } from '@main/stats/identity'
import { LEAGUES, type League } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'

/**
 * The same files give the same rows (T1302.9): every pick in the college recipes is by a total
 * order (a value, then the row itself), never by the order DuckDB meets the rows. Each league is
 * built twice from the T1302.4 to T1302.6 fixtures, the second time with every source table's rows
 * in another order, and every table built must be the same. The play by play keeps its file's order
 * (`SourceFile.ordered`): a play's place among those of the same second is its row's. Sums of
 * decimals are compared to nine significant digits, since adding in another order moves the last.
 */
const FIXTURES = join(__dirname, '../../fixtures')

async function built(league: League, shuffled: boolean): Promise<StatsDb> {
  const db = await openTestDb()
  for (const dir of ['college-identity', 'college-derived', 'college-depth']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const table = `src_${file.replace(/\.parquet$/, '')}`
      const path = join(FIXTURES, dir, league.id, file)
      const order = shuffled && table !== 'src_ncaa_pbp' ? ' t ORDER BY hash(t::VARCHAR) DESC' : ''
      await db.exec(
        `CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})${order}`
      )
    }
  }
  await buildIdentity(db, league)
  await buildDerived(db, league)
  await buildPublished(db, league)
  await buildPlays(db, league)
  return db
}

/** Each built table's rows, decimals to nine significant digits, as sorted text. */
async function contents(db: StatsDb): Promise<Map<string, string[]>> {
  const tables = await db.all<{ name: string }>(
    `SELECT table_name AS name FROM duckdb_tables()
     WHERE schema_name = 'main' AND NOT temporary AND table_name NOT LIKE 'src\\_%' ESCAPE '\\'
       AND table_name NOT IN ('derived_state', 'source_state', 'sync_log', 'stats_settings')
     ORDER BY 1`
  )
  const out = new Map<string, string[]>()
  for (const { name } of tables) {
    const cols = await db.all<{ c: string; d: string }>(
      `SELECT column_name AS c, data_type AS d FROM duckdb_columns()
       WHERE schema_name = 'main' AND table_name = ? ORDER BY column_index`,
      [name]
    )
    if (cols.length === 0) continue
    const shown = cols
      .map(({ c, d }) =>
        d === 'DOUBLE' || d === 'FLOAT'
          ? `CASE WHEN "${c}" IS NULL OR "${c}" = 0 OR NOT isfinite("${c}") THEN "${c}"
               ELSE round("${c}" / pow(10, floor(log10(abs("${c}")))), 8) * pow(10, floor(log10(abs("${c}")))) END`
          : `"${c}"`
      )
      .join(', ')
    const rows = await db.all<{ r: string }>(
      `SELECT r FROM (SELECT (${shown})::VARCHAR AS r FROM "${name}") ORDER BY r`
    )
    out.set(
      name,
      rows.map((x) => x.r)
    )
  }
  return out
}

describe('a college build', () => {
  it.each([LEAGUES.ncaam, LEAGUES.ncaaw])(
    'gives the same tables from the same files in another order: $id',
    async (league) => {
      const a = await built(league, false)
      const b = await built(league, true)
      const ta = await contents(a)
      const tb = await contents(b)
      expect([...tb.keys()]).toEqual([...ta.keys()])
      // Enough tables and rows that the comparison means something.
      expect(ta.size).toBeGreaterThan(20)
      expect(ta.get('ncaa_player_ids')?.length).toBeGreaterThan(0)
      expect(ta.get('player_game')?.length).toBeGreaterThan(0)
      expect(ta.get('play_nba')?.length).toBeGreaterThan(0)
      const differing = [...ta.keys()].filter(
        (t) => JSON.stringify(ta.get(t)) !== JSON.stringify(tb.get(t))
      )
      expect(differing).toEqual([])
      await a.close()
      await b.close()
    },
    240_000
  )
})
