# WNBA agreement checks

Written by `scripts/check-agreement.mjs --league=wnba` from a real load. Percentages are the share of rows that match exactly. What these numbers mean for the app is in [wnba-data-sources.md](wnba-data-sources.md). Seasons are the year they were played.

## Games and teams by season

Regular-season games played and teams, against Basketball-Reference's season pages (`wnba-data-sources.md`, "Season lengths and team counts"); the script fails on any difference. **From game logs:** games the league's schedule lacks, taken from its game logs. **Forfeit:** a 0-0 game ESPN marks a forfeit, counted for the side ESPN's standings give the win. **Linked:** with ESPN's id, through the crosswalk or the same teams within a day. The Commissioner's Cup final and the All-Star Game are ESPN's alone. **Other:** games not played or of another type; there should be none.

| Season | Teams | Regular-season games | Real length | From game logs | Forfeit | Linked to ESPN | Playoff games  | Cup final | All-Star | Other |
| ------ | ----- | -------------------- | ----------- | -------------- | ------- | -------------- | -------------- | --------- | -------- | ----- |
| 1997   | 8     | 112                  | yes         | –              | –       | 112 (100.0 %)  | 3 (0 linked)   | –         | –        | –     |
| 1998   | 10    | 150                  | yes         | –              | –       | 150 (100.0 %)  | 8 (0 linked)   | –         | –        | –     |
| 1999   | 12    | 192                  | yes         | –              | –       | 192 (100.0 %)  | 11 (11 linked) | –         | –        | –     |
| 2000   | 16    | 256                  | yes         | –              | –       | 256 (100.0 %)  | 16 (16 linked) | –         | –        | –     |
| 2001   | 16    | 256                  | yes         | –              | –       | 255 (99.6 %)   | 18 (18 linked) | –         | 1        | –     |
| 2002   | 16    | 256                  | yes         | –              | –       | 256 (100.0 %)  | 17 (15 linked) | –         | 1        | –     |
| 2003   | 14    | 238                  | yes         | –              | –       | 236 (99.2 %)   | 19 (19 linked) | –         | 1        | –     |
| 2004   | 13    | 221                  | yes         | –              | –       | 218 (98.6 %)   | 19 (19 linked) | –         | 1        | –     |
| 2005   | 13    | 221                  | yes         | –              | –       | 221 (100.0 %)  | 17 (17 linked) | –         | 1        | –     |
| 2006   | 14    | 238                  | yes         | –              | –       | 238 (100.0 %)  | 19 (19 linked) | –         | 1        | –     |
| 2007   | 13    | 221                  | yes         | 1              | –       | 221 (100.0 %)  | 21 (21 linked) | –         | 1        | –     |
| 2008   | 14    | 238                  | yes         | –              | –       | 238 (100.0 %)  | 21 (21 linked) | –         | –        | –     |
| 2009   | 13    | 221                  | yes         | 1              | –       | 221 (100.0 %)  | 21 (21 linked) | –         | 1        | –     |
| 2010   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 16 (16 linked) | –         | 1        | –     |
| 2011   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 19 (19 linked) | –         | 1        | –     |
| 2012   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 19 (19 linked) | –         | –        | –     |
| 2013   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 17 (17 linked) | –         | 1        | –     |
| 2014   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 18 (18 linked) | –         | 1        | –     |
| 2015   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 21 (21 linked) | –         | 1        | –     |
| 2016   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 16 (16 linked) | –         | –        | –     |
| 2017   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 15 (15 linked) | –         | 1        | –     |
| 2018   | 12    | 204                  | yes         | –              | 1       | 204 (100.0 %)  | 17 (17 linked) | –         | 1        | –     |
| 2019   | 12    | 204                  | yes         | –              | –       | 204 (100.0 %)  | 16 (16 linked) | –         | 1        | –     |
| 2020   | 12    | 132                  | yes         | –              | –       | 132 (100.0 %)  | 15 (15 linked) | –         | –        | –     |
| 2021   | 12    | 192                  | yes         | –              | –       | 192 (100.0 %)  | 17 (17 linked) | 1         | 1        | –     |
| 2022   | 12    | 216                  | yes         | –              | –       | 216 (100.0 %)  | 23 (23 linked) | 1         | 1        | –     |
| 2023   | 12    | 240                  | yes         | –              | –       | 240 (100.0 %)  | 20 (20 linked) | 1         | 1        | –     |
| 2024   | 12    | 240                  | yes         | –              | –       | 240 (100.0 %)  | 22 (22 linked) | 1         | 1        | –     |
| 2025   | 13    | 286                  | yes         | –              | –       | 286 (100.0 %)  | 24 (24 linked) | 1         | 1        | –     |
| 2026   | 15    | 330                  | yes         | –              | –       | 330 (100.0 %)  | 22 (22 linked) | 1         | 1        | –     |

## Team records against the standings

Wins and losses from `game` (regular season, played; the forfeit counted for its winner) against the league dashboards' standings (`src_dash_standings`), which agree with Basketball-Reference on every team-season (`wnba-data-sources.md`). **380 of 380** team-seasons equal.

| Season | Teams | Equal | Differ |
| ------ | ----- | ----- | ------ |
| 1997   | 8     | 8     | –      |
| 1998   | 10    | 10    | –      |
| 1999   | 12    | 12    | –      |
| 2000   | 16    | 16    | –      |
| 2001   | 16    | 16    | –      |
| 2002   | 16    | 16    | –      |
| 2003   | 14    | 14    | –      |
| 2004   | 13    | 13    | –      |
| 2005   | 13    | 13    | –      |
| 2006   | 14    | 14    | –      |
| 2007   | 13    | 13    | –      |
| 2008   | 14    | 14    | –      |
| 2009   | 13    | 13    | –      |
| 2010   | 12    | 12    | –      |
| 2011   | 12    | 12    | –      |
| 2012   | 12    | 12    | –      |
| 2013   | 12    | 12    | –      |
| 2014   | 12    | 12    | –      |
| 2015   | 12    | 12    | –      |
| 2016   | 12    | 12    | –      |
| 2017   | 12    | 12    | –      |
| 2018   | 12    | 12    | –      |
| 2019   | 12    | 12    | –      |
| 2020   | 12    | 12    | –      |
| 2021   | 12    | 12    | –      |
| 2022   | 12    | 12    | –      |
| 2023   | 12    | 12    | –      |
| 2024   | 12    | 12    | –      |
| 2025   | 13    | 13    | –      |
| 2026   | 15    | 15    | –      |

## Game types, sites and overtimes

**Schedule** and **ESPN differ:** games whose type in the league's schedule (`regular-season`, `playoffs`) or ESPN's (`2`, `3`) is not the game's; the type is the league's id. **Filed by ESPN as regular season:** the Cup final and the All-Star Game, which ESPN files as `season_type` 2. **Neutral:** ESPN's `neutral_site`. **Overtimes:** from the game logs' team minutes, or ESPN's last period on its final rows; **unknown** where neither holds (the game logs' team minutes are 0 before 2004 and ESPN's rows before 2002 are not final). **Against the play by play:** the overtimes against the WNBA's play by play's last period, where both are known.

| Season | Periods | Schedule differs | ESPN differs | Filed by ESPN as regular season | Neutral | Overtime games | Overtimes unknown | Against the play by play |
| ------ | ------- | ---------------- | ------------ | ------------------------------- | ------- | -------------- | ----------------- | ------------------------ |
| 1997   | 2       | 0                | 0            | –                               | –       | 9              | –                 | 115 of 115               |
| 1998   | 2       | 0                | 0            | –                               | –       | 7              | –                 | 157 of 157               |
| 1999   | 2       | 0                | 0            | –                               | –       | 10             | –                 | 203 of 203               |
| 2000   | 2       | 0                | 0            | –                               | –       | 14             | –                 | 272 of 272               |
| 2001   | 2       | 0                | 0            | 1                               | –       | 23             | 1                 | 274 of 274               |
| 2002   | 2       | 0                | 0            | 1                               | –       | 18             | –                 | 273 of 273               |
| 2003   | 2       | 0                | 0            | 1                               | –       | 14             | –                 | 257 of 257               |
| 2004   | 2       | 0                | 0            | 1                               | –       | 18             | –                 | 240 of 240               |
| 2005   | 2       | 0                | 0            | 1                               | –       | 14             | –                 | 238 of 238               |
| 2006   | 4       | 0                | 0            | 1                               | –       | 9              | –                 | 256 of 256               |
| 2007   | 4       | 0                | 0            | 1                               | –       | 20             | –                 | 241 of 241               |
| 2008   | 4       | 0                | 0            | –                               | –       | 19             | –                 | 259 of 259               |
| 2009   | 4       | 0                | 0            | 1                               | –       | 27             | –                 | 241 of 241               |
| 2010   | 4       | 0                | 0            | 1                               | –       | 14             | –                 | 220 of 220               |
| 2011   | 4       | 0                | 0            | 1                               | –       | 12             | –                 | 223 of 223               |
| 2012   | 4       | 0                | 0            | –                               | –       | 14             | –                 | 223 of 223               |
| 2013   | 4       | 0                | 0            | 1                               | 1       | 12             | –                 | 221 of 221               |
| 2014   | 4       | 0                | 0            | 1                               | 1       | 21             | –                 | 222 of 222               |
| 2015   | 4       | 0                | 0            | 1                               | 1       | 14             | –                 | 225 of 225               |
| 2016   | 4       | 0                | 0            | –                               | 2       | 20             | –                 | 220 of 220               |
| 2017   | 4       | 0                | 0            | 1                               | 1       | 12             | –                 | 219 of 219               |
| 2018   | 4       | 0                | 0            | 1                               | 1       | 7              | 1                 | 220 of 220               |
| 2019   | 4       | 0                | 0            | 1                               | 1       | 5              | –                 | 220 of 220               |
| 2020   | 4       | 0                | 0            | –                               | –       | 4              | –                 | 147 of 147               |
| 2021   | 4       | 0                | 0            | 2                               | 2       | 16             | –                 | 209 of 209               |
| 2022   | 4       | 0                | 0            | 2                               | 1       | 12             | –                 | 239 of 239               |
| 2023   | 4       | 0                | 0            | 2                               | 1       | 11             | –                 | 260 of 260               |
| 2024   | 4       | 0                | 0            | 2                               | 2       | 10             | –                 | 262 of 262               |
| 2025   | 4       | 0                | 0            | 2                               | 1       | 8              | –                 | 310 of 310               |
| 2026   | 4       | 0                | 0            | 2                               | 1       | 15             | –                 | 352 of 352               |

## Players and the crosswalk

Players with a line in the season (the game logs, and the 2026 box scores' players who played), by how they found their ESPN id: **crosswalk** (`wnba_player_crosswalk` that season), else the shared matching on ESPN's lines that season: the same **box-score** lines, the same **name** in the season (lines or rosters), the crosswalk of **another season**, or **none**. There is no crosswalk and no ESPN box score before 2002, so those players have none. ESPN's 2002 lines are all zeros, so box-score matching finds nobody that season.

| Season | Players | Crosswalk     | Box score | Name | Another season | None | Who (from 2002)                                              |
| ------ | ------- | ------------- | --------- | ---- | -------------- | ---- | ------------------------------------------------------------ |
| 1997   | 97      | 0 (0.0 %)     | –         | –    | –              | 97   | –                                                            |
| 1998   | 127     | 0 (0.0 %)     | –         | –    | –              | 127  | –                                                            |
| 1999   | 150     | 0 (0.0 %)     | –         | –    | –              | 150  | –                                                            |
| 2000   | 205     | 0 (0.0 %)     | –         | –    | –              | 205  | –                                                            |
| 2001   | 207     | 0 (0.0 %)     | –         | –    | –              | 207  | –                                                            |
| 2002   | 208     | 199 (95.7 %)  | 5         | –    | –              | 4    | Claudia Neves, LaQuanda Quick, Val Whiting, Zuzana Klimesova |
| 2003   | 177     | 170 (96.0 %)  | 6         | –    | –              | 1    | Zuzana Klimesova                                             |
| 2004   | 165     | 161 (97.6 %)  | 4         | –    | –              | 0    | –                                                            |
| 2005   | 168     | 164 (97.6 %)  | 4         | –    | –              | 0    | –                                                            |
| 2006   | 182     | 175 (96.2 %)  | 7         | –    | –              | 0    | –                                                            |
| 2007   | 173     | 167 (96.5 %)  | 6         | –    | –              | 0    | –                                                            |
| 2008   | 192     | 184 (95.8 %)  | 6         | –    | –              | 2    | Wanisha Smith, Yuko Oga                                      |
| 2009   | 164     | 157 (95.7 %)  | 4         | –    | –              | 3    | Britany Miller, Sherill Baker, Tenae Davis-Cain              |
| 2010   | 143     | 139 (97.2 %)  | 4         | –    | –              | 0    | –                                                            |
| 2011   | 142     | 140 (98.6 %)  | 2         | –    | –              | 0    | –                                                            |
| 2012   | 146     | 141 (96.6 %)  | 5         | –    | –              | 0    | –                                                            |
| 2013   | 146     | 142 (97.3 %)  | 4         | –    | –              | 0    | –                                                            |
| 2014   | 154     | 151 (98.1 %)  | 3         | –    | –              | 0    | –                                                            |
| 2015   | 159     | 156 (98.1 %)  | 3         | –    | –              | 0    | –                                                            |
| 2016   | 158     | 154 (97.5 %)  | 3         | –    | 1              | 0    | –                                                            |
| 2017   | 157     | 154 (98.1 %)  | 2         | –    | 1              | 0    | –                                                            |
| 2018   | 157     | 155 (98.7 %)  | 1         | –    | 1              | 0    | –                                                            |
| 2019   | 157     | 152 (96.8 %)  | 3         | –    | 2              | 0    | –                                                            |
| 2020   | 145     | 145 (100.0 %) | –         | –    | –              | 0    | –                                                            |
| 2021   | 155     | 155 (100.0 %) | –         | –    | –              | 0    | –                                                            |
| 2022   | 166     | 164 (98.8 %)  | 2         | –    | –              | 0    | –                                                            |
| 2023   | 156     | 154 (98.7 %)  | 2         | –    | –              | 0    | –                                                            |
| 2024   | 157     | 157 (100.0 %) | –         | –    | –              | 0    | –                                                            |
| 2025   | 182     | 182 (100.0 %) | –         | –    | –              | 0    | –                                                            |
| 2026   | 238     | 237 (99.6 %)  | 1         | –    | –              | 0    | –                                                            |

**ESPN's players with no league id** get the negative of their ESPN id (D28):

| Id       | Name                | Season | ESPN's lines | With a stat |
| -------- | ------------------- | ------ | ------------ | ----------- |
| -69      | LaQuanda Barksdale  | 2002   | 16           | 0           |
| -244     | Tanya Kostic        | 2002   | 34           | 0           |
| -43      | Val Whiting-Raymond | 2002   | 10           | 0           |
| -242     | Zuzi Klimesova      | 2002   | 21           | 0           |
| -627     | Laine Selwyn        | 2008   | 1            | 0           |
| -853     | Tanae Davis-Cain    | 2009   | 1            | 1           |
| -3028054 | Alina Iagupova      | 2013   | 2            | 0           |
| -5278238 | Annika Soltau       | 2025   | 1            | 0           |

## One person, one id

`player` has 1,240 rows on 1,240 ids; `player_ids` maps 1,065 ESPN ids, each once (1,065 distinct). Where the sources disagree on who is who: the crosswalk's ids, and the league's players who share a name (the same person on two ids, or two people; `wnba-data-sources.md` says which).

| Kind                       | Id or name        | Detail                                                                                                                                 |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ESPN id on two league ids  | 1001              | 202657 (2018), 202657 (2017), 202270 (2014)                                                                                            |
| League id on two ESPN ids  | 100046            | 317 (2004), 317 (2003), 317 (2002), 599 (2007), 599 (2006), 599 (2005)                                                                 |
| League id on two ESPN ids  | 100812            | 2 (2016), 2 (2011), 2 (2010), 2 (2009), 2 (2002), 2 (2017), 2 (2015), 2 (2014), 2 (2013), 2994299 (2012), 2 (2012), 2 (2008), 2 (2007) |
| League id on two ESPN ids  | 100833            | 486 (2003), 532 (2003)                                                                                                                 |
| League id on two ESPN ids  | 1629574           | 4336633 (2026), 4336633 (2025), 4336633 (2024), 4422426 (2022)                                                                         |
| One name on two league ids | angel robinson    | 202270 (2014-2014), 202657 (2014-2018)                                                                                                 |
| One name on two league ids | claudia neves     | 100797 (2002-2002), 100386 (1999-2002)                                                                                                 |
| One name on two league ids | michelle campbell | 100360 (1999-2000), 202314 (2013-2013)                                                                                                 |

## Game and season tables

Built by the WNBA's recipe (`derived/gameWnba.ts`, Plan T1301.6): `team_game` 14,058 rows, `player_game` 136,532, `team_season` 622, `player_season` 15,164. Player lines are the game logs' and, in 2026, the box scores'; team lines the game logs' team rows; ESPN's lines only where the league has none (the Commissioner's Cup finals).

### Lines and sources by season

**Team-games:** both sides of every game played between two league teams (the All-Star Game has none). **No box score:** the 2018 forfeit. **ESPN:** the Cup final, ESPN's alone. **Box = score:** team-games whose box-score points equal the game's score. **Starters known:** team-games with exactly five starters flagged (ESPN's flags from 2002, the league's 2026 box scores); before 2002 nobody is flagged, and a game with a starter ESPN has under another id reads unknown.

| Season | Team-games | No box score | ESPN | Box = score | Starters known | Player lines | Of them ESPN |
| ------ | ---------- | ------------ | ---- | ----------- | -------------- | ------------ | ------------ |
| 1997   | 230        | –            | –    | 230 of 230  | 0 (0.0 %)      | 2,144        | –            |
| 1998   | 316        | –            | –    | 316 of 316  | 0 (0.0 %)      | 3,093        | –            |
| 1999   | 406        | –            | –    | 406 of 406  | 0 (0.0 %)      | 3,910        | –            |
| 2000   | 544        | –            | –    | 544 of 544  | 0 (0.0 %)      | 5,245        | –            |
| 2001   | 548        | –            | –    | 548 of 548  | 0 (0.0 %)      | 5,328        | –            |
| 2002   | 546        | –            | –    | 546 of 546  | 488 (89.4 %)   | 5,261        | –            |
| 2003   | 514        | –            | –    | 514 of 514  | 388 (75.5 %)   | 5,013        | –            |
| 2004   | 480        | –            | –    | 480 of 480  | 428 (89.2 %)   | 4,644        | –            |
| 2005   | 476        | –            | –    | 476 of 476  | 453 (95.2 %)   | 4,603        | –            |
| 2006   | 514        | –            | –    | 514 of 514  | 508 (98.8 %)   | 5,125        | –            |
| 2007   | 484        | –            | –    | 484 of 484  | 480 (99.2 %)   | 4,810        | –            |
| 2008   | 518        | –            | –    | 518 of 518  | 502 (96.9 %)   | 5,293        | –            |
| 2009   | 484        | –            | –    | 484 of 484  | 480 (99.2 %)   | 4,719        | –            |
| 2010   | 440        | –            | –    | 440 of 440  | 438 (99.5 %)   | 4,213        | –            |
| 2011   | 446        | –            | –    | 446 of 446  | 444 (99.6 %)   | 4,314        | –            |
| 2012   | 446        | –            | –    | 446 of 446  | 440 (98.7 %)   | 4,271        | –            |
| 2013   | 442        | –            | –    | 442 of 442  | 442 (100.0 %)  | 4,192        | –            |
| 2014   | 444        | –            | –    | 444 of 444  | 443 (99.8 %)   | 4,401        | –            |
| 2015   | 450        | –            | –    | 450 of 450  | 450 (100.0 %)  | 4,459        | –            |
| 2016   | 440        | –            | –    | 440 of 440  | 436 (99.1 %)   | 4,405        | –            |
| 2017   | 438        | –            | –    | 438 of 438  | 437 (99.8 %)   | 4,397        | –            |
| 2018   | 442        | 2            | –    | 440 of 440  | 440 (99.5 %)   | 4,419        | –            |
| 2019   | 440        | –            | –    | 440 of 440  | 440 (100.0 %)  | 4,288        | –            |
| 2020   | 294        | –            | –    | 294 of 294  | 293 (99.7 %)   | 2,796        | –            |
| 2021   | 420        | –            | 2    | 420 of 420  | 420 (100.0 %)  | 3,907        | 22           |
| 2022   | 480        | –            | 2    | 480 of 480  | 480 (100.0 %)  | 4,536        | 17           |
| 2023   | 522        | –            | 2    | 522 of 522  | 522 (100.0 %)  | 4,918        | 20           |
| 2024   | 526        | –            | 2    | 526 of 526  | 526 (100.0 %)  | 4,930        | 16           |
| 2025   | 622        | –            | 2    | 622 of 622  | 622 (100.0 %)  | 5,873        | 20           |
| 2026   | 706        | –            | 2    | 706 of 706  | 706 (100.0 %)  | 7,025        | 17           |

### ESPN against the league, player-games

The league's lines in the games ESPN has, paired with ESPN's line for the same player (through `player_ids`). Exact on points, rebounds and assists; minutes within one, since the game logs print whole minutes. ESPN's 2002 lines are all zeros and have no minutes, so its counts are never read for 2002: they only flag the starters.

| Season | League lines | Paired with ESPN | Points % | Rebounds % | Assists % | All three % | Minutes within 1 % |
| ------ | ------------ | ---------------- | -------- | ---------- | --------- | ----------- | ------------------ |
| 2002   | 5,231        | 5,091 (97.3 %)   | 18.8     | 17.9       | 36.3      | 6.9         | –                  |
| 2003   | 4,975        | 3,807 (76.5 %)   | 95.0     | 95.1       | 95.7      | 94.4        | 73.7               |
| 2004   | 4,589        | 4,156 (90.6 %)   | 95.7     | 95.5       | 95.9      | 95.1        | 71.5               |
| 2005   | 4,603        | 4,423 (96.1 %)   | 95.0     | 94.9       | 95.3      | 94.3        | 72.8               |
| 2006   | 5,125        | 5,076 (99.0 %)   | 96.4     | 96.3       | 96.6      | 96.0        | 72.5               |
| 2007   | 4,810        | 4,766 (99.1 %)   | 95.2     | 95.0       | 95.4      | 94.2        | 73.2               |
| 2008   | 5,293        | 5,116 (96.7 %)   | 97.0     | 96.9       | 97.0      | 96.5        | 75.1               |
| 2009   | 4,719        | 4,711 (99.8 %)   | 99.7     | 99.7       | 99.7      | 99.7        | 100.0              |
| 2010   | 4,213        | 4,189 (99.4 %)   | 99.7     | 99.7       | 99.7      | 99.7        | 99.9               |
| 2011   | 4,314        | 4,309 (99.9 %)   | 99.6     | 99.5       | 99.6      | 99.5        | 99.9               |
| 2012   | 4,271        | 4,234 (99.1 %)   | 99.8     | 99.9       | 99.8      | 99.7        | 99.2               |
| 2013   | 4,192        | 4,192 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 99.7               |
| 2014   | 4,401        | 4,376 (99.4 %)   | 100.0    | 99.9       | 99.9      | 99.9        | 99.7               |
| 2015   | 4,459        | 4,458 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2016   | 4,405        | 4,363 (99.0 %)   | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2017   | 4,397        | 4,397 (100.0 %)  | 99.9     | 100.0      | 100.0     | 99.9        | 99.8               |
| 2018   | 4,419        | 4,419 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 99.9               |
| 2019   | 4,288        | 4,288 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2020   | 2,796        | 2,796 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2021   | 3,885        | 3,885 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2022   | 4,519        | 4,519 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2023   | 4,898        | 4,898 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2024   | 4,914        | 4,914 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2025   | 5,853        | 5,853 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |
| 2026   | 7,008        | 7,008 (100.0 %)  | 100.0    | 100.0      | 100.0     | 100.0       | 100.0              |

### Season tables against the league's dashboards

Each player's whole regular season (`player_season`, no team) against the league dashboards' season stats (`src_dash_player_stats_base`, regular season, totals; a player the file lists twice, as in 2026, summed), and each team's (`team_season`, its games with a box score) against the team dashboards. Exact, but minutes: within half a minute a game, since the game logs print whole minutes and the dashboards to the second. **Ours more:** players with a game more than the dashboards, or the same games and more points; **fewer:** the reverse. **Team points = scores:** team-seasons whose box-score points equal the scores of their games.

| Season | Dashboard players | Found | Games % | Points % | Rebounds % | Assists % | Minutes % | Ours more: games, points | Fewer | Teams: games, points equal | Team points = scores |
| ------ | ----------------- | ----- | ------- | -------- | ---------- | --------- | --------- | ------------------------ | ----- | -------------------------- | -------------------- |
| 1997   | 97                | all   | 93.8    | 72.2     | 76.3       | 80.4      | 91.8      | 5, 15                    | 10    | 8, 3 of 8                  | 8 of 8               |
| 1998   | 127               | all   | 82.7    | 85.8     | 85.8       | 88.2      | 85.8      | 22, 1                    | –     | 8, 6 of 10                 | 10 of 10             |
| 1999   | 150               | all   | 92.0    | 82.7     | 85.3       | 90.0      | 92.0      | 12, 14                   | 2     | 12, 7 of 12                | 12 of 12             |
| 2000   | 204               | all   | 100.0   | 98.0     | 99.0       | 99.0      | 96.6      | 0, 3                     | 1     | 16, 12 of 16               | 16 of 16             |
| 2001   | 207               | all   | 100.0   | 98.1     | 98.6       | 99.5      | 100.0     | 0, 4                     | –     | 16, 12 of 16               | 16 of 16             |
| 2002   | 207               | all   | 100.0   | 94.7     | 97.1       | 97.6      | 99.0      | 0, 11                    | –     | 16, 12 of 16               | 16 of 16             |
| 2003   | 177               | all   | 98.9    | 99.4     | 100.0      | 100.0     | 98.9      | 2, 1                     | –     | 14, 13 of 14               | 14 of 14             |
| 2004   | 164               | all   | 100.0   | 97.6     | 96.3       | 100.0     | 99.4      | 0, 4                     | –     | 13, 9 of 13                | 13 of 13             |
| 2005   | 168               | all   | 99.4    | 97.6     | 99.4       | 99.4      | 99.4      | 1, 4                     | –     | 13, 9 of 13                | 13 of 13             |
| 2006   | 182               | all   | 89.6    | 89.6     | 89.0       | 92.3      | 90.7      | 19, 3                    | –     | 12, 9 of 14                | 14 of 14             |
| 2007   | 173               | all   | 96.0    | 80.3     | 80.9       | 83.2      | 82.1      | 7, 31                    | –     | 13, 7 of 13                | 13 of 13             |
| 2008   | 192               | all   | 100.0   | 99.0     | 97.4       | 100.0     | 100.0     | 0, 2                     | –     | 14, 12 of 14               | 14 of 14             |
| 2009   | 164               | all   | 100.0   | 93.3     | 93.9       | 96.3      | 100.0     | 0, 11                    | –     | 13, 10 of 13               | 13 of 13             |
| 2010   | 143               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2011   | 142               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2012   | 146               | all   | 100.0   | 99.3     | 99.3       | 100.0     | 100.0     | 0, 1                     | –     | 12, 11 of 12               | 12 of 12             |
| 2013   | 146               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2014   | 154               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2015   | 159               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2016   | 158               | all   | 100.0   | 99.4     | 100.0      | 100.0     | 100.0     | 0, 1                     | –     | 12, 11 of 12               | 12 of 12             |
| 2017   | 157               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2018   | 157               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2019   | 157               | all   | 100.0   | 99.4     | 100.0      | 100.0     | 100.0     | 0, 1                     | –     | 12, 11 of 12               | 12 of 12             |
| 2020   | 145               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2021   | 155               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2022   | 166               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2023   | 156               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2024   | 157               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 12, 12 of 12               | 12 of 12             |
| 2025   | 182               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 13, 13 of 13               | 13 of 13             |
| 2026   | 238               | all   | 100.0   | 100.0    | 100.0      | 100.0     | 100.0     | –                        | –     | 15, 15 of 15               | 15 of 15             |

