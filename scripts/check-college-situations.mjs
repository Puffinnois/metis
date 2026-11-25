#!/usr/bin/env node
// Checks the college leagues' counts by situation (T1703.2, part 4c) on a real load from the SOURCE's
// side (how a check counts: stats-database.md, "Measuring a real load"), through the built worker, read
// only, every season the files hold. Each file's rows are read and counted here, apart from the builder:
//
// 1. Team-games: every side of every game `src_ncaa_pbp` has a row for, its fast-break, off-turnover and
//    paint counts, and every side of every game `src_ncaa_possessions` has, its possession counts; each
//    against its row of `ncaa_situation_team_game`.
// 2. Players: every named player of a tagged play, through the players' map, against the player table.
// 3. Teams' seasons: the same team-game values summed, against what the engine answers (the season's
//    totals and shares, by side: own and opponents').
// 4. Beside other sources, not expected to be equal: ESPN's box points in the paint, on the fast break and
//    off turnovers (from 2023-24), and stats.ncaa.org's own team box possessions (`ncaa_poss`).
//
// A game whose play by play carries no tag at all was not tagged: its tags have no value in the source,
// and it is counted apart.
// A value is equal, differing, blank (a row with no value) or with no row. What no side or player is found
// for is counted, not skipped. Build first: npm run build.
// usage: node scripts/check-college-situations.mjs <folder> --league=ncaam|ncaaw [--season=2025]
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
const league = leagueArg()
if (!folder || !league.startsWith('ncaa')) {
  console.error('usage: node scripts/check-college-situations.mjs <folder> --league=ncaam|ncaaw')
  process.exit(1)
}
const { read, query, close } = openStatsWorker(folder, { league })
const num = (x) => (x === null || x === undefined ? null : Number(x))
const label = (s) => `${s - 1}-${String(s).slice(2)}`

const TAGS = [
  'ncaa_pts_fb',
  'ncaa_pts_offtov',
  'ncaa_pts_paint',
  'ncaa_fgm_paint',
  'ncaa_fga_paint'
]
const POSS = [
  'ncaa_poss_n',
  'ncaa_poss_first3',
  'ncaa_poss_first_rim',
  'ncaa_poss_first_two',
  'ncaa_poss_first_none',
  'ncaa_poss_ast'
]

/** One line of counts: every source value is equal, differing, blank or has no row; `extra` is the reverse. */
const tally = (name) => ({
  name,
  source: 0,
  equal: 0,
  differ: 0,
  blank: 0,
  absent: 0,
  extra: 0,
  off: [],
  nowhere: []
})
function value(t, key, built, source, hasRow) {
  if (source === null) {
    if (hasRow && built !== null) t.extra++
    return
  }
  t.source++
  if (!hasRow) {
    t.absent++
    if (t.nowhere.length < 5) t.nowhere.push(`${key} ${source}`)
  } else if (built === null || built === undefined) {
    t.blank++
    if (t.nowhere.length < 5) t.nowhere.push(`${key} ${source} (blank)`)
  } else if (Math.abs(built - source) < 1e-9) t.equal++
  else {
    t.differ++
    if (t.off.length < 8) t.off.push(`${key}: built ${built}, source ${source}`)
  }
}
const show = (t) => {
  console.log(
    `  ${t.name}: source values ${t.source}: equal ${t.equal}, differ ${t.differ}, blank ${t.blank}, no row ${t.absent}; built with no source value ${t.extra}`
  )
  for (const o of t.off) console.log(`    differs: ${o}`)
  for (const o of t.nowhere) console.log(`    not there: ${o}`)
}

