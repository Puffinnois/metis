// The college leagues' plays (Plan T1302.7), checked per season as T1301.7 checked the WNBA's: the feed's
// event names and what each maps to, player-games rebuilt from the plays against the box score stat by
// stat, possessions' points against the score, the splits adding up to the whole, assists and assisted
// makes against the box, the game flow ending on the final score, fouls drawn against the other side's
// fouls, time on the floor credited play by play against stats.ncaa.org's lineup file, and the same
// through the engine. Called by `agreement-college.mjs`. Every figure is a measurement with its tolerance
// stated; none is tuned.

const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

/** The counted team-games of a season with a box score, exhibitions out (D45). */
const COUNTED = `t.game_type <> 'preseason' AND t.box_games = 1`

const STATS = [
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

export async function collegePlaysAgreement(league, read, out, query) {
  const periods = league === 'ncaam' ? 2 : 4
  const parts = league === 'ncaam' ? ['h1', 'h2', 'ot'] : ['q1', 'q2', 'q3', 'q4', 'ot']
  const partList = parts.map((p) => `'${p}'`).join(', ')
  const length = (last) => `(2400 + 300 * greatest(0, ${last} - ${periods}))`
  out.push(
    '',
    '## The plays (T1302.7)',
    '',
    "stats.ncaa.org's play by play read into the play table (`play_nba`) and the ten on the floor (`play_lineup`), and what the shared builders make of them, per season. A team-game is counted with a box score, exhibitions out; a player-game is a box-score line of such a game."
  )

  // 1. The feed's event names: every spelling, its count, and what it maps to.
  const events = await read(`SELECT action, kind, count(*)::BIGINT AS n,
      sum(fga)::BIGINT AS fga, sum(fta)::BIGINT AS fta, sum(oreb + dreb)::BIGINT AS reb,
      sum(tov)::BIGINT AS tov, sum(pf)::BIGINT AS pf, sum(stl)::BIGINT AS stl, sum(blk)::BIGINT AS blk
    FROM play_nba GROUP BY 1, 2 ORDER BY n DESC`)
  const total = events.reduce((s, r) => s + Number(r.n), 0)
  const shown = events.filter((r) => Number(r.n) >= 100)
  const rest = events.filter((r) => Number(r.n) < 100)
  const unmapped = events
    .filter((r) => r.kind === 'other' && r.action !== 'Draw Foul')
    .reduce((s, r) => s + Number(r.n), 0)
  out.push(
    '',
    '### The event names',
    '',
    `Every \`event_type\` the file spells (kept as \`action\`) with its count over every season, the play kind it maps to and the counts it carries. ${COUNT.format(rest.length)} rarer spellings (${COUNT.format(rest.reduce((s, r) => s + Number(r.n), 0))} rows: the player's name or "null" before a type in 2021-22 to 2024-25, read without it) are summed in the last row. Unmapped (\`other\` but the fouls drawn, which the play-derived counts read): ${COUNT.format(unmapped)} of ${COUNT.format(total)} rows (${pct(unmapped, total)} %).`,
    '',
    table(
      ['Event type', 'Kind', 'Rows', 'FGA', 'FTA', 'REB', 'TOV', 'PF', 'STL', 'BLK'],
      [
        ...shown.map((r) => [
          r.action === '' ? '(empty)' : r.action,
          r.kind,
          COUNT.format(r.n),
          ...['fga', 'fta', 'reb', 'tov', 'pf', 'stl', 'blk'].map((c) => COUNT.format(r[c]))
        ]),
        [
          'Rarer spellings',
          '–',
          COUNT.format(rest.reduce((s, r) => s + Number(r.n), 0)),
          ...['fga', 'fta', 'reb', 'tov', 'pf', 'stl', 'blk'].map((c) =>
            COUNT.format(rest.reduce((s, r) => s + Number(r[c]), 0))
          )
        ]
      ]
    )
  )

  // 2. Player-games rebuilt from the plays against the box score, stat by stat.
  const lines = await read(`WITH actor AS (
      SELECT game_id, player_id, ${['pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'tov', 'pf'].map((c) => `sum(${c}) AS ${c}`).join(', ')}
      FROM play_nba WHERE player_id IS NOT NULL GROUP BY 1, 2),
    ast AS (SELECT game_id, assist_id AS player_id, count(*) AS ast FROM play_nba WHERE assist_id IS NOT NULL GROUP BY 1, 2),
    stl AS (SELECT game_id, steal_id AS player_id, count(*) AS stl FROM play_nba WHERE steal_id IS NOT NULL GROUP BY 1, 2),
    blk AS (SELECT game_id, block_id AS player_id, count(*) AS blk FROM play_nba WHERE block_id IS NOT NULL GROUP BY 1, 2),
    d AS (
      SELECT b.season, t.source,
             ${STATS.map((c) => `b.${c} - coalesce(${c === 'ast' ? 's.ast' : c === 'stl' ? 'st.stl' : c === 'blk' ? 'bl.blk' : `a.${c}`}, 0) AS d_${c}`).join(', ')}
      FROM player_game b JOIN team_game t ON t.game_id = b.game_id AND t.team_id = b.team_id
      LEFT JOIN actor a ON a.game_id = b.game_id AND a.player_id = b.player_id
      LEFT JOIN ast s ON s.game_id = b.game_id AND s.player_id = b.player_id
      LEFT JOIN stl st ON st.game_id = b.game_id AND st.player_id = b.player_id
      LEFT JOIN blk bl ON bl.game_id = b.game_id AND bl.player_id = b.player_id
      WHERE ${COUNTED} AND b.game_id IN (SELECT DISTINCT game_id FROM play_nba))
    SELECT season, count(*)::INTEGER AS n,
      count(*) FILTER (WHERE ${STATS.map((c) => `d_${c} = 0`).join(' AND ')})::INTEGER AS exact,
      count(*) FILTER (WHERE ${STATS.map((c) => `abs(d_${c}) <= 1`).join(' AND ')})::INTEGER AS within1,
      ${STATS.map((c) => `count(*) FILTER (WHERE d_${c} = 0)::INTEGER AS ${c}`).join(', ')},
      count(*) FILTER (WHERE source = 'ncaa')::INTEGER AS ncaa_lines
    FROM d GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### Player-games rebuilt from the plays',
    '',
    "Each box-score line of a game with plays against the same line rebuilt from the play table's flags: the actor's counts (rebounds and turnovers where a player is named), assists to `assist_id`, steals and blocks to the player put on the turnover or the miss. Exact when all 14 counts equal the box score's (ESPN's, or stats.ncaa.org's for the games ESPN lacks); the per-stat columns are the share with that count exact.",
    '',
    table(
      ['Season', 'Lines', 'Exact', 'Within 1', ...STATS.map((c) => c.toUpperCase())],
      lines.map((r) => [
        label(r.season),
        COUNT.format(r.n),
        pct(r.exact, r.n) + ' %',
        pct(r.within1, r.n) + ' %',
        ...STATS.map((c) => pct(r[c], r.n))
      ])
    )
  )

  // 3. The score: the plays' final score, the team's points, and possessions' points.
  const score =
    await read(`WITH l AS (SELECT game_id, max(home_after) AS h, max(away_after) AS a FROM play_nba GROUP BY 1),
    p AS (SELECT game_id, team_id, sum(pts) AS pts FROM play_nba WHERE team_id IS NOT NULL GROUP BY 1, 2),
    poss AS (
      SELECT n.game_id, l.poss_team_id AS team_id, count(DISTINCT n.possession) AS n,
             sum(n.pts) FILTER (WHERE n.team_id = l.poss_team_id) AS pts
      FROM play_nba n JOIN play_lineup l ON l.season = n.season AND l.game_id = n.game_id AND l.seq = n.seq
      WHERE n.possession IS NOT NULL AND l.poss_team_id IS NOT NULL GROUP BY 1, 2)
    SELECT t.season, count(*)::INTEGER AS sides,
      count(*) FILTER (WHERE (t.home AND l.h = t.points_for) OR (NOT t.home AND l.a = t.points_for))::INTEGER AS final,
      count(*) FILTER (WHERE p.pts = t.points_for)::INTEGER AS pts,
      count(*) FILTER (WHERE poss.pts = t.points_for)::INTEGER AS poss_pts,
      count(*) FILTER (WHERE abs(poss.pts - t.points_for) <= 2)::INTEGER AS poss_pts2,
      count(*) FILTER (WHERE abs(poss.n - t.ncaa_poss) <= 2)::INTEGER AS poss_n
    FROM team_game t JOIN l ON l.game_id = t.game_id
    LEFT JOIN p ON p.game_id = t.game_id AND p.team_id = t.team_id
    LEFT JOIN poss ON poss.game_id = t.game_id AND poss.team_id = t.team_id
    WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### The score and the possessions',
    '',
    "Per team-game with plays: the plays' final score (the highest each side reached) against the game's; the team's points summed from the plays; the points scored in its possessions (the file's `poss_num`, each the team with the ball at its last play) against the score, exact and within 2; and its possessions within 2 of stats.ncaa.org's team box (`ncaa_poss`).",
    '',
    table(
      [
        'Season',
        'Team-games',
        'Final score',
        'Points from plays',
        "Possessions' points",
        'Within 2',
        'Possessions within 2'
      ],
      score.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        pct(r.final, r.sides) + ' %',
        pct(r.pts, r.sides) + ' %',
        pct(r.poss_pts, r.sides) + ' %',
        pct(r.poss_pts2, r.sides) + ' %',
        pct(r.poss_n, r.sides) + ' %'
      ])
    )
  )

  // 4. The splits add up to the whole.
  const splits = await read(`WITH s AS (
      SELECT game_id, team_id, ${STATS.filter((c) => c !== 'pts')
        .map((c) => `sum(${c}) AS ${c}`)
        .join(', ')},
             sum(pts) AS pts, sum(seconds) AS seconds, sum(poss) AS poss
      FROM split_team WHERE split IN (${partList}) GROUP BY 1, 2),
    len AS (SELECT game_id, max(period) AS last FROM play_nba GROUP BY 1),
    ps AS (SELECT game_id, player_id, sum(seconds) AS secs FROM split_player WHERE split IN (${partList}) GROUP BY 1, 2),
    pl AS (
      SELECT b.season, count(*) AS n, count(*) FILTER (WHERE abs(ps.secs / 60.0 - b.minutes) <= 1) AS within1,
             count(*) FILTER (WHERE abs(ps.secs - u.on_secs) < 0.5) AS units
      FROM player_game b JOIN ps ON ps.game_id = b.game_id AND ps.player_id = b.player_id
      LEFT JOIN player_on_court_plays u ON u.game_id = b.game_id AND u.player_id = b.player_id
      JOIN team_game t ON t.game_id = b.game_id AND t.team_id = b.team_id
      WHERE ${COUNTED} GROUP BY 1)
    SELECT t.season, count(*)::INTEGER AS sides,
      count(*) FILTER (WHERE ${STATS.map((c) => `s.${c} = t.${c}`).join(' AND ')})::INTEGER AS box,
      count(*) FILTER (WHERE s.pts = t.points_for)::INTEGER AS pts,
      count(*) FILTER (WHERE abs(s.seconds - 5 * ${length('len.last')}) < 0.5)::INTEGER AS seconds,
      any_value(pl.n)::INTEGER AS players, any_value(pl.within1)::INTEGER AS players1, any_value(pl.units)::INTEGER AS units
    FROM team_game t JOIN s ON s.game_id = t.game_id AND s.team_id = t.team_id
    JOIN len ON len.game_id = t.game_id LEFT JOIN pl ON pl.season = t.season
    WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    `### The splits add up`,
    '',
    `The ${league === 'ncaam' ? 'halves' : 'quarters'} and the overtimes (${parts.join(', ')}) summed per team-game: all 14 counts equal the box score's; the points equal the score; the seconds equal the game's (40 minutes and 5 an overtime, five players). Players: their seconds over the same splits within a minute of the box score's minutes, and equal to their on-court seconds credited play by play (\`player_on_court_plays\`).`,
    '',
    table(
      [
        'Season',
        'Team-games',
        'Box line',
        'Points',
        'Seconds',
        'Player-games',
        'Minutes within 1',
        'Equal on court'
      ],
      splits.map((r) => [
        label(r.season),
        COUNT.format(r.sides),
        pct(r.box, r.sides) + ' %',
        pct(r.pts, r.sides) + ' %',
        pct(r.seconds, r.sides) + ' %',
        COUNT.format(r.players ?? 0),
        pct(r.players1, r.players) + ' %',
        pct(r.units, r.players) + ' %'
      ])
    )
  )

  // 5. Assists and assisted makes, fouls drawn, and the play-derived counts against the box.
  const detail = await read(`WITH d AS (
      SELECT b.season, b.ast, b.fgm, b.pf, b.tov, b.ncaa_fgm_ast, b.ncaa_fg3m_ast,
             p.ast2 + p.ast3 AS ast_plays, p.made2_ast + p.made2_unast + p.made3_ast + p.made3_unast AS makes,
             p.made2_ast + p.made3_ast AS made_ast, p.made3_ast, p.pf AS pf_plays, p.tov AS tov_plays
      FROM player_game b JOIN team_game t ON t.game_id = b.game_id AND t.team_id = b.team_id
      LEFT JOIN play_player_game p ON p.game_id = b.game_id AND p.player_id = b.player_id
      WHERE ${COUNTED} AND b.game_id IN (SELECT DISTINCT game_id FROM play_nba)),
    f AS (
      SELECT season, count(*) AS sides,
             count(*) FILTER (WHERE fd::INTEGER = opp_pf::INTEGER - opp_tech::INTEGER) AS fd,
             count(*) FILTER (WHERE abs(fd::INTEGER - (opp_pf::INTEGER - opp_tech::INTEGER)) <= 1) AS fd1,
             sum(fd) AS fd_n, sum(opp_pf) AS opp_pf, sum(tov_other) AS tov_other, sum(tov) AS tov, sum(pf_other) AS pf_other, sum(pf) AS pf
      FROM play_team_game GROUP BY 1)
    SELECT d.season, count(*)::INTEGER AS n,
      count(*) FILTER (WHERE coalesce(ast_plays, 0) = ast)::INTEGER AS ast,
      count(*) FILTER (WHERE coalesce(makes, 0) = fgm)::INTEGER AS makes,
      count(ncaa_fgm_ast)::INTEGER AS with_ncaa,
      count(*) FILTER (WHERE coalesce(made_ast, 0) = ncaa_fgm_ast)::INTEGER AS made_ast,
      count(*) FILTER (WHERE coalesce(made3_ast, 0) = ncaa_fg3m_ast)::INTEGER AS made3_ast,
      count(*) FILTER (WHERE coalesce(pf_plays, 0) = pf)::INTEGER AS pf,
      any_value(f.sides)::INTEGER AS sides, any_value(f.fd)::INTEGER AS fd, any_value(f.fd1)::INTEGER AS fd1,
      any_value(f.tov_other)::BIGINT AS tov_other, any_value(f.tov)::BIGINT AS tov,
      any_value(f.pf_other)::BIGINT AS pf_other, any_value(f.pf)::BIGINT AS pf_all
    FROM d LEFT JOIN f ON f.season = d.season GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### Assists, assisted makes and fouls drawn',
    '',
    "Per player-game with plays: assists on twos and threes (`ast2 + ast3`) against the box score's assists; makes split assisted and unassisted against its field goals made; assisted makes and assisted threes against stats.ncaa.org's box (`ncaa_fgm_ast`, `ncaa_fg3m_ast`, on the lines it has); personal fouls. Per team-game: fouls drawn (the file's own rows naming the fouled player) against the other side's personal fouls less its technicals, exact and within 1; and the share of turnovers and fouls of no kind (`other`).",
    '',
    table(
      [
        'Season',
        'Player-games',
        'AST',
        'Makes split',
        'Assisted makes (stats.ncaa.org)',
        'Assisted threes',
        'PF',
        'Fouls drawn',
        'Within 1',
        'TOV of no kind',
        'PF of no kind'
      ],
      detail.map((r) => [
        label(r.season),
        COUNT.format(r.n),
        pct(r.ast, r.n) + ' %',
        pct(r.makes, r.n) + ' %',
        pct(r.made_ast, r.with_ncaa) + ' %',
        pct(r.made3_ast, r.with_ncaa) + ' %',
        pct(r.pf, r.n) + ' %',
        pct(r.fd, r.sides) + ' %',
        pct(r.fd1, r.sides) + ' %',
        pct(Number(r.tov_other), Number(r.tov)) + ' %',
        pct(Number(r.pf_other), Number(r.pf_all)) + ' %'
      ])
    )
  )

  // 6. The game flow ends on the final score and lasts the game.
  const flow = await read(`WITH s AS (
      SELECT game_id, arg_max(home_after, seq) AS h, arg_max(away_after, seq) AS a
      FROM play_nba WHERE pts > 0 GROUP BY 1),
    len AS (SELECT game_id, max(period) AS last FROM play_nba GROUP BY 1)
    SELECT g.season, count(*)::INTEGER AS games,
      count(*) FILTER (WHERE s.h = g.home_score AND s.a = g.away_score)::INTEGER AS final,
      count(*) FILTER (WHERE d.game_ds = 10 * ${length('len.last')})::INTEGER AS length,
      count(*) FILTER (WHERE d.largest_lead >= abs(g.home_score - g.away_score) OR g.home_score < g.away_score)::INTEGER AS lead
    FROM game g JOIN s ON s.game_id = g.game_id JOIN len ON len.game_id = g.game_id
    JOIN play_team_game d ON d.game_id = g.game_id AND d.team_id = g.home_team_id
    WHERE g.game_type <> 'preseason' GROUP BY 1 ORDER BY 1`)
  out.push(
    '',
    '### The game flow',
    '',
    "Per game with plays: the last scoring play's score against the final score, the flow's length against the game's (40 minutes and 5 an overtime), and a winning home side's largest lead at least its final margin.",
    '',
    table(
      ['Season', 'Games', 'Ends on the final score', 'Length', 'Largest lead ≥ margin'],
      flow.map((r) => [
        label(r.season),
        COUNT.format(r.games),
        pct(r.final, r.games) + ' %',
        pct(r.length, r.games) + ' %',
        pct(r.lead, r.games) + ' %'
      ])
    )
  )

  // 7. Time on the floor: credited play by play against the lineup file, the two sources side by side.
  const sources = [
    ['lineup file', 'unit_game', 'player_on_court'],
    ['play by play', 'unit_game_plays', 'player_on_court_plays']
  ]
  const on = []
  for (const [name, units, players] of sources) {
    const read1 =
      await read(`WITH u AS (SELECT game_id, team_id, sum(secs) AS secs, sum(pts) AS pts FROM ${units} GROUP BY 1, 2),
      len AS (SELECT game_id, max(period) AS last FROM play_nba GROUP BY 1),
      pl AS (
        SELECT b.season, count(*) AS n, count(o.player_id) AS with_line,
               count(*) FILTER (WHERE abs(o.minutes - b.minutes) <= 1) AS within1,
               sum(o.on_secs) / 60.0 AS on_min, sum(b.minutes) FILTER (WHERE o.player_id IS NOT NULL) AS box_min
        FROM player_game b JOIN team_game t ON t.game_id = b.game_id AND t.team_id = b.team_id
        LEFT JOIN ${players} o ON o.game_id = b.game_id AND o.player_id = b.player_id
        WHERE ${COUNTED} AND b.minutes > 0 GROUP BY 1)
      SELECT t.season, count(*)::INTEGER AS sides, count(u.game_id)::INTEGER AS with_units,
        count(*) FILTER (WHERE abs(u.secs - ${length('coalesce(len.last, 2)')}) <= 1)::INTEGER AS minutes,
        count(*) FILTER (WHERE u.pts = t.points_for)::INTEGER AS pts,
        sum(u.secs)::DOUBLE / sum(${length('coalesce(len.last, 2)')}) FILTER (WHERE u.game_id IS NOT NULL) AS covered,
        any_value(pl.n)::INTEGER AS players, any_value(pl.with_line)::INTEGER AS with_line,
        any_value(pl.within1)::INTEGER AS within1
      FROM team_game t LEFT JOIN u ON u.game_id = t.game_id AND u.team_id = t.team_id
      LEFT JOIN len ON len.game_id = t.game_id LEFT JOIN pl ON pl.season = t.season
      WHERE ${COUNTED} GROUP BY 1 ORDER BY 1`)
    for (const r of read1) on.push({ name, ...r })
  }
  on.sort((a, b) => a.season - b.season || a.name.localeCompare(b.name))
  out.push(
    '',
    '### Time on the floor: the play by play against the lineup file',
    '',
    "Both sources side by side (policy 5): stats.ncaa.org's lineup file (`unit_game`, `player_on_court`, what the on-court screens read) and the units credited play by play (`unit_game_plays`, `player_on_court_plays`), each team-game's units summed: minutes equal to the game's (within a second), points equal to the box score's, and the share of the game's minutes covered; each player-game with minutes: a line from the source, and its on-court minutes within a minute of the box score's.",
    '',
    table(
      [
        'Season',
        'Source',
        'Team-games',
        'With units',
        "Minutes equal the game's",
        'Minutes covered',
        "Points equal the box score's",
        'Player-games',
        'With a line',
        'Minutes within 1'
      ],
      on.map((r) => [
        label(r.season),
        r.name,
        COUNT.format(r.sides),
        pct(r.with_units, r.sides) + ' %',
        pct(r.minutes, r.sides) + ' %',
        (100 * (r.covered ?? 0)).toFixed(1) + ' %',
        pct(r.pts, r.sides) + ' %',
        COUNT.format(r.players ?? 0),
        pct(r.with_line, r.players) + ' %',
        pct(r.within1, r.players) + ' %'
      ])
    )
  )

  // 8. Through the engine: the play-derived and split metrics against the tables, a season at a time.
  const seasons = [...new Set(lines.map((r) => r.season))]
  const engine = []
  for (const season of [seasons[0], seasons[seasons.length - 1]]) {
    const scope = { seasons: [season] }
    const whole = await query({
      entity: 'team',
      metrics: ['pts', 'team_pbp_lead_changes'],
      scope,
      limit: 5000
    })
    const byTeam = new Map(whole.rows.map((r) => [r.id, r.values]))
    const t = await read(`SELECT team_id::VARCHAR AS id, sum(lead_changes)::DOUBLE / count(*) AS lc
      FROM play_team_game WHERE season = ${season} GROUP BY 1`)
    const lcTable = new Map(t.map((r) => [r.id, r.lc]))
    let lcEqual = 0
    let lcN = 0
    for (const [id, v] of byTeam) {
      const want = lcTable.get(id)
      const got = v.team_pbp_lead_changes?.value
      if (want === undefined || got === null || got === undefined) continue
      lcN++
      if (Math.abs(got - want) < 1e-6) lcEqual++
    }
    // The halves or quarters and the overtimes add up to the whole game's points through the engine.
    let sum = new Map()
    for (const split of parts) {
      const r = await query({
        entity: 'team',
        metrics: ['pts'],
        scope: { ...scope, split },
        limit: 5000
      })
      for (const row of r.rows) {
        const games = row.values.pts?.games ?? null
        const v = row.values.pts?.total ?? null
        if (v === null) continue
        sum.set(row.id, (sum.get(row.id) ?? 0) + v)
        void games
      }
    }
    const totals =
      await read(`SELECT team_id::VARCHAR AS id, sum(pts)::DOUBLE AS pts FROM split_team
      WHERE season = ${season} AND split IN (${partList}) GROUP BY 1`)
    const tableSum = new Map(totals.map((r) => [r.id, r.pts]))
    let splitEqual = 0
    for (const [id, v] of sum) if (Math.abs(v - (tableSum.get(id) ?? NaN)) < 1e-6) splitEqual++
    const ast = await query({ entity: 'player', metrics: ['pbp_ast2'], scope, limit: 5000 })
    const astTable = new Map(
      (
        await read(`SELECT player_id::VARCHAR AS id, sum(ast2)::DOUBLE / count(*) AS v
          FROM play_player_game WHERE season = ${season} GROUP BY 1`)
      ).map((r) => [r.id, r.v])
    )
    const astRows = ast.rows.filter((r) => r.values.pbp_ast2?.value !== null)
    engine.push({
      season,
      teams: lcN,
      lead: lcEqual,
      splitTeams: sum.size,
      split: splitEqual,
      players: astRows.length,
      astKnown: astRows.filter((r) => astTable.has(r.id)).length
    })
  }
  out.push(
    '',
    '### Through the engine',
    '',
    "The first and last season through the query engine: each team's lead changes per game against `play_team_game`; the points of each team's split rows summed over the halves or quarters and overtimes against `split_team`; the players with assists on twos (`pbp_ast2`) found in `play_player_game`.",
    '',
    table(
      [
        'Season',
        'Teams',
        'Lead changes equal',
        'Teams with splits',
        'Split points equal',
        'Players',
        'In the table'
      ],
      engine.map((r) => [
        label(r.season),
        COUNT.format(r.teams),
        pct(r.lead, r.teams) + ' %',
        COUNT.format(r.splitTeams),
        pct(r.split, r.splitTeams) + ' %',
        COUNT.format(r.players),
        pct(r.astKnown, r.players) + ' %'
      ])
    )
  )
  return 0
}