### The top 20 scorers each season

Our 20 most points in each regular season against the dashboards': how many of the 20 are the dashboards' 20, and how many have the same points and games. **Differ** names each one that does not, ours over the dashboards', points then games.

| Season | In the dashboards' 20 | Points equal | Games equal | Differ                                                                                                                                                                                                                         |
| ------ | --------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1997   | 20 of 20              | 13 of 20     | 19 of 20    | Lisa Leslie 445/435 in 28/28; Ruthie Bolton 445/439 in 24/24; Penny Toler 368/366 in 28/28; Bridgette Gordon 365/353 in 28/28; Bridget Pettis 352/349 in 28/28; Michele Timms 326/314 in 28/27; Tamecka Dixon 320/331 in 27/27 |
| 1998   | 20 of 20              | 18 of 20     | 18 of 20    | Nikki McCray 510/483 in 29/28; Latasha Byears 427/414 in 30/29                                                                                                                                                                 |
| 1999   | 20 of 20              | 16 of 20     | 19 of 20    | Lisa Leslie 500/498 in 32/32; Jennifer Gillom 485/481 in 32/32; Vickie Johnson 427/412 in 32/31; Sandy Brondello 424/423 in 32/32                                                                                              |
| 2000   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2001   | 20 of 20              | 18 of 20     | 20 of 20    | Katie Smith 739/737 in 32/32; Merlakia Jones 404/403 in 30/30                                                                                                                                                                  |
| 2002   | 20 of 20              | 19 of 20     | 20 of 20    | Chasity Melvin 399/396 in 32/32                                                                                                                                                                                                |
| 2003   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2004   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2005   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2006   | 20 of 20              | 15 of 20     | 17 of 20    | Diana Taurasi 860/824 in 34/33; Cappie Pondexter 624/602 in 32/31; Lauren Jackson 585/583 in 30/30; Tamika Catchings 521/519 in 32/32; Shameka Christon 423/418 in 34/33                                                       |
| 2007   | 20 of 20              | 14 of 20     | 20 of 20    | Tina Thompson 639/621 in 34/34; Katie Douglas 577/570 in 34/34; Candice Dupree 544/510 in 33/33; Asjha Jones 459/441 in 30/30; Lindsay Whalen 454/442 in 34/34; Nicole Powell 436/419 in 34/34                                 |
| 2008   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2009   | 20 of 20              | 16 of 20     | 20 of 20    | Cappie Pondexter 648/640 in 34/34; Diana Taurasi 631/629 in 31/31; Katie Douglas 547/536 in 31/31; Tamika Catchings 512/505 in 34/34                                                                                           |
| 2010   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2011   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2012   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2013   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2014   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2015   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2016   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2017   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2018   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2019   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2020   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2021   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2022   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2023   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2024   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2025   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |
| 2026   | 20 of 20              | 20 of 20     | 20 of 20    | –                                                                                                                                                                                                                              |

### Team records from the season table

Wins and losses in `team_season` (regular season; the forfeit a win and a loss with no box score) against the dashboards' standings: **380 of 380** team-seasons equal.

| Season | Teams | Equal | Differ |
| ------ | ----- | ----- | ------ |
| 1997   | 8     | 8     | –      |
| 1998   | 10    | 10    | –      |
| 1999   | 12    | 12    | –      |
| 2000   | 16    | 16    | –      |
| 2001   | 16    | 16    | –      |
| 2002   | 16    | 16    | –      |
| 2003   | 14    | 14    | –      |
| 2004   | 13    | 13    | –      |
| 2005   | 13    | 13    | –      |
| 2006   | 14    | 14    | –      |
| 2007   | 13    | 13    | –      |
| 2008   | 14    | 14    | –      |
| 2009   | 13    | 13    | –      |
| 2010   | 12    | 12    | –      |
| 2011   | 12    | 12    | –      |
| 2012   | 12    | 12    | –      |
| 2013   | 12    | 12    | –      |
| 2014   | 12    | 12    | –      |
| 2015   | 12    | 12    | –      |
| 2016   | 12    | 12    | –      |
| 2017   | 12    | 12    | –      |
| 2018   | 12    | 12    | –      |
| 2019   | 12    | 12    | –      |
| 2020   | 12    | 12    | –      |
| 2021   | 12    | 12    | –      |
| 2022   | 12    | 12    | –      |
| 2023   | 12    | 12    | –      |
| 2024   | 12    | 12    | –      |
| 2025   | 13    | 13    | –      |
| 2026   | 15    | 15    | –      |

### Game rows adding up to season rows

Every row of `player_season` (each team, and the whole season with no team) against its player's rows of `player_game` summed: games, seconds, points, rebounds, assists, field-goal attempts and starts, every season type. **Traded:** whole-season rows of players with more than one team that season and type. Every row of `team_season` against `team_game` summed on games, points and wins.

| Season | Player rows | Equal | Whole seasons | Traded | Team rows equal |
| ------ | ----------- | ----- | ------------- | ------ | --------------- |
| 1997   | 270         | 270   | 134           | 2      | 12 of 12        |
| 1998   | 329         | 329   | 163           | 3      | 14 of 14        |
| 1999   | 422         | 422   | 208           | 6      | 18 of 18        |
| 2000   | 574         | 574   | 285           | 4      | 24 of 24        |
| 2001   | 592         | 592   | 295           | 2      | 24 of 24        |
| 2002   | 593         | 593   | 290           | 13     | 24 of 24        |
| 2003   | 525         | 525   | 260           | 5      | 22 of 22        |
| 2004   | 500         | 500   | 248           | 4      | 21 of 21        |
| 2005   | 511         | 511   | 249           | 13     | 21 of 21        |
| 2006   | 535         | 535   | 265           | 4      | 22 of 22        |
| 2007   | 527         | 527   | 260           | 7      | 21 of 21        |
| 2008   | 577         | 577   | 282           | 12     | 22 of 22        |
| 2009   | 497         | 497   | 245           | 7      | 21 of 21        |
| 2010   | 457         | 457   | 224           | 9      | 20 of 20        |
| 2011   | 459         | 459   | 226           | 7      | 20 of 20        |
| 2012   | 458         | 458   | 226           | 6      | 20 of 20        |
| 2013   | 461         | 461   | 228           | 5      | 20 of 20        |
| 2014   | 488         | 488   | 243           | 2      | 20 of 20        |
| 2015   | 501         | 501   | 246           | 9      | 20 of 20        |
| 2016   | 488         | 488   | 240           | 8      | 20 of 20        |
| 2017   | 497         | 497   | 243           | 10     | 20 of 20        |
| 2018   | 484         | 484   | 238           | 8      | 20 of 20        |
| 2019   | 494         | 494   | 244           | 6      | 20 of 20        |
| 2020   | 461         | 461   | 226           | 8      | 20 of 20        |
| 2021   | 531         | 531   | 258           | 13     | 22 of 22        |
| 2022   | 549         | 549   | 266           | 15     | 22 of 22        |
| 2023   | 520         | 520   | 255           | 9      | 22 of 22        |
| 2024   | 538         | 538   | 262           | 12     | 22 of 22        |
| 2025   | 612         | 612   | 293           | 26     | 23 of 23        |
| 2026   | 714         | 714   | 346           | 21     | 25 of 25        |

### Two seasons recounted through the engine

The engine's answer (`query`, the regular season, totals) against the source files summed directly: every player's points, games, rebounds and assists against the game logs (1998) or the 2026 box scores (2026), and every team's wins and losses against the dashboards' standings.

| Season | Players equal            | Teams equal              | Top three                                                                   |
| ------ | ------------------------ | ------------------------ | --------------------------------------------------------------------------- |
| 1998   | 127 of 127 (source: 127) | 10 of 10 (standings: 10) | Cynthia Cooper 680 in 30; Jennifer Gillom 626 in 30; Lisa Leslie 549 in 28  |
| 2026   | 238 of 238 (source: 238) | 15 of 15 (standings: 15) | Kelsey Mitchell 1086 in 44; A'ja Wilson 1073 in 41; Caitlin Clark 891 in 40 |

## The league's dashboards, read through the engine

Plan T1301.7. The league's dashboards (`src_dash_*`, every row a season's totals) read through the query engine over each whole season and season type, against the raw files. A rate the league publishes is stored times its minutes, or its possessions for a rating, and divided back, so a season reads as published: exact but for floating point (1e-9). Nia Brodie's two 2026 rows (4 and 40 games) are compared one by one against her season, so her rows differ. Player columns: ratings, pace, usage, turnover ratio, PIE, paint points, shots blocked, mid-range and assisted shares, share of points on the floor, defensive win shares; team columns: rating, pace, turnovers, free-throw rate and opponents' eFG% (two of the four factors), second-chance points, opponents' paint points, the paint share. The playoffs are published from 2001. **Not in the box scores** counts a dashboard player the engine does not list; **over nothing** a rate the league prints as 0 with nothing under it, which the engine leaves blank.

| Season | Type     | Players | Not in the box scores | Rows same % | Values same % | Over nothing | Teams | Rows same % |
| ------ | -------- | ------- | --------------------- | ----------- | ------------- | ------------ | ----- | ----------- |
| 1997   | regular  | 97      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 1998   | regular  | 127     | 0                     | 100.0       | 100.0         | 0            | 10    | 100.0       |
| 1999   | regular  | 150     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2000   | regular  | 204     | 0                     | 100.0       | 100.0         | 0            | 16    | 100.0       |
| 2001   | regular  | 207     | 0                     | 100.0       | 100.0         | 0            | 16    | 100.0       |
| 2001   | playoffs | 88      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2002   | regular  | 207     | 0                     | 100.0       | 100.0         | 0            | 16    | 100.0       |
| 2002   | playoffs | 83      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2003   | regular  | 177     | 0                     | 100.0       | 100.0         | 0            | 14    | 100.0       |
| 2003   | playoffs | 83      | 0                     | 100.0       | 100.0         | 11           | 8     | 100.0       |
| 2004   | regular  | 164     | 0                     | 99.4        | 99.9          | 6            | 13    | 100.0       |
| 2004   | playoffs | 84      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2005   | regular  | 168     | 0                     | 100.0       | 100.0         | 0            | 13    | 100.0       |
| 2005   | playoffs | 81      | 0                     | 100.0       | 100.0         | 2            | 8     | 100.0       |
| 2006   | regular  | 182     | 0                     | 100.0       | 100.0         | 182          | 14    | 100.0       |
| 2006   | playoffs | 83      | 0                     | 100.0       | 100.0         | 1            | 8     | 100.0       |
| 2007   | regular  | 173     | 0                     | 100.0       | 100.0         | 0            | 13    | 100.0       |
| 2007   | playoffs | 87      | 0                     | 100.0       | 100.0         | 2            | 8     | 100.0       |
| 2008   | regular  | 192     | 0                     | 100.0       | 100.0         | 194          | 14    | 100.0       |
| 2008   | playoffs | 90      | 0                     | 100.0       | 100.0         | 4            | 8     | 100.0       |
| 2009   | regular  | 164     | 0                     | 100.0       | 100.0         | 0            | 13    | 100.0       |
| 2009   | playoffs | 81      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2010   | regular  | 143     | 0                     | 100.0       | 100.0         | 143          | 12    | 100.0       |
| 2010   | playoffs | 81      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2011   | regular  | 142     | 0                     | 100.0       | 100.0         | 142          | 12    | 100.0       |
| 2011   | playoffs | 84      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2012   | regular  | 146     | 0                     | 100.0       | 100.0         | 146          | 12    | 100.0       |
| 2012   | playoffs | 80      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2013   | regular  | 146     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2013   | playoffs | 82      | 0                     | 100.0       | 100.0         | 82           | 8     | 100.0       |
| 2014   | regular  | 154     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2014   | playoffs | 89      | 0                     | 98.9        | 99.9          | 7            | 8     | 100.0       |
| 2015   | regular  | 159     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2015   | playoffs | 87      | 0                     | 100.0       | 100.0         | 2            | 8     | 100.0       |
| 2016   | regular  | 158     | 0                     | 100.0       | 100.0         | 1            | 12    | 100.0       |
| 2016   | playoffs | 82      | 0                     | 100.0       | 100.0         | 82           | 8     | 100.0       |
| 2017   | regular  | 157     | 0                     | 100.0       | 100.0         | 157          | 12    | 100.0       |
| 2017   | playoffs | 86      | 0                     | 100.0       | 100.0         | 1            | 8     | 100.0       |
| 2018   | regular  | 157     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2018   | playoffs | 80      | 1                     | 100.0       | 100.0         | 1            | 8     | 100.0       |
| 2019   | regular  | 157     | 0                     | 100.0       | 100.0         | 2            | 12    | 100.0       |
| 2019   | playoffs | 87      | 0                     | 100.0       | 100.0         | 1            | 8     | 100.0       |
| 2020   | regular  | 145     | 0                     | 100.0       | 100.0         | 1            | 12    | 100.0       |
| 2020   | playoffs | 81      | 0                     | 100.0       | 100.0         | 1            | 8     | 100.0       |
| 2021   | regular  | 155     | 0                     | 100.0       | 100.0         | 1            | 12    | 100.0       |
| 2021   | playoffs | 81      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2022   | regular  | 166     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2022   | playoffs | 83      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2023   | regular  | 156     | 0                     | 100.0       | 100.0         | 1            | 12    | 100.0       |
| 2023   | playoffs | 79      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2024   | regular  | 157     | 0                     | 100.0       | 100.0         | 0            | 12    | 100.0       |
| 2024   | playoffs | 89      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2025   | regular  | 182     | 0                     | 100.0       | 100.0         | 1            | 13    | 100.0       |
| 2025   | playoffs | 91      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |
| 2026   | regular  | 239     | 0                     | 99.2        | 99.2          | 0            | 15    | 100.0       |
| 2026   | playoffs | 91      | 0                     | 100.0       | 100.0         | 0            | 8     | 100.0       |

### The formulas on the built tables against the published figures

The catalogue's formulas over the game tables against the league's figure for the same team and regular season, as the median of formula minus published across the teams, then how many teams are within one (possession, point per 100 or percentage point) of it. A measurement, not a test: the formulas estimate possessions from the box score (Pace and the ratings, per 40 minutes, `gameLength`), and the league counts them; the four factors are the same counts on both sides. Where the dashboards fall short of the scores (1997–2009, T1301.6), the published figure is shown as published beside the built one.

| Season | Pace per 40  | ORtg         | DRtg         | FTr           | Opp eFG%      | ORB%         |
| ------ | ------------ | ------------ | ------------ | ------------- | ------------- | ------------ |
| 1997   | +1.94 (0/8)  | −2.28 (0/8)  | −2.45 (0/8)  | +0.01 (8/8)   | +0.02 (8/8)   | −2.72 (0/8)  |
| 1998   | +1.53 (1/10) | −1.80 (1/10) | −1.77 (0/10) | +0.01 (9/10)  | +0.02 (10/10) | −2.36 (0/10) |
| 1999   | +1.49 (0/12) | −2.11 (0/12) | −2.12 (0/12) | +0.01 (12/12) | −0.01 (12/12) | −2.74 (0/12) |
| 2000   | +1.54 (2/16) | −2.09 (3/16) | −2.05 (1/16) | +0.02 (16/16) | +0.01 (16/16) | −3.16 (0/16) |
| 2001   | +1.28 (2/16) | −1.75 (2/16) | −1.91 (0/16) | −0.00 (16/16) | +0.01 (16/16) | −2.78 (0/16) |
| 2002   | +1.29 (1/16) | −1.64 (0/16) | −1.67 (1/16) | −0.01 (16/16) | +0.01 (16/16) | −2.82 (0/16) |
| 2003   | +1.83 (0/14) | −2.43 (0/14) | −2.50 (0/14) | +0.01 (14/14) | −0.02 (14/14) | −2.95 (0/14) |
| 2004   | +1.64 (0/13) | −2.09 (0/13) | −2.30 (0/13) | −0.02 (13/13) | +0.00 (13/13) | −2.77 (0/13) |
| 2005   | +1.65 (0/13) | −2.16 (0/13) | −2.16 (0/13) | −0.02 (13/13) | −0.00 (13/13) | −2.99 (0/13) |
| 2006   | +1.38 (0/14) | −1.63 (1/14) | −1.72 (1/14) | +0.00 (14/14) | −0.02 (14/14) | −3.74 (0/14) |
| 2007   | +1.47 (1/13) | −1.78 (0/13) | −1.82 (1/13) | −0.01 (13/13) | −0.00 (13/13) | −3.88 (0/13) |
| 2008   | +1.42 (2/14) | −1.77 (1/14) | −1.68 (1/14) | +0.01 (14/14) | −0.00 (14/14) | −3.96 (0/14) |
| 2009   | +1.66 (0/13) | −2.02 (0/13) | −2.05 (0/13) | −0.01 (13/13) | −0.02 (13/13) | −4.39 (0/13) |
| 2010   | +1.29 (2/12) | −1.65 (1/12) | −1.58 (1/12) | +0.02 (12/12) | +0.01 (12/12) | −4.06 (0/12) |
| 2011   | +1.43 (1/12) | −1.80 (0/12) | −1.83 (0/12) | −0.00 (12/12) | −0.01 (12/12) | −4.44 (0/12) |
| 2012   | +1.86 (0/12) | −2.30 (0/12) | −2.41 (0/12) | +0.01 (12/12) | +0.00 (12/12) | −4.82 (0/12) |
| 2013   | +1.50 (0/12) | −1.81 (0/12) | −1.79 (0/12) | +0.01 (12/12) | −0.03 (12/12) | −4.05 (0/12) |
| 2014   | +1.56 (1/12) | −1.70 (1/12) | −1.98 (0/12) | +0.02 (12/12) | +0.03 (12/12) | −4.09 (0/12) |
| 2015   | +1.68 (0/12) | −2.15 (0/12) | −2.10 (0/12) | −0.02 (12/12) | +0.00 (12/12) | −4.74 (0/12) |
| 2016   | +1.83 (0/12) | −2.33 (0/12) | −2.36 (0/12) | −0.02 (12/12) | +0.00 (12/12) | −5.11 (0/12) |
| 2017   | +2.01 (0/12) | −2.54 (0/12) | −2.49 (0/12) | +0.00 (12/12) | +0.00 (12/12) | −5.25 (0/12) |
| 2018   | +1.33 (2/12) | −1.69 (1/12) | −1.69 (1/12) | −0.01 (12/12) | −0.00 (12/12) | −4.71 (0/12) |
| 2019   | +1.88 (0/12) | −2.21 (0/12) | −2.22 (0/12) | +0.01 (12/12) | +0.00 (12/12) | −5.33 (0/12) |
| 2020   | +1.50 (0/12) | −1.86 (0/12) | −1.99 (0/12) | −0.01 (12/12) | +0.02 (12/12) | −4.90 (0/12) |
| 2021   | +1.66 (2/12) | −1.97 (1/12) | −2.12 (1/12) | −0.01 (12/12) | −0.00 (12/12) | −5.07 (0/12) |
| 2022   | +1.52 (1/12) | −1.95 (0/12) | −1.97 (0/12) | +0.01 (12/12) | +0.01 (12/12) | −5.03 (0/12) |
| 2023   | +1.76 (0/12) | −2.17 (0/12) | −2.27 (0/12) | −0.00 (12/12) | −0.00 (12/12) | −5.18 (0/12) |
| 2024   | +1.71 (0/12) | −2.13 (0/12) | −2.08 (0/12) | −0.01 (12/12) | −0.01 (12/12) | −4.78 (0/12) |
| 2025   | +1.69 (0/13) | −2.30 (0/13) | −2.14 (0/13) | +0.01 (13/13) | −0.00 (13/13) | −5.28 (0/13) |
| 2026   | +2.04 (0/15) | −2.68 (0/15) | −2.58 (0/15) | +0.02 (15/15) | −0.00 (15/15) | −5.41 (0/15) |

## SportsDataverse's impact models, read through the engine

