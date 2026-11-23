import { useContext, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StatsSelect } from '@/components/stats/controls'
import { FavouriteMark } from '@/components/stats/FavouriteStar'
import { HEAT_CELL } from '@/components/stats/LeaderTable'
import { NavButton } from '@/components/stats/parts'
import { useFavourites } from '@/lib/stats/favourites'
import {
  absentNote,
  allDays,
  gameWords,
  MIN_GAMES,
  listingWords,
  orderRows,
  pageDay,
  pageLeagues,
  PLAYER_COUNTS,
  PLAYER_PAIRS,
  playerState,
  recordAfter,
  seasonSoFar,
  SHOT_MINIMUM,
  shotTint,
  stepFavouriteDay,
  teamGameOn,
  throughNote,
  tintOf,
  topScorer,
  type GameLine,
  type Ordered,
  type PlayerState,
  type Tint
} from '@/lib/stats/favouritesPage'
import {
  useFavouritesSection,
  useGameListings,
  useTopScorers,
  type SectionData
} from '@/lib/stats/favouritesSection'
import { useLeagueDownloads } from '@/lib/stats/downloads'
import { seasonLabel } from '@/lib/stats/league'
import { fullDay } from '@/lib/stats/scope'
import { keepFavouritesDay, SessionContext } from '@/lib/stats/session'
import type { NavLocation } from '@/lib/navHistory'
import { cn } from '@/lib/utils'
import type { Favourite } from '@shared/favourites'
import { LEAGUE_IDS, LEAGUES, type LeagueId } from '@shared/leagues'

const LABELS: Record<string, string> = {
  min: 'MIN',
  pts: 'PTS',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  tov: 'TOV'
}
const WORDS: Record<string, string> = {
  min: 'minutes',
  pts: 'points',
  reb: 'rebounds',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  tov: 'turnovers',
  team_pts: 'points',
  opp_pts: 'points allowed',
  team_point_diff: 'margin',
  team_reb: 'rebounds',
  team_ast: 'assists',
  team_tov: 'turnovers'
}
const LOWER = new Set(['tov', 'opp_pts', 'team_tov'])
/** A game on the schedule that day with no result in the data loaded (D31: no live data). */
const PENDING = 'Not played in the data loaded'

const PLAYER_GRID =
  'grid grid-cols-[minmax(170px,1.5fr)_minmax(150px,1fr)_repeat(7,44px)_repeat(3,58px)_44px] items-center gap-x-2'
const TEAM_GRID =
  'grid grid-cols-[minmax(170px,1.5fr)_minmax(150px,1fr)_52px_repeat(3,44px)_repeat(2,52px)_repeat(3,44px)_minmax(120px,1fr)] items-center gap-x-2'

const fmt = (v: number | null, id: string): string => {
  if (v === null) return ''
  if (id === 'plus_minus' || id === 'team_point_diff')
    return v > 0 ? `+${Math.round(v)}` : String(Math.round(v))
  return String(Math.round(v))
}
const avgWords = (t: Tint, decimals = 1): string =>
  t.average === null ? '' : ` · season average ${t.average.toFixed(decimals)}`

/** A stat cell: its value, tinted against the subject's own games, its title in words. */
function Cell({
  value,
  id,
  tint,
  known,
  league
}: {
  value: number | null
  id: string
  tint: Tint
  known: boolean
  league: string
}): React.JSX.Element {
  const title = !known
    ? `Not in the ${league} data`
    : value === null
      ? 'Not recorded for this game'
      : `${fmt(value, id)} ${WORDS[id] ?? id}${avgWords(tint)}${tint.place ? ` · ${tint.place}` : ` · fewer than ${MIN_GAMES} games to set it against`}`
  return (
    <span
      role="cell"
      title={title}
      data-heat={tint.heat}
      className={cn(
        'rounded-[4px] px-1 py-[3px] text-right font-mono text-[12.5px] tabular-nums',
        HEAT_CELL[tint.heat]
      )}
    >
      {known ? fmt(value, id) : ''}
    </span>
  )
}

