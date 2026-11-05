# Plan

Metis rebuilt in TypeScript on the `fantasy-football-companion` template. See `decisions.md`. A box is ticked only after the check it names has been run on the real app, not just the unit tests.

The template paths named below are read-only references, in `../fantasy-football-companion`.

## Stage 1: Archive the old Metis

- [x] All work in progress committed to `archive/rust-tauri`, tagged `archive/rust-tauri-final`, pushed. Checked: the local branch, remote branch and tag are the same commit.

## Stage 2: The new base

- [x] Generic code copied from the template with no fantasy features: shell, stats worker, DuckDB access, settings, updater, dev tools, design system.
- [x] Checked: typecheck, lint, 126 tests, the worker self-test in real Electron, and `scripts/drive.mjs` through the window (nav, Back, theme, dev note). Windows packaging not yet run (the `check/**` workflow does it).
- [x] NBA dataset inspected and cross-checked: `docs/reference/nba-data-sources.md`.

## Stage 3: The data warehouse

Template: `src/main/stats/{sources,download,load,sync,views}.ts`, `docs/reference/stats-database.md`.

- [ ] **T301 Sources and download.** Finish the asset inventory the API allowance cut short, and read the licence terms. A source registry covering every NBA table; download to temp; a table per source with every column as published.
- [ ] **T302 Sync.** Per source and season: sealed old seasons, daily current season, 404 as skipped, one transaction per step, cancellation, the `sync_log`. Refresh at launch; nav shows progress. Check: quit mid-load, relaunch, it resumes.
- [ ] **T303 First full load.** Measure download size, file size, build time and peak memory against the template's settings (512 MB limit). Record them in the reference. If impractical, stop and raise it (D9).
- [ ] **T304 Game types.** Map every source to one set (D12), All-Star and Cup final handled. Check: 1,230 regular-season games in 2025-26 from both sources.
- [ ] **T305 Identity.** `player` and `team` tables on NBA ids; ESPN through the crosswalk; **a method for 1993-94 to 2000-01**, before the crosswalk starts; relocated franchises as one team. Report the match rate per season.
- [ ] **T306 Agreement checks.** The checks in the reference, as a repeatable script per season, written to the reference. Includes the turnover definitions left open.

## Stage 4: The stats

Template: `src/main/stats/derived/`, `src/main/stats/engine/`, `src/shared/stats/`.

- [ ] **T401 Derived tables.** `player_game`, `team_game`, `player_season`, `team_season`; rates as numerator and denominator; team context for shares.
- [ ] **T402 Catalogue, traditional.** Every box-score metric, per game and totals, per 36 and per 100 possessions.
- [ ] **T403 Catalogue, advanced.** TS%, eFG%, USG%, four factors, offensive and defensive rating, net rating, pace. Each with its first season; outside it a `null` with a reason. Formula tests against published values.
- [ ] **T404 Catalogue, published.** RAPM, BPM, WAR, DARKO, hustle, synergy, matchups, tracking: as the source gives them.
- [ ] **T405 Query engine.** Port compile, run and registry from weeks to game dates (D11); percentiles and qualification per position group (`G`, `F`, `C`).
- [ ] **T406 Play-level splits.** Quarter, clutch, score state, shot zone, from play by play. On/off and lineups from possessions, with their stated tolerance.

## Stage 5: The screens

Template: `src/renderer/src/screens/stats/`, `components/stats/`, `lib/stats/`, `docs/reference/stats-screens.md`.

- [ ] **T501 Scope bar.** Season, season type, date range, last N games.
- [ ] **T502 Leaderboards.** Home boards, the full table, column picker, saved views, CSV.
- [ ] **T503 Player dashboard.** Rail, header, tabs by position group, game log, splits, profile.
- [ ] **T504 Team dashboard.** Header, offense, defense, lineups, schedule, players.
- [ ] **T505 Games.** A day's games, box scores.
- [ ] **T506 Explore.** Chart, Compare, Trends.
- [ ] **T507 Glossary.**

## Stage 6: Ratings and packaging

Template: `src/main/stats/models/`.

- [ ] **T601 Team ratings.** Elo, SRS, opponent-adjusted rating, luck, schedule strength.
- [ ] **T602 Season simulation.** Play-in and best-of-seven series.
- [ ] **T603 Stability.** Metric stability, shrinkage.
- [ ] **T604 Packaging.** Real app icon (currently Electron's default), Windows installer, signed-update check, first release.

## Optional

- [ ] **T701 Fantasy stats.** Fantasy points on players and teams as ordinary metrics: the source's `nba_fantasy_pts` and standard formulas. Nothing else fantasy (D4).
