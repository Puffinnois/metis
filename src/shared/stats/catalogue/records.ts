import type { MetricDef } from '../types'
import { metric, NBA_FIRST_SEASON, type Opts } from './define'

/**
 * Reference section 13: a team's record by situation, as the league's standings publish it
 * (`src_dash_standings`, regular season): close games, blowouts, overtime, the score at the half and
 * after three quarters, scoring a mark, against winning teams, and the games it won the battle of
 * shooting, rebounds or turnovers. Each is stored as wins and losses, so seasons add up, and read as
 * a win percentage over the games in it. The records by month, conference and division are left to
 * the board's own scope, which counts them from the games. The longest streaks read one season at a
 * time: a season's longest run does not add up.
 */
const SOURCES = ["The league's standings"]
const TABLE = 'pub_team_records'
/** The NBA's standings publish these records from 2000-01; the WNBA's from 1997 or 1998. */
const FIRST = 2001

const AS_PUBLISHED = 'As the league’s standings publish it, for the regular season.'

/** A record by situation: its win percentage over the games in it, from the stored wins and losses. */
const record = (key: string, o: Partial<Opts> = {}): Opts => ({
  value: `{rec_${key}_w} / nullif({rec_${key}_g}, 0)`,
  sample: `rec_${key}_g`,
  family: 'ratings',
  entity: 'team',
  side: 'offense',
  kind: 'recorded',
  aggregation: 'ratio',
  unit: 'pct',
  decimals: 1,
  sources: SOURCES,
  firstSeason: FIRST,
  published: TABLE,
  ...o
})

/** The records, each a standings column and its words: [key, column, label, short, what it counts]. */
export const RECORD_COLUMNS = [
  [
    'close',
    'three_pts_or_less',
    'Record in close games',
    'Close W%',
    'games decided by 3 points or fewer'
  ],
  [
    'blowout',
    'ten_pts_or_more',
    'Record in games decided by 10 or more',
    '10+ W%',
    'games decided by 10 points or more'
  ],
  ['ot', 'ot', 'Record in overtime games', 'OT W%', 'games that went to overtime'],
  [
    'ahead_half',
    'ahead_at_half',
    'Record when ahead at the half',
    'Ahead½ W%',
    'games it led at the half'
  ],
  [
    'behind_half',
    'behind_at_half',
    'Record when behind at the half',
    'Behind½ W%',
    'games it trailed at the half'
  ],
  [
    'tied_half',
    'tied_at_half',
    'Record when tied at the half',
    'Tied½ W%',
    'games tied at the half'
  ],
  [
    'ahead_third',
    'ahead_at_third',
    'Record when ahead after three quarters',
    'Ahead Q3 W%',
    'games it led after three quarters'
  ],
  [
    'behind_third',
    'behind_at_third',
    'Record when behind after three quarters',
    'Behind Q3 W%',
    'games it trailed after three quarters'
  ],
  [
    'tied_third',
    'tied_at_third',
    'Record when tied after three quarters',
    'Tied Q3 W%',
    'games tied after three quarters'
  ],
  [
    'score100',
    'score100_pts',
    'Record when scoring 100 or more',
    '100+ W%',
    'games it scored 100 points or more'
  ],
  [
    'opp100',
    'opp_score100_pts',
    'Record when allowing 100 or more',
    'Opp 100+ W%',
    'games its opponent scored 100 points or more'
  ],
  [
    'score80',
    'score_80_plus',
    'Record when scoring 80 or more',
    '80+ W%',
    'games it scored 80 points or more'
  ],
  [
    'opp80',
    'opp_score_80_plus',
    'Record when allowing 80 or more',
    'Opp 80+ W%',
    'games its opponent scored 80 points or more'
  ],
  [
    'below80',
    'score_below_80',
    'Record when scoring under 80',
    '<80 W%',
    'games it scored under 80 points'
  ],
  [
    'opp_below80',
    'opp_score_below_80',
    'Record when allowing under 80',
    'Opp <80 W%',
    'games its opponent scored under 80 points'
  ],
  [
    'vs_winning',
    'opp_over500',
    'Record against winning teams',
    'vs .500+ W%',
    'games against teams over .500'
  ],
  [
    'won_fg',
    'lead_in_fgpct',
    'Record when shooting better',
    'FG% edge W%',
    'games it shot a better field-goal percentage than its opponent'
  ],
  [
    'won_reb',
    'lead_in_reb',
    'Record when outrebounding',
    'REB edge W%',
    'games it had more rebounds than its opponent'
  ],
  [
    'fewer_tov',
    'fewer_turnovers',
    'Record with fewer turnovers',
    'TOV edge W%',
    'games it committed fewer turnovers than its opponent'
  ]
] as const

/** The overtime record starts with the standings themselves, in 1996-97. */
const OWN_FIRST: Partial<Record<string, number>> = { ot: NBA_FIRST_SEASON }

const RECORDS: MetricDef[] = RECORD_COLUMNS.map(([key, , label, short, counts]) =>
  metric(
    `team_rec_${key}`,
    label,
    short,
    `The team’s win percentage in ${counts}, over those games. ${AS_PUBLISHED}`,
    {
      ...record(key, OWN_FIRST[key] ? { firstSeason: OWN_FIRST[key] } : {}),
      categories: ['results.record']
    }
  )
)

/** The longest streaks: [key, column, label, short, what it counts]. */
export const STREAK_COLUMNS = [
  ['win', 'long_win_streak', 'Longest winning streak', 'Long W', 'games won in a row'],
  ['loss', 'long_loss_streak', 'Longest losing streak', 'Long L', 'games lost in a row'],
  [
    'home',
    'long_home_streak',
    'Longest home winning streak',
    'Long home W',
    'home games won in a row'
  ],
  [
    'road',
    'long_road_streak',
    'Longest road winning streak',
    'Long road W',
    'road games won in a row'
  ]
] as const

const STREAKS: MetricDef[] = STREAK_COLUMNS.map(([key, , label, short, counts]) =>
  metric(
    `team_long_${key}_streak`,
    label,
    short,
    `The most ${counts} in the season. ${AS_PUBLISHED} It reads for one season at a time.`,
    {
      value: `{streak_${key}}`,
      sample: 'rec_games',
      family: 'ratings',
      entity: 'team',
      side: 'offense',
      kind: 'recorded',
      aggregation: 'sum',
      totalOnly: true,
      oneSeason: true,
      unit: 'count',
      decimals: 0,
      direction: key === 'loss' ? 'lower' : 'higher',
      sources: SOURCES,
      firstSeason: 2002,
      published: TABLE,
      categories: ['results.record']
    }
  )
)

export const TEAM_RECORDS: MetricDef[] = [...RECORDS, ...STREAKS]

/** What each record's sample counts, in words: the games of that situation. */
export const RECORD_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  rec_games: 'games in the standings',
  ...Object.fromEntries(RECORD_COLUMNS.map(([key, , , , counts]) => [`rec_${key}_g`, counts]))
}
