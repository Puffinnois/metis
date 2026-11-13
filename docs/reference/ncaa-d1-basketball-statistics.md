# NCAA Division I basketball statistics reference: NCAAM and NCAAW

Research date: **November 6, 2026**. Competitions: NCAA Division I men's basketball (**M**, NCAAM/MBB/NCAAMB) and women's basketball (**W**, NCAAW/WBB/NCAAWB).

This reference catalogs statistic names, meanings, formulas or calculation methods, retrieval sources, and live-data options. **Both** means a statistic is meaningful in both competitions, not that every source publishes it for every game. Source-specific measures, historical gaps, estimates, and licensed data are identified explicitly. Related variants are grouped; there is no finite inventory of every private metric or possible situational split.

This is a research document. Metis currently remains NBA-only under D15 in [decisions.md](../../decisions.md); this document does not add NCAA ingestion, change architecture, or approve paid data products. See the separate [NBA reference](nba-statistics.md) for NBA definitions; NBA constants and availability must not be carried over automatically.

**Evidence:** official NCAA material, provider documentation, library source, and model-author explanations were reviewed. Ordinary HTTP requests successfully retrieved one ESPN scoreboard and one completed-game summary for each competition. These limited samples establish access and some fields, not whole-season completeness or measured in-progress latency. Paid APIs were not authenticated. Certain NCAA ranking pages and Bart Torvik pages presented access restrictions; no bypass was attempted. Detailed evidence is in section 19.

## Contents

