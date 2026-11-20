// The college leagues' depth (Plan T1302.6), checked per family and season as T1301.7 checked the
// WNBA's: stats.ncaa.org's shots against the box scores' field goals, ESPN's shots beside them, the
// lineups' units, the stints and the possessions against the box score and the game, SportsDataverse's
// published models read back through the engine against their files, and against what the tables give,
// and the three-point line on the located shots. Called by `agreement-college.mjs`. Returns how many
// published values read otherwise than as published (the one check that must hold everywhere); the rest
// are measurements with their tolerance stated.

const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const share = (part, whole) =>
  whole ? `${COUNT.format(part)} of ${COUNT.format(whole)} (${pct(part, whole)} %)` : '–'
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const num = (x, d = 2) => (x === null || x === undefined ? '–' : Number(x).toFixed(d))

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

/** Stored times a divisor and divided back, so only floating point separates the two. */
const same = (a, b) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)))

/**
 * Every row of a query: the engine answers 5,000 at most, so a larger board is read best first and
 * worst first, and the two put together (a season has about 5,000 Division I players).
 */
async function everyRow(query, q) {
  const by = q.metrics[0]
  const rows = new Map()
  for (const dir of ['desc', 'asc']) {
    const r = await query({ ...q, sort: { metric: by, dir }, limit: 5000 })
    for (const row of r.rows) rows.set(row.id, row)
  }
  return { rows: [...rows.values()] }
}

/** The counted team-games of a season with a box score, both sides. */
const COUNTED = `t.game_type <> 'preseason' AND t.box_games = 1`

