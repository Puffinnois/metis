# Stats screens: reference

What each screen shows and where its numbers come from. Screens are added here as they are built; the data they read is in [stats-database.md](stats-database.md).

## Shell

- **Nav:** Leaderboards, Players and Teams (their leaderboards, until the dashboards come in Stage 6), Explore and Games (not built yet), Glossary. Until the tables are built, every screen says what is loaded.
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

Eight boards, the top six of each: points, rebounds, assists, threes made, steals, blocks, true shooting, and team net rating. Per game or totals, per game first. Per game, a count needs 70 % of the most games anyone played in scope: the NBA's own rule is 58 of 82, and reading it from the result holds for a date range too. A rate needs its own sample. "All →" opens the full leaderboard sorted by that metric, in the same mode; a row opens it with that row selected. Saved views are listed above the boards.

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
