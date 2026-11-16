import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// scripts/check-installer-identity.mjs fails a test build of the installer that shares anything
// with the real one. The fixtures are trimmed from electron-builder's debug output and 7-Zip
// listings of run 43936470914, with the test executable renamed as it is now; test-shared-log.txt is
// the first test builds' mistake, the real executable name kept.

const fixtures = resolve('tests/scripts/fixtures/installer-identity')
const dir = mkdtempSync(join(tmpdir(), 'metis-identity-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function run(...args: string[]): { code: number | null; out: string; err: string } {
  const r = spawnSync(process.execPath, ['scripts/check-installer-identity.mjs', ...args], {
    encoding: 'utf8'
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

/** A minimal asar archive holding one package.json, laid out as Electron reads it. */
function asar(name: string, pkg: object): string {
  const data = Buffer.from(JSON.stringify(pkg))
  const json = Buffer.from(
    JSON.stringify({ files: { 'package.json': { size: data.length, offset: '0' } } })
  )
  const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4)])
  const head = Buffer.alloc(16)
  head.writeUInt32LE(4, 0)
  head.writeUInt32LE(8 + padded.length, 4)
  head.writeUInt32LE(4 + padded.length, 8)
  head.writeUInt32LE(json.length, 12)
  const file = join(dir, name)
  writeFileSync(file, Buffer.concat([head, padded, data]))
  return file
}

const log = (name: string): string => join(fixtures, name)

describe('check-installer-identity', () => {
  it('passes a test build that shares nothing, and prints both identities', () => {
    const r = run(
      '--real-log',
      log('real-log.txt'),
      '--test-log',
      log('test-separate-log.txt'),
      '--real-listing',
      log('real-listing.txt'),
      '--test-listing',
      log('test-listing.txt'),
      '--real-asar',
      asar('real.asar', { name: 'metis', productName: 'Metis' }),
      '--test-asar',
      asar('test.asar', { name: 'metis-update-test', productName: 'Metis Update Test' })
    )
    expect(r.err).toBe('')
    expect(r.code).toBe(0)
    expect(r.out).toContain('real: %LOCALAPPDATA%\\Programs\\Metis\n')
    expect(r.out).toContain('test: %LOCALAPPDATA%\\Programs\\UpdateTestBuild\n')
    expect(r.out).toContain('test: Metis Update Test\n') // a define holding spaces
    expect(r.out).toContain('real: Uninstall Metis.exe\n')
    expect(r.out).toContain('test: Uninstall UpdateTestBuild.exe\n')
    expect(r.out).toContain('test: UpdateTestBuild.exe\n')
    expect(r.out).toContain('real: %APPDATA%\\Metis\n')
    expect(r.out).toContain('test: %APPDATA%\\Metis Update Test\n')
    expect(r.out).toContain('real: %LOCALAPPDATA%\\metis-updater\n')
  })

  it('fails the first test builds, which kept the real executable name', () => {
    const r = run('--real-log', log('real-log.txt'), '--test-log', log('test-shared-log.txt'))
    expect(r.code).toBe(1)
    expect(r.err).toContain('APP_FILENAME: both Metis')
    expect(r.err).toContain('installFolder: both %LOCALAPPDATA%\\Programs\\Metis')
    expect(r.err).toContain('uninstallerName: both Uninstall Metis.exe')
  })

  it('fails a test folder name that holds the real one', () => {
    // The real installer treats any chosen folder whose path holds "Metis" as its own.
    const close = join(dir, 'close.log')
    writeFileSync(
      close,
      readFileSync(log('test-separate-log.txt'), 'utf8').replaceAll(
        'UpdateTestBuild',
        'MetisUpdateTest'
      )
    )
    const r = run('--real-log', log('real-log.txt'), '--test-log', close)
    expect(r.code).toBe(1)
    expect(r.err).toContain('APP_FILENAME: Metis and MetisUpdateTest contain each other')
  })

  it('fails when a value is missing, such as a log without makensis', () => {
    const empty = join(dir, 'empty.log')
    writeFileSync(empty, 'no installer was built\n')
    const r = run('--real-log', log('real-log.txt'), '--test-log', empty)
    expect(r.code).toBe(1)
    expect(r.err).toContain('APP_FILENAME: missing')
  })

  it('fails when the data folders are the same', () => {
    const r = run(
      '--real-log',
      log('real-log.txt'),
      '--test-log',
      log('test-separate-log.txt'),
      '--real-asar',
      asar('a.asar', { name: 'metis', productName: 'Metis' }),
      '--test-asar',
      asar('b.asar', { name: 'metis-update-test', productName: 'Metis' })
    )
    expect(r.code).toBe(1)
    expect(r.err).toContain('dataFolder: both %APPDATA%\\Metis')
  })
})
