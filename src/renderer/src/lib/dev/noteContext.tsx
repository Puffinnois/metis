import { createContext, useContext, useEffect } from 'react'
import type { NoteContextPart } from '@shared/devNotes'

/**
 * What the screens say is open. Screens register parts while they are mounted;
 * the notes panel reads them when it opens or ↻ is pressed. Kept outside React state: registering
 * re-renders nothing.
 */
export class NoteContextRegistry {
  private parts = new Map<string, NoteContextPart>()
  private screens: string[] = []

  setPart(key: string, part: NoteContextPart): void {
    this.parts.delete(key)
    this.parts.set(key, part)
  }

  clearPart(key: string, part: NoteContextPart): void {
    // A later registration under the same key (a remount) is not undone by the old cleanup.
    if (this.parts.get(key) === part) this.parts.delete(key)
  }

  /** The shell's own screen over the app's; the latest one wins. */
  pushScreen(screen: string): () => void {
    this.screens.push(screen)
    return () => {
      const i = this.screens.lastIndexOf(screen)
      if (i >= 0) this.screens.splice(i, 1)
    }
  }

  snapshot(fallbackScreen: string): { screen: string; parts: Record<string, NoteContextPart> } {
    return {
      screen: this.screens.at(-1) ?? fallbackScreen,
      parts: Object.fromEntries(this.parts)
    }
  }
}

export const NoteContextRegistryContext = createContext<NoteContextRegistry | null>(null)

/**
 * Registers a part while the component is mounted and the part is not null. The part is compared
 * by value, so an object built on every render does not re-register.
 */
export function useNoteContext(key: string, part: NoteContextPart | null): void {
  const registry = useContext(NoteContextRegistryContext)
  const json = part === null ? null : JSON.stringify(part)
  useEffect(() => {
    if (!registry || json === null) return
    const value = JSON.parse(json) as NoteContextPart
    registry.setPart(key, value)
    return () => registry.clearPart(key, value)
  }, [registry, key, json])
}

/** The screen the shell shows. */
export function useNoteScreen(screen: string): void {
  const registry = useContext(NoteContextRegistryContext)
  useEffect(() => registry?.pushScreen(screen), [registry, screen])
}
