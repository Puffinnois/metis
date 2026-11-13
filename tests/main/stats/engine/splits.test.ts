import { describe, expect, it } from 'vitest'
import {
  compileQuery,
  NOT_FROM_PLAYS,
  SPLITS_FROM,
  StatsQueryError
} from '@main/stats/engine/compile'
import type { StatsQuery } from '@shared/stats/types'

const CTX = { currentSeason: 2027 }
const compile = (
  q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }
): ReturnType<typeof compileQuery> =>
  compileQuery({ entity: 'player', metrics: ['pts'], ...q } as StatsQuery, CTX)

describe('the engine under a split', () => {
  it('refuses a split it does not know', () => {
    expect(() => compile({ scope: { seasons: [2026], split: 'halftime' } })).toThrow(
      StatsQueryError
    )
    expect(() => compile({ scope: { seasons: [2026], split: 'halftime' } })).toThrow(
      /unknown split "halftime"/
    )
  })

  it('reads the split rows joined to the game lines, so every game filter still holds', () => {
    const c = compile({
      scope: { seasons: [2026], split: 'clutch', dates: ['2026-01-01', '2026-01-31'], home: true }
    })
    expect(c.grain).toBe('game')
    expect(c.sql).toContain('JOIN split_player sp ON sp.player_id = w.player_id')
    expect(c.sql).toContain('LEFT JOIN split_team st')
    expect(c.sql).toContain('w.game_date BETWEEN')
    expect(c.params).toContain('clutch')
    // The qualifying sample scales to the split's share of the team's time.
    expect(c.gamesSql).toContain('sum(st.seconds) / nullif(sum(w.seconds), 0)')
  })

  it('takes the last games first, then the split within them', () => {
    const c = compile({ scope: { seasons: [2026], split: 'q4', lastN: 10 } })
    expect(c.sql).toContain('recent AS (')
    expect(c.sql).toContain('JOIN recent r ON r.id = w.player_id')
  })

  it('answers a team from its split rows, with the opponent beside it', () => {
    const c = compileQuery(
      {
        entity: 'team',
        metrics: ['team_ortg', 'team_drtg'],
        scope: { seasons: [2026], split: 'ahead' }
      },
      CTX
    )
    expect(c.gaps).toEqual([null, null])
    expect(c.sql).toContain('JOIN split_team st ON st.team_id = w.team_id')
    expect(c.notes).toContain(
      'Under a split, possessions are counted from the plays (derived), not estimated.'
    )
  })

  it('leaves what the plays cannot rebuild blank, with the reason', () => {
    const c = compile({
      metrics: ['pts', 'plus_minus', 'drives', 'nba_usg_pct'],
      scope: { seasons: [2026], split: 'clutch' }
    })
    expect(c.gaps).toEqual([null, NOT_FROM_PLAYS, NOT_FROM_PLAYS, NOT_FROM_PLAYS])
    expect(c.notes.some((n) => n.includes('whole seasons only'))).toBe(false)
    expect(c.notes[0]).toMatch(/^Clutch: The NBA's rule/)
  })

  it('reads a season before the play by play with its reason, and says when one is left out', () => {
    expect(compile({ scope: { seasons: [1996], split: 'clutch' } }).gaps).toEqual([SPLITS_FROM])
    const both = compile({ scope: { seasons: [1996, 1997], split: 'clutch' } })
    expect(both.gaps).toEqual([null])
    expect(both.notes).toContain(`${SPLITS_FROM} Earlier seasons are left out.`)
  })

  it('a rate under a split divides by the split’s own minutes and possessions', () => {
    const c = compile({
      metrics: ['pts', 'stl_pct'],
      scope: { seasons: [2026], split: 'q1' },
      transform: 'per100'
    })
    expect(c.gaps).toEqual([null, null])
    expect(c.sql).toContain('0.5 * (st.poss + st.opp_poss)')
  })
})
