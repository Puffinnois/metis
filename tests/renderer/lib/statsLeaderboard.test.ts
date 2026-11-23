import { describe, expect, it } from 'vitest'
import {
  appliesTo,
  bestFirst,
  columnGroups,
  csvFileName,
  defaultBoard,
  engineSort,
  familiesOf,
  familyColumns,
  familyOf,
  leaderboardCsv,
  leaderboardQuery,
  leaderRows,
  listsEverySample,
  ownQualifiers,
  qualifiesFor,
  normalizeBoard,
  pickable,
  PLAYER_TABS,
  qualifies,
  rankWithinTab,
  rowQualifies,
  searchKey,
  tabOf,
  tabsOf,
  TEAM_TABS
} from '@/lib/stats/leaderboard'
import type { StatsScope } from '@/lib/stats/scope'
import type { LeaderboardBoard, MetricValue, StatsResult, StatsRow } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const CATALOGUE = catalogueFixture()
const BY_ID = new Map(CATALOGUE.map((m) => [m.id, m]))
const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

const value = (v: number | null, qualified = true): MetricValue => ({
  value: v,
  raw: v,
  sample: 100,
  qualified,
  percentile: null,
  rank: null
})

const row = (id: string, over: Partial<StatsRow> = {}): StatsRow => ({
  id,
  name: `Player ${id}`,
  team: 'BOS',
  position: 'G',
  group: {},
  games: 10,
  values: {},
  ...over
})

const board = (over: Partial<LeaderboardBoard> = {}): LeaderboardBoard => ({
  ...defaultBoard('player', 'ALL', BY_ID),
  ...over
})

describe('tabs', () => {
  it('has every position group, and both ends of the floor', () => {
    expect(PLAYER_TABS.map((t) => t.id)).toEqual(['ALL', 'G', 'F', 'C'])
    expect(TEAM_TABS.map((t) => t.id)).toEqual(['offense', 'defense'])
    expect(tabsOf('player')).toBe(PLAYER_TABS)
    expect(tabOf('team', 'nope').id).toBe('offense')
  })

  it('names only metrics the catalogue has, of its own entity, in every default', () => {
    for (const tab of [...PLAYER_TABS, ...TEAM_TABS]) {
      for (const id of tab.groups.flatMap(([, ids]) => ids)) {
        expect(BY_ID.get(id)?.entity, `${tab.id}: ${id}`).toBe(tab.entity)
      }
      expect(BY_ID.has(tab.sort), `${tab.id} sort`).toBe(true)
      expect(tab.groups.flatMap(([, ids]) => ids)).toContain(tab.sort)
    }
  })

  it('opens a tab on its defaults, best first', () => {
    const b = defaultBoard('team', 'defense', BY_ID)
    expect(b.sort).toEqual({ by: 'team_drtg', dir: 'asc' })
    expect(b).toMatchObject({ mode: 'raw', qualifiedOnly: true, team: null })
    expect(bestFirst(BY_ID.get('pts'))).toBe('desc')
    expect(bestFirst(BY_ID.get('tov'))).toBe('asc')
  })
})

