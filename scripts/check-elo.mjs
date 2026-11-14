#!/usr/bin/env node
// Checks Elo (Plan T1002) on a real load, through the built worker, and writes the report the data doc
// quotes.
//
// 1. Recount: Elo run again here, from the games read by SQL written apart from the builder, with its
//    own code for the rules (FiveThirtyEight's NBA Elo: K 20, home court 100, the margin multiplier,
//    a quarter back to 1505 between seasons, new franchises at 1300, a moved one linked); every
//    played game's ratings and probability must equal the table's, and every game still to come must
//    be rated from the latest ratings.
// 2. Conservation: a game moves no points in or out, so each season's ratings sum to what they
//    started at.
// 3. Neutral sites: what the schedule marks, per season.
// 4. Burn-in: Elo run from other starts in 1993-94 (random ratings; FiveThirtyEight's own ratings of
//    the time, when its file is given); how far each season's final ratings still differ.
// 5. The Brier score and log loss of the pre-game probabilities, per season from the first season
//    the metrics read, regular season and playoffs apart, beside two baselines: the league's home
//    win rate that season, and SRS to date turned into a probability (a normal on the margin, its
//    spread and home court fitted on the two burn-in seasons, so out of sample). A calibration table
//    by decile.
// 6. Tuning out of sample: K, home court and the carry fitted on 1995-96 to 2009-10 and scored on
//    2010-11 to 2025-26, against the published values, game by game.
// 7. FiveThirtyEight's published ratings (`nbaallelo.csv` from github.com/fivethirtyeight/data,
//    a one-off download given with --fte=<file>, never shipped or loaded by the app): the end of
//    each season against ours, and the same games run from its ratings of the time.
// 8. The reads: the screens' queries, warm, median of five, under 500 ms.
//
// usage: node scripts/check-elo.mjs <folder holding stats.duckdb> [out.md] [--fte=<nbaallelo.csv>]
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const args = process.argv.slice(2)
const [folder, mdFile] = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p))
const fteFile = args.find((a) => a.startsWith('--fte='))?.slice(6)
if (!folder) {
  console.error('usage: node scripts/check-elo.mjs <folder> [out.md] [--fte=<file>]')
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
const f = (x, d = 4) =>
  x === null || x === undefined || Number.isNaN(x) ? '–' : Number(x).toFixed(d)
const e = (x) => (x === 0 ? '0' : Number(x).toExponential(1))

/** The first season the metrics read (`ELO_FIRST_SEASON` in the catalogue). */
const FIRST_READ = 1996
const TYPES = ['regular', 'play-in', 'playoffs', 'cup-final']

// ---- The rules, written here apart from src/main/stats/models/elo.ts.
// The table's values (`ELO` in models/elo.ts), and FiveThirtyEight's published ones.
const RULES = { k: 20, hca: 80, carry: 0.65, mean: 1505, entry: 1300, first: 1500 }
const PUBLISHED = { ...RULES, hca: 100, carry: 0.75 }
const expect = (d) => 1 / (1 + 10 ** (-d / 400))
const step = (rules, homeElo, awayElo, neutral, margin) => {
  const d = homeElo - awayElo + (neutral ? 0 : rules.hca)
  const p = expect(d)
  if (margin === null) return { p, d, shift: 0 }
  const edge = margin > 0 ? d : -d
  const mult = (Math.abs(margin) + 3) ** 0.8 / (7.5 + 0.006 * edge)
  return { p, d, shift: rules.k * mult * ((margin > 0 ? 1 : 0) - p) }
}

// ---- The games, read apart from the builder.
const current = (await read('SELECT max(season) AS s FROM game'))[0].s
const games = await read(`
  WITH espn AS (
    SELECT DISTINCT ON (game_id) game_id, home_id, away_id, game_date::DATE AS d, neutral_site,
           notes_headline, venue_address_city
    FROM src_espn_schedule ORDER BY game_id, (season = file_season) DESC, file_season DESC
  )
  SELECT g.season, g.game_id, strftime(g.game_date, '%Y-%m-%d') AS d, g.game_type AS type,
         g.home_team_id::VARCHAR AS h, g.away_team_id::VARCHAR AS a, g.played,
         (g.home_score - g.away_score)::DOUBLE AS margin,
         coalesce(e.neutral_site, f.neutral_site) AS ns, coalesce(e.notes_headline, f.notes_headline) AS notes,
         coalesce(e.venue_address_city, f.venue_address_city) AS city
  FROM game g
  LEFT JOIN espn e ON e.game_id = g.espn_game_id
  LEFT JOIN team th ON th.team_id = g.home_team_id AND th.season = g.season
  LEFT JOIN team ta ON ta.team_id = g.away_team_id AND ta.season = g.season
  LEFT JOIN espn f ON g.espn_game_id IS NULL AND f.home_id = th.espn_team_id AND f.away_id = ta.espn_team_id
    AND abs(date_diff('day', f.d, g.game_date)) <= 1
  WHERE g.game_type IN ('${TYPES.join("', '")}') AND g.home_team_id IS NOT NULL AND g.away_team_id IS NOT NULL
    AND ((g.played AND g.home_score <> g.away_score) OR (NOT g.played AND g.season = ${current}))
  QUALIFY row_number() OVER (PARTITION BY g.game_id ORDER BY abs(date_diff('day', f.d, g.game_date)) NULLS LAST) = 1
  ORDER BY g.season, g.played DESC, d, g.game_id`)
for (const g of games) {
  g.margin = g.played ? g.margin : null
  g.neutral =
    g.ns === true ||
    g.type === 'cup-final' ||
    (/semifinal/i.test(g.notes ?? '') && /cup|tournament/i.test(g.notes ?? '')) ||
    g.city === 'Lake Buena Vista'
}
const seasons = [...new Set(games.map((g) => g.season))].sort((a, b) => a - b)
const bySeason = new Map(seasons.map((s) => [s, games.filter((g) => g.season === s)]))

/**
 * Elo over every season from `start` (a Map of team → rating in the first season, or null for 1500
 * each). Returns per game the pre-game ratings, probability and post-game ratings, and each season's
 * final ratings.
 */
function runAll(rules, start = null, from = seasons[0]) {
  const rows = new Map()
  const finals = new Map()
  let last = null
  for (const s of seasons.filter((x) => x >= from)) {
    const list = bySeason.get(s)
    const teams = [...new Set(list.flatMap((g) => [g.h, g.a]))]
    const r = new Map()
    if (last === null) {
      for (const t of teams) r.set(t, start?.get(t) ?? rules.first)
    } else {
      for (const t of teams)
        if (last.has(t)) r.set(t, rules.mean + (last.get(t) - rules.mean) * rules.carry)
      const arrived = teams.filter((t) => !last.has(t))
      const gone = [...last.keys()].filter((t) => !teams.includes(t))
      if (arrived.length === 1 && gone.length === 1)
        r.set(arrived[0], rules.mean + (last.get(gone[0]) - rules.mean) * rules.carry)
      for (const t of teams) if (!r.has(t)) r.set(t, rules.entry)
    }
    const startSum = [...r.values()].reduce((x, y) => x + y, 0)
    for (const g of list) {
      const hp = r.get(g.h)
      const ap = r.get(g.a)
      const { p, shift } = step(rules, hp, ap, g.neutral, g.margin)
      if (g.margin !== null) {
        r.set(g.h, hp + shift)
        r.set(g.a, ap - shift)
      }
      rows.set(g.game_id, { hp, ap, p, hpost: hp + shift, apost: ap - shift })
    }
    finals.set(s, { ratings: new Map(r), startSum })
    last = r
  }
  return { rows, finals }
}

const mine = runAll(RULES)

// ---- 1. Recount.
say('# Elo (Plan T1002): check on a real load', '')
say(
  `Seasons ${label(seasons[0])} to ${label(current)}; the season in progress is ${label(current)}.`,
  ''
)
say('## 1. The table against a recount apart', '')
const tableRows =
  await read(`SELECT season, game_id, team_id::VARCHAR AS team, home, played, elo_pre,
  opp_elo_pre, win_prob, elo, opp_elo, home_court FROM elo_game`)
const homeRows = new Map(tableRows.filter((r) => r.home).map((r) => [r.game_id, r]))
const rows1 = []
let worst = 0
for (const s of seasons) {
  const list = bySeason.get(s)
  let n = 0
  let missing = 0
  let maxPre = 0
  let maxPost = 0
  let maxP = 0
  let toCome = 0
  for (const g of list) {
    const t = homeRows.get(g.game_id)
    const m = mine.rows.get(g.game_id)
    if (!t) {
      missing++
      continue
    }
    n++
    maxPre = Math.max(maxPre, Math.abs(t.elo_pre - m.hp), Math.abs(t.opp_elo_pre - m.ap))
    maxP = Math.max(maxP, Math.abs(t.win_prob - m.p))
    if (g.margin !== null) {
      maxPost = Math.max(maxPost, Math.abs(t.elo - m.hpost), Math.abs(t.opp_elo - m.apost))
    } else {
      toCome++
      if (t.elo !== null) problems.push(`${g.game_id}: a game to come has a rating after it`)
    }
  }
  const extra = tableRows.filter((r) => r.season === s).length - 2 * n
  worst = Math.max(worst, maxPre, maxPost)
  if (missing || extra)
    problems.push(`${label(s)}: ${missing} games not in the table, ${extra} rows too many`)
  rows1.push([label(s), n, toCome, missing, extra, e(maxPre), e(maxPost), e(maxP)])
}
say(
  ...table(
    [
      'Season',
      'Games',
      'To come',
      'Missing',
      'Rows too many',
      'Largest gap before',
      'After',
      'Probability'
    ],
    rows1
  ),
  ''
)
if (worst > 1e-6) problems.push(`The recount differs by up to ${worst}`)
say(`Largest rating gap anywhere: ${e(worst)} points.`, '')

// ---- 2. Conservation.
say('## 2. Ratings conserved within a season', '')
const cons = await read(`
  WITH g AS (SELECT season, max(abs(elo + opp_elo - elo_pre - opp_elo_pre)) AS worst
             FROM elo_game WHERE played GROUP BY 1),
  t AS (SELECT season, team_id, arg_min(elo_pre, (game_date, game_id)) AS first,
               arg_max(elo, (game_date, game_id)) FILTER (WHERE played) AS final
        FROM elo_game GROUP BY 1, 2)
  SELECT t.season, sum(first) AS first, sum(final) AS final, count(*) AS teams, any_value(g.worst) AS worst
  FROM t JOIN g USING (season) GROUP BY 1 ORDER BY 1`)
say(
  ...table(
    ['Season', 'Teams', 'Sum at the start', 'Sum at the end', 'Gap', 'Largest game imbalance'],
    cons.map((r) => [
      label(r.season),
      r.teams,
      f(r.first, 3),
      f(r.final, 3),
      e(Math.abs(r.final - r.first)),
      e(r.worst)
    ])
  ),
  ''
)
for (const r of cons)
  if (Math.abs(r.final - r.first) > 1e-6) problems.push(`${label(r.season)}: sum not conserved`)
const means = cons.map((r) => r.final / r.teams)
say(
  `The league's mean rating at a season's end runs from ${f(Math.min(...means), 1)} to ${f(Math.max(...means), 1)}: below 1505 while the expansion teams of 1995-96 and 2004-05, entered at 1300, are carried in.`,
  ''
)

// ---- 3. Neutral sites.
say('## 3. Neutral sites', '')
const neutralRows = seasons
  .map((s) => {
    const n = bySeason.get(s).filter((g) => g.neutral)
    return [
      label(s),
      n.length,
      n.filter((g) => g.ns === true).length,
      n.filter((g) => g.city === 'Lake Buena Vista').length,
      n.filter((g) => g.type === 'cup-final' || /semifinal/i.test(g.notes ?? '')).length
    ]
  })
  .filter((r) => r[1] > 0)
say(
  ...table(
    [
      'Season',
      'Neutral games',
      'ESPN marks',
      'At Lake Buena Vista (2020)',
      'Cup semifinal or final'
    ],
    neutralRows
  ),
  ''
)
const tableNeutral = await read(`SELECT count(*) / 2 AS n FROM elo_game WHERE neutral`)
const recountNeutral = games.filter((g) => g.neutral).length
say(`Neutral games in the table: ${tableNeutral[0].n}; in the recount: ${recountNeutral}.`, '')
if (Number(tableNeutral[0].n) !== recountNeutral) problems.push('Neutral games differ')

// ---- 4. Burn-in.
say('## 4. Burn-in', '')
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const teams94 = [...new Set(bySeason.get(seasons[0]).flatMap((g) => [g.h, g.a]))]
const starts = [1, 2, 3].map(() => new Map(teams94.map((t) => [t, 1500 + (rand() - 0.5) * 400])))

// FiveThirtyEight's file, when given: its rows by game and team, keyed by our ids.
let fte = null
if (fteFile) {
  const codes = await read('SELECT season, code, team_id::VARCHAR AS team FROM team')
  const idOf = new Map(codes.map((r) => [`${r.season}|${r.code}`, r.team]))
  const ours = { PHO: 'PHX', WSB: 'WAS', BRK: 'BKN', CHO: 'CHA' }
  const lines = readFileSync(fteFile, 'utf8').trim().split('\n')
  const head = lines[0].split(',')
  const col = (n) => head.indexOf(n)
  const [cY, cD, cT, cO, cEi, cEn, cP, cF, cLoc, cIsCopy] = [
    'year_id',
    'date_game',
    'team_id',
    'opp_id',
    'elo_i',
    'elo_n',
    'is_playoffs',
    'forecast',
    'game_location',
    '_iscopy'
  ].map(col)
  fte = []
  for (const line of lines.slice(1)) {
    const c = line.split(',')
    const season = Number(c[cY])
    if (season < seasons[0]) continue
    const team = idOf.get(`${season}|${ours[c[cT]] ?? c[cT]}`)
    const opp = idOf.get(`${season}|${ours[c[cO]] ?? c[cO]}`)
    const [m, d, y] = c[cD].split('/')
    fte.push({
      season,
      date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      team,
      opp,
      code: c[cT],
      eloI: Number(c[cEi]),
      eloN: Number(c[cEn]),
      playoffs: c[cP] === '1',
      forecast: Number(c[cF]),
      loc: c[cLoc],
      copy: c[cIsCopy] === '1'
    })
  }
  const unmatched = fte.filter((r) => !r.team || !r.opp)
  say(
    `FiveThirtyEight's file: ${fte.length} team-games from ${label(seasons[0])} to ${label(Math.max(...fte.map((r) => r.season)))}, ${unmatched.length} not matched to a team.`,
    ''
  )
}

const fteStart = fte
  ? new Map(
      teams94.map((t) => {
        const first = fte
          .filter((r) => r.season === seasons[0] && r.team === t)
          .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
        return [t, first ? first.eloI : 1500]
      })
    )
  : null
const alternatives = [
  ...starts.map((s, i) => [`Random ${i + 1}`, s]),
  ...(fteStart ? [["538's", fteStart]] : [])
]
const runs = alternatives.map(([name, s]) => [name, runAll(RULES, s)])
const burn = []
for (const s of seasons.filter((x) => x <= 2002)) {
  const base = mine.finals.get(s).ratings
  const cells = runs.map(([, run]) => {
    const other = run.finals.get(s).ratings
    return Math.max(...[...base.keys()].map((t) => Math.abs(base.get(t) - other.get(t))))
  })
  burn.push([label(s), ...cells.map((c) => f(c, 1))])
}
say(
  "The largest difference in any team's final rating between the run from 1500 each and a run from another start in 1993-94 (random ratings of 1300 to 1700, and FiveThirtyEight's ratings of the time when its file is given):",
  '',
  ...table(['Season', ...alternatives.map(([n]) => n)], burn),
  ''
)

// ---- 5. Brier score and log loss.
say('## 5. How well the probabilities predict', '')
const strength =
  await read(`SELECT season, team_id::VARCHAR AS team, strftime(game_date, '%Y-%m-%d') AS d, srs
  FROM team_strength ORDER BY season, team_id, game_date`)
const srsBy = new Map()
for (const r of strength) {
  const k = `${r.season}|${r.team}`
  if (!srsBy.has(k)) srsBy.set(k, [])
  srsBy.get(k).push(r)
}
/** A team's SRS before a date: its latest row before it, its final in the playoffs, else 0. */
const srsBefore = (season, team, date, playoffs) => {
  const list = srsBy.get(`${season}|${team}`) ?? []
  if (playoffs) return list.length ? list[list.length - 1].srs : 0
  let v = 0
  for (const r of list) {
    if (r.d >= date) break
    v = r.srs
  }
  return v ?? 0
}
const phi = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const dd = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const p =
    dd *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - p : p
}
const played = games.filter((g) => g.margin !== null)
const kind = (g) => (g.type === 'playoffs' || g.type === 'play-in' ? 'playoffs' : 'regular')
// The SRS baseline's spread and home court, fitted on the burn-in seasons.
const fitGames = played.filter((g) => g.season < FIRST_READ)
const srsInputs = (g) =>
  srsBefore(g.season, g.h, g.d, kind(g) === 'playoffs') -
  srsBefore(g.season, g.a, g.d, kind(g) === 'playoffs')
