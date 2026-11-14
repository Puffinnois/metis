#!/usr/bin/env node
// Checks team strength (Plan T1001) on a real load, through the built worker, and writes the report
// the data doc quotes. Per season:
//
// 1. `team_strength`: SRS = MOV + SOS on every row; each team's games, MOV and SOS after its last
//    game against the final scores read from `game` by SQL written apart from the builder.
// 2. SRS recounted apart: iterated as Basketball-Reference describes it (rating = MOV + average
//    opponent rating, repeated until it settles, then centred on zero), not solved, from the margins
//    read here, as of each team's last game day; the table must equal it. The league's mean final
//    rating is reported (it is zero when every team plays on the last day).
// 3. MOV and Pythagorean wins (exponent 14) recounted by SQL from `game` against the engine's
//    `team_mov`, `team_pyth_w`, `team_pyth_l` and `team_win_resid` over each whole regular season.
// 4. Final SRS, MOV and SOS against Basketball-Reference's published values for every team of four
//    seasons across the eras (`BREF` below, from each season page's team table), matched by name.
//    Tolerance: 0.005, half the last printed digit, since the published values are rounded; and 0.01,
//    since the published SRS is the rounded MOV plus the rounded SOS (0.59 + 0.53 = 1.12 where the
//    unrounded parts give 1.112). A gap past 0.01 is a problem.
// 5. The reads: a playoff scope gives its reason; a mid-season date range reads the rating as it
//    stood; the screens' queries, warm, median of five, under 500 ms.
//
// usage: node scripts/check-team-strength.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-team-strength.mjs <folder> [out.md]')
  process.exit(2)
}

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

