#!/usr/bin/env node
// Checks published values on a real load from the SOURCE's side (how a check counts: stats-database.md,
// "Measuring a real load"): every source row of every season the file holds is compared with what the
// engine answers through the built worker, read only, and each source value is counted as equal,
// differing, blank (the engine's row has no value) or with no engine row. A source value the engine does
// not give is never skipped, and the seasons are read from the file and printed. Prints a season's line
// only where something is not equal, and the last season's always. Build first: npm run build.
// usage: node scripts/check-published.mjs <folder> [--league=nba|wnba] [family ...]
// families: impact (BOBAN, the box prior and REML RAPM), fantasy (the two published columns), records
// (the standings' records and streaks), current (the weekly current impact, NBA), raptor (NBA), rolling
// (the rolling windows, filled and not).
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const [folder, ...only] = positional()
const league = leagueArg()
if (!folder || !['nba', 'wnba'].includes(league)) {
  console.error('usage: node scripts/check-published.mjs <folder> [--league=nba|wnba] [family ...]')
  process.exit(1)
}
const { read, query, close } = openStatsWorker(folder, { league })
const num = (x) => (x === null || x === undefined ? null : Number(x))
const want = (family) => only.length === 0 || only.includes(family)

/** One family's counts, by season: every source value is equal, different, or one the engine lacks. */
function tally(name) {
  const t = { name, seasons: new Map(), off: [], lacks: new Map() }
  const at = (season) => {
    if (!t.seasons.has(season)) {
      t.seasons.set(season, { source: 0, equal: 0, differ: 0, blank: 0, absent: 0, extra: 0 })
    }
    return t.seasons.get(season)
  }
  return {
    t,
    // `engine` is undefined for no row, null for a row with no value; `source` null for a blank source.
    value(season, id, metric, engine, source, tolerance) {
      const c = at(season)
      if (source === null) {
        if (engine !== undefined && engine !== null) {
          c.extra++
          if (t.off.length < 6)
            t.off.push(`${id} ${season} ${metric}: engine ${engine}, source blank`)
        }
        return
      }
      c.source++
      if (engine === undefined) c.absent++
      else if (engine === null) c.blank++
      else if (Math.abs(engine - source) <= tolerance * Math.max(1, Math.abs(source))) c.equal++
      else {
        c.differ++
        if (t.off.length < 6)
          t.off.push(`${id} ${season} ${metric}: engine ${engine}, source ${source}`)
      }
      if (engine === undefined || engine === null) {
        const key = `${season} ${id}`
        t.lacks.set(key, (t.lacks.get(key) ?? 0) + 1)
      }
    }
  }
}

function report({ t }) {
  const sum = { source: 0, equal: 0, differ: 0, blank: 0, absent: 0, extra: 0 }
  for (const c of t.seasons.values()) for (const k of Object.keys(sum)) sum[k] += c[k]
  const seasons = [...t.seasons.keys()].sort((a, b) => a - b)
  console.log(
    `\n## ${league} ${t.name}: seasons ${seasons[0]} to ${seasons.at(-1)} (${seasons.length})`
  )
  console.log(
    `source values ${sum.source}: equal ${sum.equal}, differ ${sum.differ}, blank ${sum.blank}, no engine row ${sum.absent}; engine value with no source value ${sum.extra}`
  )
  for (const season of seasons) {
    const c = t.seasons.get(season)
    if (c.differ + c.absent + c.blank + c.extra > 0 || season === seasons.at(-1)) {
      console.log(
        `  ${season}: source ${c.source}, equal ${c.equal}, differ ${c.differ}, blank ${c.blank}, no engine row ${c.absent}, extra ${c.extra}`
      )
    }
  }
  for (const line of t.off) console.log(`  - ${line}`)
  const lacks = [...t.lacks].slice(0, 8).map(([k, v]) => `${k} (${v})`)
  if (t.lacks.size > 0)
    console.log(`  source rows the engine lacks a value for: ${t.lacks.size}: ${lacks.join(', ')}`)
}

