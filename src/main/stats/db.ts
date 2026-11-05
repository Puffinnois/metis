import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from '@duckdb/node-api'

export type Row = Record<string, unknown>
export type Params = DuckDBValue[]

export interface StatsDbOptions {
  /**
   * DuckDB's buffer limit. 512 MB failed the first full load, invalidating the database: a checkpoint
   * pins buffers per column, and these tables run to over 200 columns.
   */
  memoryLimit?: string
  threads?: number
  /** Where DuckDB spills large sorts and joins; its default is beside the file. */
  tempDirectory?: string
}

/** BIGINT results arrive as bigint; every count and sum here fits a double. */
function plain(value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value
}

/**
 * The stats database: one DuckDB file, opened by one thread (the stats
 * worker). `exec` and `all` run on one connection, so statements are serialised; `transaction`
 * wraps a body in BEGIN / COMMIT and rolls back on a throw.
 */
export class StatsDb {
  private constructor(
    private readonly instance: DuckDBInstance,
    private readonly conn: DuckDBConnection,
    /** A second connection shares the instance and leaves it open when it closes. */
    private readonly ownsInstance = true
  ) {}

  static async open(path: string, options: StatsDbOptions = {}): Promise<StatsDb> {
    const config: Record<string, string> = {
      memory_limit: options.memoryLimit ?? '1GB',
      threads: String(options.threads ?? 2),
      // Large inserts need not keep the source order, which lets DuckDB stream them in less memory.
      preserve_insertion_order: 'false',
      // Never download an extension at run time: parquet, json and icu are built in.
      autoinstall_known_extensions: 'false'
    }
    if (options.tempDirectory) config.temp_directory = options.tempDirectory
    const instance = await DuckDBInstance.create(path, config)
    return new StatsDb(instance, await instance.connect())
  }

  async exec(sql: string, params?: Params): Promise<void> {
    await this.conn.run(sql, params)
  }

  async all<T extends object = Row>(sql: string, params?: Params): Promise<T[]> {
    const reader = await this.conn.runAndReadAll(sql, params)
    return reader
      .getRowObjectsJS()
      .map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, plain(v)])) as T)
  }

  async get<T extends object = Row>(sql: string, params?: Params): Promise<T | null> {
    return (await this.all<T>(sql, params))[0] ?? null
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec('BEGIN TRANSACTION')
    try {
      const result = await fn()
      await this.exec('COMMIT')
      return result
    } catch (err) {
      try {
        await this.exec('ROLLBACK')
      } catch {
        // already rolled back by DuckDB; keep the original error
      }
      throw err
    }
  }

  /**
   * Another connection to the same database. Its
   * statements run alongside this one's and see committed data only.
   */
  async connect(): Promise<StatsDb> {
    return new StatsDb(this.instance, await this.instance.connect(), false)
  }

  /** Stops the statement running on this connection; it rejects with an "Interrupted" error. */
  interrupt(): void {
    this.conn.interrupt()
  }

  close(): void {
    this.conn.closeSync()
    if (this.ownsInstance) this.instance.closeSync()
  }
}

/** A SQL string literal ('it''s'), for paths and names that cannot be bound as parameters. */
export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

/** A quoted identifier ("column"), for column names read from a file's header. */
export function sqlIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}
