import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The installer and the update path are set in three files that nothing else reads before a
// Windows build: electron-builder.yml, build/installer.nsh and the Release workflow. These pin
// what the installer and the updater rely on, so a change to one fails here, not on a user's machine.

const text = (path: string): string => readFileSync(resolve(path), 'utf8')
const builder = text('electron-builder.yml')
const nsh = text('build/installer.nsh')

/** The value of a top-level key's child, as written: `nsis.oneClick` → `false`. */
function setting(section: string, key: string): string | undefined {
  const block = builder.split(/\n(?=\S)/).find((b) => b.startsWith(`${section}:`))
  return block?.match(new RegExp(`^  ${key}: (.+)$`, 'm'))?.[1].trim()
}

describe('the Windows installer', () => {
  it('is an assisted NSIS installer that installs for the current user by default', () => {
    expect(setting('win', 'icon')).toBe('build/icon.ico')
    expect(setting('nsis', 'oneClick')).toBe('false')
    expect(setting('nsis', 'perMachine')).toBe('false')
  })

  it('keeps the identity existing installs update in place by', () => {
    // electron-builder derives the uninstall and install registry keys from appId, and the install
    // folder, executable and uninstaller from win.executableName. Changing either makes the next
    // version a second app beside the installed one. package.json's name sets the updater cache,
    // its productName the data folder, %APPDATA%\Metis.
    expect(builder.match(/^appId: (.+)$/m)?.[1]).toBe('com.yhabie.metis')
    expect(builder.match(/^productName: (.+)$/m)?.[1]).toBe('Metis')
    expect(setting('win', 'executableName')).toBe('Metis')
    const pkg = JSON.parse(text('package.json'))
    expect([pkg.name, pkg.productName]).toEqual(['metis', 'Metis'])
  })

  it("keeps the user's data on uninstall", () => {
    expect(setting('nsis', 'deleteAppDataOnUninstall')).toBe('false')
  })

  it('includes the welcome page with the independence statement', () => {
    expect(setting('nsis', 'include')).toBe('build/installer.nsh')
    expect(nsh).toContain('!macro customWelcomePage')
    expect(nsh).toContain(
      'It is not affiliated with or endorsed by the NBA, ESPN or SportsDataverse.'
    )
    // The app's own credit says the same.
    expect(text('src/renderer/src/lib/stats/credit.ts')).toContain(
      'not affiliated with or endorsed by the NBA, ESPN or SportsDataverse.'
    )
  })

  it("removes the updater's cache on uninstall, but not during an update", () => {
    // electron-builder names the folder after package.json's name.
    expect(JSON.parse(text('package.json')).name).toBe('metis')
    const macro = nsh.slice(nsh.indexOf('!macro customUnInstall'))
    expect(macro).toMatch(
      /\$\{ifNot\} \$\{isUpdated\}[\s\S]*RMDir \/r "\$LOCALAPPDATA\\metis-updater"/
    )
    expect(macro).not.toContain('$APPDATA\\Metis')
  })
})

describe('the update path', () => {
  it('reads releases from the GitHub repository', () => {
    expect(setting('publish', 'provider')).toBe('github')
    expect(setting('publish', 'owner')).toBe('Puffinnois')
    expect(setting('publish', 'repo')).toBe('metis')
  })

  it('has the Release workflow upload the installer, its blockmap and latest.yml to a draft', () => {
    const release = text('.github/workflows/release.yml')
    const create = release.slice(release.indexOf('gh release create'))
    expect(create).toContain('--draft')
    for (const asset of [
      'dist/Metis-Setup-*.exe',
      'dist/Metis-Setup-*.exe.blockmap',
      'dist/latest.yml'
    ]) {
      expect(create).toContain(asset)
    }
  })
})