export async function collegeDepthAgreement(league, read, out, query) {
  let wrong = 0
  const seasons = (await read(`SELECT DISTINCT season FROM game WHERE played ORDER BY 1`)).map(
    (r) => r.season
  )
  const finished = seasons.filter((s) => s <= 2026)
  const last = finished[finished.length - 1]
  out.push(
    '',
    '## The depth (T1302.6)',
    '',
    "stats.ncaa.org's shots, lineups, stints and possessions, ESPN's shots, and SportsDataverse's published models, per season. A team-game is counted with a box score, exhibitions out."
  )

  // 1. Shots against the box score, by team-game and season.
  const shots = await read(`WITH s AS (SELECT * FROM shot_team_game)
    SELECT t.season, count(*)::INTEGER AS sides,
      count(s.team_id)::INTEGER AS with_shots,
      count(*) FILTER (WHERE s.shots_fga = t.fga)::INTEGER AS fga_espn,
      count(*) FILTER (WHERE s.shots_fgm = t.fgm)::INTEGER AS fgm_espn,
      count(*) FILTER (WHERE s.shots_fg3a = t.fg3a)::INTEGER AS fg3a_espn,
      count(*) FILTER (WHERE s.shots_fga = t.ncaa_fga)::INTEGER AS fga_ncaa,
      count(*) FILTER (WHERE s.shots_fgm = t.ncaa_fgm)::INTEGER AS fgm_ncaa,
      count(*) FILTER (WHERE abs(s.shots_fga - t.fga) <= 2)::INTEGER AS fga_near,
      sum(s.shots_fga)::BIGINT AS shot_fga, sum(t.fga)::BIGINT AS box_fga,
      sum(s.shots_fgm)::BIGINT AS shot_fgm, sum(t.fgm)::BIGINT AS box_fgm
    FROM team_game t LEFT JOIN s ON s.game_id = t.game_id AND s.team_id = t.team_id
    WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### Shots against the box score',
    '',
    "stats.ncaa.org's located shots summed per team-game (`shot_team_game`) against ESPN's team box (the app's counts, D40) and stats.ncaa.org's own (`ncaa_fga`). Exact unless the column says within 2.",
    '',
    table(
      [
        'Season',
        'Team-games',
        'With shots',
        "FGA = ESPN's",
        "FGM = ESPN's",
        "3PA = ESPN's",
        'FGA within 2',
        "FGA = stats.ncaa.org's",
        "FGM = stats.ncaa.org's",
        'Season FGA, shots / box',
        'Season FGM, shots / box'
      ],
      shots.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        pct(r.with_shots, r.sides) + ' %',
        pct(r.fga_espn, r.sides) + ' %',
        pct(r.fgm_espn, r.sides) + ' %',
        pct(r.fg3a_espn, r.sides) + ' %',
        pct(r.fga_near, r.sides) + ' %',
        pct(r.fga_ncaa, r.sides) + ' %',
        pct(r.fgm_ncaa, r.sides) + ' %',
        `${COUNT.format(r.shot_fga)} / ${COUNT.format(r.box_fga)}`,
        `${COUNT.format(r.shot_fgm)} / ${COUNT.format(r.box_fgm)}`
      ])
    )
  )

  // Who the shots are credited to.
  const shooters = await read(`SELECT season, count(*)::INTEGER AS shots,
      count(*) FILTER (WHERE player_id > 0)::INTEGER AS espn,
      count(*) FILTER (WHERE player_id < 0)::INTEGER AS fallback,
      count(*) FILTER (WHERE player_id IS NULL)::INTEGER AS nobody,
      count(*) FILTER (WHERE team_id IS NULL)::INTEGER AS no_team
    FROM shot_nba GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "Shots by whom they are credited to: an ESPN athlete through `ncaa_player_ids`, or D28's negative key (kept and counted).",
    '',
    table(
      ['Season', 'Shots', 'ESPN athlete', "D28's key", 'No player', 'No team'],
      shooters.map((r) => [
        label(r.season),
        COUNT.format(r.shots),
        pct(r.espn, r.shots) + ' %',
        COUNT.format(r.fallback),
        COUNT.format(r.nobody),
        COUNT.format(r.no_team)
      ])
    )
  )

  // ESPN's shots beside them: its made free throws are not attempts.
  const espn = await read(`WITH e AS (
      SELECT game_id, team_id, count(*) FILTER (WHERE NOT free_throw)::INTEGER AS fga,
             count(*) FILTER (WHERE NOT free_throw AND made)::INTEGER AS fgm,
             count(*) FILTER (WHERE free_throw)::INTEGER AS ft,
             count(*) FILTER (WHERE NOT free_throw AND x IS NOT NULL
                              AND NOT (abs(x) = 41.75 AND y = 0))::INTEGER AS located
      FROM shot_espn GROUP BY 1, 2)
    SELECT t.season, count(e.game_id)::INTEGER AS sides,
      count(*) FILTER (WHERE e.fga = s.shots_fga)::INTEGER AS fga,
      count(*) FILTER (WHERE e.fgm = s.shots_fgm)::INTEGER AS fgm,
      sum(e.ft)::BIGINT AS ft, sum(e.located)::BIGINT AS located, sum(e.fga)::BIGINT AS espn_fga
    FROM team_game t JOIN e ON e.game_id = t.game_id AND e.team_id = t.team_id
    JOIN shot_team_game s ON s.game_id = t.game_id AND s.team_id = t.team_id
    WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "ESPN's shots beside stats.ncaa.org's (`shot_espn`), its made free throws left out of the attempts. Located: a field goal ESPN gives coordinates other than a basket's own point.",
    '',
    table(
      [
        'Season',
        'Team-games both have',
        'FGA equal',
        'FGM equal',
        'Free throws left out',
        'Located'
      ],
      espn.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        pct(r.fga, r.sides) + ' %',
        pct(r.fgm, r.sides) + ' %',
        COUNT.format(r.ft),
        pct(r.located, r.espn_fga) + ' %'
      ])
    )
  )

  // 2. The three-point line on the located shots: where twos end and threes begin.
  const line = await read(`WITH s AS (
      SELECT season, abs(x) / 10 AS ax, y / 10 AS y, sqrt(x * x + y * y) / 10 AS d, value
      FROM shot_nba WHERE x IS NOT NULL AND y >= -50)
    SELECT season,
      max(ax) FILTER (WHERE y <= 4.7 AND value = 2) AS corner2,
      min(ax) FILTER (WHERE y <= 4.7 AND value = 3) AS corner3,
      max(d) FILTER (WHERE y > 10 AND value = 2) AS arc2,
      min(d) FILTER (WHERE y > 10 AND value = 3) AS arc3,
      count(*) FILTER (WHERE y <= 4.7 AND value = 3 AND ax < 21.65)::INTEGER AS inside_corner,
      count(*) FILTER (WHERE y <= 4.7 AND value = 3)::INTEGER AS corner_threes
    FROM s GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### The three-point line',
    '',
    "On stats.ncaa.org's located shots, which give each shot's value and its feet from the basket on a half-foot grid across (`x`) and 0.94 feet along (`y`): in the corners (`y` within 4.7 feet of the basket) the widest two and the nearest three across, above them the farthest two and the nearest three from the basket.",
    '',
    table(
      [
        'Season',
        'Corner: widest two (ft)',
        'Corner: nearest three (ft)',
        'Arc: farthest two (ft)',
        'Arc: nearest three (ft)',
        'Corner threes inside 21.65 ft'
      ],
      line.map((r) => [
        label(r.season),
        num(r.corner2),
        num(r.corner3),
        num(r.arc2, 3),
        num(r.arc3, 3),
        share(r.inside_corner, r.corner_threes)
      ])
    )
  )

  // 3. Units on the floor (stats.ncaa.org's lineup file) against the box score and the game.
  const units = await read(`WITH u AS (
      SELECT game_id, team_id, sum(secs) AS secs, sum(pts)::INTEGER AS pts, sum(opp_pts)::INTEGER AS opp_pts,
             sum(fga)::INTEGER AS fga, sum(poss)::INTEGER AS poss,
             sum(secs) FILTER (WHERE NOT complete) AS partial
      FROM unit_game_lineups GROUP BY 1, 2),
    p AS (SELECT game_id, team_id, sum(secs) FILTER (WHERE player_id < 0) AS fallback, sum(secs) AS secs
          FROM (SELECT game_id, team_id, secs, unnest([p1, p2, p3, p4, p5]) AS player_id FROM unit_game_lineups)
          GROUP BY 1, 2)
    SELECT t.season, count(*)::INTEGER AS sides, count(u.game_id)::INTEGER AS with_units,
      count(*) FILTER (WHERE abs(u.secs - (2400 + 300 * g.overtimes)) <= 60)::INTEGER AS minutes_near,
      count(*) FILTER (WHERE abs(u.secs - (2400 + 300 * g.overtimes)) <= 1)::INTEGER AS minutes_exact,
      count(*) FILTER (WHERE u.pts = t.pts)::INTEGER AS pts,
      count(*) FILTER (WHERE u.opp_pts = t.opp_pts)::INTEGER AS opp_pts,
      count(*) FILTER (WHERE u.fga = t.fga)::INTEGER AS fga,
      count(*) FILTER (WHERE abs(u.poss - t.ncaa_poss) <= 2)::INTEGER AS poss,
      sum(u.partial) / sum(u.secs) AS partial, sum(p.fallback) / sum(p.secs) AS fallback
    FROM team_game t JOIN game g ON g.game_id = t.game_id
    LEFT JOIN u ON u.game_id = t.game_id AND u.team_id = t.team_id
    LEFT JOIN p ON p.game_id = t.game_id AND p.team_id = t.team_id
    WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
  const dropped = await read(`SELECT l.season, count(*)::INTEGER AS rows,
      count(*) FILTER (WHERE g.game_id IS NULL)::INTEGER AS no_game
    FROM src_ncaa_lineups l LEFT JOIN game g ON g.ncaa_game_id = l.contest_id GROUP BY 1 ORDER BY 1`)
  const droppedBy = new Map(dropped.map((r) => [r.season, r]))
  out.push(
    '',
    '### Units on the floor against the box score',
    '',
    "stats.ncaa.org's lineup file, each row a team's stint with five players, summed per team-game (`unit_game_lineups` since T1302.7, `unit_game` before): its minutes against the game's (40 and five an overtime), its points for and against and field-goal attempts against ESPN's team box, its possessions against stats.ncaa.org's team box within 2. Share of seconds with fewer than five known players, and of player-seconds on D28's keys (players no row of `ncaa_player_ids` names).",
    '',
    table(
      [
        'Season',
        'Team-games',
        'With units',
        'Minutes exact (1 s)',
        'Minutes within 1',
        'Points',
        'Points against',
        'FGA',
        'Possessions within 2',
        'Partial units',
        "D28's keys",
        'Lineup rows with no game'
      ],
      units.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        pct(r.with_units, r.sides) + ' %',
        pct(r.minutes_exact, r.sides) + ' %',
        pct(r.minutes_near, r.sides) + ' %',
        pct(r.pts, r.sides) + ' %',
        pct(r.opp_pts, r.sides) + ' %',
        pct(r.fga, r.sides) + ' %',
        pct(r.poss, r.sides) + ' %',
        `${num(100 * (r.partial ?? 0), 2)} %`,
        `${num(100 * (r.fallback ?? 0), 2)} %`,
        share(droppedBy.get(r.season)?.no_game ?? 0, droppedBy.get(r.season)?.rows ?? 0)
      ])
    )
  )

  // Players' minutes on the floor against the box score's.
  const onc = await read(`SELECT o.season, count(*)::INTEGER AS lines,
      count(b.player_id)::INTEGER AS boxed,
      count(*) FILTER (WHERE abs(o.minutes * 60 - b.seconds) <= 60)::INTEGER AS minute,
      count(*) FILTER (WHERE abs(o.minutes * 60 - b.seconds) <= 5)::INTEGER AS close,
      sum(o.minutes) / (sum(b.seconds) FILTER (WHERE b.player_id IS NOT NULL) / 60.0) AS ratio
    FROM player_on_court_lineups o LEFT JOIN player_game b ON b.game_id = o.game_id AND b.player_id = o.player_id
    WHERE o.game_type <> 'preseason' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "A player's minutes on the floor (`player_on_court_lineups`) against their box-score minutes (ESPN's), over the player-games both have.",
    '',
    table(
      [
        'Season',
        'On-court lines',
        'With a box line',
        'Within 5 s',
        'Within 1 minute',
        'Minutes, on court / box'
      ],
      onc.map((r) => [
        label(r.season),
        COUNT.format(r.lines),
        pct(r.boxed, r.lines) + ' %',
        pct(r.close, r.boxed) + ' %',
        pct(r.minute, r.boxed) + ' %',
        num(r.ratio, 4)
      ])
    )
  )

  // 4. Stints against the game.
  const stints = await read(`WITH s AS (
      SELECT game_id, sum(secs) AS secs, sum(home_pts)::INTEGER AS hp, sum(away_pts)::INTEGER AS ap,
             count(*) FILTER (WHERE home_team_id IS NULL OR away_team_id IS NULL)::INTEGER AS unsided
      FROM stint GROUP BY 1)
    SELECT g.season, count(*)::INTEGER AS games, count(s.game_id)::INTEGER AS with_stints,
      count(*) FILTER (WHERE abs(s.secs - (2400 + 300 * g.overtimes)) <= 1)::INTEGER AS minutes,
      count(*) FILTER (WHERE s.hp + s.ap = g.home_score + g.away_score)::INTEGER AS points,
      sum(s.unsided)::INTEGER AS unsided
    FROM game g LEFT JOIN s ON s.game_id = g.game_id
    WHERE g.played AND g.game_type <> 'preseason' AND g.forfeit_winner_id IS NULL GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### Stints against the game',
    '',
    "stats.ncaa.org's ten-player stints (`stint`) summed per game: their seconds against the game's within a second, and both sides' points against the final score.",
    '',
    table(
      [
        'Season',
        'Games',
        'With stints',
        'Seconds equal',
        'Points equal the score',
        'Stints with a side unplaced'
      ],
      stints.map((r) => [
        label(r.season),
        COUNT.format(r.games),
        pct(r.with_stints, r.games) + ' %',
        pct(r.minutes, r.games) + ' %',
        pct(r.points, r.games) + ' %',
        COUNT.format(r.unsided)
      ])
    )
  )

  // 5. Possessions against the team box.
  const poss = await read(`WITH p AS (
      SELECT game_id, team_id, count(*)::INTEGER AS n, sum(points)::INTEGER AS pts
      FROM possession GROUP BY 1, 2)
    SELECT t.season, count(*)::INTEGER AS sides, count(p.game_id)::INTEGER AS with_poss,
      count(*) FILTER (WHERE abs(p.n - t.ncaa_poss) <= 2)::INTEGER AS near,
      avg(p.n - t.ncaa_poss) AS mean_diff,
      count(*) FILTER (WHERE p.pts = t.pts)::INTEGER AS pts,
      sum(p.n)::BIGINT AS n, sum(t.ncaa_poss) AS box
    FROM team_game t LEFT JOIN p ON p.game_id = t.game_id AND p.team_id = t.team_id
    WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### Possessions against the team box',
    '',
    "stats.ncaa.org's possessions (`possession`) counted per team-game against its team box's possessions (`ncaa_poss`, an estimate it publishes), and their points against ESPN's team points.",
    '',
    table(
      [
        'Season',
        'Team-games',
        'With possessions',
        'Within 2 of the box',
        'Mean difference',
        'Points equal',
        'Season, file / box'
      ],
      poss.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        pct(r.with_poss, r.sides) + ' %',
        pct(r.near, r.sides) + ' %',
        num(r.mean_diff),
        pct(r.pts, r.sides) + ' %',
        `${COUNT.format(r.n)} / ${COUNT.format(Math.round(r.box ?? 0))}`
      ])
    )
  )

  // 6. The published models, read back through the engine against their files, one season at a time.
  const back = []
  const MODELS = [
    ['team', 'sdv_adj_em', 'adj_em', 'src_ratings', 'team_id'],
    ['team', 'sdv_adj_o', 'adj_o', 'src_ratings', 'team_id'],
    ['player', 'sdv_box_bpm', 'box_bpm', 'src_player_value', 'player_id'],
    ['player', 'sdv_ncaa_rapm', 'rapm_net', 'src_ncaa_rapm', 'player_id'],
    ['player', 'sdv_ncaa_team_rapm', 'rapm_net', 'src_ncaa_rapm_within_team', 'player_id']
  ]
  for (const season of [seasons[0], last]) {
    for (const [entity, metric, column, source] of MODELS) {
      const result = await everyRow(query, {
        entity,
        metrics: [metric],
        scope: { seasons: [season] }
      })
      // A player's key is ESPN's athlete; the RAPM files' ids are stats.ncaa.org's, mapped the same way.
      const file = source.startsWith('src_ncaa_rapm')
        ? await read(`SELECT coalesce(i.player_id, -TRY_CAST(s.player_id AS BIGINT))::VARCHAR AS id,
                 s.${column} AS v, ${source === 'src_ncaa_rapm' ? 's.off_poss + s.def_poss' : 's.team_off_poss'} AS w
               FROM ${source} s LEFT JOIN ncaa_player_ids i ON i.season = s.season AND i.ncaa_player_id = s.player_id
               WHERE s.season = ${season}`)
        : await read(`SELECT ${entity === 'team' ? 'team_id' : 'player_id'}::VARCHAR AS id, ${column} AS v,
                 ${entity === 'team' ? 'games' : 'min'} AS w FROM ${source} WHERE season = ${season}`)
      // A player of two rows in a season reads their weighted mean.
      const byId = new Map()
      for (const r of file) {
        const o = byId.get(r.id) ?? { s: 0, w: 0 }
        o.s += r.v * r.w
        o.w += r.w
        byId.set(r.id, o)
      }
      const rows = result.rows.filter(
        (r) => r.values[metric]?.value !== null && r.values[metric]?.value !== undefined
      )
      const equal = rows.filter((r) => {
        const o = byId.get(r.id)
        return (
          o &&
          o.w > 0 &&
          same(Number(r.values[metric].value.toFixed(9)), Number((o.s / o.w).toFixed(9)))
        )
      }).length
      if (equal !== rows.length) wrong++
      back.push([
        label(season),
        metric,
        COUNT.format(result.rows.length),
        share(equal, rows.length),
        equal === rows.length ? 'ok' : 'WRONG'
      ])
    }
  }
  out.push(
    '',
    '### The published models through the engine',
    '',
    "SportsDataverse's values (D44) as the engine answers them over every counted game of a season, each row a Division I team or a player with a box score, against the file's value (a player of two rows: their weighted mean). Stored times what it was fitted on and divided back, so equal to nine decimals.",
    '',
    table(['Season', 'Metric', 'Rows', 'Equal to the file', 'Check'], back)
  )

  // Coverage of Division I players, and the ratings against an efficiency the tables give.
  const coverage = await read(`WITH ps AS (
      SELECT p.season, p.player_id, sum(p.seconds) / 60.0 AS minutes
      FROM player_season p JOIN team d ON d.team_id = p.team_id AND d.season = p.season AND d.division_i
      WHERE p.game_type <> 'preseason' GROUP BY 1, 2)
    SELECT ps.season, count(*)::INTEGER AS players,
      count(*) FILTER (WHERE ps.minutes >= 300)::INTEGER AS regulars,
      count(b.player_id)::INTEGER AS bpm, count(b.player_id) FILTER (WHERE ps.minutes >= 300)::INTEGER AS bpm300,
      count(r.player_id)::INTEGER AS rapm, count(r.player_id) FILTER (WHERE ps.minutes >= 300)::INTEGER AS rapm300,
      count(w.player_id)::INTEGER AS trapm, count(w.player_id) FILTER (WHERE ps.minutes >= 300)::INTEGER AS trapm300
    FROM ps
    LEFT JOIN (SELECT DISTINCT season, player_id FROM pub_player_sdv_bpm) b USING (season, player_id)
    LEFT JOIN (SELECT DISTINCT season, player_id FROM pub_player_ncaa_rapm) r USING (season, player_id)
    LEFT JOIN (SELECT DISTINCT season, player_id FROM pub_player_ncaa_rapm_team) w USING (season, player_id)
    GROUP BY 1 ORDER BY 1`)
  const keys =
    await read(`SELECT season, count(*)::INTEGER AS rows, count(*) FILTER (WHERE player_id < 0)::INTEGER AS fallback
    FROM pub_player_ncaa_rapm GROUP BY 1 ORDER BY 1`)
  const keysBy = new Map(keys.map((r) => [r.season, r]))
  out.push(
    '',
    "Division I players with a box-score line, and those with 300 minutes or more (BPM's own qualifier), with a value in each published file. A RAPM row no `ncaa_player_ids` row names keeps D28's negative key.",
    '',
    table(
      [
        'Season',
        'Players',
        '300 min +',
        'BPM',
        'BPM, 300 min +',
        'RAPM',
        'RAPM, 300 min +',
        'RAPM within team, 300 min +',
        "RAPM rows on D28's keys"
      ],
      coverage.map((r) => [
        label(r.season),
        COUNT.format(r.players),
        COUNT.format(r.regulars),
        pct(r.bpm, r.players) + ' %',
        pct(r.bpm300, r.regulars) + ' %',
        pct(r.rapm, r.players) + ' %',
        pct(r.rapm300, r.regulars) + ' %',
        pct(r.trapm300, r.regulars) + ' %',
        share(keysBy.get(r.season)?.fallback ?? 0, keysBy.get(r.season)?.rows ?? 0)
      ])
    )
  )
  const ratings = await read(`WITH t AS (
      SELECT t.season, t.team_id, 100.0 * sum(t.pts) / nullif(sum(t.ncaa_poss), 0) AS ortg,
             100.0 * sum(t.opp_pts) / nullif(sum(t.opp_ncaa_poss), 0) AS drtg, count(*) AS games
      FROM team_game t JOIN team d ON d.team_id = t.team_id AND d.season = t.season AND d.division_i
      WHERE ${COUNTED} GROUP BY 1, 2)
    SELECT t.season, count(*)::INTEGER AS teams, count(r.team_id)::INTEGER AS rated,
      count(*) FILTER (WHERE r.games = t.games)::INTEGER AS games_equal,
      corr(r.raw_o, t.ortg) AS corr_o, avg(r.raw_o - t.ortg) AS diff_o,
      corr(r.raw_d, t.drtg) AS corr_d, avg(r.raw_d - t.drtg) AS diff_d,
      corr(r.adj_em, t.ortg - t.drtg) AS corr_em
    FROM t LEFT JOIN src_ratings r ON TRY_CAST(r.team_id AS BIGINT) = t.team_id AND r.season = t.season
    GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    "SportsDataverse's team ratings against an efficiency the tables give: each Division I team's points per 100 of stats.ncaa.org's possessions over its counted games. Its unadjusted ratings are over ESPN's box scores and its own possession estimate, so they are compared by correlation and mean difference, not equality.",
    '',
    table(
      [
        'Season',
        'Division I teams',
        'Rated',
        'Same games',
        'Raw O: r',
        'Raw O − ORtg',
        'Raw D: r',
        'Raw D − DRtg',
        'AdjEM against net rating: r'
      ],
      ratings.map((r) => [
        label(r.season),
        r.teams,
        pct(r.rated, r.teams) + ' %',
        pct(r.games_equal, r.teams) + ' %',
        num(r.corr_o, 3),
        num(r.diff_o),
        num(r.corr_d, 3),
        num(r.diff_d),
        num(r.corr_em, 3)
      ])
    )
  )

  // 7. Shots and on-court lines through the engine, against the tables summed.
  const engine = []
  for (const season of [seasons[0], last]) {
    const result = await everyRow(query, {
      entity: 'player',
      metrics: ['shot_ra_fga', 'shot_atb3_fgm', 'onc_min', 'onc_plus_minus'],
      scope: { seasons: [season] }
    })
    const direct = await read(`WITH s AS (SELECT player_id, sum(ra_fga) AS ra, sum(atb3_fgm) AS atb3
                                         FROM shot_player_game WHERE season = ${season} AND game_type <> 'preseason' GROUP BY 1),
        o AS (SELECT player_id, sum(minutes) AS m, sum(on_pts - on_opp_pts) AS pm
              FROM player_on_court WHERE season = ${season} AND game_type <> 'preseason' GROUP BY 1)
      SELECT coalesce(s.player_id, o.player_id)::VARCHAR AS id, s.ra, s.atb3, o.m, o.pm FROM s FULL JOIN o USING (player_id)`)
    const byId = new Map(direct.map((r) => [r.id, r]))
    let shotsEqual = 0
    let oncEqual = 0
    for (const r of result.rows) {
      const d = byId.get(r.id)
      if (!d) continue
      if (
        (r.values.shot_ra_fga.value ?? 0) === (d.ra ?? 0) &&
        (r.values.shot_atb3_fgm.value ?? 0) === (d.atb3 ?? 0)
      )
        shotsEqual++
      if (
        Math.abs((r.values.onc_min.value ?? 0) - (d.m ?? 0)) < 1e-6 &&
        (r.values.onc_plus_minus.value ?? 0) === (d.pm ?? 0)
      )
        oncEqual++
    }
    engine.push([
      label(season),
      COUNT.format(result.rows.length),
      share(shotsEqual, result.rows.length),
      share(oncEqual, result.rows.length)
    ])
  }
  out.push(
    '',
    '### Through the engine',
    '',
    "Every player row of the engine's board over every counted game (players of Division I teams, D40), its rim attempts and above-the-break threes made (`shot_player_game`) and its on-court minutes and plus-minus (`player_on_court`), against the tables summed directly.",
    '',
    table(['Season', 'Rows', 'Shots equal', 'On-court equal'], engine)
  )
  return wrong
}
