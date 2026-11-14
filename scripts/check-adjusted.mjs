#!/usr/bin/env node
// Checks the adjusted ratings (Plan T1004) on a real load, through the built worker, and writes the
// report the data doc quotes. Per season:
//
// 1. The fit recomputed apart: the observations read here from `team_game` (one row per offense,
//    not the builder's join of `game` to both sides), the ridge normal equations built one
//    observation at a time and solved by Cholesky with no constraint rows (the builder adds games to
//    running sums and solves by elimination with the sums held at zero), as of every game day. Every
//    row of `adjusted_rating` must equal it, early dates included; ten games in is shown apart.
// 2. Identities: adjusted offensive less defensive equals net on every row; the effects sum to zero,
//    so the teams' mean adjusted offensive and defensive ratings are the league's points per 100
//    possessions, recounted here by SQL.
// 3. Against SRS (`team_strength`), final values: the correlation of adjusted net rating with SRS,
//    and the mean absolute difference once the net rating is put on a per-game scale by the league's
//    possessions a game; the plain net rating beside it as the baseline. The teams that differ most,
//    with the parts that explain it: pace (SRS counts points a game, so a fast team's margin is
//    larger than its net rating at the league's pace), blowouts (the margin beyond 20 points, which
//    a per-possession rating weighs the same) and overtime games. Ten games in as well.
// 4. The prior: predicting each day's games from the fit as of the day before, over every season,
//    for a range of priors; and what the chosen prior moves ten games in and at season's end.
// 5. The reads: a playoff scope gives its reason; a mid-season date range reads the rating as it
//    stood; the screens' queries, warm, median of five, under 500 ms.
//
// usage: node scripts/check-adjusted.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-adjusted.mjs <folder> [out.md]')
  process.exit(2)
}

/** The builder's prior, in possessions (`RIDGE_POSSESSIONS` in src/main/stats/models/adjusted.ts). */
const LAMBDA = 250
const PRIORS = [0.01, 100, 250, 500, 1000, 1500, 2000, 3000, 5000]

