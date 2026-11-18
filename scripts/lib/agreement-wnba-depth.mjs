// The WNBA's published tables (Plan T1301.7) read through the query engine against the raw files, and
// the catalogue's formulas on the built tables against the league's published figures, season by
// season. Called by `agreement-wnba.mjs`. A published value is stored times what it was measured over
// and divided back, so one season should read exactly as published (floating point aside); the
// formulas against the league's figures are a measurement, with the tolerance stated, not a test.
// Returns how many published values read otherwise than as published.

const COUNT = new Intl.NumberFormat('en-US')
const pct = (part, whole) => (whole ? ((100 * part) / whole).toFixed(1) : '–')

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

/** Stored times a divisor and divided back, so only floating point separates the two. */
const same = (a, b) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)))

const PLAYER = [
  ['nba_ortg', 'a.off_rating'],
  ['nba_pace', 'a.pace'],
  ['nba_usg_pct', 'a.usg_pct'],
  ['nba_tov_ratio', 'a.tm_tov_pct'],
  ['nba_pie', 'a.pie'],
  ['nba_pts_paint', 'm.pts_paint'],
  ['nba_blka', 'm.blka'],
  ['nba_share_pts_mid', 's.pct_pts_2_pt_mr'],
  ['nba_share_ast_fgm', 's.pct_ast_fgm'],
  ['nba_share_pts', 'u.pct_pts'],
  ['nba_def_ws', 'd.def_ws']
]
const TEAM = [
  ['team_nba_ortg', 'a.off_rating'],
  ['team_nba_pace', 'a.pace'],
  ['team_nba_tov_pct', 'a.tm_tov_pct'],
  ['team_nba_fta_rate', 'f.fta_rate'],
  ['opp_nba_efg_pct', 'f.opp_efg_pct'],
  ['team_nba_pts_2_nd_chance', 'm.pts_2_nd_chance'],
  ['opp_nba_pts_paint', 'm.opp_pts_paint'],
  ['team_nba_share_pts_paint', 's.pct_pts_paint']
]
const TYPES = [
  ['regular', 'Regular Season'],
  ['playoffs', 'Playoffs']
]
const filter = (alias, season, type) =>
  `${alias}.season = ${season} AND ${alias}.season_type = '${type}'`

/**
 * The catalogue's formula on the built tables, the league's published figure, the scale that puts both
 * in percentage points (or possessions, or points per 100), and the column head.
 */
