#!/usr/bin/env node
// Checks the play-derived tables (Plan T905) on a real load, through the built worker, and writes the
// report the data doc quotes. Per season:
//
// 1. Turnover kinds: on every player-game and team-game row the kinds add up to the turnovers, and
//    live plus dead do too; players' turnovers against the box score, and teams' with the team
//    turnovers (no player) taken out; the share of turnovers whose spelling no kind lists.
// 2. Foul kinds add up to the personal fouls; players' and teams' fouls against the box score, with
//    the fouls the box score has and the feed lacks summed.
// 3. Assisted and unassisted makes add up to the plays' makes on every player-game; the scorers'
//    assisted makes equal the passers' assists; both against the box score's assists; and against
//    the shot tables' assisted makes (Plan T903), the same flag read through the shot file.
// 4. And-ones: never more than the other side's shooting fouls, nor than the "1 of 1" free throws.
// 5. Game flow: lead changes, ties and largest lead recounted from the raw `src_nba_pbp`, by SQL
//    written apart from the builder (its own score carried from the raw text, its own rule as a
//    sequence of distinct score states), for every game of six seasons across the eras; the time
//    leading, trailing and tied adding up to the game; the final margin against the box score.
// 6. Ejections against ESPN's box score's `ejected`; fouls drawn (ESPN's, 2005-06 to 2016-17)
//    against the other side's box-score fouls. No loaded table holds technicals.
// 7. The reads' speed: an assist network and a game flow, warm, median of five.
//
// Tolerance: "exact" means equal; nothing is tuned. Box-score rows only (`box_games = 1`).
//
// usage: node scripts/check-play-derived.mjs <folder holding stats.duckdb> [out.md]
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-play-derived.mjs <folder> [out.md]')
  process.exit(2)
}

