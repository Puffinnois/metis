import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import {
  PLAY_DETAIL_BUILDERS,
  PLAY_DETAIL_PLAYER_GAME,
  PLAY_DETAIL_TEAM_GAME
} from '@main/stats/derived/playDetail'
import { PLAY_TABLES } from '@main/stats/derived/plays'
import { inspect } from '@main/stats/derived/sql'
import { bootstrapStatsDb } from '@main/stats/schema'
import { LEAGUES, type League } from '@shared/leagues'
import { CATALOGUE } from '@shared/stats/catalogue'
import type { MetricDef } from '@shared/stats/types'
import { addGame, addNbaLine, BOS, emptySources, LAL } from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

/**
 * The counts of the last minutes, scoring attempts, jump balls, recovered blocks, timeouts, challenges
 * and the bonus (T1703.3, references 36, 372, 376, 383, 386, 387, 388 and 428), each rule on rows written
 * for it, every expected value worked from the rows here.
 */
let db: StatsDb
// Boston is home. Ana and Cy are Boston's, Bea and Di the Lakers'; Cy's and Di's names share a last word.
const ANA = 1
const BEA = 2
const CY = 3
const DI = 4

interface Play {
  p: number
  clock: number
  team?: number
  player?: number
  kind: string
  action?: string
  subtype?: string
  fgm?: boolean
  fg3?: boolean
  fta?: boolean
  ftm?: boolean
  pts?: number
  blk?: boolean
  blocker?: number
  oreb?: boolean
  dreb?: boolean
  pf?: boolean
}

async function put(plays: Play[]): Promise<void> {
  let home = 0
  let away = 0
  let seq = 0
  for (const x of plays) {
    seq += 1
    const atHome = x.team === undefined ? null : x.team === BOS
    const pts = x.pts ?? 0
    if (atHome === true) home += pts
    if (atHome === false) away += pts
    const fg = x.kind === 'field_goal'
    await db.exec(
      `INSERT INTO ${PLAY_TABLES.nba} (game_id, season, game_type, game_date, seq, period, clock, home_after,
         away_after, team_id, opponent_id, home, player_id, block_id, kind, action, subtype, fga, fgm, fg3a,
         fg3m, fta, ftm, pts, oreb, dreb, tov, pf, ast, stl, blk)
       VALUES ('a', 2026, 'regular', DATE '2025-11-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?)`,
      [
        seq,
        x.p,
        x.clock,
        home,
        away,
        x.team ?? null,
        x.team === undefined ? null : x.team === BOS ? LAL : BOS,
        atHome,
        x.player ?? null,
        x.blocker ?? null,
        x.kind,
        x.action ?? '',
        x.subtype ?? null,
        Number(fg),
        Number(fg && !!x.fgm),
        Number(fg && !!x.fg3),
        Number(fg && !!x.fg3 && !!x.fgm),
        Number(!!x.fta),
        Number(!!x.ftm),
        pts,
        Number(!!x.oreb),
        Number(!!x.dreb),
        Number(!!x.pf),
        Number(!!x.blk)
      ] as never
    )
  }
}

async function build(league: League = LEAGUES.nba): Promise<void> {
  const have = await inspect(db)
  for (const b of PLAY_DETAIL_BUILDERS) {
    await db.exec(`DELETE FROM ${b.table} WHERE season = 2026`)
    await db.exec(`INSERT INTO ${b.table} ${b.select(have, 2026, league)}`)
  }
}
const player = async (id: number): Promise<Record<string, number>> =>
  (await db.get<Record<string, number>>(
    `SELECT * FROM ${PLAY_DETAIL_PLAYER_GAME} WHERE player_id = ${id}`
  )) ?? {}