The impact file (`src_wnba_impact`, SportsDataverse's own calculations, not the models' authors') through the query engine over each whole season, against the raw file: RAPM and its parts, adjusted RAPM, SPM, BPM and its parts, WAR, each stored times what it was fitted on and divided back, so exact but for floating point. DARKO is not read: the WNBA's file has no `darko_*` columns, and its `boban_*` columns are SportsDataverse's own rating, which Metis does not read yet (the owner's open question). **Not in the box scores** counts a player the file has and the engine does not list; **over nothing** a value over no possessions or minutes, or published as NaN (19 BPM values of 2016's playoffs).

| Season | Type     | Players | Not in the box scores | Rows same % | Values same % | Over nothing |
| ------ | -------- | ------- | --------------------- | ----------- | ------------- | ------------ |
| 1997   | regular  | 97      | 1                     | 100.0       | 100.0         | 0            |
| 1997   | playoffs | 35      | 1                     | 100.0       | 100.0         | 0            |
| 1998   | regular  | 127     | 1                     | 100.0       | 100.0         | 0            |
| 1998   | playoffs | 36      | 0                     | 100.0       | 100.0         | 0            |
| 1999   | regular  | 150     | 0                     | 100.0       | 100.0         | 0            |
| 1999   | playoffs | 58      | 0                     | 100.0       | 100.0         | 0            |
| 2000   | regular  | 204     | 0                     | 100.0       | 100.0         | 0            |
| 2000   | playoffs | 80      | 0                     | 100.0       | 100.0         | 1            |
| 2001   | regular  | 207     | 0                     | 100.0       | 100.0         | 0            |
| 2001   | playoffs | 88      | 0                     | 100.0       | 100.0         | 2            |
| 2002   | regular  | 207     | 0                     | 100.0       | 100.0         | 0            |
| 2002   | playoffs | 83      | 0                     | 100.0       | 100.0         | 0            |
| 2003   | regular  | 177     | 0                     | 100.0       | 100.0         | 0            |
| 2003   | playoffs | 83      | 0                     | 100.0       | 100.0         | 0            |
| 2004   | regular  | 163     | 0                     | 100.0       | 100.0         | 0            |
| 2004   | playoffs | 84      | 0                     | 100.0       | 100.0         | 1            |
| 2005   | regular  | 168     | 0                     | 100.0       | 100.0         | 0            |
| 2005   | playoffs | 81      | 0                     | 100.0       | 100.0         | 2            |
| 2006   | regular  | 182     | 0                     | 100.0       | 100.0         | 0            |
| 2006   | playoffs | 83      | 0                     | 100.0       | 100.0         | 1            |
| 2007   | regular  | 173     | 0                     | 100.0       | 100.0         | 0            |
| 2007   | playoffs | 86      | 0                     | 100.0       | 100.0         | 0            |
| 2008   | regular  | 190     | 1                     | 100.0       | 100.0         | 0            |
| 2008   | playoffs | 90      | 0                     | 100.0       | 100.0         | 0            |
| 2009   | regular  | 164     | 0                     | 100.0       | 100.0         | 0            |
| 2009   | playoffs | 81      | 0                     | 100.0       | 100.0         | 0            |
| 2010   | regular  | 143     | 0                     | 100.0       | 100.0         | 0            |
| 2010   | playoffs | 81      | 0                     | 100.0       | 100.0         | 0            |
| 2011   | regular  | 142     | 0                     | 100.0       | 100.0         | 0            |
| 2011   | playoffs | 84      | 0                     | 100.0       | 100.0         | 0            |
| 2012   | regular  | 146     | 0                     | 100.0       | 100.0         | 0            |
| 2012   | playoffs | 80      | 0                     | 100.0       | 100.0         | 0            |
| 2013   | regular  | 146     | 1                     | 100.0       | 100.0         | 0            |
| 2013   | playoffs | 82      | 0                     | 100.0       | 100.0         | 0            |
| 2014   | regular  | 154     | 0                     | 100.0       | 100.0         | 1            |
| 2014   | playoffs | 88      | 0                     | 100.0       | 100.0         | 0            |
| 2015   | regular  | 159     | 0                     | 100.0       | 100.0         | 0            |
| 2015   | playoffs | 86      | 0                     | 100.0       | 100.0         | 0            |
| 2016   | regular  | 158     | 0                     | 100.0       | 100.0         | 5            |
| 2016   | playoffs | 82      | 0                     | 100.0       | 100.0         | 57           |
| 2017   | regular  | 157     | 0                     | 100.0       | 100.0         | 0            |
| 2017   | playoffs | 85      | 0                     | 100.0       | 100.0         | 2            |
| 2018   | regular  | 157     | 0                     | 100.0       | 100.0         | 0            |
| 2018   | playoffs | 81      | 0                     | 100.0       | 100.0         | 4            |
| 2019   | regular  | 157     | 0                     | 100.0       | 100.0         | 5            |
| 2019   | playoffs | 87      | 0                     | 100.0       | 100.0         | 6            |
| 2020   | regular  | 145     | 0                     | 100.0       | 100.0         | 4            |
| 2020   | playoffs | 81      | 0                     | 100.0       | 100.0         | 5            |
| 2021   | regular  | 154     | 0                     | 100.0       | 100.0         | 0            |
| 2021   | playoffs | 81      | 0                     | 100.0       | 100.0         | 0            |
| 2022   | regular  | 166     | 0                     | 100.0       | 100.0         | 0            |
| 2022   | playoffs | 83      | 0                     | 100.0       | 100.0         | 0            |
| 2023   | regular  | 156     | 0                     | 100.0       | 100.0         | 6            |
| 2023   | playoffs | 79      | 0                     | 100.0       | 100.0         | 0            |
| 2024   | regular  | 157     | 0                     | 100.0       | 100.0         | 0            |
| 2024   | playoffs | 89      | 0                     | 100.0       | 100.0         | 0            |
| 2025   | regular  | 181     | 0                     | 100.0       | 100.0         | 0            |
| 2025   | playoffs | 91      | 0                     | 100.0       | 100.0         | 0            |
| 2026   | regular  | 238     | 0                     | 100.0       | 100.0         | 72           |
| 2026   | playoffs | 91      | 0                     | 100.0       | 100.0         | 0            |

## Team rows against their players (Plan T1301.7)

The game logs' team row against its players' rows summed, for every counting column, per season, every team-game with a box score (`src_wnba_game_logs`). Each cell: team-games where the team row is **below** its players / **above** them (and the players' surplus where the row is below). A team-game's count in `team_game` is the team row where it is at least its players' sum, else the players' sum; short turnovers add the team's own, the turnovers the play by play charges to no player, which the team row counts from 2004 (equal to the players' and the plays' on 99.3–100 % of team-games from 2004). Points stay the team row's: it equals the score in every game (T1301.6), so where the players differ they are the long side (1997: 5 team-games 10 points over; 2000: 1 over, 3 under). Turnovers count the team's own as: the team row with them from 2004; the team row without them in 1998, 1999, 2001 and 2002 (the catalogue's team turnover metrics note it); the players' sum and the plays' own in the short rows of 1997, 2000 and 2003 (most of their games). Above the players on turnovers is the team's own, so expected from 2004.

| Season | Team-games | Turnovers count                                                          | FGM       | FGA       | FG3M      | FG3A      | FTM       | FTA       | OREB      | DREB      | REB       | AST       | STL       | BLK       | TOV             | PF        | PTS        |
| ------ | ---------- | ------------------------------------------------------------------------ | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------------- | --------- | ---------- |
| 1997   | 230        | the players' sum and the plays' own where the row is short, else the row | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 1 (0) | 0 / 0 (0) | 223 / 2 (4022)  | 0 / 1 (0) | 5 / 0 (10) |
| 1998   | 316        | the team row, without the team's own                                     | 0 / 1 (0) | 0 / 1 (0) | 0 / 1 (0) | 0 / 1 (0) | 0 / 1 (0) | 0 / 1 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 1 (0) | 0 / 1 (0) | 0 / 0 (0) | 0 / 3 (0)       | 0 / 1 (0) | 0 / 2 (0)  |
| 1999   | 406        | the team row, without the team's own                                     | 0 / 0 (0) | 1 / 0 (4) | 0 / 0 (0) | 1 / 0 (1) | 0 / 0 (0) | 0 / 0 (0) | 1 / 0 (1) | 1 / 0 (2) | 1 / 0 (3) | 1 / 0 (2) | 1 / 0 (1) | 0 / 0 (0) | 1 / 6 (1)       | 1 / 0 (2) | 0 / 0 (0)  |
| 2000   | 544        | the players' sum and the plays' own where the row is short, else the row | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 491 / 21 (7448) | 0 / 0 (0) | 1 / 3 (2)  |
| 2001   | 548        | the team row, without the team's own                                     | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 13 (0)      | 0 / 0 (0) | 0 / 0 (0)  |
| 2002   | 546        | the team row, without the team's own                                     | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 12 (0)      | 0 / 0 (0) | 0 / 0 (0)  |
| 2003   | 514        | the players' sum and the plays' own where the row is short, else the row | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 476 / 10 (6607) | 0 / 0 (0) | 0 / 0 (0)  |
| 2004   | 480        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 183 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2005   | 476        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 157 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2006   | 514        | the team row, with the team's own                                        | 0 / 0 (0) | 1 / 1 (1) | 0 / 0 (0) | 1 / 1 (1) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 1 / 1 (1) | 0 / 0 (0) | 0 / 0 (0) | 0 / 299 (0)     | 1 / 0 (1) | 0 / 0 (0)  |
| 2007   | 482        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 239 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2008   | 518        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 1 / 0 (3) | 0 / 0 (0) | 1 / 0 (3) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 302 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2009   | 482        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 274 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2010   | 440        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 230 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2011   | 446        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 255 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2012   | 446        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 1 (0) | 0 / 0 (0) | 0 / 1 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 259 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2013   | 442        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 240 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2014   | 444        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 260 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2015   | 450        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 240 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2016   | 440        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 249 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2017   | 438        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 258 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2018   | 440        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 231 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2019   | 440        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 272 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2020   | 294        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 164 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2021   | 418        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 229 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2022   | 478        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 288 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2023   | 520        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 319 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2024   | 524        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 344 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2025   | 620        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 401 (0)     | 0 / 0 (0) | 0 / 0 (0)  |
| 2026   | 404        | the team row, with the team's own                                        | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) | 0 / 212 (0)     | 0 / 0 (0) | 0 / 0 (0)  |

## Plays, shots, splits and on court (Plan T1301.7)

The checks the NBA's Stage 9 wrote, run with `--league=wnba` on a real refresh of `~/.cache/metis-dev/t1301g` (a copy of T1301.6's load) through the built worker, 2026-11-17. Each script states its tolerance; the NBA's terms in their copy ("the NBA's box score", "NBA play by play") mean the league's own feed and box score, as the scripts read the league they are given. What the numbers mean, and the traps behind them, is in `wnba-data-sources.md`, "Published tables, shots and plays, built".

### Plays against the box scores

`scripts/check-plays.mjs … --league=wnba`.

Written by `scripts/check-plays.mjs` on 2026-11-18. Each game's final score and each team's and player's box-score line rebuilt from the counting flags of `play_nba` and `play_espn`, against the NBA's box score that the app trusts, per season and season type. A line is exact when all 15 counts (points, FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, REB, AST, STL, BLK, TOV, PF) equal the box score's, and within 1 when none is off by more than 1. The per-count columns are the share of lines with that count exact. What the misses are is in `nba-data-sources.md`, "Plays".

#### NBA play by play

##### Team-games

| Season | Type     |    Score exact | Team-games | Exact | Within 1 |   PTS |   FGM |   FGA |  FG3M |  FG3A |   FTM |   FTA |  OREB |  DREB |   REB |   AST |   STL |   BLK |   TOV |    PF |
| ------ | -------- | -------------: | ---------: | ----: | -------: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 1997   | Playoffs |   100.0 % of 3 |          6 |  83.3 |     83.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  83.3 | 100.0 |
| 1997   | Regular  |  95.5 % of 112 |        224 |  63.8 |     88.8 |  96.9 |  99.1 |  99.1 |  99.1 |  99.1 |  99.1 |  99.1 |  99.1 |  99.1 |  99.1 |  91.5 |  99.1 |  98.7 |  71.9 |  95.1 |
| 1998   | Playoffs |   100.0 % of 8 |         16 |  87.5 |     93.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  87.5 | 100.0 |
| 1998   | Regular  |  98.7 % of 149 |        298 |  88.3 |     96.0 |  99.0 |  99.7 |  99.7 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 | 100.0 |  93.6 |  99.3 | 100.0 | 100.0 |  93.6 |
| 1999   | Playoffs |  100.0 % of 11 |         22 |  54.5 |     90.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  95.5 | 100.0 | 100.0 |  72.7 |  86.4 |
| 1999   | Regular  |  99.5 % of 192 |        384 |  86.5 |     95.8 |  99.5 |  99.5 |  99.2 |  99.5 |  99.5 |  99.5 |  99.5 |  99.5 |  99.5 |  99.5 |  97.4 |  99.5 |  99.5 |  99.5 |  88.8 |
| 2000   | Playoffs |  100.0 % of 16 |         32 |  56.3 |     90.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  56.3 | 100.0 |
| 2000   | Regular  |  99.2 % of 256 |        512 |  62.3 |     91.2 |  99.4 | 100.0 |  99.8 |  99.8 |  99.8 | 100.0 | 100.0 | 100.0 |  99.8 |  99.8 | 100.0 | 100.0 | 100.0 |  65.4 |  95.5 |
| 2001   | Playoffs |  100.0 % of 18 |         36 |  63.9 |     91.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  63.9 | 100.0 |
| 2001   | Regular  | 100.0 % of 256 |        512 |  94.9 |     99.6 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 |  99.8 |  97.5 | 100.0 | 100.0 | 100.0 |  97.9 |
| 2002   | Playoffs |  100.0 % of 17 |         34 |  64.7 |     94.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  64.7 |  97.1 |
| 2002   | Regular  | 100.0 % of 256 |        512 |  96.3 |     99.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.2 | 100.0 | 100.0 | 100.0 |  97.1 |
| 2003   | Playoffs |  100.0 % of 19 |         38 |  71.1 |     94.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  73.7 |  97.4 |
| 2003   | Regular  | 100.0 % of 238 |        476 |  64.7 |     94.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  65.3 |  98.5 |
| 2004   | Playoffs |  100.0 % of 19 |         38 |  52.6 |     89.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  52.6 | 100.0 |
| 2004   | Regular  | 100.0 % of 221 |        442 |  59.5 |     91.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 |  98.9 |  98.6 | 100.0 | 100.0 | 100.0 |  62.4 |  95.9 |
| 2005   | Playoffs |  100.0 % of 17 |         34 |  61.8 |     94.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  61.8 | 100.0 |
| 2005   | Regular  | 100.0 % of 221 |        442 |  65.6 |     94.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  67.4 |  97.1 |
| 2006   | Playoffs |  100.0 % of 19 |         38 |  39.5 |     73.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  39.5 | 100.0 |
| 2006   | Regular  |  99.6 % of 237 |        474 |  40.7 |     73.8 |  99.8 |  99.8 |  99.6 | 100.0 |  99.8 | 100.0 | 100.0 |  99.8 | 100.0 |  99.8 |  99.8 | 100.0 | 100.0 |  42.0 |  96.6 |
| 2007   | Playoffs |  100.0 % of 21 |         42 |  52.4 |     83.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  92.9 | 100.0 | 100.0 |  54.8 |  97.6 |
| 2007   | Regular  | 100.0 % of 220 |        440 |  48.2 |     78.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  96.1 | 100.0 | 100.0 |  50.0 |  99.1 |
| 2008   | Playoffs |  100.0 % of 21 |         42 |  28.6 |     76.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.6 | 100.0 | 100.0 |  31.0 |  97.6 |
| 2008   | Regular  | 100.0 % of 238 |        476 |  39.7 |     74.6 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 |  99.8 |  99.8 |  99.6 |  96.4 | 100.0 | 100.0 |  42.6 |  96.6 |
| 2009   | Playoffs |  100.0 % of 21 |         42 |  50.0 |     83.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  95.2 | 100.0 | 100.0 |  52.4 |  95.2 |
| 2009   | Regular  | 100.0 % of 220 |        440 |  40.7 |     76.1 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 |  99.8 | 100.0 | 100.0 | 100.0 |  95.5 | 100.0 | 100.0 |  42.3 |  97.5 |
| 2010   | Playoffs |  100.0 % of 16 |         32 |  37.5 |     75.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  81.3 | 100.0 | 100.0 |  43.8 |  96.9 |
| 2010   | Regular  | 100.0 % of 204 |        408 |  46.8 |     80.4 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  94.1 |  99.8 | 100.0 |  48.0 |  99.5 |
| 2011   | Playoffs |  100.0 % of 19 |         38 |  42.1 |     78.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  92.1 | 100.0 | 100.0 |  44.7 |  97.4 |
| 2011   | Regular  | 100.0 % of 204 |        408 |  39.0 |     75.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  92.2 | 100.0 | 100.0 |  42.6 |  98.3 |
| 2012   | Playoffs |  100.0 % of 19 |         38 |  42.1 |     76.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  92.1 | 100.0 | 100.0 |  42.1 | 100.0 |
| 2012   | Regular  |  99.5 % of 204 |        408 |  39.2 |     71.3 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  92.2 | 100.0 | 100.0 |  41.9 |  99.5 |
| 2013   | Playoffs |  100.0 % of 17 |         34 |  38.2 |     79.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.1 | 100.0 | 100.0 |  38.2 |  97.1 |
| 2013   | Regular  | 100.0 % of 204 |        408 |  43.1 |     75.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  93.6 | 100.0 | 100.0 |  46.3 |  99.0 |
| 2014   | Playoffs |  100.0 % of 18 |         36 |  36.1 |     75.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  36.1 | 100.0 |
| 2014   | Regular  |  99.5 % of 204 |        408 |  39.5 |     75.5 |  99.3 | 100.0 | 100.0 | 100.0 | 100.0 |  99.3 | 100.0 | 100.0 | 100.0 | 100.0 |  93.4 | 100.0 | 100.0 |  41.9 |  99.3 |
| 2015   | Playoffs |  100.0 % of 21 |         42 |  45.2 |     73.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  45.2 | 100.0 |
| 2015   | Regular  | 100.0 % of 204 |        408 |  43.9 |     75.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  90.4 | 100.0 | 100.0 |  46.8 |  99.3 |
| 2016   | Playoffs |  100.0 % of 16 |         32 |  62.5 |     96.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  96.9 | 100.0 | 100.0 |  65.6 | 100.0 |
| 2016   | Regular  | 100.0 % of 204 |        408 |  37.7 |     72.5 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  92.4 | 100.0 | 100.0 |  41.7 |  99.0 |
| 2017   | Playoffs |  100.0 % of 15 |         30 |  40.0 |     73.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  90.0 | 100.0 | 100.0 |  46.7 | 100.0 |
| 2017   | Regular  | 100.0 % of 204 |        408 |  37.5 |     73.8 |  99.3 | 100.0 | 100.0 | 100.0 | 100.0 |  99.3 | 100.0 | 100.0 | 100.0 | 100.0 |  93.9 | 100.0 | 100.0 |  40.7 |  99.5 |
| 2018   | Playoffs |  100.0 % of 17 |         34 |  47.1 |     91.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  94.1 | 100.0 | 100.0 |  50.0 | 100.0 |
| 2018   | Regular  | 100.0 % of 203 |        406 |  43.6 |     78.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  90.4 | 100.0 | 100.0 |  47.3 |  98.8 |
| 2019   | Playoffs |  100.0 % of 16 |         32 |  34.4 |     75.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  93.8 | 100.0 | 100.0 |  37.5 |  96.9 |
| 2019   | Regular  | 100.0 % of 204 |        408 |  34.8 |     73.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  93.9 | 100.0 | 100.0 |  38.2 |  99.8 |
| 2020   | Playoffs |  100.0 % of 15 |         30 |  30.0 |     83.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  30.0 | 100.0 |
| 2020   | Regular  | 100.0 % of 132 |        264 |  45.1 |     79.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  45.8 |  98.5 |
| 2021   | Playoffs |  100.0 % of 17 |         34 |  32.4 |     67.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  32.4 | 100.0 |
| 2021   | Regular  | 100.0 % of 192 |        384 |  46.4 |     82.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  46.4 | 100.0 |
| 2022   | Playoffs |  100.0 % of 23 |         46 |  37.0 |     71.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  37.0 | 100.0 |
| 2022   | Regular  | 100.0 % of 216 |        432 |  39.6 |     76.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 | 100.0 | 100.0 |  40.0 |  99.8 |
| 2023   | Playoffs |  100.0 % of 20 |         40 |  40.0 |     67.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  40.0 | 100.0 |
| 2023   | Regular  | 100.0 % of 240 |        480 |  38.3 |     76.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.4 | 100.0 | 100.0 |  38.5 |  99.6 |
| 2024   | Playoffs |  100.0 % of 22 |         44 |  31.8 |     72.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  31.8 | 100.0 |
| 2024   | Regular  | 100.0 % of 240 |        480 |  34.4 |     73.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 |  34.6 |  99.6 |
| 2025   | Playoffs |  100.0 % of 24 |         48 |  37.5 |     68.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  37.5 | 100.0 |
| 2025   | Regular  | 100.0 % of 286 |        572 |  34.8 |     71.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  35.1 |  99.5 |
| 2026   | Playoffs |  100.0 % of 22 |         44 |  36.4 |     75.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  36.4 | 100.0 |
| 2026   | Regular  | 100.0 % of 330 |        660 |  46.7 |     80.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  46.7 |  99.8 |

##### Player-games

| Season | Type     | Lines | Exact | Within 1 |   PTS |   FGM |   FGA |  FG3M |  FG3A |   FTM |   FTA |  OREB |  DREB |   REB |   AST |   STL |   BLK |   TOV |    PF |
| ------ | -------- | ----: | ----: | -------: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 1997   | Playoffs |    51 |  98.0 |     98.0 |  98.0 |  98.0 |  98.0 | 100.0 |  98.0 |  98.0 |  98.0 |  98.0 |  98.0 |  98.0 | 100.0 |  98.0 | 100.0 |  98.0 |  98.0 |
| 1997   | Regular  | 2,093 |  97.2 |     97.9 |  98.1 |  98.1 |  97.8 |  99.2 |  98.6 |  99.0 |  99.0 |  98.7 |  98.1 |  98.1 |  98.4 |  98.8 |  99.0 |  98.3 |  98.0 |
| 1998   | Playoffs |   140 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 1998   | Regular  | 2,932 |  98.3 |     99.0 |  99.1 |  99.1 |  99.0 |  99.5 |  99.1 |  99.5 |  99.5 |  99.4 |  99.1 |  99.1 |  99.3 |  99.3 |  99.6 |  99.2 |  98.5 |
| 1999   | Playoffs |   190 |  97.9 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 | 100.0 | 100.0 | 100.0 |  98.4 |
| 1999   | Regular  | 3,720 |  98.1 |     99.1 |  99.6 |  99.6 |  99.5 |  99.8 |  99.7 |  99.8 |  99.8 |  99.5 |  99.6 |  99.5 |  99.4 |  99.6 |  99.8 |  99.6 |  98.4 |
| 2000   | Playoffs |   284 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2000   | Regular  | 4,961 |  99.5 |     99.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 |
| 2001   | Playoffs |   332 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2001   | Regular  | 4,996 |  99.5 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 |  99.8 |
| 2002   | Playoffs |   298 |  99.3 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.3 |
| 2002   | Regular  | 4,963 |  99.6 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2003   | Playoffs |   348 |  99.7 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2003   | Regular  | 4,665 |  99.8 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 |
| 2004   | Playoffs |   361 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2004   | Regular  | 4,283 |  99.5 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.6 |
| 2005   | Playoffs |   312 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2005   | Regular  | 4,291 |  99.7 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2006   | Playoffs |   373 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2006   | Regular  | 4,733 |  99.6 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2007   | Playoffs |   398 |  99.0 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.2 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2007   | Regular  | 4,393 |  99.5 |     99.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.6 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2008   | Playoffs |   414 |  99.5 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 |  99.8 |
| 2008   | Regular  | 4,879 |  99.2 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2009   | Playoffs |   380 |  98.9 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 | 100.0 | 100.0 | 100.0 |  99.5 |
| 2009   | Regular  | 4,320 |  99.3 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2010   | Playoffs |   293 |  97.6 |     99.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  98.0 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2010   | Regular  | 3,920 |  99.3 |     99.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.4 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2011   | Playoffs |   350 |  98.3 |     99.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  98.6 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2011   | Regular  | 3,964 |  98.6 |     99.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  98.8 | 100.0 | 100.0 | 100.0 |  99.8 |
| 2012   | Playoffs |   341 |  98.8 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  98.8 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2012   | Regular  | 3,930 |  98.5 |     99.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  98.7 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2013   | Playoffs |   317 |  99.4 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2013   | Regular  | 3,875 |  99.2 |     99.6 |  99.9 | 100.0 |  99.9 | 100.0 |  99.9 |  99.9 |  99.9 | 100.0 |  99.9 |  99.9 |  99.3 |  99.9 | 100.0 |  99.9 |  99.8 |
| 2014   | Playoffs |   349 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2014   | Regular  | 4,052 |  99.2 |     99.7 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.3 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2015   | Playoffs |   402 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2015   | Regular  | 4,057 |  99.0 |     99.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.0 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2016   | Playoffs |   305 |  99.7 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2016   | Regular  | 4,100 |  99.1 |     99.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.2 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2017   | Playoffs |   289 |  99.0 |     99.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2017   | Regular  | 4,108 |  99.3 |     99.7 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.4 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2018   | Playoffs |   309 |  99.4 |     99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.4 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2018   | Regular  | 4,110 |  98.9 |     99.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.1 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2019   | Playoffs |   318 |  99.1 |     99.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.4 | 100.0 | 100.0 | 100.0 |  99.7 |
| 2019   | Regular  | 3,970 |  99.3 |     99.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.3 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2020   | Playoffs |   275 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2020   | Regular  | 2,521 |  99.8 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 |
| 2021   | Playoffs |   320 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2021   | Regular  | 3,565 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2022   | Playoffs |   423 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2022   | Regular  | 4,096 |  99.9 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2023   | Playoffs |   354 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2023   | Regular  | 4,544 |  99.9 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2024   | Playoffs |   399 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2024   | Regular  | 4,515 |  99.9 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2025   | Playoffs |   446 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2025   | Regular  | 5,407 |  99.9 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 |
| 2026   | Playoffs |   421 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2026   | Regular  | 6,587 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |

##### The worst team-games

| Season | Game       |       Team | Total off |                                                                                                                 Off by (box − plays) |
| ------ | ---------- | ---------: | --------: | -----------------------------------------------------------------------------------------------------------------------------------: |
| 1999   | 1029900189 | 1611661313 |       275 | PTS +41, FGM +16, FGA +56, FG3M +4, FG3A +19, FTM +5, FTA +8, OREB +15, DREB +12, REB +27, AST +14, STL +12, BLK +8, TOV +19, PF +19 |
| 1999   | 1029900189 | 1611661315 |       266 | PTS +53, FGM +17, FGA +42, FG3M +2, FG3A +7, FTM +17, FTA +21, OREB +5, DREB +18, REB +23, AST +11, STL +13, BLK +8, TOV +16, PF +13 |
| 1997   | 1029700012 | 1611661320 |       129 |       PTS -9, FGM -7, FGA +2, FG3M -9, FG3A -5, FTM +14, FTA +14, OREB -2, DREB +9, REB +7, AST +17, STL +3, BLK +4, TOV +13, PF +14 |
| 1997   | 1029700012 | 1611661318 |       119 |         PTS -20, FGM -11, FGA -8, FG3M -6, FG3A -1, FTM +8, FTA +8, OREB -8, DREB -1, REB -9, AST +1, STL +7, BLK +4, TOV +9, PF +18 |
| 2000   | 1020000154 | 1611661323 |        71 |                                                                                                                              PTS +71 |
| 2000   | 1020000154 | 1611661315 |        60 |                                                                                                                              PTS +60 |
| 1998   | 1029800015 | 1611661315 |        11 |                                                                                                PTS +4, FGM +1, FGA +2, AST +1, PF +3 |
| 2012   | 1021200001 | 1611661328 |        10 |                                                                                                                       AST +5, TOV +5 |

##### The worst player-games

| Season | Game       | Player | Total off |                                                                                                         Off by (box − plays) |
| ------ | ---------- | -----: | --------: | ---------------------------------------------------------------------------------------------------------------------------: |
| 1998   | 1029800085 | 100374 |        95 | PTS +17, FGM +6, FGA +18, FG3M +1, FG3A +5, FTM +4, FTA +4, OREB +4, DREB +7, REB +11, AST +5, STL +5, BLK +2, TOV +2, PF +4 |
| 1998   | 1029800113 | 100374 |        86 |                   PTS +18, FGM +6, FGA +17, FG3M +3, FG3A +7, FTM +3, FTA +4, OREB +5, REB +5, AST +4, STL +2, TOV +7, PF +5 |
| 1999   | 1029900189 | 100092 |        77 |                            PTS +19, FGM +7, FGA +16, FTM +5, FTA +6, OREB +2, DREB +4, REB +6, AST +2, STL +6, BLK +1, PF +3 |
| 1998   | 1029800037 | 100374 |        68 |  PTS +15, FGM +6, FGA +15, FG3M +1, FG3A +5, FTM +2, FTA +2, OREB +1, DREB +3, REB +4, AST +1, STL +3, BLK +2, TOV +6, PF +2 |
| 1999   | 1029900189 | 100103 |        68 |          PTS +15, FGM +6, FGA +13, FG3M +2, FG3A +3, FTM +1, FTA +1, OREB +2, DREB +5, REB +7, AST +3, STL +2, TOV +6, PF +2 |
| 1999   | 1029900189 | 100091 |        68 |          PTS +16, FGM +5, FGA +10, FG3M +1, FG3A +4, FTM +5, FTA +5, OREB +3, DREB +4, REB +7, STL +1, BLK +1, TOV +4, PF +2 |
| 1997   | 1029700012 | 100018 |        67 |                          PTS -22, FGM -9, FGA -18, FG3M -3, FG3A -4, FTM -1, FTA -2, DREB -1, REB -1, AST -3, STL +1, TOV -2 |
| 1998   | 1029800022 | 100374 |        61 |                  PTS +18, FGM +7, FGA +14, FG3M +1, FG3A +4, FTM +3, FTA +4, OREB +1, DREB +2, REB +3, AST +1, TOV +1, PF +2 |

#### ESPN play by play

##### Team-games

