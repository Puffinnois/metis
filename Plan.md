# Plan

Metis rebuilt in TypeScript on the `fantasy-football-companion` template. See `decisions.md`. A box is ticked only after the check it names has been run on the real app, not just the unit tests.

The template paths named below are read-only references, in `../fantasy-football-companion`.

## The goal

Version 1.0 is done when all of this is true on a clean Windows machine:

1. **The data:** every table and season the dataset publishes is loaded, apart from files proven to repeat others (D23); the current season refreshes daily, and agreement with the source is written down per season.
2. **The stats:** each of the 443 entries in `docs/reference/nba-statistics.md` (sections 3 to 18) is in the catalogue with its coverage, or listed as unavailable with the reason.
3. **The screens:** Leaderboards, Players, Teams, Explore, Games and Glossary answer from that catalogue, and a gap always says why.
4. **The release:** an installer with a real icon, signed updates, and credit to the data sources.

No fantasy features at any point (D4).

## What this plan is built on

Measured 2026-11-05. Details are in `docs/reference/nba-data-sources.md`.

| Fact                                                                                       | What it means for the work                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 44 NBA releases: 3,107 Parquet files, 1,691 MB. The template's whole download was 210 MB   | Eight times the template's scale. Size, memory and first-load time must be measured early, not assumed  |
| Play by play alone is 879 MB. The core box scores and schedules are 100 MB                 | Load in order of value, so the app is useful long before the load ends                                  |
| 124 current-season files, 16 MB today. A finished season's files are 84 MB                 | A daily refresh is cheap at first and grows through the season                                          |
| GitHub's anonymous API allows 60 calls an hour. 40 of 44 releases publish `timestamp.json` | The app must not depend on the GitHub API. File names and freshness files replace it                    |
| Hustle and play types have no game column                                                  | "Any date range is exact" cannot hold for them: a date range answers `null` with a reason               |
| The `nba_player_impact` columns are the dataset's own calculations                         | RAPM, BPM, WAR and DARKO must be labelled as SportsDataverse's, not the original publishers'            |
| The template holds about 29,000 lines of stats code, much of it bound to the NFL           | Porting is mostly rewriting, so it is done a screen at a time, with the data each screen needs in place |

## How the work is organized

**Each stage ends with something the owner can use.** The earlier draft of this plan built in layers, with the data first and every screen last, so nothing could be judged until the end. Now each stage takes a slice from the data through to the screen, then the next one adds depth.

| Stage              | At the end, the owner can…                                    | Data added      | Tag            |
| ------------------ | ------------------------------------------------------------- | --------------- | -------------- |
| 1, 2 Archive, base | Open an empty app (done)                                      |                 |                |
| 3 Clean slate      | See one clear project on GitHub, with Windows packaging run   |                 | `v0.1-stage3`  |
| 4 Data foundation  | Load everything, quit, resume, and read the agreement report  | All 1,554 MB    | `v0.2-stage4`  |
| 5 First usable app | Rank anyone on any box-score stat, 1993-94 to now             | Core in use     | `v0.3-stage5`  |
| 6 Dashboards       | Open a player, a team or a game                               | Core in use     | `v0.4-stage6`  |
| 7 Published depth  | See tracking, hustle, play types, matchups, impact, combine   | 214 MB in use   | `v0.5-stage7`  |
| 8 Explore          | Chart any stat against another, compare, follow a career      |                 | `v0.6-stage8`  |
| 9 Play level       | Split by clutch or quarter, read shot charts, on/off, lineups | 1,239 MB in use | `v0.7-stage9`  |
| 10 Ratings         | See Elo, SRS, playoff odds, PER, Win Shares, stability        |                 | `v0.8-stage10` |
| 11 Ship            | Install it on any Windows machine                             |                 | `v1.0-stage11` |

**Order:** 3 → 4 → 5 → 6, then 7 and 8 in either order, then 9 → 10 → 11.

**Every task:** a branch cut from `main`, named by intent; one PR with a "Verified by:" line; squash-merged once `check` passes. Sizes: **S** is a small PR, **M** one full PR, **L** several PRs.

**Every stage ends with this gate:**

