import { beforeAll, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { readFileSchema, runQuery } from '@main/stats/engine/run'
import { bootstrapStatsDb } from '@main/stats/schema'
import { LEAGUES } from '@shared/leagues'
import type { StatsQuery, StatsResult } from '@shared/stats/types'
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

/**
 * Shooting against the league and the shares over a team's games (T1703.3), through the engine. Every
 * expected value is worked from the lines written here, not from the engine.
 *
 * Boston plays four games (a, b, d and the 2024-25 one), Los Angeles two of the season, Miami one.
 * Player 5 plays one game for Boston and one for Los Angeles.
 */
interface Line {
  game: string
  player: number
  team: number
  season: number
  minutes: number
  s: Stats
}

// FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PTS.
const line = (
  game: string,
  player: number,
  team: number,
  fgm: number,
  fga: number,
  fg3m: number,
  ftm: number,
  fta: number,
  ast = 0,
  minutes = 30
): Line => ({
  game,
  player,
  team,
  season: game === 'old' ? 2025 : 2026,
  minutes,
  s: [fgm, fga, fg3m, fg3m + 2, ftm, fta, 0, 0, ast, 0, 0, 2, 1, 2 * fgm + fg3m + ftm]
})

const LINES: Line[] = [
  line('a', 1, BOS, 9, 16, 3, 5, 6, 4),
  line('a', 2, BOS, 4, 13, 0, 2, 4, 2, 24),
  line('a', 5, BOS, 3, 5, 1, 0, 0, 1, 12),
  line('a', 3, LAL, 7, 15, 2, 4, 4, 6),
  line('a', 4, LAL, 5, 14, 1, 0, 2, 1),
  line('b', 1, BOS, 6, 18, 1, 8, 8, 5),
  line('b', 2, BOS, 8, 10, 2, 3, 4, 2),
  line('b', 3, LAL, 10, 17, 4, 2, 2, 3),
  line('b', 5, LAL, 2, 9, 0, 1, 3, 1, 18),
  line('d', 1, BOS, 5, 11, 0, 6, 9, 3),
  line('d', 6, MIA, 8, 16, 2, 3, 3, 5),
  line('old', 1, BOS, 2, 10, 0, 1, 2, 0),
  line('old', 3, LAL, 6, 12, 1, 1, 1, 0)
]

const CTX = { league: LEAGUES.nba, currentSeason: 2027 }
let db: StatsDb

const pts = (l: Line): number => l.s[13]
const tsa = (l: Line): number => l.s[1] + 0.44 * l.s[5]
const efgNum = (l: Line): number => l.s[0] + 0.5 * l.s[2]
const sum = (ls: Line[], f: (l: Line) => number): number => ls.reduce((x, l) => x + f(l), 0)
const ts = (ls: Line[]): number => sum(ls, pts) / (2 * sum(ls, tsa))
const efg = (ls: Line[]): number => sum(ls, efgNum) / sum(ls, (l) => l.s[1])
const season = (s: number, keep: (l: Line) => boolean = () => true): Line[] =>
  LINES.filter((l) => l.season === s && keep(l))
const of = (player: number, s = 2026, keep: (l: Line) => boolean = () => true): Line[] =>
  season(s, (l) => l.player === player && keep(l))

const ask = (q: Partial<StatsQuery>): Promise<StatsResult> =>
  runQuery(
    db,
    {
      entity: 'player',
      metrics: ['pts'],
      scope: { seasons: [2026] },
      limit: 50,
      ...q
    } as StatsQuery,
    CTX
  )
const read = (r: StatsResult, id: number | string, m: string): number | null | undefined =>
  r.rows.find((x) => x.id === String(id))?.values[m]?.value

beforeAll(async () => {
  db = await openTestDb()
  await emptySources(db)
  for (const s of [2025, 2026]) {
    await db.exec(`INSERT INTO team VALUES
      (${s}, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
      (${s}, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
      (${s}, ${MIA}, 14, 'MIA', 'Miami Heat', 'east', 'southeast')`)
  }
  await db.exec('CREATE TABLE player (player_id BIGINT, name VARCHAR)')
  const games: [string, string, number, number, number][] = [
    ['a', '2025-11-01', BOS, LAL, 2026],
    ['b', '2026-01-05', LAL, BOS, 2026],
    ['d', '2026-03-01', BOS, MIA, 2026],
    ['old', '2025-01-10', BOS, LAL, 2025]
  ]
  for (const [id, date, home, away, s] of games) {
    await addGame(db, { id, date, home, away, scores: [100, 90], season: s })
    for (const team of [home, away]) {
      const ls = LINES.filter((l) => l.game === id && l.team === team)
      const total = Array.from({ length: 14 }, (_, i) => sum(ls, (l) => l.s[i])) as Stats
      await addNbaTeam(db, id, team, total)
    }
  }
  for (const l of LINES) {
    await addNbaLine(db, l.game, l.player, l.team, {
      stats: l.s,
      season: l.season,
      position: 'G',
      minutes: `${l.minutes}:00`
    })
  }
  await db.exec("UPDATE src_nba_team_box SET season = 2025 WHERE game_id = 'old'")
  await buildDerived(db)
  await bootstrapStatsDb(db, new Date(), LEAGUES.nba)
})

describe('a rate less the league’s, and the points beyond it (T1703.3)', () => {
  it('reads each player’s against the league’s own sums in the same scope', async () => {
    const r = await ask({ metrics: ['rts_pct', 'refg_pct', 'ts_add', 'fg_add', 'ts_pct'] })
    const all = season(2026)
    for (const p of [1, 2, 3, 4, 5, 6]) {
      const ls = of(p)
      expect(read(r, p, 'rts_pct')).toBeCloseTo(ts(ls) - ts(all), 12)
      expect(read(r, p, 'refg_pct')).toBeCloseTo(efg(ls) - efg(all), 12)
      // 2 × TSA × (TS − league), worked as the reference states it.
      expect(read(r, p, 'ts_add')).toBeCloseTo(2 * sum(ls, tsa) * (ts(ls) - ts(all)), 10)
      expect(read(r, p, 'fg_add')).toBeCloseTo(
        2 * sum(ls, (l) => l.s[1]) * (efg(ls) - efg(all)),
        10
      )
    }
    // A league's own points above itself come to none, and at least one is each side of it.
    const added = [1, 2, 3, 4, 5, 6].map((p) => read(r, p, 'ts_add')!)
    expect(added.reduce((x, y) => x + y, 0)).toBeCloseTo(0, 10)
    expect(Math.max(...added)).toBeGreaterThan(1)
    expect(Math.min(...added)).toBeLessThan(-1)
  })

  it('keeps the league the whole league when the rows are narrowed, and per season by season', async () => {
    const narrow = await ask({
      metrics: ['rts_pct', 'ts_add'],
      scope: { seasons: [2026], players: ['1'], positions: ['G'] }
    })
    expect(read(narrow, 1, 'rts_pct')).toBeCloseTo(ts(of(1)) - ts(season(2026)), 12)
    expect(read(narrow, 1, 'ts_add')).toBeCloseTo(
      2 * sum(of(1), tsa) * (ts(of(1)) - ts(season(2026))),
      10
    )
    const by = await ask({
      metrics: ['rts_pct', 'ts_add'],
      scope: { seasons: [2025, 2026], players: ['1'] },
      groupBy: ['season']
    })
    for (const row of by.rows) {
      const s = Number(row.group.season)
      expect(row.values.rts_pct.value).toBeCloseTo(ts(of(1, s)) - ts(season(s)), 12)
      expect(row.values.ts_add.value).toBeCloseTo(
        2 * sum(of(1, s), tsa) * (ts(of(1, s)) - ts(season(s))),
        10
      )
    }
    // Two seasons together: the league of both, not each's.
    const both = await ask({
      metrics: ['ts_add'],
      scope: { seasons: [2025, 2026], players: ['3'] }
    })
    const ls = [...of(3), ...of(3, 2025)]
    const lg = ts([...season(2025), ...season(2026)])
    expect(read(both, 3, 'ts_add')).toBeCloseTo(sum(ls, pts) - 2 * sum(ls, tsa) * lg, 10)
  })

  it('reads the league of the games in scope, and a total per game divides it whole', async () => {
    const dates: [string, string] = ['2025-11-01', '2026-01-31']
    const keep = (l: Line): boolean => l.game === 'a' || l.game === 'b'
    const r = await ask({ metrics: ['rts_pct', 'ts_add'], scope: { seasons: [2026], dates } })
    const all = season(2026, keep)
    expect(read(r, 1, 'rts_pct')).toBeCloseTo(ts(of(1, 2026, keep)) - ts(all), 12)
    const per = await ask({ metrics: ['ts_add'], transform: 'perGame' })
    expect(read(per, 1, 'ts_add')).toBeCloseTo(
      (2 * sum(of(1), tsa) * (ts(of(1)) - ts(season(2026)))) / 3,
      10
    )
    const per36 = await ask({ metrics: ['ts_add'], transform: 'per36' })
    expect(read(per36, 2, 'ts_add')).toBeCloseTo(
      (2 * sum(of(2), tsa) * (ts(of(2)) - ts(season(2026))) * 36) / sum(of(2), (l) => l.minutes),
      8
    )
  })

  it('reads a team’s and its opponents’ against the league of teams', async () => {
    const r = await ask({
      entity: 'team',
      metrics: ['team_rts_pct', 'team_ts_add', 'opp_rts_pct', 'opp_fg_add']
    })
    const own = season(2026, (l) => l.team === BOS)
    const against = season(2026, (l) => ['a', 'b', 'd'].includes(l.game) && l.team !== BOS)
    const all = season(2026)
    expect(read(r, BOS, 'team_rts_pct')).toBeCloseTo(ts(own) - ts(all), 12)
    expect(read(r, BOS, 'team_ts_add')).toBeCloseTo(2 * sum(own, tsa) * (ts(own) - ts(all)), 9)
    expect(read(r, BOS, 'opp_rts_pct')).toBeCloseTo(ts(against) - ts(all), 12)
    expect(read(r, BOS, 'opp_fg_add')).toBeCloseTo(
      2 * sum(against, (l) => l.s[1]) * (efg(against) - efg(all)),
      9
    )
  })

  it('pulls a shrunk difference toward 0, its league, and leaves the added count alone', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['rts_pct', 'ts_add'],
        scope: { seasons: [2026], players: ['1'] },
        shrunk: true
      },
      { ...CTX, priors: new Map([['rts_pct', 30]]) }
    )
    const raw = ts(of(1)) - ts(season(2026))
    const n = sum(of(1), (l) => l.s[1])
    expect(r.rows[0].values.rts_pct.raw).toBeCloseTo(raw, 12)
    expect(r.rows[0].values.rts_pct.value).toBeCloseTo((n * raw) / (n + 30), 12)
    expect(r.rows[0].values.ts_add.value).toBe(r.rows[0].values.ts_add.raw)
  })
})

