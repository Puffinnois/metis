# NCAA Division I agreement checks

Measured on 2026-11-19 (Plan T1302.5) on the rebuilt copies `~/.cache/metis-dev/t1302e-ncaam` and `t1302e-ncaaw`: `scripts/check-agreement.mjs <folder> <out.md> --league=ncaam` (and `ncaaw`), and `scripts/check-ncaa-leaders.mjs <folder> --league=…` against the NCAA's record books. What the numbers mean for the app is in [ncaa-data-sources.md](ncaa-data-sources.md), "Game and season tables, built (T1302.5)".

## NCAA Division I men's agreement checks

### Games and teams

| Season  | Counted games | Division I teams | NCAA tournament | Exhibitions | Forfeits | Only stats.ncaa.org's | Check |
| ------- | ------------- | ---------------- | --------------- | ----------- | -------- | --------------------- | ----- |
| 2021-22 | 5,977         | 358              | 67              | 4           | 10       | 1                     | ok    |
| 2022-23 | 6,228         | 363              | 67              | 0           | 6        | 0                     | ok    |
| 2023-24 | 6,243         | 362              | 67              | 0           | 0        | 0                     | ok    |
| 2024-25 | 6,293         | 364              | 67              | 0           | 0        | 1                     | ok    |
| 2025-26 | 6,300         | 365              | 67              | 0           | 0        | 0                     | ok    |
| 2026-27 | 962           | 365              | 0               | 0           | 0        | 1                     | ok    |

### Team-games and their box scores

A team-game's counts are ESPN's team box where its lines are ESPN's, stats.ncaa.org's where ESPN has none, and the players summed where neither box has a count. A forfeit has no box score.

| Season  | Team-games | ESPN's | stats.ncaa.org's | No box score (forfeits) | Points equal the score |
| ------- | ---------- | ------ | ---------------- | ----------------------- | ---------------------- |
| 2021-22 | 11,954     | 11,930 | 4                | 20                      | 11,934 (100.0 %)       |
| 2022-23 | 12,456     | 12,442 | 2                | 12                      | 12,444 (100.0 %)       |
| 2023-24 | 12,486     | 12,482 | 4                | 0                       | 12,486 (100.0 %)       |
| 2024-25 | 12,586     | 12,578 | 8                | 0                       | 12,586 (100.0 %)       |
| 2025-26 | 12,600     | 12,600 | 0                | 0                       | 12,600 (100.0 %)       |
| 2026-27 | 1,924      | 1,922  | 2                | 0                       | 1,924 (100.0 %)        |

### Team totals against ESPN's team box

Every count of the team-games whose box is ESPN's against ESPN's team box: the tables read it, so anything short of 100 % is a team-game where ESPN's box lacks a count and the players' sum stands in.

| Season  | Team-games | pts   | fgm   | fga   | fg3m  | fg3a  | ftm   | fta   | oreb  | dreb  | reb   | ast   | stl   | blk   | tov   | pf    |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| 2021-22 | 11,930     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2022-23 | 12,440     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2023-24 | 12,478     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2024-25 | 12,566     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2025-26 | 12,598     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2026-27 | 1,922      | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |

### The two families' team boxes

ESPN's team totals (the tables') against stats.ncaa.org's team box for the same team-game, linked by the contest and the team's ESPN id. Both count the team rebounds and the team's own turnovers.

| Season  | Team-games | pts   | fgm   | fga   | fg3m  | fg3a  | ftm   | fta   | oreb  | dreb  | ast  | blk  | tov   |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- | ---- | ----- |
| 2021-22 | 11,353     | 99.9  | 99.9  | 99.5  | 99.9  | 99.6  | 99.9  | 99.9  | 99.0  | 98.9  | 96.8 | 99.0 | 99.0  |
| 2022-23 | 11,802     | 99.9  | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 99.2  | 99.1  | 97.2 | 99.2 | 99.3  |
| 2023-24 | 11,838     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.6  | 98.4  | 98.9 | 98.8 | 98.9  |
| 2024-25 | 11,954     | 99.9  | 100.0 | 100.0 | 100.0 | 99.9  | 100.0 | 100.0 | 99.8  | 99.8  | 99.1 | 98.7 | 99.9  |
| 2025-26 | 12,047     | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.1 | 98.6 | 100.0 |
| 2026-27 | 1,665      | 99.8  | 99.8  | 99.5  | 99.9  | 99.6  | 99.9  | 99.8  | 99.3  | 99.2  | 97.7 | 97.5 | 99.1  |

### Player sums against the team's lines

Each team-game's player lines summed against its team line. Rebounds and turnovers are compared as at most the team's, since the team box adds the team rebounds and the team's own turnovers.

| Season  | Team-games | pts   | fgm   | fga   | fg3m  | fta   | ftm   | ast   | stl   | blk   | reb ≤ | tov ≤ | pf   |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
| 2021-22 | 11,934     | 100.0 | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 98.7 |
| 2022-23 | 12,444     | 99.9  | 100.0 | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.7 |
| 2023-24 | 12,486     | 99.9  | 99.9  | 99.8  | 100.0 | 99.9  | 99.9  | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 98.3 |
| 2024-25 | 12,586     | 99.8  | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.6 |
| 2025-26 | 12,600     | 99.9  | 100.0 | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.0 |
| 2026-27 | 1,924      | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.1 |

### The two families' player lines

ESPN's lines (the counts) with stats.ncaa.org's line for the same player and game beside them (`ncaa_*`, D40). "Paired" is the share of ESPN's lines with one; the rest are players stats.ncaa.org's lines map to no ESPN athlete (T1302.4). "Every" asks points, every attempt and make, and turnovers all equal. stats.ncaa.org's lines stand alone only for the team-games ESPN has none of.

| Season  | ESPN's lines | Paired           | Points | FG    | 3FG   | FT    | Every | stats.ncaa.org's alone |
| ------- | ------------ | ---------------- | ------ | ----- | ----- | ----- | ----- | ---------------------- |
| 2021-22 | 120,233      | 119,929 (99.7 %) | 99.9   | 99.8  | 99.9  | 100.0 | 99.6  | 48                     |
| 2022-23 | 125,343      | 125,089 (99.8 %) | 100.0  | 100.0 | 100.0 | 100.0 | 100.0 | 27                     |
| 2023-24 | 125,918      | 125,731 (99.9 %) | 100.0  | 100.0 | 100.0 | 100.0 | 100.0 | 42                     |
| 2024-25 | 127,395      | 127,134 (99.8 %) | 100.0  | 100.0 | 100.0 | 100.0 | 99.9  | 90                     |
| 2025-26 | 127,532      | 126,677 (99.3 %) | 99.9   | 99.9  | 99.9  | 99.9  | 99.9  | 0                      |
| 2026-27 | 22,269       | 21,861 (98.2 %)  | 99.8   | 99.6  | 99.8  | 99.9  | 99.4  | 21                     |

| Season  | Lines with splits | Rim + mid + three = FGA | Transition, assisted and putbacks within their totals |
| ------- | ----------------- | ----------------------- | ----------------------------------------------------- |
| 2021-22 | 120,076           | 100.0                   | 100.0                                                 |
| 2022-23 | 125,116           | 100.0                   | 100.0                                                 |
| 2023-24 | 125,773           | 100.0                   | 100.0                                                 |
| 2024-25 | 127,224           | 100.0                   | 100.0                                                 |
| 2025-26 | 126,677           | 100.0                   | 100.0                                                 |
| 2026-27 | 21,882            | 100.0                   | 100.0                                                 |

### Game rows against season rows

Each player's season row of no team against their game rows summed (games, points, stats.ncaa.org's points). Must hold everywhere.

| Season  | Player-seasons | Equal            |
| ------- | -------------- | ---------------- |
| 2021-22 | 10,902         | 10,902 (100.0 %) |
| 2022-23 | 10,953         | 10,953 (100.0 %) |
| 2023-24 | 11,156         | 11,156 (100.0 %) |
| 2024-25 | 11,130         | 11,130 (100.0 %) |
| 2025-26 | 11,126         | 11,126 (100.0 %) |
| 2026-27 | 7,788          | 7,788 (100.0 %)  |

### Records against ESPN's standings

Each Division I team's wins and losses over every counted game against ESPN's standings, which count every game, the postseason with it. A team whose record differs and that has a forfeit is counted apart: ESPN's standings and its schedule's 2-0 rows do not always agree on a forfeit.

| Season  | Teams | Equal         | Differ, with a forfeit |
| ------- | ----- | ------------- | ---------------------- |
| 2021-22 | 358   | 344 (96.1 %)  | 13                     |
| 2022-23 | 363   | 357 (98.3 %)  | 6                      |
| 2023-24 | 362   | 362 (100.0 %) | 0                      |
| 2024-25 | 364   | 363 (99.7 %)  | 0                      |
| 2025-26 | 365   | 365 (100.0 %) | 0                      |
| 2026-27 | 365   | 364 (99.7 %)  | 0                      |

### Through the engine

Every Division I team's points, rebounds and stats.ncaa.org possessions over every counted game, as the engine answers them, against the table summed directly; and the season's first three scorers per game under the 75 % rule (D43). Teams outside Division I are not rows of a board (D40).

