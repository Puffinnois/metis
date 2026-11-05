import { describe, expect, it } from 'vitest'
import {
  appendNote,
  formatNotes,
  listNotes,
  localIso,
  nextNoteId,
  NOTES_HEADER,
  notesForClaude,
  noteTitle,
  parseNotes,
  removeNote,
  serializeNote,
  setNoteStatus,
  whereSummary,
  type NoteContext,
  type NoteError,
  type NoteMeta
} from '@shared/devNotes'

const CONTEXT: NoteContext = {
  screen: 'player',
  parts: {
    player: { label: 'N. Jokić', data: { players: ['203999'] } }
  },
  env: { width: 1280, height: 800, devicePixelRatio: 1.25, theme: 'dark' },
  app: { version: '0.30.0', build: 'packaged', platform: 'win32' },
  time: '2026-10-22T14:03:11+02:00'
}

const ERROR: NoteError = {
  at: '2026-10-22T12:02:58.000Z',
  origin: 'renderer',
  message: "TypeError: Cannot read properties of undefined (reading 'name')",
  stack: 'at TradeCard (TradeSuggestions.tsx:212:31)\nat renderWithHooks'
}

function meta(id: string, over: Partial<NoteMeta> = {}): NoteMeta {
  return {
    id,
    tag: 'bug',
    status: 'open',
    created: '2026-10-22T14:03:11+02:00',
    images: [],
    ...over
  }
}

function section(id: string, text: string, over: Partial<NoteMeta> = {}): string {
  return serializeNote(meta(id, over), {
    text,
    context: CONTEXT,
    errors: [],
    kinds: (over.images ?? []).map(() => 'snip')
  })
}

function fileWith(...sections: string[]): string {
  return sections.reduce((f, s) => formatNotes(appendNote(parseNotes(f), s)), '')
}

describe('a note’s section', () => {
  it('writes the heading, the meta line, where and when, the text, images and folded blocks', () => {
    const raw = serializeNote(meta('N-014', { images: ['img/N-014-1.png', 'img/N-014-2.png'] }), {
      text: 'Trade card cuts off long player names\n"Amon-Ra St. Brown" is cut.',
      context: CONTEXT,
      errors: [ERROR],
      kinds: ['snip', 'screenshot']
    })
    const lines = raw.split('\n')
    expect(lines.slice(0, 9)).toEqual([
      '## N-014 · Bug · open — Trade card cuts off long player names',
      '',
      '<!-- note {"id":"N-014","tag":"bug","status":"open","created":"2026-10-22T14:03:11+02:00","images":["img/N-014-1.png","img/N-014-2.png"]} -->',
      '',
      '**Where:** Player · N. Jokić',
      '**When:** 2026-10-22 14:03 · v0.30.0 · packaged · win32',
      '',
      'Trade card cuts off long player names',
      '"Amon-Ra St. Brown" is cut.'
    ])
    expect(raw).toContain('![Snip 1](img/N-014-1.png)\n![Screenshot 2](img/N-014-2.png)\n')
    expect(raw).toContain('<details><summary>Context</summary>\n\n```json\n{\n  "screen": "player"')
    expect(raw).toContain(
      '<details><summary>Recent errors (1)</summary>\n\n```text\n' +
        `${new Date(ERROR.at).toTimeString().slice(0, 8)} renderer TypeError: Cannot read properties of undefined (reading 'name')\n` +
        '    at TradeCard (TradeSuggestions.tsx:212:31)\n    at renderWithHooks\n```'
    )
    expect(raw.endsWith('</details>\n')).toBe(true)
  })

  it('leaves the errors block out when there are none', () => {
    expect(section('N-001', 'An idea')).not.toContain('Recent errors')
  })

  it('escapes lines of the text that would start a section or a title', () => {
    const raw = section('N-001', 'Title\n## not a section\n# nor a title\n### fine')
    expect(raw).toContain('\\## not a section\n\\# nor a title\n### fine')
    const [note] = listNotes(parseNotes(fileWith(raw)))
    expect(note.text).toBe('Title\n## not a section\n# nor a title\n### fine')
  })
})

