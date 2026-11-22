import { LEAGUES, pairOf, type League, type LeagueId } from '@shared/leagues'
import type { NavLocation } from '@/lib/navHistory'
import type { LeagueHolds } from '@/lib/stats/downloads'
import { fmtStat, ordinal, type ValueFormat } from '@/lib/stats/format'
import type {
  GameType,
  MetricInfo,
  StatsDraftLine,
  StatsOtherCareer,
  StatsOtherSeason,
  StatsQuery,
  StatsResult
} from '@shared/stats/types'

/**
 * The career strip on a player's page (T1304.3): their college and professional careers as one, in
 * time order. The college seasons, the draft between them, then the professional seasons, a row a
 * season with the team, games and the per-game line the page's own season table leads with. The
 * league on screen's rows come from its own engine; the other league's from the links file's read
 * (`stats.otherCareer`), which names its source. Nothing of the other league is ranked or averaged
 * (D35, D47): the strip only lists it.
 */

/** The per-game line, in the order the page's career table leads with it. */
export const STRIP_METRICS = [
  'min',
  'pts',
  'reb',
  'ast',
  'stl',
  'blk',
  'fg_pct',
  'fg3_pct',
  'ft_pct'
] as const
export type StripMetric = (typeof STRIP_METRICS)[number]

/** How each is written where the catalogue does not say: per-game counts to a tenth, rates in percent. */
const FALLBACK: Record<StripMetric, ValueFormat> = {
  min: { unit: 'minutes', decimals: 1 },
  pts: { unit: 'number', decimals: 1 },
  reb: { unit: 'number', decimals: 1 },
  ast: { unit: 'number', decimals: 1 },
  stl: { unit: 'number', decimals: 1 },
  blk: { unit: 'number', decimals: 1 },
  fg_pct: { unit: 'pct', decimals: 1 },
  fg3_pct: { unit: 'pct', decimals: 1 },
  ft_pct: { unit: 'pct', decimals: 1 }
}

/**
 * The games a league's strip rows count: every game in a college league (its default, D45, and what
 * ESPN's college totals count), the regular season in a professional one (what ESPN's professional
 * totals count). The page's own season table reads the same at the league's default scope.
 */
export function stripGameTypes(league: League): GameType[] {
  return league.defaultType === 'counted' ? [...league.countedTypes] : ['regular']
}

/** What the strip's rows count, said once: "every game" or "regular season". */
export const countsWords = (league: League): string =>
  league.defaultType === 'counted' ? 'every game' : 'regular season'

/** The league on screen's own seasons for the strip, per game, by season. */
export function stripQuery(player: string, seasons: number[], league: League): StatsQuery {
  return {
    entity: 'player',
    metrics: [...STRIP_METRICS],
    scope: { seasons, gameTypes: stripGameTypes(league), players: [player] },
    groupBy: ['season'],
    transform: 'perGame',
    sort: { metric: 'pts', dir: 'desc' },
    limit: 100,
    ranks: false
  }
}

/** One season's per-game line, from either side, before it is written. */
export interface StripLine {
  season: number
  teams: string[]
  /** Whether the last of `teams` is the team the season ended with (`StatsOtherSeason.teamsInOrder`). */
  teamsInOrder: boolean
  games: number | null
  values: Record<StripMetric, number | null>
}

/** The league on screen's lines from the strip's query; `teamName` turns a season's code into a name. */
export function ownLines(
  result: StatsResult | null,
  teamName: (season: number, code: string) => string | null
): StripLine[] {
  return (result?.rows ?? [])
    .filter((r) => r.group.season !== null && r.group.season !== undefined && r.games > 0)
    .map((r) => {
      const season = Number(r.group.season)
      const values = {} as Record<StripMetric, number | null>
      for (const id of STRIP_METRICS) values[id] = r.values[id]?.value ?? null
      return {
        season,
        teams: r.team ? [teamName(season, r.team) ?? r.team] : [],
        teamsInOrder: true,
        games: r.games,
        values
      }
    })
    .sort((a, b) => a.season - b.season)
}

