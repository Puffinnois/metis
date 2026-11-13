# NBA data sources: what was measured

Measured 2026-11-05 against [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data) release files, on the finished 2025-26 season unless noted. Numbers here came from reading the files; re-measure before relying on them much later.

## The source

Free, keyless Parquet files on GitHub releases, updated daily during the season. It fills the role nflverse fills in the template. It republishes two upstreams, ESPN (`espn_nba_*`) and stats.nba.com (`nba_stats_*`), plus derived tables.

**Licence:** the repository's licence file is MIT and its README carries a CC BY 4.0 badge. Neither speaks for the upstream data from ESPN or the NBA. Metis downloads to the user's machine and redistributes nothing, but read the terms and add the credit before a public release (Plan T1101).

Which seasons really hold values, table by table and column by column, is in [nba-coverage.md](nba-coverage.md).

## Size

The whole asset list was read through the GitHub API: 44 NBA releases (WNBA excluded), 3,107 Parquet files, **1,691 MB**. The same data is also published as CSV (9.7 GB) and RDS (1.4 GB), which Metis ignores. Metis loads 3,025 of those files, 1,554 MB: the `*_master` files repeat others (see "Which files repeat others"). The template's whole download was 210 MB.

| Load tier    | Releases                                                                                                          | Files | MB  |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ----- | --- |
| Core         | Schedules, box scores, season tables, rosters, standings, crosswalks, groups, draft, coaches, officials, injuries | 828   | 100 |
| Published    | League dashboards, tracking, play types, hustle, season matchups, impact, combine, curves, rolling windows        | 1,991 | 214 |
| Events       | Shots, possessions, lineups, game matchups                                                                        | 149   | 360 |
| Play by play | Both sources                                                                                                      | 57    | 879 |

The current season (label `2027`) is 124 files and 16.4 MB so far. A finished season, label `2026`, is 84 MB.

## The first full load

Measured 2026-11-05 with `scripts/load-report.mjs`, from nothing, in WSL on 16 cores and 23 GB of memory, at the app's default settings. It loaded 87.3 million rows into 92 tables with no errors.

| Tier         | Files | Download MB | Minutes | Database MB at its end | Peak memory MB | A leaderboard query during it, ms (median / worst) |
| ------------ | ----- | ----------- | ------- | ---------------------- | -------------- | -------------------------------------------------- |
| Core         | 828   | 100         | 3.2     | 288                    | 1,422          | 7 / 9                                              |
| Published    | 1,991 | 214         | 5.4     | 609                    | 1,392          | 8 / 19                                             |
| Events       | 149   | 360         | 4.9     | 1,508                  | 2,105          | 12 / 34                                            |
| Play by play | 57    | 879         | 6.1     | 4,031                  | 2,169          | 14 / 29                                            |
| **All**      | 3,025 | 1,554       | 19.8    | 4,265                  | 2,169          |                                                    |

All of it is inside the limits in D22 (6 GB, an hour, 4 GB of memory). Time varies: an earlier run, with the `*_master` files and nothing else on the machine, took 14.4 minutes, one through the real window with the Data panel open took 23.8, one on the leaderboards took 15.9, and one on the dashboards took 25.6.

**Memory limit:** DuckDB's limit is 1 GB. The template's 512 MB failed at about 1,000 files: a checkpoint could not pin a block, and DuckDB invalidated the database. Reopening it recovered everything, and the load carried on. 768 MB passed a whole load even with the 625-column master files, so 1 GB leaves room.

## Refreshing

- **GitHub's anonymous API allows 60 calls an hour,** too few to list 44 releases on every machine. File downloads are not counted against it. The app should know the file names and not call the API.
- **Freshness without the API:** each file's `etag` header. Do not use `timestamp.json`: 40 of 44 releases publish one, but the one in `nba_stats_schedules` said 2026-05-30 when its files had changed on 2026-11-04. A forced check of 176 files took 12 seconds: 132 unchanged, 44 not published.

## Tables

Seasons are the labels in the file names (see "Traps" for what a label means). A file existing for a season does not prove it holds real values for it (see "Traps").

| Release                         | Seasons   | Files | MB    | Holds                                                                                                                                                        |
| ------------------------------- | --------- | ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `espn_nba_schedules`            | 1994–2027 | 36    | 9.6   | Schedule master, 80 columns (venue, attendance, broadcast)                                                                                                   |
| `espn_nba_player_boxscores`     | 1994–2027 | 34    | 19.1  | Player-game box score, 57 columns                                                                                                                            |
| `espn_nba_team_boxscores`       | 1994–2027 | 34    | 4.2   | Team-game box score, 59 columns (points in the paint, fast break)                                                                                            |
| `espn_nba_player_core`          | 1994–2027 | 34    | 1.8   | Not read                                                                                                                                                     |
| `espn_nba_player_season_stats`  | 1994–2027 | 34    | 3.1   | Not read                                                                                                                                                     |
| `espn_nba_team_season_stats`    | 2002–2027 | 26    | 0.7   | Not read                                                                                                                                                     |
| `espn_nba_pbp`                  | 2002–2027 | 26    | 419.2 | Play by play, 68 columns, coordinates                                                                                                                        |
| `espn_nba_shots`                | 2002–2027 | 26    | 77.7  | Shots                                                                                                                                                        |
| `espn_nba_game_rosters`         | 2002–2027 | 26    | 7.5   | Who dressed                                                                                                                                                  |
| `espn_nba_standings`            | 2002–2027 | 26    | 0.5   | Read only to check the NBA's standings                                                                                                                       |
| `espn_nba_officials`            | 2002–2027 | 26    | 0.5   | Compared with the NBA's, not read                                                                                                                            |
| `espn_nba_draft`                | 2003–2027 | 25    | 0.5   | Not read                                                                                                                                                     |
| `espn_nba_rosters`              | 2025–2027 | 3     | 0.2   | Not read                                                                                                                                                     |
| `espn_nba_injuries`             | 2027      | 1     | 0.2   | Current only; compared with the official report, not read                                                                                                    |
| `espn_nba_depthcharts`          | 2027      | 1     | 0.1   | Current only, not read                                                                                                                                       |
| `nba_stats_schedules`           | 1997–2027 | 31    | 0.7   | Games with their type, 15 columns                                                                                                                            |
| `nba_stats_player_boxscores`    | 1997–2027 | 31    | 17.1  | Player-game box score, 37 columns                                                                                                                            |
| `nba_stats_team_boxscores`      | 1997–2027 | 31    | 2.0   | Team-game box score, 29 columns                                                                                                                              |
| `nba_stats_player_game_logs`    | 1997–2027 | 31    | 2.2   | **Team** rows despite the name (2,630 rows in 2026), 31 columns                                                                                              |
| `nba_stats_game_rosters`        | 1997–2027 | 31    | 1.3   | Not read                                                                                                                                                     |
| `nba_stats_player_season_stats` | 1997–2027 | 31    | 16.4  | Player-season, 210 columns, includes `nba_fantasy_pts`, `dd2`                                                                                                |
| `nba_stats_team_season_stats`   | 1997–2027 | 31    | 2.9   | Team-season                                                                                                                                                  |
| `nba_stats_pbp`                 | 1997–2027 | 31    | 460.3 | Play by play, 49 columns, 707,440 rows in 2026, possession number, players on court                                                                          |
| `nba_stats_shots`               | 1997–2027 | 31    | 101.0 | Shots, 19 columns                                                                                                                                            |
| `nba_stats_possessions`         | 1997–2027 | 31    | 92.5  | Every possession with the ten players on court, 35 columns                                                                                                   |
| `nba_stats_game_lineups`        | 1997–2027 | 31    | 21.3  | Five-man units per play                                                                                                                                      |
| `nba_stats_lineups`             | 2008–2027 | 20    | 25.8  | Lineup tables, 182 columns                                                                                                                                   |
| `nba_stats_leaguedash`          | 1996–2027 | 869   | 292.0 | League dashboards and tracking (below)                                                                                                                       |
| `nba_stats_synergy`             | 2016–2027 | 828   | 16.6  | Play types: type, offense or defense, totals or per game, season type                                                                                        |
| `nba_stats_hustle`              | 2016–2027 | 92    | 1.9   | Hustle, players and teams, totals or per game, season type                                                                                                   |
| `nba_stats_matchups`            | 2018–2027 | 56    | 33.2  | Season pair matchups, and rollups by position                                                                                                                |
| `nba_stats_game_matchups`       | 2018–2027 | 10    | 41.5  | Game matchups, 257,854 rows in 2026: the game grain of the matchups and a game's pairs (T906)                                                                |
| `nba_player_impact`             | 1997–2027 | 31    | 3.0   | RAPM, SPM, BPM, WAR, DARKO, 28 columns (see "Traps")                                                                                                         |
| `nba_stats_injury_report`       | 2019–2027 | 9     | 4.3   | Official injury reports, 376,069 rows in 2026: the status tag and games out                                                                                  |
| `nba_stats_rosters`             | 1997–2027 | 31    | 0.7   | Bio: height, weight, birth date, school, experience; the header and the Profile tab                                                                          |
| `nba_stats_draft`               | 1997–2027 | 31    | 0.2   | One row per pick, the 1996 to 2026 drafts: the Profile tab                                                                                                   |
| `nba_stats_draft_combine`       | 2001–2027 | 135   | 1.8   | Five combine tables: stats, anthro, drills, spot-up, non-stationary, the 2000 to 2026 combines: the Profile tab                                              |
| `nba_stats_standings`           | 1997–2027 | 31    | 1.1   | The Standings screen and a team's header                                                                                                                     |
| `nba_stats_coaches`             | 1997–2027 | 31    | 0.3   | The team dashboard's staff                                                                                                                                   |
| `nba_stats_officials`           | 1997–2027 | 31    | 0.5   | A game's officials, and the officials' rates from the box scores (T906)                                                                                      |
| `nba_stats_metric_curves`       | 1997–2027 | 31    | 2.2   | Field-goal percentage by shot-distance bin, for the league, teams and players. `down` and `epa_per_att` are always empty: the schema is shared across sports |
| `nba_stats_rolling_windows`     | 1997–2027 | 31    | 1.5   | FG% and 3P% over a player's last 50 and 200 attempts, against the prior window, the season's start and the career                                            |
| `nba_crosswalk`                 | 2002–2027 | 78    | 1.9   | Player, team and **game** ids across ESPN, NBA, Fox and Yahoo, per season                                                                                    |
| `nba_groups`                    | 1971–2027 | 63    | 0.4   | Player and team aliases, conference and division by season                                                                                                   |

### Inside `nba_stats_leaguedash`

| Family                                                                                                                     | Files      | Notes                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `player_stats_{base,advanced,misc,scoring,usage,defense}`                                                                  | 31 each    | Both season types: 812 rows in 2026                                                    |
| `team_stats_{base,advanced,misc,scoring,fourfactors,opponent,defense}`                                                     | 31 each    |                                                                                        |
| `lineups_{base,advanced,misc,scoring,fourfactors,opponent}`                                                                | 20 each    | From label 2008                                                                        |
| `player_tracking_{drives,passing,possessions,rebounding,speeddistance,defense,efficiency,elbowtouch,posttouch,painttouch}` | 14 each    | From label 2014 (2013-14). Players only: no team tracking files                        |
| `player_tracking_{catchshoot,pullupshot}`                                                                                  | 30, 31     | Go back to 1997, but only with games and minutes: their stats hold values from 2013-14 |
| `player_master`, `team_master`, `lineups_master`                                                                           | 31, 31, 20 | 138 MB, **not loaded**: every column matches its parts, with no differences (D23)      |
| `player_bio`, `standings`                                                                                                  | 31, 32     |                                                                                        |

No table has clutch, closest-defender shots, dribble and touch-time shot context, or passing and rebounding breakdowns by teammate or distance. Checked by searching every column of a full load.

## Which files repeat others

Measured on the full load (Plan T406). A file is skipped only when proven to repeat others (D23).

| Files                                                 | Result                                                                                                                                      | Loaded? |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `player_master`, `team_master`, `lineups_master`      | Every column maps to one in a part, with no differences over 21,120, 1,402 and 277,982 rows                                                 | No      |
| Per-game hustle and play types                        | Not simply totals over games: `pts` is off by more than rounding on 10,181 of 90,167 play-type rows, and hustle `min` on 1,563 of 8,718     | Yes     |
| Per-game matchups                                     | Minutes are spelled differently from totals, so not compared exactly                                                                        | Yes     |
| `nba_stats_lineups`                                   | Base totals match the dashboards exactly on 61,801 rows, and so does every other measure it holds; its per-game rows are other units (T710) | No      |
| `nba_stats_player_season_stats`                       | Base totals match on 21,120 rows, but it also holds per-game rows                                                                           | Yes     |
| `nba_stats_standings` and the dashboards' `standings` | Values differ on several columns, and only the dashboards reach 1995-96                                                                     | Yes     |
| `nba_schedule_master`                                 | The same 43,062 games as the season files, with 3 more columns                                                                              | Yes     |

## Do the numbers agree?

Measured season by season on the full load: the tables are in [nba-agreement.md](nba-agreement.md), written by `scripts/check-agreement.mjs`. In short, over finished seasons:

| Check                                                             | Result                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular-season games against the real season lengths              | Every season from 1993-94 matches, including the short ones and the game cancelled in 2013                                                                                                                                                                                                                                                          |
| Teams in each season                                              | 27, 29 and 30 in the right seasons                                                                                                                                                                                                                                                                                                                  |
| NBA: players sum to the team                                      | 99.9–100 % of team-games on points, 100 % on rebounds and assists                                                                                                                                                                                                                                                                                   |
| ESPN: players sum to the team                                     | 98.6–100 % on points, 98.7–100 % on assists                                                                                                                                                                                                                                                                                                         |
| ESPN against the NBA: points, assists, FGM, 3PM, FTA              | 99.7–100 %                                                                                                                                                                                                                                                                                                                                          |
| ESPN against the NBA: field-goal attempts                         | 98.8–100 %                                                                                                                                                                                                                                                                                                                                          |
| ESPN's players summed against the NBA's team: rebounds, turnovers | 98.6–100 %, 98.9–100 %                                                                                                                                                                                                                                                                                                                              |
| Player lines on an NBA id                                         | All but one from 1996-97; 81 %, 89 % and 95 % in the three seasons before, whose other players retired before the NBA's data starts                                                                                                                                                                                                                 |
| Player lines in both sources                                      | All found; points 100 %, rebounds and assists 99.9–100 %                                                                                                                                                                                                                                                                                            |
| Published season totals against summed box scores                 | Games 98.5–100 %, points 97.7–100 %, rebounds 98–100 %, assists 98.2–100 %                                                                                                                                                                                                                                                                          |
| Possessions against the box score, team points                    | Measured again on 2026-11-10: 100.0 % exact in every season but 1996-97 (99.8 % exact, 99.9 % within 5, the worst game off by 88) and 2003-04 (3 games off, by 3 points at worst). Until Stage 7 this read 53 % exact before 2017-18 and 88 % after, the worst game off by 113: the dataset republished the file, and Metis’s reader did not change |
| Season tables against published totals: the top 20 scorers        | 20 of 20, same points and games, every season from 1996-97                                                                                                                                                                                                                                                                                          |
| Season tables against published totals: all players               | Games 99.8–100 %, points 97.7–100 %, rebounds 98–100 %, assists 98.2–100 %. Wins and losses 100 % for every team                                                                                                                                                                                                                                    |
| Plus-minus: a team's players sum to five times the margin         | 96.2–100 %, from 1996-97                                                                                                                                                                                                                                                                                                                            |
| The catalogue's formulas against the NBA's published rates        | FG%, 3P%, FT%, eFG%, TS%, 3PAr and scoring shares: 96.6–100 % of players within rounding, 100 % in most seasons from 2007-08                                                                                                                                                                                                                        |
| Estimates against the NBA's measures, median difference           | USG% 0.4–0.7 points, AST% 0.2–0.3, TRB% about 1. Team ratings and pace about 1 against its counts, 0.7 against its own estimates                                                                                                                                                                                                                    |

So the box scores can be trusted season by season, and the sources cross-check. **Possessions are a derived table, not an official one:** SportsDataverse works them out from the NBA's play by play. Its `lineup_source` read `pbp_fallback` on 99.6 % of 2025-26 until the file was republished; on the 2026-11-10 download it reads `quarter_box` on every row of every season. Anything built on them has to state that tolerance.

## Plays

Measured 2026-11-11 on a copy of Stage 8's full load by `scripts/check-plays.mjs`, whose full tables, per season type with every count and the worst misses, are in [nba-plays-agreement.md](nba-plays-agreement.md). How the play tables are built and what later work can read is in [stats-database.md](stats-database.md), "Plays, shots and possessions"; the traps are under "Traps", "Play by play".

Each game's final score, and each team's and player's box-score line rebuilt from the counting flags, against the NBA's box score the app trusts, regular season, share of games or lines. **Tolerance:** a line is exact when all 15 counts equal the box score's (points, FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, REB, AST, STL, BLK, TOV, PF), and within 1 when none is off by more than 1. Possessions: their points against the team's.

