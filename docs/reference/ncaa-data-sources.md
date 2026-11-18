# NCAA Division I data sources: what was measured

Measured 2026-11-18 (Plan T1302.1) against the men's and women's college basketball releases of [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data). The asset list was read whole through the GitHub API. 1,072 of the 1,244 Parquet files were downloaded (1,377 MB): every file outside the play, shot, possession, lineup and stint releases, and a first, middle and last season of each of those. The other 172 were read for their row counts and schemas from their Parquet footers over HTTP range requests, and their game ids were read the same way, a column at a time, without downloading the files. Everything was read with DuckDB 1.5.6 (`@duckdb/node-api`). The 2025-26 season (`2026`) is complete; 2026-27 (`2027`) had started on 2026-11-01. Re-measure before relying on these numbers much later. The [WNBA's document](wnba-data-sources.md) is the model, and the owner's research, [ncaa-d1-basketball-statistics.md](ncaa-d1-basketball-statistics.md), is the catalogue of statistics this document checks against the data.

The raw files are kept outside the repository, in `~/.cache/metis-dev/ncaa-raw` (one folder per release). Beside them are the asset list (`~/.cache/metis-dev/bb-assets.tsv`, every basketball asset with its size), the release list (`sdv-releases.tsv`), every Parquet file's rows and columns (`ncaa-files.tsv`), the column survey (`ncaa-schema.json`), and the NCAA pages and PDFs read with a plain client (`ncaa-probe/`, the PDFs as text beside them).

"M" is the men (NCAAM), "W" the women (NCAAW). Seasons are labelled by their final year, as in the data (`2026` = 2025-26).

## The source

Three families, each with a men's and a women's release:

| Family         | Releases                                                                                                                                                                                                                                                   | Upstream                                                                                                | Seasons (M / W)       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------- |
| ESPN           | `espn_mens_college_basketball_*`, `espn_womens_college_basketball_*`: schedules, player and team box scores, season stats, standings, play by play, shots, game rosters, rosters, player bios (`player_core`), officials (12 releases a side)              | ESPN's men's and women's college basketball APIs ("Upstream source: ESPN men's-college-basketball API") | 2002–2027 / 2001–2027 |
| stats.ncaa.org | `ncaa_mbb_*`, `ncaa_wbb_*`: schedule, team ids, rosters, team rosters, player and team box scores, play by play, possessions, lineups, matchup stints, shots, RAPM, RAPM within team (13 releases a side)                                                  | "stats.ncaa.org official box scores and play-by-play", the NCAA's own statistics site                   | 2010–2027 / 2010–2027 |
| The dataset's  | `mbb_crosswalk`, `wbb_crosswalk` (ids across ESPN, stats.ncaa.org, Fox, Yahoo, KenPom and Torvik), `mbb_groups`, `wbb_groups` (conferences by season), `mbb_ratings`, `wbb_ratings` (team ratings), `mbb_player_value`, `wbb_player_value` (box-score BPM) | ESPN and NCAA inputs, "scored through the hoopR model stack" (the women's: wehoop)                      | 2002–2027 / 2002–2027 |

**The stats.ncaa.org family is the finding that changes the plan.** The research expected hoopR's and wehoop's ESPN releases. The releases also hold the NCAA's own box scores and play by play for every Division I game from 2010-11, with derived possessions, lineups and stints, and the dataset's RAPM. For the women it is the only complete source of player lines before 2016-17 (see "Coverage"). Its release notes say "stats.ncaa.org bans aggressive clients, so capture runs from the SportsDataverse droplet under a rate budget". Metis reads only the release files: it makes no request to stats.ncaa.org, ncaa.com or ESPN, as D7 has it for the NBA's stats site, and nothing in the coverage, repeats or agreement sections came from them. The pages read for the check are listed under "What the check can compare against".

### Producers and licences

Read through the GitHub API on 2026-11-18.

