# Stats database: data reference

`stats.duckdb` holds every table the NBA dataset publishes, every season, in one DuckDB file beside `metis.db`. Deleting the file makes the next refresh rebuild it. What the files are and what was measured about them is in [nba-data-sources.md](nba-data-sources.md); which seasons really hold values is in [nba-coverage.md](nba-coverage.md).

## Engine

- One worker thread (`out/main/statsWorker.js`, `src/main/stats/worker.ts`) owns the file. The main process talks to it through `StatsClient` (`src/main/stats/client.ts`): `refresh`, `status`, `query`, `catalogue`, `seasons`, `player`, `games`, `game`, `standings`, `selfTest`, `close`. Scripts also use `read`, which runs one SQL statement; the app does not expose it.
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

- **Names:** the NBA's latest spelling from its box scores, else ESPN's. The box scores split a name into first and family, which gets a few wrong (`Ming Yao`, `Nene Hilario`). The rosters have those right but garble others (`Ha Ha` for Seung-Jin Ha), so a roster's name wins only when it repeats no word and every word is in the box score's. That changes four names of 2,913.

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

## Plays, shots and possessions

Built by `src/main/stats/derived/playBuilders.ts` from the SQL in `plays.ts` and `events.ts`, logged as `stats:plays`, once at the end of a refresh, season by season (below). They are keyed to `game` and `team`, so season types, team codes and the All-Star games ESPN files as regular season come from there (D27). Each source has its own table or view and they are never merged (data policy 5). How well they agree with the box scores is in [nba-plays-agreement.md](nba-plays-agreement.md), and the traps behind each rule in [nba-data-sources.md](nba-data-sources.md), "Plays".

| Object       | Kind  | One row per                                  | Holds                                                                                    |
| ------------ | ----- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `play_nba`   | table | row of the NBA's play by play, 1996-97 on    | The play keyed to the game, its clock, the score after, who acted and the counting flags |
| `play_espn`  | table | row of ESPN's play by play, 2001-02 on       | The same columns                                                                         |
| `plays`      | view  | row of either, with `source` (`nba`, `espn`) | Both tables, plus `elapsed` and the score before                                         |
| `shot_nba`   | view  | shot in the NBA's shot chart                 | Made, value, distance and the NBA's coordinates (tenths of a foot from the basket)       |
| `shot_espn`  | view  | shot or free throw in ESPN's file            | Made, the value of a make, the second athlete and ESPN's coordinates                     |
| `possession` | view  | possession in SportsDataverse's derived file | Offense, defense, the plays it spans, points, its counts and the ten players on court    |

**What later work can rely on.** Sum flags; do not parse text.

- **Keys:** `game_id` with `seq`, the order within the game and the source's own row key (the NBA's `order_index`, ESPN's `game_play_number`). `possession.start_seq` and `end_seq` are `seq` in `play_nba`.
- **Time:** `period`, `clock` (seconds left in it) and, in `plays`, `elapsed` (seconds since the tip-off: 720 a quarter, 300 an overtime).
- **Score:** `home_after`, `away_after` stored; `home_before`, `away_before` in `plays`, the score after less the play's points.
- **Who:** `team_id` and `player_id` act; `opponent_id` is the other side, `home` whether `team_id` is at home. A row with a team and no player is the team's own (a team rebound, a shot-clock turnover).
- **Flags** (`UTINYINT`, 0 or 1, `pts` 0 to 3): `fga`, `fgm`, `fg3a`, `fg3m`, `fta`, `ftm`, `pts`, `oreb`, `dreb`, `tov`, `pf` belong to the actor; `ast` to `assist_id`, of the same team; `stl` and `blk` to `steal_id` and `block_id`, of `opponent_id`. They sit on the turnover, the make or the miss they belong to, in both sources.
- **A box-score line** is those sums, with rebounds and turnovers of rows that have a player: the box score leaves team rebounds and team turnovers out. That is how `scripts/check-plays.mjs` rebuilds it.
- **`kind`** is one set for both sources: `field_goal`, `heave`, `free_throw`, `rebound`, `turnover`, `foul`, `steal`, `block`, `violation`, `jump_ball`, `substitution`, `timeout`, `period`, `replay`, `ejection`, `other`. `action` and `subtype` keep the source's own type text, for turnover and foul types.
- **`possession`** is the NBA's possession number in `play_nba`; ESPN has none.
- **Default source: the NBA's** (`DEFAULT_PLAY_SOURCE`). It starts five seasons earlier, carries possessions and the players on court, is the feed behind the box scores the app trusts, and matches them better: see the agreement report. A metric reads ESPN's only for what the NBA's lacks.

**Built season by season.** Each file of the core, events or plays tier that writes rows marks its season in `derived_state` (`plays:<season>`) as it loads, so a refresh cut short still rebuilds it next time. At the end of the refresh the step rebuilds only the marked seasons that have games played: a current-season file never rebuilds a sealed season. Every season is rebuilt when `PLAYS_VERSION` changes (a new database has none), when a table's columns differ from its builder's, or when a file of every season (season 0, the aliases) wrote rows; a full rebuild also deletes seasons no longer played. A season is replaced in one transaction per table, its rows deleted and its new rows inserted, so a reader sees it whole, old or new, never half; a season that fails rolls back and stays marked. DuckDB is asked to checkpoint after each season, so the space of the deleted rows is reused by the next.

