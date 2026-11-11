#!/usr/bin/env node
// Checks a loaded stats database against itself and against the real history of the league, season
// by season, and writes the result as a report. Every comparison is exact unless its table says
// otherwise. Exits 1 if a finished season has the wrong number of regular-season games or teams.
//
// usage: node scripts/check-agreement.mjs <folder holding stats.duckdb> <out.md>
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder || !mdFile) {
  console.error('usage: node scripts/check-agreement.mjs <folder> <out.md>')
  process.exit(2)
}

// Regular-season games actually played. Lockouts shortened 1998-99 and 2011-12, the pandemic 2019-20
// and 2020-21, and the Boston-Indiana game of 2013 was cancelled and never replayed.
function realLength(season) {
  const exact = { 1994: 1107, 1995: 1107, 1999: 725, 2012: 990, 2013: 1229, 2020: 1059, 2021: 1080 }
  if (exact[season]) return exact[season]
  return season <= 2004 ? 1189 : 1230
}

// Toronto and Vancouver joined in 1995-96, Charlotte's second team in 2004-05.
const realTeams = (season) => (season <= 1995 ? 27 : season <= 2004 ? 29 : 30)

const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')

const { read, query, call, close } = openStatsWorker(folder)

/** The games that count: not All-Star, not preseason, and actually played. */
const COUNTED = `g.played AND g.game_type IN ('regular', 'playoffs', 'play-in', 'cup-final')`

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

const out = [
  '# NBA agreement checks',
  '',
  'Written by `scripts/check-agreement.mjs` from a real load. Percentages are the share of rows that match exactly. Counted games are the regular season, the play-in, the playoffs and the Cup final, played. What these numbers mean for the app is in [nba-data-sources.md](nba-data-sources.md).'
]

// 1. Games and types.
const games = await read(`WITH teams AS (
    SELECT season, count(*) AS teams FROM team GROUP BY 1
  )
  SELECT g.season, any_value(t.teams) AS teams,
    count(*) FILTER (game_type = 'regular' AND played) AS regular,
    count(*) FILTER (game_type = 'regular' AND played AND espn_game_id IS NOT NULL) AS linked,
    count(*) FILTER (game_type = 'playoffs' AND played) AS playoffs,
    count(*) FILTER (game_type = 'play-in' AND played) AS play_in,
    count(*) FILTER (game_type = 'cup-final' AND played) AS cup,
    count(*) FILTER (game_type = 'all-star') AS all_star,
    count(*) FILTER (game_type = 'preseason') AS preseason,
    any_value(source) AS source
  FROM game g LEFT JOIN teams t USING (season) GROUP BY g.season ORDER BY g.season`)
const current = games.at(-1)?.season
let wrong = 0
const gameRows = games.map((g) => {
  const finished = g.season !== current
  const real = realLength(g.season)
  if (finished && g.regular !== real) wrong++
  if (g.teams !== realTeams(g.season)) wrong++
  const length = !finished ? 'in progress' : g.regular === real ? 'yes' : `**no, ${real}**`
  const teams =
    g.teams === realTeams(g.season) ? `${g.teams}` : `**${g.teams}, not ${realTeams(g.season)}**`
  return [
    label(g.season),
    teams,
    COUNT.format(g.regular),
    length,
    COUNT.format(g.linked),
    g.play_in,
    g.playoffs,
    g.cup,
    g.all_star,
    g.preseason,
    g.source
  ]
})
out.push(
  '',
  '## Games by type',
  '',
  'From 1996-97 the NBA schedule decides what a game is; before it, ESPN.',
  '',
  table(
    [
      'Season',
      'Teams',
      'Regular',
      'Real length?',
      'With ESPN id',
      'Play-in',
      'Playoffs',
      'Cup final',
      'All-Star',
      'Preseason',
      'From'
    ],
    gameRows
  )
)

// 2. The two sources' team box scores, same game and team.
const teams = await read(`WITH e AS (
    SELECT b.*, t.team_id AS nba_team, g.nba_game_id, g.season AS game_season
    FROM src_espn_team_box b
    JOIN game g ON g.espn_game_id = b.game_id AND ${COUNTED}
    JOIN team t ON t.espn_team_id = b.team_id AND t.season = g.season
    WHERE b.season = b.file_season AND g.nba_game_id IS NOT NULL
  ), players AS (
    SELECT game_id, team_id, sum(turnovers) AS tov, sum(rebounds) AS reb
    FROM src_espn_player_box WHERE season = file_season GROUP BY 1, 2
  )
  SELECT e.game_season AS season, count(*) AS n,
    count(*) FILTER (e.team_score = n.points) AS pts,
    count(*) FILTER (e.total_rebounds = n.rebounds_total) AS reb,
    count(*) FILTER (p.reb = n.rebounds_total) AS reb_players,
    count(*) FILTER (e.offensive_rebounds + e.defensive_rebounds = n.rebounds_total) AS o_d,
    count(*) FILTER (e.assists = n.assists) AS ast,
    count(*) FILTER (e.field_goals_attempted = n.field_goals_attempted) AS fga,
    count(*) FILTER (e.field_goals_made = n.field_goals_made) AS fgm,
    count(*) FILTER (e.three_point_field_goals_made = n.three_pointers_made) AS fg3m,
    count(*) FILTER (e.free_throws_attempted = n.free_throws_attempted) AS fta,
    count(*) FILTER (p.tov = n.turnovers) AS tov_players,
    count(*) FILTER (e.turnovers = n.turnovers) AS tov,
    count(*) FILTER (e.total_turnovers = n.turnovers) AS tov_total,
    count(*) FILTER (e.team_turnovers = n.turnovers) AS tov_team
  FROM e
  JOIN src_nba_team_box n ON n.game_id = e.nba_game_id AND n.team_id = e.nba_team
  LEFT JOIN players p ON p.game_id = e.game_id AND p.team_id = e.team_id
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## ESPN against the NBA, team box scores',
  '',
  "Rows are team-games in both sources. The NBA's rebounds and turnovers are the sum of its players. ESPN's team columns for both change meaning by era, while the sum of its players' lines stays right.",
  '',
  table(
    [
      'Season',
      'Team-games',
      'Points %',
      "Players' rebounds %",
      '`total_rebounds` %',
      'OREB + DREB %',
      'Assists %',
      'FGA %',
      'FGM %',
      '3PM %',
      'FTA %',
      "Players' turnovers %",
      '`turnovers` %',
      '`total_turnovers` %',
      '`team_turnovers` %'
    ],
    teams.map((r) => [
      label(r.season),
      COUNT.format(r.n),
      pct(r.pts, r.n),
      pct(r.reb_players, r.n),
      pct(r.reb, r.n),
      pct(r.o_d, r.n),
      pct(r.ast, r.n),
      pct(r.fga, r.n),
      pct(r.fgm, r.n),
      pct(r.fg3m, r.n),
      pct(r.fta, r.n),
      pct(r.tov_players, r.n),
      pct(r.tov, r.n),
      pct(r.tov_total, r.n),
      pct(r.tov_team, r.n)
    ])
  )
)

// 3. Players sum to their team, inside each source.
const nbaSums = await read(`WITH p AS (
    SELECT game_id, team_id, sum(points) AS pts, sum(rebounds_total) AS reb, sum(assists) AS ast
    FROM src_nba_player_box GROUP BY 1, 2
  )
  SELECT g.season, count(*) AS n,
    count(*) FILTER (p.pts = t.points) AS pts,
    count(*) FILTER (p.reb = t.rebounds_total) AS reb,
    count(*) FILTER (p.ast = t.assists) AS ast
  FROM src_nba_team_box t
  JOIN game g ON g.nba_game_id = t.game_id AND ${COUNTED}
  JOIN p ON p.game_id = t.game_id AND p.team_id = t.team_id
  GROUP BY 1 ORDER BY 1`)
const espnSums = await read(`WITH p AS (
    SELECT game_id, team_id, sum(points) AS pts, sum(rebounds) AS reb, sum(assists) AS ast
    FROM src_espn_player_box WHERE season = file_season GROUP BY 1, 2
  )
  SELECT g.season, count(*) AS n,
    count(*) FILTER (p.pts = t.team_score) AS pts,
    count(*) FILTER (p.reb = t.offensive_rebounds + t.defensive_rebounds) AS reb,
    count(*) FILTER (p.ast = t.assists) AS ast
  FROM src_espn_team_box t
  JOIN game g ON g.espn_game_id = t.game_id AND ${COUNTED}
  JOIN p ON p.game_id = t.game_id AND p.team_id = t.team_id
  WHERE t.season = t.file_season
  GROUP BY 1 ORDER BY 1`)
const nbaBySeason = new Map(nbaSums.map((r) => [r.season, r]))
const seasons = [...new Set([...espnSums, ...nbaSums].map((r) => r.season))].sort((a, b) => a - b)
out.push(
  '',
  '## Players sum to their team',
  '',
  "ESPN's rebounds are compared with its team's offensive plus defensive rebounds, which are wrong in 2007-08: there its players are right and its team columns are not.",
  '',
  table(
    [
      'Season',
      'NBA team-games',
      'Points %',
      'Rebounds %',
      'Assists %',
      'ESPN team-games',
      'Points %',
      'Rebounds %',
      'Assists %'
    ],
    seasons.map((s) => {
      const n = nbaBySeason.get(s)
      const e = espnSums.find((r) => r.season === s)
      return [
        label(s),
        n ? COUNT.format(n.n) : '–',
        n ? pct(n.pts, n.n) : '–',
        n ? pct(n.reb, n.n) : '–',
        n ? pct(n.ast, n.n) : '–',
        e ? COUNT.format(e.n) : '–',
        e ? pct(e.pts, e.n) : '–',
        e ? pct(e.reb, e.n) : '–',
        e ? pct(e.ast, e.n) : '–'
      ]
    })
  )
)

// 4. Player identity, and the two sources' player lines.
const methods =
  await read(`SELECT method, count(*) AS espn_ids, count(DISTINCT player_id) AS players
  FROM player_ids GROUP BY 1 ORDER BY 2 DESC`)
const espnEra = await read(`SELECT count(*) AS lines FROM src_espn_player_box
  WHERE athlete_id IN (SELECT espn_athlete_id FROM player_ids WHERE method = 'espn only')
    AND season >= (SELECT min(season) FROM src_nba_schedule) AND coalesce(minutes, 0) > 0`)
const players = await read(`WITH lines AS (
    SELECT g.season, b.athlete_id, b.points, b.rebounds, b.assists, g.nba_game_id, i.player_id, i.method
    FROM src_espn_player_box b
    JOIN game g ON g.espn_game_id = b.game_id AND ${COUNTED}
    LEFT JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
    WHERE b.season = b.file_season AND b.athlete_id IS NOT NULL
      AND coalesce(b.did_not_play, false) = false AND coalesce(b.minutes, 0) > 0
  )
  SELECT l.season, count(*) AS n,
    count(*) FILTER (l.player_id > 0) AS on_nba_id,
    count(*) FILTER (l.method = 'crosswalk') AS crosswalk,
    count(*) FILTER (l.method = 'box score') AS box,
    count(*) FILTER (l.method = 'name') AS name,
    count(*) FILTER (l.method = 'espn only') AS espn_only,
    count(n.person_id) AS joined,
    count(*) FILTER (n.points = l.points) AS pts,
    count(*) FILTER (n.rebounds_total = l.rebounds) AS reb,
    count(*) FILTER (n.assists = l.assists) AS ast
  FROM lines l
  LEFT JOIN src_nba_player_box n ON n.game_id = l.nba_game_id AND n.person_id = l.player_id
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## Player identity and player lines',
  '',
  table(
    ['How an ESPN id was mapped', 'ESPN ids', 'Players'],
    methods.map((m) => [m.method, COUNT.format(m.espn_ids), COUNT.format(m.players)])
  ),
  '',
  `Players left with ESPN's id alone have ${espnEra[0].lines} line${espnEra[0].lines === 1 ? '' : 's'} from 1996-97 on: the others played before the NBA's data starts, or never got on the floor.`,
  '',
  "Rows below are ESPN's lines for players who played. **On an NBA id** is the share with a player the NBA's data knows. **In both** is the share found in the NBA's box score of the same game; the last three are shares of those. Seasons before 1996-97 have no NBA box scores.",
  '',
  table(
    [
      'Season',
      'ESPN lines',
      'On an NBA id %',
      'By crosswalk',
      'By box score',
      'By name',
      'ESPN only',
      'In both %',
      'Points %',
      'Rebounds %',
      'Assists %'
    ],
    players.map((r) => [
      label(r.season),
      COUNT.format(r.n),
      pct(r.on_nba_id, r.n),
      COUNT.format(r.crosswalk),
      COUNT.format(r.box),
      COUNT.format(r.name),
      COUNT.format(r.espn_only),
      r.joined ? pct(r.joined, r.n) : '–',
      r.joined ? pct(r.pts, r.joined) : '–',
      r.joined ? pct(r.reb, r.joined) : '–',
      r.joined ? pct(r.ast, r.joined) : '–'
    ])
  )
)