| Repository                                                                                                                                                                                    | Builds                               | Licence                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data)                                                                                                               | The release store                    | `LICENSE` is MIT (the API's `spdx_id`), as for the NBA and the WNBA                              |
| [hoopR-mbb-data](https://github.com/sportsdataverse/hoopR-mbb-data), [wehoop-wbb-data](https://github.com/sportsdataverse/wehoop-wbb-data)                                                    | The ESPN releases                    | `LICENSE.md`: CC BY 4.0 for "data, code, and documentation"; `DESCRIPTION`: `License: CC BY 4.0` |
| [ncaa-mbb-hoops-data](https://github.com/sportsdataverse/ncaa-mbb-hoops-data), [ncaa-wbb-hoops-data](https://github.com/sportsdataverse/ncaa-wbb-hoops-data) (and their `-raw` capture repos) | The stats.ncaa.org releases          | **None found**: the repositories hold a `README.md` and no licence file                          |
| [hoopR](https://github.com/sportsdataverse/hoopR), [wehoop](https://github.com/sportsdataverse/wehoop)                                                                                        | The R packages, and the model stacks | The API reports `NOASSERTION`; not read further                                                  |

**`data-rights.md`** needs an NCAA entry before the league ships (T1302.2 below). Its facts: the ESPN releases are under CC BY 4.0, as the NBA's and the WNBA's producers are. The stats.ncaa.org releases state no licence. Their upstream, stats.ncaa.org, refuses plain clients (HTTP 403, below), and the producer captures it under a rate budget, which is the same position as the NBA's `nba_stats_*` releases from stats.nba.com. The NCAA's and ESPN's own terms were not read for this part. Whether a release with no licence may be loaded is a question for the owner; it is asked in D40.

## Size

The whole asset list, read through the GitHub API: **58 basketball releases (29 a side), 1,244 Parquet files, 5,677 MB.** The same data is also published as CSV (748 files, 33,209 MB), RDS (1,097 files, 6,749 MB) and gzipped CSV (444 files, 4,841 MB), which Metis ignores, and 230 small JSON and text files (the model cards, `timestamp` and `package_function` sidecars).

| Family                              | M files | M MB        | W files | W MB        |
| ----------------------------------- | ------- | ----------- | ------- | ----------- |
| ESPN                                | 277     | 1,241.5     | 252     | 737.9       |
| stats.ncaa.org                      | 222     | 1,885.9     | 222     | 1,786.9     |
| The dataset's (ids, groups, models) | 149     | 15.9        | 122     | 8.8         |
| **All**                             | **648** | **3,143.3** | **596** | **2,533.6** |

Each side is twice the NBA's 1,554 MB, and the men are ten times the WNBA's 296 MB. In tiers, as D21 has them:

| Tier         | Releases                                                                                                                                                                                     | M MB    | W MB    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| Core         | ESPN schedules, box scores, season stats, standings, rosters, player bios, game rosters, officials; stats.ncaa.org schedule, team ids, rosters, team rosters, box scores; crosswalks, groups | 434.4   | 310.0   |
| Published    | Ratings, player value, RAPM, RAPM within team                                                                                                                                                | 14.1    | 10.4    |
| Events       | ESPN shots; stats.ncaa.org shots, possessions, lineups, matchup stints                                                                                                                       | 820.9   | 708.8   |
| Play by play | ESPN; stats.ncaa.org                                                                                                                                                                         | 1,874.0 | 1,504.6 |

The current season's files (`2027`) are 9 % of the men's ESPN files by size and grow daily from November to April. The largest single files are stats.ncaa.org's play by play, 56 to 69 MB a season a side.

## Tables

Seasons are the file-name labels, which are the season's final year in both families (`season` in the data agrees: "season = the ENDING year of the season"). "Repeats" is D23's question. Rows are summed over every season from the Parquet footers.

| Release (M; W the same name with `womens` / `wbb`) | File name                                                                  | Grain                                                                     | Seasons M                            | Seasons W                            | Files M / W | MB M / W        | Rows M / W              | Tier      | Repeats                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------ | ----------- | --------------- | ----------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `espn_mens_college_basketball_schedules`           | `mbb_schedule_<s>`                                                         | Game, 76–88 columns (W: 76–97); **twice** a game from 2003                | 2002–2027                            | 2001–2027                            | 26 / 27     | 16.5 / 14.8     | 147,805 / 143,612       | Core      | No; rows repeat within the file (see "Traps")                                                 |
|                                                    | `mbb_schedule_master`                                                      | Game, every season, 88 columns                                            | all                                  | all                                  | 1 / 1       | 17.5 / 15.2     | 136,915 / 129,120       | Core      | **No**: 11,032 / 14,498 season games missing, 142 / 6 only here                               |
|                                                    | `mbb_games_in_data_repo`                                                   | Game, with flags for the files that hold it                               | all                                  | all                                  | 1 / 1       | 14.1 / 9.7      | 96,084 / 55,105         | Core      | Not measured                                                                                  |
| `…_player_boxscores`                               | `player_box_<s>`                                                           | Player-game, 54–55 columns                                                | 2003–2027                            | 2004–2027                            | 25 / 24     | 66.0 / 31.9     | 3,706,892 / 1,800,718   | Core      | No                                                                                            |
| `…_team_boxscores`                                 | `team_box_<s>`                                                             | Team-game, 53–59 columns                                                  | 2003–2027                            | 2004–2027                            | 25 / 24     | 15.0 / 8.1      | 252,730 / 137,884       | Core      | No                                                                                            |
| `…_player_season_stats`                            | `player_season_stats_<s>`                                                  | Player-season-stat, long                                                  | 2003–2027                            | 2010–2027                            | 25 / 18     | 22.2 / 10.2     | 7,130,025 / 3,779,445   | Core      | No                                                                                            |
| `…_team_season_stats`                              | `team_season_stats_<s>`                                                    | Team-season-stat, long                                                    | 2003–2027                            | 2010–2027                            | 25 / 18     | 4.5 / 1.8       | 681,795 / 337,095       | Core      | No                                                                                            |
| `…_standings`                                      | `standings_<s>`                                                            | Team-season-stat, long, by conference                                     | 2003–2027                            | 2001–2027                            | 25 / 27     | 3.3 / 2.5       | 711,452 / 700,896       | Core      | No                                                                                            |
| `…_player_core`                                    | `player_core_<s>`                                                          | Player-season, bio                                                        | 2003–2027                            | 2004–2027                            | 25 / 24     | 15.8 / 7.9      | 211,740 / 116,811       | Core      | No                                                                                            |
| `…_rosters`                                        | `rosters_<s>`                                                              | Player-team                                                               | 2025–2027                            | 2026–2027                            | 3 / 2       | 3.3 / 1.5       | 38,106 / 19,729         | Core      | No                                                                                            |
| `…_game_rosters`                                   | `game_rosters_<s>`                                                         | Player-game, who dressed                                                  | 2002–2027                            | 2004–2027                            | 26 / 24     | 54.3 / 24.1     | 4,150,773 / 2,028,968   | Core      | No                                                                                            |
| `…_officials`                                      | `officials_<s>`                                                            | Official-game (M 7 columns, W 11)                                         | 2003–2027, no 2010                   | 2014–2027                            | 24 / 14     | 2.2 / 1.4       | 364,421 / 138,528       | Core      | No                                                                                            |
| `…_shots`                                          | `shots_<s>`                                                                | Shot, 19–20 columns                                                       | 2003, 2006–2027                      | 2004–2027                            | 23 / 24     | 146.0 / 74.2    | 14,853,695 / 8,478,246  | Events    | No                                                                                            |
| `…_pbp`                                            | `play_by_play_<s>`                                                         | Play, 62–64 columns (W 64–74)                                             | 2003, 2006–2027                      | 2004–2027                            | 23 / 24     | 860.7 / 534.5   | 32,585,547 / 19,703,620 | Plays     | No                                                                                            |
| `ncaa_mbb_schedule`                                | `ncaa_mbb_schedule_<s>`                                                    | Game, 7 columns (names, date, score)                                      | 2010–2027                            | 2010–2027                            | 18 / 18     | 0.8 / 0.8       | 100,875 / 94,816        | Core      | No                                                                                            |
| `ncaa_mbb_team_ids`                                | `ncaa_mbb_team_ids_<s>`                                                    | Team-season: name, conference, id                                         | 2010–2027                            | 2010–2027                            | 18 / 18     | 0.1 / 0.1       | 6,371 / 6,335           | Core      | No                                                                                            |
| `ncaa_mbb_rosters`                                 | `ncaa_mbb_rosters_<s>`                                                     | Player-team-season: name, games (4 columns)                               | 2010–2027                            | 2010–2027                            | 18 / 18     | 1.3 / 1.1       | 157,828 / 124,512       | Core      | Not measured against the team rosters                                                         |
| `ncaa_mbb_team_rosters`                            | `ncaa_mbb_team_rosters_<s>`                                                | Player-team-season, bio, 16 columns                                       | 2010–2027                            | 2010–2027                            | 18 / 18     | 3.4 / 3.2       | 97,807 / 88,511         | Core      | No                                                                                            |
| `ncaa_mbb_team_box`                                | `ncaa_mbb_team_box_<s>`                                                    | Team-game with the opponent's side, 81 columns                            | 2010–2027                            | 2010–2027                            | 18 / 18     | 22.7 / 21.5     | 201,750 / 189,632       | Core      | No (its points are its players' summed, 100 %; it adds possessions and the opponent's counts) |
| `ncaa_mbb_player_box`                              | `ncaa_mbb_player_box_<s>`                                                  | Player-game, 125 columns (rim, mid, putback, transition, assisted splits) | 2010–2027                            | 2010–2027                            | 18 / 18     | 162.9 / 149.3   | 1,963,616 / 1,833,977   | Core      | No                                                                                            |
| `ncaa_mbb_shots`                                   | `ncaa_mbb_shots_<s>`                                                       | Shot with location, 19 columns                                            | 2019–2027                            | 2019–2027                            | 9 / 9       | 62.1 / 58.7     | 4,990,841 / 4,706,337   | Events    | No                                                                                            |
| `ncaa_mbb_possessions`                             | `ncaa_mbb_possessions_<s>`                                                 | Possession with the ten players, 56 columns                               | 2010–2027                            | 2010–2027                            | 18 / 18     | 225.2 / 214.1   | 13,201,017 / 12,780,780 | Events    | No                                                                                            |
| `ncaa_mbb_lineups`                                 | `ncaa_mbb_lineups_<s>`                                                     | Five-player stint with its counts, 77 columns                             | 2010–2027                            | 2010–2027                            | 18 / 18     | 239.1 / 220.9   | 4,325,677 / 3,981,367   | Events    | No                                                                                            |
| `ncaa_mbb_matchup_stints`                          | `ncaa_mbb_matchup_stints_<s>`                                              | Ten-player stint, 33 columns                                              | 2010–2027                            | 2010–2027                            | 18 / 18     | 148.5 / 140.9   | 3,131,710 / 2,988,915   | Events    | No                                                                                            |
| `ncaa_mbb_pbp`                                     | `ncaa_mbb_pbp_<s>`                                                         | Play with the ten players, 87 columns                                     | 2010–2027                            | 2010–2027                            | 18 / 18     | 1,013.3 / 970.1 | 46,673,534 / 44,696,202 | Plays     | No                                                                                            |
| `ncaa_mbb_rapm`, `ncaa_mbb_rapm_within_team`       | `ncaa_mbb_rapm_<s>`, `…_within_team_<s>`                                   | Player-season, 11 columns                                                 | 2011–2026; 2010–2026                 | the same                             | 33 / 33     | 6.6 / 6.4       | 143,399 / 137,508       | Published | No                                                                                            |
| `mbb_crosswalk`                                    | `mbb_{player,team,schedule}_crosswalk_<s>`, `ncaa_espn_*`                  | Ids across sources                                                        | 2002–2027 (players 2004, games 2008) | 2002–2027 (players 2007, games 2021) | 73 / 57     | 7.2 / 3.8       | 269,356 / 157,248       | Core      | No (`ncaa_espn_schools` and `…_school_seasons` are the same in both leagues' releases)        |
| `mbb_groups`                                       | `mbb_groups`, `mbb_group_seasons`, `mbb_team_group_seasons[_<s>]`, aliases | Conferences, divisions, team and player aliases                           | 2002–2027                            | 2002–2027                            | 32 / 32     | 1.3 / 1.1       | 133,497 / 106,397       | Core      | **`mbb_team_group_seasons` repeats its 26 season files**, row for row (9,051 / 8,932)         |
| `mbb_ratings`                                      | `mbb_ratings_<s>`                                                          | Team-season, adjusted efficiency, 16 columns                              | 2006–2027                            | 2009–2027                            | 22 / 19     | 1.3 / 0.8       | 13,623 / 8,238          | Published | No                                                                                            |
| `mbb_player_value`                                 | `mbb_player_value_<s>`                                                     | Player-season, box-score BPM, 9 columns                                   | 2006–2027                            | 2014–2027                            | 22 / 14     | 6.2 / 3.2       | 167,451 / 83,290        | Published | No                                                                                            |

**Not published for either side**, though the NBA has them: player tracking, hustle, play types, matchups by player, the official injury report, a draft or combine, coaches, and the league's own season dashboards. There is no NET, no poll and no committee seed in any release.

## Coverage

### By kind

| Kind                         | Men                                                                                                                                        | Women                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule                     | ESPN 2002–2027; stats.ncaa.org 2010–2027                                                                                                   | ESPN 2001–2027 (2025 short by about 300 games, see "Traps"); stats.ncaa.org 2010–2027                                                       |
| Player box scores            | ESPN 83–99 % of games 2005–2013, 99–100 % from 2014; stats.ncaa.org every game 2011–2027                                                   | **ESPN 1–9 % of games 2004–2007, 22–33 % 2008–2016**, 93–95 % 2017–2019, 99.6–100 % from 2020; stats.ncaa.org every game 2011–2027          |
| Team box scores              | ESPN 2005–2027 (as the player lines); stats.ncaa.org 2011–2027                                                                             | ESPN 2004–2027 (as the player lines); stats.ncaa.org 2011–2027                                                                              |
| Season stats (published)     | ESPN, long format, 2003–2027                                                                                                               | ESPN, long format, 2010–2027 (2,217 to 4,079 players a season to 2016, against stats.ncaa.org's 4,229 to 4,301)                             |
| Standings                    | ESPN 2003–2027                                                                                                                             | ESPN 2001–2027                                                                                                                              |
| Play by play                 | ESPN 21–67 % of games 2006–2013, 85–99.6 % from 2014; stats.ncaa.org every game 2011–2027, 98.5–100 % of plays with the ten players        | ESPN 1–34 % of games 2004–2019, 91–99.7 % from 2020; stats.ncaa.org every game 2011–2027, 98.5–100 % with the ten players                   |
| Shots with a location        | ESPN 6–26 % of shots 2014–2025, every shot from 2026; stats.ncaa.org 2019–2027, every shot (2019: 2,216 games, 2020: 4,881, then 97–100 %) | ESPN 4–10 % in 2014–2016 and 2021–2024, none 2017–2020, 24 % in 2025, every shot from 2026; stats.ncaa.org as the men's (2019: 1,994 games) |
| Possessions, lineups, stints | stats.ncaa.org 2011–2027 (the dataset's, from its play by play)                                                                            | The same                                                                                                                                    |
| Rosters, bio                 | ESPN player bios 2003–2027, rosters 2025–2027; stats.ncaa.org team rosters 2010–2027 (height, class, hometown)                             | ESPN player bios 2004–2027, rosters 2026–2027; stats.ncaa.org as the men's                                                                  |
| Officials                    | ESPN 2003–2027, no 2010                                                                                                                    | ESPN 2014–2027                                                                                                                              |
| Conferences                  | Groups 2002–2027, ESPN team ids                                                                                                            | Groups 2002–2027 (none for 2001)                                                                                                            |
| Models                       | Team ratings 2006–2027; box-score BPM 2006–2027; RAPM 2011–2026                                                                            | Team ratings 2009–2027; box-score BPM 2014–2027; RAPM 2011–2026                                                                             |
| NET, quadrants, polls, seeds | Not published                                                                                                                              | Not published                                                                                                                               |

So **the men's box scores have two sources from 2011, and ESPN alone for 2005–2010** (2003 and 2004 hold 1 and 11 games). **The women's box scores are complete from 2011, from stats.ncaa.org alone until 2016**, and ESPN's are a sample before 2017, sparser still before 2008. Before 2011 the women have schedules and scores for every game and lines for a fifth of them or fewer.

### By season

ESPN's games are its completed games of season types 2 and 3 (regular season and postseason), each counted once. "Box" is the share with a player box score that is not all zeros, "PBP" the share with play by play. stats.ncaa.org's are the games in its team box score.

| Season | M games (ESPN) | M box % | M PBP % | M games (stats.ncaa.org) | W games (ESPN) | W box % | W PBP % | W games (stats.ncaa.org) |
| ------ | -------------- | ------- | ------- | ------------------------ | -------------- | ------- | ------- | ------------------------ |
| 2001   | –              | –       | –       | –                        | 4,642          | 0       | 0       | –                        |
| 2002   | 4,819          | 0       | 0       | –                        | 4,040          | 0       | 0       | –                        |
| 2003   | 4,990          | 0.02    | 0.4     | –                        | 4,773          | 0       | 0       | –                        |
| 2004   | 4,983          | 0.2     | 0       | –                        | 4,780          | 1.3     | 1.3     | –                        |
| 2005   | 5,048          | 82.6    | 0       | –                        | 4,856          | 2.4     | 2.4     | –                        |
| 2006   | 5,172          | 90.9    | 21.3    | –                        | 4,873          | 4.7     | 5.1     | –                        |
| 2007   | 5,480          | 94.8    | 29.6    | –                        | 5,239          | 8.5     | 9.0     | –                        |
| 2008   | 5,590          | 96.4    | 49.9    | –                        | 5,341          | 32.7    | 33.9    | –                        |
| 2009   | 5,726          | 95.9    | 63.7    | –                        | 5,430          | 23.3    | 23.7    | –                        |
| 2010   | 5,761          | 96.7    | 66.6    | 5,709 (broken)           | 5,450          | 23.4    | 17.0    | 5,398 (broken)           |
| 2011   | 5,771          | 96.3    | 60.1    | 5,735                    | 5,461          | 22.4    | 13.0    | 5,440                    |
| 2012   | 5,776          | 97.0    | 59.7    | 5,763                    | 5,463          | 26.4    | 26.8    | 5,434                    |
| 2013   | 5,817          | 98.6    | 67.0    | 5,809                    | 5,484          | 33.2    | 33.9    | 5,473                    |
| 2014   | 5,948          | 99.7    | 85.5    | 5,946                    | 5,588          | 30.8    | 26.9    | 5,586                    |
| 2015   | 5,932          | 100     | 89.0    | 5,927                    | 5,603          | 28.4    | 26.0    | 5,592                    |
| 2016   | 5,893          | 99.8    | 91.5    | 5,948                    | 5,619          | 31.9    | 29.7    | 5,610                    |
| 2017   | 5,960          | 99.3    | 91.9    | 5,970                    | 5,622          | 93.2    | 28.1    | 5,620                    |
| 2018   | 6,003          | 100     | 94.0    | 5,999                    | 5,630          | 93.7    | 27.7    | 5,627                    |
| 2019   | 6,049          | 100     | 90.5    | 6,040                    | 5,658          | 94.7    | 27.3    | 5,647                    |
| 2020   | 5,767          | 100     | 93.5    | 5,782                    | 5,434          | 99.9    | 91.0    | 5,430                    |
| 2021   | 4,285          | 100     | 93.7    | 4,269                    | 3,823          | 100     | 93.6    | 3,815                    |
| 2022   | 5,976          | 99.8    | 97.6    | 5,970                    | 5,534          | 99.6    | 96.6    | 5,508                    |
| 2023   | 6,228          | 99.9    | 98.2    | 6,221                    | 5,828          | 99.8    | 97.8    | 5,820                    |
| 2024   | 6,243          | 100     | 98.5    | 6,243                    | 5,908          | 99.8    | 97.8    | 5,897                    |
| 2025   | 6,292          | 100     | 97.5    | 6,293                    | 5,634          | 99.9    | 97.1    | 5,960                    |
| 2026   | 6,300          | 100     | 99.6    | 6,297                    | 6,030          | 100     | 99.7    | 6,019                    |
| 2027   | 961            | 100     | 99.5    | 954                      | 940            | 100     | 99.5    | 940                      |

2027 is the season to 2026-11-17. 2020 has no postseason (cancelled), and 2021 is short (4,285 and 3,823 games).

### Teams

Division I teams per season, from the groups' ESPN team ids: men 327 (2002) to 365 (2026, 2027); women 314 (2002) to 363 (2026, 2027). ESPN's schedules hold many more teams, since they list every opponent: 727 men's teams have a player line in 2026, and 663 women's. Of 2026's completed games, 5,752 men's and 5,625 women's are between two Division I teams, and 548 and 405 have one non-Division I side.

## Which files repeat others

Measured on the downloaded files. A file is skipped only when proven to repeat others (D23).

| Files                                              | Result                                                                                                                                                                                                            | Loaded?                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `mbb_team_group_seasons`, `wbb_team_group_seasons` | Equal to their 26 season files row for row (9,051 and 8,932 rows, `EXCEPT` empty)                                                                                                                                 | **No** (the season files load) |
| ESPN `mbb_schedule_master`, `wbb_schedule_master`  | Not a repeat: 136,915 and 129,120 games against the season files' 147,805 and 143,612; 11,032 and 14,498 season games are missing from it, and 142 and 6 games are in it alone; 88 columns of the seasons' 90 (M) | Yes, as the NBA's (T406)       |
| ESPN `*_games_in_data_repo`                        | Not compared                                                                                                                                                                                                      | Yes (not proven)               |
| `ncaa_espn_schools`, `ncaa_espn_school_seasons`    | The same in `mbb_crosswalk` and `wbb_crosswalk`; `ncaa_espn_team_crosswalk` differs (6,371 and 6,335 rows, the league's own teams). Each league has its own file (D36), so each loads its copy                    | Yes, once per league           |
| stats.ncaa.org team box against its player box     | Points equal the players' sum on 100 % of team-games every season but 2019 (99.4 %); the team file adds possessions, opponent counts and rates                                                                    | Yes                            |
| `ncaa_*_rosters` against `ncaa_*_team_rosters`     | Not compared (4 columns against 16; 157,828 rows against 97,807 for the men)                                                                                                                                      | Yes (not proven)               |
| ESPN against stats.ncaa.org                        | Different sources that agree closely (below), never repeats (D14)                                                                                                                                                 | Both                           |

So D23 skips only the two combined group files (0.04 MB). Nothing measured here makes a large file skippable.

## Do the numbers agree?

Exact equality, no tolerance.

### stats.ncaa.org's player lines against ESPN's

Games are joined through the NCAA file's own `espn_game_id` (from 2023 for the men, 2024 for the women) or else the schedule crosswalk (`ncaa_contest_id`, men from 2010, women from 2021). Players are joined through the player crosswalk (`ncaa_player_id` to `espn_athlete_id`, per season). "Paired" counts the stats.ncaa.org lines that found an ESPN line.

| Season | M lines | M paired | M points % | M rebounds % | M assists % | M all three % | W lines | W paired | W all three % |
| ------ | ------- | -------- | ---------- | ------------ | ----------- | ------------- | ------- | -------- | ------------- |
| 2011   | 117,226 | 104,788  | 99.4       | 99.4         | 99.5        | 99.1          | 110,512 | 0        | no game link  |
| 2012   | 117,582 | 104,602  | 99.5       | 99.5         | 99.6        | 99.3          | 110,210 | 0        | no game link  |
| 2013   | 118,422 | 105,433  | 99.5       | 99.5         | 99.6        | 99.3          | 109,726 | 0        | no game link  |
| 2014   | 122,298 | 110,780  | 99.5       | 99.5         | 99.5        | 99.4          | 112,755 | 0        | no game link  |
| 2015   | 121,605 | 110,686  | 99.4       | 99.4         | 99.4        | 99.2          | 114,221 | 0        | no game link  |
| 2016   | 122,382 | 109,335  | 99.4       | 99.4         | 99.4        | 99.1          | 113,714 | 0        | no game link  |
| 2017   | 122,967 | 109,791  | 99.5       | 99.3         | 99.4        | 99.2          | 114,814 | 0        | no game link  |
| 2018   | 121,636 | 109,410  | 99.3       | 99.3         | 99.4        | 99.1          | 113,554 | 0        | no game link  |
| 2019   | 121,053 | 109,246  | 99.4       | 99.4         | 99.5        | 99.3          | 113,994 | 0        | no game link  |
| 2020   | 115,581 | 104,308  | 99.8       | 99.8         | 99.8        | 99.6          | 109,136 | 0        | no game link  |
| 2021   | 86,718  | 79,595   | 99.8       | 99.8         | 99.9        | 99.7          | 76,340  | 71,375   | 99.2          |
| 2022   | 120,383 | 110,697  | 99.8       | 99.8         | 99.8        | 99.6          | 112,123 | 103,663  | 99.4          |
| 2023   | 125,371 | 115,108  | 100        | 100          | 100         | 100           | 117,672 | 109,350  | 99.9          |
| 2024   | 125,973 | 116,661  | 100        | 100          | 100         | 100           | 118,500 | 111,214  | 100           |
| 2025   | 127,466 | 117,368  | 100        | 100          | 100         | 100           | 121,169 | 107,612  | 100           |
| 2026   | 127,465 | 112,744  | 100        | 100          | 100         | 100           | 121,918 | 112,873  | 100           |

The women's points, rebounds and assists percentages equal their "all three" within 0.4 points every season. Unpaired lines are crosswalk misses: about 8 % of stats.ncaa.org's lines have no ESPN athlete in the player crosswalk. The women's 2011–2020 lines can be paired by date and the team crosswalk (`ncaa_espn_team_crosswalk`), which this part did not do, and ESPN holds lines for under a third of those games anyway.

### Team-games, and the files within each family

| Check                                                          | Result                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| stats.ncaa.org team box against ESPN's, through `espn_game_id` | Points 99.8–100 %, FGA 98.7–100 %, FGM 99.8–100 %, assists 97.2–99.2 % (M 2023–2027, W 2024–2027)              |
| stats.ncaa.org team points against its own schedule's score    | 98.5–99.8 % of team-games 2011–2027 (M), 98.4–99.9 % (W); **2010: 366 of 11,418 (M), 218 of 10,796 (W)**       |
| ESPN players summed against ESPN's team score                  | M 97.1–99.7 % 2005–2013, 99.8–100 % from 2014; **W 1.2–2.5 % 2004–2013**, 99 % 2014–2015, 99.5–100 % from 2016 |
| stats.ncaa.org shots against its team FGA                      | 12,037 of 12,047 team-games (M 2026)                                                                           |
| stats.ncaa.org possessions' points against its team points     | 10,400 of 12,041 team-games (86.4 %, M 2026): possessions are the dataset's estimate                           |
| stats.ncaa.org lineups                                         | Every 2026 men's game (6,297), no row with a player-count error                                                |

### Leaders against the NCAA's record books

The NCAA's record books, read with a plain client (below), list each season's individual champions. Three were checked against the files with the NCAA's 75 % rule ("Qualifying minimums"):

- Men's scoring, 2025-26: the record book has AJ Dybantsa, BYU, 35 games, 894 points, 25.5 a game. stats.ncaa.org's player box gives the same 35 games and 894 points, ranked first.
- Women's steals, 2025-26: the record book has Hannah Hidalgo, Notre Dame, 36 games, 202 steals. ESPN's player box gives the same 36 and 202.
- ESPN's men's and women's player box scores rank one-game players from non-Division I teams above them (Bloomfield, Briar Cliff and others, 36 and 40 points in one game) unless rows are kept to Division I teams. See "Traps".

## Men and women: the differences

The research's section 18 lists documented differences. Measured:

| Research's claim (section 18)                                                       | Measured                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Men: PBP and shots from 2003 and 2006 on, 2004–05 absent                            | True: files for 2003 and 2006–2027, none for 2004 and 2005. 2003 holds 18 games; the share reaches 85 % only in 2014                                                                                                                                                                 |
| Men: boxes from 2003                                                                | Files from 2003; 2003 holds 1 game and 2004 11. Box scores begin in practice in 2005 (82.6 %)                                                                                                                                                                                        |
| Men: schedules and game rosters from 2002                                           | True                                                                                                                                                                                                                                                                                 |
| Men: officials from 2003 except 2010                                                | True                                                                                                                                                                                                                                                                                 |
| Men: rosters and player season stats from 2025                                      | Rosters 2025–2027 (3 files); **player season stats from 2003** (25 files)                                                                                                                                                                                                            |
| Women: boxes, PBP, shots, game rosters from 2004; schedules from 2001               | True for the files. **The files are a sample**: box scores for 1.3 % of 2004's games, under 34 % until 2017                                                                                                                                                                          |
| Women: standings, season stats and officials have their own starts and omit 2024–25 | Standings 2001–2027, season stats 2010–2027, officials 2014–2027, **none missing 2025**. But ESPN's 2025 women's schedule holds 5,648 games against 5,923 in 2024 and stats.ncaa.org's 5,960 in 2025                                                                                 |
| Women's ratings: 2015 unusable, a failing check in 2008                             | `wbb_ratings` has files for 2009–2027 (2008 not published); 2015 not examined                                                                                                                                                                                                        |
| Men's halves, women's quarters                                                      | Women in halves to 2015 and quarters from 2016 (ESPN's `format_regulation_periods` 2 then 4 on every game; ESPN's 2015 play by play ends at period 2 and stats.ncaa.org's 2010 at period 2 outside overtime). Men in halves every season, but the 2018 NIT's 31 games read 4 periods |

Also measured:

- **stats.ncaa.org is the same for both** (the same 13 releases, the same 87 play columns, 2010–2027), so a builder written for one reads the other.
- **ESPN differs in depth, not shape**: the women's ESPN files have 55 box-score columns and 64–74 play columns against the men's 54–55 and 62–64, and the officials file has 11 columns against 7.
- **The dataset's crosswalks start later for the women**: players from 2007 (men 2004), games from 2021 (men 2008). The women's box-score BPM starts in 2014 (men 2006), team ratings in 2009 (men 2006).
- **The three-point line** (the NCAA's rules histories, read as PDFs): men 19 feet 9 inches to 2008, 20 feet 9 inches from 2008-09 (`2009`), 22 feet 1¾ inches from 2019-20 (`2020`); women 19 feet 9 inches to 2011, 20 feet 9 inches from 2011-12 (`2012`), 22 feet 1¾ inches from 2021-22 (`2022`). The men's shot clock fell from 35 to 30 seconds in 2015-16 (`2016`).

## Traps

- **A season is labelled by its final year** in both families (`2026` = 2025-26, games from 2025-11-03 to 2026-04-06), as for the NBA. Screens show `2025-26`. stats.ncaa.org's own sport-year ids and Sportradar's seasons count from the first year (the research's section 17); none of that reaches the releases.
- **ESPN's schedule files hold almost every game twice from 2003.** 136,773 men's and 129,114 women's games of 2003–2026 have two rows (9,980 rows for 4,990 games in 2003), and the two copies are equal on every column compared (teams, score, season type, headline, neutral site, time, group). A few games have one row (142 men's games of 2008, 139 of 2010, 6 women's of 2003), as do 2002 (men), 2001–2002 (women) and the current season. Count games by distinct `game_id`.
- **Season types: ESPN's `season_type` is 2 or 3, never 1.** Conference tournaments are regular season (type 2): marked by `tournament_id` with `conference_competition` (300 men's and 324 women's games in 2026), and by `notes_headline` ("Big Ten Tournament - Final", "SEC Tournament", "Atlantic 10 Championship"). Early-season events are type 2 as well, with a `tournament_id` and a headline ("Players Era Festival", "Battle 4 Atlantis"). Type 3 holds the NCAA tournament and the other postseason events. No exhibition appears: there is no type 1, and the NCAA's policies say exhibitions do not count.
- **The NCAA tournament's headline changes by era**: region names ("EAST REGIONAL AT DAYTON OH", "FINAL FOUR") in 2002–2007, "MEN'S BASKETBALL CHAMPIONSHIP" in 2008–2020, "Men's Basketball Championship" in 2021–2025, "NCAA Men's Basketball Championship - …" in 2026 (`tournament_id` 22). Classified by headline, it is 63 or 64 games to 2010 and 67 from 2011 for the men (66 in 2021), and 63 for the women to 2021 and 67 from 2022. Read the event from type 3 with an era rule, never from one spelling.
- **The other postseason events, all type 3**: men's NIT (31 games a season from 2007 by headline, but 23 in 2017 and 16 in 2021; 39–40 before), CBI (from 2008), CIT (2009–2019 and 2024), Vegas 16 (2016), The Basketball Classic (2022), College Basketball Crown (2025–2026); women's WNIT (31 to 63 games), WBI (2010–2023), WBIT (2024–2026). In the NCAA's own statistics, "postseason contests including conference and/or NCAA tournaments … shall be included" (Statistics Policies), so a season total counts them all. Each event is a season type of its own, for filtering.
- **2020 has no postseason** (no type 3 game): 159 men's conference tournament games against 292 in 2019. 2021 is short: 4,285 men's and 3,823 women's games.
- **The 2018 NIT was played in quarters**: its 31 games (type 3, headline "NIT") carry `format_regulation_periods` 4 in a men's season of halves. A builder that takes periods from the league and season alone misreads them.
- **Non-Division I opponents are in the data.** ESPN lists every opponent (727 men's teams with a player line in 2026), and marks a team outside Division I with `is_active` false: 548 of the 548 men's 2026 games against a team missing from the groups, 405 of 407 women's. The groups file (`*_team_group_seasons`) is the season's Division I list. Players of those teams have ESPN box-score lines (a leaderboard that keeps them ranks one-game players first). The NCAA counts games against "countable" opponents only, and its list of non-countable ones (on ncaa.org) was not read, so the data cannot tell a countable non-Division I opponent from a non-countable one: Metis would count every game a Division I team played, and keep non-Division I teams and players out of the leaderboards and the ranks.
- **Women's ESPN box scores are a sample before 2017** (table above), and their players summed miss the team score in 97–99 % of 2004–2013's games: a column of zeros or a partial line, not a short box score. Read 2011–2016 women's lines from stats.ncaa.org.
- **ESPN's 2025 women's schedule is short**: 5,648 games against 5,923 in 2024, 6,054 in 2026 and stats.ncaa.org's 5,960 for 2025. Not explained here; the games and teams should be built from both schedules, as the WNBA's were from two.
- **stats.ncaa.org's 2010 season is broken in both leagues**: its player box has 28,116 men's lines against 117,226 in 2011, an average of 5.3 player minutes a team-game, 4 % of plays with the ten players, and team points equal to the schedule's score in 3 % of team-games. The women's 2010 files have no team or player ids. Read stats.ncaa.org from 2011.
- **stats.ncaa.org's player ids are per season.** None of 81,287 men's and 74,454 women's player ids appears in more than one season. A player across seasons, and across a transfer, is ESPN's `athlete_id`, joined through the player crosswalk's `ncaa_player_id` (92–99 % of ESPN's rows from 2010). The RAPM file has a `person_id` beside `player_id`, not examined.
- **stats.ncaa.org's team ids are per season too**: Texas A&M-Corpus Christi is 51431 in 2009-10 and 609609 in 2025-26. `ncaa_espn_team_crosswalk` maps each season's id to ESPN's `team_id`, which is the same across seasons, with the school's `ncaa_org_id`.
- **Players across transfers.** ESPN's `athlete_id` follows a player from school to school: 12,173 men and 6,684 women have lines for more than one team across seasons, and 33 men and 70 women for two teams in one season. A player's season is a player-team row; their career sums the rows once.
- **Names and keys differ by family**: stats.ncaa.org's play by play and player box name players as `AJ.DYBANTSA` (`player`) and give a `clean_name`; its schedule names teams in the NCAA's short form (`Southern Miss.`, `A&M-Corpus Christi`) with no id, so its games join to the team box by `contest_id` and to ESPN through `espn_game_id` (2023 on for men, 2024 on for women) or the schedule crosswalk.
- **Conferences change by season.** The groups file has 31 to 33 conferences a season, and teams changing conference each season: men 22 in 2006, 20 in 2013, 47 in 2014, 21 in 2023, 21 in 2025, 27 in 2027 (the women's the same within one or two). It records renames as one lineage (American, ASUN, CAA) and divisions by season (Atlantic 10 East and West 2002–2005, MAC East and West 2002–2020, Big South North and South 2013–2022, and others). ESPN labels the MAAC "Metro" in every season, as the groups' notes say. Division I grew from 327 to 365 men's teams (314 to 363 women's), 0 to 13 joining a season.
- **Neutral sites are flagged only from 2008 (men) and 2009 (women).** `neutral_site` is false on every game before, though the NCAA tournament has always been neutral. 22 % of 2026's men's games are neutral (1,418 of 6,318): early-season events, conference and postseason tournaments. The NCAA's policies define home, away and neutral by where a team plays its home games (a team's second home arena is home; a conference tournament on a member's floor is neutral for all); whether ESPN's flag follows that rule was not checked.
- **ESPN's shot coordinates are mostly missing before 2026.** 624,195 of 803,389 men's shots in 2015 have no coordinate, and the commonest located points are the two baskets' own points (41.75, 0 and −41.75, 0: 24,596 and 21,073 shots in 2015; 136,768 and 117,426 in 2026). Every shot has a location from 2026. stats.ncaa.org's shots have a location on every row from 2019.
- **ESPN's 2026 play by play is a richer feed**: 2,915,731 men's plays for 6,275 games (465 a game) against 2,189,782 for 6,135 in 2025 (357). Counts of plays by type are not comparable across the change.
- **Game length is 40 minutes in both** (team minutes 200 in regulation; stats.ncaa.org's team box averages 39.3 to 39.7 minutes a team-game and its players 197 to 201). Overtime is five minutes: 2026 had men's games to period 5 (three overtimes, 9 games) and women's to period 8 (four overtimes, 1 game).
- **stats.ncaa.org's team box carries the estimated possessions and ratings** (`o_poss`, `ortg`) and the opponent's counts (`d_*`); its rates are published values. Rates stay stored as their parts (policy 3) and are recomputed.
- **Ids are integers in ESPN's files and text in stats.ncaa.org's** (`contest_id`, `player_id`, `espn_game_id` as VARCHAR). Cast once, in the loader.
- **The ratings and player-value files cover every team ESPN knows**: `mbb_ratings` has 727 teams in 2026, Division I and not. Rank them among the season's Division I teams.

## Does the load fit D22?

D22 stops the work at a database file over 6 GB, a first load over an hour, or 4 GB of process memory. Each league has its own file (D36), so the limits apply per league.

### DuckDB size, measured per row

One season file of each heavy table was loaded into its own DuckDB file (`CREATE TABLE … AS SELECT * FROM read_parquet(…)`, then `CHECKPOINT`), with DuckDB's memory limit at 1 GB. The process peaked at 1.29 GB.

| File (2026 unless said)             | Parquet MB | DuckDB MB | Bytes a row | Seconds | Rows                |
| ----------------------------------- | ---------- | --------- | ----------- | ------- | ------------------- |
| ESPN men's play by play             | 89.8       | 232.0     | 80          | 9.5     | 2,915,731           |
| ESPN men's play by play, 2015       | 45.0       | 235.7     | 136         | 7.5     | 1,737,302           |
| ESPN women's play by play           | 76.5       | 240.9     | 85          | 8.3     | 2,824,090           |
| ESPN men's shots                    | 13.6       | 25.4      | 26          | 0.6     | 991,836             |
| ESPN men's player box               | 3.4        | 14.4      | 73          | 0.7     | 196,876             |
| ESPN men's game rosters             | 3.0        | 11.3      | 57          | 0.5     | 196,876             |
| ESPN men's schedule                 | 1.8        | 22.3      | 1,765       | 0.6     | 6,318 (12,636 rows) |
| stats.ncaa.org men's play by play   | 63.6       | 361.2     | 117         | 23.0    | 3,075,470           |
| stats.ncaa.org women's play by play | 62.0       | 350.0     | 117         | 20.6    | 2,986,683           |
| stats.ncaa.org possessions          | 14.5       | 78.9      | 90          | 2.9     | 878,168             |
| stats.ncaa.org lineups              | 15.7       | 42.2      | 146         | 1.4     | 288,918             |
| stats.ncaa.org matchup stints       | 9.6        | 31.5      | 150         | 0.7     | 210,508             |
| stats.ncaa.org shots                | 8.9        | 24.7      | 33          | 0.5     | 740,861             |
| stats.ncaa.org player box           | 11.2       | 16.0      | 126         | 0.9     | 127,465             |
| stats.ncaa.org team box             | 1.5        | 2.1       | 167         | 0.1     | 12,594              |

### Estimated, every season

Rows over every season (the survey) times the bytes a row above. The ESPN play by play is given as a range (80 to 136 bytes a row).

| Table                                                                              | M rows     | M GB          | W rows     | W GB          |
| ---------------------------------------------------------------------------------- | ---------- | ------------- | ---------- | ------------- |
| stats.ncaa.org play by play                                                        | 46,673,534 | 5.5           | 44,696,202 | 5.2           |
| ESPN play by play                                                                  | 32,585,547 | 2.6–4.4       | 19,703,620 | 1.7–2.7       |
| stats.ncaa.org possessions                                                         | 13,201,017 | 1.2           | 12,780,780 | 1.2           |
| ESPN schedules (season files, master, in-repo)                                     | 380,804    | 0.7           | 327,837    | 0.6           |
| stats.ncaa.org lineups                                                             | 4,325,677  | 0.6           | 3,981,367  | 0.6           |
| stats.ncaa.org matchup stints                                                      | 3,131,710  | 0.5           | 2,988,915  | 0.4           |
| ESPN shots                                                                         | 14,853,695 | 0.4           | 8,478,246  | 0.2           |
| ESPN player box                                                                    | 3,706,892  | 0.3           | 1,800,718  | 0.1           |
| stats.ncaa.org player box                                                          | 1,963,616  | 0.2           | 1,833,977  | 0.2           |
| ESPN game rosters                                                                  | 4,150,773  | 0.2           | 2,028,968  | 0.1           |
| stats.ncaa.org shots                                                               | 4,990,841  | 0.2           | 4,706,337  | 0.2           |
| Everything else (season stats, standings, bios, ids, groups, models; not measured) |            | about 0.3     |            | about 0.2     |
| **Source tables**                                                                  |            | **12.7–14.5** |            | **10.7–11.7** |

The built tables add a quarter or so: the NBA's file grew from 4.3 GB at T405 to 5.33 GB with every built table, the WNBA's from 666 to 850 MB. So **the whole of either side is about twice D22's 6 GB**, and the two play-by-play files together (8.1–9.9 GB men, 6.9–7.9 GB women) are more than the limit on their own.

Time: the 1,377 MB downloaded for this part took 498 seconds four at a time (2.8 MB/s, on a machine running other work), so every file would take about 19 minutes for the men and 15 for the women before anything is built. The NBA's play step took 440–546 s for 34.9 million rows; the men's two play-by-play files are 79 million. A full men's load is estimated at 45 to 70 minutes, at or past the hour. Memory is bounded by DuckDB's 1 GB limit, as for the NBA (2.56 GB peak); nothing here suggests more.

### What fits: the first load proposed

Without the two play-by-play files and the possessions:

| Tier (as D21)                     | M source GB | W source GB | Download M / W (MB) |
| --------------------------------- | ----------- | ----------- | ------------------- |
| Core                              | 1.7         | 1.3         | 434 / 310           |
| Published                         | 0.02        | 0.02        | 14 / 10             |
| Events (shots, lineups, stints)   | 1.6         | 1.4         | 596 / 495           |
| **First load**                    | **3.4**     | **2.7**     | **1,044 / 815**     |
| With built tables, a quarter more | about 4.2   | about 3.4   |                     |

That fits D22 with room for the tables to grow: about 4.2 GB for the men and 3.4 GB for the women, against 6 GB, and about 6 and 5 minutes of downloads. What it leaves out: both play-by-play sources and the possessions (M 9.3–11.1 GB, W 8.1–9.1 GB). Left out with them are every statistic built from plays: play-derived counts, splits by period and clock, game flow, the possession-level on/off. Lineups and stints keep five-player and on-court numbers, since the dataset publishes them already summed per stint. A second option is play by play for a window of recent seasons (stats.ncaa.org's costs about 0.36 GB a season a side). A third is a larger limit for these two leagues. All three are the owner's decision (D22: past a limit the work goes to the owner); D41 below sets out the choice.

## What the check can compare against

Read with a plain client (`curl -A metis-research`, three to ten seconds apart) on 2026-11-18, kept in `~/.cache/metis-dev/ncaa-probe`. Nothing was retried with another client.

| Source                                                                                           | Answer                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stats.ncaa.org (home, rankings, team pages)                                                      | **HTTP 403**, "Access Denied" (Akamai), every request                                                                                                                                                                                                                                                                                                                                                             |
| ncaa.com statistics and standings (`/stats/basketball-men/d1/…`, `/standings/basketball-men/d1`) | **HTTP 403** on all five requests                                                                                                                                                                                                                                                                                                                                                                                 |
| ncaa.com NET rankings (men's, women's)                                                           | **Intermittent**: the women's answered 200 once (a table of 364 teams, "Through Games Apr. 05 2026") and 403 ten minutes later; the men's 403, then 200; the AP poll page 403                                                                                                                                                                                                                                     |
| data.ncaa.com scoreboard JSON                                                                    | HTTP 404 for the date tried                                                                                                                                                                                                                                                                                                                                                                                       |
| ncaa.org statistics-and-records pages (men's, women's)                                           | HTTP 200: link lists to the record books and to stats.ncaa.org                                                                                                                                                                                                                                                                                                                                                    |
| The NCAA's PDFs on S3 (`s3.amazonaws.com/fs.ncaa.org/Docs/stats/…`)                              | HTTP 200: the Statistics Policies and Guidelines, the basketball statisticians' manual, the men's and women's Division I record books (annual individual and team champions through 2025-26), the men's conference history, both rules histories, the women's conference champions. The women's `DI_ConfHistory.pdf` and `Rules_History.pdf` paths answered 403 (the women's rules history is `PlayingRules.pdf`) |
| Sports Reference college season pages (`/cbb/seasons/men/2026-school-stats.html`, `…/women/…`)   | HTTP 200: every school's record and season totals, men and women                                                                                                                                                                                                                                                                                                                                                  |

So **the NCAA's own published statistics cannot be read as tables**. stats.ncaa.org and ncaa.com refuse a plain client. What answers are the NCAA's record books, as PDFs: each season's individual champions by category (with games and totals), team champions, and the conference champions. The two leaders checked equal the files exactly (AJ Dybantsa's 894 points in 35 games, Hannah Hidalgo's 202 steals in 36). For every team's record a season, Sports Reference answers as Basketball-Reference did for the WNBA; it is not the NCAA, and the check would say so.

**NET: no free published source to load.** The releases have none. stats.ncaa.org refuses a plain client, and ncaa.com's NET page answers it only some of the time. That page holds one snapshot, the latest, with no history and no game-day ranks, which quadrants need. Reading it would mean scraping a page that also refuses the same client, so D7's and D24's reasoning leaves NET and quadrants out, listed with that reason.

## Qualifying minimums

The NCAA's Statistics Policies and Guidelines ("Ranking Minimums", read on 2026-11-18): "To be ranked, a student-athlete must appear in 75 percent of the team's games." The minimums for each category "shall be determined by the national office … and shall be reviewed annually". They are published with the rankings on stats.ncaa.org, which refused a plain client, and the record books print each season's champion without the category's minimum. National per-game rankings count "the number of games an individual actually plays", and a player in for one play has a game. A team must play the minimum number of games set for sports sponsorship to be ranked at all; the men's record book gives 13 games as the minimum for record-book inclusion in 2021, "the minimum required for NCAA championship consideration".

So the games rule can be the NCAA's own: 75 % of the team's games. The makes minimums for the shooting percentages stay D37's scaled rule until the NCAA's are read (D42 below).

## What the NCAA data can support

| Area                                    | Men                                                                                          | Women                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Games, scores, records, conferences     | 2002–2027                                                                                    | 2001–2027 (conferences from 2002)                                           |
| Player and team box scores              | 2005–2027 (two sources from 2011)                                                            | 2011–2027 complete; 2004–2010 a sample (ESPN)                               |
| Shots with location                     | 2019–2027 (stats.ncaa.org), 2026– (ESPN)                                                     | The same                                                                    |
| Lineups, on-court, stints               | 2011–2027                                                                                    | 2011–2027                                                                   |
| Play by play                            | 2006–2027 (ESPN partial to 2013), 2011–2027 (stats.ncaa.org); not in the proposed first load | 2004–2027 (ESPN partial to 2019), 2011–2027; not in the proposed first load |
| Team ratings, BPM, RAPM (the dataset's) | 2006–2027, RAPM 2011–2026                                                                    | 2009–2027, BPM 2014–2027, RAPM 2011–2026                                    |
| NET, polls, seeds, tracking, play types | Not available                                                                                | Not available                                                               |
