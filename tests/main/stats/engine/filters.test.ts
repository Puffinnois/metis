import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { compileQuery, StatsQueryError } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import { LEAGUES } from '@shared/leagues'
import type { StatsFilter, StatsQuery, StatsResult } from '@shared/stats/types'
import {
  addGame,
  addNbaLine,
  addNbaTeam,
  BOS,
  emptySources,
  LAL,
  MIA,
  type Stats
} from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const CTX = { league: LEAGUES.nba, currentSeason: 2027 }

/** A line that only scores: `pts` points on `pts` free throws. */
const scoring = (pts: number): Stats => [0, 0, 0, 0, pts, pts, 0, 0, 0, 0, 0, 0, 0, pts]

let db: StatsDb

type Q = Partial<StatsQuery> & { scope?: StatsQuery['scope'] }

const run = (filters: StatsFilter[] | undefined, q: Q = {}): Promise<StatsResult> =>
  runQuery(
    db,
    { entity: 'player', metrics: ['pts'], scope: { seasons: [2026] }, filters, ...q },
    CTX
  )

const ids = (r: StatsResult): string[] => r.rows.map((x) => x.id)

/**
 * The fixture of `run.test.ts`, smaller: player 1 traded from Boston to Miami (100 points in 4
 * games of 2025-26, 7 in 2024-25), player 2 a Laker (41 in 3), player 3 a Boston center (11 in 2).
 * The attribute tables are written by hand, so the engine is tested apart from the builder:
 * player 1 French, born 1990-03-01, 80 inches, drafted; player 2 American, born 2000-06-15, 75
 * inches, undrafted, jersey "00"; player 3 with no birth date, country or draft known.
 */
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2025, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2025, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2026, ${MIA}, 14, 'MIA', 'Miami Heat', 'east', 'southeast')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Traded'), (2, 'Bea Laker'), (3, 'Cal Center')`)
  await db.exec(
    `INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'G-F'), (3, 2026, 'C-F')`
  )
  const game = (
    id: string,
    date: string,
    home: number,
    away: number,
    season = 2026
  ): Promise<void> => addGame(db, { id, date, home, away, scores: [100, 90], season })
  await game('a', '2025-11-01', BOS, LAL)
  await game('b', '2026-01-05', LAL, BOS)
  await game('c', '2026-01-06', MIA, LAL)
  await game('d', '2026-03-01', LAL, MIA)
  await game('old', '2025-01-10', BOS, LAL, 2025)
  await addNbaLine(db, 'a', 1, BOS, { stats: scoring(10), position: 'G' })
  await addNbaLine(db, 'b', 1, BOS, { stats: scoring(20), position: 'G' })
  await addNbaLine(db, 'c', 1, MIA, { stats: scoring(30), position: 'G' })
  await addNbaLine(db, 'd', 1, MIA, { stats: scoring(40), position: 'G' })
  await addNbaLine(db, 'old', 1, BOS, { stats: scoring(7), season: 2025, position: 'G' })
  await addNbaLine(db, 'old', 2, LAL, { stats: scoring(9), season: 2025, position: 'G' })
  await addNbaLine(db, 'a', 2, LAL, { stats: scoring(11), position: 'G' })
  await addNbaLine(db, 'c', 2, LAL, { stats: scoring(13), position: 'G' })
  await addNbaLine(db, 'd', 2, LAL, { stats: scoring(17), position: 'G' })
  await addNbaLine(db, 'a', 3, BOS, { stats: scoring(5) })
  await addNbaLine(db, 'b', 3, BOS, { stats: scoring(6) })
  await addNbaTeam(db, 'a', BOS, scoring(100))
  await addNbaTeam(db, 'a', LAL, scoring(90))
  await buildDerived(db)
  await db.exec(`CREATE TABLE player_attributes (player_id BIGINT, birth_date DATE,
    birth_country VARCHAR, school VARCHAR, height_in INTEGER, undrafted BOOLEAN, draft_year INTEGER,
    hometown VARCHAR)`)
  await db.exec(`INSERT INTO player_attributes VALUES
    (1, DATE '1990-03-01', 'France', 'Duke', 80, false, 2010, NULL),
    (2, DATE '2000-06-15', 'USA', 'Iowa', 75, true, NULL, NULL),
    (3, NULL, NULL, NULL, 84, NULL, NULL, NULL)`)
  await db.exec(`CREATE TABLE player_season_attributes (player_id BIGINT, season INTEGER,
    jersey VARCHAR, experience INTEGER)`)
  await db.exec(`INSERT INTO player_season_attributes VALUES
    (1, 2026, '7', 5), (2, 2026, '00', 0), (3, 2026, NULL, NULL), (1, 2025, '9', 4), (2, 2025, '0', NULL)`)
  await db.exec(`CREATE TABLE team_attributes (team_id BIGINT, season INTEGER, arena VARCHAR,
    arena_capacity INTEGER)`)
  await db.exec(`INSERT INTO team_attributes VALUES
    (${BOS}, 2026, 'TD Garden', NULL), (${LAL}, 2026, 'Crypto.com Arena', NULL), (${MIA}, 2026, NULL, NULL)`)
})

