import { describe, expect, it } from 'vitest'
import { splitSecondsSql, splitWhenSql } from '@main/stats/derived/splits'
import { inSplit, mirrorOf, SPLITS, splitById } from '@shared/stats/splits'
import { openTestDb } from '../../fixtures/stats'

const s = (id: string): NonNullable<ReturnType<typeof splitById>> => splitById(id)!

describe('the split rules', () => {
  it('clutch: the last 5 minutes of the 4th quarter or overtime, within 5', () => {
    expect(inSplit(s('clutch'), 4, 300, 5)).toBe(true)
    expect(inSplit(s('clutch'), 4, 300.1, 0)).toBe(false)
    expect(inSplit(s('clutch'), 4, 10, -5)).toBe(true)
    expect(inSplit(s('clutch'), 4, 10, 6)).toBe(false)
    expect(inSplit(s('clutch'), 3, 10, 0)).toBe(false)
    // Every overtime is five minutes, so all of it can be clutch.
    expect(inSplit(s('clutch'), 6, 300, 0)).toBe(true)
  })

  it('quarters, halves and overtime', () => {
    expect(inSplit(s('q1'), 1, 600, 0)).toBe(true)
    expect(inSplit(s('h2'), 4, 1, 0)).toBe(true)
    expect(inSplit(s('h2'), 5, 1, 0)).toBe(false)
    expect(inSplit(s('ot'), 7, 100, 0)).toBe(true)
  })

  it('the score from the team’s side, mirrored for the other team', () => {
    expect(inSplit(s('ahead'), 1, 100, 1)).toBe(true)
    expect(inSplit(s('tied'), 1, 100, 0)).toBe(true)
    expect(inSplit(s('behind'), 1, 100, -1)).toBe(true)
    expect(inSplit(s('ahead10'), 1, 100, 10)).toBe(true)
    expect(inSplit(s('ahead10'), 1, 100, 9)).toBe(false)
    expect(mirrorOf(s('ahead'))).toBe('behind')
    expect(mirrorOf(s('ahead10'))).toBe('behind10')
    expect(mirrorOf(s('clutch'))).toBe('clutch')
  })

  it('garbage time and the rest cover every moment once', () => {
    for (const period of [1, 4, 5]) {
      for (const clock of [720, 541, 540, 361, 360, 0]) {
        for (const margin of [-30, -25, -24, -20, -19, -10, -9, 0, 9, 10, 19, 20, 24, 25]) {
          const g = inSplit(s('garbage'), period, clock, margin)
          expect(g).toBe(!inSplit(s('nogarbage'), period, clock, margin))
        }
      }
    }
    expect(inSplit(s('garbage'), 4, 541, 25)).toBe(true)
    expect(inSplit(s('garbage'), 4, 540, 24)).toBe(true)
    expect(inSplit(s('garbage'), 4, 360, 10)).toBe(true)
    expect(inSplit(s('garbage'), 4, 361, 19)).toBe(false)
    expect(inSplit(s('garbage'), 5, 100, 30)).toBe(false)
  })

  it('the SQL says the same as the rule, moment by moment', async () => {
    const db = await openTestDb()
    const moments: [number, number, number][] = []
    for (const period of [1, 2, 3, 4, 5, 6]) {
      for (const clock of [720, 541, 540, 361, 360, 300.1, 300, 120, 60, 0]) {
        for (const margin of [-26, -25, -11, -10, -6, -5, -1, 0, 1, 5, 6, 10, 20, 25]) {
          if (period >= 5 && clock > 300) continue
          moments.push([period, clock, margin])
        }
      }
    }
    await db.exec('CREATE TABLE m (period INTEGER, clock DOUBLE, margin INTEGER)')
    await db.exec(`INSERT INTO m VALUES ${moments.map((x) => `(${x.join(', ')})`).join(', ')}`)
    for (const split of SPLITS) {
      const rows = await db.all<{ period: number; clock: number; margin: number; inside: boolean }>(
        `SELECT period, clock, margin, ${splitWhenSql(split, 'period', 'clock', 'margin')} AS inside FROM m`
      )
      for (const r of rows) {
        expect([split.id, r.period, r.clock, r.margin, r.inside]).toEqual([
          split.id,
          r.period,
          r.clock,
          r.margin,
          inSplit(split, r.period, r.clock, r.margin)
        ])
      }
    }
  })

  it('times a stretch by the part of it inside each window', async () => {
    const db = await openTestDb()
    const at = async (
      id: string,
      period: number,
      lo: number,
      hi: number,
      margin: number
    ): Promise<number> =>
      (
        await db.get<{ s: number }>(
          `SELECT (${splitSecondsSql(s(id), String(period), String(lo), String(hi), String(margin))})::DOUBLE AS s`
        )
      )?.s ?? -1
    expect(await at('clutch', 4, 250, 400, 0)).toBe(50)
    expect(await at('clutch', 4, 250, 400, 6)).toBe(0)
    expect(await at('q4', 4, 250, 400, 30)).toBe(150)
    // At a margin of 20: garbage from 9:00 down, the rest above it.
    expect(await at('garbage', 4, 300, 600, 20)).toBe(240)
    expect(await at('nogarbage', 4, 300, 600, 20)).toBe(60)
  })
})
