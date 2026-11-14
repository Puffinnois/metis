/**
 * Standings, tiebreakers and seeding (Plan T1003), for a season's results so far or played out by the
 * simulation. Pure code with no database import.
 *
 * The tiebreakers are the NBA's published "Play-In and Playoff Tie-Break Procedures" (nba.com, the
 * standings page, as read in November 2026):
 *
 * Two teams: (1) winning percentage in the games between them; (2) a division winner over a team that
 * is not, whether or not they share a division; (3) winning percentage within the division, when they
 * share one; (4) winning percentage within the conference; (5) winning percentage against the teams
 * of the own conference eligible for the postseason; (6) the same against the other conference's;
 * (7) point differential in all games.
 *
 * Three or more: (1) division winners over the rest; (2) winning percentage in all games among the
 * tied teams; (3) within the division, when all share one; (4) within the conference; (5) against the
 * own conference's teams eligible for the postseason; (6) point differential.
 *
 * Ties for a division's first place are broken before any other, and serve only to name the division
 * winner. When a step separates some teams but not all, each group still tied starts again from step
 * one, by the two-team procedure if two are left. A tie no step breaks goes to a drawing: here a draw
 * from the seeded generator.
 *
 * "Eligible for the postseason" is the teams with the conference's best ten records, ties for tenth
 * included, since the play-in (2020-21); before it, the best eight, the playoff field the rule then
 * named.
 *
 * Where this approximates: the procedure before 2004-05 is not published in the load. Two ties the
 * data decides put conference record ahead of division record through 2003-04 and behind it from
 * 2005-06 (`SeasonRules.earlyTiebreak`); the other steps keep today's order in every era. The
 * playoff-field check (`scripts/check-playoff-field.mjs`, reported in `nba-data-sources.md`)
 * reproduces every season's field and seeds from 1993-94.
 */

/** A league for one season: each team's conference (0 east, 1 west) and division, by index. */
export interface League {
  /** The teams' ids, in index order. */
  ids: readonly number[]
  conference: Int8Array
  division: Int8Array
}

export function makeLeague(
  teams: readonly { id: number; conference: string; division: string }[]
): League {
  const divisions = [...new Set(teams.map((t) => t.division))].sort()
  return {
    ids: teams.map((t) => t.id),
    conference: Int8Array.from(teams, (t) => (t.conference.toLowerCase() === 'west' ? 1 : 0)),
    division: Int8Array.from(teams, (t) => divisions.indexOf(t.division))
  }
}

/**
 * A season's results: each team's wins against each other team, its point differential, and wins and
 * losses against an opponent not named yet (the season in progress's games the schedule does not
 * list, the Cup's), which count in the overall record only.
 */
export class Records {
  readonly n: number
  readonly wins: Int16Array
  readonly points: Float64Array
  readonly extraWins: Int16Array
  readonly extraLosses: Int16Array

  constructor(n: number) {
    this.n = n
    this.wins = new Int16Array(n * n)
    this.points = new Float64Array(n)
    this.extraWins = new Int16Array(n)
    this.extraLosses = new Int16Array(n)
  }

  copy(from: Records): void {
    this.wins.set(from.wins)
    this.points.set(from.points)
    this.extraWins.set(from.extraWins)
    this.extraLosses.set(from.extraLosses)
  }

  /** A game between two teams of the league: margin is home less away, never zero. */
  add(home: number, away: number, margin: number): void {
    if (margin > 0) this.wins[home * this.n + away] += 1
    else this.wins[away * this.n + home] += 1
    this.points[home] += margin
    this.points[away] -= margin
  }

  /** A game against an opponent not named yet. */
  addExtra(team: number, margin: number): void {
    if (margin > 0) this.extraWins[team] += 1
    else this.extraLosses[team] += 1
    this.points[team] += margin
  }

  won(team: number): number {
    let w = this.extraWins[team]
    for (let o = 0, i = team * this.n; o < this.n; o++, i++) w += this.wins[i]
    return w
  }

