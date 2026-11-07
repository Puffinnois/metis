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

const { read, query, close } = openStatsWorker(folder)

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

await close()
writeFileSync(mdFile, `${out.join('\n')}\n`)
console.log(`${games.length} seasons, ${wrong} problems with games or teams`)
process.exit(wrong > 0 ? 1 : 0)
