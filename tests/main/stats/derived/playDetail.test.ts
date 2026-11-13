import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import {
  kindSql,
  PLAY_DETAIL_BUILDERS,
  PLAY_DETAIL_PLAYER_GAME,
  PLAY_DETAIL_TEAM_GAME
} from '@main/stats/derived/playDetail'
import { PLAY_TABLES } from '@main/stats/derived/plays'
import { inspect } from '@main/stats/derived/sql'
import { BUILT_NO_SPLIT } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import { readAssistNetwork, readGameFlow } from '@main/stats/playReads'
import {
  elapsedAt,
  flowSummary,
  FOUL_KINDS,
  gameLength,
  kindOf,
  TURNOVER_KINDS,
  type FlowPoint
} from '@shared/stats/playDetail'
import type { StatsQuery, StatsResult } from '@shared/stats/types'
import { addGame, addNbaLine, BOS, emptySources, LAL } from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const CTX = { currentSeason: 2027 }
let db: StatsDb

// Boston (home) against the Lakers in game 'a'. Boston: 1 Ana, 3 Cy. The Lakers: 2 Bea, 4 Di.
const ANA = 1
const BEA = 2
const CY = 3
const DI = 4

interface Play {
  period: number
  clock: number
  team: number | null
  player?: number | null
  kind: string
  subtype?: string
  /** Made field goal: 2 or 3; made free throw: 1; 0 otherwise. */
  pts?: number
  fga?: boolean
  fg3?: boolean
  fta?: boolean
  tov?: boolean
  pf?: boolean
  assist?: number
  steal?: number
}

/**
 * The game, in order. Every rule has its case: a lead change, a tie after a change, a run broken by
 * a free throw, an and-one (converted), a two-shot trip with no make, a team turnover, an offensive
 * foul's turnover, a technical, a run across a period break and into overtime.
 */
const PLAYS: Play[] = [
  {
    period: 1,
    clock: 660,
    team: LAL,
    player: BEA,
    kind: 'field_goal',
    pts: 2,
    fga: true,
    assist: DI
  },
  {
    period: 1,
    clock: 600,
    team: BOS,
    player: CY,
    kind: 'field_goal',
    pts: 3,
    fga: true,
    fg3: true
  },
  {
    period: 1,
    clock: 570,
    team: LAL,
    player: DI,
    kind: 'turnover',
    subtype: 'Bad Pass',
    tov: true,
    steal: ANA
  },
  {
    period: 1,
    clock: 540,
    team: BOS,
    player: ANA,
    kind: 'field_goal',
    pts: 2,
    fga: true,
    assist: CY
  },
  { period: 1, clock: 540, team: LAL, player: BEA, kind: 'foul', subtype: 'Shooting', pf: true },
  {
    period: 1,
    clock: 540,
    team: BOS,
    player: ANA,
    kind: 'free_throw',
    subtype: 'Free Throw 1 of 1',
    pts: 1,
    fta: true
  },
  { period: 1, clock: 480, team: BOS, player: CY, kind: 'foul', subtype: 'Shooting', pf: true },
  {
    period: 1,
    clock: 480,
    team: LAL,
    player: BEA,
    kind: 'free_throw',
    subtype: 'Free Throw 1 of 2',
    pts: 1,
    fta: true
  },
  {
    period: 1,
    clock: 480,
    team: LAL,
    player: BEA,
    kind: 'free_throw',
    subtype: 'Free Throw 2 of 2',
    fta: true
  },
  {
    period: 2,
    clock: 700,
    team: LAL,
    player: DI,
    kind: 'field_goal',
    pts: 3,
    fga: true,
    fg3: true
  },
  {
    period: 2,
    clock: 600,
    team: LAL,
    player: null,
    kind: 'turnover',
    subtype: 'Shot Clock Turnover',
    tov: true
  },
  {
    period: 2,
    clock: 500,
    team: BOS,
    player: CY,
    kind: 'foul',
    subtype: 'Offensive Charge',
    pf: true
  },
  {
    period: 2,
    clock: 500,
    team: BOS,
    player: CY,
    kind: 'turnover',
    subtype: 'Offensive Foul Turnover',
    tov: true
  },
  { period: 2, clock: 400, team: LAL, player: DI, kind: 'foul', subtype: 'Technical' },
  { period: 5, clock: 100, team: LAL, player: BEA, kind: 'field_goal', pts: 2, fga: true },
  { period: 5, clock: 0, team: null, kind: 'period' }
]

