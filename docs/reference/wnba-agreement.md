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
