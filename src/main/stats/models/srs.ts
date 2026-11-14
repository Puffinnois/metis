import { solve } from './linear'

/**
 * The Simple Rating System (reference section 13): a team's rating is its average margin plus the
 * average rating of the opponents it played, so SRS = MOV + SOS. A rating of +5 is five points a
 * game better than an average team on a neutral floor. Pure maths: no database here.
 */

export interface MarginGame<K> {
  /** YYYY-MM-DD: the as-of pass groups games by day. */
  date: string
  home: K
  away: K
  /** Home points less away points. */
  margin: number
}

export interface Rating {
  games: number
  /** Average margin of victory. */
  mov: number
  /** Average rating of the opponents played, one term per game. */
  sos: number
  srs: number
}

/** The running sums a solve needs: games and margins per team, and games per pair of teams. */
class Ledger<K> {
  readonly index = new Map<K, number>()
  readonly teams: K[] = []
  private games: number[] = []
  private margins: number[] = []
  /** Games between each pair, keyed `i,j` with i < j. */
  private pairs = new Map<string, number>()

  private slot(team: K): number {
    let i = this.index.get(team)
    if (i === undefined) {
      i = this.teams.length
      this.index.set(team, i)
      this.teams.push(team)
      this.games.push(0)
      this.margins.push(0)
    }
    return i
  }

  add(g: MarginGame<K>): void {
    const h = this.slot(g.home)
    const a = this.slot(g.away)
    this.games[h]++
    this.games[a]++
    this.margins[h] += g.margin
    this.margins[a] -= g.margin
    const key = h < a ? `${h},${a}` : `${a},${h}`
    this.pairs.set(key, (this.pairs.get(key) ?? 0) + 1)
  }

  /**
   * Solves every group of teams that have played each other, each centred on zero. The equations
   * (games × rating − Σ opponents' ratings = Σ margins) have one free constant per group, so one
   * equation of each group is replaced by "the ratings sum to zero"; the replaced one follows from
   * the others, which keeps SRS = MOV + SOS exact. Iterating instead oscillates while the schedule
   * still splits the league in two.
   */
  solve(): Map<K, Rating> {
    const n = this.teams.length
    const opponents: Array<Array<[number, number]>> = Array.from({ length: n }, () => [])
    for (const [key, count] of this.pairs) {
      const [i, j] = key.split(',').map(Number)
      opponents[i].push([j, count])
      opponents[j].push([i, count])
    }
    const ratings = new Float64Array(n)
    const seen = new Uint8Array(n)
    for (let start = 0; start < n; start++) {
      if (seen[start]) continue
      const group: number[] = []
      const stack = [start]
      seen[start] = 1
      while (stack.length > 0) {
        const i = stack.pop()!
        group.push(i)
        for (const [j] of opponents[i]) {
          if (!seen[j]) {
            seen[j] = 1
            stack.push(j)
          }
        }
      }
      const k = group.length
      const local = new Map(group.map((t, i) => [t, i]))
      const a = new Float64Array(k * k)
      const b = new Float64Array(k)
      for (const [i, t] of group.entries()) {
        a[i * k + i] = this.games[t]
        b[i] = this.margins[t]
        for (const [u, count] of opponents[t]) a[i * k + local.get(u)!] -= count
      }
      for (let c = 0; c < k; c++) a[(k - 1) * k + c] = 1
      b[k - 1] = 0
      const x = solve(a, b, k)
      for (const [i, t] of group.entries()) ratings[t] = x[i]
    }
    const out = new Map<K, Rating>()
    for (let t = 0; t < n; t++) {
      const games = this.games[t]
      let opp = 0
      for (const [u, count] of opponents[t]) opp += count * ratings[u]
      out.set(this.teams[t], {
        games,
        mov: this.margins[t] / games,
        sos: opp / games,
        srs: ratings[t]
      })
    }
    return out
  }
}

/** Every team's rating over these games. */
export function srs<K>(games: readonly MarginGame<K>[]): Map<K, Rating> {
  const ledger = new Ledger<K>()
  for (const g of games) ledger.add(g)
  return ledger.solve()
}

export interface DayRating<K> extends Rating {
  date: string
  team: K
}

/**
 * The ratings as of the end of every day with games, for the teams that played that day: a team's
 * row on a day it played is its rating after that day's games, everyone's included. Games need not
 * be sorted.
 */
export function srsByDay<K>(games: readonly MarginGame<K>[]): DayRating<K>[] {
  const sorted = [...games].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
  const ledger = new Ledger<K>()
  const out: DayRating<K>[] = []
  for (let i = 0; i < sorted.length;) {
    const date = sorted[i].date
    const played = new Set<K>()
    for (; i < sorted.length && sorted[i].date === date; i++) {
      ledger.add(sorted[i])
      played.add(sorted[i].home)
      played.add(sorted[i].away)
    }
    const ratings = ledger.solve()
    for (const team of played) out.push({ date, team, ...ratings.get(team)! })
  }
  return out
}
