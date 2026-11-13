# Stats screens: reference

What each screen shows and where its numbers come from. Screens are added here as they are built; the data they read is in [stats-database.md](stats-database.md).

## Shell

- **Nav:** Leaderboards, Players, Teams, Standings, Explore, Games, Glossary. Players and Teams open a dashboard, with the leaderboards a click on from it. Until the tables are built, every screen says what the load is doing: loading, paused, out of disk space, or stopped until the next refresh.
- **Scope** (below): shared by every screen, and kept for the session.
- **A refresh that rebuilds the tables** (`status.builtAt` changes) re-reads the seasons and runs every query on screen again. A status line ticking through a load does not.
- **Status line** (`stats.status()`), read again as a load goes, at most once a second:

| It says                                               | When                                      |
| ----------------------------------------------------- | ----------------------------------------- |
| No stats yet                                          | Nothing is loaded, and nothing is running |
| Loading the stats · 412 of 3,070 files                | The first load, before any box score      |
| Data through Nov 4, 2026 · updating 71 of 3,070 files | A load or a refresh is running            |
| Data through Nov 4, 2026 · updated 2 h ago            | Nothing is running                        |
| Data through Nov 4, 2026 · paused, or Loading paused  | The owner paused                          |
| Not enough disk space                                 | The first load could not start            |
| Stats unavailable                                     | The stats database cannot be read         |

The status line opens the Data panel.

## Scope bar

- **Season:** every season with a box score, newest first, written `2025-26`.
- **Season type:** only those the season has box scores for: Regular season, Play-in, Playoffs, NBA Cup final, Regular season and after (when there is an after), All-Star (the 17 games ESPN has). Preseason games have no box score anywhere, so they are not offered. Another season falls back to the regular season if it does not have the type.
- **Range:** Whole season; Dates, two pickers held inside the season, starting on its first and last games; or Last games, the last 5, 10, 15, 20 or 30, of the player's own games or their team's. Moving to another season drops a date range, since its dates were the old season's.

## Leaderboards (home)

Eight boards, the top six of each: points, rebounds, assists, threes made, steals, blocks, true shooting, and team net rating. Per game or totals, per game first. Per game, a count needs 70 % of the most games anyone played in scope: the NBA's own rule is 58 of 82, and reading it from the result holds for a date range too. A rate needs its own sample. "All →" opens the full leaderboard sorted by that metric, in the same mode. A row opens that player's or team's dashboard. Saved views are listed above the boards.

## Players and Teams

A table per position group (All players, Guards, Forwards, Centers) or end of the floor (Offense, Defense), with default columns in named groups (`src/renderer/src/lib/stats/leaderboard.ts`).

| Shown            | From                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Value            | The metric after Totals, Per game, Per 36, Per 48 or Per 100. A ratio reads the same in each, a record stays a total, and minutes scale per game only                                                               |
| Shading          | Its percentile among the rows the tab qualifies, of the same position group, and above the metric's own sample (teams: the league): ≥ 90 / 75 / 60 green, ≤ 10 / 25 / 40 red; a metric with no better side unshaded |
| Hover on a value | Percentile, rank, the sample in words, "below the qualifying sample"; a gap's reason ("Recorded from 1996-97.")                                                                                                     |
| Column head      | Short label; hover: the catalogue entry (description, family, kind, sample and minimum, seasons, sources)                                                                                                           |
| G                | The row's games                                                                                                                                                                                                     |
| NQ               | Below 1,000 minutes per 82 games, scaled to the games in range. "Qualified only" (default) hides them. Teams always qualify                                                                                         |

