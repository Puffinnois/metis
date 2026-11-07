# Stats screens: reference

What each screen shows and where its numbers come from. Screens are added here as they are built; the data they read is in [stats-database.md](stats-database.md).

## Shell

- **Nav:** Leaderboards, Players, Teams, Standings, Explore and Games (not built yet), Glossary. Players and Teams open a dashboard, with the leaderboards a click on from it. Until the tables are built, every screen says what is loaded.
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

- **Filters:** the mode, Qualified only, team (players), search by name, which finds a name without its accents. Search filters the engine's rows, so percentiles stay among the whole position.
- **Columns:** "Columns: this tab" or one family's metrics (Traditional, Shooting, Possessions, Scoring, Composite); the column picker adds or removes any metric (at most 40); Reset.
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
- **Scoring, Shooting, Playmaking, Rebounding, Defense:** titled lists of metrics, each with its value, its percentile bar and its rank among the qualified players of the position. A stat with no value says why ("Recorded from 1996-97."), one below its sample says that. Defense is what the box score has; tracking arrives in Plan T703.
- **Career:** the scope's game types over every season, whatever its range, on their last team that season. A season inside the career with no games reads "No games". The career line leaves out the average of a stat that started after the career did, since it would divide by games the stat was not recorded in; its total stands, and says from when.
- **Game log:** every game in scope, newest first, as recorded: date, opponent, team (a traded player's changes), result, minutes as a clock, made and attempted together. A dot marks a game off the bench, or one whose starters the source does not list. The total line is the engine's own, and the screen says so if the games ever stop adding up to it. A row opens the game.
- **Splits:** one engine query per split: home and road, wins and losses, started or off the bench, before and after the All-Star Game, rest, and the opponent's conference and division as that season had them; then by month and by opponent. A split with no games is left out. No ranks: they would need every player's query per split, and a small split's rank says little. Under Last games, each split reads its own last N.

A player with no games in scope says so, and keeps their career.

## Team dashboard

Opens on the best record in scope, and stays on whoever is chosen when the season or range changes. A franchise is one NBA id across its moves, so moving from 2008-09 to 2007-08 turns Oklahoma City into Seattle. A season it did not play says so.

- **Header:** the team, its record, points, points allowed and margin from the final scores of the games in scope, so a game with no box score still counts. Its place in the conference and division, from the published standings, in the regular season.
- **Results strip:** the latest 15 games played in scope, then the next ones. A card opens the game.
- **Mode:** Per game, Totals, Per 36, Per 48, Per 100, across the stat tabs.
- **Overview:** who scores, per game, with their share of the team's points in the games they played, ordered by total points so one big night does not lead the team. The ratings, the next game, the margin by game, and the franchise by season under each season's name; a row opens that season.
- **Offense, Defense:** titled lists of metrics with their percentile and rank among the teams. A stat with no value says why.
- **Players:** everyone who played for the team in scope, most minutes first: a traded player's games here, not their season.
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

Five of these clicks took 103 to 389 ms during play by play, the heaviest writes of a first load. The boards were on screen 175 seconds into a first load, and a screen never waits for the rest.

## Data panel

What is loaded, from `stats.data()`. It reads again as a load goes.

- **Header:** files loaded of those published, the database's size on disk, the free space beside it. Pause while something is running; Resume while paused.
- **Pause** stops a load at once and holds off any other, across launches, until Resume. The step it stopped is not counted as an attempt.
- **Not enough room:** a first load needs 6 GB free, the limit in D22, less what is already on disk. Without it, the load does not start and the panel says what it needs and what is free. Once the database has passed 4 GB, a refresh needs no check.
- **One row per release of the dataset,** grouped by load tier, in load order: its name, the seasons held, files loaded of those published, the size as downloaded, when it was last fetched, its state.
- **State:** Loaded, Part loaded, Waiting, or Failed with the latest error still standing. A file not published yet, such as the current season's playoffs, does not count as missing.
- **Credit:** the data's source, with a link.
