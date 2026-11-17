import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { adoptFormerStatsFile, statsFilePath } from '@main/stats/files'
import { LEAGUES } from '@shared/leagues'

// Real folders, so the rename is tested on each platform CI builds on, Windows among them.
let dir: string
const logs: string[] = []
const log = (m: string): number => logs.push(m)
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metis-files-'))
  logs.length = 0
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const at = (name: string): string => join(dir, name)
const text = (name: string): string => readFileSync(at(name), 'utf8')

describe('a stats file per league', () => {
  it('names each league’s file in the data folder', () => {
    expect(statsFilePath(dir, LEAGUES.nba)).toBe(at('stats-nba.duckdb'))
    expect(statsFilePath(dir, LEAGUES.wnba)).toBe(at('stats-wnba.duckdb'))
  })

  it('renames the old file to the NBA’s', () => {
    writeFileSync(at('stats.duckdb'), 'old rows')
    const result = adoptFormerStatsFile(dir, LEAGUES.nba, log)
    expect(result).toMatchObject({ kind: 'renamed', wal: false })
    expect(existsSync(at('stats.duckdb'))).toBe(false)
    expect(text('stats-nba.duckdb')).toBe('old rows')
    expect(logs).toEqual(['stats: renamed stats.duckdb to stats-nba.duckdb'])
  })

  it('takes the WAL beside it along', () => {
    writeFileSync(at('stats.duckdb'), 'old rows')
    writeFileSync(at('stats.duckdb.wal'), 'last writes')
    expect(adoptFormerStatsFile(dir, LEAGUES.nba, log)).toMatchObject({
      kind: 'renamed',
      wal: true
    })
    expect(text('stats-nba.duckdb')).toBe('old rows')
    expect(text('stats-nba.duckdb.wal')).toBe('last writes')
    expect(existsSync(at('stats.duckdb.wal'))).toBe(false)
  })

  it('does nothing when there is no old file', () => {
    expect(adoptFormerStatsFile(dir, LEAGUES.nba, log)).toEqual({ kind: 'none' })
    writeFileSync(at('stats-nba.duckdb'), 'new rows')
    expect(adoptFormerStatsFile(dir, LEAGUES.nba, log)).toEqual({ kind: 'none' })
    expect(text('stats-nba.duckdb')).toBe('new rows')
    expect(logs).toEqual([])
  })

  it('leaves the old file untouched when both exist, and says so', () => {
    writeFileSync(at('stats.duckdb'), 'old rows')
    writeFileSync(at('stats.duckdb.wal'), 'old log')
    writeFileSync(at('stats-nba.duckdb'), 'new rows')
    expect(adoptFormerStatsFile(dir, LEAGUES.nba, log).kind).toBe('both')
    expect(text('stats.duckdb')).toBe('old rows')
    expect(text('stats.duckdb.wal')).toBe('old log')
    expect(text('stats-nba.duckdb')).toBe('new rows')
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/both stats\.duckdb and stats-nba\.duckdb/)
  })

  it('never gives the old file to a league that did not have it', () => {
    writeFileSync(at('stats.duckdb'), 'old rows')
    expect(adoptFormerStatsFile(dir, LEAGUES.wnba, log)).toEqual({ kind: 'none' })
    expect(existsSync(at('stats-wnba.duckdb'))).toBe(false)
    expect(text('stats.duckdb')).toBe('old rows')
  })

  it('refuses a stray WAL rather than pair it with the wrong file', () => {
    writeFileSync(at('stats.duckdb'), 'old rows')
    writeFileSync(at('stats.duckdb.wal'), 'old log')
    writeFileSync(at('stats-nba.duckdb.wal'), 'stray')
    expect(() => adoptFormerStatsFile(dir, LEAGUES.nba, log)).toThrow(/exists without/)
    expect(text('stats.duckdb')).toBe('old rows')
    expect(text('stats.duckdb.wal')).toBe('old log')
  })
})
