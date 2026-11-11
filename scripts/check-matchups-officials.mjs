#!/usr/bin/env node
// Checks the game matchups and the officials' reads on a real load, through the built worker.
//
// Matchups, from 2017-18: the game matchups added up over a regular season against the NBA's season
// pair file, per defender and per pair, every season; the playoffs against the rollup by defender;
// the engine at the game grain (a date range over the whole season, and one month) against the
// table it reads; and how many played games have matchups. Points, makes and attempts must agree
// exactly. Time is stated to the second: the pair file's `matchup_time_sec` and the game file's
// `matchup_minutes_sort` are both seconds to a tenth.
//
// Officials: per season, the share of played games with a crew and the crews' sizes, and the
// official with the most games of 2025-26 recounted by hand from the raw officials file and the raw
// team box scores, against the read, with the league's line beside it.
//
// usage: node scripts/check-matchups-officials.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-matchups-officials.mjs <folder> [out.md]')
  process.exit(2)
}

const { read, query, call, close } = openStatsWorker(folder)
const FIRST = 2018
const LAST = 2026
const lines = []
const out = (s = '') => {
  lines.push(s)
  console.log(s)
}
const label = (s) => `${s - 1}-${String(s).slice(2)}`
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—')
const table = (head, rows) => {
  out(`| ${head.join(' | ')} |`)
  out(`| ${head.map(() => '---').join(' | ')} |`)
  for (const r of rows) out(`| ${r.join(' | ')} |`)
  out()
}
let problems = 0

out('# Game matchups and officials: agreement')
out()

// --- Game matchups against the pair file, regular season ---------------------------------------
const SUMS = (
  t,
  time
) => `sum(${time}) sec, sum(poss) poss, sum(pts) pts, sum(fgm) fgm, sum(fga) fga,
  sum(f3m) f3m, sum(f3a) f3a, sum(ftm) ftm, sum(fta) fta, sum(ast) ast, sum(tov) tov, sum(blk) blk,
  sum(sfl) sfl, sum(tpts) tpts`
const gameRows = `SELECT season, def_player_id d, off_player_id o, game_id, matchup_seconds sec0,
  possessions poss, player_pts pts, matchup_fgm fgm, matchup_fga fga, matchup_fg3_m f3m,
  matchup_fg3_a f3a, matchup_ftm ftm, matchup_fta fta, matchup_ast ast, matchup_tov tov,
  matchup_blk blk, sfl, team_pts tpts FROM game_matchups WHERE game_type = 'regular'`
const pairRows = `SELECT season, def_player_id d, off_player_id o, gp, matchup_time_sec sec0,
  partial_poss poss, player_pts pts, matchup_fgm fgm, matchup_fga fga, matchup_fg3_m f3m,
  matchup_fg3_a f3a, matchup_ftm ftm, matchup_fta fta, matchup_ast ast, matchup_tov tov,
  matchup_blk blk, sfl, team_pts tpts FROM src_nba_season_matchups
  WHERE lower(per_mode) = 'totals' AND lower(season_type) LIKE 'regular%'`
const defenders = await read(`
  WITH g AS (SELECT season, d, ${SUMS('g', 'sec0')} FROM (${gameRows}) GROUP BY 1, 2),
       p AS (SELECT season, d, ${SUMS('p', 'sec0')} FROM (${pairRows}) GROUP BY 1, 2)
  SELECT coalesce(g.season, p.season) season, count(*)::INTEGER n,
    count(*) FILTER (WHERE g.d IS NULL)::INTEGER only_pairs,
    count(*) FILTER (WHERE p.d IS NULL)::INTEGER only_games,
    count(*) FILTER (WHERE g.pts = p.pts AND g.fgm = p.fgm AND g.fga = p.fga)::INTEGER shots,
    count(*) FILTER (WHERE g.f3m = p.f3m AND g.f3a = p.f3a AND g.ftm = p.ftm AND g.fta = p.fta)::INTEGER threes,
    count(*) FILTER (WHERE g.ast = p.ast AND g.tov = p.tov AND g.blk = p.blk AND g.sfl = p.sfl AND g.tpts = p.tpts)::INTEGER rest,
    count(*) FILTER (WHERE abs(g.poss - p.poss) < 0.05)::INTEGER poss,
    count(*) FILTER (WHERE abs(g.sec - p.sec) <= 1)::INTEGER sec1,
    round(max(abs(g.sec - p.sec)), 1)::DOUBLE secmax, round(max(abs(g.poss - p.poss)), 1)::DOUBLE possmax
  FROM g FULL JOIN p ON g.season = p.season AND g.d = p.d
  WHERE coalesce(g.season, p.season) BETWEEN ${FIRST} AND ${LAST}
  GROUP BY 1 ORDER BY 1`)
