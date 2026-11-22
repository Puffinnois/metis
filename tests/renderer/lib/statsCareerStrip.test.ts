import { afterEach, describe, expect, it } from 'vitest'
import {
  careerStrip,
  otherLines,
  ownLines,
  pickWords,
  reasonText,
  stripGameTypes,
  stripHint,
  stripQuery,
  teamCell,
  type StripInput,
  type StripRow,
  type StripView,
  type StripLine
} from '@/lib/stats/careerStrip'
import { setLeague } from '@/lib/stats/league'
import { seasonScope } from '@/lib/stats/scope'
import { LEAGUES } from '@shared/leagues'
import type {
  StatsDraftLine,
  StatsOtherCareer,
  StatsOtherSeason,
  StatsResult,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'

const season = (s: Partial<StatsOtherSeason> & { season: number }): StatsOtherSeason => ({
  gameType: null,
  teams: [],
  teamsInOrder: true,
  games: null,
  starts: null,
  minutes: null,
  pts: null,
  reb: null,
  oreb: null,
  ast: null,
  stl: null,
  blk: null,
  tov: null,
  pf: null,
  fgm: null,
  fga: null,
  fg3m: null,
  fg3a: null,
  ftm: null,
  fta: null,
  ...s
})

/** Cooper Flagg's draft line as the read gives it: the class of 2025, the NBA's table's 2026. */
const FLAGG_DRAFT: StatsDraftLine = {
  league: 'nba',
  draftYear: 2025,
  round: 1,
  roundPick: 1,
  overallPick: 1,
  team: 'Dallas Mavericks',
  organization: 'Duke',
  organizationType: 'College/University'
}

/** Flagg's Duke season as Metis keeps it, a row a season type: games, minutes, points and field goals
 * as the four-league profile reads them, the rest made up. */
const FLAGG_DUKE: StatsOtherSeason[] = [
  season({
    season: 2025,
    gameType: 'regular',
    teams: ['Duke Blue Devils'],
    games: 32,
    minutes: 974,
    pts: 604,
    reb: 240,
    ast: 136,
    stl: 44,
    blk: 45,
    fgm: 205,
    fga: 420,
    fg3m: 46,
    fg3a: 120,
    ftm: 148,
    fta: 176
  }),
  season({
    season: 2025,
    gameType: 'playoffs',
    teams: ['Duke Blue Devils'],
    games: 5,
    minutes: 160,
    pts: 105,
    reb: 30,
    ast: 15,
    stl: 7,
    blk: 4,
    fgm: 34,
    fga: 77,
    fg3m: 8,
    fg3a: 21,
    ftm: 29,
    fta: 33
  })
]

const career = (over: Partial<StatsOtherCareer>): StatsOtherCareer => ({
  league: 'ncaam',
  link: null,
  draft: null,
  source: null,
  seasons: [],
  reason: null,
  ...over
})

const FLAGG_FROM_NBA = career({
  league: 'ncaam',
  link: { method: 'id', playerId: '5041939', espnId: 5041939, name: 'Cooper Flagg' },
  draft: FLAGG_DRAFT,
  source: { kind: 'metis', label: "Metis's own season lines" },
  seasons: FLAGG_DUKE
})

const line = (s: number, team: string, games: number, pts: number): StripLine => ({
  season: s,
  teams: [team],
  teamsInOrder: true,
  games,
  values: {
    min: 33.5,
    pts,
    reb: 6.1,
    ast: 4.2,
    stl: 1.1,
    blk: 0.9,
    fg_pct: 0.468,
    fg3_pct: 0.3,
    ft_pct: 0.8
  }
})

const FLAGG_NBA = [
  line(2026, 'Dallas Mavericks', 70, 21.04),
  line(2027, 'Dallas Mavericks', 13, 23.5)
]

const input = (over: Partial<StripInput>): StripInput => ({
  league: LEAGUES.nba,
  playerName: 'Cooper Flagg',
  own: FLAGG_NBA,
  career: FLAGG_FROM_NBA,
  otherHolds: 'ready',
  otherOn: true,
  byId: new Map(),
  ...over
})

describe('the games a strip row counts', () => {
  it('counts every game in a college league and the regular season in a professional one', () => {
    expect(stripGameTypes(LEAGUES.nba)).toEqual(['regular'])
    expect(stripGameTypes(LEAGUES.wnba)).toEqual(['regular'])
    expect(stripGameTypes(LEAGUES.ncaam)).toEqual([...LEAGUES.ncaam.countedTypes])
    expect(stripGameTypes(LEAGUES.ncaaw)).toContain('playoffs')
  })

  it('asks the engine for the page league’s seasons per game, without ranks', () => {
    const q = stripQuery('1642843', [2026, 2027], LEAGUES.nba)
    expect(q.scope).toEqual({ seasons: [2026, 2027], gameTypes: ['regular'], players: ['1642843'] })
    expect(q.groupBy).toEqual(['season'])
    expect(q.transform).toBe('perGame')
    expect(q.ranks).toBe(false)
  })
})

describe('the other league’s lines', () => {
  it('adds up Metis’s season types into every game in college, then divides', () => {
    const [duke] = otherLines(FLAGG_DUKE, LEAGUES.ncaam)
    expect(duke.season).toBe(2025)
    expect(duke.games).toBe(37)
    expect(duke.teams).toEqual(['Duke Blue Devils'])
    expect(duke.values.pts).toBeCloseTo(709 / 37, 6)
    expect(duke.values.min).toBeCloseTo(1134 / 37, 6)
    expect(duke.values.fg_pct).toBeCloseTo(239 / 497, 6)
    expect(duke.values.ft_pct).toBeCloseTo(177 / 209, 6)
  })

  it('keeps the regular season alone in a professional league, the Cup final left out', () => {
    const lines = otherLines(
      [
        season({ season: 2024, gameType: 'cup-final', teams: ['LAL'], games: 1, pts: 0 }),
        season({ season: 2024, gameType: 'regular', teams: ['LAL'], games: 21, pts: 34 }),
        season({ season: 2025, gameType: 'regular', teams: ['LAL', 'PHI'], games: 15, pts: 106 }),
        season({ season: 2025, gameType: 'playoffs', teams: ['PHI'], games: 2, pts: 4 })
      ],
      LEAGUES.nba
    )
    expect(lines.map((l) => [l.season, l.games, l.teams])).toEqual([
      [2024, 21, ['LAL']],
      [2025, 15, ['LAL', 'PHI']]
    ])
    expect(lines[0].values.pts).toBeCloseTo(34 / 21, 6)
  })

  it('reads ESPN’s rows as they are, a row a season', () => {
    const [s] = otherLines(
      [season({ season: 2026, teams: ['Dallas Mavericks'], games: 70, pts: 1473, fga: 0, fgm: 0 })],
      LEAGUES.nba
    )
    expect(s.games).toBe(70)
    expect(s.values.pts).toBeCloseTo(21.04, 2)
    // No attempts: no rate, never a zero.
    expect(s.values.fg_pct).toBeNull()
  })

  it('drops a season with no games', () => {
    expect(otherLines([season({ season: 2023, games: 0 })], LEAGUES.ncaaw)).toEqual([])
  })
})

describe('the page league’s own lines', () => {
  const row = (s: number, team: string | null, games: number, pts: number | null): StatsRow => ({
    id: '1',
    name: 'X',
    team,
    position: 'F',
    group: { season: s },
    games,
    values: {
      pts: { value: pts, raw: null, sample: null, qualified: true, percentile: null, rank: null }
    }
  })
  it('names the team of the season and orders the seasons', () => {
    const result = { rows: [row(2027, 'DAL', 13, 23.5), row(2026, 'DAL', 70, 21)] } as StatsResult
    const lines = ownLines(result, (s, code) => (code === 'DAL' ? `Dallas ${s}` : null))
    expect(lines.map((l) => [l.season, l.teams[0], l.values.pts, l.values.reb])).toEqual([
      [2026, 'Dallas 2026', 21, null],
      [2027, 'Dallas 2027', 23.5, null]
    ])
  })
})

describe('the strip', () => {
  it('reads one career in time order: college, the draft in its real year, then the pros', () => {
    const view = careerStrip(input({}))
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.rows.map((r) => [r.kind, r.leagueName, r.season, r.own])).toEqual([
      ['season', 'NCAA Men', '2024-25', false],
      ['draft', 'NBA', '2025', false],
      ['season', 'NBA', '2025-26', true],
      ['season', 'NBA', '2026-27', true]
    ])
    expect(view.rows[1].team).toBe('Dallas Mavericks')
    expect(view.rows[1].games).toBe('Drafted: Round 1, pick 1 (1st overall)')
    expect(view.rows[0].cells[1]).toBe('19.2')
    expect(view.rows[0].cells[6]).toBe('48.1%')
    expect(view.note).toBe('NCAA Men every game · NBA regular season · Per game')
  })

  it('reads the same order from the college side, the pros being the new rows', () => {
    const view = careerStrip(
      input({
        league: LEAGUES.ncaam,
        own: otherLines(FLAGG_DUKE, LEAGUES.ncaam),
        career: career({
          league: 'nba',
          link: { method: 'id', playerId: '1642843', espnId: 5041939, name: 'Cooper Flagg' },
          draft: FLAGG_DRAFT,
          source: { kind: 'espn', label: "ESPN's season totals, regular season" },
          seasons: [season({ season: 2026, teams: ['Dallas Mavericks'], games: 70, pts: 1473 })]
        }),
        otherHolds: 'off',
        otherOn: false
      })
    )
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.rows.map((r) => [r.leagueName, r.season, r.own])).toEqual([
      ['NCAA Men', '2024-25', true],
      ['NBA', '2025', false],
      ['NBA', '2025-26', false]
    ])
    // Not downloaded: the rows open nothing, the source is said once, and one way to the rest.
    expect(view.rows.every((r) => r.open === null)).toBe(true)
    expect(view.notes).toEqual(['NBA seasons from ESPN’s totals, regular season.'])
    expect(view.action).toEqual({
      kind: 'download',
      league: 'nba',
      label: 'Download NBA for the full profile'
    })
  })

  it('opens the other league’s page in the row’s season where both are downloaded', () => {
    const view = careerStrip(input({}))
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.rows[0].open).toEqual({
      league: 'ncaam',
      screen: 'player',
      team: null,
      player: { id: '5041939', position: null },
      season: 2025
    })
    expect(view.rows[0].title).toBe('Open Cooper Flagg’s NCAA Men page, 2024-25')
    expect(view.rows.filter((r) => r.own).every((r) => r.open === null)).toBe(true)
    expect(view.notes).toEqual([
      'NCAA Men seasons from Metis, every game.',
      'Each NCAA Men row opens their NCAA Men page.'
    ])
    expect(view.action).toBeNull()
  })

  it('opens the draft in the Profile tab of the professional league where it is downloaded', () => {
    const profile = (id: string): unknown => ({
      league: 'nba',
      screen: 'player',
      team: null,
      player: { id, position: null },
      playerTab: 'profile'
    })
    const draftOf = (view: StripView): StripRow => {
      if (view.kind !== 'strip') throw new Error(view.kind)
      const row = view.rows.find((r) => r.kind === 'draft')
      if (!row) throw new Error('no draft row')
      return row
    }
    // The NBA page: the player's own Profile, whether or not NCAA Men is downloaded.
    for (const otherHolds of ['ready', 'off'] as const) {
      const row = draftOf(careerStrip(input({ player: '1642843', otherHolds, otherOn: false })))
      expect(row.open).toEqual(profile('1642843'))
      expect(row.title).toBe(
        'NBA draft 2025, Dallas Mavericks, Round 1, pick 1 (1st overall): open Cooper Flagg’s NBA profile'
      )
    }
    // The college page: the NBA Profile where the NBA is built and the player has a page there.
    const fromCollege = (otherHolds: 'ready' | 'off' | 'notBuilt'): StripRow =>
      draftOf(
        careerStrip(
          input({
            league: LEAGUES.ncaam,
            player: '4432573',
            own: otherLines(FLAGG_DUKE, LEAGUES.ncaam),
            career: career({
              league: 'nba',
              link: { method: 'id', playerId: '1642843', espnId: 5041939, name: 'Cooper Flagg' },
              draft: FLAGG_DRAFT,
              source: { kind: 'metis', label: "Metis's own season lines" },
              seasons: [
                season({ season: 2026, gameType: 'regular', teams: ['DAL'], games: 70, pts: 1473 })
              ]
            }),
            otherHolds,
            otherOn: true
          })
        )
      )
    expect(fromCollege('ready').open).toEqual(profile('1642843'))
    // Not downloaded, or still loading: plain text, as the season rows are.
    for (const holds of ['off', 'notBuilt'] as const) {
      expect(fromCollege(holds).open).toBeNull()
      expect(fromCollege(holds).title).toBe(
        'NBA draft 2025, Dallas Mavericks, Round 1, pick 1 (1st overall)'
      )
    }
  })

  it('keeps Metis’s lines of a league since deleted, without opening it', () => {
    const view = careerStrip(input({ otherHolds: 'off', otherOn: false }))
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.rows[0].open).toBeNull()
    expect(view.notes).toEqual(['NCAA Men seasons from Metis, every game.'])
    expect(view.action?.kind).toBe('download')
  })

  it('says a league turned on is still loading instead of offering it again', () => {
    const view = careerStrip(input({ otherHolds: 'off', otherOn: true }))
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.action).toEqual({
      kind: 'downloading',
      text: 'NCAA Men is loading. Its own lines follow.'
    })
  })

  it('shows an unplayed draftee’s draft line on their college page', () => {
    // Jayden Quaintance: linked by name and college, picked 20th in 2026, no NBA game yet.
    const view = careerStrip(
      input({
        league: LEAGUES.ncaam,
        playerName: 'Jayden Quaintance',
        own: [
          line(2025, 'Arizona State Sun Devils', 24, 9.4),
          line(2026, 'Kentucky Wildcats', 4, 5)
        ],
        career: career({
          league: 'nba',
          link: {
            method: 'name+college',
            playerId: '1643519',
            espnId: null,
            name: 'Jayden Quaintance'
          },
          draft: {
            ...FLAGG_DRAFT,
            draftYear: 2026,
            roundPick: 20,
            overallPick: 20,
            team: 'San Antonio Spurs',
            organization: 'Kentucky'
          },
          source: null,
          seasons: []
        })
      })
    )
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.rows.map((r) => [r.kind, r.season])).toEqual([
      ['season', '2024-25'],
      ['season', '2025-26'],
      ['draft', '2026']
    ])
    expect(view.rows[2].games).toBe('Drafted: Round 1, pick 20 (20th overall)')
    expect(view.notes).toEqual(['No NBA games.'])
  })

  it('says no games in ESPN’s totals when the professional league is not downloaded', () => {
    const view = careerStrip(
      input({
        league: LEAGUES.ncaaw,
        own: [line(2025, 'UConn Huskies', 38, 19.9)],
        career: career({
          league: 'wnba',
          link: { method: 'name+college', playerId: '1643504', espnId: null, name: 'Lani White' },
          draft: { ...FLAGG_DRAFT, league: 'wnba', draftYear: 2026, team: 'Dallas Wings' }
        }),
        otherHolds: 'off',
        otherOn: false
      })
    )
    if (view.kind !== 'strip') throw new Error(view.kind)
    expect(view.notes).toEqual(['No WNBA games in ESPN’s totals.'])
  })

  it('shows nothing without a link and a reason the data knows', () => {
    // LeBron James: drafted from a high school, which links nothing and says nothing.
    const lebron = career({
      draft: { ...FLAGG_DRAFT, draftYear: 2003, organizationType: 'High School' },
      reason: { kind: 'no-link', text: 'No linked NCAA Men career.' }
    })
    expect(careerStrip(input({ career: lebron }))).toEqual({ kind: 'none' })
    expect(
      careerStrip(
        input({ career: career({ league: null, reason: { kind: 'no-pair', text: 'x' } }) })
      )
    ).toEqual({ kind: 'none' })
  })

  it('gives one line where the data knows why: drafted from a club', () => {
    // Alex Sarr, picked 2nd in 2024 from the Perth Wildcats.
    const sarr = career({
      draft: {
        ...FLAGG_DRAFT,
        draftYear: 2024,
        team: 'Washington Wizards',
        organization: 'Perth Wildcats (Australia)',
        organizationType: 'Other Team/Club'
      },
      reason: {
        kind: 'drafted-abroad',
        text: 'Drafted from Perth Wildcats (Australia), not a college.'
      }
    })
    expect(careerStrip(input({ career: sarr }))).toEqual({
      kind: 'reason',
      title: 'College and pro career',
      text: 'Drafted in 2024 from Perth Wildcats (Australia), not a college.'
    })
  })

  it('gives one line where the data knows why: college before the window', () => {
    // Cade Cunningham, drafted in 2021 from Oklahoma State.
    const cade = career({
      draft: { ...FLAGG_DRAFT, draftYear: 2021, organization: 'Oklahoma State' },
      reason: { kind: 'college-before-window', text: 'No NCAA Men record in Metis.' }
    })
    expect(reasonText(cade)).toBe(
      'Drafted in 2021 from Oklahoma State. College seasons before 2021-22 are not in Metis.'
    )
    expect(reasonText({ ...cade, draft: null })).toBe(
      'College seasons before 2021-22 are not in Metis.'
    )
  })
})