/** The engine's values by id for one season. A query that reached its limit would hide rows, so it fails. */
async function engine(entity, metrics, season, gameTypes, extra = {}) {
  const res = await query({
    entity,
    metrics,
    scope: { seasons: [season], gameTypes },
    limit: 5000,
    ...extra
  })
  if (res.rows.length >= 5000) throw new Error(`${season}: the query's limit was reached`)
  return new Map(
    res.rows.map((r) => [
      String(r.id),
      Object.fromEntries(metrics.map((m) => [m, num(r.values[m]?.value)]))
    ])
  )
}
const seasonsOf = async (sql) =>
  (await read(`SELECT DISTINCT season AS s FROM (${sql}) ORDER BY 1`)).map((r) => Number(r.s))

// BOBAN, the box prior and REML RAPM: the impact file's regular-season rows, read one season at a time.
if (want('impact')) {
  const boban = [
    ['sdv_boban_skill', 'boban_filtered_skill'],
    ['sdv_boban_next', 'boban_projected_rating'],
    ['sdv_boban_sd', 'boban_projected_sd']
  ]
  const prior = [
    ['sdv_box_prior', 'box_prior'],
    ['sdv_o_box_prior', 'o_box_prior'],
    ['sdv_d_box_prior', 'd_box_prior'],
    ['sdv_reml_rapm', 'reml_rapm'],
    ['sdv_o_reml_rapm', 'o_reml_rapm'],
    ['sdv_d_reml_rapm', 'd_reml_rapm']
  ]
  const cols = league === 'nba' ? [...boban, ...prior] : boban
  const from = `src_${league}_impact WHERE lower(season_type) = 'regular season'`
  const t = tally('BOBAN, the box prior and REML RAPM')
  for (const season of await seasonsOf(`SELECT season FROM ${from}`)) {
    const e = await engine(
      'player',
      cols.map(([m]) => m),
      season,
      ['regular']
    )
    for (const r of await read(
      `SELECT player_id, ${cols.map(([, c]) => c).join(', ')} FROM ${from} AND season = ${season}`
    )) {
      for (const [m, c] of cols) {
        t.value(season, r.player_id, m, e.get(String(r.player_id))?.[m], num(r[c]), 1e-12)
      }
    }
  }
  report(t)
}

// The two published fantasy columns, the formulas' own agreement apart (it compares two sources).
if (want('fantasy')) {
  const cols = [
    ['nba_fantasy_pts', 'nba_fantasy_pts'],
    ['nba_wnba_fantasy_pts', 'wnba_fantasy_pts']
  ]
  const t = tally('published fantasy points')
  for (const [type, label] of [
    ['regular', 'regular season'],
    ['playoffs', 'playoffs']
  ]) {
    const from = `src_dash_player_stats_base WHERE lower(season_type) = '${label}'`
    for (const season of await seasonsOf(`SELECT season FROM ${from}`)) {
      const e = await engine(
        'player',
        cols.map(([m]) => m),
        season,
        [type],
        { transform: 'raw' }
      )
      // A traded player has a row per team; the engine's row is the player's.
      const rows = await read(
        `SELECT player_id, sum(nba_fantasy_pts) AS nba_fantasy_pts, sum(wnba_fantasy_pts) AS wnba_fantasy_pts FROM ${from} AND season = ${season} GROUP BY 1`
      )
      for (const r of rows) {
        for (const [m, c] of cols) {
          t.value(
            season,
            `${r.player_id}/${type}`,
            m,
            e.get(String(r.player_id))?.[m],
            num(r[c]),
            1e-9
          )
        }
      }
    }
  }
  report(t)
}