let best = { b: Infinity }
for (let sd = 8; sd <= 16; sd += 0.5)
  for (let hca = 0; hca <= 6; hca += 0.25) {
    let b = 0
    for (const g of fitGames) {
      const p = phi((srsInputs(g) + (g.neutral ? 0 : hca)) / sd)
      b += (p - (g.margin > 0 ? 1 : 0)) ** 2
    }
    if (b < best.b) best = { b, sd, hca }
  }
say(
  `SRS to date as a probability: Φ((SRS home − SRS away + ${best.hca} at home) / ${best.sd}), the spread and home court fitted on ${label(seasons[0])} and ${label(seasons[1])}; a team's first game reads SRS 0, a playoff game its final regular-season SRS.`,
  ''
)

const scored = played.filter((g) => g.season >= FIRST_READ)
const homeRate = new Map()
for (const s of seasons) {
  for (const k of ['regular', 'playoffs']) {
    const list = played.filter((g) => g.season === s && kind(g) === k && !g.neutral)
    homeRate.set(`${s}|${k}`, list.filter((g) => g.margin > 0).length / Math.max(1, list.length))
  }
}
const score = (list) => {
  let be = 0
  let le = 0
  let bh = 0
  let bs = 0
  for (const g of list) {
    const won = g.margin > 0 ? 1 : 0
    const p = homeRows.get(g.game_id).win_prob
    const ph = g.neutral ? 0.5 : homeRate.get(`${g.season}|${kind(g)}`)
    const ps = phi((srsInputs(g) + (g.neutral ? 0 : best.hca)) / best.sd)
    be += (p - won) ** 2
    le -= Math.log(won ? p : 1 - p)
    bh += (ph - won) ** 2
    bs += (ps - won) ** 2
  }
  const n = list.length
  return [n, f(be / n), f(le / n), f(bh / n), f(bs / n)]
}
const brierRows = []
for (const s of seasons.filter((x) => x >= FIRST_READ)) {
  const reg = scored.filter((g) => g.season === s && kind(g) === 'regular')
  const po = scored.filter((g) => g.season === s && kind(g) === 'playoffs')
  brierRows.push([label(s), ...score(reg), ...(po.length ? score(po) : ['0', '–', '–', '–', '–'])])
}
const allReg = scored.filter((g) => kind(g) === 'regular')
const allPo = scored.filter((g) => kind(g) === 'playoffs')
brierRows.push([`**${label(FIRST_READ)} to ${label(current)}**`, ...score(allReg), ...score(allPo)])
say(
  'Brier score (lower is better; 0.25 is a coin toss) and log loss in nats of the home side\'s pre-game probability. "Home rate": the league\'s home win rate that season (0.5 at a neutral site), in sample. "SRS": SRS to date. The Cup final is with the regular season; the play-in with the playoffs.',
  '',
  ...table(
    [
      'Season',
      'Regular games',
      'Elo Brier',
      'Elo log loss',
      'Home rate Brier',
      'SRS Brier',
      'Playoff games',
      'Elo Brier',
      'Elo log loss',
      'Home rate Brier',
      'SRS Brier'
    ],
    brierRows
  ),
  ''
)
const overall = score(scored)
say(
  `Every game from ${label(FIRST_READ)}: ${overall[0]} games, Elo Brier ${overall[1]}, log loss ${overall[2]}; home rate ${overall[3]}; SRS to date ${overall[4]}.`,
  ''
)

