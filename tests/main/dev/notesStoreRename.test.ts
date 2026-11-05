import { mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotesStore } from '@main/dev/notesStore'
import type { NewNote } from '@shared/devNotes'

// Windows: renaming over notes.md fails while another program holds it (antivirus, an editor).
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return { ...fs, renameSync: vi.fn(fs.renameSync) }
})

const EXTRA = {
  app: { version: '0.31.0', build: 'dev' as const, platform: 'win32' },
  time: '2026-10-22T14:03:11+02:00'
}

function note(text: string): NewNote {
  return {
    text,
    tag: 'idea',
    where: {
      screen: 'home',
      parts: {},
      env: { width: 1280, height: 800, devicePixelRatio: 1, theme: 'light' }
    },
    errors: [],
    images: []
  }
}

function busy(code: string): Error {
  return Object.assign(new Error(`${code}: resource busy or locked`), { code })
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ffc-notes-rename-'))
})
afterEach(() => {
  vi.mocked(renameSync).mockReset()
  rmSync(dir, { recursive: true, force: true })
})

describe('writing notes.md while it is held (final review)', () => {
  it('retries a busy rename and saves', () => {
    const real = vi.mocked(renameSync).getMockImplementation()
    vi.mocked(renameSync)
      .mockImplementationOnce(() => {
        throw busy('EBUSY')
      })
      .mockImplementationOnce(() => {
        throw busy('EPERM')
      })
      .mockImplementation(real!)
    const store = createNotesStore(() => dir)
    expect(store.save(note('Held twice'), EXTRA).id).toBe('N-001')
    expect(store.list().map((n) => n.title)).toEqual(['Held twice'])
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('gives up after a few tries and leaves no temp file behind', () => {
    vi.mocked(renameSync).mockImplementation(() => {
      throw busy('EPERM')
    })
    const store = createNotesStore(() => dir)
    expect(() => store.save(note('Never written'), EXTRA)).toThrow('EPERM')
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })
})