**The registry.** `PLAY_BUILDERS` in `playBuilders.ts` is the ordered list of tables built from plays. Each entry names its table, its typed columns and a SELECT of one season's rows; the step does the rest (shape, delete, insert, transaction, checkpoint). Plan T902 to T905 add their built tables by appending one line there, never by editing `sync.ts`. The rule for an entry: **per season** (the table has `season`, and one season's rows depend on that season's data only), **one transaction a season**, and **counts, not rates** (rates are divided when read, so seasons can be replaced apart). An entry runs after the ones above it, so it can read their tables.

**Cost, measured** on a copy of the full load through a real refresh (`scripts/load-report.mjs`): a full rebuild of 33,327,811 rows takes 94 to 276 seconds (the slowest the first, on a file the one-statement build had left) with the file peaking at 5.13 GB from 5.12 GB in steady state, and 5.42 GB the first time; a rebuild of the current season alone writes 154,413 rows in 1.5 seconds with no growth. Peak memory of the refresh process is 2.2 GB for a full rebuild, 0.5 GB for the current season.

**View or table, measured** on the full Stage 8 load, warm, a season's scan grouped by player or team-game: `play_nba` as a table answers in 10 to 31 ms; as a view it would redo its window functions, about 6 seconds a season. The shots and possessions answer in 15 to 38 ms as views and 4 to 15 ms as tables, and copies would cost about 540 MB and 11 seconds of build, so they stay views. Deeper pre-aggregation is T907's.

### Shots by zone (Plan T903)

`shot_player_game` and `shot_team_game`, built by `derived/shots.ts` as two builders of `PLAY_BUILDERS`, after the play tables of the same season (they read its assists). One row per player-game and team-game of the NBA's shots, with counts only: for each zone, the combined corner, each distance band and each shot type, its attempts, makes, points and assisted makes, and the makes and points the league's regular-season rate in that bucket that season would give the same attempts (stored in thousandths, as integers: doubles were three quarters of the tables' size). Then the row's shots, threes, assisted makes, summed distances and expected points by zone. A team's row also holds its opponents' shots against it, as `opp_*`. 825,740 rows from 1996-97, about 94 MB. Measured by a real refresh (`scripts/load-report.mjs`) on a fresh copy of the full load, whose new shot tables made every season due: the `stats:plays` step rebuilt plays and shots for every season in 254 seconds (34.2 million rows), the file growing from 5.16 to 5.49 GB with a peak of 5.58 GB. A refresh in which only the current season's files changed rebuilds that season alone: 1.9 seconds for 2026-27's 177,966 rows, the file unchanged, 14 MB higher at the peak.

- **Zones** (`src/shared/stats/shots.ts`), in the NBA's legacy frame (tenths of a foot, the basket at 0, 0): the published value decides two or three; a three with `y` ≤ 92.5 is a corner (left where `x` < 0, as the NBA names them), else above the break; a two within 40 of the basket is the restricted area, inside the lane (|`x`| ≤ 80, `y` ≤ 142.5) the paint, else mid-range; beyond half court (`y` > 422.5) the backcourt; a point off any court a zone of its own. The NBA's file publishes no zone, so these are not compared with one.
- **Bands:** the NBA's ranges on the published distance: under 8 feet, 8 to 16, 16 to 24, 24 and beyond.
- **Types:** the first of dunk, tip, layup (finger rolls with it), hook, floater, jump shot whose word the `sub_type` text holds; else other.
- **Assisted:** the make's row in `play_nba`, found by game, period, clock and shooter.

The engine reads them through a metric's `built` table (below, "Metrics on a built table"): at the game grain joined to the box-score rows in scope by player or team and game, at the season grain by season and season type (and by team when the query names teams), so any filter is exact; games, minutes and possessions still come from the box scores. A row in scope with no shot reads 0 attempts. The catalogue is the Shot zones family (`catalogue/shots.ts`), 411 metrics for players, teams and opponents. The shot chart reads its rows through its own call, `shots` (`shotReads.ts`).

### Metrics on a built table (`built`)

The one mechanism for tables built from the plays that the engine reads at both grains (the shot tables first; on/off and the other play-derived tables use the same). A metric names the table in `built`; the table is listed in `GAME_TABLES` (`src/main/stats/derived/gameTables.ts`); the engine needs no other change. It is apart from `published` and `publishedGames`, which are the dataset's season files and their game-grain companion (Plan T906).

**What the table must hold**

- One row per player or team and game, or several, which are added up. Counts only, never a rate: each rate is a numerator and a denominator, both columns, divided by the metric's formula (data policy 3).
- `game_id` (the `game` table's id, as in `player_game` and `team_game`), `season`, `game_type`, and the column named as its `key` in `GAME_TABLES`: `player_id` for a player table, `team_id` for a team table.
- `team_id` on a player table too: the player's team in that game. The season grain needs it for a traded player (below).
- Every column the metrics read, listed in the entry's `components`. A team table holds the opponents' side as `opp_*` columns of its own, since `swapSides` only knows the box-score names.
- Optionally `zero(component)`: the components that read 0, not null, for a row in scope that has no row in the table (a player who took no shot took none from the corner). Leave out what has no honest zero, such as an expectation in a season with no league rate yet: those read null.

It is built season by season by appending a `PlayBuilder` (`table`, typed `columns`, `select(have, season)`) to `PLAY_BUILDERS` (`derived/playBuilders.ts`). It is created empty on every open from its own bootstrap, so a query before the first build reads zeros and nulls, not a missing table. A builder that reads a view (`shot_nba`, `possession`) must read the view's SELECT for its season (`nbaShotsSelect(have, season)`), because the views are created after the builders run.

**How each grain joins.** The engine first takes the box-score rows in scope (`base`: `player_game` or `team_game` at the game grain, `player_season` or `team_season` at the season grain, after every filter and the last N games). Then `builtCte` sums the table per output row, `base LEFT JOIN table`:

| Grain                                                                                              | Join                                                                                                                    | What it gives                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game (a date range, last N, an opponent, home or road, any split, grouping by anything but season) | `w.key = b.id AND w.game_id = b.game`                                                                                   | Exactly the games in scope. Groups by what the query groups by                                                                                                                         |
| Season (whole seasons, by season or not)                                                           | `w.key = b.id AND w.season = b.season AND w.game_type = b.game_type AND (b.row_team IS NULL OR w.team_id = b.row_team)` | A season and season type. A player's row of no team reads every team they played for; with teams named, each team's row reads its own games, so a traded player is never counted twice |

Both also keep to `w.season IN` the seasons in scope, so DuckDB skips the other seasons' row groups. The sums join back to the box-score sums by row (and by every grouping dimension), so neither multiplies the other.

**Where games, minutes and possessions come from.** A component the table does not hold is read from the box-score sums of the same rows: `games`, `box_games`, `minutes`, `on_poss`, `poss_sym`. So a count's per game divides by the games played in scope (a team's by `box_games` when the metric sets `perGameBy`), per 36 and per 48 by the box score's minutes (a team's divided by five, as for any box-score team metric), and per 100 by the estimated possessions (`on_poss` for players, `poss_sym` for teams). Qualifying (`minSample`, scaled to the team games in scope) and ranks work as for any metric.

