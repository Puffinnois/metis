#!/usr/bin/env node
// Checks Metis's ratings and models on a league other than the NBA (Plan T1301.8), on a real load whose
// models step has run, with the code that ships (`src/main/stats/models/`, bundled with esbuild) and
// the league's registry entry (`League.models`):
//
// 1. PER, Win Shares and WS per 40 against Basketball-Reference's advanced pages (the season's ten
//    leaders in Win Shares), and SRS against its season pages, every team; pages read beforehand with
//    a plain client into the folder given by --bref (`<season>_advanced.html`, `<season>.html`).
// 2. The playoff field: each completed regular season fed to the standings, tiebreakers and bracket of
//    its era, against the teams and series actually played.
// 3. Elo's calibration out of sample (the later seasons of the fit), and the forecast's: its playoff
//    and title odds at a quarter, half and three quarters of each season against what happened, beside
//    the standings of the day; and its last snapshot against the real field.
// 4. The adjusted ratings against the impact file's RAPM (each team's players' RAPM weighted by their
//    minutes; Spearman's rank correlation per season), and their year-to-year stability.
// 5. BPM: Metis's (Basketball-Reference's NBA coefficients), Metis's refitted on the league (weighted
//    least squares on the impact file's RAPM, fitted seasons), and the impact file's own, each
//    predicting the next season's team net ratings from that season's minutes (out of sample).
// 6. Stability: pairs and labels of the league's measure.
// 7. Model metrics read through the engine against the tables, for two seasons.
//
// usage: node scripts/check-wnba-models.mjs <folder holding stats-<league>.duckdb> [out.md]
//   --league=<id> --bref=<folder of pages> --split=<first test season> (default 2012)
import { build } from 'esbuild'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folderArg, mdArg] = positional(process.argv.slice(2).filter((a) => !a.startsWith('--')))
if (!folderArg) {
  console.error('usage: node scripts/check-wnba-models.mjs <folder> [out.md] --league=<id>')
  process.exit(2)
}
const folder = resolve(folderArg)
const mdFile = mdArg ? resolve(mdArg) : null
const leagueId = leagueArg()
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const SPLIT = Number(arg('split', 2012))
const BREF = arg('bref', null)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundled = await build({
  stdin: {
    contents: `export * from './src/main/stats/models/standings'
               export * from './src/main/stats/models/playoffs'
               export * from './src/main/stats/models/random'
               export * from './src/main/stats/models/elo'
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
const label = (s) => L.seasonLabel(s)

const { read, query, close } = openStatsWorker(folder, { league: leagueId })
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
const f = (x, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : x.toFixed(d))
const num = (x) => (x === null || x === undefined ? null : Number(x))
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
const pearson = (x, y) => {
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  return sxy / Math.sqrt(sxx * syy)
}
const ranks = (xs) => {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0])
  const r = new Array(xs.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r
}
const spearman = (x, y) => pearson(ranks(x), ranks(y))
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const last = (
  await read(`SELECT max(season) AS s FROM game WHERE played AND game_type = 'regular'`)
)[0].s
const current = L.currentSeason(new Date())
say(`# ${L.name} ratings and models: checks`, '')
say(
  `On \`${folder}\` by \`scripts/check-wnba-models.mjs\`, seasons ${label(L.firstSeason)} to ${label(last)}.`,
  ''
)

// ---- 1. Against Basketball-Reference.
/** The rows of every table on a Basketball-Reference page, comments included, as data-stat maps. */
function brefRows(html) {
  const text = html.replace(/<!--|-->/g, '')
  const rows = []
  for (const tr of text.split('<tr').slice(1)) {
    const row = {}
    for (const m of tr.matchAll(/data-stat="([a-z_0-9]+)"[^>]*>(.*?)<\/t[dh]>/g)) {
      row[m[1]] = m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/<.*$/, '')
        .trim()
    }
    rows.push(row)
  }
  return rows
}
if (BREF) {
  const ours = await read(`
    SELECT c.season, p.name, c.player_id, sum(c.cmp_minutes) AS mp, sum(c.per_num) / sum(c.cmp_minutes) AS per,
           sum(c.ws) AS ws, 40 * sum(c.ws) / sum(c.cmp_minutes) AS ws40
    FROM player_composite c JOIN player p USING (player_id)
    WHERE c.game_type = 'regular' GROUP BY 1, 2, 3`)
  const bySeason = new Map()
  for (const r of ours) {
    const list = bySeason.get(r.season) ?? []
    list.push(r)
    bySeason.set(r.season, list)
  }
  const TOL = { per: 0.3, ws: 0.2, ws40: 0.005 }
  say('## 1. PER, Win Shares and SRS against Basketball-Reference', '')
  say(
    `Each season's ten leaders in Win Shares on Basketball-Reference's advanced page (a traded player's teams added, PER weighted by minutes), against Metis's regular season. Tolerances, stated before the run: PER within ${TOL.per}, WS within ${TOL.ws}, WS/40 within ${TOL.ws40} (the page rounds to 0.1, 0.1 and 0.001).`,
    ''
  )
  const summary = []
  const detail = []
  for (const s of [...bySeason.keys()].sort((a, b) => a - b)) {
    const file = join(BREF, `${s}_advanced.html`)
    if (!existsSync(file)) continue
    const rows = brefRows(readFileSync(file, 'utf8')).filter((r) => r.player && r.ws !== undefined)
    const players = new Map()
    for (const r of rows) {
      const key = norm(r.player)
      const p = players.get(key) ?? { name: r.player, mp: 0, perMp: 0, ws: 0, tot: null }
      const mp = Number(r.mp) || 0
      if (r.team === 'TOT' || r.team === '2TM' || r.team === '3TM')
        p.tot = { ws: Number(r.ws), per: Number(r.per), mp }
      else {
        p.mp += mp
        p.perMp += mp * (Number(r.per) || 0)
        p.ws += Number(r.ws) || 0
      }
      players.set(key, p)
    }
    const theirs = [...players.values()].map((p) =>
      p.tot
        ? { name: p.name, ws: p.tot.ws, per: p.tot.per, mp: p.tot.mp }
        : { name: p.name, ws: p.ws, per: p.perMp / p.mp, mp: p.mp }
    )
    theirs.sort((a, b) => b.ws - a.ws)
    const mine = new Map(bySeason.get(s).map((r) => [norm(r.name), r]))
    let n = 0
    let perOk = 0
    let wsOk = 0
    let w40Ok = 0
    let missing = 0
    for (const t of theirs.slice(0, 10)) {
      const m = mine.get(norm(t.name))
      n++
      if (!m) {
        missing++
        detail.push([label(s), t.name, '–', f(t.per, 1), '–', f(t.ws, 1), '–', '–', 'not matched'])
        continue
      }
      const w40 = (40 * t.ws) / t.mp
      const dPer = m.per - t.per
      const dWs = m.ws - t.ws
      const dW40 = m.ws40 - w40
      if (Math.abs(dPer) <= TOL.per + 0.05) perOk++
      if (Math.abs(dWs) <= TOL.ws + 0.05) wsOk++
      if (Math.abs(dW40) <= TOL.ws40 + 0.0005) w40Ok++
      detail.push([
        label(s),
        t.name,
        f(m.per, 1),
        f(t.per, 1),
        f(m.ws, 1),
        f(t.ws, 1),
        f(m.ws40, 3),
        f(w40, 3),
        [
          Math.abs(dPer) > TOL.per + 0.05 && 'PER',
          Math.abs(dWs) > TOL.ws + 0.05 && 'WS',
          Math.abs(dW40) > TOL.ws40 + 0.0005 && 'WS/40'
        ]
          .filter(Boolean)
          .join(', ') || 'within'
      ])
    }
    summary.push([label(s), n, n - missing, perOk, wsOk, w40Ok])
  }
  table(['Season', 'Leaders', 'Matched', 'PER within', 'WS within', 'WS/40 within'], summary)
  say('Every leader, Metis first and Basketball-Reference second:', '')
  table(['Season', 'Player', 'PER', 'B-R', 'WS', 'B-R', 'WS/40', 'B-R', 'Outside'], detail)

  // SRS, every team of every season.
  const srs = await read(`
    SELECT s.season, t.name, arg_max(s.srs, s.game_date) AS srs, arg_max(s.mov, s.game_date) AS mov
    FROM team_strength s JOIN team t ON t.team_id = s.team_id AND t.season = s.season
    GROUP BY 1, 2`)
  const srsRows = []
  let within = 0
  let total = 0
  const worst = []
  for (const s of [...new Set(srs.map((r) => r.season))].sort((a, b) => a - b)) {
    const file = join(BREF, `${s}.html`)
    if (!existsSync(file)) continue
    const theirs = new Map(
      brefRows(readFileSync(file, 'utf8'))
        .filter((r) => r.srs !== undefined && r.srs !== '' && (r.team || r.team_name))
        .map((r) => [norm((r.team ?? r.team_name).replace('*', '')), Number(r.srs)])
    )
    let n = 0
    let ok = 0
    let maxGap = 0
    for (const r of srs.filter((x) => x.season === s)) {
      const t = theirs.get(norm(r.name))
      if (t === undefined) continue
      n++
      const gap = Math.abs(r.srs - t)
      maxGap = Math.max(maxGap, gap)
      if (gap <= 0.055) ok++
      else worst.push([label(s), r.name, f(r.srs, 2), f(t, 2)])
    }
    within += ok
    total += n
    srsRows.push([label(s), n, ok, f(maxGap, 2)])
  }
  say(
    `SRS after each team's last regular-season game against the season page's SRS, every team: tolerance 0.05 (the page rounds to 0.01). ${within} of ${total} within.`,
    ''
  )
  table(['Season', 'Teams matched', 'Within 0.05', 'Largest gap'], srsRows)
  if (worst.length) table(['Season', 'Team', 'Metis', 'B-R'], worst)
}

// ---- 2. The playoff field.
const teamsOf = new Map()
for (const t of await read(
  `SELECT season, team_id, conference, division FROM team ORDER BY season, team_id`
)) {
  const list = teamsOf.get(t.season) ?? []
  list.push({ id: Number(t.team_id), conference: t.conference, division: t.division })
  teamsOf.set(t.season, list)
}
const allGames = await read(`
  SELECT season, game_id, game_type, strftime(game_date, '%Y-%m-%d') AS date, home_team_id AS home,
         away_team_id AS away, (home_score - away_score)::DOUBLE AS margin
  FROM game WHERE played AND home_score <> away_score AND game_type IN ('regular', 'playoffs')
    AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  ORDER BY game_date, game_id`)
for (const g of allGames) {
  g.home = Number(g.home)
  g.away = Number(g.away)
}
const playoffSeasons = [
  ...new Set(allGames.filter((g) => g.game_type === 'playoffs').map((g) => g.season))
]
  .filter((s) => s <= last)
  .sort((a, b) => a - b)
const realPlayoffs = new Map()
for (const s of playoffSeasons) {
  const games = allGames.filter((g) => g.season === s && g.game_type === 'playoffs')
  const series = new Map()
  for (const g of games) {
    const key = [g.home, g.away].sort((a, b) => a - b).join('-')
    const x = series.get(key) ?? { first: g.home, wins: new Map(), start: g.date }
    const winner = g.margin > 0 ? g.home : g.away
    x.wins.set(winner, (x.wins.get(winner) ?? 0) + 1)
    series.set(key, x)
  }
  const teams = new Set(games.flatMap((g) => [g.home, g.away]))
  const finalGame = games[games.length - 1]
  const champion = finalGame.margin > 0 ? finalGame.home : finalGame.away
  realPlayoffs.set(s, { teams, series, champion })
}
const fieldRows = []
let fieldOk = 0
let pairsOk = 0
let pairsTotal = 0
let homeOk = 0
let homeTotal = 0
const fieldMiss = []
for (const s of playoffSeasons) {
  const teams = teamsOf.get(s)
  const lg = M.makeLeague(teams)
  const index = new Map(lg.ids.map((id, i) => [id, i]))
  const rec = new M.Records(lg.ids.length)
  for (const g of allGames.filter((x) => x.season === s && x.game_type === 'regular')) {
    if (index.has(g.home) && index.has(g.away))
      rec.add(index.get(g.home), index.get(g.away), g.margin)
  }
  const rules = M.rulesOf(s, L)
  const { tb, conferences } = M.seedConferences(lg, rec, rules, M.rng(s))
  const brackets = conferences.map((c) => M.playIn(c.order, rules, rec, () => true).bracket)
  const field = new Set(brackets.flat().map((i) => lg.ids[i]))
  const real = realPlayoffs.get(s)
  const sameField = field.size === real.teams.size && [...field].every((t) => real.teams.has(t))
  if (sameField) fieldOk++
  else
    fieldMiss.push(
      `${label(s)}: code ${[...field].filter((t) => !real.teams.has(t)).join(', ')} in, real ${[
        ...real.teams
      ]
        .filter((t) => !field.has(t))
        .join(', ')} in`
    )
  // The series the code forms when every series goes the way it really went.
  let seasonPairs = 0
  let seasonOk = 0
  const play = (h, a) => {
    const key = [lg.ids[h], lg.ids[a]].sort((x, y) => x - y).join('-')
    const x = real.series.get(key)
    if (!x) return h < a
    const hw = x.wins.get(lg.ids[h]) ?? 0
    const aw = x.wins.get(lg.ids[a]) ?? 0
    return hw > aw
  }
  const formed = []
  const seriesPlay = (h, a, n) => {
    formed.push([h, a])
    return play(h, a, n)
  }
  M.playBracket(brackets, rules, tb, seriesPlay, () => undefined)
  const seen = new Set()
  for (const [h, a] of formed) {
    const key = [lg.ids[h], lg.ids[a]].sort((x, y) => x - y).join('-')
    if (seen.has(key)) continue
    seen.add(key)
    seasonPairs++
    const x = real.series.get(key)
    if (x) {
      seasonOk++
      if (!rules.neutralPlayoffs) {
        homeTotal++
        if (lg.ids[h] === x.first) homeOk++
      }
    }
  }
  pairsTotal += seasonPairs
  pairsOk += seasonOk
  if (seasonOk < seasonPairs) {
    const code = (i) => teams[i]?.id
    const names = new Map(
      (await read(`SELECT team_id, code FROM team WHERE season = ${s}`)).map((r) => [
        Number(r.team_id),
        r.code
      ])
    )
    fieldMiss.push(
      `${label(s)}: the code's seeds ${conferences
        .map((c) =>
          c.order
            .slice(0, rules.teams)
            .map((i) => names.get(code(i)))
            .join(' ')
        )
        .join(' / ')}; series played ${[...real.series.keys()]
        .map((k) =>
          k
            .split('-')
            .map((t) => names.get(Number(t)))
            .join('-')
        )
        .join(', ')}`
    )
  }
  fieldRows.push([
    label(s),
    `${rules.field} ${rules.teams}`,
    real.teams.size,
    sameField ? 'yes' : '**no**',
    `${seasonOk} of ${seasonPairs} (real ${real.series.size})`
  ])
}
say('## 2. The playoff field, per season', '')
say(
  `Each completed regular season fed to the standings, the ${L.name}'s tiebreakers and its era's bracket (\`League.models.playoffs\`), every series then going the way it went. The field matches in ${fieldOk} of ${playoffSeasons.length} seasons; ${pairsOk} of ${pairsTotal} series the code forms were played; the host of each series' first game matches in ${homeOk} of ${homeTotal} (seasons at one site left out).`,
  ''
)
table(['Season', 'Format', 'Real teams', 'Same field', 'Series formed and played'], fieldRows)
if (fieldMiss.length) say(...fieldMiss.map((m) => `- ${m}`), '')

// ---- 3. Calibration.
const elo = await read(`
  SELECT season, game_type, win_prob AS p, (elo > elo_pre) AS won FROM elo_game WHERE home`)
const eloLater = elo.filter((r) => r.season >= SPLIT)
const tenths = Array.from({ length: 10 }, () => ({ n: 0, p: 0, w: 0, ll: 0 }))
for (const r of eloLater) {
  const t = tenths[Math.min(9, Math.floor(r.p * 10))]
  t.n++
  t.p += r.p
  t.w += r.won ? 1 : 0
  t.ll += -Math.log(r.won ? r.p : 1 - r.p)
}
say('## 3. Calibration', '')
say(
  `Elo from \`elo_game\`, the home side's probability before each game against the result, ${label(SPLIT)} to ${label(last)} (out of sample: the constants were fitted on earlier seasons): ${eloLater.length} games, Brier ${f(M.brier(eloLater.map((r) => ({ p: r.p, won: r.won }))), 4)}, log loss ${f(M.logLoss(eloLater.map((r) => ({ p: r.p, won: r.won }))), 4)}.`,
  ''
)
table(
  ['Tenth', 'Games', 'Given %', 'Won %', 'Log loss'],
  tenths.map((t, i) => [
    `${i * 10}–${i * 10 + 10} %`,
    t.n,
    t.n ? f((100 * t.p) / t.n, 1) : '–',
    t.n ? f((100 * t.w) / t.n, 1) : '–',
    t.n ? f(t.ll / t.n, 3) : '–'
  ])
)

const fc = await read(`
  SELECT season, team_id, strftime(as_of, '%Y-%m-%d') AS as_of, p_playoffs, p_title, runs
  FROM team_forecast ORDER BY season, as_of`)
const points = [
  ['A quarter', 5],
  ['Half', 10],
  ['Three quarters', 15]
]
const calib = []
const decileRows = []
const deciles = Array.from({ length: 10 }, () => ({ n: 0, p: 0, made: 0 }))
let finalOk = 0
let finalN = 0
for (const [name, k] of points) {
  const pairs = []
  const base = []
  const title = []
  const titleBase = []
  for (const s of playoffSeasons) {
    const rows = fc.filter((r) => r.season === s)
    if (rows.length === 0) continue
    const days = [...new Set(rows.map((r) => r.as_of))].sort()
    const day = days[k - 1]
    if (!day) continue
    const real = realPlayoffs.get(s)
    const rules = M.rulesOf(s, L)
    const teams = teamsOf.get(s)
    // The standings that day: top of each conference (or the league) by winning percentage.
    const rec = new Map(teams.map((t) => [t.id, { w: 0, g: 0, c: t.conference }]))
    for (const g of allGames.filter(
      (x) => x.season === s && x.game_type === 'regular' && x.date <= day
    )) {
      for (const [t, won] of [
        [g.home, g.margin > 0],
        [g.away, g.margin < 0]
      ]) {
        const x = rec.get(t)
        if (!x) continue
        x.g++
        x.w += won ? 1 : 0
      }
    }
    const groups =
      rules.field === 'league'
        ? [[...rec.keys()]]
        : ['east', 'west'].map((c) => [...rec.keys()].filter((t) => rec.get(t).c === c))
    const top = new Set(
      groups.flatMap((ids) =>
        ids
          .sort(
            (a, b) =>
              rec.get(b).w / Math.max(1, rec.get(b).g) - rec.get(a).w / Math.max(1, rec.get(a).g)
          )
          .slice(0, rules.teams)
      )
    )
    const fieldSize = top.size
    for (const t of teams) {
      const mine = rows.filter((r) => Number(r.team_id) === t.id && r.as_of <= day).at(-1)
      if (!mine) continue
      const made = real.teams.has(t.id)
      pairs.push({ p: mine.p_playoffs, won: made })
      base.push({ p: top.has(t.id) ? 1 : 0, won: made })
      title.push({ p: mine.p_title, won: real.champion === t.id })
      titleBase.push({ p: top.has(t.id) ? 1 / fieldSize : 0, won: real.champion === t.id })
      if (k === 5) {
        const d = deciles[Math.min(9, Math.floor(mine.p_playoffs * 10))]
        d.n++
        d.p += mine.p_playoffs
        d.made += made ? 1 : 0
      }
    }
  }
  calib.push([
    name,
    pairs.length,
    f(M.brier(pairs), 3),
    f(M.brier(base), 3),
    f(M.brier(title), 3),
    f(M.brier(titleBase), 3)
  ])
}
for (const s of playoffSeasons) {
  const rows = fc.filter((r) => r.season === s)
  if (rows.length === 0) continue
  const day = [...new Set(rows.map((r) => r.as_of))].sort().at(-1)
  const real = realPlayoffs.get(s)
  for (const t of teamsOf.get(s)) {
    const mine = rows.filter((r) => Number(r.team_id) === t.id && r.as_of <= day).at(-1)
    if (!mine) continue
    finalN++
    if (mine.p_playoffs >= 0.5 === real.teams.has(t.id)) finalOk++
  }
}
say(
  `The forecast (\`team_forecast\`, ${label(models.forecastFirstSeason)} on), playoff and title odds at the fifth, tenth and fifteenth of twenty snapshots against the teams that played in the playoffs and the champion; the baseline is the standings of the day (1 for a team in the field's places by winning percentage, 0 otherwise; for the title 1 over the field's size).`,
  ''
)
table(['Point', 'Team-seasons', 'Playoffs: Brier', 'Baseline', 'Title: Brier', 'Baseline'], calib)
for (const [i, d] of deciles.entries())
  decileRows.push([
    `${i * 10}–${i * 10 + 10} %`,
    d.n,
    d.n ? f((100 * d.p) / d.n, 1) : '–',
    d.n ? f((100 * d.made) / d.n, 1) : '–'
  ])
say('Playoff odds by decile at a quarter of the season:', '')
table(['Decile', 'Teams', 'Given %', 'Made it %'], decileRows)
say(
  `Each season's last snapshot, after its last regular-season game: a team given 50 % or more is a team in the real field for ${finalOk} of ${finalN} team-seasons.`,
  ''
)

// ---- 4. Adjusted ratings against RAPM.
const adj = await read(`
  SELECT season, team_id, arg_max(adj_nrtg, game_date) AS net FROM adjusted_rating GROUP BY 1, 2`)
const rapm = await read(`
  SELECT i.season, t.team_id, sum(i.rapm * i.min) / sum(i.min) * 5 AS rapm
  FROM src_wnba_impact i JOIN team t ON abs(t.team_id) = i.team_id AND t.season = i.season
  WHERE i.season_type = 'Regular Season' AND i.min > 0 GROUP BY 1, 2`)
const rapmOf = new Map(rapm.map((r) => [`${r.season}|${r.team_id}`, r.rapm]))
const adjRows = []
const yty = { x: [], y: [] }
const adjOf = new Map(adj.map((r) => [`${r.season}|${r.team_id}`, r.net]))
for (const s of [...new Set(adj.map((r) => r.season))].sort((a, b) => a - b)) {
  const rows = adj.filter((r) => r.season === s && rapmOf.has(`${r.season}|${r.team_id}`))
  const thin = models.adjustedThin.includes(s)
  adjRows.push([
    label(s) + (thin ? ' (not shown)' : ''),
    rows.length,
    rows.length > 2
      ? f(
          spearman(
            rows.map((r) => r.net),
            rows.map((r) => rapmOf.get(`${r.season}|${r.team_id}`))
          ),
          3
        )
      : '–'
  ])
  for (const r of adj.filter((x) => x.season === s)) {
    const next = adjOf.get(`${s + 1}|${r.team_id}`)
    if (next !== undefined) {
      yty.x.push(r.net)
      yty.y.push(next)
    }
  }
}
say('## 4. Adjusted ratings against RAPM', '')
say(
  "Each team's final adjusted net rating against its players' regular-season RAPM in the impact file (SportsDataverse's), weighted by minutes and times five: Spearman's rank correlation per season.",
  ''
)
table(['Season', 'Teams', 'Rank correlation'], adjRows)
say(
  `Year to year: a team's final adjusted net rating against its next season's, ${yty.x.length} pairs: r ${f(pearson(yty.x, yty.y), 3)}.`,
  ''
)

// ---- 5. BPM.
const lines = await read(`
  WITH box AS (
    SELECT season, player_id, team_id, sum(minutes)::DOUBLE AS mp, sum(pts)::DOUBLE AS pts, sum(fg3m)::DOUBLE AS fg3m,
           sum(ast)::DOUBLE AS ast, sum(tov)::DOUBLE AS tov, sum(oreb)::DOUBLE AS oreb, sum(dreb)::DOUBLE AS dreb,
           sum(stl)::DOUBLE AS stl, sum(blk)::DOUBLE AS blk, sum(pf)::DOUBLE AS pf, sum(fga)::DOUBLE AS fga,
           sum(fta)::DOUBLE AS fta
    FROM player_game WHERE game_type = 'regular' GROUP BY 1, 2, 3 HAVING sum(minutes) > 0
  ), tm AS (
    SELECT season, team_id, sum(minutes)::DOUBLE AS mp, sum(pts)::DOUBLE AS pts, sum(opp_pts)::DOUBLE AS opp,
           sum(fga + 0.44 * fta)::DOUBLE AS tsa, sum(poss_sym)::DOUBLE AS poss
    FROM team_game WHERE game_type = 'regular' AND box_games = 1 GROUP BY 1, 2
  )
  SELECT b.*, c.position_num / c.cmp_minutes AS position, c.role_num / c.cmp_minutes AS role,
         c.bpm_num / c.cmp_minutes AS metis, tm.mp AS team_mp, tm.pts AS team_pts, tm.opp AS team_opp,
         tm.tsa AS team_tsa, tm.poss AS team_poss
  FROM box b JOIN tm USING (season, team_id)
  JOIN player_composite c ON c.season = b.season AND c.player_id = b.player_id AND c.team_id = b.team_id
    AND c.game_type = 'regular'`)
const impact = await read(`
  SELECT season, player_id, rapm / impact_poss AS rapm, bpm / impact_poss AS bpm, impact_poss AS w
  FROM pub_player_impact WHERE game_type = 'regular' AND impact_poss > 0`)
const impactOf = new Map(impact.map((r) => [`${r.season}|${r.player_id}`, r]))
const BOX = ['pts', 'fg3m', 'ast', 'tov', 'oreb', 'dreb', 'stl', 'blk', 'pf']
/** BPM's terms of one line: each rate per 100 team possessions on the floor, at position 1 and 5. */
function features(r) {
  const share = r.mp / (r.team_mp / 5)
  const per100 = (x) => (100 * x) / (share * r.team_poss)
  const tsa = r.fga + 0.44 * r.fta
  const adjPts = r.pts + (1 - r.team_pts / r.team_tsa) * tsa
  const at = (x) => [1 - (x - 1) / 4, (x - 1) / 4]
  const [p1, p5] = at(r.position)
  const [r1, r5] = at(r.role)
  const v = []
  for (const c of BOX) {
    const rate = per100(c === 'pts' ? adjPts : r[c])
    v.push(rate * p1, rate * p5)
  }
  for (const c of ['fga', 'fta']) {
    const rate = per100(r[c])
    v.push(rate * r1, rate * r5)
  }
  v.push(r.position >= 3 ? 0 : (3 - r.position) / 2, r.role - 3, 1)
  return { v, share }
}
function solve(a, b, n) {
  for (let i = 0; i < n; i++) {
    let p = i
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r * n + i]) > Math.abs(a[p * n + i])) p = r
    for (let c = 0; c < n; c++) [a[i * n + c], a[p * n + c]] = [a[p * n + c], a[i * n + c]]
    ;[b[i], b[p]] = [b[p], b[i]]
    for (let r = i + 1; r < n; r++) {
      const k = a[r * n + i] / a[i * n + i]
      for (let c = i; c < n; c++) a[r * n + c] -= k * a[i * n + c]
      b[r] -= k * b[i]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]
    for (let c = i + 1; c < n; c++) s -= a[i * n + c] * x[c]
    x[i] = s / a[i * n + i]
  }
  return x
}
const feats = lines.map((r) => ({ r, ...features(r) }))
const nf = feats[0].v.length
const A = new Float64Array(nf * nf)
const B = new Float64Array(nf)
let trainRows = 0
for (const x of feats) {
  if (x.r.season >= SPLIT) continue
  const t = impactOf.get(`${x.r.season}|${x.r.player_id}`)
  if (!t || !Number.isFinite(x.v[0])) continue
  const w = x.r.mp
  trainRows++
  for (let i = 0; i < nf; i++) {
    B[i] += w * x.v[i] * t.rapm
    for (let j = 0; j < nf; j++) A[i * nf + j] += w * x.v[i] * x.v[j]
  }
}
// A small ridge keeps the solve steady where two terms move together.
for (let i = 0; i < nf; i++) A[i * nf + i] += 1e-6 * A[i * nf + i] + 1e-9
const beta = solve(Array.from(A), Array.from(B), nf)
// The refit BPM of each line, with BPM's team adjustment: one constant per team so the players'
// values weighted by their share of the floor time add up to the team rating Metis's BPM targets.
const byTeam = new Map()
for (const x of feats) {
  const key = `${x.r.season}|${x.r.team_id}`
  const list = byTeam.get(key) ?? []
  list.push(x)
  byTeam.set(key, list)
}
const refitOf = new Map()
for (const list of byTeam.values()) {
  const raw = list.map((x) => x.v.reduce((s, v, i) => s + v * beta[i], 0))
  const target = list.reduce((s, x) => s + x.share * x.r.metis, 0)
  const shares = list.reduce((s, x) => s + x.share, 0)
  const k = (target - list.reduce((s, x, i) => s + x.share * raw[i], 0)) / shares
  list.forEach((x, i) => refitOf.set(`${x.r.season}|${x.r.player_id}|${x.r.team_id}`, raw[i] + k))
}
// Each player's season value (minutes-weighted over teams) by option.
const seasonValue = (pick) => {
  const acc = new Map()
  for (const x of feats) {
    const key = `${x.r.season}|${x.r.player_id}`
    const v = pick(x)
    if (v === null || !Number.isFinite(v)) continue
    const a = acc.get(key) ?? { s: 0, m: 0 }
    a.s += v * x.r.mp
    a.m += x.r.mp
    acc.set(key, a)
  }
  return new Map([...acc].map(([k, a]) => [k, a.s / a.m]))
}
const options = [
  ['Metis, NBA coefficients', seasonValue((x) => x.r.metis)],
  [
    'Metis, refitted on the league',
    seasonValue((x) => refitOf.get(`${x.r.season}|${x.r.player_id}|${x.r.team_id}`))
  ],
  ['Impact file, as published', new Map(impact.map((r) => [`${r.season}|${r.player_id}`, r.bpm]))]
]
// Next season's team net rating per 100 from this season's values and next season's minutes.
const teamNext = new Map()
for (const list of byTeam.values()) {
  const r0 = list[0].r
  teamNext.set(`${r0.season}|${r0.team_id}`, {
    season: r0.season,
    actual: (100 * (r0.team_pts - r0.team_opp)) / r0.team_poss,
    list
  })
}
const REPLACEMENT = -2
const bpmRows = []
for (const [name, values] of options) {
  const errs = { later: [], earlier: [] }
  const xs = { later: [[], []], earlier: [[], []] }
  for (const t of teamNext.values()) {
    if (t.season === L.firstSeason) continue
    let pred = 0
    for (const x of t.list)
      pred += x.share * (values.get(`${t.season - 1}|${x.r.player_id}`) ?? REPLACEMENT)
    const part = t.season > SPLIT ? 'later' : 'earlier'
    errs[part].push((pred - t.actual) ** 2)
    xs[part][0].push(pred)
    xs[part][1].push(t.actual)
  }
  // Against the same season's RAPM, possession-weighted correlation over players with 500+ minutes.
  const sx = []
  const sy = []
  for (const [key, v] of values) {
    const t = impactOf.get(key)
    if (t && t.w >= 1000 && Number(key.split('|')[0]) >= SPLIT) {
      sx.push(v)
      sy.push(t.rapm)
    }
  }
  bpmRows.push([
    name,
    f(Math.sqrt(mean(errs.earlier)), 2),
    f(pearson(...xs.earlier), 3),
    f(Math.sqrt(mean(errs.later)), 2),
    f(pearson(...xs.later), 3),
    errs.later.length,
    f(pearson(sx, sy), 3)
  ])
}
say('## 5. BPM: the options measured', '')
say(
  `Three values per player-season: Metis's BPM with Basketball-Reference's NBA coefficients, Metis's refitted on the ${L.name} (weighted least squares of the impact file's RAPM on BPM's terms at positions 1 and 5, ${trainRows} player-team lines of ${label(L.firstSeason)} to ${label(SPLIT - 1)}, then BPM's team adjustment), and the impact file's BPM as published. Each predicts every team's next-season net rating per 100 from its players' values and their next-season share of the floor time (a player with none counts at replacement, −2): RMSE and r, earlier seasons (the refit's own) and later ones (out of sample).`,
  ''
)
table(
  [
    'Option',
    'RMSE, earlier',
    'r, earlier',
    'RMSE, later',
    'r, later',
    'Team-seasons later',
    'r with RAPM, later (1,000+ poss)'
  ],
  bpmRows
)