- All its boxes ticked, each with its check run.
- A real load on a clean profile, then `scripts/drive.mjs` through the stage's screens, with no errors in the app log.
- A `check/**` branch run, so the Windows build and self-test pass.
- `docs/reference/` updated: `stats-database.md` and `stats-screens.md` start in Stage 4 and 5 and grow from there.
- Speed held: a screen's queries answer in under 500 ms on the full database, or the reason is written down.
- The owner tries it. Then `main` into `preprod` into `prod`, and the tag.

**Running tasks at the same time:** Stages 6, 7 and 8 have tasks that can each run in their own worktree. To allow that, T503 splits the catalogue into one file per family, so tasks adding metrics do not collide.

## Stage 1: Archive the old Metis

- [x] All work in progress committed to `archive/rust-tauri`, tagged `archive/rust-tauri-final`, pushed. Checked: the local branch, remote branch and tag are the same commit.

## Stage 2: The new base

- [x] Generic code copied from the template with no fantasy features: shell, stats worker, DuckDB access, settings, updater, dev tools, design system.
- [x] Checked: typecheck, lint, 126 tests, the worker self-test in real Electron, and `scripts/drive.mjs` through the window (nav, Back, theme, dev note). Windows packaging not yet run: T304.
- [x] NBA dataset inspected and cross-checked: `docs/reference/nba-data-sources.md`.
- [x] Merged to `main` through PR 5.
- [x] Full asset inventory read: 44 releases, 3,107 Parquet files.

## Stage 3: Clean slate

Done 2026-11-05, approved by the owner. T303 ran last, so its tag includes the rest of the stage. Gate: no data to load yet; the build, `scripts/drive.mjs` on a clean profile and the self-test passed on the promoted tree.

- [x] **T301 Repository settings (S).** Closed PR 4: its head was `main`, so it had come to carry the restart under its old "Phase 5" title. `main` is the default branch. Checked: GitHub reports `main` as the default, with no open PRs.
- [x] **T302 Old branches (S).** Tagged under `archive/` every old branch holding commits found nowhere else: `feature/pbpstats-possession-lineup-adapter`, `feature/possession-lineup-migrations`, `feature/season-rollups`, `task/002-pre-commit-ci`, and `preprod-local` for a commit only the local `preprod` held. Deleted the old branches, local and remote, and the old agent worktree that had one checked out (13 GB of Rust build output). Checked: only `main`, `preprod`, `prod` and `archive/rust-tauri` remain. Every old tip is reachable, apart from the two squash-merged ones: their trees are on `main`, and GitHub keeps their commits through PR 5 and PR 6.
- [x] **T303 Promote the base (S).** Fast-forwarded `main` into `preprod` into `prod`, which is now on GitHub, and tagged `v0.1-stage3` at `e8570b9`. Protected the three branches: no force-push or deletion, `check` required, for admins too (D25). Checked: a test push to `main` was refused (GH006), and the tag started no Release run (D26). A promotion under protection is first exercised at the end of Stage 4.
- [x] **T304 Windows check (S).** Pushed a `check/**` branch, since Windows is the real target and had never been built. Checked: run 42116214193 on `273711f` passed the Windows build, all 21 test files and the packaged self-test. It builds the unpacked app; the installer waits for T1103.
- [x] **T305 Documents (S).** Moved the reference to `docs/reference/nba-statistics.md`, fixed its links, and used they/them where it said he or his. D6 and D13 updated, D20 to D26 added, `CLAUDE.md` brought in line. The Release workflow now ignores stage tags. Checked: `npx prettier --check .`, and every relative link in the changed documents resolves.

## Stage 4: Data foundation

Template: `src/main/stats/{sources,download,load,sync,identity}.ts`, `docs/reference/stats-database.md`.

Outcome: the app downloads everything, keeps it fresh, survives being quit, and reports how far the numbers agree.

Done 2026-11-06, approved by the owner, and tagged `v0.2-stage4` at `36b3f62`. Gate, 2026-11-05: a full load through the real window on a clean profile loaded 3,025 of 3,025 files with no errors in the log, in 23.8 minutes, into 4.2 GB. On that database the Data panel reads in 27 ms and the status line in 8 ms, and the agreement report finds no problems. The Windows build, all 32 test files and the packaged self-test pass; the first Windows run caught a test that failed on CRLF line endings. Not checked: a full load on Windows (T1104).

