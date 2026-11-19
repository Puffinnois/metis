import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sqlHashes } from '../../../fixtures/sqlShapes'

/**
 * The college leagues' rules (T1302.5: Division I alone, the 75 % rule on the row's own team games and
 * the per-game categories it covers, every game as the default scope, the recipe's own columns) are
 * switched by the league's entry, and must leave the NBA's and the WNBA's SQL byte for byte as it
 * was. The fixture holds the hashes `main` gave before them, from the same `sqlHashes` (every metric
 * each league has under three scopes, boards of many columns under fourteen, and the builds). A later
 * change that means to alter the NBA's or the WNBA's SQL regenerates it and says so.
 */
const BEFORE: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, '../../../fixtures/nba-wnba-sql.json'), 'utf8')
)

describe("the NBA's and the WNBA's SQL", () => {
  it('is as main compiled it before the college leagues’ rules', async () => {
    const now = await sqlHashes()
    const changed = Object.keys(BEFORE).filter((k) => k in now && now[k] !== BEFORE[k])
    expect(changed).toEqual([])
    // Every shape the fixture holds is still asked: a metric gone would hide a change.
    expect(Object.keys(BEFORE).filter((k) => !(k in now))).toEqual([])
    expect(Object.keys(BEFORE).length).toBeGreaterThan(2500)
  }, 60_000)
})