// The standings' records by situation and longest streaks.
if (want('records')) {
  const RECORDS = [
    ['close', 'three_pts_or_less'],
    ['blowout', 'ten_pts_or_more'],
    ['ot', 'ot'],
    ['ahead_half', 'ahead_at_half'],
    ['behind_half', 'behind_at_half'],
    ['tied_half', 'tied_at_half'],
    ['ahead_third', 'ahead_at_third'],
    ['behind_third', 'behind_at_third'],
    ['tied_third', 'tied_at_third'],
    ['score100', 'score100_pts'],
    ['opp100', 'opp_score100_pts'],
    ['score80', 'score_80_plus'],
    ['opp80', 'opp_score_80_plus'],
    ['below80', 'score_below_80'],
    ['opp_below80', 'opp_score_below_80'],
    ['vs_winning', 'opp_over500'],
    ['won_fg', 'lead_in_fgpct'],
    ['won_reb', 'lead_in_reb'],
    ['fewer_tov', 'fewer_turnovers']
  ]
  const STREAKS = [
    ['win', 'long_win_streak'],
    ['loss', 'long_loss_streak'],
    ['home', 'long_home_streak'],
    ['road', 'long_road_streak']
  ]
  const ids = [
    ...RECORDS.map(([k]) => `team_rec_${k}`),
    ...STREAKS.map(([k]) => `team_long_${k}_streak`)
  ]
  const t = tally('records by situation and streaks')
  for (const season of await seasonsOf('SELECT season FROM src_dash_standings')) {
    const got = await engine('team', ids, season, ['regular'], { transform: 'raw' })
    const e = new Map([...got].map(([id, v]) => [String(Math.abs(Number(id))), v]))
    for (const r of await read(
      `SELECT team_id, ${[...RECORDS, ...STREAKS].map(([, c]) => c).join(', ')} FROM src_dash_standings WHERE season = ${season}`
    )) {
      const id = String(Math.abs(Number(r.team_id)))
      for (const [k, c] of RECORDS) {
        // Stored as wins, losses and the games of both; the text is "5-4", and an empty one reads NULL.
        const text = String(r[c] ?? '').trim()
        const [w, l] = text.split('-').map(Number)
        t.value(
          season,
          id,
          `team_rec_${k}`,
          e.get(id)?.[`team_rec_${k}`],
          text && w + l > 0 ? w / (w + l) : null,
          1e-9
        )
      }
      for (const [k, c] of STREAKS) {
        t.value(
          season,
          id,
          `team_long_${k}_streak`,
          e.get(id)?.[`team_long_${k}_streak`],
          num(r[c]),
          0
        )
      }
    }
  }
  report(t)
}

// The weekly current impact: the last week of each player-season, and the first.
if (want('current') && league === 'nba') {
  const pick = (order) =>
    `SELECT * FROM src_nba_current_impact QUALIFY row_number() OVER (PARTITION BY player_id, season ORDER BY as_of ${order}) = 1`
  const sum = (r) =>
    r.o_prior === null || r.d_prior === null ? null : num(r.o_prior) + num(r.d_prior)
  const cols = [
    ['sdv_current_impact', 'DESC', (r) => num(r.current_impact)],
    ['sdv_o_current_impact', 'DESC', (r) => num(r.o_current_impact)],
    ['sdv_d_current_impact', 'DESC', (r) => num(r.d_current_impact)],
    ['sdv_current_prior', 'DESC', sum],
    ['sdv_o_current_prior', 'DESC', (r) => num(r.o_prior)],
    ['sdv_d_current_prior', 'DESC', (r) => num(r.d_prior)],
    ['sdv_expected_impact', 'ASC', (r) => num(r.current_impact)],
    ['sdv_o_expected_impact', 'ASC', (r) => num(r.o_current_impact)],
    ['sdv_d_expected_impact', 'ASC', (r) => num(r.d_current_impact)]
  ]
  const t = tally('current and expected impact, on the boards')
  for (const season of await seasonsOf('SELECT season FROM src_nba_current_impact')) {
    const e = await engine(
      'player',
      cols.map(([m]) => m),
      season,
      ['regular']
    )
    for (const order of ['DESC', 'ASC']) {
      for (const r of await read(`SELECT * FROM (${pick(order)}) WHERE season = ${season}`)) {
        for (const [m, o, f] of cols) {
          if (o === order)
            t.value(season, r.player_id, m, e.get(String(r.player_id))?.[m], f(r), 1e-9)
        }
      }
    }
  }
  report(t)
  // The built tables themselves, every player-season, with or without a line on a board.
  const built = (
    await read(
      `SELECT (SELECT count(*) FROM (${pick('DESC')}) s JOIN pub_player_current_impact p USING (player_id, season) WHERE abs(p.ci_total / p.ci_rows - s.current_impact) <= 1e-9) AS last_equal,
            (SELECT count(*) FROM (${pick('ASC')}) s JOIN pub_player_expected_impact p USING (player_id, season) WHERE abs(p.ce_total / p.ce_rows - s.current_impact) <= 1e-9) AS first_equal,
            (SELECT count(*) FROM (${pick('DESC')})) AS player_seasons`
    )
  )[0]
  console.log(
    `  built tables: the last row equal on ${built.last_equal}, the first on ${built.first_equal} of ${built.player_seasons} player-seasons`
  )
}

