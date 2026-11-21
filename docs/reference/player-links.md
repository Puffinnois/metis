# One player across leagues: what was measured

The research step of Plan T1304, measured on 2026-11-21: what the loaded data gives to link a player's college career to their professional one (NCAA Men with the NBA, NCAA Women with the WNBA), where the link could live, what a profile can show when the other league is not downloaded, and where it could appear on screen. Nothing here is decided; the design is for the owner and the manager.

**Data read.** The clean loads of Stage 13, each attached read-only to one in-memory DuckDB 1.5.6 (`@duckdb/node-api`): `~/.cache/metis-dev/gate13` (the NBA through 2026-27's first weeks, the WNBA through 2026), `gate-ncaam-full` and `gate-ncaaw-full` (the colleges, 2021-22 to 2026-27's first weeks, D39). No file was written. The queries are in `scripts/player-links/` and run with `scripts/player-links-sql.mjs`; the HTTP measurements with `scripts/player-links-range.mjs` ("Rerunning" at the end).

**Draft classes** are named by the year of the draft: the class of 2024 was drafted in June 2024 (NBA) or April 2024 (WNBA), after the 2023-24 college season (`2024`). D39's window starts with 2021-22, so the classes of 2022 to 2026 are the ones whose last college season can be in the files.

## The answer in short

- **ESPN's athlete id is the same person in college and in the professional league.** 25 players named by hand all carry one id on both sides; at scale, 379 NBA players and 144 WNBA players share an id with a college player, and every one of the 523 is the same person (names, birth dates, schools; 16 name differences are suffixes, nicknames and a married name). No id crosses the sexes.
- **The id alone links 222 of the 233 NBA college draftees of 2022 to 2026 (95.3 %), and every WNBA draftee who played a WNBA game with a college line in the window (118 of 118).** What it misses is explained: a player ESPN gave a second id (2 cases), and draftees with no professional ESPN id because they have not played (10 NBA, 51 WNBA).
- **Recommended matcher:** the id; then name and birth date where both sides have an ESPN birth date; then, for a professional player with no ESPN id, name with draft class (and the college, where the draft names one), one candidate only. **It links 232 of the 233 NBA college draftees (100, 100, 100, 100 and 98.1 % for the classes 2022 to 2026) and 164 of the 169 WNBA ones (100, 97.0, 93.5, 94.3 and 100 %).** Nothing else is linked: no wrong link was found in 523 id links and the 57 others, all checked, and the tolerance asked of the design is zero wrong links.
- **No published crosswalk links college ids to professional ones,** and none is needed: the dataset's crosswalks within each league key on the same ESPN id.
- **A single player's lines cannot be fetched more cheaply than the season file holding them.** Every release file measured is one row group, and the box-score files carry no statistics on the id column, so a filtered read fetches the same bytes as the whole file (606 KB for an NBA season). But the files are small: a professional league's season of box scores is 0.1 to 0.6 MB, and its season stats 0.04 to 0.11 MB.
- **What the numbers argue against:** downloading "only that player" saves nothing over downloading those seasons whole. A Metis-made summary file per league has nowhere to be published, and needs no publisher: the releases already publish one (ESPN's player season stats, 0.5 MB for the NBA's window). See "What the numbers say about the ideas".

## Part 1: matching

### What each side holds

