import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export class StatsHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string
  ) {
    super(`HTTP ${status} for ${url}`)
    this.name = 'StatsHttpError'
  }
}

/** What asking for a file found. */
export type FetchedFile =
  | { kind: 'file'; path: string; etag: string | null; bytes: number }
  /** It still matches the etag asked about, so nothing was downloaded. */
  | { kind: 'unchanged' }
  /** Not published (404). */
  | { kind: 'missing' }

export interface Downloads {
  /** Downloads `url` to a temp file, unless it still matches `etag`. */
  fetchFile(url: string, etag?: string | null): Promise<FetchedFile>
  removeFile(path: string): Promise<void>
}

export interface DownloadOptions {
  /** Temp files go here; created when missing. */
  dir: string
  fetchImpl?: typeof fetch
  /** Per attempt. The largest file is about 25 MB; the default leaves room for a slow connection. */
  timeoutMs?: number
  /** The wait before the first retry; each later one waits three times longer. */
  retryDelayMs?: number
  /** Aborts downloads in flight when the worker closes. */
  signal?: AbortSignal
}

const ATTEMPTS = 4

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    })
  })
}

/** Files are Parquet, read from disk by DuckDB and deleted once loaded. */
export function createDownloads(options: DownloadOptions): Downloads {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 120_000
  const retryDelayMs = options.retryDelayMs ?? 2_000

  async function attempt(url: string, etag: string | null | undefined): Promise<FetchedFile> {
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout
    const res = await fetchImpl(url, {
      signal,
      // A plain client name: Metis never passes for a browser.
      headers: { 'user-agent': 'Metis', ...(etag ? { 'if-none-match': etag } : {}) }
    })
    if (res.status === 304) return { kind: 'unchanged' }
    if (res.status === 404) return { kind: 'missing' }
    if (!res.ok) throw new StatsHttpError(res.status, url)
    const published = res.headers.get('etag')
    // A server may ignore the condition and send the file anyway.
    if (etag && published === etag) return { kind: 'unchanged' }
    const body = new Uint8Array(await res.arrayBuffer())
    await mkdir(options.dir, { recursive: true })
    const path = join(options.dir, `${randomUUID()}.parquet`)
    await writeFile(path, body)
    return { kind: 'file', path, etag: published, bytes: body.length }
  }

  return {
    async fetchFile(url, etag) {
      for (let tried = 1; ; tried++) {
        try {
          return await attempt(url, etag)
        } catch (err) {
          const permanent = err instanceof StatsHttpError && !isRetryable(err.status)
          if (permanent || options.signal?.aborted || tried === ATTEMPTS) throw err
          await waitFor(retryDelayMs * 3 ** (tried - 1), options.signal)
        }
      }
    },
    async removeFile(path) {
      await rm(path, { force: true })
    }
  }
}
