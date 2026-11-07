import { useEffect, useState } from 'react'
import { StatsNav } from '@/components/stats/StatsNav'
import { api } from '@/lib/api'
import { useNoteScreen } from '@/lib/dev/noteContext'
import { errorMessage } from '@/lib/format'
import type { NavLocation } from '@/lib/navHistory'
import type { BoardDef } from '@/lib/stats/boards'
import { bestFirst, defaultBoard, normalizeBoard } from '@/lib/stats/leaderboard'
import { defaultPlayer, railQuery, type PlayerTab } from '@/lib/stats/player'
import { defaultScope, type StatsScope } from '@/lib/stats/scope'
import { NAV_ITEMS, type StatsScreen } from '@/lib/stats/screens'
import { useStatsData, useStatsQuery } from '@/lib/stats/useStats'
import { StatsData } from '@/screens/stats/StatsData'
import { StatsGlossary } from '@/screens/stats/StatsGlossary'
import { StatsHome } from '@/screens/stats/StatsHome'
import { StatsLeaderboard, type LeaderboardOpen } from '@/screens/stats/StatsLeaderboard'
import { StatsPlayer } from '@/screens/stats/StatsPlayer'
import type { LeaderboardBoard, StatsStatus, StatsView } from '@shared/stats/types'
import type { UpdateState } from '@shared/types'

/** A page to open: Back, or a dev note's "Go there"; a new nonce opens it again. */
export interface StatsFocus {
  location: NavLocation
  nonce: number
}

interface StatsAppProps {
  update: UpdateState
  version: string | null
  onOpenUpdate: () => void
  onToggleTheme: () => void
  focus?: StatsFocus | null
  /** Every page shown, for Back. */
  onLocation?: (location: NavLocation) => void
  canGoBack?: boolean
  onBack?: () => void
}

/** What an empty screen says: it depends on what has been loaded. */
function emptyScreenNote(status: StatsStatus | null): string {
  if (status?.builtAt) return 'This screen is not built yet.'
  if (status?.through) return 'NBA data is loaded. The tables are still being built.'
  if (status?.busy) return 'NBA data is loading.'
  return 'No stats yet: NBA data has not been loaded.'
}