| Season | Type     |    Score exact | Team-games | Exact | Within 1 |   PTS |   FGM |   FGA |  FG3M |  FG3A |   FTM |   FTA |  OREB |  DREB |   REB |   AST |   STL |   BLK |  TOV |    PF |
| ------ | -------- | -------------: | ---------: | ----: | -------: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ---: | ----: |
| 2002   | Playoffs |  100.0 % of 14 |         28 |   0.0 |      0.0 | 100.0 | 100.0 | 100.0 |   0.0 |   0.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 75.0 |  96.4 |
| 2002   | Regular  |  88.8 % of 250 |        500 |   0.0 |      0.0 |  92.8 |  94.4 |  91.6 |   1.8 |   0.0 |  94.2 |  93.8 |  93.8 |  92.6 |  92.0 |  93.8 |   0.0 |  95.8 | 91.2 |  88.2 |
| 2003   | Playoffs |   73.7 % of 19 |         38 |   0.0 |      0.0 |  84.2 |  86.8 |  76.3 |  97.4 |  97.4 |  94.7 |  92.1 |  92.1 |  89.5 |  84.2 |  94.7 |   0.0 |  97.4 | 63.2 |  84.2 |
| 2003   | Regular  |  67.4 % of 236 |        472 |   0.0 |      0.8 |  79.0 |  85.0 |  70.1 |  94.3 |  87.3 |  88.1 |  87.9 |  87.7 |  83.1 |  78.4 |  87.7 |   0.2 |  93.9 | 50.8 |  78.0 |
| 2004   | Playoffs |   84.2 % of 19 |         38 |   0.0 |      0.0 |  89.5 |  94.7 |  86.8 |  97.4 |  94.7 |  94.7 |  97.4 |  97.4 |  86.8 |  84.2 |  94.7 |   0.0 | 100.0 | 15.8 |  97.4 |
| 2004   | Regular  |  74.3 % of 218 |        436 |   0.0 |      0.0 |  83.9 |  86.7 |  78.2 |  97.2 |  94.3 |  95.2 |  90.8 |  92.4 |  89.2 |  84.4 |  92.9 |   0.0 |  96.8 | 18.1 |  86.5 |
| 2005   | Playoffs |   76.5 % of 17 |         34 |   0.0 |      0.0 |  85.3 |  94.1 |  76.5 |  97.1 |  91.2 |  91.2 |  91.2 |  91.2 |  97.1 |  88.2 |  94.1 |   0.0 |  97.1 | 55.9 |  91.2 |
| 2005   | Regular  |  75.1 % of 221 |        442 |   0.0 |      1.4 |  84.8 |  88.2 |  78.3 |  97.5 |  90.5 |  93.7 |  85.3 |  91.2 |  90.7 |  86.9 |  93.4 |   0.0 |  96.6 | 57.0 |  84.8 |
| 2006   | Playoffs |  100.0 % of 19 |         38 |   0.0 |      0.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 34.2 | 100.0 |
| 2006   | Regular  |  83.1 % of 236 |        472 |   0.0 |      0.4 |  87.9 |  90.5 |  82.8 |  97.0 |  91.7 |  94.5 |  81.6 |  90.3 |  90.3 |  84.3 |  93.2 |   0.0 |  97.5 | 36.4 |  80.3 |
| 2007   | Playoffs |  100.0 % of 21 |         42 |   0.0 |      2.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 47.6 |  97.6 |
| 2007   | Regular  |  94.5 % of 218 |        436 |   0.0 |      1.1 |  97.0 |  97.2 |  95.6 |  99.1 |  96.1 |  99.5 |  99.3 |  97.5 |  96.6 |  96.1 |  97.0 |   0.2 |  97.0 | 44.0 |  94.7 |
| 2008   | Playoffs |  100.0 % of 20 |         40 |   0.0 |      0.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 20.0 |  97.5 |
| 2008   | Regular  |  98.7 % of 236 |        472 |   0.0 |      0.2 |  99.4 |  99.2 |  98.3 |  99.8 |  96.8 |  99.6 |  99.6 |  98.3 |  97.2 |  96.8 |  97.5 |   0.0 |  98.9 | 36.4 |  94.5 |
| 2009   | Playoffs |  100.0 % of 21 |         42 |   0.0 |      0.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 52.4 |  92.9 |
| 2009   | Regular  |  98.6 % of 218 |        436 |   0.0 |      0.2 |  99.3 |  99.3 |  99.1 | 100.0 |  96.3 |  99.8 |  99.5 |  99.1 |  99.8 |  99.3 |  99.5 |   0.0 |  99.3 | 41.3 |  95.0 |
| 2010   | Playoffs |  100.0 % of 16 |         32 |   0.0 |      0.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 43.8 |  96.9 |
| 2010   | Regular  |  99.5 % of 204 |        408 |   0.0 |      0.0 |  99.8 |  99.8 |  99.5 | 100.0 |  97.8 |  99.8 |  99.5 |  99.5 |  99.8 |  99.5 |  99.5 |   0.0 |  99.8 | 47.1 |  97.8 |
| 2011   | Playoffs |  100.0 % of 19 |         38 |   0.0 |      0.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |   0.0 | 100.0 | 26.3 |  42.1 |
| 2011   | Regular  |  99.0 % of 203 |        406 |   0.0 |      0.0 |  99.5 |  99.5 |  96.6 | 100.0 |  96.6 | 100.0 | 100.0 |  97.5 |  97.5 |  96.6 |  97.0 |   0.0 |  95.8 | 34.5 |  53.4 |
| 2012   | Playoffs |   94.4 % of 18 |         36 |   0.0 |     19.4 |  75.0 |  91.7 |  91.7 | 100.0 |  94.4 |  80.6 |  72.2 |  94.4 |  97.2 |  91.7 | 100.0 |  27.8 | 100.0 | 13.9 |  25.0 |
| 2012   | Regular  |  99.0 % of 202 |        404 |   0.0 |      0.0 |  93.8 |  97.5 |  96.5 |  99.5 |  94.3 |  95.5 |  95.0 |  98.0 |  98.0 |  96.8 |  97.8 |   0.0 |  99.3 | 25.7 |  29.0 |
| 2013   | Playoffs |  100.0 % of 17 |         34 |  17.6 |     44.1 |  97.1 | 100.0 |  97.1 | 100.0 | 100.0 |  97.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  88.2 |  97.1 | 38.2 |  58.8 |
| 2013   | Regular  |  99.5 % of 203 |        406 |  21.9 |     55.4 |  87.4 |  89.9 |  84.7 |  97.5 |  89.9 |  97.3 |  97.8 |  94.6 |  91.1 |  87.7 |  93.3 |  93.8 |  97.8 | 45.3 |  64.5 |
| 2014   | Playoffs |  100.0 % of 18 |         36 |  13.9 |     47.2 | 100.0 | 100.0 | 100.0 | 100.0 |  97.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  94.4 | 100.0 | 36.1 |  33.3 |
| 2014   | Regular  | 100.0 % of 203 |        406 |  22.7 |     61.1 |  99.5 |  99.5 |  99.0 | 100.0 |  95.8 | 100.0 | 100.0 |  99.3 |  98.8 |  99.0 |  99.3 |  95.6 |  98.8 | 42.1 |  57.9 |
| 2015   | Playoffs |  100.0 % of 21 |         42 |  11.9 |     45.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.6 | 100.0 | 45.2 |  28.6 |
| 2015   | Regular  |  99.5 % of 204 |        408 |  26.5 |     62.3 |  99.5 |  99.5 |  99.3 | 100.0 |  94.4 | 100.0 |  99.5 |  99.0 |  98.8 |  99.0 |  99.5 |  95.8 |  98.0 | 46.3 |  59.1 |
| 2016   | Playoffs |  100.0 % of 15 |         30 |  23.3 |     66.7 |  93.3 |  93.3 |  90.0 |  96.7 |  86.7 | 100.0 | 100.0 |  96.7 | 100.0 |  96.7 | 100.0 |  96.7 |  96.7 | 63.3 |  53.3 |
| 2016   | Regular  | 100.0 % of 201 |        402 |  18.2 |     54.0 |  99.5 |  99.5 |  99.3 |  99.8 |  94.3 | 100.0 | 100.0 |  99.3 |  99.8 |  99.3 |  99.5 |  96.0 |  99.8 | 42.0 |  48.3 |
| 2017   | Playoffs |  100.0 % of 15 |         30 |  13.3 |     56.7 | 100.0 | 100.0 | 100.0 | 100.0 |  93.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  90.0 | 100.0 | 46.7 |  40.0 |
| 2017   | Regular  |  99.5 % of 204 |        408 |  15.7 |     57.4 |  99.3 |  99.5 |  96.8 | 100.0 |  90.4 |  99.8 |  99.3 |  98.3 |  98.0 |  97.1 |  97.8 |  94.1 |  97.5 | 39.0 |  48.8 |
| 2018   | Playoffs |  100.0 % of 17 |         34 |  32.4 |     79.4 |  94.1 |  94.1 |  94.1 | 100.0 |  82.4 |  97.1 |  97.1 |  94.1 |  97.1 |  94.1 |  88.2 | 100.0 |  97.1 | 44.1 |  76.5 |
| 2018   | Regular  | 100.0 % of 201 |        402 |  21.4 |     66.9 |  99.5 |  99.8 |  97.8 |  99.8 |  82.8 | 100.0 | 100.0 |  97.8 |  97.8 |  96.5 |  93.0 |  94.5 |  97.8 | 42.8 |  66.4 |
| 2019   | Playoffs |  100.0 % of 16 |         32 |  31.3 |     78.1 | 100.0 | 100.0 | 100.0 | 100.0 |  87.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 37.5 |  96.9 |
| 2019   | Regular  | 100.0 % of 202 |        404 |  29.7 |     69.8 |  99.3 |  99.3 |  99.0 |  99.3 |  80.7 |  99.8 |  99.5 |  99.5 |  98.3 |  98.3 |  96.3 |  98.8 |  98.0 | 35.6 |  98.8 |
| 2020   | Playoffs |  100.0 % of 15 |         30 |  20.0 |     80.0 | 100.0 | 100.0 | 100.0 | 100.0 |  83.3 | 100.0 | 100.0 | 100.0 |  96.7 |  96.7 | 100.0 | 100.0 | 100.0 | 30.0 | 100.0 |
| 2020   | Regular  | 100.0 % of 131 |        262 |  33.2 |     74.8 | 100.0 | 100.0 |  98.5 | 100.0 |  80.5 | 100.0 | 100.0 | 100.0 |  99.2 |  99.2 |  98.5 |  97.7 |  98.9 | 44.3 |  98.5 |
| 2021   | Playoffs |  100.0 % of 17 |         34 |  26.5 |     67.6 | 100.0 | 100.0 | 100.0 | 100.0 |  82.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.1 | 100.0 | 100.0 | 32.4 | 100.0 |
| 2021   | Regular  | 100.0 % of 192 |        384 |  35.7 |     77.3 | 100.0 | 100.0 |  98.2 | 100.0 |  83.6 | 100.0 | 100.0 |  99.0 |  99.0 |  97.9 |  97.7 |  97.9 |  98.2 | 45.1 | 100.0 |
| 2022   | Playoffs |  100.0 % of 23 |         46 |  32.6 |     69.6 | 100.0 | 100.0 |  97.8 | 100.0 |  89.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 37.0 | 100.0 |
| 2022   | Regular  | 100.0 % of 216 |        432 |  31.9 |     75.5 |  99.8 | 100.0 |  99.5 |  99.8 |  81.3 | 100.0 | 100.0 |  98.8 |  98.8 |  97.9 |  99.3 |  99.1 |  99.3 | 38.7 |  99.3 |
| 2023   | Playoffs |   95.0 % of 20 |         40 |  37.5 |     62.5 |  97.5 | 100.0 |  97.5 | 100.0 |  90.0 |  97.5 |  97.5 | 100.0 | 100.0 | 100.0 |  97.5 |  97.5 | 100.0 | 37.5 |  95.0 |
| 2023   | Regular  | 100.0 % of 240 |        480 |  32.9 |     75.0 | 100.0 | 100.0 |  99.2 | 100.0 |  89.4 | 100.0 |  99.8 | 100.0 |  99.6 |  99.6 |  99.0 |  99.4 |  99.4 | 37.3 |  99.8 |
| 2024   | Playoffs |  100.0 % of 22 |         44 |  29.5 |     72.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  97.7 |  97.7 | 100.0 |  97.7 | 100.0 | 31.8 |  97.7 |
| 2024   | Regular  | 100.0 % of 240 |        480 |  33.8 |     73.1 |  99.6 |  99.6 |  99.6 | 100.0 |  99.8 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 |  99.6 | 100.0 |  99.6 | 34.6 |  99.6 |
| 2025   | Playoffs |  100.0 % of 24 |         48 |  37.5 |     68.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 37.5 | 100.0 |
| 2025   | Regular  | 100.0 % of 286 |        572 |  33.6 |     70.8 | 100.0 | 100.0 |  99.8 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 |  99.8 |  99.7 |  99.8 |  99.7 | 34.6 |  99.1 |
| 2026   | Playoffs |  100.0 % of 22 |         44 |  36.4 |     75.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 36.4 | 100.0 |
| 2026   | Regular  | 100.0 % of 330 |        660 |  45.9 |     80.8 | 100.0 | 100.0 |  99.8 | 100.0 |  99.8 | 100.0 | 100.0 |  99.7 |  99.7 |  99.4 |  99.7 |  99.8 |  99.8 | 46.5 |  99.7 |

##### Player-games

| Season | Type     | Lines | Exact | Within 1 |   PTS |   FGM |   FGA |  FG3M |  FG3A |   FTM |   FTA |  OREB |  DREB |   REB |   AST |   STL |   BLK |   TOV |    PF |
| ------ | -------- | ----: | ----: | -------: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 2002   | Playoffs |   246 |  15.9 |     45.9 |  99.2 |  99.2 |  99.2 |  62.2 |  39.0 |  99.2 |  99.2 |  99.6 |  99.2 |  99.2 |  99.2 |  52.0 | 100.0 |  40.2 |  98.0 |
| 2002   | Regular  | 4,846 |  19.2 |     49.7 |  96.6 |  96.9 |  95.8 |  71.8 |  49.5 |  97.8 |  97.6 |  98.1 |  96.8 |  96.5 |  96.8 |  51.2 |  99.1 |  42.8 |  96.0 |
| 2003   | Playoffs |   348 |  31.0 |     71.6 |  97.4 |  98.0 |  96.3 |  99.7 |  99.7 |  99.4 |  99.1 |  98.6 |  98.9 |  97.7 |  99.4 |  52.9 |  99.7 |  45.1 |  98.3 |
| 2003   | Regular  | 4,627 |  28.6 |     68.9 |  95.1 |  96.2 |  93.2 |  99.1 |  97.9 |  97.8 |  97.6 |  97.9 |  96.8 |  95.7 |  97.4 |  52.8 |  99.2 |  44.0 |  96.0 |
| 2004   | Playoffs |   361 |  29.6 |     66.2 |  98.1 |  98.6 |  97.8 |  99.2 |  98.9 |  99.4 |  99.7 |  99.7 |  98.3 |  98.1 |  99.4 |  47.6 | 100.0 |  46.0 |  99.2 |
| 2004   | Regular  | 4,228 |  27.3 |     66.8 |  97.5 |  98.1 |  96.5 |  99.7 |  99.3 |  99.3 |  98.8 |  99.0 |  98.7 |  97.8 |  99.1 |  51.5 |  99.6 |  40.2 |  98.3 |
| 2005   | Playoffs |   312 |  28.8 |     73.1 |  98.4 |  99.4 |  97.4 |  99.7 |  99.0 |  99.0 |  99.0 |  98.7 |  99.7 |  98.4 |  99.4 |  51.9 |  99.7 |  41.7 |  99.0 |
| 2005   | Regular  | 4,291 |  29.6 |     70.1 |  97.6 |  98.3 |  96.3 |  99.7 |  98.6 |  99.1 |  98.0 |  98.8 |  98.3 |  97.5 |  98.9 |  52.6 |  99.6 |  43.2 |  98.0 |
| 2006   | Playoffs |   373 |  33.0 |     75.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  55.0 | 100.0 |  44.5 | 100.0 |
| 2006   | Regular  | 4,712 |  27.2 |     68.9 |  98.1 |  98.5 |  97.1 |  99.6 |  98.8 |  99.3 |  97.7 |  98.8 |  98.5 |  97.6 |  98.9 |  50.8 |  99.7 |  41.3 |  97.5 |
| 2007   | Playoffs |   398 |  33.4 |     70.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  54.5 | 100.0 |  42.5 |  99.7 |
| 2007   | Regular  | 4,351 |  30.1 |     69.2 |  99.5 |  99.6 |  99.1 |  99.9 |  99.4 |  99.9 |  99.9 |  99.5 |  99.4 |  99.3 |  99.4 |  50.8 |  99.6 |  42.0 |  99.4 |
| 2008   | Playoffs |   393 |  32.3 |     73.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  52.4 | 100.0 |  45.0 |  99.7 |
| 2008   | Regular  | 4,840 |  30.0 |     70.5 |  99.4 |  99.5 |  99.1 | 100.0 |  99.5 |  99.8 |  99.8 |  99.8 |  99.7 |  99.6 |  99.6 |  52.2 |  99.9 |  42.3 |  99.1 |
| 2009   | Playoffs |   380 |  30.3 |     67.6 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  51.1 | 100.0 |  42.6 |  99.5 |
| 2009   | Regular  | 4,282 |  28.0 |     69.7 |  99.9 |  99.9 |  99.9 | 100.0 |  99.6 | 100.0 |  99.9 |  99.9 | 100.0 |  99.9 | 100.0 |  49.8 |  99.9 |  40.9 |  99.5 |
| 2010   | Playoffs |   293 |  30.4 |     69.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  50.9 | 100.0 |  42.7 |  99.7 |
| 2010   | Regular  | 3,920 |  26.5 |     66.9 | 100.0 | 100.0 |  99.9 | 100.0 |  99.8 | 100.0 |  99.9 |  99.9 | 100.0 |  99.9 |  99.9 |  48.7 | 100.0 |  40.1 |  99.8 |
| 2011   | Playoffs |   350 |  24.6 |     64.3 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  51.1 | 100.0 |  36.3 |  88.0 |
| 2011   | Regular  | 3,944 |  26.7 |     69.2 |  99.9 |  99.9 |  99.2 | 100.0 |  99.6 | 100.0 | 100.0 |  99.5 |  99.4 |  99.2 |  99.5 |  49.9 |  99.4 |  41.5 |  91.3 |
| 2012   | Playoffs |   324 |  23.8 |     59.9 |  98.5 |  99.1 |  99.1 | 100.0 |  99.4 |  99.1 |  98.8 |  99.4 |  99.7 |  99.1 | 100.0 |  47.2 | 100.0 |  37.7 |  63.0 |
| 2012   | Regular  | 3,891 |  21.4 |     62.5 |  99.4 |  99.7 |  99.5 |  99.9 |  99.4 |  99.7 |  99.6 |  99.8 |  99.7 |  99.6 |  99.6 |  47.1 |  99.8 |  35.7 |  79.3 |
| 2013   | Playoffs |   317 |  41.3 |     83.6 |  99.7 | 100.0 |  99.4 | 100.0 | 100.0 |  99.7 | 100.0 |  99.4 | 100.0 |  99.4 | 100.0 |  46.1 |  99.7 |  44.8 |  91.2 |
| 2013   | Regular  | 3,855 |  37.6 |     76.9 |  98.4 |  98.7 |  98.0 |  99.7 |  98.8 |  99.7 |  99.7 |  99.3 |  98.9 |  98.4 |  99.1 |  41.3 |  99.7 |  41.4 |  93.8 |
| 2014   | Playoffs |   349 |  42.4 |     82.2 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  49.3 | 100.0 |  49.0 |  85.7 |
| 2014   | Regular  | 4,031 |  38.9 |     79.0 |  99.6 |  99.6 |  99.4 | 100.0 |  99.5 |  99.9 |  99.9 |  99.7 |  99.5 |  99.3 |  99.7 |  42.0 |  99.6 |  42.0 |  92.7 |
| 2015   | Playoffs |   402 |  37.3 |     78.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  40.8 | 100.0 |  40.8 |  86.1 |
| 2015   | Regular  | 4,057 |  39.6 |     80.5 |  99.9 |  99.9 |  99.6 | 100.0 |  99.2 | 100.0 | 100.0 |  99.8 |  99.7 |  99.6 |  99.9 |  42.7 |  99.6 |  42.9 |  92.8 |
| 2016   | Playoffs |   283 |  38.9 |     79.9 |  99.3 |  99.3 |  99.3 |  99.6 |  97.9 | 100.0 | 100.0 |  99.6 |  99.3 |  99.6 | 100.0 |  41.3 |  99.6 |  41.7 |  91.9 |
| 2016   | Regular  | 4,037 |  40.3 |     81.5 |  99.9 |  99.9 |  99.9 | 100.0 |  99.4 | 100.0 | 100.0 |  99.9 | 100.0 |  99.9 |  99.9 |  44.1 | 100.0 |  44.1 |  90.9 |
| 2017   | Playoffs |   289 |  45.3 |     80.6 |  99.3 |  99.3 |  99.3 | 100.0 |  99.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  49.1 | 100.0 |  49.5 |  90.7 |
| 2017   | Regular  | 4,108 |  41.0 |     80.9 |  99.8 |  99.9 |  98.9 | 100.0 |  98.8 |  99.9 |  99.9 |  99.7 |  99.4 |  99.2 |  99.3 |  45.3 |  99.8 |  45.3 |  91.8 |
| 2018   | Playoffs |   309 |  90.6 |     98.7 |  98.7 |  99.0 |  98.1 | 100.0 |  97.4 |  99.7 |  99.7 |  98.7 |  99.7 |  98.4 |  98.1 | 100.0 |  99.7 |  98.4 |  97.4 |
| 2018   | Regular  | 4,070 |  66.1 |     90.6 |  99.8 |  99.8 |  99.6 |  99.9 |  98.1 | 100.0 | 100.0 |  99.7 |  99.3 |  99.0 |  98.9 |  72.2 |  99.7 |  71.8 |  95.1 |
| 2019   | Playoffs |   318 |  96.9 |     99.4 |  99.4 | 100.0 | 100.0 | 100.0 |  98.7 |  99.4 |  99.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.4 |  99.7 |  99.7 |
| 2019   | Regular  | 3,928 |  94.2 |     99.5 |  99.7 |  99.7 |  99.5 |  99.9 |  97.7 |  99.9 |  99.9 |  99.8 |  99.6 |  99.4 |  99.3 |  99.5 |  99.7 |  99.0 |  99.6 |
| 2020   | Playoffs |   275 |  96.4 |     98.9 |  99.3 | 100.0 | 100.0 | 100.0 |  98.2 |  99.3 |  99.3 |  99.3 |  99.6 |  98.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2020   | Regular  | 2,505 |  95.4 |     99.7 |  99.8 |  99.8 |  99.6 |  99.9 |  97.6 |  99.9 |  99.9 | 100.0 |  99.8 |  99.8 |  99.6 |  99.6 |  99.8 |  99.3 |  99.8 |
| 2021   | Playoffs |   320 |  97.8 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  98.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2021   | Regular  | 3,565 |  96.0 |     99.9 | 100.0 | 100.0 |  99.7 | 100.0 |  98.0 | 100.0 | 100.0 |  99.9 |  99.7 |  99.6 |  99.7 |  99.6 |  99.7 |  99.4 |  99.9 |
| 2022   | Playoffs |   423 |  98.3 |    100.0 | 100.0 | 100.0 |  99.8 | 100.0 |  98.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 |
| 2022   | Regular  | 4,096 |  95.9 |     99.8 |  99.8 | 100.0 |  99.8 | 100.0 |  97.8 |  99.9 |  99.9 |  99.9 |  99.7 |  99.6 |  99.9 |  99.2 |  99.9 |  99.5 |  99.8 |
| 2023   | Playoffs |   354 |  95.5 |     99.2 |  99.7 | 100.0 |  99.2 | 100.0 |  98.3 |  99.7 |  99.7 | 100.0 | 100.0 | 100.0 |  99.7 |  99.7 | 100.0 |  98.9 |  98.9 |
| 2023   | Regular  | 4,544 |  97.9 |    100.0 | 100.0 | 100.0 |  99.8 | 100.0 |  98.7 | 100.0 | 100.0 | 100.0 |  99.9 |  99.9 |  99.8 |  99.9 |  99.9 |  99.7 |  99.9 |
| 2024   | Playoffs |   399 |  98.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.7 |  99.7 |  99.5 |  98.7 | 100.0 | 100.0 |  99.7 |
| 2024   | Regular  | 4,515 |  99.2 |     99.9 |  99.9 |  99.9 |  99.7 | 100.0 |  99.9 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 |  99.8 | 100.0 |  99.9 |  99.9 | 100.0 |
| 2025   | Playoffs |   446 | 100.0 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 2025   | Regular  | 5,407 |  99.0 |    100.0 | 100.0 | 100.0 |  99.6 | 100.0 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 |  99.9 |  99.9 | 100.0 |  99.7 |  99.9 |
| 2026   | Playoffs |   421 |  99.5 |    100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |  99.5 | 100.0 | 100.0 | 100.0 |
| 2026   | Regular  | 6,587 |  99.4 |     99.9 |  99.9 |  99.9 |  99.9 | 100.0 | 100.0 | 100.0 | 100.0 |  99.9 |  99.9 |  99.8 |  99.8 |  99.9 | 100.0 |  99.9 | 100.0 |

##### The worst team-games

| Season | Game       |       Team | Total off |                                                                                                                 Off by (box − plays) |
| ------ | ---------- | ---------: | --------: | -----------------------------------------------------------------------------------------------------------------------------------: |
| 2006   | 1020600231 | 1611661316 |       332 | PTS +79, FGM +26, FGA +54, FG3M +7, FG3A +21, FTM +20, FTA +26, OREB +7, DREB +18, REB +25, AST +15, STL +8, BLK +1, TOV +12, PF +13 |
| 2002   | 1020200059 | 1611661320 |       311 |  PTS +62, FGM +25, FGA +57, FG3M +7, FG3A +15, FTM +5, FTA +10, OREB +9, DREB +23, REB +32, AST +16, STL +4, BLK +7, TOV +17, PF +22 |
| 2002   | 1020200166 | 1611661327 |       311 |         PTS +70, FGM +28, FGA +53, FG3M +1, FG3A +13, FTM +13, FTA +21, OREB +6, DREB +23, REB +29, AST +16, STL +7, TOV +10, PF +21 |
| 2006   | 1020600231 | 1611661328 |       291 |          PTS +65, FGM +29, FGA +58, FG3M +2, FG3A +11, FTM +5, FTA +10, OREB +7, DREB +19, REB +26, AST +13, STL +7, TOV +19, PF +20 |
| 2002   | 1020200084 | 1611661327 |       280 |         PTS +58, FGM +21, FGA +53, FG3M +6, FG3A +13, FTM +10, FTA +13, OREB +8, DREB +18, REB +26, AST +12, STL +8, TOV +19, PF +15 |
| 2002   | 1020200169 | 1611661321 |       280 |  PTS +59, FGM +23, FGA +52, FG3M +3, FG3A +6, FTM +11, FTA +15, OREB +7, DREB +19, REB +26, AST +15, STL +9, BLK +4, TOV +11, PF +20 |
| 2002   | 1020200059 | 1611661318 |       279 | PTS +55, FGM +21, FGA +61, FG3M +3, FG3A +14, FTM +11, FTA +16, OREB +6, DREB +14, REB +20, AST +15, STL +11, BLK +6, TOV +8, PF +18 |
| 2002   | 1020200084 | 1611661316 |       279 |         PTS -58, FGM -21, FGA -53, FG3M +5, FG3A +7, FTM -10, FTA -13, OREB +3, DREB +22, REB +25, AST -12, STL +15, TOV +20, PF -15 |