const publishedRun = runAll(PUBLISHED)
const pubPairs = scored.map((g) => [publishedRun.rows.get(g.game_id).p, g.margin > 0 ? 1 : 0])
say(
  `With FiveThirtyEight's values (home court 100, carry 0.75) the same games score Brier ${f(pubPairs.reduce((s, [p, w]) => s + (p - w) ** 2, 0) / pubPairs.length)}, log loss ${f(-pubPairs.reduce((s, [p, w]) => s + Math.log(w ? p : 1 - p), 0) / pubPairs.length)}.`,
  ''
)

const calibrate = (pairs) => {
  const bins = Array.from({ length: 10 }, (_, i) => ({ i, n: 0, p: 0, w: 0 }))
  for (const [p, w] of pairs) {
    const b = bins[Math.min(9, Math.floor(p * 10))]
    b.n++
    b.p += p
    b.w += w
  }
  return bins
}
const ours = calibrate(scored.map((g) => [homeRows.get(g.game_id).win_prob, g.margin > 0 ? 1 : 0]))
const theirs = calibrate(pubPairs)
say(
  "Calibration: the home side's probability by tenths, every game from 1995-96; the gap is the home side's wins less its mean probability. Right: with FiveThirtyEight's values.",
  '',
  ...table(
    ['Probability', 'Games', 'Mean probability', 'Home wins', 'Gap', "538's values: games", 'Gap'],
    ours
      .filter((b) => b.n > 0 || theirs[b.i].n > 0)
      .map((b) => {
        const t = theirs[b.i]
        return [
          `${b.i * 10}–${b.i * 10 + 10} %`,
          b.n,
          f(b.p / b.n, 3),
          f(b.w / b.n, 3),
          f(b.w / b.n - b.p / b.n, 3),
          t.n,
          f(t.w / t.n - t.p / t.n, 3)
        ]
      })
  ),
  ''
)