async function createPlays(plays: Play[] = PLAYS): Promise<void> {
  let home = 0
  let away = 0
  let seq = 0
  for (const p of plays) {
    seq += 1
    const atHome = p.team === null ? null : p.team === BOS
    if (p.pts) {
      if (atHome) home += p.pts
      else away += p.pts
    }
    const fg = p.kind === 'field_goal'
    await db.exec(
      `INSERT INTO ${PLAY_TABLES.nba} (game_id, season, game_type, game_date, seq, period, clock,
         home_after, away_after, team_id, opponent_id, home, player_id, assist_id, steal_id, kind,
         subtype, fga, fgm, fg3a, fg3m, fta, ftm, pts, tov, pf, ast, stl)
       VALUES ('a', 2026, 'regular', DATE '2025-11-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seq,
        p.period,
        p.clock,
        home,
        away,
        p.team,
        p.team === null ? null : p.team === BOS ? LAL : BOS,
        atHome,
        p.player ?? null,
        p.assist ?? null,
        p.steal ?? null,
        p.kind,
        p.subtype ?? null,
        Number(fg && !!p.fga),
        Number(fg && !!p.pts),
        Number(fg && !!p.fg3),
        Number(fg && !!p.fg3 && !!p.pts),
        Number(!!p.fta),
        Number(p.kind === 'free_throw' && !!p.pts),
        p.pts ?? 0,
        Number(!!p.tov),
        Number(!!p.pf),
        Number(p.assist !== undefined),
        Number(p.steal !== undefined)
      ] as never
    )
  }
}

async function build(): Promise<void> {
  const have = await inspect(db)
  for (const b of PLAY_DETAIL_BUILDERS) {
    await db.exec(`DELETE FROM ${b.table} WHERE season = 2026`)
    await db.exec(`INSERT INTO ${b.table} ${b.select(have, 2026)}`)
  }
}

/** The fixture's scoring plays as the shared rules take them. */
const flowPoints = (): FlowPoint[] => {
  let home = 0
  let away = 0
  return PLAYS.filter((p) => p.pts).map((p) => {
    if (p.team === BOS) home += p.pts ?? 0
    else away += p.pts ?? 0
    return {
      t: elapsedAt(p.period, p.clock),
      home: p.team === BOS,
      pts: p.pts ?? 0,
      fg: p.kind === 'field_goal',
      homeScore: home,
      awayScore: away
    }
  })
}

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Home'), (2, 'Bea Away'), (3, 'Cy Home'),
    (4, 'Di Away')`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'G'), (3, 2026, 'F'),
    (4, 2026, 'F')`)
  await addGame(db, { id: 'a', date: '2025-11-01', home: BOS, away: LAL })
  for (const [p, t] of [
    [ANA, BOS],
    [CY, BOS],
    [BEA, LAL],
    [DI, LAL]
  ]) {
    await addNbaLine(db, 'a', p, t, { position: 'G' })
  }
  await buildDerived(db)
  await createPlays()
})

describe('the kinds in SQL', () => {
  it('give what the shared rule gives, for every era’s spelling and one no rule lists', async () => {
    for (const kinds of [TURNOVER_KINDS, FOUL_KINDS]) {
      const spellings = [...kinds.flatMap((k) => k.subtypes), 'Something New', ' Bad Pass ', null]
      for (const s of spellings) {
        const row = await db.get<{ k: string }>(
          `SELECT ${kindSql(kinds, 's')} AS k FROM (SELECT ?::VARCHAR AS s)`,
          [s] as never
        )
        expect(row?.k, String(s)).toBe(kindOf(kinds, s))
      }
    }
  })

  it('maps each era’s offensive-foul turnover, and keeps bad passes out of bounds as bad passes', () => {
    expect(kindOf(TURNOVER_KINDS, 'Foul')).toBe('off_foul')
    expect(kindOf(TURNOVER_KINDS, 'Offensive Foul Turnover')).toBe('off_foul')
    expect(kindOf(TURNOVER_KINDS, 'Out of Bounds - Bad Pass Turnover')).toBe('bad_pass')
    expect(kindOf(TURNOVER_KINDS, 'Out of Bounds Lost Ball Turnover')).toBe('lost_ball')
    expect(kindOf(TURNOVER_KINDS, 'Step Out of Bounds Turnover')).toBe('out_of_bounds')
    expect(kindOf(FOUL_KINDS, 'Shooting Block')).toBe('shooting')
    expect(kindOf(FOUL_KINDS, 'Personal Block')).toBe('personal')
    expect(kindOf(FOUL_KINDS, 'Offensive Charge')).toBe('offensive')
    expect(kindOf(FOUL_KINDS, 'Flagrant Type 2')).toBe('flagrant2')
  })
})

describe('the play-derived tables', () => {
  beforeEach(build)

  it('count each player’s kinds, and-ones, trips and assists by value', async () => {
    const rows = await db.all<Record<string, number>>(
      `SELECT * FROM ${PLAY_DETAIL_PLAYER_GAME} ORDER BY player_id`
    )
    const of = (id: number): Record<string, number> =>
      rows.find((r) => Number(r.player_id) === id) ?? {}
    expect(of(ANA)).toMatchObject({ made2_ast: 1, and1: 1, and1_ftm: 1, tov: 0 })
    expect(of(CY)).toMatchObject({
      made3_unast: 1,
      ast2: 1,
      pf: 2,
      pf_shooting: 1,
      pf_offensive: 1,
      tov: 1,
      tov_off_foul: 1,
      tov_dead: 1,
      tov_live: 0
    })
    expect(of(DI)).toMatchObject({
      tov_bad_pass: 1,
      tov_live: 1,
      tech: 1,
      pf: 0,
      ast2: 1,
      made3_unast: 1
    })
    expect(of(BEA)).toMatchObject({
      made2_ast: 1,
      made2_unast: 1,
      pf_shooting: 1,
      ft_trip2: 1,
      and1: 0
    })
    for (const r of rows) {
      const kinds = TURNOVER_KINDS.reduce((n, k) => n + Number(r[`tov_${k.key}`]), 0)
      expect(kinds).toBe(Number(r.tov))
      const fouls = FOUL_KINDS.reduce((n, k) => n + Number(r[`pf_${k.key}`]), 0)
      expect(fouls).toBe(Number(r.pf))
    }
  })

  it('counts a team’s own turnovers apart, and its opponents’ side on the same row', async () => {
    const lal = await db.get<Record<string, number>>(
      `SELECT * FROM ${PLAY_DETAIL_TEAM_GAME} WHERE team_id = ${LAL}`
    )
    expect(lal).toMatchObject({
      tov: 2,
      tov_team: 1,
      tov_shot_clock: 1,
      tov_bad_pass: 1,
      opp_and1: 1,
      opp_tov: 1,
      opp_pf_offensive: 1
    })
  })

  it('works out the flow as the shared rules do: changes, ties, leads, runs and droughts', async () => {
    const s = flowSummary(flowPoints(), gameLength(5))
    // The rules on this game, by hand: the Lakers lead 2-0, Boston leads 3-2 (a change), 6-2, the
    // Lakers' free throw ends Boston's 6-0 run, 6-6 ties it, and 6-8 in overtime is a second change.
    expect(s.leadChanges).toBe(2)
    expect(s.timesTied).toBe(1)
    expect(s.home.largestLead).toBe(4)
    expect(s.away.largestLead).toBe(2)
    expect(s.home.bestRun).toBe(6)
    // 1 + 3 + 2: a run carries over the period breaks into overtime.
    expect(s.away.bestRun).toBe(6)
    expect(s.length).toBe(3180)
    expect(s.home.drought).toBe(3180 - elapsedAt(1, 540))
    expect(s.home.timeLeading + s.away.timeLeading + s.timeTied).toBeCloseTo(3180)
    const rows = await db.all<Record<string, number>>(
      `SELECT * FROM ${PLAY_DETAIL_TEAM_GAME} ORDER BY team_id = ${BOS} DESC`
    )
    const [bos, lal] = rows
    const ds = (x: number): number => Math.round(10 * x)
    expect(bos).toMatchObject({
      lead_changes: s.leadChanges,
      times_tied: s.timesTied,
      largest_lead: s.home.largestLead,
      opp_largest_lead: s.away.largestLead,
      best_run: s.home.bestRun,
      opp_best_run: s.away.bestRun,
      lead_ds: ds(s.home.timeLeading),
      tied_ds: ds(s.timeTied),
      drought_ds: ds(s.home.drought),
      drought_fg_ds: ds(s.home.droughtFg),
      game_ds: 31800,
      flow_games: 1
    })
    expect(lal).toMatchObject({
      largest_lead: s.away.largestLead,
      lead_ds: ds(s.away.timeLeading),
      drought_ds: ds(s.away.drought),
      drought_fg_ds: ds(s.away.droughtFg)
    })
  })

  it('builds with no plays, no ESPN file and an ESPN file missing a column', async () => {
    await db.exec(`DELETE FROM ${PLAY_TABLES.nba}`)
    await build()
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${PLAY_DETAIL_TEAM_GAME}`)).toEqual({
      n: 0
    })
    await createPlays()
    await db.exec(`CREATE TABLE src_espn_pbp (game_id BIGINT, season INTEGER, type_text VARCHAR)`)
    await build()
    const r = await db.get<{ fd: number }>(
      `SELECT sum(fd)::INTEGER AS fd FROM ${PLAY_DETAIL_PLAYER_GAME}`
    )
    expect(r?.fd).toBe(0)
  })

  it('reads fouls drawn from ESPN, charges and blocking fouls included', async () => {
    await db.exec(`UPDATE game SET espn_game_id = 901 WHERE game_id = 'a'`)
    await db.exec(`CREATE OR REPLACE TABLE player_ids (espn_athlete_id BIGINT, player_id BIGINT,
      method VARCHAR)`)
    await db.exec(`INSERT INTO player_ids VALUES (11, ${ANA}, 'x'), (12, ${BEA}, 'x')`)
    await db.exec(`CREATE TABLE src_espn_pbp (game_id BIGINT, season INTEGER, file_season INTEGER,
      type_text VARCHAR, athlete_id_2 BIGINT)`)
    await db.exec(`INSERT INTO src_espn_pbp VALUES (901, 2026, 2026, 'Shooting Foul', 11),
      (901, 2026, 2026, 'Shooting Block', 11), (901, 2026, 2026, 'Offensive Charge', 12),
      (901, 2026, 2026, 'Double Personal Foul', 12), (901, 2026, 2026, 'Technical Foul', 11)`)
    await build()
    const rows = await db.all<{ player_id: number; fd: number; fd_shooting: number }>(
      `SELECT player_id, fd, fd_shooting FROM ${PLAY_DETAIL_PLAYER_GAME}
       WHERE fd > 0 ORDER BY player_id`
    )
    expect(rows.map((r) => [Number(r.player_id), r.fd, r.fd_shooting])).toEqual([
      [ANA, 2, 2],
      [BEA, 1, 0]
    ])
    const bos = await db.get<{ fd: number; opp_fd: number }>(
      `SELECT fd, opp_fd FROM ${PLAY_DETAIL_TEAM_GAME} WHERE team_id = ${BOS}`
    )
    expect(bos).toEqual({ fd: 2, opp_fd: 1 })
  })
})