describe('the notes file', () => {
  it('starts with the header and reads back what was written', () => {
    const content = fileWith(section('N-001', 'First\nmore'), section('N-002', 'Second'))
    expect(content.startsWith(`${NOTES_HEADER}\n## N-001`)).toBe(true)
    expect(content).toContain('</details>\n\n## N-002')
    const notes = listNotes(parseNotes(content))
    expect(notes.map((n) => [n.id, n.title, n.text, n.status, n.tag])).toEqual([
      ['N-001', 'First', 'First\nmore', 'open', 'bug'],
      ['N-002', 'Second', 'Second', 'open', 'bug']
    ])
    expect(notes[0].where).toBe('Player · N. Jokić')
    expect(notes[0].context).toEqual(CONTEXT)
  })

  it('formats an untouched file byte for byte, CRLF aside', () => {
    const content = fileWith(section('N-001', 'One'), section('N-002', 'Two'))
    expect(formatNotes(parseNotes(content))).toBe(content)
  })

  it('does not split on a ## line inside a code fence', () => {
    const raw = section('N-001', 'One').replace('```json\n', '```json\n## inside the fence\n')
    const file = parseNotes(fileWith(raw))
    expect(file.sections).toHaveLength(1)
  })

  it('keeps hand edits, foreign sections and the header when another note changes', () => {
    const content = fileWith(section('N-001', 'One'), section('N-002', 'Two'))
      // A person rewrote the header, edited the text, folded nothing, and added their own section.
      .replace('# Metis — dev notes', '# My notes\n\nRead me first.')
      .replace('\nOne\n', '\nOne, but longer\nDone in v0.31.0 (abc123)\n')
      .replace(/<details><summary>Context[\s\S]*?<\/details>\n/, '')
      .concat('\n## Ideas for later\n\nNo meta line here.\n')
    const changed = formatNotes(setNoteStatus(parseNotes(content), 'N-002', 'done'))
    const [before, after] = [content, changed].map((c) => c.split('## N-002')[0])
    expect(after).toBe(before)
    expect(changed.endsWith('\n## Ideas for later\n\nNo meta line here.\n')).toBe(true)
    const notes = listNotes(parseNotes(changed))
    expect(notes[0]).toMatchObject({
      text: 'One, but longer\nDone in v0.31.0 (abc123)',
      context: null
    })
    expect(notes[1].status).toBe('done')
    expect(changed).toContain('## N-002 · Bug · done — Two')
    expect(changed).toContain('"status":"done"')
  })

  it('takes the status and tag from the meta line, not the heading', () => {
    const content = fileWith(section('N-001', 'One')).replace(
      '"tag":"bug","status":"open"',
      '"tag":"polish","status":"done"'
    )
    expect(listNotes(parseNotes(content))[0]).toMatchObject({ tag: 'polish', status: 'done' })
  })

  it('skips a section whose meta line no longer parses, and keeps it', () => {
    const content = fileWith(section('N-001', 'One'), section('N-002', 'Two')).replace(
      '{"id":"N-001"',
      '{"id":"N-001",,'
    )
    const file = parseNotes(content)
    expect(listNotes(file).map((n) => n.id)).toEqual(['N-002'])
    expect(formatNotes(removeNote(file, 'N-002'))).toContain('{"id":"N-001",,')
  })

  it('removes a note and keeps the others', () => {
    const file = parseNotes(fileWith(section('N-001', 'One'), section('N-002', 'Two')))
    expect(listNotes(removeNote(file, 'N-001')).map((n) => n.id)).toEqual(['N-002'])
  })

  it('reads CRLF line endings', () => {
    const content = fileWith(section('N-001', 'One')).replace(/\n/g, '\r\n')
    expect(listNotes(parseNotes(content))[0].title).toBe('One')
  })
})