- [x] **T401 Source registry (M).** Every release, its file-name pattern, seasons, grain and load tier. `scripts/inventory-sources.mjs` rebuilds the list from the GitHub API at development time; the app itself never calls that API. Checked: a test compares the registry with `tests/fixtures/nba-inventory.tsv`, and a real run of the script listed 3,107 files in 44 releases, all of them in the registry.
- [x] **T402 Download and load (M).** Download to temp; one table per source, with every column as published and typed; type widening when a later season changes a column. `season` stays as published, with `file_season` and `source_file` added; season types and team codes are mapped in T407 and T408 (D27). Few downloads at once, retries with backoff, a plain client name. Checked: a fixture per file shape, and every tier in the full load, with no errors.
- [x] **T403 Sync (L).** Per source and season: old seasons sealed, the prior season weekly, the current one daily; 404 as skipped; one transaction per step; cancellation; the `sync_log`. Freshness from each file's `etag`, because `timestamp.json` turned out to be stale. Refresh at launch, progress in the nav. Checked: the real window showed "updating 71 of 3,152 files"; killed mid-load, it reopened and carried on with 3,081 left. A second run did nothing, and a forced check of 176 files took 12 seconds, with 132 unchanged and 44 not published.
- [x] **T404 Load order (S).** Core, then published, events, play by play; inside a tier, the newest season first. Each finished tier can be read while the next loads. Checked: a leaderboard-shaped query answered during the play-by-play load in 14 ms (median of 12), 29 ms at worst.
- [x] **T405 First full load (M).** Everything, once, from nothing, measured per tier. Checked: 3,025 files with no errors in 19.8 minutes (14.4 on a quieter run), a 4.3 GB file and a 2.2 GB memory peak, all inside D22. The template's 512 MB failed and invalidated the database, so the limit is now 1 GB; 768 MB also passed. The numbers are in `docs/reference/nba-data-sources.md`.
- [x] **T406 Coverage and duplicates (M).** Per family, the first season holding real values, not just rows: the pull-up file for 1996-97 has only games and minutes, and its stats start in 2013-14. `*_master` is proven to repeat other files and no longer loads (82 files, 138 MB); per-game files and `nba_stats_lineups` are not, and stay (D23). `metric_curves` holds FG% by shot distance, `rolling_windows` FG% and 3P% over recent attempts. Checked: `docs/reference/nba-coverage.md` and `nba-coverage.tsv`, written from the real load, cover 92 tables and 3,513 columns, and later supply each metric's first season.
- [x] **T407 Game types (M).** One set (D12) in the `game` table: the prefix of the NBA's game id from 1996-97, ESPN's season type before it, touring teams and postponed rows handled. Checked: 33 of 33 finished seasons match their real length, including the short ones and the game cancelled in 2013, and 2025-26 has 1,230 regular-season games with both sources' ids.
- [x] **T408 Identity (L).** `game`, `team_season`, `player_ids` and `player` on NBA ids, built as soon as the core tier is in. Teams through `nba_team_aliases`, one franchise across moves, conference and division by season. Players through the crosswalk, then matching box-score lines, then the same name, since the crosswalk starts in 2001-02 and misses players like Yao Ming. Players only ESPN knows get a negative id (D28). Checked: from 1996-97 all but one line of a player who played is on an NBA id; of 363 box-score matches, 352 share a last name and the other 11 are real variants (Nene Hilario, Ming Yao). Rates per season are in `docs/reference/nba-agreement.md`.
- [x] **T409 Agreement checks (M).** `scripts/check-agreement.mjs` runs the checks per season and writes `docs/reference/nba-agreement.md`. The turnover question is answered: ESPN's team columns change meaning by era, and the sum of its players' lines does not. Checked: run on the full load, and it fails on a wrong season length or team count.
- [x] **T410 Data panel (M).** New, since the template has no equivalent, and a 1.7 GB load cannot hide in a status line. Opened from the status line. Per release: state, seasons held, files, size, last fetched, last error. Disk used, a free-space check before the first load, pause and resume, the data credit. Checked: `drive.mjs` on a clean profile opened the panel mid-load, paused, resumed and paused again; a relaunch stayed paused, and Resume carried on, with no errors in the app log.

## Stage 5: First usable app

