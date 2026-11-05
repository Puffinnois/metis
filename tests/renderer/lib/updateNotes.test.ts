// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderNotes } from '@/lib/updateNotes'

describe('renderNotes', () => {
  it('keeps the formatting tags GitHub release bodies use', () => {
    const html =
      '<h2>Changes</h2><ul><li>Added <strong>x</strong> and <code>y</code></li></ul><p>Done</p>'
    expect(renderNotes(html)).toBe(html)
  })

  it('strips scripts, images, styles and event handlers', () => {
    const out = renderNotes(
      '<p onclick="alert(1)">Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><style>p{}</style>'
    )
    expect(out).toBe('<p>Hi</p>')
  })

  it('opens links in a new window so the main process sends them to the browser', () => {
    expect(renderNotes('<a href="https://example.com/x">x</a>')).toBe(
      '<a href="https://example.com/x" target="_blank" rel="noreferrer">x</a>'
    )
  })

  it('returns null for null or empty input', () => {
    expect(renderNotes(null)).toBeNull()
    expect(renderNotes('')).toBeNull()
    expect(renderNotes('  <script>x</script> ')).toBeNull()
  })
})