| Season  | NBA score | NBA team-games exact | within 1 | NBA player-games exact | within 1 | ESPN score | ESPN team-games exact | within 1 | ESPN player-games exact | Possession points exact |
| ------- | --------: | -------------------: | -------: | ---------------------: | -------: | ---------: | --------------------: | -------: | ----------------------: | ----------------------: |
| 1996-97 |      99.7 |                 89.6 |     98.9 |                   98.8 |     99.9 |          – |                     – |        – |                       – |                    99.7 |
| 1997-98 |     100.0 |                 90.8 |     99.2 |                   99.0 |     99.9 |          – |                     – |        – |                       – |                   100.0 |
| 1998-99 |     100.0 |                 93.1 |     99.5 |                   99.2 |    100.0 |          – |                     – |        – |                       – |                   100.0 |
| 1999-00 |     100.0 |                 96.3 |     99.9 |                   99.6 |    100.0 |          – |                     – |        – |                       – |                   100.0 |
| 2000-01 |     100.0 |                 96.1 |     99.7 |                   99.6 |    100.0 |          – |                     – |        – |                       – |                   100.0 |
| 2001-02 |     100.0 |                 93.7 |     99.7 |                   99.3 |    100.0 |       74.6 |                   0.0 |      0.2 |                    29.5 |                   100.0 |
| 2002-03 |     100.0 |                 95.5 |     99.7 |                   99.5 |    100.0 |       67.2 |                   0.0 |      0.4 |                    44.9 |                   100.0 |
| 2003-04 |      99.9 |                 96.7 |     99.8 |                   99.7 |    100.0 |       75.1 |                   0.0 |      0.2 |                    42.6 |                   100.0 |
| 2004-05 |     100.0 |                 97.6 |    100.0 |                   99.8 |    100.0 |       79.8 |                   0.1 |      0.7 |                    46.2 |                   100.0 |
| 2005-06 |     100.0 |                 97.4 |     99.8 |                   99.7 |    100.0 |       76.9 |                  24.2 |     60.3 |                    78.8 |                   100.0 |
| 2006-07 |     100.0 |                 98.1 |    100.0 |                   99.8 |    100.0 |       98.8 |                  76.5 |     95.6 |                    96.6 |                   100.0 |
| 2007-08 |     100.0 |                 97.9 |     99.9 |                   99.8 |    100.0 |       98.7 |                  79.5 |     97.4 |                    96.6 |                   100.0 |
| 2008-09 |     100.0 |                 97.2 |    100.0 |                   99.7 |    100.0 |      100.0 |                  80.7 |     98.9 |                    97.1 |                   100.0 |
| 2009-10 |     100.0 |                 97.5 |     99.9 |                   99.8 |    100.0 |       99.9 |                  81.3 |     98.8 |                    96.8 |                   100.0 |
| 2010-11 |     100.0 |                 97.9 |    100.0 |                   99.8 |    100.0 |       99.2 |                  88.1 |     98.7 |                    97.7 |                   100.0 |
| 2011-12 |     100.0 |                 96.8 |     99.9 |                   99.7 |    100.0 |       99.3 |                  89.4 |     98.8 |                    97.9 |                   100.0 |
| 2012-13 |     100.0 |                 96.2 |     99.5 |                   99.6 |    100.0 |       99.3 |                  46.1 |     78.1 |                    89.7 |                   100.0 |
| 2013-14 |     100.0 |                 93.5 |     98.3 |                   99.3 |     99.8 |      100.0 |                  85.3 |     98.4 |                    97.3 |                   100.0 |
| 2014-15 |     100.0 |                 93.7 |     98.6 |                   99.3 |     99.9 |       99.9 |                  83.2 |     97.0 |                    97.1 |                   100.0 |
| 2015-16 |     100.0 |                 95.0 |     99.8 |                   99.5 |    100.0 |       99.6 |                  33.8 |     46.5 |                    77.2 |                   100.0 |
| 2016-17 |     100.0 |                 94.6 |     99.1 |                   99.4 |     99.9 |       99.9 |                  68.9 |     96.4 |                    88.5 |                   100.0 |
| 2017-18 |     100.0 |                 96.0 |     98.9 |                   99.6 |     99.9 |       99.8 |                  52.8 |     92.4 |                    91.6 |                   100.0 |
| 2018-19 |     100.0 |                 96.3 |     98.4 |                   99.6 |     99.8 |       99.8 |                  77.0 |     98.8 |                    95.4 |                   100.0 |
| 2019-20 |     100.0 |                 96.4 |     98.9 |                   99.6 |     99.9 |      100.0 |                  85.1 |     99.1 |                    96.6 |                   100.0 |
| 2020-21 |     100.0 |                 94.7 |     98.3 |                   99.5 |     99.8 |      100.0 |                  85.7 |     99.4 |                    96.8 |                   100.0 |
| 2021-22 |     100.0 |                 96.2 |     99.2 |                   99.6 |     99.9 |       99.9 |                  84.6 |     98.9 |                    96.2 |                   100.0 |
| 2022-23 |     100.0 |                 96.8 |     99.1 |                   99.7 |     99.9 |       99.8 |                  90.5 |     99.2 |                    97.5 |                   100.0 |
| 2023-24 |     100.0 |                 95.7 |     98.3 |                   99.5 |     99.9 |       99.9 |                  89.0 |     99.3 |                    97.3 |                   100.0 |
| 2024-25 |     100.0 |                 96.6 |     99.2 |                   99.7 |     99.9 |      100.0 |                  93.1 |     99.9 |                    97.7 |                   100.0 |
| 2025-26 |     100.0 |                 97.0 |     99.5 |                   99.6 |    100.0 |       99.9 |                  91.6 |     99.8 |                    97.4 |                   100.0 |
| 2026-27 |     100.0 |                 95.5 |     99.3 |                   99.6 |     99.9 |      100.0 |                  90.8 |    100.0 |                    97.4 |                   100.0 |

- **The NBA's feed rebuilds the box score count by count.** Points, makes, attempts, rebounds, steals, blocks and turnovers are exact on 99 to 100 % of team-games in every regular season. What keeps a team-game from exact is assists (95 to 99.6 %, a name no rule matches) and personal fouls (92 to 99.5 %, fouls with no row), both in "Traps". Free throws made miss on 0.3 to 0.7 % of team-games from 2008-09 to 2016-17, a free throw credited to the wrong player or missing: the final score is still exact. It is the default source for later metrics.
- **ESPN's feed is close from 2006-07** (within 1 on 92 to 100 % of team-games, except 2012-13 and 2015-16), and not usable for box-score counts before it: no steals before 2005-06, missing plays, and whole games credited to one team.
- **Possessions:** their points equal the team's on every team-game from 1997-98 except three in 2003-04 (off by 3 at worst), and on 99.7 % of 1996-97 (one game off by 88). Their field-goal makes and attempts and free-throw attempts equal the box score's on 99 to 100 %. Their turnovers equal the team's plays, team turnovers included, on 97.4 to 99.6 %. Their offensive rebounds are their own measure: they match the plays on 2 to 5 %. Counted possessions run a median 1.6 to 2.4 below the box score's simple estimate, within 3 on 60 to 77 % of team-games. **Plan T901's "2,327 of 2,644 team-games exact in 2025-26" was the file before it was republished** (the 88 % above); on the current file it is 2,644 of 2,644.
- **Cost, on the full load:** the `stats:plays` step built 33,327,811 play rows (19,047,400 from the NBA's feed, 14,280,411 from ESPN's) in 213 seconds in a real refresh, as one statement a table. The file grew from 4.67 GB to 5.16 GB (+0.48 GB); peak memory of the refresh process was 1.6 GB. Built that way, a rebuild wrote the new tables before the old ones were freed, and the file reached 5.89 GB. Since the step replaces one season at a time and only the seasons that changed (`stats-database.md`, "Plays, shots and possessions"), a full rebuild takes 94 to 276 seconds and peaks at 5.13 GB from 5.12 GB in steady state (5.42 GB the first time, on the older file), with 2.2 GB of memory, and the daily rebuild of the current season takes 1.5 seconds with no growth. D22's limits are 6 GB, an hour and 4 GB.

## Splits from plays, per season

Measured 2026-11-11 by `scripts/check-splits.mjs` on a copy of T901's full load (`~/.cache/metis-dev/t902`), which writes these tables. How the split tables are built and read is in [stats-database.md](stats-database.md), "Splits of each game"; the rules are in `src/shared/stats/splits.ts` and on the screens.

**The plan's hand count:** the earliest 2025-26 regular-season game decided by one point in regulation, Philadelphia 117 at Boston 116 (2025-10-22, `0022500083`). Its clutch rows were listed from the raw `src_nba_pbp` by SQL written apart from the builder (its own clock from the ISO text, its own carried score, its own credits from the rows' columns and descriptions): 52 plays from 4:44 left, the margin before each from 5 to −4. Every player's 13 counts (points, makes and attempts, rebounds, assists, steals, blocks, turnovers, fouls) and both teams' points, makes, attempts and free throws equal `split_player` and `split_team`: 14 players, 3:30 of clutch time. The script prints the plays and both tables.

**What must hold exactly, per season.** Player-games: the quarters and overtime added up equal the game's play totals on all 14 counts; the halves equal their quarters; ahead, tied and behind added up equal the quarters, counts and seconds, and so do garbage time and the rest. Team-games: the quarters equal the play totals, the score states equal the quarters with the opponent's points, and the possessions equal the game's. Every season from 1997-98 to 2026-27 holds on every row. 1996-97 misses on one game, Miami at Charlotte of 1997-03-09 (`0029600879`), in "Traps": Keith Askins's player-game is split across both teams (counted twice as 2 rows), and Charlotte has no possessions.

**Against the box scores, per season.** The quarters added up against the NBA's box-score line (the rate T901 measured for the plays: what misses is the plays' own assists and fouls), players' time from the substitutions against box-score minutes, and teams' points by quarter and overtime against ESPN's line scores where those add up to the final score. **Tolerance for time:** one second where the box score prints seconds; a minute where it prints whole minutes.

| Season  | Player-games | Lines exact | Within 1 | Time ≤ 1 s | Time ≤ 60 s | Box in whole minutes | Line scores |   Equal |
| ------- | -----------: | ----------: | -------: | ---------: | ----------: | -------------------: | ----------: | ------: |
| 1996-97 |       25,173 |      98.8 % |   99.9 % |     99.6 % |      99.8 % |                2.9 % |       2,498 |  99.8 % |
| 1997-98 |       25,425 |      99.0 % |   99.9 % |     99.9 % |      99.9 % |                2.5 % |       2,508 | 100.0 % |
| 1998-99 |       16,262 |      99.1 % |  100.0 % |     99.7 % |      99.9 % |                2.5 % |       2,482 | 100.0 % |
| 1999-00 |       25,772 |      99.5 % |  100.0 % |     99.8 % |      99.9 % |                2.5 % |       2,474 | 100.0 % |
| 2000-01 |       25,367 |      99.6 % |  100.0 % |     94.9 % |      99.9 % |                7.5 % |       2,500 | 100.0 % |
| 2001-02 |       25,278 |      99.3 % |  100.0 % |    100.0 % |     100.0 % |                2.5 % |           – |       – |
| 2002-03 |       25,706 |      99.5 % |  100.0 % |     93.4 % |     100.0 % |                9.2 % |           – |       – |
| 2003-04 |       25,548 |      99.6 % |  100.0 % |     22.5 % |      95.5 % |               81.3 % |           – |       – |
| 2004-05 |       26,603 |      99.7 % |  100.0 % |     13.8 % |      94.2 % |               89.8 % |           – |       – |
| 2005-06 |       26,637 |      99.7 % |  100.0 % |     99.8 % |      99.8 % |                2.3 % |           – |       – |
| 2006-07 |       26,648 |      99.8 % |  100.0 % |     99.9 % |      99.9 % |                1.9 % |           – |       – |
| 2007-08 |       26,651 |      99.8 % |  100.0 % |     99.9 % |      99.9 % |                2.3 % |           – |       – |
| 2008-09 |       26,370 |      99.7 % |  100.0 % |     99.9 % |      99.9 % |                2.3 % |           – |       – |
| 2009-10 |       26,487 |      99.8 % |  100.0 % |     99.8 % |      99.9 % |                2.4 % |           – |       – |
| 2010-11 |       26,769 |      99.8 % |  100.0 % |     99.9 % |      99.9 % |                1.9 % |           – |       – |
| 2011-12 |       22,502 |      99.6 % |  100.0 % |     99.6 % |      99.6 % |                1.9 % |           – |       – |
| 2012-13 |       27,538 |      99.6 % |  100.0 % |     99.6 % |      99.6 % |                2.3 % |           – |       – |
| 2013-14 |       27,524 |      99.3 % |   99.9 % |     99.1 % |      99.1 % |                2.0 % |           – |       – |
| 2014-15 |       27,634 |      99.3 % |   99.9 % |     99.1 % |      99.1 % |                2.2 % |           – |       – |
| 2015-16 |       27,978 |      99.5 % |  100.0 % |     99.2 % |      99.2 % |                2.0 % |           – |       – |
| 2016-17 |       27,876 |      99.5 % |   99.9 % |     99.0 % |      99.1 % |                1.9 % |           – |       – |
| 2017-18 |       27,836 |      99.6 % |   99.9 % |     99.7 % |      99.7 % |                2.1 % |           – |       – |
| 2018-19 |       27,862 |      99.6 % |   99.8 % |     99.6 % |      99.7 % |                1.9 % |           – |       – |
| 2019-20 |       24,105 |      99.6 % |   99.9 % |     99.3 % |      99.3 % |                2.0 % |       2,286 | 100.0 % |
| 2020-21 |       25,054 |      99.5 % |   99.9 % |     99.2 % |      99.2 % |                1.8 % |       2,342 |  99.9 % |
| 2021-22 |       28,050 |      99.6 % |   99.9 % |     99.3 % |      99.4 % |                1.8 % |       2,646 | 100.0 % |
| 2022-23 |       27,739 |      99.6 % |   99.9 % |     99.5 % |      99.5 % |                1.9 % |       2,640 | 100.0 % |
| 2023-24 |       28,232 |      99.5 % |   99.9 % |     99.2 % |      99.2 % |                2.1 % |       2,638 | 100.0 % |
| 2024-25 |       28,265 |      99.7 % |   99.9 % |     99.6 % |      99.6 % |                2.0 % |       2,642 | 100.0 % |
| 2025-26 |       28,716 |      99.6 % |  100.0 % |     99.5 % |      99.5 % |                1.9 % |       2,636 | 100.0 % |
| 2026-27 |        3,843 |      99.6 % |   99.9 % |     99.6 % |      99.6 % |                2.2 % |         340 | 100.0 % |

- **Time is trusted for every season,** so minute-based rates under a split are not withheld. 2003-04 and 2004-05 look worse only because the box score prints whole minutes there (81 and 90 % of lines): within a minute, 95.5 and 94.2 %. 2000-01 and 2002-03 have 5 to 9 % of lines in whole minutes. Where time misses by more than a minute (0.1 to 1 % of player-games), a substitution's player coming in could not be named (below).
- **Line scores:** ESPN's schedule has them for 1996-97 to 2000-01 and from 2019-20; where it does and they add up, the quarters and overtime equal them on 99.8 to 100 % of team-games.
- **Clutch totals against the NBA's own clutch tables:** no loaded table has them (searched on a full load, above), so there is nothing to compare with. For scale only: 2025-26's leader in clutch points here is Shai Gilgeous-Alexander, 175 in 27 games.

**Garbage time against the dataset's mark.** The rule here: the 4th quarter, a margin of 25 or more with over 9:00 left, 20 or more from 9:00 to 6:01, 10 or more at 6:00 or less, as Cleaning the Glass describes it without its condition on starters. Counted possessions, each by its first play, against SportsDataverse's `is_garbage_time`: they agree on 95.2 to 95.8 % of possessions to 2016-17 and 94.7 to 95.5 % from 2017-18. In every era this rule marks two to three times as many possessions as the dataset, and nearly all of the dataset's are among them. The dataset does not publish its rule. The split states this one. (Measured again on 2026-11-13 after the fix of the running score, below in "Traps": T902's first figures for 1996-97 to 2016-17, 96.2 to 97.1 % with an overlap of a third to a half, read the score as 0-0 on every play that scored nothing.)

| Seasons            | Possessions a season | Marked by the dataset | Marked here     | Both            | Agree          |
| ------------------ | -------------------- | --------------------- | --------------- | --------------- | -------------- |
| 1996-97 to 2016-17 | 141,861 to 274,118   | 3,196 to 8,614        | 9,577 to 20,198 | 3,182 to 8,485  | 95.2 to 95.8 % |
| 2017-18 to 2026-27 | 29,145 to 279,013    | 1,055 to 10,198       | 2,575 to 24,447 | 1,041 to 10,158 | 94.7 to 95.5 % |

