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
| `nba_stats_standings`           | 1997–2027 | 31    | 1.1   | The Standings screen and a team's header                                                                                                                     |
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

Measured season by season on the full load: the tables are in [nba-agreement.md](nba-agreement.md), written by `scripts/check-agreement.mjs`. In short, over finished seasons:

| Check                                                             | Result                                                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular-season games against the real season lengths              | Every season from 1993-94 matches, including the short ones and the game cancelled in 2013                                                                  |
| Teams in each season                                              | 27, 29 and 30 in the right seasons                                                                                                                          |
| NBA: players sum to the team                                      | 99.9–100 % of team-games on points, 100 % on rebounds and assists                                                                                           |
| ESPN: players sum to the team                                     | 98.6–100 % on points, 98.7–100 % on assists                                                                                                                 |
| ESPN against the NBA: points, assists, FGM, 3PM, FTA              | 99.7–100 %                                                                                                                                                  |
| ESPN against the NBA: field-goal attempts                         | 98.8–100 %                                                                                                                                                  |
| ESPN's players summed against the NBA's team: rebounds, turnovers | 98.6–100 %, 98.9–100 %                                                                                                                                      |
| Player lines on an NBA id                                         | All but one from 1996-97; 81 %, 89 % and 95 % in the three seasons before, whose other players retired before the NBA's data starts                         |
| Player lines in both sources                                      | All found; points 100 %, rebounds and assists 99.9–100 %                                                                                                    |
| Published season totals against summed box scores                 | Games 98.5–100 %, points 97.7–100 %, rebounds 98–100 %, assists 98.2–100 %                                                                                  |
| Possessions against the box score, team points                    | 1996-97 to 2016-17: 53 % exact, 59 % within 1, 96 % within 5. From 2017-18: 88 % exact, 95 % within 1, 99.9 % within 5. The worst single game is off by 113 |
| Season tables against published totals: the top 20 scorers        | 20 of 20, same points and games, every season from 1996-97                                                                                                  |
| Season tables against published totals: all players               | Games 99.8–100 %, points 97.7–100 %, rebounds 98–100 %, assists 98.2–100 %. Wins and losses 100 % for every team                                            |
| Plus-minus: a team's players sum to five times the margin         | 96.2–100 %, from 1996-97                                                                                                                                    |
| The catalogue's formulas against the NBA's published rates        | FG%, 3P%, FT%, eFG%, TS%, 3PAr and scoring shares: 96.6–100 % of players within rounding, 100 % in most seasons from 2007-08                                |
| Estimates against the NBA's measures, median difference           | USG% 0.4–0.7 points, AST% 0.2–0.3, TRB% about 1. Team ratings and pace about 1 against its counts, 0.7 against its own estimates                            |

So the box scores can be trusted season by season, and the sources cross-check. **Possessions are a derived table, not an official one** (`lineup_source` is `pbp_fallback` on 99.6 % of 2025-26): anything built on them has to state that tolerance.

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
- **Lineup `group_id`s do not always match between dashboards:** 76,343 of 277,982 rows in the scoring file are not in the base file. Not investigated yet; player order in the id is the likely cause.
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
- **`nba_player_impact` holds the dataset's own calculations,** not the original publishers' values. Its card names `sportsdataverse.nba.nba_rapm`, `nba_bpm` (BPM 2.0), `nba_war` and `nba_darko`. It leaves out play-in games. Its DARKO columns project the next season, and are null until two seasons are available. Label these as SportsDataverse's.

## stats.nba.com directly

Metis does not call it. It refuses plain clients, and getting past that means imitating a browser. The dataset above covers what is needed. The dataset's own pipeline reads it, which is part of why the terms need reading before a release.