Template: `src/main/stats/derived/`, `src/main/stats/engine/`, `src/shared/stats/`, `src/renderer/src/{screens,lib}/stats/`.

Outcome: rank any player or team on any box-score stat, any season from 1993-94, any date range.

Done 2026-11-06, approved by the owner, and tagged `v0.3-stage5` at `62b0407`. Gate, 2026-11-06: a full load through the real window on a clean profile loaded 3,025 files with no errors in 15.9 minutes, into 4.3 GB, with 45 not published yet. The boards were on screen 175 seconds in, while the load went on, and the table answered in 103 to 389 ms during play by play. On the full database, every click reaches its table in under 330 ms. In the window, 289 rows across five seasons match the raw box scores on every column compared. The Windows build, all 43 test files and the packaged self-test, which now runs a query, pass. Not checked: a full load on Windows (T1104), and CSV's save dialog, which cannot be driven.

- [x] **T501 Game tables (L).** `player_game`, `team_game`: numerators and denominators, minutes in seconds from both sources' forms, team and opponent context, starter flag, estimated possessions (named as an estimate). Team totals come from the NBA's box score, or ESPN's players summed before 1996-97, never ESPN's team columns. Checked: formula tests, then on the full load 863,680 player lines with no duplicates. Players sum to their team on 99.9–100 % of team-games, on every count, and each season is in `docs/reference/nba-agreement.md`. The real build found what the fixtures could not: games where ESPN flags no starters, a cancelled All-Star Game, and 34 lines of zeros.
- [x] **T502 Season tables (M).** `player_season`, `team_season`. A traded player gets a row per team and a season total, never added together. Checked: the top 20 scorers against `nba_stats_player_season_stats` match on points and games, 20 of 20, in every season from 1996-97. Wins and losses match for every team. Match rates per season are in `docs/reference/nba-agreement.md`. The identity table `team_season` became `team`, as D27 already calls it, so the name could hold these.
- [x] **T503 Catalogue, core (L).** One file per family. Each metric states the fields of reference section 19.4: grain, kind (recorded, derived, estimated, model), aggregation rule, unit, sample, direction, sources, first season. Reference sections 3, 4, 5 (estimates), 6, and 14.1 (Efficiency, Game Score, PIE). Checked: a test per formula against a worked value, which fails for a metric without one, and the formulas through the real engine against the NBA's published rates per season in `docs/reference/nba-agreement.md`. FG%, 3P%, FT%, eFG%, TS%, 3PAr and scoring shares match 96.6–100 % of players within rounding. PIE follows the reference and does not match: the published figure behaves like an on-court share, which T702 brings in beside it.
- [x] **T504 Query engine (L).** Port compile, run and registry (1,666 lines) from weeks to game dates (D11). Last N, separately for a player's appearances and a team's games; home and road, opponent, conference, division, month, before and after the All-Star break, rest days, starter or bench, wins and losses. Totals, per game, per 36, per 48, per 100. Percentiles and qualification by position group (`G`, `F`, `C`, with hybrids mapped), scaled to team games so short seasons qualify fairly. Checked: engine tests over real tables built from fixtures, then `scripts/engine-speed.mjs` on the full database: every query a screen asks under 500 ms, 463 ms at worst for 40 columns. The heaviest measured, every season by season for all players, took 568 ms at worst; no screen asks it yet, and Trends (T803) will ask it for one position. The table is in `docs/reference/stats-database.md`. The packaged self-test now runs a query too, for the Windows build.
- [x] **T505 Scope bar (S).** Season, season type, date range, last N. Checked: `drive.mjs` on the full database, through each of them, including last N of a team's games and a date range held inside its season. In the window, playoffs match the published totals, the play-in, the Cup final and every game that counts match the raw box scores, and a season without a type falls back to the regular season.
- [x] **T506 Leaderboards (L).** Home boards, the full table, column picker, saved views, CSV, and a re-read when a refresh ends. Template: `StatsHome`, `StatsLeaderboard`, `lib/stats/{leaderboard,boards}.ts`. Checked: `drive.mjs` on the full database. 289 rows shown in the window, across five seasons, match the raw box scores on every column compared, and 269 of them the published totals too. The other 20, mostly from 1996-97, are the source's box scores and its published totals disagreeing by a little. A view saved in the window was still there after a relaunch, opened and deleted. CSV is checked by tests only: its save dialog cannot be driven.
- [x] **T507 Glossary (S).** Every metric, by family or search, with its coverage. Checked: `drive.mjs`.