// ---- 6. Stability.
const stab = await read(
  `SELECT * FROM metric_stability WHERE season = (SELECT max(season) FROM metric_stability)`
)
const labels = new Map()
for (const r of stab)
  labels.set(r.reliability ?? 'none', (labels.get(r.reliability ?? 'none') ?? 0) + 1)
const reasons = new Map()
for (const r of stab.filter((x) => x.reliability === null))
  reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1)
say('## 6. Stability', '')
say(
  `\`metric_stability\` measured through ${label(stab[0]?.through)}: ${stab.length} metrics; labels ${[...labels].map(([k, v]) => `${k} ${v}`).join(', ')}.`,
  ''
)
table(
  ['Reason a metric has no label', 'Metrics'],
  [...reasons].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])
)
const KEYS = [
  'pts',
  'reb',
  'ast',
  'ts_pct',
  'per',
  'ws',
  'ws_48',
  'bpm',
  'team_srs',
  'team_elo',
  'team_adj_nrtg',
  'team_net_rtg',
  'team_pace',
  'team_pyth_w'
]
table(
  ['Metric', 'Year to year', 'Pairs', 'Split half', 'Half pairs', 'Label', 'Seasons'],
  stab
    .filter((r) => KEYS.includes(r.metric_id))
    .sort((a, b) => KEYS.indexOf(a.metric_id) - KEYS.indexOf(b.metric_id))
    .map((r) => [
      r.metric_id,
      f(num(r.year_to_year), 3),
      r.pairs,
      f(num(r.split_half), 3),
      r.half_pairs,
      r.reliability ?? r.reason,
      r.first_season ? `${label(r.first_season)}–${label(r.last_season)}` : '–'
    ])
)