describe('the column picker and presets', () => {
  it('offers metrics of the entity, but not the games the row already shows', () => {
    const tab = tabOf('player', 'G')
    const offered = pickable(CATALOGUE, tab).map((m) => m.id)
    expect(offered).toContain('usg_pct')
    expect(offered).not.toContain('gp')
    expect(offered).not.toContain('team_ortg')
    expect(appliesTo(BY_ID.get('gp')!, tab)).toBe(false)
  })

  it("offers a team tab's own end first", () => {
    const defense = pickable(CATALOGUE, tabOf('team', 'defense'))
    const firstOffense = defense.findIndex((m) => m.side === 'offense')
    expect(defense.slice(0, firstOffense).every((m) => m.side === 'defense')).toBe(true)
  })

  it('has a Ratings preset on the team board, in the family’s order', () => {
    // Core first (MOV, SRS, Elo, adjusted net rating), then projected wins and playoff odds (T1003),
    // then extended up to twelve columns.
    expect(familyColumns(CATALOGUE, tabOf('team', 'offense'), 'ratings')).toEqual([
      'team_mov',
      'team_srs',
      'team_elo',
      'team_adj_nrtg',
      'team_proj_w',
      'team_playoff_pct',
      'team_pyth_w',
      'team_win_resid',
      'team_sos',
      'team_adj_ortg',
      'team_adj_drtg',
      'team_elo_exp_w'
    ])
    // The rest are in the picker: what the preset's columns already give, a league figure, or the
    // rest of the forecast.
    const offered = pickable(CATALOGUE, tabOf('team', 'offense')).map((m) => m.id)
    for (const id of [
      'team_pyth_pct',
      'team_sos_left',
      'team_pyth_l',
      'team_games_left',
      'team_elo_w_over',
      'team_adj_home',
      'team_title_pct',
      'team_mean_seed'
    ])
      expect(offered).toContain(id)
  })

  it('has a preset for each family, and knows which one a board shows', () => {
    const tab = tabOf('player', 'ALL')
    expect(familiesOf(CATALOGUE, tab)).toEqual([
      'traditional',
      'shooting',
      'indexes',
      'shots',
      'plays',
      'possessions',
      'on_court',
      'scoring',
      'composite',
      'box_composites',
      'tracking',
      'hustle',
      'play_types',
      'matchups',
      'impact',
      'availability'
    ])
    // Play by play preset to turnovers, fouls, and-ones and assists (Plan T905).
    expect([...familyColumns(CATALOGUE, tab, 'plays')].sort()).toEqual(
      [
        'pbp_tov_bad_pass',
        'pbp_tov_lost_ball',
        'pbp_tov_off_foul',
        'pbp_tov_live_share',
        'pbp_pf_shooting',
        'pbp_pf_offensive',
        'pbp_tech',
        'pbp_and1',
        'pbp_and1_pct',
        'pbp_trip_rate',
        'pbp_ast_pts',
        'pbp_unast_share'
      ].sort()
    )
    // Shot zones preset to how well and how often by zone, against the league, and the distance.
    expect([...familyColumns(CATALOGUE, tab, 'shots')].sort()).toEqual(
      [
        'ra_fg_pct',
        'paint_fg_pct',
        'mid_fg_pct',
        'c3_fg_pct',
        'atb3_fg_pct',
        'ra_freq',
        'mid_freq',
        'c3_freq',
        'atb3_freq',
        'ra_fg_rel',
        'avg_dist',
        'pps_above'
      ]
        .map((k) => `shot_${k}`)
        .sort()
    )
    // Play types preset to how often and how well, for the six commonest offensive types.
    expect([...familyColumns(CATALOGUE, tab, 'play_types')].sort()).toEqual(
      ['iso', 'pnr_bh', 'pnr_roll', 'post_up', 'spot_up', 'transition']
        .flatMap((k) => [`pt_${k}_freq`, `pt_${k}_ppp`])
        .sort()
    )
    // Tracking is a family of its own, with one or two metrics from each file as its preset.
    expect([...familyColumns(CATALOGUE, tab, 'tracking')].sort()).toEqual(
      [
        'ast_pts_created',
        'avg_speed',
        'def_rim_fg_pct',
        'dist_miles',
        'drive_fg_pct',
        'drives',
        'potential_ast',
        'catch_shoot_efg_pct',
        'pull_up_efg_pct',
        'reb_chance_pct',
        'time_of_poss',
        'touches'
      ].sort()
    )
    expect(familiesOf(CATALOGUE, tabOf('team', 'ALL'))).not.toContain('tracking')
    // Impact leads with each model's total and parts, WAR and BOBAN, before the adjusted RAPM. DARKO,
    // which the dataset no longer publishes, is not offered (T1301.9: no preset on a metric not shown).
    expect(familyColumns(CATALOGUE, tab, 'impact').slice(0, 9).sort()).toEqual(
      [
        'sdv_rapm',
        'sdv_o_rapm',
        'sdv_d_rapm',
        'sdv_bpm',
        'sdv_obpm',
        'sdv_dbpm',
        'sdv_spm',
        'sdv_war',
        'sdv_boban_skill'
      ].sort()
    )
    expect(familyColumns(CATALOGUE, tab, 'impact')).not.toContain('sdv_darko_skill')
    expect(familiesOf(CATALOGUE, tabOf('team', 'ALL'))).not.toContain('impact')
    expect(familiesOf(CATALOGUE, tabOf('team', 'ALL'))).not.toContain('play_types')
    expect(familiesOf(CATALOGUE, tabOf('team', 'defense'))).toContain('hustle')
    const shooting = familyColumns(CATALOGUE, tab, 'shooting')
    // Published metrics answer whole seasons only, so the preset is what it was without them.
    const fromGames = CATALOGUE.filter((m) => m.grains.includes('game'))
    expect(shooting.slice(0, familyColumns(fromGames, tab, 'shooting').length)).toEqual(
      familyColumns(fromGames, tab, 'shooting')
    )
    expect(shooting.length).toBeLessThanOrEqual(40)
    expect(shooting).toContain('ts_pct')
    expect(familyOf(board(), CATALOGUE, BY_ID)).toBe('default')
    expect(familyOf(board({ columns: shooting }), CATALOGUE, BY_ID)).toBe('shooting')
    expect(familyOf(board({ columns: ['pts'] }), CATALOGUE, BY_ID)).toBe('custom')
  })

  it('heads the columns by the tab’s groups, and a family for an added one', () => {
    const tab = tabOf('player', 'ALL')
    expect(columnGroups(['min', 'pts', 'ts_pct', 'pie'], tab, BY_ID)).toEqual([
      { label: 'Playing time', span: 1 },
      { label: 'Scoring', span: 2 },
      { label: 'Composite', span: 1 }
    ])
  })
})