**Speed,** through the worker on the full load, warm, 2025-26 unless said, the median of seven runs and the slowest (the script's last table):

| Query                                     |              Rows | Median ms | Slowest ms |
| ----------------------------------------- | ----------------: | --------: | ---------: |
| A leaderboard, 16 columns, the whole game |               582 |       176 |        206 |
| The same, clutch                          |               490 |       109 |        113 |
| The same, 4th quarter                     |               580 |       121 |        125 |
| Clutch, January only                      |               332 |       102 |        107 |
| Clutch, by season, every season           | 5,000 (the limit) |       249 |        259 |
| A team board, clutch                      |                30 |        41 |         44 |
| A player's 19 play splits at once         |                19 |       230 |        240 |
| A team's 19 play splits at once           |                19 |       187 |        201 |

**Cost on the full load.** Built alone on a copy of T901's load, the split tables add 194 MB (5.16 to 5.35 GB) in 215 seconds for 31 seasons. Built as they ship, as entries of `PLAY_BUILDERS` after each season's plays, in a real refresh of a fresh copy of that load (`scripts/load-report.mjs`, 2026-11-12, `PLAYS_VERSION` 2, so every season of every play table rebuilt): the `stats:plays` step took 345 seconds for both play tables and both split tables; the file went from 5.16 GB to 5.61 GB at its peak and 5.59 GB at the end, the refresh's other new files included; peak memory of the process was 2.1 GB. The peak is below T901's 5.89 GB, since a season is replaced at a time and checkpointed. A refresh that changes one season rebuilds only that season: 2025-26's plays and splits in 8.7 seconds and 2026-27's in 1.9, the file unchanged. D22's limits are 6 GB, an hour and 4 GB.

## Game matchups and officials, per season

Measured on a copy of the clean Stage 8 load after a real refresh (2026-11-11) by `scripts/check-matchups-officials.mjs`, which writes these tables.

**The game matchups added up over a regular season, against the season pair file, per defender.** Points, field goals, threes and free throws are equal for every defender of every season, as Stage 7 found. The tolerance for time is one second: both files carry seconds to a tenth (`matchup_minutes_sort`, `matchup_time_sec`), and a defender's season agrees within one second on 96.7–100 % of defenders; the rest are the few pairs the pair file has and the game file lacks (below), at most 42.5 seconds over a season.

| Season  | Defenders | PTS, FGM, FGA | 3P, FT | AST, TOV, BLK, SFL, team PTS | Poss within 0.05 | Time within 1 s | Largest gap |
| ------- | --------- | ------------- | ------ | ---------------------------- | ---------------- | --------------- | ----------- |
| 2017-18 | 541       | 100 %         | 100 %  | 99.6 %                       | 97.8 %           | 97.8 %          | 42.5 s      |
| 2018-19 | 529       | 100 %         | 100 %  | 99.6 %                       | 99.2 %           | 99.2 %          | 39.3 s      |
| 2019-20 | 529       | 100 %         | 100 %  | 100 %                        | 99.6 %           | 99.6 %          | 5.2 s       |
| 2020-21 | 540       | 100 %         | 100 %  | 99.6 %                       | 98.3 %           | 98.3 %          | 40.6 s      |
| 2021-22 | 605       | 100 %         | 100 %  | 99.7 %                       | 98.0 %           | 97.9 %          | 37.8 s      |
| 2022-23 | 539       | 100 %         | 100 %  | 100 %                        | 100 %            | 100 %           | 0           |
| 2023-24 | 572       | 100 %         | 100 %  | 99.1 %                       | 96.9 %           | 96.7 %          | 26.6 s      |
| 2024-25 | 569       | 100 %         | 100 %  | 100 %                        | 99.8 %           | 99.8 %          | 2.1 s       |
| 2025-26 | 582       | 100 %         | 100 %  | 99.8 %                       | 99.0 %           | 99.0 %          | 34.9 s      |

Per pair (123,605 to 147,303 a season), points and field goals are equal on every pair both files hold, games and time on all but 0 to 19 a season.

**The engine at the game grain**, through a date range over each whole regular season and over January alone, equals the game matchups added up in SQL on every defender, on five measures, except a defender's matchups in a game where the box score has no line for them (0 to 12 defenders a season, below), which it cannot reach. A season of defenders answers in 44 to 145 ms.

**The playoffs**, the game matchups against the rollup by defender, a reported difference: points and field goals equal on 99.5–100 % of defenders in 2017-18 and 2019-20 to 2024-25, 90.6 % in 2018-19 and 7.4 % in 2025-26 (17 of 230), where only 48 % are within a minute of time. Games are equal on 98.7–100 %. So whole playoff seasons read their totals from the game matchups and through the engine a whole playoff season equals the game matchups added up per defender on points, field goals, minutes and possessions for every defender of every season, 210 to 230 a season; the rollup's games, which the engine divides by, equal the games with a matchup on 98.7–100 % of them.

**Played games with game matchups:** every playoff, play-in and Cup final game; in the regular season 1,222 of 1,230 in 2017-18, 1,223 in 2018-19, 1,055 of 1,059 in 2019-20, 1,229 in 2021-22, 1,228 in 2023-24, and all of them in the other seasons.

**Officials: played games with a crew in the NBA's file** (regular season, play-in, playoffs and Cup final). No official appears twice in a game (90,731 distinct pairs of 90,731 rows) and every row's game is in `game`.

| Seasons            | With a crew                                     | Crew sizes                                                                                       |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1993-94 to 1995-96 | none                                            |                                                                                                  |
| 1996-97 to 2002-03 | 3.3, 2.1, 2.7, 1.8, 3.3, 8.6 and 1.7 % of games | 3, except two games of 1996-97 with fewer                                                        |
| 2003-04 to 2016-17 | 99.8–100 % (two games of 2007-08 have none)     | 3; 4 on 0 to 15 games a season, most in the playoffs; fewer or more on at most one game a season |
| 2017-18 to 2025-26 | 100 %, but 3 regular-season games of 2025-26    | 3; 4 on 28 to 77 games a season, 24 to 72 of them playoff games, and none in 2019-20             |

**One official recounted by hand:** Jacyn Goble, the official with the most games of the 2025-26 regular season, 66. Counted from the raw officials file and the raw NBA team box scores (`src_nba_team_box`), apart from the read's `team_game`: games, fouls, free-throw attempts and points for each side and home wins are equal on all eight totals (1,321 and 1,386 fouls, 1,569 and 1,541 free-throw attempts, 7,793 and 7,669 points, 40 home wins). Per game that is 41.0 fouls against the league's 39.7, 47.1 free-throw attempts against 47.0, and the home side won 60.6 % against 55.4 %.

## Shots by zone, per season (Plan T903)

Measured 2026-11-12 on a fresh copy of Stage 8's full load with the play tables built, after a real refresh built the shot tables (`~/.cache/metis-dev/t903r`), by `scripts/check-shots.mjs`, which writes every table in full. How the shot tables are built and what the zones are is in [stats-database.md](stats-database.md), "Shots by zone"; the traps are under "Traps", "Shots".

**Tolerance:** exact, nothing tuned. "Zones = shots" counts rows (player-games, team-games both sides) whose zones, bands or types do not add up to their attempts or makes, and shot-row player-games whose table row differs. "Recount" classifies every shot again by the rule written out apart in the script. "3 inside" is a three whose point is inside the arc and the corner lines, "2 outside" a two more than half a foot beyond them. Box scores: the counted game types with an NBA box score; a team-game or player-game is exact when FGA, FGM, 3PA and 3PM all equal the box score's. The corner and above-the-break threes with those from beyond half court and off the court against the threes of the rows, regular season. Curves: the league's FG% by distance from the shots against `nba_stats_metric_curves`, binned the same way (the exact distance, every season type), weighted by attempts. ESPN: its shots that are not free throws against the box score's FGA, regular season; never read by a metric.

| Season  | Zones = shots (rows off) | Recount = table | 3 inside / 2 outside | Team-games exact (all four) | Player-games exact | Playoff team-games | Corner + ATB + back of 3PA | Curves, mean diff (pts) | ESPN FGA exact |
| ------- | -----------------------: | --------------: | -------------------: | --------------------------: | -----------------: | -----------------: | -------------------------: | ----------------------: | -------------: |
| 1996-97 |                        0 |             yes |            21026 / 8 |                        99.6 |               99.9 |              100.0 |                        all |                    0.00 |              – |
| 1997-98 |                        0 |             yes |             362 / 17 |                        99.8 |               99.9 |              100.0 |                        all |                    0.00 |              – |
| 1998-99 |                        0 |             yes |              69 / 21 |                        99.9 |              100.0 |              100.0 |                        all |                    0.00 |              – |
| 1999-00 |                        0 |             yes |             159 / 13 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |              – |
| 2000-01 |                        0 |             yes |               51 / 7 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |              – |
| 2001-02 |                        0 |             yes |               81 / 8 |                        99.9 |              100.0 |              100.0 |                        all |                    0.00 |           31.2 |
| 2002-03 |                        0 |             yes |               80 / 2 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           57.0 |
| 2003-04 |                        0 |             yes |               58 / 7 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           75.7 |
| 2004-05 |                        0 |             yes |              101 / 6 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           73.0 |
| 2005-06 |                        0 |             yes |              86 / 12 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           75.2 |
| 2006-07 |                        0 |             yes |               87 / 8 |                        99.9 |              100.0 |              100.0 |                        all |                    0.00 |           97.5 |
| 2007-08 |                        0 |             yes |             113 / 13 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           96.8 |
| 2008-09 |                        0 |             yes |             117 / 12 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           98.9 |
| 2009-10 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           98.1 |
| 2010-11 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           98.5 |
| 2011-12 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           98.4 |
| 2012-13 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           76.1 |
| 2013-14 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           98.0 |
| 2014-15 |                        0 |             yes |                2 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           97.3 |
| 2015-16 |                        0 |             yes |                5 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           52.4 |
| 2016-17 |                        0 |             yes |                0 / 1 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           92.9 |
| 2017-18 |                        0 |             yes |              102 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           94.9 |
| 2018-19 |                        0 |             yes |              134 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.00 |           96.0 |
| 2019-20 |                        0 |             yes |               96 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.01 |           96.2 |
| 2020-21 |                        0 |             yes |               81 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.04 |           97.2 |
| 2021-22 |                        0 |             yes |              209 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.04 |           97.2 |
| 2022-23 |                        0 |             yes |              128 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.03 |           98.5 |
| 2023-24 |                        0 |             yes |                6 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.04 |           97.8 |
| 2024-25 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.03 |           98.6 |
| 2025-26 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |              100.0 |                        all |                    0.03 |           61.3 |
| 2026-27 |                        0 |             yes |                0 / 0 |                       100.0 |              100.0 |                  – |                        all |                    0.00 |           61.2 |

The NBA's file has no zone column (no table of a full load has one), so the zones cannot be compared with a published zone; they are recounted instead, and the published value is compared with where the three-point line is. 1996-97's threes inside the arc are its 22-foot line. After it, the few threes recorded inside the line and twos beyond it are kept as the published value has them: the value matches the box scores.

The league's FG% by zone, regular season, as the metrics compare with it (from the shots; the dataset's curves have distance bins only):

| Season  |   RA | Paint |  Mid | L corner 3 | R corner 3 | ATB 3 |
| ------- | ---: | ----: | ---: | ---------: | ---------: | ----: |
| 1996-97 | 55.1 |  43.3 | 41.1 |       39.5 |       35.4 |  35.9 |
| 1997-98 | 60.2 |  37.0 | 38.9 |       36.8 |       37.8 |  34.2 |
| 1998-99 | 59.5 |  36.4 | 38.0 |       38.3 |       36.1 |  33.2 |
| 1999-00 | 60.9 |  37.4 | 39.5 |       38.7 |       38.3 |  34.6 |
| 2000-01 | 60.0 |  37.1 | 39.1 |       37.9 |       38.2 |  34.8 |
| 2001-02 | 59.4 |  38.8 | 39.1 |       38.1 |       38.5 |  34.8 |
| 2002-03 | 59.2 |  39.0 | 38.7 |       36.5 |       37.1 |  34.7 |
| 2003-04 | 58.2 |  38.6 | 38.2 |       37.9 |       37.6 |  34.0 |
| 2004-05 | 58.5 |  39.8 | 39.2 |       37.8 |       39.1 |  34.9 |
| 2005-06 | 59.2 |  40.5 | 39.8 |       38.6 |       39.1 |  35.1 |
| 2006-07 | 60.0 |  41.3 | 39.9 |       38.4 |       38.3 |  35.2 |
| 2007-08 | 60.0 |  40.9 | 40.2 |       39.2 |       40.0 |  35.4 |
| 2008-09 | 59.6 |  41.2 | 40.2 |       39.3 |       39.4 |  36.1 |
| 2009-10 | 60.6 |  42.3 | 40.0 |       39.2 |       39.1 |  34.5 |
| 2010-11 | 62.0 |  39.1 | 40.0 |       39.2 |       39.8 |  34.9 |
| 2011-12 | 60.5 |  38.1 | 38.7 |       37.6 |       37.7 |  34.2 |
| 2012-13 | 60.5 |  38.5 | 39.3 |       38.5 |       39.3 |  35.1 |
| 2013-14 | 60.8 |  39.4 | 39.4 |       39.1 |       38.9 |  35.3 |
| 2014-15 | 60.1 |  39.3 | 39.5 |       38.0 |       39.2 |  34.1 |
| 2015-16 | 60.2 |  40.1 | 39.8 |       37.3 |       38.1 |  34.9 |
| 2016-17 | 61.1 |  41.8 | 40.2 |       38.5 |       38.9 |  35.1 |
| 2017-18 | 63.1 |  39.8 | 40.3 |       38.4 |       40.3 |  35.6 |
| 2018-19 | 62.9 |  40.4 | 40.2 |       38.5 |       37.7 |  35.0 |
| 2019-20 | 63.5 |  39.9 | 40.5 |       39.7 |       38.1 |  35.1 |
| 2020-21 | 64.1 |  42.7 | 41.5 |       39.7 |       38.8 |  36.0 |
| 2021-22 | 65.3 |  42.9 | 40.6 |       38.4 |       38.1 |  34.6 |
| 2022-23 | 66.6 |  44.4 | 42.0 |       38.5 |       38.6 |  35.4 |
| 2023-24 | 66.3 |  44.0 | 41.8 |       38.6 |       39.4 |  35.9 |
| 2024-25 | 66.3 |  44.4 | 41.6 |       38.7 |       38.9 |  35.3 |
| 2025-26 | 67.1 |  44.5 | 41.7 |       38.7 |       38.6 |  35.0 |
| 2026-27 | 65.7 |  44.4 | 40.0 |       35.9 |       35.9 |  34.8 |

## On court, per season

Measured 2026-11-12 on a copy of T901's full load after a real refresh by `scripts/check-on-off.mjs`, which writes these tables; how the tables are built is in [stats-database.md](stats-database.md), "On court", and the traps under "Traps", "On court".

