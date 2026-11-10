import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { buildPublished } from '@main/stats/derived/published'
import { compileQuery, StatsQueryError } from '@main/stats/engine/compile'
import { grainsOf } from '@main/stats/engine/registry'
import { runQuery } from '@main/stats/engine/run'
import { METRICS } from '@shared/stats/catalogue'
import type { MetricDef, StatsQuery, StatsResult, StatsRow } from '@shared/stats/types'
import { addGame, addNbaLine, BOS, emptySources, LAL, MIA } from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const WIDGET_TABLE = 'published_test_widgets'

vi.mock('@main/stats/derived/publishedTables', async (actual) => ({
  ...(await actual<typeof import('@main/stats/derived/publishedTables')>()),
  PUBLISHED_TABLES: [
    {
      table: 'published_test_widgets',
      entity: 'player',
      source: 'src_test_widgets',
      firstSeason: 2025,
      games: 'gp',
      minutes: 'min',
      columns: ['widgets', 'widget_tries']
    },
    {
      table: 'published_test_team_widgets',
      entity: 'team',
      source: 'src_test_team_widgets',
      games: 'gp',
      minutes: 'min',
      columns: ['widgets']
    },
    {
      table: 'published_test_bare',
      entity: 'player',
      source: 'src_test_bare',
      games: null,
      minutes: null,
      columns: ['rating']
    }
  ]
}))

vi.mock('@shared/stats/catalogue', async (actual) => {
  const real = await actual<typeof import('@shared/stats/catalogue')>()
  const def = (id: string, o: Partial<MetricDef>): MetricDef => ({
    ...real.METRICS.get('pts')!,
    id,
    label: id,
    short: id,
    firstSeason: 2025,
    published: 'published_test_widgets',
    ...o
  })
  const extra = [
    def('widgets', { value: '{widgets}', sample: 'games', aggregation: 'sum' }),
    def('widget_pct', {
      value: '{widgets} / nullif({widget_tries}, 0)',
      sample: 'widget_tries',
      aggregation: 'ratio',
      unit: 'pct',
      minSample: 82
    }),
    def('rating', {
      value: '{rating}',
      sample: 'rating',
      aggregation: 'sum',
      published: 'published_test_bare'
    }),
    def('team_widgets', {
      value: '{widgets}',
      sample: 'games',
      aggregation: 'sum',
      entity: 'team',
      published: 'published_test_team_widgets'
    }),
    def('widget_state', {
      value: '{widgets} / nullif({games}, 0)',
      sample: 'games',
      aggregation: 'ratio',
      oneSeason: true
    }),
    def('broken', { value: '{nope}', sample: 'games' })
  ]
  return {
    ...real,
    CATALOGUE: [...real.CATALOGUE, ...extra],
    METRICS: new Map([...real.METRICS, ...extra.map((m): [string, MetricDef] => [m.id, m])])
  }
})

const CTX = { currentSeason: 2027 }
let db: StatsDb

const run = (q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }): Promise<StatsResult> =>
  runQuery(db, { entity: 'player', metrics: ['widgets'], ...q }, CTX)

const row = (r: StatsResult, id: string, season?: number): StatsRow =>
  r.rows.find((x) => x.id === id && (season === undefined || x.group.season === season))!

const WHOLE = 'Published for whole seasons only.'

