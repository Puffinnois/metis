// The game tables' keys, checked in every league: one line per player per game in `player_game`, one
// per team per game in `team_game`. A key read twice counts its games, points and minutes twice on
// every screen; the Stage 13 gate found 12 such players in one NCAA Women game, which ESPN and
// stats.ncaa.org each listed under a different team. Every line it finds counts as wrong.

/** Appends the section to `out` and returns how many keys repeat. */
export async function checkKeys(read, out) {
  const rows = await read(`
    SELECT 'player_game' AS tbl, 'game, player' AS key, count(*)::INTEGER AS lines,
           (count(*) - count(DISTINCT (game_id, player_id)))::INTEGER AS repeats
    FROM player_game
    UNION ALL
    SELECT 'team_game', 'game, team', count(*)::INTEGER,
           (count(*) - count(DISTINCT (game_id, team_id)))::INTEGER
    FROM team_game`)
  const examples = await read(`
    SELECT 'player_game' AS tbl, game_id, player_id AS id, count(*)::INTEGER AS n FROM player_game
    GROUP BY 1, 2, 3 HAVING count(*) > 1
    UNION ALL
    SELECT 'team_game', game_id, team_id, count(*)::INTEGER FROM team_game
    GROUP BY 1, 2, 3 HAVING count(*) > 1
    ORDER BY 1, 2, 3 LIMIT 10`)
  out.push(
    '',
    "## The game tables' keys",
    '',
    'Each key must be one line: a repeat counts its games and totals twice. Exact; every repeat is wrong.',
    '',
    '| Table | Key | Lines | Repeated |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (r) => `| \`${r.tbl}\` | ${r.key} | ${r.lines.toLocaleString('en-US')} | ${r.repeats} |`
    )
  )
  if (examples.length) {
    out.push('', 'First repeats (table, game, id, lines):', '')
    for (const e of examples) out.push(`- \`${e.tbl}\` ${e.game_id} ${e.id}: ${e.n}`)
  }
  return rows.reduce((sum, r) => sum + r.repeats, 0)
}
