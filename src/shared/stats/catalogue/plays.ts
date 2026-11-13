import {
  FOUL_KINDS,
  FOULS_DRAWN_FIRST_SEASON,
  FOULS_DRAWN_LAST_SEASON,
  PLAY_DETAIL_FIRST_SEASON,
  TURNOVER_KINDS
} from '../playDetail'
import type { MetricDef } from '../types'
import { metric, type Opts } from './define'

/**
 * Reference section 16 (play-derived statistics), with section 3's technicals, flagrants, ejections
 * and fouls drawn and section 13's game flow: counted per player-game and team-game from the NBA's
 * play by play (`src/main/stats/derived/playDetail.ts`), so any season, date range or game filter
 * reads exactly; every share and rate is divided when read. The rules are in
 * `src/shared/stats/playDetail.ts`; how each compares with the box scores, per season, in
 * `docs/reference/nba-data-sources.md`, "Play-derived stats".
 *
 * Fouls drawn come from ESPN's play by play, the only feed naming the fouled player, and only from
 * 2006-07 to 2016-17 (2005-06 agrees with the box scores too rarely to show).
 */

const SOURCES = ["The NBA's play by play"]
const ESPN_SOURCES = ["ESPN's play by play (the fouled player)"]
const TABLES = { player: 'play_player_game', team: 'play_team_game' } as const

/** Seasons after ESPN stopped naming the fouled player, through the years a load can reach. */
const AFTER_FOULS_DRAWN = Array.from({ length: 2040 - FOULS_DRAWN_LAST_SEASON }, (_, i) => {
  return FOULS_DRAWN_LAST_SEASON + 1 + i
})

interface Side {
  entity: 'player' | 'team'
  c: string
  id: (rest: string) => string
  label: (text: string) => string
  short: (text: string) => string
  side?: 'offense' | 'defense'
  /** Opponents' side: what is good for the actor is bad for the team. */
  flip: boolean
}

const lowerFirst = (text: string): string =>
  /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text

const PLAYER: Side = {
  entity: 'player',
  c: '',
  id: (r) => `pbp_${r}`,
  label: (t) => t,
  short: (t) => t,
  flip: false
}
const TEAM: Side = {
  entity: 'team',
  c: '',
  id: (r) => `team_pbp_${r}`,
  label: (t) => t,
  short: (t) => t,
  side: 'offense',
  flip: false
}
const OPP: Side = {
  entity: 'team',
  c: 'opp_',
  id: (r) => `opp_pbp_${r}`,
  label: (t) => `Opponent ${lowerFirst(t)}`,
  short: (t) => `Opp ${t}`,
  side: 'defense',
  flip: true
}
const ALL = [PLAYER, TEAM, OPP]
const TEAMS = [TEAM, OPP]

const flipped = (s: Side, d: MetricDef['direction']): MetricDef['direction'] =>
  s.flip && d !== 'neutral' ? (d === 'higher' ? 'lower' : 'higher') : d

/** Replaces each `{x}` with the side's component, `{opp_x}` for opponents. */
const sided = (s: Side, sql: string): string =>
  sql.replace(/\{([a-z0-9_]+)\}/g, (_, c: string) => `{${SHARED.has(c) ? '' : s.c}${c}}`)

/** What both sides of a game share: the opponents' view reads the same column. */
const SHARED = new Set([
  'games',
  'box_games',
  'flow_games',
  'game_ds',
  'tied_ds',
  'lead_changes',
  'times_tied'
])

function base(s: Side, o: Opts & { min?: number }): Opts {
  const { min, ...rest } = o
  const team = s.entity === 'team'
  return {
    family: 'plays',
    entity: s.entity,
    side: s.side,
    sources: SOURCES,
    firstSeason: PLAY_DETAIL_FIRST_SEASON,
    built: TABLES[s.entity],
    tier: 'extended',
    kind: 'derived',
    minSample: team ? undefined : min,
    ...rest,
    value: sided(s, rest.value),
    sample: sided(s, rest.sample),
    direction: flipped(s, rest.direction ?? 'higher'),
    ...(team && rest.sample === 'games' ? { sample: 'box_games', perGameBy: 'box_games' } : {})
  }
}

interface Entry {
  key: string
  label: string
  short: string
  description: string
  opts: Opts & { min?: number }
  sides?: Side[]
}

const countOf = (c: string, o: Partial<Opts> = {}): Opts => ({
  value: `{${c}}`,
  sample: 'games',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  ...o
})

