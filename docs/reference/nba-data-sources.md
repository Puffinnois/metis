# NBA data sources: what was measured

Measured 2026-11-05 against [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data) release files, on the finished 2025-26 season unless noted. Numbers here came from reading the files; re-measure before relying on them much later.

## The source

Free, keyless Parquet files on GitHub releases, updated daily during the season. It fills the role nflverse fills in the template. It republishes two upstreams, ESPN (`espn_nba_*`) and stats.nba.com (`nba_stats_*`), plus derived tables.

**Not yet checked:**

- The licence and terms of the dataset and its upstreams. Metis downloads to the user's machine and redistributes nothing, but check before a public release.
- Asset lists for `espn_nba_player_boxscores`, `espn_nba_team_boxscores`, `espn_nba_pbp`, `espn_nba_schedules`, `nba_stats_player_boxscores` and `nba_stats_pbp`: GitHub's anonymous API allowance ran out. The first four do publish Parquet (files read directly). `nba_stats_player_boxscores` publishes at least 2026. `nba_stats_pbp` returned 404 for the one file name tried, so it is unconfirmed.
- Any season other than 2025-26, 1993-94 and 1996-97.

## Tables

Season ranges are the labels in the file names (see "Traps" for what a label means).

| Release                         | Seasons   | Parquet MB | Holds                                                             |
| ------------------------------- | --------- | ---------- | ----------------------------------------------------------------- |
| `espn_nba_player_boxscores`     | 1994–2027 | ?          | Player-game box score, 57 columns                                 |
| `espn_nba_team_boxscores`       | 1994–2027 | ?          | Team-game box score, 59 columns (points in the paint, fast break) |
| `espn_nba_pbp`                  | 2002–2027 | ~22/season | Play by play, 68 columns, coordinates                             |
| `espn_nba_schedules`            | all       | ?          | Schedule master, 80 columns (venue, attendance, broadcast)        |
| `espn_nba_shots`                | 2002–2027 | 81         | Shots                                                             |
| `espn_nba_game_rosters`         | 2002–2027 | 8          | Who dressed                                                       |
| `nba_stats_player_boxscores`    | 2026+     | ?          | Player-game box score, 37 columns (season range not read)         |
| `nba_stats_team_boxscores`      | 1997–2027 | 2          | Team-game box score, 29 columns                                   |
| `nba_stats_player_game_logs`    | 1997–2027 | 2          | **Team** rows despite the name (2,630 rows in 2026), 31 columns   |
| `nba_stats_schedules`           | 1997–2027 | 1          | Games with their type, 15 columns                                 |
| `nba_stats_possessions`         | 1997–2027 | 97         | Every possession with the ten players on court, 35 columns        |
| `nba_stats_game_lineups`        | 1997–2027 | 22         | Five-man units per play                                           |
| `nba_stats_lineups`             | 2008–2027 | 27         | Lineup tables, 182 columns                                        |
| `nba_stats_shots`               | 1997–2027 | 106        | Shots, 19 columns                                                 |
| `nba_stats_player_season_stats` | 1997–2027 | 17         | Player-season, 210 columns, includes `nba_fantasy_pts`, `dd2`     |
| `nba_stats_team_season_stats`   | 1997–2027 | 3          | Team-season                                                       |
| `nba_stats_leaguedash`          | 1996–2027 | 306        | League dashboards, 869 files                                      |
| `nba_player_impact`             | 1997–2027 | 3          | RAPM, SPM, BPM, WAR, DARKO, 28 columns                            |
| `nba_stats_synergy`             | 2016–2027 | 17         | Play types, 828 files                                             |
| `nba_stats_hustle`              | 2016–2027 | 2          | Hustle stats                                                      |
| `nba_stats_matchups`            | 2018–2027 | 35         | Season matchups                                                   |
| `nba_stats_game_matchups`       | 2018–2027 | 43         | Game matchups                                                     |
| `nba_stats_injury_report`       | 2019–2027 | 5          | Official injury reports, 376,069 rows in 2026                     |
| `nba_stats_rosters`             | 1997–2027 | 1          | Bio: height, weight, birth date, school, experience               |
| `nba_stats_draft_combine`       | 2001–2027 | 2          | Combine                                                           |
| `nba_crosswalk`                 | 2002–2027 | 2          | ESPN ↔ NBA ids for players and teams, per season                  |
| Others                          |           | ~14        | Coaches, officials, standings, rolling windows, metric curves     |

The tables with a size add up to about 800 MB. With the unmeasured ones (play by play alone is roughly 500 MB) expect well over 1 GB of downloads; **measure it during the first full load.** The template's whole download was 210 MB and its DuckDB file 350 MB, so its memory settings must be re-checked at this scale.

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
- **Ids differ.** NBA game ids are text with leading zeros (`0022500001`), ESPN's are numeric-looking (`401809234`). There is no game crosswalk file: join on date and team.
- **The player crosswalk** starts in 2002 and matches on exact names (672 of 673 in 2026), leaving a few rows unjoined. Seasons 1994–2001 need their own identity step.
- **Minutes differ in type:** text in NBA box scores (with `''` for did not play), a number in ESPN's.
- **Positions differ:** NBA `G`, `F`, `C`, `G-F`, `F-C`, `C-F`, `F-G`; ESPN mostly `G`, `F`, `C` with a few `PG`, `PF`, `SF`.
- **`nba_stats_player_season_stats` is six measure types times two modes per player:** always filter `measure_type` and `per_mode`, or rows multiply.

## stats.nba.com directly

Metis does not call it. It refuses plain clients, and getting past that means imitating a browser. The dataset above covers what is needed.
