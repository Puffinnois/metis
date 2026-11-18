// The WNBA's game and season tables (Plan T1301.6) against their sources and the league's own
// published season stats, season by season. Called by `agreement-wnba.mjs`. Every comparison is exact
// unless its table states a tolerance. Returns how many checks that must hold everywhere failed: a
// player's game rows not adding up to their season row, or a team's record not the standings'.

const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const share = (part, whole) => (whole ? `${COUNT.format(part)} (${pct(part, whole)} %)` : '–')

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

/** The dashboards' regular season, one row per player: a player listed twice (2026) is summed. */
const DASH_PLAYERS = `SELECT player_id, season, sum(gp)::INTEGER AS gp, sum(pts)::INTEGER AS pts,
         sum(reb)::INTEGER AS reb, sum(ast)::INTEGER AS ast, sum(min) AS min,
         any_value(player_name) AS name
  FROM src_dash_player_stats_base WHERE season_type = 'Regular Season' GROUP BY 1, 2`

/** A player's whole regular season from the built tables. */
const OUR_PLAYERS = `SELECT player_id, season, games::INTEGER AS gp, pts::INTEGER AS pts,
         reb::INTEGER AS reb, ast::INTEGER AS ast, minutes AS min
  FROM player_season WHERE team_id IS NULL AND game_type = 'regular'`

