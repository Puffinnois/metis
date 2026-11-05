/**
 * Devevery dev overlay (`data-dev-overlay`) is hidden while the window is captured,
 * so the notes panel never appears in a screenshot or a snip.
 */
export const CAPTURE_ATTR = 'data-dev-capture'

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** Hides the overlays, waits two frames so the hidden state is painted, captures, shows them again. */
export async function captureWindow(capture: () => Promise<string>): Promise<string> {
  const root = document.documentElement
  root.setAttribute(CAPTURE_ATTR, '1')
  try {
    await nextFrame()
    await nextFrame()
    return await capture()
  } finally {
    root.removeAttribute(CAPTURE_ATTR)
  }
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Selections smaller than this, in CSS px, are ignored. */
export const MIN_SNIP = 8

/** The rectangle between two pointer positions, whichever way it was dragged. */
export function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

/**
 * A selection in CSS px as the crop in the capture's pixels: scaled by the capture's
 * pixels per CSS px (the device pixel ratio), rounded outward, kept inside the image. Null when
 * the selection is too small.
 */
export function cropRect(
  sel: Rect,
  scale: number,
  image: { width: number; height: number }
): Rect | null {
  if (sel.width < MIN_SNIP || sel.height < MIN_SNIP) return null
  const x = Math.max(0, Math.floor(sel.x * scale))
  const y = Math.max(0, Math.floor(sel.y * scale))
  const right = Math.min(image.width, Math.ceil((sel.x + sel.width) * scale))
  const bottom = Math.min(image.height, Math.ceil((sel.y + sel.height) * scale))
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

/** Crops a PNG data URL with a canvas; resolves to the crop as a PNG data URL. */
export function cropImage(dataUrl: string, crop: Rect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not crop the capture'))
        return
      }
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Could not read the capture'))
    img.src = dataUrl
  })
}
