import { describe, expect, it, vi, type Mock } from 'vitest'
import { createFullSpeedRequest, type FullSpeedDeps, type ThrottleApi } from '@main/fullSpeed'

function deps(over: Partial<FullSpeedDeps> & { api?: Partial<ThrottleApi> } = {}): {
  api: ThrottleApi
  deps: {
    platform: NodeJS.Platform
    loadApi: Mock<FullSpeedDeps['loadApi']> | FullSpeedDeps['loadApi']
    log: Mock<FullSpeedDeps['log']>
    logError: Mock<FullSpeedDeps['logError']>
  }
} {
  const api: ThrottleApi = {
    disableExecutionSpeedThrottling: vi.fn(() => true),
    lastError: vi.fn(() => 0),
    ...over.api
  }
  return {
    api,
    deps: {
      platform: over.platform ?? 'win32',
      loadApi: over.loadApi ?? vi.fn(async () => api),
      log: vi.fn<FullSpeedDeps['log']>(),
      logError: vi.fn<FullSpeedDeps['logError']>()
    }
  }
}

describe('the full-speed request', () => {
  it('does nothing off Windows', async () => {
    for (const platform of ['linux', 'darwin'] as const) {
      const { deps: d } = deps({ platform })
      expect(await createFullSpeedRequest(d)()).toBe('skipped')
      expect(d.loadApi).not.toHaveBeenCalled()
      expect(d.log).not.toHaveBeenCalled()
      expect(d.logError).not.toHaveBeenCalled()
    }
  })

  it('makes the call on Windows and logs that it succeeded', async () => {
    const { api, deps: d } = deps()
    expect(await createFullSpeedRequest(d)()).toBe('set')
    expect(api.disableExecutionSpeedThrottling).toHaveBeenCalledTimes(1)
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining('full speed: set'))
  })

  it('calls Windows once, however often it is asked', async () => {
    const { api, deps: d } = deps()
    const request = createFullSpeedRequest(d)
    const results = await Promise.all([request(), request()])
    expect(await request()).toBe('set')
    expect(results).toEqual(['set', 'set'])
    expect(d.loadApi).toHaveBeenCalledTimes(1)
    expect(api.disableExecutionSpeedThrottling).toHaveBeenCalledTimes(1)
  })

  it('reports a refusal with the Windows error and carries on', async () => {
    const { deps: d } = deps({
      api: { disableExecutionSpeedThrottling: () => false, lastError: () => 87 }
    })
    expect(await createFullSpeedRequest(d)()).toBe('failed: Windows refused, error 87')
    expect(d.logError).toHaveBeenCalledWith(expect.stringContaining('error 87'))
    expect(d.log).not.toHaveBeenCalled()
  })

  it('swallows a library that will not load', async () => {
    const { deps: d } = deps({
      loadApi: async () => {
        throw new Error('Cannot find the native Koffi module')
      }
    })
    expect(await createFullSpeedRequest(d)()).toBe('failed: Cannot find the native Koffi module')
    expect(d.logError).toHaveBeenCalledTimes(1)
  })

  it('swallows a call that throws', async () => {
    const { deps: d } = deps({
      api: {
        disableExecutionSpeedThrottling: () => {
          throw new Error('bad argument')
        }
      }
    })
    expect(await createFullSpeedRequest(d)()).toBe('failed: bad argument')
  })
})