const TEAM_PAIRS = [
  // The league publishes pace per 48 minutes: its figure scaled to 40, against the built per 40.
  ['team_pace', 'team_nba_pace40', 1, 'Pace per 40'],
  ['team_ortg', 'team_nba_ortg', 1, 'ORtg'],
  ['team_drtg', 'team_nba_drtg', 1, 'DRtg'],
  ['team_fta_rate', 'team_nba_fta_rate', 100, 'FTr'],
  ['opp_efg_pct', 'opp_nba_efg_pct', 100, 'Opp eFG%'],
  ['team_orb_pct', 'team_nba_oreb_pct', 100, 'ORB%']
]

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (s.length === 0) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const signed = (v, d = 2) => (v === null ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`)

const IMPACT = [
  ['sdv_rapm', 'rapm', 'off_poss + def_poss'],
  ['sdv_o_rapm', 'o_rapm', 'off_poss'],
  ['sdv_d_rapm', 'd_rapm', 'def_poss'],
  ['sdv_adj_rapm', 'adj_rapm', 'off_poss + def_poss'],
  ['sdv_spm', 'spm', 'min'],
  ['sdv_bpm', 'bpm', 'min'],
  ['sdv_obpm', 'obpm', 'min'],
  ['sdv_dbpm', 'dbpm', 'min'],
  ['sdv_war', 'war', '1']
]

export async function depthChecks(read, query, out) {
  let wrong = 0
  const seasons = (
    await read('SELECT DISTINCT season FROM src_dash_team_stats_advanced ORDER BY 1')
  ).map((r) => Number(r.season))

  // 1. The dashboards through the engine, players and teams.
  const dashRows = []
  for (const season of seasons) {
    for (const [type, published] of TYPES) {
      const rawPlayers = await read(
        `SELECT a.player_id AS id, ${PLAYER.map(([id, c]) => `${c} AS ${id}`).join(', ')}
         FROM src_dash_player_stats_advanced a
         LEFT JOIN src_dash_player_stats_misc m ON m.player_id = a.player_id AND m.team_id = a.team_id AND m.gp = a.gp AND ${filter('m', season, published)}
         LEFT JOIN src_dash_player_stats_scoring s ON s.player_id = a.player_id AND s.team_id = a.team_id AND s.gp = a.gp AND ${filter('s', season, published)}
         LEFT JOIN src_dash_player_stats_usage u ON u.player_id = a.player_id AND u.team_id = a.team_id AND u.gp = a.gp AND ${filter('u', season, published)}
         LEFT JOIN src_dash_player_stats_defense d ON d.player_id = a.player_id AND d.team_id = a.team_id AND d.gp = a.gp AND ${filter('d', season, published)}
         WHERE ${filter('a', season, published)}`
      )
      if (rawPlayers.length === 0) continue
      const rawTeams = await read(
        `SELECT a.team_id AS id, ${TEAM.map(([id, c]) => `${c} AS ${id}`).join(', ')}
         FROM src_dash_team_stats_advanced a
         LEFT JOIN src_dash_team_stats_fourfactors f ON f.team_id = a.team_id AND ${filter('f', season, published)}
         LEFT JOIN src_dash_team_stats_misc m ON m.team_id = a.team_id AND ${filter('m', season, published)}
         LEFT JOIN src_dash_team_stats_scoring s ON s.team_id = a.team_id AND ${filter('s', season, published)}
         WHERE ${filter('a', season, published)}`
      )
      const players = await query({
        entity: 'player',
        metrics: PLAYER.map(([id]) => id),
        scope: { seasons: [season], gameTypes: [type] },
        limit: 5000
      })
      const teams = await query({
        entity: 'team',
        metrics: TEAM.map(([id]) => id),
        scope: { seasons: [season], gameTypes: [type] },
        limit: 100
      })
      // A team's key is its id in `team`, the 2026 Portland Fire's the negative of the files' id.
      const ours = (rows) => new Map(rows.map((r) => [Math.abs(Number(r.id)), r.values]))
      const tally = (raw, mine, checks) => {
        let rows = 0
        let rowsSame = 0
        let cells = 0
        let cellsSame = 0
        let missing = 0
        let overNothing = 0
        for (const r of raw) {
          const o = mine.get(Math.abs(Number(r.id)))
          if (!o) {
            missing++
            continue
          }
          rows++
          let all = true
          for (const [id] of checks) {
            const a = o[id]?.value ?? null
            // A rate over nothing: the league prints 0, the engine reads no value.
            if (Number.isNaN(r[id]) || (a === null && (r[id] === 0 || r[id] === null))) {
              overNothing++
              continue
            }
            cells++
            if (same(a, r[id])) cellsSame++
            else {
              all = false
              // DEBUG_DEPTH=1 names each value that differs, for the write-up.
              if (process.env.DEBUG_DEPTH) console.error(season, type, r.id, id, a, r[id])
            }
          }
          if (all) rowsSame++
        }
        return { rows, rowsSame, cells, cellsSame, missing, overNothing }
      }
      const p = tally(rawPlayers, ours(players.rows), PLAYER)
      const t = tally(rawTeams, ours(teams.rows), TEAM)
      wrong += p.cells - p.cellsSame + (t.cells - t.cellsSame)
      dashRows.push([
        String(season),
        type,
        COUNT.format(p.rows),
        COUNT.format(p.missing),
        pct(p.rowsSame, p.rows),
        pct(p.cellsSame, p.cells),
        COUNT.format(p.overNothing),
        COUNT.format(t.rows),
        pct(t.rowsSame, t.rows)
      ])
    }
  }
  out.push(
    '',
    "## The league's dashboards, read through the engine",
    '',
    "Plan T1301.7. The league's dashboards (`src_dash_*`, every row a season's totals) read through the query engine over each whole season and season type, against the raw files. A rate the league publishes is stored times its minutes, or its possessions for a rating, and divided back, so a season reads as published: exact but for floating point (1e-9). Nia Brodie's two 2026 rows (4 and 40 games) are compared one by one against her season, so her rows differ. Player columns: ratings, pace, usage, turnover ratio, PIE, paint points, shots blocked, mid-range and assisted shares, share of points on the floor, defensive win shares; team columns: rating, pace, turnovers, free-throw rate and opponents' eFG% (two of the four factors), second-chance points, opponents' paint points, the paint share. The playoffs are published from 2001. **Not in the box scores** counts a dashboard player the engine does not list; **over nothing** a rate the league prints as 0 with nothing under it, which the engine leaves blank.",
    '',
    table(
      [
        'Season',
        'Type',
        'Players',
        'Not in the box scores',
        'Rows same %',
        'Values same %',
        'Over nothing',
        'Teams',
        'Rows same %'
      ],
      dashRows
    )
  )

  // 2. The formulas on the built tables against the league's figures, regular season, every team.
  const diffRows = []
  for (const season of seasons) {
    const r = await query({
      entity: 'team',
      metrics: TEAM_PAIRS.flatMap(([a, b]) => [a, b]),
      scope: { seasons: [season], gameTypes: ['regular'] },
      limit: 100
    })
    const cells = TEAM_PAIRS.map(([a, b, scale]) => {
      const d = r.rows.map((x) => {
        const ours = x.values[a]?.value ?? null
        const theirs = x.values[b]?.value ?? null
        return ours === null || theirs === null ? NaN : (ours - theirs) * scale
      })
      const within = d.filter((v) => Number.isFinite(v) && Math.abs(v) <= 1).length
      return `${signed(median(d))} (${within}/${d.filter((v) => Number.isFinite(v)).length})`
    })
    diffRows.push([String(season), ...cells])
  }
  out.push(
    '',
    '### The formulas on the built tables against the published figures',
    '',
    "The catalogue's formulas over the game tables against the league's figure for the same team and regular season, as the median of formula minus published across the teams, then how many teams are within one (possession, point per 100 or percentage point) of it. A measurement, not a test: the formulas estimate possessions from the box score (Pace and the ratings, per 40 minutes, `gameLength`), and the league counts them; the four factors are the same counts on both sides. Where the dashboards fall short of the scores (1997–2009, T1301.6), the published figure is shown as published beside the built one.",
    '',
    table(['Season', ...TEAM_PAIRS.map((p) => p[3])], diffRows)
  )

  // 3. The impact file through the engine.
  const impactRows = []
  for (const season of seasons) {
    for (const [type, published] of TYPES) {
      const raw = await read(
        `SELECT player_id AS id, ${IMPACT.map(([id, c, by]) => `${c} AS ${id}, (${by}) AS ${id}_by`).join(', ')}
         FROM src_wnba_impact WHERE season = ${season} AND season_type = '${published}'`
      )
      if (raw.length === 0) continue
      const result = await query({
        entity: 'player',
        metrics: IMPACT.map(([id]) => id),
        scope: { seasons: [season], gameTypes: [type] },
        limit: 5000
      })
      const ours = new Map(result.rows.map((r) => [Number(r.id), r.values]))
      let rows = 0
      let missing = 0
      let rowsSame = 0
      let cells = 0
      let cellsSame = 0
      let overNothing = 0
      for (const r of raw) {
        const o = ours.get(Number(r.id))
        if (!o) {
          missing++
          continue
        }
        rows++
        let all = true
        for (const [id] of IMPACT) {
          const a = o[id]?.value ?? null
          // NaN as published (BPM of 2016's playoffs) reads as itself: not a value to compare.
          if (Number.isNaN(r[id]) || (a === null && (r[`${id}_by`] === 0 || r[id] === null))) {
            overNothing++
            continue
          }
          cells++
          if (same(a, r[id])) cellsSame++
          else all = false
        }
        if (all) rowsSame++
      }
      wrong += cells - cellsSame
      impactRows.push([
        String(season),
        type,
        COUNT.format(rows),
        COUNT.format(missing),
        pct(rowsSame, rows),
        pct(cellsSame, cells),
        COUNT.format(overNothing)
      ])
    }
  }
  out.push(
    '',
    "## SportsDataverse's impact models, read through the engine",
    '',
    "The impact file (`src_wnba_impact`, SportsDataverse's own calculations, not the models' authors') through the query engine over each whole season, against the raw file: RAPM and its parts, adjusted RAPM, SPM, BPM and its parts, WAR, each stored times what it was fitted on and divided back, so exact but for floating point. DARKO is not read: the WNBA's file has no `darko_*` columns, and its `boban_*` columns are SportsDataverse's own rating, which Metis does not read yet (the owner's open question). **Not in the box scores** counts a player the file has and the engine does not list; **over nothing** a value over no possessions or minutes, or published as NaN (19 BPM values of 2016's playoffs).",
    '',
    table(
      [
        'Season',
        'Type',
        'Players',
        'Not in the box scores',
        'Rows same %',
        'Values same %',
        'Over nothing'
      ],
      impactRows
    )
  )
  return wrong
}
