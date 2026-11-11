import { describe, expect, it } from 'vitest'
import type { StatsScope } from '@/lib/stats/scope'
import {
  careerSpan,
  chunks,
  coverageStart,
  hoverLines,
  inProgress,
  mergePool,
  poolNote,
  poolParts,
  refineParts,
  playerOptions,
  playerSearchQuery,
  poolQueries,
  quantile,
  rankIn,
  scopeNote,
  seasonPool,
  subjectQuery,
  teamOptions,
  teamsBySeason,
  teamsQuery,
  trendable,
  trendBand,
  DEFAULT_TRENDS,
  trendsFor,
  trendSubject,
  trendLine,
  trendMetric,
  trendMetrics,
  trendNotes,
  trendRows,
  trendSeasons
} from '@/lib/stats/trends'
import type {
  MetricInfo,
  MetricValue,
  StatsResult,
  StatsRow,
  StatsSeason,
  StatsStatus
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const catalogue = catalogueFixture()
const byId = new Map(catalogue.map((m) => [m.id, m]))
const info = (id: string): MetricInfo => byId.get(id)!

const SCOPE: StatsScope = {
  season: 2010,
  seasonType: 'playoffs',
  range: { kind: 'last', n: 10, of: 'appearances' }
}

const STATUS: StatsStatus = {
  available: true,
  through: { season: 2027, date: '2026-11-09' },
  updatedAt: null,
  builtAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

const val = (value: number | null, qualified = true, sample: number | null = 1): MetricValue => ({
  value,
  raw: value,
  sample,
  qualified,
  percentile: null,
  rank: null
})

function row(
  id: string,
  season: number,
  values: Record<string, MetricValue>,
  games = 70,
  extra: Partial<StatsRow> = {}
): StatsRow {
  return {
    id,
    name: `P${id}`,
    team: 'CLE',
    position: 'F',
    group: { season },
    games,
    values,
    ...extra
  }
}

const result = (rows: StatsRow[], total = rows.length): StatsResult => ({
  grain: 'season',
  columns: [],
  rows,
  total,
  notes: [],
  ms: 1
})

describe('whose seasons are shown', () => {
  const lebron = { entity: 'player' as const, id: '2544' }
  const lakers = { entity: 'team' as const, id: '1610612747' }

  it("shows the one picked, else the dashboard's while following", () => {
    expect(trendSubject(DEFAULT_TRENDS, lebron)).toEqual(lebron)
    expect(trendSubject({ ...DEFAULT_TRENDS, subject: lakers }, lebron)).toEqual(lakers)
    expect(trendSubject({ ...DEFAULT_TRENDS, follow: false }, lebron)).toBeNull()
    expect(trendSubject(DEFAULT_TRENDS, null)).toBeNull()
  })

  it('opens on a subject from another screen, keeping the metric unless one is given', () => {
    const was = { ...DEFAULT_TRENDS, metric: 'reb' }
    expect(trendsFor(was, lebron)).toMatchObject({ subject: lebron, metric: 'reb' })
    expect(trendsFor(was, lakers, 'team_drtg')).toMatchObject({
      subject: lakers,
      metric: 'team_drtg'
    })
  })
})

describe('which metrics can be charted', () => {
  it('takes season-grain metrics of the entity, not stored ones, games or one-season projections', () => {
    expect(trendable(info('pts'), 'player')).toBe(true)
    expect(trendable(info('pts'), 'team')).toBe(false)
    expect(trendable(info('team_nrtg'), 'team')).toBe(true)
    expect(trendable(info('gp'), 'player')).toBe(false)
    const stored = catalogue.find((m) => m.tier === 'stored' && m.entity === 'player')
    if (stored) expect(trendable(stored, 'player')).toBe(false)
    const projection = catalogue.find((m) => m.oneSeason)
    if (projection) expect(trendable(projection, projection.entity)).toBe(false)
    expect(trendable({ ...info('pts'), grains: ['game'] }, 'player')).toBe(false)
  })

  it('groups the select by family and finds the shown metric', () => {
    const groups = trendMetrics('player', catalogue)
    expect(groups[0].family).toBe('traditional')
    expect(groups.flatMap((g) => g.metrics).every((m) => m.entity === 'player')).toBe(true)
    expect(trendMetric('drives', 'player', byId, catalogue)).toBe('drives')
    expect(trendMetric('team_nrtg', 'player', byId, catalogue)).toBe('pts')
    expect(trendMetric(null, 'team', byId, catalogue)).toBe('team_nrtg')
  })
})

describe('the seasons and the queries', () => {
  it('spans 1993-94 to the season the data runs through', () => {
    const s = trendSeasons(STATUS)
    expect(s[0]).toBe(1994)
    expect(s.at(-1)).toBe(2027)
    expect(trendSeasons(null, new Date('2026-03-01T00:00:00Z')).at(-1)).toBe(2026)
  })

  it('asks for the subject by season under the season type only, never the range', () => {
    const q = subjectQuery('player', '2544', 'pts', [2004, 2005], SCOPE, 'per36')
    expect(q.scope).toEqual({ seasons: [2004, 2005], gameTypes: ['playoffs'], players: ['2544'] })
    expect(q.metrics).toEqual(['pts', 'min'])
    expect(q.groupBy).toEqual(['season'])
    expect(q.transform).toBe('per36')
    const t = subjectQuery('team', '1610612739', 'team_nrtg', [2004], SCOPE, 'raw')
    expect(t.scope.teams).toEqual(['1610612739'])
    expect(t.metrics).toEqual(['team_nrtg'])
  })

  it("asks for a player's teams by season, team and month", () => {
    const q = teamsQuery('2544', [2004], SCOPE)
    expect(q.groupBy).toEqual(['season', 'team', 'month'])
    expect(q.scope.players).toEqual(['2544'])
  })

  it('splits a career into pool queries under the row limit, qualified players only', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    const span = Array.from({ length: 24 }, (_, i) => 2004 + i)
    const parts = poolParts('player', span)
    expect(parts.map((p) => p.length)).toEqual([14, 10])
    const qs = poolQueries('player', 'pts', parts, SCOPE, 'perGame')
    expect([...qs.keys()]).toEqual(['2004-2017', '2018-2027'])
    const first = qs.get('2004-2017')!
    expect(first.scope.qualifiedOnly).toBe(true)
    expect(first.sort).toEqual({ metric: 'min', dir: 'desc' })
    expect(first.limit).toBe(5000)
    expect(poolParts('team', span)).toEqual([span])
    const teams = poolQueries('team', 'team_nrtg', poolParts('team', span), SCOPE, 'raw')
    expect(teams.size).toBe(1)
    expect(teams.values().next().value!.scope.qualifiedOnly).toBeUndefined()
    expect(poolParts('team', [])).toEqual([])
  })

  it('asks again in halves for a part cut off at the row limit, down to one season', () => {
    const parts = [
      [2004, 2005, 2006, 2007, 2008],
      [2009, 2010]
    ]
    const whole = result([row('1', 2009, {})])
    const cut = result([row('1', 2004, {})], 6000)
    expect(
      refineParts(
        parts,
        new Map([
          ['2004-2008', cut],
          ['2009-2010', whole]
        ])
      )
    ).toEqual([
      [2004, 2005, 2006],
      [2007, 2008],
      [2009, 2010]
    ])
    // Nothing cut off, or only a single season: the answers stand.
    expect(refineParts(parts, new Map([['2004-2008', whole]]))).toBeNull()
    expect(refineParts([[2004]], new Map([['2004-2004', cut]]))).toBeNull()
  })

  it('merges the pool and leaves out a single season still cut off, with a note', () => {
    const a = result([row('1', 2004, {})])
    const b = result([row('2', 2018, {})], 6000)
    expect(mergePool(null)).toBeNull()
    expect(mergePool(new Map([['a', a]]))).toEqual({ rows: a.rows, unavailable: new Set() })
    const merged = mergePool(
      new Map([
        ['a', a],
        ['b', b]
      ])
    )!
    expect(merged.rows).toEqual(a.rows)
    expect([...merged.unavailable]).toEqual([2018])
    expect(poolNote(merged.unavailable)).toBe(
      'Too many players to read the league in 2017-18: no band or rank.'
    )
    expect(poolNote(new Set())).toBeNull()
  })

  it('searches every player in the data, and every franchise under its latest name', () => {
    expect(playerSearchQuery([1994, 1995]).limit).toBe(5000)
    const opts = playerOptions(
      result([
        row('2', 2004, {}, 1, { name: 'Zed' }),
        row('1', 2004, {}, 1, { name: 'Amy', team: null })
      ])
    )
    expect(opts).toEqual([
      { id: '1', label: 'Amy' },
      { id: '2', label: 'Zed · CLE' }
    ])
    const seasons = [
      { season: 2008, teams: [{ id: '9', code: 'SEA', name: 'Seattle SuperSonics' }] },
      { season: 2009, teams: [{ id: '9', code: 'OKC', name: 'Oklahoma City Thunder' }] }
    ] as unknown as StatsSeason[]
    expect(teamOptions(seasons)).toEqual([{ id: '9', label: 'OKC · Oklahoma City Thunder' }])
  })
})

describe('the career span', () => {
  it('runs from the first season with games to the last, keeping a missed season inside', () => {
    const subject = result([row('1', 2005, {}), row('1', 2007, {}), row('1', 2008, {}, 0)])
    expect(careerSpan(subject, [2004, 2005, 2006, 2007, 2008])).toEqual([2005, 2006, 2007])
    expect(careerSpan(result([]), [2004])).toEqual([])
  })
})

describe('ranking a season in its own pool', () => {
  it('shares a rank between ties and counts percentiles as the engine does', () => {
    expect(rankIn([30, 25, 25, 20], 25, 'higher')).toEqual({ rank: 2, of: 4, percentile: 100 / 3 })
    expect(rankIn([30, 25, 25, 20], 30, 'higher')).toEqual({ rank: 1, of: 4, percentile: 100 })
    expect(rankIn([30, 25, 25, 20], 20, 'higher').rank).toBe(4)
  })

  it('ranks a lower-is-better metric from the bottom', () => {
    expect(rankIn([3, 1, 2], 1, 'lower')).toEqual({ rank: 1, of: 3, percentile: 100 })
    expect(rankIn([3, 1, 2], 3, 'lower')).toEqual({ rank: 3, of: 3, percentile: 0 })
  })

  it('ranks a metric with no better side higher first', () => {
    expect(rankIn([3, 1, 2], 3, 'neutral').rank).toBe(1)
  })

  it('pools only rows the minutes qualifier and the metric sample admit', () => {
    const rows = [
      row('1', 2010, { pts: val(30), min: val(3000) }),
      row('2', 2010, { pts: val(10), min: val(200, false) }),
      row('3', 2010, { pts: val(20, false), min: val(2000) }),
      row('4', 2010, { pts: val(null), min: val(2000) }),
      row('5', 2011, { pts: val(5), min: val(2000) })
    ]
    expect([...seasonPool(rows, 2010, 'pts', 'player')]).toEqual([['1', 30]])
    expect([
      ...seasonPool([row('9', 2010, { team_nrtg: val(-2) })], 2010, 'team_nrtg', 'team')
    ]).toEqual([['9', -2]])
  })
})

describe("the metric's own qualifying rule", () => {
  it('pools a shooting rate by its attempts as well as the minutes, as the leaderboard does', () => {
    // fg3_pct qualifies on three-point attempts; the engine's flag is read, not a copy of its number.
    const rows = [
      row('1', 2016, { fg3_pct: val(0.45, true, 300), min: val(2500) }),
      row('2', 2016, { fg3_pct: val(0.6, false, 12), min: val(2500) }),
      row('3', 2016, { fg3_pct: val(0.4, true, 250), min: val(800, false) })
    ]
    expect([...seasonPool(rows, 2016, 'fg3_pct', 'player')]).toEqual([['1', 0.45]])
    const line = trendLine(
      result([row('2', 2016, { fg3_pct: val(0.6, false, 12), min: val(2500) })]),
      rows,
      '2',
      'fg3_pct',
      [2016],
      'player',
      info('fg3_pct')
    )
    expect(line[0]).toMatchObject({ value: 0.6, qualified: false, rank: null, of: 1 })
  })
})

describe('the league bands', () => {
  it('interpolates percentiles as quantile_cont', () => {
    expect(quantile([], 0.5)).toBeNull()
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20)
    expect(quantile([0, 10], 0.1)).toBeCloseTo(1)
  })

  it('draws each season from its own qualified pool', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((v) =>
      row(String(v), 2010, { pts: val(v), min: val(2000) })
    )
    rows.push(row('x', 2010, { pts: val(100), min: val(10, false) }))
    const [b, empty] = trendBand(rows, 'pts', [2010, 2011], 'player')
    expect(b).toEqual({ season: 2010, n: 11, p10: 2, p25: 3.5, median: 6, p75: 8.5, p90: 10 })
    expect(trendBand(rows, 'pts', [2010], 'player', new Set([2010]))[0]).toMatchObject({
      n: 0,
      median: null
    })
    expect(empty).toEqual({
      season: 2011,
      n: 0,
      p10: null,
      p25: null,
      median: null,
      p75: null,
      p90: null
    })
  })
})

