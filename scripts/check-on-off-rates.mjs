#!/usr/bin/env node
// Checks the team's and the opponents' rates on and off the floor and on less off (T1703.3, audit entry
// 275) on a real load (how a check counts: stats-database.md, "Measuring a real load"). Read only, through
// the built worker. Two parts, every season the file holds:
//
// 1. What the two sides of the floor hold, every player-game: on plus off against the team's box score
//    (points, shots, threes, free throws, both teams' sides) and against the players' box-score lines summed
//    (turnovers, rebounds); then those two with the plays that name no player, against the team's box score:
//    what is left out must be what is credited to the team.
// 2. Every rate of every player-season, through the engine, against the same rate worked here from
//    `unit_game` alone (a player's units, and the team's other units in the games they were in), apart from
//    `player_on_court` and from the engine's SQL.
//
// Every counted season type for the colleges, the regular season for the NBA and WNBA, as a screen asks.
// usage: node scripts/check-on-off-rates.mjs <folder> --league=nba|wnba|ncaam|ncaaw [--season=2026]
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional().filter((a) => !a.startsWith('--season='))
const league = leagueArg()
if (!folder) {
  console.error('usage: node scripts/check-on-off-rates.mjs <folder> --league=nba|wnba|ncaam|ncaaw')
  process.exit(1)
}
const only = process.argv.find((a) => a.startsWith('--season='))?.slice('--season='.length)
const { read, query, close } = openStatsWorker(folder, { league })
const college = league.startsWith('ncaa')
const num = (x) => (x === null || x === undefined ? null : Number(x))

const seasons = (await read('SELECT DISTINCT season AS s FROM unit_game ORDER BY 1'))
  .map((r) => Number(r.s))
  .filter((s) => only === undefined || s === Number(only))
const types = college
  ? (
      await read(
        "SELECT DISTINCT game_type AS t FROM player_game WHERE game_type NOT IN ('all-star', 'preseason')"
      )
    ).map((r) => r.t)
  : ['regular']
const typeSql = `game_type IN (${types.map((t) => `'${t}'`).join(', ')})`
console.log(
  `${league}: seasons ${seasons[0]} to ${seasons.at(-1)}, season types ${types.join(', ')}`
)
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(2)} %` : 'none')

// ── 1. On plus off, against the box score ────────────────────────────────────────────────────────

const sums = {}
const add = (name, n, eq, season) => {
  const t = (sums[name] ??= { n: 0, eq: 0, low: [1, null] })
  t.n += n
  t.eq += eq
  if (n && eq / n < t.low[0]) t.low = [eq / n, season]
}
const ROW = ['pts', 'fga', 'fg3a', 'fta']
const PEOPLE = ['tov', 'oreb', 'dreb']
for (const season of seasons) {
  const [r] = await read(
    `WITH o AS (SELECT game_id, team_id, opponent_id, player_id, ${[...ROW, ...PEOPLE].flatMap((c) => [`on_${c} + off_${c} AS ${c}`, `on_opp_${c} + off_opp_${c} AS opp_${c}`]).join(', ')}
                FROM player_on_court WHERE season = ${season} AND ${typeSql}),
     p AS (SELECT game_id, team_id, ${PEOPLE.map((c) => `sum(${c}) AS ${c}`).join(', ')} FROM player_game WHERE season = ${season} GROUP BY 1, 2),
     q AS (SELECT game_id, team_id, ${PEOPLE.map((c) => `count(*) FILTER (WHERE ${c} AND player_id IS NULL) AS ${c}`).join(', ')} FROM play_nba WHERE season = ${season} GROUP BY 1, 2)
     SELECT count(*)::INTEGER AS n, ${ROW.flatMap((c) => [
       `count(*) FILTER (WHERE o.${c} = t.${c})::INTEGER AS eq_${c}`,
       `count(*) FILTER (WHERE o.opp_${c} = t.opp_${c})::INTEGER AS eqo_${c}`
     ]).join(', ')}, ${PEOPLE.flatMap((c) => [
       `count(*) FILTER (WHERE o.${c} = p.${c})::INTEGER AS eq_${c}`,
       `count(*) FILTER (WHERE o.opp_${c} = po.${c})::INTEGER AS eqo_${c}`,
       `count(*) FILTER (WHERE o.${c} + coalesce(q.${c}, 0) = t.${c})::INTEGER AS team_${c}`,
       `sum(o.${c})::DOUBLE AS sum_${c}`,
       `sum(t.${c})::DOUBLE AS box_${c}`
     ]).join(', ')}
     FROM o JOIN team_game t USING (game_id, team_id)
     LEFT JOIN p ON p.game_id = o.game_id AND p.team_id = o.team_id
     LEFT JOIN p po ON po.game_id = o.game_id AND po.team_id = o.opponent_id
     LEFT JOIN q ON q.game_id = o.game_id AND q.team_id = o.team_id
     WHERE t.fga IS NOT NULL`
  )
  const n = num(r.n)
  for (const c of ROW) {
    add(`${c}, the team's, against the box`, n, num(r[`eq_${c}`]), season)
    add(`${c}, the opponents', against the box`, n, num(r[`eqo_${c}`]), season)
  }
  for (const c of PEOPLE) {
    add(`${c}, the team's, against the players' lines summed`, n, num(r[`eq_${c}`]), season)
    add(`${c}, the opponents', against the players' lines summed`, n, num(r[`eqo_${c}`]), season)
    add(`${c}, with the plays that name no player, against the box`, n, num(r[`team_${c}`]), season)
    const t = (sums[`${c} held of the box`] ??= { a: 0, b: 0 })
    t.a += num(r[`sum_${c}`]) ?? 0
    t.b += num(r[`box_${c}`]) ?? 0
  }
}
console.log('\n1. On plus off, every player-game')
for (const [name, t] of Object.entries(sums)) {
  if ('a' in t) console.log(`  ${name}: ${pct(t.a, t.b)}`)
  else
    console.log(
      `  ${name}: ${t.eq.toLocaleString('en')} of ${t.n.toLocaleString('en')} (${pct(t.eq, t.n)}), lowest season ${t.low[1] ?? '-'} ${(100 * t.low[0]).toFixed(1)} %`
    )
}

