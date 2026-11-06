import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { StatsQueryError } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import type { StatsQuery, StatsResult, StatsRow } from '@shared/stats/types'
import {
  addGame,
  addNbaLine,
  addNbaTeam,
  BOS,
  emptySources,
  LAL,
  LINE,
  MIA,
  type Stats
} from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const CTX = { currentSeason: 2027 }

/** A line that only scores: `pts` points on `pts` free throws, so sums read at a glance. */
const scoring = (pts: number): Stats => [0, 0, 0, 0, pts, pts, 0, 0, 0, 0, 0, 0, 0, pts]

let db: StatsDb

const run = (q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }): Promise<StatsResult> =>
  runQuery(db, { entity: 'player', metrics: ['pts'], ...q }, CTX)

const value = (result: StatsResult, id: string, metric = 'pts'): number | null | undefined =>
  result.rows.find((r) => r.id === id)?.values[metric]?.value

const ids = (result: StatsResult): string[] => result.rows.map((r) => r.id)

/**
 * Two seasons. Player 1 is traded from Boston to Miami in the second. Player 2 stays in Los Angeles
 * and sits out one game. Player 3 is a Boston center who starts only their first game.
 */
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2025, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2025, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2025, ${MIA}, 14, 'MIA', 'Miami Heat', 'east', 'southeast'),
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2026, ${MIA}, 14, 'MIA', 'Miami Heat', 'east', 'southeast')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Traded'), (2, 'Bea Laker'), (3, 'Cal Center')`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES
    (1, 2026, 'G'), (2, 2026, 'G-F'), (3, 2026, 'C-F'), (1, 2025, 'G'), (2, 2025, 'G')`)
  const game = (
    id: string,
    date: string,
    home: number,
    away: number,
    scores: [number, number],
    season = 2026
  ): Promise<void> => addGame(db, { id, date, home, away, scores, season })
  await game('a', '2025-11-01', BOS, LAL, [100, 90])
  await game('b', '2026-01-05', LAL, BOS, [100, 90])
  await game('c', '2026-01-06', MIA, LAL, [80, 90])
  await game('d', '2026-03-01', LAL, MIA, [100, 110])
  await game('old', '2025-01-10', BOS, LAL, [100, 90], 2025)
  await addGame(db, {
    id: 'po',
    date: '2026-04-20',
    home: MIA,
    away: LAL,
    scores: [100, 90],
    type: 'playoffs'
  })
  await addGame(db, { id: 'asg', date: '2026-02-15', home: 91, away: 92, type: 'all-star' })

  await addNbaLine(db, 'a', 1, BOS, { stats: scoring(10), position: 'G' })
  await addNbaLine(db, 'b', 1, BOS, { stats: scoring(20), position: 'G' })
  await addNbaLine(db, 'c', 1, MIA, { stats: scoring(30), position: 'G' })
  await addNbaLine(db, 'd', 1, MIA, { stats: scoring(40), position: 'G' })
  await addNbaLine(db, 'old', 1, BOS, { stats: scoring(7), season: 2025, position: 'G' })
  await addNbaLine(db, 'po', 1, MIA, { stats: scoring(50), position: 'G' })

  await addNbaLine(db, 'a', 2, LAL, { stats: scoring(11), position: 'G' })
  await addNbaLine(db, 'c', 2, LAL, { stats: scoring(13), position: 'G', minutes: '12:00' })
  await addNbaLine(db, 'd', 2, LAL, { stats: scoring(17), position: 'G', minutes: '24:00' })

  await addNbaLine(db, 'a', 3, BOS, { stats: scoring(5) })
  await addNbaLine(db, 'b', 3, BOS, { stats: scoring(6) })
  await addNbaTeam(db, 'a', BOS, scoring(100))
  await addNbaTeam(db, 'a', LAL, scoring(90))
  await buildDerived(db)
})

describe('a season', () => {
  it('reads a traded player once, with the whole season and the latest team', async () => {
    const r = await run({ scope: { seasons: [2026] } })
    expect(r.grain).toBe('season')
    expect(value(r, '1')).toBe(100)
    expect(r.rows.find((x) => x.id === '1')).toMatchObject({
      name: 'Ana Traded',
      team: 'MIA',
      position: 'G',
      games: 4
    })
  })

  it('reads the team a filter names, and only those games', async () => {
    const r = await run({ scope: { seasons: [2026], teams: [String(BOS)] } })
    expect(value(r, '1')).toBe(30)
    expect(r.rows.find((x) => x.id === '1')).toMatchObject({ team: 'BOS', games: 2 })
    expect(ids(r).sort()).toEqual(['1', '3'])
  })

  it('leaves the playoffs and the All-Star Game out unless asked', async () => {
    const po = await run({ scope: { seasons: [2026], gameTypes: ['playoffs'] } })
    expect(value(po, '1')).toBe(50)
    const both = await run({ scope: { seasons: [2026], gameTypes: ['regular', 'playoffs'] } })
    expect(value(both, '1')).toBe(150)
    expect(both.rows.find((x) => x.id === '1')?.games).toBe(5)
  })

  it('adds seasons together when asked, and keeps them apart when grouped', async () => {
    const together = await run({ scope: { seasons: [2025, 2026] } })
    expect(value(together, '1')).toBe(107)
    const apart = await run({ scope: { seasons: [2025, 2026] }, groupBy: ['season'] })
    const rows = apart.rows.filter((x) => x.id === '1')
    expect(rows.map((x) => [x.group.season, x.values.pts.value]).sort()).toEqual([
      [2025, 7],
      [2026, 100]
    ])
  })
})

describe('totals against rates', () => {
  it('divides a sum per game, and leaves a ratio alone', async () => {
    const r = await run({
      metrics: ['pts', 'ft_pct', 'w'],
      scope: { seasons: [2026] },
      transform: 'perGame'
    })
    expect(value(r, '1', 'pts')).toBe(25)
    expect(value(r, '1', 'ft_pct')).toBe(1)
    // A record stays a total.
    expect(value(r, '1', 'w')).toBe(2)
    expect(r.rows.find((x) => x.id === '1')?.values.pts.raw).toBe(25)
  })

  it('scales a sum per 36 and per 48 minutes', async () => {
    const q = { metrics: ['pts'], scope: { seasons: [2026], players: ['2'] } }
    // 41 points in 30 + 12 + 24 = 66 minutes.
    expect(value(await run({ ...q, transform: 'per36' }), '2')).toBeCloseTo((36 * 41) / 66, 6)
    expect(value(await run({ ...q, transform: 'per48' }), '2')).toBeCloseTo((48 * 41) / 66, 6)
  })

  it('scales a team by its elapsed minutes, not its players’', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_fta'],
        scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-01'] },
        transform: 'per48'
      },
      CTX
    )
    // 100 free-throw attempts in one 48-minute game.
    expect(value(r, String(BOS), 'team_fta')).toBeCloseTo(100, 6)
  })

  it('reads a team’s per-game count over its box scores, not its whole record', async () => {
    // A game with only a score, as a few are before 1996-97.
    await addGame(db, { id: 'e', date: '2026-03-05', home: BOS, away: MIA, scores: [110, 100] })
    await buildDerived(db)
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_fta', 'team_pts'],
        scope: { seasons: [2026] },
        transform: 'perGame'
      },
      CTX
    )
    const bos = r.rows.find((x) => x.id === String(BOS))!
    // Two of Boston's three games have a box score; points come from the score in all three.
    expect(bos.values.team_fta.value).toBe((100 + 26) / 2)
    expect(bos.values.team_pts.value).toBeCloseTo((100 + 90 + 110) / 3, 6)
    expect(bos.games).toBe(3)
  })

  it('scales a sum per 100 estimated possessions', async () => {
    const r = await run({
      scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-01'], players: ['1'] },
      transform: 'per100'
    })
    // Each side has 100 and 90 free-throw attempts, so 44 and 39.6 possessions: 41.8 on average.
    // The player's 30 minutes of the side's 240 are a share of 5 × 30 / 240.
    const onPoss = ((5 * 30) / 240) * 41.8
    expect(value(r, '1')).toBeCloseTo((100 * 10) / onPoss, 6)
    expect(r.notes.join()).toContain('estimated possessions')
  })
})

describe('splits', () => {
  it('reads a date range, both ends in', async () => {
    const r = await run({ scope: { seasons: [2026], dates: ['2026-01-05', '2026-01-06'] } })
    expect(r.grain).toBe('game')
    expect(value(r, '1')).toBe(50)
    expect(value(r, '2')).toBe(13)
  })

  it('reads the last N of a player’s own appearances', async () => {
    const r = await run({ scope: { seasons: [2026], lastN: 2 } })
    expect(value(r, '1')).toBe(70)
    expect(value(r, '2')).toBe(30)
    expect(value(r, '3')).toBe(11)
  })

  it('reads a player’s part in their team’s last N games, which they may have missed', async () => {
    const r = await run({ scope: { seasons: [2026], lastN: 1, lastNOf: 'team' } })
    // Boston's last is `b`, which both its players played. Miami's is `d`.
    expect(value(r, '1')).toBe(60)
    expect(value(r, '3')).toBe(6)
    // Los Angeles's last is `d`.
    expect(value(r, '2')).toBe(17)
  })

  it('reads home and road', async () => {
    expect(value(await run({ scope: { seasons: [2026], home: true } }), '1')).toBe(40)
    expect(value(await run({ scope: { seasons: [2026], home: false } }), '1')).toBe(60)
  })

  it('reads an opponent, its conference and its division', async () => {
    const s = { seasons: [2026] }
    expect(value(await run({ scope: { ...s, opponents: [String(LAL)] } }), '1')).toBe(100)
    expect(value(await run({ scope: { ...s, opponents: [String(MIA)] } }), '2')).toBe(30)
    expect(value(await run({ scope: { ...s, conferences: ['east'] } }), '2')).toBe(41)
    expect(value(await run({ scope: { ...s, conferences: ['west'] } }), '1')).toBe(100)
    expect(value(await run({ scope: { ...s, divisions: ['southeast'] } }), '2')).toBe(30)
    expect(value(await run({ scope: { ...s, divisions: ['atlantic'] } }), '2')).toBe(11)
  })

  it('reads a month', async () => {
    const r = await run({ scope: { seasons: [2026], months: [1] } })
    expect(value(r, '1')).toBe(50)
    const two = await run({ scope: { seasons: [2026], months: [3, 11] } })
    expect(value(two, '1')).toBe(50)
  })

  it('reads before and after the All-Star Game', async () => {
    const before = await run({ scope: { seasons: [2026], allStarBreak: 'before' } })
    expect(value(before, '1')).toBe(60)
    const after = await run({ scope: { seasons: [2026], allStarBreak: 'after' } })
    expect(value(after, '1')).toBe(40)
    expect(after.notes.join()).toContain('All-Star')
  })

  it('reads rest days: 0 is a back-to-back', async () => {
    const r = await run({ scope: { seasons: [2026], restDays: [0, 0] } })
    // Los Angeles played on January 5 and 6.
    expect(value(r, '2')).toBe(13)
    expect(ids(r)).not.toContain('3')
  })

  it('reads wins and losses', async () => {
    expect(value(await run({ scope: { seasons: [2026], result: 'win' } }), '1')).toBe(50)
    expect(value(await run({ scope: { seasons: [2026], result: 'loss' } }), '1')).toBe(50)
  })

  it('reads starter or bench, and neither when it is unknown', async () => {
    // No game here has five flagged starters, so who started is unknown in all of them.
    expect((await run({ scope: { seasons: [2026], starter: false } })).rows).toEqual([])
    expect((await run({ scope: { seasons: [2026], starter: true } })).rows).toEqual([])
    await db.exec('UPDATE player_game SET starter = (player_id = 3)')
    expect(value(await run({ scope: { seasons: [2026], starter: true } }), '3')).toBe(11)
    expect(value(await run({ scope: { seasons: [2026], starter: false } }), '1')).toBe(100)
  })

  it('groups by team, opponent, month and game', async () => {
    const pair = (r: StatsResult, g: 'team' | 'opponent' | 'month' | 'game'): unknown[][] =>
      r.rows
        .filter((x) => x.id === '1')
        .map((x) => [x.group[g], x.values.pts.value])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    const s = { seasons: [2026] }
    expect(pair(await run({ scope: s, groupBy: ['team'] }), 'team')).toEqual([
      [BOS, 30],
      [MIA, 70]
    ])
    expect(pair(await run({ scope: s, groupBy: ['opponent'] }), 'opponent')).toEqual([[LAL, 100]])
    expect(pair(await run({ scope: s, groupBy: ['month'] }), 'month')).toEqual([
      [1, 50],
      [11, 10],
      [3, 40]
    ])
    expect(pair(await run({ scope: s, groupBy: ['game'] }), 'game')).toEqual([
      ['a', 10],
      ['b', 20],
      ['c', 30],
      ['d', 40]
    ])
  })
})

describe('ranks and qualification', () => {
  const row = (r: StatsResult, id: string): StatsRow => r.rows.find((x) => x.id === id)!

  it('ranks within a position group, hybrids mapped', async () => {
    const r = await run({ scope: { seasons: [2026] } })
    expect(row(r, '2').position).toBe('G')
    expect(row(r, '3').position).toBe('C')
    expect(row(r, '1').values.pts).toMatchObject({ rank: 1, percentile: 100 })
    expect(row(r, '2').values.pts).toMatchObject({ rank: 2, percentile: 0 })
    // Alone among centers.
    expect(row(r, '3').values.pts.rank).toBe(1)
  })

  it('filters by position group', async () => {
    const r = await run({ scope: { seasons: [2026], positions: ['C'] } })
    expect(ids(r)).toEqual(['3'])
  })

  it('scales a minimum to the team games in scope, so a short season qualifies fairly', async () => {
    // 500 attempts over 82 games is about 18 over the 3 games a team played here.
    const r = await run({ metrics: ['fg_pct', 'pts'], scope: { seasons: [2026] } })
    // Nobody here shot a field goal, so nobody has the sample.
    expect(row(r, '1').values.fg_pct).toMatchObject({ qualified: false, value: null, rank: null })
    expect(row(r, '1').values.pts.qualified).toBe(true)

    const minutes = await run({ metrics: ['min'], scope: { seasons: [2026] } })
    // 1,000 minutes over 82 games is 36.6 over 3. Player 2 has 66, player 3 has 60.
    expect(row(minutes, '2').values.min.qualified).toBe(true)
    await db.exec(`UPDATE player_season SET minutes = 30 WHERE player_id = 3`)
    const fewer = await run({ metrics: ['min'], scope: { seasons: [2026] } })
    expect(row(fewer, '3').values.min.qualified).toBe(false)
  })

  it('keeps only qualified rows when asked', async () => {
    await db.exec(`UPDATE player_season SET minutes = 30 WHERE player_id = 3`)
    const r = await run({ metrics: ['min'], scope: { seasons: [2026], qualifiedOnly: true } })
    expect(ids(r)).not.toContain('3')
    expect(r.total).toBe(2)
  })

  it('sorts best first by direction, and as asked', async () => {
    const pf = await run({ metrics: ['tov'], scope: { seasons: [2026] } })
    // Lower is better for turnovers: all zero here, then by name.
    expect(ids(pf)).toEqual(['1', '2', '3'])
    const asc = await run({ scope: { seasons: [2026] }, sort: { metric: 'pts', dir: 'asc' } })
    expect(ids(asc)).toEqual(['3', '2', '1'])
  })

  it('caps the rows but counts them all', async () => {
    const r = await run({ scope: { seasons: [2026] }, limit: 1 })
    expect(r.rows).toHaveLength(1)
    expect(r.total).toBe(3)
  })

  it('reads a percentile transform, and one against the league', async () => {
    const pct = await run({ scope: { seasons: [2026] }, transform: 'percentile' })
    expect(row(pct, '1').values.pts.value).toBe(100)
    const vs = await run({
      scope: { seasons: [2026], positions: ['G'] },
      transform: 'vsLeague'
    })
    // The guards' mean of 100 and 41.
    expect(row(vs, '1').values.pts.value).toBeCloseTo(29.5, 6)
  })
})

describe('coverage', () => {
  it('answers null with a reason outside a stat’s seasons, never an error', async () => {
    const r = await run({ metrics: ['plus_minus'], scope: { seasons: [1996] } })
    expect(r.columns[0]).toMatchObject({ seasons: [], reason: 'Recorded from 1996-97.' })
    expect(r.notes).toEqual(['Plus-minus: starts in 1996-97.'])
  })

  it('says when the source skips a season', async () => {
    const r = await runQuery(
      db,
      { entity: 'team', metrics: ['team_paint_pts'], scope: { seasons: [2018] } },
      CTX
    )
    expect(r.columns[0]).toMatchObject({ seasons: [], reason: 'Not in the source for 2017-18.' })
  })

  it('reads a null, not a zero, where a metric has no season in scope', async () => {
    await db.exec('UPDATE player_season SET plus_minus = 99')
    const r = await run({ metrics: ['plus_minus'], scope: { seasons: [2026] } })
    expect(value(r, '1', 'plus_minus')).toBe(99)
    await addGame(db, { id: 'x', season: 1996, date: '1996-01-10' })
    await addNbaLine(db, 'x', 1, BOS, { stats: LINE, season: 1996 })
    await buildDerived(db)
    await db.exec('UPDATE player_season SET plus_minus = 99')
    const old = await run({ metrics: ['plus_minus'], scope: { seasons: [1996] } })
    expect(value(old, '1', 'plus_minus')).toBeNull()
  })

  it('counts a season with no games as no rows', async () => {
    const r = await run({ scope: { seasons: [2020] } })
    expect(r.rows).toEqual([])
    expect(r.total).toBe(0)
  })
})

describe('teams', () => {
  it('names a team by the latest season in scope, and always qualifies it', async () => {
    const r = await runQuery(
      db,
      { entity: 'team', metrics: ['team_w', 'team_win_pct'], scope: { seasons: [2025, 2026] } },
      CTX
    )
    const bos = r.rows.find((x) => x.id === String(BOS))!
    expect(bos).toMatchObject({ name: 'Boston Celtics', team: 'BOS', position: null })
    expect(bos.values.team_w).toMatchObject({ value: 2, qualified: true })
    expect(bos.values.team_win_pct.value).toBeCloseTo(2 / 3, 6)
  })

  it('reads the opponent’s side of the same games', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_fta', 'opp_fta', 'opp_pts'],
        scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-01'] }
      },
      CTX
    )
    expect(r.rows.find((x) => x.id === String(BOS))?.values).toMatchObject({
      team_fta: { value: 100 },
      opp_fta: { value: 90 },
      opp_pts: { value: 90 }
    })
  })
})

describe('a query that takes too long', () => {
  it('is interrupted and reported', async () => {
    // A statement that only ends when it is interrupted, as DuckDB's does.
    let stop = (): void => {}
    const stuck = new Promise((_, reject) => {
      stop = () => reject(new Error('INTERRUPT'))
    })
    const slow = {
      get: () => stuck,
      all: () => stuck,
      interrupt: () => stop()
    } as unknown as StatsDb
    const query: StatsQuery = { entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } }
    const answer = runQuery(slow, query, CTX, 1)
    await expect(answer).rejects.toThrow(StatsQueryError)
    await expect(answer).rejects.toThrow('the query took longer than')
  })
})
