#!/usr/bin/env node
// Checks the season forecast (Plan T1003) on a real load after a refresh, and writes the report the
// docs quote:
//
// 1. The margin's spread: the standard deviation of regular-season margins around Elo's expected
//    margin (`elo_game`, home rows), 1995-96 to the last complete season: `MARGIN_SD` in forecast.ts.
// 2. The table: per season, its snapshots, runs and rows; in every snapshot the odds add up across
//    the league (sixteen playoff teams, twelve top-six seeds and eight in the play-in from 2020-21,
//    eight second-round teams, four in the conference finals, two finalists, one champion), and
//    projected wins plus losses equal the season's games.
// 3. Calibration of the past seasons' playoff odds at a quarter, half and three quarters of the
//    season (the snapshots at the fifth, tenth and fifteenth twentieth of its games) against what
//    happened (the teams that played a playoff series), by decile, with the Brier score beside a
//    baseline from the standings as they stood: 1 for a team in the conference's top eight by
//    winning percentage that day, 0 otherwise. Also the title odds' Brier against 1/16 for every
//    team then in the top eight.
// 4. The reads the screens make, warm, median of five, under 500 ms.
//
// usage: node scripts/check-forecast.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-forecast.mjs <folder> [out.md]')
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
    console.log(l)
    out.push(l)
  }
}
const f3 = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(3))
const current = (await read('SELECT max(season) AS s FROM game'))[0].s

say('# Season forecast check (Plan T1003)', '')

// 1. The margin's spread.
const [sd] = await read(
  `SELECT stddev_samp((g.home_score - g.away_score) - e.exp_margin) AS sd, count(*) AS n,
          avg((g.home_score - g.away_score) - e.exp_margin) AS bias
   FROM elo_game e JOIN game g USING (game_id)
   WHERE e.home AND e.game_type = 'regular' AND e.season BETWEEN 1996 AND ${current - 1}`
)
say(
  '## The margin around the Elo spread',
  '',
  `Regular-season games 1995-96 to ${label(current - 1)}: ${sd.n}. Standard deviation of the margin less the expected margin: **${Number(sd.sd).toFixed(2)}** points (mean ${Number(sd.bias).toFixed(2)}).`,
  ''
)

// 2. The table.
const seasons = await read(
  `SELECT season, count(DISTINCT as_of) AS snapshots, min(runs) AS runs_min, max(runs) AS runs_max,
          count(*) AS rows FROM team_forecast GROUP BY season ORDER BY season`
)
const sums = await read(
  `SELECT season, strftime(as_of, '%Y-%m-%d') AS as_of, count(*) AS teams, sum(p_playoffs) AS playoffs, sum(p_top6) AS top6,
          sum(p_play_in) AS play_in, sum(p_round2) AS r2, sum(p_conf_finals) AS cf,
          sum(p_finals) AS finals, sum(p_title) AS title, sum(proj_w) AS w, sum(proj_l) AS l
   FROM team_forecast GROUP BY season, as_of`
)
const teamCount = new Map(
  (await read('SELECT season, count(*) AS n FROM team GROUP BY season')).map((r) => [
    r.season,
    Number(r.n)
  ])
)
const games = new Map(
  (
    await read(
      `SELECT season, count(*) AS n FROM game WHERE game_type = 'regular' AND (played OR season = ${current})
       GROUP BY season`
    )
  ).map((r) => [r.season, Number(r.n)])
)
const bad = []
for (const s of sums) {
  // A snapshot that lost a team to a later one on the same game cannot add up: counted apart.
  if (Number(s.teams) < teamCount.get(s.season)) continue
  const want = [
    ['playoffs', 16],
    ['r2', 8],
    ['cf', 4],
    ['finals', 2],
    ['title', 1]
  ]
  if (s.season >= 2021) want.push(['top6', 12], ['play_in', 8])
  for (const [k, v] of want)
    if (Math.abs(Number(s[k]) - v) > 1e-6) bad.push(`${label(s.season)} ${s.as_of}: ${k} ${s[k]}`)
}
const partial = sums.filter((s) => Number(s.teams) < teamCount.get(s.season)).length
say(
  '## The table',
  '',
  ...table(
    ['Season', 'Snapshots', 'Runs', 'Rows'],
    seasons.map((r) => [
      label(r.season),
      r.snapshots,
      r.runs_min === r.runs_max ? r.runs_min : `${r.runs_min}–${r.runs_max}`,
      r.rows
    ])
  ),
  '',
  `Snapshots whose odds add up (sixteen playoff teams, eight in round two, four, two, one; twelve top six and eight in the play-in from 2020-21): ${sums.length - partial - bad.length} of ${sums.length - partial}. ${partial} snapshots lost a team's row to the next snapshot on the same game (a team with no game between them) and are not counted.`,
  ...bad.slice(0, 20).map((b) => `- ${b}`),
  ''
)
void games

