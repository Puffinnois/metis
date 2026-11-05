# Phase 9.5 audit — findings, patches, improvements

**Date:** 2026-06-26
**Author:** architect (working session)
**Scope:** Plan.md Phase 9.5 — Verification & data integrity
**Status:** read this before opening any Phase 9.5 task

This document is a handoff for the Claude Code sessions that will execute Phase 9.5. It records what was found, what to patch, in what order, and what to verify on each. Each H3 below maps to one task — open one session per task, do not bundle.

---

## 1. Context

After Phases 0–9 shipped, the running Tauri app exhibits two user-visible failures:

- The **Players** nav button doesn't visibly navigate to `/players`.
- Clicking a team's detail page (`/teams/{id}`) renders the page chrome but the stats panel sits on "Loading…" forever.

Investigation produced one architectural root cause (below) that almost certainly explains both symptoms and would have explained more, had more pages been clicked. Phase 9.5 patches that root cause, adds the structural guard that would have caught it pre-merge, and is now complete enough to gate Phase 10+.

---

## 2. Root cause

`crates/metis-tauri/src/main.rs` registers Tauri commands via `tauri::generate_handler![...]` and **does not start an HTTP server**. There is no `axum::serve` call inside the Tauri `setup` closure (verified: only `tauri::Builder::default()` at `crates/metis-tauri/src/main.rs:476`; no `bind`, `listen`, or `axum::serve` anywhere in `crates/metis-tauri/src/`).

`frontend/src/lib/api.ts` declares:

```ts
const HTTP_BASE = "http://127.0.0.1:3000";
```

…and routes a mix of requests through `tauriInvoke` and `httpGet`. The pattern is inconsistent:

| API client function | Path inside the Tauri app | Outcome |
|---|---|---|
| `listPlayers`, `listTeams`, `listSeasons`, `listPlayerStats`, `listViews` | tries `tauriInvoke` first, falls back to HTTP | works (the Tauri command exists) |
| **`getTeam(id)`** | **HTTP only** — no Tauri attempt | **fails/hangs** in the Tauri app |
| `getPlayer(id)` | HTTP only | broken (would manifest the same as team detail) |
| `listGames`, `getGame` | HTTP only | broken |
| `getPlayerGameLog` | tries Tauri, falls back to returning `[]` | silently empties on Tauri command mismatch |

So `getTeam(id)` on the team detail page goes straight to `http://127.0.0.1:3000/teams/{id}`. Nothing is listening on port 3000. The fetch eventually times out or hangs (behavior is WebView2-dependent), but because `onMount` wraps both `getTeam` and `listSeasons` in a single `Promise.all`, the page never advances to `fetchRoster()`, and `rosterLoading` (initialized to `true`) is never flipped — hence the indefinite spinner.

The Players button is almost certainly the same class of bug: `/players/+page.svelte` mounts, fires an HTTP-only call (or hits a sibling component that does), throws inside the mount handler, and the user perceives "nothing happened." Confirm by opening Tauri devtools (right-click → Inspect Element → Console) once the patches in §3 are written but before they are applied — the actual stack trace will be there.

### Why the existing acceptance criteria didn't catch this

- Unit tests in `metis-tauri` exercise individual commands (`get_teams`, `get_seasons`) in isolation — none of them prove the *frontend* invokes the right commands.
- `metis-api` unit tests pass because the HTTP handlers themselves are fine; they're just unreachable when the user runs Tauri without separately starting `metis-api`.
- `scripts/smoke.sh` runs the API and verifies `curl /players` works. That step passes because smoke explicitly starts the API process; it does not exercise the in-Tauri code path.

This is the gap CLAUDE.md rule 13 (added in this phase) and Plan.md task T094 (contract enforcement) are meant to close permanently.

---

## 3. Patches

Each subsection is a self-contained task. Apply in order; later tasks depend on earlier ones being merged. Acceptance criteria are quoted exactly so a fresh session can copy them into the PR description.

