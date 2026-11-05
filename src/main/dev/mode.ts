import type { Db } from '@main/db/connection'
import { getSetting, setSetting } from '@main/db/repos/settings'

export const SETTING_DEV_MODE = 'dev_mode'
export const DEV_MODE_FLAG = '--dev-mode'

export interface DevMode {
  get(): boolean
  set(on: boolean): void
}

/**
 * Dev mode: stored as `dev_mode`; absent → on in an unpackaged app, off in the
 * packaged one. `--dev-mode` turns it on for this launch only, until it is switched.
 */
export function createDevMode(deps: { db: Db; packaged: boolean; argv: string[] }): DevMode {
  let forced = deps.argv.includes(DEV_MODE_FLAG)
  return {
    get: () => {
      if (forced) return true
      const stored = getSetting(deps.db, SETTING_DEV_MODE)
      return stored === null ? !deps.packaged : stored === '1'
    },
    set: (on) => {
      forced = false
      setSetting(deps.db, SETTING_DEV_MODE, on ? '1' : '0')
    }
  }
}