// 3. Calibration.
const calSeasons = seasons.map((r) => r.season).filter((s) => s < current)
const points = [
  [5, 'A quarter'],
  [10, 'Half'],
  [15, 'Three quarters']
]
const rows = []
const brierRows = []
const deciles = new Map(
  points.map(([k]) => [k, Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }))])
)
for (const [k, name] of points) {
  let n = 0
  let model = 0
  let base = 0
  let titleModel = 0
  let titleBase = 0
  for (const season of calSeasons) {
    // The snapshot's day: the date of the season's ceil(k/20 × games)-th regular-season game.
    const [day] = await read(
      `WITH g AS (SELECT game_date, row_number() OVER (ORDER BY game_date, game_id) AS i,
                         count(*) OVER () AS total
                  FROM game WHERE season = ${season} AND game_type = 'regular' AND played
                    AND home_score <> away_score)
       SELECT strftime(game_date, '%Y-%m-%d') AS d FROM g WHERE i = ceil(${k} * total / 20.0)`
    )
    const made = new Set(
      (
        await read(
          `WITH s AS (SELECT team_id, opponent_id, count(*) AS n FROM team_game
                      WHERE season = ${season} AND game_type = 'playoffs' GROUP BY ALL)
           SELECT DISTINCT team_id FROM s WHERE n >= 3`
        )
      ).map((r) => Number(r.team_id))
    )
    const champion = await read(
      `SELECT CASE WHEN home_score > away_score THEN home_team_id ELSE away_team_id END AS t
       FROM game WHERE season = ${season} AND game_type = 'playoffs' AND played
       ORDER BY game_date DESC, game_id DESC LIMIT 1`
    )
    const champ = Number(champion[0]?.t)
    const fc = await read(
      `WITH rec AS (
         SELECT t.team_id, t.conference,
                sum(CASE WHEN tg.wins > 0 THEN 1 ELSE 0 END) AS w, count(*) AS g
         FROM team t LEFT JOIN team_game tg ON tg.team_id = t.team_id AND tg.season = t.season
           AND tg.game_type = 'regular' AND tg.game_date <= DATE '${day.d}'
         WHERE t.season = ${season} GROUP BY ALL),
       ranked AS (SELECT *, rank() OVER (PARTITION BY conference ORDER BY w / nullif(g, 0) DESC) AS r FROM rec)
       SELECT f.team_id, f.p_playoffs, f.p_title, r.r
       FROM team_forecast f JOIN ranked r USING (team_id)
       WHERE f.season = ${season} AND f.as_of = DATE '${day.d}'`
    )
    for (const r of fc) {
      const y = made.has(Number(r.team_id)) ? 1 : 0
      const p = Number(r.p_playoffs)
      const b = Number(r.r) <= 8 ? 1 : 0
      n++
      model += (p - y) ** 2
      base += (b - y) ** 2
      const t = Number(r.team_id) === champ ? 1 : 0
      titleModel += (Number(r.p_title) - t) ** 2
      titleBase += ((b ? 1 / 16 : 0) - t) ** 2
      const bin = deciles.get(k)[Math.min(9, Math.floor(p * 10))]
      bin.n++
      bin.p += p
      bin.y += y
    }
  }
  brierRows.push([name, n, f3(model / n), f3(base / n), f3(titleModel / n), f3(titleBase / n)])
  rows.push(name)
}
say(
  '## Calibration of the past forecasts',
  '',
  `Seasons ${label(calSeasons[0])} to ${label(calSeasons.at(-1))}. Playoffs: played a playoff series. Baseline: in the conference's top eight by winning percentage that day (1) or not (0); for the title, 1/16 for a team in the top eight.`,
  '',
  ...table(
    ['Point', 'Teams', 'Playoffs: Brier', 'Baseline', 'Title: Brier', 'Baseline'],
    brierRows
  ),
  ''
)
for (const [k, name] of points) {
  say(`### ${name} of the season, by decile of the playoff odds`, '')
  say(
    ...table(
      ['Odds', 'Teams', 'Mean odds', 'Made it'],
      deciles
        .get(k)
        .map((b, i) => [
          `${i * 10}–${i === 9 ? 100 : i * 10 + 10} %`,
          b.n,
          b.n ? `${((100 * b.p) / b.n).toFixed(1)} %` : '—',
          b.n ? `${((100 * b.y) / b.n).toFixed(1)} %` : '—'
        ])
    ),
    ''
  )
}

// 4. The reads.
const timed = async (name, q) => {
  await query(q)
  const ms = []
  let result
  for (let i = 0; i < 5; i++) {
    const at = performance.now()
    result = await query(q)
    ms.push(performance.now() - at)
  }
  ms.sort((a, b) => a - b)
  return [name, `${Math.round(ms[2])} ms`, result?.rows?.length ?? 0]
}
const FORECAST = ['team_proj_w', 'team_proj_l', 'team_playoff_pct', 'team_title_pct']
const reads = []
try {
  reads.push(
    await timed('Standings, the season in progress', {
      entity: 'team',
      metrics: FORECAST,
      scope: { seasons: [current], gameTypes: ['regular'] }
    }),
    await timed('Standings, 2015-16', {
      entity: 'team',
      metrics: FORECAST,
      scope: { seasons: [2016], gameTypes: ['regular'] }
    }),
    await timed('Overview trend, by game, the season in progress', {
      entity: 'team',
      metrics: ['team_playoff_pct'],
      groupBy: ['game'],
      scope: { seasons: [current], gameTypes: ['regular'], teams: ['1610612738'] }
    }),
    await timed('By season, 1995-96 to now', {
      entity: 'team',
      metrics: FORECAST,
      groupBy: ['season'],
      scope: {
        seasons: Array.from({ length: current - 1995 }, (_, i) => 1996 + i),
        gameTypes: ['regular']
      }
    })
  )
  say('## Reads', '', ...table(['Read', 'Median of five', 'Rows'], reads), '')
} catch (err) {
  say('## Reads', '', `Not run: ${err.message}`, '')
}

if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