describe('the pick', () => {
  it('reads the round and pick, and the overall pick alone where that is all', () => {
    expect(pickWords(FLAGG_DRAFT)).toBe('Round 1, pick 1 (1st overall)')
    expect(pickWords({ ...FLAGG_DRAFT, round: null, roundPick: null, overallPick: 33 })).toBe(
      '33rd overall'
    )
    expect(pickWords({ ...FLAGG_DRAFT, round: null, roundPick: null, overallPick: null })).toBe('')
  })
})

describe('the season a strip row opens on', () => {
  afterEach(() => setLeague('nba'))
  const held = (season: number, types: StatsSeason['types']): StatsSeason => ({
    season,
    firstDate: '2024-11-04',
    lastDate: '2025-04-07',
    types,
    teams: []
  })
  const tournament = [
    { type: 'regular' as const, games: 5000 },
    { type: 'playoffs' as const, games: 67 }
  ]

  it('opens a college season on every game, what its strip rows count', () => {
    setLeague('ncaam')
    expect(seasonScope(held(2025, tournament))).toEqual({
      season: 2025,
      seasonType: 'counted',
      range: { kind: 'season' }
    })
    // A season with only its regular season so far opens on every game too (D45).
    expect(seasonScope(held(2027, [tournament[0]])).seasonType).toBe('counted')
  })

  it('opens a professional season on its regular season, the playoffs held or not', () => {
    setLeague('wnba')
    expect(seasonScope(held(2025, tournament)).seasonType).toBe('regular')
  })
})