describe('shares of a team’s games and minutes (T1703.3)', () => {
  it('divides a player’s games by their team’s, the larger of the teams of a traded player', async () => {
    const r = await ask({ metrics: ['gp_share', 'min_share', 'gp'] })
    expect(read(r, 1, 'gp_share')).toBeCloseTo(3 / 3, 12)
    // Two of Boston's three games.
    expect(read(r, 2, 'gp_share')).toBeCloseTo(2 / 3, 12)
    // Los Angeles's two, all of them.
    expect(read(r, 3, 'gp_share')).toBeCloseTo(1, 12)
    expect(read(r, 4, 'gp_share')).toBeCloseTo(1 / 2, 12)
    // Boston's three for a player with one game for each of two teams.
    expect(read(r, 5, 'gp_share')).toBeCloseTo(2 / 3, 12)
    const one = await ask({
      metrics: ['gp_share'],
      scope: { seasons: [2026], dates: ['2025-11-01', '2026-01-31'] }
    })
    expect(read(one, 1, 'gp_share')).toBeCloseTo(2 / 2, 12)
    expect(read(one, 4, 'gp_share')).toBeCloseTo(1 / 2, 12)
    // In two seasons the games of both add up.
    const two = await ask({ metrics: ['gp_share'], scope: { seasons: [2025, 2026] } })
    expect(read(two, 1, 'gp_share')).toBeCloseTo(4 / 4, 12)
    expect(read(two, 2, 'gp_share')).toBeCloseTo(2 / 3, 12)
    const last = await ask({ metrics: ['gp_share'], scope: { seasons: [2026], lastN: 2 } })
    expect(read(last, 1, 'gp_share')).toBeCloseTo(1, 12)
  })

  it('divides a player’s minutes by the team’s in the games they played', async () => {
    const r = await ask({ metrics: ['min_share'] })
    // Each game is the team's 240 minutes, 48 for each of the five on the floor; two games for player 2.
    expect(read(r, 2, 'min_share')).toBeCloseTo(54 / (2 * 48), 10)
    expect(read(r, 1, 'min_share')).toBeCloseTo(90 / (3 * 48), 10)
  })

  it('answers on a file read by its schema, since no table holds the team’s games', async () => {
    const schema = await readFileSchema(db)
    const r = await runQuery(
      db,
      { entity: 'player', metrics: ['gp_share'], scope: { seasons: [2026], players: ['2'] } },
      { ...CTX, schema }
    )
    expect(r.columns[0].reason ?? null).toBeNull()
    expect(r.rows[0].values.gp_share.value).toBeCloseTo(2 / 3, 12)
  })

  it('reads no share of the box under a split of the game', async () => {
    const r = await ask({ metrics: ['gp_share'], scope: { seasons: [2026], split: 'q1' } })
    expect(r.columns[0].reason ?? null).not.toBeNull()
  })
})

describe('a published count over the box score’s points (MetricDef.box)', () => {
  it('reads second-chance points over the points of the rows in scope, and nothing for part of a season', async () => {
    await db.exec(
      `INSERT INTO pub_player_misc (player_id, season, game_type, games, minutes, possessions, pts_2_nd_chance)
       VALUES (1, 2026, 'regular', 3, 90, 200, 12)`
    )
    const r = await ask({ metrics: ['nba_pts_2_nd_chance_share', 'nba_pts_2_nd_chance'] })
    expect(read(r, 1, 'nba_pts_2_nd_chance')).toBe(12)
    expect(read(r, 1, 'nba_pts_2_nd_chance_share')).toBeCloseTo(12 / sum(of(1), pts), 12)
    expect(read(r, 2, 'nba_pts_2_nd_chance_share')).toBeNull()
    const part = await ask({
      metrics: ['nba_pts_2_nd_chance_share'],
      scope: { seasons: [2026], dates: ['2025-11-01', '2026-01-31'] }
    })
    expect(part.columns[0].reason ?? null).not.toBeNull()
  })
})
