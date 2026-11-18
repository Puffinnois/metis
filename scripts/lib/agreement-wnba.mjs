// The WNBA's agreement checks (Plan T1301.5 on): its game, team and player tables against the real
// history of the league and against its own sources, season by season. Run through
// `scripts/check-agreement.mjs <folder> <out.md> --league=wnba`; returns how many seasons have the wrong
// number of regular-season games or teams, and the script exits 1 when that is not 0, as the NBA's does.
// The game and season tables' checks (T1301.6) are in `agreement-wnba-tables.mjs`; later parts add
// theirs beside them.
import { tableChecks } from './agreement-wnba-tables.mjs'

/**
 * Regular-season games and teams, from Basketball-Reference's season pages read on 2026-11-17
 * (`docs/reference/wnba-data-sources.md`, "Season lengths and team counts"): B-R's game count is the
 * sum of its wins, the 2018 forfeit included.
 */
const REAL = {
  1997: [8, 112],
  1998: [10, 150],
  1999: [12, 192],
  2000: [16, 256],
  2001: [16, 256],
  2002: [16, 256],
  2003: [14, 238],
  2004: [13, 221],
  2005: [13, 221],
  2006: [14, 238],
  2007: [13, 221],
  2008: [14, 238],
  2009: [13, 221],
  2010: [12, 204],
  2011: [12, 204],
  2012: [12, 204],
  2013: [12, 204],
  2014: [12, 204],
  2015: [12, 204],
  2016: [12, 204],
  2017: [12, 204],
  2018: [12, 204],
  2019: [12, 204],
  2020: [12, 132],
  2021: [12, 192],
  2022: [12, 216],
  2023: [12, 240],
  2024: [12, 240],
  2025: [13, 286],
  2026: [15, 330]
}

const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

/** Wins and losses per team-season from `game`, the forfeit given to its winner. */
const RECORDS = `WITH sides AS (
    SELECT season, home_team_id AS team_id,
           (home_score > away_score OR forfeit_winner_id = home_team_id)::INTEGER AS w,
           (home_score < away_score OR forfeit_winner_id = away_team_id)::INTEGER AS l
    FROM game WHERE game_type = 'regular' AND played
    UNION ALL
    SELECT season, away_team_id,
           (away_score > home_score OR forfeit_winner_id = away_team_id)::INTEGER,
           (away_score < home_score OR forfeit_winner_id = home_team_id)::INTEGER
    FROM game WHERE game_type = 'regular' AND played
  )
  SELECT season, team_id, sum(w)::INTEGER AS w, sum(l)::INTEGER AS l FROM sides GROUP BY 1, 2`