### 3.1 T096 — Add Tauri commands for every HTTP-only api.ts function

**Files to edit:**
- `crates/metis-tauri/src/main.rs` — add new command functions and add their names to the `tauri::generate_handler![...]` block (around line 510).
- `frontend/src/lib/api.ts` — switch the affected functions to prefer `tauriInvoke` first, fall back to HTTP only as a debugging convenience.

**Commands to add** (Rust handler names → frontend function name):

| Rust command | Wraps repo call | Used by |
|---|---|---|
| `get_team(id: String)` | `TeamRepo::find_by_id` | `getTeam` |
| `get_player(id: String)` | `PlayerRepo::find_by_id` | `getPlayer` |
| `list_games(params)` | `GameRepo::list_by_season` + filters | `listGames` |
| `get_game(id: String)` | `GameRepo::find_by_id` | `getGame` |

Mirror the existing patterns from `get_players` / `get_teams` (already in `main.rs:179` / `:198`). Return the same DTO types the HTTP handlers return — import them from `metis_api::dto` if they're already shared, otherwise define them in a shared crate (probably worth extracting `metis-api/src/dto.rs` into `metis-core::dto` if not already done — see §4.1).

**Frontend pattern** (apply to every affected function):

```ts
export async function getTeam(id: string) {
  try {
    return await tauriInvoke<TeamItemResponse>("get_team", { id });
  } catch {
    return httpGet<TeamItemResponse>(`/teams/${encodeURIComponent(id)}`);
  }
}
```

**Acceptance:**
1. `python scripts/verify.py --no-api` → Layer 3 reports zero FAILs (no HTTP-only functions, no missing-command bindings).
2. In the running Tauri app: navigate to `/players`, `/teams`, click a team to land on `/teams/{id}`, click a player to land on `/players/{id}`. Every page renders real data within 1s. No spinners. No console errors.
3. PR description includes a "Verified by:" line per rule 13, listing each route exercised.

---

### 3.2 T097 — Make HTTP-only the explicit failure mode, not the silent default

The current `try { tauriInvoke } catch { httpGet }` pattern in `api.ts` hides Tauri command failures by silently falling back to HTTP. That's exactly how T096's class of bug went undetected: the frontend "works" against a running HTTP server, and the HTTP path masks the absence of a Tauri command.

**Fix:** When running inside Tauri (detectable via `window.__TAURI_INTERNALS__` or `import.meta.env.TAURI`), the fallback should **rethrow**, not silently call `httpGet`. The HTTP path stays for two legitimate uses: (a) running the frontend in a plain browser pointed at `metis-api` during dev, (b) smoke tests via curl.

**Implementation sketch** for `api.ts`:

```ts
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invokeOrHttp<T>(command: string, args: any, httpFn: () => Promise<T>): Promise<T> {
  if (IS_TAURI) {
    return tauriInvoke<T>(command, args);
  }
  try {
    return await tauriInvoke<T>(command, args);
  } catch {
    return httpFn();
  }
}
```

Refactor every Tauri-with-fallback function to use this helper. In a Tauri build, a missing/broken command now produces a visible error in the UI instead of a transparent HTTP call to a server that isn't running.

**Acceptance:**
1. Deliberately rename one Tauri command in `main.rs` and confirm the corresponding page shows an error toast or error state in dev (not a hang, not silent empty data). Revert the rename before commit.
2. `pnpm build` succeeds.
3. Running the frontend via `vite dev` (outside Tauri) against a running `metis-api` still works — fallback path exercised.

---

### 3.3 T098 — Tauri command harness for non-Tauri smoke testing

The biggest reason the bug shipped: there is no programmatic way to invoke Tauri commands from outside the Tauri app, so neither CI nor `smoke.sh` can exercise them. `verify.py`'s Layer 3 is a static check (good catch for missing-command bugs) but it cannot verify that a command actually returns correct data.