| Field                         | NBA file                                                                                                                                             | WNBA file                                                                          | NCAA files (men and women alike)                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ESPN athlete id               | `player.espn_athlete_id`: every player first on the floor 2019-20 to 2025-26; 63 of 74 in 2026-27 so far                                             | `player.espn_athlete_id`: every player first on the floor 2020 to 2026             | `player.espn_athlete_id`: the key (D40); players only stats.ncaa.org holds have D28's keys |
| Draft                         | `src_nba_draft` (the league's): pick, team, `organization` (the school), `organization_type`; labelled class + 1                                     | `src_wnba_draft`: pick, team; `organization` blank for 2023, 2024 and 2025         | none                                                                                       |
| ESPN's draft table            | `src_espn_draft`: **its `athlete_id` is a draft-prospect id (104249 to 4582817), not the athlete id, and `college_name` is never filled**            | the same (104566 to 111753), college never filled                                  | none                                                                                       |
| Birth date                    | `src_espn_player_core.date_of_birth`, every row 2022 to 2027                                                                                         | the same, 1 row missing of 918; also `player.birth_date` from the league's rosters | `player.birth_date`, from ESPN's bios                                                      |
| College                       | `src_espn_player_core.college_id` (an ESPN team id, the college file's `team_id`): 87 to 89 % of rows a season; `src_dash_player_bio.college` (text) | `college_id`: 80 to 92 %; `player.school` (text)                                   | `player_season.team_id` per season, with `team.name`                                       |
| Height, hometown, high school | heights in bios and rosters; birth city                                                                                                              | the same                                                                           | `player.height`, `hometown`, `high_school`                                                 |

Two traps. **The NBA's draft table is labelled one season ahead**: Paolo Banchero, drafted in June 2022, is `season` 2023, and Cooper Flagg (June 2025) is 2026; the WNBA's is labelled by the draft's own year. **ESPN's draft tables cannot link anything**: their ids are not athlete ids, and they name no college.

### The ESPN id, on named players

Paolo Banchero, Chet Holmgren, Jabari Smith Jr., Jaden Ivey, Keegan Murray, Brandon Miller, Zach Edey, Reed Sheppard, Stephon Castle, Dalton Knecht, Cooper Flagg and Dylan Harper (NBA); Caitlin Clark, Paige Bueckers, Angel Reese, Cameron Brink, Aliyah Boston, Kamilla Cardoso, Rickea Jackson, Kiki Iriafen, Sonia Citron, Haley Jones, Rhyne Howard (WNBA): each has one ESPN id in the professional file and the same id in the college file, with the same birth date (`02-known-players.sql`). Name matching on the same players already finds a second "Brandon Miller", "Angel Reese" and two more "Haley Jones" rows in the college files (namesakes, or rostered rows with no line).

### The ESPN id, at scale

Every professional player with an ESPN id, against the college file of the same sex (`04-id-at-scale.sql`):

| Pair             | Professional players with an ESPN id | Same id in college | Same name | Both birth dates known | Same birth date |
| ---------------- | ------------------------------------ | ------------------ | --------- | ---------------------- | --------------- |
| NBA, NCAA Men    | 3,152                                | 379                | 366       | 378                    | 378             |
| WNBA, NCAA Women | 1,053                                | 144                | 141       | 143                    | 138             |

The 13 NBA name differences are the same people: suffixes (Jermaine Samuels Jr., Boo Buie III, Trey Jemison III, Craig Porter Jr., Darius Brown II, Labaron Philon Jr., Terrence Shannon Jr, Ernest Udeh Jr.), punctuation (LJ Cryer), and names (Nate and Jeenathan Williams, Elijah and EJ Harkless, Bub and Carlton Carrington, David Jones Garcia and David Jones). The 3 WNBA ones: Miela Sowah (Goodchild in college, a married name), Michelle and Ugonne Onyiah, Quionche and Sha Carter. The 5 WNBA birth dates that differ are ESPN's errors on one side, the id being right (Maddy Westbeld, Aziaha James, Cotie McMahon, Michelle Onyiah, Ta'Niya Latson: a month, a day or a year apart; Aziaha James's college date is 2005, three years after her professional one). No NBA player's id is in the women's college file and no WNBA player's in the men's. The men's and women's college files share 1 id.

### The matchers

Built in SQL across the attached files (`10-match-nba.sql`, `20-match-wnba.sql`). The professional side is every draftee of the classes 2022 to 2026, and every player first on the floor in 2022-23 to 2026-27 (NBA) or 2022 to 2026 (WNBA) who was never drafted. A name is compared after accents, punctuation and a final Jr., Sr., II, III, IV or V are removed.

- **Id:** the professional ESPN id equals the college one.
- **Name and birth date:** the professional ESPN birth date equals the college one.
- **Name, college and class:** the college player's last season is the class or the season before it, and one of their teams is the professional bio's ESPN college, or a team whose name starts with the draft table's school (with 31 aliases such as Connecticut → UConn, California-Los Angeles → UCLA).
- **Name and class** (WNBA, where the draft names no school in 2023 to 2025): the last college season alone.
- **Name alone.**

Precision against the id, wherever both found a single candidate:

| Matcher                 | NBA: agrees with the id | NBA: disagrees | WNBA: agrees | WNBA: disagrees | What it misses                                                                                            |
| ----------------------- | ----------------------- | -------------- | ------------ | --------------- | --------------------------------------------------------------------------------------------------------- |
| Name and birth date     | every one               | 0              | every one    | 0               | 5 WNBA links (ESPN's dates differ); every professional player with no ESPN bio                            |
| Name, college and class | every one               | 0              | every one    | 0               | transfers whose school text is not in the aliases; draftees whose school the draft does not name          |
| Name and class          | n/a                     | n/a            | every one    | 0               | ambiguous on common names (2 a class)                                                                     |
| Name alone              | 342 of 342 unique       | 0              | 130 of 130   | 0               | ambiguous for 31 NBA and 11 WNBA linked players; links namesakes where the right player is absent (below) |

Name alone is not usable: where the right player has no college line, it links a namesake. A.J. Lawson (South Carolina before the window) meets an AJ Lawson of 2021-22; Alpha Diallo (Providence to 2020) an Alpha Diallo of 2021-22; Jaelyn Brown (California to 2019) a Jaelyn Brown at Longwood in 2025-26. Each is a different person, which the birth date, where known, confirms.

**Hand checks.** 50 id links a pair, drawn at random with a fixed seed (`30-sample.sql`), read one by one: name, both birth dates, the professional school against the college teams. **100 of 100 right.** Cotie McMahon's college birth date is a year off, the id right. Every link another matcher makes where the id does not, read the same way: **57 of 57 right**. That is 2 by name and birth date, 27 by name, college and class (`30-sample.sql`), and 28 WNBA draftees of 2023 to 2025 by name and class, whose college teams are listed by `20-match-wnba.sql` and are the schools they were drafted from (Alexis Morris, LSU; Monika Czinano, Iowa; Abbey Hsu, Columbia; Yvonne Ejim, Gonzaga, and so on).

### Rates per draft class

The recommended matcher (id; name and birth date; name, college and class when the professional player has no ESPN id), against the draftees who should be linkable: drafted from a college, with a college line in the window.

**NBA, college draftees** (`organization_type` College/University):

| Class | Drafted from college | By the id | Added by name and birth date | No NBA ESPN id yet | Added by name, college, class | Linked  | Unlinked                                                                 |
| ----- | -------------------- | --------- | ---------------------------- | ------------------ | ----------------------------- | ------- | ------------------------------------------------------------------------ |
| 2022  | 44                   | 44        | 0                            | 0                  | 0                             | 44      | 0                                                                        |
| 2023  | 46                   | 45        | 1 (Jalen Hood-Schifino)      | 0                  | 0                             | 46      | 0                                                                        |
| 2024  | 43                   | 43        | 0                            | 0                  | 0                             | 43      | 0                                                                        |
| 2025  | 46                   | 45        | 0                            | 1 (Thomas Sorber)  | 1                             | 46      | 0                                                                        |
| 2026  | 54                   | 45        | 0                            | 9                  | 8                             | 53      | 1: Trey Kaufman-Renn (his college row runs into 2026-27, past the class) |
| All   | 233                  | 222       | 1                            | 10                 | 9                             | **232** | 1                                                                        |

The id alone: 100, 97.8, 100, 97.8 and 83.3 %. Hood-Schifino has two ESPN ids (4433626 professional, 5105797 college), as does Bobi Klintman (Wake Forest 2022-23, drafted from Cairns in 2024; 4906923 and 5105340); name and birth date link both. Sorber has no NBA game (injured), so no NBA ESPN id. The 2026 class's nine had not played when the load was made; ESPN's id will come with their first game, and the id link then takes over.

**NBA, other draftees and the undrafted.** Draftees from clubs abroad, the G League's Ignite and high schools are not misses: 60 in the five classes, of which 2 have a college line before their draft, both linked (Klintman by name and birth date, Lachlan Olbrich by the id); James Nnaji's only college rows are 2025-26 and 2026-27, after his draft, and are left unlinked (below). Undrafted players first on an NBA floor in 2022-23 to 2026-27: 198, of which **154 linked by the id**. Three more have one college player of their name (Kylan Boswell, Nate Bittle, Quadir Copeland, rookies of 2026-27 with no NBA ESPN id yet). The matcher leaves them unlinked, since the NBA's bio gives no school yet, until their first game brings the id. The other 41 have no college line in the window: 17 have no college at all (international, G League, Overtime Elite), and 24 name a college whose seasons the college file does not hold, before 2021-22 or outside Division I (Northwest Missouri State, Winston-Salem State).

**WNBA draftees.**

| Class | Drafted | Played in the WNBA | Of those, college in window | By the id | Never played, from college | Linked by name (college or class) | Unlinked, from college                                       | Drafted from abroad (not misses) |
| ----- | ------- | ------------------ | --------------------------- | --------- | -------------------------- | --------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| 2022  | 36      | 26                 | 24                          | 24        | 10                         | 10                                | 0                                                            | 2                                |
| 2023  | 36      | 22                 | 22                          | 22        | 11                         | 10                                | 1 (Brittany Davis: two candidates)                           | 3                                |
| 2024  | 36      | 22                 | 17                          | 17        | 14                         | 12                                | 2 (Kaitlyn Davis: two; Nastja Claessens: only a 2026-27 row) | 5                                |
| 2025  | 38      | 30                 | 27                          | 27        | 8                          | 6                                 | 2 (Adja Kane, Ajsa Sivka: only 2026-27 rows)                 | 3                                |
| 2026  | 45      | 30                 | 28                          | 28        | 8                          | 8                                 | 0                                                            | 9                                |

Every drafted player who played in the WNBA with a college line in the window is linked by the id: **118 of 118**. With the draftees who never played, the college draftees of each class are 34, 33, 31, 35 and 36, of which 34, 32, 29, 33 and 36 are linked. A draftee who never played has no WNBA profile at all: the link can only put "Drafted 2024, 13th, Connecticut Sun" on the college profile, from the draft table, by name. For 2023 to 2025 the WNBA's draft table names no school, so name and class is all there is, and two Davises stay unlinked. Undrafted WNBA players of 2022 to 2026: 76, of which 26 linked by the id. The other 50 are international players, played college before 2021-22 (Rebekah Gardner, Robyn Parks, Ezinne Kalu, Amy Okonkwo, Kathryn Westbeld, Jaelyn Brown, Jovana Nogic and others), or are under no name or id in the women's file (Nadia Fingall, Holly Winterburn, Peyton Williams, Kyra Lambert; their ids date them to colleges of 2017 to 2021, but the files cannot prove it).

### Every miss of the 2024 and 2025 classes

"Miss" here is a player of the class the recommended matcher leaves unlinked. None of them is a college draftee who played.

| Class | League | Player                                                                                                                             | Kind                  | Reason                                                                                                          |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| 2024  | NBA    | Tyler Smith                                                                                                                        | Ignite                | No college; three namesakes in the college file are other players                                               |
| 2024  | NBA    | Alex Reese, Ethan Thompson, Kylor Kelley, Jack McVeigh, Jackson Rowe                                                               | Undrafted             | College before 2021-22 (Alabama, Oregon State, Nebraska, Cal State Fullerton): no row of the name in the window |
| 2024  | NBA    | Armel Traore, Cui Yongxi, Jazian Gortman, Phillip Wheeler, Trentyn Flowers, Yuki Kawamura                                          | Undrafted             | No college (abroad, G League, Overtime Elite)                                                                   |
| 2024  | NBA    | 13 other draftees from clubs abroad or the G League                                                                                | Drafted               | No college                                                                                                      |
| 2024  | WNBA   | Kaitlyn Davis                                                                                                                      | Drafted, never played | Two college players of the name end in 2023-24; the draft names no school; left unlinked                        |
| 2024  | WNBA   | Nastja Claessens                                                                                                                   | Drafted, never played | The only row of the name is Kansas, 2026-27, after the draft: unverifiable, left unlinked                       |
| 2024  | WNBA   | Carla Leite, Leila Lacan, Matilde Villa, Isobel Borlase, Nyadiew Puoch                                                             | Drafted, played       | No college                                                                                                      |
| 2024  | WNBA   | Ezinne Kalu, Jaelyn Brown                                                                                                          | Undrafted             | College before 2021-22 (Savannah State, California); Brown's namesake at Longwood is another player             |
| 2024  | WNBA   | Julie Vanloo, Olivia Epoupa, Sevgi Uzun                                                                                            | Undrafted             | No college                                                                                                      |
| 2025  | NBA    | Javonte Cooke                                                                                                                      | Undrafted             | Winston-Salem State, outside Division I                                                                         |
| 2025  | NBA    | Alex Antetokounmpo                                                                                                                 | Undrafted             | No college                                                                                                      |
| 2025  | NBA    | Saliou Niang                                                                                                                       | Drafted (Trento)      | No college before the draft; a namesake row in 2026-27 only: left unlinked                                      |
| 2025  | NBA    | 11 other draftees from clubs abroad or the G League                                                                                | Drafted               | No college                                                                                                      |
| 2025  | WNBA   | Adja Kane, Ajsa Sivka                                                                                                              | Drafted, never played | The only rows of the names are 2026-27 (SMU, Kentucky), after the draft: left unlinked                          |
| 2025  | WNBA   | Anastasiia Olairi Kosu, Dominique Malonga, Juste Jocyte                                                                            | Drafted, played       | No college                                                                                                      |
| 2025  | WNBA   | Amy Okonkwo, Kathryn Westbeld                                                                                                      | Undrafted             | College before 2021-22 (TCU, Notre Dame)                                                                        |
| 2025  | WNBA   | Kyra Lambert                                                                                                                       | Undrafted             | No row of the name or id in the women's file                                                                    |
| 2025  | WNBA   | Annika Soltau, Janelle Salaun, Kariata Diaby, Kyara Linskens, Mamignan Toure, Marième Badiane, Monique Akoa Makani, Murjanatu Musa | Undrafted             | No college                                                                                                      |

Thomas Sorber (NBA 2025) is linked by name, college and class, not by the id. **A new case for the design:** players drafted from abroad who then appear in a college file in 2026-27 (Nnaji, Niang and Ngoy for the men; Claessens, Kane, Sivka and Kejia Ran for the women). If these are the same people, the order of the two careers is reversed. The files cannot confirm it (no birth date on the professional side, no ESPN id), so they stay unlinked.

### The reverse view

College players with a line in a season who have a professional line in any season, by the id (`50-reverse.sql`):

| Season  | Men: players | Men: Division I | Men: D-I with a pro line | %    | Women: players | Women: Division I | Women: D-I with a pro line | %    |
| ------- | ------------ | --------------- | ------------------------ | ---- | -------------- | ----------------- | -------------------------- | ---- |
| 2021-22 | 9,445        | 5,095           | 253                      | 4.97 | 7,424          | 4,806             | 111                        | 2.31 |
| 2022-23 | 9,753        | 5,102           | 230                      | 4.51 | 7,361          | 4,713             | 111                        | 2.36 |
| 2023-24 | 9,860        | 5,063           | 173                      | 3.42 | 7,751          | 4,696             | 85                         | 1.81 |
| 2024-25 | 9,816        | 5,119           | 120                      | 2.34 | 8,113          | 4,738             | 64                         | 1.35 |
| 2025-26 | 10,015       | 5,019           | 56                       | 1.12 | 8,310          | 4,694             | 34                         | 0.72 |
| 2026-27 | 8,120        | 5,042           | 0                        | 0    | 6,847          | 4,481             | 0                          | 0    |

The share falls toward the present because recent players have not turned professional yet. One men's player of 2021-22 with a professional line played for a team outside Division I. In all: **379 men and 144 women** of the college files have a professional line, out of 43,438 and 31,697 college players. No linked player's college career is split across a second college row on the same team (`50-reverse.sql`). The same-name rows beside linked players are namesakes, or rostered rows with no line (`51-same-name-rows.sql`).

### Published crosswalks

- **In the releases:** none links college ids to professional ones. Checked against the full release list (`~/.cache/metis-dev/sdv-releases.tsv`, 387 releases) and the basketball asset list (`bb-assets.tsv`, `ncaa-assets.tsv`). `mbb_crosswalk` and `wbb_crosswalk` link ESPN, stats.ncaa.org, Fox, Yahoo, KenPom and Torvik ids within the college game. `nba_crosswalk` and `wnba_crosswalk` link ESPN, the league's own, Fox and Yahoo ids within each league. The `*_player_aliases` files of the groups releases are within one league too. They meet at the ESPN id, which is why the id link works: the dataset keys both levels on it. `nba_stats_draft` and `wnba_stats_draft` give the school as text; `nba_stats_draft_combine` gives measurements.
- **Elsewhere, free and in bulk:** one web search found nothing usable. Sportradar's player mappings link NCAA to NBA and WNBA profiles, but in a licensed API (D44's reasoning). Sports Reference links careers on its pages, which is scraping, outside the limits. A registry called PRISM (StatsVine) publishes a CSV of cross-provider ids; whether it holds ESPN ids or college players was not checked. Since the ESPN id already links, none is needed.

### Recommended matcher and its tolerance

1. **The ESPN athlete id**, when both sides have it. Measured: 523 links, all right.
2. **Else name and birth date**, when the professional player has an ESPN birth date and exactly one college player of that name has the same date. Catches ESPN's second ids (2 cases).
3. **Else, for a draftee with no professional ESPN id: name and class, with the college where the draft names one**, exactly one candidate, last college season the class or the one before, and, when a school is known, a team that is the professional bio's ESPN college or the draft's school. Catches draftees who have not played (9 NBA, 46 WNBA in these classes); the WNBA's draft names no school for 2023 to 2025, so those 28 rest on name and class alone. It is overtaken by the id once the player plays.
4. **Else nothing.** Name alone, two candidates, an undrafted player with no ESPN id, and any candidate whose college career starts after the draft stay unlinked.

**Tolerance: zero wrong links.** It is stated, not assumed: the 580 links the matcher makes on these files were all checked (the 523 id links by name and birth date, 100 of them also by hand; the 57 others by hand). The cost of a wrong link (a stranger's college career on a profile) is worse than a missing one. Each link carries its method (`id`, `name+birth`, `name+college`), so a screen can say how it was made. The `name+college` links are rechecked at every refresh and dropped if the id later says otherwise.

**How the unlinked are shown:** as nothing invented. A profile with no link shows no other-league section, or a quiet line ("No college record in Metis": the colleges start in 2021-22). It never shows a guess or a "did you mean". Players drafted from abroad, and players whose college seasons precede the window, are the common unlinked cases, and the line's reason can say so where the data knows it (the draft's `organization_type`, the bio's ESPN college with no row in the window).

**Cost:** the whole matcher ran in 0.28 s (NBA) and 0.07 s (WNBA) on these files.

## Part 2: where the link lives

Options with their costs, not a decision. In each, the worker builds the link, because only the worker opens stats files (`CLAUDE.md` rule 3), by attaching the other league's file read-only during a refresh. It is about 520 rows of three ids and a method: kilobytes.

|                             | **A. A link table in each league's file**                                                                            | **B. A link table in `metis.db`**                                                                                                           | **C. A link file of its own, built locally**                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Where                       | `player_link` in `stats-nba.duckdb` and in `stats-ncaam.duckdb`, both copies the same                                | One table keyed by the league pair                                                                                                          | `links.duckdb` (or Parquet) beside the stats files, published nowhere  |
| Built                       | At either league's refresh, when both files are present                                                              | At either refresh; the worker computes it, the main process writes it                                                                       | At either refresh, by the worker                                       |
| Only one league downloaded  | Not built; a table from an earlier build is kept (links do not change once made)                                     | Kept from an earlier build                                                                                                                  | Kept from an earlier build                                             |
| On refresh                  | Rebuilt in the refreshed file only; the other file's copy waits for its own refresh, so the two can differ for a day | Rebuilt once                                                                                                                                | Rebuilt once                                                           |
| On a rebuild or deletion    | Deleting a league's file deletes its copy; the other file keeps its own                                              | Survives any stats file's deletion; must be told when a file is rebuilt                                                                     | Survives deletion of either league; can hold the kept summary (Part 3) |
| Under `NCAA_STATS_LEFT_OUT` | Unaffected: the link reads ESPN's ids and ESPN's bios, not stats.ncaa.org                                            | Unaffected                                                                                                                                  | Unaffected                                                             |
| Asks of D36                 | An amendment: a league file would hold another league's ids, and two files the same fact                             | An amendment: `metis.db` holds settings and views; a data table changes its role, and the main process would write what the worker computed | An amendment: a third kind of stats file, opened only by the worker    |
| Asks of D35                 | A screen of one league reads a table naming the other: one league is still shown, but the profile points across      | The same                                                                                                                                    | The same                                                               |

Facts that bear on the choice: the link needs both files once, then holds. A refresh of the current season adds links only for new professional players, a few dozen a year. Writes run in turn in the worker, so attaching the other file read-only during a refresh never races its own refresh.

## Part 3: when the other league is not downloaded

Measured on 2026-11-21 against the real release URLs (`scripts/player-links-range.mjs`). Each case ran in a fresh DuckDB with no metadata cache, the cases 3 seconds apart, a plain client. Bytes are the sum of the GET responses' lengths. Times are from this machine on its connection, and only a guide.

### Downloading only that player

| Case                                                   | Files | Player's lines | Id column only, filtered | The player's full lines, filtered | The files whole |
| ------------------------------------------------------ | ----- | -------------- | ------------------------ | --------------------------------- | --------------- |
| NBA box scores, Cooper Flagg 2025-26                   | 1     | 70             | 52 KB, 0.4 s             | 606 KB, 1.1 s                     | 606 KB, 1.4 s   |
| NBA box scores, Chet Holmgren 2022-23 to 2026-27       | 5     | 240            | 229 KB, 1.5 s            | 2.02 MB, 2.2 s                    | 2.57 MB, 3.3 s  |
| NBA season stats, Cooper Flagg 2025-26                 | 1     | 43             | 19 KB, 0.5 s             | 111 KB, 0.7 s                     | 111 KB, 1.3 s   |
| WNBA box scores, Caitlin Clark 2025                    | 1     | 45             | 40 KB, 0.9 s             | 190 KB, 0.8 s                     | 190 KB, 0.7 s   |
| WNBA box scores, Caitlin Clark 2024 to 2026            | 3     | 135            | 101 KB, 1.6 s            | 510 KB, 0.6 s                     | 510 KB, 0.9 s   |
| Men's college box scores, Cooper Flagg 2024-25         | 1     | 39             | 354 KB, 0.7 s            | 3.51 MB, 1.5 s                    | 3.51 MB, 1.9 s  |
| Men's college box scores, Zach Edey 2021-22 to 2023-24 | 3     | 111            | 1.17 MB, 0.9 s           | 11.90 MB, 3.8 s                   | 11.90 MB, 4.8 s |
| Women's college box scores, Caitlin Clark 2023-24      | 1     | 39             | 356 KB, 0.9 s            | 3.84 MB, 2.3 s                    | 3.84 MB, 2.1 s  |
| Women's college box scores, Clark 2021-22 to 2023-24   | 3     | 109            | 930 KB, 0.9 s            | 9.77 MB, 3.8 s                    | 11.56 MB, 5.8 s |

**Row-group statistics cannot skip anything.** Every professional file is one row group (34,883 rows for an NBA season). The NBA files carry no min or max on `athlete_id`, and where a file has them (some WNBA and college files) the one group's range covers every id. The college files of 122,880 rows or more have two groups. A filter on the id therefore reads the id column of every row. The full lines of one player then need every column chunk of that group, which is the whole file. The one saving measured is 15 % (Clark's 2021-22 and 2022-23 files have two groups, and one could be skipped). A player's line costs what the season costs.

**What the user would see:** "Get Clark's NBA career" fetches the same bytes as "Get the NBA's box scores for 2022-23 to 2026-27", 2.6 MB in about 3 seconds, and then throws away 99.8 % of it. The second player fetches it again, unless it is kept, at which point it is a download of those seasons. Offline, a player not fetched before shows nothing.

### A published summary, fetched whole

ESPN's player season stats (`espn_*_player_season_stats`), one file a season, every player of the league:

| League     | Size a season (2022 on)                   | The window                        | One player-season holds                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NBA        | 104 to 113 KB (2026-27 so far: 83 KB)     | 2022-23 to 2026-27: about 0.51 MB | 44 rows: games, starts, minutes; makes, attempts and percentages; offensive, defensive and total rebounds, assists, blocks, steals, fouls, turnovers, points (averages and totals); double- and triple-doubles, ejections, technicals, flagrants, assist-to-turnover, scoring and shooting efficiency; the team |
| WNBA       | 37 to 54 KB                               | 2022 to 2026: about 0.21 MB       | the same                                                                                                                                                                                                                                                                                                        |
| NCAA Men   | 1.14 to 1.27 MB (2026-27 so far: 0.85 MB) | about 6.9 MB                      | the same, 45 rows                                                                                                                                                                                                                                                                                               |
| NCAA Women | 0.80 to 0.94 MB (2026-27 so far: 0.63 MB) | about 4.8 MB                      | the same                                                                                                                                                                                                                                                                                                        |

Keyed by the ESPN athlete id, so it links by the same rule with nothing else. Fetched in 0.7 to 1.3 s a file. It gives every linked player's traditional season line at once, for both directions. Alongside it, the league's draft table (`nba_stats_draft`, 496 KB for 30 seasons) gives "drafted by". What it lacks: anything Metis builds (advanced and on-court metrics), a game log, and the two second-id players and the unplayed draftees (no birth date, no ESPN id to match).

### A summary built locally, kept when a league is removed

Every linked player's season rows, written as Parquet with zstd (`41-local-summary.sql`):

| Side                                   | Rows  | Whole rows (columns) | A 28-column career line |
| -------------------------------------- | ----- | -------------------- | ----------------------- |
| NBA seasons of the 379 linked players  | 2,349 | 303 KB (74)          | 70 KB                   |
| Men's college seasons of the same      | 2,814 | 382 KB (109)         | 77 KB                   |
| WNBA seasons of the 144 linked players | 795   | 104 KB (74)          | not written             |
| Women's college seasons of the same    | 1,514 | 213 KB (109)         | not written             |

Built from the files when both are present, it costs nothing to download, and it keeps Metis's own season lines (with its derived columns) after a league is deleted. It cannot exist for a user who never downloaded the other league.

### The options side by side

| Option                             | Bytes                                                                                               | Seconds                               | What the user sees                                                                                      | Offline                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Download the other league whole    | 1.55 GB of NBA releases (a 5.3 GB file) / 0.30 GB WNBA / about 0.8 GB a college league              | minutes (5 for a college league, D42) | Everything, both sides                                                                                  | Works                                             |
| Only that player, by range reads   | The seasons' box-score files whole: 0.6 MB an NBA season, 0.1 to 0.2 MB WNBA, 3.3 to 4.3 MB college | 1 to 5 s a career                     | One player's game log, again for each player                                                            | Fails for anyone not fetched                      |
| ESPN's season stats, fetched whole | 0.51 MB NBA, 0.21 MB WNBA, 6.9 / 4.8 MB college for the window                                      | 1 s a season file                     | Every linked player's season line, both directions, at once; refreshed with the league's current season | Works once fetched; the current season goes stale |
| A local summary, kept              | 0 to download; 70 to 430 KB on disk                                                                 | none                                  | Metis's own season lines of every linked player                                                         | Works                                             |

## Part 4: what the screens could show

Placements, with the data each needs. "Both" means both leagues' files downloaded. "Summary" means the other league's season lines from ESPN's file or a kept local summary.

- **A career strip on the player page.** College seasons, then professional ones, in one line: team, games, points, rebounds, assists a season, with the draft (class, pick, team) between them. Needs the link and the other side's season lines: summary, or both.
- **A league switch that lands on the same player.** From Clark's WNBA page, NCAA Women opens Clark's college page (D35's switch keeps the screen; here it would keep the player). Needs the link and the other league downloaded; without it the switch offers the summary or the download.
- **Search across leagues.** Typing "Bueckers" in the WNBA finds her college page too, labelled with its league. Needs the other league's player names: a downloaded file, or the summary's names.
- **"Before the NBA" and "after college" on leaderboards and lists.** A column or tag on a professional board with the player's college team and last college season, and on a college board each player's professional team. Needs the link and the other side's team and season: summary, or both.
- **The draft on the college page.** "Drafted 2024, 13th, Connecticut Sun", including draftees who never played a professional game. Needs only the professional league's draft table (in its file, or `*_stats_draft`, 0.5 MB) and the name match of Part 1, step 3.
- **A class view.** The players of a draft class with their last college season beside their first professional ones. Needs both, or the summary for traditional lines.

All of these hold to D35: one league is shown; the other appears as a linked panel or a destination, never mixed into a ranking.

## What the numbers say about the ideas

- **"Download only that player" (the owner's).** The releases are one row group a file, so a player's lines cost exactly the seasons' files. The idea is not cheaper than "download those seasons", and it is worse offline and for the second player. What it promises (a quick look at one career without a whole league) is served better by one fetch of ESPN's season-stats files for the window: 0.2 to 0.5 MB for a professional league, every linked player at once. The full game log for a player is 0.1 to 0.6 MB a professional season, and could be offered as "that league's box scores for these seasons" (a few MB), with the depth of the full download clearly not included.
- **"One small summary file per league for every linked player" (the manager's).** Metis publishes nothing and has no server, so such a file would have to be built locally. It can be built only when both leagues are present, which is when it is least needed. The releases already publish the small per-league summary: ESPN's player season stats, keyed by the same id. Recommended in its place: fetch that file for the other league when the user asks, and keep a local summary built from the files when both are present, so a league deleted later still shows its linked careers.
- **One number that argues for the design's care:** a college page will rarely have a professional side (1 to 5 % of Division I players a season), and a professional page often will (379 of the NBA's players today). The college-to-professional direction is where the "not downloaded" choice will be met most.

## ESPN's season stats against Metis's own lines

Measured on 2026-11-21 for T1304.2, on the same four files, for every player whose ESPN id is in both leagues of a pair (the id links), in the seasons the paired download brings: the NBA from 2022-23, the WNBA from 2022, the colleges from 2021-22. ESPN's file is long, one row a stat (`category`, `stat_name`, `value`, with makes and attempts as text, `412-911`), and gives one line a player-season, every team together. Metis's line is `player_season` with `team_id` NULL, summed over the season types named. Exact equality per stat; minutes per game within 0.05.

**Postseason.** ESPN's professional season stats are the regular season alone, and its college season stats count every game, the tournaments included:

| League     | Lines | Games equal: regular season | Games equal: regular and play-in | Games equal: every counted type |
| ---------- | ----- | --------------------------- | -------------------------------- | ------------------------------- |
| NBA        | 868   | 829                         | 759                              | 612                             |
| WNBA       | 271   | 271                         | 271                              | 169                             |
| NCAA Men   | 834   | 264                         | 264                              | 834                             |
| NCAA Women | 405   | 53                          | 53                               | 405                             |

The NBA's play-in is not in ESPN's line, nor are the WNBA's playoffs or Commissioner's Cup final. The 39 NBA lines that differ on games are all of 2026-27, the season being played: ESPN's file was a day ahead of the box scores loaded (Ace Bailey 15 games against 14, and so on). A college line is the NCAA's count, as D45's default scope is.

**Per stat**, against the season types that match (professional: regular season, completed seasons; college: every counted game):

| League     | Lines | Games | Starts | Points | Rebounds | Off. reb. | Assists | Steals | Blocks | Turnovers | Fouls | FGM | FGA | 3PM | FTM | FTA | Minutes a game within 0.05   |
| ---------- | ----- | ----- | ------ | ------ | -------- | --------- | ------- | ------ | ------ | --------- | ----- | --- | --- | --- | --- | --- | ---------------------------- |
| NBA        | 651   | 651   | 651    | 651    | 649      | 651       | 651     | 651    | 651    | 649       | 651   | 651 | 650 | 651 | 651 | 651 | 656 of 829 (796 within 0.15) |
| WNBA       | 271   | 271   | 271    | 271    | 271      | 271       | 271     | 270    | 271    | 269       | 271   | 271 | 271 | 271 | 271 | 271 | 176 of 271 (253 within 0.15) |
| NCAA Men   | 834   | 834   | 816    | 833    | 833      | 833       | 831     | 833    | 832    | 833       | 833   | 833 | 833 | 833 | 833 | 833 | 794 of 834 (832 within 0.15) |
| NCAA Women | 405   | 405   | 388    | 404    | 404      | 404       | 404     | 404    | 404    | 404       | 404   | 404 | 404 | 404 | 404 | 404 | 382 of 405                   |

The differences are one count: a rebound, a turnover or an attempt (Chet Holmgren's 614 rebounds in 2025-26 against Metis's 615; Jabari Smith Jr.'s 975 attempts against 974), and starts, where ESPN counts one or two more than its own box scores mark (Devin Carter, 33 against 31 in 2023-24; Ta'Niya Latson 29 against 27). Minutes a game differ by rounding: ESPN's average is of whole minutes, Metis's of seconds, up to half a minute apart (a WNBA player's 4.3 against 4.5 in four games). No player's line is missing on either side.

**What it means for the screen:** a professional career read from ESPN's file is the regular season, and must say so; Metis's own lines carry the playoffs as separate season types. A college career from ESPN's file matches Metis's counted games. A user comparing the two would see the same points, rebounds and assists in 99.7 to 100 % of lines, a start or a tenth of a minute apart elsewhere. The current season's ESPN line can be a game ahead of Metis's own until the next refresh.

## What could not be measured

- Whether the 2026-27 college rows of players drafted from abroad (Nnaji, Niang, Ngoy, Claessens, Kane, Sivka, Ran) are those players: no birth date or ESPN id on the professional side.
- Whether ESPN will give the 2026 class's unplayed draftees the same athlete id they had in college: the evidence is the 222 who played, and the 2 who got a second id.
- The colleges of Nadia Fingall, Holly Winterburn, Peyton Williams and Kyra Lambert: no row of the name or id in the women's file.
- Download times on the owner's connection; the times above are from this machine.
- PRISM's contents (named, not opened).

## Rerunning

From the repository, with the stats files at the paths in `scripts/player-links-sql.mjs` (or `METIS_PRO`, `METIS_NCAAM`, `METIS_NCAAW`):

```bash
node scripts/player-links-sql.mjs scripts/player-links/02-known-players.sql
node scripts/player-links-sql.mjs scripts/player-links/04-id-at-scale.sql
node scripts/player-links-sql.mjs scripts/player-links/10-match-nba.sql scripts/player-links/11-misses-nba.sql
node scripts/player-links-sql.mjs scripts/player-links/10-match-nba.sql scripts/player-links/30-sample.sql
node scripts/player-links-sql.mjs scripts/player-links/20-match-wnba.sql scripts/player-links/30-sample.sql
node scripts/player-links-sql.mjs scripts/player-links/10-match-nba.sql scripts/player-links/50-reverse.sql
METIS_SCRATCH=/some/folder node scripts/player-links-sql.mjs scripts/player-links/41-local-summary.sql
node scripts/player-links-range.mjs --layout
```

The files are attached read-only; nothing is written to them. `player-links-range.mjs` makes about 270 HTTP requests to GitHub's release downloads, 3 seconds apart between cases.