// A play's result and value, worked from the file's own columns, apart from the builder's SQL. Older
// rows hold them in the event's name or its description.
function play(r) {
  const type = String(r.event_type ?? '')
  const desc = String(r.event_description ?? '')
  const free = /(^|[ ,])Free Throw$/.test(type)
  const ptr = /([23])PTR/.exec(desc)
  const shot =
    /(Three Point Jumper|Two Point Jumper|Layup|Dunk|Hook|Tip In|Unk)$/.test(type) ||
    (type === '' && ptr !== null)
  const result =
    r.event_result || (/(?:^| )(made|missed) /.exec(type) ?? / (made|missed) /.exec(desc))?.[1]
  const points =
    num(r.shot_value) ??
    (free ? 1 : /Three Point Jumper$/.test(type) ? 3 : ptr ? Number(ptr[1]) : 2)
  return {
    free,
    shot,
    made: result === 'made',
    tried: result === 'made' || result === 'missed',
    value: points
  }
}
const tagsOf = (r) => {
  const p = play(r)
  const pts = p.free ? (p.made ? 1 : 0) : p.shot && p.made ? p.value : 0
  return {
    ncaa_pts_fb: r.fastbreak ? pts : 0,
    ncaa_pts_offtov: r.off_turnover ? pts : 0,
    ncaa_pts_paint: r.paint ? pts : 0,
    ncaa_fgm_paint: r.paint && p.shot && p.made ? 1 : 0,
    ncaa_fga_paint: r.paint && p.shot && p.tried ? 1 : 0
  }
}
const add = (map, key, counts, names) => {
  const c = map.get(key) ?? Object.fromEntries(names.map((n) => [n, 0]))
  for (const n of names) c[n] += counts[n]
  map.set(key, c)
}

const best = (of) =>
  `arg_max(${of}, (player_id > 0, lines, player_id${of === 'player_id' ? '' : `, ${of}`}))`

const only = process.argv.find((a) => a.startsWith('--season='))?.slice('--season='.length)
const seasons = (await read('SELECT DISTINCT season AS s FROM src_ncaa_pbp ORDER BY 1'))
  .map((r) => Number(r.s))
  .filter((x) => only === undefined || x === Number(only))
const span = await read(
  'SELECT count(*)::INTEGER AS plays, (SELECT count(*)::INTEGER FROM src_ncaa_possessions) AS poss FROM src_ncaa_pbp'
)
console.log(
  `## ${league}: seasons ${label(seasons[0])} to ${label(seasons.at(-1))}, ${span[0].plays} plays, ${span[0].poss} possessions\n`
)