| Season  | Teams equal           | Leading scorers                                                                 |
| ------- | --------------------- | ------------------------------------------------------------------------------- |
| 2021-22 | 358 of 358 (358 rows) | Peter Kiss 25.2 (27 g); Darius McGhee 24.6 (33 g); Antoine Davis 23.9 (29 g)    |
| 2025-26 | 365 of 365 (365 rows) | AJ Dybantsa 25.5 (35 g); Jordan Riley 23.6 (30 g); Darius Acuff Jr. 23.5 (36 g) |

### The depth (T1302.6)

stats.ncaa.org's shots, lineups, stints and possessions, ESPN's shots, and SportsDataverse's published models, per season. A team-game is counted with a box score, exhibitions out.

#### Shots against the box score

stats.ncaa.org's located shots summed per team-game (`shot_team_game`) against ESPN's team box (the app's counts, D40) and stats.ncaa.org's own (`ncaa_fga`). Exact unless the column says within 2.

| Season  | Team-games | With shots | FGA = ESPN's | FGM = ESPN's | 3PA = ESPN's | FGA within 2 | FGA = stats.ncaa.org's | FGM = stats.ncaa.org's | Season FGA, shots / box | Season FGM, shots / box |
| ------- | ---------- | ---------- | ------------ | ------------ | ------------ | ------------ | ---------------------- | ---------------------- | ----------------------- | ----------------------- |
| 2021-22 | 11,934     | 97.3 %     | 96.9 %       | 97.2 %       | 87.6 %       | 97.2 %       | 97.2 %                 | 97.2 %                 | 673,127 / 692,371       | 294,041 / 302,367       |
| 2022-23 | 12,444     | 98.5 %     | 98.4 %       | 98.5 %       | 90.5 %       | 98.5 %       | 98.5 %                 | 98.5 %                 | 707,685 / 718,714       | 312,136 / 316,986       |
| 2023-24 | 12,486     | 99.4 %     | 99.3 %       | 99.4 %       | 93.6 %       | 99.4 %       | 99.4 %                 | 99.4 %                 | 729,580 / 734,232       | 322,134 / 324,189       |
| 2024-25 | 12,586     | 100.0 %    | 99.8 %       | 99.9 %       | 95.1 %       | 100.0 %      | 99.9 %                 | 99.9 %                 | 736,259 / 736,458       | 325,946 / 326,022       |
| 2025-26 | 12,600     | 100.0 %    | 99.8 %       | 99.9 %       | 95.5 %       | 99.9 %       | 99.9 %                 | 99.9 %                 | 740,861 / 741,185       | 331,183 / 331,319       |
| 2026-27 | 1,924      | 99.1 %     | 98.3 %       | 98.8 %       | 94.3 %       | 98.8 %       | 98.9 %                 | 98.9 %                 | 115,137 / 116,265       | 50,324 / 50,820         |

Shots by whom they are credited to: an ESPN athlete through `ncaa_player_ids`, or D28's negative key (kept and counted).

| Season  | Shots   | ESPN athlete | D28's key | No player | No team |
| ------- | ------- | ------------ | --------- | --------- | ------- |
| 2021-22 | 673,623 | 98.9 %       | 7,331     | 0         | 0       |
| 2022-23 | 707,685 | 99.1 %       | 6,569     | 0         | 0       |
| 2023-24 | 729,580 | 99.2 %       | 5,616     | 0         | 0       |
| 2024-25 | 736,259 | 99.4 %       | 4,469     | 0         | 0       |
| 2025-26 | 740,861 | 99.4 %       | 4,087     | 0         | 0       |
| 2026-27 | 115,137 | 99.0 %       | 1,160     | 0         | 0       |

ESPN's shots beside stats.ncaa.org's (`shot_espn`), its made free throws left out of the attempts. Located: a field goal ESPN gives coordinates other than a basket's own point.

| Season  | Team-games both have | FGA equal | FGM equal | Free throws left out | Located |
| ------- | -------------------- | --------- | --------- | -------------------- | ------- |
| 2021-22 | 11,426               | 79.8 %    | 87.1 %    | 196,862              | 12.2 %  |
| 2022-23 | 12,104               | 81.2 %    | 88.0 %    | 216,427              | 8.9 %   |
| 2023-24 | 12,254               | 93.9 %    | 95.7 %    | 232,104              | 6.3 %   |
| 2024-25 | 12,268               | 97.0 %    | 98.3 %    | 219,904              | 26.0 %  |
| 2025-26 | 12,546               | 98.9 %    | 99.7 %    | 253,492              | 99.6 %  |
| 2026-27 | 1,895                | 98.8 %    | 99.7 %    | 40,005               | 99.7 %  |

#### The three-point line

On stats.ncaa.org's located shots, which give each shot's value and its feet from the basket on a half-foot grid across (`x`) and 0.94 feet along (`y`): in the corners (`y` within 4.7 feet of the basket) the widest two and the nearest three across, above them the farthest two and the nearest three from the basket.

| Season  | Corner: widest two (ft) | Corner: nearest three (ft) | Arc: farthest two (ft) | Arc: nearest three (ft) | Corner threes inside 21.65 ft |
| ------- | ----------------------- | -------------------------- | ---------------------- | ----------------------- | ----------------------------- |
| 2021-22 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 683 of 45,706 (1.5 %)         |
| 2022-23 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 558 of 48,712 (1.1 %)         |
| 2023-24 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 624 of 50,444 (1.2 %)         |
| 2024-25 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 640 of 53,495 (1.2 %)         |
| 2025-26 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 601 of 56,654 (1.1 %)         |
| 2026-27 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 102 of 9,763 (1.0 %)          |

#### Units on the floor against the box score

stats.ncaa.org's lineup file, each row a team's stint with five players, summed per team-game (`unit_game`): its minutes against the game's (40 and five an overtime), its points for and against and field-goal attempts against ESPN's team box, its possessions against stats.ncaa.org's team box within 2. Share of seconds with fewer than five known players, and of player-seconds on D28's keys (players no row of `ncaa_player_ids` names).

| Season  | Team-games | With units | Minutes exact (1 s) | Minutes within 1 | Points | Points against | FGA    | Possessions within 2 | Partial units | D28's keys | Lineup rows with no game |
| ------- | ---------- | ---------- | ------------------- | ---------------- | ------ | -------------- | ------ | -------------------- | ------------- | ---------- | ------------------------ |
| 2021-22 | 11,934     | 100.0 %    | 58.3 %              | 64.5 %           | 66.6 % | 65.8 %         | 60.8 % | 58.3 %               | 0.00 %        | 1.59 %     | 0 of 259,513 (0.0 %)     |
| 2022-23 | 12,444     | 100.0 %    | 57.4 %              | 63.9 %           | 66.1 % | 64.9 %         | 60.4 % | 57.9 %               | 0.00 %        | 1.42 %     | 0 of 272,021 (0.0 %)     |
| 2023-24 | 12,486     | 100.0 %    | 59.9 %              | 66.4 %           | 68.2 % | 66.7 %         | 62.8 % | 59.3 %               | 0.00 %        | 1.07 %     | 0 of 276,701 (0.0 %)     |
| 2024-25 | 12,586     | 100.0 %    | 59.3 %              | 65.9 %           | 67.6 % | 66.4 %         | 62.1 % | 58.9 %               | 0.08 %        | 0.58 %     | 0 of 282,737 (0.0 %)     |
| 2025-26 | 12,600     | 99.8 %     | 59.1 %              | 66.0 %           | 67.3 % | 66.4 %         | 61.9 % | 58.3 %               | 0.00 %        | 0.82 %     | 0 of 288,918 (0.0 %)     |
| 2026-27 | 1,924      | 99.1 %     | 48.9 %              | 57.0 %           | 58.4 % | 57.3 %         | 51.9 % | 47.9 %               | 0.00 %        | 1.02 %     | 30 of 45,899 (0.1 %)     |

A player's minutes on the floor (`player_on_court`) against their box-score minutes (ESPN's), over the player-games both have.

| Season  | On-court lines | With a box line | Within 5 s | Within 1 minute | Minutes, on court / box |
| ------- | -------------- | --------------- | ---------- | --------------- | ----------------------- |
| 2021-22 | 119,760        | 98.4 %          | 6.7 %      | 42.1 %          | 0.9834                  |
| 2022-23 | 124,911        | 98.4 %          | 6.5 %      | 41.7 %          | 0.9806                  |
| 2023-24 | 125,555        | 98.9 %          | 6.8 %      | 43.3 %          | 0.9811                  |
| 2024-25 | 127,031        | 99.4 %          | 7.1 %      | 42.9 %          | 0.9764                  |
| 2025-26 | 126,915        | 99.0 %          | 7.0 %      | 42.4 %          | 0.9807                  |
| 2026-27 | 21,972         | 98.8 %          | 6.3 %      | 42.2 %          | 0.9726                  |

#### Stints against the game

stats.ncaa.org's ten-player stints (`stint`) summed per game: their seconds against the game's within a second, and both sides' points against the final score.

