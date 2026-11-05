import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { UpdateState } from '@shared/types'

/** Mirrors the main process's update state: initial fetch + change events. */
export function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  useEffect(() => {
    let received = false
    // Subscribe first so nothing is missed while the initial fetch is in flight.
    const unsubscribe = api.update.onChange((next) => {
      received = true
      setState(next)
    })
    void api.update
      .state()
      .then((initial) => {
        if (!received) setState(initial)
      })
      .catch(() => undefined)
    return unsubscribe
  }, [])
  return state
}
