import { describe, expect, it } from 'vitest'
import {
  ALL_TEAMS,
  bestMatch,
  matchTeams,
  movedTo,
  PAGE_ROWS,
  teamChoices
} from '@/lib/stats/teamSearch'

const team = (
  id: string,
  code: string,
  name: string,
  conference: string | null = null
): { id: string; code: string; name: string; conference: string | null } => ({
  id,
  code,
  name,
  conference
})

// In the season list's order, by code.
const TEAMS = [
  team('1', 'CARD', 'Montréal Cardinals'),
  team('2', 'MONT', 'Montana Grizzlies', 'Big Sky'),
  team('3', 'OKC', 'Oklahoma City Thunder', 'west'),
  team('4', 'SJSU', 'San José State Spartans', 'MWC'),
  team('5', 'SJU', "St. John's Red Storm", 'Big East'),
  team('6', 'UAPB', 'Arkansas-Pine Bluff Golden Lions', 'SWAC'),
  team('7', 'UNCA', 'UNC Asheville Bulldogs', 'Big South'),
  team('8', 'UNC', 'North Carolina Tar Heels', 'ACC'),
  team('9', 'UVM', 'Vermont Catamounts', 'Am. East')
]
const choices = teamChoices(TEAMS)
const found = (search: string): string[] => matchTeams(choices, search).map((c) => c.code)
const enter = (search: string): string =>
  matchTeams(choices, search)[bestMatch(matchTeams(choices, search), search, null)].code

describe('finding a team by typing', () => {
  it('lists every team in its order while nothing is typed, "All teams" first in a filter', () => {
    expect(found('')).toEqual(TEAMS.map((t) => t.code))
    expect(found('   ')).toEqual(TEAMS.map((t) => t.code))
    expect(matchTeams([ALL_TEAMS, ...choices], '')[0]).toBe(ALL_TEAMS)
    // It is no team, so no search finds it.
    expect(matchTeams([ALL_TEAMS, ...choices], 'all')).toEqual([])
  })

  it('ranks what starts with the search before what only holds it, each in the list’s order', () => {
    const college = teamChoices([
      team('1', 'BEL', 'Belmont Bruins'),
      team('2', 'MONT', 'Montana Grizzlies'),
      team('3', 'MTST', 'Montana State Bobcats'),
      team('4', 'UVM', 'Vermont Catamounts')
    ])
    const codes = (search: string): string[] => matchTeams(college, search).map((c) => c.code)
    expect(codes('mont')).toEqual(['MONT', 'MTST', 'BEL', 'UVM'])
    expect(codes('uvm')[0]).toBe('UVM')
    // A later word that starts so counts as a start.
    expect(codes('b')).toEqual(['BEL', 'MTST'])
    expect(codes('state')).toEqual(['MTST'])
    expect(codes('')).toEqual(['BEL', 'MONT', 'MTST', 'UVM'])
  })

  it('matches the name, the code and the city or school', () => {
    expect(found('okc')).toEqual(['OKC'])
    expect(found('oklahoma')).toEqual(['OKC'])
    expect(found('thunder')).toEqual(['OKC'])
    expect(found('unc')).toEqual(['UNCA', 'UNC'])
  })

  it('ignores accents, case and punctuation', () => {
    expect(found('mont')).toEqual(['CARD', 'MONT', 'UVM'])
    expect(found('MONTREAL')).toEqual(['CARD'])
    expect(found('montréal')).toEqual(['CARD'])
    expect(found('san jose')).toEqual(['SJSU'])
    expect(found('st johns')).toEqual(['SJU'])
    expect(found("st. john's")).toEqual(['SJU'])
    expect(found('pine bluff')).toEqual(['UAPB'])
    expect(found('arkansas pine')).toEqual(['UAPB'])
    expect(found('arkansas-pine')).toEqual(['UAPB'])
  })

  it('finds nothing for what no team holds, punctuation alone included', () => {
    expect(found('zzz')).toEqual([])
    expect(found('&')).toEqual([])
  })

  it('takes the team of that very code on Enter, else the first', () => {
    expect(enter('unc')).toBe('UNC')
    expect(enter('mont')).toBe('MONT')
    expect(enter('carolina')).toBe('UNC')
    expect(enter('cata')).toBe('UVM')
    expect(enter('ermont')).toBe('UVM')
    expect(enter('uvm')).toBe('UVM')
  })

  it('rests on the team chosen now while nothing is typed, else on the first', () => {
    expect(bestMatch(choices, '', '4')).toBe(3)
    expect(bestMatch(choices, '', 'gone')).toBe(0)
    expect(bestMatch(choices, '', null)).toBe(0)
  })

  it('gives a screen that keeps codes the code, and the mark its id', () => {
    expect(teamChoices(TEAMS, 'code')[2]).toEqual({
      value: 'OKC',
      id: '3',
      code: 'OKC',
      name: 'Oklahoma City Thunder',
      conference: 'West'
    })
  })

  it('moves by a row or a page, held to the list', () => {
    expect(movedTo('ArrowDown', 0, 3)).toBe(1)
    expect(movedTo('ArrowDown', 2, 3)).toBe(2)
    expect(movedTo('ArrowUp', 0, 3)).toBe(0)
    expect(movedTo('PageDown', 0, 30)).toBe(PAGE_ROWS)
    expect(movedTo('PageUp', 3, 30)).toBe(0)
    expect(movedTo('Home', 3, 30)).toBeNull()
    expect(movedTo('ArrowDown', 0, 0)).toBeNull()
  })
})