describe('ids, titles, times', () => {
  it('numbers a note one past the highest id, foreign headings included', () => {
    expect(nextNoteId(parseNotes(''))).toBe('N-001')
    const content = fileWith(section('N-001', 'One'), section('N-009', 'Nine')).concat(
      '\n## N-012 hand-written\n'
    )
    expect(nextNoteId(parseNotes(content))).toBe('N-013')
  })

  it('titles a note with its first line, trimmed to 80 characters', () => {
    expect(noteTitle('\n  First line  \nsecond')).toBe('First line')
    expect(noteTitle('x'.repeat(100))).toBe(`${'x'.repeat(79)}…`)
  })

  it('summarises where the note was written', () => {
    expect(
      whereSummary({
        screen: 'player',
        parts: { player: { label: "Ja'Marr Chase", data: {} }, empty: { label: '', data: {} } }
      })
    ).toBe("Player · Ja'Marr Chase")
  })

  it('writes local time with its offset', () => {
    expect(localIso(new Date(2026, 9, 22, 14, 3, 11))).toMatch(/^2026-10-22T14:03:11[+-]\d\d:\d\d$/)
  })
})

describe('copying notes for Claude', () => {
  it('gives the chosen sections, oldest first, with absolute image paths', () => {
    const file = parseNotes(
      fileWith(
        section('N-001', 'One', { images: ['img/N-001-1.png'] }),
        section('N-002', 'Two'),
        section('N-003', 'Three')
      )
    )
    const text = notesForClaude(file, ['N-003', 'N-001'], (p) => `C:\\notes\\${p}`)
    expect(text.indexOf('## N-001')).toBe(0)
    expect(text).toContain('![Snip 1](C:\\notes\\img/N-001-1.png)')
    expect(text).toContain('</details>\n\n## N-003')
    expect(text).not.toContain('N-002')
    expect(text.endsWith('</details>\n')).toBe(true)
  })
})

describe('code fences (final review C1)', () => {
  it('closes a fence the text leaves open, so the next note is still a note', () => {
    const raw = section('N-001', 'Pasted snippet:\n```ts\nconst x = 1')
    expect(raw).toContain('const x = 1\n```\n')
    const notes = listNotes(parseNotes(fileWith(raw, section('N-002', 'Second'))))
    expect(notes.map((n) => n.id)).toEqual(['N-001', 'N-002'])
    expect(notes[0].text).toBe('Pasted snippet:\n```ts\nconst x = 1\n```')
  })

  it('keeps a note with a meta line a note, after an unbalanced fence left by a hand edit', () => {
    const content = fileWith(
      section('N-001', 'One'),
      section('N-002', 'Two'),
      section('N-003', 'Three')
    ).replace('\nOne\n', '\nOne\n~~~~\n')
    const file = parseNotes(content)
    expect(listNotes(file).map((n) => n.id)).toEqual(['N-001', 'N-002', 'N-003'])
    expect(nextNoteId(file)).toBe('N-004')
    expect(formatNotes(removeNote(file, 'N-001'))).toContain('## N-003')
  })

  it('closes a fence only with the same character, at least as long', () => {
    const raw = section('N-001', 'Snippet\n````md\n```\n## inside\n```\n````')
    const file = parseNotes(fileWith(raw, section('N-002', 'Two')))
    expect(file.sections).toHaveLength(2)
    expect(listNotes(file)[0].text).toContain('## inside')
  })

  it('indents every line of a multi-line error message', () => {
    const raw = serializeNote(meta('N-001'), {
      text: 'x',
      context: CONTEXT,
      errors: [{ ...ERROR, message: 'Error: bad\n```\n## N-999 fake', stack: null }],
      kinds: []
    })
    expect(raw).toContain('Error: bad\n    ```\n    ## N-999 fake\n```')
    const file = parseNotes(fileWith(raw, section('N-002', 'Two')))
    expect(listNotes(file).map((n) => n.id)).toEqual(['N-001', 'N-002'])
  })
})