// 5. Published season totals against the summed box scores.
const season = await read(`WITH summed AS (
    SELECT g.season, b.person_id AS player_id,
           count(*) FILTER (coalesce(b.minutes, '') NOT IN ('', '0:00', '00:00')) AS gp,
           sum(b.points) AS pts, sum(b.rebounds_total) AS reb, sum(b.assists) AS ast
    FROM src_nba_player_box b
    JOIN game g ON g.nba_game_id = b.game_id AND g.game_type = 'regular' AND g.played
    GROUP BY 1, 2
  )
  SELECT p.season, count(*) AS n, count(s.player_id) AS joined,
    count(*) FILTER (s.gp = p.gp) AS gp,
    count(*) FILTER (s.pts = p.pts) AS pts,
    count(*) FILTER (s.reb = p.reb) AS reb,
    count(*) FILTER (s.ast = p.ast) AS ast
  FROM src_dash_player_stats_base p
  LEFT JOIN summed s ON s.season = p.season AND s.player_id = p.player_id
  WHERE p.season_type = 'Regular Season'
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## Published season totals against summed box scores',
  '',
  "Rows are players in the regular season, from the league dashboards, which hold one row per player: a traded player's row carries their whole season. The current season can lag, since the two tables are published at different times.",
  '',
  table(
    [
      'Season',
      'Players',
      'Found in box scores %',
      'Games %',
      'Points %',
      'Rebounds %',
      'Assists %'
    ],
    season.map((r) => [
      label(r.season),
      COUNT.format(r.n),
      pct(r.joined, r.n),
      pct(r.gp, r.n),
      pct(r.pts, r.n),
      pct(r.reb, r.n),
      pct(r.ast, r.n)
    ])
  )
)

// 6. Possessions against the box score.
const possessions = await read(`WITH p AS (
    SELECT game_id, offense_team_id AS team_id, sum(points) AS pts
    FROM src_nba_possessions GROUP BY 1, 2
  )
  SELECT g.season, count(*) AS n,
    count(*) FILTER (p.pts = t.points) AS exact,
    count(*) FILTER (abs(p.pts - t.points) <= 1) AS within_1,
    count(*) FILTER (abs(p.pts - t.points) <= 5) AS within_5,
    max(abs(p.pts - t.points)) AS worst
  FROM src_nba_team_box t
  JOIN game g ON g.nba_game_id = t.game_id AND ${COUNTED}
  JOIN p ON p.game_id = t.game_id AND p.team_id = t.team_id
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## Possessions against the box score',
  '',
  "Points summed from the possessions table against the team's box score. Possessions are derived, not official: this is the tolerance on/off and lineups have to work with.",
  '',
  table(
    ['Season', 'Team-games', 'Exact %', 'Within 1 %', 'Within 5 %', 'Worst'],
    possessions.map((r) => [
      label(r.season),
      COUNT.format(r.n),
      pct(r.exact, r.n),
      pct(r.within_1, r.n),
      pct(r.within_5, r.n),
      r.worst
    ])
  )
)

// 7. The game tables against their parts and the final score.
const gameTables = await read(`WITH lines AS (
    SELECT game_id, team_id, sum(pts) AS pts, sum(reb) AS reb, sum(ast) AS ast, sum(tov) AS tov,
           sum(fga) AS fga, sum(seconds) AS seconds, sum(plus_minus) AS pm
    FROM player_game GROUP BY 1, 2
  )
  SELECT t.season, count(*) AS n, sum(t.box_games) AS box,
    count(*) FILTER (l.pts = t.pts) AS pts,
    count(*) FILTER (l.reb = t.reb) AS reb,
    count(*) FILTER (l.ast = t.ast) AS ast,
    count(*) FILTER (l.tov = t.tov) AS tov,
    count(*) FILTER (l.fga = t.fga) AS fga,
    count(*) FILTER (abs(l.seconds - t.seconds) <= 60) AS seconds,
    count(*) FILTER (t.pts = t.points_for) AS score,
    count(*) FILTER (l.pm = 5 * (t.points_for - t.points_against)) AS pm,
    sum(t.starts_known) AS starts
  FROM team_game t LEFT JOIN lines l USING (game_id, team_id)
  WHERE t.game_type IN ('regular', 'playoffs', 'play-in', 'cup-final')
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## The game tables',
  '',
  "Rows are team-games in `team_game`. **Players sum** compares each team's players in `player_game` with its total, which from 1996-97 is the NBA's team box score and before it is those same players, so the older rows only show what is missing. **Box points = score** compares that total with the final score. **Seconds** allows a minute either way. **Plus-minus** is the share where the five on the floor add up: the players' sum is five times the margin. **Starters known** is the share with exactly five flagged.",
  '',
  table(
    [
      'Season',
      'Team-games',
      'With a box score %',
      'Points %',
      'Rebounds %',
      'Assists %',
      'Turnovers %',
      'FGA %',
      'Seconds %',
      'Box points = score %',
      'Plus-minus %',
      'Starters known %'
    ],
    gameTables.map((r) => [
      label(r.season),
      COUNT.format(r.n),
      pct(r.box, r.n),
      pct(r.pts, r.box),
      pct(r.reb, r.box),
      pct(r.ast, r.box),
      pct(r.tov, r.box),
      pct(r.fga, r.box),
      pct(r.seconds, r.box),
      pct(r.score, r.box),
      r.pm ? pct(r.pm, r.box) : '–',
      pct(r.starts, r.box)
    ])
  )
)

// 8. The season tables against what the source publishes per season.
const publishedPlayers = await read(`WITH pub AS (
    SELECT *, row_number() OVER (PARTITION BY season ORDER BY pts DESC) AS place
    FROM src_nba_player_season
    WHERE measure_type = 'base' AND per_mode = 'totals' AND season_type = 'regular-season'
  )
  SELECT p.season, count(*) AS n, count(s.player_id) AS joined,
    count(*) FILTER (s.games = p.gp) AS gp,
    count(*) FILTER (s.pts = p.pts) AS pts,
    count(*) FILTER (s.reb = p.reb) AS reb,
    count(*) FILTER (s.ast = p.ast) AS ast,
    count(*) FILTER (s.fg3m = p.fg3m) AS fg3m,
    count(*) FILTER (abs(s.minutes - p.min) <= 1) AS min,
    count(*) FILTER (p.place <= 20) AS top,
    count(*) FILTER (p.place <= 20 AND s.pts = p.pts AND s.games = p.gp) AS top_same
  FROM pub p
  LEFT JOIN player_season s ON s.player_id = p.player_id AND s.season = p.season
    AND s.game_type = 'regular' AND s.team_id IS NULL
  GROUP BY 1 ORDER BY 1`)
const publishedTeams = await read(`SELECT p.season, count(*) AS n,
    count(*) FILTER (s.wins = p.w) AS w,
    count(*) FILTER (s.losses = p.l) AS l,
    count(*) FILTER (s.pts = p.pts) AS pts,
    count(*) FILTER (s.reb = p.reb) AS reb,
    count(*) FILTER (s.ast = p.ast) AS ast
  FROM src_nba_team_season p
  LEFT JOIN team_season s ON s.team_id = p.team_id AND s.season = p.season AND s.game_type = 'regular'
  WHERE p.measure_type = 'base' AND p.per_mode = 'totals' AND p.season_type = 'regular-season'
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## The season tables against what is published',
  '',
  "Regular season, against `nba_stats_player_season_stats` and `nba_stats_team_season_stats`, totals. A traded player's published row has their whole season, so it is compared with the row that has no team. **Top 20** is the season's leading scorers as published, with the same points and games. Minutes allow one either way: the published ones are rounded. The current season can lag, since the two are published at different times.",
  '',
  table(
    [
      'Season',
      'Players',
      'Found %',
      'Games %',
      'Points %',
      'Rebounds %',
      'Assists %',
      '3PM %',
      'Minutes %',
      'Top 20',
      'Teams',
      'Wins %',
      'Losses %',
      'Team points %',
      'Team rebounds %',
      'Team assists %'
    ],
    publishedPlayers.map((r) => {
      const t = publishedTeams.find((x) => x.season === r.season)
      return [
        label(r.season),
        COUNT.format(r.n),
        pct(r.joined, r.n),
        pct(r.gp, r.n),
        pct(r.pts, r.n),
        pct(r.reb, r.n),
        pct(r.ast, r.n),
        pct(r.fg3m, r.n),
        pct(r.min, r.n),
        `${r.top_same} of ${r.top}`,
        t ? t.n : '–',
        t ? pct(t.w, t.n) : '–',
        t ? pct(t.l, t.n) : '–',
        t ? pct(t.pts, t.n) : '–',
        t ? pct(t.reb, t.n) : '–',
        t ? pct(t.ast, t.n) : '–'
      ]
    })
  )
)

