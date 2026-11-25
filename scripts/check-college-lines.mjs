#!/usr/bin/env node
// Checks the colleges' stats.ncaa.org player lines on a real load from the SOURCE's side (how a check
// counts: stats-database.md, "Measuring a real load"): every line of the player box of every season the
// file holds, mapped as the game tables map it, by what became of it, through the built worker, read only.
// Read a season at a time and counted here, since one query over every line asks more than a read's memory.
// It prints, per season: the lines with no player_game line, attached, detached or of two lines of one
// player; the detached by how the line is linked; that no line is detached without being another
// performance and none attached that should be detached; the box-score links that rest on fewer than half
// their lines; the players with two lines in one game and whether the splits read equal the box; and the
// half-court and transition splits, built over source. Build first: npm run build.
// usage: node scripts/check-college-lines.mjs <folder> --league=ncaam|ncaaw
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
const league = leagueArg()
if (!folder || !league.startsWith('ncaa')) {
  console.error('usage: node scripts/check-college-lines.mjs <folder> --league=ncaam|ncaaw')
  process.exit(1)
}
const { read, close } = openStatsWorker(folder, { league })
const num = (x) => (x === null || x === undefined ? null : Number(x))
const print = (rows) => {
  for (const r of rows) console.log(`  ${JSON.stringify(r)}`)
}

const FIVE = ['pts', 'reb', 'ast', 'fga', 'pf']
const sameLine = (a, b) => FIVE.every((c) => a[c] !== null && a[c] === b[c])
/** Another performance: the points differ, or two or more of the five counts. */
const otherPerformance = (a, b) => a.pts !== b.pts || FIVE.filter((c) => a[c] !== b[c]).length >= 2
const allZero = (a) => FIVE.every((c) => !a[c])

// The builder's rule for a player with several map rows (`bestPlayerSql`).
const best = (of) =>
  `arg_max(${of}, (player_id > 0, lines, player_id${of === 'player_id' ? '' : `, ${of}`}))`
const span = await read(
  'SELECT min(season) AS first, max(season) AS last, count(*)::INTEGER AS lines FROM src_ncaa_player_box'
)
const seasons = (await read('SELECT DISTINCT season AS s FROM src_ncaa_player_box ORDER BY 1')).map(
  (r) => Number(r.s)
)
console.log(
  `${league}: every player line of the file, seasons ${span[0].first} to ${span[0].last}, ${span[0].lines} lines`
)
let unread = 0
const bySeason = []
const detached = []
const twice = []
const rule = { detachedThoughNoOtherPerformance: 0, attachedThoughExactElsewhere: 0 }
const links = { links: 0, underHalf: 0 }

