import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createNotesStore, NOTES_FILE } from '@main/dev/notesStore'
import type { NewNote } from '@shared/devNotes'

// A 1×1 PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const dirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ffc-notes-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const EXTRA = {
  app: { version: '0.31.0', build: 'dev' as const, platform: 'linux' },
  time: '2026-10-22T14:03:11+02:00'
}

function note(text: string, images: NewNote['images'] = []): NewNote {
  return {
    text,
    tag: 'idea',
    where: {
      screen: 'home',
      parts: {},
      env: { width: 1280, height: 800, devicePixelRatio: 1, theme: 'light' }
    },
    errors: [],
    images
  }
}

describe('the notes folder', () => {
  it('creates the folder and the file, writes images before the note links them', () => {
    const dir = join(tempDir(), 'dev-notes')
    const store = createNotesStore(() => dir)
    const saved = store.save(
      note('First', [
        { kind: 'screenshot', dataUrl: PNG },
        { kind: 'snip', dataUrl: PNG }
      ]),
      EXTRA
    )
    expect(saved).toMatchObject({
      id: 'N-001',
      images: ['img/N-001-1.png', 'img/N-001-2.png'],
      where: 'Home'
    })
    expect(existsSync(join(dir, 'img', 'N-001-2.png'))).toBe(true)
    const content = readFileSync(join(dir, NOTES_FILE), 'utf8')
    expect(content).toContain('![Screenshot 1](img/N-001-1.png)\n![Snip 2](img/N-001-2.png)')
    expect(store.image('img/N-001-1.png')).toBe(PNG)
  })

  it('lists newest first and numbers on', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    store.save(note('First'), EXTRA)
    store.save(note('Second'), EXTRA)
    expect(store.list().map((n) => [n.id, n.title])).toEqual([
      ['N-002', 'Second'],
      ['N-001', 'First']
    ])
  })

  it('keeps a hand edit made between two saves', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    store.save(note('First'), EXTRA)
    const path = join(dir, NOTES_FILE)
    writeFileSync(path, readFileSync(path, 'utf8').replace('\nFirst\n', '\nFirst, edited\n'))
    store.save(note('Second'), EXTRA)
    expect(readFileSync(path, 'utf8')).toContain('\nFirst, edited\n')
    expect(existsSync(`${path}.${process.pid}.tmp`)).toBe(false)
  })

  it('marks done and removes a note with its images', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    store.save(note('First', [{ kind: 'snip', dataUrl: PNG }]), EXTRA)
    store.save(note('Second'), EXTRA)
    store.setStatus('N-002', 'done')
    expect(store.list()[0].status).toBe('done')
    store.remove('N-001')
    expect(store.list().map((n) => n.id)).toEqual(['N-002'])
    expect(existsSync(join(dir, 'img', 'N-001-1.png'))).toBe(false)
  })

  it('refuses an attachment that is not a PNG and writes no note', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    expect(() =>
      store.save(note('x', [{ kind: 'snip', dataUrl: 'data:text/html;base64,PGI+' }]), EXTRA)
    ).toThrow('not a PNG')
    expect(existsSync(join(dir, NOTES_FILE))).toBe(false)
  })

  it('never reads or deletes outside the folder', () => {
    const outer = tempDir()
    const dir = join(outer, 'notes')
    writeFileSync(join(outer, 'secret.png'), 'x')
    const store = createNotesStore(() => dir)
    expect(store.image('../secret.png')).toBeNull()
    expect(store.image(join(outer, 'secret.png'))).toBeNull()
  })

  it('follows a folder change', () => {
    const [a, b] = [tempDir(), tempDir()]
    let current = a
    const store = createNotesStore(() => current)
    store.save(note('In A'), EXTRA)
    current = b
    expect(store.list()).toEqual([])
    store.save(note('In B'), EXTRA)
    expect(store.list().map((n) => n.id)).toEqual(['N-001'])
  })

  it('keeps every note after one whose text opens a code fence (final review C1)', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    store.save(note('Pasted snippet:\n```ts\nconst x = 1'), EXTRA)
    store.save(note('Second note'), EXTRA)
    store.save(note('Third note'), EXTRA)
    expect(store.list().map((n) => n.id)).toEqual(['N-003', 'N-002', 'N-001'])
    store.remove('N-001')
    expect(store.list().map((n) => n.title)).toEqual(['Third note', 'Second note'])
  })

  it('deletes only its own img/*.png files, whatever a hand-edited meta line says (final review I1)', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    store.save(note('First', [{ kind: 'snip', dataUrl: PNG }]), EXTRA)
    store.save(note('Second', [{ kind: 'snip', dataUrl: PNG }]), EXTRA)
    const path = join(dir, NOTES_FILE)
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        '"images":["img/N-001-1.png"]',
        '"images":["notes.md","img/../notes.md","img","img/N-002-1.png","img/N-001-1.png"]'
      )
    )
    expect(store.image('notes.md')).toBeNull()
    expect(store.image('img/../notes.md')).toBeNull()
    store.remove('N-001')
    expect(store.list().map((n) => n.id)).toEqual(['N-002'])
    // Another note's image stays; its own goes.
    expect(existsSync(join(dir, 'img', 'N-002-1.png'))).toBe(true)
    expect(existsSync(join(dir, 'img', 'N-001-1.png'))).toBe(false)
  })

  it('refuses more than six attachments and writes nothing (final review)', () => {
    const dir = tempDir()
    const store = createNotesStore(() => dir)
    const seven = Array.from({ length: 7 }, () => ({ kind: 'snip' as const, dataUrl: PNG }))
    expect(() => store.save(note('x', seven), EXTRA)).toThrow('at most 6')
    expect(existsSync(join(dir, NOTES_FILE))).toBe(false)
    expect(existsSync(join(dir, 'img'))).toBe(false)
  })
})
