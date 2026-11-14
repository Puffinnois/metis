#!/usr/bin/env node
// Checks the box-score composites (Plan T1005) on a real load, through the built worker, and writes
// the report the data doc quotes. Per season and season type:
//
// 1. League PER: the minutes-weighted mean of every player's PER, which the method sets to 15.
// 2. Team Win Shares against the team's actual wins (regular season): the mean absolute gap.
// 3. Points produced summed over a team against the team's points: the ratio.
// 4. BPM's team adjustment: each team's players' BPM weighted by their share of the floor time,
//    against the team rating the method targets, recomputed here by SQL: net points per 100
//    possessions, plus the opponents' strength (T1001's SRS) and half the lead effect. Points are
//    the box score's, as the player lines: they fall short of the final score where a line is
//    missing (Minnesota's 34 games of 1994-95 without Darrick Martin's line).
// 5. VORP's identity: (BPM + 2) × share of the floor time × team games / 82 on every row.
// 6. Recounts by SQL written apart from the builder: every player's PER, points produced and
//    possessions used, from the box-score tables, against the stored values.
// 7. The reads' speed through the engine.
//
// Tolerance: identities and recounts within 1e-6 (doubles summed in another order); the gaps in
// 2 and 3 are measured, not judged.
//
// usage: node scripts/check-composites.mjs <folder holding stats.duckdb> [out.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-composites.mjs <folder> [out.md]')
  process.exit(2)
}

