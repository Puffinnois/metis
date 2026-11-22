import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** The nearest ancestor that scrolls vertically, or null. */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

/**
 * Scrolls an element's own box just enough to show it whole, and moves nothing else: the keys' step to
 * a row below the fold. `scrollIntoView` could move the window's hidden-overflow ancestors too.
 */
export function scrollToNearest(el: HTMLElement): void {
  const box = scrollParent(el)
  if (!box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (r.top < b.top) box.scrollTop -= b.top - r.top
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom
}

/**
 * Brings an element to the top of its own scroll box, as far as that box can scroll, and moves nothing
 * else. `scrollIntoView` would also scroll the window's hidden-overflow ancestors when the box cannot go
 * far enough (an element near its end), shifting the whole app up under the nav.
 */
export function scrollToTop(el: HTMLElement, gap = 16, smooth = true): void {
  const box = scrollParent(el)
  if (!box) return
  const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - gap
  box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}