// ---- 6. Tuning out of sample.
say('## 6. Tuning out of sample', '')
const TRAIN = [FIRST_READ, 2010]
const TEST = [2011, current]
const brierOf = (run, lo, hi) => {
  let b = 0
  let n = 0
  for (const g of played) {
    if (g.season < lo || g.season > hi) continue
    const p = run.rows.get(g.game_id).p
    b += (p - (g.margin > 0 ? 1 : 0)) ** 2
    n++
  }
  return b / n
}
const grid = []
for (const k of [12, 16, 20, 24, 28])
  for (const hca of [60, 70, 80, 90, 100, 110])
    for (const carry of [0.55, 0.65, 0.75, 0.85]) {
      const run = runAll({ ...RULES, k, hca, carry })
      grid.push({ k, hca, carry, train: brierOf(run, ...TRAIN), run })
    }
grid.sort((a, b) => a.train - b.train)
const tuned = grid[0]
const pubRun = grid.find((g) => g.k === 20 && g.hca === 100 && g.carry === 0.75)
const diffs = played
  .filter((g) => g.season >= TEST[0])
  .map((g) => {
    const won = g.margin > 0 ? 1 : 0
    return (
      (tuned.run.rows.get(g.game_id).p - won) ** 2 - (pubRun.run.rows.get(g.game_id).p - won) ** 2
    )
  })
