# NBA data sources: what was measured

Measured 2026-11-05 against [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data) release files, on the finished 2025-26 season unless noted. Numbers here came from reading the files; re-measure before relying on them much later.

## The source

Free, keyless Parquet files on GitHub releases, updated daily during the season. It fills the role nflverse fills in the template. It republishes two upstreams, ESPN (`espn_nba_*`) and stats.nba.com (`nba_stats_*`), plus derived tables.

**Licence:** the repository's licence file is MIT and its README carries a CC BY 4.0 badge. Neither speaks for the upstream data from ESPN or the NBA. Metis downloads to the user's machine and redistributes nothing, but read the terms and add the credit before a public release (Plan T1101).

**Not yet checked:** agreement between the sources in any season but 2025-26 (Plan T409).

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

All of it is inside the limits in D22 (6 GB, an hour, 4 GB of memory). Time varies: an earlier run, with the `*_master` files and nothing else on the machine, took 14.4 minutes.

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
| `espn_nba_standings`            | 2002–2027 | 26    | 0.5   | Not read                                                                                                                                                     |
| `espn_nba_officials`            | 2002–2027 | 26    | 0.5   | Not read                                                                                                                                                     |
| `espn_nba_draft`                | 2003–2027 | 25    | 0.5   | Not read                                                                                                                                                     |
| `espn_nba_rosters`              | 2025–2027 | 3     | 0.2   | Not read                                                                                                                                                     |
| `espn_nba_injuries`             | 2027      | 1     | 0.2   | Current only, not read                                                                                                                                       |
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
| `nba_stats_game_matchups`       | 2018–2027 | 10    | 41.5  | Game matchups, 257,854 rows in 2026                                                                                                                          |
| `nba_player_impact`             | 1997–2027 | 31    | 3.0   | RAPM, SPM, BPM, WAR, DARKO, 28 columns (see "Traps")                                                                                                         |
| `nba_stats_injury_report`       | 2019–2027 | 9     | 4.3   | Official injury reports, 376,069 rows in 2026                                                                                                                |
| `nba_stats_rosters`             | 1997–2027 | 31    | 0.7   | Bio: height, weight, birth date, school, experience                                                                                                          |
| `nba_stats_draft`               | 1997–2027 | 31    | 0.2   | Not read                                                                                                                                                     |
| `nba_stats_draft_combine`       | 2001–2027 | 135   | 1.8   | Five combine tables: stats, anthro, drills, spot-up, non-stationary                                                                                          |
| `nba_stats_standings`           | 1997–2027 | 31    | 1.1   | Not read                                                                                                                                                     |
| `nba_stats_coaches`             | 1997–2027 | 31    | 0.3   | Not read                                                                                                                                                     |
| `nba_stats_officials`           | 1997–2027 | 31    | 0.5   | Not read                                                                                                                                                     |
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

| Files                                                 | Result                                                                                                                                  | Loaded? |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `player_master`, `team_master`, `lineups_master`      | Every column maps to one in a part, with no differences over 21,120, 1,402 and 277,982 rows                                             | No      |
| Per-game hustle and play types                        | Not simply totals over games: `pts` is off by more than rounding on 10,181 of 90,167 play-type rows, and hustle `min` on 1,563 of 8,718 | Yes     |
| Per-game matchups                                     | Minutes are spelled differently from totals, so not compared exactly                                                                    | Yes     |
| `nba_stats_lineups`                                   | Base totals match the dashboards exactly on 61,801 rows, but it also holds measures and modes they do not                               | Yes     |
| `nba_stats_player_season_stats`                       | Base totals match on 21,120 rows, but it also holds per-game rows                                                                       | Yes     |
| `nba_stats_standings` and the dashboards' `standings` | Values differ on several columns, and only the dashboards reach 1995-96                                                                 | Yes     |
| `nba_schedule_master`                                 | The same 43,062 games as the season files, with 3 more columns                                                                          | Yes     |

## Do the numbers agree?