- **Filters:** the mode, the moments of the game, Qualified only, team (players), search by name, which finds a name without its accents. Search filters the engine's rows, so percentiles stay among the whole position.
- **Moments of the game:** Whole game, or one split counted from the play by play (Plan T902): a quarter, a half, overtime, clutch, ahead, tied, behind, within 5, ahead or behind by 10+, the last 2 minutes of a period, the last 2 minutes or the last minute of the game, garbage time or the rest. It sits on the board, not on the scope bar: the bar is shared by every screen, and a split there would change every dashboard and the home boards at once. The rule is the first note under the table ("Clutch: The NBA's rule: the last 5 minutes of the 4th quarter or overtime, the score within 5."). Only the moments in the split count; a player's games are the games they had any of them in. A metric the plays cannot rebuild (tracking, hustle, play types, the NBA's dashboards, plus-minus, paint points) reads blank with "Not counted from the play by play, so it has no split." on hover, and a season before 1996-97 "Splits are counted from the play by play, from 1996-97.". The qualifying sample scales to the split's share of the time as well as to the games: clutch is about 3.7 of a team's 48 minutes a game in 2025-26, so it needs about 75 minutes where the whole game needs 1,000. A saved view keeps its moment.
- **Columns:** "Columns: this tab" or one family’s metrics (Traditional, Shooting, Possessions, Scoring, Composite, Tracking, Hustle, Play types, Matchups, Impact (SportsDataverse), Availability; the NBA’s advanced, misc, scoring, usage and defense dashboards sit in the first five); the column picker adds or removes any metric (at most 40); Reset.
- **Sort:** a column head (best first, then the other way), or the name. The engine sorts; the table shows 50 rows at a time.
- **Views:** a named board saved in `metis.db` (`stats_views`): entity, tab, columns, sort, mode, qualified only, team. The season and dates stay the screen's. Saving under an existing name, in any case, replaces it.
- **CSV:** every row the filters keep, not only the 50 shown: rank, name, team, position and id, games, then each column unformatted, percentages in percent. Saved where the dialog says (Downloads by default), UTF-8 with a byte-order mark so Excel reads accents.
- **Notes** under the table state what the answer depends on: a stat's first season, estimated possessions, a season with no All-Star Game.

## Player dashboard

Opens on the league's leading scorer per game in scope, and stays on whoever is chosen when the season or range changes. One set of tabs serves every position.

