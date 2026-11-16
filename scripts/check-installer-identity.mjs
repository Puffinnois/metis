#!/usr/bin/env node
// Checks that a test build of the Windows installer shares nothing with the real one, before
// anyone runs it. On 2026-11-16 the first update test builds changed appId, productName and the
// package name but kept win.executableName, from which electron-builder takes the install folder,
// the executable and the uninstaller. They installed into the real Metis's folder and replaced it.
//
//   node scripts/check-installer-identity.mjs \
//     --real-log real.log --test-log test.log           # electron-builder output, DEBUG=electron-builder
//     [--real-listing real.txt --test-listing test.txt] # `7z l` of the installer, then of its app-64.7z
//     [--real-asar real.asar --test-asar test.asar]     # win-unpacked/resources/app.asar
//
// Prints each build's identity and exits 1 when any value is missing or equal in both.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** The makensis defines that decide a path, a registry key, a process name or a shortcut. */
export const IDENTITY_DEFINES = [
  'APP_ID',
  'APP_GUID',
  'UNINSTALL_APP_KEY',
  'PRODUCT_NAME',
  'PRODUCT_FILENAME',
  'APP_FILENAME',
  'APP_PACKAGE_NAME',
  'APP_INSTALLER_STORE_FILE',
  'SHORTCUT_NAME',
  'UNINSTALL_DISPLAY_NAME'
]

/**
 * The `-DNAME=value` arguments of the last makensis command in an electron-builder debug log.
 * Values can hold spaces ("Metis Update Test"), so each runs up to the next ` -` and a letter.
 */
export function readDefines(log) {
  const lines = log.split(/\r?\n/).filter((l) => /makensis(\.exe)?\s/.test(l) && l.includes(' -D'))
  if (lines.length === 0) return {}
  // The installer's own command comes after the uninstaller's, which adds BUILD_UNINSTALLER.
  const line = lines.filter((l) => !l.includes('-DBUILD_UNINSTALLER')).pop() ?? lines.pop()
  const defines = {}
  for (const part of line.split(/ (?=-[A-Za-z])/)) {
    const m = part.match(/^-D([A-Z_0-9]+)(?:=(.*))?$/)
    if (m) defines[m[1]] = (m[2] ?? '').trim()
  }
  return defines
}

/** The uninstaller and the top-level executables named in a `7z l` listing. */
export function readListing(listing) {
  const names = listing
    .split(/\r?\n/)
    // The name is the last column, after two or more spaces; it may hold single spaces.
    .map((l) => l.match(/ {2,}((?:[^ ]| (?! ))+\.exe)\s*$/i)?.[1])
    .filter(Boolean)
  return {
    uninstaller: names.map((n) => n.match(/^\$R0\\(.+)$/)?.[1]).find(Boolean) ?? null,
    executables: names.filter((n) => !n.includes('\\')).sort()
  }
}

/** One file's content from an asar archive: an 8-byte size prefix, a JSON header, then the files. */
export function readAsarFile(buffer, path) {
  const headerSize = buffer.readUInt32LE(4)
  const jsonSize = buffer.readUInt32LE(12)
  const header = JSON.parse(buffer.toString('utf8', 16, 16 + jsonSize))
  let entry = header
  for (const part of path.split('/')) entry = entry.files?.[part]
  if (!entry || entry.offset === undefined) return null
  const start = 8 + headerSize + Number(entry.offset)
  return buffer.toString('utf8', start, start + entry.size)
}

/** What a build installs and where, as electron-builder's NSIS templates use the defines. */
export function describe(defines, listing, pkg) {
  const d = (k) => defines[k] ?? null
  return {
    ...Object.fromEntries(IDENTITY_DEFINES.map((k) => [k, d(k)])),
    installFolder: d('APP_FILENAME') && `%LOCALAPPDATA%\\Programs\\${d('APP_FILENAME')}`,
    executable: d('PRODUCT_FILENAME') && `${d('PRODUCT_FILENAME')}.exe`,
    uninstallerName: d('PRODUCT_FILENAME') && `Uninstall ${d('PRODUCT_FILENAME')}.exe`,
    installKey: d('APP_GUID') && `HKCU\\Software\\${d('APP_GUID')}`,
    uninstallKey:
      d('UNINSTALL_APP_KEY') &&
      `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${d('UNINSTALL_APP_KEY')}`,
    updaterCache:
      d('APP_INSTALLER_STORE_FILE') &&
      `%LOCALAPPDATA%\\${d('APP_INSTALLER_STORE_FILE').split('\\')[0]}`,
    ...(listing && {
      listedUninstaller: listing.uninstaller,
      listedExecutables: listing.executables.join(', ')
    }),
    ...(pkg && {
      dataFolder: `%APPDATA%\\${pkg.productName ?? pkg.name}`,
      packageName: pkg.name ?? null
    })
  }
}

/** Every identity value that is missing in either build or the same in both. */
export function clashes(real, test) {
  const found = []
  for (const key of Object.keys(real)) {
    const a = real[key]
    const b = test[key]
    if (a == null || b == null || a === '') found.push(`${key}: missing`)
    else if (String(a).toLowerCase() === String(b).toLowerCase()) found.push(`${key}: both ${a}`)
  }
  // Neither folder name may hold the other: an installer whose chosen folder lacks its APP_FILENAME
  // appends it, and takes a folder that holds it as its own (instFilesPre in electron-builder's
  // assistedInstaller.nsh), so the real installer would accept "...\MetisUpdateTest".
  const ra = String(real.APP_FILENAME ?? '').toLowerCase()
  const ta = String(test.APP_FILENAME ?? '').toLowerCase()
  if (ra && ta && ra !== ta && (ra.includes(ta) || ta.includes(ra))) {
    found.push(`APP_FILENAME: ${real.APP_FILENAME} and ${test.APP_FILENAME} contain each other`)
  }
  return found
}

function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]
  return out
}

function main() {
  const a = args(process.argv.slice(2))
  if (!a['real-log'] || !a['test-log']) {
    console.error('usage: check-installer-identity.mjs --real-log <file> --test-log <file> [...]')
    process.exit(2)
  }
  const build = (side) =>
    describe(
      readDefines(readFileSync(a[`${side}-log`], 'utf8')),
      a[`${side}-listing`] ? readListing(readFileSync(a[`${side}-listing`], 'utf8')) : null,
      a[`${side}-asar`]
        ? JSON.parse(readAsarFile(readFileSync(a[`${side}-asar`]), 'package.json') ?? '{}')
        : null
    )
  const real = build('real')
  const test = build('test')
  for (const key of Object.keys(real)) {
    console.log(`${key.padEnd(26)} real: ${real[key]}`)
    console.log(`${''.padEnd(26)} test: ${test[key]}`)
  }
  const found = clashes(real, test)
  if (found.length > 0) {
    console.error(`\nThe test build is not separate from the real one:\n  ${found.join('\n  ')}`)
    process.exit(1)
  }
  console.log('\nThe test build shares no path, key, process name or shortcut with the real one.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
