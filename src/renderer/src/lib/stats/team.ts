import { seasonLabel } from '@shared/stats/seasons'
import type {
  BoardMode,
  GameSide,
  MetricInfo,
  StatsGame,
  StatsQuery,
  StatsResult,
  StatsSeason
} from '@shared/stats/types'
import type { ChartSeries, SectionDef } from './dashboard'
import { fmtStat } from './format'
import { typeTag } from './player'
import { queryScope, scopeLabel, shortDay, type StatsScope } from './scope'

/** The team dashboard: a header with the record and the standing, and tabs. */

export type TeamTab =
  | 'overview'
  | 'offense'
  | 'defense'
  | 'shots'
  | 'plays'
  | 'players'
  | 'lineups'
  | 'splits'
  | 'schedule'
  | 'on_off'

export const TEAM_DASH_TABS: { id: TeamTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'offense', label: 'Offense' },
  { id: 'defense', label: 'Defense' },
  { id: 'shots', label: 'Shots' },
  { id: 'plays', label: 'Play by play' },
  { id: 'players', label: 'Players' },
  { id: 'lineups', label: 'Lineups' },
  { id: 'splits', label: 'Splits' },
  { id: 'schedule', label: 'Schedule' },
  // Last, so the tabs before it keep their places.
  { id: 'on_off', label: 'On/off' }
]

export const RATINGS_SECTION: SectionDef = {
  title: 'Ratings',
  note: 'Possessions are estimated',
  metrics: ['team_win_pct', 'team_point_diff', 'team_ortg', 'team_drtg', 'team_nrtg', 'team_pace']
}

/**
 * Plan T1001: how strong the team is beyond its record. The margin and Pythagorean wins come from the
 * scores in scope; SRS, the schedule strengths and the adjusted ratings (T1004) are solved on the
 * regular season, as of the last game in scope.
 */
export const STRENGTH_SECTION: SectionDef = {
  title: 'Team strength',
  note: 'Computed by Metis',
  metrics: [
    'team_mov',
    'team_pyth_w',
    'team_win_resid',
    'team_srs',
    'team_sos',
    'team_sos_left',
    'team_adj_ortg',
    'team_adj_drtg',
    'team_adj_nrtg'
  ]
}

/** The two sections of the Overview, read by one query. */
export const OVERVIEW_METRICS = [...RATINGS_SECTION.metrics, ...STRENGTH_SECTION.metrics]

export const TEAM_SECTIONS: Record<
  'offense' | 'defense' | 'shots_offense' | 'shots_defense' | 'plays',
  SectionDef[]