/**
 * Player 1 is traded from Boston to Miami in 2026, and the source tracked only 3 of their 4 games.
 * Player 2 stays in Los Angeles. Player 3 is a Boston center the source did not track at all.
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
  await db.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'G'), (3, 2026, 'C'),
    (1, 2025, 'G'), (2, 2025, 'F')`)
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
  await addGame(db, {
    id: 'po',
    date: '2026-04-20',
    home: MIA,
    away: LAL,
    scores: [100, 90],
    type: 'playoffs'
  })
  await addGame(db, {
    id: 'pi',
    date: '2026-04-15',
    home: MIA,
    away: LAL,
    scores: [100, 90],
    type: 'play-in'
  })
  await addNbaLine(db, 'a', 1, BOS, { position: 'G' })
  await addNbaLine(db, 'b', 1, BOS, { position: 'G' })
  await addNbaLine(db, 'c', 1, MIA, { position: 'G' })
  await addNbaLine(db, 'd', 1, MIA, { position: 'G' })
  await addNbaLine(db, 'po', 1, MIA, { position: 'G' })
  await addNbaLine(db, 'pi', 1, MIA, { position: 'G' })
  await addNbaLine(db, 'old', 1, BOS, { position: 'G', season: 2025 })
  await addNbaLine(db, 'a', 2, LAL, { position: 'G' })
  await addNbaLine(db, 'c', 2, LAL, { position: 'G' })
  await addNbaLine(db, 'old', 2, LAL, { position: 'F', season: 2025 })
  await addNbaLine(db, 'a', 3, BOS)
  await buildDerived(db)

  await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER, season_type VARCHAR,
    per_mode VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT, widget_tries BIGINT)`)
  await db.exec(`INSERT INTO src_test_widgets VALUES
    (1, 2026, 'Regular Season', 'Totals', 3, 90, 30, 60),
    (1, 2026, 'Regular Season', 'PerGame', 3, 30, 10, 20),
    (1, 2026, 'Playoffs', 'Totals', 1, 40, 5, 10),
    (1, 2025, 'Regular Season', 'Totals', 1, 30, 7, 14),
    (2, 2026, 'regular-season', 'totals', 2, 60, 0, 40),
    (2, 2025, 'Regular Season', 'Totals', 1, 30, 9, 9),
    (1, 2024, 'Regular Season', 'Totals', 50, 1500, 0, 0)`)
  await db.exec(`CREATE TABLE src_test_team_widgets (team_id BIGINT, season INTEGER,
    season_type VARCHAR, per_mode VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
  await db.exec(`INSERT INTO src_test_team_widgets VALUES
    (${BOS}, 2026, 'Regular Season', 'Totals', 2, 96, 48)`)
  await db.exec(`CREATE TABLE src_test_bare (player_id BIGINT, season INTEGER, season_type VARCHAR,
    rating DOUBLE)`)
  await db.exec(`INSERT INTO src_test_bare VALUES (1, 2026, 'Regular Season', 2.5)`)
  await buildPublished(db)
})

describe('a published metric', () => {
  it('has only the season grain, and none when its table lacks a component', () => {
    expect(grainsOf(METRICS.get('widgets')!)).toEqual(['season'])
    expect(grainsOf(METRICS.get('broken')!)).toEqual([])
    expect(() =>
      compileQuery({ entity: 'player', metrics: ['broken'], scope: { seasons: [2026] } }, CTX)
    ).toThrow(StatsQueryError)
  })

  it('reads a whole season, a traded player once', async () => {
    const r = await run({ scope: { seasons: [2026] } })
    expect(r.grain).toBe('season')
    expect(r.columns[0]).toMatchObject({ reason: null, seasons: [2026] })
    expect(row(r, '1').values.widgets.value).toBe(30)
    expect(row(r, '2').values.widgets.value).toBe(0)
  })

  it('reads the official games and name from the box scores, and null for a player not tracked', async () => {
    const r = await run({ scope: { seasons: [2026] } })
    expect(row(r, '1')).toMatchObject({ name: 'Ana Traded', team: 'MIA', games: 4 })
    expect(row(r, '3').values.widgets).toMatchObject({ value: null, qualified: false, rank: null })
  })

  it('stands beside box-score metrics without multiplying them', async () => {
    const r = await run({ metrics: ['widgets', 'gp'], scope: { seasons: [2025, 2026] } })
    expect(row(r, '1').values.widgets.value).toBe(37)
    expect(row(r, '1').values.gp.value).toBe(5)
  })

  it('adds seasons together, and keeps them apart when grouped', async () => {
    const together = await run({ metrics: ['widget_pct'], scope: { seasons: [2025, 2026] } })
    // A rate over the summed parts, not an average of rates: 9 of 49, from 9 of 9 and 0 of 40.
    expect(row(together, '2').values.widget_pct.value).toBeCloseTo(9 / 49, 6)
    const apart = await run({ scope: { seasons: [2025, 2026] }, groupBy: ['season'] })
    expect(row(apart, '1', 2025).values.widgets.value).toBe(7)
    expect(row(apart, '1', 2026).values.widgets.value).toBe(30)
  })

  it('adds the regular season and playoffs when asked', async () => {
    const r = await run({ scope: { seasons: [2026], gameTypes: ['regular', 'playoffs'] } })
    expect(row(r, '1').values.widgets.value).toBe(35)
  })

  it('reads only the totals, whatever spelling the source uses', async () => {
    const rows = await db.all<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ${WIDGET_TABLE} WHERE season = 2026`
    )
    expect(rows[0].n).toBe(3)
  })

  it('leaves out rows before the first season with real values', async () => {
    const row2024 = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ${WIDGET_TABLE} WHERE season = 2024`
    )
    expect(row2024?.n).toBe(0)
  })
})

describe('its rates', () => {
  it('divide a total by the tracked games, not the official ones', async () => {
    const r = await run({ scope: { seasons: [2026] }, transform: 'perGame' })
    // 30 over the 3 games tracked, though the player played 4.
    expect(row(r, '1').values.widgets.value).toBe(10)
    expect(row(r, '1').games).toBe(4)
  })

  it('scale per 36 and per 48 by the tracked minutes', async () => {
    // 30 in the 90 minutes tracked; the box scores hold 120.
    const per36 = await run({ scope: { seasons: [2026] }, transform: 'per36' })
    expect(row(per36, '1').values.widgets.value).toBeCloseTo((36 * 30) / 90, 6)
    const per48 = await run({ scope: { seasons: [2026] }, transform: 'per48' })
    expect(row(per48, '1').values.widgets.value).toBeCloseTo((48 * 30) / 90, 6)
  })

  it('scale a team by its published minutes, which are elapsed', async () => {
    const r = await run({
      entity: 'team',
      metrics: ['team_widgets'],
      scope: { seasons: [2026] },
      transform: 'per48'
    })
    // 48 in two 48-minute games.
    expect(row(r, String(BOS)).values.team_widgets.value).toBeCloseTo(24, 6)
  })

  it('divide by tracked tries, and qualify on them', async () => {
    const r = await run({ metrics: ['widget_pct'], scope: { seasons: [2026] } })
    expect(row(r, '1').values.widget_pct.value).toBeCloseTo(0.5, 6)
    expect(row(r, '1').values.widget_pct.sample).toBe(60)
    // A minimum of 82 over 82 games is about 4 over the 4 games here.
    expect(row(r, '1').values.widget_pct.qualified).toBe(true)
    expect(row(r, '3').values.widget_pct.qualified).toBe(false)
  })

  it('answer null with a reason when the source publishes no divisor', async () => {
    const q = { metrics: ['rating'], scope: { seasons: [2026] } }
    const per = async (transform: 'perGame' | 'per36' | 'per100' | 'raw'): Promise<StatsResult> =>
      run({ ...q, transform })
    expect((await per('perGame')).columns[0].reason).toBe('Published without games played.')
    expect(row(await per('per36'), '1').values.rating.value).toBeNull()
    expect((await per('per36')).columns[0].reason).toBe('Published without minutes.')
    expect((await per('per100')).columns[0].reason).toBe('Published without possessions.')
    expect(row(await per('raw'), '1').values.rating.value).toBe(2.5)
    expect((await per('raw')).columns[0].reason).toBeNull()
  })
})

describe('under a filter that splits a season', () => {
  const SPLITS: StatsQuery['scope'][] = [
    { seasons: [2026], dates: ['2026-01-01', '2026-02-01'] },
    { seasons: [2026], lastN: 2 },
    { seasons: [2026], home: true },
    { seasons: [2026], months: [1] },
    { seasons: [2026], opponents: [String(LAL)] },
    { seasons: [2026], result: 'win' },
    { seasons: [2026], games: ['a'] }
  ]

  it('answers null with the reason, never an error', async () => {
    for (const scope of SPLITS) {
      const r = await run({ scope })
      expect(r.grain, JSON.stringify(scope)).toBe('game')
      expect(r.columns[0], JSON.stringify(scope)).toMatchObject({ reason: WHOLE, seasons: [] })
      expect(r.rows.length, JSON.stringify(scope)).toBeGreaterThan(0)
      for (const x of r.rows) {
        expect(x.values.widgets).toMatchObject({ value: null, qualified: false, percentile: null })
      }
    }
  })

  it('answers the same for a group by month', async () => {
    const r = await run({ scope: { seasons: [2026] }, groupBy: ['month'] })
    expect(r.columns[0].reason).toBe(WHOLE)
  })

  it('states it in the notes', async () => {
    const r = await run({ scope: SPLITS[0] })
    expect(r.notes).toContain('widgets: published for whole seasons only.')
  })

  it('leaves the box-score metrics beside it answering', async () => {
    const r = await run({ metrics: ['widgets', 'gp'], scope: SPLITS[0] })
    expect(row(r, '1').values.gp.value).toBe(2)
    expect(row(r, '1').values.widgets.value).toBeNull()
    expect(r.columns.map((c) => c.reason)).toEqual([WHOLE, null])
  })

  it('still lists the rows when sorted on it and asked for the qualified only', async () => {
    const r = await run({ scope: { ...SPLITS[0], qualifiedOnly: true } })
    expect(r.rows.map((x) => x.id)).toContain('1')
    expect(r.total).toBeGreaterThan(0)
  })

  it('says a season outside its coverage first, which no filter would answer', async () => {
    const r = await run({ scope: { seasons: [2020], dates: ['2020-01-01', '2020-02-01'] } })
    expect(r.columns[0].reason).toBe('Recorded from 2024-25.')
  })
})

describe('a value that is one season’s state', () => {
  const state = (
    scope: StatsQuery['scope'],
    groupBy?: StatsQuery['groupBy']
  ): Promise<StatsResult> => run({ metrics: ['widget_state'], scope, groupBy })

  it('reads one regular season as published', async () => {
    const r = await state({ seasons: [2026] })
    expect(r.columns[0].reason).toBeNull()
    expect(row(r, '1').values.widget_state.value).toBe(10)
  })

  it('answers null with a reason over several seasons, since an average would mean nothing', async () => {
    const r = await state({ seasons: [2025, 2026] })
    expect(r.columns[0].reason).toBe('Published for one season at a time.')
    expect(row(r, '1').values.widget_state.value).toBeNull()
  })

  it('answers each season when grouped by season', async () => {
    const r = await state({ seasons: [2025, 2026] }, ['season'])
    expect(r.columns[0].reason).toBeNull()
    expect(row(r, '1', 2025).values.widget_state.value).toBe(7)
    expect(row(r, '1', 2026).values.widget_state.value).toBe(10)
  })

  it('answers null with a reason in the playoffs alone', async () => {
    const r = await state({ seasons: [2026], gameTypes: ['playoffs'] })
    expect(r.columns[0].reason).toBe('Published for the regular season only.')
    expect(row(r, '1').values.widget_state.value).toBeNull()
  })
})

describe('the scope of a whole season', () => {
  it('answers null with a reason for a type that is not published', async () => {
    const r = await run({ scope: { seasons: [2026], gameTypes: ['play-in'] } })
    expect(r.columns[0].reason).toBe('Published for the regular season and playoffs only.')
    expect(row(r, '1').values.widgets.value).toBeNull()
  })

  it('states a type left out of a mix', async () => {
    const r = await run({ scope: { seasons: [2026], gameTypes: ['regular', 'play-in'] } })
    expect(r.columns[0].reason).toBeNull()
    expect(row(r, '1').values.widgets.value).toBe(30)
    expect(r.notes).toContain('widgets: published for the regular season and playoffs only.')
  })

  it('reads a player who stayed on the team a filter names', async () => {
    const r = await run({ scope: { seasons: [2026], teams: [String(LAL)] } })
    expect(row(r, '2').values.widgets.value).toBe(0)
  })

  it('leaves a traded player blank for one team, since their row is the whole season', async () => {
    const r = await run({ scope: { seasons: [2026], teams: [String(BOS)] } })
    expect(row(r, '1').values.widgets.value).toBeNull()
    expect(r.notes.join()).toContain('whole season')
    expect(r.columns[0].reason).toBeNull()
  })

  it('reads a traded player when every team they played for is named', async () => {
    const r = await run({ scope: { seasons: [2026], teams: [String(BOS), String(MIA)] } })
    expect(row(r, '1').values.widgets.value).toBe(30)
  })

  it('counts only the seasons a position filter leaves in', async () => {
    // Player 2 was a forward in 2025 and a guard in 2026.
    const r = await run({ scope: { seasons: [2025, 2026], positions: ['F'] } })
    expect(row(r, '2').values.widgets.value).toBe(9)
  })

  it('ranks among the players tracked', async () => {
    const r = await run({ scope: { seasons: [2026] } })
    expect(row(r, '1').values.widgets).toMatchObject({ rank: 1, percentile: 100 })
    expect(row(r, '2').values.widgets).toMatchObject({ rank: 2, percentile: 0 })
    // Alone among centers, and not tracked.
    expect(row(r, '3').values.widgets.rank).toBeNull()
  })
})

describe('a table with no source yet', () => {
  it('reads as null, not a failure, before the published tier has arrived', async () => {
    const empty = await openTestDb()
    await emptySources(empty)
    await empty.exec(
      `INSERT INTO team VALUES (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic')`
    )
    await empty.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
    await empty.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G')`)
    await addGame(empty, { id: 'a', date: '2025-11-01', home: BOS, away: LAL, scores: [100, 90] })
    await addNbaLine(empty, 'a', 1, BOS, { position: 'G' })
    await buildDerived(empty)
    const r = await runQuery(
      empty,
      { entity: 'player', metrics: ['widgets'], scope: { seasons: [2026] } },
      CTX
    )
    expect(r.rows[0].values.widgets.value).toBeNull()
  })
})