describe('filters on attributes, each operator', () => {
  it('between, at least and at most on a number, both ends included', async () => {
    expect(
      ids(await run([{ attribute: 'height', op: 'between', value: [75, 80] }])).sort()
    ).toEqual(['1', '2'])
    expect(ids(await run([{ attribute: 'height', op: 'atLeast', value: 80 }])).sort()).toEqual([
      '1',
      '3'
    ])
    expect(ids(await run([{ attribute: 'height', op: 'atMost', value: 75 }]))).toEqual(['2'])
  })

  it('compares dates as dates', async () => {
    const born = await run([
      { attribute: 'birthDate', op: 'between', value: ['1995-01-01', '2001-01-01'] }
    ])
    expect(ids(born)).toEqual(['2'])
    expect(ids(await run([{ attribute: 'birthDate', op: 'atMost', value: '1990-03-01' }]))).toEqual(
      ['1']
    )
  })

  it('any of and none of ignore letter case; contains finds a part', async () => {
    const any = await run([{ attribute: 'birthCountry', op: 'anyOf', value: ['france', 'USA'] }])
    expect(ids(any).sort()).toEqual(['1', '2'])
    expect(ids(await run([{ attribute: 'birthCountry', op: 'noneOf', value: ['usa'] }]))).toEqual([
      '1'
    ])
    expect(ids(await run([{ attribute: 'school', op: 'contains', value: 'UK' }]))).toEqual(['1'])
  })

  it('is and is not on a flag', async () => {
    expect(ids(await run([{ attribute: 'undrafted', op: 'is' }]))).toEqual(['2'])
    expect(ids(await run([{ attribute: 'undrafted', op: 'isNot' }]))).toEqual(['1'])
  })

  it('has a value and has none, which leave nothing out for lacking one', async () => {
    const none = await run([{ attribute: 'birthDate', op: 'hasNone' }])
    expect(ids(none)).toEqual(['3'])
    expect(none.filtered).toEqual({ noValue: 0, reason: null })
    expect(ids(await run([{ attribute: 'birthDate', op: 'hasValue' }])).sort()).toEqual(['1', '2'])
  })

  it('works out age on January 31 of the row’s season', async () => {
    // Player 1 is 35 on 2026-01-31 and player 2 is 25; in 2024-25 player 2 is 24.
    expect(ids(await run([{ attribute: 'age', op: 'atMost', value: 25 }]))).toEqual(['2'])
    expect(ids(await run([{ attribute: 'age', op: 'between', value: [35, 35] }]))).toEqual(['1'])
    const bySeason = await run([{ attribute: 'age', op: 'atMost', value: 24 }], {
      scope: { seasons: [2025, 2026] },
      groupBy: ['season']
    })
    expect(bySeason.rows.map((x) => [x.id, x.group.season])).toEqual([['2', 2025]])
  })

  it('reads an attribute that changes by season in the row’s season', async () => {
    expect(ids(await run([{ attribute: 'jersey', op: 'anyOf', value: ['00'] }]))).toEqual(['2'])
    const both = await run([{ attribute: 'jersey', op: 'anyOf', value: ['0', '9'] }], {
      scope: { seasons: [2025, 2026] },
      groupBy: ['season']
    })
    expect(both.rows.map((x) => [x.id, x.group.season]).sort()).toEqual([
      ['1', 2025],
      ['2', 2025]
    ])
    // Over two seasons together, a row reads its latest season's jersey.
    const together = await run([{ attribute: 'jersey', op: 'anyOf', value: ['7'] }], {
      scope: { seasons: [2025, 2026] }
    })
    expect(ids(together)).toEqual(['1'])
    expect(ids(await run([{ attribute: 'experience', op: 'atMost', value: 0 }]))).toEqual(['2'])
  })

  it('filters a team board on its own attributes', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_pts'],
        scope: { seasons: [2026] },
        filters: [{ attribute: 'arena', op: 'contains', value: 'garden' }]
      },
      CTX
    )
    expect(ids(r)).toEqual([String(BOS)])
  })
})

