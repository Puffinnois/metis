#!/usr/bin/env node
// Recounts every player's highs, streaks and threshold games (Plan T1703.3) on a real load, from the
// game rows' side: each is compared with what the app works out from `stats.playerGames`, for every
// player and season the file holds and every career, in the regular season, the playoffs and every
// counted game. The highs and the threshold counts are recounted by SQL over `player_game`, the streaks
// by a plain procedural pass over each player's games in order, neither sharing code with the app's.
// A value is counted as equal, differing, blank (the app has none) or no row (the app has no game of
// that season), and one the app gives where the rows have none as extra. Prints a season's line only
// where something is not equal. Read only. Build first: npm run build.
// usage: node scripts/check-highs.mjs <folder> [--league=nba|wnba|ncaam|ncaaw]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder] = positional()
const league = leagueArg()
if (!folder) {
  console.error('usage: node scripts/check-highs.mjs <folder> [--league=nba|wnba|ncaam|ncaaw]')
  process.exit(1)
}
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (file) =>
  import(
    `data:text/javascript,${encodeURIComponent(
      ts.transpileModule(readFileSync(join(ROOT, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText
    )}`
  )
// The app's own code, which imports only types: what is checked.
const { highOf, HIGHS, STREAKS, streakOf, tallyOf, THRESHOLDS } = await load(
  'src/shared/stats/highs.ts'
)
const { LEAGUES } = await load('src/shared/leagues.ts')
const counted = LEAGUES[league].countedTypes
const SCOPES = [
  ['regular season', ['regular']],
  ['playoffs', ['playoffs']],
  ['every counted game', counted]
]

// More memory than the app's worker has: the recounts sort every line of the file at once.
const { read, call, close } = openStatsWorker(folder, { league, memoryLimit: '4GB' })
const num = (x) => (x === null || x === undefined ? null : Number(x))
const inTypes = (types) => `game_type IN (${types.map((t) => `'${t}'`).join(', ')})`

// ---------------------------------------------------------------- the recounts, from the game rows

/** Each player's best of each count, by season and career: the value, how often, the latest game. */
async function highsBySql(types) {
  const out = new Map()
  // One count at a time: all thirteen at once outgrow the memory the worker is given.
  for (const { count } of HIGHS) {
    const rows = await read(`
      WITH lines AS (
        SELECT player_id, season, game_id, strftime(game_date, '%Y-%m-%d') AS day, ${count}::INTEGER AS v
        FROM player_game WHERE ${inTypes(types)} AND ${count} IS NOT NULL
      ), best AS (
        SELECT player_id, season, max(v) AS v, count(*) AS known
        FROM lines GROUP BY GROUPING SETS ((player_id, season), (player_id))
      )
      SELECT b.player_id::VARCHAR AS player, b.season, any_value(b.v) AS v,
             any_value(b.known)::INTEGER AS known, count(*)::INTEGER AS times,
             max(l.day || '|' || l.game_id) AS latest
      FROM best b
      JOIN lines l ON l.player_id = b.player_id AND l.v = b.v
                  AND (b.season IS NULL OR l.season = b.season)
      GROUP BY b.player_id, b.season`)
    for (const r of rows) {
      out.set(`${r.player}|${r.season ?? 'career'}|${count}`, {
        v: num(r.v),
        known: num(r.known),
        times: num(r.times),
        latest: r.latest
      })
    }
  }
  return out
}

const TENS = ['pts', 'reb', 'ast', 'stl', 'blk']
const TEN_SURE = TENS.map((c) => `(coalesce(${c}, 0) >= 10)::INTEGER`).join(' + ')
const TEN_BLANK = TENS.map((c) => `(${c} IS NULL)::INTEGER`).join(' + ')
/** A threshold's SQL, written by hand from its name: [yes, cannot say]. */
function thresholdSql(id) {
  if (id === 'dd2' || id === 'td3') {
    const n = id === 'dd2' ? 2 : 3
    return [`${TEN_SURE} >= ${n}`, `${TEN_SURE} < ${n} AND ${TEN_SURE} + ${TEN_BLANK} >= ${n}`]
  }
  const [, column, least] = id.match(/^([a-z]+(?:3m)?)(\d+)$/)
  return [`${column} >= ${least}`, `${column} IS NULL`]
}

async function thresholdsBySql(types) {
  const rows = await read(`
    SELECT player_id::VARCHAR AS player, season, count(*)::INTEGER AS n,
           coalesce(sum(dd2), 0)::INTEGER AS stored_dd, coalesce(sum(td3), 0)::INTEGER AS stored_td,
           ${THRESHOLDS.map((f) => {
             const [yes, unknown] = thresholdSql(f.id)
             return `count(*) FILTER (WHERE ${yes})::INTEGER AS "yes_${f.id}",
                     count(*) FILTER (WHERE ${unknown})::INTEGER AS "unk_${f.id}"`
           }).join(', ')}
    FROM player_game WHERE ${inTypes(types)}
    GROUP BY GROUPING SETS ((player_id, season), (player_id))`)
  return new Map(rows.map((r) => [`${r.player}|${r.season ?? 'career'}`, r]))
}