**Build a `metis-cli probe-tauri` subcommand** (Rust binary in `metis-cli`) that constructs a `Db` the same way the Tauri `setup` closure does and directly calls each `#[tauri::command]` function (or refactor the commands so their *bodies* are plain functions that the Tauri shim and the CLI both call — see §4.2).

The probe runs every command with a sensible default input, validates the response is non-empty, and prints a per-command pass/fail. Wire it into CI as a follow-up to the migration step.

**Acceptance:**
1. `metis-cli probe-tauri` exits 0 on a healthy DB, exits 1 with a clear diagnostic on any command failure.
2. CI runs it after migrations and DB seeding.
3. Removing a Tauri command from `generate_handler!` (without updating its callers) causes the probe to fail in CI — verified by a deliberate, reverted experiment in the PR.

---

### 3.4 T099 — Fix the spinner-forever pattern in team detail (and audit siblings)

Even after T096, the `onMount` pattern in `frontend/src/routes/teams/[id]/+page.svelte` is fragile: if any of the parallel calls inside `Promise.all` hangs (rather than rejects), `rosterLoading` stays `true` forever.

**Pattern to enforce across every page that loads async data:**

1. Every `await` inside an `onMount` is wrapped with a `Promise.race` against a 10s timeout that throws.
2. Every fetch path has a `finally` that flips the loading flag, regardless of resolve/reject/timeout.
3. Loading states render a `<button>Retry</button>` after timeout so the user has an out.

**Apply to:**
- `frontend/src/routes/teams/[id]/+page.svelte`
- `frontend/src/routes/players/[id]/+page.svelte`
- `frontend/src/routes/teams/+page.svelte`
- `frontend/src/routes/players/+page.svelte`
- `frontend/src/routes/+page.svelte`

Extract the pattern into `frontend/src/lib/async.ts` (`withTimeout`, `useAsyncState`, whatever shape feels natural) so it's a single function call per data load, not five lines of boilerplate per route.

**Acceptance:**
1. With T096 reverted (deliberately, to simulate a broken backend), every page shows an error state with a retry button within 10s. Re-apply T096 before commit.
2. New unit test covering the timeout/retry helper.
3. No page in the app has a literal `let loading = $state(true)` that isn't flipped via the helper.

---

### 3.5 T100 — Wire verify.py into CI

The new `scripts/verify.py` (added this phase) catches the *class* of bug that produced this incident. It must run on every PR.