**A table that brings its own divisor.** Two ways:

- Name the column after the box-score component it replaces (`minutes`, `on_poss`, `poss_sym`, `games`) and list it in `components`: the engine reads a component from the table whenever the table holds it, so per 36 or per 100 then divides by the table's own. A team's minutes are still divided by five under per 36, so a team table's `minutes` must be all five players' minutes, as the box score's are.
- Or give it its own name (`shots_fga`, `poss_on`) and use it in the formula and as the `sample`, with `totalOnly` or `perGameOnly` on counts the box-score divisors would misread.

**Splits.** A built table counts per game, not per moment of a game, so under `scope.split` (Plan T902) a built metric reads null with "Counted per game, not per moment, so it has no split.", never its whole-game value. A table that wants splits must hold them itself.

**Coverage.** A metric's `firstSeason` (and `missingSeasons`) gives the reason a season outside it reads null ("Recorded from 1996-97."); inside it, the zeros and nulls above. `grainsOf` gives a built metric both grains when every component is in the table or in the box-score tables, and none otherwise. The catalogue test reads such a metric from a worked row of the table's components.

### Play-derived stats (Plan T905)

`play_player_game` and `play_team_game`, built by `derived/playDetail.ts` as the last two builders of `PLAY_BUILDERS`, from `play_nba` of the same season (815,281 and 79,058 rows on the full load, 16.5 and 6 MB). Counts only, a byte a count; times in tenths of a second. The rules are data in `src/shared/stats/playDetail.ts`, shared by the SQL, the read and the screens; how each agrees with the box scores is in [nba-data-sources.md](nba-data-sources.md), "Play-derived stats".

- **A player's row:** turnovers, live (a steal credited) and dead, and by kind (bad pass, lost ball, offensive foul, traveling, shot clock, stepped out, other violations, other), which add up to them; personal fouls and their ten kinds, which add up to them; technicals (defensive three seconds apart); ejections; made twos and threes, assisted and not; and-ones and those converted; two- and three-shot foul trips; defensive goaltending and kicked balls; assists on twos and on threes (the passer's); fouls drawn and shooting fouls drawn, from ESPN's play by play (the only feed that names the fouled player).
- **A team's row:** the same counts over its players' rows and its own (team turnovers, bench technicals), team turnovers apart (`tov_team`, the box score leaves them out), and the game's flow: lead changes, times tied, the team's largest lead, time leading, time tied, best run, longest stretch without a point and without a field goal, the game's length, and `flow_games` (1), the divisor of a flow average. The other team's side is on the same row as `opp_*`.
- **Assisted makes** are `play_nba`'s `ast` flag, the one the shot tables (Plan T903) read through the shot file: the two agree on every player-game the shot file has.
- **The flow's rules** (`flowSummary`): the score changes only on a scoring play; a tie is a scoring play that levels the score, not 0-0 at the tip; a lead change puts a side ahead when the other led last, a tie between or not; a run is the points one side scores with none by the other between, any point ending it, a free throw included, across period breaks; a drought is the longest time without a point (or field goal), from the tip, between scores and to the end, on the game clock. The scoring rows are read by `scoringRowsSql`, shared with the game-flow read: the score is the play table's, in order of the total score, then of the row, since the feed lists a few scoring rows out of order (see the traps).
- **Read by the engine** through the `built` field: 162 metrics in the Play by play family (`catalogue/plays.ts`), counts per game, per 36 or per 100 from the box scores' divisors, shares and rates divided on read, flow averages over `flow_games`. Counts read 0 for a row in scope with no row; the flow reads null there. Under a split they read "Counted per game, not per moment, so it has no split."; before 1996-97 "Recorded from 1996-97."; fouls drawn outside 2006-07 to 2016-17 their reason.
- **Two reads beside the engine,** on their own calls (`playReads.ts`): `assists` lists passer and scorer pairs from `play_nba` over the games of a scope, as the shot chart scopes them; `gameFlow` gives one game's scoring plays in order and its `flowSummary`. Each answers in 20 to 25 ms a season, 45 to 51 ms over ten (measured), so neither stores anything.
- **Cost:** the two builders alone rebuild 31 seasons in 33 seconds with no growth of the file; in the real refresh that rebuilt every play table (plays, shots, splits and these) the `stats:plays` step took 507 seconds for 47.6 million rows, the file going from 5.16 to a peak of 5.65 GB and 5.59 GB after, peak memory 2.4 GB.

