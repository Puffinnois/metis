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
  normalizeBoard,
  pickable,
  PLAYER_TABS,
  qualifies,
  rankWithinTab,
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

  it('has a preset for each family, and knows which one a board shows', () => {
    const tab = tabOf('player', 'ALL')
    expect(familiesOf(CATALOGUE, tab)).toEqual([
      'traditional',
      'shooting',
      'shots',
      'plays',
      'possessions',
      'scoring',
      'composite',
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
    // Impact leads with each model's total and parts, WAR and DARKO, before the adjusted RAPM.
    expect(familyColumns(CATALOGUE, tab, 'impact').slice(0, 10).sort()).toEqual(
      [
        'sdv_rapm',
        'sdv_o_rapm',
        'sdv_d_rapm',
        'sdv_bpm',
        'sdv_obpm',
        'sdv_dbpm',
        'sdv_spm',
        'sdv_war',
        'sdv_darko_skill',
        'sdv_darko_next'
      ].sort()
    )
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