const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
const sdDiff = Math.sqrt(diffs.reduce((a, b) => a + (b - meanDiff) ** 2, 0) / (diffs.length - 1))
const se = sdDiff / Math.sqrt(diffs.length)
say(
  `A grid of K (12 to 28), home court (60 to 110) and the share kept between seasons (0.55 to 0.85), fitted on ${label(TRAIN[0])} to ${label(TRAIN[1])}, scored on ${label(TEST[0])} to ${label(TEST[1])} (${diffs.length} games):`,
  '',
  ...table(
    ['Values', 'Brier fitted on', 'Brier scored on'],
    [
      [
        `Published: K 20, home 100, keep 0.75`,
        f(pubRun.train, 5),
        f(brierOf(pubRun.run, ...TEST), 5)
      ],
      [
        `Best fitted: K ${tuned.k}, home ${tuned.hca}, keep ${tuned.carry}`,
        f(tuned.train, 5),
        f(brierOf(tuned.run, ...TEST), 5)
      ]
    ]
  ),
  '',
  `Game by game on the later seasons, the fitted values change the Brier score by ${f(meanDiff, 5)} (standard error ${f(se, 5)}).`,
  ''
)
const bestHomeTest = [...grid].sort((a, b) => brierOf(a.run, ...TEST) - brierOf(b.run, ...TEST))[0]
say(
  `For scale, the best values in hindsight on the later seasons (K ${bestHomeTest.k}, home ${bestHomeTest.hca}, keep ${bestHomeTest.carry}) score ${f(brierOf(bestHomeTest.run, ...TEST), 5)} there.`,
  ''
)