// 9. The catalogue's formulas, through the real engine, against what the NBA publishes per season.
const EXACT = [
  ['fg_pct', 'fg_pct', 'base', 'FG%'],
  ['fg3_pct', 'fg3_pct', 'base', '3P%'],
  ['ft_pct', 'ft_pct', 'base', 'FT%'],
  ['efg_pct', 'efg_pct', 'advanced', 'eFG%'],
  ['ts_pct', 'ts_pct', 'advanced', 'TS%'],
  ['fg3a_rate', 'pct_fga_3pt', 'scoring', '3PAr'],
  ['share_pts_3pt', 'pct_pts_3pt', 'scoring', '%PTS 3PT'],
  ['share_pts_ft', 'pct_pts_ft', 'scoring', '%PTS FT']
]
const ESTIMATES = [
  ['usg_pct', 'usg_pct', 'USG%'],
  ['ast_pct', 'ast_pct', 'AST%'],
  ['trb_pct', 'reb_pct', 'TRB%'],
  ['pie', 'pie', 'PIE']
]
const finished = games.map((g) => g.season).filter((s) => s >= 1997 && s !== current)
const GAME_MINUTES = 48
const formulaRows = []
const estimateRows = []
const teamRows = []
const median = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
}
for (const season of finished) {
  const ours = await query({
    entity: 'player',
    metrics: [...new Set([...EXACT.map((e) => e[0]), ...ESTIMATES.map((e) => e[0]), 'min'])],
    scope: { seasons: [season] },
    limit: 5000
  })
  const byId = new Map(ours.rows.map((r) => [Number(r.id), r]))
  const publishedRows =
    await read(`SELECT player_id, measure_type, fg_pct, fg3_pct, ft_pct, efg_pct,
      ts_pct, pct_fga_3pt, pct_pts_3pt, pct_pts_ft, usg_pct, ast_pct, reb_pct, pie
    FROM src_nba_player_season WHERE season = ${season} AND per_mode = 'totals'
      AND season_type = 'regular-season' AND measure_type IN ('base', 'advanced', 'scoring')`)
  const row = [label(season)]
  for (const [id, column, measure] of EXACT) {
    let same = 0
    let n = 0
    for (const p of publishedRows) {
      const v = byId.get(p.player_id)?.values[id]?.value
      if (p.measure_type !== measure || p[column] === null || v === null || v === undefined)
        continue
      n++
      // Published to three decimals. The NBA's free-throw share is what its other two leave, so
      // it can be off by one more in the last place.
      if (Math.abs(v - p[column]) <= (column === 'pct_pts_ft' ? 0.00101 : 0.00051)) same++
    }
    row.push(pct(same, n))
  }
  formulaRows.push(row)
  const estimate = [label(season)]
  for (const [id, column] of ESTIMATES) {
    const gaps = []
    for (const p of publishedRows) {
      const r = byId.get(p.player_id)
      const v = r?.values[id]?.value
      if (p.measure_type !== 'advanced' || p[column] === null || v === null || v === undefined)
        continue
      // Enough minutes that a difference is not just a small sample.
      if (!r.values.usg_pct.qualified) continue
      gaps.push(Math.abs(v - p[column]))
    }
    estimate.push(gaps.length ? (100 * median(gaps)).toFixed(2) : '–')
  }
  // The NBA's PIE reads as a share of what happened while the player was on the floor: scaling ours
  // by their share of the game's minutes brings it most of the way there.
  const onCourt = publishedRows.flatMap((p) => {
    const r = byId.get(p.player_id)
    const v = r?.values.pie?.value
    const minutes = r?.values.min?.value
    if (p.measure_type !== 'advanced' || p.pie === null || !v || !minutes) return []
    if (!r.values.usg_pct.qualified) return []
    return [Math.abs((v * r.games * GAME_MINUTES) / minutes - p.pie)]
  })
  estimate.push(onCourt.length ? (100 * median(onCourt)).toFixed(2) : '–')
  estimateRows.push(estimate)

  const teams = await query({
    entity: 'team',
    metrics: [
      'team_ortg',
      'team_drtg',
      'team_pace',
      'team_efg_pct',
      'team_tov_pct',
      'team_orb_pct'
    ],
    scope: { seasons: [season] },
    limit: 100
  })
  const publishedTeams =
    await read(`SELECT team_id, off_rating, e_off_rating, def_rating, pace, e_pace,
      efg_pct, tm_tov_pct, oreb_pct
    FROM src_nba_team_season WHERE season = ${season} AND per_mode = 'totals'
      AND season_type = 'regular-season' AND measure_type = 'advanced'`)
  const teamGap = (ours, theirs, toPoints = 1) => {
    const gaps = publishedTeams.flatMap((p) => {
      const v = teams.rows.find((r) => Number(r.id) === p.team_id)?.values[ours]?.value
      return v === null || v === undefined || p[theirs] === null
        ? []
        : [toPoints * Math.abs(v - p[theirs])]
    })
    return gaps.length ? median(gaps).toFixed(2) : '–'
  }
  teamRows.push([
    label(season),
    teamGap('team_ortg', 'off_rating'),
    teamGap('team_ortg', 'e_off_rating'),
    teamGap('team_drtg', 'def_rating'),
    teamGap('team_pace', 'pace'),
    teamGap('team_pace', 'e_pace'),
    teamGap('team_efg_pct', 'efg_pct', 100),
    teamGap('team_tov_pct', 'tm_tov_pct', 100),
    teamGap('team_orb_pct', 'oreb_pct', 100)
  ])
}
out.push(
  '',
  '## Formulas against what is published',
  '',
  "The catalogue's formulas, read through the query engine over a whole regular season, against `nba_stats_player_season_stats`. The share of players within rounding: the NBA publishes three decimals, and its free-throw share is what its other two leave, so that column allows one more in the last place.",
  '',
  table(['Season', ...EXACT.map((e) => `${e[3]} %`)], formulaRows),
  '',
  "These are estimates, and the NBA publishes its own measure of the same idea, so they are not meant to match. The median difference in percentage points, among players with 1,000 minutes per 82 games: the estimates guess a player's on-court team totals from their minutes, where the NBA counts them, and the NBA's usage counts plays differently. **PIE** follows the reference: a share of whole games. The NBA's published season figure reads higher, and **PIE, scaled to minutes** shows why: it behaves like a share of what happened while the player was on the floor.",
  '',
  table(['Season', ...ESTIMATES.map((e) => `${e[2]}`), 'PIE, scaled to minutes'], estimateRows),
  '',
  "Team estimates against `nba_stats_team_season_stats`, as the median difference across the league: points per 100 for the ratings, possessions per 48 for pace, percentage points for the rest. The NBA's ratings count possessions from the play by play; its `e_` columns are its own box-score estimates.",
  '',
  table(
    [
      'Season',
      'ORtg, `off_rating`',
      'ORtg, `e_off_rating`',
      'DRtg, `def_rating`',
      'Pace, `pace`',
      'Pace, `e_pace`',
      'eFG%',
      'TOV%, `tm_tov_pct`',
      'ORB%'
    ],
    teamRows
  )
)

// The NBA's league dashboards (Plan T702), read through the engine: first against the raw files, then
// beside the catalogue's formula for the same idea.
const DASH_PLAYER = [
  ['nba_ortg', 'a.off_rating'],
  ['nba_pace', 'a.pace'],
  ['nba_usg_pct', 'a.usg_pct'],
  ['nba_tov_ratio', 'a.tm_tov_pct'],
  ['nba_pie', 'a.pie'],
  ['nba_pts_paint', 'm.pts_paint'],
  ['nba_blka', 'm.blka'],
  ['nba_share_pts_mid', 's.pct_pts_2_pt_mr'],
  ['nba_share_ast_fgm', 's.pct_ast_fgm'],
  ['nba_share_pts', 'u.pct_pts'],
  ['nba_def_ws', 'd.def_ws']
]
const DASH_TEAM = [
  ['team_nba_ortg', 'a.off_rating'],
  ['team_nba_pace', 'a.pace'],
  ['team_nba_tov_pct', 'a.tm_tov_pct'],
  ['team_nba_fta_rate', 'f.fta_rate'],
  ['opp_nba_efg_pct', 'f.opp_efg_pct'],
  ['team_nba_pts_2_nd_chance', 'm.pts_2_nd_chance'],
  ['opp_nba_pts_paint', 'm.opp_pts_paint'],
  ['team_nba_share_pts_paint', 's.pct_pts_paint']
]
const RAW_FILTER = (alias) =>
  `${alias}.season = {season} AND ${alias}.season_type = 'Regular Season' AND ${alias}.per_mode = 'Totals'`
const rawPlayers = (season) =>
  read(
    `SELECT a.player_id, ${DASH_PLAYER.map(([id, c]) => `${c} AS ${id}`).join(', ')}
    FROM src_dash_player_stats_advanced a
    LEFT JOIN src_dash_player_stats_misc m ON m.player_id = a.player_id AND ${RAW_FILTER('m')}
    LEFT JOIN src_dash_player_stats_scoring s ON s.player_id = a.player_id AND ${RAW_FILTER('s')}
    LEFT JOIN src_dash_player_stats_usage u ON u.player_id = a.player_id AND ${RAW_FILTER('u')}
    LEFT JOIN src_dash_player_stats_defense d ON d.player_id = a.player_id AND ${RAW_FILTER('d')}
    WHERE ${RAW_FILTER('a')}`.replaceAll('{season}', season)
  )
const rawTeams = (season) =>
  read(
    `SELECT a.team_id, ${DASH_TEAM.map(([id, c]) => `${c} AS ${id}`).join(', ')}
    FROM src_dash_team_stats_advanced a
    LEFT JOIN src_dash_team_stats_fourfactors f ON f.team_id = a.team_id AND ${RAW_FILTER('f')}
    LEFT JOIN src_dash_team_stats_misc m ON m.team_id = a.team_id AND ${RAW_FILTER('m')}
    LEFT JOIN src_dash_team_stats_scoring s ON s.team_id = a.team_id AND ${RAW_FILTER('s')}
    WHERE ${RAW_FILTER('a')}`.replaceAll('{season}', season)
  )
/** Stored times a divisor and divided back, so only floating point separates the two. */
const same = (a, b) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)))

// Pairs of the same idea: the catalogue's formula, the NBA's published figure, and a scale to put
// both in percentage points (or points per game) before the difference.
const PLAYER_PAIRS = [
  ['orb_pct', 'nba_oreb_pct', 100, 'ORB%'],
  ['drb_pct', 'nba_dreb_pct', 100, 'DRB%'],
  ['ast_ratio', 'nba_ast_ratio', [100, 1], 'AST ratio'],
  ['tov_pct', 'nba_tov_ratio', [100, 1], 'TOV% against TO ratio'],
  ['share_pts', 'nba_share_pts', 100, '%PTS'],
  ['share_reb', 'nba_share_reb', 100, '%REB']
]
const TEAM_PAIRS = [
  ['team_ast_share', 'team_nba_ast_pct', 100, 'AST%'],
  ['team_fta_rate', 'team_nba_fta_rate', 100, 'FTr'],
  ['opp_efg_pct', 'opp_nba_efg_pct', 100, 'Opp eFG%'],
  ['team_paint_pts', 'team_nba_pts_paint', 'perGame', 'Paint PTS'],
  ['team_fast_break_pts', 'team_nba_pts_fb', 'perGame', 'Fast-break PTS'],
  ['team_turnover_pts', 'team_nba_pts_off_tov', 'perGame', 'PTS off TO']
]
const dashAgreeRows = []
const dashDiffRows = []
const dashTeamDiffRows = []
for (const season of finished) {
  const players = await query({
    entity: 'player',
    metrics: [
      ...new Set([
        ...DASH_PLAYER.map(([id]) => id),
        ...PLAYER_PAIRS.flatMap(([a, b]) => [a, b]),
        'usg_pct'
      ])
    ],
    scope: { seasons: [season] },
    limit: 5000
  })
  const byPlayer = new Map(players.rows.map((r) => [Number(r.id), r]))
  let pRows = 0
  let pSame = 0
  let pCells = 0
  let pCellsSame = 0
  for (const raw of await rawPlayers(season)) {
    const r = byPlayer.get(raw.player_id)
    if (!r) continue
    pRows++
    let all = true
    for (const [id] of DASH_PLAYER) {
      pCells++
      if (same(r.values[id]?.value ?? null, raw[id])) pCellsSame++
      else all = false
    }
    if (all) pSame++
  }
  const teams = await query({
    entity: 'team',
    metrics: [
      ...new Set([...DASH_TEAM.map(([id]) => id), ...TEAM_PAIRS.flatMap(([a, b]) => [a, b])])
    ],
    scope: { seasons: [season] },
    limit: 100
  })
  const byTeam = new Map(teams.rows.map((r) => [Number(r.id), r]))
  let tRows = 0
  let tSame = 0
  for (const raw of await rawTeams(season)) {
    const r = byTeam.get(raw.team_id)
    if (!r) continue
    tRows++
    if (DASH_TEAM.every(([id]) => same(r.values[id]?.value ?? null, raw[id]))) tSame++
  }
  dashAgreeRows.push([
    label(season),
    COUNT.format(pRows),
    pct(pSame, pRows),
    pct(pCellsSame, pCells),
    tRows,
    pct(tSame, tRows)
  ])

  const playerDiff = PLAYER_PAIRS.map(([ours, theirs, scale]) => {
    const [a, b] = Array.isArray(scale) ? scale : [scale, scale]
    const gaps = players.rows.flatMap((r) => {
      const x = r.values[ours]?.value
      const y = r.values[theirs]?.value
      if (!r.values.usg_pct?.qualified || x == null || y == null) return []
      return [a * x - b * y]
    })
    return gaps.length ? median(gaps).toFixed(2) : '–'
  })
  dashDiffRows.push([label(season), ...playerDiff])
  const teamDiff = TEAM_PAIRS.map(([ours, theirs, scale]) => {
    const gaps = teams.rows.flatMap((r) => {
      const x = r.values[ours]?.value
      const y = r.values[theirs]?.value
      if (x == null || y == null) return []
      return [scale === 'perGame' ? (x - y) / r.games : scale * (x - y)]
    })
    return gaps.length ? median(gaps).toFixed(2) : '–'
  })
  dashTeamDiffRows.push([label(season), ...teamDiff])
}

// Two seasons together: each published rate weighted by what it was measured over.
const twoSeasons = await query({
  entity: 'player',
  metrics: ['nba_usg_pct', 'nba_ortg'],
  scope: { seasons: [2025, 2026] },
  limit: 5000
})
const weightedRaw = await read(`SELECT player_id,
    sum(usg_pct * gp * min) / nullif(sum(gp * min), 0) AS usg,
    sum(off_rating * poss) / nullif(sum(poss), 0) AS ortg
  FROM src_dash_player_stats_advanced
  WHERE season IN (2025, 2026) AND season_type = 'Regular Season' AND per_mode = 'Totals'
  GROUP BY 1`)
const weightedById = new Map(weightedRaw.map((w) => [w.player_id, w]))
let weightedRows = 0
let weightedSame = 0
for (const r of twoSeasons.rows) {
  const w = weightedById.get(Number(r.id))
  if (!w || r.values.nba_usg_pct.value === null) continue
  weightedRows++
  if (same(r.values.nba_usg_pct.value, w.usg) && same(r.values.nba_ortg.value, w.ortg))
    weightedSame++
}