## Splits of each game

Built by `src/main/stats/derived/splits.ts` (Plan T902) from `play_nba`, as two entries of `PLAY_BUILDERS` (`playBuilders.ts`) after the play tables: the `stats:plays` step replaces a season of each in one transaction, only the seasons that changed. The rules are data in `src/shared/stats/splits.ts`, so the builder, the engine and the screens read the same numbers.

| Table          | One row per            | Holds                                                                                                                      |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `split_player` | player, game and split | The box-score counts (rebounds as offensive and defensive) and the seconds on the court                                    |
| `split_team`   | team, game and split   | The same counts, the opponent's in the same moments (`opp_`), five times the seconds elapsed, the possessions of each side |

- **The splits:** `q1` to `q4`, `h1`, `h2` (without overtime), `ot` (every overtime), `clutch`, `ahead`, `tied`, `behind`, `within5`, `ahead10`, `behind10`, `end2` (the last 2 minutes of every period), `last2` and `last1` (of the 4th quarter and each overtime), `garbage` and `nogarbage`. A play is in a split by its period, its clock and the score **before** it, from the side of the team the stat belongs to: a steal is the stealer's team's moment. Time between two plays is in a split by the score after the first, cut at each window's edge (5:00, 2:00, 1:00, 9:00, 6:00).
- **Counts** are the flags as the box score counts them (rebounds and turnovers where a player is named). **Players' time** comes from the substitutions: the period's starters from the feed's lineup on its first row, the player coming in named in the substitution's text and matched to that team's players in the game; the lineups on every row are not used, they lag the substitutions by minutes. **Possessions** are SportsDataverse's counted ones, in a split by their first play: derived, not official.
- **The engine** reads them under `scope.split` (see below). A missing source reads NULL: without the feed's substitution text or lineups players' time is NULL, without the possessions file possessions are.
- **Size and time on the full load:** 11.2 million player rows and 1.3 million team rows, 194 MB, about 7 seconds a season (215 for 31 built alone). Rows are written in key order; unsorted they took 288 MB. In a real refresh rebuilding every season, the whole `stats:plays` step took 345 seconds and the file peaked at 5.61 GB; one changed season rebuilds in 2 to 9 seconds. Measured in [nba-data-sources.md](nba-data-sources.md), "Splits from plays".

## On court

Built by `src/main/stats/derived/onCourt.ts` (Plan T904) at the end of the `stats:plays` step, a season at a time, each season in one transaction a table: the last two of `PLAY_BUILDERS` (`derived/playBuilders.ts`), after the plays they read, so a season whose files changed rebuilds them with its plays. Both hold counts, never rates (data policy 3), and a missing source or column reads NULL: no lineup file, no players on the floor; no possessions file, no possessions. How well they agree with the box scores and the NBA's lineups is in [nba-data-sources.md](nba-data-sources.md), "On court, per season".

| Table             | One row per                                | Holds                                                                                                   |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `unit_game`       | team, game and set of players on the floor | The players (`p1` to `p5`, ascending), `complete` when five are known, seconds, and 15 counts each side |
| `player_on_court` | player and game                            | The team's and the opponent's counts with the player on and off the floor, and the player's own counts  |

**How a play is credited.**

- **Who:** SportsDataverse's lineup of each play (`nba_stats_game_lineups`, through `src_nba_pbp`'s `action_number`), which changes at the play of a substitution. The possessions file's players are the possession's first five only, so a substitute who comes in between free throws is missed: with them, on-court plus-minus equals the box score's on 26 to 40 % of player-games; with the per-play lineups, on 89 to 97 %. A play the lineup file has no row for takes the lineup before it in the period.
- **Free throws** count for the players on the floor at the foul, as the official plus-minus does.
- **Time** is the clock between a play and the one before it in its period (720 seconds a quarter, 300 an overtime), credited to the players on the floor at the play. A possession's own clocks do not chain (each starts at its first play), so they are not used.
- **Possessions** are the possessions file's (those it counts), each credited to the five on the floor at the play that ends it. They are SportsDataverse's count, about 5 % below the NBA's.
- **Counts** follow `play_nba`: rebounds and turnovers are a player's, as in the box score; a steal or a block sits on the other team's play and is credited to the side of the player who made it.
- **Units:** a five-man unit is a row with five distinct players known (`complete`); a lineup with a player missing (0.05 to 0.1 % of possessions) or listed twice still counts for the team and the players known.
- **Off the floor** is the team's line in the game less the player's on-court line, so on plus off equals the team's exactly, and it covers the player's own games only, not games they missed.

