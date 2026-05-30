# Decisions log — Metis

Architect's long-term memory across sessions. Append-only. Each entry: short title, date, decision, why, alternatives considered, and pointers to deeper ADRs if any.

When a decision turns out to be wrong, do **not** delete it. Add a new entry that supersedes it and link back. Past reasoning is useful even when overturned.

Format:
```
## NNN — Title  (YYYY-MM-DD)
**Decision:** one sentence.
**Why:** the reasoning, including what we were optimizing for.
**Alternatives considered:** what we said no to and why.
**Supersedes:** (optional) NNN
**Superseded by:** (optional) NNN
```

---

## 001 — Local-first desktop app, not web service  (2026-05-30)
**Decision:** Ship Metis as a Tauri desktop app. No hosted backend in v1.
**Why:** User wants a standalone Windows (+ Mac/Linux) application with a fast, snappy dashboard. Local execution eliminates network latency, hosting cost, and ToS exposure from re-serving scraped data. Tauri gives us cross-platform + small binary while reusing our Rust core as the backend.
**Alternatives considered:** Electron (heavier, JS backend forces a second language for serving — rejected). Web app + hosted Postgres (network latency, hosting cost, ToS risk — rejected for v1; revisit if multi-user demand emerges).

## 002 — DuckDB + Parquet, not Postgres  (2026-05-30)
**Decision:** DuckDB is the canonical store, embedded in the Tauri binary. Raw ingest lands in Parquet under `data/parquet/`. DuckDB queries Parquet directly for cold data, materializes hot rollups into native tables.
**Why:** Workload is 100% analytical (scan, aggregate, filter, sort). DuckDB is columnar + vectorized, native Parquet, embedded (no server), excellent Rust + Python bindings. For a local single-user app it outperforms Postgres on every dimension that matters, with no ops cost. Migration path to Postgres later (for hosted multi-user) is realistic because SQL dialects overlap heavily.
**Alternatives considered:** Postgres (overkill for embedded single-user, requires install/run — rejected). SQLite (row-oriented, slower for OLAP — rejected). ClickHouse (server-based, too heavy — rejected). Polars-only (no SQL, no persistence layer — rejected).

