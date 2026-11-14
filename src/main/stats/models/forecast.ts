import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { ELO, eloShift, winProbability } from './elo'
import { seedOf } from './random'
import { simulateSeason, type EloModel, type GameLeft, type PlayedGame } from './simulate'
import { makeLeague, rulesOf } from './standings'
import { ELO_GAME_TABLE, ELO_SCHEDULE_TABLE } from './teamElo'

/**
 * Plan T1003: each team's season forecast as of a date, from the season simulation run on T1002's
 * Elo (`elo_game`): projected wins and losses, the odds of the playoffs, a top-six seed, the play-in,
 * each round and the title, and the mean seed.
 */
export const FORECAST_TABLE = 'team_forecast'

/** The builder's version: bump when its rows change. */
const VERSION = 1

export const FORECAST_REASON = 'Forecast in the regular season, as of its games.'

/** The first season forecast: Elo's metrics start here, after two seasons of burn-in (T1002). */
export const FORECAST_FIRST_SEASON = 1996

/** Runs for the season in progress, as decided for the task. */
export const CURRENT_RUNS = 10_000
/**
 * Runs for a past season's snapshots: 500 keeps the twenty snapshots of every season inside the
 * full rebuild's budget (measured in `stats-database.md`, "Season forecast"); a probability's
 * standard error is then at most 2.2 points, a tenth of a decile.
 */
export const PAST_RUNS = 500
/** Snapshots a season: one at each twentieth of its regular-season games, so a quarter, half and three quarters fall on one. */
export const SNAPSHOTS = 20
/** A regular season's games per team, for the season in progress's games not listed yet. */
export const SEASON_GAMES = 82

/**
 * The spread of a game's margin around the Elo expected margin, in points: the standard deviation of
 * the regular season's margins less `exp_margin` from 1995-96 to 2025-26, 12.38 over 36,735 games
 * (`scripts/check-forecast.mjs`).
 */
export const MARGIN_SD = 12.4

export const ELO_MODEL: EloModel = {
  homeCourt: ELO.homeCourt,
  winProbability,
  shift: (diff, margin) => eloShift(diff, margin),
  perPoint: ELO.perPoint,
  marginSd: MARGIN_SD
}

export const FORECAST_TABLES: readonly ModelTable[] = [
  {
    table: FORECAST_TABLE,
    entity: 'team',
    kind: 'state',
    grain: 'game',
    // A row per team and snapshot, on the team's last game on or before the snapshot's day, so the
    // engine reads, at the last game in scope, the latest forecast made by then. Two snapshots on the
    // same game of a team (no game between them) keep the later.
    columns: [
      ['season', 'INTEGER'],
      ['game_type', 'VARCHAR'],
      ['team_id', 'BIGINT'],
      ['game_id', 'VARCHAR'],
      ['game_date', 'DATE'],
      // The day of the forecast: after that day's games.
      ['as_of', 'DATE'],
      ['runs', 'INTEGER'],
      // The league's regular-season games played through `as_of`: a kept snapshot of the season in
      // progress is recomputed when it changes (a late score, a corrected game).
      ['games_in', 'INTEGER'],
      // The builder's version that computed it: a kept snapshot of another version is recomputed.
      ['model_version', 'INTEGER'],
      ['proj_w', 'DOUBLE'],
      ['proj_l', 'DOUBLE'],
      ['p_playoffs', 'DOUBLE'],
      // Null before 2020-21 (the top six), before 2019-20 (the play-in).
      ['p_top6', 'DOUBLE'],
      ['p_play_in', 'DOUBLE'],
      ['p_round2', 'DOUBLE'],
      ['p_conf_finals', 'DOUBLE'],
      ['p_finals', 'DOUBLE'],
      ['p_title', 'DOUBLE'],
      ['mean_seed', 'DOUBLE']
    ],
    components: [
      'runs',
      'proj_w',
      'proj_l',
      'p_playoffs',
      'p_top6',
      'p_play_in',
      'p_round2',
      'p_conf_finals',
      'p_finals',
      'p_title',
      'mean_seed'
    ],
    gameTypes: ['regular'],
    typesReason: FORECAST_REASON
  }
]

interface EloRow {
  game_id: string
  game_date: string
  game_type: string
  team_id: number
  opponent_id: number
  home: boolean
  neutral: boolean
  played: boolean
  elo_pre: number
  elo: number | null
  margin: number | null
}

/**
 * One season's Elo rows, both sides of every game: the games played from `elo_game`, with the margin
 * from this team's side, and the season in progress's games still to come from `elo_schedule`.
 */
