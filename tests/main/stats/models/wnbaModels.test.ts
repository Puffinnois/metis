import { describe, expect, it } from 'vitest'
import { LEAGUES, playoffEraIn, seasonGamesIn, SERIES_PATTERNS, vorpGamesIn } from '@shared/leagues'
import { CATALOGUE, metricIn } from '@shared/stats/catalogue'
import { vorp } from '@main/stats/models/bpm'
import {
  expectedMargin,
  regress,
  runSeason,
  seasonStart,
  winProbability
} from '@main/stats/models/elo'
import { eloModelOf } from '@main/stats/models/forecast'
import { neutralSitesSql } from '@main/stats/models/neutral'
import { playBracket, stagesOf, type PlayGame } from '@main/stats/models/playoffs'
import { rng } from '@main/stats/models/random'
import {
  makeLeague,
  Records,
  rulesOf,
  seedConferences,
  TieBreaker
} from '@main/stats/models/standings'

// Plan T1301.8: the models on the WNBA's constants, each worked by hand, and its playoff format on
// one season of each era.
const wnba = LEAGUES.wnba
const def = (id: string): (typeof CATALOGUE)[number] => CATALOGUE.find((d) => d.id === id)!

describe("the WNBA's model constants", () => {
  it('scales VORP to the season’s own length, the NBA’s to 82', () => {
    expect(seasonGamesIn(wnba, 1997)).toBe(28)
    expect(seasonGamesIn(wnba, 2003)).toBe(34)
    expect(seasonGamesIn(wnba, 2020)).toBe(22)
    expect(seasonGamesIn(wnba, 2026)).toBe(44)
    expect(vorpGamesIn(wnba, 2026)).toBe(44)
    // (3 + 2) × 0.6 × 44 / 44: a whole season at 60 % of the floor time.
    expect(vorp(3, 0.6, 44, vorpGamesIn(wnba, 2026))).toBeCloseTo(3, 12)
    // 2020's 22 games are a whole season too, not a quarter of 82.
    expect(vorp(3, 0.6, 22, vorpGamesIn(wnba, 2020))).toBeCloseTo(3, 12)
    expect(seasonGamesIn(LEAGUES.nba, 2012)).toBe(66)
    expect(vorpGamesIn(LEAGUES.nba, 2012)).toBe(82)
  })

  it('reads Win Shares per 40 minutes', () => {
    const ws = metricIn(def('ws_48'), wnba)
    expect(ws.value).toBe('40 * {ws} / nullif({cmp_minutes}, 0)')
    expect([ws.label, ws.short]).toEqual(['Win Shares per 40 minutes', 'WS/40'])
    // 5 Win Shares in 1,000 minutes: 40 × 5 / 1000.
    expect((40 * 5) / 1000).toBeCloseTo(0.2, 12)
  })

  it('reads the Pythagorean record with its own exponent', () => {
    expect(wnba.models.pythagoreanExponent).toBe(10.5)
    const pct = metricIn(def('team_pyth_pct'), wnba)
    expect(pct.value).toBe(
      'pow({points_for}, 10.5) / nullif(pow({points_for}, 10.5) + pow({points_against}, 10.5), 0)'
    )
    expect(metricIn(def('team_pyth_w'), wnba).value).toContain('pow({points_against}, 10.5)')
    // 2,800 points for and 2,700 against: 1 / (1 + (2700 / 2800)^10.5) = 0.5943, against 0.6246 at 14.
    const evaluate = (sql: string, pf: number, pa: number): number =>
      Function(
        `"use strict"; const pow = Math.pow; const nullif = (a) => a; return ${sql
          .replaceAll('{points_for}', String(pf))
          .replaceAll('{points_against}', String(pa))}`
      )() as number
    expect(evaluate(pct.value, 2800, 2700)).toBeCloseTo(0.594321697, 8)
    expect(evaluate(def('team_pyth_pct').value, 2800, 2700)).toBeCloseTo(0.624606494, 8)
    // The NBA's formula is the catalogue's as written.
    expect(metricIn(def('team_pyth_pct'), LEAGUES.nba)).toBe(def('team_pyth_pct'))
  })

  it("runs Elo on the WNBA's values", () => {
    const elo = wnba.models.elo
    // Home 1500 + 80 against 1500: p = 1 / (1 + 10^(−80/400)) = 0.61314; a 6-point home win moves
    // 20 × (6 + 3)^0.8 / (7.5 + 0.006 × 80) × (1 − p) = 5.62313 points.
    const { rows } = runSeason(
      [{ game_id: 'g', date: '2026-05-16', home: 'A', away: 'B', neutral: false, margin: 6 }],
      new Map([
        ['A', 1500],
        ['B', 1500]
      ]),
      elo,
      elo.newTeam
    )
    expect(rows[0].homeWin).toBeCloseTo(0.61313682, 8)
    expect(rows[0].homePost! - 1500).toBeCloseTo(5.62313499, 8)
    expect(rows[0].homeMargin).toBeCloseTo(80 / 28, 12)
    expect(expectedMargin(80, elo.perPoint)).toBeCloseTo(2.857142857, 9)
    expect(winProbability(0)).toBe(0.5)
    // Into a new season: 1505 + (1600 − 1505) × 0.65.
    expect(regress(1600, elo.carry, elo.mean)).toBeCloseTo(1566.75, 12)
    const start = seasonStart(new Map([['A', 1600]]), ['A', 'C'], elo.carry, elo.mean)
    expect(start.get('A')).toBeCloseTo(1566.75, 12)
    expect(start.has('C')).toBe(false)
    const model = eloModelOf(wnba)
    expect(model).toMatchObject({ homeCourt: 80, perPoint: 28, marginSd: 12.1 })
    expect(model.shift(80, 6)).toBeCloseTo(5.62313499, 8)
  })

  it('gives the 2020 season at IMG Academy no home court, and the Cup final its host', () => {
    const none = { tables: new Set<string>(), columns: new Map() } as never
    expect(neutralSitesSql(none, { from: 2020, to: 2020 }, wnba.models.neutral)).toContain(
      'SELECT game_id, false AS neutral'
    )
    expect(neutralSitesSql(none, { from: 2020, to: 2020 })).toContain("game_type IN ('cup-final')")
    expect(wnba.models.neutral).toEqual({ cities: ['Bradenton'], types: [], cupSemifinals: false })
  })

  it('reads the forecast columns the WNBA has, from past the burn-in', () => {
    expect(metricIn(def('team_play_in_pct'), wnba).unavailable).toBe('The WNBA has no play-in.')
    expect(metricIn(def('team_top6_pct'), wnba).unavailable).toBe('The WNBA has no play-in.')
    expect(metricIn(def('team_round2_pct'), wnba).unavailable).toMatch(/eight teams/)
    expect(metricIn(def('team_conf_finals_pct'), wnba)).toMatchObject({
      label: 'Semifinal odds',
      short: 'SF%'
    })
    expect(metricIn(def('team_playoff_pct'), wnba).firstSeason).toBe(2001)
    expect(metricIn(def('team_elo'), wnba).firstSeason).toBe(2001)
    expect(metricIn(def('team_srs'), wnba).firstSeason).toBe(1997)
    const adj = metricIn(def('team_adj_nrtg'), wnba)
    expect(adj.missingSeasons).toEqual([2004, 2009])
    expect(adj.missingReason).toMatch(/^Not shown for 2004 and 2009/)
  })
})