// Basketball-Reference's team tables (MOV, SOS, SRS), as printed on each season's page.
const BREF = {
  1995: `Utah Jazz|7.99|-0.24|7.75
Seattle SuperSonics|8.18|-0.28|7.91
Orlando Magic|7.06|-0.62|6.44
San Antonio Spurs|5.96|-0.07|5.90
Chicago Bulls|4.83|-0.52|4.31
Phoenix Suns|3.88|-0.03|3.85
Portland Trail Blazers|3.82|-0.03|3.79
Indiana Pacers|3.70|-0.35|3.35
Charlotte Hornets|3.28|-0.42|2.86
New York Knicks|3.11|-0.33|2.78
Houston Rockets|2.12|0.20|2.32
Atlanta Hawks|1.28|-0.23|1.05
Denver Nuggets|0.84|0.11|0.95
Cleveland Cavaliers|0.62|-0.07|0.55
Los Angeles Lakers|-0.22|0.21|-0.01
Sacramento Kings|-1.00|0.25|-0.75
Miami Heat|-1.63|-0.22|-1.85
Boston Celtics|-1.88|-0.05|-1.92
Dallas Mavericks|-2.90|0.51|-2.40
New Jersey Nets|-3.13|-0.15|-3.28
Milwaukee Bucks|-4.37|0.06|-4.30
Golden State Warriors|-5.41|0.51|-4.91
Philadelphia 76ers|-5.07|0.01|-5.07
Washington Bullets|-5.60|0.04|-5.56
Detroit Pistons|-7.29|0.21|-7.09
Los Angeles Clippers|-9.16|0.72|-8.44
Minnesota Timberwolves|-9.00|0.78|-8.22`,
  1998: `Los Angeles Lakers|7.74|-0.86|6.88
Seattle SuperSonics|7.17|-0.84|6.33
Chicago Bulls|7.11|0.14|7.25
Utah Jazz|6.54|-0.81|5.73
Indiana Pacers|6.09|0.17|6.25
Phoenix Suns|5.18|-0.74|4.44
Miami Heat|4.93|0.17|5.09
San Antonio Spurs|3.99|-0.69|3.30
Atlanta Hawks|3.51|0.34|3.85
Cleveland Cavaliers|2.73|0.33|3.06
New York Knicks|2.46|0.28|2.74
Charlotte Hornets|2.00|0.46|2.46
Detroit Pistons|1.57|0.38|1.95
New Jersey Nets|1.57|0.31|1.89
Portland Trail Blazers|1.40|-0.57|0.83
Washington Wizards|0.59|0.53|1.12
Minnesota Timberwolves|0.71|-0.54|0.17
Houston Rockets|-0.76|-0.47|-1.22
Orlando Magic|-1.07|0.55|-0.53
Milwaukee Bucks|-1.91|0.59|-1.33
Philadelphia 76ers|-2.39|0.50|-1.89
Boston Celtics|-2.62|0.66|-1.96
Sacramento Kings|-5.59|-0.24|-5.83
Dallas Mavericks|-6.11|-0.22|-6.33
Los Angeles Clippers|-7.37|-0.16|-7.53
Vancouver Grizzlies|-7.30|-0.16|-7.47
Toronto Raptors|-9.27|0.94|-8.33
Golden State Warriors|-9.12|-0.08|-9.20
Denver Nuggets|-11.78|0.05|-11.74`,
  2008: `Boston Celtics|10.26|-0.95|9.31
Detroit Pistons|7.39|-0.72|6.67
Los Angeles Lakers|7.26|0.09|7.35
Utah Jazz|6.88|-0.01|6.87
Orlando Magic|5.46|-0.68|4.79
New Orleans Hornets|5.28|0.18|5.47
San Antonio Spurs|4.79|0.31|5.10
Houston Rockets|4.68|0.15|4.84
Phoenix Suns|5.05|0.09|5.14
Dallas Mavericks|4.54|0.17|4.70
Denver Nuggets|3.71|0.03|3.74
Toronto Raptors|2.90|-0.43|2.47
Golden State Warriors|2.21|0.17|2.38
Philadelphia 76ers|0.41|-0.23|0.19
Washington Wizards|-0.33|-0.28|-0.61
Cleveland Cavaliers|-0.35|-0.17|-0.52
Portland Trail Blazers|-0.98|0.46|-0.52
Indiana Pacers|-1.40|-0.46|-1.86
Atlanta Hawks|-1.82|-0.41|-2.23
Sacramento Kings|-2.26|0.40|-1.85
Chicago Bulls|-3.09|-0.11|-3.19
Charlotte Bobcats|-4.38|-0.11|-4.48
New Jersey Nets|-5.06|-0.09|-5.15
Memphis Grizzlies|-6.21|0.46|-5.75
New York Knicks|-6.61|0.07|-6.54
Minnesota Timberwolves|-6.78|0.53|-6.25
Milwaukee Bucks|-6.89|-0.02|-6.91
Los Angeles Clippers|-7.27|0.71|-6.56
Seattle SuperSonics|-8.76|0.72|-8.04
Miami Heat|-8.65|0.12|-8.53`,
  2016: `San Antonio Spurs|10.63|-0.36|10.28
Golden State Warriors|10.76|-0.38|10.38
Oklahoma City Thunder|7.28|-0.19|7.09
Cleveland Cavaliers|6.00|-0.55|5.45
Toronto Raptors|4.50|-0.42|4.08
Los Angeles Clippers|4.28|-0.15|4.13
Atlanta Hawks|3.61|-0.12|3.49
Boston Celtics|3.21|-0.37|2.84
Charlotte Hornets|2.72|-0.36|2.36
Utah Jazz|1.79|0.05|1.84
Miami Heat|1.65|-0.14|1.51
Indiana Pacers|1.71|-0.08|1.62
Portland Trail Blazers|0.83|0.15|0.98
Detroit Pistons|0.61|-0.18|0.43
Houston Rockets|0.20|0.15|0.34
Dallas Mavericks|-0.30|0.29|-0.02
Washington Wizards|-0.50|0.01|-0.49
Chicago Bulls|-1.48|0.01|-1.46
Orlando Magic|-1.62|-0.06|-1.68
Sacramento Kings|-2.48|0.16|-2.31
Memphis Grizzlies|-2.24|0.11|-2.13
New York Knicks|-2.73|0.00|-2.73
Denver Nuggets|-3.10|0.29|-2.81
Minnesota Timberwolves|-3.54|0.15|-3.38
New Orleans Pelicans|-3.79|0.24|-3.55
Milwaukee Bucks|-4.18|0.20|-3.98
Phoenix Suns|-6.66|0.34|-6.32
Brooklyn Nets|-7.35|0.24|-7.11
Los Angeles Lakers|-9.56|0.64|-8.92
Philadelphia 76ers|-10.23|0.32|-9.92`
}

