#!/usr/bin/env node
// Checks T1703.3's counts from the play by play on a real load (how a check counts: stats-database.md,
// "Measuring a real load"): every season the file holds, through the built worker, read only, counted here
// apart from the builder's SQL.
//
// 1. From the play table's own rows, game by game: go-ahead baskets, game winners and buzzer-beaters, the
//    blocks recovered, the trips, technical free throws and (colleges) front ends of one-and-ones, the jump
//    balls of the college feed, the timeouts and the fouls toward the bonus. Each player's and team's count
//    of each game against the built tables: equal, differing, with no row.
// 2. From the league's own feed (NBA, WNBA), its words: the jump balls' names and the side tipped to, the
//    challenges paired with the timeout of the same moment, the timeouts by the team the text names, and the
//    bonus the feed says (`PN` in a foul's `(P4.T3)`), as shares of the team-periods that agree.
// 3. Through the engine: points per 100 scoring attempts and the trips, for every player-season.
// usage: node scripts/check-play-counts.mjs <folder> --league=nba|wnba|ncaam|ncaaw [--season=2026]
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional().filter((a) => !a.startsWith('--season='))
const league = leagueArg()
if (!folder) {
  console.error('usage: node scripts/check-play-counts.mjs <folder> --league=<league>')
  process.exit(1)
}
const only = process.argv.find((a) => a.startsWith('--season='))?.slice('--season='.length)
const { read, query, close } = openStatsWorker(folder, { league })
const college = league.startsWith('ncaa')
const num = (x) => (x === null || x === undefined ? null : Number(x))
// Regulation's last period: four quarters; two halves for the men's college and the WNBA to 2005.
const regulation = (season) =>
  league === 'ncaam'
    ? 2
    : league === 'ncaaw'
      ? season < 2016
        ? 2
        : 4
      : league === 'wnba'
        ? season < 2006
          ? 2
          : 4
        : 4

const tally = () => ({ source: 0, equal: 0, differ: 0, absent: 0, off: [] })
const all = new Map()
function value(name, key, built, source, hasRow) {
  if (!all.has(name)) all.set(name, tally())
  const t = all.get(name)
  t.source++
  if (!hasRow) {
    if (source === 0) t.equal++
    else {
      t.absent++
      if (t.off.length < 6) t.off.push(`${key}: no row, worked ${source}`)
    }
  } else if (Number(built) === source) t.equal++
  else {
    t.differ++
    if (t.off.length < 6) t.off.push(`${key}: built ${built}, worked ${source}`)
  }
}

const COUNTED_FOULS = new Set([
  'Shooting',
  'Shooting Block',
  'Personal',
  'Personal Block',
  'Loose Ball',
  'Personal Take',
  'Transition Take',
  'Flagrant Type 1',
  'Flagrant Type 2',
  'Away From Play',
  'Clear Path',
  'Inbound',
  'Elbow',
  'Punching'
])
const LATE = [
  'go_ahead',
  'game_winner',
  'buzzer',
  'buzzer_winner',
  'blk_n',
  'blk_rec',
  'ft_front',
  'ft_techm'
]
const JUMPS = ['jump_n', 'jump_won', 'jump_lost']
const TEAMS = ['timeouts', 'team_fouls', 'bonus_given', 'challenges', 'challenges_won']

const seasons = (await read('SELECT DISTINCT season AS s FROM play_nba ORDER BY 1'))
  .map((r) => Number(r.s))
  .filter((s) => only === undefined || s === Number(only))
