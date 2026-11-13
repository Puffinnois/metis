#!/usr/bin/env node
// Checks the play tables against the box scores the app already trusts, on a real load, through the
// built worker: each game's final score, and each team's and player's box-score line rebuilt from
// the counting flags, per source, season and season type. Then the possessions against the team's
// points, the box score and the plays; and the running score, which should only rise. Writes the
// tables as a report.
//
// Tolerance: a line is "exact" when all 15 counts equal the box score's, and "within 1" when none is
// off by more than 1. Nothing else is tuned: a count that misses is reported, and the worst misses
// are listed with what was off.
//
// What counts toward a line, as the box score counts it:
// - points, makes and attempts, assists, steals, blocks and personal fouls: every flag;
// - rebounds and turnovers: the players' only, as the box score leaves team rebounds and team
//   turnovers out; a steal or block counts for `opponent_id`, the side that made it.
// Games are the counted types (regular season, play-in, playoffs, NBA Cup final) with an NBA box
// score, the one the app trusts.
//
// usage: node scripts/check-plays.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-plays.mjs <folder> [out.md]')
  process.exit(2)
}

const { read, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map((h, i) => (i < 2 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  ''
]

const COUNTS = [
  'pts',
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf'
]
const COUNTED = "('regular', 'play-in', 'playoffs', 'cup-final')"
const SOURCES = [
  ['nba', 'play_nba'],
  ['espn', 'play_espn']
]

// One side's lines from the flags: the actor's counts by `by`, steals and blocks by the other id.
const sums = (by) => `
  sum(pts) AS pts, sum(fgm) AS fgm, sum(fga) AS fga, sum(fg3m) AS fg3m, sum(fg3a) AS fg3a,
  sum(ftm) AS ftm, sum(fta) AS fta,
  sum(oreb) FILTER (WHERE player_id IS NOT NULL) AS oreb,
  sum(dreb) FILTER (WHERE player_id IS NOT NULL) AS dreb,
  sum(tov) FILTER (WHERE player_id IS NOT NULL) AS tov, sum(pf) AS pf, ${by}`

const diffs = (a, b) =>
  COUNTS.map((c) => `coalesce(${a}.${c}, 0) - coalesce(${b}.${c}, 0) AS d_${c}`)
const exact = COUNTS.map((c) => `d_${c} = 0`).join(' AND ')
const within1 = COUNTS.map((c) => `abs(d_${c}) <= 1`).join(' AND ')
const offBy = COUNTS.map((c) => `abs(d_${c})`).join(' + ')

function teamSql(t) {
  return `WITH actor AS (
      SELECT game_id, team_id, ${sums('sum(ast) AS ast')}
      FROM ${t} WHERE team_id IS NOT NULL GROUP BY 1, 2
    ), credit AS (
      SELECT game_id, opponent_id AS team_id, sum(stl) AS stl, sum(blk) AS blk
      FROM ${t} WHERE opponent_id IS NOT NULL GROUP BY 1, 2
    ), p AS (
      SELECT a.*, coalesce(a.oreb, 0) + coalesce(a.dreb, 0) AS reb, c.stl, c.blk
      FROM actor a LEFT JOIN credit c USING (game_id, team_id)
    )
    SELECT b.season, b.game_type, b.game_id, b.team_id, ${diffs('b', 'p').join(', ')}
    FROM team_game b JOIN p USING (game_id, team_id)
    WHERE b.source = 'nba' AND b.game_type IN ${COUNTED}`
}

function playerSql(t) {
  return `WITH actor AS (
      SELECT game_id, player_id, ${sums('0 AS x')}
      FROM ${t} WHERE player_id IS NOT NULL GROUP BY 1, 2
    ), ast AS (SELECT game_id, assist_id AS player_id, count(*) AS ast FROM ${t} WHERE assist_id IS NOT NULL GROUP BY 1, 2),
    stl AS (SELECT game_id, steal_id AS player_id, count(*) AS stl FROM ${t} WHERE steal_id IS NOT NULL GROUP BY 1, 2),
    blk AS (SELECT game_id, block_id AS player_id, count(*) AS blk FROM ${t} WHERE block_id IS NOT NULL GROUP BY 1, 2),
    p AS (
      SELECT k.game_id, k.player_id, a.* EXCLUDE (game_id, player_id, x),
             coalesce(a.oreb, 0) + coalesce(a.dreb, 0) AS reb, s.ast, st.stl, bl.blk
      FROM (SELECT game_id, player_id FROM actor UNION SELECT game_id, player_id FROM ast
            UNION SELECT game_id, player_id FROM stl UNION SELECT game_id, player_id FROM blk) k
      LEFT JOIN actor a USING (game_id, player_id) LEFT JOIN ast s USING (game_id, player_id)
      LEFT JOIN stl st USING (game_id, player_id) LEFT JOIN blk bl USING (game_id, player_id)
    ), games AS (SELECT DISTINCT game_id FROM ${t})
    SELECT b.season, b.game_type, b.game_id, b.player_id, ${diffs('b', 'p').join(', ')}
    FROM player_game b JOIN games USING (game_id) LEFT JOIN p USING (game_id, player_id)
    JOIN team_game tg ON tg.game_id = b.game_id AND tg.team_id = b.team_id
    WHERE tg.source = 'nba' AND b.game_type IN ${COUNTED}`
}

const summary = (sql) => `SELECT season, game_type, count(*)::INTEGER AS n,
    count(*) FILTER (WHERE ${exact})::INTEGER AS exact,
    count(*) FILTER (WHERE ${within1})::INTEGER AS within1,
    ${COUNTS.map((c) => `count(*) FILTER (WHERE d_${c} = 0)::INTEGER AS ${c}`).join(', ')}
  FROM (${sql}) GROUP BY 1, 2 ORDER BY 1, 2`

const worst = (sql, key) => `SELECT season, game_id, ${key}, ${offBy} AS off,
    ${COUNTS.map((c) => `d_${c}`).join(', ')}
  FROM (${sql}) WHERE NOT (${exact}) ORDER BY off DESC, game_id LIMIT 8`

// A score only goes up, and some rows after the last basket repeat an older one, so the final
// score is the highest each side reached.
const scoreSql = (t) => `WITH last AS (
    SELECT game_id, max(home_after) AS home, max(away_after) AS away
    FROM ${t} GROUP BY 1
  )
  SELECT g.season, g.game_type, count(*)::INTEGER AS games,
         count(*) FILTER (WHERE l.home = g.home_score AND l.away = g.away_score)::INTEGER AS exact
  FROM game g JOIN last l USING (game_id)
  WHERE g.played AND g.game_type IN ${COUNTED} GROUP BY 1, 2 ORDER BY 1, 2`

const TYPES = {
  regular: 'Regular',
  'play-in': 'Play-in',
  playoffs: 'Playoffs',
  'cup-final': 'Cup final'
}
const out = [
  '# Plays against the box scores',
  '',
  `Written by \`scripts/check-plays.mjs\` on ${new Date().toISOString().slice(0, 10)}. Each game's final score and each team's and player's box-score line rebuilt from the counting flags of \`play_nba\` and \`play_espn\`, against the NBA's box score that the app trusts, per season and season type. A line is exact when all 15 counts (points, FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, REB, AST, STL, BLK, TOV, PF) equal the box score's, and within 1 when none is off by more than 1. The per-count columns are the share of lines with that count exact. What the misses are is in \`nba-data-sources.md\`, "Plays".`,
  ''
]
const brief = []

for (const [source, t] of SOURCES) {
  const scores = await read(scoreSql(t))
  const teams = await read(summary(teamSql(t)))
  const players = await read(summary(playerSql(t)))
  const scoreBy = new Map(scores.map((r) => [`${r.season}:${r.game_type}`, r]))
  out.push(`## ${source === 'nba' ? 'NBA' : 'ESPN'} play by play`, '')
  for (const [name, rows] of [
    ['Team-games', teams],
    ['Player-games', players]
  ]) {
    out.push(`### ${name}`, '')
    out.push(
      ...table(
        [
          'Season',
          'Type',
          name === 'Team-games' ? 'Score exact' : 'Lines',
          ...(name === 'Team-games' ? ['Team-games'] : []),
          'Exact',
          'Within 1',
          ...COUNTS.map((c) => c.toUpperCase())
        ],
        rows.map((r) => {
          const s = scoreBy.get(`${r.season}:${r.game_type}`)
          return [
            label(r.season),
            TYPES[r.game_type] ?? r.game_type,
            ...(name === 'Team-games'
              ? [
                  s ? `${pct(s.exact, s.games)} % of ${COUNT.format(s.games)}` : '–',
                  COUNT.format(r.n)
                ]
              : [COUNT.format(r.n)]),
            pct(r.exact, r.n),
            pct(r.within1, r.n),
            ...COUNTS.map((c) => pct(r[c], r.n))
          ]
        })
      )
    )
    const reg = rows.filter((r) => r.game_type === 'regular')
    const lo = Math.min(...reg.map((r) => (100 * r.exact) / r.n))
    const hi = Math.max(...reg.map((r) => (100 * r.exact) / r.n))
    brief.push(
      `${source} ${name.toLowerCase()} exact, regular seasons: ${lo.toFixed(1)}–${hi.toFixed(1)} %`
    )
  }
  for (const [name, sql, key] of [
    ['team-games', teamSql(t), 'team_id'],
    ['player-games', playerSql(t), 'player_id']
  ]) {
    const rows = await read(worst(sql, key))
    out.push(`### The worst ${name}`, '')
    out.push(
      ...table(
        [
          'Season',
          'Game',
          key === 'team_id' ? 'Team' : 'Player',
          'Total off',
          'Off by (box − plays)'
        ],
        rows.map((r) => [
          label(r.season),
          r.game_id,
          String(r[key]),
          String(r.off),
          COUNTS.filter((c) => r[`d_${c}`] !== 0)
            .map((c) => `${c.toUpperCase()} ${r[`d_${c}`] > 0 ? '+' : ''}${r[`d_${c}`]}`)
            .join(', ')
        ])
      )
    )
  }
}

// Possessions: derived by SportsDataverse, not published by the NBA.
const poss = await read(`WITH p AS (
    SELECT game_id, team_id, sum(points) AS pts, count(*) FILTER (WHERE counted) AS n,
           sum(fg2a + fg3a) AS fga, sum(fg2m + fg3m) AS fgm, sum(fta) AS fta, sum(oreb) AS oreb,
           sum(tov) AS tov
    FROM possession GROUP BY 1, 2
  ), pl AS (
    SELECT game_id, team_id, sum(oreb) AS oreb, sum(tov) AS tov FROM play_nba GROUP BY 1, 2
  )
  SELECT t.season, t.game_type, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE p.pts = t.points_for)::INTEGER AS pts,
         count(*) FILTER (WHERE abs(p.pts - t.points_for) <= 5)::INTEGER AS pts5,
         max(abs(p.pts - t.points_for))::INTEGER AS worst,
         count(*) FILTER (WHERE p.fga = t.fga AND p.fgm = t.fgm AND p.fta = t.fta)::INTEGER AS shots,
         count(*) FILTER (WHERE p.oreb = pl.oreb)::INTEGER AS oreb,
         count(*) FILTER (WHERE p.tov = pl.tov)::INTEGER AS tov,
         median(p.n - t.poss)::DOUBLE AS vs_est,
         count(*) FILTER (WHERE abs(p.n - t.poss) <= 3)::INTEGER AS est3
  FROM team_game t JOIN p USING (game_id, team_id) LEFT JOIN pl USING (game_id, team_id)
  WHERE t.source = 'nba' AND t.game_type IN ${COUNTED}
  GROUP BY 1, 2 ORDER BY 1, 2`)
out.push(
  '## Possessions',
  '',
  "SportsDataverse's possessions, derived from the NBA's play by play. Points: the possessions' points against the team's in the box score. Shots: field-goal makes and attempts and free-throw attempts all equal the box score's. OREB and TOV: against the team's plays, team rebounds and team turnovers included. Against the estimate: counted possessions less the box score's simple estimate (FGA + 0.44 × FTA − OREB + TOV), the median, and the share within 3.",
  '',
  ...table(
    [
      'Season',
      'Type',
      'Team-games',
      'Points exact',
      'Within 5',
      'Worst',
      'Shots exact',
      'OREB',
      'TOV',
      'Median vs estimate',
      'Within 3'
    ],
    poss.map((r) => [
      label(r.season),
      TYPES[r.game_type] ?? r.game_type,
      COUNT.format(r.n),
      pct(r.pts, r.n),
      pct(r.pts5, r.n),
      String(r.worst),
      pct(r.shots, r.n),
      pct(r.oreb, r.n),
      pct(r.tov, r.n),
      r.vs_est.toFixed(1),
      pct(r.est3, r.n)
    ])
  )
)
const preg = poss.filter((r) => r.game_type === 'regular')
brief.push(
  `possession points exact, regular seasons: ${Math.min(...preg.map((r) => (100 * r.pts) / r.n)).toFixed(1)}–${Math.max(...preg.map((r) => (100 * r.pts) / r.n)).toFixed(1)} %`
)

// The running score: per source and season, the rows whose score after is below the row before's,
// or back to 0-0 once a point has been scored. Both should be 0: a score only rises. (The NBA's feed
// wrote 0-0 on every row that scores nothing before 2017-18; read as a score, it did both.)
const steps = await read(
  `${SOURCES.map(
    ([source, t]) => `SELECT '${source}' AS source, season, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE home_after < h0 OR away_after < a0)::INTEGER AS below,
         count(*) FILTER (WHERE scored > 0 AND home_after + away_after = 0)::INTEGER AS zero
  FROM (SELECT season, home_after, away_after,
               lag(home_after) OVER w AS h0, lag(away_after) OVER w AS a0, sum(pts) OVER w AS scored
        FROM ${t} WINDOW w AS (PARTITION BY game_id ORDER BY seq))
  GROUP BY season`
  ).join(' UNION ALL ')} ORDER BY source, season`
)
out.push(
  '## The running score',
  '',
  'Rows whose score after is below the row before\'s ("Below"), and rows at 0-0 once a point has been scored ("0-0"), per source and season, in the play order. Both should be 0: a score only rises.',
  '',
  ...table(
    ['Season', 'Source', 'Rows', 'Below', '0-0'],
    steps.map((r) => [
      label(r.season),
      r.source === 'nba' ? 'NBA' : 'ESPN',
      COUNT.format(r.n),
      COUNT.format(r.below),
      COUNT.format(r.zero)
    ])
  )
)
for (const source of ['nba', 'espn']) {
  const of = steps.filter((r) => r.source === source)
  brief.push(
    `${source} running score: ${of.reduce((n, r) => n + r.below, 0)} rows below the one before, ${of.reduce((n, r) => n + r.zero, 0)} at 0-0 after a point, of ${of.reduce((n, r) => n + r.n, 0)}`
  )
}

await close()
if (mdFile) writeFileSync(mdFile, `${out.join('\n')}\n`)
for (const line of brief) console.log(line)
