# Metis

**A local-first NBA statistics desktop app.** It downloads public data into a DuckDB file on the user's machine and serves a very extensive database of player and team stats through a dashboard for filtering, sorting and comparing. Open source (Apache-2.0).

**Read [decisions.md](decisions.md) and the current stage of [Plan.md](Plan.md) before starting any task.**

---

## The template

`../fantasy-football-companion` is the template for three things: **the user interface, the database structure, and the policy of a very extensive stats database.**

- **It is read-only.** Never change anything in that project or its data (`~/.config/FantasyCompanion`).
- Copy from its last commit, not its working tree: `git -C ../fantasy-football-companion archive HEAD <paths> | tar -x -C .`
- Bring code across when a task needs it, with its tests, and rewrite what is football-specific. Its docs (`docs/reference/stats-database.md`, `stats-screens.md`) explain the design.
- **No fantasy features.** No leagues, rosters, trades, waivers, lineups, projections or advice. Fantasy-related stats on players and teams are allowed, as ordinary metrics.

---

## Stack

| Layer         | Choice                                       |
| ------------- | -------------------------------------------- |
| Desktop shell | Electron, electron-vite, electron-builder    |
| Language      | TypeScript everywhere                        |
| UI            | React, Tailwind 4, Radix (shadcn primitives) |
| Stats storage | DuckDB (`@duckdb/node-api`), in a worker     |
| App settings  | SQLite (`node:sqlite`)                       |
| Tests         | Vitest, Testing Library                      |
| Packages      | npm, Node 22 through nvm in WSL              |

## Layout

```
src/main/          Electron main process
  stats/           The stats database: worker, client, service, schema (only the worker opens it)
  db/              metis.db: app settings and migrations
  dev/             Dev mode and dev notes
src/preload/       The bridge: exposes window.api
src/renderer/src/  React: screens/stats, components/stats, lib/stats
src/shared/        Types and IPC, shared by both sides
tests/             Mirrors src/
scripts/drive.mjs  Runs the built app and follows steps; how UI work is verified
docs/reference/    What the app does and what was measured
```

User data: `~/.config/Metis/` in development, `%APPDATA%\Metis\` packaged. `stats.duckdb` holds the stats and can be deleted; the next refresh rebuilds it. The repo's `data/` folder is a leftover of the old implementation, unused and ignored.

---

## The data policy

The point of the app is depth. From the template:

1. **Every table a source publishes, every column as published and typed, zeros kept.** Only standard columns are normalised (`season`, season type, team codes).
2. **Every season each table offers.** Old seasons are fetched once and sealed; the current one refreshes daily.
3. **Rates are stored as numerator and denominator,** and divided when read, so any date range or group of games is exact. A rate whose parts are published at different times uses sums paired over the same games.
4. **Coverage is honest.** Outside a stat's seasons the answer is `null` with a reason ("Tracked from 2013-14"), never an error and never a fabricated value. A missing source or column reads as NULL and does not fail a rebuild.
5. **Sources sit side by side, never overwritten.** The catalogue says which one each metric reads.
6. **Numbers are checked against the source,** with match rates written down per season. A tolerance is stated, not assumed.

Data comes from sportsdataverse-data releases: `docs/reference/nba-data-sources.md` lists the tables, the measured agreement and **the traps** (season labels, game types, All-Star games filed as regular season, differing ids). Read it before touching the data layer.

**Metis does not call stats.nba.com,** and never disguises a client to get past a site's checks.

---

## Rules

1. **Scope.** Plan.md defines tasks. If one needs more, stop and tell the owner. If a decision is needed that is not in `decisions.md`, ask; do not invent architecture.
2. **Verify on the running app.** A task is not done until checked end to end, not just by its tests. For UI: `npm run build`, then `scripts/drive.mjs`. For data: the real load. PRs touching behaviour carry a "Verified by:" line. Say plainly what could not be checked.
3. **Only the worker opens `stats.duckdb`.** Writes run in turn; each read gets its own connection, so a screen never waits behind a refresh.
4. **Never commit `data/`** or any database file.
5. **Tests:** every formula, every source parser (with a small checked-in fixture), every engine change, every screen's logic in `lib/`.
6. **No new dependency without a reason in the commit message.**
7. **No football left behind.** Nothing copied keeps NFL terms, week logic or spec references that do not exist here.

## Conventions

- `npm run typecheck`, `npm run lint`, `npm test`, `npx prettier --check .` all pass before a commit.
- Season labels are the final year in data (`2026` = 2025-26); screens show `2025-26`.
- Comments explain why, in plain sentences. Screen copy is short and states the fact.
- Use they/them or a name for players in copy and comments.

## Git

- `prod`: what ships. Fast-forward from `preprod` only, after a stage is tested and reviewed; tag `vX.Y-stageN`.
- `preprod`: integration. Merged from `main` when a stage is complete.
- `main`: the trunk. Working branches merge here through a PR, squash preferred.
- Working branches, cut from `main`, named by intent: `feature/`, `fix/`, `chore/`, `docs/`, `refactor/` plus a short slug naming the thing changed (`feature/nba-box-score-load`, not `feature/stage-3`).
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). No force-push on the three long-lived branches.
- `archive/rust-tauri` is the old implementation: keep it, build nothing on it.

## Running it (WSL)

```bash
npm install
npm run dev
```

`--stats-self-test=<file>` checks DuckDB in the built app. In WSL, Electron needs `ELECTRON_DISABLE_SANDBOX=1` or `--no-sandbox`.
