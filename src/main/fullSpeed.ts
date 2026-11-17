/**
 * On Windows, this process asks not to have its execution speed throttled. Without it, Windows
 * may run the stats work on the efficiency cores, which happens while the window is in the
 * background. On 2026-11-16 a first load on a 6P+4E laptop ran its plays step 7.2 times slower
 * than in WSL, with the app's work mostly on the efficiency cores. A single-thread test started
 * the same way took 26 to 28 s by default and 8.4 s after this call.
 *
 * The stats worker is a worker thread, so DuckDB's threads live in this process and one
 * process-wide call covers them. It holds for the life of the process: an idle app uses
 * almost no processor time, and a refresh can start at any time, so there is nothing to
 * gain from switching it on and off.
 *
 * A failure is logged and the app runs as before, only slower.
 */
import { createRequire } from 'node:module'
import type Koffi from 'koffi'

/** `set`: the call succeeded; `skipped`: not Windows; otherwise why it failed. */
export type FullSpeedResult = 'set' | 'skipped' | `failed: ${string}`

/** The one Windows call, behind an interface so the logic is tested off Windows. */
export interface ThrottleApi {
  /** SetProcessInformation(ProcessPowerThrottling) on this process; false when Windows refuses. */
  disableExecutionSpeedThrottling(): boolean
  /** GetLastError, read straight after a refusal. */
  lastError(): number
}

export interface FullSpeedDeps {
  platform: NodeJS.Platform
  loadApi: () => Promise<ThrottleApi>
  log: (message: string) => void
  logError: (message: string, err?: unknown) => void
}

/** Returns the request: the first call does the work, every later one returns the same result. */
export function createFullSpeedRequest(deps: FullSpeedDeps): () => Promise<FullSpeedResult> {
  let result: Promise<FullSpeedResult> | null = null
  return () => {
    result ??= request(deps)
    return result
  }
}

async function request(deps: FullSpeedDeps): Promise<FullSpeedResult> {
  if (deps.platform !== 'win32') return 'skipped'
  try {
    const api = await deps.loadApi()
    if (api.disableExecutionSpeedThrottling()) {
      deps.log('full speed: set (execution speed throttling off for this process)')
      return 'set'
    }
    const reason = `Windows refused, error ${api.lastError()}`
    deps.logError(`full speed: failed, ${reason}; the app carries on`)
    return `failed: ${reason}`
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    deps.logError('full speed: failed; the app carries on', err)
    return `failed: ${reason}`
  }
}

// From Windows' processthreadsapi.h.
const PROCESS_POWER_THROTTLING = 4 // PROCESS_INFORMATION_CLASS.ProcessPowerThrottling
const PROCESS_POWER_THROTTLING_CURRENT_VERSION = 1
const PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1

/**
 * kernel32 through koffi, loaded only on Windows. ControlMask names the policy this process
 * decides for itself, and a StateMask of 0 turns the throttling off.
 */
export async function loadWindowsThrottleApi(): Promise<ThrottleApi> {
  // Required here, not imported at the top, so other platforms never load the native module;
  // through require, as DuckDB's binding is, so it loads from the packaged app's asar.
  const koffi = createRequire(__filename)('koffi') as typeof Koffi
  const kernel32 = koffi.load('kernel32.dll')
  const State = koffi.struct('PROCESS_POWER_THROTTLING_STATE', {
    Version: 'uint32',
    ControlMask: 'uint32',
    StateMask: 'uint32'
  })
  const getCurrentProcess = kernel32.func('__stdcall', 'GetCurrentProcess', 'void *', [])
  const setProcessInformation = kernel32.func('__stdcall', 'SetProcessInformation', 'int', [
    'void *',
    'int',
    koffi.pointer(State),
    'uint32'
  ])
  const getLastError = kernel32.func('__stdcall', 'GetLastError', 'uint32', [])
  return {
    disableExecutionSpeedThrottling: () =>
      setProcessInformation(
        getCurrentProcess(),
        PROCESS_POWER_THROTTLING,
        {
          Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
          ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
          StateMask: 0
        },
        koffi.sizeof(State)
      ) !== 0,
    lastError: () => getLastError() as number
  }
}