describe('the query', () => {
  it('asks for the columns, the position and team, and the mode', () => {
    const q = leaderboardQuery(board({ tab: 'G', mode: 'per36', team: '1610612738' }), SCOPE, BY_ID)
    expect(q).toMatchObject({
      entity: 'player',
      transform: 'per36',
      sort: { metric: 'pts', dir: 'desc' },
      limit: 1000,
      scope: {
        seasons: [2026],
        gameTypes: ['regular'],
        positions: ['G'],
        teams: ['1610612738']
      }
    })
  })

  it('always reads the qualifier, even when the column is removed', () => {
    const q = leaderboardQuery(board({ columns: ['pts'] }), SCOPE, BY_ID)
    expect(q.metrics).toEqual(['pts', 'min'])
    expect(leaderboardQuery(board({ columns: ['min', 'pts'] }), SCOPE, BY_ID).metrics).toEqual([
      'min',
      'pts'
    ])
  })

  it("does not ask a team for a player's last N", () => {
    const scope: StatsScope = { ...SCOPE, range: { kind: 'last', n: 5, of: 'team' } }
    const q = leaderboardQuery(defaultBoard('team', 'offense', BY_ID), scope, BY_ID)
    expect(q.scope).toMatchObject({ lastN: 5 })
    expect(q.scope).not.toHaveProperty('lastNOf')
    expect(leaderboardQuery(board(), scope, BY_ID).scope).toMatchObject({
      lastN: 5,
      lastNOf: 'team'
    })
  })

  it('sorts by the column, or the tab’s when sorted by name', () => {
    expect(engineSort(board({ sort: { by: 'ast', dir: 'asc' } }), BY_ID)).toEqual({
      metric: 'ast',
      dir: 'asc'
    })
    expect(engineSort(board({ sort: { by: 'name', dir: 'asc' } }), BY_ID)).toEqual({
      metric: 'pts',
      dir: 'desc'
    })
    expect(
      engineSort(board({ columns: ['tov'], sort: { by: 'name', dir: 'asc' } }), BY_ID)
    ).toEqual({ metric: 'tov', dir: 'asc' })
  })

  it('reads a saved view whose metrics are gone', () => {
    const gone = normalizeBoard(
      board({ columns: ['gone', 'pts'], sort: { by: 'gone', dir: 'desc' } }),
      BY_ID
    )
    expect(gone.columns).toEqual(['pts'])
    expect(gone.sort).toEqual({ by: 'pts', dir: 'desc' })
    const none = normalizeBoard(board({ columns: ['gone'] }), BY_ID)
    expect(none.columns).toEqual(defaultBoard('player', 'ALL', BY_ID).columns)
    // Before the catalogue loads, nothing is judged.
    expect(normalizeBoard(board({ columns: ['gone'] }), new Map()).columns).toEqual(['gone'])
  })
})