> = {
  // Plan T905: counted from the NBA's play by play, 1996-97 on.
  plays: [
    {
      title: 'Game flow',
      note: 'Averages a game',
      metrics: [
        'team_pbp_lead_changes',
        'team_pbp_largest_lead',
        'opp_pbp_largest_lead',
        'team_pbp_lead_share',
        'team_pbp_best_run',
        'opp_pbp_best_run',
        'team_pbp_drought',
        'team_pbp_drought_fg'
      ]
    },
    {
      title: 'Turnovers',
      note: 'Team turnovers: no player charged',
      metrics: [
        'team_pbp_tov_bad_pass',
        'team_pbp_tov_lost_ball',
        'team_pbp_tov_off_foul',
        'team_pbp_tov_travel',
        'team_pbp_tov_shot_clock',
        'team_pbp_tov_team',
        'team_pbp_tov_live_share',
        'opp_pbp_tov_live'
      ]
    },
    {
      title: 'Fouls',
      metrics: [
        'team_pbp_pf_shooting',
        'team_pbp_pf_personal',
        'team_pbp_pf_offensive',
        'team_pbp_tech',
        'team_pbp_flagrant',
        'opp_pbp_pf_shooting'
      ]
    },
    {
      title: 'Scoring',
      metrics: [
        'team_pbp_and1',
        'team_pbp_and1_pct',
        'opp_pbp_and1',
        'team_pbp_ast_pts',
        'team_pbp_ast2_share',
        'team_pbp_ast3_share'
      ]
    }
  ],
  // Shots by zone, band and type: the team's own, and those taken against it.
  shots_offense: [
    {
      title: 'Profile',
      note: 'From the NBA’s shot chart file, 1996-97 on',
      metrics: [
        'team_shot_avg_dist',
        'team_shot_ra_freq',
        'team_shot_paint_freq',
        'team_shot_mid_freq',
        'team_shot_c3_freq',
        'team_shot_atb3_freq'
      ]
    },
    {
      title: 'Against the league',
      note: 'FG% above the league’s rate in each zone that season',
      metrics: [
        'team_shot_ra_fg_rel',
        'team_shot_paint_fg_rel',
        'team_shot_mid_fg_rel',
        'team_shot_c3_fg_rel',
        'team_shot_atb3_fg_rel',
        'team_shot_pps_above',
        'team_shot_pts_above'
      ]
    },
    {
      title: 'By distance',
      metrics: [
        'team_shot_lt8_fg_pct',
        'team_shot_d8_16_fg_pct',
        'team_shot_d16_24_fg_pct',
        'team_shot_d24p_fg_pct',
        'team_shot_lt8_freq',
        'team_shot_d24p_freq'
      ]
    },
    {
      title: 'Shot types',
      metrics: [
        'team_shot_dunk_fga',
        'team_shot_layup_fg_pct',
        'team_shot_hook_fg_pct',
        'team_shot_floater_fg_pct',
        'team_shot_jumper_fg_pct',
        'team_shot_jumper_freq'
      ]
    },
    {
      title: 'Assisted',
      note: 'The share of makes assisted, by the play by play',
      metrics: [
        'team_shot_ra_ast_pct',
        'team_shot_mid_ast_pct',
        'team_shot_c3_ast_pct',
        'team_shot_atb3_ast_pct'
      ]
    }
  ],
  shots_defense: [
    {
      title: 'Profile',
      note: 'From the NBA’s shot chart file, 1996-97 on',
      metrics: [
        'opp_shot_avg_dist',
        'opp_shot_ra_freq',
        'opp_shot_paint_freq',
        'opp_shot_mid_freq',
        'opp_shot_c3_freq',
        'opp_shot_atb3_freq'
      ]
    },
    {
      title: 'Against the league',
      note: 'FG% above the league’s rate in each zone that season',
      metrics: [
        'opp_shot_ra_fg_rel',
        'opp_shot_paint_fg_rel',
        'opp_shot_mid_fg_rel',
        'opp_shot_c3_fg_rel',
        'opp_shot_atb3_fg_rel',
        'opp_shot_pps_above',
        'opp_shot_pts_above'
      ]
    },
    {
      title: 'By distance',
      metrics: [
        'opp_shot_lt8_fg_pct',
        'opp_shot_d8_16_fg_pct',
        'opp_shot_d16_24_fg_pct',
        'opp_shot_d24p_fg_pct',
        'opp_shot_lt8_freq',
        'opp_shot_d24p_freq'
      ]
    },
    {
      title: 'Shot types',
      metrics: [
        'opp_shot_dunk_fga',
        'opp_shot_layup_fg_pct',
        'opp_shot_hook_fg_pct',
        'opp_shot_floater_fg_pct',
        'opp_shot_jumper_fg_pct',
        'opp_shot_jumper_freq'
      ]
    },
    {
      title: 'Assisted',
      note: 'The share of makes assisted, by the play by play',
      metrics: [
        'opp_shot_ra_ast_pct',
        'opp_shot_mid_ast_pct',
        'opp_shot_c3_ast_pct',
        'opp_shot_atb3_ast_pct'
      ]
    }
  ],
  offense: [
    {
      title: 'Scoring',
      metrics: ['team_pts', 'team_ortg', 'team_ppp', 'team_pace', 'team_poss_sym']
    },
    {
      title: 'Shooting',
      metrics: [
        'team_ts_pct',
        'team_efg_pct',
        'team_fg_pct',
        'team_fg2_pct',
        'team_fg3_pct',
        'team_ft_pct'
      ]
    },
    {
      title: 'Four factors',
      note: 'As the NBA counts them',
      metrics: ['team_efg_pct', 'team_tov_pct', 'team_orb_pct', 'team_fta_rate']
    },
    {
      title: 'Shot profile',
      metrics: ['team_fga', 'team_fg3a', 'team_fta', 'team_fg3a_rate', 'team_fg2a_rate']
    },
    {
      title: 'Where the points come from',
      metrics: [
        'team_paint_pts',
        'team_fast_break_pts',
        'team_turnover_pts',
        'team_starter_pts',
        'team_bench_pts',
        'team_share_pts_3pt'
      ]
    },
    {
      title: 'Playmaking',
      metrics: ['team_ast', 'team_ast_share', 'team_ast_ratio', 'team_tov', 'team_ast_tov']
    },
    { title: 'Rebounding', metrics: ['team_oreb', 'team_reb', 'team_trb_pct'] }
  ],
  defense: [
    { title: 'Scoring allowed', metrics: ['opp_pts', 'team_drtg', 'opp_ppp'] },
    {
      title: 'Shooting allowed',
      metrics: [
        'opp_ts_pct',
        'opp_efg_pct',
        'opp_fg_pct',
        'opp_fg2_pct',
        'opp_fg3_pct',
        'opp_ft_pct'
      ]
    },
    {
      title: 'Four factors',
      note: 'As the NBA counts them',
      metrics: ['opp_efg_pct', 'opp_tov_pct', 'team_drb_pct', 'opp_fta_rate']
    },
    {
      title: 'Shots allowed',
      metrics: ['opp_fga', 'opp_fg3a', 'opp_fta', 'opp_fg3a_rate', 'opp_fg2a_rate']
    },
    {
      title: 'Where they scored',
      metrics: ['opp_paint_pts', 'opp_fast_break_pts', 'opp_turnover_pts']
    },
    {
      title: 'Plays',
      note: 'From the box score',
      metrics: ['team_stl', 'team_blk', 'team_dreb', 'opp_tov', 'opp_ast', 'team_pf']
    }
  ]
}