// ---- 7. FiveThirtyEight.
say("## 7. Against FiveThirtyEight's published ratings", '')
if (!fte) {
  say('Not run: no file given (--fte).', '')
} else {
  const endOf = (rows, season) => {
    const m = new Map()
    for (const r of rows
      .filter((x) => x.season === season && x.team)
      .sort((a, b) => (a.date < b.date ? -1 : 1)))
      m.set(r.team, r.eloN)
    return m
  }
  const published = runAll(PUBLISHED)
  const fromFte = runAll(PUBLISHED, fteStart)
  const rows7 = []
  for (const s of [1994, 1995, 1996, 1997, 2000, 2005, 2010, 2015]) {
    if (!mine.finals.has(s)) continue
    const theirs = endOf(fte, s)
    const cells = [mine, published, fromFte].map((run) => {
      const ours = run.finals.get(s).ratings
      const gaps = [...theirs.keys()]
        .filter((t) => ours.has(t))
        .map((t) => ours.get(t) - theirs.get(t))
      const mae = gaps.reduce((a, b) => a + Math.abs(b), 0) / gaps.length
      return [gaps.length, f(mae, 1), f(Math.max(...gaps.map(Math.abs)), 1)]
    })
    rows7.push([label(s), cells[0][0], ...cells.flatMap((c) => c.slice(1))])
  }
  say(
    "Each team's rating after its last game of the season (playoffs included), less FiveThirtyEight's: the mean gap and the largest. Three runs over our games: the table (home court 80, carry 0.65, 1500 each in 1993-94); FiveThirtyEight's values from 1500 each; FiveThirtyEight's values from its own ratings at the start of 1993-94, which leaves only what differs in the games and the rules.",
    '',
    ...table(
      [
        'Season',
        'Teams',
        'Table',
        'Largest',
        "538's values",
        'Largest',
        "538's values and start",
        'Largest'
      ],
      rows7
    ),
    ''
  )
  // Game by game, from its start: its probabilities against ours, and its neutral games we keep at home.
  const fteNeutral = fte.filter((r) => r.loc === 'N' && !r.copy)
  const ourByDate = new Map(games.map((g) => [`${g.d}|${g.h}|${g.a}`, g]))
  const ourBySides = (r) =>
    ourByDate.get(`${r.date}|${r.team}|${r.opp}`) ?? ourByDate.get(`${r.date}|${r.opp}|${r.team}`)
  const missed = fteNeutral.filter((r) => {
    const g = ourBySides(r)
    return g && !g.neutral
  })
  say(
    `FiveThirtyEight marks ${fteNeutral.length} games of ${label(seasons[0])} to 2014-15 neutral; ${missed.length} of them keep home court here, the games abroad before 2012-13 that ESPN's schedule does not mark: ${missed.map((r) => `${r.date} ${r.code}`).join(', ')}.`,
    ''
  )
  let pd = 0
  let pn = 0
  let pmax = 0
  for (const r of fte.filter((x) => !x.copy && x.loc !== 'N' && x.team && x.season >= 2011)) {
    const g = ourBySides(r)
    if (!g) continue
    const m = fromFte.rows.get(g.game_id)
    const pHome = g.h === r.team ? r.forecast : 1 - r.forecast
    pd += Math.abs(m.p - pHome)
    pmax = Math.max(pmax, Math.abs(m.p - pHome))
    pn++
  }
  say(
    `From its start, the pre-game probability of ${pn} games of 2010-11 to 2014-15 differs from FiveThirtyEight's by ${f(pd / pn, 4)} on average, ${f(pmax, 4)} at most.`,
    ''
  )
}