const shareOf = (
  a: string,
  b: string,
  min: number,
  o: Partial<Opts> = {}
): Opts & { min: number } => ({
  value: `{${a}} / nullif({${b}}, 0)`,
  sample: b,
  aggregation: 'ratio',
  unit: 'pct',
  decimals: 1,
  direction: 'neutral',
  min,
  ...o
})

const TOV_WORDS: Record<string, string> = {
  bad_pass: 'Bad-pass turnovers: passes stolen or thrown away, out of bounds included.',
  lost_ball:
    'Lost-ball turnovers: the ball lost on the dribble or in a scramble, out of bounds included.',
  off_foul: 'Turnovers on an offensive foul: charges, illegal screens and swinging elbows.',
  travel: 'Traveling turnovers.',
  shot_clock: 'Shot-clock turnovers, nearly all charged to the team, not a player.',
  out_of_bounds: 'Turnovers for stepping out of bounds with the ball.',
  violation:
    'Turnovers on any other violation: three seconds, backcourt, double dribble, offensive goaltending and the rest.',
  other: 'Turnovers whose type the feed does not give, or gives in a spelling not mapped.'
}

const TOV_HEAD: Record<string, string> = {
  bad_pass: 'BadP TO',
  lost_ball: 'Lost TO',
  off_foul: 'OffF TO',
  travel: 'Trav TO',
  shot_clock: 'SC TO',
  out_of_bounds: 'OOB TO',
  violation: 'Viol TO',
  other: 'Oth TO'
}

const FOUL_WORDS: Record<string, string> = {
  shooting: 'Shooting fouls committed, blocking fouls on a shooter included.',
  personal:
    'Non-shooting personal fouls committed: on the ball, off it, away from the play, inbound.',
  offensive: 'Offensive fouls committed, charges included.',
  loose_ball: 'Loose-ball fouls committed.',
  take: 'Take fouls committed: a deliberate foul to stop play, from 2010-11.',
  transition_take: 'Transition take fouls committed, the rule of 2022-23 on.',
  clear_path: 'Clear-path fouls committed.',
  flagrant1: 'Flagrant fouls of type 1 committed.',
  flagrant2: 'Flagrant fouls of type 2 committed.',
  other: 'Personal fouls whose type is not mapped.'
}

const FOUL_HEAD: Record<string, string> = {
  shooting: 'S PF',
  personal: 'NS PF',
  offensive: 'Off PF',
  loose_ball: 'LB PF',
  take: 'Take PF',
  transition_take: 'TT PF',
  clear_path: 'CP PF',
  flagrant1: 'FF1',
  flagrant2: 'FF2',
  other: 'Oth PF'
}

const FIRST_OF: Record<string, number> = { take: 2011, transition_take: 2023 }

