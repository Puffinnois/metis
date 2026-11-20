// NCAA Division I's agreement checks (Plan T1302.5 on), one module for the men and the women (D38):
// the game and season tables against their two source families and against themselves, season by
// season, 2021-22 on (D39). Run through `scripts/check-agreement.mjs <folder> <out.md> --league=ncaam`
// (or `ncaaw`), which loads `agreement-ncaam.mjs` and `agreement-ncaaw.mjs`. Every comparison is exact
// unless its table states a tolerance. Returns how many checks that must hold everywhere failed: the
// Division I teams or the NCAA tournament's games of a finished season, or a player's game rows not
// adding up to their season row.

import { collegeDepthAgreement } from './agreement-college-depth.mjs'
import { collegePlaysAgreement } from './agreement-college-plays.mjs'

const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const share = (part, whole) => (whole ? `${COUNT.format(part)} (${pct(part, whole)} %)` : '–')
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

/** Division I teams a season, the groups file's and Sports Reference's (T1302.4). */
const DIVISION_I = {
  ncaam: { 2022: 358, 2023: 363, 2024: 362, 2025: 364, 2026: 365, 2027: 365 },
  ncaaw: { 2022: 356, 2023: 361, 2024: 360, 2025: 362, 2026: 363, 2027: 363 }
}

/** The last season finished at the load: 2026-27 is being played. */
const FINISHED = 2026

/** The counts both team boxes hold, as `team_game` names them and as stats.ncaa.org's does. */
const NCAA_TEAM = {
  pts: 'pts',
  fgm: 'fgm',
  fga: 'fga',
  fg3m: 'tpm',
  fg3a: 'tpa',
  ftm: 'ftm',
  fta: 'fta',
  oreb: 'orb',
  dreb: 'drb',
  ast: 'ast',
  blk: 'blk',
  tov: '"to"'
}
const ESPN_TEAM = {
  pts: 'team_score',
  fgm: 'field_goals_made',
  fga: 'field_goals_attempted',
  fg3m: 'three_point_field_goals_made',
  fg3a: 'three_point_field_goals_attempted',
  ftm: 'free_throws_made',
  fta: 'free_throws_attempted',
  oreb: 'offensive_rebounds',
  dreb: 'defensive_rebounds',
  reb: 'total_rebounds',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  tov: 'turnovers',
  pf: 'fouls'
}