out.push(
  '',
  "## The NBA's dashboards, read through the engine",
  '',
  "The NBA's league dashboards (Plan T702) are read through the query engine over a whole regular season, against the raw files (`src_dash_*`), rows of totals. A rate the NBA publishes is stored times its minutes, or its possessions for a rating, and divided back when read. So one season should give back exactly what was published, and only floating point should differ. The player columns compared are one or more from each table: ratings, pace, usage, turnover ratio, PIE, paint points, shots blocked, midrange and assisted shares, share of points on court, and defensive win shares. The team columns are ratings, pace, turnovers, the four factors, points by kind and the paint share. A row matches when every compared column does.",
  '',
  table(
    ['Season', 'Players', 'Rows same %', 'Values same %', 'Teams', 'Rows same %'],
    dashAgreeRows
  ),
  '',
  'The rows that differ are players with 0 minutes or 0 possessions published, such as JamesOn Curry in 2009-10, one game of six seconds. The NBA prints 0 for their rates, and the engine reads no value, as it does for any rate over nothing.',
  '',
  `Over two seasons together (2024-25 and 2025-26), usage weighted by minutes and offensive rating weighted by possessions, worked out from the raw files: ${COUNT.format(weightedSame)} of ${COUNT.format(weightedRows)} players read the same through the engine.`,
  '',
  "The same idea, by the catalogue's formula and by the NBA, as the median of formula minus published among players with 1,000 minutes per 82 games, in percentage points. **ORB%** and **DRB%**: the formula guesses a player's on-court rebounds from their minutes, and the NBA counts them. **AST ratio**: both are assists per 100 plays used. **TOV% against TO ratio**: the reference's TOV% leaves assists out of the plays, and the NBA's TO ratio counts them, so they are different measures. **%PTS** and **%REB**: the formula is a share of whole games, and the NBA's a share of the minutes the player was on the floor, so the formula reads lower.",
  '',
  table(['Season', ...PLAYER_PAIRS.map((p) => p[3])], dashDiffRows),
  '',
  "For teams, across the league: percentage points for the rates, and points per game for the points by kind, where the formula's side is ESPN's team box score. ESPN's paint points start in 2008-09 and are missing in 2017-18, its fast-break points look low before 2004-05, and both sources classify these points their own way.",
  '',
  table(['Season', ...TEAM_PAIRS.map((p) => p[3])], dashTeamDiffRows)
)

// Player tracking (Plan T703) through the engine, against the raw files. A rate rebuilt from its
// parts should match the published one within its rounding (three decimals); a count, or a rate
// stored times its weight, should match exactly.
const ROUNDED = 0.0005 + 1e-9
const TRACKING_CHECKS = [
  ['speeddistance', 'dist_miles', 'dist_miles', 0],
  ['speeddistance', 'avg_speed', 'avg_speed', 0],
  ['speeddistance', 'avg_speed_off', 'avg_speed_off', 0],
  ['speeddistance', 'avg_speed_def', 'avg_speed_def', 0],
  ['possessions', 'touches', 'touches', 0],
  ['possessions', 'time_of_poss', 'time_of_poss', 0],
  ['possessions', 'sec_per_touch', 'avg_sec_per_touch', 0],
  ['possessions', 'drib_per_touch', 'avg_drib_per_touch', 0],
  ['possessions', 'pts_per_touch', 'pts_per_touch', ROUNDED],
  ['drives', 'drives', 'drives', 0],
  ['drives', 'drive_fg_pct', 'drive_fg_pct', ROUNDED],
  ['drives', 'drive_ft_pct', 'drive_ft_pct', ROUNDED],
  ['drives', 'drive_pts_per_drive', 'drive_pts_pct', ROUNDED],
  ['drives', 'drive_passes_pct', 'drive_passes_pct', ROUNDED],
  ['drives', 'drive_ast_pct', 'drive_ast_pct', ROUNDED],
  ['drives', 'drive_tov_pct', 'drive_tov_pct', ROUNDED],
  ['drives', 'drive_pf_pct', 'drive_pf_pct', ROUNDED],
  ['passing', 'potential_ast', 'potential_ast', 0],
  ['passing', 'ast_per_pass', 'ast_to_pass_pct', ROUNDED],
  ['passing', 'ast_adj_per_pass', 'ast_to_pass_pct_adj', ROUNDED],
  ['rebounding', 'reb_chance_pct', 'reb_chance_pct', ROUNDED],
  ['rebounding', 'oreb_chance_pct_adj', 'oreb_chance_pct_adj', ROUNDED],
  ['rebounding', 'dreb_contest_pct', 'dreb_contest_pct', ROUNDED],
  ['rebounding', 'avg_reb_dist', 'avg_reb_dist', 0],
  ['catchshoot', 'catch_shoot_fg_pct', 'catch_shoot_fg_pct', ROUNDED],
  ['catchshoot', 'catch_shoot_fg3_pct', 'catch_shoot_fg3_pct', ROUNDED],
  ['catchshoot', 'catch_shoot_efg_pct', 'catch_shoot_efg_pct', ROUNDED],
  ['pullupshot', 'pull_up_fg_pct', 'pull_up_fg_pct', ROUNDED],
  ['pullupshot', 'pull_up_efg_pct', 'pull_up_efg_pct', ROUNDED],
  ...['elbow', 'post', 'paint'].flatMap((a) => [
    [`${a}touch`, `${a}_touch_fg_pct`, `${a}_touch_fg_pct`, ROUNDED],
    [`${a}touch`, `${a}_touch_pts_per_touch`, `${a}_touch_pts_pct`, ROUNDED],
    [`${a}touch`, `${a}_touch_pass_pct`, `${a}_touch_passes_pct`, ROUNDED],
    [`${a}touch`, `${a}_touch_ast_pct`, `${a}_touch_ast_pct`, ROUNDED],
    [`${a}touch`, `${a}_touch_tov_pct`, `${a}_touch_tov_pct`, ROUNDED],
    [`${a}touch`, `${a}_touch_foul_pct`, `${a}_touch_fouls_pct`, ROUNDED]
  ]),
  ['efficiency', 'eff_catch_shoot_fg_pct', 'catch_shoot_fg_pct', 0],
  ['efficiency', 'eff_efg_pct', 'eff_fg_pct', 0],
  ['defense', 'def_rim_fg_pct', 'def_rim_fg_pct', ROUNDED]
]
const within = (a, b, tolerance) =>
  tolerance === 0
    ? same(a, b)
    : a === b || (a !== null && b !== null && Math.abs(a - b) <= tolerance)
const trackingRows = []
for (const season of finished.filter((s) => s >= 2014)) {
  const ids = TRACKING_CHECKS.map(([, id]) => id)
  const byPlayer = new Map()
  for (let i = 0; i < ids.length; i += 40) {
    const result = await query({
      entity: 'player',
      metrics: ids.slice(i, i + 40),
      scope: { seasons: [season] },
      limit: 5000
    })
    for (const r of result.rows) {
      const id = Number(r.id)
      byPlayer.set(id, { ...byPlayer.get(id), ...r.values })
    }
  }
  const raw = new Map()
  for (const file of new Set(TRACKING_CHECKS.map(([f]) => f))) {
    const cols = TRACKING_CHECKS.filter(([f]) => f === file)
    const rows = await read(
      `SELECT player_id, ${cols.map(([, id, c]) => `${c} AS ${id}`).join(', ')}
      FROM src_dash_player_tracking_${file} t WHERE ${RAW_FILTER('t').replaceAll('{season}', season)}`
    )
    for (const r of rows) raw.set(r.player_id, { ...raw.get(r.player_id), ...r })
  }
  let rows = 0
  let rowsSame = 0
  let cells = 0
  let cellsSame = 0
  let overNothing = 0
  for (const [player, r] of raw) {
    const ours = byPlayer.get(player)
    if (!ours) continue
    rows++
    let all = true
    for (const [, id, , tolerance] of TRACKING_CHECKS) {
      if (!(id in r)) continue
      const a = ours[id]?.value ?? null
      // A rate over nothing: the NBA prints 0, the engine reads no value.
      if (a === null && r[id] === 0) {
        overNothing++
        continue
      }
      cells++
      if (within(a, r[id], tolerance)) cellsSame++
      else all = false
    }
    if (all) rowsSame++
  }
  trackingRows.push([
    label(season),
    COUNT.format(rows),
    pct(rowsSame, rows),
    pct(cellsSame, cells),
    COUNT.format(overNothing)
  ])
}

// Two seasons together: a rate rebuilt from its parts adds them up, a stored one is weighted.
const trackingTwo = await query({
  entity: 'player',
  metrics: ['drive_fg_pct', 'avg_speed', 'sec_per_touch'],
  scope: { seasons: [2025, 2026] },
  limit: 5000
})
const trackingTwoRaw = await read(`SELECT d.player_id,
    sum(d.drive_fgm) / nullif(sum(d.drive_fga), 0) AS drive_fg_pct,
    sum(s.avg_speed * s.min) / nullif(sum(s.min), 0) AS avg_speed,
    sum(p.avg_sec_per_touch * p.touches) / nullif(sum(p.touches), 0) AS sec_per_touch
  FROM src_dash_player_tracking_drives d
  JOIN src_dash_player_tracking_speeddistance s USING (player_id, season, season_type, per_mode)
  JOIN src_dash_player_tracking_possessions p USING (player_id, season, season_type, per_mode)
  WHERE d.season IN (2025, 2026) AND d.season_type = 'Regular Season' AND d.per_mode = 'Totals'
  GROUP BY 1`)
const trackingTwoById = new Map(trackingTwoRaw.map((w) => [w.player_id, w]))
let trackingTwoRows = 0
let trackingTwoSame = 0
for (const r of trackingTwo.rows) {
  const w = trackingTwoById.get(Number(r.id))
  if (!w || r.values.avg_speed.value === null) continue
  trackingTwoRows++
  if (['drive_fg_pct', 'avg_speed', 'sec_per_touch'].every((id) => same(r.values[id].value, w[id])))
    trackingTwoSame++
}

out.push(
  '',
  "## The NBA's player tracking, read through the engine",
  '',
  `Player tracking (Plan T703) is read through the query engine over a whole regular season, against the raw files (\`src_dash_player_tracking_*\`), rows of totals: ${TRACKING_CHECKS.length} columns from the twelve files. A rate the files publish with its parts is rebuilt from them, so it should match within the published rounding, three decimals; a count, or a rate published without its parts and stored times what it was measured over (speed, seconds and dribbles per touch, rebound distance, the efficiency file's percentages), should match exactly. A row matches when every compared column does. **Over nothing** counts rates the NBA prints as 0 with nothing under them, which the engine leaves blank; they are not counted as values.`,
  '',
  table(['Season', 'Players', 'Rows same %', 'Values same %', 'Over nothing'], trackingRows),
  '',
  `Over two seasons together (2024-25 and 2025-26), drive FG% from summed makes and attempts, speed weighted by minutes and seconds per touch weighted by touches, worked out from the raw files: ${COUNT.format(trackingTwoSame)} of ${COUNT.format(trackingTwoRows)} players read the same through the engine.`
)