console.log(`${league}: seasons ${seasons[0]} to ${seasons.at(-1)}`)
const words = []
for (const season of seasons) {
  const gp = new Map(
    (
      await read(
        `SELECT game_id, home_team_id AS h, away_team_id AS a FROM game WHERE season = ${season}`
      )
    ).map((g) => [g.game_id, g])
  )
  const built = new Map()
  for (const r of await read(`SELECT * FROM play_player_game WHERE season = ${season}`))
    built.set(`${r.game_id}|${r.player_id}`, r)
  const teamBuilt = new Map()
  for (const r of await read(`SELECT * FROM play_team_game WHERE season = ${season}`))
    teamBuilt.set(`${r.game_id}|${r.team_id}`, r)
  const ids = [...new Set([...teamBuilt.keys()].map((k) => k.split('|')[0]))].sort()
  const reg = regulation(season)
  // Which of the season's games are read together, so a season is not held whole.
  const step = 400
  for (let at = 0; at < ids.length; at += step) {
    const chunk = ids.slice(at, at + step)
    const plays = await read(
      `SELECT game_id, seq, period, clock, team_id, opponent_id, home, player_id, block_id, assist_id, kind, action, subtype, fgm, ftm, pts, oreb, dreb, blk, home_after, away_after
       FROM play_nba WHERE season = ${season} AND game_id IN (${chunk.map((g) => `'${g}'`).join(', ')}) AND (pts > 0 OR kind IN ('field_goal', 'rebound', 'free_throw', 'turnover', 'jump_ball', 'timeout', 'foul', 'replay'))`
    )
    const by = new Map()
    for (const p of plays) {
      if (!by.has(p.game_id)) by.set(p.game_id, [])
      by.get(p.game_id).push(p)
    }
    for (const game of chunk) {
      const rows = (by.get(game) ?? []).sort((x, y) => Number(x.seq) - Number(y.seq))
      const worked = new Map()
      const add = (id, name) => {
        if (id === null || id === undefined) return
        const k = String(id)
        const c = worked.get(k) ?? {}
        c[name] = (c[name] ?? 0) + 1
        worked.set(k, c)
      }
      const teamCounts = new Map()
      const addTeam = (id, name, n = 1) => {
        if (id === null || id === undefined) return
        const k = String(id)
        const c = teamCounts.get(k) ?? {}
        c[name] = (c[name] ?? 0) + n
        teamCounts.set(k, c)
      }
      // The scoring rows in the order the flow reads: by the total score after them, then by row. A score of 0-0
      // is the feed's blank: the last score written, and the row's points.
      let lastH = 0
      let lastA = 0
      const scoring = []
      for (const r of rows) {
        const pts = Number(r.pts)
        if (pts <= 0 || r.home === null || r.clock === null) continue
        let h = Number(r.home_after)
        let a = Number(r.away_after)
        if (h + a === 0) {
          h = lastH + (r.home ? pts : 0)
          a = lastA + (r.home ? 0 : pts)
        }
        scoring.push({ ...r, pts, h, a, m: h - a })
        if (Number(r.home_after) + Number(r.away_after) > 0) {
          lastH = h
          lastA = a
        }
      }
      scoring.sort((x, y) => x.h + x.a - (y.h + y.a) || Number(x.seq) - Number(y.seq))
      scoring.forEach((r, i) => {
        if (Number(r.fgm) !== 1) return
        const clock = Number(r.clock)
        if (clock <= 1) {
          add(r.player_id, 'buzzer')
          addTeam(r.team_id, 'buzzer')
        }
        const mine = r.home ? r.m : -r.m
        const before = mine - r.pts
        if (Number(r.period) < reg || clock > 120 || before > 0 || mine <= 0) return
        add(r.player_id, 'go_ahead')
        addTeam(r.team_id, 'go_ahead')
        if (clock > 24) return
        const held = scoring.slice(i).every((x) => (r.home ? x.m > 0 : x.m < 0))
        if (!held) return
        add(r.player_id, 'game_winner')
        addTeam(r.team_id, 'game_winner')
        if (clock <= 1) {
          add(r.player_id, 'buzzer_winner')
          addTeam(r.team_id, 'buzzer_winner')
        }
      })
      // Blocks: what the next of these kinds is.
      const following = rows.filter((r) =>
        ['field_goal', 'rebound', 'free_throw', 'turnover', 'jump_ball'].includes(r.kind)
      )
      following.forEach((r, i) => {
        if (r.kind !== 'field_goal' || Number(r.blk) !== 1 || r.block_id === null) return
        const next = following[i + 1]
        if (!next || next.kind !== 'rebound' || Number(next.oreb) + Number(next.dreb) !== 1) return
        add(r.block_id, 'blk_n')
        addTeam(r.opponent_id, 'blk_n')
        if (String(next.team_id) === String(r.opponent_id)) {
          add(r.block_id, 'blk_rec')
          addTeam(r.opponent_id, 'blk_rec')
        }
      })
      // Free throws: a technical made; a one-and-one's missed front end, with no make of the same player at that moment.
      const makes = new Set(
        rows
          .filter((r) => Number(r.fgm) === 1)
          .map((r) => `${r.period}|${Number(r.clock)}|${r.player_id}`)
      )
      for (const r of rows) {
        if (r.kind !== 'free_throw') continue
        const sub = String(r.subtype ?? '').trim()
        if (!college && /^Free Throw Technical/.test(sub) && Number(r.ftm) === 1) {
          add(r.player_id, 'ft_techm')
          addTeam(r.team_id, 'ft_techm')
        }
        if (
          college &&
          sub === '1of1' &&
          Number(r.ftm) === 0 &&
          !makes.has(`${r.period}|${Number(r.clock)}|${r.player_id}`)
        ) {
          add(r.player_id, 'ft_front')
          addTeam(r.team_id, 'ft_front')
        }
      }
      for (const r of rows) {
        if (
          r.kind === 'timeout' &&
          r.team_id !== null &&
          !['Official', 'Official TV'].includes(String(r.subtype ?? '').trim()) &&
          !/media/i.test(String(r.action))
        )
          addTeam(r.team_id, 'timeouts')
        if (
          college &&
          r.kind === 'jump_ball' &&
          ['won Jumpball', 'lost Jumpball'].includes(r.action) &&
          r.team_id !== null
        ) {
          for (const c of ['jump_n', r.action === 'won Jumpball' ? 'jump_won' : 'jump_lost']) {
            addTeam(r.team_id, c)
            if (r.player_id !== null) add(r.player_id, c)
          }
        }
      }
      if (!college) {
        // The fouls toward the bonus, by period.
        const fouls = new Map()
        for (const r of rows) {
          if (
            r.kind !== 'foul' ||
            r.team_id === null ||
            !COUNTED_FOULS.has(String(r.subtype ?? '').trim())
          )
            continue
          addTeam(r.team_id, 'team_fouls')
          const k = `${r.team_id}|${r.period}`
          if (!fouls.has(k)) fouls.set(k, [])
          fouls.get(k).push(Number(r.clock))
        }
        for (const [k, clocks] of fouls) {
          const [tid, per] = k.split('|')
          const limit = Number(per) > reg ? 4 : 5
          if (clocks.length >= limit || clocks.filter((c) => c <= 120).length >= 2)
            addTeam(tid, 'bonus_given')
        }
      }
      for (const [k, b] of worked) {
        const row = built.get(`${game}|${k}`)
        for (const n of LATE)
          value(
            `player ${n}`,
            `${season} ${game} ${k} ${n}`,
            row?.[n],
            b[n] ?? 0,
            row !== undefined
          )
        if (college)
          for (const n of JUMPS)
            value(
              `player ${n}`,
              `${season} ${game} ${k} ${n}`,
              row?.[n],
              b[n] ?? 0,
              row !== undefined
            )
      }
      const g = gp.get(game)
      for (const id of g ? [g.h, g.a] : []) {
        const b = teamCounts.get(String(id)) ?? {}
        const row = teamBuilt.get(`${game}|${id}`)
        for (const n of LATE)
          value(`team ${n}`, `${season} ${game} ${id} ${n}`, row?.[n], b[n] ?? 0, row !== undefined)
        for (const n of college
          ? ['timeouts', ...JUMPS]
          : ['timeouts', 'team_fouls', 'bonus_given']) {
          value(`team ${n}`, `${season} ${game} ${id} ${n}`, row?.[n], b[n] ?? 0, row !== undefined)
        }
      }
    }
  }

  // 2. The league's own words, NBA and WNBA.
  if (!college) {
    const src = `src_${league}_pbp`
    const names = new Map()
    const strip = (s) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.'’]/g, '').trim()
    const roster = new Map()
    for (const r of await read(
      `SELECT pg.game_id, pg.player_id, pg.team_id, p.name FROM player_game pg JOIN player p ON p.player_id = pg.player_id WHERE pg.season = ${season}`
    )) {
      if (!roster.has(r.game_id)) roster.set(r.game_id, [])
      roster
        .get(r.game_id)
        .push({ id: String(r.player_id), team: String(r.team_id), n: strip(r.name) })
    }
    const teams = new Map()
    for (const t of await read(`SELECT team_id, name FROM team WHERE season = ${season}`)) {
      const n = strip(t.name)
      teams.set(String(t.team_id), n)
      names.set(n.split(' ').at(-1), String(t.team_id))
    }
    const w = {
      season,
      jumps: 0,
      jumpsCounted: 0,
      jumpEqual: 0,
      jumpDiffer: 0,
      challenges: 0,
      challengesPlaced: 0,
      chEqual: 0,
      chDiffer: 0,
      textTimeouts: 0,
      textEqual: 0,
      textDiffer: 0,
      bonusPeriods: 0,
      bonusAgree: 0,
      timeoutsNamed: 0
    }
    const jumps = await read(
      `SELECT game_id, description, person_id FROM ${src} WHERE season = ${season} AND action_type ILIKE 'jump%'`
    )
    const teamJumps = new Map()
    for (const r of jumps) {
      const m = /^Jump Ball (.+?) vs\. (.+?)(?:: Tip to (.*))?$/.exec(r.description ?? '')
      const people = roster.get(r.game_id) ?? []
      w.jumps++
      if (!m) continue
      const find = (x) => {
        const k = strip(x)
        if (!k) return []
        const init = /^(.) (.+)$/.exec(k)
        return people.filter(
          (p) =>
            p.n === k ||
            p.n.endsWith(` ${k}`) ||
            (init && p.n.startsWith(init[1]) && p.n.endsWith(` ${init[2]}`))
        )
      }
      const tip = new Set(find(m[3] ?? '').map((p) => p.team))
      const a = people.find((p) => p.id === String(r.person_id))
      const g = gp.get(r.game_id)
      if (tip.size !== 1 || !a || !g) continue
      w.jumpsCounted++
      const winner = [...tip][0]
      for (const t of [String(g.h), String(g.a)]) {
        const k = `${r.game_id}|${t}`
        const c = teamJumps.get(k) ?? { n: 0, won: 0 }
        c.n++
        if (t === winner) c.won++
        teamJumps.set(k, c)
      }
    }
    for (const [k, r] of teamBuilt) {
      const c = teamJumps.get(k) ?? { n: 0, won: 0 }
      if (Number(r.jump_n) === c.n && Number(r.jump_won) === c.won) w.jumpEqual++
      else w.jumpDiffer++
    }
    // Timeouts by the nickname the text names, and challenges by the timeout at their moment.
    const text = await read(
      `SELECT game_id, period, clock, order_index, action_type, sub_type, description FROM ${src} WHERE season = ${season} AND (action_type = 'Timeout' OR (action_type = 'Instant Replay' AND sub_type LIKE 'Coach Challenge%'))`
    )
    const perGame = new Map()
    for (const t of text) {
      if (!perGame.has(t.game_id)) perGame.set(t.game_id, [])
      perGame.get(t.game_id).push(t)
    }
    const nick = (d) => {
      const m = /^(.+?) Timeout:/i.exec(d ?? '')
      if (!m) return null
      const k = strip(m[1])
      const hit = [...teams].filter(([, n]) => n === k || n.endsWith(` ${k}`) || k.endsWith(n))
      return hit.length === 1 ? hit[0][0] : null
    }
    const chTeam = new Map()
    const toTeam = new Map()
    for (const [game, rows] of perGame) {
      if (!gp.has(game)) continue
      rows.sort((x, y) => Number(x.order_index) - Number(y.order_index))
      for (const r of rows) {
        if (r.action_type === 'Timeout') {
          if (['Official', 'Official TV'].includes(String(r.sub_type ?? ''))) continue
          const t = nick(r.description)
          if (t) {
            w.timeoutsNamed++
            const k = `${game}|${t}`
            toTeam.set(k, (toTeam.get(k) ?? 0) + 1)
          }
        } else {
          w.challenges++
          const same = rows.filter(
            (x) =>
              x.action_type === 'Timeout' &&
              x.period === r.period &&
              x.clock === r.clock &&
              nick(x.description)
          )
          if (same.length === 0) continue
          const pick = same.sort(
            (x, y) =>
              Number(y.sub_type === 'Coach Challenge') - Number(x.sub_type === 'Coach Challenge') ||
              Math.abs(Number(x.order_index) - Number(r.order_index)) -
                Math.abs(Number(y.order_index) - Number(r.order_index))
          )[0]
          const t = nick(pick.description)
          w.challengesPlaced++
          const k = `${game}|${t}`
          const c = chTeam.get(k) ?? { n: 0, won: 0 }
          c.n++
          if (/Overturn/.test(r.sub_type)) c.won++
          chTeam.set(k, c)
        }
      }
    }
    for (const [k, r] of teamBuilt) {
      const c = chTeam.get(k) ?? { n: 0, won: 0 }
      if (Number(r.challenges) === c.n && Number(r.challenges_won) === c.won) w.chEqual++
      else w.chDiffer++
      const t = toTeam.get(k) ?? 0
      if (Number(r.timeouts) === t) w.textEqual++
      else {
        w.textDiffer++
        if (w.textDiffer <= 4) console.log(`    timeouts ${k}: built ${r.timeouts}, text ${t}`)
      }
    }
    // The bonus the feed says: a foul's words in the period's last of its kind.
    const pn = await read(
      `SELECT s.game_id, s.period, s.team_id, max(CASE WHEN regexp_matches(s.description, '\\(P[0-9]+\\.PN\\)') THEN 1 ELSE 0 END)::INTEGER AS pn
       FROM ${src} s WHERE s.season = ${season} AND s.action_type = 'Foul' AND s.team_id > 0 GROUP BY 1, 2, 3`
    )
    const says = new Map()
    for (const r of pn)
      if (Number(r.pn) === 1)
        says.set(
          `${r.game_id}|${Math.abs(Number(r.team_id))}`,
          (says.get(`${r.game_id}|${Math.abs(Number(r.team_id))}`) ?? 0) + 1
        )
    for (const [key, r] of teamBuilt) {
      const [game, id] = key.split('|')
      const k = `${game}|${Math.abs(Number(id))}`
      w.bonusPeriods++
      if (Number(r.bonus_given) === (says.get(k) ?? 0)) w.bonusAgree++
      else if (w.bonusPeriods - w.bonusAgree <= 5)
        console.log(`    bonus ${k}: built ${r.bonus_given}, words ${says.get(k) ?? 0}`)
    }
    words.push(w)
    console.log(`  ${season} words: ${JSON.stringify(w)}`)
  }
  // 3. The engine's own answers, every player-season.
  const comp = await read(
    `SELECT p.player_id AS id, sum(b.fga)::DOUBLE AS fga, sum(b.pts)::DOUBLE AS pts FROM player_game b JOIN (SELECT DISTINCT player_id FROM play_player_game WHERE season = ${season}) p USING (player_id) WHERE b.season = ${season} AND b.game_type = 'regular' GROUP BY 1`
  )
  const trips = new Map(
    (
      await read(
        `SELECT player_id AS id, sum(ft_trip2 + ft_trip3 + ft_front)::DOUBLE AS t, sum(ft_techm)::DOUBLE AS tm, sum(go_ahead)::DOUBLE AS ga FROM play_player_game WHERE season = ${season} AND game_type = 'regular' GROUP BY 1`
      )
    ).map((r) => [String(r.id), r])
  )
  const idsOf = comp.map((r) => String(r.id)).filter((id) => Math.abs(Number(id)) < 2 ** 31)
  const res = new Map()
  for (let i = 0; i < idsOf.length; i += 60) {
    const a = await query({
      entity: 'player',
      metrics: ['pbp_sa', 'pbp_psa', 'pbp_ft_trips', 'pbp_go_ahead'],
      scope: { seasons: [season], gameTypes: ['regular'], players: idsOf.slice(i, i + 60) },
      transform: 'raw',
      limit: 200
    })
    for (const r of a.rows) res.set(String(r.id), r)
  }
  for (const r of comp) {
    const id = String(r.id)
    if (Math.abs(Number(id)) >= 2 ** 31) continue
    const t = trips.get(id)
    const g = res.get(id)
    const of = (m) => num(g?.values[m]?.value)
    const close1 = (x, y) =>
      x === null || y === null ? x === y : Math.abs(x - y) < 1e-9 * Math.max(1, Math.abs(y))
    const sa = Number(r.fga) + Number(t?.t ?? 0)
    for (const [name, got, want] of [
      ['engine SA', of('pbp_sa'), sa],
      [
        'engine PSA',
        of('pbp_psa'),
        sa > 0 ? (100 * (Number(r.pts) - Number(t?.tm ?? 0))) / sa : null
      ],
      ['engine trips', of('pbp_ft_trips'), Number(t?.t ?? 0)],
      ['engine go-ahead', of('pbp_go_ahead'), Number(t?.ga ?? 0)]
    ]) {
      if (!all.has(name)) all.set(name, tally())
      const x = all.get(name)
      x.source++
      if (!g) x.absent++
      else if (close1(got, want)) x.equal++
      else {
        x.differ++
        if (x.off.length < 5) x.off.push(`${season} ${id}: engine ${got}, worked ${want}`)
      }
    }
  }
  console.log(`  ${season}: checked ${ids.length} games`)
}
for (const [name, t] of all) {
  console.log(
    `${name}: values ${t.source}: equal ${t.equal}, differ ${t.differ}, no row ${t.absent}`
  )
  for (const o of t.off) console.log(`    ${o}`)
}
await close()