| Season  | Games | With stints | Seconds equal | Points equal the score | Stints with a side unplaced |
| ------- | ----- | ----------- | ------------- | ---------------------- | --------------------------- |
| 2021-22 | 5,967 | 99.9 %      | 0.0 %         | 99.8 %                 | 0                           |
| 2022-23 | 6,222 | 99.9 %      | 0.0 %         | 99.9 %                 | 0                           |
| 2023-24 | 6,243 | 100.0 %     | 0.0 %         | 100.0 %                | 0                           |
| 2024-25 | 6,293 | 100.0 %     | 0.0 %         | 100.0 %                | 0                           |
| 2025-26 | 6,300 | 99.9 %      | 0.0 %         | 99.9 %                 | 0                           |
| 2026-27 | 962   | 99.1 %      | 0.0 %         | 99.0 %                 | 0                           |

#### Possessions against the team box

stats.ncaa.org's possessions (`possession`) counted per team-game against its team box's possessions (`ncaa_poss`, an estimate it publishes), and their points against ESPN's team points.

| Season  | Team-games | With possessions | Within 2 of the box | Mean difference | Points equal | Season, file / box |
| ------- | ---------- | ---------------- | ------------------- | --------------- | ------------ | ------------------ |
| 2021-22 | 11,934     | 99.8 %           | 99.8 %              | 0.03            | 84.8 %       | 828,885 / 830,133  |
| 2022-23 | 12,444     | 99.7 %           | 99.7 %              | 0.03            | 81.1 %       | 861,561 / 863,356  |
| 2023-24 | 12,486     | 99.8 %           | 99.8 %              | 0.02            | 84.7 %       | 870,420 / 872,219  |
| 2024-25 | 12,586     | 99.8 %           | 99.8 %              | 0.02            | 86.0 %       | 872,163 / 873,221  |
| 2025-26 | 12,600     | 99.9 %           | 99.8 %              | 0.02            | 86.4 %       | 878,168 / 878,714  |
| 2026-27 | 1,924      | 99.1 %           | 99.0 %              | 0.02            | 85.1 %       | 138,044 / 137,920  |

#### The published models through the engine

SportsDataverse's values (D44) as the engine answers them over every counted game of a season, each row a Division I team or a player with a box score, against the file's value (a player of two rows: their weighted mean). Stored times what it was fitted on and divided back, so equal to nine decimals.

| Season  | Metric             | Rows  | Equal to the file        | Check |
| ------- | ------------------ | ----- | ------------------------ | ----- |
| 2021-22 | sdv_adj_em         | 358   | 358 of 358 (100.0 %)     | ok    |
| 2021-22 | sdv_adj_o          | 358   | 358 of 358 (100.0 %)     | ok    |
| 2021-22 | sdv_box_bpm        | 5,071 | 5,071 of 5,071 (100.0 %) | ok    |
| 2021-22 | sdv_ncaa_rapm      | 5,000 | 4,896 of 4,896 (100.0 %) | ok    |
| 2021-22 | sdv_ncaa_team_rapm | 5,000 | 3,982 of 3,982 (100.0 %) | ok    |
| 2025-26 | sdv_adj_em         | 365   | 365 of 365 (100.0 %)     | ok    |
| 2025-26 | sdv_adj_o          | 365   | 365 of 365 (100.0 %)     | ok    |
| 2025-26 | sdv_box_bpm        | 5,015 | 5,015 of 5,015 (100.0 %) | ok    |
| 2025-26 | sdv_ncaa_rapm      | 5,000 | 4,969 of 4,969 (100.0 %) | ok    |
| 2025-26 | sdv_ncaa_team_rapm | 5,000 | 4,117 of 4,117 (100.0 %) | ok    |

Division I players with a box-score line, and those with 300 minutes or more (BPM's own qualifier), with a value in each published file. A RAPM row no `ncaa_player_ids` row names keeps D28's negative key.

| Season  | Players | 300 min + | BPM    | BPM, 300 min + | RAPM   | RAPM, 300 min + | RAPM within team, 300 min + | RAPM rows on D28's keys |
| ------- | ------- | --------- | ------ | -------------- | ------ | --------------- | --------------------------- | ----------------------- |
| 2021-22 | 5,091   | 2,965     | 99.6 % | 100.0 %        | 96.2 % | 98.2 %          | 97.9 %                      | 42 of 4,942 (0.8 %)     |
| 2022-23 | 5,102   | 3,024     | 99.8 % | 100.0 %        | 95.8 % | 97.6 %          | 97.5 %                      | 54 of 4,942 (1.1 %)     |
| 2023-24 | 5,063   | 3,056     | 99.9 % | 100.0 %        | 96.6 % | 97.8 %          | 97.7 %                      | 29 of 4,919 (0.6 %)     |
| 2024-25 | 5,119   | 3,062     | 99.9 % | 100.0 %        | 96.5 % | 98.3 %          | 98.0 %                      | 17 of 4,960 (0.3 %)     |
| 2025-26 | 5,019   | 3,114     | 99.9 % | 100.0 %        | 99.0 % | 100.0 %         | 99.7 %                      | 4 of 4,974 (0.1 %)      |
| 2026-27 | 4,978   | 0         | 99.5 % | – %            | 0.0 %  | – %             | – %                         | –                       |

SportsDataverse's team ratings against an efficiency the tables give: each Division I team's points per 100 of stats.ncaa.org's possessions over its counted games. Its unadjusted ratings are over ESPN's box scores and its own possession estimate, so they are compared by correlation and mean difference, not equality.

| Season  | Division I teams | Rated   | Same games | Raw O: r | Raw O − ORtg | Raw D: r | Raw D − DRtg | AdjEM against net rating: r |
| ------- | ---------------- | ------- | ---------- | -------- | ------------ | -------- | ------------ | --------------------------- |
| 2021-22 | 358              | 100.0 % | 99.4 %     | 0.995    | 1.39         | 0.994    | 1.58         | 0.785                       |
| 2022-23 | 363              | 100.0 % | 99.2 %     | 0.994    | 1.37         | 0.991    | 1.55         | 0.790                       |
| 2023-24 | 362              | 100.0 % | 97.8 %     | 0.996    | 1.39         | 0.993    | 1.57         | 0.790                       |
| 2024-25 | 364              | 100.0 % | 96.2 %     | 0.994    | 1.43         | 0.992    | 1.64         | 0.774                       |
| 2025-26 | 365              | 100.0 % | 99.2 %     | 0.994    | 1.51         | 0.990    | 1.71         | 0.785                       |
| 2026-27 | 365              | 100.0 % | 99.7 %     | 0.906    | 0.72         | 0.898    | 0.99         | 0.727                       |

#### Through the engine

Every player row of the engine's board over every counted game (players of Division I teams, D40), its rim attempts and above-the-break threes made (`shot_player_game`) and its on-court minutes and plus-minus (`player_on_court`), against the tables summed directly.

| Season  | Rows  | Shots equal             | On-court equal          |
| ------- | ----- | ----------------------- | ----------------------- |
| 2021-22 | 5,091 | 5,037 of 5,091 (98.9 %) | 5,035 of 5,091 (98.9 %) |
| 2025-26 | 5,019 | 5,014 of 5,019 (99.9 %) | 5,014 of 5,019 (99.9 %) |

## NCAA Division I women's agreement checks

### Games and teams

| Season  | Counted games | Division I teams | NCAA tournament | Exhibitions | Forfeits | Only stats.ncaa.org's | Check |
| ------- | ------------- | ---------------- | --------------- | ----------- | -------- | --------------------- | ----- |
| 2021-22 | 5,534         | 356              | 67              | 0           | 22       | 0                     | ok    |
| 2022-23 | 5,828         | 361              | 67              | 1           | 8        | 0                     | ok    |
| 2023-24 | 5,909         | 360              | 67              | 1           | 10       | 1                     | ok    |
| 2024-25 | 5,968         | 362              | 67              | 1           | 3        | 334                   | ok    |
| 2025-26 | 6,030         | 363              | 67              | 0           | 1        | 0                     | ok    |
| 2026-27 | 940           | 363              | 0               | 0           | 0        | 0                     | ok    |

### Team-games and their box scores

A team-game's counts are ESPN's team box where its lines are ESPN's, stats.ncaa.org's where ESPN has none, and the players summed where neither box has a count. A forfeit has no box score.

| Season  | Team-games | ESPN's | stats.ncaa.org's | No box score (forfeits) | Points equal the score |
| ------- | ---------- | ------ | ---------------- | ----------------------- | ---------------------- |
| 2021-22 | 11,068     | 11,024 | 0                | 44                      | 11,024 (100.0 %)       |
| 2022-23 | 11,656     | 11,628 | 12               | 16                      | 11,640 (100.0 %)       |
| 2023-24 | 11,818     | 11,795 | 3                | 20                      | 11,798 (100.0 %)       |
| 2024-25 | 11,936     | 11,262 | 670              | 4                       | 11,931 (100.0 %)       |
| 2025-26 | 12,060     | 12,058 | 0                | 2                       | 12,058 (100.0 %)       |
| 2026-27 | 1,880      | 1,880  | 0                | 0                       | 1,880 (100.0 %)        |

### Team totals against ESPN's team box

Every count of the team-games whose box is ESPN's against ESPN's team box: the tables read it, so anything short of 100 % is a team-game where ESPN's box lacks a count and the players' sum stands in.

| Season  | Team-games | pts   | fgm   | fga   | fg3m  | fg3a  | ftm   | fta   | oreb  | dreb  | reb   | ast   | stl   | blk   | tov   | pf    |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| 2021-22 | 11,024     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2022-23 | 11,628     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2023-24 | 11,795     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2024-25 | 11,252     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2025-26 | 12,058     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2026-27 | 1,880      | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |

### The two families' team boxes

ESPN's team totals (the tables') against stats.ncaa.org's team box for the same team-game, linked by the contest and the team's ESPN id. Both count the team rebounds and the team's own turnovers.