- **Rail:** a position (All, G, F, C), a search, a team and a metric to rank by. Those who qualify, best first, numbered among them, the value shaded by its percentile within their position. A search finds anyone in scope, and the player on screen is listed however far below the sample they are, marked NQ. ↑ and ↓, or J and K, move through it.
- **Header:** position, team that season (it opens the team), games in scope, "Not qualified" below the sample, the scope bar. Number, height, weight, birth date and school come from the NBA's latest roster line, so a player from before 1996-97 may have none. Initials stand in for a photo: Metis fetches none.
- **Mode:** Per game, Totals, Per 36, Per 48, Per 100, across the tabs and the rail. It opens per game.
- **Overview:** four tiles, the percentile rankings, points by game with the average dashed, and the career by season.
- **Scoring, Shooting, Playmaking, Rebounding, Defense:** titled lists of metrics, each with its value, its percentile bar and its rank among the qualified players of the position. A stat with no value says why ("Recorded from 1996-97."), one below its sample says that. Defense is what the box score has, with a Hustle section from 2016-17 (contested shots, deflections, charges drawn, loose balls, box outs, screen assists), published per season.
- **Shots:** from 1996-97, the NBA's shot chart file. A half court drawn to scale, in the dashboard's scope (season, season type, date range, last games), with a count of attempts and makes above it. Zones (the default) shades each of the six zones on the court by its FG% against what the league's regular-season rate in that zone would give the same attempts, in steps of 2, 5 and 9 points, with the zone's FG% and makes over attempts written in it; a zone with fewer than 5 attempts is not shaded. Shots draws every attempt, makes filled and misses as rings. Beside it, the zones as a table: makes, attempts, FG%, share of attempts and points against the league. Fewer than 20 attempts reads "Too few shots to chart", none "No shots in these games.", a season before 1996-97 "Recorded from 1996-97.". A scope of more than 20,000 attempts draws the newest 20,000 and counts every one, and a shot from beyond half court is counted but not drawn; the line above the chart says so. Under the chart, the shot metrics (profile, against the league, by distance, by type, assisted share) with their percentiles and ranks. ESPN's shots are never drawn.
- **Tracking, Play types, Matchups:** the NBA’s published per-season tables, one tab each. Tracking and Play types are for whole seasons only: a date range or the last games reads "Published for whole seasons only.", and a season before a table starts reads "Recorded from …" on every line. Tracking (from 2013-14) lists movement, touches, drives, passing, shot types, touches by area, rebounding and rim defense. Play types (from 2015-16) lists the eleven types on offense and defense: how often, points per possession and the rest. Matchups (from 2017-18) lists the player’s defensive minutes, what the players guarded did and the time on each position, then who they guarded most and who guarded them most ("Show all" lists every pair, a row opens that player). A whole regular season reads the season files: the pair file for the totals and the pairs, the rollup for the games and, in the current season, the totals. A whole playoff season reads the totals from the NBA's game matchups and the games from the rollup. A date range, the last games or any other scope adds up the NBA's game matchups (`game_matchups`, Plan T906) over the player's games in it, totals and pairs alike, playoffs, play-in and Cup final included; the note under the pairs says which. The time on each position has no game file behind it, so it reads "Published for whole seasons only." under a range.
- **Career:** the scope's game types over every season, whatever its range, on their last team that season. A season inside the career with no games reads "No games". The career line leaves out the average of a stat that started after the career did, since it would divide by games the stat was not recorded in; its total stands, and says from when.
- **Game log:** every game in scope, newest first, as recorded: date, opponent, team (a traded player's changes), result, minutes as a clock, made and attempted together. A dot marks a game off the bench, or one whose starters the source does not list. The total line is the engine's own, and the screen says so if the games ever stop adding up to it. A row opens the game.
- **Splits:** one engine query per split: home and road, wins and losses, started or off the bench, before and after the All-Star Game, rest, and the opponent's conference and division as that season had them; then the splits within games counted from the play by play (Plan T902), each group with its rule in a line under its title: By quarter (each quarter, each half, overtime), Clutch, Last minutes, By the score (ahead, tied, behind, within 5, ahead or behind by 10+), Garbage time (and the rest); then by month and by opponent. A split with no games is left out. No ranks: they would need every player's query per split, and a small split's rank says little. Under Last games, each split reads its own last N: for a play split, the last N games, then the split within them. Plus-minus reads blank under a play split, and the note says so; before 1996-97 the play splits are left out with a line saying from when.

- **Profile:** the same whatever the scope, so it has no mode. The bio from the NBA's latest roster line that lists the player (born, age as that roster prints it, size, position, number, school, experience, how acquired), the draft (year, round and pick, team, where from), then the draft combine. Each combine measure has its value, a percentile bar among the same position group at every combine from 2000, and a rank where it has a better side; a measurement is shaded as having none. A test the player has no result in reads blank with "No result at the 2018 combine.", one not held that year "Not held at the 2018 combine.", and a part of the combine not held, or with no result at all, is one sentence under it. A player who went to more than one combine picks the year, newest first. The draft files begin with 1996, so a player not in them is "Not in the drafts of 1996 to 2026.", never undrafted.
- **Injury report tag:** in the header, the player's status on the newest official report of the newest season that lists their team's players: "Out · right hip strain · report of Nov 9", coloured by status. A player that report does not list has no tag. It is a published status, never a forecast; the hover says so, with the date of the game the report is for.

- **On/off** (before Profile, after the tabs older step files click by place): the team's numbers with the player on and off the floor, counted from the play by play: minutes and possessions on, plus-minus, pace, offensive, defensive and net rating on, off and on less off. Then the actual on-court rates, each beside the box score's estimate (usage, assist, rebound, steal and block percentages), and the team on the floor (eFG% for and against, turnover and offensive rebound percentages). Ranks and percentiles as on the other tabs. A date range or the last games reads exactly. Then **With or without**: a teammate (most minutes together first) and four rows, both on, each without the other, neither, with minutes, possessions, plus-minus, ratings, pace and four factors, in the games both played. Every number is marked derived, not official; before 1996-97 it reads "Counted from 1996-97, when the NBA's play by play starts."

A player with no games in scope says so, and keeps their career.

## Team dashboard

Opens on the best record in scope, and stays on whoever is chosen when the season or range changes. A franchise is one NBA id across its moves, so moving from 2008-09 to 2007-08 turns Oklahoma City into Seattle. A season it did not play says so.

- **Header:** the team, its record, points, points allowed and margin from the final scores of the games in scope, so a game with no box score still counts. Its place in the conference and division, from the published standings, in the regular season.
- **Coaches:** under the record, the head coach (both, with "and", in a season it changed, since the file has no dates) and the assistants for the season in scope, or "No head coach listed" where the NBA's file has no row. The Players tab marks a player the latest report lists as anything but Available, with the status and the full line on hover, in the newest season only.
- **Results strip:** the latest 15 games played in scope, then the next ones. A card opens the game.
- **Mode:** Per game, Totals, Per 36, Per 48, Per 100, across the stat tabs.
- **Overview:** who scores, per game, with their share of the team's points in the games they played, ordered by total points so one big night does not lead the team. The ratings, the next game, the margin by game, and the franchise by season under each season's name; a row opens that season.
- **Offense, Defense:** titled lists of metrics with their percentile and rank among the teams. A stat with no value says why.
- **Shots:** the player dashboard's Shots tab for the team, with "Their shots" or "Shots against": the shots the team's opponents took against it, where opponents below the league is shaded as the good side. The metrics below rank among the teams.
- **Players:** everyone who played for the team in scope, most minutes first: a traded player's games here, not their season.
- **Splits:** the team's games split as the player's are (home and road, wins and losses, before and after the All-Star Game, rest, the opponent's conference and division), then the same play splits, then by month and by opponent: points for and against, offensive, defensive and net rating, pace, the four factors. Under a play split, possessions are counted from the plays (SportsDataverse's derived possessions), not estimated, and the note says so. Added with Plan T902: the team dashboard had no Splits tab before.
- **Lineups:** the team's five-man units for the season in scope, as the NBA publishes them, one dashboard's columns at a time: Base, Advanced, Four factors, Misc, Scoring, Opponent. Each row has the five players (a name opens that player), games and minutes together. The mode applies to the counts: totals, per game, per 36 and per 48 minutes, per 100 possessions (the advanced file's possessions; blank with its reason where the unit is not in that file). Ratings and shares read as published. Click a head to sort, either way, blanks last. The minimum-minutes control starts at 25, and the list shows 15 with "Show all". A unit a file does not list reads — with its reason on hover. The regular season lists only the league's 2,000 units with the most minutes, and the screen says where that floor is. A unit is a whole season: a date range or the last games reads "Published for whole seasons only.", seasons before 2007-08 "Recorded from 2007-08.", and Regular season and after asks for one of the two. A **Source** control above it chooses **Published** (the NBA's, as above) or **From possessions**: Metis's own count from the play by play, every group in every season from 1996-97, of five, four, three or two players, with games, minutes, possessions, plus-minus, ratings, pace and four factors, a minimum-possessions control (50 to start), sorting either way and 15 rows before "Show all". It answers the scope's season types, a date range and the team's last games, and says it is derived, not official.
- **On/off** (last): each player who played for the team in scope, most minutes first, with their minutes and possessions on the floor, plus-minus, ratings on, net off and on less off; a row opens the player. Derived, not official, and off the floor is the rest of the player's own games.
- **Schedule:** every game in the scope's season type, with the result and the record after it. A game past its day with no score reads "Not played", like the one cancelled in 2013. A row opens the game.

## Standings

The NBA's published standings of a season, regular season only, by conference or by division. Nothing is recomputed. A row opens the team.

| Shown          | From                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| Rank           | `playoff_rank` or `division_rank`, as published: ties in old seasons stay ties           |
| GB             | `conference_games_back` or `division_games_back`; the leader reads as a dash             |
| Home, Road     | As published                                                                             |
| Div, Conf      | As published, except 2003-04, whose file repeats the overall record: they read as a dash |
| L10, Strk      | From 2001-02. Before it they read as a dash, and the screen says so                      |
| PPG, Opp, Diff | As published                                                                             |

Published standings start in 1995-96, so 1993-94 and 1994-95 say that and show no table. Division tables read as four through 2003-04 and six after. The clinch marks are left off: see the traps in [nba-data-sources.md](nba-data-sources.md).

## Games

A day's games on a date rail, in place of the template's weeks. Opens on the latest day a game that counts was played, and a game opened from a log or a schedule opens on its day.

- **Rail:** the season, the day (a list of days with a game, and the day before or after), then that day's games: away over home, the winner in bold, its type if not the regular season, overtime, "Not played".
- **Header:** each team's name, score, its record and last five results before this game in the same kind of game, then the status (Final, Final/OT, Not played, Scheduled), the date, ESPN's note ("NBA Finals - Game 5"), the arena and the crowd. A team opens its dashboard.
- **Officials:** under the header, "Officials: …" from the NBA's file, or "The NBA's file lists no officials for this game." (before 2003-04 most games). A name opens that official's seasons.
- **Score by period:** when ESPN has it and it adds up to the final score: through 2000-01 and from 2019-20.
- **Box score:** one table a team, starters then bench, with minutes as a clock and made and attempted together. A player opens their dashboard. The totals are the team's own box score, and points the final score. With nobody flagged as starting, one list says who started is not listed. When the players' lines do not add up to the final score, the screen says so: 36 of 83,516 team-games.
- **The teams:** twelve lines side by side, the better side in bold, with the reason where a stat did not exist yet.
- **No box score:** preseason games have none in either source, and some old games and All-Star games have only a score, so the screen says that. It never fabricates a line.
- **Who guarded whom:** under the box scores, from 2017-18, the game's pairs from the NBA's game matchups, one table for each side on defense, away first: the defender, the player guarded with the position the file lists for them, the time as a clock, partial possessions, and what the player on offense did while assigned (points, field goals, threes, free throws, assists, turnovers, blocks). Longest first, 15 a side and "Show every pair". Either name opens that player. Before 2017-18 it reads "Tracked from 2017-18."; a played game the file lacks reads "The NBA’s file has no matchups for this game." (8 of 1,230 in 2017-18, none from 2022-23).

The engine reads one game by its id. A date and teams would not do: All-Star round robins play more than once a day.

### Officials

"Officials of 2025-26" under the rail's day count switches the page from the game to the season's officials, and back. The rail stays, so a game is one click away.

- **A season's officials:** every official the NBA's file lists for the season and the season type chosen beside the heading (regular season, play-in, playoffs, Cup final, or all of them), in order of games worked, then name: no column orders the list, so nothing reads as a ranking. The league's line comes first, over every game of the same season and types. A name opens that official's seasons.
- **An official's seasons:** newest first, each season's line with the league's line for the same season and types just below it, so the reader sees the ordinary spread. "The game" or "Officials" returns to where they came from.
- **The columns:** games worked with both box scores; personal fouls and free-throw attempts per game, both teams together; fouls and free-throw attempts per game by the home side and by the away side; points per game, both teams; and the share of the games the home side won. Each is a sum over the games divided when read (`lib/stats/officials.ts`), from the box scores (`team_game`) and the game's final score.
- **Copy:** the notes under the table say the numbers describe the games an official worked, as the box scores record them, not who made each call; that every official of a crew counts the same game; and that a line of fewer than 20 games is marked "N games: few", since over a handful of games a rate moves a long way. Nothing calls an official best, worst, strict or lenient, or speaks of favouring a side.
- **Coverage:** the line under the heading says how many played games have a crew listed and the crews' sizes ("1,227 of 1,230 games have a crew listed; crews of 3 on 1,227."). Before 2003-04 the file has a crew for 0 to 8.6 % of a season's games, so the officials are still listed with their games but every rate reads — with "Crews are listed for 17 of 1,189 games in 1999-00; rates start in 2003-04.", in the season list and on each such line of an official's seasons.

Read by two calls beside the engine, `stats.officialsSeason` and `stats.officialCareer` (`src/main/stats/officialsReads.ts`), and the game's pairs by `stats.gameMatchups` (`matchupReads.ts`). On the full database, inside the worker: a game's pairs 47 ms, a player's pairs over the last 10 games 39 ms, a season's officials 188 ms, an official's seasons 391 ms.

## Explore

Chart, Compare and Trends as three tabs over the shared scope bar. Explore opens on Chart; the tab and each tab's state are kept for the session, so leaving for a dashboard and coming back finds them as they were. Back returns to the page before, not to the previous tab. Each tab is its own screen (`StatsChart`, `StatsCompare`, `StatsTrends`) with its state in `lib/stats/{chart,compare,trends}.ts`. Other screens reach Explore through two entries: Compare with a list of players or teams, and Trends on one player or team, optionally on a metric. Trends with nobody picked shows the player or team a dashboard showed last.

The scope bar has no mode, so each tab carries the dashboards' own control (Per game, Totals, Per 36, Per 48, Per 100), kept per tab. A rate is the engine's ratio of sums and reads the same in every mode; Trends shows the control only for a total the mode rescales. The scenario steps for all three tabs are in `scripts/stage8-steps.json`.

### Chart

Any metric against another, for the players at a position (All, G, F, C) or the 30 teams, in the scope bar's scope. One engine query reads the axes, size, colour and the qualifier for every row; nothing new is stored.

- **Presets:** players, usage against true shooting, three-point attempts against percentage, assist percentage against turnover percentage, and drives against points per drive (tracking, from 2013-14); teams, offensive against defensive rating, pace against net rating, three-point rate against true shooting. Any catalogue metric can go on either axis, and the axes swap.
- **Qualified:** the leaderboards' rule. A player needs enough minutes for the games in scope, and a row needs enough of each axis's own sample. "Qualified only" can be turned off, as on the leaderboards, and unqualified rows are greyed with NQ. Percentiles are among the qualified of the same position.
- **Size and colour:** size by a metric's percentile; colour by a metric's percentile, or by a category: the roster's position for players (G, F, C, grey when the roster gives none), the conference for teams. Only metrics with a better side can size or colour.
- **The plot:** a lower-is-better axis runs reversed, so up and right is better on both, and the corners say so in words. The dashed lines are the qualified means, and r is worked with both axes oriented the same way. The searched and the picked are labelled, then the eight players farthest from the crowd, or every team.
- **Clicks:** a dot or a table row opens the dashboard, and Back returns to the chart as it was. Shift-click picks up to three, and "Compare these" opens them in Compare.
- **Too few qualifiers:** under 10 dots the chart says how many qualify, in what scope, and why: "4 centers qualify on both axes in the 2025-26 play-in. A scatter needs at least 10: …". It offers the whole season when a range is set, and "Show all 14 centers" when more have values.
- **No values:** an axis the scope cannot answer shows the engine's reason instead of an empty plot: "Drives: Published for whole seasons only." under a date range or last games, with a button back to the whole season, and "Drives: Recorded from 2013-14." before then.
- **Row limit:** the engine returns at most 5,000 rows. A season's players are about 600, but if a query ever stops short, the chart says how many rows it left out.

Measured on the clean Stage 7 load (`scripts/stage8-steps.json`), timed through `window.api` from the renderer, with the engine's own time in brackets: players usage and true shooting 72 ms (58), three-pointers 62 (49), points, drives, assists and true shooting per game 73 (57) and in totals 76 (59), the same under a date range 44 (29), the last 10 games 48 (36), centers in the play-in 30 (25), and teams with three metrics 22 (17). A second run read 56 to 99 ms (41 to 75).

### Compare

Three slots side by side, all players or all teams, one row per metric and one column per slot (`StatsCompare`, `lib/stats/compare.ts`).

- **Slots:** each is filled from a search over the rows in scope, which finds a name without its accents (a team by name or code), and can be removed or replaced; someone already in a slot is not offered again. Switching between Players and Teams clears the slots. On the first visit the open slots take the three leaders who qualify (points per game, or net rating). A slot's name opens that player's or team's dashboard. The slots, kind, seasons, mode and rows are kept for the session.
- **From the dashboards:** a Compare button on the player and team dashboard headers opens Compare with that player or team in the first open slot (the last slot when all three are taken; a player opened over teams clears them). Back returns to the dashboard.
- **Seasons:** the scope bar's season, or the last 3, 5 or 10 seasons up to it, or every season up to it, each offered only when it reaches further back. Over several seasons the scope bar's date range or last games, which belong to one season, are not applied: the seasons are read whole, and a note says so.
- **Mode:** the shared control above; a rate is the ratio of sums over the slot's games, never an average of per-game values.
- **Rows:** the core metrics of Traditional, Shooting and Composite for players (23 rows), of Traditional, Shooting and Possessions for teams (40). "Add a family" appends a family's columns as the leaderboards define them, and the column picker adds or removes any metric, at most 40; Reset returns to the defaults. Players always keep Minutes, which qualifies them. Rows are grouped by family.
- **Best value:** bold, read the metric's way (fewer turnovers, fouls or points allowed, a lower defensive rating), at the precision shown, so two values that read alike tie and both are bold. A metric with no better side, a tie between every value, or a row with fewer than two values marks nothing. Each slot's card says how many rows it leads of those that can be led.
- **Ranks:** for one season, the query asks for every player or team in scope, so each slot shows the percentile bar and rank of the dashboards: a player among the qualified players of their own position (`rankWithinTab`), a team among the league. Over several seasons the query asks for the three slots alone, since a pool over a span would mix careers, and no ranks are shown. A player below the minutes asked is marked NQ and has none.
- **Blanks:** never a zero. A metric with no value in scope for any slot reads its reason across the row ("Recorded from 2013-14.", "Published for whole seasons only."). Over several seasons a slot whose own seasons all predate a metric reads blank with "Recorded from 2013-14." on hover; one whose seasons start before it shows the value over the covered seasons with "Recorded from 2013-14 only.", except a game-level count in a rate mode, which would divide by games it was not recorded in and reads blank with that reason. A slot with no games, or no sample, says so.
- **Queries:** one engine query for the three slots, plus one for the search over several seasons while it is open. On the full database, inside the worker (median of five): a 2025-26 league of players with the default rows 269 ms, the same with a date range 154 ms, last 10 games 166 ms, with tracking, play-type and impact rows 267 ms; three players over 5 seasons 199 ms, over every season 256 ms; 2025-26 teams 177 ms, three teams over every season 173 ms; the search over every season 44 ms.

### Trends

One metric by season across a player's career or a team's history in the data, 1993-94 on, against the league each season.

- **Who:** a search over every player with a game since 1993-94 ("LeBron James · LAL") or every franchise under its latest name. With nobody picked, the player or team a dashboard showed last; a choice here keeps them even when the dashboards move on. The header links to their dashboard.
- **What:** any catalogue metric read per season, by family, except a published projection (one season's state, meaningless across several). Points per game for players and net rating for teams by default.
- **Scope:** the scope bar's season type applies (regular season, playoffs and the rest); its season and range do not, since a career is every season, and the screen says so. The scope bar offers the season types of the season it shows, so the playoffs are offered once a season that has them is picked.
- **Mode:** the shared control above, shown only for a total the mode rescales.
- **The line:** a point a season. A traded player's season is one point, their whole season, with their teams named in the order they played for them. A season not played is a gap, never a line drawn across it. Before a metric is recorded the seasons read blank, never zero, and a rule marks the start with the metric's own reason ("Recorded from 2013-14."). A season below the qualifier is a hollow point with no rank, as the leaderboards leave it unranked. A lower-is-better metric runs upside down, so up is always better.
- **The league:** behind the line, each season's qualified pool: its 10th–90th and 25th–75th percentiles and its median, interpolated as DuckDB's `quantile_cont`. The pool is the leaderboard's: players the minutes qualifier admits (1,000 minutes over 82 games, scaled to that season's games) whose sample also qualifies for the metric (three-point attempts for 3P%, field-goal attempts for FG%, scaled the same way), or every team. Both rules are the engine's own `qualified` flags, read as the leaderboard's `rankWithinTab` reads them. The hover reads the band as numbers.
- **Rank:** each season in its own pool, the better side first, ties sharing a rank, the percentile as `percent_rank`: "7th of 143". On the hover and in the table under the chart, newest first, with the teams, games and minutes.
- **Notes:** where the metric starts, seasons the source lacks, why it has no answer (a published metric in the play-in), and a total for the season under way ("2026-27 is in progress."). Lockout and shortened seasons need nothing for rates.
- **Queries:** the subject by season, their teams by season, team and month, and the pool by season. A season has about 260 qualified players and the engine returns 5,000 rows at most, so the pool is asked for in parts of 14 seasons, run together. A part cut off at the limit is asked for again in halves, down to one season; a single season still cut off reads "Too many players to read the league in 2014-15: no band or rank." and has neither, rather than wrong ones. The search is one query of every player's minutes.
- **Left out from the template:** the two comparison lines, the "Career at a glance" cards, ages under the seasons and team marks on the axis (the teams are on the hover and in the table).

## Glossary

Every metric, players or teams, by family or search, with the same entry as the column hover.

## Speed

Measured in the real window on the full database, from a click to its table on screen, rendering included.

| Click                          | ms      |
| ------------------------------ | ------- |
| Leaderboards, all eight boards | 84      |
| Players, or All players        | 323–325 |
| Per game, Totals               | 327     |
| A position tab                 | 234     |
| Sort by a column               | 313     |
| Another season                 | 274–291 |
| Last 10 games                  | 230     |
| A family of columns            | 252     |
| Teams                          | 92      |
| Defense                        | 76      |
| Glossary                       | 27      |

The Shots tab's read, from `scripts/check-shots.mjs` on the full database, in the worker, warm, median of five: a player's season 38 ms, a date range 36 ms, a team's season 52 ms and its shots against 60 ms, a career from 1996-97 (20,000 of its shots drawn) 112 ms. A leaderboard of ten shot zone metrics for 2025-26 answers in 114 ms, the same over a date range in 32 ms, a team board of both sides in 19 ms. A run on a busy machine read up to three times as long (253 ms for the career, 218 for the leaderboard).

Five of these clicks took 103 to 389 ms during play by play, the heaviest writes of a first load. The boards were on screen 175 seconds into a first load, and a screen never waits for the rest.

The dashboards, measured the same way on a clean load's database with `scripts/stage6-speed-steps.json`. Where a screen has several queries, the time is until all of them are on screen.

| Click                               | ms       |
| ----------------------------------- | -------- |
| Players, the dashboard              | 377      |
| A player from the rail              | 315      |
| Scoring, Shooting                   | 262, 230 |
| Playmaking, Rebounding, Defense     | 144–160  |
| Game log, 8 games and a full season | 154, 383 |
| Splits, 8 games and a full season   | 302, 353 |
| Overview, another season            | 295–296  |
| Teams, the dashboard                | 175      |
| Offense, Defense, Players           | 148–223  |
| Schedule                            | 36       |
| Next team, another season           | 132–172  |
| Standings, another season           | 62–71    |
| Games, with a box score             | 217      |
| The day before, a day of the season | 152–156  |
| Another of the day's games          | 151      |
| Another season, Games               | 228      |

The player dashboard was on screen 219 seconds into a first load, on the current season, with a team dashboard and a box score just after.

Trends' queries, timed from the window (`window.api.stats.query`, round trip) on the full Stage 7 load with `scripts/stage8-steps.json`. The pool's parts run together, so the screen waits for the slowest.

| Trends                                          | Rows                | ms           |
| ----------------------------------------------- | ------------------- | ------------ |
| LeBron's pool, first of the session (cold)      | 3,648, 2,730        | 179, 118     |
| The same again (warm)                           | 3,648, 2,730        | 148, 111     |
| Every season, 1993-94 on, in 3 parts            | 3,423, 3,746, 1,616 | 127, 160, 79 |
| LeBron James, points per game: his seasons      | 24                  | 57           |
| His teams by season, team and month             | 156                 | 41           |
| The pool, 2003-04 to 2016-17 and 2017-18 on     | 3,648, 2,730        | 140, 161     |
| Drives: the pool, two parts                     | 3,648, 2,730        | 125, 96      |
| Playoffs, points per game: the pool, two parts  | 1,543, 766          | 85, 49       |
| Lakers, defensive rating: the history, the pool | 34, 1,005           | 21, 34       |
| The player search                               | 3,091               | 71           |

The splits within games (Plan T902), timed through the worker on the full load, warm: a season's leaderboard of 16 columns under clutch, 109 ms (176 for the whole game on the same run); a player's 19 play splits at once, as the Splits tab asks them beside its game splits, 230 ms; a team's, 187 ms. The rest are in [nba-data-sources.md](nba-data-sources.md), "Splits from plays". The scenario steps are in `scripts/stage9-splits-steps.json`.

The on-court reads (Plan T904), timed in the worker on the full database with `scripts/on-off-speed.mjs`, warm, 2025-26, the median and the worst of seven, with sibling builds running on the same machine. The On/off tab's sections are a query each, so the tab waits for the slower.

| Read                                                | Rows  | Median ms | Worst ms |
| --------------------------------------------------- | ----- | --------- | -------- |
| On/off tab: 13 metrics over every guard             | 278   | 149       | 203      |
| On/off tab: 14 actual and estimated rates           | 278   | 323       | 432      |
| On/off tab, a month                                 | 224   | 155       | 210      |
| A leaderboard: net on-off and ten box-score columns | 100   | 285       | 377      |
| Every season, net on-off by season                  | 5,000 | 313       | 383      |
| The team's On/off tab                               | 20    | 93        | 105      |
| Units of five                                       | 770   | 89        | 200      |
| Units of four                                       | 1,249 | 160       | 272      |
| Units of three                                      | 653   | 186       | 252      |
| Units of two                                        | 159   | 79        | 136      |
| Units of five, the last 10 games                    | 132   | 68        | 100      |
| With or without, the first teammate                 | 4     | 166       | 270      |

## Data panel

What is loaded, from `stats.data()`. It reads again as a load goes.

- **Header:** files loaded of those published, the database's size on disk, the free space beside it. Pause while something is running; Resume while paused.
- **Pause** stops a load at once and holds off any other, across launches, until Resume. The step it stopped is not counted as an attempt.
- **Not enough room:** a first load needs 6 GB free, the limit in D22, less what is already on disk. Without it, the load does not start and the panel says what it needs and what is free. Once the database has passed 4 GB, a refresh needs no check.
- **One row per release of the dataset,** grouped by load tier, in load order: its name, the seasons held, files loaded of those published, the size as downloaded, when it was last fetched, its state.
- **State:** Loaded, Part loaded, Waiting, or Failed with the latest error still standing. A file not published yet, such as the current season's playoffs, does not count as missing.
- **Credit:** the data's source, with a link.
