#!/usr/bin/env node
// Checks the on-court tables (Plan T904) against the box scores and the NBA's published lineups, per
// season, and writes the tables `nba-data-sources.md` quotes. Build first with `npm run build`; run it
// on a copy of a loaded profile, never the app's own data.
//
// usage: node scripts/check-on-off.mjs <folder holding stats.duckdb> [report.md]
//
// What it checks, regular season unless said:
// 1. Each team-game's counts summed over its units against the team box score, and the possessions
//    credited against the possessions file; the possessions file's own points against the box score.
// 2. Each player-game's on-court minutes and plus-minus against the box score.
// 3. On plus off against the team's line, for every player-game and count (must be exact).
// 4. Five-man units against `pub_lineups`, per season and season type.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folderArg, outArg] = process.argv.slice(2)
if (!folderArg) {
  console.error('usage: node scripts/check-on-off.mjs <folder> [report.md]')
  process.exit(2)
}
const { read, close } = openStatsWorker(resolve(folderArg))

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
  'ast',
  'stl',
  'blk',
  'tov',
  'pf'
]
const pct = (x) => (x === null || x === undefined ? '—' : `${(100 * Number(x)).toFixed(1)}`)
const out = []
const table = (title, note, head, rows) => {
  out.push(
    `### ${title}`,
    '',
    note,
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`
  )
  for (const r of rows) out.push(`| ${r.join(' | ')} |`)
  out.push('')
}
const timed = async (label, sql) => {
  const at = Date.now()
  const rows = await read(sql)
  console.error(`${label}: ${rows.length} rows, ${Date.now() - at} ms`)
  return rows
}

// 1. Team-games.
const teams = await timed(
  'team-games',
  `WITH u AS (
     SELECT season, game_id, team_id, ${COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')}, sum(poss) AS poss
     FROM unit_game WHERE game_type = 'regular' GROUP BY ALL),
   p AS (
     SELECT game_id, team_id, count(*) FILTER (WHERE counted) AS poss, sum(points) AS pts
     FROM possession WHERE game_type = 'regular' GROUP BY ALL)
   SELECT u.season, count(*) AS n,
          ${COUNTS.map((c) => `avg((u.${c} = t.${c})::INT) AS ${c}`).join(', ')},
          avg((${COUNTS.map((c) => `u.${c} = t.${c}`).join(' AND ')})::INT) AS all_exact,
          avg((u.poss = p.poss)::INT) AS poss_credited,
          avg((p.pts = t.pts)::INT) AS file_pts_exact,
          avg((abs(p.pts - t.pts) <= 5)::INT) AS file_pts_5
   FROM u JOIN team_game t USING (game_id, team_id) LEFT JOIN p USING (game_id, team_id)
   GROUP BY 1 ORDER BY 1`
)
table(
  'Team-games: units summed against the box score',
  'Share of regular-season team-games (%) whose count summed over the units equals the team box score; "All" is every count at once. "Poss" is the possessions credited to units against the possessions file\'s count; the last two are the possessions file\'s own points against the box score.',
  [
    'Season',
    'Team-games',
    'PTS',
    'FGA',
    'FGM',
    '3PA',
    'FTA',
    'OREB',
    'DREB',
    'AST',
    'STL',
    'BLK',
    'TOV',
    'PF',
    'All',
    'Poss',
    'File PTS exact',
    'File PTS ±5'
  ],
  teams.map((r) => [
    r.season,
    r.n,
    ...[
      'pts',
      'fga',
      'fgm',
      'fg3a',
      'fta',
      'oreb',
      'dreb',
      'ast',
      'stl',
      'blk',
      'tov',
      'pf',
      'all_exact',
      'poss_credited',
      'file_pts_exact',
      'file_pts_5'
    ].map((k) => pct(r[k]))
  ])
)

// 2. Player-games.
const players = await timed(
  'player-games',
  `SELECT o.season, count(*) AS n,
          avg((abs(o.minutes - b.minutes) <= 0.5)::INT) AS min05,
          avg((abs(o.minutes - b.minutes) <= 1)::INT) AS min1,
          avg((o.on_pts - o.on_opp_pts = b.plus_minus)::INT) AS pm,
          avg((abs(o.on_pts - o.on_opp_pts - b.plus_minus) <= 2)::INT) AS pm2,
          avg((o.p_pts = b.pts)::INT) AS own_pts
   FROM player_on_court o JOIN player_game b ON b.game_id = o.game_id AND b.player_id = o.player_id
   WHERE o.game_type = 'regular' AND b.plus_minus IS NOT NULL
   GROUP BY 1 ORDER BY 1`
)
const missing = await timed(
  'box players off the lineups',
  `SELECT b.season, count(*) AS missing
   FROM player_game b
   WHERE b.game_type = 'regular' AND b.minutes > 0 AND b.season >= 1997
     AND b.game_id IN (SELECT game_id FROM unit_game)
     AND NOT EXISTS (SELECT 1 FROM player_on_court o WHERE o.game_id = b.game_id AND o.player_id = b.player_id)
   GROUP BY 1`
)
const miss = new Map(missing.map((r) => [r.season, r.missing]))
table(
  'Player-games: on court against the box score',
  "Share of regular-season player-games (%) with the lineups' minutes within 30 seconds and a minute of the box score's, the on-court plus-minus equal to the box score's or within 2, and the player's own points from the plays equal to the box score's. \"Off the lineups\" counts box-score players with minutes the lineups never put on the floor.",
  [
    'Season',
    'Player-games',
    'MIN ±0.5',
    'MIN ±1',
    '+/- exact',
    '+/- ±2',
    'Own PTS',
    'Off the lineups'
  ],
  players.map((r) => [
    r.season,
    r.n,
    pct(r.min05),
    pct(r.min1),
    pct(r.pm),
    pct(r.pm2),
    pct(r.own_pts),
    miss.get(r.season) ?? 0
  ])
)

// 3. On plus off.
const parts = ['secs', 'poss', ...COUNTS]
const sums = await timed(
  'on plus off',
  `WITH t AS (SELECT game_id, team_id, ${parts.map((p) => `sum(${p}) AS ${p}`).join(', ')} FROM unit_game GROUP BY ALL)
   SELECT count(*) AS n,
          -- Seconds are fractional, so they agree to a microsecond rather than bit for bit.
          count(*) FILTER (WHERE NOT (${parts
            .map((p) =>
              p === 'secs'
                ? 'abs(o.on_secs + o.off_secs - t.secs) < 1e-6'
                : `o.on_${p} + o.off_${p} = t.${p}`
            )
            .join(' AND ')})) AS broken
   FROM player_on_court o JOIN t USING (game_id, team_id)`
)
out.push(
  '### On plus off',
  '',
  `On plus off equals the team's line in the game, for every count and the seconds, on ${sums[0].n - sums[0].broken} of ${sums[0].n} player-games (all seasons and types).`,
  ''
)

// 4. Five-man units against the published lineups.
const UNIT = `
  d AS (
    SELECT season, game_type, team_id, p1, p2, p3, p4, p5, count(DISTINCT game_id) AS games,
           sum(secs) / 60 AS minutes, sum(pts) AS pts, sum(fgm) AS fgm, sum(pts) - sum(opp_pts) AS pm,
           sum(poss) AS poss
    FROM unit_game WHERE complete AND game_type IN ('regular', 'playoffs') AND season >= 2008
    GROUP BY ALL)`
const units = await timed(
  'units',
  `WITH ${UNIT}
   SELECT p.season, p.game_type, count(*) AS n, avg((d.p1 IS NOT NULL)::INT) AS found,
          avg((abs(d.minutes - p.minutes) <= 1)::INT) AS min1,
          avg((abs(d.minutes - p.minutes) <= 0.1 * p.minutes + 1)::INT) AS min10,
          avg((d.pts = p.pts)::INT) AS pts, avg((abs(d.pts - p.pts) <= 2)::INT) AS pts2,
          avg((d.fgm = p.fgm)::INT) AS fgm,
          avg((d.pm = p.plus_minus)::INT) AS pm, avg((abs(d.pm - p.plus_minus) <= 2)::INT) AS pm2,
          avg((abs(d.poss - p.possessions) <= 2)::INT) AS poss2,
          avg((abs(d.poss - p.possessions) <= 0.05 * p.possessions + 1)::INT) AS poss5,
          sum(d.poss) FILTER (WHERE p.possessions > 0) / sum(p.possessions) FILTER (WHERE d.p1 IS NOT NULL) AS poss_ratio
   FROM pub_lineups p LEFT JOIN d USING (season, game_type, team_id, p1, p2, p3, p4, p5)
   WHERE p.minutes IS NOT NULL AND p.pts IS NOT NULL
   GROUP BY 1, 2 ORDER BY 2 DESC, 1`
)
table(
  'Five-man units against the published lineups',
  "Units the NBA's base file lists (its 2,000 a regular season with the most minutes, and its playoff units), joined on team, season, season type and the five ids. \"Found\" is the share Metis's count has at all; the rest are shares of those found (%): minutes within a minute and within 10 % (plus a minute), points and field goals made exact or within 2, plus-minus exact or within 2, and possessions within 2 and within 5 % (plus one) of the advanced file's. \"POSS ratio\" is Metis's possessions over the NBA's, summed over the units found.",
  [
    'Season',
    'Type',
    'Units',
    'Found',
    'MIN ±1',
    'MIN ±10%',
    'PTS',
    'PTS ±2',
    'FGM',
    '+/-',
    '+/- ±2',
    'POSS ±2',
    'POSS ±5%',
    'POSS ratio'
  ],
  units.map((r) => [
    r.season,
    r.game_type,
    r.n,
    pct(r.found),
    pct(r.min1),
    pct(r.min10),
    pct(r.pts),
    pct(r.pts2),
    pct(r.fgm),
    pct(r.pm),
    pct(r.pm2),
    pct(r.poss2),
    pct(r.poss5),
    r.poss_ratio === null ? '—' : Number(r.poss_ratio).toFixed(3)
  ])
)
const worst = await timed(
  'worst units',
  `WITH ${UNIT}
   SELECT p.season, p.game_type, tm.code AS team, p.names, round(p.minutes, 1) AS pub_min,
          round(d.minutes, 1) AS our_min, p.pts AS pub_pts, d.pts AS our_pts,
          p.plus_minus AS pub_pm, d.pm AS our_pm
   FROM pub_lineups p JOIN d USING (season, game_type, team_id, p1, p2, p3, p4, p5)
   LEFT JOIN team tm ON tm.team_id = p.team_id AND tm.season = p.season
   WHERE p.minutes IS NOT NULL
   ORDER BY abs(d.minutes - p.minutes) DESC LIMIT 10`
)
table(
  'The ten largest minute misses',
  'Units found in both, by the gap in minutes.',
  [
    'Season',
    'Type',
    'Team',
    'Unit',
    'NBA MIN',
    'Metis MIN',
    'NBA PTS',
    'Metis PTS',
    'NBA +/-',
    'Metis +/-'
  ],
  worst.map((r) => [
    r.season,
    r.game_type,
    r.team,
    r.names,
    r.pub_min,
    r.our_min,
    r.pub_pts,
    r.our_pts,
    r.pub_pm,
    r.our_pm
  ])
)

await close()
const text = out.join('\n')
if (outArg) writeFileSync(resolve(outArg), `${text}\n`)
console.log(text)