## Stage 6: Dashboards

Template: `StatsPlayer`, `StatsTeam`, `StatsGames`, `lib/stats/{player,team,games}.ts`, `docs/reference/stats-screens.md`.

Outcome: open any player, team or game. NBA dashboards are not split by position as the NFL's are, so one set of tabs serves everyone, and later stages add to it.

- [x] **T601 Player dashboard (L).** Rail, header, Overview, Scoring, Shooting, Playmaking, Rebounding, Defense. Checked: `drive.mjs` on the full database through the rail, the header and every tab, with no errors in the log. Michael Jordan in 1994-95 reads his plus-minus as "Recorded from 1996-97.", his career lists 1998-99 to 2000-01 as "No games", 1999-00 says he played no games, and his career plus-minus per game is left out rather than dividing by games it was not recorded in. Players have initials, not photos: Metis fetches none.
- [x] **T602 Game log and splits (M).** Every game; splits from T504. Checked: in the window, the log of Shawn Marion's 2008-09, traded from Miami to Toronto, adds up to its total line over 69 games on points, rebounds, assists, steals and blocks, and that total equals the raw NBA box scores (891, 589, 139, 88, 66). So does Luka Dončić's 2026-27. Across every season, every player's game rows add up to their season row with no exceptions. The screen says so if a log ever stops adding up.
- [ ] **T603 Team dashboard (L).** Header with record and standing, results strip, Overview, Offense, Defense, Players, Schedule. Check: `drive.mjs`, and a relocated franchise across seasons.
- [ ] **T604 Standings (S).** Conference and division tables, games behind, streaks, from the published standings. Check: against the source on three seasons.
- [ ] **T605 Games (L).** A day's games on a date rail, in place of the template's weeks; box scores. Check: `drive.mjs`, and box totals against the final score.

## Stage 7: Published depth

Outcome: everything the dataset publishes per season, on the screens. Tasks T702 to T710 can run side by side once T701 is in.

- [ ] **T701 Season-grain metrics (M).** The engine learns metrics with no game grain: under a date range they answer `null` with the reason "Published for whole seasons only." Rates divide by the tracked games and minutes, not the official ones. Check: engine tests.
- [ ] **T702 NBA advanced, misc, scoring, usage, defense (M).** Reference sections 4 to 6, as published, beside the formula versions (D14). Same-named stats with different definitions keep different ids. Check: the differences are measured and reported.
- [ ] **T703 Tracking (M).** Twelve families, from 2013-14, players only: speed, touches, drives, passing, rebounding, catch-and-shoot, pull-ups, touches by area, defense. Reference section 8. Check: against source, with a tracking tab on the dashboard.
- [ ] **T704 Hustle (S).** Reference section 9, players and teams. Check: against source.
- [ ] **T705 Play types (M).** Eleven types, offense and, where published, defense. Reference section 11. Check: against source, with its own tab.
- [ ] **T706 Season matchups (M).** Pair matchups and position rollups. Reference section 10.2. Check: against source.
- [ ] **T707 Impact models (S).** RAPM, adjusted RAPM, SPM, BPM, WAR, DARKO, labelled as SportsDataverse's calculations; play-in games are excluded from them. Its DARKO column projects next season, so it reads as a published value, not advice. Check: the label is on the column head and in the Glossary.
- [ ] **T708 Profile (M).** Bio, draft, every combine table with percentiles among the same positions. Reference section 17. Missing tests stay blank. Check: `drive.mjs`, including a player who skipped a drill.
- [ ] **T709 Availability (M).** Status tag from the injury report; games missed, counted by game and not by report; coaches and officials. Check: repeated reports count once.
- [ ] **T710 Published lineups (M).** Five-man units from 2007-08, on the team dashboard's Lineups tab. Check: against source.

## Stage 8: Explore

Template: `StatsExplore`, `StatsChart`, `StatsCompare`, `StatsTrends`, `lib/stats/{chart,compare,trends}.ts`. Each task can run on its own.