/** Every team, for ranks: the engine ranks them among themselves. */
export function teamPoolQuery(metrics: string[], scope: StatsScope, mode: BoardMode): StatsQuery {
  return {
    entity: 'team',
    metrics,
    scope: queryScope(scope, 'team'),
    transform: mode,
    limit: 40
  }
}

/** The dashboard's first team: the best record in scope. */
export function defaultTeamQuery(scope: StatsScope): StatsQuery {
  return {
    entity: 'team',
    metrics: ['team_win_pct'],
    scope: queryScope(scope, 'team'),
    sort: { metric: 'team_win_pct', dir: 'desc' },
    limit: 1
  }
}

export function defaultTeam(
  result: StatsResult | null,
  season: StatsSeason | undefined
): string | null {
  return result?.rows[0]?.id ?? season?.teams[0]?.id ?? null
}

/** A team's name in a season, or in the nearest season it has one: a franchise moves and renames. */
export function teamIn(
  seasons: readonly StatsSeason[],
  season: number,
  team: string
): { code: string; name: string; exists: boolean } {
  const here = seasons.find((s) => s.season === season)?.teams.find((t) => t.id === team)
  if (here) return { code: here.code, name: here.name, exists: true }
  const nearest = [...seasons]
    .sort((a, b) => Math.abs(a.season - season) - Math.abs(b.season - season))
    .flatMap((s) => s.teams)
    .find((t) => t.id === team)
  return { code: nearest?.code ?? team, name: nearest?.name ?? team, exists: false }
}

/** One game from one team's side. */
export interface TeamGame {
  id: string
  date: string
  type: StatsGame['type']
  home: boolean
  opponent: GameSide
  played: boolean
  pointsFor: number | null
  pointsAgainst: number | null
  result: 'W' | 'L' | null
  overtimes: number | null
}

export function teamGames(games: readonly StatsGame[], team: string): TeamGame[] {
  return games
    .filter((g) => g.home.id === team || g.away.id === team)
    .map((g) => {
      const home = g.home.id === team
      const us = home ? g.home : g.away
      const them = home ? g.away : g.home
      const scored = g.played && us.score !== null && them.score !== null
      return {
        id: g.id,
        date: g.date,
        type: g.type,
        home,
        opponent: them,
        played: g.played,
        pointsFor: scored ? us.score : null,
        pointsAgainst: scored ? them.score : null,
        result: scored ? ((us.score ?? 0) > (them.score ?? 0) ? 'W' : 'L') : null,
        overtimes: g.overtimes
      }
    })
}

/** The games the scope bar names. A last-N range is of games played; a whole season has what is to come. */
export function gamesInScope(games: readonly TeamGame[], scope: StatsScope): TeamGame[] {
  const types = queryScope(scope, 'team').gameTypes ?? ['regular']
  const of = games.filter((g) => types.includes(g.type))
  const r = scope.range
  if (r.kind === 'dates') return of.filter((g) => g.date >= r.from && g.date <= r.to)
  if (r.kind === 'last') return of.filter((g) => g.played).slice(-r.n)
  return of
}