/** The app's shell: the nav, the status of the stats database, and the screen. */
export function StatsApp({
  update,
  version,
  onOpenUpdate,
  onToggleTheme,
  focus = null,
  onLocation,
  canGoBack = false,
  onBack
}: StatsAppProps): React.JSX.Element {
  const data = useStatsData()
  const [screen, setScreen] = useState<StatsScreen>('home')
  const [focused, setFocused] = useState<number | null>(null)
  // The player dashboard: the player chosen this session, else the league's leading scorer.
  const [player, setPlayer] = useState<string | null>(null)
  const [playerTab, setPlayerTab] = useState<PlayerTab>('overview')
  if (focus && focus.nonce !== focused) {
    setFocused(focus.nonce)
    setScreen(focus.location.screen)
    if (focus.location.player) setPlayer(focus.location.player.id)
  }
  const [chosen, setChosen] = useState<StatsScope | null>(null)
  const scope = chosen ?? defaultScope(data.seasons, data.status)
  const [open, setOpen] = useState<LeaderboardOpen | null>(null)
  const [views, setViews] = useState<StatsView[]>([])
  const [viewsError, setViewsError] = useState<string | null>(null)

  useEffect(() => {
    if (!data.version) return
    void api.stats
      .views()
      .then(setViews)
      .catch((err) => setViewsError(errorMessage(err)))
  }, [data.version])

  // The query hook keys on the query's text, so a new object each render runs nothing again.
  const leaders = useStatsQuery(
    player === null && screen === 'player' && data.byId.size > 0
      ? railQuery('ALL', null, 'pts', scope, 'perGame', data.byId)
      : null,
    data.version
  )
  const shownPlayer = player ?? defaultPlayer(leaders.result)
  // Once on screen, the default is the player: a new season or range does not switch it.
  if (player === null && screen === 'player' && shownPlayer !== null) setPlayer(shownPlayer)
  const openPlayer = (id: string): void => {
    setPlayer(id)
    setScreen('player')
  }

  const locationPlayer = screen === 'player' ? shownPlayer : null
  useEffect(() => {
    onLocation?.({
      screen,
      team: null,
      player: locationPlayer === null ? null : { id: locationPlayer, position: null }
    })
  }, [screen, locationPlayer, onLocation])

  useNoteScreen(screen)

  const openBoard = (board: LeaderboardBoard, selected: string | null): void => {
    setOpen((o) => ({ board, selected, nonce: (o?.nonce ?? 0) + 1 }))
    setScreen(board.entity === 'player' ? 'players' : 'teams')
  }
  const openFromHome = (b: BoardDef, rowId: string | null, perGame: boolean): void => {
    if (b.entity === 'player' && rowId !== null) {
      openPlayer(rowId)
      return
    }
    const base = defaultBoard(b.entity, b.tab, data.byId)
    const columns = base.columns.includes(b.metric) ? base.columns : [b.metric, ...base.columns]
    openBoard(
      {
        ...base,
        columns,
        mode: perGame ? 'perGame' : 'raw',
        sort: { by: b.metric, dir: bestFirst(data.byId.get(b.metric)) }
      },
      rowId
    )
  }
  const openView = (v: StatsView): void => openBoard(normalizeBoard(v.board, data.byId), null)
  const saveView = async (name: string, board: LeaderboardBoard): Promise<void> => {
    const saved = await api.stats.saveView(name, board)
    setViews((vs) =>
      [...vs.filter((v) => v.id !== saved.id), saved].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      )
    )
  }
  const deleteView = async (view: StatsView): Promise<void> => {
    await api.stats.deleteView(view.id)
    setViews((vs) => vs.filter((v) => v.id !== view.id))
  }

  const unavailable = data.status !== null && !data.status.available
  const error = data.error ?? viewsError
  // The tables and their catalogue are read once they are built, so a screen waits for all of it.
  const ready = data.version !== null && data.catalogue.length > 0 && data.seasons.length > 0
  const label = NAV_ITEMS.find((i) => i.id === screen)?.label ?? 'Leaderboards'
  const empty = (
    <div className="py-20 text-center">
      <h1 className="text-[15px] font-semibold">{label}</h1>
      <p className="mt-2 text-[13px] text-fg-3">{emptyScreenNote(data.status)}</p>
    </div>
  )
  const playerBoard = screen === 'players'
  const teamBoard = screen === 'team' || screen === 'teams'
  return (
    <div className="flex h-full flex-col bg-paper text-fg">
      <StatsNav
        current={screen}
        onNavigate={setScreen}
        canGoBack={canGoBack}
        onBack={onBack}
        status={data.status}
        update={update}
        version={version}
        onOpenUpdate={onOpenUpdate}
        onToggleTheme={onToggleTheme}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        {unavailable || error ? (
          <div className="py-20 text-center text-[13px] text-bad">
            {error ?? 'The stats database could not be opened on this computer.'}
          </div>
        ) : screen === 'data' ? (
          <StatsData status={data.status} />
        ) : !ready ? (
          empty
        ) : screen === 'home' ? (
          <StatsHome
            data={data}
            scope={scope}
            onScope={setChosen}
            views={views}
            onOpenBoard={openFromHome}
            onOpenView={openView}
          />
        ) : screen === 'player' ? (
          shownPlayer !== null ? (
            <StatsPlayer
              data={data}
              scope={scope}
              onScope={setChosen}
              player={shownPlayer}
              onPlayer={setPlayer}
              tab={playerTab}
              onTab={setPlayerTab}
              onOpenTeam={() => setScreen('team')}
              onOpenGame={() => setScreen('games')}
              onOpenLeaderboard={() => setScreen('players')}
            />
          ) : (
            <div className="py-20 text-center text-[13px] text-fg-3">
              {leaders.error ?? (leaders.loading ? 'Loading…' : 'Nobody played in this range.')}
            </div>
          )
        ) : playerBoard || teamBoard ? (
          <StatsLeaderboard
            key={playerBoard ? 'player' : 'team'}
            entity={playerBoard ? 'player' : 'team'}
            data={data}
            scope={scope}
            onScope={setChosen}
            open={open}
            views={views}
            onSaveView={saveView}
            onDeleteView={deleteView}
            onOpenView={openView}
            onOpenRow={playerBoard ? openPlayer : undefined}
          />
        ) : screen === 'glossary' ? (
          <StatsGlossary catalogue={data.catalogue} />
        ) : (
          empty
        )}
      </main>
    </div>
  )
}