out('## Game matchups against the season pair file, regular season, per defender')
out()
out(
  'Every defender of the pair file, the game matchups added up over the season beside it. Points, field goals, threes and free throws must be equal; time is compared to the second, possessions to 0.05.'
)
out()
table(
  [
    'Season',
    'Defenders',
    'Only in one',
    'PTS, FGM, FGA',
    '3PM, 3PA, FTM, FTA',
    'AST, TOV, BLK, SFL, team PTS',
    'Poss within 0.05',
    'Time within 1 s',
    'Largest time gap',
    'Largest poss gap'
  ],
  defenders.map((r) => {
    if (r.shots !== r.n || r.threes !== r.n || r.only_pairs || r.only_games) problems++
    return [
      label(r.season),
      r.n,
      r.only_pairs + r.only_games,
      `${r.shots} (${pct(r.shots, r.n)})`,
      `${r.threes} (${pct(r.threes, r.n)})`,
      `${r.rest} (${pct(r.rest, r.n)})`,
      `${r.poss} (${pct(r.poss, r.n)})`,
      `${r.sec1} (${pct(r.sec1, r.n)})`,
      `${r.secmax} s`,
      r.possmax
    ]
  })
)

const pairs = await read(`
  WITH g AS (SELECT season, d, o, count(*) gp, sum(sec0) sec, sum(pts) pts, sum(fgm) fgm, sum(fga) fga
             FROM (${gameRows}) GROUP BY 1, 2, 3),
       p AS (SELECT season, d, o, gp, sec0 sec, pts, fgm, fga FROM (${pairRows}))
  SELECT coalesce(g.season, p.season) season, count(*)::INTEGER n,
    count(*) FILTER (WHERE g.d IS NULL)::INTEGER only_pairs,
    count(*) FILTER (WHERE g.d IS NULL AND p.pts = 0 AND p.fga = 0)::INTEGER only_pairs_empty,
    count(*) FILTER (WHERE p.d IS NULL)::INTEGER only_games,
    count(*) FILTER (WHERE g.pts = p.pts AND g.fgm = p.fgm AND g.fga = p.fga)::INTEGER shots,
    count(*) FILTER (WHERE g.gp = p.gp)::INTEGER games,
    count(*) FILTER (WHERE abs(g.sec - p.sec) <= 0.05)::INTEGER sec
  FROM g FULL JOIN p ON g.season = p.season AND g.d = p.d AND g.o = p.o
  WHERE coalesce(g.season, p.season) BETWEEN ${FIRST} AND ${LAST}
  GROUP BY 1 ORDER BY 1`)
out('## Per pair')
out()
table(
  [
    'Season',
    'Pairs',
    'Only in the pair file',
    'of them with no shot',
    'Only in the games',
    'PTS, FGM, FGA equal',
    'Games equal',
    'Time equal (0.05 s)'
  ],
  pairs.map((r) => [
    label(r.season),
    r.n,
    r.only_pairs,
    r.only_pairs_empty,
    r.only_games,
    `${r.shots} (${pct(r.shots, r.n)})`,
    `${r.games} (${pct(r.games, r.n)})`,
    `${r.sec} (${pct(r.sec, r.n)})`
  ])
)