const team = async (id: number): Promise<Record<string, number>> =>
  (await db.get<Record<string, number>>(
    `SELECT * FROM ${PLAY_DETAIL_TEAM_GAME} WHERE team_id = ${id}`
  )) ?? {}

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  await db.exec('CREATE TABLE player (player_id BIGINT, name VARCHAR)')
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Home'), (2, 'Bea Lívely II'), (3, 'Cy Williams'),
    (4, 'Dí Williams'), (5, 'Ed Smith'), (6, 'Fi Smith')`)
  await db.exec(
    `INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'G'), (3, 2026, 'F'), (4, 2026, 'F')`
  )
  await addGame(db, { id: 'a', date: '2025-11-01', home: BOS, away: LAL })
  for (const [p, t] of [
    [ANA, BOS],
    [CY, BOS],
    [BEA, LAL],
    [DI, LAL],
    [5, LAL],
    [6, LAL]
  ]) {
    await addNbaLine(db, 'a', p, t, { position: 'G' })
  }
  await buildDerived(db)
  await bootstrapStatsDb(db, new Date(), LEAGUES.nba)
  await db.exec(`DROP TABLE IF EXISTS src_nba_pbp`)
})

/** A game 100-99 with `rest` as its last rows: the score is set by a first basket of the right size. */
const scored = (home: number, away: number): Play[] => [
  { p: 1, clock: 700, team: BOS, player: CY, kind: 'field_goal', fgm: true, pts: home },
  { p: 1, clock: 690, team: LAL, player: DI, kind: 'field_goal', fgm: true, pts: away }
]

describe('the baskets of the last minutes', () => {
  it('counts a go-ahead basket, a game winner and a buzzer-beater apart', async () => {
    await put([
      ...scored(90, 90),
      // Boston ahead at 1:30: go-ahead, not a game winner (the Lakers tie it after, at 1:00).
      { p: 4, clock: 90, team: BOS, player: ANA, kind: 'field_goal', fgm: true, pts: 2 },
      { p: 4, clock: 60, team: LAL, player: BEA, kind: 'field_goal', fgm: true, pts: 2 },
      // Boston ahead at 0:20 for good: a game winner, not a buzzer-beater.
      { p: 4, clock: 20, team: BOS, player: ANA, kind: 'field_goal', fgm: true, fg3: true, pts: 3 },
      // A Lakers two that does not take the lead.
      { p: 4, clock: 15, team: LAL, player: BEA, kind: 'field_goal', fgm: true, pts: 2 },
      // An end-of-period basket with no effect on the lead, by the leader.
      { p: 4, clock: 0, team: BOS, player: CY, kind: 'field_goal', fgm: true, pts: 2 }
    ])
    await build()
    expect(await player(ANA)).toMatchObject({
      go_ahead: 2,
      game_winner: 1,
      buzzer: 0,
      buzzer_winner: 0
    })
    expect(await player(BEA)).toMatchObject({ go_ahead: 0, game_winner: 0 })
    expect(await player(CY)).toMatchObject({ buzzer: 1, buzzer_winner: 0, game_winner: 0 })
    expect(await team(BOS)).toMatchObject({
      go_ahead: 2,
      game_winner: 1,
      opp_go_ahead: 0,
      buzzer: 1
    })
  })

  it('reads a game winner at the buzzer, from the away side and from behind, and none for one answered', async () => {
    await put([
      ...scored(90, 89),
      { p: 4, clock: 24, team: LAL, player: BEA, kind: 'field_goal', fgm: true, pts: 2 },
      // Answered: Boston ties it, so the Lakers' lead did not hold.
      {
        p: 4,
        clock: 12,
        team: BOS,
        player: ANA,
        kind: 'free_throw',
        fta: true,
        ftm: true,
        subtype: 'Free Throw 1 of 2',
        pts: 1
      },
      { p: 4, clock: 1, team: LAL, player: DI, kind: 'field_goal', fgm: true, pts: 2 }
    ])
    await build()
    expect(await player(BEA)).toMatchObject({ go_ahead: 1, game_winner: 0 })
    expect(await player(DI)).toMatchObject({
      go_ahead: 1,
      game_winner: 1,
      buzzer: 1,
      buzzer_winner: 1
    })
  })

  it('needs the last period, the last two minutes, a field goal and a lead taken', async () => {
    const at = (
      t: number,
      who: number,
      p: number,
      clock: number,
      pts: number,
      fg3 = false
    ): Play => ({
      p,
      clock,
      team: t,
      player: who,
      kind: 'field_goal',
      fgm: true,
      fg3,
      pts
    })
    await put([
      ...scored(90, 90),
      // The third quarter: a lead taken and, as it happens, never lost. And four minutes left in the fourth.
      at(BOS, ANA, 3, 5, 2),
      at(LAL, BEA, 4, 240, 2),
      // A free throw takes the lead, which is not counted; the next basket only adds to it.
      { p: 4, clock: 60, team: BOS, player: CY, kind: 'free_throw', fta: true, ftm: true, pts: 1 },
      at(BOS, ANA, 4, 55, 2),
      at(LAL, DI, 4, 40, 3, true),
      // Overtime counts its last two minutes, from level.
      at(LAL, BEA, 5, 100, 2)
    ])
    await build()
    expect(await player(ANA)).toMatchObject({ go_ahead: 0, game_winner: 0 })
    expect(await player(CY)).toMatchObject({ go_ahead: 0, game_winner: 0 })
    expect(await player(DI)).toMatchObject({ go_ahead: 0 })
    expect(await player(BEA)).toMatchObject({ go_ahead: 1, game_winner: 0 })
    // A third-quarter basket at the buzzer that the other side never answers is a buzzer-beater, no winner.
    await db.exec(`DELETE FROM ${PLAY_TABLES.nba}`)
    await put([...scored(90, 90), at(BOS, ANA, 3, 1, 2)])
    await build()
    expect(await player(ANA)).toMatchObject({
      go_ahead: 0,
      game_winner: 0,
      buzzer: 1,
      buzzer_winner: 0
    })
  })
})

describe('scoring attempts', () => {
  it('counts technical free throws made, and a one-and-one’s front end in college alone', async () => {
    const plays: Play[] = [
      ...scored(50, 50),
      {
        p: 2,
        clock: 400,
        team: BOS,
        player: ANA,
        kind: 'free_throw',
        fta: true,
        ftm: true,
        subtype: 'Free Throw Technical',
        pts: 1
      },
      {
        p: 2,
        clock: 390,
        team: BOS,
        player: ANA,
        kind: 'free_throw',
        fta: true,
        subtype: 'Free Throw Technical'
      },
      { p: 2, clock: 380, team: LAL, player: BEA, kind: 'free_throw', fta: true, subtype: '1of1' },
      {
        p: 2,
        clock: 370,
        team: LAL,
        player: BEA,
        kind: 'free_throw',
        fta: true,
        ftm: true,
        subtype: '1of1',
        pts: 1
      },
      // A make and its free throw at one moment, by the same player: an and-one, no front end.
      { p: 2, clock: 360, team: LAL, player: DI, kind: 'field_goal', fgm: true, pts: 2 },
      { p: 2, clock: 360, team: LAL, player: DI, kind: 'free_throw', fta: true, subtype: '1of1' }
    ]
    await put(plays)
    await build()
    expect(await player(ANA)).toMatchObject({ ft_techm: 1, ft_front: 0 })
    expect(await player(BEA)).toMatchObject({ ft_front: 0 })
    await build(LEAGUES.ncaam)
    // The missed front end, and not the made one nor the and-one's.
    expect(await player(BEA)).toMatchObject({ ft_front: 1 })
    expect(await player(DI)).toMatchObject({ ft_front: 0 })
    expect(await player(ANA)).toMatchObject({ ft_techm: 0 })
    expect(await team(LAL)).toMatchObject({ ft_front: 1 })
  })
})

describe('blocks recovered', () => {
  const missed = (extra: Partial<Play>): Play => ({
    p: 1,
    clock: 500,
    team: LAL,
    player: BEA,
    kind: 'field_goal',
    blk: true,
    blocker: ANA,
    ...extra
  })
  const rebound = (t: number, who: number, o: boolean): Play => ({
    p: 1,
    clock: 498,
    team: t,
    player: who,
    kind: 'rebound',
    ...(o ? { oreb: true } : { dreb: true })
  })
  const block: Play = { p: 1, clock: 500, team: BOS, player: ANA, kind: 'block' }

  it('reads what came next: the blocker’s team’s rebound, the shooter’s, or nothing', async () => {
    await put([
      ...scored(10, 10),
      missed({}),
      block,
      rebound(BOS, CY, false),
      missed({ clock: 400 }),
      block,
      rebound(LAL, DI, true),
      // A block out of bounds: a shot follows, no rebound.
      missed({ clock: 300 }),
      block,
      { p: 1, clock: 290, team: LAL, player: DI, kind: 'field_goal', fgm: true, pts: 2 },
      // A block that names no blocker, and a dead-ball rebound that counts for nobody.
      missed({ clock: 250, blocker: undefined }),
      block,
      rebound(BOS, CY, false),
      missed({ clock: 200 }),
      { p: 1, clock: 198, team: LAL, kind: 'rebound' }
    ])
    await build()
    expect(await player(ANA)).toMatchObject({ blk_n: 2, blk_rec: 1 })
    expect(await player(BEA)).toMatchObject({ blk_n: 0 })
    expect(await team(BOS)).toMatchObject({ blk_n: 2, blk_rec: 1, opp_blk_n: 0 })
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n FROM ${PLAY_DETAIL_PLAYER_GAME} WHERE player_id IS NULL`
      )
    ).toEqual({ n: 0 })
  })
})