for (const season of seasons) {
  const byId = new Map(
    (
      await read(
        `SELECT ncaa_player_id AS k, ${best('player_id')} AS player_id, ${best('method')} AS method FROM ncaa_player_ids WHERE season = ${season} AND ncaa_player_id IS NOT NULL GROUP BY 1`
      )
    ).map((r) => [String(r.k), r])
  )
  const byName = new Map(
    (
      await read(
        `SELECT ncaa_team, player, ${best('player_id')} AS player_id, ${best('method')} AS method FROM ncaa_player_ids WHERE season = ${season} AND ncaa_player_id IS NULL GROUP BY 1, 2`
      )
    ).map((r) => [`${r.ncaa_team}\t${r.player}`, r])
  )
  const total = (
    await read(`SELECT count(*)::INTEGER AS n FROM src_ncaa_player_box WHERE season = ${season}`)
  )[0].n
  const rows = await read(
    `SELECT x.contest_id, g.game_id, g.espn_game_id, x.team, x.player, nullif(trim(x.player_id::VARCHAR), '') AS pid,
            x.pts::DOUBLE AS pts, (coalesce(x.orb, 0) + coalesce(x.drb, 0))::DOUBLE AS reb, x.ast::DOUBLE AS ast, x.fga::DOUBLE AS fga, x.pf::DOUBLE AS pf
     FROM src_ncaa_player_box x
     JOIN game g ON g.ncaa_game_id = x.contest_id AND g.played AND g.forfeit_winner_id IS NULL
     WHERE x.season = ${season}`
  )
  unread += total - rows.length
  const box = new Map(
    (
      await read(
        `SELECT game_id, player_id, pts::DOUBLE AS pts, reb::DOUBLE AS reb, ast::DOUBLE AS ast, fga::DOUBLE AS fga, pf::DOUBLE AS pf, ncaa_games, ncaa_pts FROM player_game WHERE season = ${season}`
      )
    ).map((r) => [`${r.game_id}\t${r.player_id}`, r])
  )
  const espn = new Map()
  for (const r of await read(
    `SELECT game_id, TRY_CAST(athlete_id AS BIGINT) AS aid, points::DOUBLE AS pts, rebounds::DOUBLE AS reb, assists::DOUBLE AS ast, field_goals_attempted::DOUBLE AS fga, fouls::DOUBLE AS pf FROM src_espn_player_box WHERE season = ${season} AND season = file_season AND points IS NOT NULL`
  )) {
    espn.set(`${r.game_id}\t${r.aid}`, r)
  }
  const teams = new Map()
  for (const l of rows) {
    const m = l.pid !== null ? byId.get(String(l.pid)) : byName.get(`${l.team}\t${l.player}`)
    l.key = m?.player_id === undefined || m?.player_id === null ? null : String(m.player_id)
    l.method = m?.method ?? null
    l.box = l.key === null ? undefined : box.get(`${l.game_id}\t${l.key}`)
    const t = `${l.contest_id}\t${l.team}`
    if (!teams.has(t)) teams.set(t, [])
    teams.get(t).push(l)
  }
  const perPlayer = new Map()
  for (const l of rows) {
    const k = `${l.game_id}\t${l.key}`
    if (l.key !== null) perPlayer.set(k, (perPlayer.get(k) ?? 0) + 1)
  }
  const c = { season, lines: rows.length, noPlayerLine: 0, attached: 0, detached: 0, ofTwoLines: 0 }
  const pairs = new Map()
  for (const l of rows) {
    const b = l.box
    if (!b) {
      c.noPlayerLine++
      continue
    }
    const many = perPlayer.get(`${l.game_id}\t${l.key}`) > 1
    const is = { pts: num(b.pts), reb: num(b.reb), ast: num(b.ast), fga: num(b.fga), pf: num(b.pf) }
    const it = { pts: num(l.pts), reb: num(l.reb), ast: num(l.ast), fga: num(l.fga), pf: num(l.pf) }
    if (many) {
      c.ofTwoLines++
      const key = `${l.game_id}\t${l.key}`
      if (!pairs.has(key))
        pairs.set(key, {
          season,
          game: l.game_id,
          player: l.key,
          box: is.pts,
          read: num(b.ncaa_pts),
          lines: []
        })
      pairs.get(key).lines.push(`${l.team} ${l.player} ${it.pts}`)
      continue
    }
    const other = otherPerformance(it, is)
    const elsewhere =
      other &&
      !allZero(is) &&
      teams
        .get(`${l.contest_id}\t${l.team}`)
        .some(
          (o) =>
            o !== l &&
            sameLine(
              { pts: num(o.pts), reb: num(o.reb), ast: num(o.ast), fga: num(o.fga), pf: num(o.pf) },
              is
            )
        )
    if (num(b.ncaa_games) !== null) {
      c.attached++
      if (elsewhere) rule.attachedThoughExactElsewhere++
    } else {
      c.detached++
      const d = detached.find((x) => x.season === season && x.method === l.method)
      if (d) d.lines++
      else detached.push({ season, method: l.method, lines: 1 })
      if (!other) rule.detachedThoughNoOtherPerformance++
    }
  }
  for (const p of pairs.values()) twice.push(p)
  bySeason.push(c)
  // The box-score links, by the share of their lines the athlete's box lines equal.
  const perLink = new Map()
  for (const l of rows) {
    if (l.method !== 'box score') continue
    const e = espn.get(`${l.espn_game_id}\t${l.key}`)
    if (!e) continue
    const who = `${l.pid ?? `${l.team}\t${l.player}`}\t${l.key}`
    const g = perLink.get(who) ?? { lines: 0, agree: 0 }
    g.lines++
    if (
      sameLine(
        { pts: num(l.pts), reb: num(l.reb), ast: num(l.ast), fga: num(l.fga), pf: num(l.pf) },
        { pts: num(e.pts), reb: num(e.reb), ast: num(e.ast), fga: num(e.fga), pf: num(e.pf) }
      )
    )
      g.agree++
    perLink.set(who, g)
  }
  for (const g of perLink.values()) {
    links.links++
    if (2 * g.agree < g.lines) links.underHalf++
  }
}
console.log(
  `of them, ${unread} are of a forfeit, a game not played or a contest listed twice, which no table reads`
)
console.log(
  'each line, by season: no player_game line for its player; its one line attached or not; one of two lines'
)
print(bySeason)
console.log('the detached, by season and how the line is linked:')
print(detached)
console.log('lines that break the rule (both should be 0):', JSON.stringify(rule))
console.log(
  'links by box-score lines, those resting on fewer than half of them (should be 0):',
  JSON.stringify(links)
)
console.log('players with two lines in one game, with the points the splits read and the box’s:')
const names = new Map(
  (
    await read(
      `SELECT player_id, name FROM player WHERE player_id IN (${twice.map((p) => p.player).join(', ') || '0'})`
    )
  ).map((r) => [String(r.player_id), r.name])
)
print(
  twice.map((p) => ({ ...p, player: names.get(p.player) ?? p.player, lines: p.lines.join(' | ') }))
)