// --- Coverage: played games with matchups -------------------------------------------------------
const cover = await read(`
  SELECT g.season, g.game_type, count(*)::INTEGER games,
         count(m.game_id)::INTEGER with_matchups
  FROM game g LEFT JOIN (SELECT DISTINCT game_id FROM game_matchups) m ON m.game_id = g.game_id
  WHERE g.played AND g.season >= ${FIRST} AND g.game_type IN ('regular', 'play-in', 'playoffs', 'cup-final')
  GROUP BY 1, 2 ORDER BY 1, 2`)
out('## Played games with matchups')
out()
table(
  ['Season', 'Type', 'Played', 'With matchups', 'Share'],
  cover.map((r) => [
    label(r.season),
    r.game_type,
    r.games,
    r.with_matchups,
    pct(r.with_matchups, r.games)
  ])
)

// --- Playoffs: the game matchups against the rollup ---------------------------------------------
const playoffs = await read(`
  WITH g AS (SELECT season, def_player_id d, sum(matchup_seconds) sec, sum(player_pts) pts,
                    sum(matchup_fgm) fgm, sum(matchup_fga) fga, count(DISTINCT game_id) gp
             FROM game_matchups WHERE game_type = 'playoffs' GROUP BY 1, 2),
       r AS (SELECT season, def_player_id d, gp,
                    TRY_CAST(split_part(matchup_min, ':', 1) AS DOUBLE) * 60
                      + TRY_CAST(split_part(matchup_min, ':', 2) AS DOUBLE) sec,
                    player_pts pts, matchup_fgm fgm, matchup_fga fga
             FROM src_nba_matchup_rollups
             WHERE lower(position) = 'total' AND lower(season_type) = 'playoffs'
               AND lower(per_mode) = 'totals')
  SELECT coalesce(g.season, r.season) season, count(*)::INTEGER n,
    count(*) FILTER (WHERE g.d IS NULL OR r.d IS NULL)::INTEGER one,
    count(*) FILTER (WHERE g.pts = r.pts AND g.fgm = r.fgm AND g.fga = r.fga)::INTEGER shots,
    count(*) FILTER (WHERE g.gp = r.gp)::INTEGER games,
    count(*) FILTER (WHERE abs(g.sec - r.sec) <= 60)::INTEGER sec60
  FROM g FULL JOIN r ON g.season = r.season AND g.d = r.d
  WHERE coalesce(g.season, r.season) BETWEEN ${FIRST} AND ${LAST}
  GROUP BY 1 ORDER BY 1`)
out('## Playoffs: game matchups against the rollup, per defender')
out()
out('The rollup prints its clock to the second (`41:33`), so time is compared within a minute.')
out()
table(
  ['Season', 'Defenders', 'Only in one', 'PTS, FGM, FGA equal', 'Games equal', 'Time within 60 s'],
  playoffs.map((r) => [
    label(r.season),
    r.n,
    r.one,
    `${r.shots} (${pct(r.shots, r.n)})`,
    `${r.games} (${pct(r.games, r.n)})`,
    `${r.sec60} (${pct(r.sec60, r.n)})`
  ])
)

