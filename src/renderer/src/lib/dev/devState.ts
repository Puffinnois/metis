import { createContext, useContext } from 'react'

/** The notes panel's two views. */
export type PanelView = 'note' | 'list'

export interface DevState {
  on: boolean
  setOn(on: boolean): void
  openNotes(view: PanelView): void
  openFolder(): void
}

export const DevContext = createContext<DevState | null>(null)

/** Dev mode and its tools, for the navs' DEV chip; null outside `DevTools`. */
export function useDev(): DevState | null {
  return useContext(DevContext)
}