async function eloRows(ctx: ModelContext): Promise<EloRow[]> {
  const toCome = ctx.have.tables.has(ELO_SCHEDULE_TABLE)
    ? `UNION ALL
       SELECT game_id, strftime(game_date, '%Y-%m-%d'), game_type, team_id, opponent_id, home,
              neutral, false, elo_pre, NULL, NULL
       FROM ${ELO_SCHEDULE_TABLE} WHERE season = ?`
    : ''
  return ctx.db.all<EloRow>(
    `SELECT * FROM (
       SELECT e.game_id, strftime(e.game_date, '%Y-%m-%d') AS game_date, e.game_type, e.team_id,
              e.opponent_id, e.home, e.neutral, true AS played, e.elo_pre, e.elo,
              (CASE WHEN e.home THEN g.home_score - g.away_score
                    ELSE g.away_score - g.home_score END)::DOUBLE AS margin
       FROM ${ELO_GAME_TABLE} e JOIN game g USING (game_id)
       WHERE e.season = ?
       ${toCome}
     ) ORDER BY game_date, game_id`,
    toCome ? [ctx.season, ctx.season] : [ctx.season]
  )
}

interface Kept {
  as_of: string
  games_in: number
  version: number
  rows: Record<string, unknown>[]
}

/** The season in progress's snapshots this builder wrote before, by day, to keep those still right. */
async function keptSnapshots(ctx: ModelContext): Promise<Map<string, Kept>> {
  const rows = await ctx.db.all<Record<string, unknown>>(
    `SELECT * EXCLUDE (as_of, game_date), strftime(as_of, '%Y-%m-%d') AS as_of,
            strftime(game_date, '%Y-%m-%d') AS game_date
     FROM ${FORECAST_TABLE} WHERE season = ?`,
    [ctx.season]
  )
  const out = new Map<string, Kept>()
  for (const r of rows) {
    const day = String(r.as_of)
    if (!out.has(day))
      out.set(day, {
        as_of: day,
        games_in: Number(r.games_in),
        version: Number(r.model_version),
        rows: []
      })
    out.get(day)!.rows.push({ ...r, team_id: Number(r.team_id) })
  }
  return out
}

/** The days a season is forecast: one at each twentieth of its regular-season games, and the latest. */
export function snapshotDays(
  playedDates: readonly string[],
  total: number,
  latest: boolean
): string[] {
  const days = new Set<string>()
  const sorted = [...playedDates].sort()
  for (let k = 1; k <= SNAPSHOTS; k++) {
    const need = Math.ceil((k * total) / SNAPSHOTS)
    if (need >= 1 && need <= sorted.length) days.add(sorted[need - 1])
  }
  if (latest && sorted.length > 0) days.add(sorted[sorted.length - 1])
  return [...days].sort()
}

/** How many runs a forecast takes: the season in progress's, and a past season's snapshots. */
export interface ForecastRuns {
  current: number
  past: number
}

