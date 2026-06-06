# Plan — Metis

**Task queue for Claude Code.** Each task is one session. Do not bundle. Do not skip ahead. Acceptance criteria are contracts — if you can't meet them, stop and tell the supervisor.

Mark tasks `[x]` only when merged. Mark `[~]` for in-progress (a PR is open).

Legend: 🦀 Rust · 🐍 Python · 🖼️ Frontend · 🗄️ SQL/Data · ⚙️ Tooling

---

## Phase 0 — Foundations  *(must complete before anything else)*

- [ ] **T001 ⚙️ Repo skeleton + tooling.**
  - Create directory structure per CLAUDE.md "Repository layout."
  - Init Rust workspace (`Cargo.toml` at root, member crates as empty `lib.rs`/`main.rs`).
  - Init Python project (`python/pyproject.toml` with `uv`, ruff, mypy).
  - Init SvelteKit project in `frontend/` with adapter-static, Tailwind, TanStack Table, shadcn-svelte.
  - Add `.gitignore` (Rust target/, Python `.venv/`, `data/`, `node_modules/`, build artifacts).
  - Add `LICENSE` (Apache-2.0) and `README.md` (one paragraph + link to CLAUDE.md).
  - **Acceptance:** `cargo build` succeeds (empty crates), `uv sync && ruff check` succeeds, `cd frontend && npm run build` succeeds. Nothing in `data/` is tracked.

- [ ] **T002 ⚙️ Pre-commit + CI.**
  - `.pre-commit-config.yaml`: `cargo fmt`, `clippy -D warnings`, `ruff`, `ruff format`, `prettier`.
  - `.github/workflows/ci.yml`: matrix runs Rust check/test, Python check/test, frontend build. Linux only for v1.
  - **Acceptance:** Pushing a branch triggers CI and it passes on an empty repo.

- [ ] **T003 🦀 `metis-core` skeleton: `League` trait + NBA impl + stat coverage types.**
  - Define `League` enum (`NBA`, `WNBA`, `NCAAM`, `NCAAW`, `Euroleague` — only `NBA` implemented).
  - Per-league constants: `period_length_min`, `periods_per_game`, `regular_season_games`.
  - Define `Coverage { min_season: Option<Season>, max_season: Option<Season> }` and `StatId` enum stub.
  - Define `Season` newtype (start year, e.g. `Season(1996)` = "1996-97").
  - Define `SeasonType` enum (Regular, Playoffs, PlayIn, AllStar, Preseason).
  - Zero deps beyond `serde` and `thiserror`.
  - **Acceptance:** `cargo test -p metis-core` passes; hardcoded period length used nowhere outside this crate (grep-verified in PR description).

---

## Phase 1 — Storage layer

- [x] **T010 🗄️ Migration runner in `metis-db`.**
  - Connect to `data/duckdb/metis.duckdb`, create if missing.
  - Apply `sql/migrations/*.sql` in order, track applied in `_migrations` table.
  - Expose `Db::open(path) -> Result<Db>` and `Db::migrate(&self)`.
  - **Acceptance:** Unit test: empty DB → migrate twice → second is no-op. Integration test with one dummy migration file.

- [x] **T011 🗄️ Initial schema migrations.**
  - `0001_core_entities.sql`: `league`, `team`, `player`, `season`, `game`.
  - `0002_box_score.sql`: `player_game_box` (one row per player-game), `team_game_box`.
  - `0003_provenance.sql`: every fact table gets `source TEXT`, `source_url TEXT`, `fetched_at TIMESTAMP`, `source_payload JSON`. Composite uniqueness on (entity keys, source).
  - `0004_user_views.sql`: `user_view` table for saved filter combinations.
  - Use snake_case, singular table names. Document each column.
  - **Acceptance:** Migrations apply clean. Schema diagram (text) in PR body.

- [x] **T012 🦀 Repository pattern for core entities in `metis-db`.**
  - `PlayerRepo`, `TeamRepo`, `GameRepo`, `BoxScoreRepo` — each with `upsert`, `find_by_id`, `find_by_*`.
  - Queries live in `src/queries/` as functions, not inline strings.
  - **Acceptance:** Unit tests per repo using an in-memory DuckDB.

---

## Phase 2 — First ingestion pipeline

- [x] **T020 🐍 Ingestion base: rate limiter, retry, Parquet writer.**
  - `python/ingest/_http.py`: shared `requests.Session` with backoff, configurable RPS per host, polite User-Agent.
  - `python/ingest/_parquet.py`: writes to `data/parquet/<source>/<entity>/season=YYYY/part-*.parquet`. Uses `pyarrow`.
  - `python/ingest/base.py`: `Adapter` protocol — `fetch`, `parse`, `write`.
  - **Acceptance:** Unit test hits a local mock server, writes Parquet, reads back identical.

- [x] **T021 🐍 nba_api adapter — historical box scores for one season.**
  - Pull all regular-season games + box scores for a configurable season (default: most recent complete).
  - Normalize into the `player_game_box` and `team_game_box` Parquet schemas (matching SQL columns plus `source_payload`).
  - CLI: `python -m ingest.nba_stats box-scores --season 2024`.
  - **Acceptance:** Running locally produces Parquet files; row counts match known season totals within 0.5%; fixture-based parser test.

- [x] **T022 🦀 Parquet → DuckDB loader in `metis-cli`.**
  - `metis-cli load box-scores --season 2024` reads Parquet via DuckDB's `read_parquet` and upserts into the typed tables.
  - Idempotent: re-running yields same row count.
  - **Acceptance:** End-to-end test from Parquet fixture to DB rows.

