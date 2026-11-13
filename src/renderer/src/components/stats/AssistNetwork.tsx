import { useMemo, useState } from 'react'
import {
  ASSIST_LIMIT,
  assistCount,
  assistRequest,
  pctText,
  playerAssistRows,
  PLAYER_ASSIST_HEAD,
  teamAssistRows,
  TEAM_ASSIST_HEAD,
  type AssistRow
} from '@/lib/stats/assists'
import type { StatsScope } from '@/lib/stats/scope'
import { useAssists } from '@/lib/stats/useStats'
import { Loading, MiniTable, SectionHead } from './parts'

/**
 * Who assisted whom, from the play by play: a team's passers and scorers, or the players a player
 * fed and was fed by, over the dashboard's scope.
 */
export function AssistNetwork({
  entity,
  id,
  scope,
  version,
  onOpenPlayer
}: {
  entity: 'player' | 'team'
  id: string
  scope: StatsScope
  version: string | null
  onOpenPlayer: (player: string) => void
}): React.JSX.Element {
  const request = useMemo(() => assistRequest(entity, id, scope), [entity, id, scope])
  const { value, error } = useAssists(request, version)
  if (!value) return <Loading error={error} />
  if (value.reason) {
    return (
      <section className="flex flex-col gap-2.5">
        <SectionHead title="Assist network" />
        <p className="m-0 text-[12.5px] text-fg-3">{value.reason}</p>
      </section>
    )
  }
  if (entity === 'team') {
    return (
      <PairList
        title="Assist network"
        rows={teamAssistRows(value.pairs)}
        team
        empty="No assisted makes in these games."
        onOpenPlayer={onOpenPlayer}
      />
    )
  }
  const { feeds, fedBy } = playerAssistRows(value.pairs, id)
  return (
    <>
      <PairList
        title="Who they feed"
        rows={feeds}
        side="scorer"
        empty="No assists in these games."
        onOpenPlayer={onOpenPlayer}
      />
      <PairList
        title="Who feeds them"
        rows={fedBy}
        side="passer"
        empty="No assisted makes in these games."
        onOpenPlayer={onOpenPlayer}
      />
    </>
  )
}

function PairList({
  title,
  rows,
  team = false,
  side = 'scorer',
  empty,
  onOpenPlayer
}: {
  title: string
  rows: AssistRow[]
  team?: boolean
  /** For a player's lists: which end of the pair is the other player. */
  side?: 'passer' | 'scorer'
  empty: string
  onOpenPlayer: (player: string) => void
}): React.JSX.Element {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, ASSIST_LIMIT)
  const head = team ? TEAM_ASSIST_HEAD : PLAYER_ASSIST_HEAD
  const name = (who: string, label: string): React.JSX.Element => (
    <button
      type="button"
      title={`Open ${label}’s dashboard`}
      onClick={() => onOpenPlayer(who)}
      className="cursor-pointer truncate font-sans text-[13px] font-medium hover:text-cobalt"
    >
      {label}
    </button>
  )
  return (
    <section className="flex flex-col gap-2.5" aria-label={title}>
      <SectionHead title={title} note={assistCount(shown.length, rows.length)} />
      {rows.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <MiniTable
            label={title}
            columns={
              team
                ? 'minmax(150px,1.4fr) minmax(150px,1.4fr) repeat(4, minmax(52px,1fr))'
                : 'minmax(170px,1.6fr) repeat(4, minmax(52px,1fr))'
            }
            left={team ? [1] : []}
            minWidth={team ? 640 : 480}
            head={head}
            rows={shown.map((r) => ({
              key: r.key,
              cells: [
                ...(team
                  ? [name(r.passer, r.passerName), name(r.scorer, r.scorerName)]
                  : side === 'scorer'
                    ? [name(r.scorer, r.scorerName)]
                    : [name(r.passer, r.passerName)]),
                r.makes,
                r.threes,
                r.points,
                pctText(r.share)
              ]
            }))}
          />
        </div>
      )}
      {rows.length > ASSIST_LIMIT && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="cursor-pointer self-start text-[12.5px] font-medium text-fg-2 hover:text-cobalt"
        >
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  )
}
