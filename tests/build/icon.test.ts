import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The icon files are drawn from build/icon.svg by scripts/make-icon.mjs. These read their headers,
// so an asset that is truncated, missing a size or at the wrong size fails here rather than in the
// installer.

const file = (path: string): Buffer => readFileSync(resolve(path))

function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  expect(png.toString('latin1', 12, 16)).toBe('IHDR')
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

describe('the app icon', () => {
  it('has an .ico holding every size Windows asks for, each entry whole', () => {
    const ico = file('build/icon.ico')
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1) // an icon, not a cursor
    const count = ico.readUInt16LE(4)
    const sizes: number[] = []
    let end = 6 + 16 * count
    for (let i = 0; i < count; i++) {
      const e = 6 + 16 * i
      const width = ico.readUInt8(e) || 256
      const height = ico.readUInt8(e + 1) || 256
      const length = ico.readUInt32LE(e + 8)
      const offset = ico.readUInt32LE(e + 12)
      expect(height).toBe(width)
      expect(ico.readUInt16LE(e + 6)).toBe(32)
      expect(offset + length).toBeLessThanOrEqual(ico.length)
      // Each entry is a 32-bit bitmap of its stated size: pixels plus a 1-bit mask.
      expect(ico.readUInt32LE(offset)).toBe(40)
      expect(ico.readInt32LE(offset + 4)).toBe(width)
      expect(ico.readInt32LE(offset + 8)).toBe(2 * width)
      expect(length).toBe(40 + width * width * 4 + Math.ceil(width / 32) * 4 * width)
      sizes.push(width)
      end = Math.max(end, offset + length)
    }
    expect(sizes).toEqual([16, 24, 32, 48, 64, 128, 256])
    expect(end).toBe(ico.length)
  })

  it('has a 512 px PNG for Linux packages and a 256 px one for the window', () => {
    expect(pngSize(file('build/icon.png'))).toEqual([512, 512])
    expect(pngSize(file('resources/icon.png'))).toEqual([256, 256])
  })
})