##### The worst player-games

| Season | Game       | Player | Total off |                                                                                            Off by (box − plays) |
| ------ | ---------- | -----: | --------: | --------------------------------------------------------------------------------------------------------------: |
| 2002   | 1020200084 | 100076 |       335 | PTS -98, FGM -38, FGA -87, FG3M +4, FG3A +5, FTM -15, FTA -18, DREB +6, REB +6, AST -28, STL +2, TOV +4, PF -24 |
| 2002   | 1020200019 | 100231 |       119 |                      PTS -29, FGM -11, FGA -32, FTM -7, FTA -8, OREB +3, DREB +3, REB +6, AST -9, BLK -2, PF -9 |
| 2006   | 1020600231 | 100076 |        90 |           PTS +25, FGM +6, FGA +13, FG3M +3, FG3A +7, FTM +10, FTA +10, DREB +6, REB +6, STL +1, BLK +1, TOV +2 |
| 2002   | 1020200166 | 100072 |        82 |      PTS +22, FGM +9, FGA +20, FG3A +4, FTM +4, FTA +4, OREB +1, DREB +4, REB +5, AST +3, STL +2, TOV +2, PF +2 |
| 2002   | 1020200012 | 100372 |        78 |            PTS +19, FGM +4, FGA +11, FG3M +1, FG3A +4, FTM +10, FTA +12, DREB +2, REB +2, AST +9, TOV +2, PF +2 |
| 2002   | 1020200166 | 100076 |        77 |              PTS +22, FGM +6, FGA +13, FG3M +3, FG3A +6, FTM +7, FTA +7, DREB +2, REB +2, AST +1, TOV +5, PF +3 |
| 2002   | 1020200130 | 100016 |        73 |                              PTS +21, FGM +9, FGA +13, FG3M +3, FG3A +4, DREB +5, REB +5, AST +2, STL +6, PF +5 |
| 2002   | 1020200019 | 100720 |        72 |      PTS +14, FGM +6, FGA +20, FG3A +6, FTM +2, FTA +2, OREB +2, DREB +2, REB +4, AST +5, STL +4, TOV +3, PF +2 |

#### Possessions

SportsDataverse's possessions, derived from the NBA's play by play. Points: the possessions' points against the team's in the box score. Shots: field-goal makes and attempts and free-throw attempts all equal the box score's. OREB and TOV: against the team's plays, team rebounds and team turnovers included. Against the estimate: counted possessions less the box score's simple estimate (FGA + 0.44 × FTA − OREB + TOV), the median, and the share within 3.

| Season | Type     | Team-games | Points exact | Within 5 | Worst | Shots exact | OREB |   TOV | Median vs estimate | Within 3 |
| ------ | -------- | ---------: | -----------: | -------: | ----: | ----------: | ---: | ----: | -----------------: | -------: |
| 1997   | Playoffs |          6 |        100.0 |    100.0 |     0 |       100.0 |  0.0 | 100.0 |               -0.4 |     83.3 |
| 1997   | Regular  |        224 |         96.9 |     99.1 |    19 |        99.1 |  4.5 |  94.6 |               -2.4 |     61.6 |
| 1998   | Playoffs |         16 |        100.0 |    100.0 |     0 |       100.0 | 12.5 | 100.0 |               -2.6 |     62.5 |
| 1998   | Regular  |        298 |         99.3 |    100.0 |     4 |        99.7 |  4.7 |  99.0 |               -1.9 |     69.8 |
| 1999   | Playoffs |         22 |        100.0 |    100.0 |     0 |       100.0 |  4.5 |  95.5 |               -3.0 |     50.0 |
| 1999   | Regular  |        384 |         99.5 |     99.5 |    53 |        99.2 |  7.3 |  98.4 |               -2.1 |     67.7 |
| 2000   | Playoffs |         32 |        100.0 |    100.0 |     0 |       100.0 | 18.8 | 100.0 |               -2.9 |     56.3 |
| 2000   | Regular  |        512 |         99.4 |     99.6 |    71 |        99.8 |  7.8 |  97.1 |               -2.2 |     66.8 |
| 2001   | Playoffs |         36 |        100.0 |    100.0 |     0 |       100.0 |  8.3 | 100.0 |               -2.8 |     55.6 |
| 2001   | Regular  |        512 |        100.0 |    100.0 |     0 |        99.8 |  9.2 |  97.5 |               -1.7 |     74.2 |
| 2002   | Playoffs |         34 |        100.0 |    100.0 |     0 |       100.0 |  5.9 |  97.1 |               -2.3 |     55.9 |
| 2002   | Regular  |        512 |        100.0 |    100.0 |     0 |       100.0 |  6.3 |  99.2 |               -1.8 |     72.1 |
| 2003   | Playoffs |         38 |        100.0 |    100.0 |     0 |       100.0 |  7.9 | 100.0 |               -3.3 |     44.7 |
| 2003   | Regular  |        476 |        100.0 |    100.0 |     0 |       100.0 |  8.2 |  97.9 |               -2.4 |     62.8 |
| 2004   | Playoffs |         38 |        100.0 |    100.0 |     0 |       100.0 | 13.2 |  97.4 |               -2.5 |     52.6 |
| 2004   | Regular  |        442 |        100.0 |    100.0 |     0 |       100.0 |  7.0 |  98.6 |               -2.0 |     67.4 |
| 2005   | Playoffs |         34 |        100.0 |    100.0 |     0 |       100.0 |  2.9 | 100.0 |               -2.8 |     55.9 |
| 2005   | Regular  |        442 |        100.0 |    100.0 |     0 |       100.0 |  6.1 |  98.9 |               -2.3 |     69.9 |
| 2006   | Playoffs |         38 |        100.0 |    100.0 |     0 |       100.0 |  2.6 | 100.0 |               -3.1 |     44.7 |
| 2006   | Regular  |        474 |         99.8 |    100.0 |     2 |        99.6 |  3.4 |  98.9 |               -2.6 |     57.6 |
| 2007   | Playoffs |         42 |        100.0 |    100.0 |     0 |       100.0 |  2.4 | 100.0 |               -2.6 |     64.3 |
| 2007   | Regular  |        440 |        100.0 |    100.0 |     0 |       100.0 |  5.2 |  98.9 |               -2.5 |     60.7 |
| 2008   | Playoffs |         42 |        100.0 |    100.0 |     0 |       100.0 |  2.4 | 100.0 |               -2.5 |     54.8 |
| 2008   | Regular  |        476 |        100.0 |    100.0 |     0 |       100.0 |  2.7 |  97.5 |               -2.6 |     62.6 |
| 2009   | Playoffs |         42 |        100.0 |    100.0 |     0 |       100.0 |  7.1 |  97.6 |               -3.0 |     50.0 |
| 2009   | Regular  |        440 |        100.0 |    100.0 |     0 |        99.8 |  3.4 |  98.2 |               -2.8 |     54.5 |
| 2010   | Playoffs |         32 |        100.0 |    100.0 |     0 |       100.0 |  6.3 | 100.0 |               -3.4 |     37.5 |
| 2010   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  5.9 |  99.0 |               -2.3 |     64.7 |
| 2011   | Playoffs |         38 |        100.0 |    100.0 |     0 |       100.0 |  5.3 | 100.0 |               -2.5 |     65.8 |
| 2011   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  3.9 |  98.3 |               -2.5 |     59.8 |
| 2012   | Playoffs |         38 |        100.0 |    100.0 |     0 |       100.0 |  2.6 | 100.0 |               -3.0 |     52.6 |
| 2012   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  5.1 |  98.8 |               -3.0 |     50.5 |
| 2013   | Playoffs |         34 |        100.0 |    100.0 |     0 |       100.0 |  2.9 |  97.1 |               -3.0 |     50.0 |
| 2013   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  5.6 |  99.0 |               -2.7 |     56.1 |
| 2014   | Playoffs |         36 |        100.0 |    100.0 |     0 |       100.0 |  5.6 | 100.0 |               -3.6 |     47.2 |
| 2014   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  5.1 |  98.3 |               -2.5 |     60.5 |
| 2015   | Playoffs |         42 |        100.0 |    100.0 |     0 |       100.0 |  7.1 |  97.6 |               -2.7 |     57.1 |
| 2015   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  5.1 |  97.5 |               -2.7 |     53.4 |
| 2016   | Playoffs |         32 |        100.0 |    100.0 |     0 |       100.0 |  6.3 | 100.0 |               -2.0 |     68.8 |
| 2016   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  4.4 |  97.5 |               -3.0 |     50.2 |
| 2017   | Playoffs |         30 |        100.0 |    100.0 |     0 |       100.0 |  3.3 | 100.0 |               -3.3 |     43.3 |
| 2017   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  6.1 |  99.0 |               -2.9 |     52.7 |
| 2018   | Playoffs |         34 |        100.0 |    100.0 |     0 |       100.0 | 14.7 | 100.0 |               -2.1 |     61.8 |
| 2018   | Regular  |        406 |        100.0 |    100.0 |     0 |       100.0 |  7.4 |  98.3 |               -2.6 |     57.6 |
| 2019   | Playoffs |         32 |        100.0 |    100.0 |     0 |       100.0 |  9.4 | 100.0 |               -2.8 |     56.3 |
| 2019   | Regular  |        408 |        100.0 |    100.0 |     0 |       100.0 |  8.6 |  98.3 |               -3.1 |     48.5 |
| 2020   | Playoffs |         30 |        100.0 |    100.0 |     0 |       100.0 |  3.3 | 100.0 |               -2.7 |     63.3 |
| 2020   | Regular  |        264 |        100.0 |    100.0 |     0 |       100.0 |  6.1 |  98.9 |               -2.5 |     61.4 |
| 2021   | Playoffs |         34 |        100.0 |    100.0 |     0 |       100.0 |  8.8 | 100.0 |               -2.8 |     58.8 |
| 2021   | Regular  |        384 |        100.0 |    100.0 |     0 |       100.0 |  9.6 |  98.7 |               -2.6 |     57.0 |
| 2022   | Playoffs |         46 |        100.0 |    100.0 |     0 |       100.0 | 13.0 |  97.8 |               -2.3 |     71.7 |
| 2022   | Regular  |        432 |        100.0 |    100.0 |     0 |       100.0 |  8.8 |  99.3 |               -2.8 |     52.8 |
| 2023   | Playoffs |         40 |        100.0 |    100.0 |     0 |       100.0 |  7.5 |  97.5 |               -2.1 |     67.5 |
| 2023   | Regular  |        480 |        100.0 |    100.0 |     0 |       100.0 |  7.1 |  99.6 |               -3.0 |     49.0 |
| 2024   | Playoffs |         44 |        100.0 |    100.0 |     0 |       100.0 | 13.6 | 100.0 |               -3.0 |     56.8 |
| 2024   | Regular  |        480 |        100.0 |    100.0 |     0 |       100.0 |  6.0 |  99.6 |               -3.0 |     50.2 |
| 2025   | Playoffs |         48 |        100.0 |    100.0 |     0 |       100.0 |  6.3 | 100.0 |               -3.6 |     45.8 |
| 2025   | Regular  |        572 |        100.0 |    100.0 |     0 |       100.0 |  6.6 |  99.1 |               -2.9 |     51.4 |
| 2026   | Playoffs |         44 |        100.0 |    100.0 |     0 |       100.0 |  6.8 | 100.0 |               -3.4 |     38.6 |
| 2026   | Regular  |        660 |        100.0 |    100.0 |     0 |        99.8 |  6.1 |  99.7 |               -3.2 |     46.8 |

#### The running score

Rows whose score after is below the row before's ("Below"), and rows at 0-0 once a point has been scored ("0-0"), per source and season, in the play order. Both should be 0: a score only rises.

| Season | Source |    Rows | Below | 0-0 |
| ------ | ------ | ------: | ----: | --: |
| 2002   | ESPN   |  95,117 |    21 |   0 |
| 2003   | ESPN   |  92,136 |    68 |   5 |
| 2004   | ESPN   |  85,339 |    44 |   4 |
| 2005   | ESPN   |  86,494 |    90 |   6 |
| 2006   | ESPN   |  99,083 |    53 |   9 |
| 2007   | ESPN   |  95,047 |    14 |   0 |
| 2008   | ESPN   | 102,445 |    13 |   0 |
| 2009   | ESPN   |  95,552 |     1 |   0 |
| 2010   | ESPN   |  86,688 |     2 |   0 |
| 2011   | ESPN   |  85,358 |     0 |   0 |
| 2012   | ESPN   |  84,349 |   288 |   0 |
| 2013   | ESPN   |  83,292 |   233 |   1 |
| 2014   | ESPN   |  84,065 |    77 |   0 |
| 2015   | ESPN   |  85,196 |    36 |   0 |
| 2016   | ESPN   |  84,024 |    61 |   0 |
| 2017   | ESPN   |  84,903 |    25 |   1 |
| 2018   | ESPN   |  84,811 |     6 |   0 |
| 2019   | ESPN   |  84,517 |    11 |   0 |
| 2020   | ESPN   |  56,361 |     0 |   0 |
| 2021   | ESPN   |  80,485 |     0 |   0 |
| 2022   | ESPN   |  93,166 |     8 |   0 |
| 2023   | ESPN   | 102,191 |     7 |   0 |
| 2024   | ESPN   | 101,501 |     0 |   0 |
| 2025   | ESPN   | 121,342 |     0 |   0 |
| 2026   | ESPN   | 144,409 |     0 |   0 |
| 1997   | NBA    |  47,583 |     6 |   0 |
| 1998   | NBA    |  63,658 |     2 |   0 |
| 1999   | NBA    |  79,679 |     7 |   0 |
| 2000   | NBA    | 105,417 |     9 |   0 |
| 2001   | NBA    | 105,957 |     2 |   0 |
| 2002   | NBA    | 105,276 |     2 |   0 |
| 2003   | NBA    |  99,349 |     1 |   3 |
| 2004   | NBA    |  92,441 |     1 |   0 |
| 2005   | NBA    |  91,502 |     5 |   0 |
| 2006   | NBA    | 104,864 |     5 |   0 |
| 2007   | NBA    | 101,161 |     0 |   0 |
| 2008   | NBA    | 109,761 |     4 |   0 |
| 2009   | NBA    | 101,779 |     6 |   0 |
| 2010   | NBA    |  91,581 |     4 |   0 |
| 2011   | NBA    |  90,663 |     3 |   0 |
| 2012   | NBA    |  91,399 |     1 |   0 |
| 2013   | NBA    |  89,896 |     3 |   0 |
| 2014   | NBA    |  90,134 |     4 |   0 |
| 2015   | NBA    |  90,972 |     1 |   0 |
| 2016   | NBA    |  91,724 |     2 |   0 |
| 2017   | NBA    |  90,543 |     9 |   0 |
| 2018   | NBA    |  89,269 |    31 |   0 |
| 2019   | NBA    |  89,334 |    34 |   0 |
| 2020   | NBA    |  59,512 |     4 |   0 |
| 2021   | NBA    |  83,986 |    11 |   0 |
| 2022   | NBA    |  97,050 |    15 |   0 |
| 2023   | NBA    | 106,038 |    25 |   0 |
| 2024   | NBA    | 105,797 |    12 |   0 |
| 2025   | NBA    | 126,330 |    20 |   0 |
| 2026   | NBA    | 149,921 |    23 |   0 |

### Shots

`scripts/check-shots.mjs … --league=wnba`.

#### 1. Zone sums equal shot totals

Rows whose zones, bands or types do not add up to their shots (attempts or makes), and shot-row player-games whose table row differs.

| Season | Player-games | Off (zones, bands, types) | Team-games | Off (both sides) | Shot rows → table off |
| ------ | -----------: | ------------------------: | ---------: | ---------------: | --------------------: |
| 1997   |        2,001 |                      2586 |        230 |              868 |            0 of 2,001 |
| 1998   |        2,811 |                      3171 |        314 |             1064 |            0 of 2,811 |
| 1999   |        3,541 |                      3856 |        406 |             1398 |            0 of 3,541 |
| 2000   |        4,789 |                      4915 |        544 |             1758 |            0 of 4,789 |
| 2001   |        4,924 |                      4880 |        548 |             1806 |            0 of 4,924 |
| 2002   |        4,836 |                      5289 |        546 |             1826 |            0 of 4,836 |
| 2003   |        4,583 |                      4007 |        514 |             1544 |            0 of 4,583 |
| 2004   |        4,223 |                      3989 |        480 |             1512 |            0 of 4,223 |
| 2005   |        4,199 |                      3935 |        476 |             1428 |            0 of 4,199 |
| 2006   |        4,763 |                      4744 |        512 |             1610 |            0 of 4,763 |
| 2007   |        4,429 |                      4271 |        482 |             1464 |            0 of 4,429 |
| 2008   |        4,913 |                      4535 |        518 |             1614 |            0 of 4,913 |
| 2009   |        4,424 |                      3977 |        482 |             1438 |            0 of 4,424 |
| 2010   |        3,952 |                      3512 |        440 |             1300 |            0 of 3,952 |
| 2011   |        4,039 |                         0 |        446 |                0 |            0 of 4,039 |
| 2012   |        4,037 |                         0 |        446 |                0 |            0 of 4,037 |
| 2013   |        3,934 |                         0 |        442 |                0 |            0 of 3,934 |
| 2014   |        4,075 |                         0 |        444 |                0 |            0 of 4,075 |
| 2015   |        4,195 |                         0 |        450 |                0 |            0 of 4,195 |
| 2016   |        4,141 |                         0 |        440 |                0 |            0 of 4,141 |
| 2017   |        4,103 |                         0 |        438 |                0 |            0 of 4,103 |
| 2018   |        4,111 |                         8 |        440 |               16 |            0 of 4,111 |
| 2019   |        4,040 |                        15 |        440 |               30 |            0 of 4,040 |
| 2020   |        2,651 |                         0 |        294 |                0 |            0 of 2,651 |
| 2021   |        3,675 |                        15 |        418 |               24 |            0 of 3,675 |
| 2022   |        4,266 |                         5 |        478 |                8 |            0 of 4,266 |
| 2023   |        4,559 |                        10 |        520 |               20 |            0 of 4,559 |
| 2024   |        4,563 |                        14 |        524 |               28 |            0 of 4,563 |
| 2025   |        5,467 |                         8 |        620 |               16 |            0 of 5,466 |
| 2026   |        6,546 |                         8 |        704 |               16 |            0 of 6,546 |

#### 2. Zones recounted from the coordinates

The NBA’s file publishes no zone. Here the zones are recounted by the rule written out again in this script, against the tables (team-games, own shots). "3 inside" is a three whose point is inside the arc and the corner lines; "2 outside" a two more than half a foot beyond them. 1996-97 had a 22-foot line all round, so its threes inside the arc are expected.

| Season |  Shots | ra % | paint % | mid % | c3l % | c3r % | atb3 % | back % | unk % | Recount = table | 3 inside | 2 outside |
| ------ | -----: | ---: | ------: | ----: | ----: | ----: | -----: | -----: | ----: | --------------: | -------: | --------: |
| 1997   | 14,080 |  3.9 |    24.5 |  22.0 |   2.2 |   1.9 |   15.4 |    0.1 |  30.0 |              NO |     2574 |         1 |
| 1998   | 19,151 |  8.4 |    23.3 |  23.0 |   2.8 |   2.1 |   14.6 |    0.0 |  25.8 |             yes |     3492 |         0 |
| 1999   | 24,150 |  6.9 |    22.2 |  24.2 |   3.0 |   2.5 |   16.9 |    0.1 |  24.2 |             yes |     5077 |         0 |
| 2000   | 31,559 |  8.4 |    22.5 |  24.3 |   3.4 |   3.0 |   15.5 |    0.0 |  22.9 |             yes |     6375 |         1 |
| 2001   | 32,008 |  7.6 |    23.0 |  25.6 |   3.3 |   2.5 |   16.3 |    0.0 |  21.6 |             yes |     6215 |         1 |
| 2002   | 32,004 |  6.5 |    19.7 |  25.5 |   3.3 |   2.6 |   16.5 |    0.1 |  25.8 |             yes |     6366 |         0 |
| 2003   | 30,728 | 12.6 |    20.2 |  24.2 |   3.3 |   2.9 |   16.3 |    0.1 |  20.4 |             yes |     6397 |         0 |
| 2004   | 28,007 | 10.7 |    17.9 |  28.1 |   2.8 |   2.4 |   15.7 |    0.1 |  22.3 |             yes |     4792 |         1 |
| 2005   | 27,524 | 10.4 |    18.2 |  28.4 |   3.1 |   2.6 |   14.7 |    0.1 |  22.4 |             yes |     4571 |         0 |
| 2006   | 33,009 |  9.5 |    16.5 |  28.4 |   3.6 |   2.9 |   16.6 |    0.1 |  22.3 |             yes |     5969 |         0 |
| 2007   | 31,974 | 10.4 |    15.1 |  28.1 |   4.0 |   3.2 |   17.3 |    0.1 |  21.9 |             yes |     6258 |         0 |
| 2008   | 33,620 | 10.1 |    16.1 |  28.6 |   3.4 |   2.6 |   17.8 |    0.2 |  21.2 |             yes |     6149 |         1 |
| 2009   | 32,008 | 13.4 |    15.1 |  27.5 |   3.9 |   3.0 |   17.5 |    0.2 |  19.4 |             yes |     6161 |         1 |
| 2010   | 29,238 | 13.3 |    15.6 |  27.4 |   3.8 |   2.9 |   18.3 |    0.2 |  18.6 |             yes |     5982 |         0 |
| 2011   | 29,381 | 31.3 |    18.1 |  26.7 |   3.4 |   2.8 |   17.6 |    0.2 |   0.0 |             yes |     5586 |         0 |
| 2012   | 29,722 | 31.9 |    15.8 |  25.9 |   4.0 |   3.3 |   19.0 |    0.2 |   0.0 |             yes |     6323 |         0 |
| 2013   | 29,307 | 32.4 |    16.5 |  29.7 |   2.3 |   2.0 |   16.9 |    0.2 |   0.0 |             yes |     2407 |         0 |
| 2014   | 29,467 | 33.1 |    16.5 |  29.3 |   2.3 |   1.8 |   16.8 |    0.2 |   0.0 |             yes |     2172 |         0 |
| 2015   | 29,400 | 32.6 |    15.4 |  29.4 |   2.5 |   1.9 |   17.9 |    0.2 |   0.0 |             yes |     2817 |         0 |
| 2016   | 29,703 | 33.7 |    15.1 |  27.6 |   2.4 |   1.8 |   19.1 |    0.3 |   0.0 |             yes |     2385 |         0 |
| 2017   | 29,730 | 33.0 |    14.4 |  26.8 |   2.4 |   1.9 |   21.2 |    0.3 |   0.0 |             yes |     2838 |         0 |
| 2018   | 30,324 | 27.7 |    16.3 |  27.4 |   2.6 |   2.0 |   23.6 |    0.3 |   0.0 |             yes |     1261 |         0 |
| 2019   | 30,271 | 27.6 |    19.4 |  23.8 |   2.9 |   2.4 |   23.7 |    0.2 |   0.0 |             yes |     1162 |         0 |
| 2020   | 20,076 | 22.2 |    25.6 |  21.4 |   2.5 |   1.9 |   26.2 |    0.1 |   0.0 |             yes |      562 |         0 |
| 2021   | 28,654 | 28.5 |    20.3 |  20.3 |   3.2 |   2.6 |   25.0 |    0.2 |   0.0 |             yes |     1237 |         0 |
| 2022   | 32,513 | 29.4 |    19.2 |  18.7 |   3.7 |   3.1 |   25.7 |    0.2 |   0.0 |             yes |     1389 |         0 |
| 2023   | 35,623 | 28.2 |    21.8 |  17.5 |   3.9 |   3.2 |   25.1 |    0.2 |   0.0 |             yes |     1288 |         0 |
| 2024   | 35,770 | 28.0 |    22.2 |  16.3 |   4.0 |   3.4 |   25.9 |    0.2 |   0.0 |             yes |     1272 |         0 |
| 2025   | 41,856 | 27.3 |    23.3 |  13.7 |   4.4 |   3.6 |   27.5 |    0.2 |   0.0 |              NO |     1574 |         0 |
| 2026   | 48,230 | 29.5 |    22.1 |  11.2 |   4.7 |   3.7 |   28.6 |    0.2 |   0.0 |             yes |     1941 |         0 |

#### 3. Shot rows against the box scores

Team-games exact on each count, all four together, and player-games exact on all four; then the corner and above-the-break threes, with the threes from beyond half court (and off the court), against the threes in the rows.