// ---- 7. Through the engine.
const recount = []
for (const season of [current <= last ? last : current, 2005]) {
  const player = await query({
    entity: 'player',
    metrics: ['per', 'ws', 'ws_48'],
    scope: { seasons: [season], gameTypes: ['regular'] },
    groupBy: [],
    sort: { metric: 'ws', dir: 'desc' },
    limit: 10,
    ranks: false
  })
  const tbl = new Map(
    (
      await read(`
      SELECT player_id, sum(per_num) / sum(cmp_minutes) AS per, sum(ws) AS ws, 40 * sum(ws) / sum(cmp_minutes) AS ws40
      FROM player_composite WHERE season = ${season} AND game_type = 'regular' GROUP BY 1`)
    ).map((r) => [String(r.player_id), r])
  )
  let pd = 0
  for (const r of player.rows) {
    const t = tbl.get(r.id)
    pd = Math.max(
      pd,
      Math.abs(r.values.per.value - t.per),
      Math.abs(r.values.ws.value - t.ws),
      Math.abs(r.values.ws_48.value - t.ws40)
    )
  }
  recount.push([
    label(season),
    'players: PER, WS, WS/40 (top ten by WS)',
    player.rows.length,
    pd.toExponential(1)
  ])
  const teamMetrics = [
    'team_srs',
    'team_elo',
    'team_adj_nrtg',
    'team_pyth_w',
    'team_proj_w',
    'team_playoff_pct'
  ]
  const team = await query({
    entity: 'team',
    metrics: teamMetrics,
    scope: { seasons: [season], gameTypes: ['regular'] },
    groupBy: [],
    ranks: false
  })
  const ttbl = new Map(
    (
      await read(`
      WITH g AS (
        SELECT team_id, sum(pts)::DOUBLE AS pf, sum(opp_pts)::DOUBLE AS pa, sum((pts > opp_pts)::INT) AS w,
               sum((pts < opp_pts)::INT) AS l
        FROM team_game WHERE season = ${season} AND game_type = 'regular' GROUP BY 1
      )
      SELECT g.team_id, (SELECT arg_max(srs, game_date) FROM team_strength s WHERE s.season = ${season} AND s.team_id = g.team_id) AS srs,
             (SELECT arg_max(elo, (game_date, game_id)) FROM elo_game e WHERE e.season = ${season} AND e.team_id = g.team_id AND e.game_type = 'regular') AS elo,
             (SELECT arg_max(adj_nrtg, game_date) FROM adjusted_rating a WHERE a.season = ${season} AND a.team_id = g.team_id) AS adj,
             (SELECT arg_max(proj_w, (game_date, as_of)) FROM team_forecast f WHERE f.season = ${season} AND f.team_id = g.team_id) AS proj_w,
             (SELECT arg_max(p_playoffs, (game_date, as_of)) FROM team_forecast f WHERE f.season = ${season} AND f.team_id = g.team_id) AS p_playoffs,
             (g.w + g.l) * pow(g.pf, ${models.pythagoreanExponent}) / (pow(g.pf, ${models.pythagoreanExponent}) + pow(g.pa, ${models.pythagoreanExponent})) AS pyth_w
      FROM g`)
    ).map((r) => [String(r.team_id), r])
  )
  let td = 0
  let compared = 0
  for (const r of team.rows) {
    const t = ttbl.get(r.id)
    if (!t) continue
    const pairs = [
      [r.values.team_srs.value, t.srs],
      [r.values.team_elo.value, t.elo],
      [r.values.team_adj_nrtg.value, t.adj],
      [r.values.team_pyth_w.value, t.pyth_w],
      [r.values.team_proj_w.value, t.proj_w],
      [r.values.team_playoff_pct.value, t.p_playoffs]
    ]
    for (const [a, b] of pairs) {
      if (a === null && b === null) continue
      if (a === null || b === null) {
        td = Infinity
        continue
      }
      td = Math.max(td, Math.abs(a - b))
      compared++
    }
  }
  recount.push([
    label(season),
    `teams: ${teamMetrics.join(', ')}`,
    `${team.rows.length} (${compared} values)`,
    td.toExponential(1)
  ])
}
say('## 7. Model metrics through the engine', '')
say(
  'Each metric read through the engine (`runQuery`) against the same value read from its table by SQL: the largest difference.',
  ''
)
table(['Season', 'Metrics', 'Rows', 'Largest difference'], recount)

if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
