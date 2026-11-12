import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { GameChart } from '@/components/stats/GameChart'
import { CompareButton } from '@/screens/stats/StatsCompare'
import {
  Loading,
  MiniTable,
  NavButton,
  Notes,
  ResultChip,
  SectionHead,
  TabRow
} from '@/components/stats/parts'
import { ScopeBar } from '@/components/stats/ScopeBar'
import { StatSection, StatSections } from '@/components/stats/StatLines'
import { LineupsTab } from './StatsLineups'
import { TeamOnOff } from './StatsOnCourt'
import { useNoteContext } from '@/lib/dev/noteContext'
import { DASHBOARD_MODES, sectionMetrics, sectionViews } from '@/lib/stats/dashboard'
import type { ExploreSubject } from '@/lib/stats/explore'
import { fmtStat } from '@/lib/stats/format'
import {
  moveToSeason,
  rangeLabel,
  seasonOf,
  shortDay,
  typeLabel,
  type StatsScope
} from '@/lib/stats/scope'
import { teamPlace } from '@/lib/stats/standings'
import {
  gamesInScope,
  HISTORY_METRICS,
  historyQuery,
  historyRows,
  marginSeries,
  nextGame,
  noGamesNote,
  RATINGS_SECTION,
  resultCards,
  ROSTER_METRICS,
  rosterQuery,
  rosterRows,
  scheduleRows,
  scorerRows,
  scorersQuery,
  TEAM_DASH_TABS,
  TEAM_SECTIONS,
  teamGames,
  teamIn,
  teamPoolQuery,
  teamRecord,
  type TeamGame,
  type TeamTab
} from '@/lib/stats/team'
import {
  useAvailability,
  useCoaches,
  useSeasonGames,
  useStandings,
  useStatsQuery,
  type StatsData
} from '@/lib/stats/useStats'
import { StatusChip } from '@/components/stats/StatusChip'
import { coachLines, tagsById } from '@/lib/stats/availability'
import { cn } from '@/lib/utils'
import type { BoardMode } from '@shared/stats/types'

/** The dashboard is about one team: never another team's answers while its own load. */
const FRESH = { keepLast: false }

interface TabProps {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  team: string
  name: string
  /** Every game of the season, from this team's side. */
  games: TeamGame[]
  mode: BoardMode
  onOpenPlayer: (id: string) => void
  onOpenGame: (id: string) => void
}