**What reads it.**

- **The engine** reads through the On court metrics' field, the same mechanism as the shots ("Metrics on a built table"): joined to the box-score rows in scope by player and game under a filter that splits a season, by season, season type and the row's team over whole seasons, so a traded player's one team reads exactly. The table holds the counts and the on-court minutes; games come from the box scores. Per 36 and per 48 divide by the minutes on the floor and per 100 by the possessions on the floor (), both the table's own, since reads a divisor from the table when the table holds it. Under a split within games (Plan T902) they read "Counted per game, not per moment, so it has no split." No new subject: a player's on/off is a player metric.
- **`onCourtUnits(team, season, scope, size)`:** a team's groups of two to five players in a season and scope (season types, a date range or the team's last games), every group the plays put on the floor, from `unit_game`. A five is a complete unit; a smaller group is any players known together, whatever the rest of the floor. Counted on read, so nothing is stored per pair, triple or four.
- **`withOrWithout(player, teammate, season, scope)`:** the player's team in the games both played for it: both on, the player alone, the teammate alone, neither; with no teammate named, the one they shared the most minutes with, and the list of teammates for a picker.

## The catalogue and the query engine

`src/shared/stats/catalogue/` holds every metric, one file per family: `traditional`, `shooting`, `possessions`, `scoring`, `composite`. Each states the fields of reference section 19.4: entity, kind (recorded, derived, estimated, model), aggregation (a sum or a ratio of sums), unit, sample, direction, sources and first season. Its formula is SQL over component sums (`{fgm} / nullif({fga}, 0)`), so adding a metric needs no engine change. Every formula has a test against a value worked by hand, and the test fails for a metric that has none.

`src/main/stats/engine/` answers a `StatsQuery`: `compile` checks it and writes parameterised SQL, `run` executes it under a five-second timeout on its own connection. Nothing from a query is spliced into SQL.

- **Which table:** `player_season` or `team_season` unless a filter splits a season, then `player_game` or `team_game`. Both give the same numbers. A player's season table is read either as its rows with no team or as those of the teams named, never both, so a trade cannot count twice.
- **Scope:** seasons, game types (default the regular season; All-Star and preseason only when asked), a date range, last N, position group, team, player, one game by its id. Then the game's context: opponent, the opponent's conference or division, month, home or road, before or after the All-Star Game, rest days, starter or bench, win or loss.
- **Last N:** a player's own last N appearances, or their part in their team's last N games, which they may have missed.
- **Split** (`scope.split`, Plan T902): only the moments of each game in the split count. The query reads the game grain, joins `split_player` (or `split_team`) to the game lines by player or team and game, so every game filter, a date range and the last games hold exactly; the last N are the player's own games, then the split within them. Each component maps to its split column (`SPLIT_PLAYER_SQL`, `SPLIT_TEAM_SQL`): the counts, minutes from the seconds, the team's and opponent's counts in the same split for shares, the on-court estimates over the player's share of the team's time in it, and per 100 over the possessions counted from the plays. A metric with a component the split rows lack reads null with "Not counted from the play by play, so it has no split.", and a scope with no season from 1996-97 on "Splits are counted from the play by play, from 1996-97.". Qualifying scales `minSample` by the split's share of the team's time in scope.
- **Transforms:** totals, per game, per 36, per 48, per 100 possessions. A ratio reads the same in each, and a record stays a total. Per 100 uses estimated possessions: a player's are their team's times their share of its minutes. A team's per-game count divides by its games with a box score.
- **Qualifying:** a metric's `minSample` is for 82 games and scales to the team games a row covers, so a short season or a date range qualifies fairly. A row per season reads its own season's games. Teams always qualify.
- **Minimums:** 500 field-goal attempts for field-goal rates, 400 for two-point percentage, 200 three-point attempts, 125 free-throw attempts, 100 turnovers for assist-to-turnover, 1,000 minutes for the rest.
- **Ranks and percentiles:** among qualified rows of the same position group, and of the same group when grouped.
- **Coverage:** a metric with no season in scope reads null, and its column says why ("Recorded from 1996-97."). A query never fails over a gap, and a gap is never a zero. Sorted on such a column with only the qualified asked for, a table still lists its rows, since nothing could qualify.
- **Grouping:** by season, team, opponent, month or game.
- **Published metrics:** see below.

### Metrics with no game behind them

Hustle, tracking, play types and the rest are published per season, so they have only the season grain. A metric says so by naming its table in `published`, and its formula reads that table's columns. Each table is listed in `src/main/stats/derived/publishedTables.ts` and built by `derived/published.ts`: the source's rows of totals, keyed on player or team, season and game type, with `games`, `minutes` and `possessions` beside its own columns. They are created empty on every open, so a query before the published tier has arrived reads null instead of failing, and the `stats:published` step fills them once that tier is in. A family adds its table to the list and its metrics to the catalogue, with no engine change, and bumps `PUBLISHED_VERSION`.

A component can also be worked out from the source's columns, as `{off_rating} * {poss}`. That is how a rate the source publishes ready-made is stored: the NBA's dashboards give usage, ratings, PIE and shares as rates without their parts, so each is stored times what it was measured over, minutes or possessions for a rating, and divided back when read. One season reads exactly as published, and seasons or season types added together are weighted by minutes or possessions. A player or team with 0 minutes or possessions published reads no value there, where the NBA prints 0.