| Season  | Team-games | pts   | fgm   | fga   | fg3m  | fg3a  | ftm   | fta   | oreb  | dreb  | ast  | blk  | tov   |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- | ---- | ----- |
| 2021-22 | 10,477     | 99.8  | 99.8  | 99.2  | 99.9  | 99.6  | 99.9  | 99.8  | 98.7  | 98.6  | 96.8 | 98.6 | 98.7  |
| 2022-23 | 11,176     | 99.9  | 99.8  | 99.7  | 100.0 | 99.9  | 99.9  | 99.9  | 98.7  | 98.6  | 97.5 | 99.0 | 99.1  |
| 2023-24 | 11,279     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.6  | 98.4  | 98.8 | 98.9 | 98.9  |
| 2024-25 | 10,773     | 100.0 | 100.0 | 99.9  | 100.0 | 99.9  | 100.0 | 100.0 | 99.9  | 99.8  | 98.8 | 99.0 | 99.9  |
| 2025-26 | 11,500     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.2 | 98.7 | 100.0 |
| 2026-27 | 1,654      | 99.8  | 99.8  | 98.7  | 99.9  | 99.1  | 99.9  | 99.8  | 99.2  | 99.1  | 97.3 | 97.9 | 99.3  |

### Player sums against the team's lines

Each team-game's player lines summed against its team line. Rebounds and turnovers are compared as at most the team's, since the team box adds the team rebounds and the team's own turnovers.

| Season  | Team-games | pts   | fgm   | fga   | fg3m  | fta   | ftm   | ast   | stl   | blk   | reb ≤ | tov ≤ | pf   |
| ------- | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
| 2021-22 | 11,024     | 99.9  | 99.9  | 99.8  | 100.0 | 99.9  | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 100.0 | 99.2 |
| 2022-23 | 11,640     | 99.9  | 99.9  | 99.8  | 100.0 | 99.9  | 99.9  | 99.9  | 100.0 | 99.9  | 100.0 | 100.0 | 99.1 |
| 2023-24 | 11,798     | 99.9  | 99.9  | 99.9  | 100.0 | 99.9  | 100.0 | 99.9  | 99.9  | 100.0 | 100.0 | 100.0 | 99.3 |
| 2024-25 | 11,932     | 99.9  | 99.9  | 99.8  | 100.0 | 99.9  | 99.9  | 99.9  | 100.0 | 99.9  | 100.0 | 100.0 | 98.8 |
| 2025-26 | 12,058     | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 98.5 |
| 2026-27 | 1,880      | 99.1  | 99.3  | 99.1  | 99.8  | 99.7  | 99.8  | 99.6  | 99.7  | 99.9  | 100.0 | 100.0 | 98.3 |

### The two families' player lines

ESPN's lines (the counts) with stats.ncaa.org's line for the same player and game beside them (`ncaa_*`, D40). "Paired" is the share of ESPN's lines with one; the rest are players stats.ncaa.org's lines map to no ESPN athlete (T1302.4). "Every" asks points, every attempt and make, and turnovers all equal. stats.ncaa.org's lines stand alone only for the team-games ESPN has none of.

| Season  | ESPN's lines | Paired           | Points | FG    | 3FG   | FT    | Every | stats.ncaa.org's alone |
| ------- | ------------ | ---------------- | ------ | ----- | ----- | ----- | ----- | ---------------------- |
| 2021-22 | 112,116      | 111,839 (99.8 %) | 99.7   | 99.6  | 99.8  | 99.9  | 99.4  | 0                      |
| 2022-23 | 117,496      | 116,944 (99.5 %) | 100.0  | 99.9  | 100.0 | 100.0 | 99.9  | 142                    |
| 2023-24 | 118,519      | 118,251 (99.8 %) | 100.0  | 100.0 | 100.0 | 100.0 | 100.0 | 36                     |
| 2024-25 | 114,549      | 114,269 (99.8 %) | 100.0  | 100.0 | 100.0 | 100.0 | 100.0 | 6,723                  |
| 2025-26 | 122,138      | 121,365 (99.4 %) | 99.9   | 99.9  | 100.0 | 100.0 | 99.9  | 0                      |
| 2026-27 | 20,399       | 20,271 (99.4 %)  | 99.9   | 99.6  | 99.8  | 99.9  | 99.4  | 0                      |

| Season  | Lines with splits | Rim + mid + three = FGA | Transition, assisted and putbacks within their totals |
| ------- | ----------------- | ----------------------- | ----------------------------------------------------- |
| 2021-22 | 111,839           | 100.0                   | 100.0                                                 |
| 2022-23 | 117,109           | 100.0                   | 100.0                                                 |
| 2023-24 | 118,309           | 100.0                   | 100.0                                                 |
| 2024-25 | 121,017           | 100.0                   | 100.0                                                 |
| 2025-26 | 121,365           | 100.0                   | 100.0                                                 |
| 2026-27 | 20,271            | 100.0                   | 100.0                                                 |

### Game rows against season rows

Each player's season row of no team against their game rows summed (games, points, stats.ncaa.org's points). Must hold everywhere.

| Season  | Player-seasons | Equal           |
| ------- | -------------- | --------------- |
| 2021-22 | 8,859          | 8,859 (100.0 %) |
| 2022-23 | 8,846          | 8,846 (100.0 %) |
| 2023-24 | 9,240          | 9,240 (100.0 %) |
| 2024-25 | 9,627          | 9,627 (100.0 %) |
| 2025-26 | 9,813          | 9,813 (100.0 %) |
| 2026-27 | 6,713          | 6,713 (100.0 %) |

### Records against ESPN's standings

Each Division I team's wins and losses over every counted game against ESPN's standings, which count every game, the postseason with it. A team whose record differs and that has a forfeit is counted apart: ESPN's standings and its schedule's 2-0 rows do not always agree on a forfeit.

| Season  | Teams | Equal         | Differ, with a forfeit |
| ------- | ----- | ------------- | ---------------------- |
| 2021-22 | 356   | 327 (91.9 %)  | 29                     |
| 2022-23 | 361   | 350 (97.0 %)  | 11                     |
| 2023-24 | 359   | 344 (95.8 %)  | 14                     |
| 2024-25 | 362   | 359 (99.2 %)  | 3                      |
| 2025-26 | 363   | 361 (99.4 %)  | 2                      |
| 2026-27 | 363   | 363 (100.0 %) | 0                      |

### Through the engine

Every Division I team's points, rebounds and stats.ncaa.org possessions over every counted game, as the engine answers them, against the table summed directly; and the season's first three scorers per game under the 75 % rule (D43). Teams outside Division I are not rows of a board (D40).

| Season  | Teams equal           | Leading scorers                                                                   |
| ------- | --------------------- | --------------------------------------------------------------------------------- |
| 2021-22 | 356 of 356 (356 rows) | Caitlin Clark 27.0 (32 g); Maddy Siegrist 25.3 (27 g); Jasmine Dickey 25.2 (31 g) |
| 2025-26 | 363 of 363 (363 rows) | Mikayla Blakes 27.0 (34 g); Audi Crooks 25.8 (31 g); Hannah Hidalgo 25.3 (36 g)   |

### The depth (T1302.6)

stats.ncaa.org's shots, lineups, stints and possessions, ESPN's shots, and SportsDataverse's published models, per season. A team-game is counted with a box score, exhibitions out.

#### Shots against the box score