- [ ] **T801 Chart (L).** Any metric against another, with presets, size and colour, and states for too few qualifiers. Check: `drive.mjs`.
- [ ] **T802 Compare (M).** Three slots, players or teams. Check: `drive.mjs`, and links from the dashboards.
- [ ] **T803 Trends (L).** A metric by season across a career, with league bands and coverage notes. Each season ranked in its own pool. Check: `drive.mjs`, on a career crossing a coverage start.

## Stage 9: Play level

Template: `src/main/stats/derived/plays.ts`, `engine/compile.ts`. This is the slowest and riskiest data, so it comes after the screens that show it are stable.

- [ ] **T901 Event tables (L).** Both play-by-play sources, shots and possessions; a `plays` view with counting flags. Check: scores and box scores rebuilt from plays, with a match rate per season and a stated tolerance. Possessions are derived, not official: 2,327 of 2,644 team-games exact in 2025-26.
- [ ] **T902 Splits from plays (L).** Quarter, clutch, score state, last minutes, garbage time, each with its rule stated (reference section 12). Check: clutch totals against a hand count on a sample game.
- [ ] **T903 Shots (L).** Zones, distance, types, relative to league, and a shot chart. Reference section 7. NBA coordinates and ESPN's are kept apart. Check: zone sums equal shot totals.
- [ ] **T904 On/off and lineups (L).** From possessions: on and off court, with-or-without, two- to five-man groups, actual on-court rates named apart from the box-score estimates (reference sections 4, 5, 12). Check: against published lineup tables, with the tolerance stated: before 2017-18, possessions are within 5 points on about 96 % of team-games.
- [ ] **T905 Play-derived stats (L).** Turnover and foul types, and-ones, assisted and unassisted shots, assist networks, runs, droughts, lead changes, a game-flow chart. Reference section 16. Check: validated against box scores before anything is shown.
- [ ] **T906 Game matchups and officials (M).** Game-grain matchups, and officiating rates stated without implying bias. Check: against the season matchups.
- [ ] **T907 Speed at full scale (M).** Pre-aggregate where the budget demands it, then measure 31 seasons of plays. Check: speed recorded in `stats-screens.md`.

## Stage 10: Ratings

Template: `src/main/stats/models/`. The template's field-goal model, fantasy tables and player outlook do not come across.

- [ ] **T1001 Team strength (M).** Margin of victory, SRS, Pythagorean wins, the win residual, schedule strength. Check: formula tests, and SRS solved on a past season.
- [ ] **T1002 Elo (M).** Sequential ratings with home court and between-season regression. Check: Brier score reported.
- [ ] **T1003 Season simulation (L).** The remaining games, the play-in, best-of-seven series, the NBA's tiebreakers. Check: reproduces the real playoff fields of past seasons.
- [ ] **T1004 Adjusted ratings (M).** Offense and defense adjusted for opponent, per possession. Check: against SRS, with differences reported.
- [ ] **T1005 Box-score composites (L).** Oliver's points produced and ratings, PER, Win Shares, VORP, from their published methods, with era limits stated and labelled as computed by Metis. Check: a test per formula, with worked values.
- [ ] **T1006 Stability (M).** Metric stability, shrinkage and the league indexes (`TS+`). Check: each metric carries its stability, shown on the column head.

## Stage 11: Ship

- [ ] **T1101 Rights and credit (S).** Read the terms of the dataset and its upstreams. The repository's licence file says MIT and its README shows CC BY 4.0; neither speaks for ESPN or the NBA. Credit in the app and the README. Raise anything unclear with the owner before release.
- [ ] **T1102 App icon (S).** Currently Electron's default. Check: in the installer and the window.
- [ ] **T1103 Installer and updates (M).** Windows installer, signed-update check. Check: install, update from the previous version.
- [ ] **T1104 Clean machine (M).** The whole first run on Windows: install, load, quit, resume, refresh. Check: the goal above, item by item.
- [ ] **T1105 Docs and README (S).** What the app does and what was measured, for someone arriving new.
- [ ] **T1106 Release (S).** `main` into `preprod` into `prod`, tag `v1.0-stage11`. Set `package.json` to `1.0.0` and push `v1.0.0`: that tag runs the Release workflow, which leaves a draft to publish (D26).

## Optional

- [ ] **T1201 Fantasy stats.** Fantasy points on players and teams as ordinary metrics: the source's `nba_fantasy_pts` and standard formulas. Nothing else fantasy (D4).