The NBA's dashboards (Plan T702) are nine tables: `pub_player_advanced`, `pub_player_misc`, `pub_player_scoring`, `pub_player_usage`, `pub_player_defense`, `pub_team_advanced`, `pub_team_four_factors`, `pub_team_misc` and `pub_team_scoring`. Their metrics are in `src/shared/stats/catalogue/dashboards.ts`, with ids starting `nba_`, `team_nba_` and `opp_nba_` beside the formula versions (D14). On the full database they build 108,582 rows in 1.1 seconds. A season's leaderboard with ten box-score columns and six published ones from five of these tables answers in 141 ms (median of seven, 150 at worst), against 114 without them; every season from 1996-97 at once, 226 ms.

Player tracking (Plan T703) is twelve more, one per file, from 2013-14: `pub_player_speed`, `pub_player_touches`, `pub_player_drives`, `pub_player_passing`, `pub_player_rebounding`, `pub_player_catch_shoot`, `pub_player_pull_up`, `pub_player_elbow_touch`, `pub_player_post_touch`, `pub_player_paint_touch`, `pub_player_tracking_efficiency` and `pub_player_rim_defense`, 122,563 rows on the full database. Their 138 metrics are in `src/shared/stats/catalogue/tracking.ts`, in a family of their own, with a Tracking tab on the player dashboard. Here the files publish most rates with their parts, so those are rebuilt from the parts and seasons together are exact; only speed, seconds and dribbles per touch, rebound distance and the efficiency file's percentages are stored times what they were measured over. Rates divide by tracking's own games and minutes, which differ from the official ones on 956 of 9,759 player-seasons. A season's leaderboard with ten box-score columns and six tracking ones answers in 131 ms (median of seven), against 96 without; every tracked season at once, 178 ms; the Tracking tab's 39 metrics over every player, 360 ms.

Hustle (Plan T704) is two more, `pub_player_hustle` and `pub_team_hustle`, from 2016-17: 8,034 and 490 rows. Their 34 metrics are in `src/shared/stats/catalogue/hustle.ts`, in a Hustle family, with a Hustle section on the player dashboard's Defense tab. They are counts, with the offensive shares of loose balls and box outs rebuilt from them; the two box-out rebound rates are stored times the box outs. A player's per game divides by the games hustle counted. The team file publishes no games, so a team's hustle reads in totals and per 48 minutes, and per game is blank with "Published without games played." rather than divided by games hustle may not have covered (its team minutes run short of the season's). A season's leaderboard with ten box-score columns and six hustle ones answers in 187 ms (median of seven), against 153 without on the same run; every hustle season at once, 233 ms; a team board with four, 22 ms.

Play types (Plan T705) are 18 more, one per type and side, all read from the one source file through a `match` on its `play_type` and `type_grouping` columns: `pub_player_pt_iso` and the ten other offensive types, and `pub_player_pt_d_iso` and six more on defense, from 2015-16, 90,418 rows. Their 234 metrics are in `src/shared/stats/catalogue/playTypes.ts`, in a Play types family, with a Play types tab on the player dashboard; the types themselves are listed once, in `src/shared/stats/playTypes.ts`. A traded player has a row per team there, which the engine adds up. Points per possession and FG% are rebuilt from their parts; the other rates are stored times possessions (eFG% times attempts), and a type's frequency divides by the possessions its published share implies, both left blank on a row whose share is printed as 0. Per game divides by the player's games on that side of the ball; the files publish no minutes, so per 36 and the rest are blank with their reason. A season's leaderboard with ten box-score columns and the twelve of the Play types preset answers in 231 ms (median of seven), against 117 without on the same run; every play-type season at once, 155 ms; the Play types tab's 36 metrics over every player, 437 ms.

Matchups (Plan T706) are two more, from 2017-18, keyed on the defender. `pub_player_matchups` holds a defender's season: the NBA's rollup by defender for the current season, whose pair file is not out yet; in the regular season the pair file added up per defender; and in the playoffs (Plan T906) `game_matchups` added up per defender, since the 2025-26 playoff rollup agrees with the game file on 17 of 230 defenders. A table names these as its `replacedBy`, one source or a list of them, each holding different season types (`types`, and `typeColumn` for a built table whose column already holds the one set). Where a replacement holds the season and type, the rollup's values of what it takes over read NULL and the replacement's rows are added in, already summed per defender, while the games still come from the rollup: the pair file's are per pair, and the box scores need the rollup's. `game_matchups` is built first in the step, so the playoffs read it. It is 12,442 rows on the full database. `pub_player_matchup_positions` reads every position row of the rollup, one column per position guarded, so the shares divide by the rollup's own total time: 29,556 rows. The 26 metrics are in `src/shared/stats/catalogue/matchups.ts`, in a Matchups family, with a Matchups tab on the player dashboard. Their possessions are the partial possessions guarded, so per 100 reads per 100 of them; matchup time is not minutes played, so per 36 and per 48 are blank with their reason. A clock printed as `41:33` is read through `{matchup_min:text}`, a source column read as text. `pub_matchup_pairs` keeps the pair file's 1,224,973 rows of totals, one per pair, for the tab's lists of who a player guarded and who guarded them; `readMatchups` reads it. A season's leaderboard with ten box-score columns and twelve matchup ones answers in 210 ms (median of seven), against 117 without on the same run; every matchup season at once, 73 ms; the Matchups tab, its 20 metrics over every player and both lists, 130 ms in the window.

