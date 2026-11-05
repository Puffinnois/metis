// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { CAPTURE_ATTR, captureWindow, cropRect, rectBetween } from '@/lib/dev/capture'

describe('capturing the window', () => {
  it('hides the dev overlays while main captures, and shows them again', async () => {
    const root = document.documentElement
    let during: string | null = null
    const shot = await captureWindow(async () => {
      during = root.getAttribute(CAPTURE_ATTR)
      return 'data:image/png;base64,AAAA'
    })
    expect(shot).toBe('data:image/png;base64,AAAA')
    expect(during).toBe('1')
    expect(root.hasAttribute(CAPTURE_ATTR)).toBe(false)
  })

  it('shows them again when the capture fails', async () => {
    await expect(
      captureWindow(() => Promise.reject(new Error('No window to capture')))
    ).rejects.toThrow('No window to capture')
    expect(document.documentElement.hasAttribute(CAPTURE_ATTR)).toBe(false)
  })
})

describe('the snip rectangle', () => {
  it('spans two points whichever way it was dragged', () => {
    expect(rectBetween({ x: 300, y: 40 }, { x: 100, y: 240 })).toEqual({
      x: 100,
      y: 40,
      width: 200,
      height: 200
    })
  })

  it('scales to the capture’s pixels, rounding outward', () => {
    const image = { width: 3200, height: 2000 }
    const sel = { x: 10.5, y: 20, width: 100, height: 50.2 }
    expect(cropRect(sel, 1, image)).toEqual({ x: 10, y: 20, width: 101, height: 51 })
    expect(cropRect(sel, 1.25, image)).toEqual({ x: 13, y: 25, width: 126, height: 63 })
    expect(cropRect(sel, 2, image)).toEqual({ x: 21, y: 40, width: 200, height: 101 })
  })

  it('stays inside the image and ignores a selection under 8 × 8', () => {
    expect(
      cropRect({ x: 1200, y: 700, width: 200, height: 200 }, 2, { width: 2560, height: 1600 })
    ).toEqual({ x: 2400, y: 1400, width: 160, height: 200 })
    expect(
      cropRect({ x: 0, y: 0, width: 7, height: 100 }, 2, { width: 100, height: 100 })
    ).toBeNull()
  })
})
