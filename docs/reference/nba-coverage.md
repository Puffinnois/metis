# NBA coverage: what each table really holds

Written by `scripts/coverage-report.mjs` from a real load. Column by column, in `nba-coverage.tsv`: a column holds values in a season when at least 1 % of its rows hold a value that is not null, zero or empty.

- **From:** the first season with rows.
- **Holds values from:** the first season where at least half of the stat columns that ever hold anything do. Names, ids, games and minutes are not stat columns: rows before this season may have those and little else.
- **Empty:** columns that never hold a value in any season.
- **Later:** columns that only start holding values after that season.

| Table                                    | Rows       | Columns | From    | Holds values from | To      | Empty | Later |
| ---------------------------------------- | ---------- | ------- | ------- | ----------------- | ------- | ----- | ----- |
| `src_dash_lineups_advanced`              | 277,982    | 56      | 2007-08 | 2007-08           | 2026-27 | 0     | 0     |
| `src_dash_lineups_base`                  | 277,982    | 64      | 2007-08 | 2007-08           | 2026-27 | 0     | 0     |
| `src_dash_lineups_fourfactors`           | 277,982    | 38      | 2007-08 | 2007-08           | 2026-27 | 0     | 0     |
| `src_dash_lineups_misc`                  | 277,982    | 38      | 2007-08 | 2007-08           | 2026-27 | 0     | 0     |
| `src_dash_lineups_opponent`              | 277,982    | 64      | 2007-08 | 2007-08           | 2026-27 | 0     | 0     |
| `src_dash_lineups_scoring`               | 277,982    | 52      | 2007-08 | 2007-08           | 2026-27 | 0     | 0     |
| `src_dash_player_bio`                    | 21,120     | 28      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_player_stats_advanced`         | 21,120     | 84      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_player_stats_base`             | 21,120     | 74      | 1996-97 | 1996-97           | 2026-27 | 0     | 2     |
| `src_dash_player_stats_defense`          | 18,449     | 48      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_player_stats_misc`             | 21,120     | 48      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_player_stats_scoring`          | 21,120     | 58      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_player_stats_usage`            | 21,120     | 58      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_catchshoot`    | 20,494     | 21      | 1996-97 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_defense`       | 10,211     | 19      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_drives`        | 10,211     | 30      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_efficiency`    | 10,211     | 27      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_elbowtouch`    | 10,211     | 31      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_painttouch`    | 10,211     | 31      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_passing`       | 10,211     | 23      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_possessions`   | 10,211     | 26      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_posttouch`     | 10,211     | 31      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_pullupshot`    | 21,120     | 21      | 1996-97 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_rebounding`    | 9,946      | 40      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_player_tracking_speeddistance` | 10,211     | 20      | 2013-14 | 2013-14           | 2026-27 | 0     | 0     |
| `src_dash_standings`                     | 951        | 131     | 1995-96 | 2001-02           | 2026-27 | 1     | 49    |
| `src_dash_team_stats_advanced`           | 1,402      | 51      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_team_stats_base`               | 1,402      | 59      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_team_stats_defense`            | 1,402      | 35      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_team_stats_fourfactors`        | 1,402      | 33      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_team_stats_misc`               | 1,402      | 33      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_team_stats_opponent`           | 1,402      | 59      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_dash_team_stats_scoring`            | 1,402      | 47      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_espn_depth_charts`                  | 57,870     | 19      | 2026-27 | 2026-27           | 2026-27 | 0     | 0     |
| `src_espn_draft`                         | 1,500      | 36      | 2002-03 | 2002-03           | 2026-27 | 16    | 2     |
| `src_espn_game_rosters`                  | 852,379    | 23      | 2001-02 | 2001-02           | 2026-27 | 3     | 2     |
| `src_espn_games_in_repo`                 | 31,262     | 80      | 2001-02 | 2001-02           | 2026-27 | 0     | 12    |
| `src_espn_injuries`                      | 5,014      | 28      | 2026-27 | 2026-27           | 2026-27 | 0     | 0     |
| `src_espn_officials`                     | 96,045     | 8       | 2001-02 | 2001-02           | 2026-27 | 0     | 0     |
| `src_espn_pbp`                           | 14,266,817 | 71      | 2001-02 | 2001-02           | 2026-27 | 3     | 7     |
| `src_espn_player_box`                    | 1,087,258  | 58      | 1993-94 | 1993-94           | 2026-27 | 0     | 4     |
| `src_espn_player_core`                   | 14,969     | 37      | 1993-94 | 1993-94           | 2026-27 | 0     | 0     |
| `src_espn_player_season`                 | 629,536    | 16      | 1993-94 | 1993-94           | 2026-27 | 0     | 1     |
| `src_espn_rosters`                       | 1,595      | 37      | 2024-25 | 2024-25           | 2026-27 | 4     | 0     |
| `src_espn_schedule`                      | 43,562     | 81      | 1993-94 | 1993-94           | 2026-27 | 0     | 8     |
| `src_espn_schedule_master`               | 43,109     | 80      | 1993-94 | 1993-94           | 2026-27 | 0     | 8     |
| `src_espn_shots`                         | 6,714,275  | 21      | 2001-02 | 2001-02           | 2026-27 | 0     | 0     |
| `src_espn_standings`                     | 17,648     | 25      | 2001-02 | 2001-02           | 2026-27 | 4     | 0     |
| `src_espn_team_box`                      | 84,164     | 60      | 1993-94 | 1993-94           | 2026-27 | 0     | 6     |
| `src_espn_team_season`                   | 35,742     | 17      | 2001-02 | 2001-02           | 2026-27 | 3     | 0     |
| `src_group_aliases`                      | 66         | 8       | –       | –                 | –       | –     | –     |
| `src_group_seasons`                      | 445        | 9       | 1970-71 | 1970-71           | 2026-27 | 0     | 0     |
| `src_groups`                             | 10         | 6       | –       | –                 | –       | –     | –     |
| `src_nba_coaches`                        | 5,623      | 12      | 1996-97 | 1996-97           | 2026-27 | 0     | 1     |
| `src_nba_combine_anthro`                 | 1,873      | 20      | 2000-01 | 2000-01           | 2026-27 | 0     | 5     |
| `src_nba_combine_drills`                 | 1,873      | 14      | 2000-01 | 2000-01           | 2026-27 | 0     | 1     |
| `src_nba_combine_on_the_move`            | 1,873      | 32      | 2000-01 | 2014-15           | 2026-27 | 0     | 9     |
| `src_nba_combine_spot_up`                | 1,873      | 53      | 2000-01 | 2013-14           | 2026-27 | 0     | 0     |
| `src_nba_combine_stats`                  | 1,873      | 48      | 2000-01 | 2013-14           | 2026-27 | 0     | 8     |
| `src_nba_draft`                          | 1,833      | 15      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_game_lineups`                   | 19,027,053 | 15      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_game_matchups`                  | 2,189,257  | 51      | 2017-18 | 2017-18           | 2026-27 | 7     | 0     |
| `src_nba_game_rosters`                   | 159,379    | 12      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_hustle_player`                  | 17,436     | 33      | 2015-16 | 2017-18           | 2026-27 | 0     | 0     |
| `src_nba_hustle_team`                    | 1,072      | 25      | 2015-16 | 2015-16           | 2026-27 | 0     | 9     |
| `src_nba_impact`                         | 21,100     | 29      | 1996-97 | 1996-97           | 2026-27 | 0     | 3     |
| `src_nba_injury_report`                  | 1,335,678  | 18      | 2018-19 | 2018-19           | 2026-27 | 0     | 0     |
| `src_nba_lineups`                        | 869,214    | 193     | 2007-08 | 2007-08           | 2026-27 | 0     | 10    |
| `src_nba_matchup_rollups`                | 59,038     | 27      | 2017-18 | 2017-18           | 2026-27 | 0     | 0     |
| `src_nba_metric_curves`                  | 391,702    | 15      | 1996-97 | 1996-97           | 2026-27 | 2     | 0     |
| `src_nba_officials`                      | 90,634     | 8       | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_pbp`                            | 19,027,053 | 50      | 1996-97 | 1996-97           | 2026-27 | 0     | 1     |
| `src_nba_play_types`                     | 180,334    | 29      | 2015-16 | 2015-16           | 2026-27 | 0     | 0     |
| `src_nba_player_box`                     | 1,045,464  | 38      | 1996-97 | 1996-97           | 2026-27 | 1     | 0     |
| `src_nba_player_season`                  | 236,260    | 213     | 1996-97 | 1996-97           | 2026-27 | 0     | 3     |
| `src_nba_possessions`                    | 7,499,906  | 36      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_rolling_windows`                | 56,298     | 22      | 1996-97 | 1996-97           | 2026-27 | 0     | 2     |
| `src_nba_rosters`                        | 13,571     | 19      | 1996-97 | 1996-97           | 2026-27 | 0     | 2     |
| `src_nba_schedule`                       | 42,235     | 16      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_season_matchups`                | 2,449,946  | 32      | 2017-18 | 2017-18           | 2025-26 | 4     | 0     |
| `src_nba_shots`                          | 6,357,110  | 20      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_standings`                      | 922        | 131     | 1996-97 | 2001-02           | 2026-27 | 1     | 49    |
| `src_nba_team_box`                       | 76,296     | 30      | 1996-97 | 1996-97           | 2026-27 | 0     | 0     |
| `src_nba_team_game_logs`                 | 76,216     | 32      | 1996-97 | 1996-97           | 2026-27 | 0     | 1     |
| `src_nba_team_season`                    | 16,884     | 189     | 1996-97 | 1996-97           | 2026-27 | 0     | 10    |
| `src_player_aliases`                     | 19,848     | 12      | –       | –                 | –       | –     | –     |
| `src_team_aliases`                       | 152        | 12      | –       | –                 | –       | –     | –     |
| `src_team_groups`                        | 1,514      | 12      | 1970-71 | 1970-71           | 2026-27 | 1     | 1     |
| `src_team_groups_all`                    | 1,514      | 11      | 1970-71 | 1970-71           | 2026-27 | 1     | 1     |
| `src_xwalk_game`                         | 35,922     | 17      | 2001-02 | 2001-02           | 2026-27 | 0     | 0     |
| `src_xwalk_player`                       | 14,921     | 22      | 2001-02 | 2001-02           | 2026-27 | 2     | 2     |
| `src_xwalk_team`                         | 777        | 22      | 2001-02 | 2001-02           | 2026-27 | 4     | 0     |