const { read, query, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`)
]
const out = []
const say = (...lines) => {
  for (const l of lines) {
    out.push(l)
    console.log(l)
  }
}
const problems = []
const f = (x, d = 2) => (x === null || x === undefined ? '–' : Number(x).toFixed(d))
const sg = (x, d = 2) => (x >= 0 ? `+${f(x, d)}` : f(x, d))

function corr(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxy / Math.sqrt(sxx * syy)
}

/** Solves the symmetric positive definite `a x = b` by Cholesky; `a` is n × n row-major. */
function cholesky(a, b, n) {
  const l = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i * n + j]
      for (let k = 0; k < j; k++) s -= l[i * n + k] * l[j * n + k]
      if (i === j) {
        if (s <= 0) throw new Error('not positive definite')
        l[i * n + i] = Math.sqrt(s)
      } else l[i * n + j] = s / l[j * n + j]
    }
  }
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= l[i * n + k] * y[k]
    y[i] = s / l[i * n + i]
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]
    for (let k = i + 1; k < n; k++) s -= l[k * n + i] * x[k]
    x[i] = s / l[i * n + i]
  }
  return x
}

/**
 * The normal equations, one observation at a time: columns mean, home, offense of each team,
 * defense of each team. `fit(lambda)` adds the prior to the team diagonals and solves.
 */
class Normal {
  constructor(teams) {
    this.t = teams.length
    this.index = new Map(teams.map((id, i) => [id, i]))
    this.n = 2 + 2 * this.t
    this.a = new Float64Array(this.n * this.n)
    this.b = new Float64Array(this.n)
    this.pts = 0
    this.w = 0
    this.poss = new Float64Array(this.t)
  }
  add(o) {
    const cols = [
      [0, 1],
      [1, o.x],
      [2 + this.index.get(o.off), 1],
      [2 + this.t + this.index.get(o.def), 1]
    ]
    const y = (100 * o.pts) / o.poss
    for (const [i, xi] of cols) {
      this.b[i] += o.poss * y * xi
      for (const [j, xj] of cols) this.a[i * this.n + j] += o.poss * xi * xj
    }
    this.pts += o.pts
    this.w += o.poss
    this.poss[this.index.get(o.off)] += o.poss
  }
  fit(lambda) {
    const a = Float64Array.from(this.a)
    const n = this.n
    if (a[n + 1] === 0) a[n + 1] = 1
    // A team with no game yet: its rows hold only the prior.
    for (let i = 2; i < n; i++) a[i * n + i] += lambda
    const x = cholesky(a, this.b, n)
    return { x, league: (100 * this.pts) / this.w, t: this.t }
  }
}

const rate = (fit, i) => ({
  ortg: fit.league + fit.x[2 + i],
  drtg: fit.league + fit.x[2 + fit.t + i],
  net: fit.x[2 + i] - fit.x[2 + fit.t + i],
  home: 2 * fit.x[1]
})

const seasons = (await read(`SELECT DISTINCT season FROM adjusted_rating ORDER BY season`)).map(
  (r) => r.season
)

say(
  '# Adjusted ratings: check on a real load',
  '',
  `Seasons ${label(seasons[0])} to ${label(seasons.at(-1))}. Prior ${LAMBDA} possessions on each team effect. Run ${new Date().toISOString().slice(0, 10)}.`,
  ''
)

/**
 * A neutral site, written here apart from `models/neutral.ts`: ESPN's mark, a Cup semifinal by ESPN's
 * note, the 2020 restart by its city. `BEFORE` is the rule this builder used before it took Elo's
 * helper (the mark, and the restart from July 30, 2020), to count the games that changed.
 */
const NEUTRAL = `(coalesce(e.flag, false)
  OR coalesce(e.notes ILIKE '%semifinal%' AND (e.notes ILIKE '%cup%' OR e.notes ILIKE '%tournament%'), false)
  OR coalesce(e.city = 'Lake Buena Vista', false))`
const BEFORE = `(coalesce(e.flag, false) OR (t.season = 2020 AND t.game_date >= DATE '2020-07-30'))`

/** Per season: observations, game days, the table's rows, the recomputed fits. */
const data = new Map()
for (const season of seasons) {
  const obs = await read(`
    SELECT strftime(t.game_date, '%Y-%m-%d') AS d, t.team_id AS off, t.opponent_id AS def,
           t.pts::DOUBLE AS pts, t.opp_pts::DOUBLE AS opp, t.poss_sym::DOUBLE AS poss,
           CASE WHEN ${NEUTRAL} THEN 0 WHEN t.home THEN 1 ELSE -1 END AS x,
           (${NEUTRAL}) <> (${BEFORE}) AS changed,
           t.minutes::DOUBLE AS minutes
    FROM team_game t
    JOIN game g ON g.game_id = t.game_id
    LEFT JOIN (SELECT game_id, bool_or(neutral_site) AS flag, any_value(notes_headline) AS notes,
                      any_value(venue_address_city) AS city
               FROM src_espn_schedule GROUP BY 1) e
      ON e.game_id = g.espn_game_id
    WHERE t.season = ${season} AND t.game_type = 'regular' AND t.pts IS NOT NULL
      AND t.opp_pts IS NOT NULL AND t.poss_sym > 0
    ORDER BY d`)
  const skipped = await read(`SELECT count(*)::INTEGER AS n FROM game g
    WHERE season = ${season} AND game_type = 'regular' AND played
      AND NOT EXISTS (SELECT 1 FROM team_game t WHERE t.game_id = g.game_id AND t.pts IS NOT NULL
                        AND t.opp_pts IS NOT NULL AND t.poss_sym > 0)`)
  const rows = await read(`SELECT team_id, strftime(game_date, '%Y-%m-%d') AS d, adj_poss, adj_ortg,
      adj_drtg, adj_nrtg, adj_league, adj_home FROM adjusted_rating WHERE season = ${season}
    ORDER BY d, team_id`)
  data.set(season, { obs, rows, skipped: skipped[0].n })
}

// 1 and 2.
say(
  '## 1. The table against the fit recomputed apart, and 2. the identities',
  '',
  'Every row against a fit solved here by Cholesky from the observations of `team_game`. "Ten games in": the first day the median team has played ten games.',
  ''
)
const rows1 = []
for (const season of seasons) {
  const { obs, rows, skipped } = data.get(season)
  const teams = [...new Set(obs.map((o) => o.off))].sort((a, b) => a - b)
  const normal = new Normal(teams)
  const byDay = new Map()
  for (const o of obs) {
    if (!byDay.has(o.d)) byDay.set(o.d, [])
    byDay.get(o.d).push(o)
  }
  const tableByDay = new Map()
  for (const r of rows) {
    if (!tableByDay.has(r.d)) tableByDay.set(r.d, [])
    tableByDay.get(r.d).push(r)
  }
  const games = new Map(teams.map((t) => [t, 0]))
  let worst = 0
  let worstTen = 0
  let identity = 0
  let checked = 0
  let tenDay = null
  let missingRows = 0
  const finalFits = { ten: null, end: null, tenNone: null, endNone: null }
  const days = [...byDay.keys()]
  for (const [k, d] of days.entries()) {
    const list = byDay.get(d)
    for (const o of list) {
      normal.add(o)
      games.set(o.off, games.get(o.off) + 1)
    }
    const fit = normal.fit(LAMBDA)
    const played = new Set(list.map((o) => o.off))
    const mine = tableByDay.get(d) ?? []
    if (mine.length !== played.size) missingRows += Math.abs(played.size - mine.length)
    const sorted = [...games.values()].sort((a, b) => a - b)
    const isTen = tenDay === null && sorted[Math.floor(sorted.length / 2)] >= 10
    if (isTen) tenDay = d
    for (const r of mine) {
      const want = rate(fit, normal.index.get(r.team_id))
      const diff = Math.max(
        Math.abs(r.adj_ortg - want.ortg),
        Math.abs(r.adj_drtg - want.drtg),
        Math.abs(r.adj_nrtg - want.net),
        Math.abs(r.adj_home - want.home),
        Math.abs(r.adj_league - fit.league),
        Math.abs(r.adj_poss - normal.poss[normal.index.get(r.team_id)])
      )
      worst = Math.max(worst, diff)
      if (isTen) worstTen = Math.max(worstTen, diff)
      identity = Math.max(identity, Math.abs(r.adj_ortg - r.adj_drtg - r.adj_nrtg))
      checked++
    }
    if (isTen) finalFits.ten = { d, fit, none: normal.fit(PRIORS[0]), index: normal.index }
    if (k === days.length - 1)
      finalFits.end = { d, fit, none: normal.fit(PRIORS[0]), index: normal.index }
  }
  // The league: points per 100 possessions over the season, by SQL.
  const league = await read(`SELECT 100 * sum(pts) / sum(poss_sym) AS l FROM team_game
    WHERE season = ${season} AND game_type = 'regular' AND pts IS NOT NULL AND opp_pts IS NOT NULL
      AND poss_sym > 0`)
  const end = finalFits.end
  const ends = teams.map((t) => rate(end.fit, end.index.get(t)))
  const meanO = ends.reduce((s, r) => s + r.ortg, 0) / ends.length
  const meanD = ends.reduce((s, r) => s + r.drtg, 0) / ends.length
  const leagueGap = Math.max(Math.abs(meanO - league[0].l), Math.abs(meanD - league[0].l))
  if (worst > 1e-8 || identity > 1e-9 || missingRows > 0 || leagueGap > 1e-8)
    problems.push(
      `${label(season)}: table ${worst}, identity ${identity}, rows ${missingRows}, league ${leagueGap}`
    )
  data.get(season).fits = finalFits
  data.get(season).teams = teams
  const neutralGames = obs.filter((o) => o.x === 0).length / 2
  const changedGames = obs.filter((o) => o.changed).length / 2
  rows1.push([
    label(season),
    obs.length / 2,
    skipped,
    checked,
    missingRows,
    worst.toExponential(1),
    tenDay ?? '–',
    worstTen.toExponential(1),
    identity.toExponential(1),
    f(league[0].l, 2),
    leagueGap.toExponential(1),
    sg(end.fit.x[1] * 2, 2),
    neutralGames,
    changedGames
  ])
}
say(
  ...table(
    [
      'Season',
      'Games fitted',
      'Played, no box score',
      'Rows',
      'Rows missing',
      'Largest difference',
      'Ten games in',
      'Difference then',
      'ORtg − DRtg − NRtg',
      'League pts/100',
      'Team mean − league',
      'Home court, final',
      'Neutral games',
      'Changed from the old rule'
    ],
    rows1
  ),
  ''
)

// 3.
say(
  '## 3. Against SRS',
  '',
  "Final values: each team's last row of `adjusted_rating` and of `team_strength`. Per game: the net rating × the league's possessions a team-game / 100. r: the correlation with SRS; MAD: the mean absolute difference from SRS, in points a game. The plain net rating is 100 × (points − points allowed) / possessions over the season. Differences are adjusted per game less SRS.",
  ''
)
const rows3 = []
const rows3ten = []
const notes = []
for (const season of seasons) {
  const { obs } = data.get(season)
  const pace = obs.reduce((s, o) => s + o.poss, 0) / obs.length
  const finals = await read(`
    WITH a AS (SELECT team_id, arg_max(adj_nrtg, game_date) AS adj FROM adjusted_rating
               WHERE season = ${season} GROUP BY 1),
         s AS (SELECT team_id, arg_max(srs, game_date) AS srs, arg_max(mov, game_date) AS mov
               FROM team_strength WHERE season = ${season} GROUP BY 1)
    SELECT a.team_id, t.code AS abbr, a.adj, s.srs, s.mov FROM a JOIN s USING (team_id)
    JOIN team t ON t.team_id = a.team_id AND t.season = ${season} ORDER BY 1`)
  // Per team from the observations: plain net, own pace, overtime games, the margin beyond 20.
  const per = new Map()
  for (const o of obs) {
    const p = per.get(o.off) ?? { pts: 0, opp: 0, poss: 0, g: 0, ot: 0 }
    p.pts += o.pts
    p.opp += o.opp
    p.poss += o.poss
    p.g++
    if (o.minutes > 241) p.ot++
    per.set(o.off, p)
  }
  const margins = await read(`SELECT team_id, sum(points_for - points_against)::DOUBLE AS m,
      sum(greatest(least(points_for - points_against, 20), -20))::DOUBLE AS capped,
      count(*)::INTEGER AS g
    FROM team_game WHERE season = ${season} AND game_type = 'regular' GROUP BY 1`)
  const mar = new Map(margins.map((m) => [m.team_id, m]))
  const end = data.get(season).fits.end
  const adj = []
  const none = []
  const plainPg = []
  const srs = []
  const detail = []
  for (const r of finals) {
    const p = per.get(r.team_id)
    if (!p) continue
    const plain = (100 * (p.pts - p.opp)) / p.poss
    const a = (r.adj * pace) / 100
    adj.push(r.adj)
    // The same games with no prior: what the prior's pull toward 0 moves, per game.
    const unshrunk = rate(end.none, end.index.get(r.team_id)).net
    none.push(unshrunk)
    srs.push(r.srs)
    plainPg.push({ plain, pg: (plain * pace) / 100 })
    const m = mar.get(r.team_id)
    detail.push({
      abbr: r.abbr,
      diff: a - r.srs,
      adj: a,
      srs: r.srs,
      // What the team's own pace adds to a per-game margin over the league's.
      pacePart: (r.adj * (p.poss / p.g - pace)) / 100,
      blowPart: (m.m - m.capped) / m.g,
      priorPart: ((r.adj - unshrunk) * pace) / 100,
      ot: p.ot
    })
  }
  const mad = adj.reduce((s, x, i) => s + Math.abs((x * pace) / 100 - srs[i]), 0) / adj.length
  const madNone = none.reduce((s, x, i) => s + Math.abs((x * pace) / 100 - srs[i]), 0) / none.length
  const madPlain = plainPg.reduce((s, x, i) => s + Math.abs(x.pg - srs[i]), 0) / adj.length
  detail.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
  const reason = (d) => {
    // SRS is points a game, so it counts what the pace and blowouts add; adjusted net is per
    // possession, and the gap runs the other way of each part.
    const parts = [
      ['pace', -d.pacePart],
      ['blowouts', -d.blowPart],
      ['prior', d.priorPart]
    ].sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    const main = parts[0]
    const said =
      Math.abs(main[1]) >= 0.25 && Math.sign(main[1]) === Math.sign(d.diff)
        ? `${main[0]} ${sg(main[1])}`
        : 'schedule'
    return `${d.abbr} ${sg(d.diff)} (${said}${d.ot >= 8 ? `, ${d.ot} OT games` : ''})`
  }
  rows3.push([
    label(season),
    adj.length,
    f(pace, 1),
    f(corr(adj, srs), 3),
    f(mad, 2),
    f(corr(none, srs), 3),
    f(madNone, 2),
    f(
      corr(
        plainPg.map((x) => x.plain),
        srs
      ),
      3
    ),
    f(madPlain, 2),
    detail.slice(0, 2).map(reason).join('; ')
  ])
  notes.push({ season, detail })

  // Ten games in: each team's row as of that day in both tables.
  const ten = data.get(season).fits.ten
  if (ten) {
    const asOf = await read(`
      WITH a AS (SELECT team_id, arg_max(adj_nrtg, game_date) AS adj FROM adjusted_rating
                 WHERE season = ${season} AND game_date <= DATE '${ten.d}' GROUP BY 1),
           s AS (SELECT team_id, arg_max(srs, game_date) AS srs FROM team_strength
                 WHERE season = ${season} AND game_date <= DATE '${ten.d}' GROUP BY 1)
      SELECT a.adj, s.srs FROM a JOIN s USING (team_id)`)
    const end = data.get(season).fits.end
    const moved = (fx) =>
      data
        .get(season)
        .teams.reduce(
          (s, t) =>
            s + Math.abs(rate(fx.fit, fx.index.get(t)).net - rate(fx.none, fx.index.get(t)).net),
          0
        ) / data.get(season).teams.length
    const spread = (fx) => {
      const nets = data.get(season).teams.map((t) => rate(fx.none, fx.index.get(t)).net)
      const m = nets.reduce((s, x) => s + x, 0) / nets.length
      return Math.sqrt(nets.reduce((s, x) => s + (x - m) ** 2, 0) / nets.length)
    }
    rows3ten.push([
      label(season),
      ten.d,
      f(
        corr(
          asOf.map((r) => r.adj),
          asOf.map((r) => r.srs)
        ),
        3
      ),
      f(moved(ten), 2),
      f(spread(ten), 2),
      f(moved(end), 2),
      f(spread(end), 2)
    ])
  }
}
say(
  ...table(
    [
      'Season',
      'Teams',
      'League poss/game',
      'Adjusted r',
      'Adjusted MAD',
      'No prior r',
      'No prior MAD',
      'Plain r',
      'Plain MAD',
      'Differing most (adjusted − SRS, what explains it)'
    ],
    rows3
  ),
  ''
)
// The season in progress is a few games in: left out of the means.
const done = rows3.slice(0, -1)
const avg = (i) => done.reduce((s, r) => s + Number(r[i]), 0) / done.length
say(
  `Mean over the completed seasons: adjusted r ${f(avg(3), 3)}, MAD ${f(avg(4), 2)}; with no prior r ${f(avg(5), 3)}, MAD ${f(avg(6), 2)}; plain r ${f(avg(7), 3)}, MAD ${f(avg(8), 2)}.`,
  '',
  "The parts: pace is the adjusted net rating × (the team's possessions a game − the league's) / 100, what SRS counts and a per-possession rating does not; blowouts is the margin a game beyond ±20 points, which SRS counts in full; prior is what the prior's pull toward 0 moves the adjusted rating, per game. A part is named when it is at least 0.25 and runs the way of the gap; otherwise it is the schedule: SRS weighs games and the regression possessions, and the regression adjusts for home court.",
  ''
)

say(
  '### Ten games in, and what the prior moves',
  '',
  `r: adjusted net rating against SRS as of the day. Moved: the mean absolute change in adjusted net rating from no prior (${PRIORS[0]} possessions) to ${LAMBDA}, beside the spread (standard deviation) of the unshrunk net ratings.`,
  ''
)
say(
  ...table(
    [
      'Season',
      'Ten games in',
      'r then',
      'Moved then',
      'Spread then',
      'Moved at the end',
      'Spread at the end'
    ],
    rows3ten
  ),
  ''
)

// 4.
say(
  '## 4. Choosing the prior',
  '',
  "Each day's games predicted from the fit as of the day before (offense + defense + home court + mean), every season, every day after the first: the root mean square error in points per 100, weighted by possessions, overall and over the observations where the offense had played fewer than 20 games.",
  ''
)
const err = PRIORS.map(() => ({ all: 0, w: 0, early: 0, we: 0 }))
for (const season of seasons) {
  const { obs } = data.get(season)
  const teams = data.get(season).teams
  const normal = new Normal(teams)
  const games = new Map(teams.map((t) => [t, 0]))
  const days = [...new Set(obs.map((o) => o.d))]
  let i = 0
  for (const [k, d] of days.entries()) {
    const list = []
    while (i < obs.length && obs[i].d === d) list.push(obs[i++])
    if (k > 0) {
      const fits = PRIORS.map((l) => normal.fit(l))
      for (const o of list) {
        const y = (100 * o.pts) / o.poss
        for (const [j, fit] of fits.entries()) {
          const pred =
            fit.x[0] +
            fit.x[1] * o.x +
            fit.x[2 + normal.index.get(o.off)] +
            fit.x[2 + fit.t + normal.index.get(o.def)]
          const e = o.poss * (y - pred) ** 2
          err[j].all += e
          err[j].w += o.poss
          if (games.get(o.off) < 20) {
            err[j].early += e
            err[j].we += o.poss
          }
        }
      }
    }
    for (const o of list) {
      normal.add(o)
      games.set(o.off, games.get(o.off) + 1)
    }
  }
}
const rmse = err.map((e) => ({ all: Math.sqrt(e.all / e.w), early: Math.sqrt(e.early / e.we) }))
const best = rmse.reduce((b, r, i) => (r.all < rmse[b].all ? i : b), 0)
say(
  ...table(
    ['Prior (possessions)', 'RMSE, every day', 'RMSE, offense under 20 games'],
    PRIORS.map((l, i) => [
      i === best ? `**${l}**` : String(l),
      f(rmse[i].all, 3),
      f(rmse[i].early, 3)
    ])
  ),
  '',
  `Lowest overall: ${PRIORS[best]} possessions. The builder's: ${LAMBDA}.`,
  ''
)