describe('qualification and ranks', () => {
  const tab = tabOf('player', 'ALL')
  const result = (rows: StatsRow[]): StatsResult => ({
    grain: 'season',
    columns: [
      {
        id: 'pts',
        label: 'Points',
        short: 'PTS',
        unit: 'count',
        decimals: 0,
        direction: 'higher',
        seasons: [2026],
        reason: null
      },
      {
        id: 'tov',
        label: 'Turnovers',
        short: 'TOV',
        unit: 'count',
        decimals: 0,
        direction: 'lower',
        seasons: [2026],
        reason: null
      }
    ],
    rows,
    total: rows.length,
    notes: [],
    ms: 1
  })

  const a = row('a', { values: { min: value(2000), pts: value(100), tov: value(5) } })
  const b = row('b', { values: { min: value(1500), pts: value(80), tov: value(9) } })
  const c = row('c', { values: { min: value(100, false), pts: value(500), tov: value(1) } })
  const d = row('d', {
    position: 'C',
    values: { min: value(1200), pts: value(60), tov: value(3) }
  })

  it('reads the qualifier from the row, and every team qualifies', () => {
    expect(qualifies(a, tab)).toBe(true)
    expect(qualifies(c, tab)).toBe(false)
    expect(qualifies(c, tabOf('team', 'offense'))).toBe(true)
  })

  it('ranks among the qualified of the same position, and the lower better too', () => {
    const ranked = rankWithinTab(result([a, b, c, d]), tab)
    const of = (id: string): StatsRow => ranked.rows.find((r) => r.id === id)!
    expect(of('a').values.pts).toMatchObject({ rank: 1, percentile: 100 })
    expect(of('b').values.pts).toMatchObject({ rank: 2, percentile: 0 })
    // Fewer turnovers rank first.
    expect(of('a').values.tov).toMatchObject({ rank: 1, percentile: 100 })
    // Below the qualifier: no rank, however high the value.
    expect(of('c').values.pts).toMatchObject({ rank: null, percentile: null })
    // Alone at center.
    expect(of('d').values.pts).toMatchObject({ rank: 1, percentile: 0 })
  })

  it('leaves a team’s ranks to the engine', () => {
    const r = result([a])
    expect(rankWithinTab(r, tabOf('team', 'offense'))).toBe(r)
  })

  it('shows the qualified, filters by search, sorts by name when asked', () => {
    const r = result([a, b, c])
    expect(leaderRows(r, board(), '').map((x) => x.id)).toEqual(['a', 'b'])
    expect(leaderRows(r, board({ qualifiedOnly: false }), '').map((x) => x.id)).toEqual([
      'a',
      'b',
      'c'
    ])
    // A row opened from the home stays, even below the qualifier.
    expect(leaderRows(r, board(), '', 'c').map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(leaderRows(r, board(), 'player b').map((x) => x.id)).toEqual(['b'])
    expect(
      leaderRows(r, board({ sort: { by: 'name', dir: 'desc' } }), '').map((x) => x.id)
    ).toEqual(['b', 'a'])
  })

  it('finds a name without its accents', () => {
    expect(searchKey('Luka Dončić')).toBe('luka doncic')
    expect(searchKey("D'Angelo")).toBe('dangelo')
  })
})

describe("the NBA's minimums, each metric by its own rule (D33)", () => {
  const tab = tabOf('player', 'ALL')
  const column = (id: string, own: boolean): StatsResult['columns'][number] => ({
    id,
    label: id,
    short: id,
    unit: 'number',
    decimals: 1,
    direction: 'higher',
    seasons: [2026],
    reason: null,
    ...(own ? { ownQualifier: true } : {})
  })
  const result = (rows: StatsRow[]): StatsResult => ({
    grain: 'season',
    columns: [
      column('fg_pct', true),
      column('pts', true),
      column('ts_pct', false),
      column('min', false)
    ],
    rows,
    total: rows.length,
    notes: [],
    ms: 1
  })
  const line = (
    id: string,
    games: number,
    q: { min: boolean; pts: boolean; fg: boolean; ts: boolean },
    v: number
  ): StatsRow =>
    row(id, {
      games,
      values: {
        min: value(1000 + v, q.min),
        pts: value(20 + v, q.pts),
        fg_pct: value(0.5 + v / 100, q.fg),
        ts_pct: value(0.55 + v / 100, q.ts)
      }
    })
  // 300 field goals made in 55 games, under 1,000 minutes: FG% only.
  const makes = line('makes', 55, { min: false, pts: false, fg: true, ts: true }, 4)
  // 60 games and few minutes: points per game only.
  const games = line('games', 60, { min: false, pts: true, fg: false, ts: true }, 3)
  // 52 games and 1,700 minutes: every uncovered metric, as on main, and not points per game.
  const minutes = line('minutes', 52, { min: true, pts: false, fg: false, ts: true }, 2)
  const all = line('all', 70, { min: true, pts: true, fg: true, ts: true }, 1)
  const r = result([makes, games, minutes, all])
  const own = ownQualifiers(r)

  it('reads which metrics qualify alone from the result', () => {
    expect([...own].sort()).toEqual(['fg_pct', 'pts'])
    expect(qualifiesFor(makes, tab, 'fg_pct', own)).toBe(true)
    expect(qualifiesFor(makes, tab, 'ts_pct', own)).toBe(false)
    expect(qualifiesFor(games, tab, 'pts', own)).toBe(true)
    expect(qualifiesFor(minutes, tab, 'ts_pct', own)).toBe(true)
    expect(qualifiesFor(minutes, tab, 'pts', own)).toBe(false)
  })

  it('ranks each metric among the rows it qualifies, by its own rule', () => {
    const ranked = rankWithinTab(r, tab)
    const ranks = (metric: string): string[] =>
      ranked.rows.filter((x) => x.values[metric].rank !== null).map((x) => x.id)
    expect(ranks('fg_pct')).toEqual(['makes', 'all'])
    expect(ranks('pts')).toEqual(['games', 'all'])
    expect(ranks('ts_pct')).toEqual(['minutes', 'all'])
    expect(ranked.rows[0].values.fg_pct).toMatchObject({ rank: 1, percentile: 100 })
  })

  it('keeps, under Qualified only, the rows that qualify for the sorted column', () => {
    const sorted = (by: string): string[] =>
      leaderRows(r, board({ sort: { by, dir: 'desc' } }), '').map((x) => x.id)
    expect(sorted('fg_pct')).toEqual(['makes', 'all'])
    expect(sorted('pts')).toEqual(['games', 'all'])
    expect(sorted('ts_pct')).toEqual(['minutes', 'all'])
    expect(rowQualifies(makes, tab, 'fg_pct', own)).toBe(true)
    expect(rowQualifies(makes, tab, 'ts_pct', own)).toBe(false)
  })
})

describe('games out with no line (Plan T1206)', () => {
  const out = (n: number, over: Partial<MetricValue> = {}): MetricValue => ({
    ...value(n, n > 0),
    sample: n,
    ...over
  })
  // A qualified starter with games out, a bench player below the minutes with some, a player out
  // for the whole season with no line, and a qualified player with none.
  const starter = row('starter', { values: { min: value(2000), games_out_injury: out(5) } })
  const bench = row('bench', { values: { min: value(300, false), games_out_injury: out(9) } })
  const absent = row('absent', {
    games: 0,
    noLine: true,
    values: {
      min: { ...value(null, false), sample: null },
      games_out_injury: out(82, { qualified: false })
    }
  })
  const healthy = row('healthy', { values: { min: value(2500), games_out_injury: out(0) } })
  const column = (id: string): StatsResult['columns'][number] => ({
    id,
    label: id,
    short: id,
    unit: 'count',
    decimals: 0,
    direction: 'neutral',
    seasons: [2026],
    reason: null,
    ...(id === 'games_out_injury' ? { addsRows: true } : {})
  })
  const r: StatsResult = {
    grain: 'season',
    columns: [column('min'), column('games_out_injury')],
    rows: [absent, bench, starter, healthy],
    total: 4,
    notes: [],
    ms: 1
  }
  const sorted = (by: string, qualifiedOnly = true): string[] =>
    leaderRows(r, board({ sort: { by, dir: 'desc' }, qualifiedOnly }), '').map((x) => x.id)

  it('lists everyone with games out under Qualified only when sorted by a games-out count', () => {
    expect(listsEverySample(r, 'games_out_injury')).toBe(true)
    // The qualified rows stay as before, a qualified player with none among them.
    expect(sorted('games_out_injury')).toEqual(['absent', 'bench', 'starter', 'healthy'])
  })

  it('hides the rows below the minutes or with no line when sorted by anything else', () => {
    expect(listsEverySample(r, 'min')).toBe(false)
    expect(sorted('min')).toEqual(['starter', 'healthy'])
    expect(sorted('min', false)).toEqual(['absent', 'bench', 'starter', 'healthy'])
  })

  it('marks a row with no line NQ, and ranks games out among the qualified rows only', () => {
    const tab = tabOf('player', 'ALL')
    expect(rowQualifies(absent, tab, 'games_out_injury', ownQualifiers(r))).toBe(false)
    const ranked = rankWithinTab(r, tab)
    const rank = (id: string): number | null =>
      ranked.rows.find((x) => x.id === id)!.values.games_out_injury.rank
    expect(rank('absent')).toBeNull()
    expect(rank('bench')).toBeNull()
    expect(rank('starter')).toBe(1)
  })
})

describe('CSV', () => {
  const rows = [
    row('2544', {
      name: 'A, "Quoted" Name',
      games: 70,
      values: { pts: value(25.5), fg_pct: value(0.5123), reb: value(null) }
    })
  ]
  const b = board({ columns: ['pts', 'fg_pct', 'reb'], mode: 'perGame' })

  it('writes the table as shown, with numbers unformatted and percentages in percent', () => {
    const [head, line, end] = leaderboardCsv(rows, b, BY_ID).split('\r\n')
    expect(head).toBe(
      'Rank,Player,Team,Position,Player id,Games,Points per game,Field-goal percentage (%),Rebounds per game'
    )
    expect(line).toBe('1,"A, ""Quoted"" Name",BOS,G,2544,70,25.5,51.23,')
    expect(end).toBe('')
  })

  it('leaves a ratio and a total unlabelled by the mode', () => {
    const [head] = leaderboardCsv(
      [],
      board({ columns: ['fg_pct', 'w'], mode: 'per36' }),
      BY_ID
    ).split('\r\n')
    expect(head).toContain('Field-goal percentage (%),Wins')
  })

  it('names a team table by its id', () => {
    const [head] = leaderboardCsv(
      [],
      { ...defaultBoard('team', 'offense', BY_ID), columns: ['team_w'] },
      BY_ID
    ).split('\r\n')
    expect(head).toBe('Rank,Team,Team id,Games,Wins')
  })

  it('names the file after the season, the tab and the range', () => {
    expect(csvFileName(board({ tab: 'G' }), SCOPE, 'Whole season')).toBe(
      'stats-2025-26-guards-whole-season.csv'
    )
    expect(csvFileName(defaultBoard('team', 'defense', BY_ID), SCOPE, 'Last 10 games')).toBe(
      'stats-2025-26-teams-defense-last-10-games.csv'
    )
  })
})
