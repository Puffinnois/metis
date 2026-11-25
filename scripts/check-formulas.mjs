#!/usr/bin/env node
// Checks the formulas of T1703.3's first PR on a real load (how a check counts: stats-database.md,
// "Measuring a real load"): every player-season and team-season of every season the file holds, worked
// here from the game rows (`player_game`, `team_game`, `player_on_court`, the dashboards' own rows),
// apart from the engine's SQL, against the engine's answer. Read only, through the built worker.
// Every season's regular season for the NBA and WNBA, every counted type for the colleges, as a screen
// asks. Each value is equal (1e-9), differing, blank (a row with no value) or with no row; the league's
// value is its own sums over the same rows, the Division I pool in the colleges.
// usage: node scripts/check-formulas.mjs <folder> --league=nba|wnba|ncaam|ncaaw [--season=2026]
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional().filter((a) => !a.startsWith('--season='))
const league = leagueArg()
if (!folder) {
  console.error('usage: node scripts/check-formulas.mjs <folder> --league=nba|wnba|ncaam|ncaaw')
  process.exit(1)
}
const only = process.argv.find((a) => a.startsWith('--season='))?.slice('--season='.length)
const { read, query, close } = openStatsWorker(folder, { league })
const college = league.startsWith('ncaa')
const num = (x) => (x === null || x === undefined ? null : Number(x))
const list = (xs) => xs.map((x) => `'${x}'`).join(', ')

const tally = () => ({
  source: 0,
  equal: 0,
  differ: 0,
  blank: 0,
  absent: 0,
  extra: 0,
  off: [],
  nowhere: []
})
const all = new Map()
let madeKeys = 0
function value(name, key, built, source, hasRow) {
  if (!all.has(name)) all.set(name, tally())
  const t = all.get(name)
  if (source === null || Number.isNaN(source)) {
    if (hasRow && built !== null) t.extra++
    return
  }
  t.source++
  if (!hasRow) {
    t.absent++
    if (t.nowhere.length < 3) t.nowhere.push(key)
  } else if (built === null) {
    t.blank++
    if (t.nowhere.length < 3) t.nowhere.push(`${key} (blank)`)
  } else if (Math.abs(built - source) <= 1e-9 * Math.max(1, Math.abs(source))) t.equal++
  else {
    t.differ++
    if (t.off.length < 6) t.off.push(`${key}: engine ${built}, worked ${source}`)
  }
}

const seasons = (await read('SELECT DISTINCT season AS s FROM player_game ORDER BY 1'))
  .map((r) => Number(r.s))
  .filter((s) => only === undefined || s === Number(only))
const types = college
  ? (
      await read(
        "SELECT DISTINCT game_type AS t FROM player_game WHERE game_type NOT IN ('all-star', 'preseason')"
      )
    ).map((r) => r.t)
  : ['regular']
const typeSql = `game_type IN (${list(types)})`
console.log(
  `${league}: seasons ${seasons[0]} to ${seasons.at(-1)}, season types ${types.join(', ')}`
)

const ts = (r, p = '') => r[`${p}pts`] / (2 * (r[`${p}fga`] + 0.44 * r[`${p}fta`]))
const efg = (r, p = '') => (r[`${p}fgm`] + 0.5 * r[`${p}fg3m`]) / r[`${p}fga`]
const tsw = (r, p = '') => 2 * (r[`${p}fga`] + 0.44 * r[`${p}fta`])
const COUNTS = ['fgm', 'fga', 'fg3m', 'ftm', 'fta', 'pts']
const sumOf = (rows, cols) =>
  Object.fromEntries(cols.map((c) => [c, rows.reduce((s, r) => s + (r[c] ?? 0), 0)]))

