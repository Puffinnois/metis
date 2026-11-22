import { describe, expect, it } from 'vitest'
import type { StatsClient } from '@main/stats/client'
import { createWorkerPool } from '@main/stats/workerPool'
import type { LeagueId } from '@shared/leagues'

/**
 * The leagues' workers opened on demand and closed when idle (D22's addition of 2026-11-22): what keeps
 * one open, when it closes, and that a league never has two workers at once (rule 3).
 */

/** Timers run by hand: `tick()` fires every timer due. */
function clock(): {
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (t: unknown) => void
  tick: (ms: number) => Promise<void>
} {
  let now = 0
  let next = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    setTimer: (fn, ms) => {
      const id = next++
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimer: (t) => void timers.delete(t as number),
    tick: async (ms) => {
      now += ms
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id)
          t.fn()
        }
      }
      // Let the closes the timers began run to their end.
      for (let i = 0; i < 10; i++) await Promise.resolve()
      await new Promise((r) => setTimeout(r, 0))
    }
  }
}

function setup(opts: { closeDelay?: Promise<void> } = {}): {
  pool: ReturnType<typeof createWorkerPool>
  calls: string[]
  tick: (ms: number) => Promise<void>
  most: () => number
} {
  const calls: string[] = []
  const alive = new Map<LeagueId, number>()
  let most = 0
  const c = clock()
  const pool = createWorkerPool({
    idleMs: 60_000,
    canOpen: (league) => league !== 'ncaaw',
    start: (league) => {
      calls.push(`start ${league}`)
      alive.set(league, (alive.get(league) ?? 0) + 1)
      most = Math.max(most, alive.get(league)!)
      return {
        status: async () => ({ available: true, builtAt: `${league} built` }),
        query: async () => `${league} rows`,
        close: async () => {
          calls.push(`close ${league}`)
          await opts.closeDelay
          alive.set(league, alive.get(league)! - 1)
        }
      } as unknown as StatsClient
    },
    setTimer: c.setTimer,
    clearTimer: c.clearTimer,
    log: () => {}
  })
  return { pool, calls, tick: c.tick, most: () => most }
}

describe('the workers, opened on demand and closed when idle', () => {
  it('opens a league for a read and closes it after the idle delay when it is not on screen', async () => {
    const { pool, calls, tick } = setup()
    expect(await pool.use('wnba', async (w) => (w as unknown as { query(): string }).query())).toBe(
      'wnba rows'
    )
    expect(calls).toEqual(['start wnba'])
    await tick(59_000)
    expect(pool.running('wnba')).not.toBeNull()
    await tick(1_000)
    expect(calls).toEqual(['start wnba', 'close wnba'])
    expect(pool.running('wnba')).toBeNull()
    // Its status, read as it closed, answers while it is closed.
    expect(pool.cachedStatus('wnba')).toMatchObject({ builtAt: 'wnba built' })
    // The next read opens it again, and the cached status is dropped.
    await pool.acquire('wnba')
    expect(calls.at(-1)).toBe('start wnba')
    expect(pool.cachedStatus('wnba')).toBeNull()
  })

  it('keeps the league on screen open, and closes the one left once idle', async () => {
    const { pool, calls, tick } = setup()
    pool.setOnScreen('nba')
    await pool.acquire('nba')
    await tick(120_000)
    expect(pool.running('nba')).not.toBeNull()
    pool.setOnScreen('ncaam')
    await pool.acquire('ncaam')
    await tick(60_000)
    expect(calls).toEqual(['start nba', 'start ncaam', 'close nba'])
    expect(pool.running('ncaam')).not.toBeNull()
  })

  it('closes the league on screen too once idle after a refresh that wrote rows, but not after one that wrote none', async () => {
    const { pool, calls, tick } = setup()
    pool.setOnScreen('nba')
    await pool.acquire('nba')
    pool.refreshed('nba', false)
    await tick(60_000)
    expect(pool.running('nba')).not.toBeNull()
    pool.refreshed('nba', true)
    await tick(60_000)
    expect(calls).toEqual(['start nba', 'close nba'])
    // Opened again for the screen, it stays open until its next refresh with rows.
    await pool.acquire('nba')
    await tick(120_000)
    expect(pool.running('nba')).not.toBeNull()
  })

  it('keeps a worker open while something holds it, and starts the delay when the last lets go', async () => {
    const { pool, calls, tick } = setup()
    const first = pool.hold('wnba')
    const second = pool.hold('wnba')
    await pool.acquire('wnba')
    await tick(120_000)
    first()
    await tick(120_000)
    expect(pool.running('wnba')).not.toBeNull()
    second()
    await tick(59_000)
    expect(pool.running('wnba')).not.toBeNull()
    await tick(1_000)
    expect(calls).toEqual(['start wnba', 'close wnba'])
  })

  it('never opens a second worker for a league while its last is closing', async () => {
    let finish: () => void = () => {}
    const closeDelay = new Promise<void>((r) => (finish = r))
    const { pool, calls, tick, most } = setup({ closeDelay })
    await pool.acquire('wnba')
    await tick(60_000)
    expect(calls).toEqual(['start wnba', 'close wnba'])
    // A read arrives while the close is still running: it waits for it, then opens a new worker.
    const reading = pool.use('wnba', async () => 'answered')
    await tick(0)
    expect(calls).toEqual(['start wnba', 'close wnba'])
    finish()
    expect(await reading).toBe('answered')
    expect(calls).toEqual(['start wnba', 'close wnba', 'start wnba'])
    expect(most()).toBe(1)
  })

  it('opens nothing for a league with no file, closes at once on stop, and nothing after closing all', async () => {
    const { pool, calls } = setup()
    expect(await pool.acquire('ncaaw')).toBeNull()
    await pool.acquire('nba')
    await pool.stop('nba')
    expect(calls).toEqual(['start nba', 'close nba'])
    await pool.acquire('wnba')
    await pool.closeAll()
    expect(calls).toEqual(['start nba', 'close nba', 'start wnba', 'close wnba'])
    expect(await pool.acquire('nba')).toBeNull()
  })
})
