# NCAA Division I agreement checks

Measured on 2026-11-19 (Plan T1302.5) on the rebuilt copies `~/.cache/metis-dev/t1302e-ncaam` and `t1302e-ncaaw`: `scripts/check-agreement.mjs <folder> <out.md> --league=ncaam` (and `ncaaw`), and `scripts/check-ncaa-leaders.mjs <folder> --league=…` against the NCAA's record books. What the numbers mean for the app is in [ncaa-data-sources.md](ncaa-data-sources.md), "Game and season tables, built (T1302.5)".

**Run again at the Stage 13 gate**, 2026-11-22, on a first load through the app (`~/.cache/metis-dev/gate13b`): 0 wrong in both leagues, and the record books' champions 53 of 55 (men) and 58 of 60 (women), the same rows as below. Of the sealed seasons' table lines (2021-22 to 2025-26), 133 of 145 (men) and 131 of 145 (women) equal the tables below; the rest are lines of the script's later sections that these tables do not carry (3 men's and 2 women's: the published models and the engine's own reads), or differ only where stats.ncaa.org's lines are paired with ESPN's, which T1302.9's fix of the picks changed after these tables were written ("The same files give the same rows" in `stats-database.md`), and in 2025-26's republished files. Men: player lines paired across the families 2 to 65 more a season (2021-22 119,965 against 119,929; 2025-26 2 more), 2025-26's shots 4,055 team-games off the box score against 4,087. Women: paired lines 2 to 319 more (2022-23 117,263 against 116,944), 2023-24's game rows against season rows 9,232 against 9,240, its splits 118,089 against 118,092, one rebuilt rate 99.8 against 99.9 and one correlation 0.9723 against 0.9722, 2024-25's possessions 848,961 of 849,969 points against 849,972, 2025-26's shots 4,527 against 4,560. ESPN's counts are equal in every line. The current season, 2026-27, has grown since.

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

### The plays (T1302.7)