export interface TeamRecord {
  record: string
  pointsPerGame: string
  allowedPerGame: string
  margin: string
  tone: 'good' | 'bad' | null
}

const one = (x: number): string => fmtStat(x, { unit: 'number', decimals: 1 })

/** From the final scores, so it counts a game with no box score: the record does too. */
export function teamRecord(games: readonly TeamGame[]): TeamRecord {
  const played = games.filter((g) => g.result !== null)
  const wins = played.filter((g) => g.result === 'W').length
  const n = played.length
  if (n === 0) {
    return { record: '0-0', pointsPerGame: '—', allowedPerGame: '—', margin: '—', tone: null }
  }
  const scored = played.reduce((a, g) => a + (g.pointsFor ?? 0), 0)
  const allowed = played.reduce((a, g) => a + (g.pointsAgainst ?? 0), 0)
  const margin = (scored - allowed) / n
  return {
    record: `${wins}-${n - wins}`,
    pointsPerGame: one(scored / n),
    allowedPerGame: one(allowed / n),
    margin: `${margin > 0 ? '+' : ''}${one(margin)}`,
    tone: margin > 0 ? 'good' : margin < 0 ? 'bad' : null
  }
}

/** A game's score from this side: "W 110–102", "L 95–98 OT". */
export function scoreText(g: TeamGame): string | null {
  if (g.result === null) return null
  const ot = g.overtimes ? ` ${g.overtimes > 1 ? `${g.overtimes}OT` : 'OT'}` : ''
  return `${g.result} ${g.pointsFor}–${g.pointsAgainst}${ot}`
}

const opponentText = (g: TeamGame): string => `${g.home ? 'vs' : '@'} ${g.opponent.code}`

export interface ResultCard {
  key: string
  date: string
  opponent: string
  score: string | null
  result: TeamGame['result']
}

const CARDS_PLAYED = 15
const CARDS_AHEAD = 3

/** The strip: the latest games played, then the next ones. */
export function resultCards(games: readonly TeamGame[]): ResultCard[] {
  const played = games.filter((g) => g.played).slice(-CARDS_PLAYED)
  const last = played.at(-1)?.date ?? ''
  const ahead = games.filter((g) => !g.played && g.date >= last).slice(0, CARDS_AHEAD)
  return [...played, ...ahead].map((g) => ({
    key: g.id,
    date: shortDay(g.date),
    opponent: opponentText(g),
    score: scoreText(g),
    result: g.result
  }))
}

/**
 * The next game: the first not played whose day has not passed. A game past its day with no score is
 * one that was not played, like the Boston-Indiana game cancelled in 2013.
 */
export function nextGame(games: readonly TeamGame[], through: string | null): TeamGame | null {
  return games.find((g) => !g.played && (through === null || g.date > through)) ?? null
}

export interface ScheduleRow {
  key: string
  date: string
  opponent: string
  type: string | null
  score: string | null
  result: TeamGame['result']
  /** After this game, in the scope's games. */
  record: string
  /** "Not played" for a game past its day with no score. */
  status: string | null
}

export function scheduleRows(games: readonly TeamGame[], through: string | null): ScheduleRow[] {
  let wins = 0
  let losses = 0
  return games.map((g) => {
    if (g.result === 'W') wins++
    if (g.result === 'L') losses++
    return {
      key: g.id,
      date: shortDay(g.date),
      opponent: opponentText(g),
      type: typeTag(g.type),
      score: scoreText(g),
      result: g.result,
      record: g.played ? `${wins}-${losses}` : '',
      status: !g.played && through !== null && g.date <= through ? 'Not played' : null
    }
  })
}

/** The margin of each game played, for the Overview's chart. */
export function marginSeries(games: readonly TeamGame[]): ChartSeries {
  return {
    id: 'margin',
    label: 'Margin',
    points: games
      .filter((g) => g.result !== null)
      .map((g) => ({
        key: g.id,
        label: shortDay(g.date),
        title: `${shortDay(g.date)} ${opponentText(g)}`,
        value: (g.pointsFor ?? 0) - (g.pointsAgainst ?? 0)
      }))
  }
}

/** The team's players, each with the games they played for it: a traded player's stint, not their season. */
export const ROSTER_METRICS = [
  'gs',
  'min',
  'pts',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'fg_pct',
  'fg3_pct',
  'ft_pct',
  'ts_pct',
  'usg_pct',
  'plus_minus'
]

