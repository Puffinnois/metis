import type { MetricDef } from '../types'
import { allSides, count, ESPN_TEAM_SOURCES, metric, share, teamSides } from './define'

/** Reference section 6: scoring composition and shares of team production. */
const f = { family: 'scoring' } as const

/**
 * ESPN's points by kind. Its columns hold real values from these seasons, except the paint in 2017-18;
 * these categories overlap, so their shares do not add to 100 %.
 */
const PAINT = { firstSeason: 2009, missingSeasons: [2018] }
const FAST_BREAK = { firstSeason: 2002, missingSeasons: [2018] }
const OFF_TURNOVERS = { firstSeason: 1995, missingSeasons: [2018] }

/** A player's share of a team total, over the games they played. */
function teamShare(c: string, label: string, short: string): MetricDef {
  return metric(
    `share_${c}`,
    `Share of team ${label}`,
    short,
    `The player's share of the team's ${label} in the games they played. Whole games: the NBA's published share counts only the minutes they were on the floor.`,
    share(c, `tm_${c}`, 'minutes', { ...f, minSample: 1000 })
  )
}

export const SCORING: MetricDef[] = [
  ...allSides('pts_2pt', 'Two-point scoring', '2PT PTS', 'Points from made twos.', {
    ...count('fgm', { ...f, value: '2 * ({fgm} - {fg3m})', kind: 'derived' })
  }),
  ...allSides('pts_3pt', 'Three-point scoring', '3PT PTS', 'Points from made threes.', {
    ...count('fg3m', { ...f, value: '3 * {fg3m}', kind: 'derived' })
  }),
  ...allSides(
    'pts_ft',
    'Free-throw scoring',
    'FT PTS',
    'Points from free throws.',
    count('ftm', f)
  ),
  ...allSides(
    'share_pts_2pt',
    'Share of points from twos',
    '%PTS 2PT',
    'Points from made twos per point. Twos, threes and free throws add to 100 %.',
    {
      value: '2 * ({fgm} - {fg3m}) / nullif({pts}, 0)',
      sample: 'pts',
      unit: 'pct',
      direction: 'neutral',
      minSample: 500,
      ...f
    }
  ),
  ...allSides(
    'share_pts_3pt',
    'Share of points from threes',
    '%PTS 3PT',
    'Points from made threes per point. Twos, threes and free throws add to 100 %.',
    {
      value: '3 * {fg3m} / nullif({pts}, 0)',
      sample: 'pts',
      unit: 'pct',
      direction: 'neutral',
      minSample: 500,
      tier: 'core',
      ...f
    }
  ),
  ...allSides(
    'share_pts_ft',
    'Share of points from free throws',
    '%PTS FT',
    'Points from free throws per point. Twos, threes and free throws add to 100 %.',
    share('ftm', 'pts', 'pts', { ...f, direction: 'neutral', minSample: 500 })
  ),

  ...teamSides(
    'paint_pts',
    'Points in the paint',
    'PITP',
    'Field-goal points from inside the paint.',
    {
      ...count('paint_pts', { ...f, ...PAINT, sources: ESPN_TEAM_SOURCES, tier: 'core' })
    }
  ),
  ...teamSides(
    'fast_break_pts',
    'Fast-break points',
    'FBP',
    'Points tagged as fast-break scoring. They read low before 2004-05: about 5 a game, against 11 to 15 after.',
    count('fast_break_pts', { ...f, ...FAST_BREAK, sources: ESPN_TEAM_SOURCES, tier: 'core' })
  ),
  ...teamSides(
    'turnover_pts',
    'Points off turnovers',
    'PTOV',
    'Points on chances that follow an opponent’s turnover.',
    count('turnover_pts', { ...f, ...OFF_TURNOVERS, sources: ESPN_TEAM_SOURCES, tier: 'core' })
  ),
  ...teamSides(
    'share_pts_paint',
    'Share of points in the paint',
    '%PTS PITP',
    'Points in the paint per point. This overlaps the other kinds, so the shares do not add to 100 %.',
    share('paint_pts', 'pts', 'paint_pts', {
      ...f,
      ...PAINT,
      sources: ESPN_TEAM_SOURCES,
      direction: 'neutral'
    })
  ),
  ...teamSides(
    'share_pts_fb',
    'Share of points on the fast break',
    '%PTS FBP',
    'Fast-break points per point. This overlaps the other kinds, so the shares do not add to 100 %.',
    share('fast_break_pts', 'pts', 'fast_break_pts', {
      ...f,
      ...FAST_BREAK,
      sources: ESPN_TEAM_SOURCES,
      direction: 'neutral'
    })
  ),
  ...teamSides(
    'share_pts_tov',
    'Share of points off turnovers',
    '%PTS PTOV',
    'Points off turnovers per point. This overlaps the other kinds, so the shares do not add to 100 %.',
    share('turnover_pts', 'pts', 'turnover_pts', {
      ...f,
      ...OFF_TURNOVERS,
      sources: ESPN_TEAM_SOURCES,
      direction: 'neutral'
    })
  ),
  metric(
    'team_starter_pts',
    'Starter points',
    'STR PTS',
    'Points by that game’s starters. Who started is unknown for some games, mostly in 2001-02, 2004-05 and 2005-06, so per game counts only those known.',
    count('starter_pts', {
      ...f,
      entity: 'team',
      side: 'offense',
      kind: 'derived',
      sample: 'starts_known',
      perGameBy: 'starts_known'
    })
  ),
  metric(
    'team_bench_pts',
    'Bench points',
    'BEN PTS',
    'Points by players who did not start that game. Who started is unknown for some games, mostly in 2001-02, 2004-05 and 2005-06, so per game counts only those known.',
    count('bench_pts', {
      ...f,
      entity: 'team',
      side: 'offense',
      kind: 'derived',
      sample: 'starts_known',
      perGameBy: 'starts_known',
      tier: 'core'
    })
  ),

  teamShare('pts', 'points', '%PTS'),
  teamShare('fgm', 'field goals made', '%FGM'),
  teamShare('fga', 'field-goal attempts', '%FGA'),
  teamShare('fg3m', 'threes made', '%3PM'),
  teamShare('fg3a', 'three-point attempts', '%3PA'),
  teamShare('ftm', 'free throws made', '%FTM'),
  teamShare('fta', 'free-throw attempts', '%FTA'),
  teamShare('oreb', 'offensive rebounds', '%OREB'),
  teamShare('dreb', 'defensive rebounds', '%DREB'),
  teamShare('reb', 'rebounds', '%REB'),
  teamShare('ast', 'assists', '%AST'),
  teamShare('tov', 'turnovers', '%TOV'),
  teamShare('stl', 'steals', '%STL'),
  teamShare('blk', 'blocks', '%BLK'),
  teamShare('pf', 'personal fouls', '%PF')
]
