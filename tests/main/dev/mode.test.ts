import { describe, expect, it } from 'vitest'
import { openDatabase } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { getSetting } from '@main/db/repos/settings'
import { createDevMode, SETTING_DEV_MODE } from '@main/dev/mode'

function db(): ReturnType<typeof openDatabase> {
  const d = openDatabase(':memory:')
  migrate(d)
  return d
}

describe('dev mode', () => {
  it('is off in the packaged app and on unpackaged until it is switched', () => {
    expect(createDevMode({ db: db(), packaged: true, argv: [] }).get()).toBe(false)
    expect(createDevMode({ db: db(), packaged: false, argv: [] }).get()).toBe(true)
  })

  it('is stored, and the stored choice wins over the default', () => {
    const d = db()
    const mode = createDevMode({ db: d, packaged: true, argv: [] })
    mode.set(true)
    expect(getSetting(d, SETTING_DEV_MODE)).toBe('1')
    expect(createDevMode({ db: d, packaged: true, argv: [] }).get()).toBe(true)
    const dev = createDevMode({ db: d, packaged: false, argv: [] })
    dev.set(false)
    expect(dev.get()).toBe(false)
  })

  it('--dev-mode turns it on for this launch only, until it is switched', () => {
    const d = db()
    const mode = createDevMode({ db: d, packaged: true, argv: ['app.exe', '--dev-mode'] })
    expect(mode.get()).toBe(true)
    expect(getSetting(d, SETTING_DEV_MODE)).toBeNull()
    mode.set(false)
    expect(mode.get()).toBe(false)
    expect(createDevMode({ db: d, packaged: true, argv: [] }).get()).toBe(false)
  })
})
