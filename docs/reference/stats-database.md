# Stats database: data reference

`stats.duckdb` holds every table the NBA dataset publishes, every season, in one DuckDB file beside `metis.db`. Deleting the file makes the next refresh rebuild it. What the files are and what was measured about them is in [nba-data-sources.md](nba-data-sources.md); which seasons really hold values is in [nba-coverage.md](nba-coverage.md).

## Engine

- One worker thread (`out/main/statsWorker.js`, `src/main/stats/worker.ts`) owns the file. The main process talks to it through `StatsClient` (`src/main/stats/client.ts`): `refresh`, `status`, `selfTest`, `close`. Scripts also use `read`, which runs one SQL statement; the app does not expose it.
- Writes run one after another. Reads run at once, each on its own connection, so a screen never waits behind a refresh.
- DuckDB `@duckdb/node-api` 1.5.6. Parquet, JSON and ICU are built in, and no extension is ever downloaded.
- Settings: `memory_limit` 1 GB, 2 threads, `preserve_insertion_order` off, spill files in `<userData>/stats-tmp/duckdb`.

**Why 1 GB.** The template's 512 MB failed during the first full load: a checkpoint could not pin a block, and DuckDB invalidated the database. A checkpoint pins buffers per column, and these files are far wider than the template's. Reopening the file recovers it, with nothing lost, and the load carries on. 768 MB passed a whole load, so 1 GB leaves room. If it ever happens, the refresh stops, the status reads as stats unavailable, and the next launch recovers.

## Source tables

Each file family in `src/main/stats/sources.ts` loads into one table, named `src_espn_*`, `src_nba_*`, `src_dash_*` (the league dashboards), `src_xwalk_*` (the crosswalks) or by what it holds (`src_team_aliases`).

Every column is kept as published and typed, zeros included. When a later season adds a column, it is added to the table. When a column's type changes between seasons, it is widened (two integer types to `BIGINT`, other numbers to `DOUBLE`, anything else to `VARCHAR`), and the step's message says so.

Three columns are standard:

| Column        | Holds                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `season`      | The file's own value as an `INTEGER`, or the label in the file's name when it has none. It is never overwritten: see the trap in the data reference. |
| `file_season` | The label in the file's name, on season files. It is what a reload replaces.                                                                         |
| `source_file` | The file's stem, on tables that hold several files of a season (play types, hustle, matchups).                                                       |

Season types and team codes stay as published here. They are mapped in the `game` and `team` tables (D27).

## Sync

- **When it runs:** at launch, and every 6 hours while the window stays open. One at a time.
- **Order (D21):** tier by tier: core, published, events, play by play. Inside a tier, files of all seasons first, then the newest season back. So the app is usable after the first tier, and a load cut short keeps the seasons people look at most.
- **What is due:**
  - A step that finished is not tried again within a day; a failed one after an hour.
  - The current season and files of all seasons are checked daily, the prior season weekly.
  - Older seasons are fetched once and sealed. A source's `version` bump fetches them again.
- **Freshness:** each request carries the file's `etag`. A file that has not changed downloads nothing, and logs `unchanged`.
- **Downloads:** up to 4 at once, ahead of the file being loaded, with 3 retries and growing waits on throttling, server errors and dropped connections. The client calls itself `Metis`. Files go to `<userData>/stats-tmp` and are deleted once loaded.
- **Loading:** one file at a time, each in one transaction, so a failed load keeps the old rows. A file not published (404) is `skipped` and tried the next day.
- **Quitting:** closing the worker aborts downloads and interrupts the running statement, and the step is logged `interrupted`. That is not an attempt, so the next run tries it again. Steps a crash left `running` are marked `interrupted` on the next open, and stale temp files are cleared.

Each file is one step, logged as `stats:<source>:<season>` (or `stats:<source>` for a file of all seasons) in the file's own `sync_log`. `source_state` holds what each source has per season: rows, size, etag, when it was fetched and whether it is sealed.

## Measuring a real load

Build first, then point these at a scratch folder, never at the app's own data.

```bash
node scripts/load-report.mjs /tmp/metis-load /tmp/metis-load/report.json
```

```bash
node scripts/coverage-report.mjs /tmp/metis-load docs/reference/nba-coverage.tsv docs/reference/nba-coverage.md
```

```bash
node scripts/stats-sql.mjs /tmp/metis-load statements.sql
```
