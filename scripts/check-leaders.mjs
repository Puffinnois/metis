#!/usr/bin/env node
// Checks the leaderboards' qualified leaders against the NBA's (Plan T1204). The dataset has no list
// of the NBA's published leaders, so they are ranked here from the NBA's own season totals
// (`src_nba_player_season`, 1996-97 on) by the NBA's minimums, twice: by the rule Metis applies (D33,
// the NBA's since 2013-14, scaled to each season's games) and by the NBA's rule of that season, as
// `docs/reference/nba-qualifying-minimums.md` lists it. The engine's side is a real query, as the
// leaderboard asks it: each statistic sorted, with Qualified only on, so each qualifies by its own
// minimum. Minutes per game is the leaderboards' row qualifier and stays on 1,000 minutes (D33).
//
// usage: node scripts/check-leaders.mjs <folder holding stats.duckdb> [out.md] [seasons, comma-separated]
// Build first with `npm run build`.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folderArg, mdArg, seasonsArg] = process.argv.slice(2)
if (!folderArg) {
  console.error('usage: node scripts/check-leaders.mjs <folder> [out.md] [seasons]')
  process.exit(2)
}
const folder = resolve(folderArg)
const SEASONS = (seasonsArg ?? '1997,1999,2005,2012,2016,2020,2021,2024,2026,2027')
  .split(',')
  .map(Number)
const CURRENT = Math.max(...SEASONS)
const TOP = 5

