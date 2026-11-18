#!/usr/bin/env node
// Fits a league's model constants on its own seasons (Plan T1301.8), each by the method Stage 10 used
// for the NBA and scored out of sample, with the code that ships (`src/main/stats/models/`, bundled
// here with esbuild) and the league's registry entry (`League.models` in `src/shared/leagues.ts`):
//
// 1. The Pythagorean exponent: the one minimising the squared error of the winning percentage over
//    the training seasons' team-seasons, scored on the later seasons against the NBA's 14.
// 2. Elo: a grid of K, home court and the share kept between seasons, fitted (Brier score) on the
//    training seasons after the burn-in and scored on the later ones, against the registry's values,
//    the NBA's and FiveThirtyEight's; then Elo points per point of margin and the margin's spread;
//    calibration by tenths; the burn-in from random starts.
// 3. The adjusted ratings' prior: each day's games predicted from the fit as of the day before (RMSE
//    in points per 100, weighted by possessions), the pull each prior gives a season's final ratings,
//    and each season's split-half reliability (odd games against even), the measure of a season too
//    thin to show.
//
// usage: node scripts/fit-league-models.mjs <folder holding stats-<league>.duckdb> [out.md] --league=<id>
// --split=<first test season> (default 2012). Build first (`npm run build`): it reads through the worker.
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folderArg, mdArg] = positional()
if (!folderArg) {
  console.error('usage: node scripts/fit-league-models.mjs <folder> [out.md] --league=<id>')
  process.exit(2)
}
const folder = resolve(folderArg)
const mdFile = mdArg ? resolve(mdArg) : null
const leagueId = leagueArg()
const SPLIT = Number(process.argv.find((a) => a.startsWith('--split='))?.slice(8) ?? 2012)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundled = await build({
  stdin: {
    contents: `export * from './src/main/stats/models/elo'
               export * from './src/main/stats/models/adjusted'
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
const models = L.models

const { read, close } = openStatsWorker(folder, { league: leagueId })
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
const f = (x, d = 4) => (x === null || !Number.isFinite(x) ? '–' : x.toFixed(d))
const label = (s) => L.seasonLabel(s)

const last = (
  await read(`SELECT max(season) AS s FROM game WHERE played AND game_type = 'regular'`)
)[0].s
say(`# ${L.name} model constants, fitted`, '')
say(
  `Fitted on ${label(L.firstSeason)} to ${label(SPLIT - 1)} and scored on ${label(SPLIT)} to ${label(last)}, on \`${folder}\`, by \`scripts/fit-league-models.mjs\`.`,
  ''
)

// ---- 1. The Pythagorean exponent.
const teamSeasons = await read(`
  SELECT season, team_id, sum(pts)::DOUBLE AS pf, sum(opp_pts)::DOUBLE AS pa,
         sum((pts > opp_pts)::INT)::DOUBLE AS w, count(*)::DOUBLE AS g
  FROM team_game WHERE game_type = 'regular' AND pts IS NOT NULL AND opp_pts IS NOT NULL
  GROUP BY 1, 2`)
const pythErr = (rows, x) => {
  let se = 0
  for (const r of rows) {
    const p = r.pf ** x / (r.pf ** x + r.pa ** x)
    se += (r.w / r.g - p) ** 2
  }
  return Math.sqrt(se / rows.length)
}
const trainTs = teamSeasons.filter((r) => r.season < SPLIT)
const testTs = teamSeasons.filter((r) => r.season >= SPLIT)
let bestX = 14
for (let x = 4; x <= 24.0001; x += 0.1) if (pythErr(trainTs, x) < pythErr(trainTs, bestX)) bestX = x
bestX = Math.round(bestX * 10) / 10
// Its error in wins of a season, for the reader.
const winsErr = (rows, x) => {
  let se = 0
  for (const r of rows) se += (r.w - (r.g * r.pf ** x) / (r.pf ** x + r.pa ** x)) ** 2
  return Math.sqrt(se / rows.length)
}
say('## 1. Pythagorean exponent', '')
say(
  `Points for to the x over points for and against each to the x, against the winning percentage of every regular-season team-season (${trainTs.length} to fit, ${testTs.length} to score). The registry's: ${models.pythagoreanExponent}.`,
  ''
)
table(
  ['Exponent', 'RMSE of W%, fitted seasons', 'RMSE of W%, later seasons', 'RMSE in wins, later'],
  [...new Set([bestX, 14, models.pythagoreanExponent])].map((x) => [
    x === bestX ? `**${x}** (fitted)` : String(x),
    f(pythErr(trainTs, x)),
    f(pythErr(testTs, x)),
    f(winsErr(testTs, x), 2)
  ])
)

// ---- 2. Elo.
const types = models.eloGameTypes.map((t) => `'${t}'`).join(', ')
const cities = models.neutral.cities.map((c) => `'${c}'`).join(', ') || "''"
const ruleTypes = models.neutral.types.map((t) => `'${t}'`).join(', ') || "''"
const games = await read(`
  WITH espn AS (
    SELECT DISTINCT ON (game_id) game_id, neutral_site, venue_address_city AS city
    FROM src_espn_schedule ORDER BY game_id, (season = file_season) DESC, file_season DESC
  )
  SELECT g.season, g.game_id, strftime(g.game_date, '%Y-%m-%d') AS date, g.game_type AS type,
         g.home_team_id AS home, g.away_team_id AS away, (g.home_score - g.away_score)::DOUBLE AS margin,
         coalesce(e.neutral_site, false) OR g.game_type IN (${ruleTypes})
           OR coalesce(e.city IN (${cities}), false) AS neutral
  FROM game g LEFT JOIN espn e ON e.game_id = g.espn_game_id
  WHERE g.game_type IN (${types}) AND g.played AND g.home_team_id IS NOT NULL
    AND g.away_team_id IS NOT NULL AND g.home_score <> g.away_score
  ORDER BY g.season, g.game_date, g.game_id`)
for (const g of games) {
  g.home = Number(g.home)
  g.away = Number(g.away)
}
const seasons = [...new Set(games.map((g) => g.season))].sort((a, b) => a - b)
const bySeason = new Map(seasons.map((s) => [s, games.filter((g) => g.season === s)]))
const neutralBySeason = seasons.map((s) => [s, bySeason.get(s).filter((g) => g.neutral).length])

/** Elo over every season with the shipped code: each game's pre-game probability and edge. */
function runElo(p, start = null) {
  const rows = []
  let lastRatings = null
  for (const s of seasons) {
    const list = bySeason.get(s)
    const teams = [...new Set(list.flatMap((g) => [g.home, g.away]))]
    const begin =
      lastRatings === null
        ? new Map(teams.map((t) => [t, start?.get(t) ?? models.elo.start]))
        : M.seasonStart(lastRatings, teams, p.carry, models.elo.mean)
    const { rows: rated, ratings } = M.runSeason(list, begin, p, models.elo.newTeam)
    const byId = new Map(list.map((g) => [g.game_id, g]))
    for (const r of rated) {
      const g = byId.get(r.game_id)
      rows.push({
        season: s,
        type: g.type,
        p: r.homeWin,
        won: g.margin > 0,
        edge: r.homePre + r.homeCourt - r.awayPre,
        margin: g.margin
      })
    }
    lastRatings = ratings
  }
  return { rows, lastRatings }
}
const scored = (rows, from, to) => rows.filter((r) => r.season >= from && r.season <= to)
const brierOf = (rows) => M.brier(rows.map((r) => ({ p: r.p, won: r.won })))
const logLossOf = (rows) => M.logLoss(rows.map((r) => ({ p: r.p, won: r.won })))
const FIRST = models.elo.firstSeason

const grid = []
for (let k = 10; k <= 40; k += 2)
  for (let h = 0; h <= 160; h += 10)
    for (let c = 0.4; c <= 0.951; c += 0.05)
      grid.push({ k, homeCourt: h, carry: Math.round(c * 100) / 100 })
let best = null
const started = Date.now()
for (const p of grid) {
  const { rows } = runElo(p)
  const b = brierOf(scored(rows, FIRST, SPLIT - 1))
  if (best === null || b < best.train) best = { ...p, train: b }
}
const gridMs = Date.now() - started
const candidates = [
  { name: 'Fitted', p: { k: best.k, homeCourt: best.homeCourt, carry: best.carry } },
  {
    name: 'Registry',
    p: { k: models.elo.k, homeCourt: models.elo.homeCourt, carry: models.elo.carry }
  },
  { name: "NBA's", p: { k: 20, homeCourt: 80, carry: 0.65 } },
  { name: "FiveThirtyEight's", p: { k: 20, homeCourt: 100, carry: 0.75 } }
]
const runs = candidates.map((c) => ({ ...c, ...runElo(c.p) }))
const fitted = runs[0]
// What the registry ships: the checks below read its values.
const shipped = runs[1]
// The best values in hindsight on the later seasons, as Stage 10 printed for the NBA.
let hindsight = null
for (const p of grid) {
  const b = brierOf(scored(runElo(p).rows, SPLIT, last))
  if (hindsight === null || b < hindsight.b) hindsight = { ...p, b }
}
say('## 2. Elo', '')
say(
  `Every game of the types Elo rates (${models.eloGameTypes.join(', ')}), ${games.length} in all, home court 0 at a neutral site (${neutralBySeason
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${label(s)} ${n}`)
    .join(
      ', '
    )}). Grid: K 10 to 40 by 2, home court 0 to 160 by 10, share kept 0.40 to 0.95 by 0.05 (${grid.length} runs, ${(gridMs / 1000).toFixed(0)} s); fitted on the Brier score of ${label(FIRST)} to ${label(SPLIT - 1)}, scored on ${label(SPLIT)} to ${label(last)}.`,
  ''
)
const test = (r) => scored(r.rows, SPLIT, last)
const train = (r) => scored(r.rows, FIRST, SPLIT - 1)
table(
  [
    'Values',
    'K',
    'Home',
    'Kept',
    'Brier, fitted',
    'Brier, later',
    'Log loss, later',
    'Later less fitted values',
    'SE'
  ],
  runs.map((r) => {
    const a = test(r)
    const base = test(fitted)
    const d = a.map(
      (x, i) => (x.p - (x.won ? 1 : 0)) ** 2 - (base[i].p - (base[i].won ? 1 : 0)) ** 2
    )
    const mean = d.reduce((s, x) => s + x, 0) / d.length
    const sd = Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / (d.length - 1))
    return [
      r.name,
      r.p.k,
      r.p.homeCourt,
      r.p.carry,
      f(brierOf(train(r))),
      f(brierOf(a)),
      f(logLossOf(a)),
      r === fitted ? '–' : f(mean, 5),
      r === fitted ? '–' : f(sd / Math.sqrt(d.length), 5)
    ]
  })
)
// The home rate in sample as a baseline, as Stage 10 printed.
const homeRate = (rows) => {
  const by = new Map()
  for (const r of rows) {
    const x = by.get(r.season) ?? { w: 0, n: 0 }
    x.w += r.won ? 1 : 0
    x.n++
    by.set(r.season, x)
  }
  return M.brier(rows.map((r) => ({ p: by.get(r.season).w / by.get(r.season).n, won: r.won })))
}
say(
  `The home side's win rate of each season, in sample, scores ${f(homeRate(test(fitted)))} on the later seasons. The best values in hindsight on the later seasons: K ${hindsight.k}, home ${hindsight.homeCourt}, kept ${hindsight.carry}, Brier ${f(hindsight.b)}. The checks below use the registry's values.`,
  ''
)

// Elo points per point of margin, and the spread of the margin, with the fitted values.
let sdm = 0
let sdd = 0
for (const r of shipped.rows.filter((x) => x.season >= FIRST && x.season < SPLIT)) {
  sdm += r.edge * r.margin
  sdd += r.edge * r.edge
}
const perPoint = sdd / sdm
const regular = shipped.rows.filter((r) => r.type === 'regular' && r.season >= FIRST)
const resid = regular.map((r) => r.margin - r.edge / perPoint)
const rmean = resid.reduce((s, x) => s + x, 0) / resid.length
const marginSd = Math.sqrt(resid.reduce((s, x) => s + (x - rmean) ** 2, 0) / (resid.length - 1))
say(
  `Elo points per point of margin, fitted (least squares of the margin on the edge, fitted seasons): ${f(perPoint, 1)} (the NBA's 28). The regular season's margins around that expected margin, ${label(FIRST)} to ${label(last)} (${resid.length} games): spread ${f(marginSd, 2)}, mean ${f(rmean, 2)}.`,
  ''
)

// Calibration by tenths of the home side's probability, later seasons.
const tenths = Array.from({ length: 10 }, () => ({ n: 0, p: 0, w: 0 }))
for (const r of test(shipped)) {
  const t = tenths[Math.min(9, Math.floor(r.p * 10))]
  t.n++
  t.p += r.p
  t.w += r.won ? 1 : 0
}
say(
  "Calibration on the later seasons, the registry values, by tenths of the home side's probability:",
  ''
)
table(
  ['Tenth', 'Games', 'Given', 'Won'],
  tenths.map((t, i) => [
    `${i * 10}–${i * 10 + 10} %`,
    t.n,
    t.n ? f((100 * t.p) / t.n, 1) : '–',
    t.n ? f((100 * t.w) / t.n, 1) : '–'
  ])
)

// Per season, fitted values.
say("Per season, the registry's values (every rated game):", '')
table(
  ['Season', 'Games', 'Brier', 'Log loss', 'Home rate'],
  seasons
    .filter((s) => s >= FIRST)
    .map((s) => {
      const rows = shipped.rows.filter((r) => r.season === s)
      return [label(s), rows.length, f(brierOf(rows)), f(logLossOf(rows)), f(homeRate(rows))]
    })
)

// Burn-in: from random starts between 1300 and 1700, how far each season's final ratings are from
// the run from the registry's start, the largest gap over the teams.
let seed = 7
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
const finals = (p, start) => {
  const out = new Map()
  let lastRatings = null
  for (const s of seasons) {
    const list = bySeason.get(s)
    const teams = [...new Set(list.flatMap((g) => [g.home, g.away]))]
    const begin =
      lastRatings === null
        ? new Map(teams.map((t) => [t, start?.get(t) ?? models.elo.start]))
        : M.seasonStart(lastRatings, teams, p.carry, models.elo.mean)
    lastRatings = M.runSeason(list, begin, p, models.elo.newTeam).ratings
    out.set(s, new Map(lastRatings))
  }
  return out
}
const base = finals(shipped.p)
const firstTeams = [...new Set(bySeason.get(seasons[0]).flatMap((g) => [g.home, g.away]))]
const gaps = new Map(seasons.slice(0, 6).map((s) => [s, 0]))
for (let run = 0; run < 20; run++) {
  const start = new Map(firstTeams.map((t) => [t, 1300 + 400 * rand()]))
  const other = finals(shipped.p, start)
  for (const s of gaps.keys()) {
    let gap = 0
    for (const [t, r] of base.get(s)) gap = Math.max(gap, Math.abs(r - other.get(s).get(t)))
    gaps.set(s, Math.max(gaps.get(s), gap))
  }
}
say(
  `Burn-in, the registry's values: twenty runs from random starts of 1300 to 1700 in ${label(seasons[0])}; the largest gap of a team's final rating from the run from ${models.elo.start}: ${[...gaps].map(([s, g]) => `${label(s)} ${f(g, 1)}`).join(', ')}.`,
  ''
)

// ---- 3. The adjusted ratings' prior.
const PRIORS = [0.01, 25, 50, 100, 150, 250, 500, 1000]
const eff = await read(`
  WITH espn AS (
    SELECT DISTINCT ON (game_id) game_id, neutral_site, venue_address_city AS city
    FROM src_espn_schedule ORDER BY game_id, (season = file_season) DESC, file_season DESC
  )
  SELECT g.season, strftime(g.game_date, '%Y-%m-%d') AS date, g.home_team_id AS home, g.away_team_id AS away,
         h.pts::DOUBLE AS "homePts", a.pts::DOUBLE AS "awayPts", h.poss_sym::DOUBLE AS poss,
         coalesce(e.neutral_site, false) OR coalesce(e.city IN (${cities}), false) AS neutral
  FROM game g
  JOIN team_game h ON h.game_id = g.game_id AND h.team_id = g.home_team_id
  JOIN team_game a ON a.game_id = g.game_id AND a.team_id = g.away_team_id
  LEFT JOIN espn e ON e.game_id = g.espn_game_id
  WHERE g.game_type = 'regular' AND g.played AND h.pts IS NOT NULL AND a.pts IS NOT NULL AND h.poss_sym > 0
  ORDER BY g.season, g.game_date, g.game_id`)
for (const g of eff) {
  g.home = Number(g.home)
  g.away = Number(g.away)
}
const effSeasons = [...new Set(eff.map((g) => g.season))].sort((a, b) => a - b)
const err = PRIORS.map(() => ({ se: 0, w: 0 }))
const pulls = PRIORS.map(() => ({ sum: 0, n: 0 }))
const possPerTeam = []
for (const s of effSeasons) {
  const list = eff.filter((g) => g.season === s)
  const days = [...new Set(list.map((g) => g.date))]
  for (let i = 1; i < days.length; i++) {
    const before = list.filter((g) => g.date < days[i])
    const today = list.filter((g) => g.date === days[i])
    PRIORS.forEach((lambda, j) => {
      const fit = M.fitAdjusted(before, lambda)
      for (const g of today) {
        for (const [o, d, x, pts] of [
          [g.home, g.away, g.neutral ? 0 : 1, g.homePts],
          [g.away, g.home, g.neutral ? 0 : -1, g.awayPts]
        ]) {
          if (!fit.off.has(o) || !fit.def.has(d)) continue
          const pred = fit.mean + fit.off.get(o) + fit.def.get(d) + x * fit.home
          err[j].se += g.poss * ((100 * pts) / g.poss - pred) ** 2
          err[j].w += g.poss
        }
      }
    })
  }
  const none = M.fitAdjusted(list, PRIORS[0])
  PRIORS.forEach((lambda, j) => {
    const fit = M.fitAdjusted(list, lambda)
    for (const t of fit.off.keys()) {
      pulls[j].sum += Math.abs(
        fit.off.get(t) - fit.def.get(t) - (none.off.get(t) - none.def.get(t))
      )
      pulls[j].n++
    }
  })
  for (const p of none.poss.values()) possPerTeam.push(p)
}
const medianPoss = [...possPerTeam].sort((a, b) => a - b)[Math.floor(possPerTeam.length / 2)]
say('## 3. Adjusted ratings', '')
say(
  `Each regular-season day's games predicted from the fit as of the day before, every season (${eff.length} games): RMSE in points per 100, weighted by possessions. Pull: the mean absolute change of a team's final adjusted net rating from no prior to the prior. A team-season holds ${f(medianPoss, 0)} possessions at the median (the NBA's about 8,000). The registry's prior: ${models.ridgePossessions}.`,
  ''
)
table(
  ['Prior (possessions)', 'RMSE, next day', 'Pull on final net rating'],
  PRIORS.map((l, j) => [
    String(l),
    f(Math.sqrt(err[j].se / err[j].w), 3),
    f(pulls[j].sum / pulls[j].n, 2)
  ])
)

// Split-half reliability of each season's final adjusted net rating, with the registry's prior:
// the fit on each team's odd games against the fit on its even games (by date), stepped up.
const pearson = (x, y) => {
  const n = x.length
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  return sxy / Math.sqrt(sxx * syy)
}
const halves = []
for (const s of effSeasons) {
  const list = eff.filter((g) => g.season === s)
  const odd = list.filter((_, i) => i % 2 === 0)
  const even = list.filter((_, i) => i % 2 === 1)
  const a = M.fitAdjusted(odd, models.ridgePossessions)
  const b = M.fitAdjusted(even, models.ridgePossessions)
  const teams = [...a.off.keys()].filter((t) => b.off.has(t))
  const x = teams.map((t) => a.off.get(t) - a.def.get(t))
  const y = teams.map((t) => b.off.get(t) - b.def.get(t))
  const r = pearson(x, y)
  const full = M.fitAdjusted(list, models.ridgePossessions)
  const nets = [...full.off.keys()].map((t) => full.off.get(t) - full.def.get(t))
  const sd = Math.sqrt(nets.reduce((q, v) => q + v * v, 0) / nets.length)
  const games = (list.length / teams.length) * 2
  halves.push([
    label(s),
    teams.length,
    f(games, 1),
    f(r, 3),
    f(r > 0 ? (2 * r) / (1 + r) : r, 3),
    f(sd, 2)
  ])
}
say(
  `Split half, the registry's prior: the season's games alternately in two halves, each fitted, each team's net rating in one half against the other's (r), stepped up to the season (Spearman-Brown), beside the spread of the final net ratings.`,
  ''
)
table(['Season', 'Teams', 'Games a team', 'r, halves', 'Stepped up', 'Spread of net'], halves)

if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