// ── 2. Every rate through the engine ─────────────────────────────────────────────────────────────

const tally = () => ({
  source: 0,
  equal: 0,
  differ: 0,
  blank: 0,
  absent: 0,
  extra: 0,
  off: []
})
const all = new Map()
const note = (name, key, built, source, hasRow) => {
  if (!all.has(name)) all.set(name, tally())
  const t = all.get(name)
  if (source === null || !Number.isFinite(source)) {
    if (hasRow && built !== null) t.extra++
    return
  }
  t.source++
  if (!hasRow) t.absent++
  else if (built === null) t.blank++
  else if (Math.abs(built - source) <= 1e-9 * Math.max(1, Math.abs(source))) t.equal++
  else {
    t.differ++
    if (t.off.length < 4) t.off.push(`${key}: engine ${built}, worked ${source}`)
  }
}

const div = (a, b) => (b ? a / b : null)
// The rates, of a line and the other team's: [name of the id, formula].
const RATES = {
  efg_pct: (o) => div(o.fgm + 0.5 * o.fg3m, o.fga),
  ts_pct: (o) => div(o.pts, 2 * (o.fga + 0.44 * o.fta)),
  fg3a_rate: (o) => div(o.fg3a, o.fga),
  fta_rate: (o) => div(o.fta, o.fga),
  tov_pct: (o) => div(o.tov, o.poss),
  orb_pct: (o, x) => div(o.oreb, o.oreb + x.dreb),
  drb_pct: (o, x) => div(o.dreb, o.dreb + x.oreb),
  trb_pct: (o, x) => div(o.oreb + o.dreb, o.oreb + o.dreb + x.oreb + x.dreb)
}
const TEAM_ID = {
  tov_pct: 'tm_tov_pct',
  orb_pct: 'tm_orb_pct',
  drb_pct: 'tm_drb_pct',
  trb_pct: 'tm_trb_pct'
}
const OPP = ['efg_pct', 'ts_pct', 'fg3a_rate', 'fta_rate', 'tov_pct']
const IDS = [
  ...Object.keys(RATES).map((r) => [r, 'team', TEAM_ID[r] ?? r]),
  ...OPP.map((r) => [r, 'opp', `opp_${r}`])
]
const metrics = IDS.flatMap(([, , id]) => [`onc_${id}`, `offc_${id}`, `onoff_${id}`])
const COUNTS = ['poss', 'pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'fta', 'oreb', 'dreb', 'tov']
const COLS = [...COUNTS, ...COUNTS.map((c) => `opp_${c}`)]

let made = 0
let unlined = 0
for (const season of seasons) {
  const rows = await read(
    `WITH u AS (SELECT * FROM unit_game WHERE season = ${season} AND ${typeSql}),
     t AS (SELECT game_id, team_id, ${COLS.map((c) => `sum(${c}) AS ${c}`).join(', ')} FROM u GROUP BY 1, 2),
     o AS (SELECT game_id, game_type, team_id, player_id, ${COLS.map((c) => `sum(${c}) AS ${c}`).join(', ')}
           FROM (SELECT *, unnest([p1, p2, p3, p4, p5]) AS player_id FROM u) WHERE player_id IS NOT NULL GROUP BY 1, 2, 3, 4),
     -- A screen sums the season types a player has a box-score line in, so this does too.
     b AS (SELECT DISTINCT game_type, player_id FROM player_game WHERE season = ${season} AND ${typeSql})
     SELECT o.player_id, ${COLS.map((c) => `sum(o.${c})::DOUBLE AS on_${c}, sum(t.${c} - o.${c})::DOUBLE AS off_${c}`).join(', ')}
     FROM o JOIN t USING (game_id, team_id) JOIN b USING (game_type, player_id) GROUP BY 1`
  )
  const byId = new Map(rows.map((r) => [String(r.player_id), r]))
  const [out] = await read(
    `SELECT count(*)::INTEGER AS n FROM player_on_court o WHERE o.season = ${season} AND o.${typeSql}
       AND NOT EXISTS (SELECT 1 FROM player_game b WHERE b.season = o.season AND b.game_type = o.game_type AND b.player_id = o.player_id)`
  )
  unlined += num(out.n)
  // A key made for a player in no map (D28) is too long for a query's player filter: not asked, counted.
  const ids = [...byId.keys()].filter((id) => Math.abs(Number(id)) < 2 ** 31)
  made += byId.size - ids.length
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60)
    const rowsOf = new Map()
    // A query takes 40 metrics at most.
    for (let m = 0; m < metrics.length; m += 40) {
      const res = await query({
        entity: 'player',
        metrics: metrics.slice(m, m + 40),
        scope: { seasons: [season], gameTypes: types, players: chunk },
        transform: 'raw',
        limit: 200
      })
      for (const r of res.rows) {
        const had = rowsOf.get(String(r.id)) ?? {}
        rowsOf.set(String(r.id), { ...had, ...r.values })
      }
    }
    for (const id of chunk) {
      const r = byId.get(id)
      const got = rowsOf.get(id)
      const line = (floor, who) =>
        Object.fromEntries(
          COUNTS.map((c) => [c, num(r[`${floor}_${who === 'opp' ? 'opp_' : ''}${c}`])])
        )
      for (const [rate, who, mid] of IDS) {
        const of = (floor) =>
          RATES[rate](line(floor, who), line(floor, who === 'opp' ? 'team' : 'opp'))
        const on = of('on')
        const off = of('off')
        const key = `${season} ${id}`
        const value = (m) => num(got?.[m]?.value)
        const has = got !== undefined
        note(`on ${mid}`, key, value(`onc_${mid}`), on, has)
        note(`off ${mid}`, key, value(`offc_${mid}`), off, has)
        note(
          `on-off ${mid}`,
          key,
          value(`onoff_${mid}`),
          on === null || off === null ? null : on - off,
          has
        )
      }
    }
  }
}
console.log('\n2. Every rate of every player-season, through the engine')
let bad = 0
for (const [name, t] of all) {
  bad += t.differ + t.blank + t.absent + t.extra
  console.log(
    `  ${name}: worked ${t.source.toLocaleString('en')}, equal ${t.equal.toLocaleString('en')}, differing ${t.differ}, blank ${t.blank}, no row ${t.absent}, extra ${t.extra}`
  )
  for (const o of t.off) console.log('     ', o)
}
console.log(
  `  not asked: ${unlined.toLocaleString('en')} player-games on the floor of a season type the player has no box-score line in (no screen reads them), ${made.toLocaleString('en')} player-seasons whose key is too long to ask for (D28)`
)
console.log(`\n${bad ? `${bad} values not equal` : 'every value equal'}`)
await close()