describe('the answer after the filters', () => {
  it('keeps each row’s rank and percentile among every row, and numbers what is left', async () => {
    const all = await run(undefined, { transform: 'perGame' })
    const kept = await run([{ attribute: 'undrafted', op: 'is' }], { transform: 'perGame' })
    const before = all.rows.find((x) => x.id === '2')?.values.pts
    expect(before?.rank).toBe(2)
    expect(kept.rows).toHaveLength(1)
    expect(kept.rows[0].values.pts).toEqual(before)
    expect(kept.total).toBe(1)
  })

  it('counts the filtered rows in total and applies the limit after the filter', async () => {
    const r = await run([{ attribute: 'height', op: 'atLeast', value: 75 }], { limit: 1 })
    expect(ids(r)).toEqual(['1'])
    expect(r.total).toBe(3)
  })

  it('leaves out a row with no value, and says how many, never guessing', async () => {
    const r = await run([{ attribute: 'birthCountry', op: 'anyOf', value: ['usa'] }])
    expect(ids(r)).toEqual(['2'])
    expect(r.filtered).toEqual({ noValue: 1, reason: null })
    // With no row left, the count is still given.
    const none = await run([{ attribute: 'birthCountry', op: 'anyOf', value: ['japan'] }])
    expect(none.rows).toEqual([])
    expect(none.total).toBe(0)
    expect(none.filtered).toEqual({ noValue: 1, reason: null })
  })

  it('counts only the rows it cannot place, not a row a condition with a value rejects', async () => {
    // Player 3 is 84 inches, so "at most 80" rejects them whatever their unknown country: they are
    // not left out for no value. Players 1 and 2 have both values.
    const r = await run([
      { attribute: 'height', op: 'atMost', value: 80 },
      { attribute: 'birthCountry', op: 'anyOf', value: ['usa'] }
    ])
    expect(ids(r)).toEqual(['2'])
    expect(r.filtered?.noValue).toBe(0)
    // With a condition player 3 passes, the unknown country is what keeps them out.
    const tall = await run([
      { attribute: 'height', op: 'atLeast', value: 80 },
      { attribute: 'birthCountry', op: 'anyOf', value: ['usa'] }
    ])
    expect(ids(tall)).toEqual([])
    expect(tall.filtered?.noValue).toBe(1)
  })

  it('counts the rows left out among those the board would list: qualified only', async () => {
    // Player 4, with no attributes at all, plays one game: short of the two that 58 in 82 asks.
    await db.exec(`INSERT INTO player VALUES (4, 'Dee Once')`)
    await addNbaLine(db, 'b', 4, BOS, { stats: scoring(2) })
    await buildDerived(db)
    const filters: StatsFilter[] = [{ attribute: 'birthCountry', op: 'anyOf', value: ['usa'] }]
    const every = await run(filters, { transform: 'perGame' })
    expect(every.filtered?.noValue).toBe(2)
    const qualified = await run(filters, {
      transform: 'perGame',
      scope: { seasons: [2026], qualifiedOnly: true }
    })
    expect(ids(qualified)).toEqual(['2'])
    expect(qualified.filtered?.noValue).toBe(1)
  })

  it('compares a metric as the transform shows it', async () => {
    // Per game: player 1 25, player 2 13.7, player 3 5.5.
    const r = await run([{ metric: 'pts', op: 'atLeast', value: 13 }], { transform: 'perGame' })
    expect(ids(r)).toEqual(['1', '2'])
    const raw = await run([{ metric: 'pts', op: 'between', value: [11, 41] }])
    expect(ids(raw).sort()).toEqual(['2', '3'])
  })

  it('computes a metric the query does not list for its condition, and does not show it', async () => {
    const r = await run([{ metric: 'ftm', op: 'atLeast', value: 50 }])
    expect(ids(r)).toEqual(['1'])
    expect(r.columns.map((c) => c.id)).toEqual(['pts'])
    expect(Object.keys(r.rows[0].values)).toEqual(['pts'])
  })

  it('holds every condition at once', async () => {
    const r = await run([
      { attribute: 'height', op: 'atLeast', value: 75 },
      { metric: 'pts', op: 'atMost', value: 50 }
    ])
    expect(ids(r).sort()).toEqual(['2', '3'])
  })
})