| Check                                                     | Result                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| NBA: players sum to the team (points, rebounds, assists)  | 2,644 of 2,644 team-games, all three                             |
| ESPN: players sum to the team (points, rebounds, assists) | 2,645 / 2,636 / 2,648 of 2,652 (includes All-Star rows)          |
| ESPN vs NBA, same team and date: points                   | 2,644 of 2,644                                                   |
| ESPN vs NBA: rebounds, assists, field-goal attempts       | 2,643, 2,636, 2,643 of 2,644                                     |
| ESPN vs NBA: turnovers                                    | 1,259 of 2,644: compared `total_turnovers`; definitions differ\* |
| ESPN vs NBA, player-game points and assists               | 28,541 of 28,541 joined (of 28,713 NBA rows)                     |
| Season table vs summed box score                          | Top 5 scorers: games and points identical                        |
| Possessions vs box score, team points                     | 2,327 of 2,644 exact; 228 off by 1, one game off by 31           |

\* Not investigated yet. ESPN has `turnovers`, `team_turnovers` and `total_turnovers`: compare each.

So the box scores can be trusted, and sources can be cross-checked. **Possessions are a derived table, not an official one** (`lineup_source` is `pbp_fallback` on 99.6 %): use them with a stated tolerance and check them per season.

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
- **Ids differ.** NBA game ids are text with leading zeros (`0022500001`), ESPN's are numeric-looking (`401809234`). `nba_schedule_crosswalk` maps them per season with `match_method` and `match_confidence` (1,415 rows for 2026, 1,392 for 2003, from label 2002). Its match rate is not measured yet. Date and team remain the fallback, and matched on every 2025-26 game above.
- **The player crosswalk** starts in 2002 and matches on exact names (672 of 673 in 2026), leaving a few rows unjoined. Seasons 1994–2001 need their own identity step; `nba_groups`' `nba_player_aliases` (19,848 rows, with valid-from and valid-to seasons) may help and is not checked.
- **Team codes differ** by source; `nba_team_aliases` (152 rows) lists them over time.
- **ESPN's 1998-99 lockout season is in two files.** The `_1999` and `_2000` box scores both hold 450 of its games, rightly marked `season` 1999 in each, so read them with `season = file_season`. The schedule files also hold 50 games dated 1999 marked 2000.
- **ESPN lists postponed games as their own rows** (`status_type_name`: 32 in 2020-21, 4 in 2025-26), and has gaps in old box scores: 1,106 of 1,189 regular-season games in 1995-96.
- **The NBA's game id prefix is its game type:** `001` preseason, `002` regular season, `003` All-Star, `004` playoffs, `005` play-in, `006` Cup final, on all 42,235 games. Its regular-season counts match the real season lengths. The BOS-IND game cancelled in 2013 is still there, at 0-0.
- **Lineup `group_id`s do not always match between dashboards:** 76,343 of 277,982 rows in the scoring file are not in the base file. Not investigated yet; player order in the id is the likely cause.
- **`matchup_min` is spelled two ways:** `41:33` in totals and `8.3` in per-game, so the column is text.
- **`season_type` holds team ids in two tables.** In `nba_stats_coaches` and `nba_stats_rosters` the column holds values such as `1610612755` (read on the 2026 files). Do not read a season type from it.
- **Minutes differ in type:** text in NBA box scores (with `''` for did not play), a number in ESPN's.
- **Positions differ:** NBA `G`, `F`, `C`, `G-F`, `F-C`, `C-F`, `F-G`; ESPN mostly `G`, `F`, `C` with a few `PG`, `PF`, `SF`.
- **`nba_stats_player_season_stats` is six measure types times two modes per player:** always filter `measure_type` and `per_mode`, or rows multiply.
- **Some tables have no game grain.** The hustle and play-type files read have no game id: they are season totals, so a date range cannot be answered from them. `nba_stats_game_matchups` does have game ids.
- **`nba_player_impact` holds the dataset's own calculations,** not the original publishers' values. Its card names `sportsdataverse.nba.nba_rapm`, `nba_bpm` (BPM 2.0), `nba_war` and `nba_darko`. It leaves out play-in games. Its DARKO columns project the next season, and are null until two seasons are available. Label these as SportsDataverse's.

## stats.nba.com directly

Metis does not call it. It refuses plain clients, and getting past that means imitating a browser. The dataset above covers what is needed. The dataset's own pipeline reads it, which is part of why the terms need reading before a release.