/** Plays and logs every game: [home, away]. */
function logged(play: PlayGame): { play: PlayGame; games: [number, number][] } {
  const games: [number, number][] = []
  return {
    games,
    play: (h, a, n) => {
      games.push([h, a])
      return play(h, a, n)
    }
  }
}

/** Teams 0 to n − 1, team 0 the best record: the first `east` in the East. */
function league(n: number, east: number): { lg: ReturnType<typeof makeLeague>; rec: Records } {
  const lg = makeLeague(
    Array.from({ length: n }, (_, i) => ({
      id: i,
      conference: i < east ? 'east' : 'west',
      division: null
    }))
  )
  const rec = new Records(n)
  for (let t = 0; t < n; t++) for (let k = 0; k < n - t; k++) rec.addExtra(t, 1)
  return { lg, rec }
}

const better: PlayGame = (h, a) => h < a
const sorted = (games: [number, number][]): number[][] =>
  games.map(([h, a]) => [h, a].sort((x, y) => x - y))
/** The distinct pairs that met, in order. */
const pairs = (games: [number, number][]): string[] => [
  ...new Set(sorted(games).map((p) => p.join('-')))
]

describe("the WNBA's playoff format, one season of each era", () => {
  it('1997: four teams, the conference winners seeded first and second, single games', () => {
    const rules = rulesOf(1997, wnba)
    expect(rules).toMatchObject({ field: 'league', teams: 4, divisionSeeds: 2, tiebreak: 'wnba' })
    // East 0 to 3, West 4 to 7: the West's winner, team 4, is fifth by record and seeded second.
    const { lg, rec } = league(8, 4)
    const { tb, conferences } = seedConferences(lg, rec, rules, rng(1))
    expect(conferences).toHaveLength(1)
    expect(conferences[0].order.slice(0, 4)).toEqual([0, 4, 1, 2])
    const { play, games } = logged(better)
    const reached = new Map<number, number>()
    const champion = playBracket([conferences[0].order.slice(0, 4)], rules, tb, play, (t, r) =>
      reached.set(t, Math.max(reached.get(t) ?? 0, r))
    )
    // One against four, two against three (the second seed hosting), then the final.
    expect(games).toEqual([
      [0, 2],
      [4, 1],
      [0, 1]
    ])
    expect(champion).toBe(0)
    expect(Object.fromEntries(reached)).toEqual({ 0: 4, 1: 3 })
  })

  it('1998: best of three, the better side hosting the second and third games', () => {
    expect(rulesOf(1998, wnba).rounds).toEqual(['1-2', '1-2'])
    expect(SERIES_PATTERNS['1-2']).toEqual([false, true, true])
  })

  it('1999: three of each conference, the first seed resting to the conference finals', () => {
    const rules = rulesOf(1999, wnba)
    expect(rules).toMatchObject({ field: 'conference', teams: 3 })
    const { lg, rec } = league(12, 6)
    const { tb, conferences } = seedConferences(lg, rec, rules, rng(1))
    const { play, games } = logged(better)
    const champion = playBracket(
      conferences.map((c) => c.order.slice(0, 3)),
      rules,
      tb,
      play,
      () => undefined
    )
    // East: 1 v 2 single game, then 0 v 1 best of three; West the same; then the final.
    expect(pairs(games)).toEqual(['1-2', '0-1', '7-8', '6-7', '0-6'])
    expect(champion).toBe(0)
    expect(stagesOf(rules)).toEqual(new Set([2, 3, 4]))
  })

  it('2000 to 2015: four of each conference, one against four and two against three', () => {
    const rules = rulesOf(2010, wnba)
    expect(rules.rounds).toEqual(['1-1-1', '1-1-1', '2-2-1'])
    expect(rulesOf(2004, wnba).finals).toBe('1-2')
    expect(rulesOf(2005, wnba).finals).toBe('2-2-1')
    const { lg, rec } = league(12, 6)
    const { tb, conferences } = seedConferences(lg, rec, rules, rng(1))
    const { play, games } = logged(better)
    playBracket(
      conferences.map((c) => c.order.slice(0, 4)),
      rules,
      tb,
      play,
      () => undefined
    )
    expect(pairs(games)).toEqual(['0-3', '1-2', '0-1', '6-9', '7-8', '6-7', '0-6'])
    // 1-1-1: the better side hosts the first game.
    expect(games[0]).toEqual([0, 3])
  })

  it('2016 to 2021: the eight best, entering by seed, the best side alive meeting the worst', () => {
    const rules = rulesOf(2016, wnba)
    expect(rules).toMatchObject({ field: 'league', teams: 8 })
    const { lg, rec } = league(12, 6)
    const { tb, conferences } = seedConferences(lg, rec, rules, rng(1))
    expect(conferences[0].order.slice(0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    // Seed eight (team 7) beats seed five (team 4); every other game goes by seed.
    const upset: PlayGame = (h, a) => (h + a === 11 && (h === 7 || a === 7) ? h === 7 : h < a)
    const { play, games } = logged(upset)
    const reached = new Map<number, number>()
    const champion = playBracket([conferences[0].order.slice(0, 8)], rules, tb, play, (t, r) =>
      reached.set(t, Math.max(reached.get(t) ?? 0, r))
    )
    // Round one: 5 v 8, 6 v 7; round two: 3 against the worst left (8), 4 against 6; then 1 v 4
    // and 2 v 3 at best of five, and the final.
    expect(pairs(games)).toEqual(['4-7', '5-6', '2-7', '3-5', '0-3', '1-2', '0-1'])
    expect(champion).toBe(0)
    // No round leaves eight: the last four, the final and the title only.
    expect(reached.get(0)).toBe(4)
    expect(reached.get(3)).toBe(2)
    expect(reached.has(5)).toBe(false)
    expect(stagesOf(rules)).toEqual(new Set([2, 3, 4]))
    expect(rulesOf(2020, wnba).neutralPlayoffs).toBe(true)
  })

  it('2022 on: a fixed bracket of eight, the Finals best of seven from 2025', () => {
    const rules = rulesOf(2022, wnba)
    expect(rules.rounds).toEqual(['2-1', '2-2-1', '2-2-1'])
    expect(rulesOf(2025, wnba).rounds).toEqual(['1-1-1', '2-2-1', '2-2-1-1-1'])
    const { lg, rec } = league(15, 7)
    const { tb, conferences } = seedConferences(lg, rec, rules, rng(1))
    const { play, games } = logged(better)
    playBracket([conferences[0].order.slice(0, 8)], rules, tb, play, () => undefined)
    expect(pairs(games)).toEqual(['0-7', '3-4', '1-6', '2-5', '0-3', '1-2', '0-1'])
    // 2-1: the better side hosts the first two games.
    expect(games.slice(0, 2)).toEqual([
      [0, 7],
      [0, 7]
    ])
    expect(playoffEraIn(wnba, 2026).from).toBe(2025)
  })

  it("breaks a tie by the WNBA's steps: the games between them, then the record against .500 teams", () => {
    const lg = makeLeague(
      Array.from({ length: 4 }, (_, i) => ({ id: i, conference: 'east', division: null }))
    )
    const rec = new Records(4)
    rec.add(0, 1, 5)
    rec.add(1, 0, 5)
    rec.add(0, 2, 5)
    rec.add(2, 1, 5)
    rec.add(1, 3, 5)
    rec.add(3, 0, 5)
    rec.add(2, 3, 5)
    // 0 and 1 are 2-2 and 1-1 between them; against teams at .500 or better 0 is 2-1, 1 is 1-2.
    const tb = new TieBreaker(lg, rec, rng(1), 4, false, 'wnba')
    expect(tb.breakTie([1, 0])).toEqual([0, 1])
  })
})