for (const season of seasons) {
  console.log(`### ${label(season)}`)
  // The sides of each contest, as the identity placed the rows' names; a contest with no such row is
  // counted as unplaced.
  const side = new Map(
    (
      await read(
        `SELECT contest_id, team, team_id FROM ncaa_side WHERE season = ${season} AND team_id IS NOT NULL`
      )
    ).map((r) => [`${r.contest_id}\t${r.team}`, String(r.team_id)])
  )
  const games = new Map(
    (
      await read(
        `SELECT ncaa_game_id AS c, game_id, home_team_id AS h, away_team_id AS a, game_type AS gt, played FROM game WHERE season = ${season} AND ncaa_game_id IS NOT NULL`
      )
    ).map((r) => [String(r.c), r])
  )
  // A contest with no row there (a forfeit) by the play by play's own stats.ncaa.org ids, counted apart.
  const teamOfId = new Map(
    (
      await read(
        `SELECT ncaa_team_id AS k, min(team_id) AS t FROM team WHERE season = ${season} AND ncaa_team_id IS NOT NULL GROUP BY 1`
      )
    ).map((r) => [String(r.k), String(r.t)])
  )
  const idsOf = new Map(
    (
      await read(
        `SELECT DISTINCT contest_id, home, away, home_ncaa_team_id AS h, away_ncaa_team_id AS a FROM src_ncaa_pbp WHERE season = ${season}`
      )
    ).flatMap((r) => [
      [`${r.contest_id}\t${r.home}`, teamOfId.get(String(r.h))],
      [`${r.contest_id}\t${r.away}`, teamOfId.get(String(r.a))]
    ])
  )
  const placedById = new Set()
  const noGame = new Set()
  const unplaced = new Set()
  const teamOf = (contest, name, home, away) => {
    const g = games.get(String(contest))
    if (!g) {
      noGame.add(String(contest))
      return undefined
    }
    const t = side.get(`${contest}\t${name}`)
    if (t) return t
    const other = side.get(`${contest}\t${name === home ? away : home}`)
    if (other) return other === String(g.h) ? String(g.a) : String(g.h)
    const id = idsOf.get(`${contest}\t${name}`)
    if (id && [String(g.h), String(g.a)].includes(id)) {
      placedById.add(String(contest))
      return id
    }
    unplaced.add(`${contest} ${name}`)
    return undefined
  }

  // The play by play: every side it has any row for, so a side with no tagged play is a source value of 0.
  const zero = Object.fromEntries(TAGS.map((n) => [n, 0]))
  const file = new Map()
  for (const r of await read(
    `SELECT DISTINCT contest_id, home, away, event_team FROM src_ncaa_pbp WHERE season = ${season} AND event_team IS NOT NULL`
  )) {
    const t = teamOf(r.contest_id, r.event_team, r.home, r.away)
    if (t) add(file, `${games.get(String(r.contest_id)).game_id}\t${t}`, zero, TAGS)
  }
  const plays = await read(
    `SELECT contest_id, home, away, event_team, player_1, player_1_id, event_type, event_result,
            event_description, shot_value, coalesce(is_fastbreak, false) AS fastbreak,
            coalesce(is_from_turnover, false) AS off_turnover, coalesce(is_paint, false) AS paint
     FROM src_ncaa_pbp WHERE season = ${season} AND (is_fastbreak OR is_from_turnover OR is_paint)`
  )
  const byId = new Map(
    (
      await read(
        `SELECT ncaa_player_id AS k, ${best('player_id')} AS player_id FROM ncaa_player_ids WHERE season = ${season} AND ncaa_player_id IS NOT NULL GROUP BY 1`
      )
    ).map((r) => [String(r.k), String(r.player_id)])
  )
  const byName = new Map(
    (
      await read(
        `SELECT team_id, player, arg_max(player_id, (lines, player_id)) AS player_id FROM ncaa_player_ids WHERE season = ${season} AND player IS NOT NULL GROUP BY 1, 2`
      )
    ).map((r) => [`${r.team_id}\t${r.player}`, String(r.player_id)])
  )
  const players = new Map()
  const tagged = new Set()
  const kinds = new Map()
  let unmapped = 0
  let teamRows = 0
  let noTeam = 0
  for (const r of plays) {
    const p = play(r)
    const kind = p.free ? 'free throw' : p.shot ? 'shot' : 'other'
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
    if (r.event_team === null) {
      noTeam++
      continue
    }
    const counts = tagsOf(r)
    const t = teamOf(r.contest_id, r.event_team, r.home, r.away)
    if (!t) continue
    const game = games.get(String(r.contest_id)).game_id
    tagged.add(game)
    add(file, `${game}\t${t}`, counts, TAGS)
    if (!TAGS.some((n) => counts[n] > 0)) continue
    if (r.player_1 === null || String(r.player_1).toUpperCase() === 'TEAM') {
      teamRows++
      continue
    }
    const id = r.player_1_id
    const pid =
      (id !== null && byId.get(String(id))) ||
      (id !== null && `-${id}`) ||
      byName.get(`${t}\t${r.player_1}`)
    if (!pid) {
      unmapped++
      continue
    }
    add(players, `${game}\t${t}\t${pid}`, counts, TAGS)
  }
  if (placedById.size) {
    console.log(
      `  play by play: contests with no row in ncaa_side, placed by the file's own team ids: ${[...placedById].join(', ')}`
    )
  }
  if (noGame.size || unplaced.size) {
    console.log(
      `  play by play: contests with no game ${noGame.size}; sides not placed ${unplaced.size}${unplaced.size ? ` (${[...unplaced].slice(0, 3).join('; ')})` : ''}`
    )
  }
  console.log(
    `  tagged plays ${plays.length} (${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}); no team ${noTeam}; scoring or tried in the paint, a team's own ${teamRows}, a player not in the map ${unmapped}`
  )

  const built = new Map(
    (
      await read(
        `SELECT game_id, team_id, ncaa_tag_games, ${[...TAGS, ...POSS].join(', ')} FROM ncaa_situation_team_game WHERE season = ${season}`
      )
    ).map((r) => [`${r.game_id}\t${r.team_id}`, r])
  )
  const team = tally('Team-game tag counts')
  let untagged = 0
  for (const [key, c] of file) {
    const b = built.get(key)
    const yes = tagged.has(key.split('\t')[0])
    if (!yes) untagged++
    for (const n of TAGS)
      value(team, `${key} ${n}`, num(b?.[n]), yes ? c[n] : null, b !== undefined)
    value(team, `${key} ncaa_tag_games`, num(b?.ncaa_tag_games), yes ? 1 : null, b !== undefined)
  }
  console.log(
    `  team-games with play by play ${file.size}; in games with no tag at all ${untagged}, with no value`
  )
  for (const [key, b] of built) {
    if (!file.has(key)) for (const n of TAGS) if (num(b[n]) !== 0) team.extra++
  }
  show(team)

  const pBuilt = new Map(
    (
      await read(
        `SELECT game_id, team_id, player_id, ${TAGS.join(', ')} FROM ncaa_situation_player_game WHERE season = ${season}`
      )
    ).map((r) => [`${r.game_id}\t${r.team_id}\t${r.player_id}`, r])
  )
  const pt = tally('Player-game tag counts')
  // Every line of the box score in a tagged game, with no tagged play of theirs, counts 0 of each.
  const zeroes = new Map()
  for (const r of await read(
    `SELECT game_id, team_id, player_id FROM player_game WHERE season = ${season} AND EXISTS (SELECT 1 FROM ncaa_situation_team_game t WHERE t.game_id = player_game.game_id)`
  )) {
    if (!tagged.has(r.game_id)) continue
    zeroes.set(`${r.game_id}\t${r.player_id}`, `${r.game_id}\t${r.team_id}\t${r.player_id}`)
  }
  for (const key of players.keys()) {
    const [game, , pid] = key.split('\t')
    zeroes.delete(`${game}\t${pid}`)
  }
  for (const [key, c] of players) {
    const b = pBuilt.get(key)
    for (const n of TAGS) value(pt, `${key} ${n}`, num(b?.[n]), c[n], b !== undefined)
  }
  for (const key of zeroes.values()) {
    const b = pBuilt.get(key)
    for (const n of TAGS) value(pt, `${key} ${n}`, num(b?.[n]), 0, b !== undefined)
  }
  for (const [key, b] of pBuilt) {
    if (!players.has(key) && ![...TAGS].every((n) => num(b[n]) === 0)) pt.extra++
  }
  show(pt)

  // The possessions, from their own file.
  const poss = await read(
    `SELECT contest_id, home, away, poss_team, first_shot_type AS first_shot, is_assisted AS assisted FROM src_ncaa_possessions WHERE season = ${season}`
  )
  const pf = new Map()
  const shots = new Map()
  let noOffence = 0
  for (const r of poss) {
    if (r.poss_team === null) {
      noOffence++
      continue
    }
    const t = teamOf(r.contest_id, r.poss_team, r.home, r.away)
    if (!t) continue
    const f = r.first_shot
    shots.set(f ?? 'none', (shots.get(f ?? 'none') ?? 0) + 1)
    add(
      pf,
      `${games.get(String(r.contest_id)).game_id}\t${t}`,
      {
        ncaa_poss_n: 1,
        ncaa_poss_first3: f === 'Three Point Jumper' ? 1 : 0,
        ncaa_poss_first_rim: ['Layup', 'Dunk', 'Tip In'].includes(f) ? 1 : 0,
        ncaa_poss_first_two: ['Two Point Jumper', 'Hook'].includes(f) ? 1 : 0,
        ncaa_poss_first_none: f === null ? 1 : 0,
        ncaa_poss_ast: num(r.assisted) > 0 ? 1 : 0
      },
      POSS
    )
  }
  const pos = tally('Team-game possession counts')
  for (const [key, c] of pf) {
    const b = built.get(key)
    for (const n of POSS) value(pos, `${key} ${n}`, num(b?.[n]), c[n], b !== undefined)
  }
  for (const [key, b] of built) {
    if (!pf.has(key)) for (const n of POSS) if (num(b[n]) !== null) pos.extra++
  }
  console.log(
    `  possessions ${poss.length}; no offence ${noOffence}; first shots: ${[...shots]
      .sort()
      .map(([k, n]) => `${k} ${n}`)
      .join(', ')}`
  )
  show(pos)

  // Team seasons through the engine: own and opponents', totals and shares, over every game of the season
  // (each type named), 60 teams at a time, since naming them reads a team of any division.
  const types = [...new Set([...games.values()].map((g) => g.gt))]
  const otherOf = new Map()
  for (const g of games.values()) {
    otherOf.set(`${g.game_id}\t${g.h}`, `${g.game_id}\t${g.a}`)
    otherOf.set(`${g.game_id}\t${g.a}`, `${g.game_id}\t${g.h}`)
  }
  const inSeason = (
    await read(`SELECT game_id, team_id FROM team_game WHERE season = ${season}`)
  ).map((r) => `${r.game_id}\t${r.team_id}`)
  const own = new Map()
  const gamesOf = new Map()
  const opp = new Map()
  let alsoPlayed = 0
  for (const key of inSeason) {
    const id = key.split('\t')[1]
    const o = otherOf.get(key)
    if (file.has(key) && tagged.has(key.split('\t')[0])) {
      add(own, id, file.get(key), TAGS)
      gamesOf.set(id, (gamesOf.get(id) ?? 0) + 1)
      alsoPlayed++
    }
    if (pf.has(key)) add(own, `p${id}`, pf.get(key), POSS)
    if (o && file.has(o) && tagged.has(o.split('\t')[0])) add(opp, id, file.get(o), TAGS)
    if (o && pf.has(o)) add(opp, `p${id}`, pf.get(o), POSS)
  }
  const defs = [
    ['fb_pts', (c) => c.t?.ncaa_pts_fb],
    ['offtov_pts', (c) => c.t?.ncaa_pts_offtov],
    ['paint_pts', (c) => c.t?.ncaa_pts_paint],
    ['paint_fga', (c) => c.t?.ncaa_fga_paint],
    [
      'paint_fg_pct',
      (c) => (c.t?.ncaa_fga_paint ? c.t.ncaa_fgm_paint / c.t.ncaa_fga_paint : undefined)
    ],
    ['poss_first3_pct', (c) => c.p && c.p.ncaa_poss_first3 / c.p.ncaa_poss_n],
    ['poss_first_rim_pct', (c) => c.p && c.p.ncaa_poss_first_rim / c.p.ncaa_poss_n],
    ['poss_first_two_pct', (c) => c.p && c.p.ncaa_poss_first_two / c.p.ncaa_poss_n],
    ['poss_no_shot_pct', (c) => c.p && c.p.ncaa_poss_first_none / c.p.ncaa_poss_n],
    ['poss_ast_pct', (c) => c.p && c.p.ncaa_poss_ast / c.p.ncaa_poss_n]
  ]
  console.log(`  team-games of the season ${inSeason.length}, with play by play ${alsoPlayed}`)
  for (const [from, name, pre] of [
    [own, 'Teams through the engine', 'team_'],
    [opp, "Teams' opponents through the engine", 'opp_']
  ]) {
    const t = tally(name)
    const metrics = defs.map(([m]) => `${pre}ncaa_${m}`)
    const rows = new Map()
    const teamIds = [...new Set([...from.keys()].map((k) => k.replace(/^p/, '')))]
    for (let i = 0; i < teamIds.length; i += 60) {
      const res = await query({
        entity: 'team',
        metrics,
        scope: { seasons: [season], gameTypes: types, teams: teamIds.slice(i, i + 60) },
        transform: 'raw',
        limit: 500
      })
      for (const r of res.rows) rows.set(String(r.id), r)
    }
    for (const id of teamIds) {
      const c = { t: from.get(id), p: from.get(`p${id}`) }
      const r = rows.get(id)
      for (const [m, f] of defs) {
        const s = f(c)
        value(
          t,
          `${id} ${pre}ncaa_${m}`,
          num(r?.values[`${pre}ncaa_${m}`]?.value),
          s === undefined || s === null || Number.isNaN(s) ? null : s,
          r !== undefined
        )
      }
    }
    show(t)
  }
  const perGame = tally('Teams through the engine, per game of the tagged games')
  const pgRows = new Map()
  const pgIds = [...gamesOf.keys()]
  for (let i = 0; i < pgIds.length; i += 60) {
    const res = await query({
      entity: 'team',
      metrics: ['team_ncaa_fb_pts', 'team_ncaa_paint_fga'],
      scope: { seasons: [season], gameTypes: types, teams: pgIds.slice(i, i + 60) },
      transform: 'perGame',
      limit: 500
    })
    for (const r of res.rows) pgRows.set(String(r.id), r)
  }
  for (const id of pgIds) {
    const r = pgRows.get(id)
    const c = own.get(id)
    for (const [m, n] of [
      ['team_ncaa_fb_pts', 'ncaa_pts_fb'],
      ['team_ncaa_paint_fga', 'ncaa_fga_paint']
    ]) {
      value(
        perGame,
        `${id} ${m}`,
        num(r?.values[m]?.value),
        c[n] / gamesOf.get(id),
        r !== undefined
      )
    }
  }
  show(perGame)
  // Players' seasons through the engine. A season adds a player's games of the built table, the few with no
  // line in the box score among them (a filter on games joins the lines and leaves those out).
  const lines = new Set(
    (await read(`SELECT game_id, player_id FROM player_game WHERE season = ${season}`)).map(
      (r) => `${r.game_id}	${r.player_id}`
    )
  )
  const bySeason = new Map()
  let noLine = 0
  let noLineValues = 0
  for (const [key, c] of players) {
    const [game, , pid] = key.split('	')
    if (!lines.has(`${game}	${pid}`)) {
      noLine++
      for (const n of TAGS) if (c[n] > 0) noLineValues++
    }
    add(bySeason, pid, c, TAGS)
  }
  const pm = ['fb_pts', 'offtov_pts', 'paint_pts', 'paint_fga', 'paint_fg_pct'].map(
    (m) => `ncaa_${m}`
  )
  const pe = new Map()
  // A key made for a player in no map (D28) is too long for a query's player filter; they are in the tables above.
  const ids = [...bySeason.keys()].filter(
    (id) => Number.isSafeInteger(Number(id)) && Math.abs(Number(id)) < 2 ** 31
  )
  for (let i = 0; i < ids.length; i += 60) {
    const res = await query({
      entity: 'player',
      metrics: pm,
      scope: { seasons: [season], gameTypes: types, players: ids.slice(i, i + 60) },
      transform: 'raw',
      limit: 2000
    })
    for (const r of res.rows) pe.set(String(r.id), r)
  }
  const pt2 = tally('Players through the engine')
  for (const id of ids) {
    const c = bySeason.get(id)
    const r = pe.get(id)
    const src = [
      c.ncaa_pts_fb,
      c.ncaa_pts_offtov,
      c.ncaa_pts_paint,
      c.ncaa_fga_paint,
      c.ncaa_fga_paint ? c.ncaa_fgm_paint / c.ncaa_fga_paint : null
    ]
    pm.forEach((m, k) =>
      value(pt2, `${id} ${m}`, num(r?.values[m]?.value), src[k], r !== undefined)
    )
  }
  console.log(
    `  players ${bySeason.size} (${bySeason.size - ids.length} with a made key, not asked); tagged player-games with no line in the box score ${noLine} (${noLineValues} values)`
  )
  show(pt2)
  const bare = (
    await read(
      `SELECT count(*)::INTEGER AS n, count(*) FILTER (WHERE s.game_id IS NULL)::INTEGER AS none,
              count(*) FILTER (WHERE s.game_id IS NULL AND t.pts IS NOT NULL)::INTEGER AS none_with_box,
              count(*) FILTER (WHERE s.ncaa_poss_n IS NULL)::INTEGER AS no_possessions
       FROM team_game t LEFT JOIN ncaa_situation_team_game s USING (game_id, team_id) WHERE t.season = ${season}`
    )
  )[0]
  console.log(
    `  every team-game ${bare.n}; with no row here ${bare.none} (${bare.none_with_box} with a box score); with no possessions ${bare.no_possessions}`
  )
}