/** Header with the record and the standing, a results strip, and the tabs. */
export function StatsTeam({
  data,
  scope,
  onScope,
  team,
  onTeam,
  tab,
  onTab,
  onOpenLeaderboard,
  onOpenPlayer,
  onOpenGame,
  onCompare,
  onTrend
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  team: string
  onTeam: (team: string) => void
  tab: TeamTab
  onTab: (tab: TeamTab) => void
  onOpenLeaderboard: () => void
  onOpenPlayer: (id: string) => void
  onOpenGame: (id: string) => void
  /** Compare with these players or teams: Explore's Compare tab. */
  onCompare?: (subjects: ExploreSubject[]) => void
  /** This dashboard's player or team over their seasons in Trends, on a metric or the one shown. */
  onTrend?: (metric?: string) => void
}): React.JSX.Element {
  const { value: all, error: gamesError } = useSeasonGames(scope.season, data.version)
  const { value: standings } = useStandings(scope.season, data.version)
  const [mode, setMode] = useState<BoardMode>('perGame')
  const games = useMemo(() => (all ? teamGames(all, team) : null), [all, team])
  const { code, name, exists } = teamIn(data.seasons, scope.season, team)
  useNoteContext('team', { label: code, data: { team, code, tab } })
  const inScope = games ? gamesInScope(games, scope) : []
  const anyPlayed = inScope.some((g) => g.played)
  const props: TabProps = {
    data,
    scope,
    onScope,
    team,
    name,
    games: games ?? [],
    mode,
    onOpenPlayer,
    onOpenGame
  }
  return (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-8">
      <Header
        data={data}
        scope={scope}
        onScope={onScope}
        team={team}
        code={code}
        name={name}
        onTeam={onTeam}
        games={games}
        place={scope.seasonType === 'regular' ? teamPlace(standings, team) : null}
        onOpenGame={onOpenGame}
        onCompare={onCompare && (() => onCompare([{ entity: 'team', id: team }]))}
      />
      <TabRow label="Team dashboard" tabs={TEAM_DASH_TABS} value={tab} onChange={onTab}>
        <div className="mb-2 flex shrink-0 items-center gap-4">
          {onTrend && (
            <button
              type="button"
              onClick={() => onTrend()}
              className="cursor-pointer text-[12.5px] font-medium whitespace-nowrap text-fg-2 hover:text-cobalt"
            >
              Trends →
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="cursor-pointer text-[12.5px] font-medium whitespace-nowrap text-fg-2 hover:text-cobalt"
          >
            Team leaderboards →
          </button>
        </div>
      </TabRow>
      {gamesError && <div className="text-[12.5px] text-bad">{gamesError}</div>}
      {games && !anyPlayed && (
        <div className="rounded-[8px] bg-panel-2 px-4 py-3 text-[13px] text-fg-2">
          {noGamesNote(name, exists, scope)}
        </div>
      )}
      {(tab === 'overview' ||
        tab === 'offense' ||
        tab === 'defense' ||
        tab === 'players' ||
        tab === 'on_off' ||
        tab === 'lineups') &&
        (anyPlayed || !games) && (
          <div className="self-start">
            <Segmented
              label="Totals or rates"
              value={mode}
              options={DASHBOARD_MODES}
              onChange={setMode}
            />
          </div>
        )}
      {tab === 'overview' && <Overview {...props} anyPlayed={anyPlayed} />}
      {(tab === 'offense' || tab === 'defense') && anyPlayed && (
        <LinesTab key={tab} {...props} tab={tab} />
      )}
      {tab === 'players' && anyPlayed && <Players {...props} />}
      {tab === 'on_off' && anyPlayed && (
        <TeamOnOff data={data} scope={scope} team={team} onOpenPlayer={onOpenPlayer} />
      )}
      {tab === 'lineups' && (anyPlayed || !games) && (
        <LineupsTab data={data} scope={scope} team={team} mode={mode} onOpenPlayer={onOpenPlayer} />
      )}
      {tab === 'schedule' && <Schedule {...props} />}
    </div>
  )
}

function Header({
  data,
  scope,
  onScope,
  team,
  code,
  name,
  onTeam,
  games,
  place,
  onOpenGame,
  onCompare
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  team: string
  code: string
  name: string
  onTeam: (team: string) => void
  games: TeamGame[] | null
  place: string | null
  onOpenGame: (id: string) => void
  onCompare?: () => void
}): React.JSX.Element {
  const teams = seasonOf(data.seasons, scope.season)?.teams ?? []
  const inScope = games ? gamesInScope(games, scope) : []
  // Until the team's games arrive, no tile shows another team's record.
  const rec = games ? teamRecord(inScope) : null
  const { value: staff } = useCoaches(team, scope.season, data.version)
  const coaches = coachLines(staff)
  const cards = resultCards(inScope)
  // The strip reads toward now: where it has to scroll, it starts at the latest games.
  const strip = useRef<HTMLDivElement | null>(null)
  const latest = cards.at(-1)?.key
  useEffect(() => {
    if (strip.current) strip.current.scrollLeft = strip.current.scrollWidth
  }, [latest])
  const i = teams.findIndex((t) => t.id === team)
  const step = (d: number): void => {
    if (teams.length) onTeam(teams[(Math.max(i, 0) + d + teams.length) % teams.length].id)
  }
  const tiles: [string, string, string?][] = [
    ['Record', rec?.record ?? '—'],
    ['Points / game', rec?.pointsPerGame ?? '—'],
    ['Allowed / game', rec?.allowedPerGame ?? '—'],
    ['Margin', rec?.margin ?? '—', rec?.tone ?? undefined]
  ]
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <NavButton title="Previous team" onClick={() => step(-1)}>
              <ChevronLeft className="size-3.5" />
            </NavButton>
            <StatsSelect
              title="Team"
              value={team}
              options={[
                ...teams.map((t) => ({ value: t.id, label: t.code })),
                // A franchise with no team that season stays selected, so a move back returns to it.
                ...(i < 0 ? [{ value: team, label: code }] : [])
              ]}
              onChange={onTeam}
              className="h-[26px] font-mono"
            />
            <NavButton title="Next team" onClick={() => step(1)}>
              <ChevronRight className="size-3.5" />
            </NavButton>
            <span className="ml-2 truncate text-[12.5px] text-fg-3">
              {name}
              {place ? ` · ${place}` : ''} · {rangeLabel(scope, 'team')}
            </span>
          </div>
          <div className="flex items-end gap-[22px]">
            <h1 className="m-0 font-sans text-[52px] leading-[0.85] font-bold tracking-[-0.04em]">
              {code}
            </h1>
            <div className="flex gap-px overflow-hidden rounded-[8px] bg-line shadow-[0_0_0_1px_var(--line)]">
              {tiles.map(([label, value, tone]) => (
                <div key={label} className="flex flex-col gap-[5px] bg-panel px-3.5 py-2">
                  <span className="text-[11px] leading-none font-medium text-fg-3">{label}</span>
                  <span
                    className={cn(
                      'font-cond text-[24px] leading-[0.9] font-extrabold tabular-nums',
                      tone === 'good' && 'text-good',
                      tone === 'bad' && 'text-bad'
                    )}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {staff && (
            <span className="max-w-[760px] text-[12px] leading-[1.4] text-fg-3">
              {coaches.head ? `Head coach ${coaches.head}` : 'No head coach listed'}
              {coaches.assistants ? ` · Assistants ${coaches.assistants}` : ''}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCompare && <CompareButton onClick={onCompare} />}
          <ScopeBar scope={scope} seasons={data.seasons} entity="team" onChange={onScope} />
        </div>
      </div>
      {cards.length > 0 && (
        <div
          ref={strip}
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="list"
          aria-label="Results"
        >
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              role="listitem"
              title="Open this game"
              onClick={() => onOpenGame(c.key)}
              className="flex min-w-[76px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[7px] bg-panel px-1 pt-[7px] pb-1.5 shadow-[0_0_0_1px_var(--line)] hover:bg-hover"
            >
              <span className="font-mono text-[10.5px] leading-none text-fg-3">{c.date}</span>
              <span className="font-mono text-[12px] leading-none font-semibold whitespace-nowrap">
                {c.opponent}
              </span>
              {c.score ? (
                <span
                  className={cn(
                    'rounded-[4px] px-[5px] py-0.5 font-mono text-[10.5px] leading-none font-semibold whitespace-nowrap',
                    c.result === 'W' && 'bg-good-s text-good',
                    c.result === 'L' && 'bg-bad-s text-bad'
                  )}
                >
                  {c.score.replace(/ \d?OT$/, '')}
                </span>
              ) : (
                <span className="font-mono text-[10.5px] leading-none text-fg-3">Next</span>
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}

function ShareBar({ bar, text }: { bar: number; text: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-line-2">
        <span
          className="block h-full rounded-[3px] bg-cobalt"
          style={{ width: `${Math.max(2, Math.min(100, bar * 100))}%` }}
        />
      </span>
      <span className="w-11 text-right font-semibold">{text}</span>
    </span>
  )
}

/** Who scores, the ratings, the next game, the margin by game, and the franchise by season. */
function Overview({
  data,
  scope,
  onScope,
  team,
  name,
  games,
  mode,
  onOpenPlayer,
  onOpenGame,
  anyPlayed
}: TabProps & { anyPlayed: boolean }): React.JSX.Element {
  const rq = useMemo(
    () => (anyPlayed ? teamPoolQuery(RATINGS_SECTION.metrics, scope, mode) : null),
    [anyPlayed, scope, mode]
  )
  const ratings = useStatsQuery(rq, data.version, FRESH)
  const sq = useMemo(() => (anyPlayed ? scorersQuery(team, scope) : null), [anyPlayed, team, scope])
  const scorers = useStatsQuery(sq, data.version, FRESH)
  const through = data.status?.through?.date ?? null
  const next = nextGame(games, through)
  const inScope = gamesInScope(games, scope)
  const view = ratings.result
    ? sectionViews([RATINGS_SECTION], ratings.result, team, data.byId, mode, null)[0]
    : null
  const rows = scorerRows(scorers.result, data.byId)
  return (
    <div className="flex flex-col gap-7">
      {anyPlayed && (
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start gap-9">
          <section className="flex flex-col gap-2.5">
            <SectionHead title="Who scores" note="Per game · share of the team’s points" />
            {scorers.result ? (
              <MiniTable
                label="Who scores"
                columns="minmax(0,1fr) 32px 44px 150px 44px 44px"
                head={['Player', 'G', 'PTS', 'Share', 'REB', 'AST']}
                rows={rows.map((r) => ({
                  key: r.id,
                  title: `Open ${r.name}’s dashboard`,
                  onOpen: () => onOpenPlayer(r.id),
                  cells: [
                    <span key="n" className="font-sans text-[13px] font-medium">
                      {r.name}
                    </span>,
                    <span key="g" className="text-fg-2">
                      {r.games}
                    </span>,
                    r.points,
                    <ShareBar key="s" bar={r.bar} text={r.shareText} />,
                    r.rebounds,
                    r.assists
                  ]
                }))}
              />
            ) : (
              <Loading error={scorers.error} />
            )}
          </section>
          <div className="flex flex-col gap-7">
            {next && (
              <button
                type="button"
                title="Open this game"
                onClick={() => onOpenGame(next.id)}
                className="flex cursor-pointer items-baseline justify-between gap-3 rounded-[10px] bg-panel p-4 text-left shadow-[0_0_0_1px_var(--line)] hover:bg-hover"
              >
                <span className="text-[15px] leading-none font-semibold">
                  Next: {next.home ? 'vs' : '@'} {next.opponent.code}
                </span>
                <span className="text-[12px] leading-none text-fg-3">
                  {shortDay(next.date)} · {next.home ? 'Home' : 'Away'}
                </span>
              </button>
            )}
            {view ? <StatSection section={view} /> : <Loading error={ratings.error} />}
            <section className="flex flex-col gap-2.5">
              <SectionHead title="Margin by game" note={rangeLabel(scope, 'team')} />
              <GameChart
                series={marginSeries(inScope)}
                format={(x) => fmtStat(x, { unit: 'count', decimals: 0 })}
                label={`${name} margin by game`}
              />
            </section>
          </div>
        </div>
      )}
      <History data={data} scope={scope} onScope={onScope} team={team} />
    </div>
  )
}

/** One NBA id across its moves: the row reads each season's own name, so a relocation shows. */
function History({
  data,
  scope,
  onScope,
  team
}: Pick<TabProps, 'data' | 'scope' | 'onScope' | 'team'>): React.JSX.Element {
  const seasons = useMemo(() => data.seasons.map((s) => s.season), [data.seasons])
  const q = useMemo(
    () => (seasons.length ? historyQuery(team, seasons, scope) : null),
    [team, seasons, scope]
  )
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  if (!result) return <Loading error={error} />
  const head = HISTORY_METRICS.map((id) => data.byId.get(id)?.short ?? id)
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead
        title="Season by season"
        note={`${typeLabel(scope.seasonType)} · one franchise, under each season’s name · a row opens that season`}
      />
      <MiniTable
        label="Season by season"
        columns={`64px 44px minmax(170px,1.6fr) ${head.map(() => 'minmax(48px,1fr)').join(' ')}`}
        head={['Season', 'Team', 'Name', ...head]}
        left={[1, 2]}
        rows={historyRows(result, data.byId).map((r) => ({
          key: String(r.season),
          title: `Open ${r.label}`,
          onOpen: () => onScope(moveToSeason(scope, r.season, data.seasons)),
          cells: [
            <span key="s" className="font-sans text-[13px] font-medium">
              {r.label}
            </span>,
            <span key="c" className="font-semibold">
              {r.code ?? ''}
            </span>,
            <span key="n" className="font-sans text-[12.5px] text-fg-2">
              {r.name}
            </span>,
            ...r.cells
          ]
        }))}
      />
    </section>
  )
}

/** Offense or Defense: its sections, ranked among the teams. */
function LinesTab({
  data,
  scope,
  team,
  mode,
  tab
}: TabProps & { tab: 'offense' | 'defense' }): React.JSX.Element {
  const sections = TEAM_SECTIONS[tab]
  const q = useMemo(
    () => teamPoolQuery(sectionMetrics(sections), scope, mode),
    [sections, scope, mode]
  )
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  if (!result) return <Loading error={error} />
  return (
    <div className="flex flex-col gap-5">
      <StatSections sections={sectionViews(sections, result, team, data.byId, mode, null)} />
      <Notes
        notes={[`Percentiles and ranks among the ${result.rows.length} teams.`, ...result.notes]}
      />
    </div>
  )
}

/** Everyone who played for the team in scope: a traded player's games here, not their season. */
function Players({ data, scope, team, mode, onOpenPlayer }: TabProps): React.JSX.Element {
  const q = useMemo(() => rosterQuery(team, scope, mode), [team, scope, mode])
  const { result, error } = useStatsQuery(q, data.version, FRESH)
  const ids = useMemo(() => (result?.rows ?? []).map((r) => r.id), [result])
  // The latest report is about now, so only the newest season carries it.
  const current = scope.season === data.seasons[0]?.season
  const { value: listed } = useAvailability(current ? ids : [], data.version)
  const tags = tagsById(listed)
  if (!result) return <Loading error={error} />
  const head = ROSTER_METRICS.map((id) => data.byId.get(id)?.short ?? id)
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title="Players" note="Their games for this team, most minutes first" />
      <div className="overflow-x-auto">
        <MiniTable
          label="Players"
          columns={`minmax(170px,1.6fr) 28px 32px ${head.map(() => 'minmax(48px,1fr)').join(' ')}`}
          minWidth={1020}
          head={['Player', 'Pos', 'G', ...head]}
          left={[1]}
          rows={rosterRows(result, data.byId, mode).map((r) => ({
            key: r.id,
            title: `Open ${r.name}’s dashboard`,
            onOpen: () => onOpenPlayer(r.id),
            cells: [
              <span key="n" className="flex items-center gap-2 font-sans text-[13px] font-medium">
                {r.name}
                {tags.get(r.id) && tags.get(r.id)?.status !== 'Available' && (
                  <StatusChip tag={tags.get(r.id)!} compact />
                )}
              </span>,
              <span key="p" className="font-semibold text-fg-2">
                {r.position ?? ''}
              </span>,
              <span key="g" className="text-fg-2">
                {r.games}
              </span>,
              ...r.cells
            ]
          }))}
        />
      </div>
      <Notes notes={result.notes} />
    </section>
  )
}

/** Every game in the scope's season type, with its result and the record after it. */
function Schedule({ data, scope, games, onOpenGame }: TabProps): React.JSX.Element {
  const rows = scheduleRows(gamesInScope(games, scope), data.status?.through?.date ?? null)
  const inScope = gamesInScope(games, scope)
  return (
    <section className="flex max-w-[640px] flex-col gap-2.5">
      <SectionHead
        title="Schedule"
        note={`${inScope.filter((g) => g.played).length} of ${inScope.length} played · ${typeLabel(scope.seasonType)}`}
      />
      <MiniTable
        label="Schedule"
        columns="60px minmax(70px,1fr) 80px 116px 60px"
        head={['Date', 'Opponent', 'Type', 'Result', 'Record']}
        left={[1, 2, 3]}
        rows={rows.map((r) => ({
          key: r.key,
          title: 'Open this game',
          onOpen: () => onOpenGame(r.key),
          cells: [
            <span key="d" className="text-fg-3">
              {r.date}
            </span>,
            <span key="o" className="font-semibold whitespace-nowrap">
              {r.opponent}
            </span>,
            <span key="t" className="text-fg-3">
              {r.type ?? ''}
            </span>,
            r.status ? (
              <span key="s" className="text-[11.5px] text-warn">
                {r.status}
              </span>
            ) : (
              <ResultChip key="s" result={r.result} score={r.score} />
            ),
            <span key="r" className="text-fg-2">
              {r.record}
            </span>
          ]
        }))}
      />
    </section>
  )
}
