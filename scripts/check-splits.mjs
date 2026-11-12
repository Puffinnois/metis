#!/usr/bin/env node
// Checks the splits of each game (`split_player`, `split_team`) on a real load, through the built
// worker, and writes the results as a report:
//
// 1. The plan's hand count: one close 2025-26 game, its clutch plays listed from the raw
//    `src_nba_pbp` by SQL written apart from the builder (its own clock, score and credits), and the
//    clutch totals of every player and both teams against the tables.
// 2. Per season, the identities that must hold exactly: the quarters and overtime add up to the
//    game's play totals; the halves to their quarters; ahead, tied and behind to the game, and so
//    garbage time and the rest.
// 3. Per season, the quarters added up against the box score (the rate T901 measured for the plays),
//    players' time against box-score minutes, and teams' points by quarter against ESPN's line
//    scores where those add up to the final score.
// 4. Per season, the garbage-time rule against the `garbage_time` mark of the dataset's possessions.
//
// Clutch totals against the NBA's own clutch tables: no loaded table holds them (searched on a full
// load, `nba-data-sources.md`), so there is nothing to compare with.
//
// usage: node scripts/check-splits.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-splits.mjs <folder> [out.md]')
  process.exit(2)
}

const { read, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map((h, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  ''
]
const out = []
const say = (lines) => {
  for (const l of [lines].flat()) {
    out.push(l)
    console.log(l)
  }
}

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
const COUNTED = "('regular', 'play-in', 'playoffs', 'cup-final')"
const PERIODS = "('q1', 'q2', 'q3', 'q4', 'ot')"
const sumsOf = (alias = '') => COUNTS.map((c) => `sum(${alias}${c}) AS ${c}`).join(', ')
const same = (a, b, counts = COUNTS) =>
  counts.map((c) => `coalesce(${a}.${c}, 0) = coalesce(${b}.${c}, 0)`).join(' AND ')

// ---- 1. The hand count -------------------------------------------------------------------------

// The earliest 2025-26 regular-season game decided by one point in regulation.
const [pick] = await read(`
  SELECT g.game_id, g.game_date, g.home_team_id, g.away_team_id, g.home_score, g.away_score,
         h.code AS home_code, a.code AS away_code
  FROM game g JOIN team h ON h.team_id = g.home_team_id AND h.season = g.season
  JOIN team a ON a.team_id = g.away_team_id AND a.season = g.season
  JOIN team_game t ON t.game_id = g.game_id AND t.team_id = g.home_team_id
  WHERE g.season = 2026 AND g.game_type = 'regular' AND g.played
    AND abs(g.home_score - g.away_score) = 1 AND t.minutes = 240
  ORDER BY g.game_date, g.game_id LIMIT 1`)

// Written apart from the builder: the raw rows, their clock from the ISO text, the score carried
// from the rows that print one, each row's points from its own columns, and the score before it.
const RAW = `WITH g AS (SELECT game_id, nba_game_id FROM game WHERE game_id = '${pick.game_id}'),
  raw AS (
    SELECT r.order_index, r.period, r.team_id, r.person_id, r.location, r.action_type, r.sub_type,
           r.description, r.shot_value, nullif(trim(r.player_name), '') AS player_name,
           TRY_CAST(regexp_extract(r.clock, 'PT(\\d+)M', 1) AS DOUBLE) * 60
             + TRY_CAST(regexp_extract(r.clock, 'M([\\d.]+)S', 1) AS DOUBLE) AS secs,
           TRY_CAST(nullif(r.score_home, '') AS INTEGER) AS sh,
           TRY_CAST(nullif(r.score_away, '') AS INTEGER) AS sa
    FROM src_nba_pbp r JOIN g ON r.game_id = g.nba_game_id
  ), carried AS (
    SELECT *,
           coalesce(last_value(sh IGNORE NULLS) OVER w, 0) AS home_after,
           coalesce(last_value(sa IGNORE NULLS) OVER w, 0) AS away_after,
           CASE WHEN action_type = 'Made Shot' THEN shot_value
                WHEN action_type = 'Free Throw' AND description NOT LIKE 'MISS%' THEN 1 ELSE 0 END AS p
    FROM raw WINDOW w AS (ORDER BY order_index ROWS UNBOUNDED PRECEDING)
  ), rows AS (
    SELECT *, (home_after - CASE WHEN location = 'h' THEN p ELSE 0 END)
              - (away_after - CASE WHEN location = 'v' THEN p ELSE 0 END) AS margin_before
    FROM carried
  ), clutch AS (
    SELECT * FROM rows WHERE period >= 4 AND secs <= 300 AND abs(margin_before) <= 5
  ), names AS (
    SELECT DISTINCT team_id, person_id, player_name FROM rows WHERE team_id > 0 AND person_id > 0
  ), credit AS (
    SELECT person_id AS player_id, team_id, p AS pts,
           (action_type = 'Made Shot')::INT AS fgm,
           (action_type IN ('Made Shot', 'Missed Shot'))::INT AS fga,
           (action_type = 'Made Shot' AND shot_value = 3)::INT AS fg3m,
           (action_type IN ('Made Shot', 'Missed Shot') AND shot_value = 3)::INT AS fg3a,
           (action_type = 'Free Throw' AND description NOT LIKE 'MISS%')::INT AS ftm,
           (action_type = 'Free Throw')::INT AS fta,
           (action_type = 'Rebound')::INT AS reb,
           (action_type = 'Turnover' AND description NOT ILIKE 'No Turnover%')::INT AS tov,
           (action_type = 'Foul' AND regexp_matches(description, '\\(P\\d+'))::INT AS pf,
           (action_type = '' AND description LIKE '% STEAL (%')::INT AS stl,
           (action_type = '' AND description LIKE '% BLOCK (%')::INT AS blk,
           0 AS ast
    FROM clutch WHERE team_id > 0 AND person_id > 0
    UNION ALL
    SELECT n.person_id, c.team_id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
    FROM clutch c JOIN names n ON n.team_id = c.team_id
     AND n.player_name = regexp_extract(c.description, '\\(([^()]*?) \\d+ AST\\)', 1)
    WHERE c.action_type = 'Made Shot' AND c.description LIKE '% AST)%'
  )`
const HAND = [
  'pts',
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf'
]

const plays = await read(`${RAW}
  SELECT period, secs, location, margin_before, description FROM clutch
  WHERE action_type NOT IN ('Substitution', 'Timeout', 'Instant Replay', 'period') ORDER BY order_index`)
const hand = await read(`${RAW}, totals AS (
    SELECT player_id, any_value(team_id) AS team_id, ${HAND.map((c) => `sum(${c})::INTEGER AS ${c}`).join(', ')}
    FROM credit GROUP BY 1
  ), mine AS (
    SELECT player_id, ${HAND.map((c) => (c === 'reb' ? 'oreb + dreb AS reb' : c)).join(', ')}
    FROM split_player WHERE split = 'clutch' AND game_id = '${pick.game_id}'
  )
  SELECT coalesce(p.name, k.player_id::VARCHAR) AS name, k.player_id,
         ${HAND.map((c) => `coalesce(h.${c}, 0) AS h_${c}, coalesce(m.${c}, 0) AS m_${c}`).join(', ')}
  FROM (SELECT player_id FROM totals UNION SELECT player_id FROM mine) k
  LEFT JOIN totals h USING (player_id) LEFT JOIN mine m USING (player_id)
  LEFT JOIN player p ON p.player_id = k.player_id
  ORDER BY coalesce(h.pts, m.pts, 0) DESC, name`)
const teamHand = await read(`${RAW}, totals AS (
    SELECT CASE WHEN location = 'h' THEN 'home' ELSE 'away' END AS side, sum(p)::INTEGER AS pts,
           sum((action_type = 'Made Shot')::INT)::INTEGER AS fgm,
           sum((action_type IN ('Made Shot', 'Missed Shot'))::INT)::INTEGER AS fga,
           sum((action_type = 'Free Throw')::INT)::INTEGER AS fta
    FROM clutch WHERE location IN ('h', 'v') GROUP BY 1
  )
  SELECT t.side, t.pts AS h_pts, s.pts AS m_pts, t.fgm AS h_fgm, s.fgm AS m_fgm,
         t.fga AS h_fga, s.fga AS m_fga, t.fta AS h_fta, s.fta AS m_fta, s.seconds / 5 AS m_seconds
  FROM totals t JOIN split_team s ON s.game_id = '${pick.game_id}' AND s.split = 'clutch'
   AND s.team_id = CASE t.side WHEN 'home' THEN ${pick.home_team_id} ELSE ${pick.away_team_id} END
  ORDER BY 1 DESC`)

const day = new Date(pick.game_date).toISOString().slice(0, 10)
say(`## Hand count: clutch in ${pick.away_code} at ${pick.home_code}, ${day}`)
say('')
say(
  `${pick.away_code} ${pick.away_score}, ${pick.home_code} ${pick.home_score}, game \`${pick.game_id}\`. ` +
    `Clutch rows from \`src_nba_pbp\`: period 4 or later, 5:00 or less on the clock, the score before ` +
    `the row within 5. ${plays.length} plays (substitutions, timeouts and reviews left out of the list):`
)
say('')
say(
  table(
    ['Period', 'Clock', 'Side', 'Margin before', 'Play'],
    plays.map((r) => [
      r.period,
      `${Math.floor(r.secs / 60)}:${String((r.secs % 60).toFixed(1)).padStart(4, '0')}`,
      r.location === 'h' ? pick.home_code : r.location === 'v' ? pick.away_code : '',
      r.margin_before,
      r.description.replaceAll('|', '/')
    ])
  )
)
const players = hand.map((r) => {
  const ok = HAND.every((c) => r[`h_${c}`] === r[`m_${c}`])
  return [
    r.name,
    ...HAND.map((c) =>
      r[`h_${c}`] === r[`m_${c}`] ? r[`h_${c}`] : `${r[`h_${c}`]} / ${r[`m_${c}`]}`
    ),
    ok ? 'equal' : 'differs'
  ]
})
say('Players, the hand count against `split_player` (one number where they agree):')
say('')
say(table(['Player', ...HAND, ''], players))
say('Teams, against `split_team`:')
say('')
say(
  table(
    ['Side', 'pts', 'fgm', 'fga', 'fta', 'Clutch time'],
    teamHand.map((r) => [
      r.side,
      ...['pts', 'fgm', 'fga', 'fta'].map((c) =>
        r[`h_${c}`] === r[`m_${c}`] ? r[`h_${c}`] : `${r[`h_${c}`]} / ${r[`m_${c}`]}`
      ),
      `${Math.floor(r.m_seconds / 60)}:${String(Math.round(r.m_seconds % 60)).padStart(2, '0')}`
    ])
  )
)
const handOk = hand.every((r) => HAND.every((c) => r[`h_${c}`] === r[`m_${c}`]))
const teamOk = teamHand.every((r) =>
  ['pts', 'fgm', 'fga', 'fta'].every((c) => r[`h_${c}`] === r[`m_${c}`])
)
say(`Hand count: ${handOk && teamOk ? 'every player and team total equal' : 'DIFFERS'}.`)
say('')

// ---- 2. Identities ------------------------------------------------------------------------------

// A season at a time, so a scan of every play stays inside DuckDB's memory limit.
const seasons = (await read('SELECT DISTINCT season FROM split_team ORDER BY 1')).map(
  (r) => r.season
)
const perSeason = async (sql) => {
  const rows = []
  for (const s of seasons) rows.push(...(await read(sql(s))))
  return rows
}

// The game's play totals per player, as the box score counts them (as `check-plays.mjs` does).
const PLAY_LINES = (s) => `
  actor AS (
    SELECT game_id, player_id, sum(pts) pts, sum(fgm) fgm, sum(fga) fga, sum(fg3m) fg3m,
           sum(fg3a) fg3a, sum(ftm) ftm, sum(fta) fta, sum(oreb) oreb, sum(dreb) dreb, sum(tov) tov,
           sum(pf) pf
    FROM play_nba WHERE season = ${s} AND player_id IS NOT NULL GROUP BY 1, 2
  ), credits AS (
    SELECT game_id, assist_id AS player_id, 1 AS ast, 0 AS stl, 0 AS blk FROM play_nba WHERE season = ${s} AND assist_id IS NOT NULL
    UNION ALL SELECT game_id, steal_id, 0, 1, 0 FROM play_nba WHERE season = ${s} AND steal_id IS NOT NULL
    UNION ALL SELECT game_id, block_id, 0, 0, 1 FROM play_nba WHERE season = ${s} AND block_id IS NOT NULL
  ), credit AS (SELECT game_id, player_id, sum(ast) ast, sum(stl) stl, sum(blk) blk FROM credits GROUP BY 1, 2),
  lines AS (
    SELECT game_id, player_id, a.* EXCLUDE (game_id, player_id), c.ast, c.stl, c.blk
    FROM actor a FULL JOIN credit c USING (game_id, player_id)
  )`

const byPeriod = (
  s
) => `SELECT season, game_id, team_id, player_id, ${sumsOf()}, sum(seconds) AS seconds
  FROM split_player WHERE season = ${s} AND split IN ${PERIODS} GROUP BY 1, 2, 3, 4`
const partSums = (s, splits) => `SELECT game_id, player_id, ${sumsOf()}, sum(seconds) AS seconds
  FROM split_player WHERE season = ${s} AND split IN (${splits.map((x) => `'${x}'`).join(', ')}) GROUP BY 1, 2`

const identity = await perSeason(
  (x) => `WITH ${PLAY_LINES(x)}, q AS (${byPeriod(x)}),
  h AS (${partSums(x, ['h1', 'h2'])}), h4 AS (${partSums(x, ['q1', 'q2', 'q3', 'q4'])}),
  s AS (${partSums(x, ['ahead', 'tied', 'behind'])}), gt AS (${partSums(x, ['garbage', 'nogarbage'])})
  SELECT q.season, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE ${same('q', 'l')})::INTEGER AS plays,
         count(*) FILTER (WHERE ${same('h', 'h4')} AND abs(coalesce(h.seconds, 0) - coalesce(h4.seconds, 0)) < 0.01)::INTEGER AS halves,
         count(*) FILTER (WHERE ${same('s', 'q')} AND abs(coalesce(s.seconds, 0) - q.seconds) < 0.01)::INTEGER AS score,
         count(*) FILTER (WHERE ${same('gt', 'q')} AND abs(coalesce(gt.seconds, 0) - q.seconds) < 0.01)::INTEGER AS garbage
  FROM q LEFT JOIN lines l USING (game_id, player_id) LEFT JOIN h USING (game_id, player_id)
  LEFT JOIN h4 USING (game_id, player_id) LEFT JOIN s USING (game_id, player_id)
  LEFT JOIN gt USING (game_id, player_id)
  GROUP BY 1 ORDER BY 1`
)

const teamIdentity = await perSeason(
  (x) => `WITH q AS (
    SELECT season, game_id, team_id, ${sumsOf()}, sum(opp_pts) AS opp_pts, sum(seconds) AS seconds, sum(poss) AS poss
    FROM split_team WHERE season = ${x} AND split IN ${PERIODS} GROUP BY 1, 2, 3
  ), s AS (
    SELECT game_id, team_id, ${sumsOf()}, sum(opp_pts) AS opp_pts, sum(seconds) AS seconds
    FROM split_team WHERE season = ${x} AND split IN ('ahead', 'tied', 'behind') GROUP BY 1, 2
  ), actor AS (
    SELECT game_id, team_id, sum(pts) pts, sum(fgm) fgm, sum(fga) fga, sum(fg3m) fg3m, sum(fg3a) fg3a,
           sum(ftm) ftm, sum(fta) fta, sum(ast) ast, sum(pf) pf,
           sum(oreb) FILTER (WHERE player_id IS NOT NULL) oreb, sum(dreb) FILTER (WHERE player_id IS NOT NULL) dreb,
           sum(tov) FILTER (WHERE player_id IS NOT NULL) tov
    FROM play_nba WHERE season = ${x} AND team_id IS NOT NULL GROUP BY 1, 2
  ), credit AS (
    SELECT game_id, opponent_id AS team_id, sum(stl) stl, sum(blk) blk FROM play_nba
    WHERE season = ${x} AND opponent_id IS NOT NULL GROUP BY 1, 2
  ), l AS (SELECT * FROM actor FULL JOIN credit USING (game_id, team_id)),
  p AS (
    SELECT game_id, team_id, count(*) FILTER (WHERE coalesce(counted, true)) AS poss
    FROM possession WHERE season = ${x} GROUP BY 1, 2
  )
  SELECT q.season, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE ${same('q', 'l')})::INTEGER AS plays,
         count(*) FILTER (WHERE ${same('s', 'q')} AND s.opp_pts = q.opp_pts)::INTEGER AS score,
         count(*) FILTER (WHERE q.poss = p.poss)::INTEGER AS poss
  FROM q LEFT JOIN l USING (game_id, team_id) LEFT JOIN s USING (game_id, team_id)
  LEFT JOIN p USING (game_id, team_id)
  GROUP BY 1 ORDER BY 1`
)

say('## Identities, per season')
say('')
say(
  "Player-games: the quarters and overtime added up against the game's play totals (all 14 counts), " +
    'the halves against the four quarters, ahead + tied + behind and garbage + the rest against the ' +
    'quarters (counts and seconds). Team-games: the quarters against the play totals, the score ' +
    "states against the quarters (with the opponent's points), possessions against the game's."
)
say('')
const teamBy = new Map(teamIdentity.map((r) => [r.season, r]))
say(
  table(
    [
      'Season',
      'Player-games',
      'Plays',
      'Halves',
      'Score',
      'Garbage',
      'Team-games',
      'Plays',
      'Score',
      'Possessions'
    ],
    identity.map((r) => {
      const t = teamBy.get(r.season) ?? {}
      const show = (part, whole) => (part === whole ? 'all' : `${COUNT.format(whole - part)} off`)
      return [
        label(r.season),
        COUNT.format(r.n),
        show(r.plays, r.n),
        show(r.halves, r.n),
        show(r.score, r.n),
        show(r.garbage, r.n),
        COUNT.format(t.n ?? 0),
        show(t.plays, t.n),
        show(t.score, t.n),
        show(t.poss, t.n)
      ]
    })
  )
)

// ---- 3. Against the box scores ------------------------------------------------------------------

const box = await perSeason(
  (x) => `WITH q AS (${byPeriod(x)})
  SELECT b.season, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE ${same('q', 'b')})::INTEGER AS exact,
         count(*) FILTER (WHERE ${COUNTS.map((c) => `abs(coalesce(q.${c}, 0) - coalesce(b.${c}, 0)) <= 1`).join(' AND ')})::INTEGER AS within1,
         count(*) FILTER (WHERE abs(coalesce(q.seconds, 0) - b.seconds) <= 1)::INTEGER AS sec1,
         count(*) FILTER (WHERE abs(coalesce(q.seconds, 0) - b.seconds) <= 60)::INTEGER AS sec60,
         count(*) FILTER (WHERE b.seconds % 60 = 0)::INTEGER AS whole_minutes,
         sum(q.seconds) / nullif(sum(b.seconds), 0) AS ratio
  FROM player_game b JOIN team_game t ON t.game_id = b.game_id AND t.team_id = b.team_id
  LEFT JOIN q ON q.game_id = b.game_id AND q.player_id = b.player_id
  WHERE b.season = ${x} AND t.source = 'nba' AND b.game_type IN ${COUNTED}
    AND b.game_id IN (SELECT DISTINCT game_id FROM split_team WHERE season = ${x})
  GROUP BY 1 ORDER BY 1`
)

const lines = await read(`WITH e AS (
    SELECT g.game_id, g.season, g.home_team_id, g.away_team_id, g.home_score, g.away_score,
           list_transform(regexp_extract_all(s.home_linescores::VARCHAR, '''value'': (-?[0-9.]+)', 1), x -> TRY_CAST(x AS DOUBLE)) AS home,
           list_transform(regexp_extract_all(s.away_linescores::VARCHAR, '''value'': (-?[0-9.]+)', 1), x -> TRY_CAST(x AS DOUBLE)) AS away
    FROM game g JOIN src_espn_schedule s ON s.game_id = g.espn_game_id
    WHERE g.played AND g.game_type IN ${COUNTED}
  ), held AS (
    SELECT * FROM e WHERE len(home) >= 4 AND list_sum(home) = home_score AND list_sum(away) = away_score
  ), sides AS (
    SELECT game_id, season, home_team_id AS team_id, home AS lines FROM held
    UNION ALL SELECT game_id, season, away_team_id, away FROM held
  ), q AS (
    SELECT game_id, team_id,
           sum(pts) FILTER (WHERE split = 'q1') q1, sum(pts) FILTER (WHERE split = 'q2') q2,
           sum(pts) FILTER (WHERE split = 'q3') q3, sum(pts) FILTER (WHERE split = 'q4') q4,
           coalesce(sum(pts) FILTER (WHERE split = 'ot'), 0) ot
    FROM split_team WHERE split IN ${PERIODS} GROUP BY 1, 2
  )
  SELECT s.season, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE q.q1 = s.lines[1] AND q.q2 = s.lines[2] AND q.q3 = s.lines[3] AND q.q4 = s.lines[4]
                          AND q.ot = coalesce(list_sum(s.lines[5:]), 0))::INTEGER AS exact
  FROM sides s JOIN q USING (game_id, team_id)
  GROUP BY 1 ORDER BY 1`)

say('## Against the box scores, per season')
say('')
say(
  "Player-games of the counted types with the NBA's box score: the quarters added up against the " +
    "box-score line (exact: all 14 counts; within 1: none off by more), and players' time from the " +
    'substitutions against box-score minutes. Team-games: points by quarter and overtime against ' +
    "ESPN's line scores, where those add up to the final score."
)
say('')
const lineBy = new Map(lines.map((r) => [r.season, r]))
say(
  table(
    [
      'Season',
      'Player-games',
      'Exact',
      'Within 1',
      'Time ≤ 1 s',
      'Time ≤ 60 s',
      'Box in whole minutes',
      'Line scores',
      'Equal'
    ],
    box.map((r) => {
      const l = lineBy.get(r.season)
      return [
        label(r.season),
        COUNT.format(r.n),
        `${pct(r.exact, r.n)} %`,
        `${pct(r.within1, r.n)} %`,
        `${pct(r.sec1, r.n)} %`,
        `${pct(r.sec60, r.n)} %`,
        `${pct(r.whole_minutes, r.n)} %`,
        l ? COUNT.format(l.n) : '–',
        l ? `${pct(l.exact, l.n)} %` : '–'
      ]
    })
  )
)

// ---- 4. Garbage time against the dataset's mark -------------------------------------------------

const garbage = await perSeason(
  (x) => `WITH p AS (
    SELECT x.season, x.garbage_time AS theirs,
           x.period = 4 AND (
             (x.start_clock > 540 AND abs(m.margin) >= 25) OR
             (x.start_clock > 360 AND x.start_clock <= 540 AND abs(m.margin) >= 20) OR
             (x.start_clock <= 360 AND abs(m.margin) >= 10)) AS ours
    FROM possession x
    LEFT JOIN (
      SELECT game_id, seq, (home_after - CASE WHEN home THEN pts ELSE 0 END)
                           - (away_after - CASE WHEN NOT home THEN pts ELSE 0 END) AS margin
      FROM play_nba WHERE season = ${x}
    ) m ON m.game_id = x.game_id AND m.seq = x.start_seq
    WHERE x.season = ${x} AND coalesce(x.counted, true)
  )
  SELECT season, count(*)::INTEGER AS n,
         count(*) FILTER (WHERE theirs)::INTEGER AS theirs,
         count(*) FILTER (WHERE ours)::INTEGER AS ours,
         count(*) FILTER (WHERE theirs AND ours)::INTEGER AS both,
         count(*) FILTER (WHERE coalesce(theirs, false) = coalesce(ours, false))::INTEGER AS agree
  FROM p GROUP BY 1 ORDER BY 1`
)

say("## Garbage time against the possessions' mark, per season")
say('')
say(
  'Counted possessions, each by its first play: the rule here (the 4th quarter, a margin of 25+ ' +
    "with over 9:00 left, 20+ from 9:00 to 6:01, 10+ at 6:00 or less) against SportsDataverse's " +
    '`is_garbage_time`.'
)
say('')
say(
  table(
    ['Season', 'Possessions', 'Theirs', 'Ours', 'Both', 'Agree'],
    garbage.map((r) => [
      label(r.season),
      COUNT.format(r.n),
      COUNT.format(r.theirs),
      COUNT.format(r.ours),
      COUNT.format(r.both),
      `${pct(r.agree, r.n)} %`
    ])
  )
)

await close()
if (mdFile) writeFileSync(mdFile, `${out.join('\n')}\n`)