1. [Notation, aggregation, and competition rules](#1-notation-aggregation-and-competition-rules)
2. [Sources and retrieval routes](#2-sources-and-retrieval-routes)
3. [Traditional box scores and participation](#3-traditional-box-scores-and-participation)
4. [Shooting efficiency and scoring composition](#4-shooting-efficiency-and-scoring-composition)
5. [Possessions, tempo, and team efficiency](#5-possessions-tempo-and-team-efficiency)
6. [Rebounding and defense](#6-rebounding-and-defense)
7. [Passing, usage, and opportunity shares](#7-passing-usage-and-opportunity-shares)
8. [Shot locations and shooting context](#8-shot-locations-and-shooting-context)
9. [Play-by-play and game flow](#9-play-by-play-and-game-flow)
10. [Lineups, on-off, and situational splits](#10-lineups-on-off-and-situational-splits)
11. [Team records, schedules, and conference context](#11-team-records-schedules-and-conference-context)
12. [NET, quadrants, and team rating systems](#12-net-quadrants-and-team-rating-systems)
13. [Player composites and impact models](#13-player-composites-and-impact-models)
14. [Scouting, play types, hustle, and tracking](#14-scouting-play-types-hustle-and-tracking)
15. [Player profiles, recruiting, and other information](#15-player-profiles-recruiting-and-other-information)
16. [Live statistics: APIs, tools, and available information](#16-live-statistics-apis-tools-and-available-information)
17. [Bulk retrieval and reproducible examples](#17-bulk-retrieval-and-reproducible-examples)
18. [Historical coverage and interpretation traps](#18-historical-coverage-and-interpretation-traps)
19. [Verification and maintenance](#19-verification-and-maintenance)

## 1. Notation, aggregation, and competition rules

### Calculation conventions

- `P`, `T`, `O`, and `L` mean player, team, opponent, and relevant competition-season population. `T_X_on` means team X during the player's actual court time.
- `FGM/FG`, `FGA`, `2PM`, `2PA`, `3PM/3P`, `3PA`, `FTM/FT`, and `FTA` are shooting makes and attempts. `OREB/ORB`, `DREB/DRB`, `REB/TRB`, `AST`, `STL`, `BLK`, `TOV/TO`, `PF`, `PTS`, and `MP/MIN` use their ordinary box-score meanings.
- `T_MP` is the sum of all team player minutes. `T_MP / 5` estimates team elapsed playing time when the minute data is complete. It is **40 minutes in regulation**, not 48; use actual elapsed time for overtime and live games.
- `c` is a named free-throw possession/trip coefficient. Several college methodologies use **0.475**; 0.44 is not a universal basketball constant. Store the provider and coefficient rather than relabeling unlike TS%, usage, or possession estimates as identical.
- Unless specified otherwise, percentage formulas below multiply by 100. Ratios such as AST/TOV and points per possession do not. JSON may store percentages as fractions, whole percentages, or text.
- For a count `X`: total `ΣX`; per game `ΣX / GP`; per 40 `40ΣX / ΣMP`; per 100 on-court possessions `100ΣX / ΣPoss_on`. Player per-100 metrics based on minutes-estimated possessions must say so.
- Aggregate rates from summed numerators and denominators over matching games. Do not average game percentages. A publisher's rating may intentionally weight games differently; reproducing it requires that method, not simply pooling possessions.
- Missing, unsupported, unreported, and zero are distinct. A zero denominator produces an undefined rate. A missing play-by-play segment cannot be filled with a run of zero events.
- Count totals, calculated rates, estimates, and fitted models are different kinds of measurements. Counts have a recording rule rather than an algebraic formula.
- Rankings and percentiles require a population, qualification rule, tie convention, and snapshot date. Use separate M and W distributions, including separate season baselines for relative metrics.

The college free-throw coefficient and opportunity-based approach are documented by [KenPom's statistics explanation](https://kenpom.com/blog/stats-explained/). Alternative publisher definitions appear in the [Sports Reference college glossary](https://www.sports-reference.com/cbb/about/glossary.html) and [Her Hoop Stats glossary](https://herhoopstats.com/stats/glossary).

### Rules that change the data model

Under the current rules comparison, men play two 20-minute halves; women play four 10-minute quarters; both use five-minute overtimes and a 30-second shot clock. Men's ordinary bonus is one-and-one beginning with the seventh team foul in a half, then two shots at the tenth. Women's ordinary bonus is two shots beginning with the fifth team foul in a quarter. Fouls reset differently; special foul categories and overtime carryover need the full rules. [NCAA 2026–27 rules comparison](https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/rules/common/2026-27PRXBB_MajorRulesDifferences.pdf).

Consequences for analysis: use a competition-season period map; classify free-throw trips instead of assuming pairs; do not infer bonus solely from a player's fouls; account for the actual rule era when reading old games. Preserve raw period labels even if a library calls its generic column `qtr`. Rule books and corrections: [men](https://www.ncaa.org/championships/playing-rules/mens-basketball-playing-rules/), [women](https://www.ncaa.org/championships/playing-rules/womens-basketball-playing-rules/).

## 2. Sources and retrieval routes

Later sections inherit the retrieval route stated at their start. Each listed statistic therefore has a source even when the same URL is not repeated on every line. **BOX** means recorded box-score inputs; **PBP** means event inputs and documented event-processing rules; **MODEL** means a named publisher's output, not a universally interchangeable formula.

### Official NCAA: both

**NCAA** covers official individual/team season statistics, national leaders, game records, team schedules, record books, and statistical conventions. Start with [men's statistics and records](https://www.ncaa.org/championships/statistics-and-records/mens-basketball/) and [women's statistics and records](https://www.ncaa.org/championships/statistics-and-records/womens-basketball/), then [stats.ncaa.org](https://stats.ncaa.org/). Select the sport, Division I, season, and category; do not reuse a season-specific internal sport-year ID indefinitely.

The [basketball statisticians' manual](https://fs.ncaa.org.s3.amazonaws.com/Docs/stats/Stats_Manuals/Basketball.pdf) governs attribution and reconciliation, including team/dead-ball events. It is the scoring-rule authority, not a public bulk API specification. A uniform supported anonymous NCAA JSON API was not established in this research. School/conference official box scores are useful corroborating records, especially where aggregator data is sparse.

### SportsDataverse, hoopR, and wehoop: both, different datasets

**SDV-M / BOX-M / PBP-M:** `hoopR` supplies men's schedules, player/team box scores, plays, shots, season statistics, standings, game rosters, officials, and identity data through the [MBB loaders](https://hoopr.sportsdataverse.org/reference/load_mbb_pbp.html). Its published outputs can be consumed outside R.

**SDV-W / BOX-W / PBP-W:** `wehoop` supplies women's corresponding families through [its package index](https://wehoop.sportsdataverse.org/reference/) and [WBB loader source](https://github.com/sportsdataverse/wehoop/blob/main/R/load_wbb.R). WBB means women's college basketball here, not WNBA. Separate WNBA helpers are not substitutes.

The [sportsdataverse-data releases](https://github.com/sportsdataverse/sportsdataverse-data/releases) contain season artifacts. Use the actual release manifest and format; section 17 gives concrete patterns. Bulk publication is suitable for historical/local analysis, not guaranteed real-time updates. Section 18 lists documented differences between M and W coverage. Published shot rows do not establish complete coordinates.

### ESPN game JSON and clients: both

**ESPN / BOX / PBP:** the public website JSON routes use separate `mens-college-basketball` and `womens-college-basketball` paths. They expose game state, box scores, and events where available. These are website feeds used by community clients, not a contracted public developer API. Their access worked on the limited samples here; there is no inferred SLA. Details, exact URLs, observed fields, and client functions are in section 16. [hoopR scoreboard reference](https://hoopr.sportsdataverse.org/reference/espn_mbb_scoreboard.html), [wehoop scoreboard reference](https://wehoop.sportsdataverse.org/reference/espn_wbb_scoreboard.html).

### College Basketball Data: men verified, women not established

**CBBD** offers key-authenticated API access to games, boxes, plays, shooting, substitutions/lineups, ratings, polls, and other college information. Use `Authorization: Bearer <key>` at `https://api.collegebasketballdata.com`. The API is relevant to men's coverage; a matching women's product was **not verified**, so do not promise NCAAW support. Its [API quick start](https://api.collegebasketballdata.com/getting-started) links TypeScript, Python, and R clients. The [coverage inventory](https://api.collegebasketballdata.com/data-availability) is more precise than a single oldest-season claim.

Ordinary game-level ingestion is described as occurring after games; the separate paid-tier `/scoreboard` is explicitly live. Historical plays and a live scoreboard do not prove live detailed player statistics. [Publisher update notes](https://collegebasketballdata.com/about), [scoreboard schema](https://api.collegebasketballdata.com/api/games).

### Sports Reference: both, field-specific history

**SR** provides college player, school, season, game, and advanced-stat pages, with Stathead query tools. Use the [college site](https://www.sports-reference.com/cbb/), [college glossary](https://www.sports-reference.com/cbb/about/glossary.html), and [Stathead college tools](https://www.sports-reference.com/stathead/basketball/). This research does not establish a free public bulk API. Women's coverage exists; do not infer the men's oldest detailed season applies to women or that all player advanced fields exist historically. Some methodology pages blocked direct retrieval.

### College-specific analytics publishers

- **KP — KenPom, M:** adjusted team offense/defense/tempo, schedule strength, Four Factors, player opportunities, team composition, and other men's analytics. An official JSON API is documented: `https://kenpom.com/api.php?endpoint=ratings&y=2026`, bearer-token authentication. Check access terms and permitted endpoints; a website subscription and API access need not be identical. [API documentation](https://kenpom.com/api-documentation.php).
- **TR — Bart Torvik, M and W:** [men's T-Rank](https://barttorvik.com/) and [women's T-Rank](https://barttorvik.com/ncaaw/). Adjusted ratings and related published outputs; method differences and availability must be retained. Direct pages returned 403 here. The publisher's [T-Rank FAQ](https://adamcwisports.blogspot.com/p/every-possession-counts.html) explains its method; women's client support is documented by [SportsDataverse](https://sportsdataverse-py.sportsdataverse.org/docs/wbb/reference/bart_wbb). No bypass or successful direct data retrieval is claimed.
- **HHS — Her Hoop Stats, W:** women's player/team game and season statistics, advanced measures, and publisher ratings; some views require subscription. Use [Her Hoop Stats](https://herhoopstats.com/) and its glossary. No anonymous bulk API was established. WNBA features on the same site are not automatically NCAA features.
- **EvanMiya, M:** player Bayesian Performance Rating and team/lineup analytics. Use [the publisher](https://evanmiya.com/); formulas and calibration are publisher-specific, with access depending on the product.
- **CBB Analytics, both:** team/player dashboards, shot charts, lineup/on-off and scouting analysis. Use [the platform](https://cbbanalytics.com/); web access is not evidence of an unrestricted API or export licence.
- **SDV models, both:** separately published college team ratings, RAPM, player-value/BPM, and win-probability outputs. Their own model cards, versions, coverage, and sign conventions apply; see section 13.
- **Sportradar / SportsDataIO / Genius, both with unequal products:** commercial or partner feeds. Exact live coverage and access are in section 16.
- **Synergy, both where licensed:** classified possessions, play types, shooting/context and video-linked scouting. Its college coverage is separately identified from its international product. [Synergy Basketball API FAQ](https://developer.sportradar.com/basketball/reference/synergy-basketball-faqs).

## 3. Traditional box scores and participation

**Applicability:** both. **Retrieve:** NCAA official tables, BOX-M/BOX-W, ESPN summaries, SR, HHS for W, and licensed game-summary feeds. Fields beyond the basic player line are conditional. The following are ordinary statistical definitions; source attribution of an event follows the NCAA manual.

- **GP / G — Games played:** games in which the player participated; team GP counts included games. Count distinct qualifying games, not roster appearances.
- **GS — Games started:** count of games with a confirmed starter flag.
- **Bench appearances:** `GP − GS`, if starter coverage is complete.
- **MP / MIN — Minutes played:** observed time on court; sum duration. Parse `MM:SS` as time, not a decimal.
- **MPG — Minutes per game:** `MP / GP`.
- **Minutes share / %Min:** `100 × P_MP / (T_MP/5)` over the chosen team schedule; includes nonappearances if measuring season availability.
- **DNP — Did not play:** participation status, not a zero-minute played game.
- **Inactive / unavailable / reason:** source-reported status or explanation; no formula and no universal college injury taxonomy.
- **PTS — Points:** `2 × 2PM + 3 × 3PM + FTM`, equivalently `2FGM + 3PM + FTM`.
- **PPG / scoring average:** `PTS / GP`.
- **FGM / FG — Field goals made:** made two- and three-point field goals.
- **FGA — Field-goal attempts:** official shot attempts, including blocked attempts when credited.
- **FG misses:** `FGA − FGM`.
- **2PM / 2P:** `FGM − 3PM`.
- **2PA:** `FGA − 3PA`.
- **3PM / 3P:** made three-point field goals.
- **3PA:** attempted three-point field goals.
- **3P misses:** `3PA − 3PM`.
- **FTM / FT:** made free throws.
- **FTA:** official free-throw attempts.
- **FT misses:** `FTA − FTM`.
- **OREB / ORB:** rebounds recovered by the attacking side after its own miss, individually credited when applicable.
- **DREB / DRB:** defensive rebounds individually credited when applicable.
- **REB / TRB:** `OREB + DREB` under matching counting conventions.
- **Team rebounds:** rebounds assigned to the team rather than a player; retain offensive/defensive subdivisions if supplied.
- **Dead-ball rebounds:** accounting events distinguished by NCAA rules; do not treat all as live possession wins or automatically add them to rebound-rate denominators.
- **AST — Assists:** credited passes contributing directly to a made basket; recorded judgments, not every pass before a score.
- **STL — Steals:** credited defensive actions causing an opponent turnover; not every turnover has a steal.
- **BLK — Blocks:** credited deflections of opponent field-goal attempts; do not infer ball possession from a block.
- **TOV / TO — Player turnovers:** turnovers charged to a player.
- **Team turnovers:** unassigned/team-level turnovers; distinguish this from a field that means all team turnovers.
- **Total turnovers:** player turnovers plus unassigned team turnovers, only when those fields are nonoverlapping.
- **PF — Personal fouls:** credited fouls under the scoring rules.
- **Team fouls / bonus fouls:** period-specific foul totals for penalty administration; not always the simple sum of displayed PF.
- **Technical / flagrant fouls:** event categories; retain type, assessed party, and rule era when available.
- **Disqualifications / foul-outs / ejections:** distinct recorded outcomes, not interchangeable flags.
- **Plus-minus:** team points minus opponent points during a player's court time; supplied where present or derived from validated stints.
- **Bench points:** sum of points by players who did not start that game.
- **Opponent points / points allowed:** opponent final or current score, for team defense.
- **Rebounds, assists, steals, blocks, turnovers and fouls per game:** each count divided by GP. Aggregate counts first.
- **Double-doubles / triple-doubles / quadruple-doubles:** count games with at least two/three/four of PTS, REB, AST, STL and BLK at least ten; label the qualifying categories.
- **Threshold games:** number with at least a specified scoring/rebounding/etc. threshold, e.g. 20-point games; explicit threshold, no separate official event.
- **Season/career highs:** maximum game value in the available sample, not proof of an all-time high if history is incomplete.

Reconcile team points to shooting and player points, but do not require every team rebound or turnover to belong to a player. The sampled ESPN basic player labels were MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB and PF in both competitions; more detail depends on the game and provider.

## 4. Shooting efficiency and scoring composition

**Applicability:** both. **Retrieve:** derive from BOX, or use the explicitly named published field in NCAA/SR/KP/TR/HHS. These are arithmetic definitions unless described as estimated or model-based.

- **FG% — Field-goal percentage:** `100FGM/FGA`.
- **2P% — Two-point percentage:** `100 × 2PM/2PA`.
- **3P% — Three-point percentage:** `100 × 3PM/3PA`.
- **FT% — Free-throw percentage:** `100FTM/FTA`.
- **eFG% — Effective field-goal percentage:** `100(FGM + 0.5 × 3PM)/FGA`; credits the additional value of threes.
- **TSA — Estimated true-shooting attempts:** `FGA + cFTA`; a scoring-opportunity estimate, not a count of physical shots.
- **TS% — Estimated true-shooting percentage:** `100PTS / [2(FGA + cFTA)]`. The college SR/KP convention uses `c = 0.475`; preserve other providers' choices.
- **PPSA — Points per scoring attempt:** `PTS/(FGA + cFTA)`; equals twice fractional TS% when the same denominator is used.
- **Points per field-goal attempt:** `(2FGM + 3PM)/FGA`; field-goal points only.
- **PTS/FGA:** all points divided by field-goal attempts, including points at the line; different from field-goal points/FGA and PPSA.
- **3PAr — Three-point attempt share:** `100 × 3PA/FGA`.
- **2PAr — Two-point attempt share:** `100 × 2PA/FGA`.
- **FTr — Free-throw attempt rate:** `FTA/FGA`, sometimes displayed multiplied by 100.
- **FTM/FGA — Made-free-throw rate:** `FTM/FGA`; do not replace FTA with FTM without changing the metric label.
- **Estimated FT trips:** `cFTA`; actual trips require event classification.
- **HHS 3P Rate:** `100 × 3PA/(FGA + 0.475FTA)`, a share of scoring attempts, not ordinary 3PAr.
- **HHS FT Rate:** under its glossary's trip definition, `100 × (0.475FTA)/(2PA + 0.475FTA)`; a two-point-opportunity trip share, not FTA/FGA. This expression is the algebraic interpretation of the published definition; verify against exported values before implementation.
- **Two-point scoring share:** `100 × 2 × 2PM / PTS`.
- **Three-point scoring share:** `100 × 3 × 3PM / PTS`.
- **Free-throw scoring share:** `100FTM/PTS`; these three point shares sum to 100 when PTS is positive and scoring reconciles.
- **Paint scoring share / fast-break share / second-chance share:** `100 × category points/PTS`. These categories overlap; they are not a partition of points.
- **Relative efficiency:** `player_or_team_rate − competition_rate`; report percentage points for percentage rates, with a defined season/sample baseline.
- **TS+ / eFG+ / 3P+ or other index:** `100 × rate / baseline_rate` for an explicitly defined custom index; not an official NCAA field or guaranteed provider convention.
- **Zone-adjusted or expected efficiency:** model-predicted efficiency given shot selection, compared with actual efficiency; requires locations/context and a trained model, not just totals.

Provider distinctions matter: the [HHS glossary](https://herhoopstats.com/stats/glossary) uses scoring-attempt/trip definitions for several rates. The [college SR glossary](https://www.sports-reference.com/cbb/about/glossary.html) specifies its TS% coefficient. A metric name alone is not a formula specification.

**Worked example:** 8 FGM on 15 FGA, 3 made threes, and 5 FTM on 6 FTA yields 24 points, 63.33% eFG%, and approximately 67.23% TS% using 0.475. Using 0.44 would instead give approximately 68.03%; neither number can silently stand in for the other.

## 5. Possessions, tempo, and team efficiency

**Applicability:** both. **Retrieve:** BOX estimates; validated PBP for event counts; KP/TR/CBBD/HHS/SDV or licensed products for their published estimates and adjusted models.

- **Estimated offensive possessions:** `FGA − OREB + TOV + cFTA`. Define included team rebounds and turnovers; this is not an exact event count.
- **Two-team possession estimate:** `(Poss_est_T + Poss_est_O)/2`; gives a common game denominator when both sides' estimates differ.
- **Actual/event-derived possessions:** count completed offensive possessions from an explicit state machine. Retained possession after an offensive rebound, an and-one, or certain penalties must not be double-counted. End-of-period treatment must be documented.
- **Possessions per game:** total relevant possessions divided by included games.
- **Tempo / pace per 40:** `40 × possessions / elapsed_team_minutes`. Across games use total possessions and total time for the pooled version.
- **Overtime-adjusted game tempo:** `40 × game_possessions/(40 + 5 × overtime_periods)` for completed games under the corresponding rules.
- **Live pace estimate:** `40 × possessions_so_far/elapsed_game_minutes`; unstable early and undefined before play starts.
- **Offensive efficiency / ORtg:** `100 × team_points/offensive_possessions`.
- **Defensive efficiency / DRtg:** `100 × opponent_points/defensive_possessions`; lower is better.
- **Net efficiency / NetRtg / efficiency margin:** `ORtg − DRtg`, using compatible denominators and scales.
- **PPP — Team points per possession:** `PTS/Poss`; multiply by 100 to obtain a rating.
- **Points per play:** `PTS/(FGA + cFTA + TOV)` for this explicitly named box-score convention. This denominator does not subtract offensive rebounds; it differs from team PPP.
- **Scoring-possession rate:** `100 × possessions_with_points/completed_possessions`, from events; a one-point possession and a three-point possession each count once.
- **Empty-possession rate:** `100 × zero-point_possessions/completed_possessions`; complementary only when all completed possessions are classified consistently.
- **Average possession length:** sum of offensive live-clock seconds divided by completed possessions, with retained-ball segments assigned consistently. Not elapsed wall-clock broadcast time.
- **Four Factors:** eFG%, turnovers per possession, offensive rebound percentage, and free-throw rate; report offense and opponent versions separately. There is no universal four-number weighted composite required by the NCAA.
- **Adjusted offense / AdjO / AdjOE:** estimated scoring per 100 against a reference-quality defense, after a provider's opponent/site and other adjustments.
- **Adjusted defense / AdjD / AdjDE:** corresponding points allowed against a reference-quality offense.
- **Adjusted margin / AdjEM / AdjNet:** adjusted offense minus adjusted defense when both use the same scale.
- **Adjusted tempo / AdjT:** a provider's pace estimate after accounting for opponent pace and other factors. Not raw pace plus a universal constant.

The historical [KenPom ratings glossary](https://kenpom.com/blog/ratings-glossary/) explains 0.475, two-sided possession estimates, and adjusted metrics; it also describes game-level rather than possession-pooled averaging. Its older column descriptions and weights should not be treated as proof of the current model version. These adjustments cannot be recreated merely by subtracting opponent win percentage.

## 6. Rebounding and defense

**Applicability:** both. **Retrieve:** BOX for rates/estimates; PBP for on-court, possession, and event-context measures; specialized scouting for matchup attribution.

- **Team ORB% — Offensive rebound percentage:** `100T_OREB/(T_OREB + O_DREB)` using comparable live-rebound conventions.
- **Team DRB% — Defensive rebound percentage:** `100T_DREB/(T_DREB + O_OREB)`.
- **Team TRB% — Total rebound percentage:** `100T_REB/(T_REB + O_REB)` under a shared definition.
- **Opponent ORB% / ORB% allowed:** opponent offensive rebounds divided by opponent offensive plus team defensive rebounds; complementary to matching team DRB%.
- **Rebound margin:** `T_REB − O_REB`; per game divides by GP.
- **Player ORB%, minutes estimate:** `100 × P_OREB × (T_MP/5) / [P_MP × (T_OREB + O_DREB)]`.
- **Player DRB%, minutes estimate:** `100 × P_DREB × (T_MP/5) / [P_MP × (T_DREB + O_OREB)]`.
- **Player TRB%, minutes estimate:** `100 × P_REB × (T_MP/5) / [P_MP × (T_REB + O_REB)]`.
- **Actual on-court rebound percentages:** divide a player's credited rebounds by the matching opportunities during their actual stints. These are different from minutes-estimated opportunity rates.
- **Steals per 100 defensive possessions:** `100STL/Poss_def`; player version uses actual or explicitly estimated on-court possessions.
- **Team block rate, two-point denominator:** `100BLK/O_2PA`; a common college convention. It includes all credited blocks unless the publisher explicitly filters them.
- **Block rate, all-shot denominator:** `100BLK/O_FGA`; separate metric from BLK/O_2PA.
- **Player block rate, minutes estimate:** `100 × P_BLK × (T_MP/5)/(P_MP × O_2PA)` for the two-point convention.
- **Blocked-attempt share:** `100 × player's_attempts_blocked/player_FGA`; requires block-to-shot linkage, not the player's own BLK.
- **Opponent FG%, 2P%, 3P%, FT%, eFG%:** apply the corresponding formula to opponent totals.
- **Opponent shot mix / FT rate:** apply 3PAr, 2PAr, FTr to opponent inputs; describes team defense's observed outcomes, not individual guarding responsibility.
- **Turnovers forced per 100:** `100O_TOV/Poss_def`; include unassigned turnovers consistently.
- **Non-steal turnovers forced:** `O_TOV − T_STL` when the credited totals are compatible.
- **Steal share of forced turnovers:** `100T_STL/O_TOV`.
- **Fouls per 40:** `40PF/MP`; player court-time rate.
- **Fouls drawn per 40:** `40 × fouls_drawn/MP`; requires drawn-foul tags or classified PBP. FTA is not the same count.
- **Fouls per 100 defensive possessions:** `100 × defensive_fouls/Poss_def`; do not silently use all PF including offensive fouls.
- **Free throws allowed:** opponent FTA, FTM, FTr; distinguish shooting fouls, bonus trips, and technicals when possible.
- **Stops / stop rate:** classify scoreless completed defensive possessions, then `100stops/Poss_def`; a provider's individual estimated stops formula may be different.
- **Defensive rating while on court:** `100 × opponent_points_during_stints / defensive_possessions_during_stints`; a team result during the player's minutes, not a causal personal defense score.

The rate conventions for assists, steals and blocks are illustrated by [KenPom's box-score explanation](https://kenpom.com/blog/box-scores/). Real rebound chances, contest rates, and defender-specific shot outcomes require additional data described in section 14.

## 7. Passing, usage, and opportunity shares

**Applicability:** both. **Retrieve:** BOX for estimates; PBP plus lineups for observed on-court opportunities; published KP/HHS/SR or specialist fields for provider-specific definitions.

- **AST/TOV — Assist-to-turnover ratio:** `AST/TOV`; undefined with no turnovers unless a display explicitly uses another convention.
- **Assist-minus-turnover margin:** `AST − TOV`; an arithmetic summary, not a quality-adjusted creation measure.
- **Team AST% / assisted-field-goal rate:** `100T_AST/T_FGM`.
- **Player AST%, minutes estimate:** `100P_AST / [(P_MP/(T_MP/5)) × T_FGM − P_FGM]`; can become unstable for tiny samples and is not a direct count of teammate opportunities.
- **Player actual on-court AST%:** `100P_AST/(T_FGM_on − P_FGM)` for the relevant stints.
- **Assists per 100 possessions:** `100AST/Poss_on` for a player; name whether Poss_on is observed or estimated.
- **Potential assists:** passes that lead to qualifying shot attempts, including misses, under a tracking definition. Not derivable from AST alone; licensed/tagged data required.
- **Assist points created:** sum points on baskets linked to a player's assists; commonly two or three per assisted field goal. Do not infer the split from AST totals alone.
- **Assist network:** counts of assists from player A to scorer B, with made-shot points/types if supplied; sum linked events.
- **Secondary assists / hockey assists:** preceding passes under a provider's timing/touch rule; generally not a complete public NCAA box-score field.
- **Estimated usage / USG%:** `100 × (P_FGA + cP_FTA + P_TOV) × (T_MP/5) / [P_MP × (T_FGA + cT_FTA + T_TOV)]`.
- **Observed on-court used-play share:** player used plays divided by team used plays during the same stints. A used play here means FGA, relevant FT trip, or turnover under the chosen definition.
- **KenPom %Poss:** publisher's individual possession-usage measure, based on possession-ending involvement. Do not assume it is identical to every simple USG formula. [Individual rating and usage explanation](https://kenpom.com/blog/offensive-ratingpossession-usage/).
- **%Shots / shot opportunity share, minutes estimate:** `100P_FGA / [(P_MP/(T_MP/5)) × T_FGA]`.
- **Team production shares:** for X in PTS, FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, REB, AST, STL, BLK or TOV, `100P_X/T_X` over the same sample. Each is a distinct share; a higher turnover share is not automatically desirable.
- **On-court production shares:** `100P_X/T_X_on`; different denominator from full-team-season shares.
- **Turnover percentage per used play:** `100TOV/(FGA + cFTA + TOV)`; a shot/play-based rate.
- **Turnover percentage per possession:** `100TOV/Poss`; does subtract offensive-rebound continuations through the possession denominator. Keep separate from the previous rate.
- **Live-ball / dead-ball turnover rate:** corresponding classified turnovers divided by possessions or total turnovers; state which denominator.
- **Bad-pass / lost-ball / offensive-foul / violation turnovers:** count tagged events; several labels may be absent or represented only in text.
- **Pass volume / passes received / touches:** tracking quantities; not the same as assists and not established as complete public D-I data.

## 8. Shot locations and shooting context

**Applicability:** both when events or scouting cover the game. **Retrieve:** PBP/shot releases, CBBD for its men's shooting/plays, CBB Analytics, HHS where the NCAA view supplies the field, or Synergy/licensed tagging. A WNBA feature on HHS is not proof of an NCAA equivalent.

For every documented zone/context `Z`, derive **attempts**, **makes**, **FG% = 100FGM_Z/FGA_Z**, **attempt share = 100FGA_Z/FGA**, **field-goal points**, and **eFG%** when two- and three-point shots are combined. These are five metric families rather than five new event types.

- **Shot coordinates:** supplied location `(x,y)` with units, origin, basket orientation, and raw coordinates preserved; no formula.
- **Shot distance:** if calibrated coordinates and basket location are known, `sqrt((x−basket_x)^2 + (y−basket_y)^2)`; respect units. Prefer the published distance when coordinates are not interpretable.
- **At-rim / restricted-area shots:** shots inside a declared boundary. Provider rim zones are not necessarily the rulebook restricted-area semicircle.
- **Paint non-rim shots:** paint attempts outside the chosen rim boundary.
- **Midrange / nonpaint two-pointers:** declared two-point regions outside the paint; boundaries vary.
- **Corner / above-break / left-wing / right-wing / top threes:** spatial partitions with college court geometry, not copied NBA boundaries.
- **Distance bins:** e.g. 0–3, 3–10, 10–16 feet; custom boundaries must be explicit and stable within an analysis.
- **Layups / dunks / tip-ins / hooks / jump shots:** classified shot types; count/makes/percentage by type. Do not label all near-basket shots layups.
- **Assisted and unassisted makes:** partition makes with complete assist attribution; `assisted_make_share = 100assisted_FGM/FGM`. Missing assistant data is not proof of unassisted play.
- **Catch-and-shoot / pull-up / off-dribble shots:** requires pass/dribble context or tagged video; generic PBP jump-shot descriptions are insufficient.
- **Transition / half-court attempts:** event or vendor-defined phase classifications; publish classification rules.
- **Putbacks / second-chance attempts:** qualifying attempts following an offensive rebound under a stated sequence/time rule.
- **Shot-clock buckets:** attempts with a specified remaining shot-clock range; not derivable from game clock alone.
- **Contested / open / defender-distance buckets:** requires tracking or analyst classification; threshold and vendor required.
- **Expected points / expected FG% / shot quality:** model output from location/context. `shot_value × estimated_make_probability` gives expected field-goal points for that attempt; handling shooting fouls requires a richer model.
- **Shot-making over expectation:** `actual_points − expected_points`, or actual minus expected FG%; units and input population must match.
- **Shot coverage rate:** `100 × eligible_shots_with_valid_location / eligible_shots`; report beside a chart so missing attempts are visible.

The [CBBD coverage inventory](https://api.collegebasketballdata.com/data-availability) distinguishes shot-type history from coordinates, and lists coordinates from ending-year 2019 with missing locations. That is CBBD's coverage, not a universal NCAA start date. A coordinate on a non-shot event may be a placeholder; test both event type and coordinate validity.

## 9. Play-by-play and game flow

**Applicability:** both, conditional on complete events. **Retrieve:** PBP-M/PBP-W, ESPN summary `plays`, licensed event feeds, CBBD men's plays. Most quantities below are calculated by grouping ordered events; they are not guaranteed precomputed fields.

- **Event ID and sequence:** source identifiers/order, not counts of possessions. Preserve long identifiers exactly as strings or 64-bit integers.
- **Period and game clock:** recorded period and remaining time. Men's second half and women's second quarter are not the same game phase.
- **Elapsed game time:** sum lengths of completed periods plus elapsed time in the current period, using the correct competition-season map.
- **Wall-clock event time:** real-world timestamp when supplied; distinct from game clock and from local retrieval time.
- **Score after event:** recorded or validated reconstructed home/away score. Store whether the source or reconstruction supplied it.
- **Score margin:** chosen team's score minus opponent score.
- **Lead changes:** transitions between positive and negative margin under an explicit treatment of intervening ties.
- **Times tied:** occurrences of newly reached tie states; do not count every non-scoring event while tied.
- **Time leading / tied / trailing:** sum game-clock intervals in each state. `lead percentage = 100 × leading_seconds/elapsed_seconds` if that is the chosen convention.
- **Average lead / time-weighted margin:** `Σ(margin × interval_seconds)/Σinterval_seconds`.
- **Largest lead / deficit:** maximum positive / magnitude of minimum negative margin.
- **Unanswered scoring run:** consecutive points by one team before opponent scoring; maximum across sequences gives largest run.
- **Scoring drought:** consecutive elapsed game time without that team's scoring; separate field-goal droughts from all-point droughts.
- **Points off turnovers:** points in the scoring sequence attributed to an opponent turnover under a declared definition; may already be in a team summary.
- **Second-chance points:** points after offensive-rebound continuations under the source rule; record whether free throws are included.
- **Fast-break points:** points credited to transition/fast-break actions; tags or timing classifier required.
- **Points in the paint:** scored field-goal points from the defined paint area; not all two-point baskets.
- **And-one opportunities / conversions:** made baskets with associated single additional free throw; count trips and makes separately.
- **Shooting-foul frequency:** shooting-foul events divided by eligible shot/attack opportunities; the denominator is provider-specific.
- **One-and-one trips / front-end makes / missed front ends:** classify bonus FT sequences under the era's men's or women's rules, rather than treating one FTA as an incomplete pair.
- **Technical/flagrant FT points:** sum free throws linked to these penalties, not ordinary shooting attempts.
- **Timeouts / reviews / challenges:** count supplied event tags; a missing tag does not prove no review occurred.
- **Substitution events:** player-in/out actions with time; used for stints after validation.
- **Possession start/end reason:** made basket, defensive rebound, turnover, period end, or relevant FT sequence; derived classification rather than a single event-type lookup.
- **Possession starting state:** inbound/rebound/steal, court location if supplied, score and clock; useful for contextual splits.
- **Win probability / WP:** model estimate of winning from game state; use source/version and pregame inputs. It is not an observed percentage of games in this particular game.
- **WPA — Win probability added:** `WP_after − WP_before`, oriented to a named team. Assigning all change to one player requires a separate attribution method.
- **Excitement / leverage / game control:** provider/model-dependent summaries of win probability swings or time spent competitive. Without the exact aggregation rule, retrieve the publisher value instead of inventing a substitute.

The [men's SDV win-probability model](https://hoopr.sportsdataverse.org/articles/college-basketball-win-probability-model.html) and [women's model](https://wehoop.sportsdataverse.org/articles/womens-college-basketball-win-probability-model.html) are independent of ESPN's `winprobability` output. Keep both if used, with their provenance.

## 10. Lineups, on-off, and situational splits

**Applicability:** both; event/substitution coverage is often the limiting factor. **Retrieve:** reconstructed PBP stints, CBB Analytics, EvanMiya for its men's product, CBBD's documented men's lineup endpoints, or licensed scouting. These are statistical on-court combinations, not fantasy lineup features.

- **Stint:** continuous interval with the same five players on each side, with period/time boundaries.
- **Lineup minutes / possessions:** summed court time and offensive/defensive possessions for a specified five-player unit.
- **Lineup points / plus-minus:** points for, points against, and their difference during those stints.
- **Lineup ORtg / DRtg / NetRtg:** use the efficiency formulas with lineup-specific points and possessions.
- **Lineup Four Factors:** eFG%, turnover rate, ORB%, FTr for the same stint sample, with opponent versions.
- **Two-/three-/four-player combinations:** include all stints in which every selected player is on court; do not sum overlapping groups as if disjoint.
- **On-court and off-court production:** separate counts/rates for a player's presence/absence within a declared team-game sample.
- **On-off differential:** `NetRtg_on − NetRtg_off`, or separately named offensive/defensive differences. This is observational and influenced by teammate/opponent combinations.
- **With-or-without:** split player/team production by another player's presence; report minutes and possessions in each cell.
- **Starter/bench splits:** player's performance grouped by game starter status, not necessarily the current five.
- **Period splits:** halves for M; quarters for modern W; overtime separately. Historical women's halves must be supported.
- **Clutch splits:** apply a stated clock-and-margin rule, such as final five minutes with absolute margin at most five; this is an analyst-defined NCAA comparison unless a publisher specifies it.
- **Garbage-time filtered stats:** exclude events under a documented score/time/probability rule; no universally official NCAA garbage-time flag.
- **Home/away/neutral splits:** classified relative to the team, including neutral tournament sites and pseudo-home situations if the provider identifies them.
- **Opponent/conference/top-ranked splits:** use season-correct memberships and a declared ranking date (at game time or latest).
- **Conference/nonconference/postseason splits:** source game classification plus competition rules; an early-season tournament is not automatically postseason.
- **Date range / last N / rest splits:** define whether N counts a player's appearances or the team's scheduled games; rest uses elapsed days and actual dates.
- **Win/loss / ahead/behind/tied splits:** game outcomes versus within-game score states are different filters.
- **Opponent strength / quadrant splits:** snapshot-dependent groups, described in section 12.

For every split, sum counts and rate components within the filtered sample. Do not distribute whole-season published numbers proportionally across dates. A source with season-only ratings cannot answer an exact last-five-games rating without a separate calculation.

## 11. Team records, schedules, and conference context

**Applicability:** both. **Retrieve:** official NCAA/school/conference records; ESPN/SDV schedules and standings; SR; provider game databases. Conference membership and D-I status are season-dependent.

- **W / L / GP:** included wins, losses, and games, using the chosen official or on-court record convention.
- **Win percentage:** `W/(W+L)`; multiply by 100 for display as a percent.
- **Conference wins/losses/percentage:** same calculations limited to designated conference games.
- **D-I wins/losses:** results against D-I opponents under the relevant season classification; different from all countable games.
- **Home/road/neutral record:** W-L grouped by venue classification.
- **Scoring offense / scoring defense:** `PTS/GP` and `O_PTS/GP`; lower scoring defense may also reflect slower pace.
- **Scoring margin / MOV:** `(PTS − O_PTS)/GP`; raw points per game, not per possession.
- **Rebounding margin / turnover margin:** `(REB − O_REB)/GP` and `(O_TOV − T_TOV)/GP`; explicitly choose the positive-good turnover orientation.
- **Conference position / standing:** source-ordered position after the conference's tiebreaking process; not generally identical to win-percentage rank.
- **Games behind:** `[(leader_W − W) + (L − leader_L)]/2`; descriptive where used, not a replacement for conference standings rules.
- **Win/loss streak:** consecutive qualifying outcomes; postponed games are not losses or streak breaks by themselves.
- **Strength of schedule / SOS:** named model's opponent difficulty; may use opponent ratings, opponents' records, location, or a reference team's expected wins.
- **Nonconference SOS:** same model restricted to nonconference games; do not mix with overall SOS.
- **Opponent win percentage / opponents' opponent win percentage:** schedule-derived averages with explicit exclusion and weighting rules; needed for historical RPI variants.
- **Rest days:** elapsed calendar days between games minus one under this convention; label timezone and back-to-back handling.
- **Travel distance:** distance between venues under a defined route model; inferred context, not observed actual travel.
- **Attendance / capacity / fill rate:** recorded attendance and venue capacity; `100attendance/capacity` only if comparable definitions are available.
- **Coach record / tenure:** wins and losses assigned to the documented coach/period, with interim appointments and vacated records handled explicitly.
- **Tournament seed / region / round / result:** committee-assigned or bracket-recorded metadata, not formulas.
- **Automatic qualification / at-large selection / eligibility:** published status, not something inferred solely from NET rank or regular-season conference position.
- **National/conference rank:** ordinal position in a specified official statistical category and qualification population.

A D-I team's game against a lower-division opponent may appear in its official season statistics but be excluded from a D-I-only analytical rating. Keep both the game's counting status and the analytical filter.

## 12. NET, quadrants, and team rating systems

### NCAA NET and tournament resume: both, separate populations

- **NET — NCAA Evaluation Tool rank:** NCAA's competition-specific sorting tool. Its components are **Team Value Index** (results/opponent/site) and **adjusted net efficiency** (performance adjusted for opposition and location). Full fitted parameters are not provided by a simple public box-score equation; retrieve the NCAA snapshot rather than labeling an approximation official NET. [NCAA NET explanation](https://www.ncaa.org/news/march-basketball/media-center-how-do-net-rankings-work-in-ncaa-tournament-selection/).
- **NET change:** prior snapshot rank minus current rank if positive means improvement; save dates and do not substitute rank difference for a change in underlying ability.
- **Quadrant record:** count wins/losses in buckets determined by opponent NET rank and game location. A later opponent ranking can change a prior game's bucket. Preserve both snapshot date and whether the rank is at-game or latest.
- **Quality wins / bad losses:** either explicitly defined quadrant counts or a provider's stated rule; these phrases are not universal extra stats.
- **WAB — Wins Above Bubble:** `actual wins − Σ(reference_bubble_team_win_probability_for_each_game)`. The reference-team quality and game-probability model are essential inputs; publishers' WAB values may differ. Women's NCAA use began in 2025–26. [Women's selection overview](https://www.ncaa.org/championships/march-madness/selections-101/division-i-womens-basketball-championship/).

**Men's quadrant thresholds** (opponent NET, home / neutral / away): Q1 = 1–30 / 1–50 / 1–75; Q2 = 31–75 / 51–100 / 76–135; Q3 = 76–160 / 101–200 / 136–240; Q4 = 161+ / 201+ / 241+. Use the actual season's membership rather than hard-coding an old last-place rank. [NCAA men's selection reference](https://www.ncaa.org/championships/march-madness/selections-101/division-i-mens-basketball-championship/).

**Women's quadrant thresholds, explicitly verified for 2025–26:** Q1 = 1–25 / 1–35 / 1–45; Q2 = 26–55 / 36–65 / 46–80; Q3 = 56–90 / 66–105 / 81–130; Q4 = 91+ / 106+ / 131+. Women's NET began in 2020–21; its inputs exclude preseason information and non-D-I games. Do not apply men's thresholds to women's results or claim these season-specific thresholds are permanently fixed. [NCAA women's NET FAQ](https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/d1/women/D1WBB_NETFAQ.pdf).

Retrieve published rankings and team sheets through the official statistics portals. Direct NCAA.com NET pages required a browser/access check during this review; no current ranking values are asserted here.

### Predictive, resume, and poll metrics

- **KenPom adjusted ratings, M:** AdjO, AdjD, AdjEM and AdjT measure team efficiency/tempo after adjustments. Retrieve KP's named outputs/API; the complete current fitting process is not reducible to one raw-stat identity.
- **KenPom Luck, M:** departure of actual results from expected results based on game performances; use the publisher's value/method, not any arbitrary residual with the same name. [Ratings glossary](https://kenpom.com/blog/ratings-glossary/).
- **T-Rank / adjusted efficiencies, M and W product lines:** retrieve TR's competition-specific ratings; do not assume shared fitted parameters.
- **Barthag, TR:** the published men's FAQ uses `AdjOE^11.5 / (AdjOE^11.5 + AdjDE^11.5)`, representing modeled win probability against an average D-I team. This is not raw win percentage. The FAQ also describes venue, time weighting, and game-script changes; the compact formula alone cannot reproduce the underlying adjusted ratings. Women's exact calibration should be verified separately. [Author's FAQ](https://adamcwisports.blogspot.com/p/every-possession-counts.html).
- **HHS team rating, W:** publisher's team-strength rating, with offensive/defensive components; retrieve published values and methodology version. Do not relabel it NET or assume KenPom coefficients. [HHS ratings access](https://herhoopstats.com/).
- **BPI — Basketball Power Index, M verified here:** ESPN's model of team strength with opponent, possession, location and contextual inputs; fitted formula not fully specified in the reviewed material.
- **SOR — Strength of Record, M verified here:** ESPN's estimate of difficulty of matching/exceeding a team's record for a reference team, rather than predicting the next game's point margin.
- **KPI — Kevin Pauga Index, M selection use verified:** average of provider-valued game results after its opponent/location and other adjustments; complete game-value coefficients are not given here. BPI, SOR and KPI meanings: [NCAA selection criteria](https://www.ncaa.org/championships/march-madness/selections-101/division-i-mens-basketball-championship/).
- **SRS — Simple Rating System, both as a method:** solve `rating_i = average_margin_i + average_opponent_rating_i` with a centering constraint. Choices about home court, game weighting, and non-D-I games create variants. Retrieve SR or CBBD's named SRS; do not mix their calibrations.
- **Elo, both as a method:** `R_new = R_old + K(result − expected_result)`; a common expected-result form is `1/[1 + 10^((R_opp−R_team−H)/D)]`. `K`, home advantage `H`, scale `D`, season regression, and margin adjustments are model parameters. CBBD publishes men's Elo and adjusted ratings via [its ratings API](https://api.collegebasketballdata.com/api/ratings).
- **Pythagorean expected win percentage:** `PF^x/(PF^x + PA^x)`; specify the exponent, raw versus adjusted scoring, and opponent context. **Expected wins** = fraction × GP; **win residual** = actual minus expected wins. This generic residual is not automatically KenPom Luck.
- **Historical RPI:** basic form `0.25WP + 0.50OWP + 0.25OOWP`, with historical location weighting and opponent-exclusion rules depending on the published version. Not current NET. Do not copy a glossary typo that makes weights sum above one; verify any attempt to reproduce official historical RPI.
- **AP / Coaches poll rank and points, both:** recorded ballot-based ranking; points and first-place votes are separate fields. It is not the same as NET or an efficiency ranking. Retrieve dated official poll publications or a documented poll dataset.
- **Model consensus / average rank:** analyst calculation across a named model set; define missing-model handling and whether ranks or standardized scores are averaged.
- **Game win probability / expected margin:** model outputs from team ratings and game context; calibration and coverage required. These are statistical estimates, not observed results or betting advice.

For simple custom models, the equations above define the calculation. For named proprietary systems, import the publisher's output or implement its actual documented model; do not brand a generic approximation with the publisher's name.

## 13. Player composites and impact models

**Applicability:** basic formulas can be evaluated for both with complete inputs; named models only where the identified publisher covers that competition. **Retrieve:** BOX for arithmetic composites; SR/HHS/KP/TR/EvanMiya or SDV model releases for published estimates. A model field named BPM is not necessarily Basketball-Reference's BPM.

### Arithmetic and established box-score composites

- **Efficiency / EFF, explicitly defined simple version:** `PTS + REB + AST + STL + BLK − (FGA−FGM) − (FTA−FTM) − TOV`. Different sites may call other formulas efficiency.
- **Game Score / GmSc:** `PTS + 0.4FGM − 0.7FGA − 0.4(FTA−FTM) + 0.7OREB + 0.3DREB + STL + 0.7AST + 0.7BLK − 0.4PF − TOV`. A weighted single-game production summary, not opponent-adjusted impact. [College SR glossary](https://www.sports-reference.com/cbb/about/glossary.html).
- **Individual offensive rating:** `100 × estimated_points_produced / estimated_individual_possessions_used`; Oliver-style calculations assign credit for scoring, assists, and offensive rebounds. The full intermediate formulas must be used; `100PTS/team_possessions` is a different statistic. [KenPom individual rating explanation](https://kenpom.com/blog/offensive-ratingpossession-usage/).
- **Individual defensive rating:** estimated points allowed per 100 based on team defense and estimated individual stops. It is not the same as an actual on-court team DRtg or a matchup tracking measure. Retrieve the publisher's value/method where offered.
- **PER — Player Efficiency Rating:** weighted box-score production per minute, pace-adjusted and scaled to a league reference average. In the common formulation, `PER = adjusted_unscaled_PER × 15 / league_average_adjusted_unscaled_PER`. This normalization is only the last step; the weighted numerator, possession values, and league context are essential. Use a college-specific published implementation and season baseline; do not reuse NBA league constants. [Underlying PER method](https://www.basketball-reference.com/about/per.html); HHS visibly publishes women's NCAA PER.
- **OWS / DWS / WS — Offensive, defensive, total Win Shares:** estimates of wins attributable to offensive/defensive contributions. At a high level, `OWS = marginal_offense/marginal_points_per_win`, `DWS = marginal_defense/marginal_points_per_win`, and `WS = OWS + DWS`. Marginal production and points-per-win require the publisher's full method; do not derive WS from raw plus-minus. [College Win Shares methodology](https://www.sports-reference.com/cbb/about/ws.html), linked as the authoritative implementation reference; direct retrieval was blocked in this review.
- **WS/40:** `40WS/MP`; rate form of the matching college Win Shares, not NBA WS/48.
- **BPM / OBPM / DBPM:** a box-score model of total/offensive/defensive impact per 100 possessions, relative to a reference player. For an implementation with additive components, `BPM = OBPM + DBPM`; fitting/adjustment parameters must come from that implementation.
- **Value above replacement / wins above replacement:** convert a model's above-replacement rate and exposure into value, then optionally wins. General form `value = (impact_rate − replacement_rate) × possessions/100`; wins require a points-to-wins conversion. There is no universal NCAA VORP/WAR constant or verified universal publication across M and W here.

### Published SportsDataverse college models

These are available research routes, not validated Metis imports.

- **Men's box player value:** `box_obpm`, `box_dbpm`, `box_bpm`, minutes, and qualification via `hoopR::load_mbb_player_value()`. The documented calculation standardizes box features, scores them with fitted ridge coefficients, then applies a team constraint. `box_bpm = box_obpm + box_dbpm`. Retrieve the accompanying coefficient artifact to reproduce the version; do not hard-code a generic NBA BPM formula. [Men's model explanation](https://hoopr.sportsdataverse.org/articles/college-basketball-player-value-model.html).
- **Women's box player value:** `wehoop::load_wbb_player_value()` returns corresponding women's college outputs; the documented range starts in ending-year 2014, with 2015 values unavailable because their team-rating input is missing. Its model has a qualification flag and low-minute limitations. [Women's model explanation](https://wehoop.sportsdataverse.org/articles/womens-college-basketball-player-value-model.html).
- **APM — Adjusted plus-minus:** fit possession/stint outcomes using player-presence indicators and context. A standard weighted least-squares form minimizes `Σ w_s(y_s − X_sβ)^2`; coefficients attempt to separate shared court time, but observational data and lineup correlation remain limitations.
- **RAPM — Regularized adjusted plus-minus:** add a penalty, e.g. minimize `Σ w_s(y_s − X_sβ)^2 + λΣβ_j²`. Design, penalty, intercept handling, priors, and possession inclusion rules define the actual model.
- **Men's league-wide RAPM:** `hoopR::load_ncaa_mbb_rapm()`; within-team version `load_ncaa_mbb_rapm_within_team()`. League-wide and within-team fits answer different questions and must not be merged into one national rank. Related possession and matchup-stint loaders provide analytical inputs. [Men's RAPM documentation](https://hoopr.sportsdataverse.org/articles/college-basketball-rapm-model.html).
- **Women's league-wide/within-team RAPM:** `wehoop::load_ncaa_wbb_rapm()` and `load_ncaa_wbb_rapm_within_team()`. In the documented league output, positive `drapm` is beneficial and `rapm_net = orapm + drapm`. In the within-team output, negative `rapm_def` is beneficial and `rapm_net = rapm_off − rapm_def`. Preserve those signs. [Women's RAPM documentation](https://wehoop.sportsdataverse.org/articles/womens-college-basketball-rapm-model.html).
- **Model uncertainty / standard error / interval:** use the published uncertainty field when it actually exists. A model card may describe fields absent from a released asset; do not manufacture a precision estimate from the number of decimal places.
- **SDV adjusted team ratings:** separately fitted M and W outputs, useful as model context; not NCAA NET or KenPom. [Men's model](https://hoopr.sportsdataverse.org/articles/college-basketball-team-ratings-model.html), [women's model](https://wehoop.sportsdataverse.org/articles/womens-college-basketball-team-ratings-model.html).

### Other publisher impact measures

- **BPR / OBPR / DBPR — Bayesian Performance Rating, M:** EvanMiya's total/offensive/defensive player-strength estimates combine box-score, play-by-play and historical information. These are fitted predictive ratings; a simple public closed-form box-score replacement was not established. Retrieve the named publisher output. [EvanMiya methodology](https://evanmiya.com/how-it-works).
- **HHS player composites, W:** use the women's NCAA player view for PER, Win Shares and other actually exposed fields. Preserve its game/season grain and metric conventions; the existence of a WNBA field on the same site does not establish NCAA availability. [HHS NCAA player access](https://herhoopstats.com/).
- **Custom composite / standardized score:** specify `Σ(weight_j × standardized_metric_j)`, reference distribution, direction, and missing-data policy. A calculated research index is not an official NCAA or named vendor rating.

## 14. Scouting, play types, hustle, and tracking

**Applicability:** both in principle; mostly licensed, manually tagged, or incomplete publicly. **Retrieve:** Synergy/Sportradar scouting products, CBB Analytics where offered, or a team's documented video/tracking export. No complete free nationwide NCAA tracking database was verified.

### Play-type families

Typical scouting categories include **transition** (before the defense is set), **isolation** (individual attack), **pick-and-roll ball handler**, **roll/pop screener**, **post-up**, **spot-up**, **cut**, **off-screen**, **handoff**, **putback**, and **miscellaneous**. Definitions belong to the tagging provider, including which player receives the terminal action and whether a pass-out continues the category. See [Synergy's team-stat views](https://support.synergysports.com/support/solutions/articles/77000565436-team-stats) and [API coverage/definitions](https://developer.sportradar.com/basketball/reference/synergy-basketball-faqs).

For **each** available play type, the useful statistics are:

- **Possessions / plays:** recorded count of qualifying tagged sequences; not necessarily equal to full team possessions.
- **Frequency:** `100 × type_possessions/all_tagged_possessions`.
- **Points:** points credited to those tagged sequences.
- **PPP:** `type_points/type_possessions`.
- **FGM / FGA / FG% / eFG%:** corresponding shooting outcomes within the category.
- **Turnover frequency:** `100type_TOV/type_possessions`.
- **Shooting-foul frequency:** qualifying foul-ending sequences divided by type possessions, according to vendor rules.
- **Score frequency:** percentage of type possessions producing points; distinct from FG%.
- **And-one frequency:** qualifying and-one sequences per type possessions.
- **Percentile / rank:** position among qualified comparable players/teams in that competition and version.
- **Defensive counterpart:** outcomes allowed while assigned to defend the type; an assignment/tagging measure, not automatically all opponent points during a player's minutes.

These formulas describe calculations from tagged inputs, not a promise that every vendor supplies every column. Scouting products may be processed after games rather than live. Do not infer an eleven-type partition from ordinary event labels such as “jump shot.”

### Hustle and off-ball measures

- **Deflections:** tagged disruptions of passes/dribbles; count events, including some that do not become steals.
- **Loose balls recovered:** recovery events after neither team has controlled possession, under the source rule.
- **Charges drawn:** offensive-charge events attributed to the defender; not all offensive fouls.
- **Screen assists / screen-assist points:** screens tagged as creating a made basket and the associated points.
- **Box outs / box-out success:** tagged exclusion actions and resulting qualifying rebound outcomes; `success rate = successes/opportunities`.
- **Contests / contest rate:** tagged challenges to shots, split by shot type if supported.
- **Rebound chances / conversion:** eligible tracked opportunities and actual recoveries; `100rebounds/chances`, which differs from box-score ORB% or DRB%.
- **Contested rebound rate:** contested rebounds divided by rebounds or contested chances; label the denominator.
- **Matchup possessions/minutes:** observed or inferred defensive assignments to a particular opponent.
- **Defended FG% / difference:** makes divided by qualifying defended attempts, and difference from a specified shooting baseline.
- **Help-defense / rotation / rim-deterrence measures:** provider-specific video/tracking classifications or models; no universal box-score formula.

### Continuous tracking and inferred movement

- **Distance / speed / acceleration:** derive from timestamped player trajectories; `distance = Σsegment_length`, `speed = distance/time`, acceleration is change in velocity per time.
- **Touches / time of possession / dribbles:** tracked ball-control events and duration; not estimated from minutes played.
- **Drives / paint touches / post touches / elbow touches:** tracked attacks or touches meeting spatial definitions.
- **Passes / potential assists / secondary assists:** tracked passing chains; public AST only captures a small subset.
- **Spacing / gravity / defensive attention:** learned or rule-based summaries of off-ball positioning; model and input specification required.
- **Expected shot quality / expected points:** fitted outcome probabilities from shot context; no universally official college formula.

A published shot coordinate is one event location, not a continuous tracking frame. A statistic being measurable in principle is not evidence that it can be retrieved freely for all D-I schools.

## 15. Player profiles, recruiting, and other information

**Applicability:** both unless a product is explicitly M-only. **Retrieve:** official school rosters/media guides, NCAA records, SDV identity/roster tables, ESPN profiles, CBBD men's recruiting/portal where documented, HHS women's profiles, and the original award or recruiting publisher.

- **Identity:** provider athlete ID, full/display name, school, jersey, position and competition; recorded fields, no formula.
- **Height / weight:** published measurements, with units and snapshot date; historical profile files may contain current values.
- **Class / experience / redshirt designation:** source-reported categories; not an automatic birth-year or remaining-eligibility calculation.
- **Age:** difference between date of birth and a stated reference date; unavailable if reliable birth date is absent.
- **Minutes-weighted team height/experience:** `Σ(player_measure × player_minutes)/Σplayer_minutes`; define how class becomes a numeric experience value. KP's published team-composition metrics may use more specialized rules.
- **Roster continuity / returning production:** fraction of prior-season minutes, points or possessions retained by a defined returning-player set. A transfer returning to college basketball is not necessarily returning to the same team.
- **Transfer origin/destination/date/status:** source-recorded player movement; preserve status changes rather than treating a reported destination as guaranteed participation.
- **Recruiting stars / composite / national-position-state rank:** publisher-specific evaluations and ordinal ranks, with class year and snapshot; no universal NCAA numeric formula.
- **Awards / all-conference / All-America / player-of-year:** recorded selections from a named awarding body and season; votes/points only where published.
- **Availability / missed games:** distinguish roster membership, DNP, reported injury, suspension, and confirmed game absence; do not assign an injury reason from zero minutes alone.
- **Draft selection / destination:** recorded professional draft result; NBA and WNBA identifiers are separate from college IDs. NCAA does not have an NBA-style nationwide college draft combine dataset.
- **PRA / PR / PA / RA:** `PTS+REB+AST`, `PTS+REB`, `PTS+AST`, `REB+AST`; ordinary combined totals.
- **Stocks:** `STL+BLK`; informal label for a calculated total.
- **Fantasy points as a metric:** `Σweight_j × count_j + specified_bonuses`; name platform, contest and rule date. This is a statistical column, not a fantasy roster/advice feature.
- **NIL valuations / compensation estimates:** external economic data, not official performance stats; a valuation is not verified compensation. No complete public NCAA payment dataset is claimed.

Recruiting rank, current biography, lineup identity and game performance have different dates and grains. Store enough provenance to prevent a current roster or updated height from rewriting historical facts.

## 16. Live statistics: APIs, tools, and available information

### 16.1. ESPN website feeds: both, keyless access observed

Use separate competition paths:

```text
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=YYYYMMDD&groups=50&limit=1000
GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?dates=YYYYMMDD&groups=50&limit=1000
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event={ESPN_GAME_ID}
GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event={ESPN_GAME_ID}
```

These are HTTP JSON snapshots, not a documented public WebSocket. The community clients use `groups=50` for D-I discovery; a high limit avoids a small default slate, but returned records still require division/date/completeness checks. Games involving a D-I team can include a non-D-I opponent. Obtain game IDs from returned schedules; do not generate them from team IDs.

**Access evidence:** on November 6, the November 5 scoreboard requests returned 65 men's and 86 women's events, all marked complete. One completed-game summary per competition contained both teams' player boxes, team statistics, and plays. This is a sample result, not proof those counts represent every official game that day. Exact sample URLs and observed limits are in section 19.

Use `hoopR::espn_mbb_scoreboard()` or `wehoop::espn_wbb_scoreboard()` as convenient R clients, or ordinary JavaScript/TypeScript `fetch`. [Men's client documentation](https://hoopr.sportsdataverse.org/reference/espn_mbb_scoreboard.html), [women's client documentation](https://wehoop.sportsdataverse.org/reference/espn_wbb_scoreboard.html). Inspect corresponding package ESPN endpoint indexes for box-score and PBP helpers supported by the installed version.

**Practical limit:** successful ordinary requests do not confer guaranteed access, redistributable rights, a support contract, or uniform game coverage. Respect access denials; no client impersonation or challenge bypass is required or proposed.

### 16.2. Sportradar: both, licensed REST and push

The men's product uses `ncaamb`; the women's uses `ncaawb`. Push subscription patterns are:

```text
GET https://api.sportradar.com/ncaamb/{access_level}/stream/{language_code}/events/subscribe
GET https://api.sportradar.com/ncaamb/{access_level}/stream/{language_code}/statistics/subscribe
GET https://api.sportradar.com/ncaawb/{access_level}/stream/{language_code}/events/subscribe
GET https://api.sportradar.com/ncaawb/{access_level}/stream/{language_code}/statistics/subscribe
x-api-key: YOUR_API_KEY
```

These are continuous HTTP JSON streams. Follow redirects and handle message framing/heartbeats. Push is an add-on; a self-issued basic trial does not automatically include it. Supplement streams with REST Game Summary/Boxscore/Play-by-Play and schedule/status recovery. [Men's Push guide](https://developer.sportradar.com/basketball/docs/ncaamb-ig-push), [women's Push guide](https://developer.sportradar.com/basketball/reference/ncaawb-push-feeds), [women's Events syntax](https://developer.sportradar.com/basketball/reference/ncaawb-push-events.md), [women's Statistics syntax](https://developer.sportradar.com/basketball/reference/ncaawb-push-statistics.md).

**Coverage is per game.** The men's guide distinguishes full live PBP/team/player coverage from extended box-score coverage, where scores/time can be live while detailed player/team stats arrive after the gamebook. Conference/broadcast availability influences coverage, which can change before tipoff. A product covering all D-I teams is not a guarantee of live detailed stats for every game. [Men's live retrieval and coverage](https://developer.sportradar.com/basketball/docs/ncaamb-ig-live-game-retrieval).

The women's statistics stream specifies live **full-coverage** games. Its REST guide lists a three-second in-progress Game Boxscore cache and real-time updates conditional on coverage. Cache TTL is not end-to-end arena latency. [Women's update frequencies](https://developer.sportradar.com/basketball/docs/ncaawb-ig-update-frequencies).

**Recovery documentation caveat:** the women's general Push page describes stateless reconnects, while its endpoint pages document a ten-minute `resumeSessionId` replay. Confirm the contracted version's behavior; always keep REST reconciliation. A heartbeat is not a new play or a continuously ticking game/shot clock. The NBA-specific running-clock product is not evidence of the same college entitlement.

### 16.3. SportsDataIO: both, materially different depth

Authentication: `Ocp-Apim-Subscription-Key: YOUR_API_KEY`.

```text
# Men's scores and player/team box scores
GET https://api.sportsdata.io/v3/cbb/scores/json/GamesByDate/{date}
GET https://api.sportsdata.io/v3/cbb/stats/json/BoxScore/{gameid}
GET https://api.sportsdata.io/v3/cbb/stats/json/BoxScoresDelta/{date}/{minutes}

# Women's scores and game state
GET https://api.sportsdata.io/v3/cwbb/scores/json/GamesByDate/{date}
```

The men's catalog documents live/final scores, box scores and changed-record box-score retrieval. Read the delta contract as changed snapshots, not necessarily numerical increments. A corresponding men's PBP product was **not established** from the reviewed catalog. [Men's API documentation](https://sportsdata.io/developers/api-documentation/ncaa-basketball).

The women's catalog reviewed here exposes teams/conferences, schedules, season/in-progress helpers, and live/final scores with period scores. It lists a **five-second call interval** for live GamesByDate. It does **not establish live player box scores or PBP** equivalent to the men's boxes. Do not create guessed `cwbb/stats/BoxScore` URLs from the men's pattern. [Women's API documentation](https://sportsdata.io/developers/api-documentation/ncaa-womens-basketball).

Choose live-entitled endpoints; `Final` variants are a separate product. Prices/quotas and exact rights should come from the current plan or quote; no paid request was executed here.

### 16.4. CBBD live scoreboard: men verified

```text
GET https://api.collegebasketballdata.com/scoreboard
Authorization: Bearer YOUR_API_KEY
```

The documented endpoint requires Patreon Tier 1 or higher. It returns current games with status, clock/period, teams and points/linescores, venue, conference/neutral-site indicators, television information and betting fields where present. It has no historical season selector. This is distinct from CBBD's historical game and play operations, and does not itself contain a complete player box score. Women's coverage and a universal freshness SLA were not established. [Live scoreboard schema](https://api.collegebasketballdata.com/api/games).

### 16.5. NCAA LiveStats / Genius and school live-stat pages: both

**NCAA LiveStats** is the official courtside collection platform, not automatically a free public developer API. Schools may link public game centers from schedules, while machine feeds and downstream rights depend on the relevant arrangement. Genius's NCAA partnership identifies LiveStats and licensed data distribution; “free to member schools” is not an open-data licence for every third-party application. Evaluate a partner/licensed feed for supported access. [Genius/NCAA partnership description](https://www.geniussports.com/newsroom/ncaa-and-genius-sports-expand-partnership-through-2032/).

School-specific live-stat pages can be useful for checking a missing game, but are not one stable nationwide schema. A scoreboard embed or widget is also not equivalent to downloadable raw event data.

### 16.6. What information can a live experience expose?

The following inventory combines **observed ESPN fields** with conditional provider capabilities. Absence must remain explicit. See sections 3–15 for meanings/formulas.

**Game identity and context:** competition; provider game ID/UID; season and season type; scheduled/start date; team IDs/names/abbreviations/logos; home/away designation; neutral-site and conference-game flags; venue/location; broadcasts; records and displayed poll rank; attendance/officials when supplied. Attendance and officials may only be finalized later.

**Scoreboard state:** numeric/text status; scheduled/live/intermission/delayed/postponed/cancelled/final states where supported; completion flag; clock/display clock; current period; regulation-period count; current scores; period linescores; winner flag after completion; leaders; PBP-availability indicator. Timeouts, possession arrow, bonus, team fouls, and shot clock require explicit provider fields; they were not established as uniformly available from the sampled ESPN scoreboard.

**Player box score:** player ID/name and profile fields; starter, active, DNP and ejected flags where populated; minutes; points; FG/3PT/FT makes-attempts; total/offensive/defensive rebounds; assists; turnovers; steals; blocks; fouls. Read each stat array using its labels/keys, not a hard-coded column order. A roster player with no stats is not necessarily a played game with zero production.

**Team box score:** shooting totals and percentages; rebounds; assists; steals/blocks; personal fouls; player/unassigned/total turnovers; technical fouls; points off turnovers; fast-break points; paint points; largest lead; lead changes; leading-time share. These categories were present by name in the sampled women's summary; completeness and definitions need further checks. Second-chance points, bench points, team rebounds and other extensions are provider/game-dependent, not promised by every response.

**Events:** ID; sequence; type/subtype text; human description; period/clock; event wall-clock timestamp; team/participants when supplied; home/away score; shooting/scoring flags; score/attempt value; coordinates where present. An event sequence may contain shots, free throws, rebounds, turnovers, fouls, substitutions, timeouts, period boundaries and other administrative events; coverage of each class must be measured. The sampled first events correctly showed 20:00 in a men's half and 10:00 in a women's quarter.

**Optional model/context payloads:** win-probability series, leaders, odds, game notes, stories and highlights may appear in a summary. Their presence is not a complete live market/video licence, nor proof that every field is current. ESPN probability and independently computed SDV probability are different products.

**Derived during the game:** shooting percentages/eFG/TS, shot mix, PRA and other combinations, milestone progress, runs, margin, period splits, provisional possession/pace/efficiency, shot charts, and validated lineup/on-off statistics. These require no separate metric API if the underlying inputs are complete, but corrections can change the output. An early-game rate is not a forecast.

**Not established by these basic feeds:** continuous player/ball trajectories, comprehensive touches/passes/dribbles, defender distance, all hustle events, complete play-type tagging, every substitution in every game, reliable injuries, instantaneous revised NET, or live recalculated PER/Win Shares/BPR. Evaluate specialized sources; never infer these from a generic “live stats” claim.

### 16.7. Collection behavior and tool choices

For a future implementation, native TypeScript `fetch` fits the existing language stack; R `hoopR`/`wehoop` and Python SportsDataverse clients are research tools; an HTTP streaming client is needed for Push; DuckDB stores/query results but does not supply live data. This document does not implement an adapter.

- Share one collector across screens, select relevant games, and obey plan quotas/cache guidance. Large college slates make per-game polling substantially more expensive than an NBA slate.
- Keep snapshots and deltas distinct. Replace/upsert cumulative counts; do not add the same running totals repeatedly.
- Upsert events using provider, competition, game and event identifiers. Handle revised/deleted/reordered events and recompute affected possessions/stints.
- Preserve raw payload, source timestamps, retrieval time, schema version, coverage tier, and error state. Show last-successful-update age.
- Treat schedule discovery, game-state updates, player stats, PBP, odds, and model ratings as separate freshness streams.
- A display countdown interpolated between samples is an estimate. Resynchronize on new observations and do not invent a running shot clock.
- Recover from outages with a complete snapshot/event reconciliation; back off on errors and stop assuming empty results mean no games when access failed.
- Finalize and later recheck corrected games. Keep provider IDs separate and do not overwrite historical data from another source.

No live feed here was benchmarked for event-to-screen latency. Cache interval, suggested polling interval, publisher update cadence, and observed latency are four different measurements.

## 17. Bulk retrieval and reproducible examples

### 17.1. Concrete public bulk assets

These four example Parquet URLs returned HTTP 200 to HEAD requests on November 6, 2026. That verifies availability, not row-level completeness or file contents:

```text
https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_mens_college_basketball_player_boxscores/player_box_2026.parquet
https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_mens_college_basketball_team_boxscores/team_box_2026.parquet
https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_womens_college_basketball_player_boxscores/player_box_2026.parquet
https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_womens_college_basketball_team_boxscores/team_box_2026.parquet
```

Here `2026` means **2025–26**. This convention must not be generalized to every provider: Sportradar's men's season parameter uses the **starting** year. Preserve the source's season label and map it explicitly.

Other documented release families use these tags and stems; inspect the release assets to establish each available season and extension rather than assuming a continuous range:

- Men's PBP: `espn_mens_college_basketball_pbp`, `play_by_play_{year}`.
- Women's PBP: `espn_womens_college_basketball_pbp`, `play_by_play_{year}`.
- Men's schedules: `espn_mens_college_basketball_schedules`, `mbb_schedule_{year}`.
- Women's schedules: `espn_womens_college_basketball_schedules`, `wbb_schedule_{year}`.
- Player/team boxes use the verified tags above with the appropriate ending year.
- Rosters, season stats, shots, standings, officials and model releases have their own inventories; never infer their coverage from the player-box file.

Route authority: [hoopR loader source](https://github.com/sportsdataverse/hoopR/blob/main/R/load_mbb.R) and [wehoop loader source](https://github.com/sportsdataverse/wehoop/blob/main/R/load_wbb.R). RDS and Parquet are file formats, not independent sources. Prefer exact identifier-preserving formats; some releases are Parquet-only.

### 17.2. R research examples

These are documented client usage examples, **not executed** as part of this review. They are not additions to Metis's TypeScript implementation.

```r
# Packages must already be installed; some loaders require arrow.
men_players <- hoopR::load_mbb_player_box(seasons = 2026)
men_teams   <- hoopR::load_mbb_team_box(seasons = 2026)
men_plays   <- hoopR::load_mbb_pbp(seasons = 2026)

women_players <- wehoop::load_wbb_player_box(seasons = 2026)
women_teams   <- wehoop::load_wbb_team_box(seasons = 2026)
women_plays   <- wehoop::load_wbb_pbp(seasons = 2026)
```

For direct TypeScript or DuckDB ingestion, retrieve the confirmed Parquet artifacts instead of requiring an R runtime. A future NCAA data layer would still need its own approved scope, measured schema inventory, and identity/coverage design.

### 17.3. A single live-route inspection in TypeScript

Illustration only; the equivalent HTTP routes were checked, but this code was not run as an app feature:

```ts
const competition = 'womens-college-basketball' // or 'mens-college-basketball'
const base = `https://site.api.espn.com/apis/site/v2/sports/basketball/${competition}`
const response = await fetch(`${base}/scoreboard?dates=20261105&groups=50&limit=1000`, {
  signal: AbortSignal.timeout(15000)
})
if (!response.ok) throw new Error(`Scoreboard HTTP ${response.status}`)
const payload: unknown = await response.json()
// Validate the schema, retain raw IDs, and inspect events before normalization.
// Use a returned game ID with `${base}/summary?event=${gameId}`.
```

A production loop would need provider-specific quota handling, cache/retry behavior, state transitions, and correction processing from section 16. This single read is not an SLA or a production collector.

## 18. Historical coverage and interpretation traps

### Documented ranges are not audited completeness

All numeric years below are **season-ending years**, except where explicitly labeled otherwise. These are the current publishers' documented ranges/gaps, not an independent full-download audit.

- **SDV men's:** the loader documents PBP/shot assets for 2003 and 2006 onward, leaving 2004–05 absent; boxes from 2003; schedules/game rosters from 2002; officials from 2003 except 2010; roster and player-season-stat loaders from 2025. Existing assets can still contain sparse fields. [MBB loader reference](https://hoopr.sportsdataverse.org/reference/load_mbb_pbp.html).
- **SDV women's:** the source documents boxes/PBP/shots/game rosters from 2004 and schedules from 2001. Standings, player/team season stats and officials have their own starts and omit 2024–25; boxes/PBP are not thereby absent in those years. Some older artifacts are Parquet-only. Current rosters have a shorter range. [WBB loader implementation](https://github.com/sportsdataverse/wehoop/blob/main/R/load_wbb.R).
- **CBBD men's:** the coverage audit reports exceptionally sparse 2003–04 boxes; plays for 2003 and 2006 onward; shot coordinates from 2019 with missing locations; usable lineup statistics from 2024. Stored season leaderboards and adjusted ratings have shorter histories than schedules. Use its operation-specific filters/record limits instead of assuming one broad call returns the whole season. [CBBD availability](https://api.collegebasketballdata.com/data-availability).
- **SDV women's ratings:** the published model notes unusable 2015 ratings, a failing level check in 2008, thin older samples and additional early-era comparability issues. These are model-output gaps even when raw game data exists. [Women's team-rating limitations](https://wehoop.sportsdataverse.org/articles/womens-college-basketball-team-ratings-model.html).
- **NCAA records/SR:** long record-book or score history is not equally long possession, minute, turnover, shot-location, or on-court history. Women's pre-NCAA/AIAW records and NCAA records require the exact record book's scope; do not silently merge definitions of a career record.

### Interpretation rules for a trustworthy catalogue

1. **Season versus calendar date:** a November 2026 game belongs to 2026–27, commonly ending-year 2027; provider filters may instead require starting-year 2026.
2. **Competition namespace:** use M/W plus provider identity. The same school name, logo or institution ID does not make men's and women's team-season rows interchangeable.
3. **Membership history:** D-I status, transition eligibility, conference affiliations and school names change. Keep season-aware membership; never hard-code the current team count into all years.
4. **Non-D-I games:** preserve game rows and their inclusion flags. Official player totals and D-I-only rating samples can legitimately differ.
5. **Tournament categories:** conference tournaments, NCAA tournaments, other postseason tournaments, early-season invitational events and exhibitions need separate classification. Do not map NBA playoff/Cup rules into college data.
6. **Rule eras:** historical women's halves, shot-clock changes, bonus rules, and three-point line changes affect period parsing, possession estimates and shot zones. Use the relevant rulebook, not today's constants for every season.
7. **Rebound accounting:** keep individual/team/dead-ball classifications; automatically assigning every miss a player rebound corrupts rates and possessions.
8. **Turnover accounting:** ESPN-style `turnovers`, `teamTurnovers`, and `totalTurnovers` can represent different aggregates. Reconcile with player lines and the official box rather than summing all three.
9. **Zero-minute participation:** rounded minutes may be zero for an actual brief appearance. Use participation evidence, not `MIN > 0`, to determine GP.
10. **Long event IDs:** values may exceed JavaScript's safe integer range. Preserve strings from JSON or exact integer values from Parquet; do not round identifiers during joins.
11. **Event labels are not outcomes:** the WBB loader warns that a free-throw type label can be used for both makes and misses and that `score_value` can describe attempted value. Use scoring flags/result and validated scores, not the label alone. [WBB source definitions](https://github.com/sportsdataverse/wehoop/blob/main/R/load_wbb.R).
12. **Coordinates:** mixed origins/units, missing locations, placeholders and parser versions can change charts. Keep raw and normalized coordinates with a transformation version.
13. **On-court reconstruction:** substitutions can be incomplete; unresolved stints should be unknown, not an invented five-player unit. A full-game box does not prove a full event history.
14. **Snapshot bias:** current player biography or NET rank is not necessarily what was known on game day. Keep observation dates, especially for backtests.
15. **Transfers and duplicate totals:** separate player-team rows from combined player-season totals. A person changing schools or names must not become two careers or double-counted season production.
16. **Small samples and qualification:** a one-shot 100% shooter is not automatically the national shooting leader. Use the relevant NCAA/publisher minimums and do not copy one competition's qualification rules into another without checking.
17. **Formula namespace:** preserve coefficient, denominator, scale, model version and defensive sign. “AST%,” “PPP,” “FT Rate,” “BPM” and “RAPM” can describe materially different quantities.
18. **Rights and freshness:** a public library's code licence is not a licence for every upstream dataset. A file publication timestamp is not necessarily its latest completed game or last corrected game.

## 19. Verification and maintenance

### What was checked in this research

- Required project decisions and the current plan stage were read; the new file is documentation only.
- Official NCAA rules/selection explanations, API and library documentation, and model-author explanations were reviewed. Citations are attached to the relevant definitions and routes.
- Both ESPN scoreboard URLs in section 16.1 succeeded for `dates=20261105`, using ordinary requests with no API key. They returned 65 M and 86 W records; exhaustive official-day reconciliation was not performed.
- [Men's completed-game sample, ESPN ID 401906770](https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=401906770): two player-box groups, two team-stat groups, 440 plays; opening period labeled first half at 20:00.
- [Women's completed-game sample, ESPN ID 401911737](https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event=401911737): two player-box groups, two team-stat groups, 455 plays; opening period labeled first quarter at 10:00; 452 win-probability entries in the inspected response.
- Four 2026 player/team-box Parquet asset URLs returned HTTP 200 to HEAD checks. No full season was downloaded or loaded into Metis.
- Direct Bart Torvik pages returned 403; NCAA.com NET pages required a browser/access check; the college Win Shares methodology page blocked retrieval. Their existence/relevance is referenced, but their complete current data was not read.
- Commercial APIs and model-release correctness were not tested with paid credentials or independently reproduced. The R and TypeScript examples were not executed as integration tests. Completed-game retrieval does not demonstrate in-progress latency or a continuous clock.

### What a future source audit should measure

For each competition, source, table and season, record schema, rows, unique games/teams/players, first/last actual game, field non-null rates, duplicates, checksum and timestamp. Compare games to the official schedule, then reconcile scores, shooting points, player/team counts, period totals, and rate components against official boxes. Test lower-coverage schools as well as major-conference broadcasts.

For PBP, measure score reconstruction, shot/FT/turnover/rebound reconciliation, coordinate completeness, substitution validity and the fraction of possessions with known lineups. State tolerances explicitly, particularly for rounded minutes, percentages and estimated possessions. Preserve disagreements between sources instead of replacing them invisibly.

For live feeds, inspect a genuinely active game, record coverage tier and timestamps, observe corrections and disconnects, then compare the finalized game. Measure availability, correctness and freshness separately. Commercial entitlement and permitted storage/display/export require the actual product agreement.

For ratings/models, save coefficients, model card, output version, reference population, qualification flag, units, sign and input vintage. If a field is undocumented or unavailable, report that reason rather than substituting a familiar NBA metric.

**Maintenance:** recheck provider schemas and access, NCAA rule/selection versions, membership history, source release manifests and model cards before extending the catalogue. This reference describes the major available statistical families and retrieval options; private vendor metrics and arbitrary new splits cannot be certified exhaustively.