/** Basketball-Reference's iteration, centred at the end: a method apart from the builder's solve. */
function iterateSrs(games) {
  const teams = new Map()
  const of = (t) => {
    if (!teams.has(t)) teams.set(t, { margin: 0, opps: [] })
    return teams.get(t)
  }
  for (const g of games) {
    of(g.home).margin += g.margin
    of(g.home).opps.push(g.away)
    of(g.away).margin -= g.margin
    of(g.away).opps.push(g.home)
  }
  let r = new Map([...teams].map(([t, x]) => [t, x.margin / x.opps.length]))
  for (let it = 0; it < 100000; it++) {
    const next = new Map()
    for (const [t, x] of teams) {
      const opp = x.opps.reduce((s, o) => s + r.get(o), 0) / x.opps.length
      next.set(t, x.margin / x.opps.length + opp)
    }
    const mean = [...next.values()].reduce((s, v) => s + v, 0) / next.size
    for (const [t, v] of next) next.set(t, v - mean)
    // Damped, since the plain iteration can oscillate between two halves of the league.
    let moved = 0
    for (const [t, v] of next) {
      const blended = 0.5 * r.get(t) + 0.5 * v
      moved = Math.max(moved, Math.abs(blended - r.get(t)))
      next.set(t, blended)
    }
    r = next
    if (moved < 1e-12) break
  }
  return r
}

const seasons = (await read(`SELECT DISTINCT season FROM team_strength ORDER BY season`)).map(
  (r) => r.season
)

// 1 and 2.
say('## 1–2. The table against the final scores, and SRS recounted apart', '')
const rows1 = []
for (const season of seasons) {
  const games = await read(`SELECT strftime(game_date, '%Y-%m-%d') AS d, home_team_id AS home,
      away_team_id AS away, (home_score - away_score)::DOUBLE AS margin
    FROM game WHERE season = ${season} AND game_type = 'regular' AND played
      AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL ORDER BY game_date`)
  const finals = await read(`SELECT team_id, strftime(max(game_date), '%Y-%m-%d') AS d,
      arg_max(srs, game_date) AS srs, arg_max(mov, game_date) AS mov, arg_max(sos, game_date) AS sos,
      arg_max(srs_games, game_date) AS n, max(abs(srs - mov - sos)) AS gap
    FROM team_strength WHERE season = ${season} GROUP BY 1`)
  const recount = await read(`WITH s AS (
      SELECT home_team_id AS t, home_score - away_score AS m FROM game
      WHERE season = ${season} AND game_type = 'regular' AND played AND away_team_id IS NOT NULL
      UNION ALL
      SELECT away_team_id, away_score - home_score FROM game
      WHERE season = ${season} AND game_type = 'regular' AND played AND home_team_id IS NOT NULL)
    SELECT t, count(*) AS n, avg(m) AS mov FROM s GROUP BY 1`)
  const byTeam = new Map(recount.map((r) => [r.t, r]))
  const lastDay = games.at(-1)?.d
  let gap = 0
  let movOff = 0
  let gamesOff = 0
  let srsOff = 0
  const cache = new Map()
  for (const t of finals) {
    gap = Math.max(gap, t.gap)
    const c = byTeam.get(t.team_id)
    if (!c || c.n !== t.n) gamesOff++
    else movOff = Math.max(movOff, Math.abs(c.mov - t.mov))
    if (!cache.has(t.d)) cache.set(t.d, iterateSrs(games.filter((g) => g.d <= t.d)))
    srsOff = Math.max(srsOff, Math.abs(cache.get(t.d).get(t.team_id) - t.srs))
  }
  const mean = finals.reduce((s, t) => s + t.srs, 0) / finals.length
  const allLast = finals.every((t) => t.d === lastDay)
  if (gap > 1e-9 || movOff > 1e-9 || gamesOff > 0 || srsOff > 1e-6) {
    problems.push(`${label(season)}: gap ${gap}, MOV ${movOff}, games ${gamesOff}, SRS ${srsOff}`)
  }
  rows1.push([
    label(season),
    finals.length,
    games.length,
    gap.toExponential(1),
    gamesOff,
    movOff.toExponential(1),
    srsOff.toExponential(1),
    mean.toExponential(1),
    allLast ? 'yes' : 'no'
  ])
}
say(
  ...table(
    [
      'Season',
      'Teams',
      'Games',
      'max |SRS − MOV − SOS|',
      'Teams whose games differ',
      'max MOV off',
      'max SRS off the iteration',
      'Mean final SRS',
      'All teams on the last day'
    ],
    rows1
  ),
  ''
)

