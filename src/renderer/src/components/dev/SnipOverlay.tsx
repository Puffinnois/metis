import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cropImage, cropRect, MIN_SNIP, rectBetween, type Rect } from '@/lib/dev/capture'

interface SnipOverlayProps {
  /** The window captured just before: the region is picked on this frozen frame. */
  source: string
  /** The crop as a PNG data URL, or null when cancelled. */
  onDone: (crop: string | null) => void
  onError: (message: string) => void
}

/**
 * Snip: the frozen capture, dimmed; drag a rectangle, release to keep, drag
 * again to redo; Enter or Use confirms, Esc cancels.
 */
export function SnipOverlay({ source, onDone, onError }: SnipOverlayProps): React.JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [sel, setSel] = useState<Rect | null>(null)
  const [dragging, setDragging] = useState(false)
  const usable = sel !== null && sel.width >= MIN_SNIP && sel.height >= MIN_SNIP

  const confirm = useCallback(() => {
    const img = imgRef.current
    if (!img || !sel) return
    const crop = cropRect(sel, img.naturalWidth / img.clientWidth, {
      width: img.naturalWidth,
      height: img.naturalHeight
    })
    if (!crop) return
    cropImage(source, crop).then(onDone, (err: Error) => onError(err.message))
  }, [sel, source, onDone, onError])

  // A layout effect, so the keys are heard from the commit that shows the overlay: a passive effect
  // can run a task later, after the overlay is up. Capture phase: Esc must not also close a player
  // file under the overlay.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onDone(null)
      } else if (e.key === 'Enter') {
        e.stopPropagation()
        e.preventDefault()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirm, onDone])

  const point = (e: React.PointerEvent): { x: number; y: number } => ({
    x: Math.min(Math.max(0, e.clientX), window.innerWidth),
    y: Math.min(Math.max(0, e.clientY), window.innerHeight)
  })

  return (
    <div
      data-dev-overlay=""
      aria-label="Snip a region"
      className="fixed inset-0 z-[60] cursor-crosshair overflow-hidden select-none"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        const p = point(e)
        setStart(p)
        setSel({ ...p, width: 0, height: 0 })
        setDragging(true)
      }}
      onPointerMove={(e) => {
        if (dragging && start) setSel(rectBetween(start, point(e)))
      }}
      onPointerUp={() => setDragging(false)}
    >
      <img
        ref={imgRef}
        src={source}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {sel === null ? (
        <div className="absolute inset-0 bg-black/45" />
      ) : (
        <div
          className="absolute border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{ left: sel.x, top: sel.y, width: sel.width, height: sel.height }}
        >
          {usable && (
            <span className="absolute -top-6 left-0 rounded-[4px] bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">
              {Math.round(sel.width)} × {Math.round(sel.height)}
            </span>
          )}
        </div>
      )}
      <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/75 py-1.5 pr-1.5 pl-4 text-[12.5px] text-white">
        <span>Drag to select · Enter to use · Esc to cancel</span>
        <button
          type="button"
          onClick={() => onDone(null)}
          className="cursor-pointer rounded-full px-3 py-1 hover:bg-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!usable || dragging}
          onClick={confirm}
          className="cursor-pointer rounded-full bg-white px-3 py-1 font-semibold text-black disabled:cursor-default disabled:opacity-40"
        >
          Use
        </button>
      </div>
    </div>
  )
}