stats.ncaa.org's located shots summed per team-game (`shot_team_game`) against ESPN's team box (the app's counts, D40) and stats.ncaa.org's own (`ncaa_fga`). Exact unless the column says within 2.

| Season  | Team-games | With shots | FGA = ESPN's | FGM = ESPN's | 3PA = ESPN's | FGA within 2 | FGA = stats.ncaa.org's | FGM = stats.ncaa.org's | Season FGA, shots / box | Season FGM, shots / box |
| ------- | ---------- | ---------- | ------------ | ------------ | ------------ | ------------ | ---------------------- | ---------------------- | ----------------------- | ----------------------- |
| 2021-22 | 11,024     | 97.2 %     | 96.4 %       | 96.9 %       | 86.1 %       | 96.9 %       | 97.0 %                 | 97.0 %                 | 630,038 / 648,053       | 252,493 / 259,598       |
| 2022-23 | 11,640     | 98.9 %     | 98.5 %       | 98.6 %       | 89.3 %       | 98.6 %       | 98.7 %                 | 98.7 %                 | 673,097 / 680,220       | 271,996 / 274,734       |
| 2023-24 | 11,798     | 99.4 %     | 99.1 %       | 99.1 %       | 91.6 %       | 99.2 %       | 99.2 %                 | 99.2 %                 | 688,869 / 692,849       | 279,566 / 281,062       |
| 2024-25 | 11,932     | 99.8 %     | 99.5 %       | 99.6 %       | 92.7 %       | 99.6 %       | 99.6 %                 | 99.6 %                 | 695,511 / 696,988       | 283,653 / 284,236       |
| 2025-26 | 12,058     | 99.8 %     | 99.5 %       | 99.5 %       | 93.3 %       | 99.6 %       | 99.5 %                 | 99.5 %                 | 708,038 / 709,510       | 286,440 / 287,020       |
| 2026-27 | 1,880      | 99.9 %     | 98.6 %       | 99.6 %       | 93.5 %       | 99.6 %       | 99.6 %                 | 99.7 %                 | 112,389 / 112,532       | 45,306 / 45,360         |

Shots by whom they are credited to: an ESPN athlete through `ncaa_player_ids`, or D28's negative key (kept and counted).

| Season  | Shots   | ESPN athlete | D28's key | No player | No team |
| ------- | ------- | ------------ | --------- | --------- | ------- |
| 2021-22 | 630,038 | 98.6 %       | 8,978     | 0         | 0       |
| 2022-23 | 673,225 | 98.9 %       | 7,373     | 0         | 0       |
| 2023-24 | 688,992 | 98.9 %       | 7,604     | 0         | 0       |
| 2024-25 | 695,639 | 99.2 %       | 5,515     | 0         | 0       |
| 2025-26 | 708,038 | 99.4 %       | 4,560     | 0         | 0       |
| 2026-27 | 112,389 | 99.3 %       | 834       | 0         | 0       |

ESPN's shots beside stats.ncaa.org's (`shot_espn`), its made free throws left out of the attempts. Located: a field goal ESPN gives coordinates other than a basket's own point.

| Season  | Team-games both have | FGA equal | FGM equal | Free throws left out | Located |
| ------- | -------------------- | --------- | --------- | -------------------- | ------- |
| 2021-22 | 10,468               | 87.9 %    | 93.4 %    | 167,922              | 4.0 %   |
| 2022-23 | 11,293               | 87.7 %    | 93.7 %    | 188,712              | 4.4 %   |
| 2023-24 | 11,500               | 93.8 %    | 95.5 %    | 187,735              | 4.6 %   |
| 2024-25 | 10,928               | 97.7 %    | 98.9 %    | 166,346              | 25.1 %  |
| 2025-26 | 11,999               | 99.1 %    | 99.6 %    | 199,946              | 99.7 %  |
| 2026-27 | 1,870                | 99.0 %    | 99.6 %    | 33,294               | 99.8 %  |

#### The three-point line

On stats.ncaa.org's located shots, which give each shot's value and its feet from the basket on a half-foot grid across (`x`) and 0.94 feet along (`y`): in the corners (`y` within 4.7 feet of the basket) the widest two and the nearest three across, above them the farthest two and the nearest three from the basket.

| Season  | Corner: widest two (ft) | Corner: nearest three (ft) | Arc: farthest two (ft) | Arc: nearest three (ft) | Corner threes inside 21.65 ft |
| ------- | ----------------------- | -------------------------- | ---------------------- | ----------------------- | ----------------------------- |
| 2021-22 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 616 of 35,255 (1.7 %)         |
| 2022-23 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 495 of 38,726 (1.3 %)         |
| 2023-24 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 519 of 40,551 (1.3 %)         |
| 2024-25 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 545 of 42,189 (1.3 %)         |
| 2025-26 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 596 of 45,002 (1.3 %)         |
| 2026-27 | 20.50                   | 21.00                      | 22.150                 | 22.260                  | 109 of 7,967 (1.4 %)          |

#### Units on the floor against the box score

stats.ncaa.org's lineup file, each row a team's stint with five players, summed per team-game (`unit_game`): its minutes against the game's (40 and five an overtime), its points for and against and field-goal attempts against ESPN's team box, its possessions against stats.ncaa.org's team box within 2. Share of seconds with fewer than five known players, and of player-seconds on D28's keys (players no row of `ncaa_player_ids` names).

| Season  | Team-games | With units | Minutes exact (1 s) | Minutes within 1 | Points | Points against | FGA    | Possessions within 2 | Partial units | D28's keys | Lineup rows with no game |
| ------- | ---------- | ---------- | ------------------- | ---------------- | ------ | -------------- | ------ | -------------------- | ------------- | ---------- | ------------------------ |
| 2021-22 | 11,024     | 99.9 %     | 56.2 %              | 62.3 %           | 65.1 % | 63.7 %         | 58.7 % | 54.8 %               | 0.00 %        | 1.19 %     | 0 of 250,040 (0.0 %)     |
| 2022-23 | 11,640     | 100.0 %    | 54.9 %              | 61.7 %           | 64.5 % | 62.9 %         | 57.7 % | 54.8 %               | 0.00 %        | 1.13 %     | 0 of 267,546 (0.0 %)     |
| 2023-24 | 11,798     | 99.9 %     | 55.2 %              | 61.9 %           | 64.6 % | 63.7 %         | 58.1 % | 55.7 %               | 0.00 %        | 1.07 %     | 0 of 272,294 (0.0 %)     |
| 2024-25 | 11,932     | 99.9 %     | 53.7 %              | 60.1 %           | 64.8 % | 63.5 %         | 58.4 % | 55.6 %               | 0.00 %        | 0.27 %     | 0 of 277,406 (0.0 %)     |
| 2025-26 | 12,058     | 99.8 %     | 56.0 %              | 63.0 %           | 65.7 % | 64.3 %         | 59.1 % | 56.1 %               | 0.00 %        | 0.34 %     | 0 of 286,277 (0.0 %)     |
| 2026-27 | 1,880      | 100.0 %    | 51.6 %              | 59.8 %           | 62.1 % | 61.3 %         | 54.7 % | 50.0 %               | 0.00 %        | 0.47 %     | 0 of 47,254 (0.0 %)      |

A player's minutes on the floor (`player_on_court`) against their box-score minutes (ESPN's), over the player-games both have.

| Season  | On-court lines | With a box line | Within 5 s | Within 1 minute | Minutes, on court / box |
| ------- | -------------- | --------------- | ---------- | --------------- | ----------------------- |
| 2021-22 | 111,414        | 98.6 %          | 6.2 %      | 40.5 %          | 0.9708                  |
| 2022-23 | 117,133        | 98.7 %          | 5.9 %      | 39.6 %          | 0.9717                  |
| 2023-24 | 118,024        | 98.8 %          | 5.9 %      | 39.8 %          | 0.9722                  |
| 2024-25 | 120,707        | 99.8 %          | 7.0 %      | 41.4 %          | 0.9648                  |
| 2025-26 | 121,465        | 99.5 %          | 6.7 %      | 41.0 %          | 0.9682                  |
| 2026-27 | 20,362         | 99.3 %          | 6.2 %      | 41.1 %          | 0.9676                  |

#### Stints against the game

stats.ncaa.org's ten-player stints (`stint`) summed per game: their seconds against the game's within a second, and both sides' points against the final score.

| Season  | Games | With stints | Seconds equal | Points equal the score | Stints with a side unplaced |
| ------- | ----- | ----------- | ------------- | ---------------------- | --------------------------- |
| 2021-22 | 5,512 | 99.9 %      | 0.0 %         | 99.7 %                 | 0                           |
| 2022-23 | 5,820 | 99.9 %      | 0.0 %         | 99.9 %                 | 0                           |
| 2023-24 | 5,899 | 99.9 %      | 0.0 %         | 99.9 %                 | 0                           |
| 2024-25 | 5,965 | 99.8 %      | 0.0 %         | 99.8 %                 | 0                           |
| 2025-26 | 6,029 | 99.7 %      | 0.0 %         | 99.7 %                 | 0                           |
| 2026-27 | 940   | 100.0 %     | 0.0 %         | 99.9 %                 | 0                           |

#### Possessions against the team box

stats.ncaa.org's possessions (`possession`) counted per team-game against its team box's possessions (`ncaa_poss`, an estimate it publishes), and their points against ESPN's team points.

| Season  | Team-games | With possessions | Within 2 of the box | Mean difference | Points equal | Season, file / box |
| ------- | ---------- | ---------------- | ------------------- | --------------- | ------------ | ------------------ |
| 2021-22 | 11,024     | 99.6 %           | 99.6 %              | 0.04            | 92.8 %       | 782,395 / 784,473  |
| 2022-23 | 11,640     | 99.8 %           | 99.8 %              | 0.04            | 92.7 %       | 829,694 / 830,630  |
| 2023-24 | 11,798     | 99.8 %           | 99.8 %              | 0.03            | 93.3 %       | 840,786 / 841,468  |
| 2024-25 | 11,932     | 99.7 %           | 99.6 %              | 0.03            | 93.8 %       | 848,961 / 849,972  |
| 2025-26 | 12,058     | 99.7 %           | 99.6 %              | 0.03            | 90.0 %       | 862,483 / 863,806  |
| 2026-27 | 1,880      | 100.0 %          | 100.0 %             | 0.04            | 90.5 %       | 139,280 / 139,208  |

#### The published models through the engine

SportsDataverse's values (D44) as the engine answers them over every counted game of a season, each row a Division I team or a player with a box score, against the file's value (a player of two rows: their weighted mean). Stored times what it was fitted on and divided back, so equal to nine decimals.