Availability (Plan T709) is one more, `pub_player_availability`, built by `derived/availability.ts` from `src_nba_injury_report` and `game`: a published table that names an `sql` instead of reading a source's totals. Each player's rows for a game are cut to the last report, so a game counts once however many reports listed it; `games_out_injury` and `games_out_other` count the games whose last status is Out, split by reason, for played regular-season and playoff games from 2019-20. It has no games, minutes or possessions, so its two metrics (an Availability family, `catalogue/availability.ts`) are `totalOnly`. 4,449 rows on the full database. A source or column that is missing builds an empty table. The status tag, the coaches and the officials are plain reads (`availabilityReads.ts`), not metrics.

SportsDataverse's impact models (Plan T707) are two more, from `src_nba_impact`, players only. `pub_player_impact` stores RAPM, adjusted RAPM and their parts times the possessions they were fitted on (offense, defense, or both for the total), SPM and BPM and their parts times minutes, and WAR as published: 21,117 rows, 1996-97 on, regular season and playoffs. `pub_player_darko` stores DARKO's skill, next-season projection and its spread times games, from the regular season only, since the playoff rows repeat it: 14,586 rows, 1997-98 on. The 16 metrics are in `src/shared/stats/catalogue/impact.ts`, in an Impact (SportsDataverse) family. Every label ends "(SportsDataverse)", every column head "SDV", and every description says it is the dataset's calculation, not the model authors' figure. DARKO is a state at the season's end, not a total or a rate, so its metrics carry `oneSeason`: the engine answers them for one regular season at a time, and otherwise null with "Published for one season at a time." or "Published for the regular season only.". Grouped by season, each season answers. A season's leaderboard with ten box-score columns and twelve impact ones answers in 170 ms (median of seven), against 103 without on the same run; all twelve over every season from 1996-97, grouped by season, 209 ms.

The engine sums a published table apart from the box scores and joins the result by row, so neither multiplies the other. A row's name, team, position and `games` still come from the box scores.

### Game tables

A published metric can also name a built table at game grain in `publishedGames`. Under any filter that splits a season (a date range, the last games, home or road, an opponent, a team, a grouping by game, month, team or opponent) the engine reads that table instead of answering "Published for whole seasons only."; a whole season still reads the `published` table. The surface is three pieces, kept small for the tables that follow:

- **The table** is built by a step like any other, with one row per game and whatever the row is about (a pair of players for `game_matchups`). It holds `game_id`, keyed to `game` (D27), the column the engine sums by (the player's or team's id), and counts only, named as the `published` table names them, so the metric's one formula reads either. Rates are divided on read.
- **The registry**, `src/main/stats/derived/gameTables.ts`: each table's name, entity, `key` (its column holding the player or team id) and `components` (what the engine may read). `games` is the one special component: the engine counts the distinct games with a row rather than summing a column. `grainsOf` gives a published metric the game grain when its game table holds every part of its formula.
- **The engine** (`gameCte` in `engine/compile.ts`) joins the table to the box-score rows in scope (`base`) by `key = player or team id` and `game_id = game`, sums the components per output row and per group, and left-joins that to the box-score sums on every grouping dimension. Every filter on a game holds because `base` already applied it, and the last games are the player's or team's last appearances, as for box-score metrics. The gaps keep their order: coverage first ("Recorded from 2017-18."), then a divisor the game table lacks ("Published without minutes."); the season types a published table lacks do not apply, since the game table holds every type it has rows for.

The consequence to know: a row of the game table counts only where the box score has the player in that game. For `game_matchups` that leaves out 34 defender-games of 2017-18 to 2025-26 where tracking assigned a player the box score lists without minutes (`nba-data-sources.md`).

`game_matchups` (Plan T906) is the first: 2,197,055 rows, one per game, player on offense and defender, from `src_nba_game_matchups`, built by `derived/gameMatchups.ts` in the `stats:published` step, which a refresh runs again once at its end when an events-tier source it reads (`PUBLISHED_LATE_SOURCES`) wrote rows, before `stats:plays`. Its 17 defender metrics are the Matchups family's except the shares by position. A season of defenders through a date range answers in 44 to 145 ms. `readGameMatchups` reads a game's pairs from it, and `readScopedMatchups` a player's pairs over any scope that is not a whole regular season (`matchupReads.ts`).

| The query                                              | The metric answers                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Whole seasons, regular season or playoffs              | The published totals, added across the seasons and types in scope                       |
| A date range, last N, home or road, any game filter    | Its game table, if it names one; else `null`: "Published for whole seasons only."       |
| Only the play-in, the Cup final, All-Star or preseason | `null`: "Published for the regular season and playoffs only."                           |
| Per game, per 36, per 48                               | Divided by the games and minutes the source tracked, not the official ones              |
| A divisor the source does not publish                  | `null`: "Published without games played.", "without minutes." or "without possessions." |
| One team, for a traded player                          | `null`, with a note: their one row is the whole season, under their last team           |
| Every team a traded player played for                  | Their whole season                                                                      |

A team's published minutes are elapsed, about 48 a game, and its box-score minutes are all five players', about 240. Per 36 and per 48 read each correctly. A position or team filter holds, because a published row counts only for the seasons and types the row's box scores have in scope. Ranks and percentiles work as they do for any metric, among the players tracked.