export async function runAgreement(read, out, query) {
  out.push(
    '# WNBA agreement checks',
    '',
    'Written by `scripts/check-agreement.mjs --league=wnba` from a real load. Percentages are the share of rows that match exactly. What these numbers mean for the app is in [wnba-data-sources.md](wnba-data-sources.md). Seasons are the year they were played.'
  )
  let wrong = 0

  // 1. Games and teams by season, against Basketball-Reference.
  const games =
    await read(`WITH teams AS (SELECT season, count(*)::INTEGER AS teams FROM team GROUP BY 1)
    SELECT g.season, any_value(t.teams) AS teams,
      count(*) FILTER (game_type = 'regular' AND played)::INTEGER AS regular,
      count(*) FILTER (game_type = 'regular' AND played AND espn_game_id IS NOT NULL)::INTEGER AS linked,
      count(*) FILTER (game_type = 'regular' AND source = 'game logs')::INTEGER AS from_logs,
      count(*) FILTER (game_type = 'regular' AND forfeit_winner_id IS NOT NULL)::INTEGER AS forfeits,
      count(*) FILTER (game_type = 'playoffs' AND played)::INTEGER AS playoffs,
      count(*) FILTER (game_type = 'playoffs' AND played AND espn_game_id IS NOT NULL)::INTEGER AS playoffs_linked,
      count(*) FILTER (game_type = 'cup-final')::INTEGER AS cup,
      count(*) FILTER (game_type = 'all-star')::INTEGER AS all_star,
      count(*) FILTER (NOT played)::INTEGER AS unplayed,
      count(*) FILTER (game_type NOT IN ('regular', 'playoffs', 'cup-final', 'all-star'))::INTEGER AS other
    FROM game g LEFT JOIN teams t USING (season) GROUP BY g.season ORDER BY g.season`)
  const gameRows = games.map((g) => {
    const [teams, length] = REAL[g.season] ?? [null, null]
    if (g.regular !== length) wrong++
    if (g.teams !== teams) wrong++
    return [
      g.season,
      g.teams === teams ? `${g.teams}` : `**${g.teams}, not ${teams}**`,
      COUNT.format(g.regular),
      g.regular === length ? 'yes' : `**no, ${length}**`,
      g.from_logs || '–',
      g.forfeits || '–',
      `${COUNT.format(g.linked)} (${pct(g.linked, g.regular)} %)`,
      `${g.playoffs} (${g.playoffs_linked} linked)`,
      g.cup || '–',
      g.all_star || '–',
      g.unplayed + g.other || '–'
    ]
  })
  const seasonsFound = new Set(games.map((g) => g.season))
  for (const season of Object.keys(REAL).map(Number)) {
    if (!seasonsFound.has(season)) {
      wrong++
      gameRows.push([season, '**none**', '0', '**no**', '', '', '', '', '', '', ''])
    }
  }
  out.push(
    '',
    '## Games and teams by season',
    '',
    "Regular-season games played and teams, against Basketball-Reference's season pages (`wnba-data-sources.md`, \"Season lengths and team counts\"); the script fails on any difference. **From game logs:** games the league's schedule lacks, taken from its game logs. **Forfeit:** a 0-0 game ESPN marks a forfeit, counted for the side ESPN's standings give the win. **Linked:** with ESPN's id, through the crosswalk or the same teams within a day. The Commissioner's Cup final and the All-Star Game are ESPN's alone. **Other:** games not played or of another type; there should be none.",
    '',
    table(
      [
        'Season',
        'Teams',
        'Regular-season games',
        'Real length',
        'From game logs',
        'Forfeit',
        'Linked to ESPN',
        'Playoff games',
        'Cup final',
        'All-Star',
        'Other'
      ],
      gameRows
    )
  )

  // 2. Every team's record against the league dashboards' standings.
  const records = await read(`WITH rec AS (${RECORDS})
    SELECT d.season, count(*)::INTEGER AS teams,
           count(*) FILTER (r.w = d.wins AND r.l = d.losses)::INTEGER AS equal,
           string_agg(CASE WHEN r.w IS DISTINCT FROM d.wins OR r.l IS DISTINCT FROM d.losses
                      THEN d.team_name || ' ' || coalesce(r.w, 0) || '-' || coalesce(r.l, 0)
                           || ' against ' || d.wins || '-' || d.losses END, '; ') AS differ
    FROM src_dash_standings d LEFT JOIN rec r ON r.season = d.season AND abs(r.team_id) = d.team_id
    GROUP BY 1 ORDER BY 1`)
  const allTeams = records.reduce((n, r) => n + r.teams, 0)
  const allEqual = records.reduce((n, r) => n + r.equal, 0)
  out.push(
    '',
    '## Team records against the standings',
    '',
    `Wins and losses from \`game\` (regular season, played; the forfeit counted for its winner) against the league dashboards' standings (\`src_dash_standings\`), which agree with Basketball-Reference on every team-season (\`wnba-data-sources.md\`). **${allEqual} of ${allTeams}** team-seasons equal.`,
    '',
    table(
      ['Season', 'Teams', 'Equal', 'Differ'],
      records.map((r) => [r.season, r.teams, r.equal, r.differ ?? '–'])
    )
  )

  // 3. Types: what each source files each game as.
  const types = await read(`SELECT g.season,
      count(*) FILTER (s.season_type IS NOT NULL AND s.season_type <> CASE g.game_type
        WHEN 'regular' THEN 'regular-season' WHEN 'playoffs' THEN 'playoffs' END)::INTEGER AS schedule_differs,
      count(*) FILTER (e.season_type IS NOT NULL AND e.season_type <> CASE g.game_type
        WHEN 'playoffs' THEN 3 ELSE 2 END)::INTEGER AS espn_differs,
      count(*) FILTER (g.game_type IN ('cup-final', 'all-star') AND e.season_type = 2)::INTEGER AS espn_regular,
      count(*) FILTER (g.neutral)::INTEGER AS neutral,
      count(*) FILTER (g.overtimes > 0)::INTEGER AS overtimes,
      count(*) FILTER (g.overtimes IS NULL AND g.played)::INTEGER AS overtimes_unknown,
      any_value(g.periods) FILTER (g.source <> 'espn')::INTEGER AS periods
    FROM game g
    LEFT JOIN (SELECT DISTINCT game_id, season_type FROM src_wnba_schedule) s USING (game_id)
    LEFT JOIN (SELECT DISTINCT ON (game_id) game_id, season_type FROM src_espn_schedule
               ORDER BY game_id, (season = file_season) DESC) e ON e.game_id = g.espn_game_id
    GROUP BY 1 ORDER BY 1`)
  const pbp =
    await read(`WITH last AS (SELECT game_id, max(period) AS last FROM src_wnba_pbp GROUP BY 1)
    SELECT g.season,
      count(*) FILTER (g.overtimes IS NOT NULL AND l.last IS NOT NULL)::INTEGER AS compared,
      count(*) FILTER (g.overtimes IS NOT NULL AND l.last IS NOT NULL
                       AND g.overtimes = greatest(l.last - g.periods, 0))::INTEGER AS equal
    FROM game g JOIN last l USING (game_id) GROUP BY 1 ORDER BY 1`).catch(() => [])
  const pbpBySeason = new Map(pbp.map((p) => [p.season, p]))
  out.push(
    '',
    '## Game types, sites and overtimes',
    '',
    "**Schedule** and **ESPN differ:** games whose type in the league's schedule (`regular-season`, `playoffs`) or ESPN's (`2`, `3`) is not the game's; the type is the league's id. **Filed by ESPN as regular season:** the Cup final and the All-Star Game, which ESPN files as `season_type` 2. **Neutral:** ESPN's `neutral_site`. **Overtimes:** from the game logs' team minutes, or ESPN's last period on its final rows; **unknown** where neither holds (the game logs' team minutes are 0 before 2004 and ESPN's rows before 2002 are not final). **Against the play by play:** the overtimes against the WNBA's play by play's last period, where both are known.",
    '',
    table(
      [
        'Season',
        'Periods',
        'Schedule differs',
        'ESPN differs',
        'Filed by ESPN as regular season',
        'Neutral',
        'Overtime games',
        'Overtimes unknown',
        'Against the play by play'
      ],
      types.map((t) => {
        const p = pbpBySeason.get(t.season)
        return [
          t.season,
          t.periods,
          t.schedule_differs,
          t.espn_differs,
          t.espn_regular || '–',
          t.neutral || '–',
          t.overtimes,
          t.overtimes_unknown || '–',
          p ? `${p.equal} of ${p.compared}` : '–'
        ]
      })
    )
  )

  // 4. Players: how each season's players found their ESPN id.
  const players = await read(`WITH lines AS (
      SELECT DISTINCT season, player_id FROM src_wnba_game_logs WHERE player_id IS NOT NULL
      UNION SELECT DISTINCT season, person_id FROM src_wnba_player_box WHERE nullif(minutes, '') IS NOT NULL
    ), xw AS (
      SELECT DISTINCT season, TRY_CAST(wnba_player_id AS BIGINT) AS player_id FROM src_xwalk_player
      WHERE nullif(wnba_player_id, '') IS NOT NULL AND nullif(espn_athlete_id, '') IS NOT NULL
    ), espn_lines AS (
      SELECT DISTINCT b.season, i.player_id, i.method FROM src_espn_player_box b
      JOIN player_ids i ON i.espn_athlete_id = b.athlete_id WHERE b.season = b.file_season
    )
    SELECT l.season, count(*)::INTEGER AS players,
      count(*) FILTER (x.player_id IS NOT NULL)::INTEGER AS crosswalk,
      count(*) FILTER (x.player_id IS NULL AND e.method = 'box score')::INTEGER AS box,
      count(*) FILTER (x.player_id IS NULL AND e.method = 'name')::INTEGER AS by_name,
      count(*) FILTER (x.player_id IS NULL AND e.method = 'crosswalk')::INTEGER AS other_season,
      count(*) FILTER (x.player_id IS NULL AND e.method IS NULL)::INTEGER AS none,
      string_agg(CASE WHEN x.player_id IS NULL AND e.method IS NULL THEN p.name END, ', ' ORDER BY p.name) AS none_names
    FROM lines l
    LEFT JOIN xw x USING (season, player_id)
    LEFT JOIN espn_lines e USING (season, player_id)
    LEFT JOIN player p USING (player_id)
    GROUP BY 1 ORDER BY 1`)
  const espnOnly =
    await read(`SELECT p.player_id, p.name, p.first_season, count(b.game_id)::INTEGER AS lines,
      count(b.game_id) FILTER (coalesce(b.points, 0) + coalesce(b.rebounds, 0) + coalesce(b.assists, 0) > 0)::INTEGER AS with_stats
    FROM player p LEFT JOIN src_espn_player_box b ON b.athlete_id = p.espn_athlete_id AND b.season = b.file_season
    WHERE p.method = 'espn only' GROUP BY ALL ORDER BY p.first_season, p.name`)
  out.push(
    '',
    '## Players and the crosswalk',
    '',
    "Players with a line in the season (the game logs, and the 2026 box scores' players who played), by how they found their ESPN id: **crosswalk** (`wnba_player_crosswalk` that season), else the shared matching on ESPN's lines that season: the same **box-score** lines, the same **name** in the season (lines or rosters), the crosswalk of **another season**, or **none**. There is no crosswalk and no ESPN box score before 2002, so those players have none. ESPN's 2002 lines are all zeros, so box-score matching finds nobody that season.",
    '',
    table(
      [
        'Season',
        'Players',
        'Crosswalk',
        'Box score',
        'Name',
        'Another season',
        'None',
        'Who (from 2002)'
      ],
      players.map((p) => [
        p.season,
        p.players,
        `${p.crosswalk} (${pct(p.crosswalk, p.players)} %)`,
        p.box || '–',
        p.by_name || '–',
        p.other_season || '–',
        p.none,
        p.season >= 2002 ? (p.none_names ?? '–') : '–'
      ])
    ),
    '',
    "**ESPN's players with no league id** get the negative of their ESPN id (D28):",
    '',
    table(
      ['Id', 'Name', 'Season', "ESPN's lines", 'With a stat'],
      espnOnly.map((p) => [p.player_id, p.name, p.first_season, p.lines, p.with_stats])
    )
  )

  // 5. One person, one id.
  const twoIds = await read(`SELECT 'ESPN id on two league ids' AS kind, espn_athlete_id AS id,
        string_agg(DISTINCT wnba_player_id || ' (' || season || ')', ', ') AS detail
      FROM src_xwalk_player WHERE nullif(wnba_player_id, '') IS NOT NULL AND nullif(espn_athlete_id, '') IS NOT NULL
      GROUP BY 2 HAVING count(DISTINCT wnba_player_id) > 1
    UNION ALL
    SELECT 'League id on two ESPN ids', wnba_player_id,
        string_agg(DISTINCT espn_athlete_id || ' (' || season || ')', ', ')
      FROM src_xwalk_player WHERE nullif(wnba_player_id, '') IS NOT NULL AND nullif(espn_athlete_id, '') IS NOT NULL
      GROUP BY 2 HAVING count(DISTINCT espn_athlete_id) > 1
    UNION ALL
    SELECT 'One name on two league ids', name_key,
        string_agg(DISTINCT player_id || ' (' || first_season || '-' || last_season || ')', ', ')
      FROM (SELECT player_id, first_season, last_season, lower(strip_accents(name)) AS name_key
            FROM player WHERE player_id > 0)
      GROUP BY 2 HAVING count(DISTINCT player_id) > 1
    ORDER BY 1, 2`)
  const keys = await read(`SELECT (SELECT count(*) FROM player)::INTEGER AS players,
      (SELECT count(DISTINCT player_id) FROM player)::INTEGER AS ids,
      (SELECT count(*) FROM player_ids)::INTEGER AS espn,
      (SELECT count(DISTINCT espn_athlete_id) FROM player_ids)::INTEGER AS espn_ids`)
  out.push(
    '',
    '## One person, one id',
    '',
    `\`player\` has ${COUNT.format(keys[0].players)} rows on ${COUNT.format(keys[0].ids)} ids; \`player_ids\` maps ${COUNT.format(keys[0].espn)} ESPN ids, each once (${COUNT.format(keys[0].espn_ids)} distinct). Where the sources disagree on who is who: the crosswalk's ids, and the league's players who share a name (the same person on two ids, or two people; \`wnba-data-sources.md\` says which).`,
    '',
    table(
      ['Kind', 'Id or name', 'Detail'],
      twoIds.map((r) => [r.kind, r.id, r.detail])
    )
  )

  // The game and season tables, once the league builds them.
  if (
    (
      await read(
        "SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name = 'player_season'"
      )
    )[0].n
  ) {
    wrong += await tableChecks(read, query, out)
  }

  return wrong
}
