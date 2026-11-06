# Stats database: data reference

`stats.duckdb` holds every table the NBA dataset publishes, every season, in one DuckDB file beside `metis.db`. Deleting the file makes the next refresh rebuild it. What the files are and what was measured about them is in [nba-data-sources.md](nba-data-sources.md); which seasons really hold values is in [nba-coverage.md](nba-coverage.md).

## Engine

- One worker thread (`out/main/statsWorker.js`, `src/main/stats/worker.ts`) owns the file. The main process talks to it through `StatsClient` (`src/main/stats/client.ts`): `refresh`, `status`, `query`, `catalogue`, `seasons`, `selfTest`, `close`. Scripts also use `read`, which runs one SQL statement; the app does not expose it.
- Writes run one after another. Reads run at once, each on its own connection, so a screen never waits behind a refresh.
- DuckDB `@duckdb/node-api` 1.5.6. Parquet, JSON and ICU are built in, and no extension is ever downloaded.
- Settings: `memory_limit` 1 GB, 2 threads, `preserve_insertion_order` off, spill files in `<userData>/stats-tmp/duckdb`.

**Why 1 GB.** The template's 512 MB failed during the first full load: a checkpoint could not pin a block, and DuckDB invalidated the database. A checkpoint pins buffers per column, and these files are far wider than the template's. Reopening the file recovers it, with nothing lost, and the load carries on. 768 MB passed a whole load, so 1 GB leaves room. If it ever happens, the refresh stops, the status reads as stats unavailable, and the next launch recovers.

## Source tables

Each file family in `src/main/stats/sources.ts` loads into one table, named `src_espn_*`, `src_nba_*`, `src_dash_*` (the league dashboards), `src_xwalk_*` (the crosswalks) or by what it holds (`src_team_aliases`).

Every column is kept as published and typed, zeros included. When a later season adds a column, it is added to the table. When a column's type changes between seasons, it is widened (two integer types to `BIGINT`, other numbers to `DOUBLE`, anything else to `VARCHAR`), and the step's message says so.

Three columns are standard:

| Column        | Holds                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `season`      | The file's own value as an `INTEGER`, or the label in the file's name when it has none. It is never overwritten: see the trap in the data reference. |
| `file_season` | The label in the file's name, on season files. It is what a reload replaces.                                                                         |
| `source_file` | The file's stem, on tables that hold several files of a season (play types, hustle, matchups).                                                       |

Season types and team codes stay as published here. They are mapped in the `game` and `team` tables (D27).

## Identity

Built by `src/main/stats/identity.ts`, logged as `stats:identity`, as soon as the core tier has loaded and whenever it changes after that. A new `IDENTITY_VERSION` rebuilds it with nothing downloaded.