const ENTRIES: Entry[] = [
  // Turnovers
  ...TURNOVER_KINDS.map((k): Entry => ({
    key: `tov_${k.key}`,
    label: `${k.label} turnovers`,
    short: TOV_HEAD[k.key],
    description: TOV_WORDS[k.key],
    opts: countOf(`tov_${k.key}`, { direction: 'lower' })
  })),
  {
    key: 'tov_live',
    label: 'Live-ball turnovers',
    short: 'Live TO',
    description:
      'Turnovers with a steal credited, so the ball stays live. The rest are dead-ball turnovers.',
    opts: countOf('tov_live', { direction: 'lower' })
  },
  {
    key: 'tov_dead',
    label: 'Dead-ball turnovers',
    short: 'Dead TO',
    description: 'Turnovers with no steal credited: play stops.',
    opts: countOf('tov_dead', { direction: 'lower' })
  },
  {
    key: 'tov_live_share',
    label: 'Live-ball turnover share',
    short: 'Live TO%',
    description: 'The share of turnovers that were live-ball: a steal credited.',
    opts: shareOf('tov_live', 'tov', 50, { direction: 'lower' })
  },
  ...['bad_pass', 'lost_ball', 'off_foul', 'travel'].map((k): Entry => ({
    key: `tov_${k}_share`,
    label: `${TURNOVER_KINDS.find((x) => x.key === k)?.label} share of turnovers`,
    short: `${TOV_HEAD[k]}%`,
    description: `The share of turnovers that were ${lowerFirst(TURNOVER_KINDS.find((x) => x.key === k)?.label ?? k)}.`,
    opts: shareOf(`tov_${k}`, 'tov', 50)
  })),
  {
    key: 'tov_team',
    label: 'Team turnovers',
    short: 'Team TO',
    description:
      'Turnovers charged to the team, not a player (a shot-clock violation, five seconds): the box score leaves them out.',
    opts: countOf('tov_team', { direction: 'lower' }),
    sides: TEAMS
  },
  // Fouls
  ...FOUL_KINDS.filter((k) => k.key !== 'other').map((k): Entry => ({
    key: `pf_${k.key}`,
    label: `${k.label} fouls`,
    short: FOUL_HEAD[k.key],
    description: FOUL_WORDS[k.key],
    opts: countOf(`pf_${k.key}`, {
      direction: 'lower',
      ...(FIRST_OF[k.key] ? { firstSeason: FIRST_OF[k.key] } : {})
    })
  })),
  {
    key: 'pf_shooting_share',
    label: 'Shooting share of fouls',
    short: 'S PF%',
    description: 'The share of personal fouls that were shooting fouls.',
    opts: shareOf('pf_shooting', 'pf', 50)
  },
  {
    key: 'flagrant',
    label: 'Flagrant fouls',
    short: 'Flagrant',
    description: 'Flagrant fouls of either type committed.',
    opts: {
      ...countOf('pf_flagrant1'),
      value: '{pf_flagrant1} + {pf_flagrant2}',
      direction: 'lower'
    }
  },
  {
    key: 'tech',
    label: 'Technical fouls',
    short: 'Tech',
    description:
      'Technical fouls: unsportsmanlike, delay, hanging, taunting, flopping, bench and the rest, defensive three seconds apart. A double technical names one player in the feed, so the other is not credited.',
    opts: countOf('tech', { direction: 'lower' })
  },
  {
    key: 'def3',
    label: 'Defensive three seconds',
    short: 'Def 3s',
    description: 'Defensive three-second technicals.',
    opts: countOf('def3', { direction: 'lower' })
  },
  {
    key: 'ejections',
    label: 'Ejections',
    short: 'Ejected',
    description: 'Ejections, as the play by play records them.',
    opts: countOf('ejections', { direction: 'lower' })
  },
  {
    key: 'fd',
    label: 'Fouls drawn',
    short: 'PFD',
    description:
      'Personal fouls drawn, from ESPN’s play by play, which names the fouled player from 2006-07 to 2016-17 only.',
    opts: countOf('fd', {
      sources: ESPN_SOURCES,
      firstSeason: FOULS_DRAWN_FIRST_SEASON,
      missingSeasons: AFTER_FOULS_DRAWN
    })
  },
  {
    key: 'fd_shooting',
    label: 'Shooting fouls drawn',
    short: 'S PFD',
    description: 'Shooting fouls drawn, from ESPN’s play by play, 2006-07 to 2016-17.',
    opts: countOf('fd_shooting', {
      sources: ESPN_SOURCES,
      firstSeason: FOULS_DRAWN_FIRST_SEASON,
      missingSeasons: AFTER_FOULS_DRAWN
    })
  },
  // And-ones and free-throw trips
  {
    key: 'and1',
    label: 'And-ones',
    short: 'And1',
    description:
      'Made field goals with a shooting foul on the shot: a make, a shooting foul by the other side and one free throw by the shooter, at the same moment.',
    opts: countOf('and1')
  },
  {
    key: 'and1_ftm',
    label: 'And-ones converted',
    short: 'And1 FTM',
    description: 'And-ones whose free throw went in.',
    opts: countOf('and1_ftm')
  },
  {
    key: 'and1_pct',
    label: 'And-one conversion',
    short: 'And1%',
    description: 'The share of and-one free throws made.',
    opts: shareOf('and1_ftm', 'and1', 20, { direction: 'higher' })
  },
  {
    key: 'and1_rate',
    label: 'And-ones per make',
    short: 'And1/FGM',
    description: 'And-ones over field goals made (the box score’s).',
    opts: shareOf('and1', 'fgm', 150, { direction: 'higher' })
  },
  {
    key: 'ft_trip2',
    label: 'Two-shot fouls',
    short: '2FT trips',
    description: 'Shooting-foul trips of two free throws, counted once a trip.',
    opts: countOf('ft_trip2')
  },
  {
    key: 'ft_trip3',
    label: 'Three-shot fouls',
    short: '3FT trips',
    description: 'Shooting-foul trips of three free throws, counted once a trip.',
    opts: countOf('ft_trip3')
  },
  {
    key: 'trip_rate',
    label: 'Shooting-foul trips per FGA',
    short: 'Trips/FGA',
    description:
      'Shooting-foul trips (two- and three-shot fouls and and-ones) per field-goal attempt: trips, not free-throw attempts.',
    opts: {
      value: '({ft_trip2} + {ft_trip3} + {and1}) / nullif({fga}, 0)',
      sample: 'fga',
      aggregation: 'ratio',
      unit: 'pct',
      decimals: 1,
      direction: 'higher',
      min: 300
    }
  },
  // Assisted and unassisted makes
  {
    key: 'made2_ast',
    label: 'Assisted twos',
    short: 'Ast 2PM',
    description: 'Two-point field goals made with an assist.',
    opts: countOf('made2_ast')
  },
  {
    key: 'made2_unast',
    label: 'Unassisted twos',
    short: 'Unast 2PM',
    description: 'Two-point field goals made with no assist.',
    opts: countOf('made2_unast')
  },
  {
    key: 'made3_ast',
    label: 'Assisted threes',
    short: 'Ast 3PM',
    description: 'Threes made with an assist.',
    opts: countOf('made3_ast')
  },
  {
    key: 'made3_unast',
    label: 'Unassisted threes',
    short: 'Unast 3PM',
    description: 'Threes made with no assist.',
    opts: countOf('made3_unast')
  },
  {
    key: 'ast2_share',
    label: 'Assisted share of twos',
    short: '%Ast 2PM',
    description: 'The share of two-point makes that were assisted.',
    opts: {
      ...shareOf('made2_ast', 'made2_ast', 100),
      value: '{made2_ast} / nullif({made2_ast} + {made2_unast}, 0)'
    }
  },
  {
    key: 'ast3_share',
    label: 'Assisted share of threes',
    short: '%Ast 3PM',
    description: 'The share of threes made that were assisted.',
    opts: {
      ...shareOf('made3_ast', 'made3_ast', 40),
      value: '{made3_ast} / nullif({made3_ast} + {made3_unast}, 0)'
    }
  },
  {
    key: 'unast_share',
    label: 'Unassisted share of makes',
    short: '%Unast FGM',
    description: 'The share of field goals made with no assist.',
    opts: {
      ...shareOf('made2_unast', 'made2_unast', 150),
      value:
        '({made2_unast} + {made3_unast}) / nullif({made2_ast} + {made2_unast} + {made3_ast} + {made3_unast}, 0)'
    }
  },
  // Violations
  {
    key: 'goaltend',
    label: 'Defensive goaltending',
    short: 'GT',
    description: 'Defensive goaltending violations called.',
    opts: countOf('goaltend', { direction: 'lower' })
  },
  {
    key: 'kicked',
    label: 'Kicked balls',
    short: 'Kick',
    description: 'Kicked-ball violations called.',
    opts: countOf('kicked', { direction: 'lower' })
  }
]