| Season  | Metric             | Rows  | Equal to the file        | Check |
| ------- | ------------------ | ----- | ------------------------ | ----- |
| 2021-22 | sdv_adj_em         | 356   | 356 of 356 (100.0 %)     | ok    |
| 2021-22 | sdv_adj_o          | 356   | 356 of 356 (100.0 %)     | ok    |
| 2021-22 | sdv_box_bpm        | 4,806 | 4,798 of 4,798 (100.0 %) | ok    |
| 2021-22 | sdv_ncaa_rapm      | 4,806 | 4,607 of 4,607 (100.0 %) | ok    |
| 2021-22 | sdv_ncaa_team_rapm | 4,806 | 4,023 of 4,023 (100.0 %) | ok    |
| 2025-26 | sdv_adj_em         | 363   | 363 of 363 (100.0 %)     | ok    |
| 2025-26 | sdv_adj_o          | 363   | 363 of 363 (100.0 %)     | ok    |
| 2025-26 | sdv_box_bpm        | 4,694 | 4,692 of 4,692 (100.0 %) | ok    |
| 2025-26 | sdv_ncaa_rapm      | 4,694 | 4,594 of 4,594 (100.0 %) | ok    |
| 2025-26 | sdv_ncaa_team_rapm | 4,694 | 4,090 of 4,090 (100.0 %) | ok    |

