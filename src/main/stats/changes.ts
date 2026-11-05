/**
 * Tells the window the stats changed, at most once per `intervalMs`: a first load finishes thousands
 * of steps, and the last change must still arrive.
 */
export function createChangeNotifier(notify: () => void, intervalMs = 1_000): () => void {
  let last = -Infinity
  let timer: NodeJS.Timeout | null = null
  return () => {
    if (timer) return
    const wait = last + intervalMs - Date.now()
    if (wait <= 0) {
      last = Date.now()
      notify()
      return
    }
    timer = setTimeout(() => {
      timer = null
      last = Date.now()
      notify()
    }, wait)
  }
}
