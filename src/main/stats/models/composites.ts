import { div, leagueOf, possessions, type Box, type TeamSeason } from './box'
import { bpmForTeam, teamRatings } from './bpm'
import { oliverDefense, oliverOffense } from './oliver'
import { aPer, leagueMeanAPer, perLeague, perOf, uPer } from './per'
import { winShares } from './winShares'

/**
 * The box-score composites of one season and game type (Plan T1005), from every player's line with
 * each team and every team's season. Each line is computed with its own team, as the published
 * methods do for a traded player; the player's season is the sum of those lines.
 *
 * What is stored adds up (policy 3): Win Shares, VORP, points produced and possessions as sums; PER,
 * BPM and the defensive rating as a value times its weight, beside the weight, so a group of whole
 * seasons divides back exactly.
 */

export interface CompositeLine {
  playerId: number
  teamId: number
  box: Box
  /** Listed position, 1 (point guard) to 5 (center), when the roster has one. */
  listed: number | null
}

/** The columns of `player_composite` and `team_composite` that are summed. */
export const COMPOSITE_SUMS = [
  'minutes',
  'sc_poss',
  'tot_poss',
  'pprod',
  'stops',
  'd_poss',
  'drtg_num',
  'per_num',
  'ows',
  'dws',
  'ws',
  'bpm_poss',
  'bpm_num',
  'obpm_num',
  'vorp',
  'position_num',
  'role_num'
] as const
export type CompositeSums = Record<(typeof COMPOSITE_SUMS)[number], number>

export interface PlayerComposite extends CompositeSums {
  playerId: number
  /** Null on the row of the whole season, with every team. */
  teamId: number | null
}

export interface TeamComposite extends CompositeSums {
  teamId: number
}

export interface SeasonComposites {
  players: PlayerComposite[]
  teams: TeamComposite[]
  /** The minutes-weighted mean aPER that PER is scaled by. */
  leagueAPer: number
}

const zero = (): CompositeSums =>
  Object.fromEntries(COMPOSITE_SUMS.map((c) => [c, 0])) as CompositeSums

function addInto(into: CompositeSums, from: CompositeSums): void {
  for (const c of COMPOSITE_SUMS) into[c] += from[c]
}

export function seasonComposites(
  lines: readonly CompositeLine[],
  teams: ReadonlyMap<number, TeamSeason>
): SeasonComposites {
  const league = leagueOf([...teams.values()])
  const perLg = perLeague(league)
  const byTeam = new Map<number, CompositeLine[]>()
  for (const l of lines) {
    if (!teams.has(l.teamId)) continue
    const list = byTeam.get(l.teamId) ?? []
    list.push(l)
    byTeam.set(l.teamId, list)
  }

  const computed: { line: CompositeLine; sums: CompositeSums; aPer: number }[] = []
  for (const [teamId, list] of byTeam) {
    const ts = teams.get(teamId) as TeamSeason
    const lead = div(0.5 * (ts.team.pts - ts.opp.pts), ts.games)
    const bpm = bpmForTeam(list, ts, teamRatings(ts, league, lead))
    const teamPoss = possessions(ts)
    list.forEach((line, i) => {
      const p = line.box
      const off = oliverOffense(p, ts)
      const def = oliverDefense(p, ts)
      const ws = winShares(p, off, def, ts, league)
      const a = aPer(uPer(p, ts, perLg), ts, league)
      const b = bpm[i]
      const bpmPoss = b.share * teamPoss
      computed.push({
        line,
        aPer: a,
        sums: {
          minutes: p.mp,
          sc_poss: off.scPoss,
          tot_poss: off.totPoss,
          pprod: off.pprod,
          stops: def.stops,
          d_poss: def.dPoss,
          drtg_num: def.drtg * def.dPoss,
          // Scaled once the league's mean is known.
          per_num: a * p.mp,
          ows: ws.ows,
          dws: ws.dws,
          ws: ws.ws,
          bpm_poss: bpmPoss,
          bpm_num: b.bpm * bpmPoss,
          obpm_num: b.obpm * bpmPoss,
          vorp: b.vorp,
          position_num: b.position * p.mp,
          role_num: b.role * p.mp
        }
      })
    })
  }

  const leagueAPer = leagueMeanAPer(computed.map((c) => ({ aPer: c.aPer, mp: c.line.box.mp })))
  for (const c of computed) c.sums.per_num = perOf(c.aPer, leagueAPer) * c.line.box.mp

  const players: PlayerComposite[] = []
  const totals = new Map<number, PlayerComposite>()
  const teamRows = new Map<number, TeamComposite>()
  for (const { line, sums } of computed) {
    players.push({ playerId: line.playerId, teamId: line.teamId, ...sums })
    const total = totals.get(line.playerId) ?? { playerId: line.playerId, teamId: null, ...zero() }
    addInto(total, sums)
    totals.set(line.playerId, total)
    const team = teamRows.get(line.teamId) ?? { teamId: line.teamId, ...zero() }
    addInto(team, sums)
    teamRows.set(line.teamId, team)
  }
  return { players: [...players, ...totals.values()], teams: [...teamRows.values()], leagueAPer }
}