Division I players with a box-score line, and those with 300 minutes or more (BPM's own qualifier), with a value in each published file. A RAPM row no `ncaa_player_ids` row names keeps D28's negative key.

| Season  | Players | 300 min + | BPM     | BPM, 300 min + | RAPM   | RAPM, 300 min + | RAPM within team, 300 min + | RAPM rows on D28's keys |
| ------- | ------- | --------- | ------- | -------------- | ------ | --------------- | --------------------------- | ----------------------- |
| 2021-22 | 4,806   | 2,899     | 99.8 %  | 100.0 %        | 95.9 % | 96.4 %          | 96.4 %                      | 55 of 4,666 (1.2 %)     |
| 2022-23 | 4,713   | 2,982     | 99.8 %  | 100.0 %        | 96.5 % | 97.5 %          | 97.2 %                      | 57 of 4,606 (1.2 %)     |
| 2023-24 | 4,696   | 3,008     | 99.9 %  | 100.0 %        | 96.0 % | 97.2 %          | 96.9 %                      | 45 of 4,557 (1.0 %)     |
| 2024-25 | 4,738   | 2,989     | 99.9 %  | 100.0 %        | 97.2 % | 97.9 %          | 97.3 %                      | 19 of 4,623 (0.4 %)     |
| 2025-26 | 4,694   | 3,012     | 100.0 % | 100.0 %        | 97.9 % | 98.6 %          | 98.0 %                      | 2 of 4,596 (0.0 %)      |
| 2026-27 | 4,443   | 0         | 99.9 %  | – %            | 0.0 %  | – %             | – %                         | –                       |

SportsDataverse's team ratings against an efficiency the tables give: each Division I team's points per 100 of stats.ncaa.org's possessions over its counted games. Its unadjusted ratings are over ESPN's box scores and its own possession estimate, so they are compared by correlation and mean difference, not equality.

| Season  | Division I teams | Rated   | Same games | Raw O: r | Raw O − ORtg | Raw D: r | Raw D − DRtg | AdjEM against net rating: r |
| ------- | ---------------- | ------- | ---------- | -------- | ------------ | -------- | ------------ | --------------------------- |
| 2021-22 | 356              | 100.0 % | 100.0 %    | 0.997    | 1.13         | 0.993    | 1.24         | 0.812                       |
| 2022-23 | 361              | 100.0 % | 98.6 %     | 0.997    | 1.13         | 0.993    | 1.24         | 0.827                       |
| 2023-24 | 360              | 100.0 % | 99.7 %     | 0.997    | 1.01         | 0.994    | 1.11         | 0.822                       |
| 2024-25 | 362              | 100.0 % | 28.7 %     | 0.986    | 0.87         | 0.963    | 1.03         | 0.834                       |
| 2025-26 | 363              | 100.0 % | 100.0 %    | 0.982    | 0.75         | 0.965    | 0.88         | 0.832                       |
| 2026-27 | 363              | 100.0 % | 100.0 %    | 0.996    | 1.04         | 0.996    | 1.26         | 0.751                       |

#### Through the engine

Every player row of the engine's board over every counted game (players of Division I teams, D40), its rim attempts and above-the-break threes made (`shot_player_game`) and its on-court minutes and plus-minus (`player_on_court`), against the tables summed directly.

| Season  | Rows  | Shots equal             | On-court equal          |
| ------- | ----- | ----------------------- | ----------------------- |
| 2021-22 | 4,806 | 4,762 of 4,806 (99.1 %) | 4,762 of 4,806 (99.1 %) |
| 2025-26 | 4,694 | 4,688 of 4,694 (99.9 %) | 4,688 of 4,694 (99.9 %) |

## Men's champions against the NCAA's record books

The engine leads each category among qualified players over every counted game (D45), under the 75 % rule for the per-game categories, and for the percentages and the assist-to-turnover ratio the counts per game played with the 75 % rule (D43). "Leader" says whether its first row is the champion; "Line" whether the champion's games and totals equal the book's.

| Category                              | Season | Champion (book)                  | Book line      | Leader  | App leader            | App line for the champion            | Line    |
| ------------------------------------- | ------ | -------------------------------- | -------------- | ------- | --------------------- | ------------------------------------ | ------- |
| Scoring average                       | 2022   | Peter Kiss, Bryant               | 27 / 680       | same    |                       | 27 / 680                             | equal   |
| Scoring average                       | 2023   | Antoine Davis, Detroit Mercy     | 33 / 930       | same    |                       | 33 / 930                             | equal   |
| Scoring average                       | 2024   | Zach Edey, Purdue                | 39 / 983       | same    |                       | 39 / 983                             | equal   |
| Scoring average                       | 2025   | Eric Dixon, Villanova            | 35 / 815       | same    |                       | 35 / 815                             | equal   |
| Scoring average                       | 2026   | AJ Dybantsa, BYU                 | 35 / 894       | same    |                       | 35 / 894                             | equal   |
| Field-goal percentage                 | 2022   | Enrique Freeman, Akron           | 34 / 175 / 263 | same    |                       | 34 / 175 / 263                       | equal   |
| Field-goal percentage                 | 2023   | Max Fiedler, Rice                | 35 / 175 / 238 | same    |                       | 35 / 175 / 238                       | equal   |
| Field-goal percentage                 | 2024   | AJ Braun, Wright St.             | 32 / 164 / 238 | same    |                       | 32 / 164 / 238                       | equal   |
| Field-goal percentage                 | 2025   | Max Brooks, UMass Lowell         | 32 / 217 / 308 | same    |                       | 32 / 217 / 308                       | equal   |
| Field-goal percentage                 | 2026   | Aidan Kehoe, Navy                | 34 / 220 / 301 | same    |                       | 34 / 220 / 301                       | equal   |
| Three-point field goals made per game | 2022   | Darius McGhee, Liberty           | 33 / 142       | same    |                       | 33 / 142                             | equal   |
| Three-point field goals made per game | 2023   | Antoine Davis, Detroit Mercy     | 33 / 159       | same    |                       | 33 / 159                             | equal   |
| Three-point field goals made per game | 2024   | Jack Gohlke, Oakland             | 36 / 137       | same    |                       | 36 / 137                             | equal   |
| Three-point field goals made per game | 2025   | Abdi Bashir Jr., Monmouth        | 33 / 127       | same    |                       | 33 / 127                             | equal   |
| Three-point field goals made per game | 2026   | Jadin Booth, Samford             | 30 / 127       | same    |                       | 30 / 127                             | equal   |
| Three-point field-goal percentage     | 2022   | Kyle Foster, Howard              | 29 / 105 / 229 | differs | Jake Kosakowski 0.473 | 29 / 105 / 229                       | equal   |
| Three-point field-goal percentage     | 2023   | Jordan Johnson, New Orleans      | 27 / 93 / 193  | same    |                       | 1 / 0 / 2; 31 / 0 / 0; 27 / 93 / 193 | equal   |
| Three-point field-goal percentage     | 2024   | Koby Brea, Dayton                | 33 / 100 / 201 | same    |                       | 33 / 100 / 201                       | equal   |
| Three-point field-goal percentage     | 2025   | Tyler Lundblade, Belmont         | 33 / 104 / 216 | same    |                       | 33 / 104 / 216                       | equal   |
| Three-point field-goal percentage     | 2026   | Milan Momcilovic, Iowa St.       | 37 / 136 / 279 | same    |                       | 37 / 136 / 279                       | equal   |
| Free-throw percentage                 | 2022   | Foster Loyer, Davidson           | 29 / 118 / 126 | same    |                       | 29 / 116 / 124                       | differs |
| Free-throw percentage                 | 2023   | Walter Clayton Jr., Iona         | 32 / 102 / 107 | same    |                       | 32 / 102 / 107                       | equal   |
| Free-throw percentage                 | 2024   | DJ Davis, Butler                 | 33 / 95 / 100  | same    |                       | 33 / 95 / 100                        | equal   |
| Free-throw percentage                 | 2025   | Tamar Bates, Missouri            | 34 / 87 / 92   | same    |                       | 34 / 87 / 92                         | equal   |
| Free-throw percentage                 | 2026   | Tyler Lundblade, Belmont         | 32 / 85 / 91   | same    |                       | 32 / 85 / 91                         | equal   |
| Rebound average                       | 2022   | Oscar Tshiebwe, Kentucky         | 34 / 515       | same    |                       | 34 / 515                             | equal   |
| Rebound average                       | 2023   | Oscar Tshiebwe, Kentucky         | 32 / 437       | same    |                       | 32 / 437                             | equal   |
| Rebound average                       | 2024   | Enrique Freeman, Akron           | 35 / 453       | same    |                       | 35 / 453                             | equal   |
| Rebound average                       | 2025   | Carson Towt, Northern Ariz.      | 34 / 423       | same    |                       | 34 / 423                             | equal   |
| Rebound average                       | 2026   | Hannes Steinbach, Washington     | 30 / 353       | same    |                       | 30 / 353                             | equal   |
| Assist average                        | 2022   | Yuri Collins, Saint Louis        | 34 / 267       | same    |                       | 34 / 267                             | equal   |
| Assist average                        | 2023   | Yuri Collins, Saint Louis        | 32 / 324       | same    |                       | 32 / 324                             | equal   |
| Assist average                        | 2024   | Tyler Kolek, Marquette           | 31 / 239       | same    |                       | 31 / 239                             | equal   |
| Assist average                        | 2025   | Ryan Nembhard, Gonzaga           | 35 / 344       | same    |                       | 35 / 344                             | equal   |
| Assist average                        | 2026   | Jeremy Fears Jr., Michigan St.   | 35 / 328       | same    |                       | 35 / 328                             | equal   |
| Assist-to-turnover ratio              | 2022   | CJ Fulton, Lafayette             | 30 / 99 / 27   | same    |                       | 30 / 99 / 27                         | equal   |
| Assist-to-turnover ratio              | 2023   | Connor McCaffery, Iowa           | 32 / 117 / 30  | same    |                       | 32 / 117 / 30                        | equal   |
| Assist-to-turnover ratio              | 2024   | CJ Fulton, Col. of Charleston    | 35 / 145 / 35  | same    |                       | 35 / 145 / 35                        | equal   |
| Assist-to-turnover ratio              | 2025   | Garrison Keeslar, Chattanooga    | 38 / 118 / 21  | same    |                       | 38 / 118 / 21                        | equal   |
| Assist-to-turnover ratio              | 2026   | Ryan Prather Jr., Robert Morris  | 33 / 120 / 27  | same    |                       | 33 / 120 / 27                        | equal   |
| Blocked-shot average                  | 2022   | Jamarion Sharp, Western Ky.      | 32 / 148       | same    |                       | 32 / 148                             | equal   |
| Blocked-shot average                  | 2023   | Jamarion Sharp, Western Ky.      | 32 / 131       | same    |                       | 32 / 131                             | equal   |
| Blocked-shot average                  | 2024   | Isaiah Cozart, Eastern Ky.       | 30 / 116       | same    |                       | 30 / 116                             | equal   |
| Blocked-shot average                  | 2025   | Obinna Anochili-Killen, Marshall | 32 / 102       | differs | Malcolm Wilson 3.286  | 32 / 102                             | equal   |
| Blocked-shot average                  | 2026   | Kyle Evans, UC Irvine            | 35 / 115       | same    |                       | 35 / 115                             | equal   |
| Steal average                         | 2022   | Nendah Tarke, Coppin St.         | 32 / 94        | same    |                       | 32 / 94                              | equal   |
| Steal average                         | 2023   | Kellen Tynes, Maine              | 30 / 98        | same    |                       | 30 / 98                              | equal   |
| Steal average                         | 2024   | Arturo Dean, FIU                 | 31 / 104       | same    |                       | 31 / 104                             | equal   |
| Steal average                         | 2025   | Kellen Tynes, Maine              | 34 / 107       | same    |                       | 34 / 107                             | equal   |
| Steal average                         | 2026   | Javontae Campbell, Bowling Green | 32 / 97        | same    |                       | 32 / 97                              | equal   |
| Double-doubles                        | 2022   | Armando Bacot, North Carolina    | 39 / 31        | same    |                       | 39 / 31                              | equal   |
| Double-doubles                        | 2023   | Zach Edey, Purdue                | 34 / 27        | same    |                       | 34 / 27                              | equal   |
| Double-doubles                        | 2024   | Enrique Freeman, Akron           | 35 / 31        | same    |                       | 35 / 31                              | equal   |
| Double-doubles                        | 2025   | Yaxel Lendeborg, UAB             | 37 / 26        | same    |                       | 37 / 26                              | equal   |
| Double-doubles                        | 2026   | Cameron Boozer, Duke             | 38 / 22        | same    |                       | 38 / 22                              | equal   |

| Category                              | Same leader | Same line |
| ------------------------------------- | ----------- | --------- |
| Scoring average                       | 5 of 5      | 5 of 5    |
| Field-goal percentage                 | 5 of 5      | 5 of 5    |
| Three-point field goals made per game | 5 of 5      | 5 of 5    |
| Three-point field-goal percentage     | 4 of 5      | 5 of 5    |
| Free-throw percentage                 | 5 of 5      | 4 of 5    |
| Rebound average                       | 5 of 5      | 5 of 5    |
| Assist average                        | 5 of 5      | 5 of 5    |
| Assist-to-turnover ratio              | 5 of 5      | 5 of 5    |
| Blocked-shot average                  | 4 of 5      | 5 of 5    |
| Steal average                         | 5 of 5      | 5 of 5    |
| Double-doubles                        | 5 of 5      | 5 of 5    |
| Every category                        | 53 of 55    | 54 of 55  |

Stated differences: the app keeps its leader.

- Three-point field-goal percentage, 2022: Jake Kosakowski of UC San Diego leads, 70 of 148 in 28 games (2.5 made a game); the book names Kyle Foster (105 of 229). The NCAA lists a school reclassifying to Division I at the bottom of its rankings and does not rank it ("These reclassifying schools will not be ranked but rather listed at the bottom of the weekly rankings", Statistics Policies and Guidelines, `ForSIDs_Policies.txt` lines 1054-1058); the data has no list of them, so the app ranks them.
- Blocked-shot average, 2025: Malcolm Wilson of Queens leads, 115 blocks in 35 games, equal in both families; the book names Obinna Anochili-Killen (102 in 32). The NCAA lists a school reclassifying to Division I at the bottom of its rankings and does not rank it ("These reclassifying schools will not be ranked but rather listed at the bottom of the weekly rankings", Statistics Policies and Guidelines, `ForSIDs_Policies.txt` lines 1054-1058); the data has no list of them, so the app ranks them.

## Women's champions against the NCAA's record books

The engine leads each category among qualified players over every counted game (D45), under the 75 % rule for the per-game categories, and for the percentages and the assist-to-turnover ratio the counts per game played with the 75 % rule (D43). "Leader" says whether its first row is the champion; "Line" whether the champion's games and totals equal the book's.

| Category                              | Season | Champion (book)                     | Book line      | Leader  | App leader          | App line for the champion | Line    |
| ------------------------------------- | ------ | ----------------------------------- | -------------- | ------- | ------------------- | ------------------------- | ------- |
| Scoring average                       | 2022   | Caitlin Clark, Iowa                 | 32 / 863       | same    |                     | 32 / 863                  | equal   |
| Scoring average                       | 2023   | Maddy Siegrist, Villanova           | 37 / 1081      | same    |                     | 37 / 1081                 | equal   |
| Scoring average                       | 2024   | Caitlin Clark, Iowa                 | 39 / 1234      | same    |                     | 39 / 1234                 | equal   |
| Scoring average                       | 2025   | Ta’Niya Liston, Florida St.         | 29 / 731       | same    |                     | 29 / 731                  | equal   |
| Scoring average                       | 2026   | Mikayla Blakes, Vanderbilt          | 34 / 918       | same    |                     | 34 / 918                  | equal   |
| Field-goal percentage                 | 2022   | Monika Czinano, Iowa                | 31 / 277 / 408 | same    |                     | 31 / 277 / 408            | equal   |
| Field-goal percentage                 | 2023   | Mya Berkman, Liberty                | 33 / 196 / 282 | differs | Gracie Merkle 0.702 | 33 / 196 / 282            | equal   |
| Field-goal percentage                 | 2024   | Raegan Beers, Oregon St.            | 31 / 221 / 333 | differs | Jo Langbehn 0.665   | 31 / 221 / 333            | equal   |
| Field-goal percentage                 | 2025   | Jordana Reisma, Cleveland St.       | 37 / 203 / 300 | same    |                     | 37 / 203 / 300            | equal   |
| Field-goal percentage                 | 2026   | Gracie Merkle, Penn St.             | 26 / 216 / 298 | same    |                     | 26 / 216 / 298            | equal   |
| Three-point field goals made per game | 2022   | Taylor Robertson, Oklahoma          | 34 / 124       | same    |                     | 34 / 124                  | equal   |
| Three-point field goals made per game | 2023   | Caitlin Clark, Iowa                 | 38 / 140       | same    |                     | 38 / 140                  | equal   |
| Three-point field goals made per game | 2024   | Caitlin Clark, Iowa                 | 39 / 201       | same    |                     | 39 / 201                  | equal   |
| Three-point field goals made per game | 2025   | Alyssa Durazo-Frescas, Grand Canyon | 32 / 124       | same    |                     | 32 / 124                  | equal   |
| Three-point field goals made per game | 2026   | Briana Rivera, Samford              | 35 / 112       | same    |                     | 35 / 112                  | equal   |
| Three-point field-goal percentage     | 2022   | Tess Amundsen, CSUN                 | 28 / 56 / 114  | same    |                     | 28 / 56 / 114             | equal   |
| Three-point field-goal percentage     | 2023   | Alex Giannaros, Boston U.           | 25 / 50 / 97   | same    |                     | 25 / 50 / 97              | equal   |
| Three-point field-goal percentage     | 2024   | Te-Hina Paopao, South Carolina      | 37 / 87 / 186  | same    |                     | 37 / 87 / 186             | equal   |
| Three-point field-goal percentage     | 2025   | Lauren Ross, Purdue Fort Wayne      | 36 / 111 / 233 | same    |                     | 36 / 111 / 233            | equal   |
| Three-point field-goal percentage     | 2026   | Emilee Fox, South Dakota St.        | 27 / 57 / 116  | same    |                     | 27 / 57 / 116             | equal   |
| Free-throw percentage                 | 2022   | Haley Cavinder, Fresno St.          | 29 / 109 / 112 | same    |                     | 29 / 109 / 112            | equal   |
| Free-throw percentage                 | 2023   | Erin Houpt, Mercer                  | 28 / 92 / 98   | same    |                     | 28 / 92 / 98              | equal   |
| Free-throw percentage                 | 2024   | Maya McDermott, UNI                 | 31 / 80 / 83   | same    |                     | 31 / 80 / 83              | equal   |
| Free-throw percentage                 | 2025   | Lauren Ross, Purdue Fort Wayne      | 36 / 91 / 96   | same    |                     | 36 / 91 / 96              | equal   |
| Free-throw percentage                 | 2026   | Allie Turner, Gonzaga               | 34 / 86 / 90   | same    |                     | 34 / 86 / 90              | equal   |
| Rebound average                       | 2022   | Aneesah Morrow, DePaul              | 33 / 457       | same    |                     | 33 / 457                  | equal   |
| Rebound average                       | 2023   | Lauren Gustin, BYU                  | 33 / 552       | same    |                     | 33 / 552                  | equal   |
| Rebound average                       | 2024   | Lauren Gustin, BYU                  | 33 / 504       | same    |                     | 33 / 504                  | equal   |
| Rebound average                       | 2025   | Aneesah Morrow, LSU                 | 36 / 485       | same    |                     | 36 / 485                  | equal   |
| Rebound average                       | 2026   | Megan Nestor, North Texas           | 33 / 464       | same    |                     | 33 / 464                  | equal   |
| Assist average                        | 2022   | Caitlin Clark, Iowa                 | 32 / 257       | same    |                     | 32 / 257                  | equal   |
| Assist average                        | 2023   | Caitlin Clark, Iowa                 | 38 / 327       | same    |                     | 38 / 327                  | equal   |
| Assist average                        | 2024   | Caitlin Clark, Iowa                 | 39 / 346       | same    |                     | 39 / 346                  | equal   |
| Assist average                        | 2025   | Serena Sundell, Kansas St.          | 36 / 262       | same    |                     | 36 / 262                  | equal   |
| Assist average                        | 2026   | Caroline Lau, Northwestern          | 29 / 245       | same    |                     | 29 / 245                  | equal   |
| Assist-to-turnover ratio              | 2022   | Clair Steele, Lehigh                | 24 / 131 / 33  | same    |                     | 24 / 131 / 33             | equal   |
| Assist-to-turnover ratio              | 2023   | Molly Masciantonio, La Salle        | 26 / 118 / 25  | same    |                     | 26 / 118 / 25             | equal   |
| Assist-to-turnover ratio              | 2024   | Kiara Jackson, UNLV                 | 33 / 157 / 45  | same    |                     | 33 / 157 / 45             | equal   |
| Assist-to-turnover ratio              | 2025   | Kiara Jackson, UNLV                 | 34 / 170 / 46  | same    |                     | 34 / 170 / 46             | equal   |
| Assist-to-turnover ratio              | 2026   | Paige Girardi, Quinnipiac           | 28 / 88 / 20   | same    |                     | 28 / 88 / 20              | equal   |
| Blocked-shot average                  | 2022   | Lucy Cochrane, Portland             | 29 / 114       | same    |                     | 29 / 114                  | equal   |
| Blocked-shot average                  | 2023   | Brooke Flowers, Saint Louis         | 35 / 133       | same    |                     | 35 / 133                  | equal   |
| Blocked-shot average                  | 2024   | Cameron Brink, Stanford             | 34 / 127       | same    |                     | 34 / 127                  | equal   |
| Blocked-shot average                  | 2025   | Anastasiia Boldyreva, Middle Tenn.  | 35 / 128       | same    |                     | 35 / 128                  | equal   |
| Blocked-shot average                  | 2026   | Madison Francis, Mississippi St.    | 31 / 88        | same    |                     | 31 / 88                   | equal   |
| Steal average                         | 2022   | Veronica Burton, Northwestern       | 29 / 117       | same    |                     | 29 / 117                  | equal   |
| Steal average                         | 2023   | Ny’Ceara Pryor, Sacred Heart        | 33 / 122       | same    |                     | 33 / 122                  | equal   |
| Steal average                         | 2024   | Hannah Hidalgo, Notre Dame          | 35 / 160       | same    |                     | 35 / 160                  | equal   |
| Steal average                         | 2025   | Ny’Ceara Pryor, Sacred Heart        | 29 / 120       | same    |                     | 29 / 120                  | equal   |
| Steal average                         | 2026   | Hannah Hidalgo, Notre Dame          | 36 / 202       | same    |                     | 36 / 202                  | equal   |
| Triple-doubles                        | 2022   | Caitlin Clark, Iowa                 | 32 / 5         | same    |                     | 32 / 5                    | equal   |
| Triple-doubles                        | 2023   | Caitlin Clark, Iowa                 | 38 / 5         | same    |                     | 38 / 5                    | equal   |
| Triple-doubles                        | 2024   | Caitlin Clark, Iowa                 | 39 / 6         | same    |                     | 39 / 6                    | equal   |
| Triple-doubles                        | 2025   | Olivia Miles, Notre Dame            | 34 / 3         | same    |                     | 34 / 3                    | equal   |
| Triple-doubles                        | 2026   | Olivia Miles, TCU                   | 38 / 8         | same    |                     | 38 / 6                    | differs |
| Double-doubles                        | 2022   | Aliyah Boston, South Carolina       | 37 / 30        | same    |                     | 37 / 30                   | equal   |
| Double-doubles                        | 2023   | Angel Reese, LSU                    | 36 / 34        | same    |                     | 2 / 0; 36 / 34            | equal   |
| Double-doubles                        | 2024   | Lauren Gustin, BYU                  | 33 / 30        | same    |                     | 33 / 30                   | equal   |
| Double-doubles                        | 2025   | Aneesah Morrow, LSU                 | 36 / 30        | same    |                     | 36 / 30                   | equal   |
| Double-doubles                        | 2026   | Sharneccee Currie-Jelks, Murray St. | 35 / 26        | same    |                     | 35 / 26                   | equal   |

| Category                              | Same leader | Same line |
| ------------------------------------- | ----------- | --------- |
| Scoring average                       | 5 of 5      | 5 of 5    |
| Field-goal percentage                 | 3 of 5      | 5 of 5    |
| Three-point field goals made per game | 5 of 5      | 5 of 5    |
| Three-point field-goal percentage     | 5 of 5      | 5 of 5    |
| Free-throw percentage                 | 5 of 5      | 5 of 5    |
| Rebound average                       | 5 of 5      | 5 of 5    |
| Assist average                        | 5 of 5      | 5 of 5    |
| Assist-to-turnover ratio              | 5 of 5      | 5 of 5    |
| Blocked-shot average                  | 5 of 5      | 5 of 5    |
| Steal average                         | 5 of 5      | 5 of 5    |
| Triple-doubles                        | 5 of 5      | 4 of 5    |
| Double-doubles                        | 5 of 5      | 5 of 5    |
| Every category                        | 58 of 60    | 59 of 60  |

Stated differences: the app keeps its leader.

- Field-goal percentage, 2023: Gracie Merkle of Bellarmine leads, 191 of 272 in 31 games; the book names Mya Berkman (196 of 282). The NCAA lists a school reclassifying to Division I at the bottom of its rankings and does not rank it ("These reclassifying schools will not be ranked but rather listed at the bottom of the weekly rankings", Statistics Policies and Guidelines, `ForSIDs_Policies.txt` lines 1054-1058); the data has no list of them, so the app ranks them.
- Field-goal percentage, 2024: Jo Langbehn of St. Thomas leads, 169 of 254 in 31 games; the book names Raegan Beers (221 of 333). The NCAA lists a school reclassifying to Division I at the bottom of its rankings and does not rank it ("These reclassifying schools will not be ranked but rather listed at the bottom of the weekly rankings", Statistics Policies and Guidelines, `ForSIDs_Policies.txt` lines 1054-1058); the data has no list of them, so the app ranks them.