**Implementation:**
- Add a job to `.github/workflows/ci.yml` that runs `python scripts/verify.py --no-api`. Use a cached DuckDB fixture (a tiny seeded DB committed to `crates/metis-db/tests/fixtures/`) so the integrity layers have something to check against in CI.
- The job depends on the Rust build job (`metis-tauri/src/main.rs` must be a parseable file at the time the script runs — though the parity check is regex-based and doesn't need a compiled artifact, the Rust build still gates merging).

**Acceptance:**
1. CI fails on a PR that adds a `tauriInvoke("nonexistent")` call.
2. CI fails on a PR that removes a registered Tauri command without removing its callers.
3. CI fails on a PR that introduces an HTTP-only api.ts function (after T097 lands).

---

### 3.6 T101 — Document the dev-mode invariant in CLAUDE.md

Add a one-line invariant to the **Frontend** conventions in CLAUDE.md so future sessions don't reintroduce this bug:

> Every async data call from the frontend goes through a Tauri command when running inside Tauri. HTTP paths exist only for non-Tauri dev (`vite dev`) and curl/smoke testing — never as a silent fallback in production builds. See `frontend/src/lib/api.ts` `invokeOrHttp` helper.

Also update the "Tech stack" row for the API to clarify:

> Core / compute / API: Rust (workspace of crates). **Inside Tauri, the API is exposed via Tauri commands, not over HTTP. The axum HTTP server is for CLI/curl/smoke-test use only.**

**Acceptance:** CLAUDE.md updated. No code changes.

---

## 4. Bigger-picture improvements (not strictly Phase 9.5)

These are deferred to dedicated tasks, but they came up while reading the code and are worth queuing.

### 4.1 Hoist DTOs into a shared crate

Right now DTOs (`PlayerDto`, `TeamDto`, `PlayerStatsRowDto`) seem to live in `metis-api`, and `metis-tauri` imports them. As more Tauri commands appear (T096), this dependency direction is fine — but every Tauri command will define its arg/result types ad-hoc unless there's a single source. Extract `crates/metis-core/src/dto.rs` (or a new `metis-contracts` crate) so:

- One canonical DTO definition.
- OpenAPI codegen (T094) reads from one place.
- TypeScript types are generated from one place.

Without this, T094's contract enforcement is enforcing a contract whose Rust source is fragmented.

### 4.2 Make Tauri commands one-liners over a pure-function service layer

Currently a Tauri command embeds DB calls, error mapping, and state access in the command body. That's why the harness in T098 has to "construct a Db the same way the Tauri setup does." Refactor:

```rust
// crates/metis-api/src/service.rs  (pure functions, easy to test, callable from anywhere)
pub fn get_team(db: &Db, id: &str) -> Result<TeamItemResponse, ServiceError> { ... }

// crates/metis-tauri/src/main.rs  (thin shim)
#[tauri::command]
fn get_team(state: tauri::State<'_, DbState>, id: String) -> Result<TeamItemResponse, String> {
    let db = state.lock().unwrap();
    db.as_ref()
        .ok_or_else(|| "db not loaded".into())
        .and_then(|d| service::get_team(d, &id).map_err(|e| e.to_string()))
}
```

The HTTP handlers in `metis-api` should also become thin shims over the same service functions. One service layer, three callers (HTTP, Tauri, CLI probe). T098's harness then becomes trivial: just call the service functions directly with a test Db.

### 4.3 Design system task — start the editorial direction

Per the prior conversation about design inspiration (The Ringer / The Athletic, editorial typography over data density), **T095 from Phase 9.6** is ready to go once Phase 9.5 closes. Specifically:

- Pick a free serif (recommend *Fraunces*) and sans pairing (recommend *Geist* or *Inter*).
- Build `frontend/src/routes/style/+page.svelte` as a single page demoing every primitive (type scale, button states, table density, empty/loading/error states, color tokens). This becomes the design contract every subsequent page is graded against.
- Land design tokens in `frontend/src/app.css` and a `frontend/src/lib/design.md` style guide.

Do this *before* polishing individual pages — a per-page polish pass without a system regresses every other page.

### 4.4 Consider a feature flag for "show me the seams"

A developer-only setting (gated on `import.meta.env.DEV` or a localStorage flag) that renders, on every data view:
- The source of every stat shown (nba_stats vs bref vs canonical).
- The age of the data (`fetched_at` per row).
- A "raw payload" expandable for any cell.

This is invaluable for diagnosing reconciliation issues in Phase 4+ work and costs ~half a day to build. Worth a dedicated task in Phase 11 or as a side-quest.

---

## 5. Verification — how the supervisor confirms each task

For every task above, the merge gate is the same three-step protocol (per CLAUDE.md rule 13):

1. **Mechanical:** `cargo test && (cd python && uv run pytest) && (cd frontend && pnpm test) && cargo clippy -D warnings && python scripts/verify.py --no-api` all green.
2. **Manual UI:** open the running Tauri app, click through every v1 route. Take a screenshot for the PR.
3. **Regression poke:** for the task that fixed the original bug (T096), explicitly revert one symptom inducer (e.g. rename a Tauri command), confirm the new guard catches it (verify.py fails, or UI shows error not hang), then revert the revert.

If a task can't be verified by the above, it's not done — flag it back to the supervisor with what's missing.