| Table        | One row per        | Holds                                                                                                                                                             |
| ------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game`       | game of the league | `game_id` (the NBA's id, or `espn:<id>` before 1996-97), `nba_game_id`, `espn_game_id`, `season`, `game_type`, `game_date`, teams on NBA ids, the score, `played` |
| `team`       | team in a season   | NBA `team_id`, `espn_team_id`, `code`, `name`, `conference`, `division`                                                                                           |
| `player_ids` | ESPN id            | `player_id`, and the `method` that found it                                                                                                                       |
| `player`     | person             | `player_id`, `name`, `espn_athlete_id`, `method`, `first_season`, `last_season`                                                                                   |

- **Game types** (D12): `regular`, `play-in`, `playoffs`, `cup-final`, `all-star`, `preseason`. From 1996-97 the prefix of the NBA's game id decides. Before it, ESPN's season type, with a game against a touring team counted as `preseason`.
- **What is a game:** the NBA's schedule from 1996-97, ESPN's before. ESPN's rows for postponed games are left out. `played` is false for a game not played, including the one cancelled in 2013.
- **Linking the sources:** the crosswalk, then the same teams within a day.
- **Teams:** `nba_team_aliases` maps ESPN's ids by season, so one NBA id follows a franchise across a move, and ESPN's id 3 is Charlotte through 2001-02 and New Orleans after it.
- **Players**, first hit wins (D28):
  1. the crosswalk;
  2. the same box-score lines in the same games, with at least two lines that are not all zeros and a clear winner;
  3. the same name in the same season, when only one player has it.

  Anyone left gets the negative of their ESPN id: 200 players, of whom one has a line from 1996-97 on.

- **Reading ESPN's box scores:** add `season = file_season`, or the games of 1998-99 count twice.
- **Reading team totals:** the NBA's box score, or ESPN's players summed before 1996-97. Never ESPN's team rebound and turnover columns.

## Game and season tables

Built by `src/main/stats/derived/`, logged as `stats:derived`, right after identity and whenever it runs. A new `DERIVED_VERSION` rebuilds them with nothing downloaded. Each replaces the old table in one statement, so a screen reads the old rows or the new ones. The build takes 14 seconds on the full database.

| Table           | One row per                                     | Holds                                                                                                                 |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `team_game`     | team in a game played                           | Its box score beside the opponent's (`opp_`), the score, estimated possessions, ESPN's points by kind, game context   |
| `player_game`   | player in a game they appeared in               | Their box score, whether they started, their position group, the team's and opponent's totals, the game context       |
| `team_season`   | team, season and game type                      | `team_game` summed                                                                                                    |
| `player_season` | player, season, game type and team, and no team | `player_game` summed. The row with no team is the whole season: a traded player's is never the sum read beside others |

No rate is stored. Every column is a count or a sum over the same games, divided when read, so any date range or group of games is exact.

- **Which box score:** the NBA's wherever it has the game, which is everything counted from 1996-97. ESPN's before that, and for the 17 All-Star games it has. Preseason games have no box score anywhere, so they are in `team_game` with a score and `box_games` 0, and in `player_game` not at all.
- **Team totals:** the NBA's team box score, which equals its players on every count (one game aside). Before 1996-97 ESPN's players summed, never ESPN's team columns. Those totals have only player-charged turnovers: team turnovers are not in this box score.
- **A game with no box score** (26 team-games before 1996-97) still counts toward a record: `games` and `box_games` differ, and points for and against come from the schedule.
- **Appearing:** the NBA's non-empty `minutes`, or an ESPN line with minutes and not marked as not played. `seconds` reads `6:34`, `240:00` and the bare `26` on 88 old lines.
- **Started:** the NBA's position from 2017-18, when it lists one for starters only; ESPN's flag before it. A team-game without exactly five flagged reads NULL: unknown, not all bench. `starts_known` counts the team-games where it is known, so bench points can be per game of those.
- **Position group** (`G`, `F`, `C`): the NBA's roster that season, then what its box scores list most, then ESPN's. A hybrid takes the first listed: `G-F` is a guard, `F-C` a forward, `C-F` a center.
- **Possessions are estimates:** `poss` and `opp_poss` are `FGA + 0.44 FTA - OREB + TOV` for each side, `poss_sym` their mean, `poss_bref` the rebound-adjusted form. See reference section 5.
- **Estimated on-court totals:** `x_*_den` and `on_poss` are what a player's team did while they played, guessed game by game from their share of its minutes (`5 × seconds / team seconds`), for Basketball-Reference's AST%, ORB%, DRB%, TRB%, STL%, BLK% and USG%.
- **`rest_days`:** full days off since the team's last game that season, 0 on a back-to-back, NULL for its first. Preseason games are counted apart.
- **`after_break`:** against the date of the All-Star Game that was played, or one still to come this season. Before 1996-97 the schedule has none, so those three dates are in the code, each checked against the gap in that February's games. 1998-99's was cancelled, so that season reads NULL.
- **Plus-minus** is the NBA's, from 1996-97. ESPN's column is zero before then, and is not read.

## The catalogue and the query engine

`src/shared/stats/catalogue/` holds every metric, one file per family: `traditional`, `shooting`, `possessions`, `scoring`, `composite`. Each states the fields of reference section 19.4: entity, kind (recorded, derived, estimated, model), aggregation (a sum or a ratio of sums), unit, sample, direction, sources and first season. Its formula is SQL over component sums (`{fgm} / nullif({fga}, 0)`), so adding a metric needs no engine change. Every formula has a test against a value worked by hand, and the test fails for a metric that has none.

`src/main/stats/engine/` answers a `StatsQuery`: `compile` checks it and writes parameterised SQL, `run` executes it under a five-second timeout on its own connection. Nothing from a query is spliced into SQL.

- **Which table:** `player_season` or `team_season` unless a filter splits a season, then `player_game` or `team_game`. Both give the same numbers. A player's season table is read either as its rows with no team or as those of the teams named, never both, so a trade cannot count twice.
- **Scope:** seasons, game types (default the regular season; All-Star and preseason only when asked), a date range, last N, position group, team. Then the game's context: opponent, the opponent's conference or division, month, home or road, before or after the All-Star Game, rest days, starter or bench, win or loss.
- **Last N:** a player's own last N appearances, or their part in their team's last N games, which they may have missed.
- **Transforms:** totals, per game, per 36, per 48, per 100 possessions. A ratio reads the same in each, and a record stays a total. Per 100 uses estimated possessions: a player's are their team's times their share of its minutes. A team's per-game count divides by its games with a box score.
- **Qualifying:** a metric's `minSample` is for 82 games and scales to the team games a row covers, so a short season or a date range qualifies fairly. A row per season reads its own season's games. Teams always qualify.
- **Minimums:** 500 field-goal attempts for field-goal rates, 400 for two-point percentage, 200 three-point attempts, 125 free-throw attempts, 100 turnovers for assist-to-turnover, 1,000 minutes for the rest.
- **Ranks and percentiles:** among qualified rows of the same position group, and of the same group when grouped.
- **Coverage:** a metric with no season in scope reads null, and its column says why ("Recorded from 1996-97."). A query never fails over a gap, and a gap is never a zero.
- **Grouping:** by season, team, opponent, month or game.

Measured with `scripts/engine-speed.mjs` on the full database, in the worker, a season's worth of players:

| Query                                 | Rows   | Median ms | Worst ms |
| ------------------------------------- | ------ | --------- | -------- |
| A leaderboard: ten columns            | 582    | 116       | 274      |
| 40 columns                            | 582    | 423       | 452      |
| A home board                          | 582    | 26        | 31       |
| A team leaderboard                    | 30     | 27        | 30       |
| Any one filter (date range, home ...) | ~500   | 47–56     | 87       |
| By month                              | 3,266  | 158       | 174      |
| By opponent                           | 12,812 | 265       | 309      |
| One player by game                    | 60     | 57        | 62       |
| Every season, one leaderboard         | 3,037  | 195       | 197      |
| Every season, by season, all players  | 15,808 | 419       | 450      |

## Sync

- **When it runs:** at launch, and every 6 hours while the window stays open. One at a time. Not while paused, and a first load does not start without room for it: see the Data panel in [stats-screens.md](stats-screens.md).
- **Order (D21):** tier by tier: core, published, events, play by play. Inside a tier, files of all seasons first, then the newest season back. So the app is usable after the first tier, and a load cut short keeps the seasons people look at most.
- **What is due:**
  - A step that finished is not tried again within a day; a failed one after an hour.
  - The current season and files of all seasons are checked daily, the prior season weekly.
  - Older seasons are fetched once and sealed. A source's `version` bump fetches them again.
- **Freshness:** each request carries the file's `etag`. A file that has not changed downloads nothing, and logs `unchanged`.
- **Downloads:** up to 4 at once, ahead of the file being loaded, with 3 retries and growing waits on throttling, server errors and dropped connections. The client calls itself `Metis`. Files go to `<userData>/stats-tmp` and are deleted once loaded.
- **Loading:** one file at a time, each in one transaction, so a failed load keeps the old rows. A file not published (404) is `skipped` and tried the next day.
- **Quitting:** closing the worker aborts downloads and interrupts the running statement, and the step is logged `interrupted`. That is not an attempt, so the next run tries it again. Steps a crash left `running` are marked `interrupted` on the next open, and stale temp files are cleared.

Each file is one step, logged as `stats:<source>:<season>` (or `stats:<source>` for a file of all seasons) in the file's own `sync_log`. `source_state` holds what each source has per season: rows, size, etag, when it was fetched and whether it is sealed.

## Measuring a real load

Build first, then point these at a scratch folder, never at the app's own data.

```bash
node scripts/load-report.mjs /tmp/metis-load /tmp/metis-load/report.json
```

```bash
node scripts/coverage-report.mjs /tmp/metis-load docs/reference/nba-coverage.tsv docs/reference/nba-coverage.md
```

```bash
node scripts/stats-sql.mjs /tmp/metis-load statements.sql
```