describe('jump balls', () => {
  const asRow = (description: string, person: number, team: number): string =>
    `('a', 2026, 'Jump Ball', '${description.replaceAll("'", "''")}', ${team}, ${person})`
  const jumps = async (rows: string[]): Promise<void> => {
    await db.exec(`CREATE TABLE src_nba_pbp (game_id VARCHAR, season INTEGER, action_type VARCHAR,
      description VARCHAR, team_id BIGINT, person_id BIGINT)`)
    await db.exec(`INSERT INTO src_nba_pbp VALUES ${rows.join(', ')}`)
  }

  it('gives the winner and the loser their jump, by the team of the player tipped to', async () => {
    await put(scored(10, 10))
    await jumps([
      // Ana against Bea, whose description has the suffix; Boston wins by its tip.
      asRow('Jump Ball Home vs. Lively II: Tip to Home', ANA, BOS),
      // Won by the side of the second name, by the accented full name's plain last word.
      asRow('Jump Ball Home vs. Lively II: Tip to Lively II', ANA, BOS),
      // A tip to a name both teams have: not counted.
      asRow('Jump Ball Home vs. Lively II: Tip to Williams', ANA, BOS),
      // No tip named, and a tip to nobody of the game: not counted.
      asRow('Jump Ball Home vs. Lively II: Tip to ', ANA, BOS),
      asRow('Jump Ball Home vs. Lively II: Tip to Nobody', ANA, BOS),
      // A second name only one of the two teams' players has, among the other team's: Di's, not Cy's.
      asRow('Jump Ball Home vs. Williams: Tip to Home', ANA, BOS),
      // Two of the other team with the second name: won by Ana, and nobody's loss.
      asRow('Jump Ball Home vs. Smith: Tip to Home', ANA, BOS),
      // An initial and a last word.
      asRow('Jump Ball A Home vs. Lively II: Tip to C Williams', ANA, BOS)
    ])
    await build()
    expect(await player(ANA)).toMatchObject({ jump_n: 5, jump_won: 4, jump_lost: 1 })
    expect(await player(DI)).toMatchObject({ jump_n: 1, jump_won: 0, jump_lost: 1 })
    expect(await player(CY)).toMatchObject({ jump_n: 0 })
    expect(await player(5)).toEqual({})
    expect(await player(6)).toEqual({})
    expect(await player(BEA)).toMatchObject({ jump_n: 3, jump_won: 1, jump_lost: 2 })
    expect(await team(BOS)).toMatchObject({ jump_n: 5, jump_won: 4, jump_lost: 1 })
    expect(await team(LAL)).toMatchObject({ jump_n: 5, jump_won: 1, jump_lost: 4 })
  })

  it('reads the college feed’s own rows for the winner and the loser', async () => {
    await put([
      ...scored(10, 10),
      { p: 1, clock: 900, team: BOS, player: ANA, kind: 'jump_ball', action: 'won Jumpball' },
      { p: 1, clock: 900, team: LAL, player: BEA, kind: 'jump_ball', action: 'lost Jumpball' },
      { p: 1, clock: 800, team: LAL, kind: 'jump_ball', action: 'Jumpball (held ball)' }
    ])
    await build(LEAGUES.ncaam)
    expect(await player(ANA)).toMatchObject({ jump_won: 1, jump_lost: 0, jump_n: 1 })
    expect(await player(BEA)).toMatchObject({ jump_won: 0, jump_lost: 1 })
    expect(await team(LAL)).toMatchObject({ jump_n: 1, jump_won: 0 })
  })
})