// --- The engine at the game grain against the table ----------------------------------------------
out('## The engine at the game grain')
out()
out(
  'A date range over the whole regular season, and January alone, through the engine, against the game matchups added up over the same games in SQL, per defender. A matchup in a game where the defender has no box-score line could not be read: counted as "No line".'
)
out()
const engineRows = []
for (let season = FIRST; season <= LAST; season++) {
  const [span] = await read(`SELECT min(game_date)::VARCHAR f, max(game_date)::VARCHAR t
    FROM game WHERE season = ${season} AND game_type = 'regular'`)
  for (const [name, from, to] of [
    ['season', span.f, span.t],
    ['January', `${season}-01-01`, `${season}-01-31`]
  ]) {
    const at = Date.now()
    const r = await query({
      entity: 'player',
      metrics: ['matchup_pts', 'matchup_fgm', 'matchup_fga', 'matchup_min', 'matchup_poss'],
      scope: { seasons: [season], dates: [from, to] },
      limit: 5000
    })
    const ms = Date.now() - at
    const sql = await read(`
      SELECT def_player_id::VARCHAR id, sum(player_pts) pts, sum(matchup_fgm) fgm,
             sum(matchup_fga) fga, sum(matchup_minutes) mins, sum(possessions) poss
      FROM game_matchups WHERE season = ${season} AND game_type = 'regular'
        AND game_date BETWEEN DATE '${from}' AND DATE '${to}'
      GROUP BY 1`)
    const [noLine] = await read(`
      SELECT count(*)::INTEGER n FROM (
        SELECT DISTINCT m.def_player_id, m.game_id FROM game_matchups m
        WHERE m.season = ${season} AND m.game_type = 'regular'
          AND m.game_date BETWEEN DATE '${from}' AND DATE '${to}'
          AND NOT EXISTS (SELECT 1 FROM player_game p WHERE p.player_id = m.def_player_id
                                                         AND p.game_id = m.game_id))`)
    const byId = new Map(r.rows.map((x) => [x.id, x.values]))
    let equal = 0
    for (const s of sql) {
      const v = byId.get(s.id)
      if (
        v &&
        v.matchup_pts.value === s.pts &&
        v.matchup_fgm.value === s.fgm &&
        v.matchup_fga.value === s.fga &&
        Math.abs(v.matchup_min.value - s.mins) < 1e-6 &&
        Math.abs(v.matchup_poss.value - s.poss) < 1e-6
      ) {
        equal++
      }
    }
    if (equal + noLine.n < sql.length) problems++
    engineRows.push([
      label(season),
      name,
      sql.length,
      `${equal} (${pct(equal, sql.length)})`,
      noLine.n,
      `${ms} ms`
    ])
  }
}
table(['Season', 'Range', 'Defenders', 'Equal on all five', 'No line', 'Engine'], engineRows)

// --- Officials -----------------------------------------------------------------------------------
const crews = await read(`
  WITH crew AS (SELECT DISTINCT TRY_CAST(o.official_id AS BIGINT) official_id, g.game_id
                FROM src_nba_officials o JOIN game g ON g.nba_game_id = TRY_CAST(o.game_id AS VARCHAR)),
       sizes AS (SELECT game_id, count(*) n FROM crew GROUP BY 1)
  SELECT g.season, count(*)::INTEGER games, count(s.game_id)::INTEGER with_crew,
    count(*) FILTER (WHERE s.n = 3)::INTEGER c3, count(*) FILTER (WHERE s.n = 4)::INTEGER c4,
    count(*) FILTER (WHERE s.n < 3)::INTEGER fewer, count(*) FILTER (WHERE s.n > 4)::INTEGER more,
    count(*) FILTER (WHERE s.n = 4 AND g.game_type = 'playoffs')::INTEGER c4_playoffs
  FROM game g LEFT JOIN sizes s ON s.game_id = g.game_id
  WHERE g.played AND g.game_type IN ('regular', 'play-in', 'playoffs', 'cup-final')
  GROUP BY 1 ORDER BY 1`)
const [raw] = await read(`
  SELECT count(*)::INTEGER n, count(DISTINCT (o.official_id, o.game_id))::INTEGER distinct_n,
    count(*) FILTER (WHERE g.game_id IS NULL)::INTEGER no_game
  FROM src_nba_officials o LEFT JOIN game g ON g.nba_game_id = TRY_CAST(o.game_id AS VARCHAR)`)
out('## Officials: games with a crew')
out()
out(
  `The file has ${raw.n} rows, ${raw.distinct_n} distinct official and game pairs, and ${raw.no_game} rows whose game the \`game\` table does not know. Played games of the regular season, play-in, playoffs and Cup final:`
)
out()
table(
  [
    'Season',
    'Played',
    'With a crew',
    'Share',
    'Crews of 3',
    'of 4',
    'of 4 in the playoffs',
    'Fewer',
    'More'
  ],
  crews.map((r) => [
    label(r.season),
    r.games,
    r.with_crew,
    pct(r.with_crew, r.games),
    r.c3,
    r.c4,
    r.c4_playoffs,
    r.fewer,
    r.more
  ])
)