const SEQUENCE_COLUMNS = ['pts', 'reb', 'ast', 'stl', 'blk', 'fg3m']
const BATCH = 60000

/** Each player's games in order, the counts the streaks read as arrays, from plain ordered rows. */
async function sequences(types) {
  const out = new Map()
  for (let offset = 0; ; offset += BATCH) {
    const rows = await read(`
      SELECT player_id::VARCHAR AS player, season, game_id, ${SEQUENCE_COLUMNS.join(', ')}
      FROM player_game WHERE ${inTypes(types)}
      ORDER BY player_id, game_date, game_id LIMIT ${BATCH} OFFSET ${offset}`)
    for (const r of rows) {
      if (!out.has(r.player)) {
        out.set(r.player, {
          seasons: [],
          games: [],
          ...Object.fromEntries(SEQUENCE_COLUMNS.map((c) => [c, []]))
        })
      }
      const seq = out.get(r.player)
      seq.seasons.push(num(r.season))
      seq.games.push(r.game_id)
      for (const c of SEQUENCE_COLUMNS) seq[c].push(num(r[c]))
    }
    if (rows.length < BATCH) return out
  }
}

/** One character a game: 1 did it, 0 did not, x cannot say. Written from the streak's name alone. */
function marks(id, row) {
  const list = (c) => row[c]
  if (id === 'dd2' || id === 'td3') {
    const n = id === 'dd2' ? 2 : 3
    const columns = TENS.map(list)
    return columns[0].map((_, i) => {
      let sure = 0
      let blank = 0
      for (const c of columns) {
        if (c[i] === null) blank++
        else if (c[i] > 9) sure++
      }
      return sure >= n ? '1' : sure + blank >= n ? 'x' : '0'
    })
  }
  const [, column, least] = id.match(/^([a-z]+(?:3m)?)(\d+)$/)
  return list(column).map((v) => (v === null ? 'x' : v >= Number(least) ? '1' : '0'))
}

/** The longest run of ones, its latest place, and the run at the end. */
function runsOf(chars, games) {
  const text = chars.join('')
  const length = Math.max(0, ...text.split(/[^1]+/).map((s) => s.length))
  const at = length > 0 ? text.lastIndexOf('1'.repeat(length)) : -1
  const tail = text.match(/1*$/)[0].length
  return {
    longest: length,
    from: at < 0 ? null : games[at],
    to: at < 0 ? null : games[at + length - 1],
    last: tail,
    lastFrom: tail ? games[games.length - tail] : null
  }
}

// ------------------------------------------------------------------------------- the comparison

function tally(name) {
  const seasons = new Map()
  const off = []
  const at = (season) => {
    if (!seasons.has(season)) {
      seasons.set(season, { rows: 0, equal: 0, differ: 0, blank: 0, absent: 0, extra: 0 })
    }
    return seasons.get(season)
  }
  return {
    /** `mine` undefined: the app has no game of that season; null: it gives no value. */
    value(season, id, theirs, mine) {
      const c = at(season)
      if (theirs === null) {
        if (mine !== null && mine !== undefined) {
          c.extra++
          if (off.length < 6) off.push(`${id}: rows have none, app ${mine}`)
        }
        return
      }
      c.rows++
      if (mine === undefined) c.absent++
      else if (mine === null) c.blank++
      else if (mine === theirs) c.equal++
      else c.differ++
      if (mine !== theirs && off.length < 6) off.push(`${id}: rows ${theirs}, app ${mine}`)
    },
    print() {
      const t = { rows: 0, equal: 0, differ: 0, blank: 0, absent: 0, extra: 0 }
      for (const c of seasons.values()) for (const k of Object.keys(t)) t[k] += c[k]
      const line = (label, c) =>
        console.log(
          `${label}: ${c.rows} from the rows, ${c.equal} equal, ${c.differ} differing, ${c.blank} blank, ${c.absent} no row, ${c.extra} extra`
        )
      const numbered = [...seasons.keys()].filter((s) => s !== 'career').sort((a, b) => a - b)
      line(`  ${name} (${numbered[0]} to ${numbered.at(-1)} and careers)`, t)
      for (const [season, c] of [...seasons].sort()) {
        if (c.equal !== c.rows || c.extra) line(`    ${season}`, c)
      }
      for (const o of off) console.log(`      ${o}`)
      return t
    }
  }
}

