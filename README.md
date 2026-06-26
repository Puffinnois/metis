# Metis

A local-first NBA statistics desktop app. Ingests box scores, play-by-play, and lineup data from multiple public sources, stores everything in an embedded DuckDB + Parquet store, computes traditional and advanced stats, and serves a Tauri + SvelteKit dashboard for filtering, sorting, and comparing players and teams across any era.

No account. No server. No network required after the initial data pull.

---

## What it does

**Player index** — filterable, sortable, virtually-scrolled table of every player in the database. Column groups: Traditional, Advanced (TS%, eFG%, USG%), Shooting, Lineup/On-Off. Filters: season, team, season type, position, age, minutes threshold.

**Player detail** — career splits by season, per-game / per-36 / per-100 views, filterable game log.

**Team index + detail** — same UX for teams; roster breakdown with per-player contributions.

**Saved views** — save a filter/sort/column state, load it later, set a default per entity type.

**Multi-source reconciliation** — stats.nba.com and Basketball-Reference are ingested independently. The reconciliation layer stores both, flags disagreements, and serves a canonical value per stat by configurable rules.

**Coverage markers** — the API returns a `coverage` field on every response. Stats that don't exist for a given era return `null` with a marker, never an error.

---

## Tech stack

| Layer | Choice |
|---|---|
| Storage | **DuckDB** (embedded) + **Parquet** files |
| Core / compute / API | **Rust** workspace of crates |
| Ingestion / ML | **Python 3.12+** via **uv** |
| Desktop shell | **Tauri 2** |
| Frontend | **SvelteKit** (static) + **TanStack Table** + **Tailwind** + **shadcn-svelte** |
| Python ↔ Rust | Filesystem (Parquet) + DuckDB — no FFI |

See [CLAUDE.md](CLAUDE.md) for the full rationale and all locked decisions.

---

## Repository layout

```
metis/
├── crates/
│   ├── metis-core/        # League trait, stat definitions, coverage types
│   ├── metis-db/          # DuckDB connection, migrations, repositories
│   ├── metis-compute/     # Season rollups, advanced stats, on-off, splits
│   ├── metis-api/         # axum HTTP server + OpenAPI spec
│   ├── metis-tauri/       # Tauri 2 shell (wires API to webview)
│   └── metis-cli/         # Admin CLI: migrate, load, compute
├── python/
│   └── ingest/            # nba_stats/, bref/, pbpstats/ adapters
├── frontend/              # SvelteKit app
├── sql/migrations/        # NNNN_name.sql applied in order on startup
├── scripts/
│   └── smoke.sh           # End-to-end pipeline smoke test
└── data/                  # gitignored — raw JSON, Parquet, metis.duckdb
```

---

## Getting started

### Prerequisites

- Rust (stable) — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Python 3.12+ with [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 20+ and [pnpm](https://pnpm.io/installation)
- Tauri system deps for your OS — see the [Tauri prereqs guide](https://tauri.app/start/prerequisites/)

### 1. Install dependencies

```bash
# Rust
cargo build --workspace

# Python
cd python && uv sync && cd ..

# Frontend
cd frontend && pnpm install && cd ..
```

### 2. Ingest data

```bash
# Fetch the 2024-25 season from stats.nba.com (~30 min, rate-limited)
cd python && uv run python -m ingest.nba_stats box-scores --season 2024 && cd ..
```

### 3. Load and compute

```bash
cargo run -p metis-cli -- load box-scores --season 2024 --source nba_stats
cargo run -p metis-cli -- compute season-rollups --season 2024 --source nba_stats
cargo run -p metis-cli -- compute advanced-stats --season 2024 --source nba_stats
```

Or run the full pipeline with the smoke test:

```bash
bash scripts/smoke.sh --season 2024
```

### 4. Open the app

```bash
cargo tauri dev
```

---

## Sources

| Source | Library | Data |
|---|---|---|
| stats.nba.com | `nba_api` | Box scores, advanced, tracking, PBP (1996–present) |
| Basketball-Reference | `basketball_reference_scraper` | Historical depth, season totals (1946–present) |
| pbpstats.com | `pbpstats` | Possession-level, lineups, on-off |

All sources are treated as untrusted. Raw data lands in `data/raw/` with full provenance (`source`, `source_url`, `fetched_at`, `source_payload`). Reconciliation happens in a separate layer, never destructively at ingest.

---

## Stat coverage

| Era | Box score | Advanced | Play-by-play | Lineup / on-off |
|---|---|---|---|---|
| 1946–1979 | ✅ where available | ❌ | ❌ | ❌ |
| 1979–1996 | ✅ | ⚠️ where computable | ❌ | ❌ |
| 1996–2013 | ✅ | ✅ | ✅ | ✅ |
| 2013–present | ✅ | ✅ | ✅ | ✅ |

---

## Development

```bash
# Rust: format, lint, test
cargo fmt --all
cargo clippy --workspace -- -D warnings
cargo test --workspace

# Python: lint, type-check, test
cd python
uv run ruff check .
uv run mypy --strict .
uv run pytest

# Frontend: type-check, build
cd frontend
pnpm check
pnpm build
```

CI runs all three on every push. A separate `api-contract` job regenerates the OpenAPI spec and TypeScript types and fails if the committed files are out of sync.

### Adding a new stat

1. Add the formula to `crates/metis-compute/src/` with a unit test.
2. Add a migration in `sql/migrations/` for any new column.
3. Expose via the API — add a field to the relevant `*Dto` and handler.
4. Regenerate the spec: `cargo run -p metis-api --example gen_openapi`
5. Regenerate TS types: `cd frontend && pnpm gen:api`

### Smoke test

`scripts/smoke.sh` runs the full ingest → load → compute → API chain and asserts row counts at each stage. Run it after any change that touches the pipeline. It accepts `--season YYYY`, `--db PATH`, `--no-clean`, and `--skip-ingest` flags.

---

## License

Apache-2.0. See [LICENSE](LICENSE).