## 003 — Rust core + Python ingestion, no FFI  (2026-05-30)
**Decision:** Rust owns storage, compute, API, and the Tauri shell. Python owns ingestion, ML, and future CV. They communicate exclusively via the filesystem (Parquet) and DuckDB. No PyO3, no FFI.
**Why:** Each language used where strongest. The NBA scraping ecosystem is entirely Python (`nba_api`, `pbpstats`, `basketball_reference_scraper`); rebuilding in Rust is wasted effort. PyO3 entanglement adds build complexity, cross-language stack traces, and packaging pain. The DuckDB/Parquet boundary is naturally typed, debuggable, and language-independent — Python writes files, Rust reads files.
**Alternatives considered:** Pure Rust (loses Python's scraping libs — rejected). PyO3 in-process (build/debug pain — rejected). gRPC between processes (network overhead, schema duplication, more moving parts for zero gain on a local app — rejected).

## 004 — Frontend: SvelteKit + TanStack Table + Tailwind + shadcn-svelte  (2026-05-30)
**Decision:** Tauri shell renders a SvelteKit (static adapter) app. Data grids use TanStack Table. Styling via Tailwind + shadcn-svelte primitives.
**Why:** User wants visually clean, fast, snappy filtering/sorting over large stat tables. Svelte's compiled runtime is the lightest among major frameworks — matters when rendering tables with thousands of rows + frequent re-renders. TanStack Table is the gold standard for headless sort/filter/virtualization. Tailwind + shadcn give clean defaults without per-component CSS sprawl. Static adapter fits Tauri (no SSR needed).
**Alternatives considered:** React + Next.js (heavier runtime, SSR not useful here — rejected for runtime weight). SolidJS (great perf but smaller component ecosystem — rejected). Plain Rust egui/iced (no web reuse, harder to make visually polished — rejected).

## 005 — Provenance over reconciliation at ingest  (2026-05-30)
**Decision:** Every ingested row stores `source`, `source_url`, `fetched_at`, and the original payload as JSON. Reconciliation between sources happens in a separate compute layer with configurable rules, never destructively at ingest.
**Why:** Sources disagree (Basketball-Reference vs stats.nba.com often differ on advanced stats). Disagreements are *data*, not errors — we want to surface them, tune which source wins per stat type, and revisit later when one source updates a historical correction. Destructive merging at ingest loses information forever.
**Alternatives considered:** Pick one source per stat at ingest (loses ability to compare/audit — rejected). Pick "best" source globally (no globally-best source exists — rejected).

## 006 — League abstraction from day one  (2026-05-30)
**Decision:** A `League` enum/trait in `metis-core` parameterizes period length, periods per game, season structure, roster rules, and available stat coverage. Even NBA-only v1 code goes through `League::NBA`. No hardcoded "48 minutes" or "82 games" anywhere outside that module.
**Why:** Adding WNBA (40min, 4×10), NCAA (40min, 2×20), Euroleague (40min, 4×10) is on the explicit roadmap. Retrofitting a league abstraction after the schema and stat formulas are written is a major rewrite. Doing it now costs ~one task and saves a phase-sized refactor later.
**Alternatives considered:** NBA-only now, abstract later (rejected — high refactor cost, easy to do right the first time).

## 007 — Apache-2.0 license  (2026-05-30)
**Decision:** Project licensed Apache-2.0.
**Why:** Open source goal. Apache-2.0's explicit patent grant is meaningful in a domain (sports stats) with known IP/licensing friction. Compatible with most ecosystems we'll touch.
**Alternatives considered:** MIT (simpler but no patent grant — rejected). GPL (would limit downstream use — rejected for this project's goals).

## 008 — Coverage policy: return null outside support window  (2026-05-30)
**Decision:** Stats with limited historical coverage (advanced stats pre-1979, PBP pre-1996, tracking pre-2013) return `null` with a `coverage` marker in API responses. Never error, never synthesize.
**Why:** User wants both modern depth and historical breadth. A hard-error policy makes "show LeBron's career TS%" easy but "show Wilt's career TS%" crash. Null + marker lets the UI gracefully show "—" or "not tracked this era" without special-case logic per stat.
**Alternatives considered:** Compute backfilled estimates for missing data (rejected — invents data, violates provenance principle). Error out (rejected — bad UX).

## 009 — One task per Claude Code session, supervised  (2026-05-30)
**Decision:** Plan.md is structured as a queue of self-contained, single-session tasks with explicit acceptance criteria. Each task is small enough to complete in one session and large enough to produce a reviewable PR. Claude Code does not start the next task autonomously.
**Why:** User's workflow: Claude Code writes everything, fresh session per task, user supervises. Cross-session continuity comes entirely through committed files (code, CLAUDE.md, decisions.md, Plan.md). This means every task must be reviewable in isolation, conventions must be locked tight (or each new session drifts), and architectural decisions belong in version control, not in any one session's memory.
**Alternatives considered:** Long-running session with TODO list (rejected — user wants discrete review checkpoints). Auto-continue (rejected — supervisor needs to gate each step).

## 010 — Stat scope: traditional, four factors, advanced box, lineup/on-off, shooting, PBP-derived  (2026-05-30)
**Decision:** v1 stat surface covers traditional box, four factors, advanced (TS%, eFG%, USG%, PER, BPM, VORP, WS), shooting splits where available, lineup / on-off, and PBP-derived splits (clutch, by-quarter, garbage time). Tracking stats (speed, touches) included where source provides. Opponent-adjusted ratings deferred to v1.5.
**Why:** Covers ~95% of what a serious stats consumer wants. Anything beyond requires either paid data (Synergy) or our own CV pipeline (later phase). Opponent-adjustment is methodologically non-trivial and benefits from being designed once the base layer is stable.
**Alternatives considered:** Minimal traditional-only v1 (rejected — undersells the product). Everything including SRS-style adjustments (rejected — scope creep, design risk).

## 011 — Filter dimensions locked for v1  (2026-05-30)
**Decision:** v1 supports filtering on: season(s), season type (regular/playoffs/play-in/all-star), date range, team(s), opponent(s), home/away, win/loss, days rest, score margin, quarter/half/clutch window, lineup-mate. Granularity: career / multi-season / season / month / game / quarter / possession. Display modes: totals / per-game / per-36 / per-100-poss.
**Why:** These are the axes that show up in essentially every serious NBA analysis. Locking them now lets us design indexes and materialized rollups correctly the first time. Adding a new filter dimension later requires either a new index or a slow scan — cheaper to plan for them now.
**Alternatives considered:** Filter on whatever the user types (rejected — DuckDB is fast but not magical; uncontrolled filters mean unpredictable performance). Smaller filter set (rejected — the user explicitly asked for "every filter and sort feature possible").

## 012 — Comparison tool deferred to post-v1 UI, but data layer supports it  (2026-05-30)
**Decision:** Player-vs-player and team-vs-team comparison is not a v1 UI feature. The data layer and API are designed so adding it later is purely a frontend task.
**Why:** Comparison is two queries side-by-side over the same indexes — zero foundation cost if the API returns one entity per call cleanly. User wants foundation solid before features pile on; comparison fits naturally on top later.
**Alternatives considered:** Build it in v1 (rejected — user prioritized foundation). Design a special comparison API (rejected — premature; the per-entity API already supports it).

## 013 — Saved views in v1  (2026-05-30)
**Decision:** v1 supports user-saved views (named filter + sort + columns combinations). Stored in a local `user_view` table in DuckDB.
**Why:** Cheap to add (one table, one CRUD endpoint, one modal). High UX value for repeat use. Establishes the pattern for any future user-settings features.
**Alternatives considered:** Defer (rejected — small enough to do now, and locking the schema for it sooner is better).

## 014 — `source_payload JSON` column instead of "future stat slots"  (2026-05-30)
**Decision:** Raw ingestion tables carry a `source_payload JSON` column with the full original row. Typed columns exist only for stats we currently use. New stat types do not require schema migration for ingestion — only when promoting them to typed columns in the normalized layer.
**Why:** DuckDB migrations are cheap, but the bigger win is decoupling ingestion velocity from schema design. We can backfill a new typed column from `source_payload` later without re-fetching anything. No need to pre-declare slots we may never fill.
**Alternatives considered:** Pre-declare "extension" columns (rejected — premature). Schema-on-read for everything (rejected — kills query performance on hot paths).