const players = (
  await read('SELECT DISTINCT player_id::VARCHAR AS id FROM player_game ORDER BY 1')
).map((r) => r.id)
const held = num((await read('SELECT count(*) AS n FROM player_game'))[0].n)
console.log(`${league}: ${players.length} players, ${held} game lines`)

// Every player's lines through the app's read, timed.
const lines = new Map()
const took = []
let given = 0
for (const id of players) {
  const t0 = performance.now()
  const answer = await call('playerGames', { player: id })
  took.push([performance.now() - t0, id, answer.games.length])
  given += answer.games.length
  lines.set(id, answer.games)
}
took.sort((a, b) => a[0] - b[0])
const ms = (i) => took[Math.min(took.length - 1, Math.floor(i))]?.[0].toFixed(1)
console.log(
  `lines given by stats.playerGames: ${given} of ${held} · read: median ${ms(took.length / 2)} ms, 95th ${ms(took.length * 0.95)}, slowest ${ms(took.length - 1)} (${took.at(-1)?.[1]}, ${took.at(-1)?.[2]} games)`
)

for (const [label, types] of SCOPES) {
  console.log(label)
  const byHigh = await highsBySql(types)
  const byThreshold = await thresholdsBySql(types)
  const bySequence = await sequences(types)
  const values = tally('highs, their value')
  const times = tally('highs, the games that reached them')
  const latest = tally('highs, the latest of those games')
  const lacking = tally('highs, the games with no count')
  const overs = tally('threshold games')
  const unknowns = tally('threshold games, those that cannot say')
  const stored = tally('double- and triple-doubles against the stored dd2 and td3')
  const longest = tally('streaks, the longest')
  const place = tally('streaks, the longest one’s first and last game')
  const current = tally('streaks, the one the last game stands in')

  for (const [key, row] of byThreshold) {
    const [player, at] = key.split('|')
    const season = at === 'career' ? 'career' : Number(at)
    const all = lines.get(player).filter((g) => types.includes(g.gameType))
    const games = season === 'career' ? all : all.filter((g) => g.season === season)
    const none = games.length === 0

    for (const { count, metric } of HIGHS) {
      const sql = byHigh.get(`${player}|${at}|${count}`)
      const app = none ? undefined : highOf(games, count)
      const id = `${player} ${at} ${metric}`
      const of = (x) => (app === undefined ? undefined : app === null ? null : x(app))
      values.value(
        season,
        id,
        sql?.v ?? null,
        of((h) => h.value)
      )
      times.value(
        season,
        id,
        sql?.times ?? null,
        of((h) => h.times)
      )
      latest.value(
        season,
        id,
        sql?.latest ?? null,
        of((h) => `${h.game.date}|${h.game.gameId}`)
      )
      if (sql)
        lacking.value(
          season,
          id,
          num(row.n) - sql.known,
          of((h) => h.unknown)
        )
    }
    for (const feat of THRESHOLDS) {
      const app = none ? undefined : tallyOf(games, feat)
      const id = `${player} ${at} ${feat.id}`
      overs.value(season, id, num(row[`yes_${feat.id}`]), app?.games)
      unknowns.value(season, id, num(row[`unk_${feat.id}`]), app?.unknown)
      if (feat.id === 'dd2') stored.value(season, id, num(row.stored_dd), app?.games)
      if (feat.id === 'td3') stored.value(season, id, num(row.stored_td), app?.games)
    }

    const seq = bySequence.get(player)
    const { games: ids, seasons: when } = seq
    const keep = ids.map((_, i) => season === 'career' || when[i] === season)
    for (const feat of STREAKS) {
      const plain = runsOf(
        marks(feat.id, seq).filter((_, i) => keep[i]),
        ids.filter((_, i) => keep[i])
      )
      const app = none ? undefined : streakOf(games, feat)
      const id = `${player} ${at} ${feat.id}`
      const of = (x) => (app === undefined ? undefined : x(app))
      longest.value(
        season,
        id,
        plain.longest,
        of((s) => s.longest?.length ?? 0)
      )
      place.value(
        season,
        id,
        plain.from === null ? null : `${plain.from}–${plain.to}`,
        of((s) => (s.longest ? `${s.longest.from.gameId}–${s.longest.to.gameId}` : null))
      )
      current.value(
        season,
        id,
        `${plain.last} ${plain.lastFrom}`,
        of((s) => `${s.last?.length ?? 0} ${s.last?.from.gameId ?? null}`)
      )
    }
  }
  for (const t of [
    values,
    times,
    latest,
    lacking,
    overs,
    unknowns,
    stored,
    longest,
    place,
    current
  ]) {
    t.print()
  }
}
await close()