describe('timeouts, challenges and the bonus', () => {
  const foul = (t: number, clock: number, subtype = 'Personal', p = 1): Play => ({
    p,
    clock,
    team: t,
    player: t === BOS ? ANA : BEA,
    kind: 'foul',
    subtype,
    pf: true
  })

  it('counts a team’s timeouts, the officials’ and the media’s left out', async () => {
    await put([
      ...scored(10, 10),
      { p: 1, clock: 500, team: BOS, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      { p: 1, clock: 400, team: BOS, kind: 'timeout', action: 'Timeout', subtype: 'Short' },
      { p: 1, clock: 300, kind: 'timeout', action: 'Timeout', subtype: 'Official' },
      { p: 1, clock: 200, team: LAL, kind: 'timeout', action: 'Media Timeout' },
      { p: 1, clock: 150, team: LAL, kind: 'timeout', action: 'Timeout', subtype: 'Official' }
    ])
    await build()
    expect(await team(BOS)).toMatchObject({ timeouts: 2, opp_timeouts: 0 })
    expect(await team(LAL)).toMatchObject({ timeouts: 0, opp_timeouts: 2 })
  })

  it('gives a challenge to the team whose timeout is at the same moment, and counts the overturned', async () => {
    const replay = (clock: number, subtype: string): Play => ({
      p: 1,
      clock,
      kind: 'replay',
      subtype
    })
    await put([
      ...scored(10, 10),
      { p: 1, clock: 500, team: BOS, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      replay(500, 'Coach Challenge Overturn Ruling'),
      { p: 1, clock: 400, team: LAL, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      {
        p: 1,
        clock: 400,
        team: BOS,
        kind: 'timeout',
        action: 'Timeout',
        subtype: 'Coach Challenge'
      },
      // Two teams' timeouts: the challenge's own is taken.
      replay(400, 'Coach Challenge Support Ruling'),
      // The feed sometimes lists the timeout after the replay: still the same moment.
      replay(350, 'Coach Challenge Overturn Ruling'),
      { p: 1, clock: 350, team: LAL, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      // Two ordinary timeouts at a moment: the nearer one, and not the later.
      { p: 1, clock: 250, team: BOS, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      replay(250, 'Coach Challenge Overturn Ruling'),
      { p: 1, clock: 250, kind: 'other' },
      { p: 1, clock: 250, team: LAL, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      // No timeout there, and an ordinary replay: not counted.
      replay(300, 'Coach Challenge Ruling Stands'),
      { p: 1, clock: 200, team: LAL, kind: 'timeout', action: 'Timeout', subtype: 'Regular' },
      replay(200, 'Overturn Ruling')
    ])
    await build()
    expect(await team(BOS)).toMatchObject({ challenges: 3, challenges_won: 2 })
    expect(await team(LAL)).toMatchObject({ challenges: 1, challenges_won: 1, opp_challenges: 3 })
    // The college feed's challenges are left out (the catalogue says why).
    await build(LEAGUES.ncaam)
    expect(await team(BOS)).toMatchObject({ challenges: 0 })
  })

  it('puts the other team in the bonus at the fifth foul of a quarter, or the second of its last two minutes', async () => {
    await put([
      ...scored(10, 10),
      foul(BOS, 700),
      foul(BOS, 600, 'Loose Ball'),
      foul(BOS, 500, 'Shooting'),
      foul(BOS, 400, 'Personal Take'),
      // An offensive foul and a technical do not count: this is still four.
      foul(BOS, 350, 'Offensive'),
      foul(BOS, 340, 'Technical'),
      foul(BOS, 300, 'Clear Path'),
      // A sixth, in the same period: still one period of the bonus.
      foul(BOS, 290),
      // The Lakers' two in the last two minutes of the second.
      foul(LAL, 100, 'Personal', 2),
      foul(LAL, 90, 'Personal', 2),
      // The Lakers' four in overtime, and Boston's three in it.
      foul(LAL, 280, 'Personal', 5),
      foul(LAL, 250, 'Personal', 5),
      foul(LAL, 200, 'Personal', 5),
      foul(LAL, 170, 'Personal', 5),
      foul(BOS, 280, 'Personal', 5),
      foul(BOS, 200, 'Personal', 5),
      foul(BOS, 170, 'Personal', 5)
    ])
    await build()
    // Six of Boston's counted in the first, three in overtime.
    expect(await team(BOS)).toMatchObject({
      team_fouls: 9,
      bonus_given: 1,
      opp_bonus_given: 2,
      opp_team_fouls: 6
    })
    expect(await team(LAL)).toMatchObject({ team_fouls: 6, bonus_given: 2, opp_bonus_given: 1 })
    await build(LEAGUES.ncaam)
    expect(await team(BOS)).toMatchObject({ team_fouls: 0, bonus_given: 0 })
  })
})

describe('where the counts are available', () => {
  const of = (id: string): MetricDef => CATALOGUE.find((m) => m.id === id)!

  it('states each league’s first season, and the reason where college has none', () => {
    expect(of('team_pbp_challenges').firstSeason).toBe(2020)
    expect(of('team_pbp_challenge_pct').firstSeason).toBe(2020)
    expect(of('team_pbp_challenges').leagues?.wnba?.firstSeason).toBe(2023)
    expect(of('opp_pbp_challenges_won').leagues?.wnba?.firstSeason).toBe(2023)
    for (const id of ['team_pbp_bonus_given', 'team_pbp_bonus_got', 'opp_pbp_team_fouls']) {
      expect(of(id).leagues?.wnba?.firstSeason, id).toBe(2006)
    }
    expect(of('team_pbp_bonus_given').firstSeason).toBe(1997)
    for (const league of ['ncaam', 'ncaaw'] as const) {
      expect(of('team_pbp_challenges').leagues?.[league]?.unavailable).toMatch(/2025-26/)
      expect(of('opp_pbp_challenges').leagues?.[league]?.unavailable).toMatch(/2025-26/)
      expect(of('team_pbp_bonus_given').leagues?.[league]?.unavailable).toMatch(/does not say/)
      expect(of('team_pbp_bonus_got').leagues?.[league]?.unavailable).toMatch(/does not say/)
      expect(of('pbp_go_ahead').leagues?.[league]?.unavailable).toBeUndefined()
      expect(of('pbp_psa').leagues?.[league]?.unavailable).toBeUndefined()
    }
  })
})
