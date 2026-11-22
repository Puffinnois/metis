# What was measured

The headline numbers, each with its date and where it came from. The detail is in the documents linked from each section. Every number here was measured on the development machine, in WSL on 16 cores and 23 GB of memory, unless it says otherwise. On Windows, apart from the build and the packaged self-test in CI, the installer, the uninstaller and an update were run on 2026-11-16, with test builds and a local update feed ([windows-install-check.md](windows-install-check.md)), and a first load with a quit and resume the same day ("On Windows", below). A refresh on Windows and a clean machine were not checked (Plan T1104, closed with them stated).

## The first load

A first load downloads every file the dataset publishes, builds the tables and computes the models. The latest full measurement of the NBA alone is the Stage 10 gate, 2026-11-14, on the built app through the real window, from a clean profile (Plan, Stage 10); of all four leagues, the Stage 13 gate, 2026-11-22 (below).

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

### Both leagues, from nothing (Stage 13, T1301.9)

A first load of each league on one clean folder, one after the other, through the built stats worker (`scripts/load-report.mjs`), 2026-11-18 (`~/.cache/metis-dev/gate13`, kept). D22's limits hold for each.

| What          | NBA                                                                                 | WNBA                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Files         | 3,031 steps ok (3,025 files and six group tables), 45 not published yet, 0 problems | 1,499 steps ok, 1 not published yet (2019's coach file), 0 problems                                                        |
| Download      | 1,581 MB                                                                            | 294 MB                                                                                                                     |
| Time          | 26.9 minutes                                                                        | 6.3 minutes                                                                                                                |
| Database file | 5.33 GB at the end (5,329,137,664 bytes)                                            | 850 MB (849,883,136 bytes)                                                                                                 |
| Peak memory   | 2.56 GB (the worker process, in the plays tier)                                     | 1.72 GB                                                                                                                    |
| Build steps   | game tables 13.4 s, published 14.0 s, plays 425 s, models 199 s                     | identity and game tables twice (the late identity rebuild, 0.3 and 7.3 s in all), published 1.9 s, plays 93 s, models 47 s |

The WNBA's late identity rebuild (T1301.7: its overtimes before 2002 read from the play by play, a later tier) ran on this first load as it did in a refresh: every one of the 1,022 regular-season and playoff games of 1997 to 2001 has its overtimes, 63 of them in overtime.

### Four leagues, from nothing, through the window (Stage 13 gate)

The built app on a clean profile (`~/.cache/metis-dev/gate13b`, kept), 2026-11-22, driven through its own window (`scripts/stage13-first-load-steps.json`): the first-run question answered with the NBA alone, then the WNBA, NCAA Men and NCAA Women each turned on in the Data panel once the one before had finished. NCAA Women's load was stopped with 67 of 185 files in (the app killed) and finished after a relaunch (`stage13-resume-steps.json`). Memory is summed over the app's processes, sampled every 10 seconds; with each league loaded, its stats worker stays open in the main process.

| What                    | NBA                                                               | WNBA                                                                               | NCAA Men                                                   | NCAA Women                                                 |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Files                   | 3,027 of 3,027, none failed                                       | 1,492 of 1,492, none failed                                                        | 184 of 184, none failed                                    | 183 of 183, none failed                                    |
| Download (as published) | 1,661 MB                                                          | 308 MB                                                                             | 805 MB                                                     | 754 MB                                                     |
| Time                    | 25.6 minutes                                                      | 6.1 minutes                                                                        | 17.5 minutes                                               | 0.6 minutes, then 16.2 after the relaunch (118 left)       |
| Database file           | 5.33 GB (5,329,661,952 bytes)                                     | 851 MB (851,193,856 bytes)                                                         | 4.31 GB (4,307,824,640 bytes)                              | 4.08 GB (4,080,807,936 bytes)                              |
| Peak memory             | 2.40 GB (2.14 the main process)                                   | 3.04 GB (2.77)                                                                     | **4.77 GB (4.50)**, the NBA and WNBA open                  | 3.34 GB (3.11), after the relaunch                         |
| Build steps             | game tables 22 s, published 6 and 11 s, plays 436 s, models 162 s | identity and game tables twice (3 and 4 s), published 2 s, plays 99 s, models 41 s | identity 26 s, game tables 72 s, plays 374 s, models 203 s | identity 24 s, game tables 63 s, plays 379 s, models 195 s |
| Links step after it     | 386 links (377 by id, 9 by name and college)                      | 189 (144, 45)                                                                      | 389 (378, 2 by name and birth date, 9)                     | 190 (144, 46)                                              |

All four files and the links file came to 14.66 GB. **NCAA Men's peak is past D22's 4 GB of process memory**: T1302.9 measured 2.98 GB loading the college leagues alone; here the NBA's and WNBA's workers were already open in the same process. Loaded alone after a relaunch, NCAA Women peaked at 3.34 GB. A restart then opened every league at once (a leaderboard 30 ms after the page was ready), downloaded nothing (each league tried within the day) and peaked at 1.07 GB; the links step ran after each league's launch refresh, every count unchanged. A forced refresh of each league (`scripts/load-report.mjs --force`) tried only open seasons: the NBA 178 of its files in 0.7 minutes (136 ok, 42 not published yet, 45 unchanged), the WNBA 8 (all unchanged), NCAA Men 43 in 2 minutes and NCAA Women 39, sealed seasons untouched (2,883, 1,472, 142 and 140 files sealed).

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

A second first load the same day, on the same machine (6 performance and 4 efficiency cores, the Balanced power plan, on mains power, in use) with the same test build and a clean profile, took 105.6 minutes (16:53:10 to 18:38:44). It ran 3,031 steps with 45 skipped, into 5,340,147,712 bytes, with memory at about 2.0 GB at its peak. This time the app's sync log was read:

| Step              | On Windows                    | In WSL, Stage 10 gate |
| ----------------- | ----------------------------- | --------------------- |
| File loads        | About 29 minutes, 16:53–17:22 |                       |
| `stats:published` | 90 seconds (two runs)         |                       |
| `stats:plays`     | 3,933 seconds                 | 546 seconds (7.2×)    |
| `stats:models`    | 668 seconds                   | 200 seconds (3.3×)    |

Sampled about every 16 seconds, the app used 1.2 to 1.3 cores throughout. The summed utility of the 4 efficiency cores was about 210 to 260 of 400 during the load and about 83 after it; that of the 12 performance-core threads about 70 of 1,200. Defender averaged 4% of a core during plays and 12% during the file loads, disk writes about 1 MB/s during plays, and `stats-tmp` peaked at 59 MB during the file loads and was empty during plays and models. Windows reported no power-throttling setting of the app's own, and a Normal priority, the whole time.

A fixed single-thread test, started the same way as the app (from a background session), took 26 to 28 seconds by default, 29.6 pinned to the efficiency cores, 12 to 17 pinned to the performance cores, 22 at AboveNormal priority, 20 at High, and 8.4, twice, after opting out of execution-speed throttling. The app now opts out at startup on Windows ([`src/main/fullSpeed.ts`](../../src/main/fullSpeed.ts)). Not established: why plays ran 7 times slower when the single-thread test gives about 3 times; whether an app launched from the Start menu and kept in front already gets the performance cores; and whether opting out speeds up the real load, which the third load below measured.

A third first load the same day, on the same machine and setup with a clean profile, used a test build that makes the call (run 43990003214). The app logged "full speed: set", and Windows reported the setting (ControlMask 1, StateMask 0) on the main process for the whole load. It took 46.8 minutes (19:58:09 to 20:44:55), into 5,322,846,208 bytes, with memory at about 2.0 GB at its peak (working set 2,044 MB) and `stats-tmp` at 35 MB.

| Step              | Third load, with the call     | Second load, without | In WSL, Stage 10 gate |
| ----------------- | ----------------------------- | -------------------- | --------------------- |
| Whole load        | 46.8 minutes                  | 105.6 minutes        | 33.7 minutes          |
| File loads        | About 24 minutes, 19:58–20:22 | About 29 minutes     |                       |
| `stats:derived`   | 11.5 seconds                  | 26.9 seconds         |                       |
| `stats:published` | 8.4 and 31.1 seconds          | 90 seconds together  |                       |
| `stats:plays`     | 1,124.6 seconds               | 3,933 seconds        | 546 seconds           |
| `stats:models`    | 198.2 seconds                 | 668 seconds          | 200 seconds           |

The app used 1.20 cores on average. The summed utility of the performance-core threads averaged 358 of 1,200 (about 70 in the second load), and that of the efficiency cores 151 of 400 (210 to 260). Defender averaged 12% of a core over the load, 25% in the first 20 minutes and 3% after.

The load was short six files. Six ESPN 2002 files (player box scores, player seasons, team seasons, game rosters, standings and officials) each failed with HTTP 502 from the GitHub release download between 20:03:04 and 20:03:57: 3,025 steps succeeded, 45 were skipped and 6 failed, and the run did not try them again before it finished. On this run the time, the file and the memory are inside D22's limits, for a load missing those six files. Plays still takes about twice WSL's time, and why is not established. Not checked: a launch from the Start menu with the window kept in front, and whether the six files arrive at the next refresh.

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

At the Stage 13 gate, 2026-11-22, `scripts/engine-speed.mjs` on the four-league load: NCAA Men's 2025-26 worst read 465 ms (by opponent; 40 columns 229 ms median) and NCAA Women's 457 ms (447; 217), inside the budget as at T1302.9 (454 and 440); the NBA's worst 547 ms on a second run (753 on the first) and the WNBA's 466 (851), each the first read of a fresh worker, whose median is 126 and 79 ms; the NBA's 40 columns 420 ms median.

One click read over 500 ms outside a load: Shrunk rates on the player board, 579 ms in the full scripted run, each turn of the toggle being a new query of the board's sixteen columns. The play-level reads of Stage 9 are 63 to 322 ms from a click (Plan T907, 2026-11-13). Every screen's numbers, stage by stage, are in [stats-screens.md](stats-screens.md), "Speed"; `scripts/engine-speed.mjs` times the engine on a real load.

## Agreement with the sources

How far the numbers agree with what the sources publish, per season. Each line names its tolerance. The full tables are in [nba-agreement.md](nba-agreement.md) (written by `scripts/check-agreement.mjs`), [nba-plays-agreement.md](nba-plays-agreement.md) (written by `scripts/check-plays.mjs` on 2026-11-13) and [nba-data-sources.md](nba-data-sources.md). At the Stage 10 gate the agreement report found no problems across 34 seasons.

**At the Stage 13 gate** (2026-11-22, the four-league load above): `scripts/check-agreement.mjs` found 0 problems for the NBA (34 seasons) and 0 wrong for the WNBA, NCAA Men and NCAA Women; the NCAA record books' champions are the app's leaders in 53 of 55 men's and 58 of 60 women's category-seasons, every difference a stated one ([ncaa-agreement.md](ncaa-agreement.md)); the college models check as at T1302.8 (Elo's Brier 0.1855 and 0.1600). The NBA's and WNBA's sealed seasons are unchanged by the college and link work: every season's player-game count and sums (points, rebounds, assists, field goals, threes), team-game count and points, top scorers and game count equal the Stage 12 gate's load (`gate13`, 2026-11-18). The links equal the research's, pair for pair and method for method ([player-links.md](player-links.md)).

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

- **Windows:** a refresh, the credit section by eye, a clean machine, and the real installer's first run (the first load used a test build) (Plan T1104). Why plays still takes about twice WSL's time with the full-speed call; a complete load with the call (the third was short six files that failed to download); whether those files arrive at the next refresh. Also not yet checked: SmartScreen on a browser download, an update from the published releases on GitHub, a differential update download, and the real installer's pages on a clean machine. What was run on 2026-11-16 is in [windows-install-check.md](windows-install-check.md).
- **The download size at the Stage 9 and 10 gates:** each says "Not checked: the size of the downloads". The 1,554 MB above is from the asset list on 2026-11-05; the Stage 7 and 8 gates report 1.64 GB of downloads.
- **Why the first attempt at the Stage 10 gate lost its page** 14 minutes into the load: it left no log, and it did not recur on two later loads with the capture on (Plan, Stage 10 gate).
- **How fast a click is during the heaviest writes of the play step:** only five clicks were timed, 106 to 354 ms (Plans T907 and Stage 9 gate).