const ratio = (a: number | null, b: number | null): number | null =>
  a === null || b === null || b === 0 ? null : a / b

/**
 * The other league's lines from the read: per game from its totals. Metis's own lines come a row a
 * season type and are added up over the types the strip counts in that league; ESPN's come a row a
 * season, already counting what the source's label says.
 */
export function otherLines(seasons: StatsOtherSeason[], league: League): StripLine[] {
  const counted = new Set<GameType>(stripGameTypes(league))
  const bySeason = new Map<number, StatsOtherSeason[]>()
  for (const s of seasons) {
    if (s.gameType !== null && !counted.has(s.gameType)) continue
    bySeason.set(s.season, [...(bySeason.get(s.season) ?? []), s])
  }
  const sum = (rows: StatsOtherSeason[], key: keyof StatsOtherSeason): number | null => {
    const known = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number')
    return known.length === 0 ? null : known.reduce((a, b) => a + b, 0)
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, rows]) => {
      const games = sum(rows, 'games')
      const per = (key: keyof StatsOtherSeason): number | null => ratio(sum(rows, key), games)
      // The regular season's teams first, then any new in the games after it.
      const teams = [...new Set(rows.flatMap((r) => r.teams))]
      return {
        season,
        teams,
        teamsInOrder: rows.every((r) => r.teamsInOrder),
        games,
        values: {
          min: per('minutes'),
          pts: per('pts'),
          reb: per('reb'),
          ast: per('ast'),
          stl: per('stl'),
          blk: per('blk'),
          fg_pct: ratio(sum(rows, 'fgm'), sum(rows, 'fga')),
          fg3_pct: ratio(sum(rows, 'fg3m'), sum(rows, 'fg3a')),
          ft_pct: ratio(sum(rows, 'ftm'), sum(rows, 'fta'))
        }
      }
    })
    .filter((l) => (l.games ?? 0) > 0)
}

/** "Round 1, pick 1 (1st overall)". */
export function pickWords(d: StatsDraftLine): string {
  const parts = [
    d.round !== null ? `Round ${d.round}` : null,
    d.roundPick !== null ? `pick ${d.roundPick}` : null
  ].filter(Boolean)
  if (parts.length === 0) return d.overallPick !== null ? `${ordinal(d.overallPick)} overall` : ''
  const overall = d.overallPick !== null ? ` (${ordinal(d.overallPick)} overall)` : ''
  return `${parts.join(', ')}${overall}`
}

/**
 * The team cell: the season's last team, as the page's career table shows it; "2 teams" where the
 * source names several without saying which came last (the names on hover). Never one picked.
 */
export function teamCell(line: Pick<StripLine, 'teams' | 'teamsInOrder'>): string {
  if (line.teams.length > 1 && !line.teamsInOrder) return `${line.teams.length} teams`
  return line.teams.at(-1) ?? ''
}

/** A page of the other league to open: that player's, in the season of the row. */
export type StripTarget = NavLocation & { season: number }

/** One row of the strip, written. */
export interface StripRow {
  key: string
  kind: 'season' | 'draft'
  league: LeagueId
  leagueName: string
  /** A season of the league on screen: what this page is about. */
  own: boolean
  season: string
  /** The last team of the season, as the page's career table shows it; every team in `title`. */
  team: string
  /** A season's games; the draft's pick, spilling over the empty cells. */
  games: string
  cells: string[]
  /** A season row: the other league's page in its season. The draft row: the Profile tab. */
  open: NavLocation | null
  /** The row's hover and accessible name. */
  title: string
}

/** What the strip offers when the other league is not downloaded (D48: never one player alone). */
export type StripAction =
  { kind: 'download'; league: LeagueId; label: string } | { kind: 'downloading'; text: string }

export type StripView =
  /** No other career and no reason the data knows: nothing at all on the page. */
  | { kind: 'none' }
  /** No other career, with the reason the data knows. */
  | { kind: 'reason'; title: string; text: string }
  | {
      kind: 'strip'
      title: string
      note: string
      rows: StripRow[]
      /** Where each league's rows come from, said once. */
      notes: string[]
      action: StripAction | null
    }