/** A made–attempted cell, tinted by its percentage once the attempts reach the minimum. */
function PairCell({
  made,
  attempts,
  label,
  tint,
  minimum,
  known,
  league
}: {
  made: number | null
  attempts: number | null
  label: string
  tint: Tint
  minimum: number
  known: boolean
  league: string
}): React.JSX.Element {
  const pct = made !== null && attempts ? made / attempts : null
  const title = !known
    ? `Not in the ${league} data`
    : made === null || attempts === null
      ? 'Not recorded for this game'
      : `${label} ${made}–${attempts}${pct !== null ? ` (${(100 * pct).toFixed(1)} %)` : ''}${
          attempts < minimum
            ? ` · fewer than ${minimum} attempts: not tinted`
            : tint.place
              ? ` · season ${(100 * (tint.average ?? 0)).toFixed(1)} % in games of ${minimum}+ attempts · ${tint.place}`
              : ` · fewer than ${MIN_GAMES} games of ${minimum}+ attempts to set it against`
        }`
  return (
    <span
      role="cell"
      title={title}
      data-heat={tint.heat}
      className={cn(
        'rounded-[4px] px-1 py-[3px] text-right font-mono text-[12.5px] tabular-nums',
        HEAT_CELL[tint.heat]
      )}
    >
      {known && made !== null && attempts !== null ? `${made}–${attempts}` : ''}
    </span>
  )
}

const linkClass = 'min-w-0 cursor-pointer truncate text-left hover:text-cobalt'

interface PlayerRowData {
  state: PlayerState
  lines: GameLine[]
  team: string | null
}

function PlayerRow({
  fav,
  data,
  section,
  open
}: {
  fav: Favourite
  data: PlayerRowData
  section: SectionData
  open: (to: NavLocation) => void
}): React.JSX.Element {
  const L = LEAGUES[section.league].name
  const teams = section.season?.teams ?? []
  const s = data.state
  const teamId = data.team
  const code = teams.find((t) => t.id === teamId)?.code ?? ''
  const game = s.kind === 'played' || s.kind === 'dnp' || s.kind === 'pending' ? s.game : null
  const base = { league: section.league, team: null, player: null } as const
  const name = (
    <span className="flex min-w-0 items-center gap-1.5">
      <FavouriteMark kind="player" id={fav.id} on />
      <button
        type="button"
        className={cn(linkClass, 'text-[13px] font-medium')}
        title={`Open ${fav.name}’s page`}
        onClick={() =>
          open({
            ...base,
            screen: 'player',
            player: { id: fav.id, position: null },
            season: section.season?.season
          })
        }
      >
        {fav.name}
      </button>
      <span className="shrink-0 font-mono text-[11px] text-fg-3">{code}</span>
    </span>
  )
  const gameCell = game ? (
    <button
      type="button"
      className={cn(linkClass, 'font-mono text-[12px] text-fg-2')}
      title="Open this game"
      onClick={() =>
        open({ ...base, screen: 'games', game: game.id, season: section.season?.season })
      }
    >
      {gameWords(game, teamId)}
    </button>
  ) : (
    <span />
  )
  if (s.kind !== 'played') {
    return (
      <div
        role="row"
        data-state={s.kind}
        className={cn(PLAYER_GRID, 'h-[34px] border-b border-line-2')}
      >
        {name}
        {gameCell}
        <span
          role="cell"
          className="col-span-11 text-[12.5px] text-fg-3"
          title={s.kind === 'dnp' ? (s.reason ?? undefined) : undefined}
        >
          {s.kind === 'dnp'
            ? `Did not play${s.reason ? ` · ${s.reason}` : ''}`
            : s.kind === 'pending'
              ? PENDING
              : 'No game'}
        </span>
      </div>
    )
  }
  const so = seasonSoFar(data.lines, s.line)
  const v = s.line.values
  return (
    <div
      role="row"
      data-state="played"
      className={cn(PLAYER_GRID, 'h-[34px] border-b border-line-2')}
    >
      {name}
      {gameCell}
      {PLAYER_COUNTS.map((id) => (
        <Cell
          key={id}
          id={id}
          value={v[id] ?? null}
          known={section.known.has(id)}
          league={L}
          tint={tintOf(
            v[id] ?? null,
            so.map((l) => l.values[id] ?? null),
            LOWER.has(id) ? 'lower' : 'higher'
          )}
        />
      ))}
      {PLAYER_PAIRS.map(([label, m, a]) => (
        <PairCell
          key={label}
          label={label}
          made={v[m] ?? null}
          attempts={v[a] ?? null}
          minimum={SHOT_MINIMUM[a]}
          known={section.known.has(m) && section.known.has(a)}
          league={L}
          tint={shotTint(
            v[m] ?? null,
            v[a] ?? null,
            so.map((l) => ({ made: l.values[m] ?? null, attempts: l.values[a] ?? null })),
            SHOT_MINIMUM[a]
          )}
        />
      ))}
      <Cell
        id="plus_minus"
        value={v.plus_minus ?? null}
        known={section.known.has('plus_minus')}
        league={L}
        tint={{ heat: 'n', percentile: null, place: null, average: null }}
      />
    </div>
  )
}