describe('the engine over the play-derived tables', () => {
  const run = (q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }): Promise<StatsResult> =>
    runQuery(db, { entity: 'player', metrics: ['pbp_and1'], ...q }, CTX)
  const value = (r: StatsResult, metric: string, id: string): number | null =>
    r.rows.find((x) => x.id === id)?.values[metric].value ?? null

  beforeEach(build)

  it('reads counts and shares for players and teams, a player with none as 0', async () => {
    const r = await run({
      metrics: ['pbp_and1', 'pbp_and1_pct', 'pbp_ast_pts', 'pbp_tov_bad_pass'],
      scope: { seasons: [2026] }
    })
    expect(value(r, 'pbp_and1', String(ANA))).toBe(1)
    expect(value(r, 'pbp_and1_pct', String(ANA))).toBe(1)
    expect(value(r, 'pbp_ast_pts', String(CY))).toBe(2)
    expect(value(r, 'pbp_tov_bad_pass', String(DI))).toBe(1)
    expect(value(r, 'pbp_tov_bad_pass', String(ANA))).toBe(0)
    const t = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_pbp_lead_changes', 'team_pbp_tov_team', 'opp_pbp_and1'],
        scope: { seasons: [2026] }
      },
      CTX
    )
    expect(value(t, 'team_pbp_lead_changes', String(BOS))).toBe(2)
    expect(value(t, 'team_pbp_tov_team', String(LAL))).toBe(1)
    expect(value(t, 'opp_pbp_and1', String(LAL))).toBe(1)
  })

  it('answers a date range exactly', async () => {
    const r = await run({ scope: { seasons: [2026], dates: ['2026-01-01', '2026-01-31'] } })
    expect(value(r, 'pbp_and1', String(ANA))).toBeNull()
  })

  it('reads a season before the plays, and fouls drawn after ESPN stopped, with their reasons', async () => {
    const r = await run({ scope: { seasons: [1996] } })
    expect(r.columns.find((c) => c.id === 'pbp_and1')?.reason).toBe('Recorded from 1996-97.')
    const fd = await run({ metrics: ['pbp_fd'], scope: { seasons: [2026] } })
    expect(fd.columns.find((c) => c.id === 'pbp_fd')?.reason).toMatch(/^Not in the source/)
  })

  it('reads its reason under a split, never the whole game’s value', async () => {
    const r = await run({ metrics: ['pbp_and1', 'fga'], scope: { seasons: [2026], split: 'q4' } })
    expect(r.columns.find((c) => c.id === 'pbp_and1')?.reason).toBe(BUILT_NO_SPLIT)
    for (const row of r.rows) expect(row.values.pbp_and1.value).toBeNull()
  })
})