// Hustle (Plan T704) through the engine, against the raw files, players and teams. Counts and the
// box-out rates stored times the box outs should match exactly; the shares of loose balls and box
// outs on offense are rebuilt from their parts, within the published rounding.
const HUSTLE_SHARED = [
  ['contested_shots', 'contested_shots', 0],
  ['contested_shots_2pt', 'contested_shots_2_pt', 0],
  ['contested_shots_3pt', 'contested_shots_3_pt', 0],
  ['deflections', 'deflections', 0],
  ['charges_drawn', 'charges_drawn', 0],
  ['screen_assists', 'screen_assists', 0],
  ['screen_ast_pts', 'screen_ast_pts', 0],
  ['loose_balls', 'loose_balls_recovered', 0],
  ['off_loose_balls', 'off_loose_balls_recovered', 0],
  ['def_loose_balls', 'def_loose_balls_recovered', 0],
  ['box_outs', 'box_outs', 0],
  ['off_box_outs', 'off_boxouts', 0],
  ['def_box_outs', 'def_boxouts', 0],
  ['off_loose_balls_pct', 'pct_loose_balls_recovered_off', ROUNDED],
  ['off_box_outs_pct', 'pct_box_outs_off', ROUNDED]
]
const HUSTLE_PLAYER = [
  ...HUSTLE_SHARED,
  ['box_out_team_rebs', 'box_out_player_team_rebs', 0],
  ['box_out_rebs', 'box_out_player_rebs', 0],
  ['box_out_team_reb_pct', 'pct_box_outs_team_reb', 0],
  ['box_out_reb_pct', 'pct_box_outs_reb', 0]
]
const HUSTLE_TEAM = HUSTLE_SHARED.map(([id, c, t]) => [`team_${id}`, c, t])
async function hustleSeason(entity, season, checks) {
  const result = await query({
    entity,
    metrics: checks.map(([id]) => id),
    scope: { seasons: [season] },
    limit: 5000
  })
  const ours = new Map(result.rows.map((r) => [Number(r.id), r.values]))
  const key = entity === 'player' ? 'player_id' : 'team_id'
  const raw = await read(
    `SELECT ${key} AS id, ${checks.map(([id, c]) => `${c} AS ${id}`).join(', ')}
    FROM src_nba_hustle_${entity}
    WHERE season = ${season} AND season_type = 'regular-season' AND per_mode = 'totals'`
  )
  let rows = 0
  let rowsSame = 0
  let cells = 0
  let cellsSame = 0
  let overNothing = 0
  for (const r of raw) {
    const o = ours.get(Number(r.id))
    if (!o) continue
    rows++
    let all = true
    for (const [id, , tolerance] of checks) {
      const a = o[id]?.value ?? null
      // Box outs hold zeros before 2017-18, where the engine reads no value.
      if (a === null && (r[id] === 0 || season < 2018)) {
        overNothing++
        continue
      }
      cells++
      if (within(a, r[id], tolerance)) cellsSame++
      else all = false
    }
    if (all) rowsSame++
  }
  return [COUNT.format(rows), pct(rowsSame, rows), pct(cellsSame, cells), COUNT.format(overNothing)]
}
const hustleRows = []
for (const season of finished.filter((s) => s >= 2017)) {
  hustleRows.push([
    label(season),
    ...(await hustleSeason('player', season, HUSTLE_PLAYER)),
    ...(await hustleSeason('team', season, HUSTLE_TEAM))
  ])
}

out.push(
  '',
  "## The NBA's hustle stats, read through the engine",
  '',
  `Hustle (Plan T704) is read through the query engine over a whole regular season, against the raw files (\`src_nba_hustle_player\`, \`src_nba_hustle_team\`), rows of totals: ${HUSTLE_PLAYER.length} columns for players and ${HUSTLE_TEAM.length} for teams. Counts, and the two box-out rebound rates, which are stored times the box outs, should match exactly; the offensive shares of loose balls and box outs are rebuilt from their parts, within the published rounding. It starts in 2016-17, since the 2015-16 regular-season file is 2016-17's under the wrong label, and box outs in 2017-18. **Not compared** counts box outs before 2017-18 and rates with nothing under them, which the engine leaves blank.`,
  '',
  table(
    [
      'Season',
      'Players',
      'Rows same %',
      'Values same %',
      'Not compared',
      'Teams',
      'Rows same %',
      'Values same %',
      'Not compared'
    ],
    hustleRows
  )
)

// Play types (Plan T705) through the engine, against the raw files, rows of totals. A traded player
// has a row per team, so the raw side is added up per player the way the engine does: counts summed,
// rates published without their parts weighted by what they divide by, and the frequency over the
// possessions its share implies. Those should match exactly. Points per possession and FG% are rebuilt
// from their parts, so they are compared with the published rates of one-team players, within the
// published rounding: three places from 2023-24, two before.
const PLAY_TYPE_KEYS = {
  isolation: 'iso',
  transition: 'transition',
  prballhandler: 'pnr_bh',
  prrollman: 'pnr_roll',
  postup: 'post_up',
  spotup: 'spot_up',
  handoff: 'handoff',
  cut: 'cut',
  offscreen: 'off_screen',
  offrebound: 'putback',
  misc: 'misc'
}
const PLAY_TYPE_DEFENSE = [
  'iso',
  'pnr_bh',
  'pnr_roll',
  'post_up',
  'spot_up',
  'handoff',
  'off_screen'
]
const PLAY_TYPE_SIDES = [
  ...Object.values(PLAY_TYPE_KEYS),
  ...PLAY_TYPE_DEFENSE.map((k) => `d_${k}`)
]
const PLAY_TYPE_EXACT = [
  'poss',
  'pts',
  'fgm',
  'fga',
  'freq',
  'efg_pct',
  'ft_freq',
  'tov_freq',
  'sf_freq',
  'and1_freq',
  'score_freq'
]
const playTypeRaw = (seasons) =>
  read(`SELECT player_id, lower(play_type) AS play_type, lower(type_grouping) AS side,
      count(*)::INTEGER AS teams, sum(poss) AS poss, sum(pts) AS pts, sum(fgm) AS fgm,
      sum(fga) AS fga,
      sum(poss) FILTER (WHERE poss_pct > 0)
        / nullif(sum(poss / poss_pct) FILTER (WHERE poss_pct > 0), 0) AS freq,
      sum(efg_pct * fga) / nullif(sum(fga), 0) AS efg_pct,
      sum(ft_poss_pct * poss) / nullif(sum(poss), 0) AS ft_freq,
      sum(tov_poss_pct * poss) / nullif(sum(poss), 0) AS tov_freq,
      sum(sf_poss_pct * poss) / nullif(sum(poss), 0) AS sf_freq,
      sum(plusone_poss_pct * poss) / nullif(sum(poss), 0) AS and1_freq,
      sum(score_poss_pct * poss) / nullif(sum(poss), 0) AS score_freq,
      sum(pts) / nullif(sum(poss), 0) AS ppp_parts, max(ppp) AS ppp,
      max(fg_pct) AS fg_pct
    FROM src_nba_play_types
    WHERE season IN (${seasons.join(', ')}) AND season_type = 'regular-season'
      AND per_mode = 'totals'
    GROUP BY ALL`)
const playTypeKey = (r) => `${r.side === 'defensive' ? 'd_' : ''}${PLAY_TYPE_KEYS[r.play_type]}`

async function playTypeValues(seasons, measures) {
  const ids = PLAY_TYPE_SIDES.flatMap((k) => measures.map((m) => `pt_${k}_${m}`))
  const byPlayer = new Map()
  for (let i = 0; i < ids.length; i += 40) {
    const result = await query({
      entity: 'player',
      metrics: ids.slice(i, i + 40),
      scope: { seasons },
      limit: 5000
    })
    for (const r of result.rows) {
      const values = byPlayer.get(Number(r.id)) ?? {}
      for (const [id, v] of Object.entries(r.values)) values[id] = v.value
      byPlayer.set(Number(r.id), values)
    }
  }
  return byPlayer
}

const playTypeRows = []
for (const season of finished.filter((s) => s >= 2016)) {
  const ours = await playTypeValues([season], [...PLAY_TYPE_EXACT, 'ppp', 'fg_pct'])
  const raw = await playTypeRaw([season])
  const rounding = season >= 2024 ? ROUNDED : 0.005 + 1e-9
  const players = new Set()
  const wrong = new Set()
  let cells = 0
  let cellsSame = 0
  let traded = 0
  const published = { ppp: [0, 0], fg_pct: [0, 0] }
  for (const r of raw) {
    const o = ours.get(Number(r.player_id))
    if (!o) continue
    players.add(r.player_id)
    const key = playTypeKey(r)
    for (const m of PLAY_TYPE_EXACT) {
      cells++
      if (same(o[`pt_${key}_${m}`] ?? null, r[m])) cellsSame++
      else wrong.add(r.player_id)
    }
    // Rebuilt from the parts: the same as the raw parts give, and near the published rate.
    for (const m of ['ppp', 'fg_pct']) {
      const parts = m === 'ppp' ? r.ppp_parts : r.fga ? r.fgm / r.fga : null
      cells++
      if (same(o[`pt_${key}_${m}`] ?? null, parts)) cellsSame++
      else wrong.add(r.player_id)
    }
    if (r.teams > 1) {
      traded++
      continue
    }
    for (const m of ['ppp', 'fg_pct']) {
      const a = o[`pt_${key}_${m}`] ?? null
      if (a === null) continue
      published[m][0]++
      if (within(a, r[m], rounding)) published[m][1]++
    }
  }
  playTypeRows.push([
    label(season),
    COUNT.format(players.size),
    pct(players.size - wrong.size, players.size),
    pct(cellsSame, cells),
    COUNT.format(traded),
    pct(published.ppp[1], published.ppp[0]),
    pct(published.fg_pct[1], published.fg_pct[0])
  ])
}

// Two seasons together: points per possession from summed parts, the rest weighted.
const playTypeTwoOurs = await playTypeValues([2025, 2026], ['ppp', 'freq', 'tov_freq'])
const playTypeTwoRaw = (await playTypeRaw([2025, 2026])).filter(
  (r) => r.play_type === 'spotup' && r.side === 'offensive'
)
let playTypeTwoRows = 0
let playTypeTwoSame = 0
for (const r of playTypeTwoRaw) {
  const o = playTypeTwoOurs.get(Number(r.player_id))
  if (!o) continue
  playTypeTwoRows++
  if (
    same(o.pt_spot_up_ppp ?? null, r.ppp_parts) &&
    same(o.pt_spot_up_freq ?? null, r.freq) &&
    same(o.pt_spot_up_tov_freq ?? null, r.tov_freq)
  )
    playTypeTwoSame++
}

out.push(
  '',
  "## The NBA's play types, read through the engine",
  '',
  `Play types (Plan T705) are read through the query engine over a whole regular season, against the raw file (\`src_nba_play_types\`), rows of totals: ${PLAY_TYPE_SIDES.length} types and sides, ${PLAY_TYPE_EXACT.length + 2} measures each. A traded player has a row per team, so the raw rows are added up per player as the engine does: counts summed, rates published without their parts weighted by possessions (eFG% by attempts), and the frequency over the possessions its published share implies. A row matches when every type and measure does. **PPP** and **FG%** are rebuilt from their parts; the last two columns compare them with the published rates of players with one team, within the published rounding: three places from 2023-24, two before. The file prints points per possession as a whole number on 248 regular-season rows of 2015-16, and on about a quarter of the playoff rows of 2015-16 to 2017-18: those are the misses, and the rate rebuilt from the parts is the right one.`,
  '',
  table(
    [
      'Season',
      'Players',
      'Rows same %',
      'Values same %',
      'Traded rows',
      'PPP as published %',
      'FG% as published %'
    ],
    playTypeRows
  ),
  '',
  `Over two seasons together (2024-25 and 2025-26), spot-up points per possession from summed parts, frequency over the implied possessions and turnover frequency weighted by possessions, worked out from the raw file: ${COUNT.format(playTypeTwoSame)} of ${COUNT.format(playTypeTwoRows)} players read the same through the engine.`
)

// Matchups (Plan T706) through the engine, against the raw files. In the regular season a defender's
// totals add up the pair file, which is checked against the game matchups too; the rollup by defender
// is compared with both. Its split by position should read back as its published percent of time,
// and the playoffs, which only the rollup has, as the rollup.
const MATCHUP_CHECKS = [
  ['matchup_min', 'minutes'],
  ['matchup_poss', 'poss'],
  ['matchup_pts', 'pts'],
  ['matchup_team_pts', 'team_pts'],
  ['matchup_fgm', 'fgm'],
  ['matchup_fga', 'fga'],
  ['matchup_fg3a', 'fg3a'],
  ['matchup_fta', 'fta'],
  ['matchup_tov', 'tov'],
  ['matchup_sfl', 'sfl'],
  ['matchup_fg_pct', 'fg_pct']
]
const MATCHUP_SUMS = `sum(partial_poss) AS poss, sum(player_pts) AS pts, sum(team_pts) AS team_pts,
  sum(matchup_fgm) AS fgm, sum(matchup_fga) AS fga, sum(matchup_fg3_a) AS fg3a,
  sum(matchup_fta) AS fta, sum(matchup_tov) AS tov, sum(sfl) AS sfl,
  sum(matchup_fgm) / nullif(sum(matchup_fga), 0) AS fg_pct`
const CLOCK = `(TRY_CAST(split_part(matchup_min, ':', 1) AS DOUBLE)
  + TRY_CAST(split_part(matchup_min, ':', 2) AS DOUBLE) / 60)`

async function matchupValues(seasons, gameTypes, metrics) {
  const result = await query({
    entity: 'player',
    metrics,
    scope: { seasons, gameTypes },
    limit: 5000
  })
  return new Map(
    result.rows.map((r) => [
      Number(r.id),
      Object.fromEntries(Object.entries(r.values).map(([id, v]) => [id, v.value]))
    ])
  )
}