describe('a condition no row can answer', () => {
  it('answers with the league’s reason for an attribute it does not have', async () => {
    const r = await run([{ attribute: 'hometown', op: 'contains', value: 'x' }])
    expect(r.rows).toEqual([])
    expect(r.filtered?.reason).toMatch(/college rosters/)
    expect(r.columns.map((c) => c.id)).toEqual(['pts'])
  })

  it('answers with the seasons it has, outside them', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_pts'],
        scope: { seasons: [2026] },
        filters: [{ attribute: 'arenaCapacity', op: 'atLeast', value: 1 }]
      },
      CTX
    )
    expect(r.filtered?.reason).toBe('Arena capacity: published from 2001-02 to 2018-19.')
  })

  it('answers with the metric’s own reason', async () => {
    // Tracking starts in 2013-14: a condition on it over 2004-05 has nothing to compare.
    const r = await run([{ metric: 'touches', op: 'atLeast', value: 1 }], {
      scope: { seasons: [2005] }
    })
    expect(r.rows).toEqual([])
    expect(r.filtered?.reason).toMatch(/^Touches: .*2013-14/)
  })

  it('says the attributes come with the next refresh when the file has none yet', async () => {
    await db.exec('DROP TABLE player_season_attributes')
    const r = await run([{ attribute: 'jersey', op: 'anyOf', value: ['7'] }])
    expect(r.filtered?.reason).toBe('Attributes are built at the next refresh of this league.')
  })
})

describe('the checks and the SQL', () => {
  const compile = (filters: unknown, entity: 'player' | 'team' = 'player'): string =>
    compileQuery(
      { entity, metrics: ['pts'], scope: { seasons: [2026] }, filters } as StatsQuery,
      CTX
    ).sql

  it('refuses a condition it cannot read, with a message to act on', () => {
    expect(() => compile([{ attribute: 'shoeSize', op: 'atLeast', value: 1 }])).toThrow(
      'unknown attribute "shoeSize"'
    )
    expect(() => compile([{ attribute: 'height', op: 'contains', value: 'x' }])).toThrow(
      /contains does not apply to a number/
    )
    expect(() => compile([{ attribute: 'height', op: 'between', value: [80, 70] }])).toThrow(
      /\[min, max\]/
    )
    expect(() => compile([{ attribute: 'birthDate', op: 'atLeast', value: 1990 }])).toThrow(
      /a date YYYY-MM-DD/
    )
    expect(() => compile([{ attribute: 'arena', op: 'contains', value: 'x' }])).toThrow(
      /a team attribute, not a player one/
    )
    expect(() => compile([{ attribute: 'height', metric: 'pts', op: 'hasValue' }])).toThrow(
      /one attribute or one metric/
    )
    expect(() => compile([{ attribute: 'undrafted', op: 'is', value: true }])).toThrow(
      /takes no value/
    )
    expect(() => compile([{ attribute: 'height', op: 'atLeast', value: 1, extra: 1 }])).toThrow(
      'unknown filters[0] field "extra"'
    )
    expect(() =>
      compile(Array.from({ length: 21 }, () => ({ attribute: 'height', op: 'hasValue' })))
    ).toThrow(/at most 20/)
    expect(() => compile([{ metric: 'pts', op: 'is' }])).toThrow(StatsQueryError)
  })

  it('binds every value as a parameter, never into the SQL', () => {
    const c = compileQuery(
      {
        entity: 'player',
        metrics: ['pts'],
        scope: { seasons: [2026] },
        filters: [{ attribute: 'birthCountry', op: 'anyOf', value: ["Côte d'Ivoire"] }]
      },
      CTX
    )
    expect(c.sql).not.toContain('Ivoire')
    expect(c.params).toContain("côte d'ivoire")
    expect(c.sql).toContain('FROM filtered x')
    expect(c.sql).toContain('LEFT JOIN player_attributes fa ON fa.player_id = x.id')
  })

  it('leaves the SQL of a query with no filters as it was', () => {
    expect(compile([])).toBe(compile(undefined))
    expect(compile(undefined)).not.toContain('judged')
  })
})
