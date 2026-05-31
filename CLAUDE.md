# Metis

**Local-first NBA (eventually multi-league) statistics desktop app.** Ingests from multiple public sources, stores in DuckDB+Parquet, computes traditional and advanced stats, serves a Tauri dashboard for filtering/sorting/comparing players and teams. Open source (Apache-2.0).

This file is loaded into every Claude Code session. **Read [decisions.md](decisions.md) and the current phase of [Plan.md](Plan.md) before starting any task.** Each task in Plan.md is scoped to one session.

---

## Tech stack (locked — do not change without an ADR in decisions.md)

| Layer | Choice | Why |
|---|---|---|
| Storage | **DuckDB** (embedded) + **Parquet** files on local disk | Columnar, vectorized, embedded — no server, ships inside the app. Native Parquet. |
| Core / compute / API | **Rust** (workspace of crates) | Speed, type safety, single binary, shared with Tauri backend. |
| Ingestion / ML / CV | **Python 3.12+** via **uv** | Every usable NBA scraping library is Python (`nba_api`, `pbpstats`, `basketball_reference_scraper`). ML/CV ecosystem. |
| Desktop shell | **Tauri 2** | Rust backend = our core, webview frontend, ~10MB binary, cross-platform. |
| Frontend | **SvelteKit** (static adapter) + **TanStack Table** + **Tailwind** + **shadcn-svelte** | Lightest runtime for heavy data grids; TanStack is the gold standard for filter/sort. |
| Python ↔ Rust boundary | **The filesystem (Parquet) and DuckDB.** No PyO3, no FFI. | Process isolation, language independence, easy debugging. |
| Migrations | Plain SQL files in `sql/migrations/`, applied by Rust on startup | Single source of truth. |
| Lint/format | `cargo fmt` + `clippy -D warnings`; `ruff` + `ruff format`; `prettier` for frontend | Enforced in pre-commit and CI. |
| License | **Apache-2.0** | Patent grant matters for this domain. |

---

## Repository layout

```
metis/
├── crates/                     # Rust workspace
│   ├── metis-core/             # Domain types, League trait, stat definitions, errors
│   ├── metis-db/               # DuckDB connection, migrations, repositories
│   ├── metis-compute/          # Advanced stat calculations, rollups, materialization
│   ├── metis-api/              # axum HTTP server (also exposed via Tauri commands)
│   ├── metis-tauri/            # Tauri 2 app shell (thin — wires API to webview)
│   └── metis-cli/              # Admin CLI (run migrations, trigger ingestion, query)
├── python/
│   ├── pyproject.toml          # uv-managed workspace
│   ├── ingest/                 # One module per source: nba_stats/, bref/, pbpstats/, espn/
│   ├── ml/                     # (later) prediction models
│   └── cv/                     # (later) computer vision
├── frontend/                   # SvelteKit app, built into Tauri
├── sql/
│   ├── migrations/             # NNNN_name.sql — applied in order by metis-db
│   └── views/                  # Materialized view definitions
├── data/                       # gitignored
│   ├── raw/<source>/<entity>/  # Untouched JSON/CSV dumps with fetched_at
│   ├── parquet/                # Normalized Parquet, partitioned by season/source
│   └── duckdb/metis.duckdb     # The canonical DB
├── notebooks/                  # Jupyter for exploration only — never load-bearing
├── docs/
│   └── adr/                    # Architecture Decision Records (long-form ADRs)
├── .github/workflows/          # CI: rust tests, python tests, frontend build
├── CLAUDE.md                   # This file
├── decisions.md                # Short architect log (decisions + rationale)
└── Plan.md                     # Phased task queue
```

---

## Critical rules (do not violate without explicit user approval)

1. **One task per session.** Plan.md defines task boundaries. Do not silently expand scope. If a task needs more, stop and tell the supervisor.
2. **No PyO3, no FFI between Rust and Python.** They communicate via DuckDB and Parquet only.
3. **All ingested data carries provenance.** Every raw row stores `source`, `source_url`, `fetched_at`, `source_payload` (JSON of the original). Reconciliation happens in a later layer, never destructively at ingest.
4. **No raw SQL strings scattered in Rust code.** Queries live in `metis-db/src/queries/` as named functions or in `sql/` as files.
5. **Schema changes go through `sql/migrations/`** with the next sequential number. Never `ALTER` the DB by hand. Migrations are append-only and idempotent.
6. **The `League` abstraction is mandatory from day one.** Even NBA-only code goes through `League::NBA`. Hardcoding "48 minutes" or "82 games" anywhere outside `crates/metis-core/src/league.rs` is a bug.
7. **Stats with limited historical coverage must declare their `min_season`.** UI and API gracefully return `null` (not error) when asked for a stat outside its coverage.
8. **No network calls from Rust.** Ingestion is exclusively Python. Rust reads from the local DB/Parquet only. This keeps the desktop binary offline-capable.
9. **No new dependencies without justification in the commit message.** Especially in `metis-core` (zero deps target) and `metis-db`.
10. **Tests required for:** every stat formula in `metis-compute`, every repository in `metis-db`, every ingestion adapter's parser (with a checked-in fixture). UI/integration tests not required in v1.
11. **Never commit anything in `data/`.** Even small files. It's gitignored — keep it that way.
12. **If you discover a decision needs to be made that isn't in decisions.md, stop and ask the supervisor.** Do not invent architecture.