const matchupRows = []
const matchupSeasons = finished.filter((s) => s >= 2018)
for (const season of matchupSeasons) {
  const ours = await matchupValues(
    [season],
    ['regular'],
    MATCHUP_CHECKS.map(([id]) => id)
  )
  const pairs =
    await read(`SELECT def_player_id, sum(matchup_time_sec) / 60 AS minutes, ${MATCHUP_SUMS}
    FROM src_nba_season_matchups
    WHERE season = ${season} AND per_mode = 'totals' GROUP BY 1`)
  const gameFile = new Map(
    (
      await read(`SELECT def_person_id AS id, sum(player_points) AS pts,
          sum(matchup_field_goals_made) AS fgm, sum(matchup_field_goals_attempted) AS fga,
          sum(matchup_minutes_sort) / 60 AS minutes
        FROM src_nba_game_matchups WHERE season = ${season} AND game_id LIKE '002%' GROUP BY 1`)
    ).map((r) => [Number(r.id), r])
  )
  const rollup = new Map(
    (
      await read(`SELECT def_player_id AS id, ${CLOCK} AS minutes, player_pts AS pts,
          matchup_fga AS fga
        FROM src_nba_matchup_rollups
        WHERE season = ${season} AND season_type = 'regular-season' AND per_mode = 'totals'
          AND position = 'TOTAL'`)
    ).map((r) => [Number(r.id), r])
  )
  let rows = 0
  let rowsSame = 0
  let gameSame = 0
  let rollupSame = 0
  let rollupMinutes = 0
  let pairMinutes = 0
  let gameMinutes = 0
  for (const r of pairs) {
    const o = ours.get(Number(r.def_player_id))
    if (!o) continue
    rows++
    if (MATCHUP_CHECKS.every(([id, c]) => same(o[id] ?? null, r[c]))) rowsSame++
    const g = gameFile.get(Number(r.def_player_id))
    if (g && g.pts === r.pts && g.fgm === r.fgm && g.fga === r.fga) gameSame++
    gameMinutes += g?.minutes ?? 0
    const u = rollup.get(Number(r.def_player_id))
    if (u && u.pts === r.pts && u.fga === r.fga) rollupSame++
    rollupMinutes += u?.minutes ?? 0
    pairMinutes += r.minutes
  }
  matchupRows.push([
    label(season),
    COUNT.format(rows),
    pct(rowsSame, rows),
    pct(gameSame, rows),
    (100 * (gameMinutes / pairMinutes - 1)).toFixed(2).replace(/^-0\.00$/, '0.00'),
    pct(rollupSame, rows),
    (100 * (rollupMinutes / pairMinutes - 1)).toFixed(1)
  ])
}

// The split by position, and the playoffs, against the rollup as published.
const positionRows = []
for (const season of matchupSeasons) {
  for (const type of ['regular', 'playoffs']) {
    const ours = await matchupValues(
      [season],
      [type],
      [
        'matchup_g_time_pct',
        'matchup_f_time_pct',
        'matchup_c_time_pct',
        'matchup_pts',
        'matchup_poss'
      ]
    )
    const raw = await read(`SELECT def_player_id AS id,
        max(percent_of_time) FILTER (WHERE position = 'G') AS g,
        max(percent_of_time) FILTER (WHERE position = 'F') AS f,
        max(percent_of_time) FILTER (WHERE position = 'C') AS c,
        max(player_pts) FILTER (WHERE position = 'TOTAL') AS pts,
        max(partial_poss) FILTER (WHERE position = 'TOTAL') AS poss
      FROM src_nba_matchup_rollups
      WHERE season = ${season} AND per_mode = 'totals'
        AND season_type = '${type === 'regular' ? 'regular-season' : 'playoffs'}'
      GROUP BY 1`)
    let rows = 0
    let shares = 0
    let sharesNear = 0
    let totals = 0
    for (const r of raw) {
      const o = ours.get(Number(r.id))
      if (!o) continue
      rows++
      // A share the rollup leaves out is no time there: the engine reads it as 0 of the total.
      const near = (tolerance) =>
        within(o.matchup_g_time_pct ?? 0, r.g ?? 0, tolerance) &&
        within(o.matchup_f_time_pct ?? 0, r.f ?? 0, tolerance) &&
        within(o.matchup_c_time_pct ?? 0, r.c ?? 0, tolerance)
      if (near(0.001)) shares++
      if (near(0.01)) sharesNear++
      if (same(o.matchup_pts ?? null, r.pts) && same(o.matchup_poss ?? null, r.poss)) totals++
    }
    positionRows.push([
      label(season),
      type === 'regular' ? 'Regular season' : 'Playoffs',
      COUNT.format(rows),
      pct(shares, rows),
      pct(sharesNear, rows),
      type === 'playoffs' ? pct(totals, rows) : '–'
    ])
  }
}

// Two seasons together: the pair file added up over both.
const matchupTwoOurs = await matchupValues(
  [2025, 2026],
  ['regular'],
  ['matchup_pts', 'matchup_fg_pct']
)
const matchupTwoRaw = await read(`SELECT def_player_id, ${MATCHUP_SUMS}
  FROM src_nba_season_matchups WHERE season IN (2025, 2026) AND per_mode = 'totals' GROUP BY 1`)
let matchupTwoRows = 0
let matchupTwoSame = 0
for (const r of matchupTwoRaw) {
  const o = matchupTwoOurs.get(Number(r.def_player_id))
  if (!o) continue
  matchupTwoRows++
  if (same(o.matchup_pts ?? null, r.pts) && same(o.matchup_fg_pct ?? null, r.fg_pct)) {
    matchupTwoSame++
  }
}

out.push(
  '',
  "## The NBA's matchups, read through the engine",
  '',
  `Matchups (Plan T706) are read through the query engine over a whole regular season. In the regular season a defender's totals add up the pair file (\`src_nba_season_matchups\`), rows of totals; a row matches when all ${MATCHUP_CHECKS.length} measures do (matchup minutes, partial possessions, points, team points, FGM, FGA, 3PA, FTA, turnovers, shooting fouls, FG%). The next two check the pair file against the game matchups (\`src_nba_game_matchups\`, regular-season games): the share of defenders with the same points, makes and attempts, and how far the game files' matchup time differs in all. The last two compare the rollup by defender (\`src_nba_matchup_rollups\`) with the pair file: the share of defenders with the same points and attempts, and how far its matchup time differs from the pair file's in all. The 2025-26 rollup reads about 5 % less time and matches almost no defender; the pair file and the game matchups agree, so the regular-season totals read the pair file.`,
  '',
  table(
    [
      'Season',
      'Defenders',
      'Rows same %',
      'Pairs = games %',
      'Games time vs pairs %',
      'Rollup = pairs %',
      'Rollup time vs pairs %'
    ],
    matchupRows
  ),
  '',
  'The time on guards, forwards and centers against the rollup’s published percent of time, all three within 0.1 and within 1 percentage point. The NBA works the share out from unrounded time while the file prints it to the second, so a share rebuilt from the printed time is off by rounding, most on the smallest samples; from 2025-26 the two agree more closely. In the playoffs, which only the rollup has, its points and partial possessions should read back exactly.',
  '',
  table(
    [
      'Season',
      'Type',
      'Defenders',
      'Shares within 0.1 pt %',
      'Within 1 pt %',
      'Playoff totals same %'
    ],
    positionRows
  ),
  '',
  `Over two seasons together (2024-25 and 2025-26), points and FG% allowed from the pair file added up over both: ${COUNT.format(matchupTwoSame)} of ${COUNT.format(matchupTwoRows)} defenders read the same through the engine.`
)

// SportsDataverse's impact models (Plan T707) through the engine, against the raw file. Each value is
// stored times what it was fitted on and divided back, so one season should read as published,
// exactly. DARKO reads the regular season only, and over one season at a time. The raw file gives its
// columns as boban_* (the dataset renamed them; see nba-data-sources.md).
const IMPACT_CHECKS = [
  ['sdv_rapm', 'rapm', 'off_poss + def_poss'],
  ['sdv_o_rapm', 'o_rapm', 'off_poss'],
  ['sdv_d_rapm', 'd_rapm', 'def_poss'],
  ['sdv_adj_rapm', 'adj_rapm', 'off_poss + def_poss'],
  ['sdv_o_adj_rapm', 'o_adj_rapm', 'off_poss'],
  ['sdv_d_adj_rapm', 'd_adj_rapm', 'def_poss'],
  ['sdv_spm', 'spm', 'min'],
  ['sdv_ospm', 'ospm', 'min'],
  ['sdv_dspm', 'dspm', 'min'],
  ['sdv_bpm', 'bpm', 'min'],
  ['sdv_obpm', 'obpm', 'min'],
  ['sdv_dbpm', 'dbpm', 'min'],
  ['sdv_war', 'war', '1'],
  ['sdv_darko_skill', 'boban_filtered_skill', 'gp', 1998],
  ['sdv_darko_next', 'boban_projected_rating', 'gp', 1998],
  ['sdv_darko_sd', 'boban_projected_sd', 'gp', 1999]
]
const IMPACT_TYPES = [
  ['regular', 'Regular Season'],
  ['playoffs', 'Playoffs']
]
const impactRows = []
let darkoPlayoffReasons = 0
let darkoSeasons = 0
const darkoPlayoffWhy = new Set()
// A metric the dataset no longer publishes answers with that reason everywhere: there is nothing to
// compare (Stage 7 found DARKO's columns replaced by other values).
const impactGone = new Map()
for (const season of finished) {
  for (const [type, published] of IMPACT_TYPES) {
    const result = await query({
      entity: 'player',
      metrics: IMPACT_CHECKS.map(([id]) => id),
      scope: { seasons: [season], gameTypes: [type] },
      limit: 5000
    })
    const reasons = new Map(result.columns.map((c) => [c.id, c.reason]))
    for (const c of result.columns) {
      if (c.reason && /no longer publishes/.test(c.reason)) impactGone.set(c.id, c.reason)
    }
    const ours = new Map(result.rows.map((r) => [Number(r.id), r.values]))
    const checks = IMPACT_CHECKS.filter(
      ([id]) => (type === 'regular' || !id.includes('darko')) && !impactGone.has(id)
    )
    // Before every DARKO column covers the season, its coverage is the reason given instead.
    if (type === 'playoffs' && season >= 1999) {
      darkoSeasons++
      const darko = IMPACT_CHECKS.filter(([id]) => id.includes('darko'))
      if (darko.every(([id]) => reasons.get(id))) {
        darkoPlayoffReasons++
        for (const [id] of darko) darkoPlayoffWhy.add(reasons.get(id))
      }
    }
    const raw = await read(
      `SELECT player_id AS id, ${checks.map(([id, c, by]) => `${c} AS ${id}, (${by}) AS ${id}_by`).join(', ')}
      FROM src_nba_impact WHERE season = ${season} AND season_type = '${published}'`
    )
    let rows = 0
    let missing = 0
    let rowsSame = 0
    let cells = 0
    let cellsSame = 0
    let overNothing = 0
    for (const r of raw) {
      const o = ours.get(Number(r.id))
      if (!o) {
        missing++
        continue
      }
      rows++
      let all = true
      for (const [id, , , first] of checks) {
        const a = o[id]?.value ?? null
        // A value over nothing, or before the model's first season, reads blank.
        if (a === null && (r[`${id}_by`] === 0 || r[id] === null || season < (first ?? 0))) {
          overNothing++
          continue
        }
        cells++
        if (same(a, r[id])) cellsSame++
        else all = false
      }
      if (all) rowsSame++
    }
    impactRows.push([
      label(season),
      type === 'regular' ? 'Regular season' : 'Playoffs',
      COUNT.format(rows),
      COUNT.format(missing),
      pct(rowsSame, rows),
      pct(cellsSame, cells),
      COUNT.format(overNothing)
    ])
  }
}

// Two seasons together: each value weighted by what it was fitted on; DARKO has no answer.
const impactTwo = await query({
  entity: 'player',
  metrics: ['sdv_rapm', 'sdv_bpm', 'sdv_war', 'sdv_darko_next'],
  scope: { seasons: [2025, 2026], gameTypes: ['regular'] },
  limit: 5000
})
const impactTwoRaw = await read(`SELECT player_id,
    sum(rapm * (off_poss + def_poss)) / nullif(sum(off_poss + def_poss), 0) AS rapm,
    sum(bpm * min) / nullif(sum(min), 0) AS bpm, sum(war) AS war
  FROM src_nba_impact WHERE season IN (2025, 2026) AND season_type = 'Regular Season' GROUP BY 1`)