export const STRIP_TITLE = 'College and pro career'

const draftWhere = (d: StatsDraftLine): string => (d.organization ? ` from ${d.organization}` : '')

/** A reason in the strip's words, or null where the read gives none worth a line. */
export function reasonText(career: StatsOtherCareer): string | null {
  const reason = career.reason
  if (!reason) return null
  const d = career.draft
  if (reason.kind === 'drafted-abroad') {
    return d
      ? `Drafted in ${d.draftYear}${draftWhere(d)}, not a college.`
      : 'Drafted from a club, not a college.'
  }
  if (reason.kind === 'college-before-window') {
    const pair = career.league ? pairOf(career.league) : null
    const college = pair ? LEAGUES[pair.college] : null
    const from = college && pair ? college.seasonLabel(pair.collegeFrom) : null
    const before = from ? `College seasons before ${from} are not in Metis.` : reason.text
    return d ? `Drafted in ${d.draftYear}${draftWhere(d)}. ${before}` : before
  }
  // No pair, or no link and nothing known: no line, never a guess.
  return null
}

export interface StripInput {
  /** The league on screen. */
  league: League
  /** The player on screen, by their id in that league: the draft row of a professional page opens it. */
  player?: string
  playerName: string
  /** The league on screen's own lines (`ownLines`). */
  own: StripLine[]
  career: StatsOtherCareer
  /** What the other league holds now; undefined until the downloads are read. */
  otherHolds: LeagueHolds | undefined
  /** Whether the other league is turned on (downloading, when it holds nothing yet). */
  otherOn: boolean
  byId: ReadonlyMap<string, MetricInfo>
}

function seasonRow(
  line: StripLine,
  league: League,
  own: boolean,
  byId: ReadonlyMap<string, MetricInfo>,
  open: StripTarget | null,
  playerName: string
): StripRow {
  const season = league.seasonLabel(line.season)
  return {
    key: `${league.id}:${line.season}`,
    kind: 'season',
    league: league.id,
    leagueName: league.name,
    own,
    season,
    team: teamCell(line),
    games: line.games === null ? '—' : String(line.games),
    cells: STRIP_METRICS.map((id) =>
      fmtStat(line.values[id], byId.get(id) ?? FALLBACK[id], 'perGame')
    ),
    open,
    // Every team of a traded season, where the row shows only the last.
    title: `${open ? `Open ${playerName}’s ${league.name} page, ${season}` : `${league.name} ${season}`}${
      line.teams.length > 1 ? ` (${line.teams.join(', ')})` : ''
    }`
  }
}