describe('the reads', () => {
  const scope = { gameTypes: ['regular' as const] }

  it('list a team’s passers and scorers, and a player’s both ways', async () => {
    const team = await readAssistNetwork(db, {
      entity: 'team',
      id: String(BOS),
      seasons: [2026],
      scope
    })
    expect(team.pairs).toEqual([
      {
        passer: String(CY),
        passerName: 'Cy Home',
        scorer: String(ANA),
        scorerName: 'Ana Home',
        makes: 1,
        threes: 0,
        points: 2
      }
    ])
    const di = await readAssistNetwork(db, {
      entity: 'player',
      id: String(DI),
      seasons: [2026],
      scope
    })
    expect(di.pairs.map((p) => [p.passer, p.scorer])).toEqual([[String(DI), String(BEA)]])
    const none = await readAssistNetwork(db, {
      entity: 'team',
      id: String(BOS),
      seasons: [2026],
      scope: { ...scope, dates: ['2026-01-01', '2026-01-31'] }
    })
    expect(none.pairs).toEqual([])
    const early = await readAssistNetwork(db, {
      entity: 'team',
      id: String(BOS),
      seasons: [1995],
      scope
    })
    expect(early.reason).toBe('Recorded from 1996-97.')
    const bad = await readAssistNetwork(db, {
      entity: 'team',
      id: '1; DROP TABLE x',
      seasons: [2026],
      scope
    })
    expect(bad).toEqual({ pairs: [], total: 0, reason: null })
  })

  it('give a game’s scoring in order with its flow', async () => {
    const flow = await readGameFlow(db, 'a')
    expect(flow.periods).toBe(5)
    expect(flow.points.map((p) => [p.homeScore, p.awayScore])).toEqual([
      [0, 2],
      [3, 2],
      [5, 2],
      [6, 2],
      [6, 3],
      [6, 6],
      [6, 8]
    ])
    expect(flow.summary).toEqual(flowSummary(flowPoints(), gameLength(5)))
    expect((await readGameFlow(db, 'nope')).reason).toBeNull()
  })
})
