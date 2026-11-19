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