## Where each stat comes from

How the 443 entries in reference sections 3 to 18 are covered. Some are families of related metrics.

| §   | Family                                 | Entries | Source                                                                     | Stage              |
| --- | -------------------------------------- | ------- | -------------------------------------------------------------------------- | ------------------ |
| 3   | Traditional box scores                 | 42      | Box scores; technicals and such: plays                                     | 5, some 9          |
| 4   | Shooting efficiency, opportunity rates | 35      | Formulas over box scores; on-court: 9                                      | 5, 7, 9            |
| 5   | Possessions, pace, ratings             | 19      | Estimates; published; possessions                                          | 5, 7, 9, Oliver 10 |
| 6   | Scoring composition, shares            | 28      | Team box scores; league dashboards                                         | 5, 7               |
| 7   | Shot location and context              | 23      | Shots. Some tracked context not found                                      | 9, some 7          |
| 8   | Player tracking                        | 53      | League dashboards. Pass and rebound detail not found                       | 7                  |
| 9   | Hustle, box outs                       | 16      | `nba_stats_hustle`                                                         | 7                  |
| 10  | Defense, matchups                      | 25      | Tracking defense; matchups                                                 | 7, 9               |
| 11  | Play types                             | 25      | `nba_stats_synergy`                                                        | 7                  |
| 12  | Lineups, on/off, clutch, splits        | 19      | Game tables; lineups; possessions                                          | 5, 7, 9            |
| 13  | Team strength, standings, game flow    | 23      | Standings; local models; plays                                             | 6, 9, 10           |
| 14  | Composite and impact                   | 43      | Formulas; `nba_player_impact`. EPM, LEBRON, RAPTOR not available           | 5, 7, 10           |
| 15  | NBA's new tracking models              | 14      | Not available: no public export found                                      | Listed only        |
| 16  | Play-derived                           | 24      | Play by play                                                               | 9                  |
| 17  | Measurements, combine                  | 22      | Rosters, draft, combine                                                    | 7                  |
| 18  | Fantasy, others, availability          | 32      | Combined stats: formulas. Publisher grades, salaries, awards not available | 5, 7, T1201        |

"Not found" means no such column appears in any table, checked on a full load.

## Risks

| Risk                                                                    | What would show it                  | Answer                                                                                        |
| ----------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| The database is too large or the first load too slow                    | T405's numbers, past D22's limits   | Load order, duplicates dropped; Parquet kept on disk and read directly                        |
| DuckDB's memory limit is too low: a checkpoint invalidates the database | It happened at 512 MB in T405       | Now 1 GB, and 768 MB passed too. If it recurs, the refresh stops and the next launch recovers |
| GitHub throttles thousands of downloads from one machine                | Failures during T405                | Fewer at once, backoff; failed steps retry the next day                                       |
| One volunteer-run dataset: a pipeline stalls, a column or file changes  | "Data through" falls behind in T410 | Last good rows kept; a missing source reads NULL and never fails                              |
| Rows that are not real data, such as tracking before 2013-14            | T406                                | First seasons come from the coverage table, not from file names                               |
| Rights: the upstream data's terms may limit a public release            | T1101                               | Files are downloaded by each user and nothing is redistributed. Raise it early if unclear     |
| Football left behind in ported code                                     | Review of each port                 | Rule 7 of `CLAUDE.md`; a search for NFL terms in the stage gate                               |

## Decisions behind this plan

The owner accepted these on 2026-11-05. `decisions.md` has them in full.

- **D20:** stages are slices, as above.
- **D21:** the first load runs in tiers, and the app is usable after the first.
- **D22:** the limits that stop T405. The load stayed inside them: 4.3 GB, 20 minutes and 2.2 GB of memory.
- **D23:** a file proven to repeat others is skipped.
- **D24:** stats with no free bulk source stay out.
- **D25:** the repository's shape: `main` is the default, old branches are tags, the three long-lived branches are protected.
- **D26:** a stage tag is not a release.

## Not in this plan

Fantasy features (D4). Ask and the Claude connection (D16). Seasons before 1993-94 (D9). Other leagues (D15). Calling stats.nba.com (D7). Stats with no free bulk source (D24). Raw player-tracking coordinates and licensed scouting data.