Measured on a copy of a full load, with hustle and tracking tables registered only for the check: 29,676 rows built in 62 ms, and ten box-score columns with five published ones from three tables took 152 ms, against 120 ms without them.

Measured with `scripts/engine-speed.mjs` on the full database, in the worker, a season's worth of players:

| Query                                 | Rows   | Median ms | Worst ms |
| ------------------------------------- | ------ | --------- | -------- |
| A leaderboard: ten columns            | 582    | 129       | 279      |
| 40 columns                            | 582    | 452       | 463      |
| A home board                          | 582    | 29        | 35       |
| A team leaderboard                    | 30     | 29        | 30       |
| Any one filter (date range, home ...) | ~500   | 49–59     | 64       |
| By month                              | 3,266  | 176       | 184      |
| By opponent                           | 12,812 | 311       | 317      |
| One player by game                    | 60     | 62        | 66       |
| Every season, one leaderboard         | 3,037  | 230       | 234      |
| Every season, by season, all players  | 15,808 | 486       | 568      |

The last is over the 500 ms a screen is allowed, and no screen asks it. Trends (Plan T803) will, for one position, which is about a third of those rows. Times vary between runs: the same query read 450 ms at worst on another. What a click takes in the window is in [stats-screens.md](stats-screens.md).

Lineups (Plan T710) are one more table that is not a metric: `pub_lineups`, one row per team, season, season type and set of five players, 83,277 rows from 2007-08. It is built by the `stats:published` step from the six lineup dashboards and read by its own call, `lineups`; the engine never sees it, and it has no lineup subject. The five ids are sorted ascending (`p1` to `p5`), which is the order the sources write them, so a unit's key never depends on a file's habit. Each of the 89 stored columns is read from its own dashboard, in `src/shared/stats/lineups.ts`, and the NBA's `nba_stats_lineups` is not read. The table holds every unit any dashboard lists: each file is cut to its first 2,000 regular-season rows by its own sort, so the files list different units and a measure a file does not list reads NULL (`nba-data-sources.md`). Games come from whichever file lists the unit, in the order base, advanced, misc, opponent, four factors, scoring, and minutes from `sum_time_played / 3000`. Counts are stored as published and the rates as published, since a unit is a whole season and nothing adds them up across seasons; the seven percentages of makes over attempts are worked out on read. A team-season reads in 22 ms at the median and 70 ms at most over all 5,244 reads of 2007-08 to 2025-26 (`scripts/check-lineups.mjs`).

## Reads beside the engine

`src/main/stats/reads.ts`: plain reads a dashboard needs that are not a metric. A table not loaded yet reads as nothing, and a column a source has dropped as NULL.

| Read                                             | Answers                                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `player(id)`                                     | Name, seasons, latest position and team; number, size, birth date and school from the latest roster line                                        |
| `games(season)`                                  | Every game on the schedule, played or not: its type, sides, score, whether a box score is held, overtimes                                       |
| `game(id)`                                       | ESPN's venue, city, attendance and note, and the score by period when those add up to the final score                                           |
| `standings(season)`                              | The published standings: `src_nba_standings`, or the dashboards' file for 1995-96                                                               |
| `matchups(id, season)`                           | Who a defender guarded and who guarded them, from `pub_matchup_pairs`                                                                           |
| `lineups(team, season, type, group)`             | A team's five-man units for a season and season type with one dashboard's columns, most minutes first, from `pub_lineups`; empty before 2007-08 |
| `profile(id)`                                    | The latest roster line, the draft pick, and every combine the player went to, each measure with its percentile in its position group            |
| `availability(ids)`                              | Each player's status on their team's newest official injury report that lists anyone, with its reason and date                                  |
| `onCourtUnits(team, season, scope, size)`        | A team's groups of two to five players on the floor, counted from the plays, from `unit_game`: see "On court"                                   |
| `withOrWithout(player, teammate, season, scope)` | A player's team with a teammate on and off the floor, in the games both played: see "On court"                                                  |
| `coaches(team, season)`                          | The head coach and the assistants of a season, from `src_nba_coaches`                                                                           |

- **A side with no row in `team`** is an All-Star team or a touring club: its name comes from the NBA's schedule, then ESPN's.
- **Overtime** is read from the team's minutes, 240 in regulation and 25 more per period. It matches ESPN's period on nearly every game, and in 2001-02 ESPN's undercounts: it has 30 overtime games to the box scores' 70.
- **The combine** (Plan T708) is read from four of its five tables, joined on season, id and name (`-1` stands for several players without an id). `draftcombinestats` repeats them column for column. The 46 measures are listed in `src/shared/stats/profile.ts`: measurements, four proportions worked out from them (wingspan and standing reach over barefoot height, and standing reach plus each vertical), athletic testing, and the shooting drills, each spot with makes and attempts and a total per distance. A percentile ranks a measure among every attendee of the same position group at every combine in the data, linked to an NBA player or not: the first listed position (`SG-SF` is a guard, as in Plan T504), mid-rank so tied players share the middle of their ranks, the faster time higher. Measurements have no better side, so they get a percentile but no rank. A test is held at a combine when anyone has a result in it; a player with no result in a held test reads blank, never 0. Shooting is made over attempted, rebuilt from its parts; the published percentage agrees on every row compared. The read takes about 80 ms.

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
