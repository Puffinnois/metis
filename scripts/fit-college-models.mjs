#!/usr/bin/env node
// Fits a college league's model constants on its own seasons (Plan T1302.8), with the code that ships
// (`src/main/stats/models/`, bundled here with esbuild). Every fit reads the games the models read:
// games between two Division I teams of the season (the groups file's list, `team.division_i`), of
// every counted type (the conference tournaments, the NCAA tournament and the other postseason events,
// D45), never an exhibition, never a forfeit (2-0 in ESPN's schedule, `forfeit_winner_id`), home court 0
// where the `game` table marks a neutral site. Fitted on 2021-22 to 2024-25, scored on 2025-26.
//
// 1. The Pythagorean exponent: least squares on the winning percentage of team-seasons.
// 2. Elo: a grid of K, home court, the share kept between seasons and a new Division I team's start,
//    fitted on the Brier score of 2022-23 to 2024-25 (2021-22 is the burn-in: every team starts at
//    1500) and scored on 2025-26; calibration by tenths and the log loss against the home side's rate;
//    Elo points per point of margin and the margin's spread; the burn-in measured by the games a team
//    has played and from random starts.
// 3. The adjusted ratings' prior: each week's games predicted from the fit as of the week before
//    (RMSE in points per 100, weighted by possessions), the pull on a season's final ratings, and each
//    season's split-half reliability (odd games against even).
//
// It opens the file read-only (no worker, nothing written): node scripts/fit-college-models.mjs
// <stats-ncaam.duckdb> [out.md] --league=ncaam [--split=2026]
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const { DuckDBInstance } = require('@duckdb/node-api')

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const leagueId = process.argv.find((a) => a.startsWith('--league='))?.slice(9) ?? 'ncaam'
const SPLIT = Number(process.argv.find((a) => a.startsWith('--split='))?.slice(8) ?? 2026)
const [fileArg, mdArg] = args
if (!fileArg) {
  console.error('usage: node scripts/fit-college-models.mjs <stats file> [out.md] --league=<id>')
  process.exit(2)
}