describe('a traded player’s season', () => {
  it('shows the last team, as the career table does, and every team on hover', () => {
    const view = careerStrip(
      input({
        league: LEAGUES.ncaam,
        own: [line(2023, 'Indiana Hoosiers', 32, 13.5)],
        career: career({
          league: 'nba',
          link: {
            method: 'name+birth',
            playerId: '1641720',
            espnId: 4433626,
            name: 'Jalen Hood-Schifino'
          },
          source: { kind: 'metis', label: "Metis's own season lines" },
          seasons: [
            season({
              season: 2025,
              gameType: 'regular',
              teams: ['Los Angeles Lakers', 'Philadelphia 76ers'],
              games: 15,
              pts: 106
            })
          ]
        }),
        playerName: 'Jalen Hood-Schifino'
      })
    )
    if (view.kind !== 'strip') throw new Error(view.kind)
    const traded = view.rows.find((r) => r.season === '2024-25')
    expect(traded?.team).toBe('Philadelphia 76ers')
    expect(traded?.title).toBe(
      'Open Jalen Hood-Schifino’s NBA page, 2024-25 (Los Angeles Lakers, Philadelphia 76ers)'
    )
  })
})

describe('the team cell', () => {
  it('names the last team where the order is known, and never picks one where it is not', () => {
    expect(
      teamCell({ teams: ['Los Angeles Lakers', 'Philadelphia 76ers'], teamsInOrder: true })
    ).toBe('Philadelphia 76ers')
    expect(teamCell({ teams: ['Dallas Wings', 'Minnesota Lynx'], teamsInOrder: false })).toBe(
      '2 teams'
    )
    expect(teamCell({ teams: ['Dallas Wings'], teamsInOrder: true })).toBe('Dallas Wings')
    expect(teamCell({ teams: [], teamsInOrder: true })).toBe('')
  })

  it('says how many teams an ESPN season names, with the names on hover', () => {
    const espn = season({
      season: 2025,
      teams: ['Dallas Wings', 'Minnesota Lynx'],
      teamsInOrder: false,
      games: 30,
      pts: 300
    })
    expect(otherLines([espn], LEAGUES.wnba)[0].teamsInOrder).toBe(false)
    const view = careerStrip(
      input({
        league: LEAGUES.ncaaw,
        own: [line(2024, 'Maryland Terrapins', 30, 12)],
        career: career({
          league: 'wnba',
          link: { method: 'id', playerId: '1', espnId: 2, name: 'Diamond Miller' },
          source: { kind: 'espn', label: "ESPN's season totals, regular season" },
          seasons: [espn]
        }),
        playerName: 'Diamond Miller',
        otherHolds: 'off',
        otherOn: false
      })
    )
    if (view.kind !== 'strip') throw new Error(view.kind)
    const row = view.rows.find((r) => r.league === 'wnba' && r.kind === 'season')
    expect(row?.team).toBe('2 teams')
    expect(row?.title).toBe('WNBA 2025 (Dallas Wings, Minnesota Lynx)')
  })
})