- **Tolerances.** Counts and plus-minus are exact or they miss; minutes are within 30 seconds of the box score's (it prints seconds from 2005-06, whole minutes on most of 2003-04 and 2004-05); a five-man unit's minutes are within a minute or 10 % of the NBA's, its points, field goals and plus-minus exact or within 2, and its possessions within 5 % plus one.
- **Team-games:** the units add up to the box score on every count on 89.6 to 98.1 % of team-games, and points on 99.3 to 100 %: what misses is T901's assists and fouls, not the lineups. Every possession the file counts is credited to a unit.
- **Possessions' points against the box score,** the plan's old check: exact on 99.7 % of 1996-97's team-games and 100 % of every season after, so within 5 on 99.9 to 100 %. The "about 96 % within 5 before 2017-18" was the file before its republication.
- **Player-games:** on-court plus-minus equals the box score's on 95.3 to 97.5 % of player-games a season to 2011-12, and 89.4 to 93.6 % from 2012-13; within 2 on 95 to 99.7 %. Minutes are within a minute on 92.2 to 99.6 %. The later seasons have more mid-possession substitutions and more of the lineup file's slips (below). From 1996-97 every season is within these bounds, so coverage starts there: no early season reads worse than the latest.
- **On plus off** equals the team's line exactly on every player-game.
- **Five-man units:** 99.2 to 100 % of the units the NBA lists in a regular season are found, and 94.6 to 99 % of its playoff units. Minutes agree within 10 % on 91.6 to 99.2 % in the regular season, 93.3 to 99.5 % in the playoffs; points within 2 on 80.5 to 97.3 % and 91.3 to 99 %. Possessions agree within 5 % on only 66 to 84 % in the regular season: SportsDataverse counts about 5 % fewer than the NBA, steadily. The worst misses are units the lineup file credits a few minutes too many or too few, where a substitution it kept a player on through: their plus-minus still agrees within 10.
- **Cost, every Stage 9 table together, measured alone** (2026-11-13, main with #57's score fix, a fresh copy of T901's load, nothing else running): the two on-court tables hold 1,182,262 and 818,397 rows, beside 19,059,316 and 14,288,099 plays, 10,879,925 and 1,279,010 split rows and 749,347 and 76,393 shot rows. The `stats:plays` step rebuilt every season of every builder (`PLAYS_VERSION` 4), 48,332,749 rows, in 450 seconds, peak memory 2.49 GB. The file went from 5.16 GB to a peak of 5.71 GB (with its write-ahead log) and settled at 5.69 GB, 5.63 GB of it in use. **Against D22's 6 GB: 0.29 GB under at the peak, 0.31 GB under after.** A rebuild of the current season alone, as a daily refresh does, took 3.3 seconds for 244,129 rows, peaked at 5.69 GB and left the file as it was. The on-court tables alone, before the splits and shots joined, took the file from 5.16 to 5.49 GB under the same rebuild.
- **No on-court number reads the score columns** (`home_after`, `away_after`, the score before) that #57 corrected before 2017-18: the tables sum `play_nba`'s flags, whose points come from the shot value and made free throws, and the per-season tables above were identical before and after the fix.

#### Team-games: units summed against the box score

Share of regular-season team-games (%) whose count summed over the units equals the team box score; "All" is every count at once. "Poss" is the possessions credited to units against the possessions file's count; the last two are the possessions file's own points against the box score.

| Season  | Team-games | PTS   | FGA   | FGM   | 3PA   | FTA   | OREB  | DREB  | AST  | STL   | BLK   | TOV   | PF   | All  | Poss  | File PTS exact | File PTS ±5 |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- | ----- | ----- | ----- | ---- | ---- | ----- | -------------- | ----------- |
| 1996-97 | 2378       | 99.8  | 99.6  | 99.8  | 99.8  | 100.0 | 99.8  | 99.7  | 98.5 | 99.0  | 99.9  | 99.7  | 92.3 | 89.6 | 100.0 | 99.7           | 99.9        |
| 1997-98 | 2378       | 100.0 | 99.9  | 100.0 | 100.0 | 100.0 | 99.9  | 100.0 | 99.2 | 99.9  | 100.0 | 100.0 | 92.0 | 90.8 | 100.0 | 100.0          | 100.0       |
| 1998-99 | 1450       | 100.0 | 99.9  | 100.0 | 99.9  | 100.0 | 99.9  | 100.0 | 99.7 | 99.9  | 100.0 | 99.9  | 93.7 | 93.1 | 100.0 | 100.0          | 100.0       |
| 1999-00 | 2378       | 100.0 | 100.0 | 100.0 | 100.0 | 99.9  | 100.0 | 100.0 | 99.5 | 100.0 | 100.0 | 100.0 | 97.0 | 96.3 | 100.0 | 100.0          | 100.0       |
| 2000-01 | 2378       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.5 | 100.0 | 100.0 | 100.0 | 96.6 | 96.1 | 100.0 | 100.0          | 100.0       |
| 2001-02 | 2378       | 100.0 | 99.9  | 100.0 | 100.0 | 100.0 | 99.9  | 100.0 | 99.2 | 99.9  | 99.9  | 99.9  | 94.6 | 93.7 | 100.0 | 100.0          | 100.0       |
| 2002-03 | 2378       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.1 | 99.9  | 100.0 | 99.9  | 96.6 | 95.5 | 100.0 | 100.0          | 100.0       |
| 2003-04 | 2378       | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.1 | 100.0 | 100.0 | 100.0 | 97.8 | 96.7 | 100.0 | 100.0          | 100.0       |
| 2004-05 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.5 | 100.0 | 100.0 | 100.0 | 98.2 | 97.6 | 100.0 | 100.0          | 100.0       |
| 2005-06 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.1 | 100.0 | 100.0 | 100.0 | 98.4 | 97.4 | 100.0 | 100.0          | 100.0       |
| 2006-07 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.9  | 98.9 | 100.0 | 100.0 | 100.0 | 99.3 | 98.1 | 100.0 | 100.0          | 100.0       |
| 2007-08 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.3 | 100.0 | 100.0 | 100.0 | 98.6 | 97.9 | 100.0 | 100.0          | 100.0       |
| 2008-09 | 2460       | 99.3  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.9  | 99.5 | 100.0 | 100.0 | 100.0 | 98.6 | 97.2 | 100.0 | 100.0          | 100.0       |
| 2009-10 | 2460       | 99.6  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.4 | 100.0 | 100.0 | 100.0 | 98.6 | 97.5 | 100.0 | 100.0          | 100.0       |
| 2010-11 | 2460       | 99.6  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.4 | 100.0 | 100.0 | 100.0 | 98.9 | 97.9 | 100.0 | 100.0          | 100.0       |
| 2011-12 | 1980       | 99.4  | 100.0 | 100.0 | 100.0 | 99.9  | 100.0 | 99.9  | 98.5 | 100.0 | 100.0 | 100.0 | 98.9 | 96.8 | 100.0 | 100.0          | 100.0       |
| 2012-13 | 2458       | 99.7  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.4 | 100.0 | 100.0 | 100.0 | 98.2 | 96.2 | 100.0 | 100.0          | 100.0       |
| 2013-14 | 2460       | 99.3  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 95.1 | 100.0 | 100.0 | 100.0 | 99.0 | 93.5 | 100.0 | 100.0          | 100.0       |
| 2014-15 | 2460       | 99.7  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 95.7 | 100.0 | 100.0 | 100.0 | 98.1 | 93.7 | 100.0 | 100.0          | 100.0       |
| 2015-16 | 2460       | 99.7  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.0 | 100.0 | 100.0 | 100.0 | 98.1 | 95.0 | 100.0 | 100.0          | 100.0       |
| 2016-17 | 2460       | 99.7  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 96.1 | 100.0 | 100.0 | 100.0 | 98.7 | 94.6 | 100.0 | 100.0          | 100.0       |
| 2017-18 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.0 | 100.0 | 100.0 | 100.0 | 98.9 | 96.0 | 100.0 | 100.0          | 100.0       |
| 2018-19 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 96.7 | 100.0 | 100.0 | 100.0 | 99.5 | 96.3 | 100.0 | 100.0          | 100.0       |
| 2019-20 | 2118       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 96.9 | 100.0 | 100.0 | 100.0 | 99.4 | 96.4 | 100.0 | 100.0          | 100.0       |
| 2020-21 | 2160       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 95.4 | 100.0 | 100.0 | 100.0 | 99.4 | 94.7 | 100.0 | 100.0          | 100.0       |
| 2021-22 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.0 | 100.0 | 100.0 | 100.0 | 99.2 | 96.2 | 100.0 | 100.0          | 100.0       |
| 2022-23 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.6 | 100.0 | 100.0 | 100.0 | 99.2 | 96.8 | 100.0 | 100.0          | 100.0       |
| 2023-24 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 96.1 | 100.0 | 100.0 | 100.0 | 99.5 | 95.7 | 100.0 | 100.0          | 100.0       |
| 2024-25 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.2 | 100.0 | 100.0 | 100.0 | 99.3 | 96.6 | 100.0 | 100.0          | 100.0       |
| 2025-26 | 2460       | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.2 | 100.0 | 100.0 | 100.0 | 98.9 | 97.0 | 100.0 | 100.0          | 100.0       |
| 2026-27 | 340        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.1 | 100.0 | 100.0 | 100.0 | 98.5 | 95.6 | 100.0 | 100.0          | 100.0       |

#### Player-games: on court against the box score

Share of regular-season player-games (%) with the lineups' minutes within 30 seconds and a minute of the box score's, the on-court plus-minus equal to the box score's or within 2, and the player's own points from the plays equal to the box score's. "Off the lineups" counts box-score players with minutes the lineups never put on the floor.

| Season  | Player-games | MIN ±0.5 | MIN ±1 | +/- exact | +/- ±2 | Own PTS | Off the lineups |
| ------- | ------------ | -------- | ------ | --------- | ------ | ------- | --------------- |
| 1996-97 | 23612        | 99.2     | 99.5   | 96.3      | 99.5   | 99.9    | 146             |
| 1997-98 | 23853        | 99.4     | 99.5   | 95.9      | 99.5   | 100.0   | 148             |
| 1998-99 | 14831        | 99.4     | 99.6   | 96.6      | 99.6   | 100.0   | 90              |
| 1999-00 | 24169        | 99.5     | 99.6   | 97.2      | 99.6   | 100.0   | 128             |
| 2000-01 | 23822        | 98.5     | 98.7   | 96.3      | 99.0   | 100.0   | 150             |
| 2001-02 | 23741        | 99.4     | 99.6   | 97.5      | 99.7   | 100.0   | 167             |
| 2002-03 | 23796        | 99.3     | 99.5   | 97.3      | 99.6   | 100.0   | 145             |
| 2003-04 | 23731        | 73.8     | 94.8   | 96.7      | 99.4   | 100.0   | 162             |
| 2004-05 | 24806        | 69.2     | 93.7   | 97.0      | 99.6   | 100.0   | 150             |
| 2005-06 | 24689        | 98.9     | 99.3   | 97.2      | 99.5   | 100.0   | 224             |
| 2006-07 | 24859        | 97.5     | 98.1   | 95.8      | 98.8   | 100.0   | 227             |
| 2007-08 | 24694        | 96.4     | 97.1   | 95.3      | 98.3   | 100.0   | 192             |
| 2008-09 | 24460        | 98.7     | 99.0   | 96.6      | 99.4   | 99.9    | 168             |
| 2009-10 | 24672        | 98.3     | 98.6   | 96.5      | 99.0   | 100.0   | 140             |
| 2010-11 | 25018        | 98.0     | 98.4   | 96.5      | 99.0   | 100.0   | 134             |
| 2011-12 | 20558        | 97.1     | 97.7   | 95.8      | 98.7   | 99.9    | 197             |
| 2012-13 | 25506        | 95.3     | 96.3   | 93.6      | 97.8   | 100.0   | 249             |
| 2013-14 | 25314        | 94.2     | 95.7   | 93.0      | 97.5   | 99.9    | 301             |
| 2014-15 | 25721        | 91.7     | 93.4   | 90.8      | 96.1   | 100.0   | 258             |
| 2015-16 | 25855        | 93.1     | 94.7   | 91.7      | 96.8   | 100.0   | 220             |
| 2016-17 | 25869        | 92.7     | 94.5   | 91.3      | 96.6   | 100.0   | 269             |
| 2017-18 | 25829        | 93.9     | 95.4   | 90.9      | 96.0   | 100.0   | 274             |
| 2018-19 | 25869        | 93.2     | 94.8   | 91.8      | 96.3   | 100.0   | 231             |
| 2019-20 | 22178        | 92.6     | 94.3   | 91.4      | 96.6   | 100.0   | 213             |
| 2020-21 | 22715        | 91.6     | 93.4   | 90.5      | 95.7   | 100.0   | 338             |
| 2021-22 | 25665        | 91.2     | 93.1   | 89.9      | 95.4   | 100.0   | 372             |
| 2022-23 | 25548        | 90.7     | 92.6   | 89.7      | 95.2   | 100.0   | 346             |
| 2023-24 | 25905        | 89.9     | 92.2   | 89.4      | 95.0   | 100.0   | 494             |
| 2024-25 | 25867        | 93.0     | 94.5   | 92.6      | 96.6   | 100.0   | 439             |
| 2025-26 | 26635        | 91.9     | 93.5   | 91.4      | 96.0   | 100.0   | 15              |
| 2026-27 | 3778         | 90.3     | 92.6   | 89.8      | 95.5   | 100.0   | 65              |

#### On plus off

On plus off equals the team's line in the game, for every count and the seconds, on 818397 of 818397 player-games (all seasons and types).

#### Five-man units against the published lineups

Units the NBA's base file lists (its 2,000 a regular season with the most minutes, and its playoff units), joined on team, season, season type and the five ids. "Found" is the share Metis's count has at all; the rest are shares of those found (%): minutes within a minute and within 10 % (plus a minute), points and field goals made exact or within 2, plus-minus exact or within 2, and possessions within 2 and within 5 % (plus one) of the advanced file's. "POSS ratio" is Metis's possessions over the NBA's, summed over the units found.

| Season  | Type     | Units | Found | MIN ±1 | MIN ±10% | PTS  | PTS ±2 | FGM  | +/-  | +/- ±2 | POSS ±2 | POSS ±5% | POSS ratio |
| ------- | -------- | ----- | ----- | ------ | -------- | ---- | ------ | ---- | ---- | ------ | ------- | -------- | ---------- |
| 2007-08 | regular  | 2000  | 100.0 | 88.7   | 97.0     | 86.0 | 91.0   | 88.8 | 84.2 | 93.0   | 48.7    | 73.7     | 0.958      |
| 2008-09 | regular  | 2000  | 100.0 | 96.1   | 99.2     | 93.7 | 97.3   | 95.9 | 90.7 | 97.7   | 49.0    | 76.2     | 0.958      |
| 2009-10 | regular  | 2000  | 100.0 | 94.0   | 98.3     | 91.8 | 95.2   | 94.2 | 89.6 | 96.4   | 50.0    | 74.1     | 0.958      |
| 2010-11 | regular  | 2000  | 100.0 | 92.8   | 97.9     | 90.1 | 94.5   | 92.8 | 87.5 | 94.9   | 48.8    | 73.7     | 0.958      |
| 2011-12 | regular  | 2000  | 100.0 | 92.6   | 97.2     | 91.1 | 94.0   | 93.0 | 89.3 | 95.7   | 57.9    | 76.2     | 0.957      |
| 2012-13 | regular  | 2000  | 100.0 | 86.8   | 95.0     | 83.5 | 88.5   | 86.3 | 81.8 | 90.5   | 46.2    | 69.9     | 0.955      |
| 2013-14 | regular  | 2000  | 100.0 | 84.6   | 95.0     | 80.8 | 87.0   | 84.0 | 79.8 | 90.2   | 49.5    | 72.3     | 0.957      |
| 2014-15 | regular  | 2000  | 100.0 | 77.3   | 91.8     | 74.8 | 80.8   | 76.8 | 73.0 | 84.9   | 44.9    | 66.0     | 0.952      |
| 2015-16 | regular  | 2000  | 100.0 | 80.9   | 93.0     | 77.9 | 83.9   | 81.0 | 75.7 | 86.7   | 45.2    | 67.8     | 0.953      |
| 2016-17 | regular  | 2000  | 100.0 | 80.0   | 93.3     | 76.3 | 82.7   | 79.7 | 73.3 | 87.0   | 45.5    | 68.8     | 0.954      |
| 2017-18 | regular  | 2000  | 100.0 | 84.5   | 95.3     | 80.5 | 86.9   | 84.1 | 77.5 | 89.6   | 44.0    | 66.0     | 0.948      |
| 2018-19 | regular  | 2000  | 100.0 | 83.4   | 93.8     | 79.8 | 85.0   | 82.1 | 78.6 | 89.5   | 43.5    | 67.8     | 0.950      |
| 2019-20 | regular  | 2000  | 100.0 | 82.7   | 93.5     | 78.0 | 84.5   | 81.9 | 76.4 | 87.8   | 48.4    | 69.3     | 0.950      |
| 2020-21 | regular  | 2000  | 100.0 | 80.5   | 91.9     | 77.4 | 82.8   | 79.8 | 75.6 | 86.4   | 52.0    | 71.9     | 0.953      |
| 2021-22 | regular  | 2000  | 100.0 | 81.8   | 93.5     | 77.9 | 83.8   | 80.2 | 76.3 | 87.5   | 47.0    | 68.2     | 0.949      |
| 2022-23 | regular  | 2000  | 100.0 | 79.5   | 92.8     | 76.3 | 82.1   | 78.8 | 74.4 | 86.0   | 49.4    | 69.5     | 0.951      |
| 2023-24 | regular  | 2000  | 100.0 | 77.5   | 91.6     | 75.0 | 80.5   | 78.0 | 73.1 | 84.2   | 46.3    | 67.3     | 0.950      |
| 2024-25 | regular  | 2000  | 100.0 | 83.9   | 95.4     | 80.4 | 85.5   | 83.2 | 78.1 | 88.4   | 50.0    | 71.9     | 0.954      |
| 2025-26 | regular  | 2000  | 100.0 | 79.7   | 92.5     | 75.6 | 81.5   | 78.8 | 73.2 | 85.2   | 49.8    | 70.0     | 0.953      |
| 2026-27 | regular  | 2000  | 99.2  | 91.9   | 95.0     | 89.8 | 93.9   | 91.6 | 87.9 | 95.0   | 87.9    | 84.4     | 0.945      |
| 2007-08 | playoffs | 1002  | 97.5  | 98.1   | 98.3     | 97.3 | 98.2   | 98.3 | 96.8 | 98.9   | 91.0    | 90.3     | 0.947      |
| 2008-09 | playoffs | 996   | 98.0  | 97.2   | 98.1     | 96.9 | 98.0   | 97.4 | 95.1 | 98.5   | 91.4    | 89.2     | 0.946      |
| 2009-10 | playoffs | 967   | 98.6  | 98.3   | 99.2     | 96.9 | 98.7   | 97.6 | 96.6 | 99.2   | 91.3    | 90.7     | 0.948      |
| 2010-11 | playoffs | 957   | 99.0  | 98.5   | 99.2     | 97.4 | 99.0   | 98.6 | 96.9 | 99.4   | 90.1    | 87.9     | 0.941      |
| 2011-12 | playoffs | 1054  | 97.2  | 98.9   | 99.5     | 97.7 | 98.8   | 98.4 | 96.6 | 99.1   | 90.9    | 90.8     | 0.945      |
| 2012-13 | playoffs | 1157  | 97.4  | 97.8   | 98.1     | 97.2 | 98.3   | 97.8 | 96.5 | 98.8   | 90.8    | 89.9     | 0.944      |
| 2013-14 | playoffs | 1149  | 97.0  | 97.6   | 98.3     | 96.7 | 98.3   | 97.6 | 96.3 | 98.1   | 90.5    | 87.8     | 0.943      |
| 2014-15 | playoffs | 1108  | 96.2  | 93.7   | 96.3     | 92.2 | 94.7   | 93.4 | 89.4 | 94.7   | 88.0    | 86.5     | 0.941      |
| 2015-16 | playoffs | 1262  | 97.0  | 95.3   | 97.6     | 93.5 | 96.0   | 94.4 | 92.1 | 97.1   | 91.7    | 88.5     | 0.944      |
| 2016-17 | playoffs | 1240  | 97.3  | 93.4   | 96.1     | 90.9 | 94.6   | 92.1 | 90.2 | 95.4   | 90.1    | 87.2     | 0.942      |
| 2017-18 | playoffs | 1203  | 97.7  | 98.3   | 99.0     | 96.6 | 98.1   | 97.6 | 95.1 | 98.3   | 92.7    | 90.0     | 0.942      |
| 2018-19 | playoffs | 1148  | 96.9  | 92.1   | 94.8     | 91.1 | 93.3   | 92.7 | 89.5 | 94.5   | 88.0    | 85.1     | 0.938      |
| 2019-20 | playoffs | 1168  | 96.8  | 90.5   | 94.0     | 87.7 | 91.6   | 90.0 | 85.0 | 93.0   | 86.3    | 83.0     | 0.938      |
| 2020-21 | playoffs | 1287  | 94.6  | 92.9   | 96.7     | 91.7 | 95.1   | 92.7 | 90.3 | 95.5   | 88.7    | 85.3     | 0.938      |
| 2021-22 | playoffs | 1253  | 96.2  | 92.9   | 95.1     | 91.4 | 93.5   | 93.2 | 89.2 | 95.0   | 88.9    | 86.2     | 0.940      |
| 2022-23 | playoffs | 1090  | 97.1  | 92.9   | 95.7     | 90.9 | 93.2   | 91.9 | 90.1 | 95.5   | 88.5    | 86.6     | 0.939      |
| 2023-24 | playoffs | 1108  | 96.4  | 89.6   | 94.2     | 87.2 | 92.4   | 89.1 | 86.0 | 94.0   | 86.0    | 81.6     | 0.935      |
| 2024-25 | playoffs | 1210  | 96.4  | 89.5   | 93.3     | 86.6 | 91.3   | 89.4 | 85.4 | 93.2   | 85.7    | 82.5     | 0.934      |
| 2025-26 | playoffs | 1442  | 98.5  | 95.3   | 97.0     | 93.8 | 96.3   | 94.9 | 93.1 | 96.8   | 91.3    | 88.6     | 0.935      |

#### The ten largest minute misses

Units found in both, by the gap in minutes.

| Season  | Type    | Team | Unit                                                                    | NBA MIN | Metis MIN | NBA PTS | Metis PTS | NBA +/- | Metis +/- |
| ------- | ------- | ---- | ----------------------------------------------------------------------- | ------- | --------- | ------- | --------- | ------- | --------- |
| 2018-19 | regular | OKC  | R. Westbrook - P. George - S. Adams - J. Grant - T. Ferguson            | 919.3   | 1068.4    | 2249    | 2590      | 160     | 150       |
| 2018-19 | regular | OKC  | R. Westbrook - P. George - D. Schroder - S. Adams - J. Grant            | 434.3   | 301.2     | 1144    | 843       | 85      | 85        |
| 2022-23 | regular | ATL  | C. Capela - D. Murray - J. Collins - T. Young - D. Hunter               | 737.7   | 795.1     | 1847    | 1988      | 82      | 79        |
| 2013-14 | regular | PHX  | C. Frye - G. Green - P. Tucker - G. Dragic - M. Plumlee                 | 526.1   | 578.3     | 1184    | 1300      | 6       | 9         |
| 2021-22 | regular | DEN  | J. Green - W. Barton - A. Gordon - N. Jokic - M. Morris                 | 761.2   | 710.3     | 1928    | 1800      | 146     | 144       |
| 2019-20 | regular | OKC  | C. Paul - D. Gallinari - D. Schroder - S. Adams - S. Gilgeous-Alexander | 176.6   | 130       | 518     | 408       | 126     | 123       |
| 2022-23 | regular | ATL  | C. Capela - B. Bogdanovic - D. Murray - J. Collins - D. Hunter          | 71.5    | 25        | 172     | 73        | -25     | -1        |
| 2022-23 | regular | HOU  | K. Porter Jr. - J. Green - K. Martin Jr. - A. Sengun - J. Smith Jr.     | 439.8   | 399.6     | 1028    | 937       | -77     | -67       |
| 2021-22 | regular | ATL  | D. Gallinari - C. Capela - K. Huerter - T. Young - D. Hunter            | 232.4   | 270.2     | 578     | 651       | 9       | -15       |
| 2023-24 | regular | ATL  | C. Capela - B. Bogdanovic - D. Murray - D. Hunter - V. Krejci           | 158     | 121.2     | 373     | 285       | 31      | 23        |

## Play-derived stats, per season (Plan T905)

Measured 2026-11-13 on a copy of the full load after a real refresh that built every play table with T905's (`~/.cache/metis-dev/t905`), by `scripts/check-play-derived.mjs`, which writes every table below in full. How the tables are built is in [stats-database.md](stats-database.md), "Play-derived stats"; the rules are data in `src/shared/stats/playDetail.ts`; the traps are under "Traps", "Play-derived stats".

### Where each entry comes from

Reference section 16, entry by entry, and the entries of sections 3 and 13 the plan sends to the plays. "Built" is a metric of the Play by play family (`catalogue/plays.ts`) or a read; "elsewhere" is another task's table; "not built" says why.

| Entry (section 16)                                                                                                  | Where it comes from                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-ball / dead-ball turnovers                                                                                     | Built: a turnover with a steal credited is live-ball, the rest dead-ball (the feed tags no other way)                                                     |
| Bad-pass / lost-ball / offensive-foul / traveling / shot-clock / out-of-bounds turnovers                            | Built: eight disjoint kinds from `sub_type` (bad pass, lost ball, offensive foul, traveling, shot clock, stepped out of bounds, other violations, other)  |
| Shooting / non-shooting / offensive / loose-ball / take / transition-take / clear-path / technical / flagrant fouls | Built: ten personal-foul kinds that add up to PF, technicals and defensive three seconds apart                                                            |
| And-one opportunities / conversions                                                                                 | Built: a make, a shooting foul by the other side and a "1 of 1" free throw by the shooter at the same moment; converted when it went in                   |
| Two-shot / three-shot foul trips                                                                                    | Built: counted once a trip, on the "1 of 2" and "1 of 3" free throws                                                                                      |
| Free-throw trip rate                                                                                                | Built: shooting-foul trips (two- and three-shot and and-ones) per field-goal attempt, labelled so                                                         |
| Actual scoring attempts / possession-ending trips                                                                   | Not built: needs possession-ending rules for free throws the plan has not assigned; the possessions (`possession`) hold the ends, for T907 or later       |
| Assisted two-point / three-point points (assist points)                                                             | Built: 2 × assists on twos + 3 × assists on threes, for the passer; a team's from its assisted makes                                                      |
| Assist networks                                                                                                     | Built: its own read (`assists`), passer to scorer with makes, threes and points, for a team or a player over any scope                                    |
| Unassisted rim / mid-range / three makes                                                                            | Elsewhere and built: by zone, the shot tables' makes less assisted makes (Plan T903); unassisted twos and threes here                                     |
| Blocked-shot recovery rate                                                                                          | Not built: who recovered a block is the next rebound or turnover, a possession-chain rule the plan has not assigned                                       |
| Offensive rebound retention / second-chance PPP                                                                     | Not built here: the dataset's possessions mark `is_second_chance`; reading them is possession work (T904's tables, T907)                                  |
| Transition after steal / defensive rebound / made basket                                                            | Not built here: `possession_start_type` and `is_transition` are in the possessions file, the same                                                         |
| Half-court frequency / PPP                                                                                          | Not built here: the same file's `is_transition`, the same                                                                                                 |
| Average possession duration                                                                                         | Not built here: the possessions' start and end clocks, the same                                                                                           |
| After-timeout efficiency                                                                                            | Not built: needs a rule for which possessions follow a timeout; listed for later                                                                          |
| After-dead-ball / sideline / baseline out-of-bounds efficiency                                                      | Not available: the feed does not tag inbound locations (reference: licensed video)                                                                        |
| Jump balls won / lost / win%                                                                                        | Not built: the winner is named only in the text ("Tip to Grimes"), by a name to match; listed for later                                                   |
| Goaltending / basket interference / other violations                                                                | Built: defensive goaltending and kicked balls per player; offensive goaltending is a turnover kind                                                        |
| Substitutions / stints / rotation lengths                                                                           | Elsewhere: Plan T904's units and time on court                                                                                                            |
| Timeouts taken / remaining                                                                                          | Not built: a team's timeouts are rows (`kind = 'timeout'`), but not a performance statistic; listed only                                                  |
| Coach's challenges / successful challenges                                                                          | Not built: the challenge row names the team (2,591 rows), the ruling rows do not (5,021 overturned, 2,014 stand); pairing them is a rule not yet assigned |
| Buzzer-beaters / game winners / go-ahead shots                                                                      | Not built: needs the stated clock tolerance and rules the reference asks for; the flow read has every scoring play in order                               |
| Scoring drought / longest run / lead-preserving possessions                                                         | Built: runs and droughts (below); lead-preserving possessions not built                                                                                   |