// 3.
say('## 3. MOV and Pythagorean wins through the engine, against SQL on `game`', '')
const rows3 = []
for (const season of seasons) {
  const sql = await read(`WITH s AS (
      SELECT home_team_id AS t, home_score AS pf, away_score AS pa FROM game
      WHERE season = ${season} AND game_type = 'regular' AND played AND away_team_id IS NOT NULL
      UNION ALL
      SELECT away_team_id, away_score, home_score FROM game
      WHERE season = ${season} AND game_type = 'regular' AND played AND home_team_id IS NOT NULL)
    SELECT t, count(*) AS g, sum((pf > pa)::INT) AS w, sum((pf < pa)::INT) AS l,
      sum(pf)::DOUBLE AS pf, sum(pa)::DOUBLE AS pa FROM s GROUP BY 1`)
  const res = await query({
    entity: 'team',
    metrics: ['team_mov', 'team_pyth_pct', 'team_pyth_w', 'team_pyth_l', 'team_win_resid'],
    scope: { seasons: [season] },
    limit: 40,
    ranks: false
  })
  const byId = new Map(res.rows.map((r) => [Number(r.id), r.values]))
  let worst = 0
  let missing = 0
  for (const t of sql) {
    const v = byId.get(t.t)
    if (!v) {
      missing++
      continue
    }
    const p = t.pf ** 14 / (t.pf ** 14 + t.pa ** 14)
    const want = {
      team_mov: (t.pf - t.pa) / t.g,
      team_pyth_pct: p,
      team_pyth_w: (t.w + t.l) * p,
      team_pyth_l: (t.w + t.l) * (1 - p),
      team_win_resid: t.w - (t.w + t.l) * p
    }
    for (const [m, x] of Object.entries(want)) worst = Math.max(worst, Math.abs(v[m].value - x))
  }
  if (worst > 1e-9 || missing > 0) problems.push(`${label(season)}: sums off ${worst}, ${missing}`)
  rows3.push([label(season), sql.length, missing, worst.toExponential(1)])
}
say(...table(['Season', 'Teams', 'Missing in the engine', 'Largest difference'], rows3), '')

// 4.
say(
  '## 4. Final SRS, MOV and SOS against Basketball-Reference',
  '',
  'Tolerance 0.005: the published values are rounded to the hundredth. And 0.01: the published SRS is the rounded MOV plus the rounded SOS, so it can be up to 0.01 from the unrounded sum.',
  ''
)
const rows4 = []
const detail = []
for (const [s, text] of Object.entries(BREF)) {
  const season = Number(s)
  const res = await query({
    entity: 'team',
    metrics: ['team_srs', 'team_mov', 'team_sos'],
    scope: { seasons: [season] },
    limit: 40,
    ranks: false
  })
  const ours = new Map(res.rows.map((r) => [r.name, r.values]))
  // The NBA's names where Basketball-Reference writes another.
  const ALIASES = { 'Los Angeles Clippers': 'LA Clippers' }
  const counts = { srs: 0, mov: 0, sos: 0 }
  let within01 = 0
  let teams = 0
  let unmatched = []
  let worst = 0
  for (const line of text.split('\n')) {
    const [name, mov, sos, srs] = line.split('|')
    const v = ours.get(name) ?? ours.get(ALIASES[name])
    teams++
    if (!v) {
      unmatched.push(name)
      continue
    }
    const pairs = {
      srs: [v.team_srs.value, +srs],
      mov: [v.team_mov.value, +mov],
      sos: [v.team_sos.value, +sos]
    }
    for (const [k, [a, b]] of Object.entries(pairs)) {
      const d = Math.abs(a - b)
      if (d <= 0.005 + 1e-9) counts[k]++
      if (k === 'srs') worst = Math.max(worst, d)
      if (k === 'srs' && d <= 0.01 + 1e-9) within01++
      if (d > 0.01 + 1e-9) problems.push(`${label(season)} ${name} ${k}: ${a} against ${b}`)
      if (d > 0.005 + 1e-9) detail.push(`${label(season)} ${name} ${k}: ${f(a, 3)} against ${b}`)
    }
  }
  rows4.push([
    label(season),
    teams,
    `${counts.srs} of ${teams}`,
    `${within01} of ${teams}`,
    `${counts.mov} of ${teams}`,
    `${counts.sos} of ${teams}`,
    f(worst, 3),
    unmatched.join(', ') || '–'
  ])
}
say(
  ...table(
    [
      'Season',
      'Teams',
      'SRS within 0.005',
      'SRS within 0.01',
      'MOV within 0.005',
      'SOS within 0.005',
      'Largest SRS gap',
      'Not matched by name'
    ],
    rows4
  ),
  ''
)
if (detail.length) say('Outside 0.005:', '', ...detail.map((d) => `- ${d}`), '')