// One official's season, by hand: the raw officials file and the raw team box scores.
const season = await call('officialsSeason', { season: LAST, gameTypes: ['regular'] })
const top = season.officials[0]
const [hand] = await read(`
  WITH worked AS (
    SELECT DISTINCT o.game_id FROM src_nba_officials o
    WHERE TRY_CAST(o.official_id AS BIGINT) = ${Number(top.id)} AND o.season = ${LAST}
  ), games AS (
    SELECT g.nba_game_id, g.home_team_id, g.away_team_id, g.home_score, g.away_score
    FROM game g JOIN worked w ON w.game_id = g.nba_game_id
    WHERE g.played AND g.game_type = 'regular'
  ), box AS (
    SELECT TRY_CAST(b.game_id AS VARCHAR) game_id, b.team_id, b.fouls_personal pf,
           b.free_throws_attempted fta, b.points pts
    FROM src_nba_team_box b
  )
  SELECT count(*)::INTEGER games, sum(h.pf)::DOUBLE home_pf, sum(a.pf)::DOUBLE away_pf,
         sum(h.fta)::DOUBLE home_fta, sum(a.fta)::DOUBLE away_fta,
         sum(h.pts)::DOUBLE home_pts, sum(a.pts)::DOUBLE away_pts,
         sum((g.home_score > g.away_score)::INTEGER)::DOUBLE home_wins
  FROM games g
  JOIN box h ON h.game_id = g.nba_game_id AND h.team_id = g.home_team_id
  JOIN box a ON a.game_id = g.nba_game_id AND a.team_id = g.away_team_id`)
const fields = [
  ['games', 'games'],
  ['homeFouls', 'home_pf'],
  ['awayFouls', 'away_pf'],
  ['homeFta', 'home_fta'],
  ['awayFta', 'away_fta'],
  ['homePts', 'home_pts'],
  ['awayPts', 'away_pts'],
  ['homeWins', 'home_wins']
]
out(`## One official recounted by hand: ${top.name}, ${label(LAST)} regular season`)
out()
out(
  'The read (officials file, `game`, `team_game`) against a count from the raw officials file and the raw NBA team box scores (`src_nba_team_box`), with the league line the read gives.'
)
out()
table(
  ['Total', 'Read', 'By hand', 'Equal', 'League'],
  fields.map(([k, h]) => {
    const same = top.totals[k] === hand[h]
    if (!same) problems++
    return [k, top.totals[k], hand[h], same ? 'yes' : 'NO', season.league[k]]
  })
)
const rate = (t, a, b) => (t.games ? ((t[a] + (b ? t[b] : 0)) / t.games).toFixed(2) : '—')
out(
  `Per game: fouls ${rate(top.totals, 'homeFouls', 'awayFouls')} (league ${rate(season.league, 'homeFouls', 'awayFouls')}), free-throw attempts ${rate(top.totals, 'homeFta', 'awayFta')} (${rate(season.league, 'homeFta', 'awayFta')}), home wins ${rate(top.totals, 'homeWins')} (${rate(season.league, 'homeWins')}).`
)
out()

// --- Speed --------------------------------------------------------------------------------------
const time = async (name, f) => {
  const at = Date.now()
  await f()
  return [name, `${Date.now() - at} ms`]
}
const [aGame] = await read(`SELECT game_id FROM game_matchups WHERE season = ${LAST} LIMIT 1`)
out('## Speed of the reads')
out()
table(
  ['Read', 'Time'],
  [
    await time('A game’s pairs', () => call('gameMatchups', { game: aGame.game_id })),
    await time('A player’s pairs, last 10 games', () =>
      call('matchups', {
        player: '2544',
        season: LAST,
        scope: { gameTypes: ['regular'], lastN: 10, lastNOf: 'appearances' }
      })
    ),
    await time('A season’s officials', () =>
      call('officialsSeason', { season: LAST, gameTypes: ['regular'] })
    ),
    await time('An official’s seasons', () =>
      call('officialCareer', { official: top.id, gameTypes: ['regular'] })
    )
  ]
)

out(problems ? `**${problems} problems.**` : 'No problems.')
await close()
if (mdFile) writeFileSync(mdFile, `${lines.join('\n')}\n`)
process.exit(problems ? 1 : 0)