---

## Conventions

### Rust
- Workspace `Cargo.toml` pins versions; member crates inherit via `workspace = true` for package metadata and deps.
- `clippy::pedantic` enabled in `metis-core` and `metis-compute`; `clippy::all -D warnings` everywhere. **Note:** `metis-core` and `metis-compute` declare their lints explicitly (not via `workspace = true`) to allow the pedantic override — if you update workspace lints, update these two crates as well.
- Errors: `thiserror` for library crates, `anyhow` only in `metis-cli` and `metis-tauri` (binaries).
- Async runtime: `tokio` (full). HTTP server: `axum`. DB driver: `duckdb` crate.
- Module naming: snake_case. Types: PascalCase. No `mod.rs` — use `foo.rs` + `foo/`.
- Public items documented with `///`. `cargo doc` must build clean.

### Python
- Python 3.12+, managed by `uv`. Single `pyproject.toml` at `python/`.
- Type hints required. `ruff` + `mypy --strict` in CI.
- Every adapter exposes the same interface: `fetch(entity, params) -> RawRecord` and `parse(raw) -> NormalizedRecord`. See `python/ingest/base.py` (to be created in Phase 2).
- Adapters write Parquet to `data/parquet/<source>/<entity>/season=YYYY/part-*.parquet`. Never write to DuckDB directly — Rust owns DB writes.
- Rate limiting and retry are mandatory and live in `python/ingest/_http.py`. No raw `requests.get` in adapter code.

### SQL
- Migrations: `NNNN_short_name.sql`, sequential, never edited after merge.
- Snake_case for tables and columns. Singular table names (`player`, not `players`).
- Every table has `id`, `created_at`, `updated_at` unless it's a pure fact table (then `ingested_at`).
- Fact tables are partitioned by `season` where applicable.

### Frontend
- Package manager: **pnpm**. Do not use npm or bun.
- SvelteKit with `adapter-static`. No SSR (Tauri serves static files).
- Data fetched via Tauri commands (preferred) or local HTTP to `metis-api`. Never directly to DuckDB from JS.
- Tables use TanStack Table with virtualization. Filters debounced 150ms.
- Tailwind only — no component CSS files. shadcn-svelte for primitives.

### Git

**Long-lived branches (protected):**
- `prod` — production. Only fast-forward merges from `preprod` after sign-off. This is what ships to users.
- `preprod` — pre-production / staging. Integration branch where completed work is validated together before promotion to `prod`.
- `main` — active development trunk. Working branches are cut from here and merged back here. Promoted to `preprod` in batches.

**Working branches** are cut from `main` and named by *intent*, not by task number. The slug must be short, kebab-case, and evocative enough that another contributor (human or agent) can guess the scope without opening the PR.

- `feature/<evocative-slug>` — new functionality. Examples: `feature/duckdb-migration-runner`, `feature/nba-box-score-ingest`, `feature/tanstack-player-table`.
- `fix/<evocative-slug>` — bug fix or patch. Examples: `fix/season-coverage-null-handling`, `fix/bref-rate-limit-backoff`.
- `chore/<evocative-slug>` — tooling, deps, CI, non-functional. Example: `chore/clippy-pedantic-rollout`.
- `docs/<evocative-slug>` — docs-only changes. Example: `docs/adr-storage-format`.
- `refactor/<evocative-slug>` — internal restructure, no behavior change. Example: `refactor/repository-trait-split`.

Bad slugs: `feature/task-12`, `feature/phase-2`, `fix/bug`, `feature/update`. Good slugs name the *thing* being changed.

**Flow:** `feature|fix|...` → PR into `main` → batch promote `main` → `preprod` → validate → fast-forward `preprod` → `prod`.