describe('the line', () => {
  const pool = [
    row('1', 2013, { pts: val(25), min: val(3000) }),
    row('2', 2013, { pts: val(28), min: val(3000) }),
    row('1', 2014, { pts: val(27), min: val(3000) }),
    row('2', 2014, { pts: val(27), min: val(3000) }),
    row('3', 2014, { pts: val(30), min: val(3000) })
  ]

  it('ranks the subject each season, plots an unqualified season without a rank, and leaves a gap', () => {
    const subject = result([
      row('1', 2012, { pts: val(9), min: val(300, false, 300) }, 20),
      row('1', 2013, { pts: val(25), min: val(3000, true, 3000) }, 80),
      row('1', 2014, { pts: val(27), min: val(3000, true, 2900) }, 78)
    ])
    const teams = new Map([[2014, ['CLE', 'MIA']]])
    const line = trendLine(
      subject,
      pool,
      '1',
      'pts',
      [2011, 2012, 2013, 2014],
      'player',
      info('pts'),
      teams
    )
    expect(line[0]).toMatchObject({ season: 2011, value: null, played: false, qualified: false })
    expect(line[1]).toMatchObject({ value: 9, played: true, qualified: false, rank: null })
    expect(line[2]).toMatchObject({ value: 25, qualified: true, rank: 2, of: 2, percentile: 0 })
    expect(line[3]).toMatchObject({
      rank: 2,
      of: 3,
      minutes: 2900,
      games: 78,
      teams: ['CLE', 'MIA']
    })
  })

  it('reads blank before a metric is recorded, never zero', () => {
    const subject = result([
      row('1', 2013, { drives: val(0), min: val(3000) }),
      row('1', 2014, { drives: val(12), min: val(3000) })
    ])
    const tracking = { ...info('drives'), firstSeason: 2014 }
    const line = trendLine(subject, [], '1', 'drives', [2013, 2014], 'player', tracking)
    expect(line[0]).toMatchObject({ value: null, covered: false, played: true })
    expect(line[1]).toMatchObject({ value: 12, covered: true, qualified: false })
    expect(coverageStart(tracking, [2013, 2014])).toBe(2014)
    expect(coverageStart(tracking, [2014, 2015])).toBeNull()
    expect(coverageStart(tracking, [2010, 2011])).toBeNull()
  })

  it("names a traded player's teams in the order they played for them", () => {
    const rows = [
      row('1', 2018, { min: val(100) }, 5, {
        team: 'LAL',
        group: { season: 2018, team: 1, month: 3 }
      }),
      row('1', 2018, { min: val(100) }, 5, {
        team: 'CLE',
        group: { season: 2018, team: 2, month: 11 }
      }),
      row('1', 2018, { min: val(100) }, 5, {
        team: 'CLE',
        group: { season: 2018, team: 2, month: 1 }
      }),
      row('1', 2020, { min: val(100) }, 5, {
        team: 'LAL',
        group: { season: 2020, team: 1, month: 8 }
      }),
      row('1', 2020, { min: val(0) }, 0, {
        team: 'NYK',
        group: { season: 2020, team: 3, month: 10 }
      })
    ]
    const teams = teamsBySeason(result(rows))
    expect(teams.get(2018)).toEqual(['CLE', 'LAL'])
    expect(teams.get(2020)).toEqual(['LAL'])
  })
})