// ---- 8. Reads.
say('## 8. Reads', '')
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
const ratingIds = [
  'team_mov',
  'team_srs',
  'team_elo',
  'team_pyth_pct',
  'team_pyth_w',
  'team_pyth_l',
  'team_win_resid',
  'team_sos',
  'team_sos_left',
  'team_games_left',
  'team_elo_exp_w',
  'team_elo_w_over'
]
const po = await query({
  entity: 'team',
  metrics: ['team_elo', 'team_srs'],
  scope: { seasons: [2025], gameTypes: ['playoffs'] },
  limit: 40
})
say(
  `- A 2024-25 playoff scope: Elo has ${po.rows.filter((r) => r.values.team_elo.value !== null).length} values, SRS reads "${po.columns[1].reason}".`
)
const burnScope = await query({
  entity: 'team',
  metrics: ['team_elo'],
  scope: { seasons: [1995] },
  limit: 40
})
say(
  `- 1994-95: Elo reads ${burnScope.rows.filter((r) => r.values.team_elo.value !== null).length} values; notes: ${JSON.stringify(burnScope.notes)}.`,
  ''
)
const someGame = (
  await read(`SELECT game_id FROM elo_game WHERE season = ${current} AND NOT played LIMIT 1`)
)[0]?.game_id
const speeds = [
  [
    'Standings: Elo beside SRS, 2025-26',
    await median(() =>
      query({
        entity: 'team',
        metrics: ['team_pyth_w', 'team_srs', 'team_sos', 'team_elo'],
        scope: { seasons: [2026], gameTypes: ['regular'] },
        limit: 40,
        ranks: false
      })
    )
  ],
  [
    'Ratings preset, 2025-26',
    await median(() =>
      query({ entity: 'team', metrics: ratingIds, scope: { seasons: [2026] }, limit: 40 })
    )
  ],
  [
    'Ratings preset, a date range',
    await median(() =>
      query({
        entity: 'team',
        metrics: ratingIds,
        scope: { seasons: [2026], dates: ['2025-12-01', '2026-01-31'] },
        limit: 40
      })
    )
  ],
  [
    'Ratings preset, playoffs and regular season',
    await median(() =>
      query({
        entity: 'team',
        metrics: ratingIds,
        scope: { seasons: [2025], gameTypes: ['regular', 'playoffs'] },
        limit: 40
      })
    )
  ],
  [
    'Ratings by season, every season',
    await median(() =>
      query({
        entity: 'team',
        metrics: ratingIds,
        scope: { seasons: seasons.filter((s) => s >= FIRST_READ) },
        groupBy: ['season'],
        limit: 2000
      })
    )
  ],
  [
    'Elo by game, one team, 2025-26',
    await median(() =>
      query({
        entity: 'team',
        metrics: ['team_elo'],
        scope: { seasons: [2026], teams: ['1610612738'], gameTypes: TYPES.slice() },
        groupBy: ['game'],
        limit: 200
      })
    )
  ],
  [
    'A game page: both sides of one game',
    await median(() => read(`SELECT * FROM elo_game WHERE game_id = '${someGame}'`))
  ]
]
say(...table(['Read', 'ms (warm, median of five)'], speeds), '')
for (const [name, ms] of speeds) if (ms >= 500) problems.push(`${name}: ${ms} ms`)

say('## Problems', '', ...(problems.length ? problems.map((p) => `- ${p}`) : ['No problems.']))
if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