// RAPTOR, every linked player-season of the by-player files (regular season and playoffs together).
if (want('raptor') && league === 'nba') {
  const CHECKS = [
    ['raptor_total', 'historical', 'raptor_total'],
    ['raptor_offense', 'historical', 'raptor_offense'],
    ['raptor_defense', 'historical', 'raptor_defense'],
    ['raptor_war', 'historical', 'war_total'],
    ['raptor_predator', 'historical', 'predator_total'],
    ['raptor_predator_offense', 'historical', 'predator_offense'],
    ['raptor_predator_defense', 'historical', 'predator_defense'],
    ['raptor_pace_impact', 'historical', 'pace_impact'],
    ['raptor_box_total', 'modern', 'raptor_box_total'],
    ['raptor_box_offense', 'modern', 'raptor_box_offense'],
    ['raptor_box_defense', 'modern', 'raptor_box_defense'],
    ['raptor_onoff_total', 'modern', 'raptor_onoff_total'],
    ['raptor_onoff_offense', 'modern', 'raptor_onoff_offense'],
    ['raptor_onoff_defense', 'modern', 'raptor_onoff_defense']
  ]
  const t = tally('RAPTOR, linked player-seasons')
  const nbaOf = new Map(
    (await read('SELECT DISTINCT player_id, bref_id FROM pub_player_raptor')).map((r) => [
      r.bref_id,
      String(r.player_id)
    ])
  )
  let unlinked = 0
  for (const file of ['historical', 'modern']) {
    const checks = CHECKS.filter(([, f]) => f === file)
    for (const season of await seasonsOf(`SELECT season FROM src_raptor_${file}_player`)) {
      const e = await engine(
        'player',
        checks.map(([m]) => m),
        season,
        ['regular', 'playoffs']
      )
      for (const r of await read(
        `SELECT * FROM src_raptor_${file}_player WHERE season = ${season}`
      )) {
        const id = nbaOf.get(r.player_id)
        // Players no link names are listed by check-raptor.mjs; they have no engine row by design.
        if (!id) {
          unlinked++
          continue
        }
        for (const [m, , c] of checks)
          t.value(season, `${r.player_id}=${id}`, m, e.get(id)?.[m], num(r[c]), 1e-8)
      }
    }
  }
  report(t)
  console.log(`  file rows of players with no link, not counted above: ${unlinked}`)
}

// The rolling windows: a filled window's columns, and nothing for an unfilled one.
if (want('rolling')) {
  const source = `src_${league}_rolling_windows`
  const WINDOWS = [
    ['fg50', 'fg_pct', 50],
    ['fg200', 'fg_pct', 200],
    ['fg3_50', 'fg3_pct', 50],
    ['fg3_200', 'fg3_pct', 200]
  ]
  const VALUES = {
    cur: 'cur',
    prev: 'prev',
    start: 'season_start',
    career: 'career_baseline',
    dprev: 'delta_prev',
    dseason: 'delta_season',
    dcareer: 'delta_career'
  }
  const metrics = WINDOWS.flatMap(([k]) => Object.keys(VALUES).map((v) => `rw_${k}_${v}`))
  const filled = tally('rolling windows, filled')
  let unfilledSource = 0
  const unfilled = tally(
    'rolling windows, unfilled (the source counts as blank, so a value is "extra")'
  )
  for (const season of await seasonsOf(`SELECT season FROM ${source}`)) {
    const e = await engine('player', metrics, season, undefined)
    for (const r of await read(
      `SELECT * FROM ${source} WHERE season = ${season} AND entity_type = 'player'`
    )) {
      const w = WINDOWS.find(([, m, n]) => m === r.metric && n === Number(r.window_n))
      if (!w) throw new Error(`an unknown window: ${r.metric} ${r.window_n}`)
      for (const [v, c] of Object.entries(VALUES)) {
        const got = e.get(String(r.entity_id))?.[`rw_${w[0]}_${v}`]
        if (r.qualified) filled.value(season, r.entity_id, `rw_${w[0]}_${v}`, got, num(r[c]), 1e-12)
        else {
          unfilled.value(season, r.entity_id, `rw_${w[0]}_${v}`, got, null, 0)
          if (num(r[c]) !== null) unfilledSource++
        }
      }
    }
  }
  report(filled)
  report(unfilled)
  console.log(
    `  values the source gives in unfilled windows, none of which is read: ${unfilledSource}`
  )
}
await close()