| Entry (sections 3 and 13)              | Where it comes from                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fouls drawn                            | Built: ESPN's play by play, which names the fouled player, read from 2006-07 to 2016-17 (below)                    |
| Offensive fouls                        | Built: a foul kind; the turnover it causes is a turnover kind, so a possession is never counted twice in one count |
| Technical fouls / team technical fouls | Built: a player's, and a team's with its bench and delay technicals                                                |
| Flagrant fouls / ejections             | Built: flagrants of type 1 and 2; ejections from the play by play's ejection rows                                  |
| Disqualifications                      | Not built: a sixth foul is not a row; it can be read from PF ≥ 6 in the box score                                  |
| Team fouls / bonus status              | Not built: a period's state, not a statistic over games                                                            |
| Largest lead, largest scoring run      | Built: per team-game, averaged per game; and on each game's flow chart                                             |
| Lead changes, times tied               | Built: the same                                                                                                    |
| Time leading / tied / trailing         | Built: the same, by the game clock                                                                                 |
| Comeback size                          | Not built: neither section 13 nor 16 lists it                                                                      |

### The feed's spellings

`play_nba.subtype`, the NBA's `sub_type` trimmed. Every spelling, its rows and its first and last season; the kind it falls in is in `src/shared/stats/playDetail.ts`.