describe('the header hint', () => {
  it('names the last college team and season on a professional page', () => {
    expect(stripHint(FLAGG_FROM_NBA)).toEqual({
      text: 'NCAA Men: Duke Blue Devils, 2024-25',
      title: 'NCAA Men career: see it under the career by season'
    })
  })

  it('names the last professional team on a college page, or the draft before a game', () => {
    const fromCollege = career({
      league: 'nba',
      link: { method: 'id', playerId: '1642843', espnId: 5041939, name: 'Cooper Flagg' },
      draft: FLAGG_DRAFT,
      source: { kind: 'metis', label: "Metis's own season lines" },
      seasons: [
        season({ season: 2026, gameType: 'regular', teams: ['Dallas Mavericks'], games: 70 }),
        season({ season: 2027, gameType: 'regular', teams: ['Dallas Mavericks'], games: 13 })
      ]
    })
    expect(stripHint(fromCollege)?.text).toBe('NBA: Dallas Mavericks')
    // Jayden Quaintance: picked 20th in 2026, no NBA game yet.
    const unplayed = career({
      league: 'nba',
      link: {
        method: 'name+college',
        playerId: '1643519',
        espnId: null,
        name: 'Jayden Quaintance'
      },
      draft: { ...FLAGG_DRAFT, draftYear: 2026, roundPick: 20, overallPick: 20 }
    })
    expect(stripHint(unplayed)?.text).toBe('NBA: Drafted 2026, 20th')
  })

  it('says nothing for a player with no link, a reason line included', () => {
    expect(stripHint(null)).toBeNull()
    expect(stripHint(career({ reason: { kind: 'no-link', text: 'x' } }))).toBeNull()
    expect(
      stripHint(career({ draft: FLAGG_DRAFT, reason: { kind: 'drafted-abroad', text: 'x' } }))
    ).toBeNull()
    // A link with nothing of the other career to name.
    expect(
      stripHint(career({ link: { method: 'id', playerId: '1', espnId: 1, name: 'X' } }))
    ).toBeNull()
  })
})
