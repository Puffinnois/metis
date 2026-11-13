// Prints the SQL the engine compiles for a query given as JSON, for EXPLAIN ANALYZE. Bundled and
// run by hand while measuring; not part of the app.
import { compileQuery } from '../../src/main/stats/engine/compile'

const q = JSON.parse(process.argv[2])
const c = compileQuery(q, { currentSeason: 2026 })
const inline = (sql: string, params: unknown[]): string =>
  sql.replace(/\$(\d+)\b/g, (_, i) => {
    const v = params[Number(i) - 1]
    return typeof v === 'string' ? `'${v.replaceAll("'", "''")}'` : String(v)
  })
console.log(
  JSON.stringify({ games: inline(c.gamesSql, c.gamesParams), sql: inline(c.sql, c.params) })
)