// The rules have no imports, so they are read here without bundling: the kinds' spellings.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const rules = ts.transpileModule(
  readFileSync(join(ROOT, 'src/shared/stats/playDetail.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText
const { TURNOVER_KINDS, FOUL_KINDS } = await import(
  `data:text/javascript,${encodeURIComponent(rules)}`
)

const { read, call, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map((_, i) => (i < 1 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  ''
]
const list = (xs) => xs.map((x) => `'${x.replaceAll("'", "''")}'`).join(', ')
const n = (x) => Number(x ?? 0)

const tovKinds = TURNOVER_KINDS.map((k) => `tov_${k.key}`).join(' + ')
const pfKinds = FOUL_KINDS.map((k) => `pf_${k.key}`).join(' + ')
const tovSpelled = list(TURNOVER_KINDS.flatMap((k) => k.subtypes))
const pfSpelled = list(FOUL_KINDS.flatMap((k) => k.subtypes))

const out = ['# Play-derived tables: checks', '']

// 1 to 3, per season, regular season and playoffs together, against the box score.
const players = await read(`
  SELECT w.season, count(*)::INTEGER AS n,
    count(*) FILTER (WHERE ${tovKinds} <> w.tov OR w.tov_live + w.tov_dead <> w.tov)::INTEGER AS tov_sum_bad,
    count(*) FILTER (WHERE ${pfKinds} <> w.pf)::INTEGER AS pf_sum_bad,
    count(*) FILTER (WHERE w.tov = b.tov)::INTEGER AS tov_exact,
    count(*) FILTER (WHERE w.pf = b.pf)::INTEGER AS pf_exact,
    count(*) FILTER (WHERE w.ast2 + w.ast3 = b.ast)::INTEGER AS ast_exact,
    sum(b.pf - w.pf)::INTEGER AS pf_gap
  FROM play_player_game w JOIN player_game b USING (game_id, player_id)
  WHERE b.games = 1 AND b.source = 'nba'
  GROUP BY 1 ORDER BY 1`)

const makes = await read(`
  WITH p AS (
    SELECT season, game_id, player_id, sum(fgm)::INTEGER AS fgm, sum(fg3m)::INTEGER AS fg3m
    FROM play_nba WHERE player_id IS NOT NULL GROUP BY 1, 2, 3)
  SELECT p.season,
    count(*) FILTER (WHERE coalesce(w.made2_ast + w.made2_unast + w.made3_ast + w.made3_unast, 0) <> p.fgm
                        OR coalesce(w.made3_ast + w.made3_unast, 0) <> p.fg3m)::INTEGER AS bad,
    count(*)::INTEGER AS n
  FROM p LEFT JOIN play_player_game w USING (game_id, player_id)
  GROUP BY 1 ORDER BY 1`)

const shotsAgree = await read(`
  SELECT w.season, count(*)::INTEGER AS n,
    count(*) FILTER (WHERE w.made2_ast + w.made3_ast = s.shots_ast)::INTEGER AS same
  FROM play_player_game w JOIN shot_player_game s USING (game_id, player_id)
  GROUP BY 1 ORDER BY 1`)

const teams = await read(`
  SELECT w.season, count(*)::INTEGER AS n,
    count(*) FILTER (WHERE ${tovKinds} <> w.tov OR ${pfKinds} <> w.pf)::INTEGER AS sum_bad,
    count(*) FILTER (WHERE w.tov - w.tov_team = b.tov)::INTEGER AS tov_exact,
    count(*) FILTER (WHERE w.tov = b.tov)::INTEGER AS tov_with_team,
    count(*) FILTER (WHERE w.pf = b.pf)::INTEGER AS pf_exact,
    count(*) FILTER (WHERE abs(w.pf - b.pf) <= 1)::INTEGER AS pf_within1,
    sum(b.pf - w.pf)::INTEGER AS pf_gap, sum(b.pf)::INTEGER AS pf_box,
    count(*) FILTER (WHERE w.made2_ast + w.made3_ast = b.ast)::INTEGER AS ast_exact,
    count(*) FILTER (WHERE w.and1 > w.opp_pf_shooting)::INTEGER AS and1_over,
    sum(w.and1)::INTEGER AS and1, sum(w.and1_ftm)::INTEGER AS and1_ftm,
    sum(w.tech)::INTEGER AS tech, sum(w.pf_flagrant1 + w.pf_flagrant2)::INTEGER AS flagrant,
    count(*) FILTER (WHERE abs(w.lead_ds + w.opp_lead_ds + w.tied_ds - w.game_ds) > 1)::INTEGER AS time_bad,
    count(*) FILTER (WHERE w.season BETWEEN 2006 AND 2017 AND w.fd = b.opp_pf)::INTEGER AS fd_exact,
    count(*) FILTER (WHERE w.season BETWEEN 2006 AND 2017 AND abs(w.fd - b.opp_pf) <= 2)::INTEGER AS fd_within2
  FROM play_team_game w JOIN team_game b USING (game_id, team_id)
  WHERE b.box_games = 1
  GROUP BY 1 ORDER BY 1`)

const ones = await read(`
  WITH f AS (
    SELECT season, count(*)::INTEGER AS ones FROM play_nba
    WHERE kind = 'free_throw' AND trim(subtype) = 'Free Throw 1 of 1' GROUP BY 1)
  SELECT f.season, f.ones, (SELECT sum(and1)::INTEGER FROM play_team_game t WHERE t.season = f.season) AS and1
  FROM f ORDER BY 1`)

const unmapped = await read(`
  SELECT season,
    count(*) FILTER (WHERE kind = 'turnover' AND tov = 1)::INTEGER AS tov,
    count(*) FILTER (WHERE kind = 'turnover' AND tov = 1
                       AND coalesce(trim(subtype), '') NOT IN (${tovSpelled}))::INTEGER AS tov_un,
    count(*) FILTER (WHERE pf = 1)::INTEGER AS pf,
    count(*) FILTER (WHERE pf = 1 AND coalesce(trim(subtype), '') NOT IN (${pfSpelled}))::INTEGER AS pf_un
  FROM play_nba GROUP BY 1 ORDER BY 1`)

const ejections = await read(`
  WITH e AS (
    SELECT g.game_id, pi.player_id, bool_or(TRY_CAST(b.ejected AS BOOLEAN)) AS ejected
    FROM src_espn_player_box b JOIN game g ON g.espn_game_id = b.game_id
    JOIN player_ids pi ON pi.espn_athlete_id = b.athlete_id
    WHERE b.season = b.file_season GROUP BY 1, 2)
  SELECT g.season,
    count(*) FILTER (WHERE e.ejected)::INTEGER AS espn,
    count(*) FILTER (WHERE coalesce(w.ejections, 0) > 0)::INTEGER AS plays,
    count(*) FILTER (WHERE e.ejected AND coalesce(w.ejections, 0) > 0)::INTEGER AS both
  FROM e JOIN game g USING (game_id)
  LEFT JOIN play_player_game w ON w.game_id = e.game_id AND w.player_id = e.player_id
  WHERE e.ejected OR coalesce(w.ejections, 0) > 0
  GROUP BY 1 ORDER BY 1`)

const margins = await read(`
  WITH last AS (
    SELECT game_id, arg_max(home_after - away_after, seq) AS m FROM play_nba
    WHERE pts > 0 GROUP BY 1)
  SELECT g.season, count(*)::INTEGER AS n,
    count(*) FILTER (WHERE l.m = b.pts - b.opp_pts)::INTEGER AS same
  FROM last l JOIN game g USING (game_id)
  JOIN team_game b ON b.game_id = g.game_id AND b.team_id = g.home_team_id
  WHERE b.box_games = 1 GROUP BY 1 ORDER BY 1`)

// 5. The flow recounted from the raw feed, apart from the builder.
const FLOW_SEASONS = [1997, 2003, 2009, 2015, 2021, 2026]
const flow = await read(`
  WITH raw AS (
    SELECT g.game_id, g.season, p.order_index,
           TRY_CAST(nullif(p.score_home, '') AS INTEGER) AS h,
           TRY_CAST(nullif(p.score_away, '') AS INTEGER) AS a
    FROM src_nba_pbp p JOIN game g ON g.nba_game_id = p.game_id
    WHERE g.season IN (${FLOW_SEASONS.join(', ')}) AND p.season = g.season
  ), states AS (
    SELECT game_id, season, order_index, h, a, h - a AS m FROM raw
    -- Before 2017-18 the feed writes 0-0 on rows that score nothing: a real 0-0 is only the tip.
    WHERE h IS NOT NULL AND a IS NOT NULL AND h + a > 0
    QUALIFY (h, a) IS DISTINCT FROM lag((h, a)) OVER (PARTITION BY game_id ORDER BY order_index)
  ), signed AS (
    SELECT game_id, sign(m) AS s,
           lag(sign(m)) OVER (PARTITION BY game_id ORDER BY order_index) AS before
    FROM states WHERE m <> 0
  ), recount AS (
    SELECT s.game_id, any_value(s.season) AS season,
           count(*) FILTER (WHERE s.m = 0)::INTEGER AS ties,
           greatest(0, max(s.m))::INTEGER AS home_lead, greatest(0, max(-s.m))::INTEGER AS away_lead,
           (SELECT count(*) FROM signed x WHERE x.game_id = s.game_id AND x.s <> x.before)::INTEGER AS changes
    FROM states s GROUP BY s.game_id
  )
  SELECT r.season, count(*)::INTEGER AS n,
    count(*) FILTER (WHERE t.lead_changes = r.changes)::INTEGER AS changes,
    count(*) FILTER (WHERE t.times_tied = r.ties)::INTEGER AS ties,
    count(*) FILTER (WHERE t.largest_lead = r.home_lead AND t.opp_largest_lead = r.away_lead)::INTEGER AS lead,
    list(r.game_id) FILTER (WHERE t.lead_changes <> r.changes OR t.times_tied <> r.ties
                             OR t.largest_lead <> r.home_lead)[1:3] AS misses
  FROM recount r JOIN game g USING (game_id)
  JOIN play_team_game t ON t.game_id = r.game_id AND t.team_id = g.home_team_id
  GROUP BY 1 ORDER BY 1`)

// 7. The reads, warm, median of five.
const median = async (f) => {
  await f()
  const times = []
  for (let i = 0; i < 5; i++) {
    const at = Date.now()
    await f()
    times.push(Date.now() - at)
  }
  return times.sort((a, b) => a - b)[2]
}
const busyTeam = (
  await read(`SELECT team_id FROM team_game WHERE season = 2026 AND game_type = 'regular' LIMIT 1`)
)[0]?.team_id
const busyPlayer = (
  await read(`SELECT player_id FROM player_game WHERE season = 2026 AND game_type = 'regular'
              GROUP BY 1 ORDER BY sum(ast) DESC LIMIT 1`)
)[0]?.player_id
const aGame = (
  await read(`SELECT game_id FROM game WHERE season = 2026 AND played AND game_type = 'regular'
              ORDER BY game_date DESC LIMIT 1`)
)[0]?.game_id
const scope = { gameTypes: ['regular'] }
const assistReq = (entity, id, seasons, s = scope) => ({
  request: { entity, id: String(id), seasons, scope: s }
})
const speeds = [
  [
    'A team’s assist network, a season',
    await median(() => call('assists', assistReq('team', busyTeam, [2026])))
  ],
  [
    'The same over January',
    await median(() =>
      call(
        'assists',
        assistReq('team', busyTeam, [2026], { ...scope, dates: ['2026-01-01', '2026-01-31'] })
      )
    )
  ],
  [
    'A player’s assists, a season',
    await median(() => call('assists', assistReq('player', busyPlayer, [2026])))
  ],
  [
    'A team’s assist network, ten seasons',
    await median(() =>
      call(
        'assists',
        assistReq('team', busyTeam, [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
      )
    )
  ],
  ['A game’s flow', await median(() => call('gameFlow', { game: aGame }))]
]
const engineSpeed = await median(() =>
  call('query', {
    query: {
      entity: 'player',
      metrics: ['pbp_tov_bad_pass', 'pbp_tov_live_share', 'pbp_and1', 'pbp_ast_pts', 'pbp_tech'],
      scope: { seasons: [2026] },
      transform: 'perGame',
      sort: { metric: 'pbp_ast_pts', dir: 'desc' },
      limit: 50
    }
  })
)
speeds.push(['A five-metric player leaderboard (engine)', engineSpeed])
await close()

out.push('## Turnovers and fouls against the box score', '')
out.push(
  'Kinds that do not add up to the total are counted as "sum ≠" (0 everywhere is the check). Team turnovers: the box score leaves out the team’s own (a shot-clock violation with no player), so the plays’ team total less those is compared; the column beside counts them in. Fouls: the gap is the box score’s fouls the feed has no row for, summed.',
  ''
)
out.push(
  ...table(
    [
      'Season',
      'Player-games',
      'Sum ≠',
      'TOV exact',
      'PF exact',
      'Team-games',
      'Sum ≠',
      'TOV exact',
      'TOV w/ team',
      'PF exact',
      'PF ±1',
      'PF gap',
      'Unmapped TOV',
      'Unmapped PF'
    ],
    players.map((p) => {
      const t = teams.find((x) => x.season === p.season) ?? {}
      const u = unmapped.find((x) => x.season === p.season) ?? {}
      return [
        label(p.season),
        p.n,
        n(p.tov_sum_bad) + n(p.pf_sum_bad),
        pct(p.tov_exact, p.n),
        pct(p.pf_exact, p.n),
        t.n,
        t.sum_bad,
        pct(t.tov_exact, t.n),
        pct(t.tov_with_team, t.n),
        pct(t.pf_exact, t.n),
        pct(t.pf_within1, t.n),
        `${t.pf_gap} of ${t.pf_box}`,
        `${u.tov_un} (${pct(u.tov_un, u.tov)} %)`,
        `${u.pf_un} (${pct(u.pf_un, u.pf)} %)`
      ]
    })
  )
)

out.push('## Assisted makes, and-ones and flow', '')
out.push(
  'Makes: player-games where assisted plus unassisted twos and threes differ from the plays’ makes (0 is the check). Assists: the scorers’ assisted makes against the box score’s team assists, and the passers’ against each player’s. Shots: player-games where the assisted makes equal the shot table’s `shots_ast` (the same flag through the shot file). And-ones: team-games with more and-ones than the other side’s shooting fouls (0 is the check), and the "1 of 1" free throws beside them. Time: team-games whose time leading, trailing and tied miss the game’s length by more than a tenth (0 is the check). Margin: games whose last scoring play’s margin equals the box score’s.',
  ''
)
out.push(
  ...table(
    [
      'Season',
      'Makes ≠',
      'Team AST exact',
      'Player AST exact',
      'Same as shots',
      'And-ones',
      'Converted',
      'Over shooting fouls',
      '"1 of 1" FTs',
      'Technicals',
      'Flagrants',
      'Time ≠',
      'Margin exact'
    ],
    players.map((p) => {
      const t = teams.find((x) => x.season === p.season) ?? {}
      const m = makes.find((x) => x.season === p.season) ?? {}
      const s = shotsAgree.find((x) => x.season === p.season) ?? {}
      const o = ones.find((x) => x.season === p.season) ?? {}
      const g = margins.find((x) => x.season === p.season) ?? {}
      return [
        label(p.season),
        m.bad,
        pct(t.ast_exact, t.n),
        pct(p.ast_exact, p.n),
        pct(s.same, s.n),
        t.and1,
        pct(t.and1_ftm, t.and1),
        t.and1_over,
        o.ones,
        t.tech,
        t.flagrant,
        t.time_bad,
        pct(g.same, g.n)
      ]
    })
  )
)

out.push('## Game flow recounted from the raw feed', '')
out.push(
  'Every game of six seasons: the raw `src_nba_pbp` score text carried as distinct score states, ties the states level after 0-0, lead changes the switches between non-zero signs, largest leads the extremes; against the home side’s row of `play_team_game`.',
  ''
)
out.push(
  ...table(
    ['Season', 'Games', 'Lead changes', 'Ties', 'Largest leads', 'First misses'],
    flow.map((f) => [
      label(f.season),
      f.n,
      pct(f.changes, f.n),
      pct(f.ties, f.n),
      pct(f.lead, f.n),
      (f.misses ?? []).join(', ') || '–'
    ])
  )
)

out.push('## Fouls drawn and ejections', '')
out.push(
  'Fouls drawn: ESPN’s, 2005-06 to 2016-17, a team’s summed against the other side’s box-score fouls. Ejections: player-games ESPN’s box score marks ejected, those the play by play records, and both.',
  ''
)
out.push(
  ...table(
    ['Season', 'FD exact', 'FD ±2', 'Ejected (ESPN)', 'Ejections (plays)', 'Both'],
    teams.map((t) => {
      const e = ejections.find((x) => x.season === t.season) ?? {}
      const fd = t.season >= 2006 && t.season <= 2017
      return [
        label(t.season),
        fd ? pct(t.fd_exact, t.n) : '–',
        fd ? pct(t.fd_within2, t.n) : '–',
        n(e.espn),
        n(e.plays),
        n(e.both)
      ]
    })
  )
)

out.push('## Reads, warm, median of five', '')
out.push(
  ...table(
    ['Read', 'ms'],
    speeds.map(([what, ms]) => [what, ms])
  )
)

const text = out.join('\n')
console.log(text)
if (mdFile) writeFileSync(mdFile, text)