function TeamRow({
  fav,
  section,
  day,
  scorers,
  open
}: {
  fav: Favourite
  section: SectionData
  day: string
  scorers: ReturnType<typeof useTopScorers>
  open: (to: NavLocation) => void
}): React.JSX.Element {
  const L = LEAGUES[section.league].name
  const game = teamGameOn(fav.id, day, section.games)
  const lines = section.teams.get(fav.id) ?? []
  const line = game ? lines.find((l) => l.game === game.id) : undefined
  const base = { league: section.league, team: null, player: null } as const
  const name = (
    <span className="flex min-w-0 items-center gap-1.5">
      <FavouriteMark kind="team" id={fav.id} on />
      <button
        type="button"
        className={cn(linkClass, 'text-[13px] font-medium')}
        title={`Open the ${fav.name}`}
        onClick={() =>
          open({ ...base, screen: 'team', team: fav.id, season: section.season?.season })
        }
      >
        {fav.name}
      </button>
    </span>
  )
  const gameCell = game ? (
    <button
      type="button"
      className={cn(linkClass, 'font-mono text-[12px] text-fg-2')}
      title="Open this game"
      onClick={() =>
        open({ ...base, screen: 'games', game: game.id, season: section.season?.season })
      }
    >
      {gameWords(game, fav.id)}
    </button>
  ) : (
    <span />
  )
  if (!game || !line) {
    return (
      <div
        role="row"
        data-state={game ? 'pending' : 'nogame'}
        className={cn(TEAM_GRID, 'h-[34px] border-b border-line-2')}
      >
        {name}
        {gameCell}
        <span role="cell" className="col-span-10 text-[12.5px] text-fg-3">
          {game ? (game.played ? 'No box score for this game' : PENDING) : 'No game'}
        </span>
      </div>
    )
  }
  const so = seasonSoFar(lines, line)
  const v = line.values
  const count = (id: string): React.JSX.Element => (
    <Cell
      key={id}
      id={id}
      value={v[id] ?? null}
      known={section.known.has(id)}
      league={L}
      tint={tintOf(
        v[id] ?? null,
        so.map((l) => l.values[id] ?? null),
        LOWER.has(id) ? 'lower' : 'higher'
      )}
    />
  )
  const pct = (label: string, m: string, a: string): React.JSX.Element => {
    const t = shotTint(
      v[m] ?? null,
      v[a] ?? null,
      so.map((l) => ({ made: l.values[m] ?? null, attempts: l.values[a] ?? null })),
      SHOT_MINIMUM[a]
    )
    const made = v[m] ?? null
    const att = v[a] ?? null
    return (
      <span
        key={label}
        role="cell"
        data-heat={t.heat}
        title={
          made !== null && att
            ? `${label} ${made}–${att}${t.place ? ` · ${t.place}` : ''}`
            : 'Not recorded for this game'
        }
        className={cn(
          'rounded-[4px] px-1 py-[3px] text-right font-mono text-[12.5px] tabular-nums',
          HEAT_CELL[t.heat]
        )}
      >
        {made !== null && att ? `${((100 * made) / att).toFixed(1)}` : ''}
      </span>
    )
  }
  const top = topScorer(scorers, game, fav.id)
  return (
    <div
      role="row"
      data-state="played"
      className={cn(TEAM_GRID, 'h-[34px] border-b border-line-2')}
    >
      {name}
      {gameCell}
      <span
        role="cell"
        className="text-right font-mono text-[12px] text-fg-2"
        title="Record after the game"
      >
        {recordAfter(fav.id, game, section.games)}
      </span>
      {count('team_pts')}
      {count('opp_pts')}
      {count('team_point_diff')}
      {pct('FG%', 'team_fgm', 'team_fga')}
      {pct('3P%', 'team_fg3m', 'team_fg3a')}
      {count('team_reb')}
      {count('team_ast')}
      {count('team_tov')}
      <span role="cell" className="truncate text-[12.5px] text-fg-2" title="The game's top scorer">
        {top ? `${top.name} ${top.pts}` : ''}
      </span>
    </div>
  )
}