**Promotion policy:**
- `main` ← working branches: merged via PR after the task's acceptance criteria pass. Squash-merge preferred (one commit per task = easy revert).
- `preprod` ← `main`: promoted when a Plan.md phase is complete or a coherent batch of tasks is ready for integration testing. Use a merge commit (no squash) so individual task commits remain visible for bisecting.
- `prod` ← `preprod`: **only after a full phase has been tested and reviewed.** Fast-forward only — no direct commits, no merges from anywhere except `preprod`. Tag the resulting commit `vX.Y-phaseN` so reverts are trivial (`git reset --hard <previous tag>`).

**Protection rules (enforce when a GitHub remote is added; until then, honor by convention):**
- `prod`: no direct pushes, no force-push, linear history (fast-forward only), require PR from `preprod`, require passing CI, require one reviewer.
- `preprod`: no direct pushes, no force-push, require PR from `main`, require passing CI.
- `main`: no force-push, require PR from working branches, require passing CI.
- Working branches: no rules — force-push allowed (they're the agent's scratch space).

**Reverting:**
- A bad task on `main`: revert the squash commit (`git revert <sha>`).
- A bad phase on `prod`: reset to the previous `vX.Y-phaseN` tag, then fix forward on `main` → `preprod` → `prod`.

**Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). One PR per Plan.md task. PR description references the task ID and checks off acceptance criteria.

---

## Stat coverage policy

| Era | Box score | Advanced (TS%, eFG%, USG%) | Play-by-play | Lineup / on-off | Tracking |
|---|---|---|---|---|---|
| 1946–1979 | ✅ where available | ❌ | ❌ | ❌ | ❌ |
| 1979–1996 | ✅ | ⚠️ where computable from box | ❌ | ❌ | ❌ |
| 1996–2013 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 2013–present | ✅ | ✅ | ✅ | ✅ | ✅ (NBA Stats) |

API and UI return `null` (with a `coverage` marker) outside support windows. Never throw, never fake.

---

## Sources (planned)

| Source | Library | Use | Risk |
|---|---|---|---|
| stats.nba.com | `nba_api` | Box, advanced, tracking, PBP (1996+) | Rate-limited, unofficial API, breaks occasionally |
| Basketball-Reference | `basketball_reference_scraper` + custom | Historical depth, advanced totals | Scraping — respect `robots.txt`, rate-limit hard |
| pbpstats.com | `pbpstats` | Possession-level, lineups, on-off | Best-in-class lineup data |
| ESPN | custom (hidden JSON endpoints) | Cross-reference, live (later) | Undocumented, brittle |

**Every source is treated as untrusted.** Disagreements are stored, not resolved at ingest. The reconciliation layer (`metis-compute/src/reconcile/`) picks a canonical value per stat by configurable rules.

---

## DuckDB DDL quirks (discovered T011 — affects T012+)

The bundled DuckDB (crate `duckdb = "1"`, bundled feature) does not implement every SQL standard feature. Known gaps that affect schema and repository work:

| Feature | Status | Workaround |
|---|---|---|
| `GENERATED ALWAYS AS IDENTITY` | ❌ Not implemented | Use `CREATE SEQUENCE seq; ... DEFAULT nextval('seq')` |
| `ALTER TABLE t ADD COLUMN c TEXT NOT NULL` | ❌ Not implemented | Define `NOT NULL` columns in the original `CREATE TABLE` |
| `ALTER TABLE t ADD COLUMN c TEXT DEFAULT 'x'` | ✅ Works (nullable + default only) | N/A |
| `FOREIGN KEY` / `REFERENCES` in `CREATE TABLE` | ✅ Parsed and stored | Not enforced at runtime — application layer owns integrity |
| `CREATE UNIQUE INDEX` | ✅ Works | N/A |
| `INSERT ... ON CONFLICT DO NOTHING` | ✅ Works | Use for idempotent seed data |
| `current_timestamp` in `ON CONFLICT DO UPDATE SET` | ❌ Parsed as column name | Use `now()` instead (e.g. `updated_at = now()`) |

**Implication for T012 (repository upsert):** use `INSERT INTO ... ON CONFLICT DO UPDATE SET ...` (upsert) or `ON CONFLICT DO NOTHING` for deduplication. Do not rely on FK enforcement — validate foreign keys in application code before insert.

---

## How to start a task

1. Open [Plan.md](Plan.md), find the next unchecked task in the current phase.
2. Read its acceptance criteria.
3. Read [decisions.md](decisions.md) entries linked from the task.
4. Read referenced ADRs in `docs/adr/` if any.
5. Implement. Run `cargo fmt && cargo clippy -D warnings && cargo test` (and the Python/frontend equivalents if touched).
6. Open a PR. Tick off acceptance criteria in the PR body.
7. Stop. Do not start the next task. The supervisor reviews and starts a fresh session.

If anything in this file is wrong or unclear, **stop and ask the supervisor.** Do not "fix" CLAUDE.md unilaterally.