console.log(
  `\n## ${league}: beside other sources (two tags of one game, so agreement is measured)\n`
)
const within = (a, b, w) => `round(100.0 * avg((abs(${a} - ${b}) <= ${w})::INTEGER), 1)`
const pairs = {
  paint: ['s.ncaa_pts_paint', 'g.paint_pts'],
  fb: ['s.ncaa_pts_fb', 'g.fast_break_pts'],
  tov: ['s.ncaa_pts_offtov', 'g.turnover_pts']
}
const cross = await read(`
  SELECT s.season, count(*)::INTEGER AS games, ${Object.entries(pairs)
    .map(
      ([k, [a, b]]) =>
        `count(${b})::INTEGER AS ${k}_n, ${within(a, b, 0)} AS ${k}_eq, ${within(a, b, 2)} AS ${k}_2, ${within(a, b, 6)} AS ${k}_6, round(avg(${a} - ${b}), 2) AS ${k}_d, round(corr(${a}::DOUBLE, ${b}::DOUBLE), 3) AS ${k}_r, round(avg(${b}), 1) AS ${k}_espn`
    )
    .join(', ')},
    count(g.ncaa_poss)::INTEGER AS poss_n, ${within('s.ncaa_poss_n', 'g.ncaa_poss', 2)} AS poss_2,
    round(avg(s.ncaa_poss_n - g.ncaa_poss), 2) AS poss_d, round(corr(s.ncaa_poss_n::DOUBLE, g.ncaa_poss::DOUBLE), 3) AS poss_r
  FROM ncaa_situation_team_game s
  JOIN team_game g ON g.game_id = s.game_id AND g.team_id = s.team_id
  GROUP BY 1 ORDER BY 1`)
for (const c of cross) console.log(JSON.stringify(c))
await close()