const impactTwoById = new Map(impactTwoRaw.map((w) => [Number(w.player_id), w]))
let impactTwoRows = 0
let impactTwoSame = 0
for (const r of impactTwo.rows) {
  const w = impactTwoById.get(Number(r.id))
  if (!w || w.rapm === null || w.bpm === null) continue
  impactTwoRows++
  const v = r.values
  if (
    same(v.sdv_rapm.value, w.rapm) &&
    same(v.sdv_bpm.value, w.bpm) &&
    same(v.sdv_war.value, w.war)
  ) {
    impactTwoSame++
  }
}
const darkoTwoReason = impactTwo.columns.find((c) => c.id === 'sdv_darko_next')?.reason

out.push(
  '',
  "## SportsDataverse's impact models, read through the engine",
  '',
  `The impact models (Plan T707) are read through the query engine over a whole season, against the raw file (\`src_nba_impact\`): ${IMPACT_CHECKS.length} columns, RAPM, adjusted RAPM, SPM and BPM with their parts, WAR and DARKO. Each is stored times what it was fitted on (possessions for the RAPM family, minutes for SPM and BPM, games for DARKO) and divided back, so a season should read exactly as published. DARKO is compared in the regular season only, since its playoff rows repeat the regular season's. **Not in the box scores** counts players the file has and the engine does not list; **not compared** counts values over nothing (0 minutes or possessions) and DARKO in 1996-97 and its projection spread in 1997-98, before they start, which the engine leaves blank.`,
  '',
  table(
    [
      'Season',
      'Type',
      'Players',
      'Not in the box scores',
      'Rows same %',
      'Values same %',
      'Not compared'
    ],
    impactRows
  ),
  '',
  `${impactGone.size ? `${impactGone.size} columns are not compared (${[...impactGone.keys()].join(', ')}): the engine answers "${[...new Set(impactGone.values())].join('", "')}" for them, since the file's columns now hold other values (see nba-data-sources.md). ` : ''}In the playoffs, DARKO reads blank in ${darkoPlayoffReasons} of the ${darkoSeasons} seasons from 1998-99, with the reason "${[...darkoPlayoffWhy].join('" or "')}". Over two regular seasons together (2024-25 and 2025-26), RAPM weighted by possessions, BPM by minutes and WAR added up: ${COUNT.format(impactTwoSame)} of ${COUNT.format(impactTwoRows)} players read the same through the engine, and DARKO's projection reads blank with the reason "${darkoTwoReason}"`
)

// Availability (Plan T709) through the engine and the worker's reads, against the raw files. Games out
// are worked out here again from the raw report rows, in JavaScript and not in the SQL that builds the
// table: the last report that lists a player for a game, by timestamp, then a count per player.
const NOT_INJURY =
  /^(-|g league|not with team|personal|rest|coach|league suspension|team suspension|trade pending|health and safety|return to competition|ineligible)/i
const wasInjury = (category, reason) =>
  category !== null ? category === 'Injury/Illness' : !NOT_INJURY.test((reason ?? '').trim() || '-')
const AVAILABILITY_FIRST = 2020
const availabilityGames = new Map(
  (
    await read(
      "SELECT game_id, season, game_type FROM game WHERE played AND game_type IN ('regular', 'playoffs') AND season >= " +
        AVAILABILITY_FIRST
    )
  ).map((g) => [g.game_id, g])
)
const reportRows = await read(
  'SELECT game_id, person_id AS id, team_id, CAST(report_datetime AS VARCHAR) AS at, current_status AS status, category, reason FROM src_nba_injury_report WHERE game_id IS NOT NULL AND person_id IS NOT NULL AND report_datetime IS NOT NULL'
)
const lastReport = new Map()
for (const r of reportRows) {
  const key = r.game_id + '|' + r.id
  const cur = lastReport.get(key)
  if (!cur || r.at > cur.at || (r.at === cur.at && Number(r.team_id) < Number(cur.team_id))) {
    lastReport.set(key, r)
  }
}
const playedLines = new Set(
  (
    await read(
      'SELECT game_id, player_id FROM player_game WHERE seconds > 0 AND season >= ' +
        AVAILABILITY_FIRST
    )
  ).map((r) => r.game_id + '|' + r.player_id)
)
const workedOut = new Map() // season|type -> Map(player -> [injury, other])
const outPlayed = new Map() // season|type -> [listed out, of whom played, injury listed, injury played]
const statusTotals = new Map()
for (const [key, r] of lastReport) {
  const g = availabilityGames.get(r.game_id)
  if (!g) continue
  const bucket = g.season + '|' + g.game_type
  const players = workedOut.get(bucket) ?? new Map()
  const counts = players.get(Number(r.id)) ?? [0, 0]
  players.set(Number(r.id), counts)
  workedOut.set(bucket, players)
  statusTotals.set(r.status, (statusTotals.get(r.status) ?? 0) + 1)
  if (r.status !== 'Out') continue
  const injury = wasInjury(r.category, r.reason)
  counts[injury ? 0 : 1]++
  const o = outPlayed.get(bucket) ?? [0, 0, 0, 0]
  const played = playedLines.has(key)
  o[0]++
  if (played) o[1]++
  if (injury) {
    o[2]++
    if (played) o[3]++
  }
  outPlayed.set(bucket, o)
}
const availabilityRows = []
const outPlayedRows = []
const outPlayedAll = [0, 0, 0, 0]
let availabilitySeasons = 0
for (const season of finished.filter((s) => s >= AVAILABILITY_FIRST).concat(current)) {
  for (const type of ['regular', 'playoffs']) {
    const bucket = season + '|' + type
    const worked = workedOut.get(bucket)
    if (!worked) continue
    const result = await query({
      entity: 'player',
      metrics: ['games_out_injury', 'games_out_other'],
      scope: { seasons: [season], gameTypes: [type] },
      limit: 5000
    })
    const ours = new Map(result.rows.map((r) => [Number(r.id), r.values]))
    let listed = 0
    let noBox = 0
    let rowsSame = 0
    let injuryGames = 0
    let otherGames = 0
    for (const [id, [injury, other]] of worked) {
      const o = ours.get(id)
      if (!o) {
        noBox++
        continue
      }
      listed++
      injuryGames += injury
      otherGames += other
      if ((o.games_out_injury.value ?? 0) === injury && (o.games_out_other.value ?? 0) === other)
        rowsSame++
    }
    // Players the engine gives games out that the raw rows do not.
    let extra = 0
    for (const [id, o] of ours) {
      if (
        !worked.has(id) &&
        ((o.games_out_injury.value ?? 0) > 0 || (o.games_out_other.value ?? 0) > 0)
      )
        extra++
    }
    availabilityRows.push([
      label(season),
      type === 'regular' ? 'Regular season' : 'Playoffs',
      COUNT.format(listed),
      COUNT.format(noBox),
      pct(rowsSame, listed),
      COUNT.format(injuryGames),
      COUNT.format(otherGames),
      COUNT.format(extra)
    ])
    const o = outPlayed.get(bucket) ?? [0, 0, 0, 0]
    for (let i = 0; i < 4; i++) outPlayedAll[i] += o[i]
    outPlayedRows.push([
      label(season),
      type === 'regular' ? 'Regular season' : 'Playoffs',
      COUNT.format(o[0]),
      COUNT.format(o[1]),
      COUNT.format(o[2]),
      COUNT.format(o[3])
    ])
    availabilitySeasons++
  }
}
const earlier = await query({
  entity: 'player',
  metrics: ['games_out_injury'],
  scope: { seasons: [2019] },
  limit: 5
})
const earlierReason = earlier.columns[0]?.reason
const coveredGames = await read(
  "SELECT g.season, count(*) AS games, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM src_nba_injury_report r WHERE r.game_id = g.game_id AND r.person_id IS NOT NULL)) AS reported FROM game g WHERE g.played AND g.game_type = 'regular' AND g.season >= 2019 GROUP BY 1 ORDER BY 1"
)

out.push(
  '',
  "## Games out, from the NBA's injury reports",
  '',
  'Games out (Plan T709) are read through the query engine, for the players with a box-score line in the season and type, against a count worked out again from the raw report rows (`src_nba_injury_report`) in JavaScript, apart from the SQL that builds the table: for each game and player the report with the latest timestamp, then, when its status is Out, one game, for an injury or illness or for another reason (the same rule, written out again). **Not in the box scores** counts players the reports list who have no line that season and type, so the engine does not list them. **Extra** counts players the engine gives games out that the raw rows do not: it should be 0.',
  '',
  table(
    [
      'Season',
      'Type',
      'Players',
      'Not in the box scores',
      'Rows same %',
      'Games out, injury',
      'Games out, other',
      'Extra'
    ],
    availabilityRows
  ),
  '',
  'Out, then in the box score. Each game a player was listed Out on the last report, against a line with minutes in the box score for that game and player: a published listing is not a statement that the player did not play. **Of whom played** counts the games the player has minutes in.',
  '',
  table(
    ['Season', 'Type', 'Listed Out', 'Of whom played', 'Listed Out, injury', 'Of whom played'],
    outPlayedRows
  ),
  '',
  'Over ' +
    availabilitySeasons +
    ' seasons and types together: ' +
    COUNT.format(outPlayedAll[0]) +
    ' games listed Out, ' +
    COUNT.format(outPlayedAll[1]) +
    ' of them with minutes (' +
    (outPlayedAll[0] ? ((100 * outPlayedAll[1]) / outPlayedAll[0]).toFixed(2) : '–') +
    ' %); for injury or illness ' +
    COUNT.format(outPlayedAll[2]) +
    ', ' +
    COUNT.format(outPlayedAll[3]) +
    " with minutes. The last report's statuses over those games: " +
    [...statusTotals].map(([s, n]) => s + ' ' + COUNT.format(n)).join(', ') +
    '.',
  '',
  'Before the first complete season the metric reads blank with the reason "' +
    earlierReason +
    '". Regular-season games with a report listing at least one player, by season: ' +
    coveredGames
      .map((c) => label(c.season) + ' ' + COUNT.format(c.reported) + ' of ' + COUNT.format(c.games))
      .join('; ') +
    '.'
)

// The status on the latest report, and ESPN's current injuries beside it. ESPN's file is a daily
// snapshot of the current season only; they are compared on ESPN's last date, by NBA player id.
const latestEspn =
  (await read('SELECT max(as_of_date)::VARCHAR AS d FROM src_espn_injuries'))[0]?.d ?? null
const espnList = latestEspn
  ? await read(
      "SELECT i.player_id AS id, e.status, e.detail_type, e.injury_date FROM src_espn_injuries e JOIN player_ids i ON i.espn_athlete_id = e.athlete_id WHERE e.as_of_date = DATE '" +
        latestEspn +
        "' AND i.player_id IS NOT NULL"
    )
  : []
const espnTotal = latestEspn
  ? (
      await read(
        "SELECT count(*) AS n FROM src_espn_injuries WHERE as_of_date = DATE '" + latestEspn + "'"
      )
    )[0].n
  : 0
const officialSeason = (
  await read('SELECT max(season) AS s FROM src_nba_injury_report WHERE person_id IS NOT NULL')
)[0].s
const officialIds = (
  await read(
    'SELECT DISTINCT person_id AS id FROM src_nba_injury_report WHERE person_id IS NOT NULL AND season = ' +
      officialSeason
  )
).map((r) => String(r.id))
const officialLatest = await call('availability', { players: officialIds })
const officialById = new Map(officialLatest.map((a) => [a.playerId, a]))
const latestOfficial = (
  await read(
    'SELECT max(report_datetime)::DATE::VARCHAR AS d FROM src_nba_injury_report WHERE person_id IS NOT NULL'
  )
)[0].d
const espnOut = espnList.filter((e) => e.status === 'Out')
const espnByStatus = new Map()
for (const e of espnList) espnByStatus.set(e.status, (espnByStatus.get(e.status) ?? 0) + 1)
let espnOutOfficialOut = 0
let espnOutOfficialOther = 0
let espnOutNotListed = 0
for (const e of espnOut) {
  const a = officialById.get(String(e.id))
  if (!a) espnOutNotListed++
  else if (a.status === 'Out') espnOutOfficialOut++
  else espnOutOfficialOther++
}
const officialOut = officialLatest.filter((a) => a.status === 'Out' && a.injury)
const espnIds = new Set(espnList.map((e) => String(e.id)))
const officialOutOnEspn = officialOut.filter((a) => espnIds.has(a.playerId)).length

out.push(
  '',
  "## The injury report and ESPN's injuries",
  '',
  "ESPN's file (`src_espn_injuries`) is a snapshot per day of the current season only. The official report's latest date is " +
    latestOfficial +
    " and ESPN's is " +
    latestEspn +
    ". On ESPN's last date it lists " +
    COUNT.format(espnTotal) +
    ' players (' +
    [...espnByStatus].map(([s, n]) => s + ' ' + n).join(', ') +
    '), ' +
    COUNT.format(espnList.length) +
    ' of them with an NBA id. Of the ' +
    COUNT.format(espnOut.length) +
    " ESPN lists as Out, the official report's latest status is Out for " +
    COUNT.format(espnOutOfficialOut) +
    ', another status for ' +
    COUNT.format(espnOutOfficialOther) +
    ', and the player is not on the latest report for ' +
    COUNT.format(espnOutNotListed) +
    '. Of the ' +
    COUNT.format(officialOut.length) +
    ' players the official report lists Out for an injury or illness, ' +
    COUNT.format(officialOutOnEspn) +
    " are on ESPN's list."
)

// Coaches and officials against the raw files, each with its ESPN twin where one exists. ESPN has no
// coach file, so the coaches have none. The head coach and the assistants are read as the screens do.
const HEAD = /^(interim )?head coach$/i
const staff = (title) =>
  !title
    ? null
    : HEAD.test(title)
      ? 'head'
      : /trainer|strength|conditioning|director/i.test(title)
        ? null
        : /coach/i.test(title)
          ? 'assistant'
          : null
const coachRaw = await read(
  'SELECT team_id, season, coach_name AS name, coach_type AS title FROM src_nba_coaches'
)
const rawStaff = new Map()
for (const c of coachRaw) {
  const role = staff(c.title)
  if (!role || !c.name) continue
  const key = c.team_id + '|' + c.season
  const s = rawStaff.get(key) ?? { head: new Set(), assistant: new Set() }
  s[role].add(c.name.trim())
  rawStaff.set(key, s)
}
const seasonTeams = await read(
  'SELECT season, team_id FROM team WHERE season >= 2000 ORDER BY season, team_id'
)
const coachRows = []
for (const season of [...new Set(seasonTeams.map((t) => t.season))]) {
  let teams = 0
  let withHead = 0
  let headSame = 0
  let assistSame = 0
  for (const t of seasonTeams.filter((x) => x.season === season)) {
    teams++
    const ours = await call('coaches', { team: String(t.team_id), season })
    const raw = rawStaff.get(t.team_id + '|' + season)
    const names = (role) => new Set(ours.filter((c) => c.role === role).map((c) => c.name))
    const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))
    const rawHead = raw?.head ?? new Set()
    const rawAssist = raw?.assistant ?? new Set()
    if (rawHead.size) withHead++
    if (same(names('head'), rawHead)) headSame++
    if (same(names('assistant'), rawAssist)) assistSame++
  }
  coachRows.push([
    label(season),
    COUNT.format(teams),
    COUNT.format(withHead),
    pct(headSame, teams),
    pct(assistSame, teams)
  ])
}

const normalName = (s) =>
  s
    .normalize('NFKD')
    .replace(/[^a-z]/gi, '')
    .toLowerCase()
const crews = await read(
  "SELECT g.season, g.game_id, g.nba_game_id, g.espn_game_id FROM game g WHERE g.played AND g.game_type IN ('regular', 'playoffs') AND g.nba_game_id IS NOT NULL AND g.season >= 2000"
)
const nbaCrew = new Map()
for (const o of await read('SELECT game_id, first_name, last_name FROM src_nba_officials')) {
  const set = nbaCrew.get(o.game_id) ?? new Set()
  set.add(normalName(String(o.first_name ?? '') + String(o.last_name ?? '')))
  nbaCrew.set(o.game_id, set)
}
const espnCrew = new Map()
for (const o of await read('SELECT game_id, official_full_name AS name FROM src_espn_officials')) {
  const set = espnCrew.get(Number(o.game_id)) ?? new Set()
  set.add(normalName(String(o.name ?? '')))
  espnCrew.set(Number(o.game_id), set)
}
const officialRows = []
const seasonsWithCrews = [...new Set(crews.map((c) => c.season))].sort((a, b) => a - b)
for (const season of seasonsWithCrews) {
  const games = crews.filter((c) => c.season === season)
  let withNba = 0
  let withEspn = 0
  let both = 0
  let sameCrew = 0
  for (const g of games) {
    const n = nbaCrew.get(g.nba_game_id)
    const e = espnCrew.get(Number(g.espn_game_id))
    if (n) withNba++
    if (e) withEspn++
    if (n && e) {
      both++
      if (n.size === e.size && [...n].every((x) => e.has(x))) sameCrew++
    }
  }
  officialRows.push([
    label(season),
    COUNT.format(games.length),
    pct(withNba, games.length),
    pct(withEspn, games.length),
    COUNT.format(both),
    pct(sameCrew, both)
  ])
}
// The screens' read of a crew, against the raw file, on a spread of games in four seasons.
let readGames = 0
let readSame = 0
let readEmpty = 0
for (const season of [2005, 2013, 2020, 2026]) {
  const games = crews.filter((c) => c.season === season)
  for (const g of games.filter((_, i) => i % 15 === 0)) {
    const detail = await call('game', { game: g.game_id })
    const raw = nbaCrew.get(g.nba_game_id)
    readGames++
    const ours = new Set((detail?.officials ?? []).map((o) => normalName(o.name)))
    if (!raw) {
      if (ours.size === 0) readSame++
      readEmpty++
    } else if (ours.size === raw.size && [...ours].every((x) => raw.has(x))) readSame++
  }
}

out.push(
  '',
  '## Coaches and officials',
  '',
  "A team's staff (`src_nba_coaches`) as the team dashboard reads it, against the raw rows: the head coach (or coaches, when it changed: the file has no dates) and the assistants, with trainers and strength staff left out. ESPN has no coach file, so there is no twin to compare. **With a head coach** counts the teams the file has a head coach row for; the rest read as no coach listed, not as a team without one.",
  '',
  table(['Season', 'Teams', 'With a head coach', 'Head same %', 'Assistants same %'], coachRows),
  '',
  "Officials (`src_nba_officials`) against ESPN's twin (`src_espn_officials`), played regular-season and playoff games from 1999-00 with an NBA id: the share of games each file has a crew for, and, where both do, the share whose crews hold the same names (case, accents and spaces ignored). The sources are not merged: the Games screen shows the NBA's.",
  '',
  table(
    ['Season', 'Games', 'NBA has crew %', 'ESPN has crew %', 'Both', 'Same crew %'],
    officialRows
  ),
  '',
  "The Games screen's read of a crew (`readGame`), on every 15th game of 2004-05, 2012-13, 2019-20 and 2025-26: " +
    COUNT.format(readSame) +
    ' of ' +
    COUNT.format(readGames) +
    ' match the raw file, ' +
    COUNT.format(readEmpty) +
    ' of them games with no crew in the file, which read as none.'
)

// The published standings, which the Standings screen and a team's header read.
const standings = await read(`WITH e AS (
    SELECT s.season, t.team_id,
      max(value) FILTER (stat_name = 'wins') AS wins,
      max(value) FILTER (stat_name = 'losses') AS losses,
      max(value) FILTER (stat_name = 'gamesBehind') AS gb,
      max(display_value) FILTER (stat_name = 'streak') AS streak
    FROM src_espn_standings s JOIN team t ON t.espn_team_id = s.team_id AND t.season = s.season
    WHERE s.season = s.file_season
    GROUP BY 1, 2
  ), leader AS (
    SELECT season, conference, arg_min(wins, playoff_rank) AS w, arg_min(losses, playoff_rank) AS l
    FROM src_dash_standings GROUP BY 1, 2
  )
  SELECT d.season, count(*) AS teams,
    count(*) FILTER (d.wins = b.wins AND d.losses = b.losses) AS box,
    count(n.team_id) AS nba,
    count(*) FILTER (n.wins = d.wins AND n.losses = d.losses AND n.playoff_rank = d.playoff_rank
      AND n.conference_games_back = d.conference_games_back
      AND n.current_streak IS NOT DISTINCT FROM d.current_streak) AS nba_same,
    count(e.team_id) AS espn,
    count(*) FILTER (e.wins = d.wins AND e.losses = d.losses) AS espn_record,
    count(*) FILTER (e.gb = d.conference_games_back) AS espn_gb,
    count(*) FILTER (replace(d.str_current_streak, ' ', '') = e.streak) AS espn_streak,
    count(*) FILTER (d.conference_games_back
      = ((l.w - d.wins) + (d.losses - l.l)) / 2.0) AS arithmetic
  FROM src_dash_standings d
  LEFT JOIN team_season b ON b.team_id = d.team_id AND b.season = d.season AND b.game_type = 'regular'
  LEFT JOIN src_nba_standings n ON n.team_id = d.team_id AND n.season = d.season
  LEFT JOIN e ON e.team_id = d.team_id AND e.season = d.season
  LEFT JOIN leader l ON l.season = d.season AND l.conference = d.conference
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## The published standings',
  '',
  "`nba_stats_standings`, and the league dashboards' file, which alone reaches 1995-96. Percentages are of each season's teams. **Box scores:** wins and losses against `team_season`. **NBA's file:** the same record, rank, games back and streak as the dashboards'. **ESPN:** `espn_nba_standings`, from 2001-02. **By the record:** games back worked out from the conference leader's record. The last ten and the streak start in 2001-02. In 2003-04 the NBA's file repeats the overall record as the conference and division records, so the screen reads those as not published.",
  '',
  table(
    [
      'Season',
      'Teams',
      'Box scores %',
      "NBA's file %",
      'ESPN record %',
      'ESPN games back %',
      'ESPN streak %',
      'By the record %'
    ],
    standings.map((r) => [
      label(r.season),
      r.teams,
      pct(r.box, r.teams),
      r.nba ? pct(r.nba_same, r.nba) : '–',
      r.espn ? pct(r.espn_record, r.espn) : '–',
      r.espn ? pct(r.espn_gb, r.espn) : '–',
      r.espn ? pct(r.espn_streak, r.espn) : '–',
      pct(r.arithmetic, r.teams)
    ])
  )
)