/** The passer's side, players only: assists by the value of the make, and the points they created. */
const PASSING: MetricDef[] = [
  metric(
    'pbp_ast2',
    'Assists on twos',
    'Ast→2',
    'Assists on two-point makes.',
    base(PLAYER, countOf('ast2'))
  ),
  metric(
    'pbp_ast3',
    'Assists on threes',
    'Ast→3',
    'Assists on threes.',
    base(PLAYER, countOf('ast3'))
  ),
  metric(
    'pbp_ast_pts',
    'Assist points',
    'Ast PTS',
    'Points from the makes a player assisted: 2 a two, 3 a three. Free throws after a pass are not counted.',
    base(PLAYER, { ...countOf('ast2'), value: '2 * {ast2} + 3 * {ast3}' })
  ),
  metric(
    'pbp_ast_to3_share',
    'Share of assists on threes',
    '%Ast→3',
    'The share of a player’s assists that set up a three.',
    base(PLAYER, {
      value: '{ast3} / nullif({ast2} + {ast3}, 0)',
      sample: 'ast2',
      aggregation: 'ratio',
      unit: 'pct',
      decimals: 1,
      direction: 'neutral',
      min: 100
    })
  )
]

/** A team's assist points: its assisted makes, by value. */
const TEAM_PASSING: MetricDef[] = TEAMS.map((s) =>
  metric(
    s.id('ast_pts'),
    s.label('Assist points'),
    s.short('Ast PTS'),
    'Points from assisted makes: 2 a two, 3 a three.',
    base(s, { ...countOf('made2_ast'), value: '2 * {made2_ast} + 3 * {made3_ast}' })
  )
)

/** The game flow, teams only: averages per game with plays, the opponents' side the team's deficit. */
const flowAvg = (c: string, o: Partial<Opts> = {}): Opts => ({
  value: `{${c}} / nullif({flow_games}, 0)`,
  sample: 'flow_games',
  aggregation: 'ratio',
  unit: 'number',
  decimals: 1,
  ...o
})

