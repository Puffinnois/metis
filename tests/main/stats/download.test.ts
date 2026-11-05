import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createDownloads } from '@main/stats/download'
import { tempDir } from '../../fixtures/stats'

const respond =
  (status: number, body = '', headers: Record<string, string> = {}): typeof fetch =>
  async () =>
    new Response(status === 404 || status === 304 ? null : body, { status, headers })

describe('createDownloads', () => {
  it('writes the file to temp, reports its etag, and removes it when asked', async () => {
    const dir = tempDir()
    const downloads = createDownloads({ dir, fetchImpl: respond(200, 'abc', { etag: '"v1"' }) })
    const got = await downloads.fetchFile('https://x/f.parquet')
    if (got.kind !== 'file') throw new Error('expected a file')
    expect(got.path.endsWith('.parquet')).toBe(true)
    expect(got).toMatchObject({ etag: '"v1"', bytes: 3 })
    expect(readFileSync(got.path, 'utf8')).toBe('abc')
    await downloads.removeFile(got.path)
    expect(readdirSync(dir)).toEqual([])
  })

  it('asks with the etag it has and a plain client name', async () => {
    const fetchImpl = vi.fn(respond(304))
    const downloads = createDownloads({ dir: tempDir(), fetchImpl })
    expect(await downloads.fetchFile('https://x/f.parquet', '"v1"')).toEqual({ kind: 'unchanged' })
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({
      'user-agent': 'Metis',
      'if-none-match': '"v1"'
    })
  })

  it('sends no condition without an etag', async () => {
    const fetchImpl = vi.fn(respond(200, 'abc'))
    await createDownloads({ dir: tempDir(), fetchImpl }).fetchFile('https://x/f.parquet', null)
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({ 'user-agent': 'Metis' })
  })

  it('writes nothing when a server ignores the condition but the etag still matches', async () => {
    const dir = `${tempDir()}/never-made`
    const downloads = createDownloads({
      dir,
      fetchImpl: respond(200, 'abc', { etag: '"v1"' })
    })
    expect(await downloads.fetchFile('https://x/f.parquet', '"v1"')).toEqual({ kind: 'unchanged' })
    expect(existsSync(dir)).toBe(false)
  })

  it('reports a file that is not published, without retrying', async () => {
    const fetchImpl = vi.fn(respond(404))
    const downloads = createDownloads({ dir: tempDir(), fetchImpl, retryDelayMs: 0 })
    expect(await downloads.fetchFile('https://x/f.parquet')).toEqual({ kind: 'missing' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not retry a permanent failure', async () => {
    const fetchImpl = vi.fn(respond(403))
    const downloads = createDownloads({ dir: tempDir(), fetchImpl, retryDelayMs: 0 })
    await expect(downloads.fetchFile('https://x/f.parquet')).rejects.toThrow(
      'HTTP 403 for https://x/f.parquet'
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries throttling, server errors and dropped connections, then succeeds', async () => {
    const answers: (() => Promise<Response>)[] = [
      respond(429) as () => Promise<Response>,
      () => Promise.reject(new TypeError('fetch failed')),
      respond(503) as () => Promise<Response>,
      respond(200, 'abc') as () => Promise<Response>
    ]
    const fetchImpl = vi.fn((() => answers.shift()!()) as typeof fetch)
    const downloads = createDownloads({ dir: tempDir(), fetchImpl, retryDelayMs: 0 })
    expect((await downloads.fetchFile('https://x/f.parquet')).kind).toBe('file')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('gives up after its attempts', async () => {
    const fetchImpl = vi.fn(respond(500))
    const downloads = createDownloads({ dir: tempDir(), fetchImpl, retryDelayMs: 0 })
    await expect(downloads.fetchFile('https://x/f.parquet')).rejects.toThrow('HTTP 500')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('stops a download when its signal aborts, without retrying', async () => {
    const abort = new AbortController()
    const hanging = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        )
    ) as unknown as typeof fetch
    const downloads = createDownloads({ dir: tempDir(), fetchImpl: hanging, signal: abort.signal })
    const pending = downloads.fetchFile('https://x/f.parquet')
    abort.abort()
    await expect(pending).rejects.toThrow('aborted')
    expect(hanging).toHaveBeenCalledTimes(1)
  })
})