---

## Phase 3 — Traditional stats compute

- [x] **T030 🦀 `metis-compute` season rollups.**
  - From `player_game_box`, materialize `player_season_totals` and `player_season_per_game`.
  - Same for teams.
  - Triggered via `metis-cli compute season-rollups --season 2024`.
  - **Acceptance:** Numbers tie out vs. a known reference (e.g., NBA.com leaders page) for top 10 scorers, within rounding.

- [ ] **T031 🦀 Traditional advanced stats: TS%, eFG%, USG%, per-36, per-100-poss.**
  - Formulas in `metis-compute/src/formulas/` with citations in doc comments.
  - Unit tests per formula with hand-computed examples.
  - **Acceptance:** Same tie-out as T030 for advanced columns.

---

## Phase 4 — Second source + reconciliation

- [ ] **T040 🐍 Basketball-Reference adapter — season totals.**
  - Respect robots.txt, ≤1 req/3s, cache responses.
  - Pull player season totals and advanced totals.
  - **Acceptance:** Parquet output for one season; parser test on saved HTML fixture.

- [ ] **T041 🦀 Reconciliation layer.**
  - `metis-compute/src/reconcile/`: per-stat rules — default source, disagreement threshold, action on disagreement.
  - Materializes `player_season_canonical` from multi-source inputs.
  - Disagreements logged into `stat_disagreement` table.
  - **Acceptance:** Test with synthetic disagreements; canonical picks expected source; disagreements logged.

---

## Phase 5 — Play-by-play & lineup

- [x] **T050 🐍 pbpstats adapter — possessions + lineups for one season.**
- [x] **T051 🗄️ Migrations: `possession`, `lineup_stint`, `player_lineup_stats`.**
- [x] **T052 🦀 On-off and lineup net rating compute.**
- [ ] **T053 🦀 PBP-derived splits: clutch, by-quarter, garbage time.**

*(Detailed acceptance criteria added when phase is reached — supervisor refines based on Phase 4 learnings.)*

---

## Phase 6 — API

- [ ] **T060 🦀 `metis-api` axum server: entity endpoints.**
  - `GET /players/:id`, `GET /players` (with filter query params per decisions.md ADR 011).
  - `GET /teams/:id`, `GET /teams`.
  - `GET /seasons`, `GET /games`.
  - JSON response includes `coverage` marker on nullable stats (per ADR 008).
  - **Acceptance:** OpenAPI spec generated; integration tests per endpoint.

- [ ] **T061 🦀 Filter/sort/pagination query layer.**
  - All v1 filter dimensions from ADR 011 supported.
  - Pagination + sort spec in query string. Max page size enforced.
  - **Acceptance:** Property tests on filter combinations; p95 query latency <100ms on full-history DB.

- [ ] **T062 🦀 Materialized rollups for filter performance.**
  - Identify hot filter combos, precompute via DuckDB views/tables.
  - **Acceptance:** p95 <50ms on the 10 most common filter shapes.

---

## Phase 7 — Tauri shell + frontend foundation

- [ ] **T070 🦀🖼️ `metis-tauri` shell wiring frontend ↔ api.**
  - Tauri 2 setup. Frontend bundled as static assets.
  - Tauri commands proxy to `metis-api` handlers in-process (no localhost HTTP needed).
  - **Acceptance:** `cargo tauri dev` opens a window; a smoke command returns data.

- [ ] **T071 🖼️ Frontend data layer + routing skeleton.**
  - `src/lib/api.ts` typed client (codegen from OpenAPI).
  - Routes: `/players`, `/players/[id]`, `/teams`, `/teams/[id]`.
  - Tailwind theme, shadcn-svelte primitives installed.
  - **Acceptance:** Empty pages render with shared layout.

- [ ] **T072 🖼️ Player index page: table with all v1 filters + sort + virtualization.**
  - TanStack Table headless mode. Virtual scroll. Debounced filters (150ms).
  - Column groups: Traditional / Advanced / Shooting / Lineup.
  - **Acceptance:** Scrolls smoothly on full historical DB; switching column groups is instant (no refetch if data already loaded).

- [ ] **T073 🖼️ Player detail page: career + season splits + filterable game log.**
- [ ] **T074 🖼️ Team index + detail pages (mirroring player UX).**

---

## Phase 8 — Saved views

- [ ] **T080 🦀 Saved-view CRUD endpoints + repository.**
- [ ] **T081 🖼️ Saved-view UI: save / load / delete / set default.**

---

## Phase 9 — Historical depth

- [ ] **T090 🐍 Backfill ingestion for all available seasons (1946 → present, per coverage policy).**
- [ ] **T091 🦀 Full rollup + reconciliation run; verify coverage markers correct per ADR 008.**

---

## Future phases  *(scoped when reached, not before)*

- **Phase 10 — Comparison UI** (player vs player, team vs team).
- **Phase 11 — Live ingestion** (poll stats.nba.com for in-progress games).
- **Phase 12 — ML / predictions** (game outcome, player projection).
- **Phase 13 — RAG-backed Q&A** over the local DB.
- **Phase 14 — Computer vision** (proprietary tracking data from broadcast video).
- **Phase 15 — Additional leagues** (WNBA → NCAAM → NCAAW → Euroleague).

Each future phase gets its own task breakdown when the prior phase ships. Adding tasks ahead of time wastes effort because earlier phases will reshape what's actually needed.
