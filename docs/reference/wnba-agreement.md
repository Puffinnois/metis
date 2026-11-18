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
| 1997   | 2       | 0                | 0            | –                               | –       | 0              | 112               | 3 of 3                   |
| 1998   | 2       | 0                | 0            | –                               | –       | 1              | 147               | 10 of 10                 |
| 1999   | 2       | 0                | 0            | –                               | –       | 0              | 190               | 13 of 13                 |
| 2000   | 2       | 0                | 0            | –                               | –       | 2              | 246               | 26 of 26                 |
| 2001   | 2       | 0                | 0            | 1                               | –       | 0              | 255               | 20 of 20                 |
| 2002   | 2       | 0                | 0            | 1                               | –       | 18             | –                 | 273 of 273               |
| 2003   | 2       | 0                | 0            | 1                               | –       | 14             | 3                 | 254 of 254               |
| 2004   | 2       | 0                | 0            | 1                               | –       | 18             | 2                 | 238 of 238               |
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