  lost(team: number): number {
    let l = this.extraLosses[team]
    for (let o = 0; o < this.n; o++) l += this.wins[o * this.n + team]
    return l
  }

  pct(team: number): number {
    const w = this.won(team)
    const g = w + this.lost(team)
    return g > 0 ? w / g : 0
  }

  /** Wins and games against the teams `vs` accepts (the team itself never). */
  versus(team: number, vs: (o: number) => boolean): { w: number; g: number } {
    let w = 0
    let g = 0
    for (let o = 0; o < this.n; o++) {
      if (o === team || !vs(o)) continue
      const a = this.wins[team * this.n + o]
      w += a
      g += a + this.wins[o * this.n + team]
    }
    return { w, g }
  }
}

/** Two winning percentages closer than this are equal: an exact tie, written in floating point. */
const EPS = 1e-9

/** A tiebreaker step: a value per team, higher better, or null when it does not apply. */
type Step = (group: readonly number[]) => number[] | null

/**
 * Ranks teams by the tiebreakers for one season's results. `winners` names the division winners once
 * known; while they are being found, the division-winner step does not apply.
 */
export class TieBreaker {
  readonly league: League
  readonly rec: Records
  readonly random: () => number
  /** 1 for a division winner. Empty while division ties are being broken. */
  winners: Uint8Array | null = null
  /** 1 for a team eligible for the postseason (the steps against those teams). */
  readonly eligible: Uint8Array
  private readonly eligibleTop: number
  /** The procedure through 2003-04 (`SeasonRules.earlyTiebreak`). */
  private readonly early: boolean

  constructor(
    league: League,
    rec: Records,
    random: () => number,
    eligibleTop: number,
    early = false
  ) {
    this.league = league
    this.rec = rec
    this.random = random
    this.eligibleTop = eligibleTop
    this.early = early
    this.eligible = new Uint8Array(rec.n)
  }

  /** The teams with the best `eligibleTop` records of each conference, ties for the last included. */
  markEligible(): void {
    const { conference } = this.league
    for (const c of [0, 1]) {
      const pcts: number[] = []
      for (let t = 0; t < this.rec.n; t++) if (conference[t] === c) pcts.push(this.rec.pct(t))
      pcts.sort((a, b) => b - a)
      const cut = pcts[Math.min(this.eligibleTop, pcts.length) - 1] ?? 0
      for (let t = 0; t < this.rec.n; t++)
        if (conference[t] === c) this.eligible[t] = this.rec.pct(t) >= cut - EPS ? 1 : 0
    }
  }

  /** Winning percentage against `vs`, per team; null (the step does not apply) if any has no game. */
  private pctStep(
    group: readonly number[],
    vs: (t: number, o: number) => boolean
  ): number[] | null {
    const out: number[] = []
    for (const t of group) {
      const { w, g } = this.rec.versus(t, (o) => vs(t, o))
      if (g === 0) return null
      out.push(w / g)
    }
    return out
  }

  private readonly headToHead: Step = (group) => {
    const inGroup = new Set(group)
    return this.pctStep(group, (_, o) => inGroup.has(o))
  }

  private readonly divisionWinner: Step = (group) =>
    this.winners === null ? null : group.map((t) => this.winners![t])

  private readonly divisionRecord: Step = (group) => {
    const d = this.league.division[group[0]]
    if (group.some((t) => this.league.division[t] !== d)) return null
    return this.pctStep(group, (t, o) => this.league.division[o] === this.league.division[t])
  }

  private readonly conferenceRecord: Step = (group) =>
    this.pctStep(group, (t, o) => this.league.conference[o] === this.league.conference[t])

  private readonly eligibleOwn: Step = (group) =>
    this.pctStep(
      group,
      (t, o) => this.eligible[o] === 1 && this.league.conference[o] === this.league.conference[t]
    )

  private readonly eligibleOther: Step = (group) =>
    this.pctStep(
      group,
      (t, o) => this.eligible[o] === 1 && this.league.conference[o] !== this.league.conference[t]
    )

  private readonly pointDifferential: Step = (group) => group.map((t) => this.rec.points[t])