Measured on 2026-11-19 on `t1302g-ncaam` (the T1302.6 file rebuilt by the built worker's refresh, the on-court screens on the play by play) by `scripts/check-agreement.mjs` (`scripts/lib/agreement-college-plays.mjs`).

stats.ncaa.org's play by play read into the play table (`play_nba`), with the ten on the floor worked out at each build (`play_lineup`, not kept), and what the shared builders make of them, per season. A team-game is counted with a box score, exhibitions out; a player-game is a box-score line of such a game.

#### The event names

Every `event_type` the file spells (kept as `action`) with its count over every season, the play kind it maps to and the counts it carries. 80 rarer spellings (474 rows: the player's name or "null" before a type in 2021-22 to 2024-25, read without it) are summed in the last row. Unmapped (`other` but the fouls drawn, which the play-derived counts read): 594 of 15,299,464 rows (0.0 %).

| Event type                | Kind         | Rows      | FGA       | FTA       | REB       | TOV     | PF        | STL     | BLK     |
| ------------------------- | ------------ | --------- | --------- | --------- | --------- | ------- | --------- | ------- | ------- |
| Enters Game               | substitution | 2,041,771 | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Leaves Game               | substitution | 2,041,747 | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Defensive Rebound         | rebound      | 1,582,495 | 0         | 0         | 1,582,495 | 0       | 0         | 0       | 0       |
| Three Point Jumper        | field_goal   | 1,435,299 | 1,435,299 | 0         | 0         | 0       | 0         | 0       | 14,477  |
| Layup                     | field_goal   | 1,269,774 | 1,269,774 | 0         | 0         | 0       | 0         | 0       | 145,473 |
| Free Throw                | free_throw   | 1,199,742 | 0         | 1,199,742 | 0         | 0       | 0         | 0       | 0       |
| Commits Foul              | foul         | 1,088,840 | 0         | 0         | 0         | 0       | 1,086,457 | 0       | 0       |
| Draw Foul                 | other        | 1,064,966 | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Two Point Jumper          | field_goal   | 817,272   | 817,272   | 0         | 0         | 0       | 0         | 0       | 44,106  |
| Turnover                  | turnover     | 785,557   | 0         | 0         | 0         | 785,557 | 0         | 423,839 | 0       |
| Offensive Rebound         | rebound      | 658,379   | 0         | 0         | 658,379   | 0       | 0         | 0       | 0       |
| Steal                     | steal        | 427,239   | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Blocked Shot              | block        | 211,620   | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Deadball Rebound          | rebound      | 185,681   | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Timeout                   | timeout      | 158,826   | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Dunk                      | field_goal   | 142,855   | 142,855   | 0         | 0         | 0       | 0         | 0       | 4,672   |
| Hook                      | field_goal   | 71,984    | 71,984    | 0         | 0         | 0       | 0         | 0       | 2,008   |
| Jumpball (held ball)      | jump_ball    | 38,944    | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| lost Jumpball             | jump_ball    | 33,673    | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| won Jumpball              | jump_ball    | 33,673    | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Challenge (Out of Bounds) | replay       | 2,485     | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Media Timeout             | timeout      | 1,174     | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Second Timeout            | timeout      | 1,131     | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Jumpball (lodged ball)    | jump_ball    | 1,038     | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Team Timeout              | timeout      | 703       | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Tip In                    | field_goal   | 559       | 559       | 0         | 0         | 0       | 0         | 0       | 6       |
| (empty)                   | other        | 520       | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| media Timeout             | timeout      | 517       | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Jumpball (out of bounds)  | jump_ball    | 315       | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Challenge (Interference)  | replay       | 211       | 0         | 0         | 0         | 0       | 0         | 0       | 0       |
| Rarer spellings           | –            | 474       | 192       | 17        | 50        | 30      | 11        | 2       | 12      |

#### Player-games rebuilt from the plays

Each box-score line of a game with plays against the same line rebuilt from the play table's flags: the actor's counts (rebounds and turnovers where a player is named), assists to `assist_id`, steals and blocks to the player put on the turnover or the miss. Exact when all 14 counts equal the box score's (ESPN's, or stats.ncaa.org's for the games ESPN lacks); the per-stat columns are the share with that count exact.

| Season  | Lines   | Exact  | Within 1 | PTS  | FGM  | FGA  | FG3M  | FG3A | FTM   | FTA  | OREB | DREB | AST  | STL  | BLK   | TOV  | PF   |
| ------- | ------- | ------ | -------- | ---- | ---- | ---- | ----- | ---- | ----- | ---- | ---- | ---- | ---- | ---- | ----- | ---- | ---- |
| 2021-22 | 120,262 | 97.9 % | 99.3 %   | 99.8 | 99.8 | 99.7 | 99.9  | 99.8 | 99.9  | 99.9 | 99.8 | 99.7 | 99.5 | 98.8 | 99.9  | 99.8 | 99.8 |
| 2022-23 | 125,347 | 99.0 % | 99.7 %   | 99.9 | 99.9 | 99.8 | 100.0 | 99.9 | 100.0 | 99.9 | 99.9 | 99.9 | 99.7 | 99.5 | 99.9  | 99.9 | 99.9 |
| 2023-24 | 125,960 | 99.5 % | 99.8 %   | 99.9 | 99.9 | 99.9 | 100.0 | 99.9 | 100.0 | 99.9 | 99.9 | 99.9 | 99.9 | 99.7 | 100.0 | 99.9 | 99.9 |
| 2024-25 | 127,485 | 99.7 % | 99.8 %   | 99.9 | 99.9 | 99.8 | 99.9  | 99.9 | 99.9  | 99.9 | 99.9 | 99.9 | 99.9 | 99.9 | 99.9  | 99.9 | 99.9 |
| 2025-26 | 127,472 | 99.2 % | 99.4 %   | 99.5 | 99.6 | 99.4 | 99.8  | 99.6 | 99.8  | 99.7 | 99.7 | 99.6 | 99.7 | 99.7 | 99.9  | 99.6 | 99.5 |
| 2026-27 | 22,068  | 98.2 % | 99.2 %   | 99.4 | 99.5 | 99.1 | 99.8  | 99.4 | 99.7  | 99.6 | 99.5 | 99.4 | 99.4 | 99.6 | 99.7  | 99.4 | 99.5 |

#### The score and the possessions

Per team-game with plays: the plays' final score (the highest each side reached) against the game's; the team's points summed from the plays; the points scored in its possessions (the file's `poss_num`, each the team's that shot, turned the ball over or took an offensive rebound in it) against the score, exact and within 2; and its possessions within 2 of stats.ncaa.org's team box (`ncaa_poss`).

| Season  | Team-games | Final score | Points from plays | Possessions' points | Within 2 | Possessions within 2 |
| ------- | ---------- | ----------- | ----------------- | ------------------- | -------- | -------------------- |
| 2021-22 | 11,932     | 99.9 %      | 99.9 %            | 95.8 %              | 99.3 %   | 96.9 %               |
| 2022-23 | 12,442     | 100.0 %     | 99.9 %            | 93.9 %              | 99.2 %   | 96.6 %               |
| 2023-24 | 12,486     | 100.0 %     | 100.0 %           | 95.7 %              | 99.2 %   | 96.9 %               |
| 2024-25 | 12,586     | 100.0 %     | 99.9 %            | 96.3 %              | 99.4 %   | 97.0 %               |
| 2025-26 | 12,594     | 100.0 %     | 99.9 %            | 96.2 %              | 99.4 %   | 96.8 %               |
| 2026-27 | 1,906      | 99.9 %      | 99.8 %            | 95.4 %              | 99.4 %   | 96.1 %               |

#### The splits add up

The halves and the overtimes (h1, h2, ot) summed per team-game: all 14 counts equal the whole game's from the same plays (team rebounds and team turnovers left out, as in a player's line); the points equal the score; the seconds equal the game's (40 minutes and 5 an overtime, five players). Players: their seconds over the same splits within a minute of the box score's minutes, and equal to their on-court seconds credited play by play (`player_on_court`).

| Season  | Team-games | Whole game | Points  | Seconds | Player-games | Minutes within 1 | Equal on court |
| ------- | ---------- | ---------- | ------- | ------- | ------------ | ---------------- | -------------- |
| 2021-22 | 11,932     | 100.0 %    | 99.9 %  | 100.0 % | 119,686      | 91.7 %           | 99.8 %         |
| 2022-23 | 12,442     | 100.0 %    | 99.9 %  | 100.0 % | 124,853      | 92.6 %           | 99.9 %         |
| 2023-24 | 12,486     | 100.0 %    | 100.0 % | 100.0 % | 125,391      | 92.8 %           | 99.9 %         |
| 2024-25 | 12,586     | 100.0 %    | 99.9 %  | 100.0 % | 126,942      | 94.5 %           | 100.0 %        |
| 2025-26 | 12,594     | 100.0 %    | 99.9 %  | 100.0 % | 126,380      | 94.3 %           | 99.9 %         |
| 2026-27 | 1,906      | 100.0 %    | 99.8 %  | 100.0 % | 21,825       | 93.8 %           | 99.9 %         |

#### Assists, assisted makes and fouls drawn

Per player-game with plays: assists on twos and threes (`ast2 + ast3`) against the box score's assists; makes split assisted and unassisted against its field goals made; assisted makes and assisted threes against stats.ncaa.org's box (`ncaa_fgm_ast`, `ncaa_fg3m_ast`, on the lines it has); personal fouls. Per team-game: fouls drawn (the file's own rows naming the fouled player) against the other side's personal fouls less its technicals, exact and within 1; and the share of turnovers and fouls of no kind (`other`).

| Season  | Player-games | AST    | Makes split | Assisted makes (stats.ncaa.org) | Assisted threes | PF     | Fouls drawn | Within 1 | TOV of no kind | PF of no kind |
| ------- | ------------ | ------ | ----------- | ------------------------------- | --------------- | ------ | ----------- | -------- | -------------- | ------------- |
| 2021-22 | 120,262      | 99.5 % | 99.8 %      | 100.0 %                         | 100.0 %         | 99.8 % | 92.8 %      | 97.2 %   | 3.8 %          | 4.2 %         |
| 2022-23 | 125,347      | 99.7 % | 99.9 %      | 100.0 %                         | 100.0 %         | 99.9 % | 88.7 %      | 97.8 %   | 2.4 %          | 2.9 %         |
| 2023-24 | 125,960      | 99.9 % | 99.9 %      | 100.0 %                         | 100.0 %         | 99.9 % | 95.6 %      | 99.3 %   | 1.5 %          | 2.2 %         |
| 2024-25 | 127,485      | 99.9 % | 99.9 %      | 100.0 %                         | 100.0 %         | 99.9 % | 96.9 %      | 99.9 %   | 0.8 %          | 1.5 %         |
| 2025-26 | 127,472      | 99.7 % | 99.6 %      | 100.0 %                         | 100.0 %         | 99.5 % | 96.1 %      | 99.9 %   | 0.7 %          | 1.5 %         |
| 2026-27 | 22,068       | 99.4 % | 99.5 %      | 100.0 %                         | 100.0 %         | 99.5 % | 95.8 %      | 99.9 %   | 0.8 %          | 1.3 %         |

#### The game flow

Per game with plays: the last scoring play's score against the final score, the flow's length against the game's (40 minutes and 5 an overtime), and a winning home side's largest lead at least its final margin.

| Season  | Games | Ends on the final score | Length  | Largest lead ≥ margin |
| ------- | ----- | ----------------------- | ------- | --------------------- |
| 2021-22 | 5,966 | 99.9 %                  | 100.0 % | 100.0 %               |
| 2022-23 | 6,221 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2023-24 | 6,243 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2024-25 | 6,292 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2025-26 | 6,297 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2026-27 | 953   | 99.9 %                  | 100.0 % | 100.0 %               |

#### Time on the floor: the play by play against the lineup file

Both sources side by side (policy 5): stats.ncaa.org's lineup file (`unit_game_lineups`, `player_on_court_lineups`) and the units credited play by play (`unit_game`, `player_on_court`, what the on-court screens read since T1302.7), each team-game's units summed: minutes equal to the game's (within a second), points equal to the box score's, and the share of the game's minutes covered; each player-game with minutes: a line from the source, and its on-court minutes within a minute of the box score's.

| Season  | Source       | Team-games | With units | Minutes equal the game's | Minutes covered | Points equal the box score's | Player-games | With a line | Minutes within 1 |
| ------- | ------------ | ---------- | ---------- | ------------------------ | --------------- | ---------------------------- | ------------ | ----------- | ---------------- |
| 2021-22 | lineup file  | 11,934     | 100.0 %    | 58.3 %                   | 96.5 %          | 66.6 %                       | 119,405      | 98.0 %      | 41.2 %           |
| 2021-22 | play by play | 11,934     | 100.0 %    | 100.0 %                  | 100.0 %         | 99.9 %                       | 119,406      | 99.6 %      | 91.4 %           |
| 2022-23 | lineup file  | 12,444     | 100.0 %    | 57.4 %                   | 96.5 %          | 66.1 %                       | 124,422      | 98.1 %      | 40.9 %           |
| 2022-23 | play by play | 12,444     | 100.0 %    | 100.0 %                  | 100.0 %         | 99.9 %                       | 124,422      | 99.7 %      | 92.3 %           |
| 2023-24 | lineup file  | 12,486     | 100.0 %    | 59.9 %                   | 96.8 %          | 68.2 %                       | 124,976      | 98.6 %      | 42.5 %           |
| 2023-24 | play by play | 12,486     | 100.0 %    | 100.0 %                  | 100.0 %         | 100.0 %                      | 124,976      | 99.7 %      | 92.6 %           |
| 2024-25 | lineup file  | 12,586     | 100.0 %    | 59.3 %                   | 96.8 %          | 67.6 %                       | 126,666      | 99.0 %      | 42.4 %           |
| 2024-25 | play by play | 12,586     | 100.0 %    | 100.0 %                  | 100.0 %         | 99.9 %                       | 126,666      | 99.7 %      | 94.2 %           |
| 2025-26 | lineup file  | 12,600     | 99.8 %     | 59.1 %                   | 97.0 %          | 67.3 %                       | 126,804      | 98.5 %      | 41.7 %           |
| 2025-26 | play by play | 12,600     | 100.0 %    | 100.0 %                  | 100.0 %         | 99.9 %                       | 126,805      | 99.1 %      | 93.6 %           |
| 2026-27 | lineup file  | 2,066      | 92.3 %     | 45.6 %                   | 96.0 %          | 54.4 %                       | 23,723       | 90.9 %      | 38.3 %           |
| 2026-27 | play by play | 2,066      | 92.3 %     | 92.3 %                   | 100.0 %         | 92.1 %                       | 23,723       | 91.6 %      | 85.9 %           |

#### Through the engine

The first and last season through the query engine: each team's lead changes per game against `play_team_game`; the points of each team's split rows summed over the halves or quarters and overtimes against `split_team`; each player's assists on twos (`pbp_ast2`, raw over the season, the best 5,000) against `play_player_game` summed; exhibitions out of both.

| Season  | Teams | Lead changes equal | Teams with splits | Split points equal | Players | Assists on twos equal |
| ------- | ----- | ------------------ | ----------------- | ------------------ | ------- | --------------------- |
| 2021-22 | 358   | 100.0 %            | 358               | 100.0 %            | 5,000   | 100.0 %               |
| 2026-27 | 365   | 100.0 %            | 365               | 100.0 %            | 5,000   | 100.0 %               |

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

### The plays (T1302.7)

Measured on 2026-11-19 on `t1302g-ncaaw` (the T1302.6 file rebuilt by the built worker's refresh, the on-court screens on the play by play) by `scripts/check-agreement.mjs` (`scripts/lib/agreement-college-plays.mjs`).

stats.ncaa.org's play by play read into the play table (`play_nba`), with the ten on the floor worked out at each build (`play_lineup`, not kept), and what the shared builders make of them, per season. A team-game is counted with a box score, exhibitions out; a player-game is a box-score line of such a game.

#### The event names

Every `event_type` the file spells (kept as `action`) with its count over every season, the play kind it maps to and the counts it carries. 37 rarer spellings (278 rows: the player's name or "null" before a type in 2021-22 to 2024-25, read without it) are summed in the last row. Unmapped (`other` but the fouls drawn, which the play-derived counts read): 187 of 14,760,049 rows (0.0 %).

| Event type                | Kind         | Rows      | FGA       | FTA     | REB       | TOV     | PF        | STL     | BLK     |
| ------------------------- | ------------ | --------- | --------- | ------- | --------- | ------- | --------- | ------- | ------- |
| Enters Game               | substitution | 1,945,213 | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Leaves Game               | substitution | 1,945,135 | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Defensive Rebound         | rebound      | 1,514,735 | 0         | 0       | 1,514,735 | 0       | 0         | 0       | 0       |
| Layup                     | field_goal   | 1,373,742 | 1,373,742 | 0       | 0         | 0       | 0         | 0       | 121,224 |
| Three Point Jumper        | field_goal   | 1,173,545 | 1,173,545 | 0       | 0         | 0       | 0         | 0       | 13,950  |
| Commits Foul              | foul         | 1,009,309 | 0         | 0       | 0         | 0       | 1,008,693 | 0       | 0       |
| Draw Foul                 | other        | 995,129   | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Free Throw                | free_throw   | 992,777   | 0         | 992,777 | 0         | 0       | 0         | 0       | 0       |
| Turnover                  | turnover     | 973,523   | 0         | 0       | 0         | 973,523 | 0         | 475,819 | 0       |
| Two Point Jumper          | field_goal   | 958,557   | 958,557   | 0       | 0         | 0       | 0         | 0       | 51,913  |
| Offensive Rebound         | rebound      | 688,406   | 0         | 0       | 688,406   | 0       | 0         | 0       | 0       |
| Steal                     | steal        | 479,477   | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Deadball Rebound          | rebound      | 192,632   | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Blocked Shot              | block        | 189,305   | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Timeout                   | timeout      | 143,108   | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Jumpball (held ball)      | jump_ball    | 85,988    | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| won Jumpball              | jump_ball    | 31,334    | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| lost Jumpball             | jump_ball    | 31,334    | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Hook                      | field_goal   | 30,691    | 30,691    | 0       | 0         | 0       | 0         | 0       | 1,396   |
| Challenge (Out of Bounds) | replay       | 1,608     | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Second Timeout            | timeout      | 941       | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Jumpball (lodged ball)    | jump_ball    | 690       | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Dunk                      | field_goal   | 689       | 689       | 0       | 0         | 0       | 0         | 0       | 12      |
| Media Timeout             | timeout      | 570       | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Jumpball (out of bounds)  | jump_ball    | 397       | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Team Timeout              | timeout      | 315       | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| media Timeout             | timeout      | 238       | 0         | 0       | 0         | 0       | 0         | 0       | 0       |
| Tip In                    | field_goal   | 211       | 211       | 0       | 0         | 0       | 0         | 0       | 4       |
| (empty)                   | field_goal   | 172       | 172       | 0       | 0         | 0       | 0         | 0       | 11      |
| Rarer spellings           | –            | 278       | 27        | 10      | 11        | 4       | 8         | 0       | 2       |

#### Player-games rebuilt from the plays

Each box-score line of a game with plays against the same line rebuilt from the play table's flags: the actor's counts (rebounds and turnovers where a player is named), assists to `assist_id`, steals and blocks to the player put on the turnover or the miss. Exact when all 14 counts equal the box score's (ESPN's, or stats.ncaa.org's for the games ESPN lacks); the per-stat columns are the share with that count exact.

| Season  | Lines   | Exact  | Within 1 | PTS  | FGM   | FGA  | FG3M  | FG3A | FTM   | FTA   | OREB  | DREB | AST  | STL  | BLK   | TOV  | PF   |
| ------- | ------- | ------ | -------- | ---- | ----- | ---- | ----- | ---- | ----- | ----- | ----- | ---- | ---- | ---- | ----- | ---- | ---- |
| 2021-22 | 112,034 | 97.6 % | 99.1 %   | 99.6 | 99.7  | 99.5 | 99.9  | 99.8 | 99.9  | 99.9  | 99.8  | 99.7 | 99.6 | 98.7 | 99.9  | 99.7 | 99.8 |
| 2022-23 | 117,617 | 99.1 % | 99.7 %   | 99.9 | 99.9  | 99.8 | 100.0 | 99.9 | 99.9  | 99.9  | 99.9  | 99.9 | 99.7 | 99.5 | 99.9  | 99.9 | 99.9 |
| 2023-24 | 118,490 | 99.4 % | 99.7 %   | 99.9 | 99.9  | 99.9 | 100.0 | 99.9 | 99.9  | 99.9  | 99.9  | 99.9 | 99.8 | 99.7 | 100.0 | 99.9 | 99.9 |
| 2024-25 | 121,111 | 99.8 % | 99.9 %   | 99.9 | 100.0 | 99.9 | 100.0 | 99.9 | 100.0 | 100.0 | 100.0 | 99.9 | 99.9 | 99.9 | 100.0 | 99.9 | 99.9 |
| 2025-26 | 121,923 | 99.4 % | 99.5 %   | 99.6 | 99.7  | 99.5 | 99.9  | 99.7 | 99.8  | 99.8  | 99.8  | 99.6 | 99.7 | 99.7 | 99.9  | 99.6 | 99.6 |
| 2026-27 | 20,419  | 98.4 % | 99.3 %   | 99.5 | 99.6  | 99.2 | 99.9  | 99.5 | 99.8  | 99.7  | 99.7  | 99.4 | 99.5 | 99.6 | 99.8  | 99.3 | 99.6 |

#### The score and the possessions

Per team-game with plays: the plays' final score (the highest each side reached) against the game's; the team's points summed from the plays; the points scored in its possessions (the file's `poss_num`, each the team's that shot, turned the ball over or took an offensive rebound in it) against the score, exact and within 2; and its possessions within 2 of stats.ncaa.org's team box (`ncaa_poss`).

| Season  | Team-games | Final score | Points from plays | Possessions' points | Within 2 | Possessions within 2 |
| ------- | ---------- | ----------- | ----------------- | ------------------- | -------- | -------------------- |
| 2021-22 | 11,016     | 99.9 %      | 99.9 %            | 98.2 %              | 99.7 %   | 96.7 %               |
| 2022-23 | 11,638     | 100.0 %     | 99.9 %            | 97.7 %              | 99.7 %   | 97.1 %               |
| 2023-24 | 11,792     | 100.0 %     | 100.0 %           | 98.0 %              | 99.6 %   | 97.0 %               |
| 2024-25 | 11,918     | 100.0 %     | 100.0 %           | 98.1 %              | 99.7 %   | 97.2 %               |
| 2025-26 | 12,038     | 100.0 %     | 100.0 %           | 97.5 %              | 99.6 %   | 97.2 %               |
| 2026-27 | 1,880      | 99.9 %      | 99.8 %            | 97.2 %              | 99.5 %   | 95.9 %               |

#### The splits add up

The quarters and the overtimes (q1, q2, q3, q4, ot) summed per team-game: all 14 counts equal the whole game's from the same plays (team rebounds and team turnovers left out, as in a player's line); the points equal the score; the seconds equal the game's (40 minutes and 5 an overtime, five players). Players: their seconds over the same splits within a minute of the box score's minutes, and equal to their on-court seconds credited play by play (`player_on_court`).

| Season  | Team-games | Whole game | Points  | Seconds | Player-games | Minutes within 1 | Equal on court |
| ------- | ---------- | ---------- | ------- | ------- | ------------ | ---------------- | -------------- |
| 2021-22 | 11,016     | 100.0 %    | 99.9 %  | 100.0 % | 111,610      | 88.2 %           | 99.9 %         |
| 2022-23 | 11,638     | 100.0 %    | 99.9 %  | 100.0 % | 117,216      | 89.0 %           | 99.9 %         |
| 2023-24 | 11,792     | 100.0 %    | 100.0 % | 100.0 % | 118,092      | 89.8 %           | 99.9 %         |
| 2024-25 | 11,918     | 100.0 %    | 100.0 % | 100.0 % | 120,863      | 95.0 %           | 99.9 %         |
| 2025-26 | 12,038     | 100.0 %    | 100.0 % | 100.0 % | 121,168      | 94.5 %           | 99.8 %         |
| 2026-27 | 1,880      | 100.0 %    | 99.8 %  | 99.9 %  | 20,273       | 92.2 %           | 100.0 %        |

#### Assists, assisted makes and fouls drawn

Per player-game with plays: assists on twos and threes (`ast2 + ast3`) against the box score's assists; makes split assisted and unassisted against its field goals made; assisted makes and assisted threes against stats.ncaa.org's box (`ncaa_fgm_ast`, `ncaa_fg3m_ast`, on the lines it has); personal fouls. Per team-game: fouls drawn (the file's own rows naming the fouled player) against the other side's personal fouls less its technicals, exact and within 1; and the share of turnovers and fouls of no kind (`other`).

| Season  | Player-games | AST    | Makes split | Assisted makes (stats.ncaa.org) | Assisted threes | PF     | Fouls drawn | Within 1 | TOV of no kind | PF of no kind |
| ------- | ------------ | ------ | ----------- | ------------------------------- | --------------- | ------ | ----------- | -------- | -------------- | ------------- |
| 2021-22 | 112,034      | 99.6 % | 99.7 %      | 100.0 %                         | 100.0 %         | 99.8 % | 93.9 %      | 97.1 %   | 3.9 %          | 3.5 %         |
| 2022-23 | 117,617      | 99.7 % | 99.9 %      | 100.0 %                         | 100.0 %         | 99.9 % | 95.3 %      | 98.8 %   | 2.2 %          | 1.9 %         |
| 2023-24 | 118,490      | 99.8 % | 99.9 %      | 100.0 %                         | 100.0 %         | 99.9 % | 96.2 %      | 99.4 %   | 1.6 %          | 1.2 %         |
| 2024-25 | 121,111      | 99.9 % | 100.0 %     | 100.0 %                         | 100.0 %         | 99.9 % | 96.7 %      | 99.8 %   | 0.9 %          | 0.8 %         |
| 2025-26 | 121,923      | 99.7 % | 99.7 %      | 100.0 %                         | 100.0 %         | 99.6 % | 96.3 %      | 99.8 %   | 1.0 %          | 0.8 %         |
| 2026-27 | 20,419       | 99.5 % | 99.6 %      | 100.0 %                         | 100.0 %         | 99.6 % | 96.8 %      | 99.9 %   | 1.4 %          | 0.7 %         |

#### The game flow

Per game with plays: the last scoring play's score against the final score, the flow's length against the game's (40 minutes and 5 an overtime), and a winning home side's largest lead at least its final margin.

| Season  | Games | Ends on the final score | Length  | Largest lead ≥ margin |
| ------- | ----- | ----------------------- | ------- | --------------------- |
| 2021-22 | 5,508 | 99.9 %                  | 100.0 % | 100.0 %               |
| 2022-23 | 5,819 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2023-24 | 5,896 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2024-25 | 5,959 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2025-26 | 6,019 | 100.0 %                 | 100.0 % | 100.0 %               |
| 2026-27 | 940   | 99.9 %                  | 100.0 % | 100.0 %               |

#### Time on the floor: the play by play against the lineup file

Both sources side by side (policy 5): stats.ncaa.org's lineup file (`unit_game_lineups`, `player_on_court_lineups`) and the units credited play by play (`unit_game`, `player_on_court`, what the on-court screens read since T1302.7), each team-game's units summed: minutes equal to the game's (within a second), points equal to the box score's, and the share of the game's minutes covered; each player-game with minutes: a line from the source, and its on-court minutes within a minute of the box score's.

| Season  | Source       | Team-games | With units | Minutes equal the game's | Minutes covered | Points equal the box score's | Player-games | With a line | Minutes within 1 |
| ------- | ------------ | ---------- | ---------- | ------------------------ | --------------- | ---------------------------- | ------------ | ----------- | ---------------- |
| 2021-22 | lineup file  | 11,024     | 99.9 %     | 56.2 %                   | 95.5 %          | 65.1 %                       | 111,317      | 98.1 %      | 39.6 %           |
| 2021-22 | play by play | 11,024     | 99.9 %     | 99.9 %                   | 100.0 %         | 99.8 %                       | 111,317      | 99.6 %      | 88.0 %           |
| 2022-23 | lineup file  | 11,640     | 100.0 %    | 54.9 %                   | 95.8 %          | 64.5 %                       | 116,883      | 98.3 %      | 38.9 %           |
| 2022-23 | play by play | 11,640     | 100.0 %    | 99.9 %                   | 100.0 %         | 99.9 %                       | 116,883      | 99.7 %      | 88.8 %           |
| 2023-24 | lineup file  | 11,798     | 99.9 %     | 55.2 %                   | 95.9 %          | 64.6 %                       | 117,840      | 98.4 %      | 39.1 %           |
| 2023-24 | play by play | 11,798     | 99.9 %     | 99.9 %                   | 100.0 %         | 99.9 %                       | 117,816      | 99.7 %      | 89.5 %           |
| 2024-25 | lineup file  | 11,932     | 99.9 %     | 55.5 %                   | 96.1 %          | 64.8 %                       | 120,706      | 99.4 %      | 41.1 %           |
| 2024-25 | play by play | 11,932     | 99.9 %     | 99.9 %                   | 100.0 %         | 99.8 %                       | 120,706      | 99.7 %      | 94.7 %           |
| 2025-26 | lineup file  | 12,058     | 99.8 %     | 56.0 %                   | 96.1 %          | 65.7 %                       | 121,487      | 99.0 %      | 40.5 %           |
| 2025-26 | play by play | 12,058     | 99.8 %     | 99.8 %                   | 100.0 %         | 99.8 %                       | 121,488      | 99.2 %      | 93.8 %           |
| 2026-27 | lineup file  | 2,014      | 93.3 %     | 48.2 %                   | 96.0 %          | 58.0 %                       | 21,740       | 92.8 %      | 38.1 %           |
| 2026-27 | play by play | 2,014      | 93.3 %     | 93.2 %                   | 100.0 %         | 93.1 %                       | 21,740       | 93.0 %      | 85.7 %           |

**The 2024-25 team-games against the box score's seconds** (measured at T1302.9 on T1302.8's built files). Summed over a team-game, the play-credited units' time times five equals the box score's seconds (its players' minutes added up) on 11,590 of the 11,920 team-games with units, 97.2 %, against 99.9 to 100 % in the other seasons (2021-22 11,016 of 11,016; 2022-23 11,634 of 11,640; 2023-24 11,794 of 11,794; 2025-26 12,036 of 12,038). Every one of the 330 that differ is in the 335 games ESPN lacks and stats.ncaa.org gives (D40; `game.source` 'ncaa', 670 team-games, of which 340 equal); ESPN's 11,250 team-games with units all equal. In those 330 the box score is stats.ncaa.org's, and its players' minutes add up to 62 seconds less than the game on average, never more, so the units cover the whole game and the box score does not (188 of the 330 within a minute). The men's games read from stats.ncaa.org alone are few and differ the same way: 2 of 10 team-games equal in 2021-22 and 0 of 2 in 2026-27, every ESPN team-game equal.

#### Through the engine

The first and last season through the query engine: each team's lead changes per game against `play_team_game`; the points of each team's split rows summed over the halves or quarters and overtimes against `split_team`; each player's assists on twos (`pbp_ast2`, raw over the season, the best 5,000) against `play_player_game` summed; exhibitions out of both.

| Season  | Teams | Lead changes equal | Teams with splits | Split points equal | Players | Assists on twos equal |
| ------- | ----- | ------------------ | ----------------- | ------------------ | ------- | --------------------- |
| 2021-22 | 356   | 100.0 %            | 356               | 100.0 %            | 4,806   | 100.0 %               |
| 2026-27 | 363   | 100.0 %            | 363               | 100.0 %            | 4,458   | 100.0 %               |

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

## Ratings and models (T1302.8)

Measured on 2026-11-20. The constants are fitted by `scripts/fit-college-models.mjs` on the T1302.7 files (`t1302g-*`, opened read-only), with the code that ships, on games between two Division I teams of every counted type (no exhibition, no forfeit), fitted on 2021-22 to 2024-25 and scored on 2025-26. The checks are `scripts/check-college-models.mjs` on the rebuilt copies (`t1302h-ncaam`, `t1302h-ncaaw`, the built worker's refresh), read through the built worker and its engine, against Sports Reference's school and leaders pages (read with a plain client, slowly, cached in `~/.cache/metis-dev/ncaa-probe`) and SportsDataverse's published team ratings. Tolerances were stated before the runs; where a run showed a tolerance was the wrong question (SRS's centring, Win Shares' constants), what changed is said below the table.

**SRS's centring.** Sports Reference's college SRS counts only games between Division I teams, as Metis's does (its "SRS calculation details" page), but its Division I ratings do not average zero: −0.56 to −0.68 a season for the men, −0.84 to −0.90 for the women. Metis's are centred on the division, so as published they differ by about that much (within 0.5 on only 2 to 33 % of team-seasons, the stated tolerance missed); with each season's mean gap taken out, 95 to 100 % are within 0.5 and the median gap is 0.07 to 0.14, rank correlation 0.9996 to 0.9999. What is left is largest for a few teams Sports Reference has with no offset at all (Ivy League and NEC schools); it does not follow their games against teams outside Division I, and is not traced further.

**Win Shares' constants.** With Basketball-Reference's NBA constants (0.92 and 1.08 of the league's points per possession, a win at 0.32 of its points per game), the men's leaders came out about a third above Sports Reference's (Keegan Murray 11.5 against 8.7 in 2021-22; 0 of 50 leaders within 0.3). Sports Reference's college method ("Calculating Win Shares", 2009-10 on) uses 0.875, 1.125 and 0.5 against the division's totals; with those in the registry (`LeagueModels.winShares`) the men's leaders agree on 49 of 50 Win Shares and 50 of 50 WS/40. PER needed no change: 50 of 50 men's leaders within 0.5 from the first run.

**Players with no regular-season line.** The first comparison through the engine found one men's player of 2022-23 reading no PER: Austin Sacks (Baylor), whose one game that season was an NCAA tournament game (table PER −45.0 and WS −0.016 on 1 minute, engine NULL). A college row covering every counted game was stored under the regular season, and the engine joins a model or published season row to the player's box-score rows of its type, so a player with no regular-season line read nothing. Eight men's player-team-seasons have none (2021-22: 3, 2022-23: 1, 2024-25: 4), none of the women's, and every team plays a regular season; seven had composites and all eight SportsDataverse BPM or RAPM rows. Each player's row is now stored under a type they have a line in (the regular season where they have one), in the composites and in the published college tables (`COLLEGE_PUBLISHED` version 2); the rows are read only over every counted game, so nothing else reads differently. The comparison now runs every season of both leagues.

### NCAA Men: the constants, fitted

Games between two Division I teams of the season, every counted type, no exhibition or forfeit; fitted on 2021-22 to 2024-25 and scored on 2025-26, by `scripts/fit-college-models.mjs` on `/home/yhabie/.cache/metis-dev/t1302g-ncaam/stats-ncaam.duckdb`.

| Season  | Games counted | Between Division I teams | Neutral site | Postseason |
| ------- | ------------- | ------------------------ | ------------ | ---------- |
| 2021-22 | 5977          | 5475                     | 688          | 130        |
| 2022-23 | 6228          | 5715                     | 765          | 113        |
| 2023-24 | 6243          | 5726                     | 741          | 120        |
| 2024-25 | 6293          | 5764                     | 739          | 123        |
| 2025-26 | 6300          | 5752                     | 700          | 105        |

#### 1. Pythagorean exponent

Points for to the x over points for and against each to the x, against the winning percentage of every team-season over its games against Division I teams (1447 to fit, 365 to score).

| Exponent         | RMSE of W%, fitted seasons | RMSE of W%, 2025-26 | RMSE in wins, 2025-26 |
| ---------------- | -------------------------- | ------------------- | --------------------- |
| **8.6** (fitted) | 0.0597                     | 0.0583              | 1.84                  |
| 10.25            | 0.0650                     | 0.0646              | 2.06                  |
| 11.5             | 0.0736                     | 0.0737              | 2.36                  |
| 14               | 0.0952                     | 0.0955              | 3.06                  |

#### 2. Elo

Every game between Division I teams, 28432 in all. Grid: K 10 to 100 by 2, home court 0 to 200 by 10, share kept 0.30 to 0.95 by 0.05 (13524 runs), then a new Division I team's start 1000 to 1500 by 50 (194 s); fitted on the Brier score of 2022-23 to 2024-25 (2021-22 is the burn-in), scored on 2025-26.

| Values                | K   | Home | Kept | New team | Brier, fitted | Brier, 2025-26 | Log loss, 2025-26 |
| --------------------- | --- | ---- | ---- | -------- | ------------- | -------------- | ----------------- |
| Fitted                | 48  | 90   | 0.75 | 1350     | 0.1865        | 0.1855         | 0.5464            |
| Registry              | 48  | 90   | 0.75 | 1350     | 0.1865        | 0.1855         | 0.5464            |
| NBA's                 | 20  | 80   | 0.65 | 1300     | 0.1921        | 0.1908         | 0.5634            |
| FiveThirtyEight's NBA | 20  | 100  | 0.75 | 1300     | 0.1917        | 0.1905         | 0.5612            |

Baseline, the home side's win rate of 2022-23 to 2024-25 at a home court (64.8 %) and a coin at a neutral site: on 2025-26, Brier 0.2316, log loss 0.6559 against Elo's 0.1855 and 0.5464 (5752 games).

The best values in hindsight on 2025-26 (a third of the grid): K 44, home 70, kept 0.8, Brier 0.1853.

Elo points per point of margin (least squares of the margin on the edge, fitted seasons): 23.3 (the NBA's 28). The margins around that expected margin, 2022-23 to 2025-26 (22957 games): spread 12.06, mean 0.27.

Calibration on 2025-26, out of sample, by tenths of the home side's probability:

| Tenth    | Games | Given | Won  |
| -------- | ----- | ----- | ---- |
| 0–10 %   | 28    | 7.3   | 7.1  |
| 10–20 %  | 141   | 15.9  | 12.8 |
| 20–30 %  | 293   | 25.2  | 23.5 |
| 30–40 %  | 454   | 35.5  | 37.2 |
| 40–50 %  | 609   | 45.0  | 48.3 |
| 50–60 %  | 801   | 55.1  | 55.9 |
| 60–70 %  | 883   | 65.1  | 62.6 |
| 70–80 %  | 998   | 75.1  | 73.3 |
| 80–90 %  | 984   | 85.0  | 85.7 |
| 90–100 % | 561   | 93.6  | 95.5 |

Per season, the fitted values (every rated game):

| Season  | Games | Brier  | Log loss | Baseline log loss |
| ------- | ----- | ------ | -------- | ----------------- |
| 2021-22 | 5475  | 0.1915 | 0.5653   | 0.6605            |
| 2022-23 | 5715  | 0.1888 | 0.5563   | 0.6550            |
| 2023-24 | 5726  | 0.1881 | 0.5549   | 0.6537            |
| 2024-25 | 5764  | 0.1825 | 0.5404   | 0.6545            |
| 2025-26 | 5752  | 0.1855 | 0.5464   | 0.6559            |

Burn-in by games played: each game by the fewer games either team had played between Division I teams earlier in its season, 2021-22 (every team at 1500 on its first game) against the same point of 2022-23 to 2024-25 (ratings carried from the season before). The excess is 2021-22's log loss less the later seasons'; early-season games are lopsided home games against weak opponents in every season, so each is read against the same point of the later seasons, not against their whole:

| Games before | Games, 2021-22 | Log loss, 2021-22 | Log loss, later | Excess  | Brier, 2021-22 | Brier, later |
| ------------ | -------------- | ----------------- | --------------- | ------- | -------------- | ------------ |
| 0–2          | 616            | 0.5511            | 0.4828          | 0.0683  | 0.1819         | 0.1581       |
| 3–5          | 560            | 0.5815            | 0.5627          | 0.0188  | 0.1981         | 0.1919       |
| 6–9          | 746            | 0.5553            | 0.5155          | 0.0398  | 0.1879         | 0.1724       |
| 10–14        | 911            | 0.5812            | 0.5607          | 0.0205  | 0.1991         | 0.1910       |
| 15–19        | 898            | 0.5674            | 0.5749          | -0.0075 | 0.1922         | 0.1960       |
| 20–24        | 865            | 0.5630            | 0.5692          | -0.0062 | 0.1912         | 0.1938       |
| 25–29        | 686            | 0.5386            | 0.5583          | -0.0197 | 0.1807         | 0.1901       |
| 30+          | 193            | 0.6223            | 0.5720          | 0.0503  | 0.2178         | 0.1952       |

From 20 random starts of 1300 to 1700 in 2021-22, a team's final rating against the run from 1500: 2021-22 mean 15.9, largest 75.7; 2022-23 mean 5.5, largest 32.2; 2023-24 mean 2.9, largest 13.9; 2024-25 mean 1.8, largest 7.7; 2025-26 mean 1.3, largest 5.0.

Ratings spread at the end of each season (standard deviation over the teams):

| Season  | Teams | SD    | Mean   |
| ------- | ----- | ----- | ------ |
| 2021-22 | 358   | 162.7 | 1500.0 |
| 2022-23 | 363   | 181.5 | 1497.9 |
| 2023-24 | 362   | 190.4 | 1499.3 |
| 2024-25 | 364   | 200.7 | 1498.7 |
| 2025-26 | 365   | 203.1 | 1498.6 |

#### 3. Adjusted ratings

Each week's games predicted from the fit as of the week before, every season (28432 games), RMSE in points per 100 weighted by possessions, over the season and over its second half. Pull: the mean absolute change of a team's final adjusted net rating from no prior. A team-season holds 2121 possessions at the median (the NBA's about 8,000, the WNBA's 2,700). 110 s.

| Prior (possessions) | RMSE, every week | RMSE, second half | Pull on final net |
| ------------------- | ---------------- | ----------------- | ----------------- |
| 0.01                | 16.264           | 13.516            | 0.000             |
| 50                  | 14.071           | 13.484            | 0.725             |
| 100                 | 13.923           | 13.462            | 1.344             |
| 200                 | 13.834           | 13.437            | 2.349             |
| 400                 | 13.846           | 13.433            | 3.778             |
| 800                 | 13.980           | 13.499            | 5.486             |
| 1600                | 14.218           | 13.679            | 7.180             |

Split-half reliability: the season's games alternately in two halves (by date), each fitted with no prior; the correlation of the two halves' net ratings over the teams.

| Season  | Teams | Split-half r | SD of net rating |
| ------- | ----- | ------------ | ---------------- |
| 2021-22 | 358   | 0.872        | 13.17            |
| 2022-23 | 363   | 0.872        | 12.57            |
| 2023-24 | 362   | 0.916        | 13.61            |
| 2024-25 | 364   | 0.915        | 14.70            |
| 2025-26 | 365   | 0.915        | 15.36            |

#### 4. SRS spread

| Season  | Teams | SD of SRS |
| ------- | ----- | --------- |
| 2021-22 | 358   | 9.88      |
| 2022-23 | 363   | 9.65      |
| 2023-24 | 362   | 10.35     |
| 2024-25 | 364   | 11.14     |
| 2025-26 | 365   | 11.66     |

Fitted: exponent 8.6; Elo K 48, home 90, kept 0.75, new team 1350, per point 23.3, margin spread 12.06.

### NCAA Men: checked

On `/home/yhabie/.cache/metis-dev/t1302h-ncaam`, by `scripts/check-college-models.mjs`, through the built worker and its engine.

#### SRS against Sports Reference

Metis's SRS after each team's last game (every counted game between Division I teams), read through the engine, against the SRS on Sports Reference's school pages, Division I teams matched by T1302.4's map. Tolerance stated before the run: within 0.5 a game on 95 % of team-seasons.

| Season  | Teams | Unmatched | SR's mean | Mean gap | Within 0.5 as published | Centred, within 0.1 | Centred, within 0.5 | Centred, median gap | Centred, largest | Rank r |
| ------- | ----- | --------- | --------- | -------- | ----------------------- | ------------------- | ------------------- | ------------------- | ---------------- | ------ |
| 2021-22 | 358   | 0         | -0.64     | 0.64     | 14.5 %                  | 52.8 %              | 96.9 %              | 0.09                | 0.66             | 0.9996 |
| 2022-23 | 363   | 0         | -0.56     | 0.56     | 32.5 %                  | 38.3 %              | 98.3 %              | 0.14                | 0.72             | 0.9997 |
| 2023-24 | 362   | 0         | -0.60     | 0.60     | 18.0 %                  | 64.4 %              | 100.0 %             | 0.07                | 0.49             | 0.9998 |
| 2024-25 | 364   | 0         | -0.66     | 0.65     | 14.3 %                  | 59.6 %              | 100.0 %             | 0.08                | 0.45             | 0.9998 |
| 2025-26 | 365   | 0         | -0.68     | 0.67     | 8.2 %                   | 63.8 %              | 100.0 %             | 0.07                | 0.34             | 0.9999 |

The largest gaps once each season's mean gap is taken out:

| Season  | Team                          | Metis  | Sports Reference | Gap   | Centred gap |
| ------- | ----------------------------- | ------ | ---------------- | ----- | ----------- |
| 2022-23 | St. Francis Brooklyn Terriers | -16.65 | -16.49           | -0.16 | -0.72       |
| 2022-23 | Long Island University Sharks | -24.58 | -24.46           | -0.12 | -0.68       |
| 2021-22 | Pittsburgh Panthers           | 0.43   | 0.45             | -0.02 | -0.66       |
| 2021-22 | Quinnipiac Bobcats            | -5.57  | -5.56            | -0.01 | -0.64       |
| 2022-23 | Wagner Seahawks               | -11.89 | -11.81           | -0.08 | -0.64       |
| 2022-23 | St. Francis (PA) Red Flash    | -13.46 | -13.41           | -0.05 | -0.61       |
| 2021-22 | Fairfield Stags               | -3.84  | -3.88            | 0.04  | -0.60       |
| 2021-22 | Monmouth Hawks                | -0.35  | -0.39            | 0.04  | -0.60       |

#### PER, Win Shares and WS/40 against Sports Reference

Each season's ten leaders on Sports Reference's leaders page, matched by name (and school where two share a name), against the engine's value over every counted game of the season. Tolerance stated before the run: PER within 0.5, Win Shares within 0.3, WS/40 within 0.01.

| Stat  | Leaders | Within tolerance | Within twice it |
| ----- | ------- | ---------------- | --------------- |
| PER   | 50      | 50 (100.0 %)     | 50 (100.0 %)    |
| WS    | 50      | 49 (98.0 %)      | 50 (100.0 %)    |
| WS/40 | 50      | 50 (100.0 %)     | 50 (100.0 %)    |

0 leaders had no value from the engine (no match by name).

Each season's top three:

| Season  | Stat  | Player               | School             | Sports Reference | Metis | Within tolerance |
| ------- | ----- | -------------------- | ------------------ | ---------------- | ----- | ---------------- |
| 2021-22 | PER   | Keegan Murray        | Iowa               | 37.8             | 37.5  | yes              |
| 2021-22 | PER   | Oscar Tshiebwe       | Kentucky           | 35.0             | 34.9  | yes              |
| 2021-22 | PER   | Norchad Omier        | Arkansas State     | 34.8             | 34.7  | yes              |
| 2021-22 | WS    | Keegan Murray        | Iowa               | 8.7              | 8.5   | yes              |
| 2021-22 | WS    | Oscar Tshiebwe       | Kentucky           | 8.0              | 7.9   | yes              |
| 2021-22 | WS    | Malachi Smith        | Chattanooga        | 7.5              | 7.4   | yes              |
| 2021-22 | WS/40 | Keegan Murray        | Iowa               | 0.311            | 0.306 | yes              |
| 2021-22 | WS/40 | Oscar Tshiebwe       | Kentucky           | 0.297            | 0.293 | yes              |
| 2021-22 | WS/40 | Tari Eason           | LSU                | 0.294            | 0.290 | yes              |
| 2022-23 | PER   | Zach Edey            | Purdue             | 40.2             | 40.0  | yes              |
| 2022-23 | PER   | Trayce Jackson-Davis | Indiana            | 34.2             | 33.9  | yes              |
| 2022-23 | PER   | Dwight Wilson        | Ohio               | 31.8             | 31.5  | yes              |
| 2022-23 | WS    | Zach Edey            | Purdue             | 8.8              | 8.6   | yes              |
| 2022-23 | WS    | Tylor Perry          | North Texas        | 7.8              | 7.8   | yes              |
| 2022-23 | WS    | Darius McGhee        | Liberty            | 7.4              | 7.2   | yes              |
| 2022-23 | WS/40 | Zach Edey            | Purdue             | 0.325            | 0.320 | yes              |
| 2022-23 | WS/40 | Marcus Sasser        | Houston            | 0.261            | 0.258 | yes              |
| 2022-23 | WS/40 | Trayce Jackson-Davis | Indiana            | 0.261            | 0.256 | yes              |
| 2023-24 | PER   | Zach Edey            | Purdue             | 39.3             | 39.1  | yes              |
| 2023-24 | PER   | Donovan Clingan      | UConn              | 34.8             | 34.6  | yes              |
| 2023-24 | PER   | Johni Broome         | Auburn             | 32.5             | 32.6  | yes              |
| 2023-24 | WS    | Zach Edey            | Purdue             | 10.5             | 10.3  | yes              |
| 2023-24 | WS    | Riley Minix          | Morehead State     | 8.2              | 8.1   | yes              |
| 2023-24 | WS    | Cam Spencer          | UConn              | 7.9              | 7.9   | yes              |
| 2023-24 | WS/40 | Zach Edey            | Purdue             | 0.336            | 0.330 | yes              |
| 2023-24 | WS/40 | Donovan Clingan      | UConn              | 0.302            | 0.299 | yes              |
| 2023-24 | WS/40 | Jonathan Mogbo       | San Francisco      | 0.283            | 0.280 | yes              |
| 2024-25 | PER   | Oscar Cluff          | South Dakota State | 35.2             | 35.0  | yes              |
| 2024-25 | PER   | JT Toppin            | Texas Tech         | 32.1             | 32.0  | yes              |
| 2024-25 | PER   | Graham Ike           | Gonzaga            | 32.1             | 31.9  | yes              |
| 2024-25 | WS    | Bennett Stirtz       | Drake              | 8.9              | 8.8   | yes              |
| 2024-25 | WS    | Cooper Flagg         | Duke               | 8.4              | 8.3   | yes              |
| 2024-25 | WS    | Aniwaniwa Tait-Jones | UC San Diego       | 7.8              | 7.7   | yes              |
| 2024-25 | WS/40 | Aniwaniwa Tait-Jones | UC San Diego       | 0.300            | 0.295 | yes              |
| 2024-25 | WS/40 | Cooper Flagg         | Duke               | 0.296            | 0.291 | yes              |
| 2024-25 | WS/40 | Oscar Cluff          | South Dakota State | 0.289            | 0.284 | yes              |
| 2025-26 | PER   | Logan Duncomb        | Winthrop           | 33.9             | 33.8  | yes              |
| 2025-26 | PER   | Cameron Boozer       | Duke               | 33.7             | 33.4  | yes              |
| 2025-26 | PER   | Dylan Faulkner       | Samford            | 31.4             | 31.2  | yes              |
| 2025-26 | WS    | Cameron Boozer       | Duke               | 10.4             | 10.2  | yes              |
| 2025-26 | WS    | Yaxel Lendeborg      | Michigan           | 7.9              | 7.9   | yes              |
| 2025-26 | WS    | Keaton Wagler        | Illinois           | 7.2              | 7.2   | yes              |
| 2025-26 | WS/40 | Cameron Boozer       | Duke               | 0.327            | 0.320 | yes              |
| 2025-26 | WS/40 | Logan Duncomb        | Winthrop           | 0.279            | 0.274 | yes              |
| 2025-26 | WS/40 | Allen Graves         | Santa Clara        | 0.266            | 0.264 | yes              |

#### Elo, out of sample

The constants were fitted on 2021-22 to 2024-25; 2025-26's 5752 games between Division I teams, read from the built `elo_game` table (a win is a rating that rose). Brier 0.1855 and log loss 0.5464, against the home side's rate of 2022-23 to 2024-25 at a home court (64.8 %) and a coin at a neutral site: 0.2316 and 0.6559. The postseason alone (105 games): log loss 0.5547.

| Home side given | Games | Given | Won  |
| --------------- | ----- | ----- | ---- |
| 0–10 %          | 28    | 7.3   | 7.1  |
| 10–20 %         | 141   | 15.9  | 12.8 |
| 20–30 %         | 293   | 25.2  | 23.5 |
| 30–40 %         | 454   | 35.5  | 37.2 |
| 40–50 %         | 609   | 45.0  | 48.3 |
| 50–60 %         | 801   | 55.1  | 55.9 |
| 60–70 %         | 883   | 65.1  | 62.6 |
| 70–80 %         | 998   | 75.1  | 73.3 |
| 80–90 %         | 984   | 85.0  | 85.7 |
| 90–100 %        | 561   | 93.6  | 95.5 |

#### Against SportsDataverse's published ratings

Spearman's rank correlation over Division I teams, per season, of Metis's adjusted net rating and SRS after the last game with SportsDataverse's adjusted efficiency margin (its `*_ratings` file, published for every game of the season), each read through the engine. A check, not a correction: the two sit side by side under their own names.

| Season  | Teams | Adjusted net | SRS   | Elo   | Elo reason                                                                                                          |
| ------- | ----- | ------------ | ----- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| 2021-22 | 358   | 0.992        | 0.996 | –     | Elo is read from 2022-23: every team starts at 1500 in 2021-22, the first season loaded, which settles the ratings. |
| 2022-23 | 363   | 0.987        | 0.996 | 0.929 |                                                                                                                     |
| 2023-24 | 362   | 0.991        | 0.997 | 0.933 |                                                                                                                     |
| 2024-25 | 364   | 0.991        | 0.996 | 0.935 |                                                                                                                     |
| 2025-26 | 365   | 0.992        | 0.997 | 0.928 |                                                                                                                     |

#### Top ten, beside the NCAA tournament

Each season's ten best Division I teams by the adjusted net rating and by Elo after their last game (every counted game, the postseason included, so the ratings have seen the tournament), with how far each went in the NCAA tournament (`game_type` playoffs: First Four, Round of 64, 32, Sweet 16, Elite Eight, Final Four, final). Elo's first season is its burn-in and reads its reason.

##### 2021-22

| Rank | Adjusted net           |      | NCAA tournament | Elo       |     | NCAA tournament |
| ---- | ---------------------- | ---- | --------------- | --------- | --- | --------------- |
| 1    | Gonzaga Bulldogs       | 29.8 | Sweet 16        | (burn-in) |     |                 |
| 2    | Houston Cougars        | 28.1 | Elite Eight     | (burn-in) |     |                 |
| 3    | Arizona Wildcats       | 25.9 | Sweet 16        | (burn-in) |     |                 |
| 4    | Kansas Jayhawks        | 25.2 | Champion        | (burn-in) |     |                 |
| 5    | Baylor Bears           | 24.9 | Round of 32     | (burn-in) |     |                 |
| 6    | Kentucky Wildcats      | 24.2 | Round of 64     | (burn-in) |     |                 |
| 7    | Texas Tech Red Raiders | 23.7 | Sweet 16        | (burn-in) |     |                 |
| 8    | Tennessee Volunteers   | 23.6 | Round of 32     | (burn-in) |     |                 |
| 9    | Duke Blue Devils       | 23.2 | Final Four      | (burn-in) |     |                 |
| 10   | Villanova Wildcats     | 23.1 | Final Four      | (burn-in) |     |                 |

Champion: Kansas Jayhawks, ranked 4 by the adjusted net rating and – by Elo.

##### 2022-23

| Rank | Adjusted net         |      | NCAA tournament | Elo                    |      | NCAA tournament |
| ---- | -------------------- | ---- | --------------- | ---------------------- | ---- | --------------- |
| 1    | Houston Cougars      | 28.5 | Sweet 16        | UConn Huskies          | 2032 | Champion        |
| 2    | UConn Huskies        | 26.7 | Champion        | UCLA Bruins            | 1930 | Sweet 16        |
| 3    | Alabama Crimson Tide | 26.4 | Sweet 16        | Alabama Crimson Tide   | 1928 | Sweet 16        |
| 4    | UCLA Bruins          | 25.3 | Sweet 16        | Texas Longhorns        | 1917 | Elite Eight     |
| 5    | Tennessee Volunteers | 24.6 | Sweet 16        | Houston Cougars        | 1914 | Sweet 16        |
| 6    | Texas Longhorns      | 22.4 | Elite Eight     | San Diego State Aztecs | 1911 | Final           |
| 7    | Gonzaga Bulldogs     | 21.2 | Elite Eight     | Gonzaga Bulldogs       | 1907 | Elite Eight     |
| 8    | Purdue Boilermakers  | 20.9 | Round of 64     | Florida Atlantic Owls  | 1895 | Final Four      |
| 9    | Kansas Jayhawks      | 20.5 | Round of 32     | Miami Hurricanes       | 1887 | Final Four      |
| 10   | Saint Mary's Gaels   | 20.2 | Round of 32     | Memphis Tigers         | 1862 | Round of 64     |

Champion: UConn Huskies, ranked 2 by the adjusted net rating and 1 by Elo.

##### 2023-24

| Rank | Adjusted net             |      | NCAA tournament | Elo                      |      | NCAA tournament |
| ---- | ------------------------ | ---- | --------------- | ------------------------ | ---- | --------------- |
| 1    | UConn Huskies            | 32.4 | Champion        | UConn Huskies            | 2119 | Champion        |
| 2    | Houston Cougars          | 31.8 | Sweet 16        | Purdue Boilermakers      | 2001 | Final           |
| 3    | Purdue Boilermakers      | 28.9 | Final           | Iowa State Cyclones      | 1960 | Sweet 16        |
| 4    | Arizona Wildcats         | 27.2 | Sweet 16        | Houston Cougars          | 1945 | Sweet 16        |
| 5    | Iowa State Cyclones      | 26.0 | Sweet 16        | Auburn Tigers            | 1921 | Round of 64     |
| 6    | Auburn Tigers            | 25.9 | Round of 64     | Illinois Fighting Illini | 1904 | Elite Eight     |
| 7    | Tennessee Volunteers     | 25.0 | Elite Eight     | Gonzaga Bulldogs         | 1899 | Sweet 16        |
| 8    | Duke Blue Devils         | 24.0 | Elite Eight     | Duke Blue Devils         | 1886 | Elite Eight     |
| 9    | North Carolina Tar Heels | 23.7 | Sweet 16        | North Carolina Tar Heels | 1879 | Sweet 16        |
| 10   | Alabama Crimson Tide     | 22.6 | Final Four      | Tennessee Volunteers     | 1872 | Elite Eight     |

Champion: UConn Huskies, ranked 1 by the adjusted net rating and 1 by Elo.

##### 2024-25

| Rank | Adjusted net           |      | NCAA tournament | Elo                     |      | NCAA tournament |
| ---- | ---------------------- | ---- | --------------- | ----------------------- | ---- | --------------- |
| 1    | Duke Blue Devils       | 37.7 | Final Four      | Florida Gators          | 2110 | Champion        |
| 2    | Houston Cougars        | 34.5 | Final           | Houston Cougars         | 2099 | Final           |
| 3    | Auburn Tigers          | 33.1 | Final Four      | Duke Blue Devils        | 2085 | Final Four      |
| 4    | Florida Gators         | 32.3 | Champion        | Auburn Tigers           | 2007 | Final Four      |
| 5    | Tennessee Volunteers   | 28.0 | Elite Eight     | Michigan State Spartans | 1969 | Elite Eight     |
| 6    | Alabama Crimson Tide   | 28.0 | Elite Eight     | Alabama Crimson Tide    | 1964 | Elite Eight     |
| 7    | Gonzaga Bulldogs       | 27.5 | Round of 32     | Tennessee Volunteers    | 1942 | Elite Eight     |
| 8    | Texas Tech Red Raiders | 26.1 | Elite Eight     | St. John's Red Storm    | 1938 | Round of 32     |
| 9    | Maryland Terrapins     | 25.8 | Sweet 16        | Gonzaga Bulldogs        | 1935 | Round of 32     |
| 10   | Arizona Wildcats       | 24.9 | Sweet 16        | Maryland Terrapins      | 1918 | Sweet 16        |

Champion: Florida Gators, ranked 4 by the adjusted net rating and 1 by Elo.

##### 2025-26

| Rank | Adjusted net             |      | NCAA tournament | Elo                      |      | NCAA tournament |
| ---- | ------------------------ | ---- | --------------- | ------------------------ | ---- | --------------- |
| 1    | Michigan Wolverines      | 37.7 | Champion        | Michigan Wolverines      | 2185 | Champion        |
| 2    | Duke Blue Devils         | 36.5 | Elite Eight     | Duke Blue Devils         | 2124 | Elite Eight     |
| 3    | Arizona Wildcats         | 33.9 | Final Four      | Arizona Wildcats         | 2103 | Final Four      |
| 4    | Florida Gators           | 31.7 | Round of 32     | Florida Gators           | 1991 | Round of 32     |
| 5    | Illinois Fighting Illini | 31.2 | Final Four      | UConn Huskies            | 1989 | Final           |
| 6    | Houston Cougars          | 30.9 | Sweet 16        | Houston Cougars          | 1986 | Sweet 16        |
| 7    | Iowa State Cyclones      | 30.6 | Sweet 16        | Illinois Fighting Illini | 1979 | Final Four      |
| 8    | Purdue Boilermakers      | 28.5 | Elite Eight     | St. John's Red Storm     | 1978 | Sweet 16        |
| 9    | Gonzaga Bulldogs         | 28.1 | Round of 32     | Purdue Boilermakers      | 1974 | Elite Eight     |
| 10   | UConn Huskies            | 27.0 | Final           | Arkansas Razorbacks      | 1927 | Sweet 16        |

Champion: Michigan Wolverines, ranked 1 by the adjusted net rating and 1 by Elo.

#### Through the engine, against the tables

Every team-season's SRS, Elo and adjusted net rating after its last game, and every player's PER and Win Shares over the season (each player named, 64 to a query), through the engine over every counted game against the tables (to 1e-9; Elo's burn-in season must read no value).

| Season       | Teams: SRS, Elo and adjusted net equal | Players: PER and WS equal |
| ------------ | -------------------------------------- | ------------------------- |
| 2021-22      | 358 of 358                             | 5075 of 5075              |
| 2022-23      | 363 of 363                             | 5094 of 5094              |
| 2023-24      | 362 of 362                             | 5058 of 5058              |
| 2024-25      | 364 of 364                             | 5115 of 5115              |
| 2025-26      | 365 of 365                             | 5015 of 5015              |
| Every season | 1812 of 1812                           | 25357 of 25357            |

#### Stability

Measured through 2025-26 on the league's own seasons, players across transfers one player (ESPN's athlete id). Labels: not measured 741, medium 431, low 208, high 135; the most pairs a metric had: 6650.

| Metric        | Year to year | Pairs | Split half | Label  |
| ------------- | ------------ | ----- | ---------- | ------ |
| fg3_pct       | 0.080        | 104   | 0.380      | low    |
| per           | 0.616        | 6497  | –          | high   |
| pts           | 0.555        | 6650  | 0.963      | medium |
| team_adj_nrtg | 0.783        | 1445  | –          | high   |
| team_elo      | 0.715        | 1087  | –          | high   |
| team_srs      | 0.855        | 1445  | –          | high   |
| ts_pct        | 0.474        | 2640  | 0.604      | medium |
| usg_pct       | 0.616        | 6497  | 0.953      | high   |
| ws            | 0.550        | 6497  | –          | medium |

Player-season pairs across a transfer (a player whose next season was for another team): 6432, each one player's pair.

### NCAA Women: the constants, fitted

Games between two Division I teams of the season, every counted type, no exhibition or forfeit; fitted on 2021-22 to 2024-25 and scored on 2025-26, by `scripts/fit-college-models.mjs` on `/home/yhabie/.cache/metis-dev/t1302g-ncaaw/stats-ncaaw.duckdb`.

| Season  | Games counted | Between Division I teams | Neutral site | Postseason |
| ------- | ------------- | ------------------------ | ------------ | ---------- |
| 2021-22 | 5534          | 5204                     | 505          | 142        |
| 2022-23 | 5828          | 5516                     | 557          | 142        |
| 2023-24 | 5909          | 5560                     | 553          | 145        |
| 2024-25 | 5968          | 5588                     | 474          | 145        |
| 2025-26 | 6030          | 5624                     | 567          | 145        |

#### 1. Pythagorean exponent

Points for to the x over points for and against each to the x, against the winning percentage of every team-season over its games against Division I teams (1439 to fit, 363 to score).

| Exponent         | RMSE of W%, fitted seasons | RMSE of W%, 2025-26 | RMSE in wins, 2025-26 |
| ---------------- | -------------------------- | ------------------- | --------------------- |
| **6.6** (fitted) | 0.0615                     | 0.0617              | 1.92                  |
| 10.25            | 0.0920                     | 0.0971              | 3.05                  |
| 11.5             | 0.1068                     | 0.1124              | 3.53                  |
| 14               | 0.1341                     | 0.1401              | 4.39                  |

#### 2. Elo

Every game between Division I teams, 27492 in all. Grid: K 10 to 100 by 2, home court 0 to 200 by 10, share kept 0.30 to 0.95 by 0.05 (13524 runs), then a new Division I team's start 1000 to 1500 by 50 (191 s); fitted on the Brier score of 2022-23 to 2024-25 (2021-22 is the burn-in), scored on 2025-26.

| Values                | K   | Home | Kept | New team | Brier, fitted | Brier, 2025-26 | Log loss, 2025-26 |
| --------------------- | --- | ---- | ---- | -------- | ------------- | -------------- | ----------------- |
| Fitted                | 62  | 70   | 0.85 | 1200     | 0.1623        | 0.1600         | 0.4785            |
| Registry              | 60  | 70   | 0.85 | 1200     | 0.1623        | 0.1600         | 0.4787            |
| NBA's                 | 20  | 80   | 0.65 | 1300     | 0.1753        | 0.1730         | 0.5200            |
| FiveThirtyEight's NBA | 20  | 100  | 0.75 | 1300     | 0.1754        | 0.1737         | 0.5186            |

Baseline, the home side's win rate of 2022-23 to 2024-25 at a home court (61.1 %) and a coin at a neutral site: on 2025-26, Brier 0.2413, log loss 0.6757 against Elo's 0.1600 and 0.4785 (5624 games).

The best values in hindsight on 2025-26 (a third of the grid): K 66, home 50, kept 0.7, Brier 0.1595.

Elo points per point of margin (least squares of the margin on the edge, fitted seasons): 21.7 (the NBA's 28). The margins around that expected margin, 2022-23 to 2025-26 (22288 games): spread 13.20, mean 0.21.

Calibration on 2025-26, out of sample, by tenths of the home side's probability:

| Tenth    | Games | Given | Won  |
| -------- | ----- | ----- | ---- |
| 0–10 %   | 274   | 6.0   | 4.7  |
| 10–20 %  | 375   | 15.0  | 14.4 |
| 20–30 %  | 420   | 25.0  | 28.3 |
| 30–40 %  | 426   | 34.9  | 37.1 |
| 40–50 %  | 486   | 45.3  | 46.1 |
| 50–60 %  | 544   | 55.2  | 49.3 |
| 60–70 %  | 555   | 65.0  | 60.5 |
| 70–80 %  | 677   | 75.2  | 72.2 |
| 80–90 %  | 796   | 85.0  | 85.9 |
| 90–100 % | 1071  | 95.2  | 96.7 |

Per season, the fitted values (every rated game):

| Season  | Games | Brier  | Log loss | Baseline log loss |
| ------- | ----- | ------ | -------- | ----------------- |
| 2021-22 | 5204  | 0.1767 | 0.5283   | 0.6768            |
| 2022-23 | 5516  | 0.1667 | 0.5009   | 0.6696            |
| 2023-24 | 5560  | 0.1629 | 0.4891   | 0.6723            |
| 2024-25 | 5588  | 0.1572 | 0.4722   | 0.6696            |
| 2025-26 | 5624  | 0.1600 | 0.4785   | 0.6757            |

Burn-in by games played: each game by the fewer games either team had played between Division I teams earlier in its season, 2021-22 (every team at 1500 on its first game) against the same point of 2022-23 to 2024-25 (ratings carried from the season before). The excess is 2021-22's log loss less the later seasons'; early-season games are lopsided home games against weak opponents in every season, so each is read against the same point of the later seasons, not against their whole:

| Games before | Games, 2021-22 | Log loss, 2021-22 | Log loss, later | Excess  | Brier, 2021-22 | Brier, later |
| ------------ | -------------- | ----------------- | --------------- | ------- | -------------- | ------------ |
| 0–2          | 599            | 0.5808            | 0.4559          | 0.1249  | 0.1965         | 0.1508       |
| 3–5          | 584            | 0.5501            | 0.4727          | 0.0774  | 0.1850         | 0.1562       |
| 6–9          | 756            | 0.5274            | 0.4501          | 0.0774  | 0.1759         | 0.1477       |
| 10–14        | 895            | 0.5386            | 0.4861          | 0.0526  | 0.1810         | 0.1617       |
| 15–19        | 885            | 0.5008            | 0.5031          | -0.0023 | 0.1658         | 0.1681       |
| 20–24        | 852            | 0.4898            | 0.5110          | -0.0213 | 0.1621         | 0.1720       |
| 25–29        | 544            | 0.5339            | 0.5047          | 0.0293  | 0.1793         | 0.1686       |
| 30+          | 89             | 0.5455            | 0.5336          | 0.0120  | 0.1853         | 0.1804       |

From 20 random starts of 1300 to 1700 in 2021-22, a team's final rating against the run from 1500: 2021-22 mean 11.9, largest 65.1; 2022-23 mean 5.0, largest 28.2; 2023-24 mean 3.2, largest 17.5; 2024-25 mean 2.5, largest 11.5; 2025-26 mean 2.0, largest 8.5.

Ratings spread at the end of each season (standard deviation over the teams):

| Season  | Teams | SD    | Mean   |
| ------- | ----- | ----- | ------ |
| 2021-22 | 356   | 218.4 | 1500.0 |
| 2022-23 | 361   | 260.0 | 1495.8 |
| 2023-24 | 360   | 281.8 | 1497.9 |
| 2024-25 | 362   | 297.9 | 1496.6 |
| 2025-26 | 363   | 303.6 | 1496.3 |

#### 3. Adjusted ratings

Each week's games predicted from the fit as of the week before, every season (27492 games), RMSE in points per 100 weighted by possessions, over the season and over its second half. Pull: the mean absolute change of a team's final adjusted net rating from no prior. A team-season holds 2125 possessions at the median (the NBA's about 8,000, the WNBA's 2,700). 103 s.

| Prior (possessions) | RMSE, every week | RMSE, second half | Pull on final net |
| ------------------- | ---------------- | ----------------- | ----------------- |
| 0.01                | 16.439           | 13.357            | 0.000             |
| 50                  | 13.900           | 13.329            | 0.964             |
| 100                 | 13.827           | 13.315            | 1.780             |
| 200                 | 13.866           | 13.319            | 3.112             |
| 400                 | 14.080           | 13.391            | 5.040             |
| 800                 | 14.491           | 13.615            | 7.411             |
| 1600                | 15.044           | 14.047            | 9.834             |

Split-half reliability: the season's games alternately in two halves (by date), each fitted with no prior; the correlation of the two halves' net ratings over the teams.

| Season  | Teams | Split-half r | SD of net rating |
| ------- | ----- | ------------ | ---------------- |
| 2021-22 | 356   | 0.933        | 18.38            |
| 2022-23 | 361   | 0.941        | 19.37            |
| 2023-24 | 360   | 0.949        | 19.68            |
| 2024-25 | 362   | 0.950        | 20.48            |
| 2025-26 | 363   | 0.953        | 20.74            |

#### 4. SRS spread

| Season  | Teams | SD of SRS |
| ------- | ----- | --------- |
| 2021-22 | 356   | 13.62     |
| 2022-23 | 361   | 14.48     |
| 2023-24 | 360   | 14.68     |
| 2024-25 | 362   | 15.35     |
| 2025-26 | 363   | 15.61     |

Fitted: exponent 6.6; Elo K 62, home 70, kept 0.85, new team 1200, per point 21.7, margin spread 13.20.

### NCAA Women: checked

On `/home/yhabie/.cache/metis-dev/t1302h-ncaaw`, by `scripts/check-college-models.mjs`, through the built worker and its engine.

#### SRS against Sports Reference

Metis's SRS after each team's last game (every counted game between Division I teams), read through the engine, against the SRS on Sports Reference's school pages, Division I teams matched by T1302.4's map. Tolerance stated before the run: within 0.5 a game on 95 % of team-seasons.

| Season  | Teams | Unmatched | SR's mean | Mean gap | Within 0.5 as published | Centred, within 0.1 | Centred, within 0.5 | Centred, median gap | Centred, largest | Rank r |
| ------- | ----- | --------- | --------- | -------- | ----------------------- | ------------------- | ------------------- | ------------------- | ---------------- | ------ |
| 2021-22 | 356   | 0         | -0.88     | 0.89     | 3.1 %                   | 53.4 %              | 95.2 %              | 0.09                | 0.90             | 0.9998 |
| 2022-23 | 361   | 0         | -0.87     | 0.87     | 4.4 %                   | 52.1 %              | 98.1 %              | 0.09                | 0.81             | 0.9998 |
| 2023-24 | 360   | 0         | -0.84     | 0.82     | 5.0 %                   | 39.2 %              | 95.0 %              | 0.13                | 0.74             | 0.9997 |
| 2024-25 | 362   | 0         | -0.89     | 0.90     | 3.6 %                   | 54.7 %              | 98.1 %              | 0.09                | 0.72             | 0.9998 |
| 2025-26 | 363   | 0         | -0.90     | 0.89     | 2.2 %                   | 47.9 %              | 98.1 %              | 0.11                | 0.99             | 0.9998 |

The largest gaps once each season's mean gap is taken out:

| Season  | Team                          | Metis  | Sports Reference | Gap   | Centred gap |
| ------- | ----------------------------- | ------ | ---------------- | ----- | ----------- |
| 2025-26 | Pennsylvania Quakers          | 2.83   | 2.93             | -0.10 | -0.99       |
| 2025-26 | Dartmouth Big Green           | -17.83 | -17.73           | -0.10 | -0.99       |
| 2021-22 | Denver Pioneers               | -9.37  | -9.35            | -0.02 | -0.90       |
| 2021-22 | Western Illinois Leathernecks | -6.46  | -6.45            | -0.01 | -0.89       |
| 2025-26 | Brown Bears                   | 0.68   | 0.67             | 0.01  | -0.88       |
| 2022-23 | Furman Paladins               | -14.77 | -14.84           | 0.07  | -0.81       |
| 2021-22 | Oral Roberts Golden Eagles    | -2.60  | -2.69            | 0.09  | -0.80       |
| 2025-26 | Cornell Big Red               | -13.49 | -13.58           | 0.09  | -0.80       |

#### PER, Win Shares and WS/40 against Sports Reference

Each season's ten leaders on Sports Reference's leaders page, matched by name (and school where two share a name), against the engine's value over every counted game of the season. Tolerance stated before the run: PER within 0.5, Win Shares within 0.3, WS/40 within 0.01.

| Stat  | Leaders | Within tolerance | Within twice it |
| ----- | ------- | ---------------- | --------------- |
| PER   | 50      | 42 (84.0 %)      | 48 (96.0 %)     |
| WS    | 50      | 44 (88.0 %)      | 50 (100.0 %)    |
| WS/40 | 50      | 39 (78.0 %)      | 48 (96.0 %)     |

0 leaders had no value from the engine (no match by name).

Each season's top three:

| Season  | Stat  | Player         | School             | Sports Reference | Metis | Within tolerance |
| ------- | ----- | -------------- | ------------------ | ---------------- | ----- | ---------------- |
| 2021-22 | PER   | Macee Williams | IU Indianapolis    | 44.1             | 44.5  | yes              |
| 2021-22 | PER   | Aliyah Boston  | South Carolina     | 43.1             | 45.8  | no               |
| 2021-22 | PER   | Aneesah Morrow | DePaul             | 40.2             | 40.6  | yes              |
| 2021-22 | WS    | Aliyah Boston  | South Carolina     | 11.6             | 11.6  | yes              |
| 2021-22 | WS    | NaLyssa Smith  | Baylor             | 9.3              | 9.2   | yes              |
| 2021-22 | WS    | Caitlin Clark  | Iowa               | 9.1              | 8.8   | yes              |
| 2021-22 | WS/40 | Aliyah Boston  | South Carolina     | 0.441            | 0.455 | no               |
| 2021-22 | WS/40 | Macee Williams | IU Indianapolis    | 0.413            | 0.411 | yes              |
| 2021-22 | WS/40 | Hannah Sjerven | South Dakota       | 0.358            | 0.346 | no               |
| 2022-23 | PER   | Maddy Siegrist | Villanova          | 45.4             | 45.1  | yes              |
| 2022-23 | PER   | Angel Reese    | LSU                | 44.4             | 44.3  | yes              |
| 2022-23 | PER   | Caitlin Clark  | Iowa               | 40.5             | 40.1  | yes              |
| 2022-23 | WS    | Maddy Siegrist | Villanova          | 13.3             | 13.1  | yes              |
| 2022-23 | WS    | Angel Reese    | LSU                | 13.2             | 13.1  | yes              |
| 2022-23 | WS    | Caitlin Clark  | Iowa               | 12.0             | 11.8  | yes              |
| 2022-23 | WS/40 | Angel Reese    | LSU                | 0.435            | 0.433 | yes              |
| 2022-23 | WS/40 | Maddy Siegrist | Villanova          | 0.405            | 0.397 | yes              |
| 2022-23 | WS/40 | Aliyah Boston  | South Carolina     | 0.380            | 0.380 | yes              |
| 2023-24 | PER   | Cameron Brink  | Stanford           | 45.7             | 45.9  | yes              |
| 2023-24 | PER   | Yvonne Ejim    | Gonzaga            | 43.5             | 43.2  | yes              |
| 2023-24 | PER   | Caitlin Clark  | Iowa               | 42.9             | 42.4  | yes              |
| 2023-24 | WS    | Caitlin Clark  | Iowa               | 13.3             | 13.1  | yes              |
| 2023-24 | WS    | Paige Bueckers | UConn              | 12.1             | 12.0  | yes              |
| 2023-24 | WS    | Hannah Hidalgo | Notre Dame         | 10.0             | 9.8   | yes              |
| 2023-24 | WS/40 | Cameron Brink  | Stanford           | 0.416            | 0.411 | yes              |
| 2023-24 | WS/40 | Caitlin Clark  | Iowa               | 0.393            | 0.384 | yes              |
| 2023-24 | WS/40 | Yvonne Ejim    | Gonzaga            | 0.392            | 0.390 | yes              |
| 2024-25 | PER   | Sarah Strong   | UConn              | 41.3             | 41.0  | yes              |
| 2024-25 | PER   | Lauren Betts   | UCLA               | 41.2             | 40.9  | yes              |
| 2024-25 | PER   | Paige Bueckers | UConn              | 40.5             | 40.3  | yes              |
| 2024-25 | WS    | Paige Bueckers | UConn              | 12.4             | 12.1  | no               |
| 2024-25 | WS    | Sarah Strong   | UConn              | 12.3             | 12.0  | yes              |
| 2024-25 | WS    | Sedona Prince  | TCU                | 9.7              | 9.7   | yes              |
| 2024-25 | WS/40 | Paige Bueckers | UConn              | 0.430            | 0.421 | yes              |
| 2024-25 | WS/40 | Sarah Strong   | UConn              | 0.429            | 0.419 | yes              |
| 2024-25 | WS/40 | Harmoni Turner | Harvard            | 0.377            | 0.371 | yes              |
| 2025-26 | PER   | Brooklyn Meyer | South Dakota State | 45.7             | 45.0  | no               |
| 2025-26 | PER   | Avery Koenen   | North Dakota State | 45.6             | 45.6  | yes              |
| 2025-26 | PER   | Sarah Strong   | UConn              | 44.3             | 44.0  | yes              |
| 2025-26 | WS    | Sarah Strong   | UConn              | 12.4             | 12.2  | yes              |
| 2025-26 | WS    | Hannah Hidalgo | Notre Dame         | 11.4             | 11.1  | no               |
| 2025-26 | WS    | Madison Booker | Texas              | 10.9             | 10.7  | yes              |
| 2025-26 | WS/40 | Sarah Strong   | UConn              | 0.476            | 0.466 | yes              |
| 2025-26 | WS/40 | Avery Koenen   | North Dakota State | 0.440            | 0.431 | yes              |
| 2025-26 | WS/40 | Brooklyn Meyer | South Dakota State | 0.411            | 0.401 | yes              |

#### Elo, out of sample

The constants were fitted on 2021-22 to 2024-25; 2025-26's 5624 games between Division I teams, read from the built `elo_game` table (a win is a rating that rose). Brier 0.1600 and log loss 0.4785, against the home side's rate of 2022-23 to 2024-25 at a home court (61.1 %) and a coin at a neutral site: 0.2413 and 0.6757. The postseason alone (145 games): log loss 0.5063.

| Home side given | Games | Given | Won  |
| --------------- | ----- | ----- | ---- |
| 0–10 %          | 274   | 6.0   | 4.7  |
| 10–20 %         | 375   | 15.0  | 14.4 |
| 20–30 %         | 420   | 25.0  | 28.3 |
| 30–40 %         | 426   | 34.9  | 37.1 |
| 40–50 %         | 486   | 45.3  | 46.1 |
| 50–60 %         | 544   | 55.2  | 49.3 |
| 60–70 %         | 555   | 65.0  | 60.5 |
| 70–80 %         | 677   | 75.2  | 72.2 |
| 80–90 %         | 796   | 85.0  | 85.9 |
| 90–100 %        | 1071  | 95.2  | 96.7 |

#### Against SportsDataverse's published ratings

Spearman's rank correlation over Division I teams, per season, of Metis's adjusted net rating and SRS after the last game with SportsDataverse's adjusted efficiency margin (its `*_ratings` file, published for every game of the season), each read through the engine. A check, not a correction: the two sit side by side under their own names.

| Season  | Teams | Adjusted net | SRS   | Elo   | Elo reason                                                                                                          |
| ------- | ----- | ------------ | ----- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| 2021-22 | 356   | 0.996        | 0.998 | –     | Elo is read from 2022-23: every team starts at 1500 in 2021-22, the first season loaded, which settles the ratings. |
| 2022-23 | 361   | 0.997        | 0.998 | 0.934 |                                                                                                                     |
| 2023-24 | 360   | 0.997        | 0.998 | 0.953 |                                                                                                                     |
| 2024-25 | 362   | 0.997        | 0.997 | 0.961 |                                                                                                                     |
| 2025-26 | 363   | 0.998        | 0.998 | 0.964 |                                                                                                                     |

#### Top ten, beside the NCAA tournament

Each season's ten best Division I teams by the adjusted net rating and by Elo after their last game (every counted game, the postseason included, so the ratings have seen the tournament), with how far each went in the NCAA tournament (`game_type` playoffs: First Four, Round of 64, 32, Sweet 16, Elite Eight, Final Four, final). Elo's first season is its burn-in and reads its reason.

##### 2021-22

| Rank | Adjusted net             |      | NCAA tournament | Elo       |     | NCAA tournament |
| ---- | ------------------------ | ---- | --------------- | --------- | --- | --------------- |
| 1    | South Carolina Gamecocks | 49.9 | Champion        | (burn-in) |     |                 |
| 2    | NC State Wolfpack        | 44.5 | Elite Eight     | (burn-in) |     |                 |
| 3    | Stanford Cardinal        | 43.5 | Final Four      | (burn-in) |     |                 |
| 4    | UConn Huskies            | 42.3 | Final           | (burn-in) |     |                 |
| 5    | Louisville Cardinals     | 38.9 | Final Four      | (burn-in) |     |                 |
| 6    | North Carolina Tar Heels | 36.9 | Sweet 16        | (burn-in) |     |                 |
| 7    | Texas Longhorns          | 36.2 | Elite Eight     | (burn-in) |     |                 |
| 8    | Baylor Bears             | 35.8 | Round of 32     | (burn-in) |     |                 |
| 9    | Iowa State Cyclones      | 32.2 | Sweet 16        | (burn-in) |     |                 |
| 10   | Virginia Tech Hokies     | 32.0 | Round of 64     | (burn-in) |     |                 |

Champion: South Carolina Gamecocks, ranked 1 by the adjusted net rating and – by Elo.

##### 2022-23

| Rank | Adjusted net              |      | NCAA tournament | Elo                       |      | NCAA tournament |
| ---- | ------------------------- | ---- | --------------- | ------------------------- | ---- | --------------- |
| 1    | South Carolina Gamecocks  | 58.0 | Final Four      | South Carolina Gamecocks  | 2317 | Final Four      |
| 2    | LSU Tigers                | 44.0 | Champion        | LSU Tigers                | 2230 | Champion        |
| 3    | UConn Huskies             | 43.1 | Sweet 16        | Virginia Tech Hokies      | 2160 | Final Four      |
| 4    | Stanford Cardinal         | 43.0 | Round of 32     | Iowa Hawkeyes             | 2155 | Final           |
| 5    | Indiana Hoosiers          | 40.9 | Round of 32     | Maryland Terrapins        | 2094 | Elite Eight     |
| 6    | Iowa Hawkeyes             | 39.5 | Final           | Louisville Cardinals      | 2077 | Elite Eight     |
| 7    | Virginia Tech Hokies      | 37.2 | Final Four      | Indiana Hoosiers          | 2076 | Round of 32     |
| 8    | Utah Utes                 | 36.9 | Sweet 16        | UConn Huskies             | 2070 | Sweet 16        |
| 9    | Notre Dame Fighting Irish | 36.1 | Sweet 16        | Tennessee Lady Volunteers | 2049 | Sweet 16        |
| 10   | Texas Longhorns           | 36.0 | Round of 32     | Stanford Cardinal         | 2038 | Round of 32     |

Champion: LSU Tigers, ranked 2 by the adjusted net rating and 2 by Elo.

##### 2023-24

| Rank | Adjusted net              |      | NCAA tournament | Elo                       |      | NCAA tournament |
| ---- | ------------------------- | ---- | --------------- | ------------------------- | ---- | --------------- |
| 1    | South Carolina Gamecocks  | 56.6 | Champion        | South Carolina Gamecocks  | 2435 | Champion        |
| 2    | UConn Huskies             | 48.2 | Final Four      | UConn Huskies             | 2227 | Final Four      |
| 3    | Texas Longhorns           | 45.7 | Elite Eight     | Iowa Hawkeyes             | 2227 | Final           |
| 4    | Iowa Hawkeyes             | 44.7 | Final           | LSU Tigers                | 2200 | Elite Eight     |
| 5    | Stanford Cardinal         | 42.9 | Sweet 16        | Texas Longhorns           | 2165 | Elite Eight     |
| 6    | UCLA Bruins               | 41.6 | Sweet 16        | Notre Dame Fighting Irish | 2159 | Sweet 16        |
| 7    | LSU Tigers                | 40.4 | Elite Eight     | NC State Wolfpack         | 2141 | Final Four      |
| 8    | Notre Dame Fighting Irish | 39.5 | Sweet 16        | USC Trojans               | 2127 | Elite Eight     |
| 9    | Ohio State Buckeyes       | 37.7 | Round of 32     | UCLA Bruins               | 2072 | Sweet 16        |
| 10   | USC Trojans               | 37.2 | Elite Eight     | Gonzaga Bulldogs          | 2056 | Sweet 16        |

Champion: South Carolina Gamecocks, ranked 1 by the adjusted net rating and 1 by Elo.

##### 2024-25

| Rank | Adjusted net              |      | NCAA tournament | Elo                       |      | NCAA tournament |
| ---- | ------------------------- | ---- | --------------- | ------------------------- | ---- | --------------- |
| 1    | UConn Huskies             | 60.6 | Champion        | UConn Huskies             | 2519 | Champion        |
| 2    | South Carolina Gamecocks  | 55.4 | Final           | South Carolina Gamecocks  | 2367 | Final           |
| 3    | Texas Longhorns           | 51.3 | Final Four      | Texas Longhorns           | 2281 | Final Four      |
| 4    | USC Trojans               | 48.0 | Elite Eight     | UCLA Bruins               | 2268 | Final Four      |
| 5    | Notre Dame Fighting Irish | 47.7 | Sweet 16        | USC Trojans               | 2260 | Elite Eight     |
| 6    | UCLA Bruins               | 47.7 | Final Four      | Duke Blue Devils          | 2221 | Elite Eight     |
| 7    | Duke Blue Devils          | 44.3 | Elite Eight     | TCU Horned Frogs          | 2177 | Elite Eight     |
| 8    | LSU Tigers                | 41.9 | Elite Eight     | LSU Tigers                | 2173 | Elite Eight     |
| 9    | TCU Horned Frogs          | 41.8 | Elite Eight     | NC State Wolfpack         | 2166 | Sweet 16        |
| 10   | Kansas State Wildcats     | 41.8 | Sweet 16        | Notre Dame Fighting Irish | 2160 | Sweet 16        |

Champion: UConn Huskies, ranked 1 by the adjusted net rating and 1 by Elo.

##### 2025-26

| Rank | Adjusted net             |      | NCAA tournament | Elo                        |      | NCAA tournament |
| ---- | ------------------------ | ---- | --------------- | -------------------------- | ---- | --------------- |
| 1    | UConn Huskies            | 64.5 | Final Four      | UCLA Bruins                | 2546 | Champion        |
| 2    | UCLA Bruins              | 63.3 | Champion        | UConn Huskies              | 2445 | Final Four      |
| 3    | South Carolina Gamecocks | 60.4 | Final           | Texas Longhorns            | 2394 | Final Four      |
| 4    | Texas Longhorns          | 59.5 | Final Four      | South Carolina Gamecocks   | 2390 | Final           |
| 5    | LSU Tigers               | 56.6 | Sweet 16        | LSU Tigers                 | 2256 | Sweet 16        |
| 6    | Michigan Wolverines      | 46.7 | Elite Eight     | Duke Blue Devils           | 2188 | Elite Eight     |
| 7    | Duke Blue Devils         | 42.5 | Elite Eight     | Michigan Wolverines        | 2168 | Elite Eight     |
| 8    | Vanderbilt Commodores    | 41.9 | Sweet 16        | TCU Horned Frogs           | 2144 | Elite Eight     |
| 9    | Louisville Cardinals     | 40.0 | Sweet 16        | Notre Dame Fighting Irish  | 2132 | Elite Eight     |
| 10   | Kentucky Wildcats        | 39.5 | Sweet 16        | West Virginia Mountaineers | 2124 | Round of 32     |

Champion: UCLA Bruins, ranked 2 by the adjusted net rating and 1 by Elo.

#### Through the engine, against the tables

Every team-season's SRS, Elo and adjusted net rating after its last game, and every player's PER and Win Shares over the season (each player named, 64 to a query), through the engine over every counted game against the tables (to 1e-9; Elo's burn-in season must read no value).

| Season       | Teams: SRS, Elo and adjusted net equal | Players: PER and WS equal |
| ------------ | -------------------------------------- | ------------------------- |
| 2021-22      | 356 of 356                             | 4798 of 4798              |
| 2022-23      | 361 of 361                             | 4704 of 4704              |
| 2023-24      | 360 of 360                             | 4692 of 4692              |
| 2024-25      | 362 of 362                             | 4737 of 4737              |
| 2025-26      | 363 of 363                             | 4692 of 4692              |
| Every season | 1802 of 1802                           | 23623 of 23623            |

1 of the players are keyed by D28's fallback (13 digits), which the engine does not take in `scope.players`: read through their team's rows instead.

#### Stability

Measured through 2025-26 on the league's own seasons, players across transfers one player (ESPN's athlete id). Labels: not measured 742, high 319, medium 293, low 161; the most pairs a metric had: 6974.

| Metric        | Year to year | Pairs | Split half | Label  |
| ------------- | ------------ | ----- | ---------- | ------ |
| fg3_pct       | 0.430        | 218   | 0.502      | medium |
| per           | 0.745        | 6566  | –          | high   |
| pts           | 0.674        | 6974  | 0.963      | high   |
| team_adj_nrtg | 0.863        | 1437  | –          | high   |
| team_elo      | 0.823        | 1081  | –          | high   |
| team_srs      | 0.888        | 1437  | –          | high   |
| ts_pct        | 0.631        | 2813  | 0.680      | high   |
| usg_pct       | 0.694        | 6566  | 0.956      | high   |
| ws            | 0.693        | 6566  | –          | high   |

Player-season pairs across a transfer (a player whose next season was for another team): 4571, each one player's pair.