// What the Games screen shows: the players' lines and the team's box score against the final score.
const boxes = await read(`WITH lines AS (
    SELECT game_id, team_id, sum(pts) AS pts, sum(reb) AS reb, sum(ast) AS ast
    FROM player_game GROUP BY 1, 2
  )
  SELECT t.season, count(*) AS sides,
    count(*) FILTER (t.pts = t.points_for) AS team_same,
    count(*) FILTER (l.pts = t.points_for) AS lines_same,
    count(*) FILTER (l.reb = t.reb) AS reb_same,
    count(*) FILTER (l.ast = t.ast) AS ast_same,
    coalesce(max(abs(l.pts - t.points_for)), 0) AS worst
  FROM team_game t LEFT JOIN lines l ON l.game_id = t.game_id AND l.team_id = t.team_id
  WHERE t.box_games = 1 AND t.game_type IN ('regular', 'play-in', 'playoffs', 'cup-final')
  GROUP BY 1 ORDER BY 1`)
out.push(
  '',
  '## Box scores against the final score',
  '',
  "What the Games screen shows, per team-game with a box score that counts. **Team box:** the team's points against the final score. **Lines:** its players' points summed against the final score, then rebounds and assists against the team's box. **Worst:** the most points a game's lines fall short or over. The screen says so when a game's lines do not add up to its score.",
  '',
  table(
    ['Season', 'Team-games', 'Team box %', 'Lines %', 'Rebounds %', 'Assists %', 'Worst'],
    boxes.map((r) => [
      label(r.season),
      COUNT.format(r.sides),
      pct(r.team_same, r.sides),
      pct(r.lines_same, r.sides),
      pct(r.reb_same, r.sides),
      pct(r.ast_same, r.sides),
      r.worst
    ])
  )
)

await close()
writeFileSync(mdFile, `${out.join('\n')}\n`)
console.log(`${games.length} seasons, ${wrong} problems with games or teams`)
process.exit(wrong > 0 ? 1 : 0)
