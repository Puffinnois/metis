import { describe, expect, it } from 'vitest'
import {
  CC_BY_URL,
  CREDIT_LEAD,
  CREDIT_WHOSE,
  DATASET_URL,
  ESPN_NBA_URL,
  ESPN_NCAA_URL,
  ESPN_WNBA_URL,
  NBA_STATS_URL,
  NCAA_STATS_URL,
  RAPTOR_DATA_URL,
  WNBA_STATS_URL,
  creditText
} from '@/lib/stats/credit'
import { CATALOGUE } from '@shared/stats/catalogue'

const links = CREDIT_LEAD.filter((s) => typeof s !== 'string')

describe('the data credit', () => {
  it('credits the dataset with a link, and links the licence CC BY 4.0 asks for', () => {
    expect(links).toContainEqual({ text: 'SportsDataverse', url: DATASET_URL })
    expect(links).toContainEqual({ text: 'CC BY 4.0', url: CC_BY_URL })
  })

  it('credits NBA.com and ESPN as the sources, each with a link', () => {
    expect(links).toContainEqual({ text: 'NBA.com', url: NBA_STATS_URL })
    expect(links).toContainEqual({ text: 'ESPN', url: ESPN_NBA_URL })
    expect(NBA_STATS_URL).toBe('https://www.nba.com/stats')
    expect(ESPN_NBA_URL).toBe('https://www.espn.com/nba/')
    expect(DATASET_URL).toBe('https://github.com/sportsdataverse/sportsdataverse-data')
  })

  it('credits the WNBA’s sources as the NBA’s are, each with a link', () => {
    expect(links).toContainEqual({ text: 'WNBA.com', url: WNBA_STATS_URL })
    expect(links).toContainEqual({ text: 'ESPN', url: ESPN_WNBA_URL })
    expect(creditText()).toContain(
      'WNBA data is published by SportsDataverse under CC BY 4.0, from ESPN and WNBA.com.'
    )
  })

  it('credits NCAA Division I’s sources, and says which files carry the licence', () => {
    expect(links).toContainEqual({ text: 'ESPN', url: ESPN_NCAA_URL })
    expect(links).toContainEqual({ text: 'stats.ncaa.org', url: NCAA_STATS_URL })
    expect(creditText()).toContain(
      'NCAA Division I data is published by SportsDataverse, from ESPN, its files under CC BY 4.0, and from the NCAA’s stats.ncaa.org, whose files state no licence.'
    )
  })

  it('credits FiveThirtyEight as RAPTOR’s publisher, with the licence its data sets carry (D54)', () => {
    expect(links).toContainEqual({ text: 'FiveThirtyEight', url: RAPTOR_DATA_URL })
    expect(RAPTOR_DATA_URL).toBe('https://github.com/fivethirtyeight/data/tree/master/nba-raptor')
    expect(creditText()).toContain(
      'The NBA’s RAPTOR is published by FiveThirtyEight under CC BY 4.0.'
    )
    // Every RAPTOR metric carries the maker's name the credit points at.
    const raptor = CATALOGUE.filter((m) => m.published === 'pub_player_raptor')
    expect(raptor.length).toBeGreaterThan(0)
    for (const m of raptor) expect(m.label).toMatch(/\(FiveThirtyEight\)$/)
  })

  it('names the upstreams and says what Metis changed', () => {
    const text = creditText()
    expect(text).toContain('from ESPN and NBA.com.')
    expect(text).toContain('as ESPN, NBA.com, WNBA.com and stats.ncaa.org publish them')
    expect(text).toContain('reshapes it into its own tables and computes stats from it')
    expect(text).toContain('It shares nothing.')
  })

  it('disclaims any affiliation and leaves the names with their owners', () => {
    const text = creditText()
    expect(text).toContain(
      'Metis is not affiliated with or endorsed by the NBA, the WNBA, the NCAA, ESPN, SportsDataverse or FiveThirtyEight.'
    )
    expect(text).toContain(
      'Team, school and player names, and the NBA, WNBA, NCAA and ESPN names, belong to their owners.'
    )
  })

  it('keeps the app’s licence apart from the data’s terms', () => {
    expect(creditText()).toContain(
      'Metis is open source under the Apache License 2.0. That covers the app, not the data'
    )
  })

  it('says whose each number is', () => {
    expect(CREDIT_WHOSE.map((w) => w.label)).toEqual([
      'As published',
      'SportsDataverse’s calculations',
      'FiveThirtyEight’s calculations',
      'Computed by Metis'
    ])
  })

  it('matches how the catalogue labels whose a metric is', () => {
    // The credit says the dataset's models carry "(SportsDataverse)" and Metis's own say so in
    // their description; the catalogue has to agree, or the credit points at nothing.
    const sdv = CATALOGUE.filter((m) => m.label.endsWith('(SportsDataverse)'))
    expect(sdv.length).toBeGreaterThan(0)
    const metis = new Set(
      CATALOGUE.filter((m) => m.description.includes('Computed by Metis')).map((m) => m.id)
    )
    for (const id of ['per', 'ows', 'vorp']) expect(metis.has(id)).toBe(true)
  })

  it('names only impact models the dataset still publishes', () => {
    // DARKO left the dataset; a model named in the credit must have a metric that still reads.
    const reading = CATALOGUE.filter(
      (m) => m.label.endsWith('(SportsDataverse)') && !m.unavailable
    ).map((m) => m.label)
    const named = CREDIT_WHOSE[1].text.match(/\(([^)]*)\)/)?.[1].split(', ') ?? []
    expect(named).toEqual(['RAPM', 'SPM', 'BPM', 'WAR'])
    const labels: Record<string, string> = { WAR: 'Wins above replacement' }
    for (const name of named) {
      expect(reading).toContain(`${labels[name] ?? name} (SportsDataverse)`)
    }
    expect(creditText()).not.toContain('DARKO')
  })
})
