import DOMPurify from 'dompurify'

/** What a GitHub release body needs; anything else (scripts, images, styles, handlers) is dropped. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote'
]
const ALLOWED_ATTR = ['href']

// Links open a new window, which the main process's setWindowOpenHandler sends to the browser.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer')
  }
})

/** Sanitized HTML for the update dialog, or null when there is nothing worth showing. */
export function renderNotes(html: string | null): string | null {
  if (html === null) return null
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  return clean.trim() === '' ? null : clean
}
