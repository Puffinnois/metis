#!/usr/bin/env node
// Measures what one player's lines cost to fetch from the release Parquet files over HTTP, for T1304
// (docs/reference/player-links.md, part 3): DuckDB's HTTP range reads with a filter on the player's ESPN id,
// against downloading each file whole. Each case runs in a fresh in-memory DuckDB, so nothing is cached between
// cases, and the cases run a few seconds apart. A plain client, as every Metis download is.
//
// usage: node scripts/player-links-range.mjs [--layout]
// --layout also prints each file's row groups and the id column's min and max per row group.
import { DuckDBInstance } from '@duckdb/node-api'

const base = 'https://github.com/sportsdataverse/sportsdataverse-data/releases/download'
const url = (release, file) => `${base}/${release}/${file}`
const nba = (s) => url('espn_nba_player_boxscores', `player_box_${s}.parquet`)
const wnba = (s) => url('espn_wnba_player_boxscores', `player_box_${s}.parquet`)
const mbb = (s) => url('espn_mens_college_basketball_player_boxscores', `player_box_${s}.parquet`)
const wbb = (s) => url('espn_womens_college_basketball_player_boxscores', `player_box_${s}.parquet`)
const nbaSeason = (s) => url('espn_nba_player_season_stats', `player_season_stats_${s}.parquet`)

const cases = [
  { name: 'NBA box scores, one season: Cooper Flagg 2025-26', id: 5041939, files: [nba(2026)] },
  {
    name: 'NBA box scores, career: Chet Holmgren 2022-23 to 2026-27',
    id: 4433255,
    files: [2023, 2024, 2025, 2026, 2027].map(nba)
  },
  {
    name: 'NBA season stats, one season: Cooper Flagg 2025-26',
    id: 5041939,
    files: [nbaSeason(2026)]
  },
  { name: 'WNBA box scores, one season: Caitlin Clark 2025', id: 4433403, files: [wnba(2025)] },
  {
    name: 'WNBA box scores, career: Caitlin Clark 2024 to 2026',
    id: 4433403,
    files: [2024, 2025, 2026].map(wnba)
  },
  {
    name: "Men's college box scores, one season: Cooper Flagg 2024-25",
    id: 5041939,
    files: [mbb(2025)]
  },
  {
    name: "Men's college box scores, career: Zach Edey 2021-22 to 2023-24",
    id: 4600663,
    files: [2022, 2023, 2024].map(mbb)
  },
  {
    name: "Women's college box scores, one season: Caitlin Clark 2023-24",
    id: 4433403,
    files: [wbb(2024)]
  },
  {
    name: "Women's college box scores, career: Caitlin Clark 2021-22 to 2023-24",
    id: 4433403,
    files: [2022, 2023, 2024].map(wbb)
  }
]

const layout = process.argv.includes('--layout')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function fresh() {
  const db = await DuckDBInstance.create(':memory:', { threads: '4' })
  const con = await db.connect()
  await con.run('LOAD httpfs')
  // No metadata cache, so each case pays for its footers as a first visit would.
  await con.run('SET enable_http_metadata_cache = false')
  await con.run("CALL enable_logging('HTTP')")
  return con
}

async function httpTotals(con) {
  const r = await con.runAndReadAll(`
    SELECT count(*) AS requests,
      count(*) FILTER (WHERE request.type = 'HEAD') AS heads,
      count(*) FILTER (WHERE request.type = 'GET') AS gets,
      coalesce(sum(TRY_CAST(response.headers['Content-Length'] AS BIGINT)) FILTER (WHERE request.type = 'GET'), 0) AS bytes
    FROM duckdb_logs_parsed('HTTP')`)
  const [requests, heads, gets, bytes] = r.getRowsJS()[0].map(Number)
  return { requests, heads, gets, bytes }
}

for (const c of cases) {
  const list = `[${c.files.map((f) => `'${f}'`).join(', ')}]`
  // Projected: the id column alone, filtered, which is the least a range read can fetch (a count of lines).
  let con = await fresh()
  let at = Date.now()
  const rows = await con.runAndReadAll(
    `SELECT count(*) FROM read_parquet(${list}, union_by_name = true) WHERE athlete_id = ${c.id}`
  )
  const projectedMs = Date.now() - at
  const projected = await httpTotals(con)
  const lines = Number(rows.getRowsJS()[0][0])
  con.closeSync()
  await pause(3000)
  // Filtered: the player's full lines, every column, which is what a profile shows.
  con = await fresh()
  at = Date.now()
  await con.runAndReadAll(
    `SELECT * FROM read_parquet(${list}, union_by_name = true) WHERE athlete_id = ${c.id}`
  )
  const filteredMs = Date.now() - at
  const filtered = await httpTotals(con)
  con.closeSync()
  await pause(3000)
  // Whole: every column of every row, as a download of the files would read them.
  con = await fresh()
  at = Date.now()
  const whole = await con.runAndReadAll(
    `SELECT count(*) FROM read_parquet(${list}, union_by_name = true)`
  )
  const allRows = Number(whole.getRowsJS()[0][0])
  await con.runAndReadAll(`SELECT * FROM read_parquet(${list}, union_by_name = true)`)
  const wholeMs = Date.now() - at
  const wholeHttp = await httpTotals(con)
  console.log(
    JSON.stringify({
      case: c.name,
      files: c.files.length,
      lines,
      idOnly: { ms: projectedMs, ...projected },
      playerRows: { ms: filteredMs, ...filtered },
      whole: { ms: wholeMs, rows: allRows, ...wholeHttp }
    })
  )
  if (layout) {
    const meta = await con.runAndReadAll(`
      SELECT file_name, count(DISTINCT row_group_id) AS row_groups, max(row_group_num_rows) AS rows_per_group,
        string_agg(DISTINCT stats_min || '..' || stats_max, ' | ') AS id_ranges
      FROM parquet_metadata(${list}) WHERE path_in_schema = 'athlete_id' GROUP BY file_name`)
    for (const r of meta.getRowsJS())
      console.log('  layout', JSON.stringify(r.map((v) => (typeof v === 'bigint' ? Number(v) : v))))
  }
  con.closeSync()
  await pause(3000)
}