const Head = ({ grid, cols }: { grid: string; cols: string[] }): React.JSX.Element => (
  <div
    role="row"
    className={cn(grid, 'h-7 border-b border-fg-3 pb-[5px] text-[11px] text-fg-3 items-end')}
  >
    {cols.map((c, i) => (
      <span
        key={c + i}
        role="columnheader"
        className={cn('font-mono', i < 2 ? 'text-left font-sans' : 'text-right')}
      >
        {c}
      </span>
    ))}
  </div>
)

function Section({
  league,
  favourites,
  downloaded,
  first,
  day,
  onDays,
  open,
  onOpenData
}: {
  league: LeagueId
  favourites: Favourite[]
  downloaded: boolean
  first: boolean
  day: string | null
  onDays: (league: LeagueId, days: string[] | null) => void
  open: (to: NavLocation) => void
  onOpenData: (league: LeagueId) => void
}): React.JSX.Element {
  const section = useFavouritesSection(league, favourites, downloaded, 0)
  const teamIds = useMemo(
    () => favourites.filter((f) => f.kind === 'team').map((f) => f.id),
    [favourites]
  )
  const scorers = useTopScorers(section, teamIds, day)
  // The games the favourite players did not play on the day, for their listings' reasons.
  const dnp = useMemo(() => {
    if (section.status !== 'ready' || day === null) return []
    return favourites.flatMap((f) => {
      if (f.kind !== 'player') return []
      const st = playerState(section.players.get(f.id) ?? [], day, section.games)
      return st.kind === 'dnp' ? [{ game: st.game.id, player: f.id }] : []
    })
  }, [section, day, favourites])
  const listings = useGameListings(section, dnp)
  useEffect(() => {
    if (!downloaded) onDays(league, [])
    else if (section.status !== 'loading') onDays(league, section.days)
  }, [downloaded, section.status, section.days, league, onDays])
  const L = LEAGUES[league].name
  const title = (
    <div className="flex items-baseline gap-2.5">
      <h2 className="m-0 text-[17px] leading-none font-semibold tracking-[-0.01em]">{L}</h2>
      {section.season && (
        <span className="font-mono text-[11.5px] text-fg-3">
          {seasonLabel(section.season.season)}
        </span>
      )}
      {first && <span className="font-mono text-[11px] text-fg-3">on screen</span>}
    </div>
  )
  if (!downloaded) {
    return (
      <section aria-label={L} data-league={league} className="flex flex-col gap-2">
        {title}
        <div className="flex items-center gap-3 text-[12.5px] text-fg-3">
          <span>Not downloaded</span>
          <button
            type="button"
            onClick={() => onOpenData(league)}
            className="cursor-pointer font-medium text-fg-2 hover:text-cobalt"
          >
            Open the Data panel →
          </button>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px]">
          {favourites.map((f) => (
            <li key={`${f.kind}:${f.id}`} className="flex items-center gap-1.5">
              <FavouriteMark kind={f.kind} id={f.id} on />
              {f.name}
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (section.status === 'loading') {
    return (
      <section aria-label={L} data-league={league} className="flex flex-col gap-2">
        {title}
        <div className="text-[12.5px] text-fg-3" data-loading="">
          Loading the {L}…
        </div>
      </section>
    )
  }
  if (section.status === 'error') {
    return (
      <section aria-label={L} data-league={league} className="flex flex-col gap-2">
        {title}
        <div className="text-[12.5px] text-bad">{section.error}</div>
      </section>
    )
  }
  if (day === null) {
    return (
      <section
        aria-label={L}
        data-league={league}
        data-ms={section.ms ?? ''}
        className="flex flex-col gap-2"
      >
        {title}
      </section>
    )
  }
  const players = favourites.filter((f) => f.kind === 'player')
  const teams = favourites.filter((f) => f.kind === 'team')
  const playerRows: Ordered<PlayerRowData>[] = []
  let absent = 0
  for (const f of players) {
    const lines = section.players.get(f.id) ?? []
    const state = playerState(lines, day, section.games)
    if (state.kind === 'absent') {
      absent++
      continue
    }
    const team = state.kind === 'played' ? state.line.team : state.team
    // The injury report's reason for a game not played, where it lists the player.
    const shown =
      state.kind === 'dnp'
        ? {
            ...state,
            reason: listingWords(listings.get(`${state.game.id}:${f.id}`) ?? null) ?? state.reason
          }
        : state
    playerRows.push({ favourite: f, state: shown, row: { state: shown, lines, team } })
  }
  const teamRows: Ordered<null>[] = teams.map((f) => {
    const g = teamGameOn(f.id, day, section.games)
    return {
      favourite: f,
      state: { kind: g ? (g.played ? 'played' : 'pending') : 'nogame' },
      row: null
    }
  })
  const through = throughNote(L, section.through, day, fullDay)
  const foot = section.season ? absentNote(absent, seasonLabel(section.season.season)) : null
  return (
    <section
      aria-label={L}
      data-league={league}
      data-ms={section.ms ?? ''}
      className="flex flex-col gap-2.5"
    >
      <div className="flex items-baseline justify-between gap-4">
        {title}
        {through && (
          <span className="text-[12px] text-warn" data-through="">
            {through}
          </span>
        )}
      </div>
      {playerRows.length > 0 && (
        <div role="table" aria-label={`${L} favourite players`} className="flex flex-col">
          <Head
            grid={PLAYER_GRID}
            cols={[
              'Player',
              'Game',
              ...PLAYER_COUNTS.map((c) => LABELS[c]),
              'FG',
              '3P',
              'FT',
              '+/−'
            ]}
          />
          {orderRows(playerRows).map((r) => (
            <PlayerRow
              key={r.favourite.id}
              fav={r.favourite}
              data={r.row}
              section={section}
              open={open}
            />
          ))}
        </div>
      )}
      {teamRows.length > 0 && (
        <div role="table" aria-label={`${L} favourite teams`} className="flex flex-col">
          <Head
            grid={TEAM_GRID}
            cols={[
              'Team',
              'Game',
              'Record',
              'PTS',
              'OPP',
              '+/−',
              'FG%',
              '3P%',
              'REB',
              'AST',
              'TOV',
              'Top scorer'
            ]}
          />
          {orderRows(teamRows).map((r) => (
            <TeamRow
              key={r.favourite.id}
              fav={r.favourite}
              section={section}
              day={day}
              scorers={scorers}
              open={open}
            />
          ))}
        </div>
      )}
      {foot && (
        <div className="text-[12px] text-fg-3" data-absent="">
          {foot}
        </div>
      )}
    </section>
  )
}

/**
 * The Favourites page (D50, Plan T1601.4): one day, a section a league that has favourites, the league
 * on screen first, each section read on its own. Opened from the nav; the app still opens on
 * Leaderboards.
 */
export function StatsFavourites({
  league,
  onOpenPage,
  onOpenData
}: {
  league: LeagueId
  onOpenPage?: (to: NavLocation) => void
  onOpenData: (league: LeagueId) => void
}): React.JSX.Element {
  const { all, ready } = useFavourites()
  const downloads = useLeagueDownloads()
  const store = useContext(SessionContext)
  // The page's day is the app's, not a league's: kept above the shell, so Back finds it.
  const [chosen, setChosenState] = useState<string | null>(store?.favouritesDay ?? null)
  const setChosen = (d: string | null): void => {
    keepFavouritesDay(store, d)
    setChosenState(d)
  }
  const [days, setDays] = useState<Partial<Record<LeagueId, string[] | null>>>({})
  const onDays = useMemo(
    () => (l: LeagueId, d: string[] | null) =>
      setDays((was) => (JSON.stringify(was[l]) === JSON.stringify(d) ? was : { ...was, [l]: d })),
    []
  )
  const sections = pageLeagues(
    league,
    LEAGUE_IDS,
    all,
    (l) => downloads?.leagues.find((d) => d.league === l)?.hasFile ?? true
  )
  const leagues = sections.map((x) => x.league)
  const sectionDays = leagues.map((l) => days[l] ?? []).filter((d) => d.length)
  const every = allDays(sectionDays)
  const day = pageDay(chosen, sectionDays)
  const loaded = leagues.every((l) => days[l] !== undefined)
  const open = (to: NavLocation): void => onOpenPage?.(to)

  const empty = (text: string): React.JSX.Element => (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-8">
      <h1 className="m-0 text-[26px] leading-[1.1] font-semibold tracking-[-0.025em]">
        Favourites
      </h1>
      <div className="py-16 text-center text-[13px] text-fg-3" data-empty="">
        {text}
      </div>
    </div>
  )
  if (ready && leagues.length === 0) {
    return empty(
      'No favourites yet. Star a player or a team, on their page or a leaderboard, to keep them here.'
    )
  }
  return (
    <div className="flex flex-col gap-6 px-8 pt-[22px] pb-8">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-[7px]">
          <h1 className="m-0 text-[26px] leading-[1.1] font-semibold tracking-[-0.025em]">
            Favourites
          </h1>
          <div className="text-[13px] text-fg-3" data-day={day ?? ''}>
            {day
              ? fullDay(day)
              : loaded
                ? 'No day with a favourite’s game'
                : 'Finding the latest day…'}
            {' · the latest data loaded, never live'}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <NavButton
            title="The day before with a favourite’s game"
            disabled={stepFavouriteDay(every, day, -1) === null}
            onClick={() => setChosen(stepFavouriteDay(every, day, -1))}
          >
            <ChevronLeft className="size-3.5" />
          </NavButton>
          <StatsSelect
            title="Day"
            value={day ?? ''}
            options={(every.length ? every : day ? [day] : []).map((d) => ({
              value: d,
              label: fullDay(d)
            }))}
            onChange={(d) => setChosen(d || null)}
            className="w-[150px]"
          />
          <NavButton
            title="The day after with a favourite’s game"
            disabled={stepFavouriteDay(every, day, 1) === null}
            onClick={() => setChosen(stepFavouriteDay(every, day, 1))}
          >
            <ChevronRight className="size-3.5" />
          </NavButton>
        </div>
      </header>
      {loaded && every.length === 0 && sections.some((x) => x.downloaded) && (
        <div className="py-6 text-center text-[13px] text-fg-3" data-empty="">
          No favourite has a game on any day loaded.
        </div>
      )}
      {leagues.map((l, i) => (
        <Section
          key={l}
          league={l}
          favourites={all[l] ?? []}
          downloaded={sections[i].downloaded}
          first={i === 0 && l === league}
          day={day}
          onDays={onDays}
          open={open}
          onOpenData={onOpenData}
        />
      ))}
    </div>
  )
}