const bundled = await build({
  stdin: {
    contents: `export * from './src/main/stats/models/elo'
               export * from './src/main/stats/models/adjusted'
               export { srs } from './src/main/stats/models/srs'
               export { LEAGUES } from './src/shared/leagues'`,
    resolveDir: root,
    loader: 'ts'
  },
  alias: { '@shared': resolve(root, 'src/shared'), '@main': resolve(root, 'src/main') },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const M = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
const L = M.LEAGUES[leagueId]

const instance = await DuckDBInstance.create(resolve(fileArg), { access_mode: 'READ_ONLY' })
const conn = await instance.connect()
const read = async (sql) => (await conn.runAndReadAll(sql)).getRowObjectsJson()

const out = []
const say = (...lines) => {
  for (const l of lines) {
    console.log(l)
    out.push(l)
  }
}
const table = (headers, rows) => {
  say(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`)
  for (const r of rows) say(`| ${r.join(' | ')} |`)
  say('')
}
const f = (x, d = 4) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : x.toFixed(d))
const label = (s) => `${s - 1}-${String(s % 100).padStart(2, '0')}`

// Seasons complete: the season in progress (the latest with games to come) is left out.
const done = (
  await read(`SELECT DISTINCT season FROM game WHERE played AND season NOT IN
    (SELECT season FROM game WHERE NOT played) ORDER BY season`)
).map((r) => Number(r.season))
const FIRST = done[0]
const LAST = done[done.length - 1]

const D1_GAMES = `
  FROM game g
  JOIN team th ON th.team_id = g.home_team_id AND th.season = g.season AND th.division_i
  JOIN team ta ON ta.team_id = g.away_team_id AND ta.season = g.season AND ta.division_i
  WHERE g.played AND g.game_type <> 'preseason' AND g.forfeit_winner_id IS NULL
    AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL AND g.home_score <> g.away_score
    AND g.season BETWEEN ${FIRST} AND ${LAST}`

say(`# ${L.name} model constants, fitted`, '')
say(
  `Games between two Division I teams of the season, every counted type, no exhibition or forfeit; fitted on ${label(FIRST)} to ${label(SPLIT - 1)} and scored on ${label(SPLIT)}, by \`scripts/fit-college-models.mjs\` on \`${fileArg}\`.`,
  ''
)
const counts = await read(`SELECT g.season, count(*) AS n, sum(g.neutral::INT) AS neutral,
  sum((g.game_type <> 'regular')::INT) AS post ${D1_GAMES} GROUP BY 1 ORDER BY 1`)
const all = await read(`SELECT g.season, count(*) AS n FROM game g WHERE g.played
  AND g.game_type <> 'preseason' AND g.season BETWEEN ${FIRST} AND ${LAST} GROUP BY 1 ORDER BY 1`)
table(
  ['Season', 'Games counted', 'Between Division I teams', 'Neutral site', 'Postseason'],
  counts.map((r, i) => [label(r.season), all[i].n, r.n, r.neutral, r.post])
)

// ---- 1. The Pythagorean exponent.
const teamSeasons = await read(`
  WITH sides AS (
    SELECT g.season, g.home_team_id AS team, g.home_score AS pf, g.away_score AS pa ${D1_GAMES}
    UNION ALL
    SELECT g.season, g.away_team_id, g.away_score, g.home_score ${D1_GAMES}
  )
  SELECT season, team, sum(pf)::DOUBLE AS pf, sum(pa)::DOUBLE AS pa,
         sum((pf > pa)::INT)::DOUBLE AS w, count(*)::DOUBLE AS g
  FROM sides GROUP BY 1, 2`)
const pythErr = (rows, x) => {
  let se = 0
  for (const r of rows) se += (r.w / r.g - r.pf ** x / (r.pf ** x + r.pa ** x)) ** 2
  return Math.sqrt(se / rows.length)
}
const winsErr = (rows, x) => {
  let se = 0
  for (const r of rows) se += (r.w - (r.g * r.pf ** x) / (r.pf ** x + r.pa ** x)) ** 2
  return Math.sqrt(se / rows.length)
}
const trainTs = teamSeasons.filter((r) => r.season < SPLIT)
const testTs = teamSeasons.filter((r) => r.season >= SPLIT)
let bestX = 14
for (let x = 4; x <= 24.0001; x += 0.1) if (pythErr(trainTs, x) < pythErr(trainTs, bestX)) bestX = x
bestX = Math.round(bestX * 10) / 10
say('## 1. Pythagorean exponent', '')
say(
  `Points for to the x over points for and against each to the x, against the winning percentage of every team-season over its games against Division I teams (${trainTs.length} to fit, ${testTs.length} to score).`,
  ''
)
table(
  ['Exponent', 'RMSE of W%, fitted seasons', 'RMSE of W%, 2025-26', 'RMSE in wins, 2025-26'],
  [...new Set([bestX, 10.25, 11.5, 14, L.models?.pythagoreanExponent ?? bestX])].map((x) => [
    x === bestX ? `**${x}** (fitted)` : String(x),
    f(pythErr(trainTs, x)),
    f(pythErr(testTs, x)),
    f(winsErr(testTs, x), 2)
  ])
)

// ---- 2. Elo.
const games = await read(`
  SELECT g.season, g.game_id, strftime(g.game_date, '%Y-%m-%d') AS date, g.game_type AS type,
         g.home_team_id AS home, g.away_team_id AS away,
         (g.home_score - g.away_score)::DOUBLE AS margin, coalesce(g.neutral, false) AS neutral
  ${D1_GAMES}
  ORDER BY g.season, g.game_date, g.game_id`)
for (const g of games) {
  g.home = Number(g.home)
  g.away = Number(g.away)
}
const seasons = [...new Set(games.map((g) => g.season))].sort((a, b) => a - b)
const bySeason = new Map(seasons.map((s) => [s, games.filter((g) => g.season === s)]))
const START = 1500

/** Elo over every season with the shipped code, each game's pre-game probability and edge. */
function runElo(p, start = null) {
  const rows = []
  let lastRatings = null
  const finals = new Map()
  // Games each team has played, for the burn-in by games.
  const played = new Map()
  for (const s of seasons) {
    const list = bySeason.get(s)
    const teams = [...new Set(list.flatMap((g) => [g.home, g.away]))]
    const begin =
      lastRatings === null
        ? new Map(teams.map((t) => [t, start?.get(t) ?? START]))
        : M.seasonStart(lastRatings, teams, p.carry, START)
    // A team new to Division I this season enters at `newTeam`: never matched to a team gone, since
    // schools join and leave the division in the same season without being one another.
    if (lastRatings !== null) for (const t of teams) if (!begin.has(t)) begin.set(t, p.newTeam)
    const { rows: rated, ratings } = M.runSeason(list, begin, p, p.newTeam)
    const byId = new Map(list.map((g) => [g.game_id, g]))
    for (const r of rated) {
      const g = byId.get(r.game_id)
      const before = Math.min(played.get(g.home) ?? 0, played.get(g.away) ?? 0)
      played.set(g.home, (played.get(g.home) ?? 0) + 1)
      played.set(g.away, (played.get(g.away) ?? 0) + 1)
      rows.push({
        season: s,
        type: g.type,
        neutral: g.neutral,
        p: r.homeWin,
        won: g.margin > 0,
        edge: r.homePre + r.homeCourt - r.awayPre,
        margin: g.margin,
        before
      })
    }
    lastRatings = ratings
    finals.set(s, new Map(ratings))
  }
  return { rows, finals }
}
const scored = (rows, from, to) => rows.filter((r) => r.season >= from && r.season <= to)
const brierOf = (rows) => M.brier(rows.map((r) => ({ p: r.p, won: r.won })))
const logLossOf = (rows) => M.logLoss(rows.map((r) => ({ p: r.p, won: r.won })))
const ELO_FROM = FIRST + 1

const grid = []
for (let k = 10; k <= 60; k += 2)
  for (let h = 0; h <= 240; h += 10)
    for (let c = 0.3; c <= 0.951; c += 0.05)
      grid.push({ k, homeCourt: h, carry: Math.round(c * 100) / 100, newTeam: 1300 })
let best = null
let started = Date.now()
for (const p of grid) {
  const b = brierOf(scored(runElo(p).rows, ELO_FROM, SPLIT - 1))
  if (best === null || b < best.train) best = { ...p, train: b }
}
// Then a new Division I team's start, with the rest fitted.
for (const n of [1200, 1250, 1300, 1350, 1400, 1450, 1500]) {
  const p = { ...best, newTeam: n }
  const b = brierOf(scored(runElo(p).rows, ELO_FROM, SPLIT - 1))
  if (b < best.train) best = { ...p, train: b }
}
const gridMs = Date.now() - started
const fittedP = { k: best.k, homeCourt: best.homeCourt, carry: best.carry, newTeam: best.newTeam }
const candidates = [
  { name: 'Fitted', p: fittedP },
  { name: "NBA's", p: { k: 20, homeCourt: 80, carry: 0.65, newTeam: 1300 } },
  { name: "FiveThirtyEight's NBA", p: { k: 20, homeCourt: 100, carry: 0.75, newTeam: 1300 } }
]
if (L.models) {
  const e = L.models.elo
  candidates.splice(1, 0, {
    name: 'Registry',
    p: { k: e.k, homeCourt: e.homeCourt, carry: e.carry, newTeam: e.newTeam }
  })
}
const runs = candidates.map((c) => ({ ...c, ...runElo(c.p) }))
const fitted = runs[0]
say('## 2. Elo', '')
say(
  `Every game between Division I teams, ${games.length} in all. Grid: K 10 to 60 by 2, home court 0 to 240 by 10, share kept 0.30 to 0.95 by 0.05 (${grid.length} runs), then a new Division I team's start 1200 to 1500 by 50 (${(gridMs / 1000).toFixed(0)} s); fitted on the Brier score of ${label(ELO_FROM)} to ${label(SPLIT - 1)} (${label(FIRST)} is the burn-in), scored on ${label(SPLIT)}.`,
  ''
)
const test = (r) => scored(r.rows, SPLIT, LAST)
const train = (r) => scored(r.rows, ELO_FROM, SPLIT - 1)
// The baseline the brief names: the home side's win rate of the fitted seasons at a home court, a coin
// at a neutral site.
const trainRows = train(fitted)
const homeRows = trainRows.filter((r) => !r.neutral)
const homeRate = homeRows.filter((r) => r.won).length / homeRows.length
const baseline = (rows) => rows.map((r) => ({ p: r.neutral ? 0.5 : homeRate, won: r.won }))
table(
  ['Values', 'K', 'Home', 'Kept', 'New team', 'Brier, fitted', 'Brier, 2025-26', 'Log loss, 2025-26'],
  runs.map((r) => [
    r.name,
    r.p.k,
    r.p.homeCourt,
    r.p.carry,
    r.p.newTeam,
    f(brierOf(train(r))),
    f(brierOf(test(r))),
    f(logLossOf(test(r)))
  ])
)
const testRows = test(fitted)
say(
  `Baseline, the home side's win rate of ${label(ELO_FROM)} to ${label(SPLIT - 1)} at a home court (${f(100 * homeRate, 1)} %) and a coin at a neutral site: on ${label(SPLIT)}, Brier ${f(M.brier(baseline(testRows)))}, log loss ${f(M.logLoss(baseline(testRows)))} against Elo's ${f(brierOf(testRows))} and ${f(logLossOf(testRows))} (${testRows.length} games).`,
  ''
)
let hindsight = null
for (const p of grid.filter((_, i) => i % 3 === 0)) {
  const b = brierOf(scored(runElo({ ...p, newTeam: best.newTeam }).rows, SPLIT, LAST))
  if (hindsight === null || b < hindsight.b) hindsight = { ...p, b }
}
say(
  `The best values in hindsight on ${label(SPLIT)} (a third of the grid): K ${hindsight.k}, home ${hindsight.homeCourt}, kept ${hindsight.carry}, Brier ${f(hindsight.b)}.`,
  ''
)

// Points per margin point and the margin's spread, fitted values.
let sdm = 0
let sdd = 0
for (const r of fitted.rows.filter((x) => x.season >= ELO_FROM && x.season < SPLIT)) {
  sdm += r.edge * r.margin
  sdd += r.edge * r.edge
}
const perPoint = sdd / sdm
const resid = fitted.rows.filter((r) => r.season >= ELO_FROM).map((r) => r.margin - r.edge / perPoint)
const rmean = resid.reduce((s, x) => s + x, 0) / resid.length
const marginSd = Math.sqrt(resid.reduce((s, x) => s + (x - rmean) ** 2, 0) / (resid.length - 1))
say(
  `Elo points per point of margin (least squares of the margin on the edge, fitted seasons): ${f(perPoint, 1)} (the NBA's 28). The margins around that expected margin, ${label(ELO_FROM)} to ${label(LAST)} (${resid.length} games): spread ${f(marginSd, 2)}, mean ${f(rmean, 2)}.`,
  ''
)

const tenths = (rows) => {
  const t = Array.from({ length: 10 }, () => ({ n: 0, p: 0, w: 0 }))
  for (const r of rows) {
    const x = t[Math.min(9, Math.floor(r.p * 10))]
    x.n++
    x.p += r.p
    x.w += r.won ? 1 : 0
  }
  return t
}
say(`Calibration on ${label(SPLIT)}, out of sample, by tenths of the home side's probability:`, '')
table(
  ['Tenth', 'Games', 'Given', 'Won'],
  tenths(testRows).map((t, i) => [
    `${i * 10}–${i * 10 + 10} %`,
    t.n,
    t.n ? f((100 * t.p) / t.n, 1) : '–',
    t.n ? f((100 * t.w) / t.n, 1) : '–'
  ])
)
say('Per season, the fitted values (every rated game):', '')
table(
  ['Season', 'Games', 'Brier', 'Log loss', 'Baseline log loss'],
  seasons.map((s) => {
    const rows = fitted.rows.filter((r) => r.season === s)
    return [label(s), rows.length, f(brierOf(rows)), f(logLossOf(rows)), f(M.logLoss(baseline(rows)))]
  })
)

// Burn-in by games: the log loss by the fewer games either side had played in the window, in the
// first season against the later ones.
const BUCKETS = [0, 3, 6, 10, 15, 20, 25, 30]
const bucketOf = (n) => BUCKETS.filter((b) => n >= b).length - 1
const byBucket = (rows) => {
  const t = BUCKETS.map(() => [])
  for (const r of rows) t[bucketOf(r.before)].push(r)
  return t
}
const firstB = byBucket(fitted.rows.filter((r) => r.season === FIRST))
const laterLL = logLossOf(fitted.rows.filter((r) => r.season > FIRST && r.season < SPLIT))
const laterBrier = brierOf(fitted.rows.filter((r) => r.season > FIRST && r.season < SPLIT))
say(
  `Burn-in by games played: ${label(FIRST)}'s games by the fewer games either team had played between Division I teams before it (every team at ${START} on its first), against ${label(ELO_FROM)} to ${label(SPLIT - 1)}'s whole seasons (log loss ${f(laterLL)}, Brier ${f(laterBrier)}):`,
  ''
)
table(
  ['Games before', 'Games', 'Log loss', 'Brier', 'Baseline log loss'],
  firstB.map((rows, i) => [
    `${BUCKETS[i]}${BUCKETS[i + 1] ? `–${BUCKETS[i + 1] - 1}` : '+'}`,
    rows.length,
    f(logLossOf(rows)),
    f(brierOf(rows)),
    f(M.logLoss(baseline(rows)))
  ])
)
// From random starts of 1300 to 1700: the largest gap of a team's final rating each season.
let seed = 7
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
const firstTeams = [...new Set(bySeason.get(FIRST).flatMap((g) => [g.home, g.away]))]
const gaps = new Map(seasons.map((s) => [s, { max: 0, mean: 0 }]))
const RUNS = 20
for (let run = 0; run < RUNS; run++) {
  const other = runElo(fittedP, new Map(firstTeams.map((t) => [t, 1300 + 400 * rand()]))).finals
  for (const s of seasons) {
    let gap = 0
    let sum = 0
    let n = 0
    for (const [t, r] of fitted.finals.get(s)) {
      const d = Math.abs(r - other.get(s).get(t))
      gap = Math.max(gap, d)
      sum += d
      n++
    }
    const x = gaps.get(s)
    x.max = Math.max(x.max, gap)
    x.mean += sum / n / RUNS
  }
}
say(
  `From ${RUNS} random starts of 1300 to 1700 in ${label(FIRST)}, a team's final rating against the run from ${START}: ${seasons.map((s) => `${label(s)} mean ${f(gaps.get(s).mean, 1)}, largest ${f(gaps.get(s).max, 1)}`).join('; ')}.`,
  ''
)
say('Ratings spread at the end of each season (standard deviation over the teams):', '')
table(
  ['Season', 'Teams', 'SD', 'Mean'],
  seasons.map((s) => {
    const v = [...fitted.finals.get(s).values()]
    const mean = v.reduce((a, b) => a + b, 0) / v.length
    return [label(s), v.length, f(Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), 1), f(mean, 1)]
  })
)

// ---- 3. The adjusted ratings' prior.
const PRIORS = [0.01, 50, 100, 200, 400, 800, 1600]
const eff = await read(`
  WITH t AS (SELECT game_id, team_id, pts, poss_sym FROM team_game WHERE game_type <> 'preseason')
  SELECT g.season, strftime(g.game_date, '%Y-%m-%d') AS date,
         strftime(date_trunc('week', g.game_date), '%Y-%m-%d') AS week,
         g.home_team_id AS home, g.away_team_id AS away, h.pts::DOUBLE AS "homePts",
         a.pts::DOUBLE AS "awayPts", h.poss_sym::DOUBLE AS poss, coalesce(g.neutral, false) AS neutral
  ${D1_GAMES.replace('FROM game g', `FROM game g
  JOIN t h ON h.game_id = g.game_id AND h.team_id = g.home_team_id
  JOIN t a ON a.game_id = g.game_id AND a.team_id = g.away_team_id`)}
    AND h.pts IS NOT NULL AND a.pts IS NOT NULL AND h.poss_sym > 0
  ORDER BY g.season, g.game_date, g.game_id`)
for (const g of eff) {
  g.home = Number(g.home)
  g.away = Number(g.away)
}
const err = PRIORS.map(() => ({ se: 0, w: 0, seLate: 0, wLate: 0 }))
const pulls = PRIORS.map(() => ({ sum: 0, n: 0 }))
const possPerTeam = []
const reliability = []
started = Date.now()
for (const s of seasons) {
  const list = eff.filter((g) => g.season === s)
  const weeks = [...new Set(list.map((g) => g.week))].sort()
  for (let i = 1; i < weeks.length; i++) {
    const before = list.filter((g) => g.week < weeks[i])
    const now = list.filter((g) => g.week === weeks[i])
    PRIORS.forEach((lambda, j) => {
      const fit = M.fitAdjusted(before, lambda)
      for (const g of now) {
        for (const [o, d, x, pts] of [
          [g.home, g.away, g.neutral ? 0 : 1, g.homePts],
          [g.away, g.home, g.neutral ? 0 : -1, g.awayPts]
        ]) {
          if (!fit.off.has(o) || !fit.def.has(d)) continue
          const pred = fit.mean + fit.off.get(o) + fit.def.get(d) + x * fit.home
          const e2 = g.poss * ((100 * pts) / g.poss - pred) ** 2
          err[j].se += e2
          err[j].w += g.poss
          // The second half of the season's weeks, where the ratings are read as a record.
          if (i >= weeks.length / 2) {
            err[j].seLate += e2
            err[j].wLate += g.poss
          }
        }
      }
    })
  }
  const none = M.fitAdjusted(list, PRIORS[0])
  PRIORS.forEach((lambda, j) => {
    const fit = M.fitAdjusted(list, lambda)
    for (const t of fit.off.keys()) {
      pulls[j].sum += Math.abs(fit.off.get(t) - fit.def.get(t) - (none.off.get(t) - none.def.get(t)))
      pulls[j].n++
    }
  })
  for (const p of none.poss.values()) possPerTeam.push(p)
  // Split-half reliability: each team's odd games against its even ones (by the order of its own
  // games), the correlation of the two fits' net ratings.
  const seen = new Map()
  const odd = []
  const even = []
  for (const g of list) {
    const nh = seen.get(g.home) ?? 0
    seen.set(g.home, nh + 1)
    ;(nh % 2 === 0 ? odd : even).push(g)
  }
  reliability.push([s, list])
}
const medianPoss = [...possPerTeam].sort((a, b) => a - b)[Math.floor(possPerTeam.length / 2)]
say('## 3. Adjusted ratings', '')
say(
  `Each week's games predicted from the fit as of the week before, every season (${eff.length} games), RMSE in points per 100 weighted by possessions, over the season and over its second half. Pull: the mean absolute change of a team's final adjusted net rating from no prior. A team-season holds ${f(medianPoss, 0)} possessions at the median (the NBA's about 8,000, the WNBA's 2,700). ${((Date.now() - started) / 1000).toFixed(0)} s.`,
  ''
)
table(
  ['Prior (possessions)', 'RMSE, every week', 'RMSE, second half', 'Pull on final net'],
  PRIORS.map((p, j) => [
    String(p),
    f(Math.sqrt(err[j].se / err[j].w), 3),
    f(Math.sqrt(err[j].seLate / err[j].wLate), 3),
    f(pulls[j].sum / pulls[j].n, 3)
  ])
)
const pearson = (a, b) => {
  const n = a.length
  const ma = a.reduce((s, x) => s + x, 0) / n
  const mb = b.reduce((s, x) => s + x, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return sab / Math.sqrt(saa * sbb)
}
say('Split-half reliability: the season\'s games alternately in two halves (by date), each fitted with no prior; the correlation of the two halves\' net ratings over the teams.', '')
const halves = reliability.map(([s, list]) => {
  const a = M.fitAdjusted(list.filter((_, i) => i % 2 === 0), 0.01)
  const b = M.fitAdjusted(list.filter((_, i) => i % 2 === 1), 0.01)
  const teams = [...a.off.keys()].filter((t) => b.off.has(t))
  const na = teams.map((t) => a.off.get(t) - a.def.get(t))
  const nb = teams.map((t) => b.off.get(t) - b.def.get(t))
  const full = M.fitAdjusted(list, 0.01)
  const net = [...full.off.keys()].map((t) => full.off.get(t) - full.def.get(t))
  const m = net.reduce((x, y) => x + y, 0) / net.length
  const sd = Math.sqrt(net.reduce((x, y) => x + (y - m) ** 2, 0) / net.length)
  return [label(s), teams.length, f(pearson(na, nb), 3), f(sd, 2)]
})
table(['Season', 'Teams', 'Split-half r', 'SD of net rating'], halves)

// SRS on the same games, for the checks that compare it.
say('## 4. SRS spread', '')
table(
  ['Season', 'Teams', 'SD of SRS'],
  seasons.map((s) => {
    const r = M.srs(bySeason.get(s).map((g) => ({ date: g.date, home: g.home, away: g.away, margin: g.margin })))
    const v = [...r.values()].map((x) => x.srs)
    const m = v.reduce((a, b) => a + b, 0) / v.length
    return [label(s), v.length, f(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length), 2)]
  })
)
say(
  `Fitted: exponent ${bestX}; Elo K ${fittedP.k}, home ${fittedP.homeCourt}, kept ${fittedP.carry}, new team ${fittedP.newTeam}, per point ${f(perPoint, 1)}, margin spread ${f(marginSd, 2)}.`
)
if (mdArg) writeFileSync(resolve(mdArg), out.join('\n') + '\n')
conn.closeSync?.()