// The half-court and transition splits: what player_game holds over what the file holds, against the
// points' own share, per season. The share below 1 is the lines with no player_game line and the detached.
const HALF = [
  'pts',
  'fgm',
  'fga',
  'tpm:fg3m',
  'tpa:fg3a',
  'ftm',
  'fta',
  'rimm',
  'rima',
  'midm',
  'mida',
  'orb',
  'drb',
  'ast',
  'stl',
  'blk',
  'tov'
]
const TRANS = ['orb', 'drb', 'ast', 'stl', 'blk', 'midm', 'mida']
const cols = [...HALF.map((x) => [x, 'half']), ...TRANS.map((x) => [x, 'trans'])].map(([x, w]) => {
  const [s, b] = x.split(':')
  return { src: `${s}_${w}`, built: `ncaa_${b ?? s}_${w}` }
})
const src =
  await read(`SELECT season, ${cols.map((k) => `sum(${k.src})::DOUBLE AS ${k.src}`).join(', ')}
  FROM src_ncaa_player_box GROUP BY 1 ORDER BY 1`)
const built =
  await read(`SELECT season, ${cols.map((k) => `sum(${k.built})::DOUBLE AS ${k.built}`).join(', ')}
  FROM player_game GROUP BY 1 ORDER BY 1`)
console.log(
  "half-court and transition splits, built over source, per season: the points' own share and the column furthest from it"
)
for (const s of src) {
  const b = built.find((r) => Number(r.season) === Number(s.season))
  if (!b) {
    console.log(`  ${s.season}: no built rows`)
    continue
  }
  const base = b.ncaa_pts_half / s.pts_half
  let worst = { column: '', gap: 0 }
  for (const k of cols) {
    const gap = Math.abs(b[k.built] / s[k.src] - base)
    if (gap > worst.gap) worst = { column: k.built, gap }
  }
  console.log(
    `  ${s.season}: points' share ${base.toFixed(5)}, furthest ${worst.column} by ${(100 * worst.gap).toFixed(3)} points of share`
  )
}
await close()