export async function tableChecks(read, query, out) {
  let wrong = 0
  const counts = await read(`SELECT (SELECT count(*) FROM team_game)::INTEGER AS team_game,
      (SELECT count(*) FROM player_game)::INTEGER AS player_game,
      (SELECT count(*) FROM team_season)::INTEGER AS team_season,
      (SELECT count(*) FROM player_season)::INTEGER AS player_season`)
  const c = counts[0]
  out.push(
    '',
    '## Game and season tables',
    '',
    `Built by the WNBA's recipe (\`derived/gameWnba.ts\`, Plan T1301.6): \`team_game\` ${COUNT.format(c.team_game)} rows, \`player_game\` ${COUNT.format(c.player_game)}, \`team_season\` ${COUNT.format(c.team_season)}, \`player_season\` ${COUNT.format(c.player_season)}. Player lines are the game logs' and, in 2026, the box scores'; team lines the game logs' team rows; ESPN's lines only where the league has none (the Commissioner's Cup finals).`
  )

  // 5. Where each line comes from, and whether each team's box adds up to its score.
  const sources = await read(`SELECT t.season,
      count(*)::INTEGER AS sides,
      count(*) FILTER (WHERE t.source = 'wnba' AND t.seconds IS NOT NULL)::INTEGER AS league,
      count(*) FILTER (WHERE t.box_games = 0)::INTEGER AS no_box,
      count(*) FILTER (WHERE t.source = 'espn')::INTEGER AS espn,
      count(*) FILTER (WHERE t.box_games = 1 AND t.pts = t.points_for)::INTEGER AS score,
      count(*) FILTER (WHERE t.box_games = 1)::INTEGER AS boxed,
      count(*) FILTER (WHERE t.starts_known = 1)::INTEGER AS starters,
      (SELECT count(*) FROM player_game p WHERE p.season = t.season)::INTEGER AS lines,
      (SELECT count(*) FROM player_game p WHERE p.season = t.season AND p.source = 'espn')::INTEGER
        AS espn_lines
    FROM team_game t GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### Lines and sources by season',
    '',
    "**Team-games:** both sides of every game played between two league teams (the All-Star Game has none). **No box score:** the 2018 forfeit. **ESPN:** the Cup final, ESPN's alone. **Box = score:** team-games whose box-score points equal the game's score. **Starters known:** team-games with exactly five starters flagged (ESPN's flags from 2002, the league's 2026 box scores); before 2002 nobody is flagged, and a game with a starter ESPN has under another id reads unknown.",
    '',
    table(
      [
        'Season',
        'Team-games',
        'No box score',
        'ESPN',
        'Box = score',
        'Starters known',
        'Player lines',
        'Of them ESPN'
      ],
      sources.map((r) => [
        r.season,
        COUNT.format(r.sides),
        r.no_box || '–',
        r.espn || '–',
        `${COUNT.format(r.score)} of ${COUNT.format(r.boxed)}`,
        share(r.starters, r.sides),
        COUNT.format(r.lines),
        r.espn_lines || '–'
      ])
    )
  )

  // 6. ESPN's lines against the league's, per season.
  const espn = await read(`WITH e AS (
      SELECT g.game_id, i.player_id, b.points, b.rebounds, b.assists, b.minutes
      FROM src_espn_player_box b
      JOIN game g ON g.espn_game_id = b.game_id
      JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
      WHERE b.season = b.file_season
      QUALIFY row_number() OVER (PARTITION BY g.game_id, i.player_id ORDER BY b.minutes DESC NULLS LAST) = 1
    )
    SELECT p.season, count(*)::INTEGER AS lines, count(e.player_id)::INTEGER AS paired,
           count(*) FILTER (WHERE e.points = p.pts)::INTEGER AS pts,
           count(*) FILTER (WHERE e.rebounds = p.reb)::INTEGER AS reb,
           count(*) FILTER (WHERE e.assists = p.ast)::INTEGER AS ast,
           count(*) FILTER (WHERE e.points = p.pts AND e.rebounds = p.reb AND e.assists = p.ast)::INTEGER
             AS all3,
           count(*) FILTER (WHERE abs(e.minutes - p.minutes) <= 1)::INTEGER AS minutes,
           count(e.minutes)::INTEGER AS with_minutes
    FROM player_game p
    JOIN game g ON g.game_id = p.game_id AND g.espn_game_id IS NOT NULL
    LEFT JOIN e ON e.game_id = p.game_id AND e.player_id = p.player_id
    WHERE p.source = 'wnba' AND p.season >= 2002
    GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### ESPN against the league, player-games',
    '',
    "The league's lines in the games ESPN has, paired with ESPN's line for the same player (through `player_ids`). Exact on points, rebounds and assists; minutes within one, since the game logs print whole minutes. ESPN's 2002 lines are all zeros and have no minutes, so its counts are never read for 2002: they only flag the starters.",
    '',
    table(
      [
        'Season',
        'League lines',
        'Paired with ESPN',
        'Points %',
        'Rebounds %',
        'Assists %',
        'All three %',
        'Minutes within 1 %'
      ],
      espn.map((r) => [
        r.season,
        COUNT.format(r.lines),
        share(r.paired, r.lines),
        pct(r.pts, r.paired),
        pct(r.reb, r.paired),
        pct(r.ast, r.paired),
        pct(r.all3, r.paired),
        pct(r.minutes, r.with_minutes)
      ])
    )
  )

  // 7. The season tables against the league's dashboards.
  const players = await read(`WITH d AS (${DASH_PLAYERS}), o AS (${OUR_PLAYERS})
    SELECT d.season, count(*)::INTEGER AS dash, count(o.player_id)::INTEGER AS found,
           count(*) FILTER (WHERE o.gp = d.gp)::INTEGER AS gp,
           count(*) FILTER (WHERE o.pts = d.pts)::INTEGER AS pts,
           count(*) FILTER (WHERE o.reb = d.reb)::INTEGER AS reb,
           count(*) FILTER (WHERE o.ast = d.ast)::INTEGER AS ast,
           count(*) FILTER (WHERE abs(o.min - d.min) <= 0.5 * d.gp + 0.01)::INTEGER AS min,
           count(*) FILTER (WHERE o.gp > d.gp)::INTEGER AS more_games,
           count(*) FILTER (WHERE o.gp = d.gp AND o.pts > d.pts)::INTEGER AS more_points,
           count(*) FILTER (WHERE o.pts < d.pts OR o.gp < d.gp)::INTEGER AS fewer,
           (SELECT count(*) FROM o x WHERE x.season = d.season
              AND NOT EXISTS (SELECT 1 FROM d y WHERE y.season = x.season AND y.player_id = x.player_id))::INTEGER
             AS ours_only
    FROM d LEFT JOIN o USING (player_id, season) GROUP BY 1 ORDER BY 1`)
  const teams = await read(`WITH d AS (
      SELECT team_id, season, gp::INTEGER AS gp, pts::INTEGER AS pts
      FROM src_dash_team_stats_base WHERE season_type = 'Regular Season'
    ), o AS (
      SELECT abs(team_id) AS team_id, season, box_games::INTEGER AS gp, pts::INTEGER AS pts,
             sum(points_for)::INTEGER AS scores
      FROM (SELECT t.team_id, t.season, s.box_games, s.pts, t.points_for
            FROM team_game t JOIN team_season s USING (team_id, season, game_type)
            WHERE t.game_type = 'regular' AND t.box_games = 1)
      GROUP BY 1, 2, 3, 4
    )
    SELECT d.season, count(*)::INTEGER AS teams,
           count(*) FILTER (WHERE o.gp = d.gp)::INTEGER AS gp,
           count(*) FILTER (WHERE o.pts = d.pts)::INTEGER AS pts,
           count(*) FILTER (WHERE o.pts = o.scores)::INTEGER AS scores,
           count(*) FILTER (WHERE o.gp > d.gp)::INTEGER AS more_games,
           count(*) FILTER (WHERE o.gp = d.gp AND o.pts > d.pts)::INTEGER AS more_points
    FROM d LEFT JOIN o USING (team_id, season) GROUP BY 1 ORDER BY 1`)
  const teamBy = new Map(teams.map((t) => [t.season, t]))
  out.push(
    '',
    "### Season tables against the league's dashboards",
    '',
    "Each player's whole regular season (`player_season`, no team) against the league dashboards' season stats (`src_dash_player_stats_base`, regular season, totals; a player the file lists twice, as in 2026, summed), and each team's (`team_season`, its games with a box score) against the team dashboards. Exact, but minutes: within half a minute a game, since the game logs print whole minutes and the dashboards to the second. **Ours more:** players with a game more than the dashboards, or the same games and more points; **fewer:** the reverse. **Team points = scores:** team-seasons whose box-score points equal the scores of their games.",
    '',
    table(
      [
        'Season',
        'Dashboard players',
        'Found',
        'Games %',
        'Points %',
        'Rebounds %',
        'Assists %',
        'Minutes %',
        'Ours more: games, points',
        'Fewer',
        'Teams: games, points equal',
        'Team points = scores'
      ],
      players.map((r) => {
        const t = teamBy.get(r.season)
        return [
          r.season,
          COUNT.format(r.dash),
          r.found === r.dash ? 'all' : COUNT.format(r.found),
          pct(r.gp, r.dash),
          pct(r.pts, r.dash),
          pct(r.reb, r.dash),
          pct(r.ast, r.dash),
          pct(r.min, r.dash),
          r.more_games || r.more_points ? `${r.more_games}, ${r.more_points}` : '–',
          r.fewer || '–',
          t ? `${t.gp}, ${t.pts} of ${t.teams}` : '–',
          t ? `${t.scores} of ${t.teams}` : '–'
        ]
      })
    )
  )

  // 8. The top 20 scorers each season.
  const top = await read(`WITH d AS (${DASH_PLAYERS}), o AS (${OUR_PLAYERS}),
    dt AS (SELECT *, row_number() OVER (PARTITION BY season ORDER BY pts DESC, player_id) AS rk FROM d),
    ot AS (SELECT *, row_number() OVER (PARTITION BY season ORDER BY pts DESC, player_id) AS rk FROM o)
    SELECT ot.season,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM dt WHERE dt.season = ot.season AND dt.rk <= 20
                                           AND dt.player_id = ot.player_id))::INTEGER AS same,
           count(*) FILTER (WHERE d.pts = ot.pts)::INTEGER AS pts,
           count(*) FILTER (WHERE d.gp = ot.gp)::INTEGER AS gp,
           string_agg(CASE WHEN d.pts IS DISTINCT FROM ot.pts OR d.gp IS DISTINCT FROM ot.gp
                           THEN d.name || ' ' || ot.pts || '/' || d.pts || ' in ' || ot.gp || '/' || d.gp END,
                      '; ' ORDER BY ot.rk) AS differ
    FROM ot LEFT JOIN d USING (player_id, season) WHERE ot.rk <= 20 GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### The top 20 scorers each season',
    '',
    "Our 20 most points in each regular season against the dashboards': how many of the 20 are the dashboards' 20, and how many have the same points and games. **Differ** names each one that does not, ours over the dashboards', points then games.",
    '',
    table(
      ['Season', "In the dashboards' 20", 'Points equal', 'Games equal', 'Differ'],
      top.map((r) => [
        r.season,
        `${r.same} of 20`,
        `${r.pts} of 20`,
        `${r.gp} of 20`,
        r.differ ?? '–'
      ])
    )
  )

  // 9. Every team's wins and losses, from the season table, against the standings.
  const records = await read(`SELECT s.season, count(*)::INTEGER AS teams,
      count(*) FILTER (WHERE t.wins = s.wins AND t.losses = s.losses)::INTEGER AS equal,
      string_agg(CASE WHEN t.wins IS DISTINCT FROM s.wins OR t.losses IS DISTINCT FROM s.losses
                      THEN s.team_id || ' ' || t.wins || '-' || t.losses || ' vs ' || s.wins || '-' || s.losses END, '; ')
        AS differ
    FROM src_dash_standings s
    LEFT JOIN team_season t ON abs(t.team_id) = s.team_id AND t.season = s.season AND t.game_type = 'regular'
    GROUP BY 1 ORDER BY 1`)
  const allTeams = records.reduce((n, r) => n + r.teams, 0)
  const equalTeams = records.reduce((n, r) => n + r.equal, 0)
  wrong += records.filter((r) => r.equal !== r.teams).length
  out.push(
    '',
    '### Team records from the season table',
    '',
    `Wins and losses in \`team_season\` (regular season; the forfeit a win and a loss with no box score) against the dashboards' standings: **${equalTeams} of ${allTeams}** team-seasons equal.`,
    '',
    table(
      ['Season', 'Teams', 'Equal', 'Differ'],
      records.map((r) => [r.season, r.teams, r.equal, r.differ ?? '–'])
    )
  )

  // 10. Every player's game rows add up to their season rows, and every team's.
  const sums = await read(`WITH g AS (
      SELECT player_id, season, game_type, team_id, count(*) AS games, sum(seconds) AS seconds,
             sum(pts) AS pts, sum(reb) AS reb, sum(ast) AS ast, sum(fga) AS fga, sum(starts) AS starts
      FROM player_game GROUP BY GROUPING SETS ((player_id, season, game_type, team_id),
                                               (player_id, season, game_type))
    ), s AS (
      SELECT player_id, season, game_type, team_id, games, seconds, pts, reb, ast, fga, starts FROM player_season
    ), t AS (
      SELECT team_id, season, game_type, count(*) AS games, sum(pts) AS pts, sum(wins) AS wins
      FROM team_game GROUP BY 1, 2, 3
    )
    SELECT s.season, count(*)::INTEGER AS rows,
           count(*) FILTER (WHERE g.games = s.games AND g.seconds IS NOT DISTINCT FROM s.seconds
             AND g.pts IS NOT DISTINCT FROM s.pts AND g.reb IS NOT DISTINCT FROM s.reb
             AND g.ast IS NOT DISTINCT FROM s.ast AND g.fga IS NOT DISTINCT FROM s.fga
             AND g.starts = s.starts)::INTEGER AS equal,
           count(*) FILTER (WHERE s.team_id IS NULL)::INTEGER AS whole,
           count(*) FILTER (WHERE s.team_id IS NULL AND (SELECT count(*) FROM s x WHERE x.player_id = s.player_id
             AND x.season = s.season AND x.game_type = s.game_type AND x.team_id IS NOT NULL) > 1)::INTEGER AS traded,
           (SELECT count(*) FILTER (WHERE ts.games = t.games AND ts.pts IS NOT DISTINCT FROM t.pts AND ts.wins = t.wins)
              FROM team_season ts JOIN t USING (team_id, season, game_type) WHERE ts.season = s.season)::INTEGER
             AS team_equal,
           (SELECT count(*) FROM team_season ts WHERE ts.season = s.season)::INTEGER AS team_rows
    FROM s LEFT JOIN g ON g.player_id = s.player_id AND g.season = s.season AND g.game_type = s.game_type
      AND g.team_id IS NOT DISTINCT FROM s.team_id
    GROUP BY 1 ORDER BY 1`)
  wrong += sums.filter((r) => r.equal !== r.rows || r.team_equal !== r.team_rows).length
  out.push(
    '',
    '### Game rows adding up to season rows',
    '',
    "Every row of `player_season` (each team, and the whole season with no team) against its player's rows of `player_game` summed: games, seconds, points, rebounds, assists, field-goal attempts and starts, every season type. **Traded:** whole-season rows of players with more than one team that season and type. Every row of `team_season` against `team_game` summed on games, points and wins.",
    '',
    table(
      ['Season', 'Player rows', 'Equal', 'Whole seasons', 'Traded', 'Team rows equal'],
      sums.map((r) => [
        r.season,
        COUNT.format(r.rows),
        COUNT.format(r.equal),
        COUNT.format(r.whole),
        COUNT.format(r.traded),
        `${r.team_equal} of ${r.team_rows}`
      ])
    )
  )

  // 11. Two seasons recounted through the engine, against the sources directly.
  const recount = []
  for (const season of [1998, 2026]) {
    const result = await query({
      entity: 'player',
      metrics: ['pts', 'gp', 'reb', 'ast'],
      scope: { seasons: [season] },
      sort: { metric: 'pts', dir: 'desc' },
      limit: 1000
    })
    const source =
      season === 2026
        ? `SELECT person_id AS player_id, count(*)::INTEGER AS gp, sum(points)::INTEGER AS pts,
                  sum(rebounds_total)::INTEGER AS reb, sum(assists)::INTEGER AS ast
           FROM src_wnba_player_box b JOIN game g ON g.nba_game_id = b.game_id
           WHERE g.game_type = 'regular' AND b.minutes <> '' GROUP BY 1`
        : `SELECT player_id, count(*)::INTEGER AS gp, sum(pts)::INTEGER AS pts, sum(reb)::INTEGER AS reb,
                  sum(ast)::INTEGER AS ast
           FROM src_wnba_game_logs l JOIN game g ON g.nba_game_id = l.game_id
           WHERE g.game_type = 'regular' AND l.player_id IS NOT NULL AND l.season = ${season} GROUP BY 1`
    const raw = new Map((await read(source)).map((r) => [String(r.player_id), r]))
    const rows = result.rows
    const same = rows.filter((r) => {
      const s = raw.get(r.id)
      return (
        s &&
        s.pts === r.values.pts.value &&
        s.gp === r.values.gp.value &&
        s.reb === r.values.reb.value &&
        s.ast === r.values.ast.value
      )
    }).length
    const teamResult = await query({
      entity: 'team',
      metrics: ['team_w', 'team_l', 'team_pts'],
      scope: { seasons: [season] },
      limit: 100
    })
    const standings = new Map(
      (
        await read(
          `SELECT team_id, wins::INTEGER AS w, losses::INTEGER AS l FROM src_dash_standings WHERE season = ${season}`
        )
      ).map((r) => [String(r.team_id), r])
    )
    const teamSame = teamResult.rows.filter((r) => {
      const s = standings.get(String(Math.abs(Number(r.id))))
      return s && s.w === r.values.team_w.value && s.l === r.values.team_l.value
    }).length
    recount.push([
      season,
      `${COUNT.format(same)} of ${COUNT.format(rows.length)} (source: ${COUNT.format(raw.size)})`,
      `${teamSame} of ${teamResult.rows.length} (standings: ${standings.size})`,
      rows
        .slice(0, 3)
        .map((r) => `${r.name} ${r.values.pts.value} in ${r.values.gp.value}`)
        .join('; ')
    ])
    if (same !== rows.length || rows.length !== raw.size || teamSame !== standings.size) wrong++
  }
  out.push(
    '',
    '### Two seasons recounted through the engine',
    '',
    "The engine's answer (`query`, the regular season, totals) against the source files summed directly: every player's points, games, rebounds and assists against the game logs (1998) or the 2026 box scores (2026), and every team's wins and losses against the dashboards' standings.",
    '',
    table(['Season', 'Players equal', 'Teams equal', 'Top three'], recount)
  )

  return wrong
}