| Season |      Type | Team-games | FGA % | FGM % | 3PA % | 3PM % | All four % | Player-games all four % |  Corner + ATB + back = 3PA |
| ------ | --------: | ---------: | ----: | ----: | ----: | ----: | ---------: | ----------------------: | -------------------------: |
| 1997   |   regular |        224 |  99.1 |  99.1 |  99.1 |  99.1 |       99.1 |                    97.7 |    2,672 + 20 + 3 of 2,695 |
| 1998   |   regular |        300 |  99.0 |  99.0 |  99.3 |  99.3 |       99.0 |                    98.4 |     3,527 + 7 + 2 of 3,536 |
| 1999   |   regular |        384 |  99.5 |  99.5 |  99.5 |  99.5 |       99.5 |                    99.5 |    5,104 + 29 + 3 of 5,136 |
| 2000   |   regular |        512 |  99.8 | 100.0 |  99.8 |  99.8 |       99.8 |                   100.0 |    6,434 + 12 + 7 of 6,453 |
| 2001   |   regular |        512 |  99.8 | 100.0 | 100.0 | 100.0 |       99.8 |                   100.0 |    6,599 + 14 + 1 of 6,614 |
| 2002   |   regular |        512 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    6,683 + 28 + 3 of 6,714 |
| 2003   |   regular |        476 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    6,437 + 14 + 2 of 6,453 |
| 2004   |   regular |        442 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    5,380 + 18 + 2 of 5,400 |
| 2005   |   regular |        442 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    5,219 + 25 + 2 of 5,246 |
| 2006   |   regular |        476 |  99.2 |  99.4 |  99.4 |  99.6 |       99.2 |                    99.6 |    7,115 + 36 + 0 of 7,151 |
| 2007   |   regular |        442 |  99.5 |  99.5 |  99.5 |  99.5 |       99.5 |                    99.6 |    6,960 + 33 + 3 of 6,996 |
| 2008   |   regular |        476 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    7,368 + 49 + 1 of 7,418 |
| 2009   |   regular |        442 |  99.5 |  99.5 |  99.5 |  99.5 |       99.5 |                    99.6 |    7,095 + 46 + 5 of 7,146 |
| 2010   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    6,804 + 46 + 0 of 6,850 |
| 2011   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    6,406 + 49 + 0 of 6,455 |
| 2012   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    7,172 + 45 + 0 of 7,217 |
| 2013   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                    99.9 |    5,811 + 48 + 0 of 5,859 |
| 2014   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    5,673 + 62 + 0 of 5,735 |
| 2015   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    5,983 + 57 + 0 of 6,040 |
| 2016   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    6,486 + 74 + 0 of 6,560 |
| 2017   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    7,062 + 71 + 0 of 7,133 |
| 2018   |   regular |        406 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    7,826 + 96 + 0 of 7,922 |
| 2019   |   regular |        408 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    8,111 + 61 + 0 of 8,172 |
| 2020   |   regular |        264 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    5,558 + 27 + 0 of 5,585 |
| 2021   |   regular |        384 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    8,073 + 54 + 0 of 8,127 |
| 2022   |   regular |        432 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |    9,615 + 52 + 0 of 9,667 |
| 2023   |   regular |        480 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |  10,541 + 68 + 0 of 10,609 |
| 2024   |   regular |        480 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |  10,910 + 52 + 0 of 10,962 |
| 2025   |   regular |        572 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |  13,765 + 91 + 0 of 13,856 |
| 2026   |   regular |        660 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 | 16,730 + 109 + 0 of 16,839 |
| 1997   |  playoffs |          6 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                    98.0 |                            |
| 1998   |  playoffs |         16 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 1999   |  playoffs |         22 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2000   |  playoffs |         32 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2001   |  playoffs |         36 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2002   |  playoffs |         34 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2003   |  playoffs |         38 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2004   |  playoffs |         38 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2005   |  playoffs |         34 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2006   |  playoffs |         38 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2007   |  playoffs |         42 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2008   |  playoffs |         42 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2009   |  playoffs |         42 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2010   |  playoffs |         32 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2011   |  playoffs |         38 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2012   |  playoffs |         38 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2013   |  playoffs |         34 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2014   |  playoffs |         36 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2015   |  playoffs |         42 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2016   |  playoffs |         32 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2017   |  playoffs |         30 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2018   |  playoffs |         34 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2019   |  playoffs |         32 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2020   |  playoffs |         30 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2021   |  playoffs |         34 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2022   |  playoffs |         46 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2023   |  playoffs |         40 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2024   |  playoffs |         44 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2025   |  playoffs |         48 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2026   |  playoffs |         44 | 100.0 | 100.0 | 100.0 | 100.0 |      100.0 |                   100.0 |                            |
| 2021   | cup-final |          2 |   0.0 |   0.0 |   0.0 |   0.0 |        0.0 |                     0.0 |                            |
| 2022   | cup-final |          2 |   0.0 |   0.0 |   0.0 |   0.0 |        0.0 |                     5.9 |                            |
| 2023   | cup-final |          2 |   0.0 |   0.0 |   0.0 |   0.0 |        0.0 |                    15.0 |                            |
| 2024   | cup-final |          2 |   0.0 |   0.0 |   0.0 |   0.0 |        0.0 |                     0.0 |                            |
| 2025   | cup-final |          2 |   0.0 |   0.0 |   0.0 |   0.0 |        0.0 |                    15.0 |                            |
| 2026   | cup-final |          2 |   0.0 |   0.0 |   0.0 |   0.0 |        0.0 |                     5.9 |                            |

#### 4. ESPN’s shots against the box scores (regular season, not read by any metric)

ESPN’s shot file counts heaves and its own field-goal rows; it is reported here and never merged with the NBA’s.

| Season | Team-games | With ESPN shots | FGA exact % | FGM exact % |
| ------ | ---------: | --------------: | ----------: | ----------: |
| 2002   |        512 |             498 |        89.5 |        92.2 |
| 2003   |        476 |             472 |        69.5 |        84.2 |
| 2004   |        442 |             436 |        77.1 |        85.5 |
| 2005   |        442 |             442 |        78.3 |        88.2 |
| 2006   |        476 |             472 |        82.1 |        89.7 |
| 2007   |        442 |             436 |        94.3 |        95.9 |
| 2008   |        476 |             472 |        97.5 |        98.3 |
| 2009   |        442 |             436 |        97.7 |        98.0 |
| 2010   |        408 |             408 |        99.5 |        99.8 |
| 2011   |        408 |             406 |        96.1 |        99.0 |
| 2012   |        408 |             404 |        95.1 |        96.1 |
| 2013   |        408 |             406 |        81.6 |        87.0 |
| 2014   |        408 |             406 |        94.6 |        95.3 |
| 2015   |        408 |             408 |        97.3 |        98.0 |
| 2016   |        408 |             402 |        95.1 |        95.3 |
| 2017   |        408 |             408 |        94.9 |        97.8 |
| 2018   |        406 |             402 |        95.8 |        97.5 |
| 2019   |        408 |             404 |        98.0 |        98.3 |
| 2020   |        264 |             262 |        97.7 |        99.2 |
| 2021   |        384 |             384 |        98.2 |       100.0 |
| 2022   |        432 |             432 |        99.5 |       100.0 |
| 2023   |        480 |             480 |        99.2 |       100.0 |
| 2024   |        480 |             480 |        99.6 |        99.6 |
| 2025   |        572 |             572 |        99.8 |       100.0 |
| 2026   |        660 |             660 |        99.8 |       100.0 |

#### 5. League FG% by distance: shots against the dataset’s curves

The curves bin by the exact distance (floor of the coordinates’ distance in feet) over every season type; the shots here are binned the same way, all season types. The differences are in percentage points: the largest over bins of 1,000 attempts or more, and the mean weighted by attempts. The metrics’ league figure is recomputed from the regular-season shots by zone, band and type, which the curves cannot give.

| Season | Curve attempts | Shot rows | Largest diff (pts) | Mean diff (pts) |
| ------ | -------------: | --------: | -----------------: | --------------: |
| 1997   |         14,080 |     9,856 |               3.83 |            1.16 |
| 1998   |         19,151 |    14,209 |              11.35 |            3.20 |
| 1999   |         24,150 |    18,311 |              15.54 |            3.94 |
| 2000   |         31,559 |    24,321 |              16.80 |            4.00 |
| 2001   |         32,008 |    25,103 |              13.99 |            3.11 |
| 2002   |         32,004 |    23,736 |              12.23 |            3.23 |
| 2003   |         30,728 |    24,456 |              15.45 |            3.41 |
| 2004   |         28,007 |    21,748 |              16.47 |            3.86 |
| 2005   |         27,524 |    21,349 |              18.88 |            4.48 |
| 2006   |         33,009 |    25,655 |              17.45 |            4.14 |
| 2007   |         31,974 |    24,977 |              11.95 |            2.83 |
| 2008   |         33,620 |    26,482 |              15.95 |            3.68 |
| 2009   |         32,008 |    25,785 |              11.52 |            2.50 |
| 2010   |         29,238 |    23,808 |               9.78 |            2.06 |
| 2011   |         29,381 |    29,381 |               0.00 |            0.00 |
| 2012   |         29,722 |    29,722 |               0.00 |            0.00 |
| 2013   |         29,307 |    29,307 |               0.00 |            0.00 |
| 2014   |         29,467 |    29,467 |               0.00 |            0.00 |
| 2015   |         29,400 |    29,400 |               0.00 |            0.00 |
| 2016   |         29,703 |    29,703 |               0.00 |            0.00 |
| 2017   |         29,730 |    29,730 |               0.00 |            0.00 |
| 2018   |         30,324 |    30,320 |               0.08 |            0.00 |
| 2019   |         30,271 |    30,260 |               0.26 |            0.01 |
| 2020   |         20,076 |    20,076 |               0.00 |            0.00 |
| 2021   |         28,654 |    28,645 |               0.00 |            0.00 |
| 2022   |         32,513 |    32,510 |               0.01 |            0.00 |
| 2023   |         35,623 |    35,616 |               0.16 |            0.01 |
| 2024   |         35,770 |    35,763 |               0.14 |            0.01 |
| 2025   |         41,856 |    41,852 |               0.08 |            0.00 |
| 2026   |         48,230 |    48,226 |               0.07 |            0.00 |

#### 6. League FG% by zone (regular season) and unmapped types

| Season |   RA | Paint |  Mid | L corner 3 | R corner 3 | ATB 3 | Type unmapped |
| ------ | ---: | ----: | ---: | ---------: | ---------: | ----: | ------------: |
| 1997   | 53.2 |  37.5 | 35.6 |       29.8 |       32.0 |  32.4 |    51 (0.4 %) |
| 1998   | 52.2 |  37.5 | 35.0 |       31.8 |       29.3 |  31.8 |     0 (0.0 %) |
| 1999   | 53.5 |  37.3 | 36.1 |       33.8 |       30.6 |  32.2 |     3 (0.0 %) |
| 2000   | 54.4 |  37.5 | 36.9 |       32.4 |       35.3 |  32.9 |     4 (0.0 %) |
| 2001   | 48.0 |  35.0 | 34.4 |       34.9 |       34.9 |  33.2 |     0 (0.0 %) |
| 2002   | 52.3 |  37.1 | 35.4 |       36.2 |       33.5 |  33.8 |     0 (0.0 %) |
| 2003   | 53.1 |  38.2 | 35.4 |       34.5 |       32.9 |  33.5 |     0 (0.0 %) |
| 2004   | 55.2 |  36.9 | 36.4 |       35.0 |       37.4 |  34.7 |     0 (0.0 %) |
| 2005   | 57.6 |  36.6 | 36.5 |       32.0 |       37.6 |  33.6 |     0 (0.0 %) |
| 2006   | 57.1 |  36.8 | 37.0 |       32.6 |       35.7 |  33.5 |     0 (0.0 %) |
| 2007   | 54.0 |  36.8 | 36.2 |       34.9 |       35.9 |  34.8 |     0 (0.0 %) |
| 2008   | 57.5 |  38.0 | 35.6 |       34.3 |       36.4 |  33.7 |     0 (0.0 %) |
| 2009   | 57.4 |  38.8 | 36.6 |       35.8 |       36.7 |  34.0 |     0 (0.0 %) |
| 2010   | 59.2 |  38.6 | 38.4 |       35.2 |       39.3 |  34.4 |     0 (0.0 %) |
| 2011   | 60.7 |  35.4 | 36.4 |       36.7 |       38.5 |  34.7 |     0 (0.0 %) |
| 2012   | 59.5 |  33.7 | 36.0 |       39.5 |       37.8 |  34.2 |     0 (0.0 %) |
| 2013   | 58.2 |  36.3 | 35.5 |       34.7 |       36.5 |  32.1 |     0 (0.0 %) |
| 2014   | 60.0 |  36.9 | 37.0 |       37.3 |       37.9 |  32.1 |     0 (0.0 %) |
| 2015   | 57.5 |  35.6 | 37.2 |       37.3 |       28.7 |  32.6 |     0 (0.0 %) |
| 2016   | 58.3 |  40.1 | 38.4 |       36.5 |       38.4 |  33.2 |     0 (0.0 %) |
| 2017   | 59.1 |  39.2 | 38.0 |       35.4 |       37.1 |  33.7 |     8 (0.0 %) |
| 2018   | 61.9 |  41.9 | 39.1 |       40.2 |       35.2 |  34.3 |     0 (0.0 %) |
| 2019   | 59.3 |  38.1 | 36.6 |       36.4 |       36.1 |  33.5 |     0 (0.0 %) |
| 2020   | 68.3 |  41.7 | 38.1 |       37.8 |       36.9 |  34.2 |     0 (0.0 %) |
| 2021   | 60.9 |  40.0 | 36.6 |       36.0 |       37.0 |  34.1 |     0 (0.0 %) |
| 2022   | 62.7 |  39.6 | 36.8 |       38.5 |       35.6 |  34.1 |     0 (0.0 %) |
| 2023   | 62.5 |  40.0 | 36.6 |       35.6 |       39.1 |  34.3 |     0 (0.0 %) |
| 2024   | 62.8 |  39.4 | 37.2 |       35.1 |       37.4 |  33.4 |     0 (0.0 %) |
| 2025   | 62.8 |  40.6 | 38.3 |       35.7 |       37.3 |  33.3 |     0 (0.0 %) |
| 2026   | 64.3 |  41.9 | 37.9 |       35.3 |       35.9 |  33.9 |     0 (0.0 %) |

#### 7. Speed of the reads (warm, median of five, ms)

| Read                                   |  ms |
| -------------------------------------- | --: |
| A player’s chart, 2025-26              |  37 |
| A player’s chart, Dec 2025             |  30 |
| A team’s chart, 2025-26                |  30 |
| A team’s chart against, 2025-26        |  30 |
| A career chart (capped), 1996-97 on    |  32 |
| Leaderboard, ten zone metrics, 2025-26 |  54 |
| The same over a date range             |  12 |
| Team board, both sides, 2025-26        |  15 |

### Splits of each game

`scripts/check-splits.mjs … --league=wnba`.

#### Hand count: clutch in ATL at MIN, 2026-05-09

ATL 91, MIN 90, game `1022600010`. Clutch rows from `src_nba_pbp`: period 4 or later, 5:00 or less on the clock, the score before the row within 5. 43 plays (substitutions, timeouts and reviews left out of the list):

| Period |  Clock | Side | Margin before |                                                 Play |
| ------ | -----: | ---: | ------------: | ---------------------------------------------------: |
| 4      | 4:55.0 |  MIN |             5 |          Miles 2' Driving Finger Roll Layup (19 PTS) |
| 4      | 4:27.0 |  MIN |             5 |                      Miles 1' Driving Layup (21 PTS) |
| 4      | 3:52.0 |  MIN |             5 |                     Miles Bad Pass Turnover (P3.T13) |
| 4      | 3:52.0 |  ATL |             5 |                                  Reese STEAL (2 STL) |
| 4      | 3:48.0 |  ATL |             5 |                          MISS Reese 2' Running Layup |
| 4      | 3:46.0 |  MIN |             5 |                                         LYNX Rebound |
| 4      | 3:33.0 |  MIN |             5 |                   MISS Miles 16' Step Back Jump Shot |
| 4      | 3:30.0 |  ATL |             5 |                        Hillmon REBOUND (Off:2 Def:4) |
| 4      | 3:14.0 |  ATL |             5 |             Hillmon 5' Layup (12 PTS) (Howard 5 AST) |
| 4      | 2:57.0 |  MIN |             3 |                MISS McBride 24' 3PT Pullup Jump Shot |
| 4      | 2:51.0 |  ATL |             3 |                           Gray REBOUND (Off:2 Def:6) |
| 4      | 2:44.0 |  ATL |             3 |        Hillmon 3PT Jump Shot (15 PTS) (Canada 6 AST) |
| 4      | 2:25.0 |  MIN |             0 |                  Williams Bad Pass Turnover (P2.T14) |
| 4      | 2:25.0 |  ATL |             0 |                                 Howard STEAL (2 STL) |
| 4      | 2:14.0 |  ATL |             0 |                        MISS Hillmon 2' Driving Layup |
| 4      | 2:14.0 |  MIN |             0 |                                  Miles BLOCK (2 BLK) |
| 4      | 2:13.0 |  ATL |             0 |                        Hillmon REBOUND (Off:3 Def:4) |
| 4      | 2:10.0 |  ATL |             0 |                            MISS Canada 3PT Jump Shot |
| 4      | 2:08.0 |  MIN |             0 |                        Cechova REBOUND (Off:1 Def:2) |
| 4      | 1:49.0 |  MIN |             0 |              MISS Miles 2' Driving Finger Roll Layup |
| 4      | 1:49.0 |  MIN |             0 |                                         LYNX Rebound |
| 4      | 1:47.0 |  MIN |             0 | McBride 3' Cutting Layup Shot (17 PTS) (Miles 8 AST) |
| 4      | 1:24.0 |  MIN |             2 |                               Cechova S.FOUL (P6.PN) |
| 4      | 1:24.0 |  ATL |             2 |                      Gray Free Throw 1 of 2 (23 PTS) |
| 4      | 1:24.0 |  ATL |             1 |                      Gray Free Throw 2 of 2 (24 PTS) |
| 4      | 1:11.0 |  MIN |             0 |        McBride 3PT Jump Shot (20 PTS) (Coffey 1 AST) |
| 4      | 0:59.2 |  ATL |             3 |                     Canada 2' Driving Layup (12 PTS) |
| 4      | 0:53.9 |  ATL |             1 |                                Howard P.FOUL (P4.T2) |
| 4      | 0:45.5 |  MIN |             1 |                   McBride Bad Pass Turnover (P1.T15) |
| 4      | 0:45.5 |  ATL |             1 |                                 Howard STEAL (3 STL) |
| 4      | 0:30.9 |  ATL |             1 |                                 MISS Canada 8' Layup |
| 4      | 0:30.9 |  MIN |             1 |                                   Kosu BLOCK (1 BLK) |
| 4      | 0:27.3 |  ATL |             1 |                          Reese REBOUND (Off:9 Def:5) |
| 4      | 0:26.5 |  ATL |             1 |                          MISS Reese 5' Putback Layup |
| 4      | 0:22.7 |  ATL |             1 |                         Canada REBOUND (Off:1 Def:1) |
| 4      | 0:12.0 |  ATL |             1 |  Paopao 16' Pullup Jump Shot (6 PTS) (Hillmon 2 AST) |
| 4      | 0:06.6 |  MIN |            -1 |                          MISS Miles 3' Driving Layup |
| 4      | 0:06.6 |  ATL |            -1 |                                   Gray BLOCK (1 BLK) |
| 4      | 0:05.5 |  MIN |            -1 |                                         LYNX Rebound |
| 4      | 0:05.5 |  MIN |            -1 |           Jump Ball Coffey vs. Hillmon: Tip to Miles |
| 4      | 0:00.0 |  MIN |            -1 |                                    MISS Hof 4' Layup |
| 4      | 0:00.0 |  ATL |            -1 |                                  Reese BLOCK (3 BLK) |
| 4      | 0:00.0 |  MIN |            -1 |                                         LYNX Rebound |

Players, the hand count against `split_player` (one number where they agree):

| Player                 | pts | fgm | fga | fg3m | fg3a | ftm | fta | reb | ast | stl | blk | tov |  pf |       |
| ---------------------- | --: | --: | --: | ---: | ---: | --: | --: | --: | --: | --: | --: | --: | --: | ----: |
| Kayla McBride          |   5 |   2 |   3 |    1 |    2 |   0 |   0 |   0 |   0 |   0 |   0 |   1 |   0 | equal |
| Naz Hillmon            |   5 |   2 |   3 |    1 |    1 |   0 |   0 |   2 |   1 |   0 |   0 |   0 |   0 | equal |
| Olivia Miles           |   4 |   2 |   5 |    0 |    0 |   0 |   0 |   0 |   1 |   0 |   1 |   1 |   0 | equal |
| Allisha Gray           |   2 |   0 |   0 |    0 |    0 |   2 |   2 |   1 |   0 |   0 |   1 |   0 |   0 | equal |
| Jordin Canada          |   2 |   1 |   3 |    0 |    1 |   0 |   0 |   1 |   1 |   0 |   0 |   0 |   0 | equal |
| Te-Hina Paopao         |   2 |   1 |   1 |    0 |    0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 | equal |
| Anastasiia Olairi Kosu |   0 |   0 |   0 |    0 |    0 |   0 |   0 |   0 |   0 |   0 |   1 |   0 |   0 | equal |
| Angel Reese            |   0 |   0 |   2 |    0 |    0 |   0 |   0 |   1 |   0 |   1 |   1 |   0 |   0 | equal |
| Courtney Williams      |   0 |   0 |   0 |    0 |    0 |   0 |   0 |   0 |   0 |   0 |   0 |   1 |   0 | equal |
| Emese Hof              |   0 |   0 |   1 |    0 |    0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 | equal |
| Emma Cechova           |   0 |   0 |   0 |    0 |    0 |   0 |   0 |   1 |   0 |   0 |   0 |   0 |   1 | equal |
| Natasha Howard         |   0 |   0 |   0 |    0 |    0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 | equal |
| Nia Brodie             |   0 |   0 |   0 |    0 |    0 |   0 |   0 |   0 |   1 |   0 |   0 |   0 |   0 | equal |
| Rhyne Howard           |   0 |   0 |   0 |    0 |    0 |   0 |   0 |   0 |   1 |   2 |   0 |   0 |   1 | equal |

Teams, against `split_team`:

| Side | pts | fgm | fga | fta | Clutch time |
| ---- | --: | --: | --: | --: | ----------: |
| home |   9 |   4 |   9 |   0 |        4:25 |
| away |  11 |   4 |   9 |   2 |        4:25 |

Hand count: every player and team total equal.

#### Identities, per season

Player-games: the quarters and overtime added up against the game's play totals (all 14 counts), the halves against the four quarters, ahead + tied + behind and garbage + the rest against the quarters (counts and seconds). Team-games: the quarters against the play totals, the score states against the quarters (with the opponent's points), possessions against the game's.

| Season | Player-games | Plays | Halves | Score | Garbage | Team-games | Plays | Score | Possessions |
| ------ | -----------: | ----: | -----: | ----: | ------: | ---------: | ----: | ----: | ----------: |
| 1997   |        2,151 |   all |    all |   all |     all |        230 |   all |   all |         all |
| 1998   |        3,096 |   all |    all |   all |     all |        314 |   all |   all |         all |
| 1999   |        3,898 |   all |    all |   all |     all |        406 |   all |   all |         all |
| 2000   |        5,245 | 1 off |    all | 2 off |   2 off |        544 |   all |   all |         all |
| 2001   |        5,327 |   all |    all |   all |     all |        548 |   all |   all |         all |
| 2002   |        5,261 |   all |    all |   all |     all |        546 |   all |   all |         all |
| 2003   |        5,012 |   all |    all |   all |     all |        514 |   all |   all |         all |
| 2004   |        4,644 |   all |    all |   all |     all |        480 |   all |   all |         all |
| 2005   |        4,602 |   all |    all |   all |     all |        476 |   all |   all |         all |
| 2006   |        5,106 |   all |    all |   all |     all |        512 |   all |   all |         all |
| 2007   |        4,791 |   all |    all |   all |     all |        482 |   all |   all |         all |
| 2008   |        5,294 |   all |    all |   all |     all |        518 |   all |   all |         all |
| 2009   |        4,700 |   all |    all |   all |     all |        482 |   all |   all |         all |
| 2010   |        4,212 |   all |    all |   all |     all |        440 |   all |   all |         all |
| 2011   |        4,314 |   all |    all |   all |     all |        446 |   all |   all |         all |
| 2012   |        4,271 |   all |    all |   all |     all |        446 |   all |   all |         all |
| 2013   |        4,195 |   all |    all |   all |     all |        442 |   all |   all |         all |
| 2014   |        4,400 |   all |    all |   all |     all |        444 |   all |   all |         all |
| 2015   |        4,458 |   all |    all |   all |     all |        450 |   all |   all |         all |
| 2016   |        4,404 |   all |    all |   all |     all |        440 |   all |   all |         all |
| 2017   |        4,397 |   all |    all |   all |     all |        438 |   all |   all |         all |
| 2018   |        4,415 |   all |    all |   all |     all |        440 |   all |   all |         all |
| 2019   |        4,286 |   all |    all |   all |     all |        440 |   all |   all |         all |
| 2020   |        2,796 |   all |    all |   all |     all |        294 |   all |   all |         all |
| 2021   |        3,885 |   all |    all |   all |     all |        418 |   all |   all |         all |
| 2022   |        4,519 |   all |    all |   all |     all |        478 |   all |   all |         all |
| 2023   |        4,897 |   all |    all |   all |     all |        520 |   all |   all |         all |
| 2024   |        4,913 |   all |    all |   all |     all |        524 |   all |   all |         all |
| 2025   |        5,852 |   all |    all |   all |     all |        620 |   all |   all |         all |
| 2026   |        7,007 |   all |    all |   all |     all |        704 |   all |   all |         all |

#### Against the box scores, per season

Player-games of the counted types with the NBA's box score: the quarters added up against the box-score line (exact: all 14 counts; within 1: none off by more), and players' time from the substitutions against box-score minutes. Team-games: points by quarter and overtime against ESPN's line scores, where those add up to the final score.