// 5.
say('## 5. Reads', '')
const playoffs = await query({
  entity: 'team',
  metrics: ['team_adj_nrtg', 'team_nrtg'],
  scope: { seasons: [2025], gameTypes: ['playoffs'] },
  limit: 40
})
say(
  `- A 2024-25 playoff scope: adjusted net rating reads "${playoffs.columns[0].reason}", ${playoffs.rows.filter((r) => r.values.team_adj_nrtg.value !== null).length} values; the plain net rating has ${playoffs.rows.filter((r) => r.values.team_nrtg.value !== null).length}.`
)
if (playoffs.columns[0].reason !== 'Solved on the regular season.') problems.push('playoff reason')
const mid = await query({
  entity: 'team',
  metrics: ['team_adj_ortg', 'team_adj_drtg', 'team_adj_nrtg', 'team_adj_home'],
  scope: { seasons: [2016], dates: ['2015-10-27', '2016-01-31'] },
  limit: 40,
  ranks: false
})
const gsw = mid.rows.find((r) => r.name === 'Golden State Warriors')
const gswRow = await read(`SELECT a.*, a.game_date::VARCHAR AS d FROM adjusted_rating a
  JOIN team t ON t.team_id = a.team_id AND t.season = a.season
  WHERE a.season = 2016 AND t.name = 'Golden State Warriors' AND a.game_date <= DATE '2016-01-31'
  ORDER BY a.game_date DESC LIMIT 1`)
