#!/usr/bin/env node
// Checks where each stats.ncaa.org team row stands (`ncaa_side`, T1703.2) on a real load, through the
// built worker, read only, from the source's side: every team-box row of every season the file holds is
// counted as equal, differing, blank or with no team-game, against the row's own possessions and seconds;
// how each was placed; whether its points are its own side's; and whether each player line without an
// ESPN id stands with its team row. Build first: npm run build.
// usage: node scripts/check-college-sides.mjs <folder> --league=ncaam|ncaaw
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
const league = leagueArg()
if (!folder || !league.startsWith('ncaa')) {
  console.error('usage: node scripts/check-college-sides.mjs <folder> --league=ncaam|ncaaw')
  process.exit(1)
}
const { read, close } = openStatsWorker(folder, { league })
const print = (rows) => {
  for (const r of rows) console.log(`  ${JSON.stringify(r)}`)
}

const seasons = await read(
  'SELECT min(season) AS first, max(season) AS last, count(*) AS rows FROM src_ncaa_team_box'
)
console.log(
  `${league}: every team-box row, seasons ${seasons[0].first} to ${seasons[0].last}, ${seasons[0].rows} rows`
)
const left = await read(`SELECT count(*)::INTEGER AS rows FROM src_ncaa_team_box n
  WHERE NOT EXISTS (SELECT 1 FROM ncaa_side s WHERE s.contest_id = n.contest_id)`)
console.log(`of them, ${left[0].rows} are of a forfeit or a game not played, which no table reads`)
console.log('placed, by season and method (blank: no side could be told):')
print(
  await read(`SELECT season, coalesce(method, 'none') AS method, count(*)::INTEGER AS rows
    FROM ncaa_side GROUP BY 1, 2 ORDER BY 1, 2`)
)
for (const [name, source, column] of [
  ['seconds on offence', 'n.o_mins * 60', 'ncaa_off_seconds'],
  ['possessions', 'n.o_poss', 'ncaa_poss']
]) {
  console.log(`${name}: each row's own value against its team-game's`)
  print(
    await read(`SELECT s.season, count(*)::INTEGER AS rows, count(*) FILTER (WHERE s.team_id IS NULL)::INTEGER AS unplaced,
      count(*) FILTER (WHERE abs(t.${column} - (${source})::DOUBLE) < 1e-6)::INTEGER AS equal,
      count(*) FILTER (WHERE t.${column} IS NOT NULL AND abs(t.${column} - (${source})::DOUBLE) >= 1e-6)::INTEGER AS differ,
      count(*) FILTER (WHERE s.team_id IS NOT NULL AND t.team_id IS NOT NULL AND t.${column} IS NULL)::INTEGER AS blank,
      count(*) FILTER (WHERE s.team_id IS NOT NULL AND t.team_id IS NULL)::INTEGER AS no_team_game
    FROM src_ncaa_team_box n JOIN ncaa_side s ON s.contest_id = n.contest_id AND s.team = n.team
    LEFT JOIN team_game t ON t.game_id = s.game_id AND t.team_id = s.team_id
    GROUP BY 1 ORDER BY 1`)
  )
}
console.log("the row's points against the score of the side it stands on (by method):")
print(
  await read(`SELECT s.method, count(*)::INTEGER AS rows,
    count(*) FILTER (WHERE n.pts = CASE WHEN s.team_id = g.home_team_id THEN g.home_score ELSE g.away_score END)::INTEGER AS own_side,
    count(*) FILTER (WHERE n.pts <> CASE WHEN s.team_id = g.home_team_id THEN g.home_score ELSE g.away_score END
      AND n.pts = CASE WHEN s.team_id = g.home_team_id THEN g.away_score ELSE g.home_score END)::INTEGER AS other_side_only
  FROM src_ncaa_team_box n JOIN ncaa_side s ON s.contest_id = n.contest_id AND s.team = n.team
  JOIN game g ON g.game_id = s.game_id WHERE s.team_id IS NOT NULL GROUP BY 1 ORDER BY 1`)
)
console.log("a team-game's stats.ncaa.org points against ESPN's team score, by season:")
print(
  await read(`SELECT season, count(*)::INTEGER AS team_games, count(*) FILTER (WHERE ncaa_pts = pts)::INTEGER AS equal,
    count(*) FILTER (WHERE abs(ncaa_pts - pts) BETWEEN 1 AND 12)::INTEGER AS off_by_up_to_12
  FROM team_game WHERE ncaa_pts IS NOT NULL AND pts IS NOT NULL GROUP BY 1 ORDER BY 1`)
)
await close()