Turnovers: Bad Pass 463,711 (1996-97 on); Lost Ball 242,960 (1996-97 on); Foul 103,878 (1996-97 to 2016-17, an offensive foul's turnover); Traveling 75,698; Out of Bounds - Bad Pass Turnover 47,766 (2015-16 on); Shot Clock Turnover 47,554; Out of Bounds Lost Ball Turnover 46,320 (2003-04 on); Offensive Foul Turnover 42,957 (2003-04 on, a few dozen a season until 2017-18); Step Out of Bounds Turnover 18,498 (2003-04 on); 3 Second Violation 17,110; Poss Lost Ball Turnover 8,895 (2003-04 to 2016-17); Out Of Bounds 6,082 (to 2016-17); Backcourt Turnover 5,632; Offensive Goaltending 4,629; Discontinue Dribble 4,089; Palming Turnover 3,460 (2000-01 on); Double Dribble 3,137; 8 Second Violation 1,056; Lane Violation 998; Inbound Turnover 901; 5 Second Violation 871; Kicked Ball Violation 702; no type 616; Illegal Screen Turnover 578; 5 Second Inbound Turnover 493; Illegal Assist Turnover 239; Illegal Pick 182; Jump Ball Violation 155; Isolation Violation 52; Basket from Below Turnover 41; Double Personal Turnover 32; Punched Ball Turnover 31; Excess Timeout Turnover 26; Player Out of Bounds Violation Turnover 24; Swinging Elbows Turnover 19; Post Up Turnover 18; Stolen Pass Turnover 17; Too Many Players Turnover 9; Opposite Basket Turnover 6; 10 Second Violaton 4 (sic, 2023-24 on).

Fouls: Shooting 779,004; Personal 578,238; Offensive 123,198; Loose Ball 104,568; Technical 28,190; Personal Take 23,410 (2010-11 on); Offensive Charge 23,097 (2010-11 on); Defense 3 Second 21,358; Shooting Block 7,564 and Personal Block 6,257 (2010-11 to 2017-18); Flagrant Type 1 4,221; Double Technical 3,403; Clear Path 2,358; Away From Play 2,356; Double Personal 1,724; Inbound 966 (to 2017-18); Delay Technical 858; Transition Take 698 (2022-23 on); Hanging Technical 487; Flagrant Type 2 400; Taunting Technical 273; Flopping 147 (2023-24 on); Non-Unsportsmanlike Technical 121; Excess Timeout Technical 32; Too Many Players Technical 21; Elbow 13; Punching 10; Bench 7; no type 4 (none a personal foul).

**Unmapped:** every foul spelling is mapped (0 personal fouls unmapped in every season). The turnovers no kind lists are those with no type: 0 to 7 a season (0.0 %) except 2015-16 (28), 2016-17 (38), 2017-18 (241, 0.6 %), 2018-19 (103) and 2019-20 to 2021-22 (35 to 49); they count in "other".

### What the tables are checked against

**Tolerance:** exact, nothing tuned. "Sum ≠" counts rows whose kinds do not add up to their turnovers (and live plus dead to them) or whose foul kinds do not add up to their personal fouls; 0 in every season is the check. Box-score rows only.

**Turnovers and fouls.** Kinds that do not add up to the total are counted as "sum ≠" (0 everywhere is the check). Team turnovers: the box score leaves out the team’s own (a shot-clock violation with no player), so the plays’ team total less those is compared; the column beside counts them in. Fouls: the gap is the box score’s fouls the feed has no row for, summed.

| Season  | Player-games | Sum ≠ | TOV exact | PF exact | Team-games | Sum ≠ | TOV exact | TOV w/ team | PF exact | PF ±1 |       PF gap | Unmapped TOV | Unmapped PF |
| ------- | -----------: | ----: | --------: | -------: | ---------: | ----: | --------: | ----------: | -------: | ----: | -----------: | -----------: | ----------: |
| 1996-97 |        24884 |     0 |      99.9 |     99.1 |       2522 |     0 |      99.7 |        54.7 |     92.0 |  99.5 | 230 of 55967 |    1 (0.0 %) |   0 (0.0 %) |
| 1997-98 |        25140 |     0 |     100.0 |     99.1 |       2520 |     0 |     100.0 |        53.6 |     91.8 |  99.3 | 226 of 56734 |    0 (0.0 %) |   0 (0.0 %) |
| 1998-99 |        16085 |     0 |     100.0 |     99.2 |       1582 |     0 |      99.9 |        51.1 |     93.1 |  99.6 | 115 of 35418 |    0 (0.0 %) |   0 (0.0 %) |
| 1999-00 |        25507 |     0 |     100.0 |     99.7 |       2528 |     0 |      99.9 |        57.4 |     96.9 | 100.0 |  79 of 59044 |    0 (0.0 %) |   0 (0.0 %) |
| 2000-01 |        25101 |     0 |     100.0 |     99.6 |       2520 |     0 |     100.0 |        53.1 |     96.5 |  99.8 |  91 of 56359 |    0 (0.0 %) |   0 (0.0 %) |
| 2001-02 |        24974 |     0 |     100.0 |     99.4 |       2520 |     0 |      99.9 |        54.4 |     94.6 |  99.8 | 142 of 53871 |    5 (0.0 %) |   0 (0.0 %) |
| 2002-03 |        25429 |     0 |     100.0 |     99.7 |       2554 |     0 |      99.9 |        53.4 |     96.6 |  99.9 |  89 of 56010 |    7 (0.0 %) |   0 (0.0 %) |
| 2003-04 |        25257 |     0 |     100.0 |     99.8 |       2542 |     0 |     100.0 |        50.0 |     97.6 | 100.0 |  62 of 54818 |    2 (0.0 %) |   0 (0.0 %) |
| 2004-05 |        26275 |     0 |     100.0 |     99.8 |       2628 |     0 |     100.0 |        53.0 |     98.0 | 100.0 |  52 of 59612 |    6 (0.0 %) |   0 (0.0 %) |
| 2005-06 |        26266 |     0 |     100.0 |     99.8 |       2638 |     0 |     100.0 |        53.7 |     98.4 |  99.9 |  44 of 60255 |    3 (0.0 %) |   0 (0.0 %) |
| 2006-07 |        26228 |     0 |     100.0 |     99.9 |       2618 |     0 |     100.0 |        54.2 |     99.3 | 100.0 |  19 of 58169 |    7 (0.0 %) |   0 (0.0 %) |
| 2007-08 |        26309 |     0 |     100.0 |     99.8 |       2632 |     0 |     100.0 |        55.6 |     98.5 | 100.0 |  40 of 55606 |    0 (0.0 %) |   0 (0.0 %) |
| 2008-09 |        26080 |     0 |     100.0 |     99.9 |       2630 |     0 |     100.0 |        54.6 |     98.6 | 100.0 |  37 of 55626 |    6 (0.0 %) |   0 (0.0 %) |
| 2009-10 |        26172 |     0 |     100.0 |     99.9 |       2624 |     0 |     100.0 |        51.9 |     98.6 | 100.0 |  38 of 55129 |    2 (0.0 %) |   0 (0.0 %) |
| 2010-11 |        26496 |     0 |     100.0 |     99.9 |       2622 |     0 |     100.0 |        51.9 |     98.7 | 100.0 |  33 of 54434 |    5 (0.0 %) |   0 (0.0 %) |
| 2011-12 |        22200 |     0 |     100.0 |     99.9 |       2148 |     0 |     100.0 |        55.4 |     98.7 | 100.0 |  27 of 42301 |    6 (0.0 %) |   0 (0.0 %) |
| 2012-13 |        27167 |     0 |     100.0 |     99.8 |       2630 |     0 |     100.0 |        55.2 |     98.0 |  99.9 |  54 of 52572 |    7 (0.0 %) |   0 (0.0 %) |
| 2013-14 |        27094 |     0 |     100.0 |     99.9 |       2640 |     0 |     100.0 |        56.5 |     99.1 | 100.0 |  25 of 54861 |    3 (0.0 %) |   0 (0.0 %) |
| 2014-15 |        27271 |     0 |     100.0 |     99.8 |       2624 |     0 |     100.0 |        54.2 |     98.1 | 100.0 |  50 of 53281 |    4 (0.0 %) |   0 (0.0 %) |
| 2015-16 |        27628 |     0 |     100.0 |     99.8 |       2634 |     0 |     100.0 |        54.6 |     98.1 | 100.0 |  52 of 53494 |   28 (0.1 %) |   0 (0.0 %) |
| 2016-17 |        27532 |     0 |     100.0 |     99.9 |       2620 |     0 |     100.0 |        55.3 |     98.7 | 100.0 |  33 of 52248 |   38 (0.1 %) |   0 (0.0 %) |
| 2017-18 |        27457 |     0 |     100.0 |     99.9 |       2626 |     0 |     100.0 |        55.6 |     98.9 | 100.0 |  29 of 52264 |  241 (0.6 %) |   0 (0.0 %) |
| 2018-19 |        27520 |     0 |     100.0 |    100.0 |       2628 |     0 |      99.9 |        58.9 |     99.4 |  99.9 |   0 of 55092 |  103 (0.3 %) |   0 (0.0 %) |
| 2019-20 |        23805 |     0 |     100.0 |     99.9 |       2288 |     0 |     100.0 |        53.1 |     99.3 | 100.0 |  16 of 47694 |   42 (0.1 %) |   0 (0.0 %) |
| 2020-21 |        24593 |     0 |     100.0 |     99.9 |       2344 |     0 |     100.0 |        54.8 |     99.4 | 100.0 |  15 of 45416 |   35 (0.1 %) |   0 (0.0 %) |
| 2021-22 |        27560 |     0 |     100.0 |     99.9 |       2648 |     0 |     100.0 |        48.5 |     99.2 | 100.0 |  22 of 52318 |   49 (0.1 %) |   0 (0.0 %) |
| 2022-23 |        27272 |     0 |     100.0 |     99.9 |       2642 |     0 |     100.0 |        51.1 |     99.2 | 100.0 |  20 of 52688 |   11 (0.0 %) |   0 (0.0 %) |
| 2023-24 |        27621 |     0 |     100.0 |    100.0 |       2640 |     0 |     100.0 |        48.2 |     99.5 | 100.0 |  12 of 49469 |    0 (0.0 %) |   0 (0.0 %) |
| 2024-25 |        27725 |     0 |     100.0 |     99.9 |       2648 |     0 |     100.0 |        45.3 |     99.3 | 100.0 |  19 of 49503 |    2 (0.0 %) |   0 (0.0 %) |
| 2025-26 |        28261 |     0 |     100.0 |     99.9 |       2644 |     0 |     100.0 |        47.8 |     98.8 | 100.0 |  32 of 52917 |    3 (0.0 %) |   0 (0.0 %) |
| 2026-27 |         3774 |     0 |     100.0 |     99.9 |        340 |     0 |     100.0 |        45.0 |     98.5 | 100.0 |    5 of 7502 |    0 (0.0 %) |   0 (0.0 %) |

**Assisted makes, and-ones and the flow.** Makes: player-games where assisted plus unassisted twos and threes differ from the plays’ makes (0 is the check). Assists: the scorers’ assisted makes against the box score’s team assists, and the passers’ against each player’s. Shots: player-games where the assisted makes equal the shot table’s `shots_ast` (the same flag through the shot file). And-ones: team-games with more and-ones than the other side’s shooting fouls (0 is the check), and the "1 of 1" free throws beside them. Time: team-games whose time leading, trailing and tied miss the game’s length by more than a tenth (0 is the check). Margin: games whose last scoring play’s margin equals the box score’s. Team assists miss on 1 to 5 % of team-games as Plan T901 measured them: assists named in text no rule matches.

| Season  | Makes ≠ | Team AST exact | Player AST exact | Same as shots | And-ones | Converted | Over shooting fouls | "1 of 1" FTs | Technicals | Flagrants | Time ≠ | Margin exact |
| ------- | ------: | -------------: | ---------------: | ------------: | -------: | --------: | ------------------: | -----------: | ---------: | --------: | -----: | -----------: |
| 1996-97 |       0 |           98.6 |             99.9 |         100.0 |     5314 |      71.0 |                   0 |         5375 |        922 |       152 |      2 |         99.7 |
| 1997-98 |       0 |           99.2 |            100.0 |         100.0 |     5426 |      69.8 |                   0 |         5489 |       1028 |       159 |      2 |         99.8 |
| 1998-99 |       0 |           99.6 |            100.0 |         100.0 |     3132 |      70.2 |                   0 |         3175 |        599 |       125 |      0 |        100.0 |
| 1999-00 |       0 |           99.4 |            100.0 |         100.0 |     5084 |      72.2 |                   0 |         5155 |       1027 |       185 |      0 |         99.9 |
| 2000-01 |       0 |           99.5 |            100.0 |         100.0 |     4868 |      71.6 |                   0 |         4957 |       1163 |       198 |      2 |         99.8 |
| 2001-02 |       0 |           99.2 |            100.0 |         100.0 |     4971 |      72.2 |                   0 |         5047 |       1091 |       218 |      2 |        100.0 |
| 2002-03 |       0 |           99.1 |            100.0 |         100.0 |     5000 |      73.6 |                   0 |         5087 |       1038 |       188 |      0 |        100.0 |
| 2003-04 |       0 |           99.1 |            100.0 |         100.0 |     4866 |      71.9 |                   0 |         4938 |        937 |       116 |      0 |         99.9 |
| 2004-05 |       0 |           99.4 |            100.0 |         100.0 |     5720 |      72.5 |                   0 |         5812 |       1063 |       103 |      0 |        100.0 |
| 2005-06 |       0 |           99.1 |            100.0 |         100.0 |     6083 |      72.9 |                   0 |         6171 |        843 |       129 |      0 |         99.9 |
| 2006-07 |       0 |           98.9 |            100.0 |         100.0 |     6403 |      71.4 |                   0 |         6472 |        908 |       123 |      0 |         99.8 |
| 2007-08 |       0 |           99.3 |            100.0 |         100.0 |     5859 |      73.1 |                   0 |         5940 |        797 |       108 |      0 |         99.9 |
| 2008-09 |       0 |           99.3 |            100.0 |         100.0 |     5985 |      74.3 |                   0 |         6074 |        871 |       109 |      0 |         99.8 |
| 2009-10 |       0 |           99.4 |            100.0 |         100.0 |     6171 |      74.3 |                   0 |         6270 |        759 |        98 |      0 |         99.9 |
| 2010-11 |       0 |           99.4 |            100.0 |         100.0 |     5947 |      74.2 |                   0 |         6633 |        942 |       134 |      0 |         99.9 |
| 2011-12 |       0 |           98.3 |            100.0 |         100.0 |     4237 |      71.0 |                   0 |         4433 |        751 |       103 |      0 |         99.9 |
| 2012-13 |       0 |           98.4 |             99.9 |         100.0 |     5098 |      73.5 |                   0 |         5714 |        926 |       130 |      0 |         99.8 |
| 2013-14 |       0 |           95.3 |             99.5 |         100.0 |     5545 |      73.1 |                   0 |         6138 |        883 |       115 |      0 |        100.0 |
| 2014-15 |       0 |           95.9 |             99.6 |         100.0 |     5165 |      72.7 |                   0 |         5821 |        790 |       141 |      0 |        100.0 |
| 2015-16 |       0 |           96.9 |             99.8 |         100.0 |     5445 |      73.7 |                   0 |         5995 |        752 |       140 |      0 |         99.8 |
| 2016-17 |       0 |           96.2 |             99.7 |         100.0 |     5857 |      74.8 |                   0 |         6483 |        811 |       130 |      2 |        100.0 |
| 2017-18 |       0 |           97.1 |             99.8 |         100.0 |     5833 |      74.6 |                   0 |         6434 |        874 |       119 |     80 |         99.4 |
| 2018-19 |       0 |           96.5 |             99.8 |         100.0 |     6148 |      74.6 |                   0 |         6753 |        929 |       120 |     28 |         99.8 |
| 2019-20 |       0 |           96.8 |             99.8 |         100.0 |     5408 |      73.9 |                   0 |         5584 |        755 |       170 |      8 |        100.0 |
| 2020-21 |       0 |           95.6 |             99.7 |         100.0 |     5269 |      75.1 |                   0 |         5656 |        756 |       173 |     16 |         99.9 |
| 2021-22 |       0 |           96.8 |             99.8 |         100.0 |     6129 |      75.0 |                   0 |         6574 |       1088 |       208 |     10 |         99.8 |
| 2022-23 |       0 |           97.3 |             99.8 |         100.0 |     6922 |      76.5 |                   0 |         7720 |       1024 |       211 |      8 |        100.0 |
| 2023-24 |       0 |           96.3 |             99.7 |         100.0 |     6320 |      75.5 |                   0 |         7019 |        936 |       145 |      6 |        100.0 |
| 2024-25 |       0 |           97.3 |             99.9 |         100.0 |     5897 |      75.7 |                   0 |         6549 |        801 |       168 |      4 |        100.0 |
| 2025-26 |       0 |           98.3 |             99.9 |         100.0 |     6229 |      76.3 |                   0 |         7018 |        824 |       272 |      8 |        100.0 |
| 2026-27 |       0 |           97.1 |             99.9 |         100.0 |      779 |      76.4 |                   0 |          877 |        137 |        38 |      4 |         99.4 |

**The flow recounted.** Every game of six seasons: the raw `src_nba_pbp` score text carried as distinct score states, ties the states level after 0-0, lead changes the switches between non-zero signs, largest leads the extremes; against the home side’s row of `play_team_game`.

| Season  | Games | Lead changes |  Ties | Largest leads | First misses |
| ------- | ----: | -----------: | ----: | ------------: | -----------: |
| 1996-97 |  1261 |        100.0 | 100.0 |         100.0 |            – |
| 2002-03 |  1277 |        100.0 | 100.0 |         100.0 |            – |
| 2008-09 |  1317 |        100.0 |  99.9 |         100.0 |   0020800225 |
| 2014-15 |  1431 |        100.0 | 100.0 |         100.0 |            – |
| 2020-21 |  1221 |        100.0 | 100.0 |         100.0 |            – |
| 2025-26 |  1400 |        100.0 | 100.0 |         100.0 |            – |

**Fouls drawn and ejections.** Fouls drawn: ESPN’s, 2005-06 to 2016-17, a team’s summed against the other side’s box-score fouls. Ejections: player-games ESPN’s box score marks ejected, those the play by play records, and both. Fouls drawn read from 2006-07 (2005-06 agrees too rarely); ESPN’s `ejected` is never true in this load.

| Season  | FD exact | FD ±2 | Ejected (ESPN) | Ejections (plays) | Both |
| ------- | -------: | ----: | -------------: | ----------------: | ---: |
| 1996-97 |        – |     – |              0 |                74 |    0 |
| 1997-98 |        – |     – |              0 |                76 |    0 |
| 1998-99 |        – |     – |              0 |                56 |    0 |
| 1999-00 |        – |     – |              0 |               101 |    0 |
| 2000-01 |        – |     – |              0 |               107 |    0 |
| 2001-02 |        – |     – |              0 |                97 |    0 |
| 2002-03 |        – |     – |              0 |                80 |    0 |
| 2003-04 |        – |     – |              0 |                69 |    0 |
| 2004-05 |        – |     – |              0 |                95 |    0 |
| 2005-06 |     83.4 |  97.0 |              0 |                53 |    0 |
| 2006-07 |     93.7 |  97.6 |              0 |                78 |    0 |
| 2007-08 |     94.8 |  98.7 |              0 |                43 |    0 |
| 2008-09 |     96.7 |  99.8 |              0 |                53 |    0 |
| 2009-10 |     96.6 |  99.6 |              0 |                33 |    0 |
| 2010-11 |     96.8 |  99.6 |              0 |                76 |    0 |
| 2011-12 |     96.6 | 100.0 |              0 |                34 |    0 |
| 2012-13 |     90.5 |  99.8 |              0 |                65 |    0 |
| 2013-14 |     97.7 |  99.6 |              0 |                58 |    0 |
| 2014-15 |     95.6 |  99.7 |              0 |                56 |    0 |
| 2015-16 |     95.7 |  99.7 |              0 |                54 |    0 |
| 2016-17 |     97.3 | 100.0 |              0 |                73 |    0 |
| 2017-18 |        – |     – |              0 |                78 |    0 |
| 2018-19 |        – |     – |              0 |                73 |    0 |
| 2019-20 |        – |     – |              0 |                53 |    0 |
| 2020-21 |        – |     – |              0 |                57 |    0 |
| 2021-22 |        – |     – |              0 |                95 |    0 |
| 2022-23 |        – |     – |              0 |                78 |    0 |
| 2023-24 |        – |     – |              0 |                74 |    0 |
| 2024-25 |        – |     – |              0 |                83 |    0 |
| 2025-26 |        – |     – |              0 |                64 |    0 |
| 2026-27 |        – |     – |              0 |                 7 |    0 |

**Reads,** in the worker on the full load, warm, median of five: a team’s assist network, a season 25 ms; the same over January 23 ms; a player’s assists, a season 23 ms; a team’s assist network, ten seasons 51 ms; a game’s flow 23 ms; a five-metric player leaderboard (engine) 51 ms.

## Old seasons

| Season label (file) | Source | Games | Notes                                                  |
| ------------------- | ------ | ----- | ------------------------------------------------------ |
| 1994                | ESPN   | 1,179 | 85 % of player rows have minutes and shooting stats    |
| 1997                | NBA    | 1,261 | Team rows complete, including offensive rebounds and ± |

## Traps

- **A season label is its final year.** File `…_2026` holds 2025-10-02 to 2026-06-13, so the current season is `2027`.
- **Game types differ by source, and the file's own labels differ again.**
  - ESPN `season_type`: 2 regular, 3 playoffs, 5 play-in.
  - NBA `season_type_id`: 2 regular, 4 playoffs, 5 play-in, 6 NBA Cup final.
  - NBA schedule: `regular-season` (1,230 games), `playoffs` (85), `play-in` (6), `nba-cup` (1), `all-star` (7), `preseason` (71).
- **ESPN files All-Star games under regular season** (teams `STARS`, `STRIPES`, `WORLD`): 1,235 "regular" games against the NBA's 1,230. Filter them or league totals are wrong.
- **The NBA Cup final is not a regular-season game** in the NBA's own count.
- **Ids differ.** NBA game ids are text with leading zeros (`0022500001`), ESPN's are numeric-looking (`401809234`). `nba_schedule_crosswalk` maps them per season from label 2002 (1,415 rows for 2026). With the same teams within a day as a fallback, every regular-season game from 1996-97 links, except 21 that ESPN does not have.
- **The player crosswalk** starts in 2002 and matches on names, so it misses players spelled differently (Yao Ming is `Ming Yao` at the NBA, Nene is `Nene Hilario`). `nba_player_aliases` comes from the same crosswalk and adds nothing earlier. Matching box-score lines finds them, and the players before 2002: see `player_ids` in [stats-database.md](stats-database.md).
- **No table has every name right.** Of 2,913 players, 23 differ between the box scores, the rosters and the published season stats. The box scores say `Ming Yao` and `Nene Hilario`. The other two say `Ha Ha` for Seung-Jin Ha, `Sun Sun` for Yue Sun and `Cui Cui` for Cui Yongxi. Accents and suffixes such as `Jr.` come and go in all three.
- **Team codes differ** by source; `nba_team_aliases` (152 rows) lists them over time.
- **ESPN's 1998-99 lockout season is in two files.** The `_1999` and `_2000` box scores both hold 450 of its games, rightly marked `season` 1999 in each, so read them with `season = file_season`. The schedule files also hold 50 games dated 1999 marked 2000.
- **ESPN lists postponed games as their own rows** (`status_type_name`: 32 in 2020-21, 4 in 2025-26), and has gaps in old box scores: 1,106 of 1,189 regular-season games in 1995-96.
- **The NBA's game id prefix is its game type:** `001` preseason, `002` regular season, `003` All-Star, `004` playoffs, `005` play-in, `006` Cup final, on all 42,235 games. Its regular-season counts match the real season lengths. The BOS-IND game cancelled in 2013 is still there, at 0-0.
- **Lineup `group_id`s do not always match between dashboards, and it is not the order of the players.** Every dashboard and `nba_stats_lineups` write the id as the player ids in ascending order, `-1627734-1643411-`: on all 61,801 five-man rows of each of the seven files, none is unsorted. The 277,982 rows of a dashboard are groups of two, three, four and five players (`group_quantity`), which is why the scoring file's 76,343 rows outside the base file looked so many; five-man rows are 61,801 in each file.
- **Each lineup file is cut to its first 2,000 regular-season rows by its own sort, per season.** Playoffs are not cut (21,801 rows in every file). The base, misc and opponent files rank by total minutes, so they list the same units (the cut falls at 9.6 to 12.2 minutes). The advanced and four-factors files differ from them on 667 units over 2007-08 to 2025-26, all within 0.8 minutes under the base file's cut, so ties at the cut-off. The scoring file ranks by minutes per game: it lists 20,774 units the base file does not, none more than 0.1 minutes over the base cut, and the base file lists 20,774 it does not, none more than 0.1 minutes per game over the scoring cut. So five-man rows that fail to pair are 20,886 of 61,801 in the scoring file and 781 in the advanced and four-factors files (counting 2026-27, whose lists move daily), none in misc, opponent or `nba_stats_lineups`. Metis keeps the union of the units, keyed by team, season, season type and the sorted ids, and a measure a file does not list for a unit reads blank.
- **Lineup minutes are in `sum_time_played`, in fiftieths of a second.** `sum_time_played / 3000` equals the base file's `min` on every row, and is the same in all six files, so it is the one read for minutes. `min` itself is the unit's total minutes in the base, misc and opponent files, a per-game average in the scoring file, and a total rounded to a tenth in the advanced and four-factors files.
- **Lineup percentages are rounded to three decimals.** `fg_pct`, `fg3_pct`, `ft_pct`, `w_pct` and the opponent's agree with their counts within half a printed digit (0.0005) on every row with attempts, 59,338 for `fg_pct`; 424 of those sit exactly on the half, so a check needs 0.0005 plus float error. They are worked out from their counts, which are in the same file.
- **`nba_stats_lineups` adds nothing a dashboard lacks.** Its `usage` and `defense` measure rows repeat its base columns on all 61,801 rows, its `four-factors` rows exist for 2026-27 only and equal the dashboard's, and its other measures equal the dashboards' on every row. Its per-game mode is a different 2,000 units, ranked by minutes per game: of the 61,801 rows, 40,915 are units the totals hold, and there `pts` and `min` equal the totals over games. It is not read for lineups.
- **A unit is one team's.** No set of five players appears for two teams in a season type, and no file has a team-total row or a repeated unit (61,801 distinct keys of 61,801 rows in each). A traded player's units are the new team's.
- **`group_name` follows the id's order** (`I. Hartenstein - S. Gilgeous-Alexander - L. Dort - C. Holmgren - C. Wallace`): the last names of the first and last place agree with the player table on 99.4 % of units, the rest being spellings. Every player of 2007-08 to 2025-26 is in `player`, so the NBA's names are only a fallback.
- **ESPN's team rebounds and turnovers change meaning by era; the sum of its players' lines does not.** `total_rebounds` adds team rebounds until about 2020, and `offensive_rebounds` and `defensive_rebounds` are wrong on most of 2007-08. `turnovers` adds team turnovers from 2001-02 to 2011-12, when `total_turnovers` is just twice it. For team totals, read the NBA's box score, or sum ESPN's players.
- **The league dashboards hold one row per player per season type,** so a traded player has one row with their whole season: 66 players in 2009-10.
- **ESPN does not have 21 games from the last two days of 1999-00** (April 18 and 19, 2000), and has no box score for others in old seasons.
- **Preseason games have no box score in either source,** and the All-Star Game has one only at ESPN, for 17 of 76 games, none before 2012-13. So those two types are not offered as stats.
- **ESPN flags no starters in some games:** 38 in 2001-02, 91 in 2004-05, 110 in 2005-06, and a few others. Its game rosters do not fill the gap. Before 2017-18 the NBA lists a position for most players, not just starters, so it does not fill it either. Who started in those games is unknown.
- **ESPN has 34 lines in 1994-95 with no minutes and all zeros** for Darrick Martin, who did play for Minnesota. They are left out, so in those 34 games Minnesota's box score falls short of its score.
- **The schedule lists All-Star games that were not played:** 1998-99's was cancelled, and 1997-98 has a stray row in April. Read the date from a game that was played.
- **The NBA's box scores round minutes in two seasons:** 81 % of lines in 2003-04 and 90 % in 2004-05 are whole minutes, so a season's minutes can differ from the published total by up to 39. Other seasons match within one minute on 95.9 % of players or more.
- **ESPN's points by kind are not all real:** `-1` means not recorded, and each column holds zeros before its first real season. Points in the paint start in 2008-09 (1,673 of 2,630 team-games that season) and are missing in 2017-18. Fast-break points start in 2001-02, and look low until 2004-05: about 5 a game against 11 to 15 after. Points off turnovers start in 1994-95.
- **The NBA's published PIE is not a share of whole games.** The reference defines PIE over both teams' game totals, and that is what the catalogue computes. The published season figure reads about 4 points higher, and scaling ours by a player's share of the game's minutes brings it within 0.2: it behaves like a share of what happened while they were on the floor. The published one comes with the league dashboards (Plan T702), beside this one.
- **The NBA's free-throw share of points is what its other two leave:** `pct_pts_ft` equals 1 minus `pct_pts_2pt` and `pct_pts_3pt` on every player read, so it can be off by one more in the last place.
- **The NBA's team ORB% and TOV% are its own.** Its `oreb_pct` runs 3 to 4.5 points above rebounds over available rebounds in the box score, and `tm_tov_pct` about 2 points above turnovers over estimated plays, so they read as different measures. Same-named stats keep different ids (D14).
- **The NBA's 2003-04 standings repeat the overall record** as `conference_record` and `division_record`, for all 29 teams. Every other season is fine, so the screen reads a repeat on every team as not published. Early in a season a team can truly have played only its conference: 11 did in 2026-27.
- **ESPN's standings have no real conference or division records in 2001-02 and 2002-03:** they read `0-0`. Its records, games back and streaks agree with the NBA's on all 26 seasons.
- **The standings' `clinch_indicator` is not reliable in old seasons.** 2002-03 marks teams 15th in their conference `x`, clinched a playoff spot, and 2014-15 has `pi`, the play-in, six seasons before there was one. They are not shown.
- **Scores by period come and go:** ESPN's `home_linescores` hold values through 2000-01 and from 2019-20, and are empty between.
- **ESPN undercounts overtime in 2001-02:** `status_period` has 30 overtime games to the box scores' 70. Read overtime from the team's minutes.
- **`matchup_min` is spelled two ways:** `41:33` in totals and `8.3` in per-game, so the column is text.
- **`season_type` holds team ids in two tables.** In `nba_stats_coaches` and `nba_stats_rosters` the column holds values such as `1610612755` (read on the 2026 files). Do not read a season type from it.
- **Minutes differ in type:** text in NBA box scores (with `''` for did not play), a number in ESPN's.
- **Positions differ:** NBA `G`, `F`, `C`, `G-F`, `F-C`, `C-F`, `F-G`; ESPN mostly `G`, `F`, `C` with a few `PG`, `PF`, `SF`.
- **`nba_stats_player_season_stats` is six measure types times two modes per player:** always filter `measure_type` and `per_mode`, or rows multiply.
- **Some tables have no game grain.** The hustle and play-type files read have no game id: they are season totals, so a date range cannot be answered from them. `nba_stats_game_matchups` does have game ids.
- **The player dashboards for advanced stats and scoring publish minutes per game, in their rows of totals too.** So does the team scoring dashboard. The others publish the season's minutes. A season's minutes there are `gp × min`, rounded to a tenth per game.
- **The NBA's `tm_tov_pct` is two different things.** For players it is the turnover ratio, turnovers per 100 plays with assists among the plays (Tyrese Maxey's 2025-26 reads 7.4). For teams it is a fraction of possessions (0.144). They keep different ids.
- **Fouls drawn start in 2005-06.** `pfd` and `pct_pfd` hold values for under half the players in every season before it except 1999-00, and for nearly all after.
- **The dashboards print 0 for a rate over nothing.** A player with 0 minutes or 0 possessions published has 0 for their usage shares or ratings; the engine reads no value there.
- **Hustle's games and minutes are its own.** They differ from the official games on 2,817 of 5,455 player-seasons from 2016-17 to 2025-26: James Harden's 2025-26 reads 70 in both, Dennis Schröder's 68 against 70. A rate has to divide by the tracked figure.
- **Hustle's 2015-16 regular season is 2016-17 under the wrong label.** Every row of the 2016 regular-season files equals 2017's, on all 485 players and 30 teams, and 99 of those players did not play in 2015-16, such as Brandon Ingram, a rookie the next year. The 2016 playoff files differ and hold the right players. A stat's coverage is per season, not per season type, so hustle reads from 2016-17, and the 2015-16 playoffs are left out with their regular season.
- **The team hustle file publishes no games,** only minutes, and those run short of the season's (Lakers 2025-26: 3,900 against 82 games), so a team's hustle is read in totals and per 48 minutes.
- **Box outs hold zeros before 2017-18,** in both files and both season types.
- **The box-out rebound rates do not divide by the box outs in old seasons.** `pct_box_outs_team_reb` and `pct_box_outs_reb` equal team rebounds and own rebounds after box outs over the box outs on 96–98 % of players from 2024-25, on 80 % in 2023-24, and on 6–57 % from 2017-18 to 2022-23, rising each season. What they divide by otherwise is not published, so they are read as published, weighted by box outs across seasons.
- **Hustle's parts nearly add up:** contested twos and threes sum to the contests on every row, offensive and defensive loose balls to the loose balls on 99.9 %, offensive and defensive box outs to the box outs on 99.2 %.
- **Tracking's games and minutes are its own too:** they differ from the official games on 956 of 9,759 player-seasons from 2013-14 to 2025-26.
- **The tracking efficiency file repeats the others, except on catch-and-shoot and pull-ups.** Its drive, elbow, post and paint points, drive FG% and total points equal the other files on every row. Its catch-and-shoot points match the catch-and-shoot file on 44–85 % of players a season, its catch-and-shoot FG% on 23–66 %, its pull-up points on 90–99 % and its pull-up FG% on 37–96 %. Only those and its eFG% are read, beside the other files' (D23).
- **The touch areas divide their assist rate differently.** `elbow_touch_ast_pct` is assists per pass, while `post_touch_ast_pct` and `paint_touch_ast_pct` are assists per touch, on every row of every season. Every other area rate is per touch.
- **The catch-and-shoot and pull-up files leave threes blank, not 0,** for a player who took none (Charles Bassey's 2025-26: 2 of 5 on catch-and-shoot, threes blank). Read with attempts, a blank is 0, or eFG% would be blank too. Before 2013-14 these two files hold games and minutes with zeros.
- **Seconds per touch cannot be rebuilt from the time of possession,** which is published to a tenth of a minute: `60 × time_of_poss / touches` misses `avg_sec_per_touch` by more than 0.01 on a fifth of rows. It is read as published.
- **Tracking's parts do not always add up.** Contested and uncontested rebounds sum to the rebounds on 58 % of rows, and adjusted assists equal assists, secondary assists and free-throw assists on 61 %. Each is read as published.
- **The play types have a row per team for a traded player,** unlike the dashboards and hustle (3,299 player, type and season groups of totals): Andre Miller's 2015-16 pick-and-roll defense has a San Antonio row and a Minnesota one. The engine adds them up. Their `gp` is the player's games on that side of the ball, the same for every type of it on 99.5 % of players, teams and sides.
- **From 2023-24 a play type under 10 possessions has no row;** before, every type from 1 possession is published. So a missing type reads blank, not 0, and a share of all a player's plays cannot be worked out by adding the types up.
- **Play-type rates are rounded loosely before 2023-24.** FG% misses makes over attempts by more than 0.0006 on 10–24 % of rows a season to 2022-23 and on none after, always within two-place rounding. Points per possession is printed as a whole number on 248 regular-season rows of 2015-16 and on about a quarter of the playoff rows of 2015-16 to 2017-18 (Patrick Patterson's 2017-18 playoff spot-ups: 6 points on 4 possessions, printed 2). Both are rebuilt from their parts; the other rates are read as published.
- **The 2025-26 playoff play types print a share of 0** for 264 of 530 offensive rows, Jalen Brunson's 170 pick-and-roll possessions among them. Frequency reads blank there; everything else on the row is read.
- **The 2025-26 regular-season matchup rollup is short.** Its defenders' matchup time adds up to 5.5 % less than the pair file's, and only 4 of 582 defenders have the same points and attempts in both. The pair file agrees with the game matchups on points, makes and attempts for every defender of every season from 2017-18, so the regular-season totals add up the pair file; the rollup's games still match the box scores. In earlier seasons the rollup and the pair file agree on 94–100 % of defenders. Leaving out the NBA Cup games does not explain the gap.
- **The matchup clocks are printed to the second, and round up to `:60`:** `9:60` on 847 pairs of 2025-26. Read as minutes plus seconds over 60 it is 10 minutes. The pair file also gives `matchup_time_sec`, to a tenth of a second, which is what agrees with the game matchups. The rollup's percent of time is worked out from unrounded time, so a share rebuilt from its printed clock is within 0.1 percentage point on 94–98 % of regular-season defenders to 2024-25 and on all of them in 2025-26, and on 82–89 % in the playoffs to 2024-25, where samples are small.
- **The help columns of the pair file are zeros on every row** of every season: help blocks, help makes and help attempts. They are left out rather than read as a real 0.
- **The 2017-18 rollup has a fifth position, `P`,** on 42 defenders, about a tenth of a percent of their time. It counts in the total, so the three shares can add to just under 100 %.
- **The game matchups keep the time two ways:** `matchup_minutes` printed as `7:14`, and `matchup_minutes_sort`, the seconds to a tenth (434.4), which is what agrees with the pair file's `matchup_time_sec`. The seconds are read; the printed clock is read only where they are missing, as either spelling the NBA uses (`9:60` is ten minutes, `8.3` is decimal minutes). No `:60` appears in the game file, and the printed clock is more than half a second from the seconds on 12 of 2.2 million rows.
- **The game matchups hold every season type,** keyed by the NBA's game id (text, `0022500586`), which is the `game` table's `nba_game_id` on every row from 2017-18: the regular season, the playoffs, 37 play-in games and 3 Cup finals, so a date range in the playoffs is answered from them although the pair file is regular season only. `season_type_id` is the NBA's code (2, 4, 5, 6) and is not read: the type comes from `game` (D27).
- **The pair file lists a few pairs the game file does not,** 0 to 11 a season, every one with no points and no shot: time only. They are the whole of a defender's time gap between the two, at most 42.5 seconds over a season.
- **The game file lacks a few regular-season games:** 8 in 2017-18, 7 in 2018-19, 4 in 2019-20, 1 in 2021-22, 2 in 2023-24, none in the other finished seasons. The pair file lacks them too, since points agree for every defender. Such a game reads "The NBA’s file has no matchups for this game."
- **Tracking assigns a few defenders who did not play:** 34 defender-games from 2017-18 to 2025-26 have matchups where the box score lists the player without minutes or not at all, mostly seconds, once 7.4 minutes (2024-25). The engine reads matchups over the box-score games in scope, so a date range or the last games leave these out, while a whole regular season, read from the pair file, keeps them.
- **The help columns, `switches_on` and `matchup_potential_assists` of the game file are zeros on every row** of every season. They are kept in `game_matchups` as published and read by nothing.
- **The game file's three percentages are shares, not counts.** `percentage_defender_total_time` and `percentage_offensive_total_time` are the pair's share of each player's matchup time in the game: a defender's add up to 1.000 (median of 28,670 defender-games in 2025-26). They follow from the times, which are stored. `percentage_total_time_both_on` is a share of the time both players were on the floor, a base the file does not publish (0 to 1, mean 0.21), so it is not carried into `game_matchups` and stays in the source table.
- **The rollup's playoffs disagree with the game matchups in 2025-26,** as its regular season does with the pair file: points and field goals are equal on 17 of 230 defenders and only 48 % are within a minute. In 2018-19 they are equal on 192 of 212. So a whole playoff season reads its totals from the game matchups, added up per defender, as the regular season reads the pair file; the rollup still gives the games, which match the box scores.
- **`nba_player_impact` holds the dataset's own calculations,** not the original publishers' values. Its card names `sportsdataverse.nba.nba_rapm`, `nba_bpm` (BPM 2.0), `nba_war` and `nba_darko`. It leaves out play-in games. Its DARKO columns project the next season, and are null until two seasons are available. Label these as SportsDataverse's.
- **DARKO's playoff rows repeat the regular season's.** Filtered skill and projection are the same in both rows of every player who played in the playoffs, in every season from 1997-98, so DARKO is read from the regular season only. It is also null for the whole of 1996-97 and for the season under way.
- **DARKO's projection spread is 0 for 352 players in 1997-98,** and 10 for the other 87: the first season has no history to measure uncertainty from. From 1998-99 it is about 2 for most players and about 10 for those with little history. It is read from 1998-99.
- **Adjusted RAPM's two halves are not centred on zero.** Over the regular season the offensive part averages +8.6 in 1997-98 and +9.8 in 2025-26, and the defensive part about as far below zero, while their sum averages 0 like RAPM. Only the sum compares with RAPM; it differs from it by 2.7 points per 100 possessions on average in the regular seasons of 2019-20 to 2025-26. RAPM's, SPM's and BPM's parts add up to their totals on every row.
- **DARKO is gone from the impact file, and `boban_*` is not a rename.** Until November 2026 the file had `darko_filtered_skill`, `darko_projected_rating` and `darko_projected_sd`, with `boban_*` empty on every row. A fresh download on 2026-11-10 has no `darko_*` columns and fills `boban_*` for every regular-season row of 1997-98 to 2025-26. Compared on the 20,016 player-seasons both files hold (Stage 6’s load against Stage 7’s, per season type): none of the three columns is equal on any row (filtered skill within 0.005 on 233 rows, projected rating on 230, spread on 628), and the largest differences are 2.54, 2.50 and 0.82. They are another model’s values, so they are not read as DARKO: its three metrics answer "The dataset no longer publishes DARKO." The old `darko_*` values stay in Stage 6’s profile only. Whether `boban_*` becomes metrics of its own is a task for the owner.
- **The impact file's games are the box scores', its minutes are rounded.** Games played match the official regular-season games on 99 % of players (2015-16 to 2025-26, play-in left out); minutes are whole numbers, within about 3 of the box scores for 80 % of players. Each value is weighted by the file's own minutes or possessions.
- **The draft and combine files are labelled the season after.** The 2025 draft, with Cooper Flagg first, is in `nba_stats_draft_2026`, and Kevin Durant's 2007 combine in label 2008. So the drafts held run from 1996 (Allen Iverson first, Kobe Bryant 13th) to 2026, and the combines from 2000 to 2026. A player drafted before 1996 has no row, so missing from the files is not undrafted. The draft file has one row per pick, 1,833 in all, and `draft_type` is `Draft` on every row.
- **`draftcombinestats` repeats the other four combine tables.** On all 1,873 rows, every measurement and test equals the anthro and drills files, and its shooting, written as text (`3-5`), equals the spot-up and non-stationary files' makes and attempts. Those four are read.
- **The combine's tests come and go,** and a test not held is blank for everyone that year: height with shoes from 2004 to 2022, body fat in most years to 2022, hand size from 2010, the shuttle (`modified_lane_agility_time`) from 2013, the bench press in most years to 2019 and never since, spot-up shooting by spot from 2013 to 2019, shooting off the dribble and on the move from 2014, and no shooting at all in 2020. A player who skipped a test held that year is blank too: Grayson Allen has no bench press at the 2018 combine, where 53 of 69 attendees did one. So whether a test was held is read per combine, from whether anyone has a result.
- **From the 2021 combine, a shooting drill is one total filed under its first spot.** The spot-up college three is 25 shots in `college_corner_left_*` and shooting off the dribble from college range 30 shots in `off_drib_college_break_left_*`, with every other spot empty for everyone. Before, each spot was 5 shots. Those columns are read as the drill's total, not as that spot. On the move from college range is 25 shots on every row from 2021, against 8 to 49 before.
- **A bench press of 0 is a result,** not a gap: 40 of 1,095 recorded, Kevin Durant's in 2007 among them.
- **A combine row can hold no results:** 58 attendees have none of the main measurements or tests, Victor Wembanyama in 2023 among them.
- **The combine's ids:** `player_id` is the NBA's person id, so 1,293 of 1,805 attendees link to a player in the box scores; the rest never played. Five rows have `-1` for no id. 63 players went more than once (Terrence Shannon Jr. in 2021, 2023 and 2024). Five rows list no position, Danny Granger's among them, so they have no percentile. `weight` is text there (`220.40`, with blanks).

- **The injury report is a row for every version of every listing.** In 2025-26, 338,588 rows with a player and a game cover 2,599 team-games, about 37 reports of each team's list a game (95,136 team, game and report combinations in the file). Over the file there are 1,199,448 rows with a player and a game, and 94,410 game and player pairs. Count the pairs, never the rows.
- **The reports begin on 2018-12-17.** A report lists at least one player for 62.8 % of 2018-19's team-games, and for 98.1 to 99.7 % of the regular-season team-games of 2019-20 to 2026-27 (a team with nobody listed has no row). Games out are counted from 2019-20.
- **A listing can change.** An Out before a game becomes Questionable, or a Questionable becomes Out, so the last report that lists the player decides. 228 Out listings of 2019-20 to 2026-27 drop off the team's final report, and 3 of those players played, so a listing that disappears still counts as the last status. `previous_status` is filled for 2018-19 and part of 2019-20 and empty from 2020-21 on, so a change is read from the order of reports.
- **"NOT YET SUBMITTED" rows name nobody.** 125,681 rows have no player and no status, only a team and a game, and they can be the newest row of a team, so the newest report that lists anyone is the latest. 4,495 rows have a player and no game id and cannot be counted by game. 16 game ids in the file were not played.
- **Most Out rows are not injuries.** Of the 70,386 games listed Out in the counted seasons, 45,534 are for an injury or illness; the rest are G League assignments and two-way players (the most), health and safety protocols, not with the team, personal reasons, rest, suspensions, a trade pending, and "-" with no reason. 2018-19 files the category apart (`Injury/Illness`, `G League Team`) with the injury as the reason; from 2019-20 the reason carries both (`Injury/Illness - Left Knee; Sprain`), with "N/a" where a part is empty.
- **A listing is not a statement that the player did not play.** 20 of 70,386 Out listings have minutes in the box score; 3 of them for injury or illness. A trade pending and a G League assignment account for most of the rest.
- **Season-long absences are not in the counts.** The engine lists a player with a box-score line in the season and type, so a player listed Out of every game has none: 14 players and 394 injury games in the 2019-20 regular season.
- **The coach file has no dates.** A team's season lists every coach who held a role in it, so 46 team-seasons have more than one head coach (`Interim Head Coach` in 2025-26 for New Orleans). `is_assistant` is a role code (1 head, 2 assistant, 3 trainer, 15 interim head), and `season_type` holds team ids, as noted above. Head coach rows are missing for whole teams: 17 of 29 teams in 2000-01, 23 in 2002-03, 27 of 30 in 2025-26 (Charlotte and the Lakers have no row, Chicago only assistants). A missing row reads "No head coach listed", never no coach.
- **NBA officials are complete from 2003-04.** The file has a crew for 99.8 to 100 % of played games from 2003-04, for 1.7 to 8.6 % of games from 1996-97 to 2002-03, and for none before; ESPN's file starts in 2001-02 and has a crew for 87 to 100 % of games a season. It has no marker for the crew chief, and its jersey numbers are padded with spaces (`7   `). So an official's rates are read from 2003-04, and earlier seasons list their games with the reason.
- **A crew is usually three, but the file lists four on some games:** 28 to 77 a season from 2017-18 (none in 2019-20), most of them playoff games, and 0 to 15 a season before. Every official listed counts the game, so a fourth official's games count as fully as the others'.
- **An official's numbers describe the games, not the calls.** The box scores give each team's fouls and free throws, not who called them, and every official of a crew counts the same game. The officials list and the rates are read with the league's line for the same seasons beside them, in order of games worked; no rate orders them.
- **The two officials files name some officials differently.** The crews of a game hold the same names on 81 to 84 % of games in 2003-04 to 2007-08, 85 to 95 % to 2010-11, and 90 to 99.9 % from 2011-12: JB DeRosa is Joe DeRosa and Jimmy Clark is Jim Clark in ESPN's, and ESPN repeats a name in a few games a season. The sources are not merged.
- **ESPN's injuries are a snapshot per day of the current season,** from 2026-09-08, 103 players on 2026-11-09, a day behind the official report's 2026-11-10. All 68 players it lists as Out are Out on the official latest report, and 75 of the 84 the official report lists Out for an injury or illness are on ESPN's list. It is not read.

### Play by play (Plan T901)

The NBA's feed is stats.nba.com's v3 play by play, ESPN's its own. How the play tables read them is in `src/main/stats/derived/plays.ts`; how well they rebuild the box scores is under "Plays" below.

- **The NBA writes steals and blocks as rows of their own,** with no `action_type` (`event_type` `other`) and the description "Sengun STEAL (1 STL)" or "BLOCK (1 BLK)". Each has the `action_number` of the turnover or the miss it belongs to, on every one read in three seasons (63,548 steals, 39,122 blocks). The play tables put the steal on the turnover and the block on the miss, as ESPN does.
- **The NBA names the assist only in the made shot's description,** by the name its feed uses: "(Dort 1 AST)". Where two players share a last name in a game it writes an initial ("J. Brown", "Jal. Williams"); it never writes an accent ("Schroder", "Jokic"); and old descriptions keep the name of the time while `player_name` is today's ("Butler" in 2016-17 for a player now "Butler III", "World Peace", "Mark Morris"). Read with all four rules, 95 to 99.6 % of regular-season team-games have every assist matched; what is left is mostly a whole team's assists in a game where no rule finds a unique teammate.
- **The NBA's team rows have `team_id` 0** and the team's id in `person_id` ("Rockets Rebound", "Spurs Turnover: Shot Clock"); `location` (`h`, `v`) names the side on every row.
- **The NBA's box score leaves team rebounds and team turnovers out:** its team rebounds equal the players' on 99.7 % of team-games or more, its team turnovers the players' on 100 %; counted with the team rows, team-games match on under 1 % for offensive rebounds and 6 to 13 % for defensive ones.
- **The NBA's rebounds carry the player's running counts** ("Off:1 Def:0"), and they are not always in order: some come before the one they follow (Off:3, then Off:2), and some are written twice with the same counts, the jump on the first (Off:1, then Off:3 and Off:3). Read by row order, offensive rebounds were exact on 94 to 96 % of team-games from 2017-18; read by the counts in their own order, on 100 %.
- **The NBA's feed has no row for some fouls:** a player's running count skips a number ("S.FOUL (P3.PN)" after "(P1.T4)"). Personal fouls are exact on 92 to 94 % of team-games in 1996-97 to 1998-99 and 97 to 99.5 % after; neither the rows nor the highest running count matches the box score on every player. The missing foul is not made up.
- **The NBA pads `action_type` with spaces in 2000-01,** on about 7,000 rows that then have `event_type` `other`.
- **The NBA writes a score on scoring rows only,** and some rows after a game's last basket repeat an older score, so the final score is the highest each side reached, and a running score carries forward.
- **Before 2017-18 the NBA writes the score as "0" and "0" on every row that scores nothing,** not as empty text, and on a few that score (up to 16 a season); 2019-20 has 362 such rows and 2022-23 ten. Read as a score, `play_nba` had 0-0 after about half the rows of 1996-97 to 2016-17 (1996-97: 341,509 of 596,315), so the splits that depend on the score (clutch, ahead, tied, behind, within 5, ahead or behind by 10, garbage time) put those plays at 0-0: 1996-97's "tied" held 92,257 team attempts against 13,361 once fixed. A written 0-0 is now no score: the running score is the last one written plus the points since. `scripts/check-plays.mjs` checks it: rows at 0-0 once a point is scored, 0 in every season of the NBA's feed (ESPN's: 34 in all, 0 to 10 a season).
- **Both feeds list a few scoring rows out of order,** an and-one's free throw before its basket, so the score steps back for a row: 10 to 131 rows a season in the NBA's feed (366 in 2017-18), 0 to 2,071 in ESPN's (2012-13 and 2015-16 the most). They are left as published; `check-plays.mjs` counts them.
- **Heaves are not field-goal attempts from 2025-26.** Both feeds mark them (`Heave` at the NBA, `Heave Jump Shot` at ESPN, 1,334 and 1,302 rows to date), and the box score leaves them out of FGA; a block of one still counts. ESPN's field-goal attempts were exact on 62 % of 2025-26's team-games with heaves counted, 98 % without.
- **ESPN's `score_value` is 0 on made free throws** from 2012-13 into 2019-20 (46,420 of 61,405 in 2015-16), so a made free throw is read as 1 point.
- **ESPN's `points_attempted` is filled only from 2024-25** (and on 3,674 shots of 2023-24). Before, a made shot's `score_value` says whether it was a three, and a miss is a three when its text says "three point" or its raw coordinates are beyond the line. `coordinate_x_raw` runs 0 to 50 across the court with the basket at 25, and `coordinate_y_raw` is feet out from the basket: a shot 23.5 feet out, or 22 feet to the side within 9 feet of the baseline, is a three. That rule agrees with `points_attempted` on 99.8 % of 2025-26's 236,114 shots.
- **ESPN records no steals before 2005-06,** and misses whole runs of plays from 2001-02 to 2005-06: its team-games rebuild exactly on under 1 % of 2001-02 to 2004-05 and 24 % of 2005-06.
- **ESPN credits nearly every play of some old games to one team:** Denver–Portland of 2002-03-09 has 448 of its 487 rows on Portland, so one side's line is the whole game and the other's nearly nothing. These games are the worst misses of 2001-02 and 2002-03 and are left as published. Teams are matched by ESPN id through `team`, not by side, and where ESPN's home side is the `game` table's away side its scores are swapped to match.
- **ESPN's 2012-13 and 2015-16 rebuild worse than the seasons around them** (team-games exact 46 % and 34 %, against 83 to 89 % beside them), on field-goal attempts and makes. The cause was not found; those seasons read as measured.
- **The NBA's lineups on every row lag the substitutions** (`off_player_1` to `def_player_5`, which SportsDataverse fills from the quarter box scores, `lineup_source` `quarter_box`): a player can stay listed for minutes after leaving, or appear before a substitution names them. Players' time from them matched box-score minutes within a second on 4 % of 2025-26's player-games; from the substitutions, on 99.5 %. The split tables take only each period's first lineup from them.
- **A substitution names the player going out by id and the one coming in by name only** ("SUB: Eason FOR Smith Jr."): the name the feed uses, an initial where two share it ("Jay. Williams"), no accent ("Jokic"), sometimes the last word of a longer name ("Hansen" for Yang Hansen). A player who comes in and does nothing else has no other row with that name, so the names are matched against everyone with a box-score line for that team in the game; where two fit, the one the feed lists on the court at the next play. 95 % of 2025-26's substitutions are named by these rules; the rest leave the player in from the period's start, which is what misses in "Time ≤ 1 s".
- **The NBA's feed credits a player with the steal of his own turnover** in Miami at Charlotte of 1997-03-09 (`0029600879`): Keith Askins turns it over and the steal row names him too. A steal counts for the other side, so his line there is split across both teams; the split tables keep it as published. The dataset's possessions of that game are all Miami's: Charlotte has none, so its possessions read NULL there.
- **ESPN's line scores are text in Python's form** (`[{'period': 1, 'value': 23.0} …]`), and its schedule has them only for 1996-97 to 2000-01 and from 2019-20.
- **Both feeds hold games the box scores do not count:** the NBA's has preseason and All-Star games, and 8 of ESPN's 2025-26 games link to no game in `game`. The play tables keep only games in `game`, with its type.

### Shots (Plan T903)

- **The NBA's shot file has no zone, area or range column**, though the NBA's own shot charts carry them: 19 columns, coordinates and the distance only. Zones are classified from `x_legacy`, `y_legacy` and `shot_value` by the rule in `src/shared/stats/shots.ts`.
- **The distance is the coordinates' distance rounded to the foot** on every shot from 1996-97 (`round(sqrt(x² + y²) / 10)`), 457 of 1996-97's rows aside, which have none; a band falls back on the coordinates there.
- **2001-02 has a dozen points thousands of tenths off the court** (`x` −16,398): they keep their attempt in a zone of their own, "unknown", so the zones still add up. 2009-10 to 2016-17 have shots a little beyond the sideline (`|x|` up to 328); they stay in their zone.
- **1996-97's three-point line was 22 feet all round**, so a three there can be inside today's arc; the value, not the point, decides. Its restricted-area share (37 %) and FG% (55 %) stand apart from the seasons after (about 30 % and 60 %): its coordinates place more shots near the rim.
- **Which corner is left is the NBA's own naming**, negative `x`, from its shot charts elsewhere; nothing in this dataset names a side. Both corners together do not depend on it.
- **Heaves are out of the shot file from 2025-26**, as out of the box score's FGA (Plan T901): 34 shots from beyond half court in the 2025-26 regular season, against 336 to 581 a season from 2017-18 to 2024-25.
- **The dataset's distance curves mix every season type and bin by the exact distance**, not the published one, and from 2019-20 leave out a few hundred shots a season (202,223 of 202,399 in 2019-20). The metrics' league rate is recomputed from the regular-season shots instead.
- **ESPN's shot coordinates are another frame**, whole feet: `coordinate_x` runs the court's length from centre court, `coordinate_y` across it; the raw pair is feet across the court and out from the basket. They are not converted or mixed in.

### On court (Plan T904)

How the on-court tables read these is in `src/main/stats/derived/onCourt.ts`; how well they agree is under "On court, per season".

- **The possessions file's ten players are the possession's first five a side,** and the NBA play by play's `off_player_*` and `def_player_*` columns copy them onto every play of the possession. A substitute who comes in during a possession (after a foul, between free throws) appears only from the next one: in 2025-26, 34,149 of 278,341 possessions hold a substitution after their first play. Credited by possession, on-court plus-minus equals the box score's on 26 to 40 % of player-games.
- **`nba_stats_game_lineups` has the ten players for every play,** keyed by the game and the NBA's `action_number`, which is not unique (a steal shares its turnover's); the rows of one action number agree on 99.98 % of keys (158 of 670,234 in 2025-26 do not) and the first is taken. It is the same row count as the play by play, home and away rather than offense and defense. Its lineup on a substitution row is sometimes before the substitution and sometimes after; a substitution row carries no time and no points, so neither matters. Some plays have no row (period starts and ends, replays): they take the lineup before them in the period.
- **It sometimes keeps a player on after their substitution,** or swaps two players' stretches: in the first game of 2025-26, Hartenstein's and Caruso's minutes are five minutes apart from the box score's either way. These are the worst minute misses below; plus-minus can still match, when the swapped players shared the floor.
- **The official plus-minus credits free throws to the players on the floor at the foul.** Credited to those on the floor at the free throw, plus-minus matches on about 36 % of player-games; at the foul, on 89 to 97 %.
- **A possession's start clock is its first play, not the previous possession's end:** the gap between them (about 10 seconds) belongs to no possession. Seconds per possession read from their own clocks average 4 seconds; from the end of the one before, 14.5 to 15.6.
- **Every possession in the file is `quarter_box`:** `lineup_source` holds no other value on any season loaded, so no possession is marked as a fallback.
- **Possessions with a player listed twice or missing:** 14 to 333 a season (0.05 to 0.1 %). Their team counts stand; the player known is on the floor; they make no five-man unit.
- **SportsDataverse's possessions are about 5 % fewer than the NBA's** (0.945 to 0.958 of the advanced lineup file's, summed over the units found, steadily across seasons), so ratings from them read about 5 % higher than the NBA's for the same points. They are not the NBA's count, and the screens say so.
- **Box-score minutes are whole minutes on 81 % of 2003-04's player-games and 90 % of 2004-05's**, against 2 to 9 % around them, so on-court minutes are within 30 seconds of them on 69 to 74 % of those seasons' player-games, and within a minute on 94 %.
- **Off the floor covers the player's own games.** A team's line without a player in games they missed is not counted; the screens say "the rest of their own games".

### Play-derived stats (Plan T905)

- **The feed's 0-0 scores before 2017-18** (under "Play by play" above) were found here and are fixed in the play table itself (#57). The flow also takes, on a scoring row with no written score, the last written score plus the play's points: since #57 the play table already does, so this is a guard with nothing to do.
- **It lists a few scoring rows out of order:** an and-one's free throw before its basket, so the written score steps back (76-75, then 75-75) and would make a tie that never was. A score only rises, so the flow orders scoring plays by the total score, then by row. With both rules the raw feed's own score, recounted apart, gives the same lead changes, ties and largest leads on every game of six seasons across the eras but one (its ties, in 2008-09).
- **The final margin from the last written score equals the box score's on 99.4 to 100 % of games;** the running sum of the plays' points does on 98.6 to 100 %, so the written score is the one read.
- **An offensive foul's turnover is "Foul" until 2016-17 and "Offensive Foul Turnover" after,** both from 2003-04 to 2016-17 (the second on a few dozen a season). Both are one kind.
- **A bad pass out of bounds is spelled apart only from 2015-16** ("Out of Bounds - Bad Pass Turnover"), so it stays a bad pass, or bad passes would fall by a quarter in 2015-16. A ball lost out of bounds likewise stays a lost ball.
- **Live-ball turnovers are those with a steal credited.** The feed tags no other way; a bad pass thrown out of bounds is dead-ball.
- **The NBA's feed never names the fouled player.** Its foul text ends with the official ("(S.Foster)"). ESPN's names them as the second athlete from 2005-06 to 2016-17 (99 to 100 % of its fouls), and not before or after (0 %, a handful in 2026-27). From 2010-11 ESPN spells charges and blocking fouls as types of their own ("Offensive Charge", "Shooting Block", "Personal Block"); left out, a team's fouls drawn fell short by 1.2 to 1.4 a game. A team's fouls drawn equal the other side's box-score fouls on 93.7 to 97.7 % of team-games from 2006-07 (90.5 % in 2012-13, when ESPN's file misses plays), but on 83.4 % in 2005-06, so fouls drawn start in 2006-07. A double personal foul names a second fouler, not a fouled player, and is left out.
- **No loaded table holds technical fouls,** so technicals are counted from the plays only. A double technical is one row naming one player: the other is not credited.
- **ESPN's player box score's `ejected` is never true in this load,** so ejections cannot be checked against it: the plays record 33 to 107 a full season.
- **And-ones never exceed the other side's shooting fouls** in any team-game; they are about 90 to 99 % of the "1 of 1" free throws (the rest follow away-from-play and other fouls, or a make at another clock).

## stats.nba.com directly

Metis does not call it. It refuses plain clients, and getting past that means imitating a browser. The dataset above covers what is needed. The dataset's own pipeline reads it, which is part of why the terms need reading before a release.