export async function collegeAgreement(league, read, out, query) {
  let wrong = 0
  const name = league === 'ncaam' ? "NCAA Division I men's" : "NCAA Division I women's"
  out.push(
    `# ${name} agreement checks`,
    '',
    'Written by `scripts/check-agreement.mjs` from a real load (Plan T1302.5). Counted games are every type but the exhibitions (`preseason`), played (D45). Percentages are the share of rows that match exactly. What these numbers mean for the app is in [ncaa-data-sources.md](ncaa-data-sources.md).'
  )

  // 1. Games, teams and events.
  const games = await read(`SELECT g.season,
      count(*) FILTER (WHERE g.played AND g.game_type <> 'preseason')::INTEGER AS counted,
      count(*) FILTER (WHERE g.played AND g.game_type = 'playoffs')::INTEGER AS ncaa_tournament,
      count(*) FILTER (WHERE g.played AND g.game_type = 'preseason')::INTEGER AS exhibitions,
      count(*) FILTER (WHERE g.forfeit_winner_id IS NOT NULL)::INTEGER AS forfeits,
      count(*) FILTER (WHERE g.played AND g.source = 'ncaa' AND g.game_type <> 'preseason')::INTEGER AS ncaa_only,
      (SELECT count(*) FROM team t WHERE t.season = g.season AND t.division_i)::INTEGER AS division_i
    FROM game g GROUP BY g.season ORDER BY g.season`)
  const gameRows = games.map((r) => {
    const teams = DIVISION_I[league][r.season]
    const bad = r.season <= FINISHED && (r.division_i !== teams || r.ncaa_tournament !== 67)
    if (bad) wrong++
    return [
      label(r.season),
      COUNT.format(r.counted),
      `${r.division_i}${teams === undefined || r.division_i === teams ? '' : ` (expected ${teams})`}`,
      r.ncaa_tournament,
      r.exhibitions,
      r.forfeits,
      r.ncaa_only,
      bad ? 'WRONG' : 'ok'
    ]
  })
  out.push(
    '',
    '## Games and teams',
    '',
    table(
      [
        'Season',
        'Counted games',
        'Division I teams',
        'NCAA tournament',
        'Exhibitions',
        'Forfeits',
        "Only stats.ncaa.org's",
        'Check'
      ],
      gameRows
    )
  )

  // 2. Where each team-game's box score comes from, and whether it adds up to the score.
  const sources = await read(`SELECT t.season, count(*)::INTEGER AS sides,
      count(*) FILTER (WHERE t.source = 'espn')::INTEGER AS espn,
      count(*) FILTER (WHERE t.source = 'ncaa')::INTEGER AS ncaa,
      count(*) FILTER (WHERE t.box_games = 0)::INTEGER AS no_box,
      count(*) FILTER (WHERE t.box_games = 1)::INTEGER AS boxed,
      count(*) FILTER (WHERE t.box_games = 1 AND t.pts = t.points_for)::INTEGER AS score
    FROM team_game t WHERE t.game_type <> 'preseason' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '## Team-games and their box scores',
    '',
    "A team-game's counts are ESPN's team box where its lines are ESPN's, stats.ncaa.org's where ESPN has none, and the players summed where neither box has a count. A forfeit has no box score.",
    '',
    table(
      [
        'Season',
        'Team-games',
        "ESPN's",
        "stats.ncaa.org's",
        'No box score (forfeits)',
        'Points equal the score'
      ],
      sources.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        COUNT.format(r.espn),
        COUNT.format(r.ncaa),
        r.no_box,
        share(r.score, r.boxed)
      ])
    )
  )

  // 3. Team totals against each family's team box.
  const espnCols = Object.keys(ESPN_TEAM)
  const espnTeam = await read(`SELECT t.season, count(*)::INTEGER AS n,
      ${espnCols.map((c) => `count(*) FILTER (WHERE t.${c} = TRY_CAST(e.${ESPN_TEAM[c]} AS INTEGER))::INTEGER AS ${c}`).join(', ')}
    FROM team_game t JOIN game g USING (game_id)
    JOIN src_espn_team_box e ON e.game_id = g.espn_game_id AND e.team_id = t.team_id AND e.season = e.file_season
    WHERE t.source = 'espn' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "## Team totals against ESPN's team box",
    '',
    "Every count of the team-games whose box is ESPN's against ESPN's team box: the tables read it, so anything short of 100 % is a team-game where ESPN's box lacks a count and the players' sum stands in.",
    '',
    table(
      ['Season', 'Team-games', ...espnCols],
      espnTeam.map((r) => [
        label(r.season),
        COUNT.format(r.n),
        ...espnCols.map((c) => pct(r[c], r.n))
      ])
    )
  )
  const ncaaCols = Object.keys(NCAA_TEAM)
  const ncaaTeam = await read(`SELECT t.season, count(*)::INTEGER AS n,
      ${ncaaCols.map((c) => `count(*) FILTER (WHERE t.${c} = TRY_CAST(n.${NCAA_TEAM[c]} AS INTEGER))::INTEGER AS ${c}`).join(', ')}
    FROM team_game t JOIN game g USING (game_id)
    JOIN src_ncaa_team_box n ON n.contest_id = g.ncaa_game_id AND TRY_CAST(n.team_espn_team_id AS INTEGER) = t.team_id
    WHERE t.source = 'espn' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "## The two families' team boxes",
    '',
    "ESPN's team totals (the tables') against stats.ncaa.org's team box for the same team-game, linked by the contest and the team's ESPN id. Both count the team rebounds and the team's own turnovers.",
    '',
    table(
      ['Season', 'Team-games', ...ncaaCols],
      ncaaTeam.map((r) => [
        label(r.season),
        COUNT.format(r.n),
        ...ncaaCols.map((c) => pct(r[c], r.n))
      ])
    )
  )

  // 4. Player sums against the team's lines.
  const equal = ['pts', 'fgm', 'fga', 'fg3m', 'fta', 'ftm', 'ast', 'stl', 'blk']
  const sums = await read(`WITH p AS (
      SELECT game_id, team_id, ${[...equal, 'reb', 'tov', 'pf'].map((c) => `sum(${c}) AS ${c}`).join(', ')}
      FROM player_game GROUP BY 1, 2
    )
    SELECT t.season, count(*)::INTEGER AS n,
      ${equal.map((c) => `count(*) FILTER (WHERE p.${c} = t.${c})::INTEGER AS ${c}`).join(', ')},
      count(*) FILTER (WHERE p.reb <= t.reb)::INTEGER AS reb, count(*) FILTER (WHERE p.tov <= t.tov)::INTEGER AS tov,
      count(*) FILTER (WHERE p.pf = t.pf)::INTEGER AS pf
    FROM team_game t JOIN p USING (game_id, team_id)
    WHERE t.box_games = 1 AND t.game_type <> 'preseason' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "## Player sums against the team's lines",
    '',
    "Each team-game's player lines summed against its team line. Rebounds and turnovers are compared as at most the team's, since the team box adds the team rebounds and the team's own turnovers.",
    '',
    table(
      ['Season', 'Team-games', ...equal, 'reb ≤', 'tov ≤', 'pf'],
      sums.map((r) => [
        label(r.season),
        COUNT.format(r.n),
        ...[...equal, 'reb', 'tov', 'pf'].map((c) => pct(r[c], r.n))
      ])
    )
  )

  // 5. The two families' player lines, side by side on the same rows.
  const lines = await read(`SELECT season, count(*) FILTER (WHERE source = 'espn')::INTEGER AS espn,
      count(*) FILTER (WHERE source = 'espn' AND ncaa_games = 1)::INTEGER AS paired,
      count(*) FILTER (WHERE source = 'espn' AND ncaa_games = 1 AND pts = ncaa_pts)::INTEGER AS pts,
      count(*) FILTER (WHERE source = 'espn' AND ncaa_games = 1 AND fga = ncaa_fga AND fgm = ncaa_fgm)::INTEGER AS fg,
      count(*) FILTER (WHERE source = 'espn' AND ncaa_games = 1 AND fg3a = ncaa_fg3a AND fg3m = ncaa_fg3m)::INTEGER AS fg3,
      count(*) FILTER (WHERE source = 'espn' AND ncaa_games = 1 AND fta = ncaa_fta AND ftm = ncaa_ftm)::INTEGER AS ft,
      count(*) FILTER (WHERE source = 'espn' AND ncaa_games = 1 AND pts = ncaa_pts AND fga = ncaa_fga
                         AND fgm = ncaa_fgm AND fg3a = ncaa_fg3a AND fg3m = ncaa_fg3m AND fta = ncaa_fta
                         AND ftm = ncaa_ftm AND tov = ncaa_tov)::INTEGER AS every,
      count(*) FILTER (WHERE source = 'ncaa')::INTEGER AS ncaa_lines
    FROM player_game WHERE game_type <> 'preseason' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "## The two families' player lines",
    '',
    "ESPN's lines (the counts) with stats.ncaa.org's line for the same player and game beside them (`ncaa_*`, D40). \"Paired\" is the share of ESPN's lines with one; the rest are players stats.ncaa.org's lines map to no ESPN athlete (T1302.4). \"Every\" asks points, every attempt and make, and turnovers all equal. stats.ncaa.org's lines stand alone only for the team-games ESPN has none of.",
    '',
    table(
      [
        'Season',
        "ESPN's lines",
        'Paired',
        'Points',
        'FG',
        '3FG',
        'FT',
        'Every',
        "stats.ncaa.org's alone"
      ],
      lines.map((r) => [
        label(r.season),
        COUNT.format(r.espn),
        share(r.paired, r.espn),
        pct(r.pts, r.paired),
        pct(r.fg, r.paired),
        pct(r.fg3, r.paired),
        pct(r.ft, r.paired),
        pct(r.every, r.paired),
        COUNT.format(r.ncaa_lines)
      ])
    )
  )
  const splits = await read(`SELECT season, count(*)::INTEGER AS n,
      count(*) FILTER (WHERE ncaa_rima + ncaa_mida + ncaa_fg3a = ncaa_fga)::INTEGER AS zones,
      count(*) FILTER (WHERE ncaa_fga_trans <= ncaa_fga AND ncaa_fgm_ast <= ncaa_fgm AND ncaa_pbacka <= ncaa_rima + ncaa_mida)::INTEGER AS within
    FROM player_game WHERE ncaa_games = 1 GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    table(
      [
        'Season',
        'Lines with splits',
        'Rim + mid + three = FGA',
        'Transition, assisted and putbacks within their totals'
      ],
      splits.map((r) => [label(r.season), COUNT.format(r.n), pct(r.zones, r.n), pct(r.within, r.n)])
    )
  )

  // 6. Game rows against season rows: must hold everywhere.
  const rollup = await read(`WITH g AS (
      SELECT player_id, season, game_type, count(*) AS games, sum(pts) AS pts, sum(ncaa_pts) AS ncaa_pts
      FROM player_game GROUP BY 1, 2, 3
    )
    SELECT s.season, count(*)::INTEGER AS n,
      count(*) FILTER (WHERE s.games = g.games AND s.pts IS NOT DISTINCT FROM g.pts
                         AND s.ncaa_pts IS NOT DISTINCT FROM g.ncaa_pts)::INTEGER AS same
    FROM player_season s JOIN g USING (player_id, season, game_type)
    WHERE s.team_id IS NULL GROUP BY 1 ORDER BY 1`)
  for (const r of rollup) if (r.same !== r.n) wrong++
  out.push(
    '',
    '## Game rows against season rows',
    '',
    "Each player's season row of no team against their game rows summed (games, points, stats.ncaa.org's points). Must hold everywhere.",
    '',
    table(
      ['Season', 'Player-seasons', 'Equal'],
      rollup.map((r) => [label(r.season), COUNT.format(r.n), share(r.same, r.n)])
    )
  )

  // 7. Records against ESPN's published standings.
  const records = await read(`WITH ours AS (
      SELECT team_id, season, sum(wins)::INTEGER AS w, sum(losses)::INTEGER AS l,
             count(*) FILTER (WHERE box_games = 0)::INTEGER AS forfeits
      FROM team_game WHERE game_type <> 'preseason' GROUP BY 1, 2
    ), espn AS (
      SELECT team_id, season, max(value) FILTER (WHERE stat_type = 'wins')::INTEGER AS w,
             max(value) FILTER (WHERE stat_type = 'losses')::INTEGER AS l
      FROM src_espn_standings WHERE season = file_season GROUP BY 1, 2
    )
    SELECT e.season, count(*)::INTEGER AS n,
      count(*) FILTER (WHERE e.w = o.w AND e.l = o.l)::INTEGER AS same,
      count(*) FILTER (WHERE NOT (e.w = o.w AND e.l = o.l) AND o.forfeits > 0)::INTEGER AS forfeits
    FROM espn e JOIN ours o USING (team_id, season) GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "## Records against ESPN's standings",
    '',
    "Each Division I team's wins and losses over every counted game against ESPN's standings, which count every game, the postseason with it. A team whose record differs and that has a forfeit is counted apart: ESPN's standings and its schedule's 2-0 rows do not always agree on a forfeit.",
    '',
    table(
      ['Season', 'Teams', 'Equal', 'Differ, with a forfeit'],
      records.map((r) => [label(r.season), r.n, share(r.same, r.n), r.forfeits])
    )
  )

  // 8. Through the engine: every Division I team's points and the season's leaders, 2021-22 and the
  // last finished season, against the tables summed directly.
  const engine = []
  for (const season of [2022, FINISHED]) {
    const result = await query({
      entity: 'team',
      metrics: ['team_pts', 'team_reb', 'team_ncaa_poss'],
      scope: { seasons: [season] },
      limit: 500
    })
    // The engine's points are the final score's (`team_pts`), a forfeit's 2-0 with them.
    const direct =
      await read(`SELECT t.team_id::VARCHAR AS id, sum(t.points_for)::INTEGER AS pts, sum(t.reb)::INTEGER AS reb,
        sum(t.ncaa_poss) AS poss
      FROM team_game t JOIN team d ON d.team_id = t.team_id AND d.season = t.season AND d.division_i
      WHERE t.season = ${season} AND t.game_type <> 'preseason' GROUP BY 1`)
    const byId = new Map(direct.map((r) => [r.id, r]))
    const same = result.rows.filter((r) => {
      const d = byId.get(r.id)
      return (
        d &&
        r.values.team_pts.value === d.pts &&
        r.values.team_reb.value === d.reb &&
        Math.abs((r.values.team_ncaa_poss.value ?? 0) - (d.poss ?? 0)) < 1e-6
      )
    }).length
    const top = await query({
      entity: 'player',
      metrics: ['pts'],
      transform: 'perGame',
      scope: { seasons: [season], qualifiedOnly: true },
      limit: 3
    })
    engine.push([
      label(season),
      `${same} of ${direct.length} (${result.rows.length} rows)`,
      top.rows.map((r) => `${r.name} ${r.values.pts.value?.toFixed(1)} (${r.games} g)`).join('; ')
    ])
  }
  out.push(
    '',
    '## Through the engine',
    '',
    "Every Division I team's points, rebounds and stats.ncaa.org possessions over every counted game, as the engine answers them, against the table summed directly; and the season's first three scorers per game under the 75 % rule (D43). Teams outside Division I are not rows of a board (D40).",
    '',
    table(['Season', 'Teams equal', 'Leading scorers'], engine)
  )
  // The shots, lineups, stints, possessions and published models (T1302.6).
  wrong += await collegeDepthAgreement(league, read, out, query)
  // The play by play's own tables and the time on the floor credited from it (T1302.7).
  wrong += await collegePlaysAgreement(league, read, out, query)
  return wrong
}