async function build(ctx: ModelContext, runCount: ForecastRuns): Promise<ModelRows> {
  if (ctx.season < FORECAST_FIRST_SEASON || !ctx.have.tables.has(ELO_GAME_TABLE)) {
    return { [FORECAST_TABLE]: [] }
  }
  const teams = await ctx.db.all<{ team_id: number; conference: string; division: string }>(
    `SELECT team_id, conference, division FROM team WHERE season = ? AND conference IS NOT NULL
     ORDER BY team_id`,
    [ctx.season]
  )
  const league = makeLeague(
    teams.map((t) => ({ id: Number(t.team_id), conference: t.conference, division: t.division }))
  )
  const index = new Map(league.ids.map((id, i) => [id, i]))
  // A season whose conferences cannot fill a bracket of eight (a test fixture) has no forecast.
  for (const c of [0, 1])
    if (league.conference.filter((x) => x === c).length < 8) return { [FORECAST_TABLE]: [] }
  const all = (await eloRows(ctx)).map((r) => ({
    ...r,
    team_id: Number(r.team_id),
    opponent_id: Number(r.opponent_id)
  }))
  // The regular season, one row a game (the home side's), between two teams of the season's table.
  const regular = all.filter(
    (r) => r.game_type === 'regular' && r.home && index.has(r.team_id) && index.has(r.opponent_id)
  )
  const played = regular.filter((r) => r.played && r.margin !== null && r.margin !== 0)
  if (played.length === 0) return { [FORECAST_TABLE]: [] }
  const current = ctx.season === ctx.current
  const toCome = current ? regular.filter((r) => !r.played) : []
  const days = snapshotDays(
    played.map((g) => g.game_date),
    played.length + toCome.length,
    current
  )
  const rules = rulesOf(ctx.season)
  const kept = current ? await keptSnapshots(ctx) : new Map<string, Kept>()
  // Each team's Elo rows in date order, every type Elo rates (the Cup final moves a rating too).
  const byTeam = new Map<number, EloRow[]>()
  for (const r of all) {
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, [])
    byTeam.get(r.team_id)!.push(r)
  }
  const ratingAt = (team: number, day: string): number => {
    const rows = byTeam.get(team) ?? []
    let rating = rows[0]?.elo_pre ?? ELO.newTeam
    for (const r of rows) {
      if (r.game_date > day || !r.played || r.elo === null) break
      rating = r.elo
    }
    return rating
  }
  // Each team's regular-season games played, in date order, to attach a snapshot to its last one.
  const gamesOf = new Map<number, { game_id: string; game_date: string }[]>()
  for (const g of played)
    for (const t of [g.team_id, g.opponent_id]) {
      if (!gamesOf.has(t)) gamesOf.set(t, [])
      gamesOf.get(t)!.push({ game_id: g.game_id, game_date: g.game_date })
    }

  const out = new Map<string, Record<string, unknown>>()
  const latestDay = days[days.length - 1]
  for (const day of days) {
    const before = played.filter((g) => g.game_date <= day)
    const keep = kept.get(day)
    let rows: Record<string, unknown>[]
    if (
      keep !== undefined &&
      keep.games_in === before.length &&
      keep.version === VERSION &&
      day !== latestDay
    ) {
      rows = keep.rows
    } else {
      rows = forecastDay(ctx, day, before, played, toCome, current)
    }
    for (const r of rows) {
      const games = gamesOf.get(Number(r.team_id)) ?? []
      let last: { game_id: string; game_date: string } | undefined
      for (const g of games) if (g.game_date <= day) last = g
      if (last === undefined) continue
      out.set(`${r.team_id}|${last.game_id}`, {
        ...r,
        game_id: last.game_id,
        game_date: last.game_date
      })
    }
  }
  return { [FORECAST_TABLE]: [...out.values()] }

  function forecastDay(
    c: ModelContext,
    day: string,
    before: EloRow[],
    allPlayed: EloRow[],
    future: EloRow[],
    inProgress: boolean
  ): Record<string, unknown>[] {
    const toPlay: GameLeft[] = [...allPlayed.filter((g) => g.game_date > day), ...future].map(
      (g) => ({
        home: index.get(g.team_id)!,
        away: index.get(g.opponent_id)!,
        neutral: g.neutral
      })
    )
    const results: PlayedGame[] = before.map((g) => ({
      home: index.get(g.team_id)!,
      away: index.get(g.opponent_id)!,
      margin: g.margin!
    }))
    // The season in progress's games the schedule does not list yet (the Cup's), against an
    // average opponent: each team's 82 less the games played and listed.
    const unnamed = new Array<number>(league.ids.length).fill(0)
    if (inProgress) {
      const count = new Array<number>(league.ids.length).fill(0)
      for (const g of [...results, ...toPlay]) {
        count[g.home]++
        count[g.away]++
      }
      for (let t = 0; t < count.length; t++) unnamed[t] = Math.max(0, SEASON_GAMES - count[t])
    }
    const ratings = Float64Array.from(league.ids, (id) => ratingAt(id, day))
    const runs = inProgress ? runCount.current : runCount.past
    const f = simulateSeason({
      league,
      rules,
      played: results,
      left: toPlay,
      unnamed,
      ratings,
      elo: ELO_MODEL,
      runs,
      seed: seedOf(c.season, Number(day.replaceAll('-', '')))
    })
    return league.ids.map((id, t) => ({
      season: c.season,
      game_type: 'regular',
      team_id: id,
      as_of: day,
      runs,
      games_in: before.length,
      model_version: VERSION,
      proj_w: f[t].wins,
      proj_l: f[t].losses,
      p_playoffs: f[t].playoffs,
      p_top6: rules.playIn === 'modern' ? f[t].top6 : null,
      p_play_in: rules.playIn === 'none' ? null : f[t].playIn,
      p_round2: f[t].round2,
      p_conf_finals: f[t].conferenceFinals,
      p_finals: f[t].finals,
      p_title: f[t].title,
      mean_seed: f[t].seed
    }))
  }
}

/** The builder, with its run counts: tests pass fewer. */
export const makeForecastBuilder = (
  runs: ForecastRuns = { current: CURRENT_RUNS, past: PAST_RUNS }
): ModelBuilder => ({
  name: 'season_forecast',
  version: VERSION,
  tables: FORECAST_TABLES,
  build: (ctx) => build(ctx, runs)
})

export const FORECAST_BUILDER = makeForecastBuilder()