export function rosterQuery(team: string, scope: StatsScope, mode: BoardMode): StatsQuery {
  return {
    entity: 'player',
    metrics: ROSTER_METRICS,
    scope: { ...queryScope(scope, 'player'), teams: [team] },
    transform: mode,
    sort: { metric: 'min', dir: 'desc' },
    limit: 60
  }
}

export interface RosterRow {
  id: string
  name: string
  position: string | null
  games: string
  cells: string[]
}

export function rosterRows(
  result: StatsResult | null,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode
): RosterRow[] {
  return (result?.rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    games: String(r.games),
    cells: ROSTER_METRICS.map((id) =>
      fmtStat(r.values[id]?.value ?? null, byId.get(id) ?? { unit: 'number', decimals: 1 }, mode)
    )
  }))
}

export interface ScorerRow {
  id: string
  name: string
  position: string | null
  games: string
  points: string
  /** Their share of the team's points in the games they played, 0–1. */
  share: number
  shareText: string
  /** Against the team's leader, 0–1. */
  bar: number
  rebounds: string
  assists: string
}

const SCORERS_SHOWN = 8

/** Who scores: from the same query as the Players tab, the leading scorers. */
export const SCORER_METRICS = ['pts', 'share_pts', 'reb', 'ast']

export function scorersQuery(team: string, scope: StatsScope): StatsQuery {
  return {
    entity: 'player',
    metrics: SCORER_METRICS,
    scope: { ...queryScope(scope, 'player'), teams: [team] },
    transform: 'perGame',
    sort: { metric: 'pts', dir: 'desc' },
    limit: 60
  }
}

export function scorerRows(
  result: StatsResult | null,
  byId: ReadonlyMap<string, MetricInfo>
): ScorerRow[] {
  const raw = (id: string, r: StatsResult['rows'][number]): number => r.values[id]?.value ?? 0
  // Totals decide the order: a call-up's one big night does not lead the team.
  const rows = [...(result?.rows ?? [])]
    .sort((a, b) => raw('pts', b) * b.games - raw('pts', a) * a.games)
    .slice(0, SCORERS_SHOWN)
  const lead = Math.max(0, ...rows.map((r) => raw('share_pts', r)))
  const text = (id: string, r: StatsResult['rows'][number]): string =>
    fmtStat(r.values[id]?.value ?? null, byId.get(id) ?? { unit: 'number', decimals: 1 }, 'perGame')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    games: String(r.games),
    points: text('pts', r),
    share: raw('share_pts', r),
    shareText: text('share_pts', r),
    bar: lead > 0 ? raw('share_pts', r) / lead : 0,
    rebounds: text('reb', r),
    assists: text('ast', r)
  }))
}

/** The franchise by season: one NBA id across its moves, under each season's own name. */
export const HISTORY_METRICS = [
  'team_w',
  'team_l',
  'team_win_pct',
  'team_point_diff',
  'team_ortg',
  'team_drtg',
  'team_nrtg',
  'team_pace'
]

export function historyQuery(team: string, seasons: number[], scope: StatsScope): StatsQuery {
  return {
    entity: 'team',
    metrics: HISTORY_METRICS,
    scope: { seasons, gameTypes: queryScope(scope, 'team').gameTypes, teams: [team] },
    groupBy: ['season'],
    transform: 'perGame',
    sort: { metric: 'team_w', dir: 'desc' },
    limit: 100
  }
}

export interface HistoryRow {
  season: number
  label: string
  code: string | null
  name: string
  cells: string[]
}

/** Newest first. */
export function historyRows(
  result: StatsResult | null,
  byId: ReadonlyMap<string, MetricInfo>
): HistoryRow[] {
  return [...(result?.rows ?? [])]
    .sort((a, b) => Number(b.group.season) - Number(a.group.season))
    .map((r) => {
      const season = Number(r.group.season)
      return {
        season,
        label: seasonLabel(season),
        code: r.team,
        name: r.name,
        cells: HISTORY_METRICS.map((id) =>
          fmtStat(
            r.values[id]?.value ?? null,
            byId.get(id) ?? { unit: 'number', decimals: 1 },
            'perGame'
          )
        )
      }
    })
}

/** Why a dashboard is empty. */
export function noGamesNote(name: string, exists: boolean, scope: StatsScope): string {
  return exists
    ? `${name} played no games in ${scopeLabel(scope, 'team')}.`
    : `This franchise did not play in ${seasonLabel(scope.season)}.`
}