describe('the notes, the table and the hover', () => {
  const NOW = new Date('2026-11-10T00:00:00Z')

  it('marks the coverage start in the metric’s own words, missing seasons and a total in progress', () => {
    const tracking = { ...info('drives'), firstSeason: 2014, missingSeasons: [2016] }
    expect(
      trendNotes(tracking, [2012, 2013, 2014, 2015, 2016], 'perGame', STATUS, null, NOW)
    ).toEqual(['Recorded from 2013-14.', 'Not in the source for 2015-16.'])
    expect(trendNotes(info('pts'), [2026, 2027], 'raw', STATUS, null, NOW)).toEqual([
      '2026-27 is in progress.'
    ])
    expect(trendNotes(info('pts'), [2026, 2027], 'perGame', STATUS, null, NOW)).toEqual([])
    expect(trendNotes(info('ts_pct'), [2026, 2027], 'raw', STATUS, null, NOW)).toEqual([])
    expect(
      trendNotes(
        info('pts'),
        [2010],
        'raw',
        STATUS,
        'Published for the regular season and playoffs only.',
        NOW
      )
    ).toEqual(['Published for the regular season and playoffs only.'])
    expect(trendNotes(undefined, [2010], 'raw', STATUS)).toEqual([])
  })

  it('knows a season under way', () => {
    expect(inProgress(2027, STATUS, NOW)).toBe(true)
    expect(inProgress(2026, STATUS, NOW)).toBe(false)
    expect(inProgress(2027, STATUS, new Date('2027-07-02T00:00:00Z'))).toBe(false)
    expect(inProgress(2027, null, NOW)).toBe(false)
  })

  it('lists every season newest first with its value, rank, games and minutes', () => {
    const subject = result([
      row('1', 2013, { pts: val(25), min: val(3000, true, 3001.4) }, 80),
      row('1', 2015, { pts: val(9), min: val(300, false, 300) }, 20)
    ])
    const pool = [row('1', 2013, { pts: val(25), min: val(3000) })]
    const line = trendLine(subject, pool, '1', 'pts', [2012, 2013, 2014, 2015], 'player', {
      ...info('pts'),
      firstSeason: 2013
    })
    const rows = trendRows(line, info('pts'), 'perGame')
    expect(rows.map((r) => [r.label, r.value, r.rank, r.games, r.minutes])).toEqual([
      ['2014-15', '9.0', 'Not qualified', '20', '300'],
      ['2013-14', '', 'Did not play', '', ''],
      ['2012-13', '25.0', '1st of 1', '80', '3,001'],
      ['2011-12', '', 'Did not play', '', '']
    ])
    const covered = trendLine(
      result([row('1', 2012, { pts: val(5), min: val(1) })]),
      [],
      '1',
      'pts',
      [2012],
      'player',
      { ...info('pts'), firstSeason: 2013 }
    )
    expect(trendRows(covered, info('pts'), 'raw')[0].rank).toBe('Not recorded')
  })

  it('writes the hover card', () => {
    const fmt = (v: number): string => v.toFixed(1)
    const base = {
      season: 2014,
      value: 27.1,
      played: true,
      covered: true,
      qualified: true,
      pooled: true,
      rank: 7,
      of: 143,
      percentile: 95.8,
      games: 77,
      minutes: 2902.6,
      teams: ['MIA', 'CLE']
    }
    expect(hoverLines(base, 'player', fmt)).toEqual({
      title: '2013-14 · MIA, CLE',
      lines: ['27.1', '7th of 143 · 96th percentile', '77 games · 2,903 minutes']
    })
    expect(hoverLines({ ...base, rank: null, qualified: false }, 'team', fmt).lines).toEqual([
      '27.1',
      'Not qualified',
      '77 games'
    ])
    expect(
      hoverLines({ ...base, rank: null, qualified: false, pooled: false }, 'player', fmt).lines[1]
    ).toBe('No league data this season')
    expect(hoverLines({ ...base, played: false, value: null, teams: [] }, 'player', fmt)).toEqual({
      title: '2013-14',
      lines: ['Did not play']
    })
    expect(hoverLines({ ...base, covered: false, value: null }, 'player', fmt).lines[0]).toBe(
      'Not recorded this season'
    )
  })

  it('reads the league band as numbers on the hover card', () => {
    const fmt = (v: number): string => v.toFixed(1)
    const p = {
      season: 2013,
      value: 26.8,
      played: true,
      covered: true,
      qualified: true,
      pooled: true,
      rank: 4,
      of: 263,
      percentile: 98.9,
      games: 76,
      minutes: 2877,
      teams: ['MIA']
    }
    const band = {
      season: 2013,
      n: 263,
      p10: 5.54,
      p25: 7.69,
      median: 10.64,
      p75: 14.14,
      p90: 17.46
    }
    expect(hoverLines(p, 'player', fmt, band).lines.slice(-2)).toEqual([
      'League median 10.6 · 263 qualified',
      '25th–75th 7.7–14.1 · 10th–90th 5.5–17.5'
    ])
    const none = { ...band, n: 0, p10: null, p25: null, median: null, p75: null, p90: null }
    expect(hoverLines(p, 'player', fmt, none).lines).toHaveLength(3)
  })

  it('says which parts of the scope apply', () => {
    expect(scopeNote('Playoffs')).toContain('Playoffs')
  })
})