| Season | Player-games |   Exact | Within 1 | Time ≤ 1 s | Time ≤ 60 s | Box in whole minutes | Line scores |   Equal |
| ------ | -----------: | ------: | -------: | ---------: | ----------: | -------------------: | ----------: | ------: |
| 1997   |        2,144 |  97.2 % |   97.9 % |      5.1 % |      96.7 % |              100.0 % |           – |       – |
| 1998   |        3,072 |  98.3 % |   99.1 % |      4.5 % |      98.9 % |              100.0 % |           4 |   0.0 % |
| 1999   |        3,910 |  98.1 % |   99.2 % |      5.4 % |      98.4 % |              100.0 % |           6 |   0.0 % |
| 2000   |        5,246 |  99.5 % |   99.9 % |      5.7 % |      99.8 % |              100.0 % |           2 |   0.0 % |
| 2001   |        5,328 |  99.5 % |  100.0 % |      5.8 % |      99.2 % |              100.0 % |           4 |   0.0 % |
| 2002   |        5,261 |  99.6 % |  100.0 % |      6.3 % |      99.5 % |              100.0 % |          10 |   0.0 % |
| 2003   |        5,013 |  99.8 % |  100.0 % |      5.3 % |      99.8 % |              100.0 % |           6 |   0.0 % |
| 2004   |        4,644 |  99.5 % |  100.0 % |      4.4 % |      98.9 % |              100.0 % |           4 |   0.0 % |
| 2005   |        4,603 |  99.7 % |  100.0 % |      5.5 % |      99.0 % |              100.0 % |           8 |   0.0 % |
| 2006   |        5,106 |  99.6 % |  100.0 % |      4.2 % |      93.4 % |              100.0 % |         510 |  97.3 % |
| 2007   |        4,791 |  99.5 % |   99.9 % |      5.6 % |      99.1 % |              100.0 % |         480 |  99.0 % |
| 2008   |        5,293 |  99.3 % |   99.8 % |      4.7 % |      99.3 % |              100.0 % |         518 |  99.2 % |
| 2009   |        4,700 |  99.2 % |   99.7 % |      4.7 % |      99.2 % |              100.0 % |         482 |  98.8 % |
| 2010   |        4,213 |  99.2 % |   99.6 % |      4.8 % |      99.0 % |              100.0 % |         440 |  99.8 % |
| 2011   |        4,314 |  98.6 % |   99.5 % |      5.3 % |      98.3 % |              100.0 % |         446 |  99.8 % |
| 2012   |        4,271 |  98.6 % |   99.3 % |      4.5 % |      98.4 % |              100.0 % |         446 |  99.8 % |
| 2013   |        4,192 |  99.2 % |   99.6 % |      4.7 % |      99.1 % |              100.0 % |         442 | 100.0 % |
| 2014   |        4,401 |  99.3 % |   99.7 % |      4.9 % |      98.7 % |              100.0 % |         444 |  99.3 % |
| 2015   |        4,459 |  99.1 % |   99.6 % |      4.6 % |      97.3 % |              100.0 % |         450 | 100.0 % |
| 2016   |        4,405 |  99.2 % |   99.6 % |      4.6 % |      97.5 % |              100.0 % |         438 |  99.8 % |
| 2017   |        4,397 |  99.2 % |   99.7 % |      4.6 % |      98.4 % |              100.0 % |         438 |  99.3 % |
| 2018   |        4,419 |  99.0 % |   99.6 % |      5.1 % |      96.7 % |              100.0 % |         440 |  99.8 % |
| 2019   |        4,288 |  99.3 % |   99.8 % |      4.4 % |      96.4 % |              100.0 % |         440 | 100.0 % |
| 2020   |        2,796 |  99.9 % |  100.0 % |      4.9 % |      98.5 % |              100.0 % |         294 | 100.0 % |
| 2021   |        3,885 | 100.0 % |  100.0 % |      4.6 % |      99.0 % |              100.0 % |         418 | 100.0 % |
| 2022   |        4,519 |  99.9 % |  100.0 % |      4.9 % |      98.3 % |              100.0 % |         478 | 100.0 % |
| 2023   |        4,898 |  99.9 % |  100.0 % |      5.2 % |      98.3 % |              100.0 % |         520 | 100.0 % |
| 2024   |        4,914 |  99.9 % |  100.0 % |      5.2 % |     100.0 % |              100.0 % |         524 | 100.0 % |
| 2025   |        5,853 |  99.9 % |  100.0 % |      4.6 % |     100.0 % |              100.0 % |         620 | 100.0 % |
| 2026   |        7,008 | 100.0 % |  100.0 % |     99.3 % |      99.4 % |                2.0 % |         704 | 100.0 % |

#### Garbage time against the possessions' mark, per season

Counted possessions, each by its first play: the rule here (the 4th quarter, a margin of 25+ with over 9:00 left, 20+ from 9:00 to 6:01, 10+ at 6:00 or less) against SportsDataverse's `is_garbage_time`.

| Season | Possessions | Theirs |  Ours |  Both |  Agree |
| ------ | ----------: | -----: | ----: | ----: | -----: |
| 1997   |      17,201 |    260 |     0 |     0 | 98.5 % |
| 1998   |      23,287 |    694 |     0 |     0 | 97.0 % |
| 1999   |      28,810 |    627 |     1 |     0 | 97.8 % |
| 2000   |      38,046 |    933 |     0 |     0 | 97.5 % |
| 2001   |      37,665 |    472 |     0 |     0 | 98.7 % |
| 2002   |      37,894 |    641 |     0 |     0 | 98.3 % |
| 2003   |      35,775 |    579 |     0 |     0 | 98.4 % |
| 2004   |      33,192 |    388 |     0 |     0 | 98.8 % |
| 2005   |      32,932 |    363 |     5 |     0 | 98.9 % |
| 2006   |      38,988 |  1,252 | 3,550 | 1,248 | 94.1 % |
| 2007   |      37,815 |    650 | 2,658 |   644 | 94.7 % |
| 2008   |      40,092 |    641 | 2,773 |   609 | 94.5 % |
| 2009   |      37,794 |    620 | 2,632 |   619 | 94.7 % |
| 2010   |      34,616 |    822 | 2,588 |   814 | 94.9 % |
| 2011   |      34,312 |    590 | 2,548 |   589 | 94.3 % |
| 2012   |      34,347 |    690 | 3,200 |   689 | 92.7 % |
| 2013   |      33,748 |    898 | 2,963 |   895 | 93.9 % |
| 2014   |      34,021 |    717 | 2,342 |   712 | 95.2 % |
| 2015   |      33,861 |    806 | 2,293 |   804 | 95.6 % |
| 2016   |      34,463 |    747 | 2,649 |   746 | 94.5 % |
| 2017   |      34,292 |  1,002 | 2,814 |   997 | 94.7 % |
| 2018   |      34,563 |    924 | 2,984 |   918 | 94.0 % |
| 2019   |      34,450 |  1,147 | 2,797 | 1,125 | 95.1 % |
| 2020   |      23,441 |    580 | 2,057 |   578 | 93.7 % |
| 2021   |      33,023 |    858 | 2,639 |   850 | 94.6 % |
| 2022   |      37,931 |  1,115 | 3,242 | 1,112 | 94.4 % |
| 2023   |      41,280 |    964 | 3,670 |   963 | 93.4 % |
| 2024   |      41,348 |    660 | 3,013 |   660 | 94.3 % |
| 2025   |      48,324 |  1,356 | 4,109 | 1,348 | 94.3 % |
| 2026   |      56,032 |  1,425 | 4,846 | 1,424 | 93.9 % |

#### Speed

Through the worker on the full load, warm, 2025-26 unless said: the median of seven runs and the slowest.

| Query                                     |  Rows | Median ms | Slowest ms |
| ----------------------------------------- | ----: | --------: | ---------: |
| A leaderboard, 16 columns, the whole game |   238 |       127 |        136 |
| The same, clutch                          |   196 |        81 |         87 |
| The same, 4th quarter                     |   238 |        88 |         92 |
| Clutch, January only                      |     0 |        28 |         33 |
| Clutch, by season, every season           | 4,273 |       112 |        125 |
| A team board, clutch                      |    15 |        34 |         38 |
| A player's 19 play splits at once         |    19 |       153 |        161 |
| A team's 19 play splits at once           |    19 |        88 |         92 |

### On court

`scripts/check-on-off.mjs … --league=wnba`.

##### Team-games: units summed against the box score

Share of regular-season team-games (%) whose count summed over the units equals the team box score; "All" is every count at once. "Poss" is the possessions credited to units against the possessions file's count; the last two are the possessions file's own points against the box score.

| Season | Team-games | PTS   | FGA   | FGM   | 3PA   | FTA   | OREB  | DREB  | AST   | STL   | BLK   | TOV   | PF    | All  | Poss  | File PTS exact | File PTS ±5 |
| ------ | ---------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- | ----- | -------------- | ----------- |
| 1997   | 224        | 96.9  | 99.1  | 99.1  | 99.1  | 99.1  | 99.1  | 99.1  | 91.5  | 99.1  | 98.7  | 71.9  | 95.1  | 63.8 | 100.0 | 96.9           | 99.1        |
| 1998   | 298        | 99.0  | 99.7  | 99.7  | 100.0 | 100.0 | 100.0 | 100.0 | 93.6  | 99.3  | 100.0 | 100.0 | 93.6  | 88.3 | 100.0 | 99.3           | 100.0       |
| 1999   | 384        | 99.5  | 99.2  | 99.5  | 99.5  | 99.5  | 99.5  | 99.5  | 97.4  | 99.5  | 99.5  | 99.5  | 88.8  | 86.5 | 100.0 | 99.5           | 99.5        |
| 2000   | 512        | 99.4  | 99.8  | 100.0 | 99.8  | 100.0 | 100.0 | 99.8  | 100.0 | 100.0 | 100.0 | 65.4  | 95.5  | 62.3 | 100.0 | 99.4           | 99.6        |
| 2001   | 512        | 100.0 | 99.8  | 100.0 | 100.0 | 100.0 | 100.0 | 99.8  | 97.5  | 100.0 | 100.0 | 100.0 | 97.9  | 94.9 | 100.0 | 100.0          | 100.0       |
| 2002   | 512        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.2  | 100.0 | 100.0 | 100.0 | 97.1  | 96.3 | 100.0 | 100.0          | 100.0       |
| 2003   | 476        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 65.3  | 98.5  | 64.7 | 100.0 | 100.0          | 100.0       |
| 2004   | 442        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.5  | 98.9  | 100.0 | 100.0 | 100.0 | 62.4  | 95.9  | 59.5 | 100.0 | 100.0          | 100.0       |
| 2005   | 442        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 67.4  | 97.1  | 65.6 | 100.0 | 100.0          | 100.0       |
| 2006   | 474        | 99.8  | 99.6  | 99.8  | 99.8  | 100.0 | 99.8  | 100.0 | 99.8  | 100.0 | 100.0 | 42.0  | 96.6  | 40.7 | 100.0 | 99.8           | 100.0       |
| 2007   | 440        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 96.1  | 100.0 | 100.0 | 50.0  | 99.1  | 48.2 | 100.0 | 100.0          | 100.0       |
| 2008   | 476        | 99.8  | 100.0 | 100.0 | 100.0 | 100.0 | 99.8  | 99.8  | 96.4  | 100.0 | 100.0 | 42.6  | 96.6  | 39.7 | 100.0 | 100.0          | 100.0       |
| 2009   | 440        | 99.8  | 100.0 | 100.0 | 100.0 | 99.8  | 100.0 | 100.0 | 95.5  | 100.0 | 100.0 | 42.3  | 97.5  | 40.7 | 100.0 | 100.0          | 100.0       |
| 2010   | 408        | 99.8  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 94.1  | 99.8  | 100.0 | 48.0  | 99.5  | 46.8 | 100.0 | 100.0          | 100.0       |
| 2011   | 408        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 92.2  | 100.0 | 100.0 | 42.6  | 98.3  | 39.0 | 100.0 | 100.0          | 100.0       |
| 2012   | 408        | 99.8  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 92.2  | 100.0 | 100.0 | 41.9  | 99.5  | 39.2 | 100.0 | 100.0          | 100.0       |
| 2013   | 408        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 93.6  | 100.0 | 100.0 | 46.3  | 99.0  | 43.1 | 100.0 | 100.0          | 100.0       |
| 2014   | 408        | 99.3  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 93.4  | 100.0 | 100.0 | 41.9  | 99.3  | 39.5 | 100.0 | 100.0          | 100.0       |
| 2015   | 408        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 90.4  | 100.0 | 100.0 | 46.8  | 99.3  | 43.9 | 100.0 | 100.0          | 100.0       |
| 2016   | 408        | 99.8  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 92.4  | 100.0 | 100.0 | 41.7  | 99.0  | 37.7 | 100.0 | 100.0          | 100.0       |
| 2017   | 408        | 99.3  | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 93.9  | 100.0 | 100.0 | 40.7  | 99.5  | 37.5 | 100.0 | 100.0          | 100.0       |
| 2018   | 406        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 90.4  | 100.0 | 100.0 | 47.3  | 98.8  | 43.6 | 100.0 | 100.0          | 100.0       |
| 2019   | 408        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 93.9  | 100.0 | 100.0 | 38.2  | 99.8  | 34.8 | 100.0 | 100.0          | 100.0       |
| 2020   | 264        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 45.8  | 98.5  | 45.1 | 100.0 | 100.0          | 100.0       |
| 2021   | 384        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 46.4  | 100.0 | 46.4 | 100.0 | 100.0          | 100.0       |
| 2022   | 432        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.5  | 100.0 | 100.0 | 40.0  | 99.8  | 39.6 | 100.0 | 100.0          | 100.0       |
| 2023   | 480        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.4  | 100.0 | 100.0 | 38.5  | 99.6  | 38.3 | 100.0 | 100.0          | 100.0       |
| 2024   | 480        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.8  | 100.0 | 100.0 | 34.6  | 99.6  | 34.4 | 100.0 | 100.0          | 100.0       |
| 2025   | 572        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 35.1  | 99.5  | 34.8 | 100.0 | 100.0          | 100.0       |
| 2026   | 660        | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 46.7  | 99.8  | 46.7 | 100.0 | 100.0          | 100.0       |

##### Player-games: on court against the box score

Share of regular-season player-games (%) with the lineups' minutes within 30 seconds and a minute of the box score's, the on-court plus-minus equal to the box score's or within 2, and the player's own points from the plays equal to the box score's. "Off the lineups" counts box-score players with minutes the lineups never put on the floor.

| Season | Player-games | MIN ±0.5 | MIN ±1 | +/- exact | +/- ±2 | Own PTS | Off the lineups |
| ------ | ------------ | -------- | ------ | --------- | ------ | ------- | --------------- |
| 2008   | 4878         | 98.2     | 98.5   | 94.6      | 98.1   | 100.0   | 1               |
| 2009   | 4320         | 98.4     | 98.6   | 96.3      | 99.3   | 100.0   | 0               |
| 2010   | 3919         | 98.0     | 98.7   | 96.7      | 99.1   | 100.0   | 0               |
| 2011   | 3964         | 97.2     | 97.7   | 95.7      | 98.6   | 100.0   | 0               |
| 2012   | 3930         | 96.8     | 97.5   | 95.9      | 98.5   | 100.0   | 0               |
| 2013   | 3875         | 98.0     | 98.5   | 96.5      | 99.0   | 99.9    | 0               |
| 2014   | 4052         | 97.9     | 98.3   | 96.1      | 98.5   | 99.9    | 0               |
| 2015   | 4055         | 94.9     | 95.9   | 93.7      | 97.8   | 100.0   | 2               |
| 2016   | 4099         | 98.1     | 98.6   | 96.2      | 99.3   | 100.0   | 0               |
| 2017   | 4108         | 98.1     | 98.5   | 95.5      | 98.9   | 99.9    | 0               |
| 2018   | 4110         | 97.1     | 97.7   | 94.9      | 98.0   | 100.0   | 0               |
| 2019   | 3970         | 98.7     | 99.1   | 97.5      | 99.4   | 100.0   | 0               |
| 2020   | 2521         | 99.5     | 99.7   | 97.7      | 99.7   | 100.0   | 0               |
| 2021   | 3565         | 99.7     | 99.8   | 98.3      | 99.6   | 100.0   | 0               |
| 2022   | 4096         | 99.3     | 99.6   | 97.6      | 99.6   | 100.0   | 0               |
| 2023   | 4543         | 99.1     | 99.3   | 97.8      | 99.4   | 100.0   | 0               |
| 2024   | 4514         | 99.9     | 99.9   | 96.0      | 98.1   | 100.0   | 1               |
| 2025   | 5407         | 100.0    | 100.0  | 98.8      | 99.8   | 100.0   | 0               |
| 2026   | 6587         | 100.0    | 100.0  | 98.7      | 100.0  | 100.0   | 0               |

##### On plus off

On plus off equals the team's line in the game, for every count and the seconds, on 136342 of 136342 player-games (all seasons and types).

##### Five-man units against the published lineups

Units the NBA's base file lists (its 2,000 a regular season with the most minutes, and its playoff units), joined on team, season, season type and the five ids. "Found" is the share Metis's count has at all; the rest are shares of those found (%): minutes within a minute and within 10 % (plus a minute), points and field goals made exact or within 2, plus-minus exact or within 2, and possessions within 2 and within 5 % (plus one) of the advanced file's. "POSS ratio" is Metis's possessions over the NBA's, summed over the units found.

| Season | Type     | Units | Found | MIN ±1 | MIN ±10% | PTS   | PTS ±2 | FGM   | +/-   | +/- ±2 | POSS ±2 | POSS ±5% | POSS ratio |
| ------ | -------- | ----- | ----- | ------ | -------- | ----- | ------ | ----- | ----- | ------ | ------- | -------- | ---------- |
| 1997   | regular  | 943   | 98.8  | 94.7   | 96.2     | 92.2  | 96.0   | 94.1  | 90.8  | 96.7   | 83.9    | 81.1     | 0.916      |
| 1998   | regular  | 1524  | 97.3  | 96.6   | 96.8     | 95.8  | 97.6   | 97.1  | 94.9  | 97.6   | 88.5    | 86.2     | 0.905      |
| 1999   | regular  | 1645  | 99.6  | 97.0   | 98.8     | 96.0  | 98.5   | 97.2  | 94.4  | 98.7   | 87.4    | 84.0     | 0.936      |
| 2000   | regular  | 2000  | 100.0 | 100.0  | 100.0    | 98.8  | 100.0  | 99.8  | 97.9  | 99.9   | 86.7    | 83.9     | 0.938      |
| 2001   | regular  | 2000  | 100.0 | 96.9   | 97.8     | 96.2  | 97.8   | 97.5  | 95.1  | 98.4   | 85.3    | 82.3     | 0.935      |
| 2002   | regular  | 2000  | 100.0 | 99.5   | 99.7     | 98.3  | 99.6   | 99.2  | 98.0  | 99.8   | 87.8    | 84.5     | 0.939      |
| 2003   | regular  | 2000  | 100.0 | 99.9   | 99.9     | 99.5  | 100.0  | 99.9  | 99.1  | 100.0  | 89.3    | 86.7     | 0.937      |
| 2004   | regular  | 2000  | 100.0 | 100.0  | 100.0    | 99.4  | 100.0  | 99.8  | 99.0  | 100.0  | 89.9    | 87.2     | 0.937      |
| 2005   | regular  | 2000  | 100.0 | 100.0  | 100.0    | 99.0  | 100.0  | 99.6  | 98.5  | 99.9   | 88.7    | 85.7     | 0.932      |
| 2006   | regular  | 2000  | 100.0 | 99.6   | 100.0    | 99.0  | 100.0  | 99.9  | 98.0  | 100.0  | 87.3    | 84.2     | 0.940      |
| 2007   | regular  | 2000  | 99.5  | 93.4   | 96.6     | 92.5  | 95.3   | 93.8  | 91.1  | 96.2   | 85.9    | 81.6     | 0.945      |
| 2008   | regular  | 2000  | 99.9  | 97.0   | 98.3     | 96.1  | 97.5   | 96.9  | 95.2  | 98.2   | 85.0    | 80.6     | 0.935      |
| 2009   | regular  | 2000  | 99.8  | 96.9   | 98.4     | 96.1  | 97.8   | 97.0  | 95.1  | 98.0   | 86.5    | 84.0     | 0.932      |
| 2010   | regular  | 1956  | 99.6  | 98.2   | 99.1     | 97.1  | 98.3   | 98.0  | 97.0  | 98.9   | 88.3    | 87.0     | 0.938      |
| 2011   | regular  | 1803  | 99.6  | 97.3   | 98.1     | 96.5  | 97.7   | 97.5  | 95.8  | 98.4   | 86.7    | 84.5     | 0.934      |
| 2012   | regular  | 2000  | 99.8  | 96.8   | 98.2     | 95.9  | 97.9   | 96.5  | 95.3  | 98.0   | 86.9    | 83.8     | 0.934      |
| 2013   | regular  | 1912  | 99.3  | 97.7   | 98.8     | 97.2  | 98.3   | 97.7  | 95.5  | 98.2   | 88.0    | 84.6     | 0.934      |
| 2014   | regular  | 2000  | 99.7  | 97.3   | 98.5     | 96.7  | 98.0   | 97.4  | 95.6  | 98.4   | 87.5    | 84.8     | 0.933      |
| 2015   | regular  | 2000  | 99.8  | 93.9   | 96.1     | 92.1  | 95.3   | 93.3  | 92.3  | 96.6   | 86.8    | 81.5     | 0.933      |
| 2016   | regular  | 2000  | 99.8  | 97.3   | 98.8     | 96.0  | 97.8   | 96.7  | 95.0  | 98.0   | 89.2    | 87.1     | 0.941      |
| 2017   | regular  | 2000  | 99.8  | 97.4   | 98.7     | 96.4  | 98.7   | 97.3  | 95.6  | 98.8   | 89.8    | 86.5     | 0.941      |
| 2018   | regular  | 2000  | 99.6  | 96.2   | 98.3     | 94.8  | 97.0   | 95.7  | 93.5  | 97.6   | 87.9    | 85.1     | 0.937      |
| 2019   | regular  | 1946  | 99.9  | 96.9   | 98.5     | 96.8  | 98.3   | 97.7  | 95.4  | 98.2   | 88.7    | 84.3     | 0.939      |
| 2020   | regular  | 1611  | 99.9  | 99.3   | 99.8     | 98.7  | 99.6   | 99.3  | 97.9  | 99.6   | 92.6    | 90.1     | 0.942      |
| 2021   | regular  | 1968  | 99.8  | 98.6   | 98.9     | 98.1  | 98.8   | 98.6  | 97.8  | 99.1   | 90.5    | 87.6     | 0.949      |
| 2022   | regular  | 2000  | 100.0 | 99.0   | 99.7     | 98.2  | 99.1   | 99.1  | 97.4  | 99.4   | 88.5    | 86.3     | 0.940      |
| 2023   | regular  | 2000  | 99.9  | 98.4   | 99.5     | 97.0  | 98.5   | 98.2  | 96.3  | 98.6   | 87.2    | 85.6     | 0.940      |
| 2024   | regular  | 2000  | 99.9  | 99.6   | 99.8     | 99.4  | 99.8   | 99.7  | 98.9  | 99.9   | 88.3    | 87.0     | 0.943      |
| 2025   | regular  | 2000  | 100.0 | 100.0  | 100.0    | 99.5  | 100.0  | 99.9  | 99.2  | 100.0  | 84.3    | 80.6     | 0.937      |
| 2026   | regular  | 2000  | 100.0 | 100.0  | 100.0    | 99.4  | 99.9   | 99.9  | 98.7  | 99.9   | 84.3    | 80.0     | 0.941      |
| 2001   | playoffs | 174   | 100.0 | 100.0  | 100.0    | 97.7  | 100.0  | 98.9  | 97.7  | 100.0  | 90.2    | 90.2     | 0.938      |
| 2002   | playoffs | 199   | 100.0 | 100.0  | 100.0    | 100.0 | 100.0  | 100.0 | 99.0  | 100.0  | 88.9    | 88.9     | 0.934      |
| 2003   | playoffs | 262   | 100.0 | 100.0  | 100.0    | 98.9  | 100.0  | 100.0 | 98.5  | 100.0  | 95.4    | 95.0     | 0.944      |
| 2004   | playoffs | 263   | 100.0 | 100.0  | 100.0    | 100.0 | 100.0  | 100.0 | 100.0 | 100.0  | 93.9    | 90.5     | 0.930      |
| 2005   | playoffs | 241   | 100.0 | 100.0  | 100.0    | 99.2  | 100.0  | 100.0 | 98.3  | 100.0  | 94.6    | 90.5     | 0.930      |
| 2006   | playoffs | 312   | 100.0 | 99.4   | 99.7     | 98.7  | 99.4   | 99.4  | 98.1  | 99.4   | 95.8    | 92.0     | 0.930      |
| 2007   | playoffs | 284   | 97.9  | 94.6   | 96.8     | 95.0  | 96.0   | 96.0  | 93.2  | 96.4   | 87.4    | 85.3     | 0.928      |
| 2008   | playoffs | 377   | 100.0 | 99.5   | 99.7     | 99.5  | 99.5   | 99.5  | 98.9  | 100.0  | 95.2    | 91.8     | 0.932      |
| 2009   | playoffs | 262   | 100.0 | 99.2   | 99.6     | 96.6  | 99.6   | 98.5  | 95.8  | 98.9   | 92.4    | 92.4     | 0.941      |
| 2010   | playoffs | 238   | 99.6  | 97.5   | 99.2     | 95.4  | 96.6   | 96.2  | 94.1  | 97.5   | 94.1    | 91.1     | 0.940      |
| 2011   | playoffs | 275   | 100.0 | 99.3   | 99.3     | 98.9  | 100.0  | 99.6  | 97.8  | 100.0  | 94.5    | 92.0     | 0.938      |
| 2012   | playoffs | 238   | 99.6  | 97.0   | 97.5     | 96.6  | 97.9   | 97.0  | 96.2  | 97.9   | 90.3    | 87.8     | 0.939      |
| 2013   | playoffs | 238   | 100.0 | 100.0  | 100.0    | 100.0 | 100.0  | 100.0 | 99.2  | 100.0  | 95.8    | 94.5     | 0.944      |
| 2014   | playoffs | 273   | 99.6  | 98.2   | 99.6     | 98.5  | 98.5   | 98.5  | 96.0  | 99.3   | 94.9    | 92.3     | 0.937      |
| 2015   | playoffs | 301   | 98.3  | 99.7   | 99.7     | 98.3  | 99.3   | 99.3  | 95.3  | 99.0   | 94.6    | 91.9     | 0.936      |
| 2016   | playoffs | 249   | 99.2  | 96.8   | 97.2     | 95.5  | 97.2   | 96.4  | 94.3  | 98.0   | 91.9    | 90.3     | 0.935      |
| 2017   | playoffs | 201   | 100.0 | 99.0   | 100.0    | 98.0  | 99.0   | 99.0  | 97.0  | 100.0  | 94.0    | 90.0     | 0.940      |
| 2018   | playoffs | 215   | 99.5  | 99.5   | 99.5     | 99.5  | 100.0  | 99.5  | 99.5  | 100.0  | 93.5    | 91.6     | 0.941      |
| 2019   | playoffs | 213   | 99.1  | 92.4   | 94.3     | 92.4  | 92.4   | 92.4  | 92.4  | 93.8   | 86.7    | 85.8     | 0.989      |
| 2020   | playoffs | 220   | 100.0 | 93.2   | 95.0     | 92.7  | 94.5   | 93.2  | 92.3  | 95.9   | 95.5    | 91.8     | 1.009      |
| 2021   | playoffs | 191   | 100.0 | 95.3   | 96.3     | 95.8  | 96.9   | 96.3  | 94.8  | 96.3   | 90.6    | 88.0     | 0.970      |
| 2022   | playoffs | 221   | 100.0 | 100.0  | 100.0    | 99.1  | 100.0  | 100.0 | 98.2  | 100.0  | 90.0    | 87.8     | 0.935      |
| 2023   | playoffs | 191   | 100.0 | 100.0  | 100.0    | 99.5  | 100.0  | 99.5  | 99.0  | 100.0  | 89.5    | 90.6     | 0.948      |
| 2024   | playoffs | 230   | 100.0 | 100.0  | 100.0    | 100.0 | 100.0  | 100.0 | 100.0 | 100.0  | 92.6    | 93.5     | 0.949      |
| 2025   | playoffs | 253   | 100.0 | 100.0  | 100.0    | 100.0 | 100.0  | 100.0 | 100.0 | 100.0  | 89.3    | 87.4     | 0.936      |
| 2026   | playoffs | 300   | 100.0 | 100.0  | 100.0    | 99.3  | 99.3   | 99.3  | 98.7  | 99.3   | 94.3    | 92.3     | 0.938      |

