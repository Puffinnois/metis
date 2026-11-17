# WNBA data sources: what was measured

Measured 2026-11-17 (Plan T1301.1) against the WNBA releases of [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data), all 1,586 Parquet files downloaded on that day and read with DuckDB. The 2026 season had finished (Finals ended 2026-10-29), so every season here is complete. Numbers came from reading the files; re-measure before relying on them much later. The NBA's document, [nba-data-sources.md](nba-data-sources.md), is the model: where a WNBA table behaves like its NBA twin, this document says so and does not repeat the NBA's traps.

The raw files are kept outside the repository, in `~/.cache/metis-dev/wnba-raw` (one folder per release), with the asset list in `~/.cache/metis-dev/wnba-assets.tsv`, a column survey in `~/.cache/metis-dev/wnba-schema.txt` and Basketball-Reference's season pages in `~/.cache/metis-dev/wnba-bref`.

## The source

The same release store as the NBA's: free, keyless Parquet files on GitHub releases, rebuilt daily in season. Two upstreams again, ESPN (`espn_wnba_*`) and the league's own stats site, stats.wnba.com (`wnba_stats_*`), plus the dataset's derived tables (`wnba_crosswalk`, `wnba_groups`, `wnba_player_impact`). Every release note names its upstream: "ESPN WNBA API" or "stats.wnba.com official endpoints"; the impact file says "stats.wnba.com inputs, scored through the wehoop model stack".

Metis reads only these release files. It makes no request to stats.wnba.com or wnba.com (D7 holds for the WNBA's stats site as for the NBA's), and nothing in this document came from them.

### Producers and licences

Read through the GitHub API on 2026-11-17.

