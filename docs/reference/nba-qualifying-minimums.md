# The NBA's qualifying minimums

What a player needs to lead one of the NBA's statistics, and how Metis uses it (Plan T1204, decision D33). Read on 2026-11-17.

## Where the rule was read

The source was chosen in this order, as the owner's manager session set it: NBA.com's own page first, then the NBA's official guide or media materials, then Basketball-Reference's "Rate Statistic Requirements" page, which lists the NBA's minimums by season. Each was read with plain `curl` 8.5.0 from WSL, no browser headers, no cookies. The client names were `metis-research/1.0 (curl; open-source stats app)`, then `metis-research (https://github.com/Puffinnois/metis)` and curl's own `curl/8.5.0` where the first was refused. No request went to stats.nba.com (D7).

| URL                                                             | When (UTC)       | Result                                                                                 |
| --------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `https://www.nba.com/stats/help/statminimums`                   | 2026-11-17 17:26 | **HTTP 403**, "Access Denied" from the CDN, to all three client names                  |
| `https://www.nba.com/stats/help/statminimums/`                  | 2026-11-17 17:26 | **HTTP 403**                                                                           |
| `https://pr.nba.com/` (the NBA's communications site)           | 2026-11-17 17:26 | **HTTP 403**, to all three client names                                                |
| `https://pr.nba.com/?s=statistical+minimums`                    | 2026-11-17 17:26 | **HTTP 403**                                                                           |
| The NBA's official guide or media materials                     | 2026-11-17       | Not found: a web search for the minimums found no league-issued file a client can read |
| `https://www.basketball-reference.com/about/rate_stat_req.html` | 2026-11-17 17:26 | **HTTP 200**, 104 KB; the rule below is from this page                                 |

**NBA.com's page was not read.** Every number here comes from Basketball-Reference's page, which states the minimums a player needs "to qualify" for each statistic, season by season, BAA and ABA included. The owner can read NBA.com's page in a browser and compare, as for T1101.

That page mixes two kinds of minimum. For the statistics the NBA itself publishes leaders in (per-game points, rebounds, assists, steals, blocks and minutes; FG%, 3P%, FT%) the minimums are the NBA's. For true shooting, PER, the rebound, assist, steal, block, turnover and usage percentages, the ratings and win shares per 48, the minimums are Basketball-Reference's own: the NBA publishes no leaders in those. Metis takes only the first kind.

## The rule

Per player, regular season, per the page. "G" is games played, "FG" field goals made, "3P" threes made, "FT" free throws made. Seasons are written as the screens show them.

**Per-game leaders** (minutes, points, rebounds, assists, steals, blocks per game):

| Seasons             | Minimum                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| 1974-75 to 1997-98  | 70 G, or 2,000 minutes / 1,400 points / 800 rebounds / 400 assists / 125 steals / 100 blocks |
| 1998-99 (50 games)  | 43 G, or 1,220 / 854 / 488 / 244 / 76 / 61                                                   |
| 1999-00 to 2010-11  | 70 G, or 2,000 / 1,400 / 800 / 400 / 125 / 100                                               |
| 2011-12 (66 games)  | 56 G, or 1,610 / 1,127 / 644 / 321 / 100 / 80                                                |
| 2012-13             | 70 G, or 2,000 / 1,400 / 800 / 400 / 125 / 100                                               |
| 2013-14 to 2018-19  | 58 G                                                                                         |
| 2019-20 and 2020-21 | 58 G, or on pace for 58 G; stats prorated to an 82-game season                               |
| 2021-22 to now      | 58 G                                                                                         |

**Field-goal percentage:** 300 FG from 1974-75; 183 in 1998-99, 241 in 2011-12; in 2019-20 and 2020-21, 300 FG or on pace for it, prorated to 82 games.

**Free-throw percentage:** 125 FT from 1974-75; 76 in 1998-99, 100 in 2011-12; the same proration in 2019-20 and 2020-21.

**Three-point percentage:**

| Seasons            | Minimum                                           |
| ------------------ | ------------------------------------------------- |
| 1990-91 to 1993-94 | 50 3P                                             |
| 1994-95 to 1996-97 | 82 3P                                             |
| 1997-98            | 55 3P                                             |
| 1998-99            | 34 3P                                             |
| 1999-00 to 2010-11 | 55 3P                                             |
| 2011-12            | 44 3P                                             |
| 2012-13            | 55 3P                                             |
| 2013-14 to now     | 82 3P (2019-20 and 2020-21: or on pace, prorated) |

### A shortened season

The page gives each shortened season's own numbers, and every one is the full-season minimum scaled by the season's length, rounded: 1998-99 had 50 games, so 300 × 50 / 82 = 182.9 → 183 FG, 125 → 76 FT, 55 → 34 3P, 70 → 43 G; 2011-12 had 66, so 300 × 66 / 82 = 241.5 → 241 FG, 125 → 100.6 → 100 FT, 55 → 44 3P, 70 → 56 G. In 2019-20 and 2020-21 the page says "on pace … prorated to 82-game season": the same scaling, by the games a team played.

## What Metis does with it

- **The statistics the rule covers are the ones the source lists for the NBA:** points, rebounds, assists, steals and blocks per game (58 games), FG% (300 field goals made), 3P% (82 threes made) and FT% (125 free throws made). One rule for every season, the NBA's since 2013-14, per 82 games. The numbers are `NBA_MINIMUMS` in `src/shared/stats/catalogue/define.ts`. Minutes per game, the sixth per-game category the page lists, is the exception below.
- **They scale with the games in scope,** as before: a season's minimum is multiplied by the team games played over 82, so a shortened season and a season in progress scale as the NBA scales them, and a date range or the last N games scale the same way. **The scaled minimum is rounded to the nearest whole count,** as the page's shortened-season numbers are: 300 × 66 / 82 = 241.5 → 241. Unrounded, 2011-12's NBA field-goal leader, Tyson Chandler, who made exactly 241, would not qualify. Three of the page's 2011-12 numbers are rounded down where the nearest would be one more (321 assists, 100 steals, 100 free throws); only a player at exactly that number is affected.
- **Each covered statistic qualifies by its own minimum alone,** as the NBA's do: no games gate on a percentage and no minutes gate on either. A player with 300 field goals made in 55 games qualifies for FG%; one with 60 games and few minutes qualifies for points per game. A metric's `qualifyBy` names the column its `minSample` counts (makes, or games); its sample, the attempts for a rate, is still what shrinking weighs and what the tables show as "on N attempts". The engine tells the screens which columns these are (`ownQualifier`), and the leaderboard, the scatter, the trend's pool, the player rail and the stability measure rank such a column, and keep its rows under "Qualified only", by its own flag.
- **Every other player metric qualifies as before:** 1,000 minutes over 82 games for the player (the row qualifier, `min`), and the metric's own sample. On a leaderboard that mixes both kinds, "Qualified only" keeps the rows that qualify for the sorted column; a cell below its own minimum reads NQ as before.
- **Minutes per game stays on 1,000 minutes,** not the NBA's 58 games: `min` is the row qualifier of every uncovered metric, and one metric cannot qualify two ways. So minutes per game is the one category the source lists that Metis does not hold to the NBA's minimum.
- **The home boards** hold a per-game leader to 58 games of 82, scaled and rounded, and a total to no minimum, as the NBA's totals have none.

### Not the NBA's rule before 2013-14

From 1993-94 to 2012-13 the NBA's rule differed and Metis does not follow it: per-game leaders then needed 70 games of 82 (85 %, against 71 % now) or a total (1,400 points and so on); 3P% needed 55 threes from 1997-98 to 2012-13 (50 in 1993-94). Metis reads one rule for every season, so an old season's qualified list can differ from the NBA's at the edge. How much is measured in [nba-data-sources.md](nba-data-sources.md#the-nbas-leaders-against-the-qualified-leaders-plan-t1204). Following the era's rule would need minimums that change by season, and alternatives (games or a total), which the engine does not have; that is the owner's to decide.

### The playoffs

The page gives no NBA minimum for the playoffs (its playoff rows are Basketball-Reference's own). Metis scales the same rule to the playoff games in scope, as it did before.

### What keeps its Stage 5 minimum

Every metric the NBA's rule does not cover keeps its own minimum, unchanged, per 82 games and scaled the same way, and for players the 1,000 minutes of the row qualifier as well:

- **Other shooting rates:** 2P% (400 FGA), eFG%, TS%, points per shot, the attempt rates and shares (500 FGA or true-shooting attempts), assist-to-turnover (100 turnovers).
- **Estimated rates and box composites:** the rebound, assist, steal, block, turnover and usage percentages, PER, Game Score and the rest (1,000 minutes).
- **Scoring shares** (500 points or 1,000 minutes).
- **Tracking, hustle and box outs, play types, matchups, shots by zone, plays, on-court and impact metrics:** their own samples (possessions, touches, attempts, minutes), as the catalogue sets them.
- **Teams** always qualify.