const FLOW: MetricDef[] = [
  metric(
    'team_pbp_lead_changes',
    'Lead changes',
    'LC',
    'Lead changes a game: a score that puts a side ahead when the other led last, a tie between or not. The first lead is not a change.',
    base(TEAM, flowAvg('lead_changes', { direction: 'neutral' }))
  ),
  metric(
    'team_pbp_times_tied',
    'Times tied',
    'Tied',
    'Scores that level the game, a game. 0-0 at the tip is not a tie.',
    base(TEAM, flowAvg('times_tied', { direction: 'neutral' }))
  ),
  metric(
    'team_pbp_tied_share',
    'Time tied',
    'Tied%',
    'The share of game time with the score level, 0-0 at the tip included.',
    base(TEAM, {
      value: '{tied_ds} / nullif({game_ds}, 0)',
      sample: 'flow_games',
      aggregation: 'ratio',
      unit: 'pct',
      decimals: 1,
      direction: 'neutral'
    })
  ),
  ...TEAMS.flatMap((s) => [
    metric(
      s.id('largest_lead'),
      s.flip ? 'Largest deficit' : 'Largest lead',
      s.flip ? 'Max Def' : 'Max Lead',
      s.flip
        ? 'The most the team trailed by, on average a game.'
        : 'The most the team led by, on average a game; 0 in a game it never led.',
      base(s, { ...flowAvg('largest_lead'), direction: s.flip ? 'higher' : 'higher' })
    ),
    metric(
      s.id('lead_share'),
      s.flip ? 'Time trailing' : 'Time leading',
      s.flip ? 'Trail%' : 'Lead%',
      `The share of game time with the team ${s.flip ? 'behind' : 'ahead'}, by the game clock.`,
      base(s, {
        value: '{lead_ds} / nullif({game_ds}, 0)',
        sample: 'flow_games',
        aggregation: 'ratio',
        unit: 'pct',
        decimals: 1,
        direction: 'higher'
      })
    ),
    metric(
      s.id('best_run'),
      s.label('Best run'),
      s.short('Run'),
      'The longest run a game, on average: points scored with none by the other side between; any point ends it, a free throw included, and it carries over a period break.',
      base(s, flowAvg('best_run'))
    ),
    metric(
      s.id('drought'),
      s.label('Longest scoring drought'),
      s.short('Drought'),
      'The longest time without a point a game, on average, in minutes of game clock, from the tip, between scores or to the end.',
      base(s, {
        ...flowAvg('drought_ds'),
        value: '{drought_ds} / 600.0 / nullif({flow_games}, 0)',
        unit: 'minutes',
        direction: 'lower'
      })
    ),
    metric(
      s.id('drought_fg'),
      s.label('Longest field-goal drought'),
      s.short('FG Drought'),
      'The longest time without a field goal a game, on average, in minutes of game clock.',
      base(s, {
        ...flowAvg('drought_fg_ds'),
        value: '{drought_fg_ds} / 600.0 / nullif({flow_games}, 0)',
        unit: 'minutes',
        direction: 'lower'
      })
    )
  ])
]

/**
 * The family's leaderboard preset: what a turnover, a foul, an assist and a game's flow most often
 * come down to. Core, so the preset shows them first.
 */
const CORE = new Set([
  'tov_bad_pass',
  'tov_lost_ball',
  'tov_off_foul',
  'tov_live_share',
  'pf_shooting',
  'pf_offensive',
  'tech',
  'and1',
  'and1_pct',
  'trip_rate',
  'ast_pts',
  'unast_share',
  'lead_changes',
  'largest_lead',
  'best_run',
  'drought'
])

const PLAYS_ALL: MetricDef[] = [
  ...ENTRIES.flatMap((e) =>
    (e.sides ?? ALL).map((s) =>
      metric(
        s.id(e.key),
        s.label(e.label),
        s.short(e.short),
        s.flip ? `${e.description} For the team's opponents.` : e.description,
        base(s, e.opts)
      )
    )
  ),
  ...PASSING,
  ...TEAM_PASSING,
  ...FLOW
]

export const PLAYS: MetricDef[] = PLAYS_ALL.map((m) =>
  CORE.has(m.id.replace(/^(team_|opp_)?pbp_/, '')) ? { ...m, tier: 'core' as const } : m
)

/** What each sample counts, in words. */
export const PLAY_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  and1: 'and-ones',
  opp_and1: 'and-ones allowed',
  made2_ast: 'two-point makes',
  opp_made2_ast: 'two-point makes allowed',
  made3_ast: 'threes made',
  opp_made3_ast: 'threes allowed',
  made2_unast: 'field goals made',
  opp_made2_unast: 'field goals allowed',
  ast2: 'assists',
  pf: 'personal fouls',
  opp_pf: 'opponents’ personal fouls',
  flow_games: 'games with play by play'
}