| Repository                                                                                                                                               | Builds                                                                               | Licence                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data)                                                                          | The release store                                                                    | `LICENSE` is MIT, README shows CC BY 4.0, as for the NBA                                         |
| [wehoop-wnba-data](https://github.com/sportsdataverse/wehoop-wnba-data)                                                                                  | `espn_wnba_*` (13 releases in its README's diagram)                                  | `LICENSE.md`: CC BY 4.0 for "data, code, and documentation"; `DESCRIPTION`: `License: CC BY 4.0` |
| [wehoop-wnba-stats-data](https://github.com/sportsdataverse/wehoop-wnba-stats-data)                                                                      | `wnba_stats_*` (18 releases in its README's diagram), from stats.wnba.com            | `LICENSE.md`: CC BY 4.0; `DESCRIPTION`: `License: CC BY 4.0`                                     |
| [wehoop-wnba-raw](https://github.com/sportsdataverse/wehoop-wnba-raw), [wehoop-wnba-stats-raw](https://github.com/sportsdataverse/wehoop-wnba-stats-raw) | The raw JSON behind the two above                                                    | `LICENSE.md`: CC BY 4.0                                                                          |
| [wehoop](https://github.com/sportsdataverse/wehoop)                                                                                                      | The R package (its README lists the WNBA Stats API and ESPN among the APIs it wraps) | MIT (`MIT + file LICENSE`)                                                                       |

So the WNBA's producers carry the same CC BY 4.0 as hoopR-nba-data and hoopR-nba-stats-data, and the upstreams are ESPN and the league's stats site. Which repository builds `wnba_crosswalk`, `wnba_groups` and `wnba_player_impact` is not stated in a README read; their release notes name only their inputs.

**`data-rights.md`.** It needs a WNBA entry before the WNBA ships, and the entry is factual and mirrors the NBA's, so it can be written in T1301.4 with the WNBA's releases. What it should say: the WNBA releases come from wehoop-wnba-data (`espn_wnba_*`) and wehoop-wnba-stats-data (`wnba_stats_*`), each under CC BY 4.0 like the NBA's producers; the upstreams are ESPN and the WNBA (stats.wnba.com, WNBA.com), whose terms no repository speaks for; the credit in the app and README names SportsDataverse and CC BY 4.0, and adds the WNBA and ESPN as sources; "NBA" in D31's lines about the app's name, icon and domain reads as "NBA or WNBA". The WNBA's own terms of use were not read for this part. This part leaves `data-rights.md` unchanged.

## Size

The whole asset list, read through the GitHub API: **37 WNBA releases, 1,586 Parquet files, 402.7 MB** (the draft of 2026-11-08 counted 1,535 files and about 420 MB). The same data is also published as CSV (921 files, 1,530 MB) and RDS (853 files, 203 MB), which Metis ignores, and 134 small JSON, text and README files. Downloaded four at a time with a plain client, the 1,586 files took 227 seconds (407 MB on disk).

Metis would load 1,496 of the files, 296.1 MB: the 90 `*_master` files (106.6 MB) repeat their parts (see "Which files repeat others").

| Load tier    | Releases                                                                                                                                     | Files | MB    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| Core         | Schedules, box scores and game logs, season tables, rosters, game rosters, standings, crosswalk, groups, draft, coaches, officials, injuries | 574   | 16.3  |
| Published    | League dashboards (masters left out), lineup tables, impact, metric curves, rolling windows                                                  | 751   | 121.7 |
| Events       | Shots (both sources), possessions, game lineups                                                                                              | 115   | 42.9  |
| Play by play | Both sources                                                                                                                                 | 56    | 115.2 |

A WNBA season is one calendar year, so there is no "current season" file growing beside a finished one in November: all 30 seasons are finished. The 2026 files are 65 files and 24.0 MB. Nine files hold every season in one file (`wnba_groups`' six, both schedule masters, ESPN's `wnba_games_in_data_repo`).

Against the NBA: a fifth of the files loaded (1,496 against 3,025) and a fifth of the megabytes (296 against 1,554).

## Tables

Seasons are the file-name labels, which for the WNBA are the year the season was played (see "Traps"). "Tier" is where the file would load (D21); "Repeats" is D23's question.

| Release                          | File name                                                                          | Grain                                          | Seasons            | Files | MB    | Tier      | Repeats                                        |
| -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------ | ----- | ----- | --------- | ---------------------------------------------- |
| `espn_wnba_schedules`            | `wnba_schedule_<season>`                                                           | Game, 80 columns                               | 1997–2026          | 30    | 1.6   | Core      | No                                             |
|                                  | `wnba_schedule_master`, `wnba_games_in_data_repo`                                  | Game, every season                             | 1997–2026          | 2     | 1.2   | Core      | Master: the same 7,042 games                   |
| `espn_wnba_player_boxscores`     | `player_box_<season>`                                                              | Player-game, 57 columns                        | 2002–2026          | 25    | 2.5   | Core      | No (2002 is empty, see "Traps")                |
| `espn_wnba_team_boxscores`       | `team_box_<season>`                                                                | Team-game, 59 columns                          | 2003–2026          | 24    | 1.0   | Core      | No                                             |
| `espn_wnba_player_season_stats`  | `player_season_stats_<season>`                                                     | Player-season-stat, long (one row per stat)    | 1997–2026          | 30    | 1.1   | Core      | No                                             |
| `espn_wnba_team_season_stats`    | `team_season_stats_<season>`                                                       | Team-season-stat, long                         | 1997–2026          | 30    | 0.4   | Core      | No                                             |
| `espn_wnba_player_core`          | `player_core_<season>`                                                             | Player-season, bio                             | 2002–2026          | 25    | 0.7   | Core      | No                                             |
| `espn_wnba_game_rosters`         | `game_rosters_<season>`                                                            | Player-game, who dressed                       | 2002–2026          | 25    | 0.9   | Core      | No                                             |
| `espn_wnba_standings`            | `standings_<season>`                                                               | Team-season-stat, long                         | 2002–2026          | 25    | 0.3   | Core      | No                                             |
| `espn_wnba_officials`            | `officials_<season>`                                                               | Official-game                                  | 2003–2026          | 24    | 0.2   | Core      | No                                             |
| `espn_wnba_draft`                | `draft_<season>`                                                                   | Pick                                           | 2018–2026          | 9     | 0.1   | Core      | No                                             |
| `espn_wnba_rosters`              | `rosters_<season>`                                                                 | Player-team                                    | 2024–2026          | 3     | 0.1   | Core      | No                                             |
| `espn_wnba_injuries`             | `injuries_2026`                                                                    | Player-day snapshot                            | 2026               | 1     | 0.05  | Core      | No                                             |
| `espn_wnba_shots`                | `shots_<season>`                                                                   | Shot, 20 columns                               | 2002–2026          | 25    | 11.5  | Events    | No                                             |
| `espn_wnba_pbp`                  | `play_by_play_<season>`                                                            | Play, 70 columns                               | 2002–2026          | 25    | 65.1  | Plays     | No                                             |
| `wnba_stats_schedules`           | `wnba_schedule_<season>`                                                           | Game, 15 columns                               | 1997–2026          | 30    | 0.25  | Core      | No                                             |
|                                  | `wnba_stats_schedule_<season>`                                                     | Game logs, mislabelled (see "Traps")           | 2025–2026          | 2     | 0.14  | Core      | Repeats the game logs                          |
|                                  | `wnba_stats_schedule_master`                                                       | Team-game, 2026 to 2026-07-15                  | 2026               | 1     | 0.02  | Core      | Repeats the game logs' team rows               |
| `wnba_stats_player_game_logs`    | `player_game_logs_<season>`                                                        | Player-game **and** team-game rows, 35 columns | 1997–2026          | 30    | 3.1   | Core      | No                                             |
| `wnba_stats_player_boxscores`    | `player_boxscores_2026`                                                            | Player-game, 34 columns                        | 2026               | 1     | 0.15  | Core      | No (the only full 2026 player lines)           |
| `wnba_stats_team_boxscores`      | `team_boxscores_2026`                                                              | Team-game, 26 columns                          | 2026               | 1     | 0.03  | Core      | Not measured against the game logs' team rows  |
| `wnba_stats_player_season_stats` | `player_season_stats_2026`                                                         | Player-season-measure, 212 columns             | 2026               | 1     | 0.27  | Core      | Not measured against the dashboards            |
| `wnba_stats_team_season_stats`   | `team_season_stats_2026`                                                           | Team-season-measure, 188 columns               | 2026               | 1     | 0.09  | Core      | Not measured against the dashboards            |
| `wnba_stats_standings`           | `standings_2026`                                                                   | Team-season, 94 columns                        | 2026               | 1     | 0.03  | Core      | Not measured against the dashboards'           |
| `wnba_stats_rosters`             | `rosters_<season>`                                                                 | Player-team, bio                               | 1997–2026          | 30    | 0.4   | Core      | No                                             |
| `wnba_stats_game_rosters`        | `game_rosters_<season>`                                                            | Player-game, sparse (1 to 994 rows a season)   | 1997–2026          | 30    | 0.2   | Core      | No                                             |
| `wnba_stats_draft`               | `draft_<season>`                                                                   | Pick                                           | 1997–2026          | 30    | 0.2   | Core      | No                                             |
| `wnba_stats_coaches`             | `coaches_<season>`                                                                 | Coach-team                                     | 1997–2026, no 2019 | 29    | 0.1   | Core      | No                                             |
| `wnba_stats_officials`           | `officials_<season>`                                                               | Official-game                                  | 2004–2026          | 23    | 0.1   | Core      | No                                             |
| `wnba_crosswalk`                 | `wnba_{player,team,schedule}_crosswalk_<season>`                                   | Ids across ESPN, WNBA, Fox and Yahoo           | 2002–2026          | 75    | 0.8   | Core      | No                                             |
| `wnba_groups`                    | `wnba_groups`, `wnba_group_seasons`, `wnba_team_group_seasons[_<season>]`, aliases | Conferences, team and player aliases           | 1997–2026          | 36    | 0.2   | Core      | No                                             |
| `wnba_stats_leaguedash`          | `player_stats_{base,advanced,misc,scoring,usage,defense}_<season>`                 | Player-season per season type                  | 1997–2026          | 180   | 8.6   | Published | No                                             |
|                                  | `team_stats_{base,advanced,misc,scoring,fourfactors,opponent,defense}_<season>`    | Team-season per season type                    | 1997–2026          | 210   | 3.7   | Published | No                                             |
|                                  | `lineups_{base,advanced,misc,scoring,fourfactors,opponent}_<season>`               | Two- to five-player units                      | 1997–2026          | 180   | 103.1 | Published | No                                             |
|                                  | `player_bio_<season>`, `standings_<season>`                                        | Player-season, team-season                     | 1997–2026          | 60    | 1.6   | Published | No                                             |
|                                  | `player_master`, `team_master`, `lineups_master`                                   | Every part joined                              | 1997–2026          | 90    | 106.6 | —         | **Yes: not loaded** (D23)                      |
| `wnba_stats_lineups`             | `lineups_2026`                                                                     | Unit per measure and mode                      | 2026               | 1     | 0.9   | Published | Not measured against the dashboards            |
| `wnba_player_impact`             | `wnba_player_impact_<season>`, `…_league_averages_<season>`                        | Player-season per season type, 76 columns      | 1997–2026          | 60    | 2.5   | Published | No                                             |
| `wnba_stats_metric_curves`       | `metric_curves_<season>`                                                           | FG% by shot-distance bin: league, team, player | 1997–2026          | 30    | 0.7   | Published | No                                             |
| `wnba_stats_rolling_windows`     | `rolling_windows_<season>`                                                         | Player FG% and 3P% over windows                | 1997–2026          | 30    | 0.6   | Published | No                                             |
| `wnba_stats_shots`               | `shots_<season>`                                                                   | Shot, 18 columns                               | 1997–2026          | 30    | 13.5  | Events    | No                                             |
| `wnba_stats_possessions`         | `wnba_possessions_<season>`                                                        | Possession with the ten players, 37 columns    | 1997–2026          | 30    | 14.3  | Events    | No                                             |
| `wnba_stats_game_lineups`        | `wnba_lineups_<season>`                                                            | Ten players per play, 14 columns               | 1997–2026          | 30    | 3.6   | Events    | No                                             |
| `wnba_stats_pbp`                 | `wnba_play_by_play_<season>`                                                       | Play, 38 columns                               | 1997–2026          | 30    | 47.6  | Plays     | No                                             |
|                                  | `play_by_play_2026`                                                                | Play, 25 columns                               | 2026               | 1     | 2.5   | Plays     | Same 149,921 plays as `wnba_play_by_play_2026` |

Rows, over every season: ESPN play by play 2,297,871; the WNBA's play by play and game lineups 2,842,576 each; possessions 1,065,895; shots 1,014,207 (ESPN) and 909,087 (WNBA); game logs 147,465; ESPN player box scores 135,532.

**Not published for the WNBA at all,** though the NBA has them: player tracking, hustle, play types (`synergy`), season and game matchups, the official injury report, the draft combine. No `wnba_stats_*` release exists for any of them.

## Coverage

Which source gives what, from which season. "WNBA" is the league's stats site through the dataset.

| Kind                                            | WNBA source                                                                                    | ESPN source                                                      | One source only |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------- |
| Schedule                                        | 1997–2026, every game (regular season and playoffs)                                            | 1997–2026, every game plus the All-Star Game and the Cup final   |                 |
| Player box scores                               | Game logs 1997–2025 complete; 2026 in 202 of 352 games. `player_boxscores` 2026, all 352 games | 2003–2026 (2003: 195 of 256 games). 2002's file holds only zeros | **1997–2002**   |
| Team box scores                                 | Game logs' team rows 1997–2026, every game                                                     | 2003–2026                                                        | **1997–2002**   |
| Season stats (published)                        | League dashboards 1997–2026 (regular season; playoffs from 2001); `*_season_stats` 2026 only   | 1997–2026, long format                                           |                 |
| Standings                                       | League dashboards 1997–2026 (regular season); `standings` 2026 only                            | 2002–2026                                                        | 1997–2001       |
| Play by play                                    | 1997–2026                                                                                      | 2002–2026                                                        | 1997–2001       |
| Shots                                           | 1997–2026; a location on every shot from 2011, on 70–80 % before                               | 2002–2026                                                        | 1997–2001       |
| Possessions, on-court                           | Possessions and game lineups 1997–2026 (the dataset's, from the play by play)                  |                                                                  | All             |
| Lineup tables                                   | Dashboards 1997–2026 (playoffs from 2001); `wnba_stats_lineups` 2026                           |                                                                  | All             |
| Rosters, bio                                    | 1997–2026                                                                                      | `player_core` 2002–2026, `rosters` 2024–2026                     |                 |
| Draft                                           | 1997–2026                                                                                      | 2018–2026                                                        |                 |
| Coaches                                         | 1997–2026 (no 2019; head coaches only until 2024)                                              |                                                                  | All             |
| Officials                                       | 2004–2026, a crew for every game                                                               | 2003–2026 (a crew for 55–82 % of games to 2012, all from 2013)   |                 |
| Injuries                                        | None                                                                                           | Daily snapshots from 2026-09-08 only                             | All             |
| Impact                                          | RAPM, SPM, BPM, WAR 1997–2026; BOBAN 1998–2026 (the dataset's own)                             |                                                                  | All             |
| Tracking, hustle, play types, matchups, combine | Not published                                                                                  | Not published                                                    |                 |

**The draft's known facts, checked.** "NBA-stats-side box scores, season stats and standings publish 2026 only": true of the releases named `*_boxscores`, `*_season_stats` and `*_standings`, but not of the data. The player game logs hold every team-game from 1997 and every player-game from 1997 to 2025, and the league dashboards publish season stats and standings for every season from 1997, which agree with Basketball-Reference's records on every team (below). "1997 to 2001 has one source": true for box scores, and it is **1997 to 2002**, since ESPN's 2002 box scores are all zeros and its team box scores start in 2003.

## Which files repeat others

Measured on the downloaded files. A file is skipped only when proven to repeat others (D23).

| Files                                                                                     | Result                                                                                                                                                                                                                                     | Loaded?                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `team_master`                                                                             | 286 columns; each maps to a part (prefixes `adv_`, `misc_`, `scor_`, `ff_`, `opp_`, `def_`, none for base); all 283 compared equal on every row; no part row missing from it                                                               | No                                                                     |
| `lineups_master`                                                                          | 276 columns, 272 compared, equal on every row. Its 258,539 units are the base file's; the 2,273 and 22,643 it has that the advanced and scoring files lack carry no value of theirs (`adv_off_rating` null on all 2,352 such rows checked) | No                                                                     |
| `player_master`                                                                           | 367 columns, 363 compared, equal before 2026 (a first pass flagged one row, not found again). In 2026 it holds 301 regular-season rows for the parts' 239 rows of the same 238 players: repeated rows, no player the parts lack            | No                                                                     |
| `wnba_stats_pbp/play_by_play_2026`                                                        | All 149,921 plays equal `wnba_play_by_play_2026` on game, action number, clock, score and description; 25 columns against 38                                                                                                               | No                                                                     |
| `wnba_stats_schedule_<season>`, `wnba_stats_schedule_master`                              | Game logs under a schedule's name: 2026 holds the 2026 game logs' 4,011 player rows and 704 team rows; 2025 holds 2025's 620 team rows; the master 362 team rows to 2026-07-15                                                             | No                                                                     |
| ESPN `wnba_schedule_master`                                                               | The same 7,042 games as the season files                                                                                                                                                                                                   | As the NBA's: yes (T406 kept it for 3 more columns; not measured here) |
| `wnba_stats_player_boxscores_2026` against the game logs                                  | Equal on points, rebounds and assists on all 4,011 lines both hold; it alone has the other 150 games                                                                                                                                       | Yes                                                                    |
| `*_season_stats_2026`, `standings_2026`, `team_boxscores_2026`, `wnba_stats_lineups_2026` | Not compared with the dashboards or game logs in this part                                                                                                                                                                                 | Yes (not proven)                                                       |

The skipped files are 90 masters (106.6 MB), plus the four small mislabelled or repeated files (2.8 MB). T1301.4 confirmed the four in its loader tests (`tests/main/stats/wnbaLoad.test.ts`, on fixtures cut from game 1022600001): the 2026 file under a schedule's name holds the game logs' rows exactly, and `play_by_play_2026` the same plays as `wnba_play_by_play_2026` on game, action number, clock, period, score and description; the registry leaves them out (`SOURCES_BY_LEAGUE.wnba`, 1,492 files).

## Do the numbers agree?

Measured on the downloaded files: the game logs (WNBA) against ESPN's box scores, games joined through `wnba_schedule_crosswalk` and players through `wnba_player_crosswalk`. Exact equality, no tolerance.

### Player-games, by season

"Paired" counts the WNBA's player lines, in games the crosswalk links, that found an ESPN line for the same player through the crosswalk.

| Season | WNBA lines in linked games | Paired with ESPN | Points % | Rebounds % | Assists % | All three % |
| ------ | -------------------------- | ---------------- | -------- | ---------- | --------- | ----------- |
| 2002   | 5,231                      | 4,944 (94.5 %)   | 19.0     | 18.1       | 36.1      | 7.0         |
| 2003   | 4,975                      | 3,692 (74.2 %)   | 95.2     | 95.2       | 95.9      | 94.6        |
| 2004   | 4,589                      | 4,044 (88.1 %)   | 95.7     | 95.5       | 95.9      | 95.1        |
| 2005   | 4,604                      | 4,304 (93.5 %)   | 95.0     | 94.9       | 95.2      | 94.2        |
| 2006   | 5,125                      | 4,864 (94.9 %)   | 96.5     | 96.4       | 96.7      | 96.1        |
| 2007   | 4,791                      | 4,583 (95.7 %)   | 95.1     | 95.0       | 95.4      | 94.2        |
| 2008   | 5,293                      | 4,967 (93.8 %)   | 97.0     | 96.9       | 97.0      | 96.5        |
| 2009   | 4,700                      | 4,591 (97.7 %)   | 99.7     | 99.7       | 99.7      | 99.7        |
| 2010   | 4,213                      | 4,055 (96.2 %)   | 99.7     | 99.7       | 99.7      | 99.7        |
| 2011   | 4,335                      | 4,264 (98.4 %)   | 99.6     | 99.5       | 99.6      | 99.5        |
| 2012   | 4,271                      | 4,089 (95.7 %)   | 99.8     | 99.9       | 99.8      | 99.7        |
| 2013   | 4,192                      | 4,078 (97.3 %)   | 100      | 100        | 100       | 100         |
| 2014   | 4,401                      | 4,289 (97.5 %)   | 99.95    | 99.9       | 99.9      | 99.9        |
| 2015   | 4,459                      | 4,358 (97.7 %)   | 100      | 100        | 100       | 100         |
| 2016   | 4,405                      | 4,249 (96.5 %)   | 100      | 99.98      | 100       | 99.98       |
| 2017   | 4,397                      | 4,348 (98.9 %)   | 99.9     | 99.98      | 100       | 99.9        |
| 2018   | 4,419                      | 4,355 (98.6 %)   | 100      | 99.95      | 100       | 99.95       |
| 2019   | 4,288                      | 4,200 (97.9 %)   | 100      | 100        | 100       | 100         |
| 2020   | 2,796                      | 2,796 (100 %)    | 100      | 100        | 100       | 100         |
| 2021   | 3,885                      | 3,885 (100 %)    | 100      | 100        | 100       | 100         |
| 2022   | 4,519                      | 4,459 (98.7 %)   | 100      | 100        | 100       | 100         |
| 2023   | 4,898                      | 4,852 (99.1 %)   | 100      | 100        | 100       | 100         |
| 2024   | 4,914                      | 4,914 (100 %)    | 100      | 100        | 100       | 100         |
| 2025   | 5,853                      | 5,853 (100 %)    | 100      | 100        | 100       | 100         |
| 2026   | 4,011                      | 3,984 (99.3 %)   | 100      | 100        | 100       | 100         |

2026's game logs hold 202 games; the WNBA's 2026 `player_boxscores`, which hold all 352, pair 6,959 of their 7,008 played lines (99.3 %) with ESPN, equal on points, rebounds and assists on every one. 2002 fails because ESPN's 2002 lines are all zeros. Unpaired lines are mostly crosswalk misses (it matches players by name, see "Traps") and, in 2003 and 2004, ESPN games with no box score.

### Team-games, by season

The game logs' team rows against ESPN's team box score, and against ESPN's players summed.

| Season | WNBA team-games | With an ESPN team box | Score % | Rebounds % | Assists % | FGA % | ESPN players summed: points % | rebounds % | assists % |
| ------ | --------------- | --------------------- | ------- | ---------- | --------- | ----- | ----------------------------- | ---------- | --------- |
| 2002   | 542             | 0                     | –       | –          | –         | –     | 0                             | 0          | 0         |
| 2003   | 510             | 392                   | 100     | 95.2       | 98.0      | 94.9  | 91.2                          | 86.6       | 95.6      |
| 2004   | 474             | 428                   | 100     | 97.0       | 99.8      | 98.6  | 92.5                          | 90.0       | 95.3      |
| 2005   | 476             | 458                   | 99.8    | 96.7       | 98.0      | 96.9  | 90.6                          | 90.2       | 93.0      |
| 2006   | 514             | 510                   | 99.8    | 98.2       | 98.4      | 97.6  | 93.3                          | 91.8       | 95.5      |
| 2007   | 482             | 482                   | 99.8    | 95.6       | 97.3      | 94.8  | 90.4                          | 89.1       | 93.1      |
| 2008   | 518             | 514                   | 100     | 99.0       | 99.4      | 98.1  | 94.6                          | 93.1       | 95.6      |
| 2009   | 482             | 482                   | 100     | 98.3       | 99.2      | 98.1  | 99.4                          | 99.4       | 99.4      |
| 2010   | 440             | 440                   | 100     | 99.3       | 99.5      | 99.3  | 99.3                          | 99.3       | 99.5      |
| 2011   | 448             | 448                   | 100     | 96.9       | 97.5      | 96.7  | 99.8                          | 98.7       | 99.1      |
| 2012   | 446             | 444                   | 100     | 98.9       | 98.6      | 98.4  | 99.8                          | 99.1       | 99.1      |
| 2013   | 442             | 442                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2014   | 444             | 444                   | 100     | 99.8       | 99.5      | 99.8  | 100                           | 99.5       | 99.5      |
| 2015   | 450             | 450                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2016   | 440             | 438                   | 100     | 99.8       | 99.8      | 99.8  | 100                           | 99.8       | 100       |
| 2017   | 438             | 438                   | 100     | 99.8       | 100       | 99.8  | 100                           | 99.8       | 100       |
| 2018   | 442             | 440                   | 100     | 99.5       | 100       | 100   | 100                           | 99.5       | 100       |
| 2019   | 440             | 440                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2020   | 294             | 294                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2021   | 418             | 418                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2022   | 478             | 478                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2023   | 520             | 520                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |
| 2024   | 524             | 524                   | 100     | 100        | 100       | 99.8  | 100                           | 100        | 100       |
| 2025   | 620             | 620                   | 100     | 100        | 100       | 99.8  | 100                           | 100        | 100       |
| 2026   | 704             | 704                   | 100     | 100        | 100       | 100   | 100                           | 100        | 100       |

### Within the WNBA's own files

| Check                                                            | Result                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game logs: team row's points against the schedule's score        | Every team-game of every season                                                                                                                                                 |
| Game logs: players summed against the team row                   | Points 97.8 % (1997), 99.4 % (1998), 99.3 % (2000), 100 % in every other season; rebounds and assists 99.6–100 %; FGA 99.6–100 %                                                |
| Game logs: players' minutes summed within a minute of the team's | 2 to 10 % of team-games from 1997 to 2004 (minutes are whole numbers per player, and the rounding adds up), 91.6 to 100 % from 2005                                             |
| Dashboards against game logs summed, regular season, all players | Points equal for 72–95 % of players in 1997–1999, 2002, 2006, 2007 and 2009; 97.6–100 % in every other season to 2025; games 83–100 %. 2026 is not comparable (game logs short) |
| Dashboard standings against the schedule's records               | Every team in every season except 2 in 2007, 2 in 2009 and 2 in 2018 (the schedule's missing games and the 2018 forfeit, see "Traps")                                           |
| Play by play's last score against the schedule                   | Home score equal on 95.7 % of 1997's games, 99.3–99.6 % of 1998–2000's, every game from 2001                                                                                    |
| Shots against the game logs' team FGA                            | 99.1–100 % of team-games to 2006, every team-game played from 2007                                                                                                              |
| Possessions' points against the team's points                    | 97.0 % exact in 1997 (99.1 % within 5), 99.3–99.6 % in 1998–2000, 100 % from 2001 but 2006 (one game)                                                                           |

So the box scores can be trusted season by season from 2009 in both sources, and within 3 to 5 % of player lines from 2003 to 2008, where ESPN's lines differ more often than in the NBA's data (99.7–100 %). The game logs are the reference for every season; ESPN checks them from 2003.

## Season lengths and team counts

The real ones are from [Basketball-Reference's WNBA season pages](https://www.basketball-reference.com/wnba/years/2026.html) (`/wnba/years/<season>.html`, the standings tables `standings_e` and `standings_w`), read with a plain client (`curl -A metis-research`, HTTP 200 for all 30, four seconds apart) on 2026-11-17 and kept in `~/.cache/metis-dev/wnba-bref`.

| Season    | Teams | Games a team | Regular-season games (B-R) | WNBA schedule | ESPN (league teams, less All-Star) | Team records: schedule / dashboards against B-R |
| --------- | ----- | ------------ | -------------------------- | ------------- | ---------------------------------- | ----------------------------------------------- |
| 1997      | 8     | 28           | 112                        | 112           | 112                                | 8 / 8 of 8                                      |
| 1998      | 10    | 30           | 150                        | 150           | 150                                | 10 / 10                                         |
| 1999      | 12    | 32           | 192                        | 192           | 192                                | 12 / 12                                         |
| 2000–2002 | 16    | 32           | 256                        | 256           | 256, 260, 256                      | 16 / 16 each                                    |
| 2003      | 14    | 34           | 238                        | 238           | 236                                | 14 / 14                                         |
| 2004      | 13    | 34           | 221                        | 221           | 218                                | 13 / 13                                         |
| 2005      | 13    | 34           | 221                        | 221           | 221                                | 13 / 13                                         |
| 2006      | 14    | 34           | 238                        | 238           | 238                                | 14 / 14                                         |
| 2007      | 13    | 34           | 221                        | **220**       | 221                                | **11** / 13                                     |
| 2008      | 14    | 34           | 238                        | 238           | 238                                | 14 / 14                                         |
| 2009      | 13    | 34           | 221                        | **220**       | 221                                | **11** / 13                                     |
| 2010–2017 | 12    | 34           | 204                        | 204           | 204 (205 in 2011)                  | 12 / 12 each                                    |
| 2018      | 12    | 34           | 204                        | 204 (one 0-0) | 204                                | **10** / 12                                     |
| 2019      | 12    | 34           | 204                        | 204           | 204                                | 12 / 12                                         |
| 2020      | 12    | 22           | 132                        | 132           | 132                                | 12 / 12                                         |
| 2021      | 12    | 32           | 192                        | 192           | 193 (with the Cup final)           | 12 / 12                                         |
| 2022      | 12    | 36           | 216                        | 216           | 217 (with the Cup final)           | 12 / 12                                         |
| 2023–2024 | 12    | 40           | 240                        | 240           | 242, 241                           | 12 / 12 each                                    |
| 2025      | 13    | 44           | 286                        | 286           | 287                                | 13 / 13                                         |
| 2026      | 15    | 44           | 330                        | 330           | 332                                | 15 / 15                                         |

ESPN's counts include rows that are not real regular-season games (postponed and to-be-decided rows in 2001, 2023 and 2026, the Commissioner's Cup final from 2021), and it has rows with no score for 1997 to 2001. The WNBA's schedule matches every season but two, each one game short; the dashboards' standings match Basketball-Reference on all 380 team-seasons. B-R's game count is the sum of its wins.

## The first load, estimated

Not measured in T1301.1 (the machine is shared). Estimated from the NBA's measured load (`nba-data-sources.md`, "The first full load"; WSL, 16 cores) by size and rows:

| Step                      | NBA, measured                                          | WNBA                      | WNBA, estimated                                |
| ------------------------- | ------------------------------------------------------ | ------------------------- | ---------------------------------------------- |
| Files                     | 3,025 files, 1,554 MB, about 20 minutes with downloads | 1,496 files, 296 MB       | 4 to 6 minutes (downloads alone took 3.8 here) |
| Play step (`stats:plays`) | 34.9 million rows in 440–546 s                         | 2.8 + 2.3 million plays   | 1 to 2 minutes                                 |
| Models step               | 161–200 s                                              | 7,021 games in 30 seasons | Under a minute                                 |
| Database file             | 5.32 GB from 1,554 MB (3.4 times)                      | 296 MB                    | About 1 GB                                     |
| Peak memory               | 2.7 GB (DuckDB's limit is 1 GB)                        |                           | Under the NBA's: bounded by the same limit     |

Well inside D22's limits (a 6 GB file, an hour, 4 GB of memory) for the WNBA alone. With both leagues each in its own file (D36), the NBA's numbers do not change; two first loads on one machine would add the WNBA's minutes to the NBA's.

## The first load, measured

Plan T1301.4, 2026-11-17: `node scripts/load-report.mjs ~/.cache/metis-dev/t1301d-clean ~/.cache/metis-dev/t1301d-load.json --league=wnba`, the built worker under plain Node, on a clean folder, WSL, 16 cores, the machine otherwise idle. The folder is kept as the WNBA's gate load for T1301.5 on (`~/.cache/metis-dev/t1301d-clean/stats-wnba.duckdb`). Nothing is built from the files yet (`League.derived` is false): the load ends with one `stats:derived` step logged `skipped`, "No WNBA game, team, player or season tables yet: its files are loaded, and nothing is built from them."

| Tier      | Files | Rows       | Downloaded | Minutes | File at its end | Peak memory |
| --------- | ----- | ---------- | ---------- | ------- | --------------- | ----------- |
| Core      | 571   | 768,477    | 16.2 MB    | 0.8     | 73 MB           | 928 MB      |
| Published | 751   | 1,781,527  | 121.7 MB   | 1.6     | 370 MB          | 1,474 MB    |
| Events    | 115   | 5,831,765  | 42.9 MB    | 0.3     | 371 MB          | 1,221 MB    |
| Plays     | 55    | 5,140,447  | 112.7 MB   | 0.7     | 659 MB          | 1,732 MB    |
| **All**   | 1,492 | 13,522,216 | 293.5 MB   | **3.7** | **666 MB**      | **1.73 GB** |

- **Steps:** 1,494: 1,492 files `ok` with no error, `coaches_2019` `skipped` (not published), and the `stats:derived` step `skipped`.
- **Against D22:** a 666 MB file (697,839,616 bytes) against 6 GB, 3.7 minutes against an hour, 1.73 GB of memory against 4 GB; and against the estimate, about 1 GB and 4 to 6 minutes: both lower. The registry's `size` for the WNBA is these numbers: 294 MB downloaded, the 666 MB file, 1 GB of free space asked before a first load (one and a half times the file, as the NBA's 6 GB is for its 5.1 GB), and loaded past 512 MB.
- **Widened types:** two, both integers made BIGINT (`src_wnba_coaches.sort_sequence`, empty in 2025 and 2026; `src_dash_standings.playoff_seeding`). ESPN's `game_date_time`, timestamp with time zone in most seasons and plain timestamp in 2023–2025, reads as timestamp with time zone in every file with this DuckDB (1.5.6), so it was not widened; ESPN's 2002 `athlete_jersey`, published with no type, reads as an empty INTEGER and the text column stays.
- **A read during the load:** the script's leaderboard read on ESPN's 2026 box scores took 2 to 17 ms in each tier.

**Rows, table by table,** against the raw files' own counts (`scripts/check-source-rows.mjs ~/.cache/metis-dev/t1301d-clean ~/.cache/metis-dev/wnba-raw --league=wnba`: DuckDB's `count(*)` over every file the registry names, in the files downloaded for T1301.1 that morning). 67 of 68 tables equal their files and what the load recorded. The one that differs, `src_espn_injuries`, is ESPN's daily snapshot file: it was republished at 21:33 UTC with the 2026-11-17 snapshot (44 rows), and its 3,231 rows up to 2026-11-16 equal the raw file.

| Table                             | Files | Raw rows  | Table rows | Recorded  | Equal  |
| --------------------------------- | ----- | --------- | ---------- | --------- | ------ |
| `src_dash_lineups_advanced`       | 30    | 258,539   | 258,539    | 258,539   | yes    |
| `src_dash_lineups_base`           | 30    | 258,539   | 258,539    | 258,539   | yes    |
| `src_dash_lineups_fourfactors`    | 30    | 258,539   | 258,539    | 258,539   | yes    |
| `src_dash_lineups_misc`           | 30    | 258,539   | 258,539    | 258,539   | yes    |
| `src_dash_lineups_opponent`       | 30    | 258,539   | 258,539    | 258,539   | yes    |
| `src_dash_lineups_scoring`        | 30    | 258,539   | 258,539    | 258,539   | yes    |
| `src_dash_player_bio`             | 30    | 7,124     | 7,124      | 7,124     | yes    |
| `src_dash_player_stats_advanced`  | 30    | 7,125     | 7,125      | 7,125     | yes    |
| `src_dash_player_stats_base`      | 30    | 7,125     | 7,125      | 7,125     | yes    |
| `src_dash_player_stats_defense`   | 30    | 5,999     | 5,999      | 5,999     | yes    |
| `src_dash_player_stats_misc`      | 30    | 7,125     | 7,125      | 7,125     | yes    |
| `src_dash_player_stats_scoring`   | 30    | 7,125     | 7,125      | 7,125     | yes    |
| `src_dash_player_stats_usage`     | 30    | 7,125     | 7,125      | 7,125     | yes    |
| `src_dash_standings`              | 30    | 380       | 380        | 380       | yes    |
| `src_dash_team_stats_advanced`    | 30    | 588       | 588        | 588       | yes    |
| `src_dash_team_stats_base`        | 30    | 588       | 588        | 588       | yes    |
| `src_dash_team_stats_defense`     | 30    | 588       | 588        | 588       | yes    |
| `src_dash_team_stats_fourfactors` | 30    | 588       | 588        | 588       | yes    |
| `src_dash_team_stats_misc`        | 30    | 588       | 588        | 588       | yes    |
| `src_dash_team_stats_opponent`    | 30    | 588       | 588        | 588       | yes    |
| `src_dash_team_stats_scoring`     | 30    | 588       | 588        | 588       | yes    |
| `src_espn_draft`                  | 9     | 335       | 335        | 335       | yes    |
| `src_espn_game_rosters`           | 25    | 137,887   | 137,887    | 137,887   | yes    |
| `src_espn_games_in_repo`          | 1     | 5,986     | 5,986      | 5,986     | yes    |
| `src_espn_injuries`               | 1     | 3,231     | 3,275      | 3,275     | **no** |
| `src_espn_officials`              | 24    | 14,830    | 14,830     | 14,830    | yes    |
| `src_espn_pbp`                    | 25    | 2,297,871 | 2,297,871  | 2,297,871 | yes    |
| `src_espn_player_box`             | 25    | 135,532   | 135,532    | 135,532   | yes    |
| `src_espn_player_core`            | 25    | 4,244     | 4,244      | 4,244     | yes    |
| `src_espn_player_season`          | 30    | 205,835   | 205,835    | 205,835   | yes    |
| `src_espn_rosters`                | 3     | 568       | 568        | 568       | yes    |
| `src_espn_schedule`               | 30    | 7,042     | 7,042      | 7,042     | yes    |
| `src_espn_schedule_master`        | 1     | 7,042     | 7,042      | 7,042     | yes    |
| `src_espn_shots`                  | 25    | 1,014,207 | 1,014,207  | 1,014,207 | yes    |
| `src_espn_standings`              | 25    | 7,173     | 7,173      | 7,173     | yes    |
| `src_espn_team_box`               | 24    | 11,302    | 11,302     | 11,302    | yes    |
| `src_espn_team_season`            | 30    | 16,380    | 16,380     | 16,380    | yes    |
| `src_group_aliases`               | 1     | 17        | 17         | 17        | yes    |
| `src_group_seasons`               | 1     | 90        | 90         | 90        | yes    |
| `src_groups`                      | 1     | 3         | 3          | 3         | yes    |
| `src_player_aliases`              | 1     | 3,512     | 3,512      | 3,512     | yes    |
| `src_team_aliases`                | 1     | 68        | 68         | 68        | yes    |
| `src_team_groups`                 | 30    | 380       | 380        | 380       | yes    |
| `src_team_groups_all`             | 1     | 380       | 380        | 380       | yes    |
| `src_wnba_coaches`                | 29    | 480       | 480        | 480       | yes    |
| `src_wnba_draft`                  | 30    | 1,246     | 1,246      | 1,246     | yes    |
| `src_wnba_game_lineups`           | 30    | 2,842,576 | 2,842,576  | 2,842,576 | yes    |
| `src_wnba_game_logs`              | 30    | 147,465   | 147,465    | 147,465   | yes    |
| `src_wnba_game_rosters`           | 30    | 4,805     | 4,805      | 4,805     | yes    |
| `src_wnba_impact`                 | 30    | 7,329     | 7,329      | 7,329     | yes    |
| `src_wnba_impact_averages`        | 30    | 580       | 580        | 580       | yes    |
| `src_wnba_lineups`                | 1     | 36,800    | 36,800     | 36,800    | yes    |
| `src_wnba_metric_curves`          | 30    | 114,212   | 114,212    | 114,212   | yes    |
| `src_wnba_officials`              | 23    | 16,554    | 16,554     | 16,554    | yes    |
| `src_wnba_pbp`                    | 30    | 2,842,576 | 2,842,576  | 2,842,576 | yes    |
| `src_wnba_player_box`             | 1     | 8,539     | 8,539      | 8,539     | yes    |
| `src_wnba_player_season`          | 1     | 3,960     | 3,960      | 3,960     | yes    |
| `src_wnba_possessions`            | 30    | 1,065,895 | 1,065,895  | 1,065,895 | yes    |
| `src_wnba_rolling_windows`        | 30    | 18,128    | 18,128     | 18,128    | yes    |
| `src_wnba_rosters`                | 30    | 4,599     | 4,599      | 4,599     | yes    |
| `src_wnba_schedule`               | 30    | 7,021     | 7,021      | 7,021     | yes    |
| `src_wnba_shots`                  | 30    | 909,087   | 909,087    | 909,087   | yes    |
| `src_wnba_standings`              | 1     | 15        | 15         | 15        | yes    |
| `src_wnba_team_box`               | 1     | 704       | 704        | 704       | yes    |
| `src_wnba_team_season`            | 1     | 322       | 322        | 322       | yes    |
| `src_xwalk_game`                  | 25    | 6,032     | 6,032      | 6,032     | yes    |
| `src_xwalk_player`                | 25    | 4,536     | 4,536      | 4,536     | yes    |
| `src_xwalk_team`                  | 25    | 318       | 318        | 318       | yes    |

**Sealed after the load** (`source_state`, the rule in `stats-database.md`, "Sync"): 1,473 files sealed, 19 not. Every season to 2024 is sealed on load. Of 2026's 60 files, 54 had not changed for two weeks and are sealed; 6 changed after 2026-11-03 and are checked weekly until they settle (ESPN's injuries, rosters and player season stats, the impact file and its averages, the possessions). Of 2025's 53, 48 are sealed and 5 republished in the last two weeks are not. The 8 files of every season are never sealed and are checked daily.

## Games, teams and players, built

Plan T1301.5, 2026-11-17: `game`, `team` and `player` built by the WNBA's identity recipe (`stats-database.md`, "The WNBA's recipe") in a real refresh of `~/.cache/metis-dev/t1301e`, a copy of the gate load `t1301d-clean`, through the built worker (`scripts/load-report.mjs … --league=wnba`; the `stats:identity` step took 0.6 s for 7,051 games), then checked by `scripts/check-agreement.mjs … --league=wnba`, whose full tables are in [wnba-agreement.md](wnba-agreement.md). Exact, no tolerance.

| Season | Teams (B-R) | Regular-season games (B-R) | Playoff games | Cup final, All-Star | Records equal to the standings | Games with ESPN's id | Crosswalk misses: by box score, none |
| ------ | ----------- | -------------------------- | ------------- | ------------------- | ------------------------------ | -------------------- | ------------------------------------ |
| 1997   | 8 (8)       | 112 (112)                  | 3             | –                   | 8 of 8                         | 112 of 115           | no crosswalk                         |
| 1998   | 10 (10)     | 150 (150)                  | 8             | –                   | 10 of 10                       | 150 of 158           | no crosswalk                         |
| 1999   | 12 (12)     | 192 (192)                  | 11            | –                   | 12 of 12                       | 203 of 203           | no crosswalk                         |
| 2000   | 16 (16)     | 256 (256)                  | 16            | –                   | 16 of 16                       | 272 of 272           | no crosswalk                         |
| 2001   | 16 (16)     | 256 (256)                  | 18            | –, 1                | 16 of 16                       | 273 of 274           | no crosswalk                         |
| 2002   | 16 (16)     | 256 (256)                  | 17            | –, 1                | 16 of 16                       | 271 of 273           | 9: 5, 4                              |
| 2003   | 14 (14)     | 238 (238)                  | 19            | –, 1                | 14 of 14                       | 255 of 257           | 7: 6, 1                              |
| 2004   | 13 (13)     | 221 (221)                  | 19            | –, 1                | 13 of 13                       | 237 of 240           | 4: 4, 0                              |
| 2005   | 13 (13)     | 221 (221)                  | 17            | –, 1                | 13 of 13                       | all 238              | 4: 4, 0                              |
| 2006   | 14 (14)     | 238 (238)                  | 19            | –, 1                | 14 of 14                       | all 257              | 7: 7, 0                              |
| 2007   | 13 (13)     | 221 (221), 1 from the logs | 21            | –, 1                | 13 of 13                       | all 242              | 6: 6, 0                              |
| 2008   | 14 (14)     | 238 (238)                  | 21            | –                   | 14 of 14                       | all 259              | 8: 6, 2                              |
| 2009   | 13 (13)     | 221 (221), 1 from the logs | 21            | –, 1                | 13 of 13                       | all 242              | 7: 4, 3                              |
| 2010   | 12 (12)     | 204 (204)                  | 16            | –, 1                | 12 of 12                       | all 220              | 4: 4, 0                              |
| 2011   | 12 (12)     | 204 (204)                  | 19            | –, 1                | 12 of 12                       | all 223              | 2: 2, 0                              |
| 2012   | 12 (12)     | 204 (204)                  | 19            | –                   | 12 of 12                       | all 223              | 5: 5, 0                              |
| 2013   | 12 (12)     | 204 (204)                  | 17            | –, 1                | 12 of 12                       | all 221              | 4: 4, 0                              |
| 2014   | 12 (12)     | 204 (204)                  | 18            | –, 1                | 12 of 12                       | all 222              | 3: 3, 0                              |
| 2015   | 12 (12)     | 204 (204)                  | 21            | –, 1                | 12 of 12                       | all 225              | 3: 3, 0                              |
| 2016   | 12 (12)     | 204 (204)                  | 16            | –                   | 12 of 12                       | all 220              | 4: 3, 0                              |
| 2017   | 12 (12)     | 204 (204)                  | 15            | –, 1                | 12 of 12                       | all 219              | 3: 2, 0                              |
| 2018   | 12 (12)     | 204 (204), 1 forfeit       | 17            | –, 1                | 12 of 12                       | all 221              | 2: 1, 0                              |
| 2019   | 12 (12)     | 204 (204)                  | 16            | –, 1                | 12 of 12                       | all 220              | 5: 3, 0                              |
| 2020   | 12 (12)     | 132 (132)                  | 15            | –                   | 12 of 12                       | all 147              | 0                                    |
| 2021   | 12 (12)     | 192 (192)                  | 17            | 1, 1                | 12 of 12                       | all 209              | 0                                    |
| 2022   | 12 (12)     | 216 (216)                  | 23            | 1, 1                | 12 of 12                       | all 239              | 2: 2, 0                              |
| 2023   | 12 (12)     | 240 (240)                  | 20            | 1, 1                | 12 of 12                       | all 260              | 2: 2, 0                              |
| 2024   | 12 (12)     | 240 (240)                  | 22            | 1, 1                | 12 of 12                       | all 262              | 0                                    |
| 2025   | 13 (13)     | 286 (286)                  | 24            | 1, 1                | 13 of 13                       | all 310              | 0                                    |
| 2026   | 15 (15)     | 330 (330)                  | 22            | 1, 1                | 15 of 15                       | all 352              | 1: 1, 0                              |

- **Every season's regular-season games and teams equal Basketball-Reference's,** and **every team's record equals the dashboards' standings: 380 of 380**. The two games the schedule lacks are taken from the game logs (Connecticut 73, New York 76 on 2007-06-20; New York 60, Los Angeles 69 on 2009-07-09, both equal to ESPN's scores), and the forfeit counts for Washington.
- **The Commissioner's Cup final** is a game type of its own (`cup-final`), counted in no record, and the league's dashboards leave its stats out of the regular season too (see the trap below), so T1301.6 should keep it out of regular-season totals.
- **Games with ESPN's id** count the league's games (both types); the Cup finals and All-Star Games are ESPN's own and always have it. ESPN has no playoff rows for 1997 and 1998, lacks 1 game of 2001, 2 of 2002's playoffs (both 2002-08-20) and 2 of 2003's, 3 of 2004's regular season.
- **Crosswalk misses** are the players with a line that season whom the season's crosswalk does not link (0 to 9 a season, as T1301.1 measured): most are found by the same box-score lines, a few through the crosswalk of another season (2016 to 2019, 1 or 2) or a name in the roster (Chameka Scott, who never got a line); "none" are those left with no ESPN id. In 2002 ESPN's lines are all zeros, so box-score matching cannot work there. The players with none are named in `wnba-agreement.md`.
- **One person on two ids,** kept as the sources have them (for the manager to decide): Angel Robinson is 202270 in the 2014 game logs and 202657 in 2017-18 (ESPN's 1001 for both, the roster's 202657 for all three seasons, the same birth date); Claudia Neves is 100386 and, in one 2002 game, 100797 (the rosters list both ids every season with the same birth date). Four of ESPN's players with no league id are league players under another spelling: LaQuanda Barksdale (the league's LaQuanda Quick), Val Whiting-Raymond (Val Whiting), Zuzi Klimesova (Zuzana Klimesova), all with 2002 lines of zeros only, and Tanae Davis-Cain (Tenae Davis-Cain, one 2009 line). Michelle Campbell is two people (different birth dates). `player` has one row per id and `player_ids` one league id per ESPN id.
- **Overtimes** equal the play by play's last period on every game where both are known: 5,992 of 5,992 from 2002, and the 72 known before it (`wnba-agreement.md`). Before 2002 they are known only where the game logs' team minutes are 200 or more (3 to 26 games a season), since the team minutes are 0 to 2003; the play by play, loaded in a later tier, has the rest.
- **Neutral sites** as ESPN marks them: the All-Star Games from 2013 to 2024, the 2021 Cup final in Phoenix, and five league games (two in 2016, one in each of 2024 to 2026). The 2020 season at IMG Academy is not marked, and is kept as published (no value is invented).

## Traps

- **A season label is the year it was played.** `…_2026` holds 2026-05-08 to 2026-10-29: the label is the season, with no final-year rule. Screens show `2026`, not `2025-26`. Draft files are labelled the draft's year (Caitlin Clark first in `draft_2024`), unlike the NBA's, which are labelled the season after.
- **The WNBA's game id is `10` + type + two-digit year + number:** `1022600001`. Type `2` is regular season (6,494 games), `4` playoffs (527), on every game of the WNBA's schedule; the schedule's `season_type` reads `regular-season` and `playoffs` only. Text with no leading zeros, ten characters. ESPN's ids are integers, `401857321`, and older ones date-based (`210716098`, the 2001 All-Star Game). The NBA's own ids start `00`, so the two leagues' ids never collide, but each league has its own file anyway (D36).
- **The WNBA's schedule has no All-Star Game, no Commissioner's Cup final and no preseason.** ESPN files the All-Star Game under regular season (`season_type` 2), with teams such as `EAST`, `WEST`, `Team WNBA`, `Team USA`, `Team Wilson`, `TEAM CLARK`, `TEAM COOP`: one a season in 2001–2007, 2009–2011, 2013–2015, 2017–2019 and 2021–2026 (22 games), none in the Olympic years 2008, 2012, 2016 and 2020. The 2004, 2010, 2021 and 2024 games were Team WNBA against Team USA. Filter them or league totals are wrong, as for the NBA.
- **The Commissioner's Cup final is in ESPN only, as regular season.** It does not count in the standings (the schedule's 2022 regular season is exactly 216 games, 12 × 36 / 2). ESPN marks it by `notes_headline` "WNBA Commissioner's Cup Championship" from 2022 (5 games); the 2021 final (Seattle 79, Connecticut 57, 2021-08-12 in Phoenix, ESPN 401353913, marked neutral) carries the group games' headline "WNBA Commissioner's Cup", so it shows only as ESPN's one game over the real count, and T1301.5 tells it by its date. **Its stats do not count toward the regular season in the league's own totals either** (measured in T1301.5): for all twelve finalists of 2021 to 2026, the dashboards' regular-season games and points equal the standings' games and the game logs' team rows summed (Las Vegas 2026: 44 games, 4,025 points in all three), and none of the finalists' 132 players of 2021 to 2025 has a dashboard game more than their game-log games. So a season total that adds the Cup final would differ from the league's. The crosswalk does not link it, and the game logs have no lines for it. So it is a season type of its own, like the NBA Cup final, with its box score from ESPN alone. The Cup's group games (`notes_headline` "WNBA Commissioner's Cup", 296 games from 2021) are ordinary regular-season games and count.
- **1997 to 2005 were played in two 20-minute halves,** quarters of 10 minutes from 2006. The play by play's `period` is 1 and 2 for the halves and 3 on for overtime in 1997–2005; ESPN's `format_regulation_periods` reads 2 then 4. A game is 40 minutes in every season, so per-minute rates are per 40 (team minutes 200 in regulation). Overtime is five minutes. "Fourth quarter" and "clutch" splits mean something else before 2006: a split by quarter has no quarters to split before 2006.
- **Overtime in the play by play:** `period > 2` in 1997–2005 (9 to 23 games a season), `period > 4` from 2006 (4 to 27). 2026 had a game to period 8 (four overtimes). ESPN's `status_period` against `format_regulation_periods` gives the same.
- **The game logs are both player and team rows.** `player_id` is null on the team rows: 230 to 704 a season, two a game. Summing all rows doubles a team's points. The team rows carry team minutes (200, 225 with one overtime) from 2005; before that they read 0 (1997 to 2003, but for 6 to 48 rows a season at 200) and 12 (2004), so they tell no overtime. The two games the schedule lacks (2007, 2009) have player rows only, no team rows.
- **The 2026 game logs stop at 202 games for players,** though their team rows cover all 352. `wnba_stats_player_boxscores_2026` holds all 352 games (8,539 rows, 7,008 with minutes, the rest listed without playing: `minutes` blank). Read 2026's player lines from it; it agrees with the game logs on every line both hold.
- **Minutes differ in type and grain:** whole numbers in the game logs (BIGINT, every season), `mm:ss` text in the 2026 player box scores (blank for did not play), a double in ESPN's (null for every 2002 line, and for 594 to 1,311 lines a season from 2003 to 2011 that have no did-not-play flag; `did_not_play` exists from 2012).
- **ESPN's 2002 player box scores are all zeros:** points, rebounds, assists and field goals are 0 on all 5,959 lines (19 % of lines "agree" on points only where the player scored nothing), and minutes are null. Players summed never reach the score. Names and starters are there. ESPN's team box scores start in 2003, and its 2003 player box scores cover 195 of 256 games.
- **ESPN has no box scores before 2002, and its 1997–2001 schedule rows read as unfinished:** `status_type_completed` is false on 964 of 1,017 rows (`STATUS_IN_PROGRESS` or `STATUS_TBD`), some with no score. Read whether a game was played from the WNBA's schedule.
- **The WNBA's schedule lacks one game in 2007 and one in 2009,** which the game logs hold (242 games against 241). So two teams a season show 33 games against 34, and their records miss a game: 2007 Connecticut and New York, 2009 New York and Los Angeles. Build `game` from the schedule and the game logs together.
- **A 2018 game was forfeited:** Las Vegas at Washington, scheduled 2018-08-03, is in the schedule at 0-0 with no box score. The standings count it (Washington 22-12, Las Vegas 14-20), so a record built from box scores misses it, as Basketball-Reference's does not.
- **Franchises: the WNBA keeps one team id across a move, ESPN does not always.** The WNBA's 1611661319 is Utah Starzz (1997–2002), San Antonio Silver Stars and Stars (2003–2017) and Las Vegas Aces (2018–); 1611661321 is Detroit Shock (1998–2009), Tulsa Shock (2010–2015) and Dallas Wings (2016–); 1611661323 is Orlando Miracle (1999–2002) and Connecticut Sun (2003–). ESPN splits Utah (15) from San Antonio and Las Vegas (17), and Orlando (10) from Connecticut (18), but keeps Detroit, Tulsa and Dallas on 3, abbreviated `TUL` even for Detroit's rows. Folded: Charlotte Sting (1997–2006), Cleveland Rockers (1997–2003), Houston Comets (1997–2008), Miami Sol (2000–2002), Portland Fire (2000–2002), Sacramento Monarchs (1997–2009). Joined: Washington and Detroit 1998, Minnesota and Orlando 1999, Indiana, Seattle, Miami and Portland 2000, Chicago 2006, Atlanta 2008, Golden State 2025, Toronto and Portland 2026.
- **The 2026 Portland Fire share an id with the 2000–2002 Portland Fire:** the WNBA's 1611661327 for both, and ESPN's 132052 for both (ESPN also has 12 for 2002). They are different franchises 23 years apart; a franchise view must not join them by id. The alias table gives the id two spans (2000-2002, 2026), which is how T1301.5 tells them apart: the 2026 club's `team_id` is `-1611661327`. ESPN's own 2002 Portland home games carry ESPN team id 12 (the crosswalk links them).
- **Team codes change with the source and the era.** The WNBA's: `PHO` then `PHX`, `UTA` then `SAN` then `LVA`, `DET`, `TUL`, `DAL`, `ORL`, `CON`, `POR` then `PDX`, `LAS`, `NYL`, `GSV`. ESPN's: `NYL` then `NY`, `LOS` then `LA`, `PHO` then `PHX`, `WAS` then `WSH`, `CT` then `CONN` then `CON`, `SAS` then `SA` then `LV`, `UTH`, `GS`. `wnba_team_aliases` (68 rows) lists them.
- **Conferences, no divisions, in every season.** `wnba_groups`: East and West from 1997 ("conferences only (no divisions) in every season", its own note). The standings' `division*` columns are empty. Its note also says conferences have not seeded the playoffs since 2016.
- **Player ids.** The WNBA's person ids run from 100002 to 1643706 (1,211 players with a line); ESPN's are integers. `wnba_player_crosswalk` starts in 2002 and matches by name (`exact_name`, `fuzzy_jw`, `unmatched`): it misses 0 to 9 of the WNBA's players a season (2002: 198 of 207; 2020–2025: all or all but two). 180 players played only before 2002, when there is no crosswalk and no ESPN line, so they are keyed by the WNBA's id alone. The crosswalk puts ESPN's 1001 on two league ids (Angel Robinson: 202270 in 2014, 202657 in 2017-18), and the game logs give Claudia Neves two ids in 2002 (100386, and 100797 for one game): the league's own data has the same person under two ids twice. `wnba_player_aliases` (3,512 rows) adds Fox and Yahoo ids through the same crosswalk.
- **Plus-minus starts in 2008** in the game logs: null on every player line of 1997–2007 but 0 to 62 a season.
- **Shot locations before 2011 are partly missing:** 20 to 30 % of the WNBA's shots of 1997–2010 sit at `x_legacy = 0, y_legacy = 0` (4,224 of 14,080 in 1997), none from 2011. Distance is printed for all of them. Zones and charts read from 2011, or leave the (0, 0) rows out with the count stated.
- **Possessions are the dataset's,** worked out from the WNBA's play by play, as for the NBA. Their points equal the team's on 97 % of 1997's team-games and on all but one from 2001.
- **The dashboards publish the regular season from 1997 and the playoffs from 2001;** the dashboard standings have the regular season only. Per mode is `Totals` everywhere. The team dashboards have 588 rows in all, the player dashboards 7,125, except `player_stats_defense`, which is short in eight seasons (83 of 265 players in 2006, 80 of 226 in 2012).
- **The dashboards against summed game logs differ more in some seasons:** points equal for 72–95 % of players in 1997–1999, 2002, 2006, 2007 and 2009, against 97.6–100 % in the rest. Not explained in this part; T1301.6 checks the season tables against both.
- **`nba_fantasy_pts` and `wnba_fantasy_pts`** both appear in the player dashboards: the NBA's name is a leftover of the shared schema. Fantasy columns are ordinary metrics (D4).
- **`metric_curves` has the NBA's empty football columns** (`down`, `epa_per_att`), as the NBA's file does.
- **Coaches:** no 2019 file; head coaches only until 2024 (5 to 23 rows a season, including interim changes), and 5 rows in 2006 and 2024; assistants and trainers appear in 2025 (68 rows) and 2026 (89).
- **The WNBA's game rosters are sparse:** 1 to 994 rows a season, not a list of who dressed. ESPN's game rosters (2002–2026) are.
- **Officials:** the WNBA's file lists about three officials for every game from 2004 (3.0 to 3.1 a game); ESPN's has 2 games in 2003 and a crew for 131 to 184 games a season in 2004–2012, every game from 2013.
- **ESPN's injuries are daily snapshots of the current state,** from 2026-09-08 to 2026-11-16 (69 days, 94 players). There is no history before, and no official injury report.
- **Column types change between seasons** in a few places: ESPN's `game_date_time` (timestamp with time zone, plain timestamp in 2023–2025), `athlete_jersey` (null type in 2002, text after), `venue_capacity` (double or integer by season), the coaches' `sort_sequence` (integer, then null type in 2025–2026), the rosters' `how_acquired` (null type in 13 seasons). ESPN's points by kind (`fast_break_points`, `points_in_paint`, `turnover_points`) exist only from 2023, and `lead_changes` only in 2026. As for the NBA, read files with `union_by_name` and cast in the loader.
- **Empty columns:** ESPN's draft has 22 columns null on every row (college, team, position); its game rosters' `home_away`; the WNBA's 2026 standings' `division*`, `clinched_*` and `playoff_seeding`; the crosswalk's `fox_jersey`. Read as NULL, never as 0 (data policy 4).

## Qualifying minimums

D33's minimums are the NBA's. The WNBA's own rule was not read: WNBA.com's page "Qualifications for League Leaders" (`https://www.wnba.com/qualifications-for-league-wnba-com-stats`) refused a plain client on 2026-11-17 (HTTP 403 to `curl -A metis-research`), and stats.wnba.com's help page was not requested (D7). A web search's summary of those two pages gave figures that disagree with each other (31 games or 70 % of a 44-game season; 110 or 100 field goals, 55 or 50 free throws, 30 or 25 threes), so neither is written down as the rule.

[Basketball-Reference's "WNBA Rate Statistic Requirements"](https://www.basketball-reference.com/about/wnba_rate_stat_req.html) answered a plain client (HTTP 200, 2026-11-17). It states its own requirements, not the league's and not scaled to the season: per-game leaders need 20 games or a total (400 points, 200 rebounds, 100 assists, 35 steals, 35 blocks, 500 minutes); FG% 85 made, FT% 35 made, 3P% 20 made, 2P% 65 made, TS% 125 true-shooting attempts, eFG% 85 made; the rate statistics (PER, rebound, assist, steal, block, turnover and usage percentages, DRtg, WS/48) 375 minutes, ORtg 125 possessions; rookies half of each.

So no WNBA rule from the league is written down. The conservative answer, until the owner reads the league's page as for T1101 and T1204: the WNBA's leaderboards keep the NBA's rule scaled to the games in scope (a 44-game season is 54 % of 82), which the engine already does, and a decision names the WNBA's rule when it is read.

## What the WNBA data can support

One row per area of the app as it is on `main` (0806ba5). "Build" means the data holds it from the season named; "partly" means some of it; "not available" gives the reason.

| Area (Stage)                                        | WNBA                           | Reason, from the measurements above                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Box-score metrics, game and season tables (5)       | Build, 1997–2026               | Game logs every player-game 1997–2025 and every team-game 1997–2026, the 2026 player box scores, ESPN from 2003. Per 40 minutes. Plus-minus from 2008; starters from ESPN, 2002 on; minutes whole numbers                                                                                           |
| Published season stats and the estimates (5, 7)     | Build, 1997–2026               | League dashboards: base, advanced (PIE, usage, ratings, pace per 40), misc, scoring, usage, defense; teams also four factors and opponent. Playoffs from 2001                                                                                                                                       |
| Dashboards: Players, Teams, Games (6)               | Build                          | Rosters and bio 1997–2026, draft 1997–2026, coaches (head coaches to 2024, no 2019), a game's box score from the game logs or ESPN                                                                                                                                                                  |
| Tracking, hustle, play types, matchups, combine (7) | Not available                  | No WNBA release publishes any of them                                                                                                                                                                                                                                                               |
| Lineup tables, metric curves, rolling windows (7)   | Build, 1997–2026               | Dashboards' lineups (playoffs from 2001), `metric_curves`, `rolling_windows`                                                                                                                                                                                                                        |
| The impact file (7)                                 | Build                          | `wnba_player_impact`: RAPM, adjusted RAPM, SPM, BPM, WAR 1997–2026, BOBAN 1998–2026, both season types; the dataset's own calculations, labelled so, as for the NBA                                                                                                                                 |
| Explore (8)                                         | Build                          | Reads the same catalogue                                                                                                                                                                                                                                                                            |
| Shots (9)                                           | Build, partly before 2011      | The WNBA's shots 1997–2026, ESPN's 2002–2026; locations complete from 2011, so zones and charts from 2011 and earlier seasons with the missing count stated                                                                                                                                         |
| Plays and splits (9)                                | Build, 1997–2026               | The WNBA's play by play 1997–2026, ESPN's 2002–2026. Splits by quarter from 2006 (halves before); clutch reads the last five minutes of the second half before 2006 and of the fourth quarter after                                                                                                 |
| On court and lineups (9)                            | Build, 1997–2026               | Possessions and game lineups 1997–2026 (the dataset's; points equal the score on 97–100 %)                                                                                                                                                                                                          |
| Play-derived stats (9)                              | Build, needs its own spellings | The WNBA's play by play has the NBA's columns (`action_type`, `sub_type`, `is_*` flags); its descriptions were not read for this part, so the parser's spellings need a check per league                                                                                                            |
| Ratings: Elo, SRS (10)                              | Build, refit Elo               | SRS reads margins and the schedule as is. Elo needs its constants fitted for the WNBA: K, home advantage and the carry-over between seasons, on 22- to 44-game seasons                                                                                                                              |
| The playoff field and season forecast (10)          | Build, per-season formats      | Needs the WNBA's format by season: 4 teams in 1997, conference brackets from 1998, eight teams seeded 1–8 by record from 2016 (single-elimination first two rounds 2016–2021, best-of-three first round from 2022). Written from the schedule's round names; the rules per season need writing down |
| Composites: PER, Win Shares, BPM (10)               | Build; BPM refit or the file's | PER and Win Shares work from league totals per season, with 40 minutes where the NBA has 48 (WS per 40). Metis's BPM uses the NBA's BPM 2.0 coefficients: either refit them on the WNBA or read the impact file's WNBA BPM in its place                                                             |
| Adjusted ratings (10)                               | Build, refit the penalty       | Possessions with the ten players are there from 1997. The ridge penalty needs fitting on smaller seasons (1.07 million possessions over 30 seasons)                                                                                                                                                 |
| Stability (10)                                      | Build, measured again          | Seasons of 22 to 44 games and about 150 players: fewer pairs; measured on the WNBA's own                                                                                                                                                                                                            |
| Qualifying minimums (12)                            | Partly                         | The NBA's rule scaled to the games in scope, until the WNBA's rule is read (above)                                                                                                                                                                                                                  |
| Availability and injuries (7, T1206)                | Not available                  | No official injury report for the WNBA. ESPN's snapshots start 2026-09-08 and give the current state only; games out cannot be counted for any past season                                                                                                                                          |
| Officials (9)                                       | Build, 2004–2026               | The WNBA's file, a crew for every game from 2004; ESPN's from 2013 in full                                                                                                                                                                                                                          |
| Standings (6)                                       | Build, 1997–2026               | Dashboard standings match Basketball-Reference on every team-season. Conferences, no divisions. Playoff seeding by conference to 2015, league-wide from 2016                                                                                                                                        |
| Glossary and catalogue                              | Build                          | Per-40 rates; each metric's first season per league                                                                                                                                                                                                                                                 |
| The source switch (T1107)                           | Build                          | Per tag, as now. The WNBA's tags that cannot be left out: both schedules, the game logs, ESPN's player box scores, `wnba_crosswalk` and `wnba_groups` (the game, team and player keys)                                                                                                              |
| The installer's data folder (T1102)                 | Build                          | One data folder, a stats file per league (D36); an existing `stats.duckdb` is renamed for the NBA                                                                                                                                                                                                   |