  // Getters: the field initialisers run before the constructor sets `early`.
  private get two(): readonly Step[] {
    return this.early ? this.twoEarly : this.twoNow
  }

  private get many(): readonly Step[] {
    return this.early ? this.manyEarly : this.manyNow
  }

  private readonly twoEarly: readonly Step[] = [
    this.headToHead,
    this.conferenceRecord,
    this.divisionRecord,
    this.eligibleOwn,
    this.eligibleOther,
    this.pointDifferential
  ]

  private readonly twoNow: readonly Step[] = [
    this.headToHead,
    this.divisionWinner,
    this.divisionRecord,
    this.conferenceRecord,
    this.eligibleOwn,
    this.eligibleOther,
    this.pointDifferential
  ]

  private readonly manyEarly: readonly Step[] = [
    this.headToHead,
    this.conferenceRecord,
    this.divisionRecord,
    this.eligibleOwn,
    this.pointDifferential
  ]

  private readonly manyNow: readonly Step[] = [
    this.divisionWinner,
    this.headToHead,
    this.divisionRecord,
    this.conferenceRecord,
    this.eligibleOwn,
    this.pointDifferential
  ]

  /** Orders teams tied on record, best first. */
  breakTie(group: readonly number[]): number[] {
    if (group.length <= 1) return [...group]
    for (const step of group.length === 2 ? this.two : this.many) {
      const values = step(group)
      if (values === null) continue
      const parts = partition(group, values)
      // A partial break: each group still tied starts again from the first step.
      if (parts.length > 1) return parts.flatMap((p) => this.breakTie(p))
    }
    // The drawing.
    const out = [...group]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  /** Orders teams by winning percentage, best first, each tie broken by the procedure. */
  rank(teams: readonly number[]): number[] {
    const pct = new Map(teams.map((t) => [t, this.rec.pct(t)]))
    const sorted = [...teams].sort((a, b) => pct.get(b)! - pct.get(a)!)
    const out: number[] = []
    let i = 0
    while (i < sorted.length) {
      let j = i + 1
      while (j < sorted.length && Math.abs(pct.get(sorted[j])! - pct.get(sorted[i])!) < EPS) j++
      out.push(...this.breakTie(sorted.slice(i, j)))
      i = j
    }
    return out
  }
}

/** Splits teams into groups of equal value, best first. */
function partition(group: readonly number[], values: readonly number[]): number[][] {
  const order = group.map((t, i) => ({ t, v: values[i] })).sort((a, b) => b.v - a.v)
  const parts: number[][] = []
  for (let i = 0; i < order.length; i++) {
    if (i > 0 && Math.abs(order[i].v - order[i - 1].v) < EPS)
      parts[parts.length - 1].push(order[i].t)
    else parts.push([order[i].t])
  }
  return parts
}

/**
 * How a season's playoffs were set. Seasons by final year (2026 = 2025-26). Every era since 1993-94,
 * the first season the app holds (D9), sends eight teams of each conference to the bracket.
 */
export interface SeasonRules {
  season: number
  /**
   * Division winners' places among the seeds: 2 (the two division winners seeded first and second,
   * through 2003-04), 3 (the three winners first to third, 2004-05 and 2005-06), `top4` (the three
   * winners and the best other team take seeds one to four, ordered by record, 2006-07 to 2014-15),
   * 0 (seeds by record alone, from 2015-16).
   */
  divisionSeeds: 0 | 2 | 3 | 'top4'
  /**
   * `none`; `bubble`, 2019-20's: the ninth team, if within four games of the eighth, had to beat it
   * twice; `modern` from 2020-21: seventh to tenth play for the last two seeds.
   */
  playIn: 'none' | 'bubble' | 'modern'
  /** First-round series: best of five through 2001-02, of seven since. */
  firstRound: 5 | 7
  /** The Finals' home pattern: 2-3-2 from 1985 to 2013, 2-2-1-1-1 before and since. */
  finals: '2-3-2' | '2-2-1-1-1'
  /**
   * Home court in a series: by record from 2004-05, when protected division winners could have a
   * worse record than a lower seed (2005-06: the sixth-seeded Clippers, 47-35, hosted the third,
   * Denver, 44-38, in the first round); by seed before. The Finals always by record.
   */
  homeByRecord: boolean
  /**
   * The tiebreakers through 2003-04: conference record ahead of division record, and no
   * division-winner step (the division winners were seeded first and second anyway). Two ties the
   * data decides: 2002-03's Midwest, where San Antonio and Dallas finished 60-22 and 2-2 between
   * them, and San Antonio won the division on its conference record (36-16 to 34-18) though Dallas
   * had the better division record (18-6 to 17-7); and 2005-06's sixth seed in the East, where
   * Indiana and Chicago finished 41-41 and 2-2, and Indiana took it on division record (6-10 to
   * 4-12) though Chicago had the better conference record. The switch is placed at the 2004-05
   * realignment; no tie in between decides it. Where the old text placed the other steps is not
   * known here: they keep today's order.
   */
  earlyTiebreak: boolean
  /** Teams of each conference eligible for the postseason, in the tiebreakers. */
  eligibleTop: number
  /** 2019-20's playoffs were played at one site, with no home court. */
  neutralPlayoffs: boolean
}

export function rulesOf(season: number): SeasonRules {
  return {
    season,
    divisionSeeds: season <= 2004 ? 2 : season <= 2006 ? 3 : season <= 2015 ? 'top4' : 0,
    playIn: season === 2020 ? 'bubble' : season >= 2021 ? 'modern' : 'none',
    firstRound: season <= 2002 ? 5 : 7,
    finals: season >= 1985 && season <= 2013 ? '2-3-2' : '2-2-1-1-1',
    homeByRecord: season >= 2005,
    earlyTiebreak: season <= 2004,
    eligibleTop: season >= 2021 ? 10 : 8,
    neutralPlayoffs: season === 2020
  }
}

export interface ConferenceSeeds {
  /** The conference's teams in seed order, every team: protected division winners first in the eras that had them. */
  order: number[]
  /** The division winners of the conference. */
  winners: number[]
}

/**
 * Each conference's seed order for a season's results. Division ties are broken first and name the
 * winners; then the eligible teams are marked (records alone); then each conference is ranked, with
 * the division winners' protected places of the era.
 */
export function seedConferences(
  league: League,
  rec: Records,
  rules: SeasonRules,
  random: () => number
): { tb: TieBreaker; conferences: [ConferenceSeeds, ConferenceSeeds] } {
  const tb = new TieBreaker(league, rec, random, rules.eligibleTop, rules.earlyTiebreak)
  tb.markEligible()
  const n = rec.n
  const winners = new Uint8Array(n)
  const divisions = new Set(league.division)
  tb.winners = null
  for (const d of divisions) {
    const teams: number[] = []
    for (let t = 0; t < n; t++) if (league.division[t] === d) teams.push(t)
    winners[tb.rank(teams)[0]] = 1
  }
  tb.winners = winners
  const seedsOf = (c: number): ConferenceSeeds => {
    const teams: number[] = []
    for (let t = 0; t < n; t++) if (league.conference[t] === c) teams.push(t)
    const ranked = tb.rank(teams)
    const won = ranked.filter((t) => winners[t] === 1)
    let top: number[] = []
    if (rules.divisionSeeds === 2 || rules.divisionSeeds === 3) top = tb.rank(won)
    else if (rules.divisionSeeds === 'top4') {
      const best = ranked.find((t) => winners[t] === 0)
      top = tb.rank(best === undefined ? won : [...won, best])
    }
    const rest = ranked.filter((t) => !top.includes(t))
    return { order: [...top, ...rest], winners: won }
  }
  return { tb, conferences: [seedsOf(0), seedsOf(1)] }
}

/** Games behind: how far `b` trails `a`, half the difference of wins plus that of losses. */
export const gamesBehind = (rec: Records, a: number, b: number): number =>
  (rec.won(a) - rec.won(b) + rec.lost(b) - rec.lost(a)) / 2