for (const season of seasons) {
  // Who is in the pool: every player (NBA, WNBA), or the Division I rows (the colleges).
  const divisionI = college
    ? new Set(
        (await read(`SELECT team_id FROM team WHERE season = ${season} AND division_i`)).map((r) =>
          String(r.team_id)
        )
      )
    : null
  const inPool = (team) => divisionI === null || divisionI.has(String(team))
  const lines = (
    await read(
      `SELECT player_id, team_id, ${COUNTS.map((c) => `sum(${c})::DOUBLE AS ${c}`).join(', ')}, sum(seconds)::DOUBLE AS seconds, count(DISTINCT game_id)::INTEGER AS games,
              sum(ast)::DOUBLE AS ast, sum(tov)::DOUBLE AS tov, sum(x_ast_den)::DOUBLE AS x_ast_den, sum(x_usg_den)::DOUBLE AS x_usg_den
       FROM player_game WHERE season = ${season} AND ${typeSql} GROUP BY 1, 2`
    )
  ).map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        ['player_id', 'team_id'].includes(k) ? String(v) : num(v)
      ])
    )
  )
  // Minutes over the team's, in the games a line is in, from the team's own row.
  const teamSeconds = new Map(
    (
      await read(
        `SELECT b.player_id, sum(t.seconds)::DOUBLE AS s FROM player_game b JOIN team_game t ON t.game_id = b.game_id AND t.team_id = b.team_id
         WHERE b.season = ${season} AND b.${typeSql} GROUP BY 1`
      )
    ).map((r) => [String(r.player_id), num(r.s)])
  )
  const lastTeam = new Map(
    (
      await read(
        `SELECT player_id, arg_max(team_id, (game_date, game_id)) AS t FROM player_game WHERE season = ${season} AND ${typeSql} GROUP BY 1`
      )
    ).map((r) => [String(r.player_id), String(r.t)])
  )
  const boxGames = new Map(
    (
      await read(
        `SELECT team_id, count(*) FILTER (WHERE fga IS NOT NULL)::INTEGER AS n FROM team_game WHERE season = ${season} AND ${typeSql} GROUP BY 1`
      )
    ).map((r) => [String(r.team_id), num(r.n)])
  )
  const players = new Map()
  for (const l of lines) {
    const p = players.get(l.player_id) ?? { teams: new Set(), rows: [] }
    p.teams.add(l.team_id)
    p.rows.push(l)
    players.set(l.player_id, p)
  }
  const cols = [...COUNTS, 'seconds', 'games', 'ast', 'tov', 'x_ast_den', 'x_usg_den']
  const total = new Map()
  for (const [id, p] of players) total.set(id, sumOf(p.rows, cols))
  // The league's own sums: the players whose last team is in the pool.
  const pool = [...total].filter(([id]) => inPool(lastTeam.get(id))).map(([, r]) => r)
  const lg = sumOf(pool, COUNTS)
  const lgTs = ts(lg)
  const lgEfg = efg(lg)
  // The engine's, naming the players 60 at a time, so a college's rows of any division are read.
  // A key made for a player in no map (D28) is too long for a query's player filter: counted, not asked.
  const ids = [...total.keys()].filter((id) => Math.abs(Number(id)) < 2 ** 31)
  const made = total.size - ids.length
  const metrics = [
    'rts_pct',
    'refg_pct',
    'ts_add',
    'fg_add',
    'ast_usg_ratio',
    'min_share',
    'gp_share'
  ]
  const got = new Map()
  for (let i = 0; i < ids.length; i += 60) {
    const res = await query({
      entity: 'player',
      metrics,
      scope: { seasons: [season], gameTypes: types, players: ids.slice(i, i + 60) },
      transform: 'raw',
      limit: 200
    })
    for (const r of res.rows) got.set(String(r.id), r)
  }
  for (const id of ids) {
    const r = total.get(id)
    const g = got.get(id)
    const of = (m) => num(g?.values[m]?.value)
    const has = g !== undefined
    const tag = `${season} ${id}`
    const t = tsw(r) > 0 ? ts(r) : null
    const e = r.fga > 0 ? efg(r) : null
    value('rTS%', tag, of('rts_pct'), t === null ? null : t - lgTs, has)
    value('reFG%', tag, of('refg_pct'), e === null ? null : e - lgEfg, has)
    value('TS Add', tag, of('ts_add'), r.pts - tsw(r) * lgTs, has)
    value('FG Add', tag, of('fg_add'), 2 * r.fgm + r.fg3m - 2 * r.fga * lgEfg, has)
    const usg = r.x_usg_den !== 0 ? (r.fga + 0.44 * r.fta + r.tov) / r.x_usg_den : null
    const ast = r.x_ast_den !== 0 ? r.ast / r.x_ast_den : null
    value('AST:USG', tag, of('ast_usg_ratio'), ast === null || !usg ? null : ast / usg, has)
    const ts2 = teamSeconds.get(id)
    value('Minutes share', tag, of('min_share'), ts2 > 0 ? r.seconds / (ts2 / 5) : null, has)
    const games = Math.max(...[...players.get(id).teams].map((x) => boxGames.get(x) ?? 0))
    value('Games share', tag, of('gp_share'), games > 0 ? r.games / games : null, has)
  }

  // Teams and opponents.
  const teamLines = (
    await read(
      `SELECT team_id, ${COUNTS.map((c) => `sum(${c})::DOUBLE AS ${c}, sum(opp_${c})::DOUBLE AS opp_${c}`).join(', ')} FROM team_game WHERE season = ${season} AND ${typeSql} GROUP BY 1`
    )
  ).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'team_id' ? String(v) : num(v)]))
  )
  const teamPool = teamLines.filter((r) => inPool(r.team_id))
  const tl = sumOf(teamPool, COUNTS)
  const ol = sumOf(
    teamPool,
    COUNTS.map((c) => `opp_${c}`)
  )
  const tm = [
    ['team_', '', tl],
    ['opp_', 'opp_', ol]
  ]
  const teamIds = teamLines.map((r) => r.team_id)
  const tMetrics = ['rts_pct', 'refg_pct', 'ts_add', 'fg_add'].flatMap((m) => [
    `team_${m}`,
    `opp_${m}`
  ])
  const tGot = new Map()
  for (let i = 0; i < teamIds.length; i += 60) {
    const res = await query({
      entity: 'team',
      metrics: tMetrics,
      scope: { seasons: [season], gameTypes: types, teams: teamIds.slice(i, i + 60) },
      transform: 'raw',
      limit: 200
    })
    for (const r of res.rows) tGot.set(String(r.id), r)
  }
  // The colleges name teams of any division: the league the engine reads is Division I's all the same.
  for (const r of teamLines) {
    const g = tGot.get(r.team_id)
    for (const [pre, p, lgr] of tm) {
      const of = (m) => num(g?.values[`${pre}${m}`]?.value)
      const pick = (k) => r[`${p}${k}`]
      const l = {
        pts: lgr[`${p}pts`],
        fga: lgr[`${p}fga`],
        fta: lgr[`${p}fta`],
        fgm: lgr[`${p}fgm`],
        fg3m: lgr[`${p}fg3m`]
      }
      const row = {
        pts: pick('pts'),
        fga: pick('fga'),
        fta: pick('fta'),
        fgm: pick('fgm'),
        fg3m: pick('fg3m')
      }
      const key = `${season} ${r.team_id} ${pre}`
      const t = row.fga > 0 ? ts(row) : null
      value(`${pre}rTS%`, key, of('rts_pct'), t === null ? null : t - ts(l), g !== undefined)
      value(
        `${pre}reFG%`,
        key,
        of('refg_pct'),
        row.fga > 0 ? efg(row) - efg(l) : null,
        g !== undefined
      )
      value(
        `${pre}TS Add`,
        key,
        of('ts_add'),
        row.fga > 0 ? row.pts - tsw(row) * ts(l) : null,
        g !== undefined
      )
      value(
        `${pre}FG Add`,
        key,
        of('fg_add'),
        row.fga > 0 ? 2 * row.fgm + row.fg3m - 2 * row.fga * efg(l) : null,
        g !== undefined
      )
    }
  }

  // On court, from the built table's own rows.
  const onc = new Map(
    (
      await read(
        `SELECT player_id, sum(on_pts)::DOUBLE AS p, sum(on_opp_pts)::DOUBLE AS o FROM player_on_court WHERE season = ${season} AND ${typeSql} GROUP BY 1`
      )
    ).map((r) => [String(r.player_id), [num(r.p), num(r.o)]])
  )
  const oIds = [...onc.keys()].filter((id) => Math.abs(Number(id)) < 2 ** 31)
  for (let i = 0; i < oIds.length; i += 60) {
    const chunk = oIds.slice(i, i + 60)
    const res = await query({
      entity: 'player',
      metrics: ['onc_pts', 'onc_opp_pts'],
      scope: { seasons: [season], gameTypes: types, players: chunk },
      transform: 'raw',
      limit: 200
    })
    const rows = new Map(res.rows.map((r) => [String(r.id), r]))
    for (const id of chunk) {
      const r = rows.get(id)
      value(
        'On-court points for',
        `${season} ${id}`,
        num(r?.values.onc_pts?.value),
        onc.get(id)[0],
        r !== undefined
      )
      value(
        'On-court points against',
        `${season} ${id}`,
        num(r?.values.onc_opp_pts?.value),
        onc.get(id)[1],
        r !== undefined
      )
    }
  }

  // Second-chance share, from the dashboards' own rows over the box score's points.
  if (!college) {
    const misc = await read(
      `SELECT player_id, sum(pts_2_nd_chance)::DOUBLE AS sc FROM src_dash_player_stats_misc WHERE season = ${season} AND lower(season_type) = 'regular season' GROUP BY 1`
    ).catch(() => [])
    const res = new Map()
    const mIds = misc.map((r) => String(r.player_id))
    for (let i = 0; i < mIds.length; i += 60) {
      const a = await query({
        entity: 'player',
        metrics: ['nba_pts_2_nd_chance_share'],
        scope: { seasons: [season], players: mIds.slice(i, i + 60) },
        transform: 'raw',
        limit: 200
      })
      for (const r of a.rows) res.set(String(r.id), r)
    }
    for (const r of misc) {
      const id = String(r.player_id)
      const pts = total.get(id)?.pts
      const g = res.get(id)
      value(
        'Second-chance share',
        `${season} ${id}`,
        num(g?.values.nba_pts_2_nd_chance_share?.value),
        pts > 0 && r.sc !== null ? num(r.sc) / pts : null,
        g !== undefined
      )
    }
  }
  const t = all.get('rTS%')
  madeKeys += made
  console.log(`  ${season}: rTS% so far ${t.source} values, ${t.equal} equal, ${t.differ} differ`)
}
console.log(`player-seasons with a made key, in the league's sums and not asked: ${madeKeys}`)
for (const [name, t] of all) {
  console.log(
    `${name}: values ${t.source}: equal ${t.equal}, differ ${t.differ}, blank ${t.blank}, no row ${t.absent}; engine value with none worked ${t.extra}`
  )
  for (const o of t.off) console.log(`    differs: ${o}`)
  for (const o of t.nowhere) console.log(`    not there: ${o}`)
}
await close()