/** The strip from the page's own lines and the read: its rows in time order, notes and action. */
export function careerStrip({
  league,
  player,
  playerName,
  own,
  career,
  otherHolds,
  otherOn,
  byId
}: StripInput): StripView {
  if (!career.link || career.league === null) {
    const text = reasonText(career)
    return text ? { kind: 'reason', title: STRIP_TITLE, text } : { kind: 'none' }
  }
  const other = LEAGUES[career.league]
  const pair = pairOf(league.id)
  if (!pair) return { kind: 'none' }
  const college = pair.college === league.id ? league : other
  const pro = pair.pro === league.id ? league : other
  const otherId = career.link.playerId
  const navigable = otherHolds === 'ready' && otherId !== null
  const mine = own.map((l) => seasonRow(l, league, true, byId, null, playerName))
  const theirs = otherLines(career.seasons, other).map((l) =>
    seasonRow(
      l,
      other,
      false,
      byId,
      navigable
        ? {
            league: other.id,
            screen: 'player',
            team: null,
            player: { id: otherId, position: null },
            season: l.season
          }
        : null,
      playerName
    )
  )
  const d = career.draft
  // The draft row opens the draft where the app shows it: the Profile tab of the player's page in the
  // professional league, this page's where it is that league, the other's where that is downloaded
  // and they have a page there: a game in it (a draftee who has not played has no page to open).
  // Elsewhere it stays plain text.
  const proId =
    pro.id === league.id ? (player ?? null) : navigable && theirs.length > 0 ? otherId : null
  const draftOpen: NavLocation | null =
    proId !== null
      ? {
          league: pro.id,
          screen: 'player',
          team: null,
          player: { id: proId, position: null },
          playerTab: 'profile'
        }
      : null
  const draftWords = d
    ? `${pro.name} draft ${d.draftYear}${d.team ? `, ${d.team}` : ''}${pickWords(d) ? `, ${pickWords(d)}` : ''}`
    : ''
  const draft: StripRow[] = d
    ? [
        {
          key: `draft:${d.draftYear}`,
          kind: 'draft',
          league: pro.id,
          leagueName: pro.name,
          own: false,
          // The draft's own year: the NBA's table labels its class a season ahead (2026 for 2025).
          season: String(d.draftYear),
          team: d.team ?? '',
          games: `Drafted: ${pickWords(d)}`.replace(/: $/, ''),
          cells: [],
          open: draftOpen,
          title: draftOpen ? `${draftWords}: open ${playerName}’s ${pro.name} profile` : draftWords
        }
      ]
    : []
  // D46 never links a college career that starts after the draft, so the order is the career's.
  const collegeRows = college.id === league.id ? mine : theirs
  const proRows = pro.id === league.id ? mine : theirs
  const rows = [...collegeRows, ...draft, ...proRows]

  const notes: string[] = []
  if (career.source && theirs.length > 0) {
    notes.push(
      career.source.kind === 'metis'
        ? `${other.name} seasons from Metis, ${countsWords(other)}.`
        : `${other.name} seasons from ESPN’s totals, ${countsWords(other)}.`
    )
  } else if (theirs.length === 0) {
    // A draftee who has not played yet, or a career whose lines no source has.
    notes.push(
      otherHolds === 'ready'
        ? `No ${other.name} games.`
        : `No ${other.name} games in ESPN’s totals.`
    )
  }
  if (navigable && theirs.length > 0) {
    notes.push(`Each ${other.name} row opens their ${other.name} page.`)
  }

  let action: StripAction | null = null
  if (otherHolds === 'off' || otherHolds === 'notBuilt') {
    action =
      otherOn || otherHolds === 'notBuilt'
        ? { kind: 'downloading', text: `${other.name} is loading. Its own lines follow.` }
        : {
            kind: 'download',
            league: other.id,
            label: `Download ${other.name} for the full profile`
          }
  }
  return {
    kind: 'strip',
    title: STRIP_TITLE,
    note: `${college.name} ${countsWords(college)} · ${pro.name} ${countsWords(pro)} · Per game`,
    rows,
    notes,
    action
  }
}

/** The header's way to the strip: one short link at the end of the facts line. */
export interface StripHint {
  /** "NCAA Men: Duke Blue Devils, 2024-25", "NBA: Dallas Mavericks", "NBA: Drafted 2026, 20th". */
  text: string
  /** Its hover and accessible name. */
  title: string
}

/**
 * The hint the header carries once the read finds a link (item 1 of the T1304.3 review): on a
 * professional page the last college team and season, on a college page the last professional team,
 * or the draft where they have not played. Named by its league, since the facts line already ends
 * with the school. Nothing without a link, or with nothing of the other career to name.
 */
export function stripHint(career: StatsOtherCareer | null): StripHint | null {
  if (!career?.link || career.league === null) return null
  const other = LEAGUES[career.league]
  const lines = otherLines(career.seasons, other)
  const last = lines.at(-1)
  const title = `${other.name} career: see it under the career by season`
  if (last) {
    const team = teamCell(last)
    const pair = pairOf(career.league)
    const college = pair?.college === career.league
    // A college season names its year, a professional team is enough: it is where they play now.
    const text = college
      ? `${team ? `${team}, ` : ''}${other.seasonLabel(last.season)}`
      : team || other.seasonLabel(last.season)
    return { text: `${other.name}: ${text}`, title }
  }
  const d = career.draft
  if (d && d.league === career.league) {
    const pick = d.overallPick !== null ? `, ${ordinal(d.overallPick)}` : ''
    return { text: `${other.name}: Drafted ${d.draftYear}${pick}`, title }
  }
  return null
}