const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`

/** Per-game leaders, with the total that qualified instead of games before 2013-14. */
const PER_GAME = [
  { id: 'pts', col: 'pts', total: 1400, short: 'PTS' },
  { id: 'reb', col: 'reb', total: 800, short: 'REB' },
  { id: 'ast', col: 'ast', total: 400, short: 'AST' },
  { id: 'stl', col: 'stl', total: 125, short: 'STL' },
  { id: 'blk', col: 'blk', total: 100, short: 'BLK' },
  { id: 'min', col: 'min', total: 2000, short: 'MIN' }
]
const RATES = [
  { id: 'fg_pct', made: 'fgm', att: 'fga', min: 300, short: 'FG%' },
  { id: 'fg3_pct', made: 'fg3m', att: 'fg3a', min: 82, short: '3P%' },
  { id: 'ft_pct', made: 'ftm', att: 'fta', min: 125, short: 'FT%' }
]

/** The NBA's 3P% minimum by season, from the reference. */
function threesOfEra(season) {
  if (season <= 1994) return 50
  if (season <= 1997) return 82
  if (season === 1999) return 34
  if (season === 2012) return 44
  if (season <= 2013) return 55
  return 82
}

/**
 * Whether a published line qualifies by the NBA's rule of its season. Before 2013-14: games or a
 * total, with the shortened seasons' own numbers; 2019-20 and 2020-21 "on pace", prorated by the
 * games a team played; otherwise 58 games and the makes.
 */
function qualifiesInEra(p, stat, season, teamGames, inProgress) {
  const short = { 1999: 50, 2012: 66 }[season]
  const scale = short ? short / 82 : 1
  const round = (x) => Math.round(x * scale)
  // A season in progress is held to the pace of the games played so far.
  const onPace = season === 2020 || season === 2021 || inProgress ? teamGames / 82 : 1
  if (stat.col) {
    if (season <= 2013) return p.gp >= round(70) || p[stat.col] >= round(stat.total)
    return p.gp >= 58 * onPace
  }
  const need = stat.made === 'fg3m' ? threesOfEra(season) : stat.min
  return p[stat.made] >= (short ? round(need) : need * onPace)
}

/**
 * By the rule Metis applies: the minimum scaled to the season's games and rounded, as the engine does.
 * Minutes per game is the row qualifier, on 1,000 minutes.
 */
function qualifiesInMetis(p, stat, teamGames) {
  const factor = teamGames / 82
  if (stat.id === 'min') return p.min >= Math.round(1000 * factor)
  return stat.col ? p.gp >= Math.round(58 * factor) : p[stat.made] >= Math.round(stat.min * factor)
}

const valueOf = (p, stat) =>
  stat.col ? p[stat.col] / p.gp : p[stat.att] > 0 ? p[stat.made] / p[stat.att] : null

function ranked(lines, stat, keep) {
  return lines
    .filter((p) => p.gp > 0 && keep(p))
    .map((p) => ({ id: String(p.player_id), name: p.player_name, value: valueOf(p, stat) }))
    .filter((r) => r.value !== null)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

const { read, query, close } = openStatsWorker(folder)

/** The team games a team played in a season, on average, as the engine counts them. */
const games = new Map(
  (
    await read(`SELECT season, count(*)::DOUBLE / count(DISTINCT team_id) AS g FROM team_game
      WHERE game_type = 'regular' GROUP BY season`)
  ).map((r) => [Number(r.season), Number(r.g)])
)

async function engineTop(stat, season) {
  const r = await query({
    entity: 'player',
    metrics: [stat.id],
    scope: { seasons: [season], qualifiedOnly: true },
    transform: stat.col ? 'perGame' : 'raw',
    limit: 50
  })
  return r.rows
    .filter((x) => x.values[stat.id].value !== null)
    .map((x) => ({ id: x.id, name: x.name, value: x.values[stat.id].value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

const fmt = (stat, v) => (stat.col ? v.toFixed(1) : (100 * v).toFixed(1))
const sameTop = (a, b, n) =>
  a.slice(0, n).every((x, i) => b[i]?.id === x.id) && a.length >= n && b.length >= n

const out = []
const summary = { leaders: 0, leadersMetis: 0, leadersEra: 0, top5Metis: 0, top5Era: 0 }
// Minutes per game stays on the row qualifier's 1,000 minutes (D33): how often 58 games, the NBA's
// rule for it, would name another leader or top five, from the NBA's own totals.
const mpg = []
const misses = []
for (const season of SEASONS) {
  const teamGames = games.get(season)
  const lines = await read(`SELECT player_id, any_value(player_name) AS player_name,
      max(gp) AS gp, max(min) AS min, max(pts) AS pts, max(reb) AS reb, max(ast) AS ast,
      max(stl) AS stl, max(blk) AS blk, max(fgm) AS fgm, max(fga) AS fga, max(fg3m) AS fg3m,
      max(fg3a) AS fg3a, max(ftm) AS ftm, max(fta) AS fta
    FROM src_nba_player_season
    WHERE season = ${season} AND per_mode = 'totals' AND measure_type = 'base'
      AND season_type = 'regular-season'
    GROUP BY player_id`)
  out.push(
    '',
    `**${label(season)}** (${teamGames.toFixed(1)} team games${season === CURRENT ? ', in progress' : ''})`,
    '',
    '| Stat | Leader here | Value | NBA totals, Metis rule: leader, top 5 | NBA totals, rule of the season: leader, top 5 |',
    '| --- | --- | --- | --- | --- |'
  )
  for (const stat of [...PER_GAME, ...RATES]) {
    const ours = await engineTop(stat, season)
    const metis = ranked(lines, stat, (p) => qualifiesInMetis(p, stat, teamGames))
    const era = ranked(lines, stat, (p) =>
      qualifiesInEra(p, stat, season, teamGames, season === CURRENT)
    )
    const lead = ours[0]
    const mark = (list) => {
      const one = list[0]?.id === lead?.id
      const five = sameTop(ours, list, TOP)
      return [one, five]
    }
    const [m1, m5] = mark(metis)
    const [e1, e5] = mark(era)
    summary.leaders++
    if (m1) summary.leadersMetis++
    if (e1) summary.leadersEra++
    if (m5) summary.top5Metis++
    if (e5) summary.top5Era++
    const word = (one, five, list) =>
      `${one ? 'same' : `**${list[0]?.name ?? 'none'}** ${list[0] ? fmt(stat, list[0].value) : ''}`}, ${five ? 'same' : '**differs**'}`
    if (!m1 || !e1 || !m5 || !e5) {
      misses.push({
        season,
        stat: stat.short,
        ours: ours.slice(0, TOP).map((x) => `${x.name} ${fmt(stat, x.value)}`),
        metis: metis.slice(0, TOP).map((x) => `${x.name} ${fmt(stat, x.value)}`),
        era: era.slice(0, TOP).map((x) => `${x.name} ${fmt(stat, x.value)}`)
      })
    }
    if (stat.id === 'min') {
      const games = ranked(lines, stat, (p) => p.gp >= Math.round((58 * teamGames) / 82))
      const name = (x) => (x ? `${x.name} ${fmt(stat, x.value)}` : 'none')
      mpg.push({
        season,
        minutes: name(metis[0]),
        games: name(games[0]),
        leader: metis[0]?.id === games[0]?.id,
        top5: sameTop(metis, games, TOP)
      })
    }
    out.push(
      `| ${stat.short} | ${lead?.name ?? 'none'} | ${lead ? fmt(stat, lead.value) : ''} | ${word(m1, m5, metis)} | ${word(e1, e5, era)} |`
    )
  }
}
await close()

const head = [
  `Seasons: ${SEASONS.map(label).join(', ')}. ${summary.leaders} leaders: the same as the NBA's totals ranked by Metis's rule in ${summary.leadersMetis}, top five in the same order in ${summary.top5Metis}; by the NBA's rule of the season, ${summary.leadersEra} and ${summary.top5Era}.`
]
const mpgTable = [
  '',
  `**Minutes per game, 1,000 minutes against 58 games** (both scaled to the season's games and rounded, from the NBA's totals): the same leader in ${mpg.filter((m) => m.leader).length} of ${mpg.length} seasons, the same top five in ${mpg.filter((m) => m.top5).length}.`,
  '',
  '| Season | Leader on 1,000 minutes | Leader on 58 games | Same leader | Same top five |',
  '| --- | --- | --- | --- | --- |',
  ...mpg.map(
    (m) =>
      `| ${label(m.season)} | ${m.minutes} | ${m.games} | ${m.leader ? 'yes' : '**no**'} | ${m.top5 ? 'yes' : '**no**'} |`
  )
]
const md = [...head, ...out, ...mpgTable, ''].join('\n')
if (mdArg) writeFileSync(resolve(mdArg), md)
console.log(md)
console.error(JSON.stringify(misses, null, 1))
