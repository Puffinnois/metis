# What was measured

The headline numbers, each with its date and where it came from. The detail is in the documents linked from each section. Every number here was measured on the development machine, in WSL on 16 cores and 23 GB of memory, unless it says otherwise. On Windows, apart from the build and the packaged self-test in CI, the installer, the uninstaller and an update were run on 2026-11-16, with test builds and a local update feed ([windows-install-check.md](windows-install-check.md)), and a first load with a quit and resume the same day ("On Windows", below). A refresh on Windows and a clean machine remain (Plan T1104).

## The first load

A first load downloads every file the dataset publishes, builds the tables and computes the models. The latest full measurement is the Stage 10 gate, 2026-11-14, on the built app through the real window, from a clean profile (Plan, Stage 10).

| What                    | Measured                                                                                                                                  | Where                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Files                   | 3,025 loaded with no errors, 45 not published yet (the current season's later files)                                                      | Plan, Stage 10 gate                                |
| Download                | 1,554 MB for those 3,025 files, read from the release asset list on 2026-11-05                                                            | [nba-data-sources.md](nba-data-sources.md), "Size" |
| Time                    | 33.7 minutes, and 35.2 on a second run the same day. Most of it is the download: the files came at 0.45 to 1.73 MB/s                      | Plan, Stage 10 gate                                |
| First screens           | The leaderboards 213 seconds in, a player dashboard 214 (279 and 281 on the second run), while the load goes on                           | Plan, Stage 10 gate                                |
| Database file           | 5.32 GB at the end, 5.33 to 5.34 GB at its peak                                                                                           | Plan, Stage 10 gate                                |
| Free disk to start      | 6 GB, less what is already on disk (the check in `src/main/stats/disk.ts`, D22's limit on the file)                                       | [stats-screens.md](stats-screens.md), "Data panel" |
| Peak memory             | 2.73 GB summed over the app's processes (2.74 on the second run: 2.39 the main process with the stats worker and DuckDB, 0.28 the window) | Plan, Stage 10 gate                                |
| The limits it must keep | A 6 GB file, an hour, 4 GB of memory (D22)                                                                                                | [decisions.md](../../decisions.md), D22            |

Earlier gates on the same data loaded the same 3,025 files in 12.2 minutes (Stage 7, 2026-11-10), 12.7 (Stage 8, 2026-11-11) and 20.7 (Stage 9, 2026-11-13). The difference is the network and the machine: Stage 10's builds kept their time, and its downloads were slower ("The load took 13 minutes longer than Stage 9's", Plan, Stage 10 gate). The tier-by-tier breakdown and the play step's cost are in [nba-data-sources.md](nba-data-sources.md), "The first full load".

What the steps cost at the Stage 10 gate: building the game tables 12.7 seconds, the published tables 3.7 and 13.9 seconds, the play tables (34.9 million rows) 546 seconds, and the models (Elo, team strength, the adjusted ratings, the composites, the forecast and stability, 372,222 rows) 200 seconds.

### On Windows

One first load on Windows, 2026-11-16, measured by the manager (Plan T1104). The machine was the owner's: Windows 11 Home build 26300, an Intel i7-13620H, 31.7 GB of memory (9.1 GB free at the start) and 151.5 GB of free disk. It was in use for other things during the run, a browser playing video and other apps, so it was a clean profile, not a clean machine. The build was the test build 0.8.1 of run 43939122396, the app as on main at that run with its own data folder, installed silently for the current user.

| What                 | Measured                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Files                | 3,025 of 3,025 loaded (Data panel), all in by about 15:29, about 20 minutes after launch                                                                                                         |
| Time                 | 76.1 minutes from launch to the last write (15:08:51 to 16:24:57), one second of it closed. About 20 minutes for the downloads and file loads, about 56 for the build steps after them           |
| First screens        | The leaderboards with 2026-27 data between 3 min 10 s and 4 min 15 s after launch (807 of 3,070 files at 3:10, the leaderboards up with 1,339 at about 4:15)                                     |
| Quit and resume      | Quit at 15:13:05 with 1,339 files in: every process gone within 1 second, no WAL beside the 533,737,472-byte file. Relaunched at once, the leaderboards showed and the load carried on           |
| Database file        | 5,319,176,192 bytes at the end. Free disk went from 151.5 to 146.4 GB                                                                                                                            |
| Peak memory          | 2,031 MB working set and 2,022 MB private, summed over the app's four processes, sampled every 15 seconds, both at 16:24:00                                                                      |
| CPU                  | 5,620 CPU-seconds in the main process, about 1.2 cores on average over the run                                                                                                                   |
| After the load       | The player dashboard, the standings with SRS and a game's page with Elo and the game-flow chart answered. Quitting took 7.5 seconds; relaunched, the app opened with data and did not load again |
| Against D22's limits | The file and memory are inside. The time, 76 minutes, is outside, on a machine in use                                                                                                            |

The build steps took about 56 minutes, against about 13 in WSL at the Stage 10 gate. Only the file's size over time is known (4,679 MB until after 15:39, 4,704 at 15:49, 4,845 at 15:59, 5,073 from 16:09): the profile was deleted before the sync log was read, so the time of each step was not. Why they ran four to five times slower than in WSL is not established. Candidates, none tested: other load on the machine, Windows scheduling a background window's process on efficiency cores, real-time antivirus scanning of the database file, and DuckDB's thread count on Windows.

## Refreshing

| What                                                | Measured                                                                           | Where                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A daily refresh with nothing new, forced            | 173 files tried in 21 seconds, 129 unchanged and 44 not published yet (2026-11-14) | Plan, Stage 10 gate                                               |
| A daily refresh with the season in progress changed | 27 seconds; the play step rebuilt 2026-27 alone in 3.3 seconds (2026-11-13)        | [nba-data-sources.md](nba-data-sources.md), "The first full load" |
| The models step for the season in progress          | 3.7 seconds                                                                        | Plan, Stage 10 gate                                               |
| Quit and relaunch after a first load                | The load resumes as finished: the sync log gains no row                            | Plan, every gate from Stage 7                                     |

## Speed

The budget: a click to its table on screen in under 500 ms on the full database, and a screen never waits behind a refresh. Measured at the Stage 10 gate, 2026-11-14, on the full database (Plan, Stage 10 gate):

| What                                                            | ms                               |
| --------------------------------------------------------------- | -------------------------------- |
| A leaderboard of ten columns, in the stats worker               | 128                              |
| A leaderboard of 40 columns (the column picker's limit)         | 480                              |
| Every season by season for every player                         | 449 to 482                       |
| Clicks in the window, on a quiet machine                        | 48 to 453                        |
| Clicks during the models step's heaviest minute of a first load | Up to 674 (the player dashboard) |

One click read over 500 ms outside a load: Shrunk rates on the player board, 579 ms in the full scripted run, each turn of the toggle being a new query of the board's sixteen columns. The play-level reads of Stage 9 are 63 to 322 ms from a click (Plan T907, 2026-11-13). Every screen's numbers, stage by stage, are in [stats-screens.md](stats-screens.md), "Speed"; `scripts/engine-speed.mjs` times the engine on a real load.

## Agreement with the sources

How far the numbers agree with what the sources publish, per season. Each line names its tolerance. The full tables are in [nba-agreement.md](nba-agreement.md) (written by `scripts/check-agreement.mjs`), [nba-plays-agreement.md](nba-plays-agreement.md) (written by `scripts/check-plays.mjs` on 2026-11-13) and [nba-data-sources.md](nba-data-sources.md). At the Stage 10 gate the agreement report found no problems across 34 seasons.

**Box scores and seasons (Stages 4 to 6)**

- Season lengths: 33 of 33 finished seasons have their real number of games, the short ones included; 2025-26 has its 1,230 regular-season games (Plan T407).
- Players add up to their team on 99.9 to 100 % of team-games, on every count (Plan T501).
- Each side's player lines add up to the final score, exactly, in every season but 1994-95 (98.6 %, 15 points at worst) and two games off by 4 (Plan T605; nba-agreement.md, "Box scores against the final score").
- The season tables against the NBA's published season totals: the top 20 scorers match on points and games, 20 of 20, in every season from 1996-97; wins and losses match for every team (Plan T502).
- The formulas against the NBA's published rates: FG%, 3P%, FT%, eFG%, TS%, 3PAr and the scoring shares agree for 96.6 to 100 % of players within the published rounding (Plan T503).
- The standings: wins and losses match the box scores for every team of all 32 seasons; ESPN's matches on record, games back and streak in all 26 it has (Plan T604).

**What the NBA publishes per season (Stage 7)**

- The league dashboards, tracking, hustle, play types, matchups and SportsDataverse's impact models, read back through the engine, equal the raw files on every player-season compared, with rebuilt rates within the published rounding (Plans T702 to T707). Five players with 0 minutes or possessions read blank where the NBA prints 0.
- Published lineups: 5,322,289 stored values equal the raw files; the 381,053 percentages worked out on read are within the published rounding, 0.0005 (Plan T710).

**From the play by play (Stage 9)**

- The NBA's feed rebuilds the final score on 99.7 to 100 % of games; a team's 15 box-score counts exactly on 89.6 to 98.1 % of regular-season team-games (98.3 to 100 % within 1), a player's on 98.8 to 99.8 % (Plan T901).
- ESPN's feed matches team-games on 77 to 93 % a season from 2006-07, except 2012-13 (46 %), 2015-16 (34 %) and 2016-17 to 2017-18 (53 to 69 %). It is kept for checks, not read by the screens (Plan T901).
- Possessions' points equal the team's on every team-game from 1997-98 but three (Plan T901).
- Shots against the box score's FGA, FGM, 3PA and 3PM together: 99.6 to 100 % of regular-season team-games, every playoff team-game (Plan T903).
- On court, from the plays: plus-minus matches the box score on 95 to 97.5 % of player-games a season to 2011-12 and 89 to 94 % after (within 2 on 95 to 99.7 %); minutes within a minute on 92 to 99.6 % (Plan T904).
- Clutch: a hand count of one game's 52 clutch plays equals every player's and both teams' totals (Plan T902).

**Metis's own models (Stage 10)**

- SRS against Basketball-Reference's published values for 116 teams in four seasons: all within 0.01 (Plan T1001).
- Elo's Brier score from 1995-96, over 39,453 games: 0.2090, against 0.2412 for the league's home win rate and 0.2156 for SRS to date (Plan T1002).
- The playoff field: fed every completed regular season from 1993-94 to 2025-26, the code gives the real field and first-round pairs in 66 of 66 conference-seasons (Plan T1003).
- PER, Win Shares and BPM against Basketball-Reference for 35 player-seasons: PER, OWS, DWS and WS within 0.3 on 28 of 28, BPM within 0.5 on 23 of 28 (Plan T1005).

## Coverage

Which seasons really hold values, table by table and column by column, is in [nba-coverage.md](nba-coverage.md) (written by `scripts/coverage-report.mjs` from a real load: 92 tables and 3,513 columns). Outside a stat's seasons the screens read blank with the reason, such as "Recorded from 2013-14.".

## Not measured or not checked

- **Windows:** a refresh, the time of each build step, the credit section by eye, a clean machine, and the real installer's first run (the first load used a test build) (Plan T1104). Why the build steps ran four to five times slower than in WSL. Also not yet checked: SmartScreen on a browser download, an update from the published releases on GitHub, a differential update download, and the real installer's pages on a clean machine. What was run on 2026-11-16 is in [windows-install-check.md](windows-install-check.md).
- **The download size at the Stage 9 and 10 gates:** each says "Not checked: the size of the downloads". The 1,554 MB above is from the asset list on 2026-11-05; the Stage 7 and 8 gates report 1.64 GB of downloads.
- **Why the first attempt at the Stage 10 gate lost its page** 14 minutes into the load: it left no log, and it did not recur on two later loads with the capture on (Plan, Stage 10 gate).
- **How fast a click is during the heaviest writes of the play step:** only five clicks were timed, 106 to 354 ms (Plans T907 and Stage 9 gate).
