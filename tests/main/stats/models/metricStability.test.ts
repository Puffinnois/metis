import { beforeAll, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { runQuery } from '@main/stats/engine/run'
import { buildModels, markModelSeason } from '@main/stats/models/build'
import {
  catalogueSignature,
  measureStability,
  NOT_MEASURED,
  priorsOf,
  readStability,
  STABILITY_TABLE
} from '@main/stats/models/metricStability'
import {
  leagueIndex,
  pearson,
  priorOf,
  reliabilityOf,
  shrink,
  spearmanBrown
} from '@main/stats/models/stability'
import { CATALOGUE } from '@shared/stats/catalogue'
import type { MetricDef } from '@shared/stats/types'
import { addGame, emptySources } from '../../../fixtures/boxScores'
import {
  addStabilityLeague,
  FTA,
  LINES,
  PLAYERS,
  SEASONS,
  type FixtureLine
} from '../../../fixtures/stability'
import { openTestDb } from '../../../fixtures/stats'

let db: StatsDb

beforeAll(async () => {
  db = await openTestDb()
  await emptySources(db)
  await addStabilityLeague(db)
  await buildDerived(db)
})

const players = Array.from({ length: PLAYERS }, (_, i) => i + 1)
const of = (
  player: number,
  season: number,
  keep: (l: FixtureLine) => boolean = () => true
): FixtureLine[] => LINES.filter((l) => l.player === player && l.season === season && keep(l))
const sum = (lines: FixtureLine[], f: (l: FixtureLine) => number): number =>
  lines.reduce((s, l) => s + f(l), 0)
const ftPct = (lines: FixtureLine[]): number => sum(lines, (l) => l.ftm) / sum(lines, (l) => l.fta)

/** Year to year, recounted from the fixture's lines: each player's season against their next. */
function yearToYear(value: (lines: FixtureLine[]) => number): number {
  const x: number[] = []
  const y: number[] = []
  for (const p of players) {
    for (const s of SEASONS.slice(0, -1)) {
      x.push(value(of(p, s)))
      y.push(value(of(p, s + 1)))
    }
  }
  return pearson(x, y)
}

/** The odd games (the 1st and 3rd by date) against the even ones, every player-season. */
function halves(value: (lines: FixtureLine[]) => number): number {
  const x: number[] = []
  const y: number[] = []
  for (const p of players) {
    for (const s of SEASONS) {
      x.push(value(of(p, s, (l) => l.game % 2 === 0)))
      y.push(value(of(p, s, (l) => l.game % 2 === 1)))
    }
  }
  return pearson(x, y)
}

describe('the stability measure, through the engine (Plan T1006)', () => {
  it('equals the correlations recounted from the lines', async () => {
    const s = await measureStability(db, 2026, 2027, { metrics: ['ft_pct', 'stl', 'qd4'] })
    const ft = s.get('ft_pct')!
    const r = yearToYear(ftPct)
    expect(ft.pairs).toBe(PLAYERS * 2)
    expect(ft.yearToYear).toBeCloseTo(r, 10)
    expect(ft.reliability).toBe(reliabilityOf(r))
    const h = halves(ftPct)
    expect(ft.halfPairs).toBe(PLAYERS * 3)
    expect(ft.splitHalf).toBeCloseTo(spearmanBrown(h), 10)
    // Each half is two games of free throws.
    expect(ft.prior).toBeCloseTo(priorOf(h, 2 * FTA)!, 8)
    expect([ft.firstSeason, ft.lastSeason]).toEqual([2024, 2026])
    // Steals per game, noise alone: low, and a count has no prior.
    const stl = s.get('stl')!
    expect(stl.yearToYear).toBeCloseTo(
      yearToYear((lines) => sum(lines, (l) => l.stl) / lines.length),
      10
    )
    expect(stl.yearToYear!).toBeLessThan(ft.yearToYear!)
    expect(stl.reliability).toBe('low')
    expect(stl.prior).toBeNull()
    // Nobody has a quadruple double: no spread, no label, a reason.
    expect(s.get('qd4')).toMatchObject({ reliability: null, reason: expect.any(String) })
  })

  it('says why a metric is not measured', async () => {
    const gone = CATALOGUE.find((m) => m.unavailable)!
    const s = await measureStability(db, 2026, 2027, { metrics: [gone.id, 'touches'] })
    expect(s.get(gone.id)).toMatchObject({ reliability: null, reason: NOT_MEASURED.gone })
    // Tracking has no rows here: nothing to pair, which is a reason, not a label.
    expect(s.get('touches')).toMatchObject({ reliability: null, reason: expect.any(String) })
  })

  it(
    'writes one row per metric through the models step, and keeps it on a daily refresh',
    {
      timeout: 120_000
    },
    async () => {
      // 2026-27 under way: one game played.
      await addGame(db, { id: 'now', season: 2027, date: '2026-11-01', scores: [100, 99] })
      await buildDerived(db)
      await buildModels(db, 2027)
      const rows = await db.all<{ season: number; through: number; n: number }>(
        `SELECT season, through, count(*)::INTEGER AS n FROM ${STABILITY_TABLE} GROUP BY ALL`
      )
      expect(rows).toEqual([{ season: 2027, through: 2026, n: CATALOGUE.length }])
      const read = await readStability(db)
      expect(read.get('ft_pct')?.yearToYear).toBeCloseTo(yearToYear(ftPct), 10)
      expect(priorsOf(read).get('ft_pct')).toBeCloseTo(priorOf(halves(ftPct), 2 * FTA)!, 8)

      // A day of the season in progress keeps the rows (a marked row survives)...
      await db.exec(`UPDATE ${STABILITY_TABLE} SET pairs = -1 WHERE metric_id = 'ft_pct'`)
      await markModelSeason(db, 2027)
      await buildModels(db, 2027)
      expect((await readStability(db)).get('ft_pct')?.pairs).toBe(-1)
      // ...and a change to a completed season measures again.
      await markModelSeason(db, 2025)
      await buildModels(db, 2027)
      expect((await readStability(db)).get('ft_pct')?.pairs).toBe(PLAYERS * 2)
    }
  )

  it('changes its version with a formula, not with words', () => {
    const changed: MetricDef[] = CATALOGUE.map((m) =>
      m.id === 'ft_pct' ? { ...m, value: `${m.value} + 0` } : m
    )
    const reworded: MetricDef[] = CATALOGUE.map((m) =>
      m.id === 'ft_pct' ? { ...m, description: 'Other words.' } : m
    )
    expect(catalogueSignature(changed)).not.toBe(catalogueSignature())
    expect(catalogueSignature(reworded)).toBe(catalogueSignature())
  })
})

describe('shrunk rates and league indexes, through the engine (Plan T1006)', () => {
  const season = 2026
  const all = LINES.filter((l) => l.season === season)
  const leagueFt = ftPct(all)
  const tovPct = (lines: FixtureLine[]): number =>
    sum(lines, (l) => l.tov) / sum(lines, (l) => l.fga + 0.44 * l.fta + l.tov)

  it('pulls a rate toward the league by its prior, keeping the raw value', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['ft_pct', 'pts'],
        scope: { seasons: [season], players: ['1', '60'] },
        shrunk: true
      },
      { currentSeason: 2027, priors: new Map([['ft_pct', 30]]) }
    )
    for (const p of [1, 60]) {
      const row = r.rows.find((x) => x.id === String(p))!
      const v = ftPct(of(p, season))
      expect(row.values.ft_pct.raw).toBeCloseTo(v, 12)
      // The league is every player's, not the two asked for.
      expect(row.values.ft_pct.value).toBeCloseTo(shrink(v, 4 * FTA, 30, leagueFt), 12)
      // Counts are not shrunk.
      expect(row.values.pts.value).toBe(row.values.pts.raw)
    }
    expect(r.columns.map((c) => c.shrunk ?? false)).toEqual([true, false])
    expect(r.notes.some((n) => n.startsWith('Shrunk:'))).toBe(true)
  })

  it('ranks every row with a sample when the sort is shrunk, and names a rate it cannot shrink', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['ft_pct', 'fg_pct'],
        scope: { seasons: [season] },
        shrunk: true,
        limit: 100
      },
      { currentSeason: 2027, priors: new Map([['ft_pct', 30]]) }
    )
    const shown = r.rows.map((x) => x.values.ft_pct.value!)
    expect(shown).toEqual([...shown].sort((a, b) => b - a))
    expect(r.rows.every((x) => x.values.ft_pct.rank !== null)).toBe(true)
    expect(r.notes).toContain('Not shrunk, no prior measured: Field-goal percentage.')
  })

  it('refuses shrunk with a transform against the pool', () => {
    return expect(
      runQuery(
        db,
        {
          entity: 'player',
          metrics: ['ft_pct'],
          scope: { seasons: [season] },
          shrunk: true,
          transform: 'zScore'
        },
        { currentSeason: 2027 }
      )
    ).rejects.toThrow(/shrunk/)
  })

  it('indexes a rate against the league in the same scope, 100 the league', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['ft_pct_plus', 'tov_pct_plus', 'ft_pct'],
        scope: { seasons: [season] },
        limit: 100
      },
      { currentSeason: 2027 }
    )
    const leagueTov = tovPct(all)
    for (const row of r.rows) {
      const lines = of(Number(row.id), season)
      expect(row.values.ft_pct_plus.value).toBeCloseTo(
        leagueIndex(ftPct(lines), leagueFt, false),
        9
      )
      // Turnovers: lower is better, so mirrored.
      expect(row.values.tov_pct_plus.value).toBeCloseTo(
        leagueIndex(tovPct(lines), leagueTov, true),
        9
      )
    }
    // The league's own index: the players' indexes weighted by their attempts average 100.
    const weighted = r.rows.reduce(
      (s, x) => s + x.values.ft_pct_plus.value! * x.values.ft_pct.sample!,
      0
    )
    const attempts = r.rows.reduce((s, x) => s + x.values.ft_pct.sample!, 0)
    expect(weighted / attempts).toBeCloseTo(100, 9)
  })

  it('keeps the league the whole league when the rows are narrowed, and per season by season', async () => {
    const one = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['ft_pct_plus'],
        scope: { seasons: [season], players: ['1'], positions: ['G'] }
      },
      { currentSeason: 2027 }
    )
    expect(one.rows[0].values.ft_pct_plus.value).toBeCloseTo(
      leagueIndex(ftPct(of(1, season)), leagueFt, false),
      9
    )
    const by = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['ft_pct_plus'],
        scope: { seasons: SEASONS, players: ['1'] },
        groupBy: ['season']
      },
      { currentSeason: 2027 }
    )
    for (const row of by.rows) {
      const s = Number(row.group.season)
      expect(row.values.ft_pct_plus.value).toBeCloseTo(
        leagueIndex(ftPct(of(1, s)), ftPct(LINES.filter((l) => l.season === s)), false),
        9
      )
    }
  })

  it('indexes a team against the league of teams, its defense mirrored', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_ft_pct_plus', 'opp_ft_pct_plus'],
        scope: { seasons: [season] }
      },
      { currentSeason: 2027 }
    )
    const plus = r.rows.map((x) => x.values.team_ft_pct_plus.value!)
    const opp = r.rows.map((x) => x.values.opp_ft_pct_plus.value!)
    // Two teams: one above the league by as much as the other is below, and a team's opponents'
    // free throws are the other team's, mirrored.
    expect((plus[0] + plus[1]) / 2).toBeCloseTo(100, 6)
    expect(opp[0]).toBeCloseTo(200 - plus[1], 6)
  })
})