// 5.
say('## 5. Reads', '')
const playoffs = await query({
  entity: 'team',
  metrics: ['team_srs', 'team_mov'],
  scope: { seasons: [2025], gameTypes: ['playoffs'] },
  limit: 40
})
say(
  `- A 2024-25 playoff scope: SRS reads "${playoffs.columns[0].reason}", MOV ${playoffs.columns[1].reason === null ? 'has values' : playoffs.columns[1].reason}, ${playoffs.rows.filter((r) => r.values.team_srs.value !== null).length} SRS values.`
)
const mid = await query({
  entity: 'team',
  metrics: ['team_srs', 'team_sos', 'team_sos_left', 'team_games_left'],
  scope: { seasons: [2016], dates: ['2015-10-27', '2016-01-31'] },
  limit: 40,
  ranks: false
})
const gsw = mid.rows.find((r) => r.name === 'Golden State Warriors')
const gswRow = await read(`SELECT s.srs, s.sos, s.sos_left, s.games_left, s.game_date::VARCHAR AS d
  FROM team_strength s JOIN team t ON t.team_id = s.team_id AND t.season = s.season
  WHERE s.season = 2016 AND t.name = 'Golden State Warriors' AND s.game_date <= DATE '2016-01-31'
  ORDER BY s.game_date DESC LIMIT 1`)
say(
  `- 2015-16 through Jan 31, Golden State: SRS ${f(gsw.values.team_srs.value)}, SOS ${f(gsw.values.team_sos.value)}, SOS left ${f(gsw.values.team_sos_left.value)} over ${gsw.values.team_games_left.value} games; the table's row of ${gswRow[0].d}: ${f(gswRow[0].srs)}, ${f(gswRow[0].sos)}, ${f(gswRow[0].sos_left)}, ${gswRow[0].games_left}.`
)
const now = await read(`SELECT count(*) FILTER (NOT played) AS left_games,
    count(*) FILTER (NOT played AND (home_team_id IS NULL OR away_team_id IS NULL)) AS unnamed,
    count(*) FILTER (played) AS played
  FROM game WHERE season = (SELECT max(season) FROM game) AND game_type = 'regular'`)
say(
  `- The season in progress: ${now[0].played} regular-season games played and ${now[0].left_games} on the schedule still to come in \`game\`, ${now[0].unnamed} of them with a side not named yet.`
)

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
  'team_pyth_pct',
  'team_pyth_w',
  'team_pyth_l',
  'team_win_resid',
  'team_sos',
  'team_sos_left',
  'team_games_left'
]
const speeds = [
  [
    'Standings: PYTH W, SRS, SOS of 2025-26',
    await median(() =>
      query({
        entity: 'team',
        metrics: ['team_pyth_w', 'team_srs', 'team_sos'],
        scope: { seasons: [2026], gameTypes: ['regular'] },
        limit: 40,
        ranks: false
      })
    )
  ],
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
    'Team overview, 2025-26 (12 metrics)',
    await median(() =>
      query({
        entity: 'team',
        metrics: [
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
          'team_sos_left'
        ],
        scope: { seasons: [2026] },
        transform: 'perGame',
        limit: 40
      })
    )
  ]
]
say('', ...table(['Read', 'ms (warm, median of five)'], speeds), '')
for (const [name, ms] of speeds) if (ms >= 500) problems.push(`${name}: ${ms} ms`)

say('## Problems', '', ...(problems.length ? problems.map((p) => `- ${p}`) : ['No problems.']))
if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