say(
  `- 2015-16 through Jan 31, Golden State: adjusted ORtg ${f(gsw.values.team_adj_ortg.value, 2)}, DRtg ${f(gsw.values.team_adj_drtg.value, 2)}, net ${f(gsw.values.team_adj_nrtg.value, 2)}, home court ${f(gsw.values.team_adj_home.value, 2)}; the table's row of ${gswRow[0].d}: ${f(gswRow[0].adj_ortg, 2)}, ${f(gswRow[0].adj_drtg, 2)}, ${f(gswRow[0].adj_nrtg, 2)}, ${f(gswRow[0].adj_home, 2)}.`
)
if (Math.abs(gsw.values.team_adj_nrtg.value - gswRow[0].adj_nrtg) > 1e-9) problems.push('mid read')

const median = async (fn) => {
  const times = []
  for (let i = 0; i < 6; i++) {
    const t = performance.now()
    await fn()
    if (i > 0) times.push(performance.now() - t)
  }
  times.sort((a, b) => a - b)
  return Math.round(times[2])
}
const ratings = [
  'team_mov',
  'team_srs',
  'team_adj_nrtg',
  'team_pyth_pct',
  'team_pyth_w',
  'team_pyth_l',
  'team_win_resid',
  'team_sos',
  'team_sos_left',
  'team_games_left',
  'team_adj_ortg',
  'team_adj_drtg',
  'team_adj_home'
]
const overview = [
  'team_win_pct',
  'team_point_diff',
  'team_ortg',
  'team_drtg',
  'team_nrtg',
  'team_pace',
  'team_mov',
  'team_pyth_w',
  'team_win_resid',
  'team_srs',
  'team_sos',
  'team_sos_left',
  'team_adj_ortg',
  'team_adj_drtg',
  'team_adj_nrtg'
]
const speeds = [
  [
    'Ratings preset, 2025-26',
    await median(() =>
      query({ entity: 'team', metrics: ratings, scope: { seasons: [2026] }, limit: 40 })
    )
  ],
  [
    'Ratings preset, a date range',
    await median(() =>
      query({
        entity: 'team',
        metrics: ratings,
        scope: { seasons: [2026], dates: ['2025-12-01', '2026-01-31'] },
        limit: 40
      })
    )
  ],
  [
    'Ratings by season, every season',
    await median(() =>
      query({
        entity: 'team',
        metrics: ratings,
        scope: { seasons },
        groupBy: ['season'],
        limit: 2000
      })
    )
  ],
  [
    'Team overview, 2025-26 (15 metrics)',
    await median(() =>
      query({
        entity: 'team',
        metrics: overview,
        scope: { seasons: [2026] },
        transform: 'perGame',
        limit: 40
      })
    )
  ],
  [
    'Adjusted ratings by game, one team, 2025-26',
    await median(() =>
      query({
        entity: 'team',
        metrics: ['team_adj_ortg', 'team_adj_drtg', 'team_adj_nrtg'],
        scope: { seasons: [2026], teams: [String(data.get(2026)?.teams[0] ?? '')] },
        groupBy: ['game'],
        limit: 200
      })
    )
  ]
]
for (const [name, ms] of speeds) if (ms >= 500) problems.push(`${name}: ${ms} ms`)
say('', ...table(['Read', 'ms (warm, median of five)'], speeds), '')

say(
  problems.length === 0
    ? 'No problems.'
    : `Problems:\n\n${problems.map((p) => `- ${p}`).join('\n')}`
)
if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
process.exit(problems.length === 0 ? 0 : 1)
