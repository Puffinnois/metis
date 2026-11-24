#!/usr/bin/env node
// Checks the college leagues' counts by situation (T1703.2, part 4c) on a real load, through the built
// worker, read only. Per season:
//
// 1. Against the source: each team-game's fast-break, off-turnover and paint counts recounted from
//    `src_ncaa_pbp` by SQL written apart from the builder (a made shot its value, a made free throw 1,
//    paint twos only), and each possession count from `src_ncaa_possessions`, game by game and side by
//    side; the players' counts adding up to their team's.
// 2. Across sources: the same team-games' points in the paint, on the fast break and off turnovers
//    against ESPN's box score (from 2023-24, when ESPN starts), and the possessions against
//    stats.ncaa.org's own team box (`e_poss`). Two sources' tags of the same games, so the agreement
//    is measured, not expected: the share of team-games within 2 points (2 possessions) and the mean
//    difference.
//
// usage: node scripts/check-college-situations.mjs <folder holding stats-<league>.duckdb> --league=ncaam
import { openStatsWorker, leagueArg, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
const league = leagueArg()
if (!folder || !league.startsWith('ncaa')) {
  console.error('usage: node scripts/check-college-situations.mjs <folder> --league=ncaam|ncaaw')
  process.exit(1)
}
const { read, close } = openStatsWorker(folder, { league })
const label = (s) => `${s - 1}-${String(s).slice(2)}`
const TAGS = [
  'ncaa_pts_fb',
  'ncaa_pts_offtov',
  'ncaa_pts_paint',
  'ncaa_fgm_paint',
  'ncaa_fga_paint'
]
const POSS = [
  'ncaa_poss_n',
  'ncaa_poss_first3',
  'ncaa_poss_first_rim',
  'ncaa_poss_first_two',
  'ncaa_poss_first_none',
  'ncaa_poss_ast'
]

const made = (when) =>
  `sum(CASE WHEN ${when} AND p.event_result = 'made' THEN CASE WHEN p.event_type = 'Free Throw' THEN 1 ELSE p.shot_value END ELSE 0 END)`
const fileTags = `
  SELECT g.season, g.game_id, p.event_team AS side,
    ${made('p.is_fastbreak')} AS ncaa_pts_fb, ${made('p.is_from_turnover')} AS ncaa_pts_offtov,
    sum(CASE WHEN p.is_paint AND p.event_result = 'made' AND p.event_type <> 'Free Throw' THEN p.shot_value ELSE 0 END) AS ncaa_pts_paint,
    sum(CASE WHEN p.is_paint AND p.event_result = 'made' AND p.event_type <> 'Free Throw' THEN 1 ELSE 0 END) AS ncaa_fgm_paint,
    sum(CASE WHEN p.is_paint AND p.event_result IN ('made', 'missed') AND p.event_type <> 'Free Throw' AND p.shot_value IN (2, 3) THEN 1 ELSE 0 END) AS ncaa_fga_paint
  FROM src_ncaa_pbp p JOIN game g ON g.ncaa_game_id = p.contest_id
  WHERE p.event_team IS NOT NULL GROUP BY 1, 2, 3`
const filePoss = `
  SELECT g.season, g.game_id, s.poss_team AS side, count(*) AS ncaa_poss_n,
    count(*) FILTER (WHERE s.first_shot_type = 'Three Point Jumper') AS ncaa_poss_first3,
    count(*) FILTER (WHERE s.first_shot_type IN ('Layup', 'Dunk', 'Tip In')) AS ncaa_poss_first_rim,
    count(*) FILTER (WHERE s.first_shot_type IN ('Two Point Jumper', 'Hook')) AS ncaa_poss_first_two,
    count(*) FILTER (WHERE s.first_shot_type IS NULL) AS ncaa_poss_first_none,
    count(*) FILTER (WHERE s.is_assisted > 0) AS ncaa_poss_ast
  FROM src_ncaa_possessions s JOIN game g ON g.ncaa_game_id = CAST(s.contest_id AS VARCHAR)
  WHERE s.poss_team IS NOT NULL GROUP BY 1, 2, 3`

// Each game's two values, smallest first, compared side by side without naming the sides.
const sorted = (cols, from, key = 'game_id') => `
  SELECT season, ${key}, ${cols.map((c) => `list_sort(list(${c})) AS ${c}`).join(', ')}
  FROM (${from}) GROUP BY season, ${key}`

console.log(`## ${league}: counts by situation against the source\n`)
console.log(
  '| Season | Team-games | Games | Tags equal | Possession counts equal | Players add up |'
)
console.log('| --- | --- | --- | --- | --- | --- |')
const tagRows = await read(`
  WITH t AS (${sorted(TAGS, 'SELECT season, game_id, ' + TAGS.join(', ') + ' FROM ncaa_situation_team_game')}),
       f AS (${sorted(TAGS, fileTags)})
  SELECT t.season, count(*) AS games,
         count(*) FILTER (WHERE ${TAGS.map((c) => `(t.${c} = f.${c} OR (len(f.${c}) = 1 AND t.${c} = list_sort([0, f.${c}[1]])))`).join(' AND ')}) AS equal
  FROM t LEFT JOIN f USING (season, game_id) GROUP BY 1 ORDER BY 1`)
const possRows = await read(`
  WITH t AS (${sorted(POSS, 'SELECT season, game_id, ' + POSS.join(', ') + ' FROM ncaa_situation_team_game WHERE ncaa_poss_n IS NOT NULL')}),
       f AS (${sorted(POSS, filePoss)})
  SELECT f.season, count(*) AS games,
         count(*) FILTER (WHERE ${POSS.map((c) => `t.${c} = f.${c}`).join(' AND ')}) AS equal
  FROM f LEFT JOIN t USING (season, game_id) GROUP BY 1 ORDER BY 1`)
const addRows = await read(`
  SELECT t.season, count(*) AS team_games,
         count(*) FILTER (WHERE ${TAGS.map((c) => `coalesce(p.${c}, 0) = t.${c}`).join(' AND ')}) AS equal
  FROM ncaa_situation_team_game t
  LEFT JOIN (SELECT game_id, team_id, ${TAGS.map((c) => `sum(${c}) AS ${c}`).join(', ')}
             FROM ncaa_situation_player_game GROUP BY 1, 2) p USING (game_id, team_id)
  GROUP BY 1 ORDER BY 1`)
for (const a of addRows) {
  const t = tagRows.find((r) => r.season === a.season)
  const p = possRows.find((r) => r.season === a.season)
  console.log(
    `| ${label(a.season)} | ${a.team_games} | ${t?.games ?? 0} | ${t?.equal ?? 0} | ${p ? `${p.equal} of ${p.games}` : '–'} | ${a.equal} |`
  )
}

console.log(`\n## ${league}: against ESPN's box score and stats.ncaa.org's team box\n`)
console.log(
  '| Season | Team-games | Paint PTS within 2 | mean diff | Fast-break within 2 | mean diff | Off-TO within 2 | mean diff | Possessions within 2 | mean diff |'
)
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
const within = (a, b) => `round(100.0 * avg((abs(${a} - ${b}) <= 2)::INTEGER), 1)`
const diff = (a, b) => `round(avg(${a} - ${b}), 2)`
const cross = await read(`
  SELECT s.season, count(*) AS n,
    ${within('s.ncaa_pts_paint', 'g.paint_pts')} AS paint, ${diff('s.ncaa_pts_paint', 'g.paint_pts')} AS paint_d,
    ${within('s.ncaa_pts_fb', 'g.fast_break_pts')} AS fb, ${diff('s.ncaa_pts_fb', 'g.fast_break_pts')} AS fb_d,
    ${within('s.ncaa_pts_offtov', 'g.turnover_pts')} AS tov, ${diff('s.ncaa_pts_offtov', 'g.turnover_pts')} AS tov_d,
    ${within('s.ncaa_poss_n', 'g.ncaa_poss')} AS poss, ${diff('s.ncaa_poss_n', 'g.ncaa_poss')} AS poss_d
  FROM ncaa_situation_team_game s
  JOIN team_game g ON g.game_id = s.game_id AND g.team_id = s.team_id
  WHERE g.paint_pts IS NOT NULL OR g.ncaa_poss IS NOT NULL
  GROUP BY 1 ORDER BY 1`)
for (const c of cross) {
  console.log(
    `| ${label(c.season)} | ${c.n} | ${c.paint ?? '–'} % | ${c.paint_d ?? '–'} | ${c.fb ?? '–'} % | ${c.fb_d ?? '–'} | ${c.tov ?? '–'} % | ${c.tov_d ?? '–'} | ${c.poss ?? '–'} % | ${c.poss_d ?? '–'} |`
  )
}
await close()