##### The ten largest minute misses

Units found in both, by the gap in minutes.

| Season | Type     | Team | Unit                                                                        | NBA MIN | Metis MIN | NBA PTS | Metis PTS | NBA +/- | Metis +/- |
| ------ | -------- | ---- | --------------------------------------------------------------------------- | ------- | --------- | ------- | --------- | ------- | --------- |
| 1997   | regular  | CHA  | V. Bullett - A. Stinson - S. Manning - P. McCray, Nikki ( - N. Levesque     | 116.3   | 51.7      | 188     | 91        | 14      | 12        |
| 1998   | regular  | WAS  | P. McCray, Nikki ( - H. Burge - N. McCray - M. Page - R. Williams           | 110     | 54.5      | 167     | 81        | -47     | -24       |
| 1997   | regular  | CHA  | V. Bullett - A. Stinson - R. Mapp - T. Suber - P. McCray, Nikki (           | 99.6    | 45        | 173     | 83        | -16     | -15       |
| 1998   | regular  | WAS  | P. McCray, Nikki ( - N. McCray - M. Page - A. Santos de Olive - R. Williams | 100.2   | 53.6      | 165     | 89        | -41     | -25       |
| 1998   | regular  | WAS  | P. McCray, Nikki ( - N. McCray - M. Page - A. Santos de Olive - A. Shuler   | 88.4    | 42.5      | 151     | 81        | -14     | -1        |
| 1998   | regular  | WAS  | P. McCray, Nikki ( - H. Burge - N. McCray - M. Page - A. Shuler             | 38.8    | 6.8       | 62      | 11        | -17     | -6        |
| 2021   | regular  | ATL  | T. Hayes - E. Williams - C. Williams - M. Billings - A. McDonald            | 38.5    | 70.1      | 71      | 124       | -4      | -13       |
| 2009   | regular  | SEA  | L. Jackson - S. Bird - S. Cash - T. Wright - C. Little                      | 390.1   | 361       | 785     | 728       | 111     | 108       |
| 2019   | playoffs | SEA  | A. Clark - N. Howard - J. Loyd - J. Canada - M. Russell                     | 17.4    | 42.9      | 42      | 93        | 7       | 7         |
| 2009   | regular  | SEA  | J. Burse - L. Jackson - S. Bird - S. Cash - T. Wright                       | 77.5    | 99.2      | 162     | 198       | 29      | 26        |

### The Lineups tab against the raw lineup files

`scripts/check-lineups.mjs … --league=wnba`.

Written by `scripts/check-lineups.mjs`. Stored values must equal the raw file exactly; percentages worked out on read may differ from the published ones by half a printed digit (0.0005).

| Season  | Units | Raw rows | Not returned | Extra | Values  | Match    | Percentages | Match    | Games and minutes |
| ------- | ----- | -------- | ------------ | ----- | ------- | -------- | ----------- | -------- | ----------------- |
| 2008    | 2585  | 14262    | 0            | 0     | 211553  | 100.00 % | 13642       | 100.00 % | 100.00 %          |
| 2009    | 2289  | 13572    | 0            | 0     | 201318  | 100.00 % | 12696       | 100.00 % | 100.00 %          |
| 2010    | 2194  | 13164    | 0            | 0     | 195266  | 100.00 % | 11707       | 100.00 % | 100.00 %          |
| 2011    | 2078  | 12468    | 0            | 0     | 184942  | 100.00 % | 11234       | 100.00 % | 100.00 %          |
| 2012    | 2247  | 13428    | 0            | 0     | 199182  | 100.00 % | 12261       | 100.00 % | 100.00 %          |
| 2013    | 2150  | 12900    | 0            | 0     | 191350  | 100.00 % | 11478       | 100.00 % | 100.00 %          |
| 2014    | 2279  | 13638    | 0            | 0     | 202297  | 100.00 % | 11800       | 100.00 % | 100.00 %          |
| 2015    | 2482  | 13806    | 0            | 0     | 204789  | 100.00 % | 13025       | 100.00 % | 100.00 %          |
| 2016    | 2289  | 13494    | 0            | 0     | 200161  | 100.00 % | 12471       | 100.00 % | 100.00 %          |
| 2017    | 2231  | 13206    | 0            | 0     | 195889  | 100.00 % | 12253       | 100.00 % | 100.00 %          |
| 2018    | 2257  | 13290    | 0            | 0     | 197135  | 100.00 % | 12343       | 100.00 % | 100.00 %          |
| 2019    | 2159  | 12954    | 0            | 0     | 192151  | 100.00 % | 11775       | 100.00 % | 100.00 %          |
| 2020    | 1831  | 10986    | 0            | 0     | 162959  | 100.00 % | 9925        | 100.00 % | 100.00 %          |
| 2021    | 2159  | 12954    | 0            | 0     | 192151  | 100.00 % | 11921       | 100.00 % | 100.00 %          |
| 2022    | 2276  | 13326    | 0            | 0     | 197669  | 100.00 % | 12852       | 100.00 % | 100.00 %          |
| 2023    | 2242  | 13146    | 0            | 0     | 194999  | 100.00 % | 12652       | 100.00 % | 100.00 %          |
| 2024    | 2244  | 13380    | 0            | 0     | 198470  | 100.00 % | 12811       | 100.00 % | 100.00 %          |
| 2025    | 2581  | 13518    | 0            | 0     | 200517  | 100.00 % | 14062       | 100.00 % | 100.00 %          |
| 2026    | 2808  | 13045    | 0            | 755   | 193514  | 100.00 % | 13869       | 100.00 % | 94.23 %           |
| **All** | 43381 | 250537   | 0            | 755   | 3716312 | 100.00 % | 234777      | 100.00 % | 99.63 %           |

Mismatches by column: {}

Reads: 2316, median 22 ms, 95th percentile 26 ms, slowest 32 ms ({"ms":32,"season":2008,"game_type":"playoffs","team_id":1611661313,"group":"advanced","units":54}).

Units' minutes times 5 over the player minutes the team played, from the base file's units:

Regular season (the NBA lists the 2,000 units with the most minutes):

| Season | Teams | Median  | Lowest  | Highest |
| ------ | ----- | ------- | ------- | ------- |
| 2008   | 14    | 97.1 %  | 93.7 %  | 98.8 %  |
| 2009   | 13    | 99.7 %  | 98.6 %  | 99.8 %  |
| 2010   | 12    | 100.0 % | 100.0 % | 100.0 % |
| 2011   | 12    | 100.0 % | 100.0 % | 100.0 % |
| 2012   | 12    | 100.0 % | 100.0 % | 100.0 % |
| 2013   | 12    | 100.0 % | 100.0 % | 100.0 % |
| 2014   | 12    | 100.0 % | 100.0 % | 100.6 % |
| 2015   | 12    | 97.9 %  | 96.6 %  | 99.0 %  |
| 2016   | 12    | 99.8 %  | 99.7 %  | 100.0 % |
| 2017   | 12    | 99.9 %  | 99.7 %  | 100.5 % |
| 2018   | 12    | 99.9 %  | 99.8 %  | 99.9 %  |
| 2019   | 12    | 100.0 % | 97.1 %  | 100.0 % |
| 2020   | 12    | 100.0 % | 100.0 % | 100.0 % |
| 2021   | 12    | 100.0 % | 93.8 %  | 100.0 % |
| 2022   | 12    | 99.5 %  | 99.1 %  | 99.7 %  |
| 2023   | 12    | 99.6 %  | 98.9 %  | 99.9 %  |
| 2024   | 12    | 99.9 %  | 99.7 %  | 99.9 %  |
| 2025   | 13    | 94.2 %  | 90.5 %  | 97.1 %  |
| 2026   | 15    | 88.8 %  | 82.7 %  | 95.2 %  |

Playoffs (all units listed):

| Season | Teams | Median  | Lowest  | Highest |
| ------ | ----- | ------- | ------- | ------- |
| 2008   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2009   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2010   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2011   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2012   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2013   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2014   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2015   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2016   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2017   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2018   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2019   | 8     | 100.0 % | 50.0 %  | 100.0 % |
| 2020   | 8     | 100.0 % | 83.3 %  | 100.0 % |
| 2021   | 7     | 100.0 % | 90.4 %  | 100.0 % |
| 2022   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2023   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2024   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2025   | 8     | 100.0 % | 100.0 % | 100.0 % |
| 2026   | 8     | 100.0 % | 100.0 % | 100.0 % |

### Play-derived stats

`scripts/check-play-derived.mjs … --league=wnba`.

#### Turnovers and fouls against the box score

Kinds that do not add up to the total are counted as "sum ≠" (0 everywhere is the check). Team turnovers: the box score leaves out the team’s own (a shot-clock violation with no player), so the plays’ team total less those is compared; the column beside counts them in. Fouls: the gap is the box score’s fouls the feed has no row for, summed.

| Season | Player-games | Sum ≠ | TOV exact | PF exact | Team-games | Sum ≠ | TOV exact | TOV w/ team | PF exact | PF ±1 |      PF gap | Unmapped TOV | Unmapped PF |
| ------ | -----------: | ----: | --------: | -------: | ---------: | ----: | --------: | ----------: | -------: | ----: | ----------: | -----------: | ----------: |
| 1997   |         2102 |     0 |      99.5 |     99.0 |        230 |     0 |      72.2 |        99.1 |     95.2 |  99.1 |  41 of 4512 |    0 (0.0 %) |   0 (0.0 %) |
| 1998   |         3015 |     0 |     100.0 |     99.4 |        314 |     0 |      99.4 |        68.2 |     93.9 |  99.4 |  22 of 6326 |    0 (0.0 %) |   0 (0.0 %) |
| 1999   |         3848 |     0 |      99.8 |     98.6 |        406 |     0 |      98.0 |        70.2 |     88.7 |  97.5 | 103 of 8296 |    1 (0.0 %) |   0 (0.0 %) |
| 2000   |         5192 |     0 |     100.0 |     99.6 |        544 |     0 |      64.9 |        99.8 |     95.8 |  99.6 | 25 of 10980 |    0 (0.0 %) |   0 (0.0 %) |
| 2001   |         5278 |     0 |     100.0 |     99.8 |        548 |     0 |      97.6 |        71.9 |     98.0 | 100.0 | 11 of 10262 |    0 (0.0 %) |   0 (0.0 %) |
| 2002   |         5215 |     0 |     100.0 |     99.7 |        546 |     0 |      97.8 |        68.5 |     97.1 |  99.6 | 18 of 10491 |    1 (0.0 %) |   0 (0.0 %) |
| 2003   |         4956 |     0 |     100.0 |     99.8 |        514 |     0 |      66.0 |       100.0 |     98.4 | 100.0 |   8 of 9735 |    3 (0.0 %) |   0 (0.0 %) |
| 2004   |         4592 |     0 |     100.0 |     99.6 |        480 |     0 |      61.7 |        99.6 |     96.3 | 100.0 |  12 of 9077 |    3 (0.0 %) |   0 (0.0 %) |
| 2005   |         4546 |     0 |     100.0 |     99.7 |        476 |     0 |      67.0 |       100.0 |     97.3 | 100.0 |  13 of 9381 |    1 (0.0 %) |   0 (0.0 %) |
| 2006   |         5049 |     0 |      99.8 |     99.4 |        512 |     0 |      41.8 |        99.8 |     96.9 |  99.8 | 13 of 10078 |    3 (0.0 %) |   0 (0.0 %) |
| 2007   |         4754 |     0 |      99.8 |     99.7 |        482 |     0 |      50.4 |       100.0 |     99.0 | 100.0 |   5 of 9470 |    0 (0.0 %) |   0 (0.0 %) |
| 2008   |         5242 |     0 |     100.0 |     99.7 |        518 |     0 |      41.7 |       100.0 |     96.7 | 100.0 | 17 of 10697 |    0 (0.0 %) |   0 (0.0 %) |
| 2009   |         4684 |     0 |      99.8 |     99.5 |        482 |     0 |      43.2 |       100.0 |     97.3 |  99.8 |  14 of 9665 |    3 (0.0 %) |   0 (0.0 %) |
| 2010   |         4177 |     0 |     100.0 |     99.9 |        440 |     0 |      47.7 |       100.0 |     99.3 | 100.0 |   3 of 8483 |    0 (0.0 %) |   0 (0.0 %) |
| 2011   |         4280 |     0 |     100.0 |     99.8 |        446 |     0 |      42.8 |       100.0 |     98.2 | 100.0 |   8 of 8167 |    2 (0.0 %) |   0 (0.0 %) |
| 2012   |         4246 |     0 |     100.0 |    100.0 |        446 |     0 |      41.9 |       100.0 |     99.6 | 100.0 |   2 of 7938 |    1 (0.0 %) |   0 (0.0 %) |
| 2013   |         4147 |     0 |      99.9 |     99.8 |        442 |     0 |      45.7 |       100.0 |     98.9 | 100.0 |   5 of 7883 |    0 (0.0 %) |   0 (0.0 %) |
| 2014   |         4351 |     0 |     100.0 |     99.9 |        444 |     0 |      41.4 |       100.0 |     99.3 | 100.0 |   3 of 8165 |    0 (0.0 %) |   0 (0.0 %) |
| 2015   |         4409 |     0 |     100.0 |     99.9 |        450 |     0 |      46.7 |       100.0 |     99.3 | 100.0 |   3 of 8298 |    0 (0.0 %) |   0 (0.0 %) |
| 2016   |         4360 |     0 |     100.0 |     99.9 |        440 |     0 |      43.4 |       100.0 |     99.1 | 100.0 |   4 of 8649 |    1 (0.0 %) |   0 (0.0 %) |
| 2017   |         4339 |     0 |     100.0 |    100.0 |        438 |     0 |      41.1 |       100.0 |     99.5 | 100.0 |   2 of 8275 |    6 (0.1 %) |   0 (0.0 %) |
| 2018   |         4359 |     0 |     100.0 |     99.9 |        440 |     0 |      47.5 |       100.0 |     98.9 | 100.0 |   3 of 7969 |   41 (0.7 %) |   1 (0.0 %) |
| 2019   |         4256 |     0 |     100.0 |    100.0 |        440 |     0 |      38.2 |       100.0 |     99.5 | 100.0 |   2 of 7657 |   18 (0.3 %) |   0 (0.0 %) |
| 2020   |         2770 |     0 |     100.0 |     99.9 |        294 |     0 |      44.2 |       100.0 |     98.6 | 100.0 |   4 of 5245 |    4 (0.1 %) |   0 (0.0 %) |
| 2021   |         3845 |     0 |     100.0 |    100.0 |        418 |     0 |      45.2 |       100.0 |    100.0 | 100.0 |   0 of 7260 |    8 (0.1 %) |   0 (0.0 %) |
| 2022   |         4471 |     0 |     100.0 |    100.0 |        478 |     0 |      39.7 |       100.0 |     99.8 | 100.0 |   1 of 8333 |   11 (0.2 %) |   0 (0.0 %) |
| 2023   |         4829 |     0 |     100.0 |    100.0 |        520 |     0 |      38.7 |       100.0 |     99.6 | 100.0 |   2 of 9178 |   10 (0.1 %) |   0 (0.0 %) |
| 2024   |         4823 |     0 |     100.0 |    100.0 |        524 |     0 |      34.4 |       100.0 |     99.6 | 100.0 |   2 of 8934 |    0 (0.0 %) |   0 (0.0 %) |
| 2025   |         5776 |     0 |     100.0 |     99.9 |        620 |     0 |      35.3 |       100.0 |     99.5 | 100.0 |  3 of 10826 |    1 (0.0 %) |   0 (0.0 %) |
| 2026   |         6911 |     0 |     100.0 |    100.0 |        704 |     0 |      46.0 |       100.0 |     99.9 | 100.0 |  1 of 13927 |    0 (0.0 %) |   0 (0.0 %) |

#### Assisted makes, and-ones and flow

Makes: player-games where assisted plus unassisted twos and threes differ from the plays’ makes (0 is the check). Assists: the scorers’ assisted makes against the box score’s team assists, and the passers’ against each player’s. Shots: player-games where the assisted makes equal the shot table’s `shots_ast` (the same flag through the shot file). And-ones: team-games with more and-ones than the other side’s shooting fouls (0 is the check), and the "1 of 1" free throws beside them. Time: team-games whose time leading, trailing and tied miss the game’s length by more than a tenth (0 is the check). Margin: games whose last scoring play’s margin equals the box score’s.

| Season | Makes ≠ | Team AST exact | Player AST exact | Same as shots | And-ones | Converted | Over shooting fouls | "1 of 1" FTs | Technicals | Flagrants | Time ≠ | Margin exact |
| ------ | ------: | -------------: | ---------------: | ------------: | -------: | --------: | ------------------: | -----------: | ---------: | --------: | -----: | -----------: |
| 1997   |       0 |           91.7 |             99.3 |         100.0 |      346 |      70.5 |                   0 |          359 |         24 |         6 |      4 |         96.5 |
| 1998   |       0 |           93.9 |             99.9 |         100.0 |      546 |      70.9 |                   0 |          562 |         42 |        10 |      0 |         98.7 |
| 1999   |       0 |           97.3 |             99.6 |         100.0 |      638 |      69.7 |                   0 |          645 |         70 |        26 |      2 |         99.5 |
| 2000   |       0 |          100.0 |            100.0 |         100.0 |      771 |      72.0 |                   0 |          788 |         68 |        16 |      2 |         99.3 |
| 2001   |       0 |           97.6 |             99.8 |         100.0 |      756 |      71.7 |                   0 |          759 |         83 |        10 |      0 |        100.0 |
| 2002   |       0 |           99.3 |             99.9 |         100.0 |      788 |      73.2 |                   0 |          799 |         79 |        18 |      0 |        100.0 |
| 2003   |       0 |          100.0 |            100.0 |         100.0 |      757 |      72.1 |                   0 |          773 |         66 |        18 |      0 |        100.0 |
| 2004   |       0 |          100.0 |            100.0 |         100.0 |      715 |      70.3 |                   0 |          728 |         42 |         6 |      0 |        100.0 |
| 2005   |       0 |          100.0 |            100.0 |         100.0 |      751 |      74.6 |                   0 |          761 |         78 |         5 |      0 |        100.0 |
| 2006   |       0 |           99.8 |             99.8 |         100.0 |      954 |      73.5 |                   0 |          966 |         78 |        18 |      0 |         99.6 |
| 2007   |       0 |           95.9 |             99.4 |         100.0 |      885 |      77.1 |                   0 |          899 |         86 |         9 |      0 |        100.0 |
| 2008   |       0 |           96.5 |             99.7 |         100.0 |      926 |      73.0 |                   0 |          943 |         88 |         7 |      0 |        100.0 |
| 2009   |       0 |           95.4 |             99.3 |         100.0 |      926 |      74.9 |                   0 |          946 |         67 |        11 |      0 |        100.0 |
| 2010   |       0 |           93.2 |             99.3 |         100.0 |      830 |      74.3 |                   0 |          840 |         60 |        10 |      0 |        100.0 |
| 2011   |       0 |           92.2 |             98.7 |         100.0 |      765 |      73.9 |                   0 |          777 |         74 |         8 |      0 |        100.0 |
| 2012   |       0 |           92.2 |             98.7 |         100.0 |      792 |      71.6 |                   0 |          798 |         88 |         8 |      0 |        100.0 |
| 2013   |       0 |           93.9 |             99.3 |         100.0 |      744 |      76.2 |                   0 |          753 |         99 |        14 |      0 |        100.0 |
| 2014   |       0 |           93.9 |             99.4 |         100.0 |      782 |      74.9 |                   0 |          791 |         71 |        19 |      0 |        100.0 |
| 2015   |       0 |           91.3 |             99.1 |         100.0 |      782 |      76.9 |                   0 |          792 |         69 |        14 |      0 |        100.0 |
| 2016   |       0 |           92.7 |             99.3 |         100.0 |      937 |      78.5 |                   0 |          946 |         84 |        22 |      0 |         99.5 |
| 2017   |       0 |           93.6 |             99.4 |         100.0 |      842 |      74.7 |                   0 |          892 |         94 |        17 |      0 |        100.0 |
| 2018   |       0 |           90.7 |             99.1 |         100.0 |      839 |      78.1 |                   0 |          890 |        113 |        18 |     14 |         99.1 |
| 2019   |       0 |           93.9 |             99.3 |         100.0 |      691 |      76.4 |                   0 |          735 |        107 |        20 |     10 |         99.5 |
| 2020   |       0 |          100.0 |            100.0 |         100.0 |      546 |      78.0 |                   0 |          582 |         47 |         4 |      0 |        100.0 |
| 2021   |       0 |          100.0 |            100.0 |         100.0 |      712 |      76.1 |                   0 |          743 |         86 |        27 |      2 |         99.5 |
| 2022   |       0 |           99.6 |            100.0 |         100.0 |      898 |      75.5 |                   0 |          929 |        111 |        49 |      0 |        100.0 |
| 2023   |       0 |           99.4 |             99.9 |         100.0 |     1007 |      79.0 |                   0 |         1110 |        110 |        66 |      2 |        100.0 |
| 2024   |       0 |           99.8 |            100.0 |         100.0 |      961 |      75.3 |                   0 |         1054 |        131 |        37 |      0 |        100.0 |
| 2025   |       0 |          100.0 |            100.0 |         100.0 |     1126 |      74.7 |                   0 |         1228 |        134 |        51 |      4 |        100.0 |
| 2026   |       0 |          100.0 |            100.0 |         100.0 |     1536 |      77.0 |                   0 |         1673 |        165 |        79 |      2 |         99.7 |

#### Game flow recounted from the raw feed

Every game of six seasons: the raw `src_nba_pbp` score text carried as distinct score states, ties the states level after 0-0, lead changes the switches between non-zero signs, largest leads the extremes; against the home side’s row of `play_team_game`.

| Season | Games | Lead changes |  Ties | Largest leads | First misses |
| ------ | ----: | -----------: | ----: | ------------: | -----------: |
| 1997   |   115 |        100.0 | 100.0 |         100.0 |            – |
| 2003   |   257 |        100.0 | 100.0 |         100.0 |            – |
| 2009   |   241 |        100.0 | 100.0 |         100.0 |            – |
| 2015   |   225 |        100.0 | 100.0 |         100.0 |            – |
| 2021   |   209 |        100.0 | 100.0 |         100.0 |            – |
| 2026   |   352 |        100.0 | 100.0 |         100.0 |            – |

#### Fouls drawn and ejections

Fouls drawn: ESPN’s, 2005-06 to 2016-17, a team’s summed against the other side’s box-score fouls. Ejections: player-games ESPN’s box score marks ejected, those the play by play records, and both.

| Season | FD exact | FD ±2 | Ejected (ESPN) | Ejections (plays) | Both |
| ------ | -------: | ----: | -------------: | ----------------: | ---: |
| 1997   |        – |     – |              0 |                 0 |    0 |
| 1998   |        – |     – |              0 |                 0 |    0 |
| 1999   |        – |     – |              0 |                 0 |    0 |
| 2000   |        – |     – |              0 |                 0 |    0 |
| 2001   |        – |     – |              0 |                 0 |    0 |
| 2002   |        – |     – |              0 |                 3 |    0 |
| 2003   |        – |     – |              0 |                 2 |    0 |
| 2004   |        – |     – |              0 |                 1 |    0 |
| 2005   |        – |     – |              0 |                 3 |    0 |
| 2006   |     82.2 |  96.9 |              0 |                 5 |    0 |
| 2007   |     92.3 |  97.1 |              0 |                 3 |    0 |
| 2008   |     87.8 |  98.5 |              0 |                 5 |    0 |
| 2009   |     91.5 |  98.8 |              0 |                 2 |    0 |
| 2010   |     95.0 | 100.0 |              0 |                 3 |    0 |
| 2011   |     46.9 |  85.7 |              0 |                 2 |    0 |
| 2012   |     26.0 |  64.8 |              0 |                 4 |    0 |
| 2013   |     91.4 |  99.1 |              0 |                 3 |    0 |
| 2014   |     92.1 |  99.3 |              0 |                 2 |    0 |
| 2015   |     98.2 | 100.0 |              0 |                 4 |    0 |
| 2016   |     95.0 |  97.7 |              0 |                 5 |    0 |
| 2017   |     98.4 | 100.0 |              0 |                 5 |    0 |
| 2018   |        – |     – |              0 |                 7 |    0 |
| 2019   |        – |     – |              0 |                 7 |    0 |
| 2020   |        – |     – |              0 |                 0 |    0 |
| 2021   |        – |     – |              0 |                 1 |    0 |
| 2022   |        – |     – |              0 |                 4 |    0 |
| 2023   |        – |     – |              0 |                 6 |    0 |
| 2024   |        – |     – |              0 |                 6 |    0 |
| 2025   |        – |     – |              0 |                11 |    0 |
| 2026   |        – |     – |              0 |                 5 |    0 |

#### Reads, warm, median of five

| Read                                      |  ms |
| ----------------------------------------- | --: |
| A team’s assist network, a season         |  19 |
| The same over January                     |  16 |
| A player’s assists, a season              |  19 |
| A team’s assist network, ten seasons      |  24 |
| A game’s flow                             |  20 |
| A five-metric player leaderboard (engine) |  23 |
