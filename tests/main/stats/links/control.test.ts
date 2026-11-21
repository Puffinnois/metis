import { describe, expect, it, vi } from 'vitest'
import type { StatsClient } from '@main/stats/client'
import { createLinksControl } from '@main/stats/links/control'
import type { LinksClient } from '@main/stats/links/protocol'
import type { LeagueId } from '@shared/leagues'

/**
 * The main process's side of the links (D47): the worker starts only when there is something to do,
 * steps run one at a time, and a failed step is logged and recorded, never thrown into the refresh.
 */
function fakeLinks(calls: string[], fail?: string): LinksClient {
  const step =
    (name: string) =>
    async (...args: unknown[]): Promise<unknown> => {
      calls.push(`${name}:${JSON.stringify(args[0])}`)
      if (fail === name) throw new Error(`${name} failed`)
      await new Promise((r) => setTimeout(r, 5))
      return name === 'linkedIds' ? [1, 2] : name === 'counts' ? { id: 2 } : []
    }
  return {
    refreshPaired: step('refreshPaired') as LinksClient['refreshPaired'],
    ingestSide: step('ingestSide') as LinksClient['ingestSide'],
    ingestLines: step('ingestLines') as LinksClient['ingestLines'],
    failed: step('failed') as LinksClient['failed'],
    linkedIds: step('linkedIds') as LinksClient['linkedIds'],
    counts: step('counts') as LinksClient['counts'],
    otherCareer: step('otherCareer') as LinksClient['otherCareer'],
    pairedFamilies: step('pairedFamilies') as LinksClient['pairedFamilies'],
    read: step('read') as LinksClient['read'],
    ping: async () => undefined,
    close: async () => undefined
  }
}

function fakeLeague(league: LeagueId, calls: string[]): StatsClient {
  return {
    linkSide: async (_dir: string, tag: string) => {
      calls.push(`linkSide:${league}`)
      return {
        league,
        side: league.startsWith('ncaa') ? 'college' : 'pro',
        players: tag,
        draft: null
      }
    },
    linkLines: async () => {
      calls.push(`linkLines:${league}`)
      return { league, seasons: 's', teams: 't' }
    }
  } as unknown as StatsClient
}

describe('the links control', () => {
  it('runs the paired files, the side, then the lines of each league of the pair it has', async () => {
    const calls: string[] = []
    const start = vi.fn(() => fakeLinks(calls))
    const workers: Partial<Record<LeagueId, StatsClient>> = {
      nba: fakeLeague('nba', calls),
      ncaam: fakeLeague('ncaam', calls)
    }
    const control = createLinksControl({
      tempDir: '/tmp/links',
      start,
      client: (l) => workers[l] ?? null,
      log: () => {}
    })
    const done = await control.afterRefresh('nba')
    expect(done).toEqual({ league: 'nba', steps: [], links: { id: 2 } })
    expect(calls.map((c) => c.split(':')[0] + ':' + c.split(':')[1])).toEqual([
      'refreshPaired:"nba"',
      'linkSide:nba',
      expect.stringMatching(/^ingestSide:/),
      'linkedIds:"ncaam"',
      'linkLines:ncaam',
      expect.stringMatching(/^ingestLines:/),
      'linkedIds:"nba"',
      'linkLines:nba',
      expect.stringMatching(/^ingestLines:/),
      'counts:"nba"'
    ])
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a league with no worker, and starts nothing to list its paired files', async () => {
    const start = vi.fn(() => fakeLinks([]))
    const control = createLinksControl({
      tempDir: '/tmp/links',
      start,
      client: () => null,
      log: () => {}
    })
    expect(await control.afterRefresh('wnba')).toBeNull()
    const families = await control.pairedFamilies('ncaaw', false)
    expect(families.map((f) => [f.label, f.state, f.seasonsOf])).toEqual([
      ['WNBA player season stats (ESPN), for linked careers', 'waiting', 'wnba'],
      ['WNBA draft (WNBA), for linked careers', 'waiting', 'wnba']
    ])
    expect(start).not.toHaveBeenCalled()
  })

  it('logs and records a failed step, resolves, and tries again on the next refresh', async () => {
    const calls: string[] = []
    let fail: string | undefined = 'ingestSide'
    const control = createLinksControl({
      tempDir: '/tmp/links',
      start: () => fakeLinks(calls, fail),
      client: (l) => (l === 'wnba' ? fakeLeague('wnba', calls) : null),
      log: () => {}
    })
    expect(await control.afterRefresh('wnba')).toBeNull()
    expect(calls.some((c) => c.startsWith('failed:"wnba"'))).toBe(true)
    fail = undefined
    calls.length = 0
    // The same worker: the next step runs whole.
    await control.afterRefresh('wnba')
    expect(calls).toContain('linkSide:wnba')
  })

  it('runs the steps of two leagues one after the other, in the order asked', async () => {
    const calls: string[] = []
    const workers: Partial<Record<LeagueId, StatsClient>> = {
      wnba: fakeLeague('wnba', calls),
      ncaaw: fakeLeague('ncaaw', calls)
    }
    const control = createLinksControl({
      tempDir: '/tmp/links',
      start: () => fakeLinks(calls),
      client: (l) => workers[l] ?? null,
      log: () => {}
    })
    await Promise.all([control.afterRefresh('ncaaw'), control.afterRefresh('wnba')])
    const paired = calls.filter((c) => c.startsWith('refreshPaired') || c.startsWith('counts'))
    expect(paired).toEqual([
      'refreshPaired:"ncaaw"',
      'counts:"ncaaw"',
      'refreshPaired:"wnba"',
      'counts:"wnba"'
    ])
  })
})

describe('the paired files in the Data panel', () => {
  it('are listed last in their tier, under the league that brings them', async () => {
    const { withPairedFamilies } = await import('@main/stats/families')
    type Family = Parameters<typeof withPairedFamilies>[0][number]
    const family = (release: string, tier: 'core' | 'published' | 'events'): Family =>
      ({ release, tier }) as Family
    const own = [
      family('a', 'core'),
      family('b', 'core'),
      family('c', 'published'),
      family('d', 'events')
    ]
    expect(withPairedFamilies(own, [family('paired', 'core')]).map((f) => f.release)).toEqual([
      'a',
      'b',
      'paired',
      'c',
      'd'
    ])
    expect(withPairedFamilies([], [family('paired', 'core')]).map((f) => f.release)).toEqual([
      'paired'
    ])
  })
})
