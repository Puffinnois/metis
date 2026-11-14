#!/usr/bin/env node
// Checks the standings, tiebreakers, play-in and bracket of the season simulation (Plan T1003)
// against the real playoff fields, on a real load. For every completed season the load holds, the
// completed regular season is fed to the code (`src/main/stats/models/standings.ts` and
// `playoffs.ts`, bundled here with esbuild so the code checked is the code that ships), with no
// game left, and compared with:
//
// 1. The published seeds: ESPN's standings `playoffSeed` from 2001-02 (it carries the division
//    winners' protected seeds, 2002-03 and 2005-06 included); before it the NBA's `playoff_rank`
//    (1996-97 to 2000-01) or the league dashboard's (1995-96), which rank by record and do not apply
//    the division winners' seeds, so there only a field and pairing check is exact. None for 1993-94
//    and 1994-95: the pairs alone.
// 2. The playoff field and the first-round pairs actually played (the playoff games: each team's
//    first opponent), after the play-in fed with its real results (2019-20, and from 2020-21).
// 3. The second round: each real second-round series joins the winners of two pairs of the same
//    half of the bracket the code built (one-eight with four-five, two-seven with three-six).
// 4. Home court in each first-round series: the code's side against the host of its first game.
//
// usage: node scripts/check-playoff-field.mjs <folder holding stats.duckdb> [out.md]
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder) {
  console.error('usage: node scripts/check-playoff-field.mjs <folder> [out.md]')
  process.exit(2)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundled = await build({
  stdin: {
    contents: `export * from './src/main/stats/models/standings'
               export * from './src/main/stats/models/playoffs'
               export * from './src/main/stats/models/random'`,
    resolveDir: root,
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const code = bundled.outputFiles[0].text
const M = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const { read, close } = openStatsWorker(folder)
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`)
]
const out = []
const say = (...lines) => {
  for (const l of lines) {
    console.log(l)
    out.push(l)
  }
}

const current = (await read('SELECT max(season) AS s FROM game'))[0].s
const seasons = (
  await read(
    `SELECT season FROM game WHERE game_type = 'playoffs' AND played GROUP BY season
     HAVING season < ${current} ORDER BY season`
  )
).map((r) => r.season)

const rows = []
const misses = []
const playInRows = []
for (const season of seasons) {
  const teams = await read(
    `SELECT team_id, espn_team_id, code, conference, division FROM team WHERE season = ${season}
     ORDER BY team_id`
  )
  const index = new Map(teams.map((t, i) => [Number(t.team_id), i]))
  const code = (i) => teams[i].code
  const league = M.makeLeague(
    teams.map((t) => ({ id: Number(t.team_id), conference: t.conference, division: t.division }))
  )
  const rec = new M.Records(teams.length)
  const games = await read(
    `SELECT home_team_id AS h, away_team_id AS a, home_score - away_score AS m FROM game
     WHERE season = ${season} AND game_type = 'regular' AND played AND home_score <> away_score`
  )
  let skipped = 0
  for (const g of games) {
    const h = index.get(Number(g.h))
    const a = index.get(Number(g.a))
    if (h === undefined || a === undefined) skipped++
    else rec.add(h, a, Number(g.m))
  }
  const rules = M.rulesOf(season)
  const { tb, conferences } = M.seedConferences(league, rec, rules, M.rng(season))

  // The published seeds, by team index: ESPN's seeds from 2001-02 (after the play-in from
  // 2020-21: the play-in's winners seventh and eighth, its last game's loser ninth), and the NBA's
  // `playoff_rank`, by record (before the play-in from 2020-21; with ties unbroken before 2001-02).
  const espnSeed = new Map()
  const nbaRank = new Map()
  if (season >= 2002) {
    const espn = new Map(teams.map((t, i) => [Number(t.espn_team_id), i]))
    const r = await read(
      `SELECT team_id, value FROM src_espn_standings WHERE season = ${season}
       AND stat_name = 'playoffSeed'`
    )
    for (const x of r) espnSeed.set(espn.get(Number(x.team_id)), Number(x.value))
  }
  if (season >= 1996) {
    const t = season >= 1997 ? 'src_nba_standings' : 'src_dash_standings'
    const r = await read(`SELECT team_id, playoff_rank FROM ${t} WHERE season = ${season}`)
    for (const x of r) nbaRank.set(index.get(Number(x.team_id)), Number(x.playoff_rank))
  }
  const source =
    season >= 2021
      ? 'NBA rank; ESPN seed'
      : season >= 2002
        ? 'ESPN seed'
        : season >= 1997
          ? 'NBA rank'
          : season === 1996
            ? 'dashboard rank'
            : 'none'

  // The playoff and play-in games played.
  const post = await read(
    `SELECT game_type, game_date::VARCHAR AS d, game_id, home_team_id AS h, away_team_id AS a,
            home_score > away_score AS hw
     FROM game WHERE season = ${season} AND game_type IN ('playoffs', 'play-in') AND played
     ORDER BY game_date, game_id`
  )
  const playIns = post.filter((g) => g.game_type === 'play-in')
  const playoff = post.filter((g) => g.game_type === 'playoffs')
  // Each team's series in order: the opponents, the first game's host and the winner.
  const seriesOf = new Map()
  for (const g of playoff) {
    const h = index.get(Number(g.h))
    const a = index.get(Number(g.a))
    for (const [t, o] of [
      [h, a],
      [a, h]
    ]) {
      if (!seriesOf.has(t)) seriesOf.set(t, [])
      const list = seriesOf.get(t)
      let s = list.find((x) => x.opp === o)
      if (!s) {
        s = { opp: o, host: h, wins: 0, losses: 0 }
        list.push(s)
      }
      if ((g.hw && t === h) || (!g.hw && t === a)) s.wins++
      else s.losses++
    }
  }
  // The play-in fed with its real results: a pairing that was not played is a miss.
  let playInMissing = []
  const realPlay = (home, away) => {
    const g = playIns.find(
      (x) =>
        (index.get(Number(x.h)) === home && index.get(Number(x.a)) === away) ||
        (index.get(Number(x.h)) === away && index.get(Number(x.a)) === home)
    )
    if (!g) {
      playInMissing.push(`${code(home)}-${code(away)}`)
      return true
    }
    playIns.splice(playIns.indexOf(g), 1)
    return index.get(Number(g.h)) === home ? g.hw : !g.hw
  }

  for (const c of [0, 1]) {
    const conf = c === 0 ? 'East' : 'West'
    const { order } = conferences[c]
    playInMissing = []
    const { bracket, played } = M.playIn(order, rules, rec, realPlay)
    const notes = []

    // 1. Seeds against the published ones, as far as the bracket reaches (ten with the play-in).
    // `ours` in the order compared; a published rank shared by several teams accepts any of them.
    const compare = (ours, published, what) => {
      const differ = []
      ours.forEach((t, i) => {
        const r = published.get(t)
        const tied = [...published].filter(([u, x]) => x === r && league.conference[u] === c).length
        if (r === undefined || i + 1 < r || i + 1 >= r + tied) {
          const want = [...published].find(
            ([u, x]) => x === i + 1 && league.conference[u] === c
          )?.[0]
          differ.push(
            `${what} ${i + 1}: ${code(t)} (published ${want === undefined ? '—' : code(want)})`
          )
        }
      })
      return differ
    }
    let seedState = 'n.a.'
    if (rules.playIn === 'modern') {
      seedState = [
        ...compare(order.slice(0, 10), nbaRank, 'rank'),
        ...compare([...bracket, ...out], espnSeed, 'seed')
      ]
    } else if (espnSeed.size > 0) {
      seedState = compare(order.slice(0, rules.playIn === 'bubble' ? 9 : 8), espnSeed, 'seed')
    } else if (nbaRank.size > 0) {
      // The published rank is the seeds in some seasons and the order by record (the division
      // winners not moved up) in others, with ties left unbroken: it agrees if either of the
      // code's orders matches it. The seeds themselves are checked by the pairs played.
      const asSeeds = compare(order.slice(0, 8), nbaRank, 'rank')
      const byRecord = compare(tb.rank(order).slice(0, 8), nbaRank, 'rank')
      seedState =
        asSeeds.length === 0
          ? 'exact (as seeds)'
          : byRecord.length === 0
            ? 'exact (by record)'
            : asSeeds
    }
    // In the play-in era the play-in games played name the seventh to tenth too: a published rank
    // they contradict is the source's error, and said so.
    if (rules.playIn === 'modern' && Array.isArray(seedState) && playInMissing.length === 0)
      seedState = seedState.map((d) =>
        d.startsWith('rank') ? `${d} [contradicted by the play-in played]` : d
      )
    if (Array.isArray(seedState))
      seedState = seedState.length === 0 ? 'exact' : seedState.join('; ')

    // 2. The field and the first-round pairs.
    const realField = [...seriesOf.keys()].filter(
      (t) => t !== undefined && league.conference[t] === c
    )
    const fieldOk =
      realField.length === 8 && realField.every((t) => bracket.includes(t)) && bracket.length === 8
    const pairs = [
      [0, 7],
      [3, 4],
      [2, 5],
      [1, 6]
    ]
    const pairState = pairs.map(([i, j]) => {
      const first = seriesOf.get(bracket[i])?.[0]
      return first?.opp === bracket[j]
    })
    const pairsOk = pairState.every(Boolean)
    if (!pairsOk)
      notes.push(
        `pairs: ${pairs
          .filter((_, k) => !pairState[k])
          .map(
            ([i, j]) =>
              `${i + 1} ${code(bracket[i])} v ${j + 1} ${code(bracket[j])}, played ${code(seriesOf.get(bracket[i])?.[0]?.opp ?? bracket[i])}`
          )
          .join('; ')}`
      )

    // 3. The second round within the halves.
    const winnerOf = ([i, j]) => {
      const s = seriesOf.get(bracket[i])?.[0]
      return s && s.opp === bracket[j] ? (s.wins > s.losses ? bracket[i] : bracket[j]) : undefined
    }
    const halves = [
      [winnerOf(pairs[0]), winnerOf(pairs[1])],
      [winnerOf(pairs[2]), winnerOf(pairs[3])]
    ]
    const r2Ok = halves.every(([a, b]) => a !== undefined && seriesOf.get(a)?.[1]?.opp === b)

    // 4. Home court in the first round.
    const homeMiss = []
    for (const [i, j] of pairs) {
      const s = seriesOf.get(bracket[i])?.[0]
      if (!s || s.opp !== bracket[j] || rules.neutralPlayoffs) continue
      const [hi] = M.homeCourt(
        { team: bracket[i], seed: i + 1 },
        { team: bracket[j], seed: j + 1 },
        false,
        rules,
        tb
      )
      if (hi.team !== s.host) homeMiss.push(`${code(bracket[i])}-${code(bracket[j])}`)
    }
    if (homeMiss.length) notes.push(`home court: ${homeMiss.join(', ')}`)
    if (playInMissing.length) notes.push(`play-in not played: ${playInMissing.join(', ')}`)
    if (skipped) notes.push(`${skipped} games with a team not in the season's table`)

    if (played.length > 0)
      playInRows.push([
        label(season),
        conf,
        played.map((t) => code(t)).join(', '),
        `${code(bracket[6])}, ${code(bracket[7])}`,
        playInMissing.length === 0 && pairsOk ? 'yes' : 'no'
      ])
    const ok = (b) => (b ? 'yes' : '**no**')
    rows.push([
      label(season),
      conf,
      source,
      seedState.startsWith('exact') || seedState === 'n.a.' ? seedState : `**${seedState}**`,
      ok(fieldOk),
      ok(pairsOk),
      ok(r2Ok),
      homeMiss.length === 0 ? (rules.neutralPlayoffs ? 'n.a. (one site)' : 'yes') : '**no**',
      bracket.map((t) => code(t)).join(' ')
    ])
    if (
      !(seedState.startsWith('exact') || seedState === 'n.a.') ||
      !fieldOk ||
      !pairsOk ||
      !r2Ok ||
      notes.length
    )
      misses.push(
        `- ${label(season)} ${conf}: ${[!seedState.startsWith('exact') && seedState !== 'n.a.' ? `seeds ${seedState}` : '', ...notes].filter(Boolean).join('; ')}`
      )
  }
}

say(`# Playoff field check (Plan T1003)`, '')
say(
  `Seasons ${label(seasons[0])} to ${label(seasons.at(-1))}, the completed regular season fed with no game left.`,
  ''
)
say(
  ...table(
    [
      'Season',
      'Conf.',
      'Published seeds',
      'Seeds',
      'Field',
      'Pairs',
      'Second round',
      'Home court',
      'Bracket 1–8'
    ],
    rows
  ),
  ''
)
if (playInRows.length) {
  say('## The play-in, fed with its real results', '')
  say(
    ...table(['Season', 'Conf.', 'Played', 'Seeds 7, 8', 'Matches the first round'], playInRows),
    ''
  )
}
say('## Differences', '', ...(misses.length ? misses : ['None.']), '')
if (mdFile) writeFileSync(mdFile, out.join('\n') + '\n')
await close()