const { read, query, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const f = (x, d = 2) => (x === null || x === undefined ? '–' : Number(x).toFixed(d))
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map((_, i) => (i < 2 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  ''
]
const out = ['# Box-score composites: checks', '']
const problems = []

const C = [
  'fgm',
  'fga',
  'fg3m',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'pts'
]

// Team seasons with team turnovers, written apart from the builder: the NBA's play by play's team
// turnovers, ESPN's team box score's before 1996-97.
const TEAMS = `
  WITH tt AS (
    SELECT game_id, team_id, tov_team AS x FROM play_team_game
    UNION ALL
    SELECT g.game_id, CASE b.team_home_away WHEN 'home' THEN g.home_team_id ELSE g.away_team_id END,
           b.team_turnovers - b.turnovers
    FROM src_espn_team_box b JOIN game g ON g.espn_game_id = b.game_id
    WHERE b.season = b.file_season AND b.season < 1997 AND b.team_turnovers >= b.turnovers
  ), ts AS (
    SELECT t.season, t.game_type, t.team_id, count(*) AS g, sum(t.minutes) AS mp,
           ${C.map((c) => `sum(t.${c})::DOUBLE AS ${c}, sum(t.opp_${c})::DOUBLE AS o_${c}`).join(', ')},
           coalesce(sum(a.x), 0) AS tt, coalesce(sum(b.x), 0) AS o_tt
    FROM team_game t
    LEFT JOIN tt a ON a.game_id = t.game_id AND a.team_id = t.team_id
    LEFT JOIN tt b ON b.game_id = t.game_id AND b.team_id = t.opponent_id
    WHERE t.box_games = 1 AND t.game_type IN ('regular', 'playoffs')
    GROUP BY 1, 2, 3
  ), t2 AS (
    SELECT * REPLACE (tov + tt AS tov, o_tov + o_tt AS o_tov) FROM ts
  )
  SELECT *,
    0.5 * ((fga + 0.4 * fta - 1.07 * (oreb / (oreb + o_dreb)) * (fga - fgm) + tov)
         + (o_fga + 0.4 * o_fta - 1.07 * (o_oreb / (o_oreb + dreb)) * (o_fga - o_fgm) + o_tov)) AS poss
  FROM t2`

// 1, 2, 3: league PER, Win Shares against wins, points produced against points.
const per = await read(`
  SELECT p.season, p.game_type, sum(p.per_num) / sum(p.cmp_minutes) AS league_per, count(*) AS rows,
         count(DISTINCT p.player_id) AS players
  FROM player_composite p GROUP BY 1, 2 ORDER BY 1, 2`)
const teams = await read(`
  SELECT c.season, c.game_type, count(*) AS teams,
         avg(abs(c.ws - s.wins)) AS ws_gap, avg(c.ws - s.wins) AS ws_bias,
         sum(c.pprod) / sum(s.pts) AS pprod_ratio, min(c.pprod / s.pts) AS pprod_min,
         max(c.pprod / s.pts) AS pprod_max
  FROM team_composite c JOIN team_season s USING (season, game_type, team_id)
  GROUP BY 1, 2 ORDER BY 1, 2`)
const teamBy = new Map(teams.map((t) => [`${t.season}|${t.game_type}`, t]))

// 4: BPM's team identity.
const bpm = await read(`
  WITH teams AS (${TEAMS}),
  final AS (SELECT season, team_id, arg_max(srs, game_date) AS srs FROM team_strength GROUP BY 1, 2),
  sos AS (
    SELECT t.season, t.game_type, t.team_id, avg(f.srs) AS sos
    FROM team_game t JOIN final f ON f.season = t.season AND f.team_id = t.opponent_id
    WHERE t.box_games = 1 AND t.game_type IN ('regular', 'playoffs') GROUP BY 1, 2, 3
  ), target AS (
    SELECT t.season, t.game_type, t.team_id, t.mp,
           100 * (t.pts - t.o_pts) / t.poss + 0.175 * (0.5 * (t.pts - t.o_pts) / t.g)
             + 100 * coalesce(s.sos, 0) * t.g / t.poss AS rating
    FROM teams t LEFT JOIN sos s USING (season, game_type, team_id)
  ), players AS (
    SELECT p.season, p.game_type, p.team_id,
           sum(p.cmp_minutes / (t.mp / 5) * p.bpm_num / p.cmp_minutes) AS weighted
    FROM player_composite p JOIN target t USING (season, game_type, team_id)
    WHERE p.cmp_minutes > 0 GROUP BY 1, 2, 3
  )
  SELECT t.season, t.game_type, count(*) AS teams, max(abs(p.weighted - t.rating)) AS worst,
         min(t.rating) AS low, max(t.rating) AS high
  FROM target t JOIN players p USING (season, game_type, team_id)
  GROUP BY 1, 2 ORDER BY 1, 2`)
const bpmBy = new Map(bpm.map((t) => [`${t.season}|${t.game_type}`, t]))

// 5: VORP's identity.
const vorp = await read(`
  WITH tm AS (
    SELECT season, game_type, team_id, sum(minutes) AS mp, count(*) AS g FROM team_game
    WHERE box_games = 1 AND game_type IN ('regular', 'playoffs') GROUP BY 1, 2, 3
  )
  SELECT p.season, p.game_type,
         max(abs(p.vorp - (p.bpm_num / p.cmp_minutes + 2) * (p.cmp_minutes / (tm.mp / 5)) * tm.g / 82))
           AS worst
  FROM player_composite p JOIN tm USING (season, game_type, team_id)
  WHERE p.cmp_minutes > 0 GROUP BY 1, 2 ORDER BY 1, 2`)
const vorpBy = new Map(vorp.map((t) => [`${t.season}|${t.game_type}`, t]))

// 6: PER, points produced and possessions used recounted by SQL.
const recount = await read(`
  WITH teams AS (${TEAMS}),
  t AS (SELECT *, 48 * poss / (mp / 5) AS pace FROM teams),
  l AS (
    SELECT season, game_type, ${C.map((c) => `sum(${c}) AS ${c}`).join(', ')}, sum(mp) AS mp,
           sum(poss) AS poss
    FROM t GROUP BY 1, 2
  ), lc AS (
    SELECT *, 48 * poss / (mp / 5) AS pace,
           2 / 3 - (0.5 * (ast / fgm)) / (2 * (fgm / ftm)) AS factor,
           pts / (fga - oreb + tov + 0.44 * fta) AS vop,
           dreb / (oreb + dreb) AS drbp
    FROM l
  ), p AS (
    SELECT season, game_type, player_id, team_id, sum(minutes) AS mp,
           ${C.map((c) => `sum(${c})::DOUBLE AS ${c}`).join(', ')}
    FROM player_game WHERE game_type IN ('regular', 'playoffs')
    GROUP BY 1, 2, 3, 4 HAVING sum(minutes) > 0
  ), a AS (
    SELECT p.*, t.pace AS tpace, lc.pace AS lpace,
      (p.fg3m + (2 / 3) * p.ast + (2 - lc.factor * (t.ast / t.fgm)) * p.fgm
       + p.ftm * 0.5 * (2 - (t.ast / t.fgm) / 3) - lc.vop * p.tov
       - lc.vop * lc.drbp * (p.fga - p.fgm)
       - lc.vop * 0.44 * (0.44 + 0.56 * lc.drbp) * (p.fta - p.ftm)
       + lc.vop * (1 - lc.drbp) * p.dreb + lc.vop * lc.drbp * p.oreb + lc.vop * p.stl
       + lc.vop * lc.drbp * p.blk
       - p.pf * (lc.ftm / lc.pf - 0.44 * (lc.fta / lc.pf) * lc.vop)) / p.mp * lc.pace / t.pace AS aper,
      -- Oliver: the team's parts first.
      t.fgm + (1 - (1 - t.ftm / t.fta) ** 2) * t.fta * 0.4 AS tsc,
      t.oreb / (t.oreb + t.o_dreb) AS torb,
      t.ast AS tast, t.fgm AS tfgm, t.fga AS tfga, t.pts AS tpts, t.ftm AS tftm, t.fg3m AS tfg3m,
      t.fta AS tfta, t.tov AS ttov, t.oreb AS toreb, t.mp AS tmp
    FROM p JOIN t USING (season, game_type, team_id) JOIN lc USING (season, game_type)
  ), o AS (
    SELECT *, tsc / (tfga + tfta * 0.4 + ttov) AS tplay,
      (mp / (tmp / 5)) * 1.14 * ((tast - ast) / tfgm)
        + ((tast / tmp) * mp * 5 - ast) / nullif((tfgm / tmp) * mp * 5 - fgm, 0) * (1 - mp / (tmp / 5)) AS qast
    FROM a
  ), o2 AS (
    SELECT *, ((1 - torb) * tplay) / ((1 - torb) * tplay + torb * (1 - tplay)) AS w,
      coalesce(1 - 0.5 * ((pts - ftm) / nullif(2 * fga, 0)) * qast, 0) AS kept,
      ((tpts - tftm) - (pts - ftm)) / (2 * (tfga - fga)) AS passed
    FROM o
  ), o3 AS (
    SELECT *, 1 - (toreb / tsc) * w * tplay AS cut,
      coalesce((1 - (1 - ftm / nullif(fta, 0)) ** 2) * 0.4 * fta, 0) AS ftpart
    FROM o2
  ), mine AS (
    SELECT season, game_type, player_id, team_id, aper, mp,
      (fgm * kept + 0.5 * passed * ast + ftpart) * cut + oreb * w * tplay
        + (fga - fgm) * (1 - 1.07 * torb)
        + coalesce((1 - ftm / nullif(fta, 0)) ** 2 * 0.4 * fta, 0) + tov AS totposs,
      (2 * (fgm + 0.5 * fg3m) * kept
        + 2 * ((tfgm - fgm + 0.5 * (tfg3m - fg3m)) / (tfgm - fgm)) * 0.5 * passed * ast + ftm) * cut
        + oreb * w * tplay * (tpts / tsc) AS pprod
    FROM o3
  ), scaled AS (
    SELECT *, 15 * aper / (sum(aper * mp) OVER (PARTITION BY season, game_type)
                           / sum(mp) OVER (PARTITION BY season, game_type)) AS per
    FROM mine
  )
  SELECT s.season, s.game_type, count(*) AS rows,
         max(abs(s.per - c.per_num / c.cmp_minutes)) AS per_worst,
         max(abs(s.pprod - c.pprod)) AS pprod_worst,
         max(abs(s.totposs - c.tot_poss)) AS poss_worst
  FROM scaled s JOIN player_composite c USING (season, game_type, player_id, team_id)
  GROUP BY 1, 2 ORDER BY 1, 2`)
const recountBy = new Map(recount.map((t) => [`${t.season}|${t.game_type}`, t]))

const rows = []
for (const r of per) {
  const key = `${r.season}|${r.game_type}`
  const t = teamBy.get(key) ?? {}
  const b = bpmBy.get(key) ?? {}
  const v = vorpBy.get(key) ?? {}
  const rc = recountBy.get(key) ?? {}
  rows.push([
    label(r.season),
    r.game_type,
    r.players,
    f(r.league_per, 3),
    t.teams ?? '–',
    r.game_type === 'regular' ? f(t.ws_gap, 2) : '–',
    r.game_type === 'regular' ? f(t.ws_bias, 2) : '–',
    `${f(t.pprod_ratio, 3)} (${f(t.pprod_min, 3)}–${f(t.pprod_max, 3)})`,
    f(b.worst, 9),
    f(v.worst, 9),
    `${f(rc.per_worst, 9)} / ${f(rc.pprod_worst, 6)} / ${f(rc.poss_worst, 6)}`
  ])
  if (Math.abs(r.league_per - 15) > 1e-6) problems.push(`${key}: league PER ${r.league_per}`)
  if (!(b.worst < 1e-6)) problems.push(`${key}: BPM identity off by ${b.worst}`)
  if (!(v.worst < 1e-6)) problems.push(`${key}: VORP identity off by ${v.worst}`)
  if (!(rc.per_worst < 1e-6 && rc.pprod_worst < 1e-6 && rc.poss_worst < 1e-6)) {
    problems.push(`${key}: recount off (${rc.per_worst}, ${rc.pprod_worst}, ${rc.poss_worst})`)
  }
}
out.push(
  '## Per season',
  '',
  'League PER: the minutes-weighted mean of PER over every line. WS − wins: the mean absolute gap between team Win Shares and actual wins, and its mean sign. PProd / points: points produced summed over the team against its points, the league and the lowest and highest team. BPM and VORP: the worst row off its identity. Recount: the worst player-team row of PER, points produced and possessions used recounted by SQL apart from the builder.',
  '',
  ...table(
    [
      'Season',
      'Type',
      'Players',
      'League PER',
      'Teams',
      '|WS − wins|',
      'WS − wins',
      'PProd / points',
      'BPM identity',
      'VORP identity',
      'Recount PER / PProd / TotPoss'
    ],
    rows
  )
)

// 7: speed through the engine.
const time = async (name, q) => {
  const runs = []
  for (let i = 0; i < 5; i++) {
    const at = Date.now()
    await query(q)
    runs.push(Date.now() - at)
  }
  runs.sort((a, b) => a - b)
  return [name, runs[0], runs[2], runs[4]]
}
const family = [
  'per',
  'ows',
  'dws',
  'ws',
  'ws_48',
  'bpm',
  'obpm',
  'dbpm',
  'vorp',
  'ortg_ind',
  'drtg_ind',
  'pprod'
]
const speed = [
  await time('Preset leaderboard, 2025-26', {
    entity: 'player',
    metrics: family,
    scope: { seasons: [2026] },
    limit: 100
  }),
  await time('Preset leaderboard, 1995-96', {
    entity: 'player',
    metrics: family,
    scope: { seasons: [1996] },
    limit: 100
  }),
  await time('Every season, by season, every player', {
    entity: 'player',
    metrics: ['per', 'ws', 'bpm', 'vorp'],
    scope: { seasons: Array.from({ length: 34 }, (_, i) => 1994 + i) },
    groupBy: ['season'],
    limit: 5000
  }),
  await time('A career total (LeBron James)', {
    entity: 'player',
    metrics: family,
    scope: { seasons: Array.from({ length: 24 }, (_, i) => 2004 + i), players: ['2544'] }
  }),
  await time('Teams, 2025-26', {
    entity: 'team',
    metrics: ['team_ws', 'team_ows', 'team_dws', 'team_vorp', 'team_pprod'],
    scope: { seasons: [2026] }
  })
]
out.push('## Speed', '', 'Through the engine, five runs: fastest, median, slowest (ms).', '')
out.push(...table(['Read', 'Fastest', 'Median', 'Slowest'], speed))

out.push(
  '## Problems',
  '',
  problems.length ? problems.map((p) => `- ${p}`).join('\n') : 'No problems.',
  ''
)
const text = out.join('\n')
if (mdFile) writeFileSync(mdFile, text)
console.log(text)
await close()
