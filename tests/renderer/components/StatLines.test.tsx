// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StatSection } from '@/components/stats/StatLines'
import type { StatLine } from '@/lib/stats/dashboard'

afterEach(cleanup)

const line = (over: Partial<StatLine>): StatLine => ({
  metric: 'bpm',
  label: 'Box Plus/Minus',
  value: '—',
  percentile: null,
  rank: null,
  missing: null,
  title: '',
  info: undefined,
  ...over
})

/** The college leagues' reason for Box Plus/Minus, as long as it reads on the page. */
const LONG =
  "Not computed for the college leagues: Metis's BPM uses coefficients fitted on the NBA's seasons, which are not refitted on college basketball. SportsDataverse's box-score BPM is shown under its own name."

describe('a stat line with no value', () => {
  it('keeps a reason of any length to one line of its row, the whole of it on hover', () => {
    render(
      <StatSection
        section={{
          title: 'Composite',
          lines: [
            line({ missing: LONG }),
            line({ metric: 'pm', label: 'Plus-minus', missing: 'x' })
          ]
        }}
      />
    )
    const reason = screen.getByText(LONG)
    expect(reason.getAttribute('title')).toBe(LONG)
    // Cut to its own row rather than wrapped over the next one.
    expect(reason.className).toContain('truncate')
    expect(reason.className).toContain('min-w-0')
  })

  it('says a value below the sample so, with nothing to hover', () => {
    render(
      <StatSection
        section={{ title: 'Shooting', lines: [line({ metric: 'fg3_pct', value: '38.5%' })] }}
      />
    )
    const below = screen.getByText('Below the qualifying sample')
    expect(below.getAttribute('title')).toBeNull()
  })
})
