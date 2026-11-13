# European basketball statistics reference: EuroLeague and EuroCup, men and women

Research date: **November 6, 2026**.

This document catalogs statistic names, meanings, formulas or calculation methods, retrieval sources, and live-data options for four competitions:

- **EL-M:** men's EuroLeague, organized by Euroleague Basketball; competition code `E` in its feeds.
- **EC-M:** men's EuroCup, organized by Euroleague Basketball; competition code `U` in its feeds.
- **EL-W:** EuroLeague Women, organized by FIBA Europe.
- **EC-W:** EuroCup Women, organized by FIBA Europe.

These are four separate competitions. The men's `E` and `U` APIs do not cover the women's competitions. EuroCup Women is also distinct from the men's **FIBA Europe Cup**, the Basketball Champions League, national leagues, EuroBasket national-team tournaments, and 3x3 basketball.

The catalog covers published statistics and clearly labeled calculations that their underlying data can support. It cannot enumerate every proprietary model or every possible filter combination. **All four** means a measure is applicable across the four competitions, not that all providers publish it, all seasons contain it, or every game has live coverage.

This is research, not an ingestion implementation. Metis remains NBA-only under D15 in [decisions.md](../../decisions.md). This document does not change that decision or authorize subscriptions or scraping. Related documents: [NBA statistics](nba-statistics.md) and [NCAA Division I statistics](ncaa-d1-basketball-statistics.md).

**Evidence:** ordinary HTTP requests retrieved completed-game box scores, play-by-play, and shot events for one EL-M and one EC-M game. PIR was reconciled across all 48 player rows. Official women's statistics pages, statistical manuals, and provider documentation were researched; no authenticated women's live feed was tested. Historical completeness and in-progress latency were not measured. Section 19 records the precise limits.

## Contents

1. [Notation, rules, and aggregation](#1-notation-rules-and-aggregation)
2. [Sources and retrieval map](#2-sources-and-retrieval-map)
3. [Traditional box scores and participation](#3-traditional-box-scores-and-participation)
4. [Shooting efficiency and scoring composition](#4-shooting-efficiency-and-scoring-composition)
5. [Possessions, pace, and team efficiency](#5-possessions-pace-and-team-efficiency)
6. [Rebounding, defense, and fouls](#6-rebounding-defense-and-fouls)
7. [Passing, usage, and opportunity shares](#7-passing-usage-and-opportunity-shares)
8. [Shots, locations, and play types](#8-shots-locations-and-play-types)
9. [Play-by-play and game flow](#9-play-by-play-and-game-flow)
10. [Lineups, on-off, and splits](#10-lineups-on-off-and-splits)
11. [Standings, competition formats, and team strength](#11-standings-competition-formats-and-team-strength)
12. [PIR, EFF, and other composite ratings](#12-pir-eff-and-other-composite-ratings)
13. [Player, club, and game information](#13-player-club-and-game-information)
14. [Live APIs and tools](#14-live-apis-and-tools)
15. [Information available during a live game](#15-information-available-during-a-live-game)
16. [Observed men's API field dictionary](#16-observed-mens-api-field-dictionary)
17. [Historical coverage and data quality](#17-historical-coverage-and-data-quality)
18. [Retrieval choices for these four competitions](#18-retrieval-choices-for-these-four-competitions)
19. [Verification and source register](#19-verification-and-source-register)

## 1. Notation, rules, and aggregation

### 1.1 Notation

`P` is a player, `T` their team, `O` the opponent, and `L` the competition-season reference pool. `MIN` means decimal minutes, calculated from seconds, not a display string such as `13:17`. `GP` means actual appearances for players and counted games for teams. `FGA = 2PA + 3PA`; `FGM = 2PM + 3PM`; `REB = OREB + DREB` within the same accounting scope. `FC` means fouls committed; `FD` means fouls drawn/received; `BA` means blocks against the shooter.

`GMIN` means elapsed game minutes, normally 40 plus 5 for each overtime. `TM_MIN` means the sum of the team's individual player minutes, normally `5 × GMIN`. They are different quantities. For a multi-game player calculation, team totals and `TM_MIN` must cover the same games, team stints, and competition as the player numerator.

`POSS_T` and `POSS_O` mean team offensive and defensive possessions under an explicit counting method. `c` is the declared free-throw coefficient in an estimator; `0.44` is a conventional approximation, not a universal European rule or an official possession count.

A percentage is `100 × numerator / denominator`. Ratios such as points per possession and AST/TOV are not automatically percentages. Zero denominators return `null`/undefined with a reason; they do not turn into a fabricated zero. Published zero makes from positive attempts remain genuine zeros.

### 1.2 Playing and statistical rules

All four use the familiar 40-minute, four-quarter European basketball framework, with 10-minute quarters and 5-minute overtimes. Use **per 40** for a regulation-length normalization; per 36 is also a valid explicitly labeled player rate. Do not use NBA 48-minute pace or 12-minute-quarter parsing. Historical rule changes and unusual game formats still need season-specific treatment.

FIBA's 2026 rules took effect October 1, 2026. They include changes to technical-foul categories and replace the previous unsportsmanlike-foul category with disruptive and flagrant categories. Preserve historical event codes and check each competition's implemented rules; do not silently relabel every older `UF` event. The men's competitions also publish their own statistical criteria. [FIBA's 2026 announcement](https://about.fiba.basketball/en/regions/africa/news/fiba-official-basketball-rules-2026-to-take-effect-october-1), [Euroleague Basketball statistical criteria](https://ftpserver.euroleague.net/general/EB_Statistics_Criteria_Manual.pdf).

**Assists require special care.** The men's criteria manual, version 1.2 dated September 5, 2025, permits an assist on an eligible pass leading to shooting-foul free throws once the first free throw is made. Consequently, official AST is not necessarily a count of assisted made field goals. Use event-linked **field-goal assists** when calculating an assisted-FGM share. Never require `AST ≤ FGM` as a universal validation rule. [Men's criteria, section 3](https://ftpserver.euroleague.net/general/EB_Statistics_Criteria_Manual.pdf).

For the women's competitions, consult the applicable FIBA statistical manual and season regulations. A shared label does not prove identical scorer interpretation across organizers or eras. The [FIBA statisticians resource page](https://about.fiba.basketball/en/fiba-game-officials/statisticians) is the starting point for current manuals; the [indexed 2024 manual](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf) supplies the EFF convention used here, although its direct PDF URL failed during this research.

### 1.3 Aggregation rules

- **Totals:** sum valid game-level counts. Do not add a season total to its constituent games.
- **Per game:** `ΣX / counted GP`; player GP must exclude genuine DNPs, even when roster rows contain zeros.
- **Per minute:** `ΣX / ΣMIN`; per 40 is `40 × ΣX / ΣMIN`.
- **Percentages:** `100 × Σmakes / Σattempts`; do not average rounded game percentages.
- **Efficiency over games:** `100 × ΣPTS / ΣPOSS`, not the mean of game offensive ratings.
- **Opponent rates:** use the same games as the team numerator. Missing opponent rows cannot be replaced with season-wide opponent totals.
- **Team totals:** include unassigned team events where the source does. Player sums alone can omit team rebounds and turnovers.
- **Phases:** keep qualifiers, regular season/group stages, additional rounds, play-in, playoffs, and finals separate. The available phases depend on the competition and season.
- **Transfers:** player totals can span several clubs; preserve player-club-season stints before aggregating a competition career.
- **Partial coverage:** show both the result and covered games/possessions. Never mix a complete scoring numerator with an incomplete minutes or possession denominator.

These are calculation conventions for this catalog, not a claim that every vendor applies them identically.

## 2. Sources and retrieval map

A source code below identifies where the entries in later sections can be retrieved. Every family states its applicable codes; exceptions are identified in the entries. A **derived** metric is calculated locally from the cited inputs, rather than necessarily published by the organizer.

### M-BOX: men's official-origin box scores and game records

For EL-M and EC-M, use the [EuroLeague game center](https://www.euroleaguebasketball.net/euroleague/game-center/) and [EuroCup game center](https://www.euroleaguebasketball.net/eurocup/game-center/) for human inspection. League-hosted JSON serves game box scores through `api-live.euroleague.net` and the older `live.euroleague.net/api` routes. Public access was tested, but these are not a contracted public developer API with a guaranteed schema, quota, or SLA.

Direct working examples: [EL-M E2025 game 1 box score](https://api-live.euroleague.net/v2/competitions/E/seasons/E2025/games/1/stats) and [EC-M U2025 game 1 box score](https://api-live.euroleague.net/v2/competitions/U/seasons/U2025/games/1/stats). These provide player/team counts, minutes, starters, plus/minus, PIR, and identity metadata. Section 16 maps the observed fields.

### M-EVENT: men's play-by-play and shot events

The older game feeds supply events and shot coordinates. Both competitions worked in the sampled 2025-26 games. Examples: [EL-M play-by-play](https://live.euroleague.net/api/PlayByPlay?gamecode=1&seasoncode=E2025), [EL-M shots](https://live.euroleague.net/api/Points?gamecode=1&seasoncode=E2025), [EC-M play-by-play](https://live.euroleague.net/api/PlayByPlay?gamecode=1&seasoncode=U2025), [EC-M shots](https://live.euroleague.net/api/Points?gamecode=1&seasoncode=U2025). Shots include misses despite the endpoint's name `Points`.

These inputs support event-derived splits, shooting maps, scoring runs, and potentially possessions and lineups. Their presence in two games is not proof of complete substitutions, precise coordinates, or all-season coverage.

### M-ADV: men's published season statistics

The v3 player and team routes offer traditional and advanced season tables. Available advanced fields include shooting efficiency, rebound rates, assist and turnover ratios, shot-attempt mix, free-throw rate, and selected scoring shares. Treat provider values as published: identical labels do not establish an identical formula. The [hoopR team reference](https://hoopr.sportsdataverse.org/reference/euroleague_team_stats.html) and [player reference](https://hoopr.sportsdataverse.org/reference/euroleague_player_stats.html) describe these routes and normalized columns. They explicitly identify the integration as unofficial.

### W-PUBLIC: women's official competition pages and reports

For EL-W and EC-W, start with their FIBA event sites and each season's games, team pages, player pages, statistics, and linked reports:

- [EuroLeague Women 2026-27](https://www.fiba.basketball/en/events/euroleague-women-26-27) and [statistics](https://www.fiba.basketball/en/events/euroleague-women-26-27/stats).
- [EuroCup Women 2026-27](https://www.fiba.basketball/en/events/eurocup-women-26-27) and [statistics](https://www.fiba.basketball/en/events/eurocup-women-26-27/stats).
- [EuroLeague Women 2025-26 statistics review](https://www.fiba.basketball/en/events/euroleague-women-25-26/news/season-in-review-who-topped-the-stats-charts) explicitly uses EFF alongside scoring, rebounding, and other leaders.

The EC-W statistics page was indexed with player/team leaders and game highs, GP, minutes, points, and shooting fields. Some FIBA pages refused direct retrieval. Official report PDFs appear under `reports.fiba.basketball`, but the sampled PDF links failed to load; report availability should be discovered through each game, not assumed from a constructed filename. Public viewing does not imply a supported bulk JSON API.

### W-GDAP: supported FIBA data access

FIBA's [GDAP portal](https://gdap-portal.fiba.basketball/) provides authenticated products. Obtain the specific EL-W and EC-W competition/season entitlements and schemas from FIBA. It distinguishes validated pre/post-game data from live data. **The old MAP API is now internal-only.** Do not build a new public integration around old MAP endpoint examples. [GDAP documentation](https://gdap-portal.fiba.basketball/documentation), [MAP retirement notice](https://gdap-portal.fiba.basketball/map-api).

### VENDOR: commercial multi-competition feeds

[Sportradar Global Basketball](https://developer.sportradar.com/basketball/reference/global-basketball-overview) and [API-Sports API-Basketball](https://api-sports.io/documentation/basketball/v1) are candidate structured feeds. Confirm all four competitions by provider ID and season, then check game-level coverage. A league listed in a schedule feed does not guarantee live player statistics or shots. Neither vendor was authenticated in this research. Section 14 details their live options.

### MODEL: local or independent analytical calculations

Derived measures use M-BOX/M-EVENT or W-PUBLIC/W-GDAP/VENDOR inputs. Independent publishers such as [Hack a Stat](https://hackastat.eu/en/home-page-eng/) publish European advanced analysis, including men's EuroLeague/EuroCup material. [6.75 Analytics](https://675hoops.com/glossary/), [ELSTATSLAB](https://elstatslab.com/methodology/), and [Viziball](https://viziball.app/glossary/euroleague/en) explain their own analytical labels. These are primary sources for their own models, not organizers' official statistics or evidence of equivalent women's coverage. An accessible website is not necessarily an export API.

## 3. Traditional box scores and participation

**Retrieval:** M-BOX for EL-M/EC-M; W-PUBLIC or entitled W-GDAP for EL-W/EC-W; VENDOR where supported. The following basic definitions apply to all four; scorer attribution follows the relevant manual. Derived variants use those same inputs.

- **Games played (GP):** games in which a player actually participated; team GP counts included official games. Use participation status, not the count of roster rows.
- **Games started (GS):** count of official starting-five selections. Not equivalent to games with many minutes.
- **Minutes played (MIN/MP):** time on court. `seconds / 60`; overtime is included.
- **Minutes per game (MPG):** `MIN / GP`.
- **Points (PTS):** credited scoring; normally `2×2PM + 3×3PM + FTM`. Keep official attribution of unusual baskets and corrections.
- **Points per game (PPG):** `PTS / GP`.
- **Field goals made/attempted (FGM/FGA):** all counted two- and three-point attempts, excluding free throws. `FGM=2PM+3PM`; `FGA=2PA+3PA`.
- **Field-goal percentage (FG%):** `100×FGM/FGA`.
- **Two-pointers made/attempted (2PM/2PA):** credited two-point makes and attempts; `2PM=FGM−3PM`, `2PA=FGA−3PA` when the source does not split them.
- **Two-point percentage (2P%):** `100×2PM/2PA`.
- **Three-pointers made/attempted (3PM/3PA):** credited three-point makes and attempts.
- **Three-point percentage (3P%):** `100×3PM/3PA`.
- **Free throws made/attempted (FTM/FTA):** credited free throws. Canceled or repeated attempts must follow scorer decisions.
- **Free-throw percentage (FT%):** `100×FTM/FTA`.
- **Missed field goals (FG misses):** `FGA−FGM`.
- **Missed free throws (FT misses):** `FTA−FTM`.
- **Offensive rebounds (OREB/ORB):** credited recoveries following the offensive team's missed attempts.
- **Defensive rebounds (DREB/DRB):** credited recoveries following an opponent's missed attempts.
- **Total rebounds (REB/TRB):** `OREB+DREB`; distinguish player totals from team-inclusive totals.
- **Team rebounds:** rebounds assigned to the team rather than a named player. Preserve offensive/defensive components where supplied.
- **Rebounds per game (RPG):** `REB/GP`; ORPG and DRPG use their corresponding counts.
- **Assists (AST/AS):** passes credited as directly creating scoring under the applicable criteria. Not safely reconstructed from chronological proximity alone.
- **Assists per game (APG):** `AST/GP`.
- **Steals (STL/ST):** credited defensive actions producing possession under scorer criteria.
- **Steals per game (SPG):** `STL/GP`.
- **Blocks (BLK/BS):** credited blocked shot attempts.
- **Blocks per game (BPG):** `BLK/GP`.
- **Blocks against (BA/BLKA/SR):** the player's own attempts blocked by opponents. Frequently explicit in men's boxes; inspect women's schema rather than assume publication.
- **Turnovers (TOV/TO):** losses of possession charged to the player or team.
- **Team turnovers:** losses assigned to the team, outside the sum of named player turnovers.
- **Turnovers per game (TOPG):** `TOV/GP`.
- **Fouls committed (FC/PF):** recorded player fouls within the publisher's category. Team/bench technicals may have separate accounting.
- **Fouls drawn/received (FD/RV):** credited fouls suffered. Not inferable from FTA alone; not all fouls lead to free throws.
- **Plus/minus (+/−):** team points scored minus allowed during the player's court time. Derived from scoring and substitutions or taken as published; it is contextual rather than isolated player impact.
- **PIR/valuation:** men's published additive box-score index; formula in section 12.
- **EFF/efficiency:** FIBA's common additive box-score index, used on women's leaderboards; formula in section 12. It differs from PIR.
- **Per-game count variants:** any count `X/GP`, including 3PM, FTA, fouls, PIR, and EFF.
- **Per-40 and per-36 variants:** `40×X/MIN` or `36×X/MIN`; playing-time normalizations, not predicted production in a longer role.
- **Season/career totals:** sum game counts under an explicit competition/phase scope; a domestic-league appearance is not a EuroLeague appearance.
- **Game high:** maximum game value in the selected scope; preserve tied dates and opponents.
- **Double-double:** at least 10 in at least two selected conventional categories, normally PTS/REB/AST/STL/BLK. Do not count PIR as a category.
- **Triple-double/quadruple-double:** the same threshold in at least three/four categories.
- **Threshold games:** number of games with `X≥threshold`, such as 20 points; the threshold is part of the metric definition.
- **DNP/absent/inactive:** participation status, not a zero-performance game. Reason text is usable only if explicitly supplied.

## 4. Shooting efficiency and scoring composition

**Retrieval:** derived from the core boxes for all four. M-ADV publishes several of these for the men. Event-only variants require M-EVENT or an equivalent women's event feed. Published percentages and local formulas remain separate until reconciled.

- **Effective field-goal percentage (eFG%):** `100×(FGM+0.5×3PM)/FGA`. Accounts for the extra point from a three.
- **True shooting percentage, estimated (TS%):** `100×PTS/[2×(FGA+c×FTA)]`. State `c`, conventionally 0.44; this estimate does not perfectly count and-ones, technical free throws, and three-shot fouls.
- **True shooting attempts, estimated (TSA):** `FGA+c×FTA`; a modeled denominator, not a scorer-recorded count.
- **Event-based shooting efficiency:** `PTS/(actual scoring opportunities)` using an explicitly implemented event grouping. Do not label it the same TS% as the box estimate unless the definition matches.
- **Points per field-goal attempt:** `(2×2PM+3×3PM)/FGA = 2×eFG%/100`; excludes free-throw points.
- **Points per shooting attempt, estimated:** `PTS/(FGA+c×FTA)`; equals `2×TS%/100` under the same convention.
- **Points per FGA, all points included:** `PTS/FGA`; includes free throws and therefore differs from field-goal points per attempt.
- **Two-point attempt rate (2PAr):** `100×2PA/FGA`.
- **Three-point attempt rate (3PAr):** `100×3PA/FGA`; complements 2PAr when attempts are classified completely.
- **Free-throw attempt rate (FTr-FTA):** `FTA/FGA`, sometimes multiplied by 100. Always label the scale.
- **Free-throw make rate (FTr-FTM):** `FTM/FGA`; a distinct four-factor convention, not interchangeable with FTA/FGA.
- **Two-point scoring share:** `100×2×2PM/PTS`.
- **Three-point scoring share:** `100×3×3PM/PTS`.
- **Free-throw scoring share:** `100×FTM/PTS`.
- **Field-goal scoring share:** `100×(2×2PM+3×3PM)/PTS`.
- **Points in the paint (PITP):** points from classified made field goals in the paint; use provider tags or calibrated coordinates. Free throws do not become paint points merely because the foul occurred there.
- **Fast-break points (FBP):** points tagged as fast-break scoring by the source. A short possession duration is only a separately labeled proxy.
- **Second-chance points (SCP):** scoring after an offensive rebound before the possession ends, using source rules for free throws and repeated rebounds.
- **Points off turnovers (POT):** scoring on possessions following opponent turnovers under the source's convention.
- **Bench points:** points by game-designated nonstarters, regardless of how long they play.
- **Starter points:** points by the game's official starting five.
- **Paint/fast-break/second-chance/turnover/bench scoring shares:** `100×category PTS/team PTS`. These categories overlap and should not be added into a scoring partition.
- **Assisted field-goal share:** `100×assisted FGM/FGM`, using linked made-field-goal events rather than all official AST.
- **Unassisted field-goal share:** `100×unassisted FGM/FGM`; unknown assist linkage must not be relabeled unassisted.
- **Assisted 2P/3P share:** `100×assisted 2PM/2PM`, or the analogous three-point fraction.
- **Dunk/layup/jump-shot efficiency:** makes divided by attempts carrying that explicit shot-type label. Basic two/three classification does not establish the subtype.
- **Relative FG%, eFG%, TS%:** player/team percentage minus the corresponding attempt-weighted competition-season percentage, in percentage points.
- **FG+, eFG+, TS+ indexes:** `100×entity rate/reference rate`, with the comparison pool stated. A score of 100 means the reference average; these are local indexes unless attributed to a publisher.
- **True shooting added (estimated):** `PTS−2×TSA×L_TS`, where `L_TS` is a fraction and uses the same TSA estimator. Measures scoring above a chosen baseline at that volume.
- **Shooting consistency:** standard deviation of a declared game-level rate or points total. Report sample size; an average of game percentages answers a different question from season shooting percentage.

## 5. Possessions, pace, and team efficiency

**Retrieval:** local calculations from both sides' box scores, or possessions reconstructed from event data. Men may also have provider advanced fields. Do not assume all four publish an authoritative possession table.

- **Offensive possessions:** team control sequences ending under a declared possession-counting rule. An offensive rebound normally extends a possession rather than starting a new one.
- **Defensive possessions:** the opponent's offensive possessions while the relevant team or lineup defends.
- **Box-score possession estimate:** `FGA−OREB+TOV+c×FTA`. Team counts must include the relevant unassigned events. This is an approximation.
- **Symmetric game possession estimate:** average the two teams' box estimates: `(POSS_est_T+POSS_est_O)/2`. This forces a shared denominator for estimated game ratings; actual event counts can differ.
- **Alternative adjusted possession estimates:** some European teaching material applies `0.96×(FGA−OREB+TOV+0.44×FTA)`. Preserve the adjustment as a separate named method rather than mixing it with the simple estimator. [FIBA Europe coaching terminology](https://assets.fiba.basketball/image/upload/documents-corporate-regional-offices-europe-programs-fiba-europe-coaching-certificate-fiba-europe-basketball-terminology.pdf).
- **Pace per 40:** `40×(POSS_T+POSS_O)/(2×GMIN)` for a game; over several games, sum possessions and elapsed game minutes first.
- **Possessions per game:** `ΣPOSS/GP`; includes extra overtime opportunities and differs from pace per 40.
- **Offensive rating (ORtg):** `100×PTS/POSS_T`; points scored per 100 offensive possessions.
- **Defensive rating (DRtg):** `100×OPP_PTS/POSS_O`; points conceded per 100 defensive possessions. Lower is better.
- **Net rating:** `ORtg−DRtg`. If both use a shared possession denominator, also `100×point differential/POSS`.
- **Points per possession (PPP):** `PTS/POSS_T`; ORtg divided by 100.
- **Opponent PPP:** `OPP_PTS/POSS_O`.
- **Turnover possession rate (team TOV%):** `100×TOV/POSS_T`; denominator must identify exact versus estimated possessions.
- **Scoring-possession percentage:** `100×possessions with ≥1 point/all possessions`; requires events.
- **Empty-possession percentage:** `100×zero-point possessions/all possessions`; scoring corrections must be resolved first.
- **Average possession length:** sum of live game-clock time used in possessions divided by counted possessions. Do not use wall-clock duration or mechanically divide 40 minutes by one team's possessions.
- **Transition/half-court efficiency:** points divided by possessions tagged transition/half-court; tag definitions vary and may require video data.
- **Putback efficiency:** points divided by tagged putback plays; a play-type denominator can differ from entire second-chance possessions.
- **Four factors:** eFG%, turnover rate, offensive rebound rate, and free-throw rate. This is a family of measures, not a universal single weighted formula.
- **Opponent four factors:** the same measures for opponents in the selected games.
- **Per-100 on-court player counts:** `100×player X/team possessions while player is on court`; do not substitute the player's own usage possessions.
- **Points per used possession:** a player's points divided by a declared player opportunity/usage denominator. Not team ORtg or a complete individual offensive rating.

Event reconstruction must handle end-of-period sequences, offensive rebounds, retained-ball free throws, technical fouls, jump balls, and scoring corrections. A shot, foul, or free throw does not automatically end a possession. Store the method/version alongside calculated results.

## 6. Rebounding, defense, and fouls

**Retrieval:** box-score formulas work across all four with complete team/opponent inputs. M-EVENT and equivalent women's event feeds support situational counts. Tracking and video measures require a separate provider; ordinary box scores do not contain them.

- **Team offensive rebound percentage (ORB%):** `100×T_OREB/(T_OREB+O_DREB)`. State whether unassigned team rebounds are included.
- **Team defensive rebound percentage (DRB%):** `100×T_DREB/(T_DREB+O_OREB)`.
- **Team total rebound percentage (TRB%):** `100×T_REB/(T_REB+O_REB)`.
- **Rebound differential:** `T_REB−O_REB`; offensive and defensive components can also be compared separately.
- **Estimated player ORB%:** `100×P_OREB×(TM_MIN/5)/[P_MIN×(T_OREB+O_DREB)]`. Assumes opportunities are distributed proportionally to minutes.
- **Estimated player DRB%:** `100×P_DREB×(TM_MIN/5)/[P_MIN×(T_DREB+O_OREB)]`.
- **Estimated player TRB%:** `100×P_REB×(TM_MIN/5)/[P_MIN×(T_REB+O_REB)]`.
- **Actual on-court player rebound rate:** player rebounds divided by the corresponding team-plus-opponent rebound opportunities while on court. Requires substitutions and events; label apart from the minutes-based estimates.
- **Offensive rebound conversion:** points scored after offensive rebounds divided by offensive-rebound possessions, or the share of those possessions that score. Name the chosen numerator and denominator.
- **Rebound chances/chance conversion:** tracked opportunities to rebound and `rebounds/chances`. Not reconstructible simply from all missed shots; no universal public four-competition source verified.
- **Contested/uncontested rebounds:** tagged by nearby opposition or video judgment. Provider thresholds must accompany the statistic.
- **Box outs:** tagged actions creating rebounding space. No standard public feed for all four was verified.
- **Team steal rate:** `100×STL/POSS_O`.
- **Estimated player steal percentage:** `100×P_STL×(TM_MIN/5)/(P_MIN×POSS_O)`; a box estimate of opponent possessions during court time.
- **Actual player steal rate:** `100×P_STL/opponent possessions during P's court time`.
- **Block rate, all attempts:** `100×BLK/O_FGA`; use this name to distinguish it from the two-point denominator convention.
- **Block percentage, two-point denominator:** `100×BLK/O_2PA`; common but includes blocks on threes in the numerator unless explicitly restricted.
- **Estimated player BLK%:** `100×P_BLK×(TM_MIN/5)/(P_MIN×O_2PA)` under the preceding convention.
- **Blocked-attempt rate:** `100×BA/FGA`; can also be split by shot type if linked events exist.
- **Steals plus blocks (stocks):** `STL+BLK`; a descriptive count, not total defensive value.
- **Opponent FG%, 2P%, 3P%, eFG%, TS%:** apply the shooting formulas to all opponents in the included games. These are team-level allowed rates.
- **Defended FG%:** opponent makes/attempts attributed to a particular primary defender by a tracking/video system. Do not assign every team opponent attempt to each on-court player.
- **Defensive FG% differential:** defended FG% minus a defined shooter/reference expectation; requires matchup attribution and a baseline.
- **Deflections:** tagged defensive touches disrupting passes or dribbles, including those not producing a steal. Public steal totals cannot recover them.
- **Loose-ball recoveries:** tracked or coded recoveries under a provider definition. Not synonymous with steals.
- **Charges drawn:** offensive charging fouls explicitly credited to a defender. FD alone includes many other foul types.
- **Contests:** shots challenged under a provider's distance or tagging rules. A block is a narrower event.
- **Fouls per 40:** `40×FC/MIN` for a player.
- **Fouls per 100 defensive possessions:** `100×defensive FC/defensive POSS`, when offensive/defensive foul types are separable.
- **Fouls drawn per 40:** `40×FD/MIN`.
- **Foul differential:** `FD−FC`; not a measure of officiating accuracy.
- **Shooting fouls:** count of explicitly classified fouls during shooting. FTA/2 is not a reliable count.
- **Offensive fouls:** count of that event category; often also a turnover, so avoid adding it twice to total possession losses.
- **Technical/bench/disqualifying and historical unsportsmanlike fouls:** source-coded counts. Include newer categories only after checking the competition's rules and feed enum.
- **Foul-outs:** games in which a player reaches the applicable personal-foul limit; separate from disqualification for other reasons.
- **Team-foul and bonus state:** quarter-specific foul accounting under the rules, not necessarily the simple sum of all displayed foul types.
- **Opponent free-throw rate:** opponent FTA/FGA or FTM/FGA, clearly labeled.

The simple shooting, rebound, and defensive rate conventions above are analytical calculations. They are not assertions about unpublished proprietary formulas. For European examples and definitions, see [Viziball's glossary](https://viziball.app/glossary/euroleague/en) and [ELSTATSLAB's methodology](https://elstatslab.com/methodology/); provider-specific conventions must remain separate.

## 7. Passing, usage, and opportunity shares

**Retrieval:** M-BOX/M-ADV for men; women's boxes and entitled feeds for basic counts and derived estimates. Exact on-court and linked-assist measures require events. Touches and pass tracking require licensed or manually coded data.

- **Assist-to-turnover ratio (AST/TOV):** `AST/TOV`. If TOV is zero, retain numerator and denominator and report undefined/infinite according to the presentation convention, not an invented finite value.
- **Team assists per made field goal:** `AST/FGM`; a descriptive ratio, not necessarily a bounded assisted-basket percentage when free-throw assists are included.
- **Field-goal assist percentage, exact:** `100×P_FG_AST/teammate FGM while P is on court`. Exclude the player's own makes from the denominator and free-throw assists from the numerator.
- **Field-goal assist percentage, box estimate:** `100×P_FG_AST/[P_MIN/(TM_MIN/5)×T_FGM−P_FGM]`. Requires the field-goal-only assist count and a positive denominator. Using all AST changes the interpretation.
- **Assist ratio, opportunity convention:** `100×AST/(FGA+c×FTA+TOV+AST)`. One common analytical convention; it is not automatically the men's published v3 formula.
- **Assists per 100 team possessions:** `100×AST/POSS_T`; different denominator from assist ratio.
- **Usage percentage, box estimate (USG%):** `100×(P_FGA+c×P_FTA+P_TOV)×(TM_MIN/5)/[P_MIN×(T_FGA+c×T_FTA+T_TOV)]`. Measures estimated share of ending opportunities, not ball-holding time; assists are excluded.
- **Exact event usage:** share of team possessions or ending opportunities assigned to a player while they are on court, using explicit rules for free throws and multiple shooters. State which denominator is used.
- **Player used opportunities:** `FGA+c×FTA+TOV` under a box convention. Some providers publish a similarly named possession count with a different calculation; keep it separate.
- **Player turnover rate, usage convention:** `100×TOV/(FGA+c×FTA+TOV)`.
- **Turnover ratio, assists-included convention:** `100×TOV/(FGA+c×FTA+TOV+AST)`. Do not merge it with the preceding rate.
- **Scoring share:** `100×P_PTS/T_PTS` over matched games.
- **Shot share:** `100×P_FGA/T_FGA` over matched games; not usage adjusted for court time.
- **Three-point/FT attempt share:** `100×P_3PA/T_3PA` or `100×P_FTA/T_FTA`.
- **Assist/rebound/steal/block share:** `100×P_X/T_X` for the stated category; use comparable accounting scopes.
- **Minutes share:** `100×P_MIN/(TM_MIN/5)` estimates the fraction of available game time played. Share of all player minutes instead uses `TM_MIN`, and sums to 100% across players.
- **Assisted points created:** sum the points from baskets explicitly linked to a player's assists. For free-throw assists, state whether associated made FTs are included. `2×AST` is only a rough proxy.
- **Assist network:** counts or assisted points for each passer-to-scorer pair, requiring linked events.
- **Potential assists:** passes resulting in a qualifying shot attempt whether made or missed. Cannot be recovered from recorded AST alone.
- **Secondary assists:** qualifying pass before the scoring assist; needs pass-sequence data.
- **Passes made/received:** tracked pass counts, not a standard box field.
- **Touches/time of possession:** tracked player ball contacts and duration. Not USG%.
- **Dribbles per touch/shot:** tracked dribble counts over qualifying touches or shots; no complete public source for all four verified.
- **Points per touch, drive, post touch, or paint touch:** points attributed to each provider-defined action divided by action count; requires tracking or video tags.

## 8. Shots, locations, and play types

**Retrieval:** M-EVENT shot feeds were observed for both men's competitions. Women's shot charts or event exports depend on the game center/product; coverage and coordinates were not verified through an authenticated women's API. Advanced scouting categories require vendor rights or manual coding.

### 8.1 Shot-location statistics

- **Shot coordinate (x,y):** source position for an attempt. Preserve original units, origin, axis direction, and shooting-end convention before normalization.
- **Shot distance:** `sqrt((x−basket_x)^2+(y−basket_y)^2)` after validated unit conversion; retain whether measured or derived.
- **Zone:** provider-defined court region; the observed men's feed used letter codes. Do not map letters to NBA zone names without a verified dictionary.
- **Zone makes/attempts/FG%:** `FGM_zone`, `FGA_zone`, `100×FGM_zone/FGA_zone`.
- **Zone frequency:** `100×FGA_zone/FGA_with_valid_zone`; show coordinate coverage separately.
- **Zone points per attempt:** field-goal points in the zone divided by zone attempts.
- **At-rim frequency/accuracy:** shots inside an explicitly chosen distance or tagged rim region; define the boundary.
- **Paint non-rim frequency/accuracy:** paint shots excluding the defined rim region.
- **Midrange frequency/accuracy:** two-point jump shots outside the chosen paint/rim classification; not simply every non-layup two without tags.
- **Corner versus above-break threes:** classify with the actual court geometry and coordinates; do not import NBA court dimensions.
- **Left/right/center distribution:** attempt share by declared coordinate boundaries.
- **Average attempt distance:** mean distance over valid located field-goal attempts; distinguish makes-only distance.
- **Shot quality/expected points:** model expectation given location, type, contest, shooter, and other available features. No universal official model or public all-four field was verified.
- **Shooting above expectation:** actual field-goal points minus modeled expected points; report model, training seasons, calibration, and available features.
- **Shot-chart coverage:** `100×located eligible attempts/all eligible attempts`; unknown coordinates must remain missing.

The men's `Points` samples include free throws with `COORD_X=-1, COORD_Y=-1`. This is an observed sentinel, not a literal shot one coordinate unit from the origin. Likewise, zero can be a valid on-court coordinate. Filter by action type and the provider's missing-value rules.

### 8.2 Shot and action context

- **Catch-and-shoot/pull-up:** attempts after a catch versus after dribbling under a provider definition; not reliably inferred from basic PBP alone.
- **Dribble-count bands/touch-duration bands:** attempts grouped by tracked dribbles or seconds before release.
- **Shot-clock bands:** attempts by remaining shot-clock time; game-clock time is not a substitute.
- **Defender-distance bands:** contested/open categories from tracking distances, not the nearest defender guessed from a box score.
- **Transition:** actions before the defense is set, tagged or modeled explicitly.
- **Isolation:** tagged one-on-one attacking possessions.
- **Pick-and-roll ball handler:** tagged possessions ending with the handler's action.
- **Pick-and-roll roll/pop player:** tagged possessions ending with the screener's action; separate roll and pop only if available.
- **Post-up:** tagged action initiated in a defined post context.
- **Spot-up:** tagged stationary reception/shoot-or-drive action.
- **Cut:** tagged off-ball movement leading to a finishing action.
- **Off-screen:** tagged action following an off-ball screen.
- **Hand-off:** tagged dribble-hand-off action.
- **Putback:** tagged finishing action after an offensive rebound.
- **Miscellaneous:** residual tagged actions; preserve the vendor definition rather than force every event into another category.
- **Play-type frequency:** `100×type possessions/all classified possessions`.
- **Play-type PPP:** `type points/type possessions`; establish treatment of shooting-foul free throws and turnovers.
- **Play-type score/TOV/foul frequency:** number of qualifying type possessions divided by type possessions.
- **Play-type percentile:** rank within a stated competition-season, role, and minimum-volume pool. A EuroLeague percentile is not a EuroCup Women percentile.
- **Defensive play-type efficiency:** opponent points per tagged defended play, attributed at team or defender level according to the provider.

These are useful categories to request from a licensed scouting provider; their inclusion here does **not** claim they are all present in the free men's shot feed or women's FIBA box scores. A video subscription also does not automatically permit a data export.

## 9. Play-by-play and game flow

**Retrieval:** M-EVENT; supported women's FIBA live/PBP data or a licensed timeline. Some summary values may also appear in game reports. All formulas are conditional on a complete, corrected sequence.

- **Event ID/sequence:** source identifier and order. Time alone is not unique: many events can occur at the same clock reading.
- **Period and clock:** regulation quarter or overtime plus remaining game-clock time; convert each period using its own duration.
- **Running score:** home/away score after an event. Some feeds omit the non-scoring side; do not replace null with zero.
- **Scoring margin:** current team score minus opponent score.
- **Quarter/half/overtime points:** sum scoring within each period grouping; compare to published period scores.
- **Lead changes:** switches between teams holding a lead; tied intervals do not create a new team lead by themselves.
- **Times tied:** count tied-score situations under a declared convention, normally excluding the opening 0–0.
- **Largest lead:** maximum positive scoring margin for each team; retain period and clock of the occurrence.
- **Largest comeback:** largest deficit overcome before winning, or before regaining the lead if that is the stated definition.
- **Largest scoring run:** maximum consecutive unanswered points by a team.
- **Time leading/tied/trailing:** elapsed game-clock intervals in each score state, reconstructed between scoring events; wall-clock stoppages are excluded.
- **Scoring drought:** elapsed playing time without a score; distinguish team and player droughts and whether field goals or any points count.
- **Clutch statistics:** any chosen stat filtered by an explicit time/margin rule, for example final five minutes of Q4/OT with margin at most five. This is a local convention unless the provider specifies it.
- **Garbage-time statistics:** filtered under a published model or threshold; no single official Europe-wide definition.
- **And-one plays:** linked made field goal plus an awarded continuation free throw; not any adjacent FG and FT.
- **Three-/four-point plays:** a made three, or a made three plus made continuation FT, under the stated definition. Keep distinct from three made FTs.
- **Free-throw trips:** groups of attempts belonging to one award; technical and retained-possession awards need special handling.
- **Shooting-foul points:** points from free throws linked to a shooting foul; not all FT scoring.
- **Live-ball/dead-ball turnovers:** classify using event codes and subsequent control. A turnover with no recorded steal is not automatically dead-ball.
- **Turnover type:** bad pass, lost ball, travel, offensive foul, timing violation, etc., only where explicitly coded or reliably parsed.
- **Points following time-outs:** points on the first qualifying possession after a timeout; an after-timeout offense measure requires an explicit window.
- **Points following offensive rebounds/steals:** linked possession outcomes; distinguish these from overlapping official summary categories.
- **Buzzer-beaters:** successful shots at a period-ending clock value with valid event ordering. Rounded `00:00` is not high-resolution release evidence.
- **Game-winning basket:** a retrospectively defined shot after which the winning side never loses the lead, or another clearly stated convention.
- **Jump-ball wins:** recorded control after a jump ball; do not treat all held-ball events as new physical jump balls across rulesets.
- **Timeouts/challenges/reviews:** counts and outcomes when explicitly recorded. A text mention is not always a structured final ruling.
- **Substitution counts/stints:** entries and exits plus court-time intervals; simultaneous events need stable ordering.
- **Win probability:** model probability of winning given score, time, possession, and team strength. A derived or licensed estimate, never an official score statistic.
- **Win-probability added (WPA):** change in model win probability across an event. Player attribution is a separate modeling decision.

## 10. Lineups, on-off, and splits

**Retrieval:** derive from complete starters, substitutions, scores, and possessions; M-EVENT or an equivalent women's feed. Neither box-score minutes alone nor a list of roster players identifies lineups.

- **Five-player lineup minutes:** total court time with an exact five-player combination.
- **Two-/three-/four-player combination minutes:** time the named subset shares the court; these overlapping groups are not additive.
- **Lineup points for/against and plus/minus:** scoring during a lineup's intervals; `PF−PA`.
- **Lineup offensive/defensive possessions:** possessions assigned under a declared handling of substitutions mid-possession.
- **Lineup ORtg/DRtg/net rating:** the section 5 formulas restricted to those intervals.
- **Lineup four factors:** shooting, turnovers, rebounding, and free-throw rates within the same intervals.
- **Player on-court rating:** team efficiency when the player participates, not their individual scoring efficiency.
- **Player off-court rating:** team efficiency in the remaining game time; define the eligible game set.
- **On-off differential:** `on-court net rating−off-court net rating`. Does not adjust for teammates, opponents, or rotation context.
- **With-or-without (WOWY):** compare intervals with both named players, only one, and neither.
- **Stint length:** continuous court-time segment for a player or lineup.
- **Starting-lineup record:** team game results grouped by starting five; not the outcome of just their shared minutes.
- **Closing lineup:** lineup during a defined final interval or at the final meaningful possession. Do not infer it from starters.
- **Matchup lineup:** concurrent offensive and defensive combinations; useful for context but often extremely small samples.
- **Home/away/neutral splits:** filter games by actual venue designation; a designated home side at a neutral final is not home-court advantage.
- **Opponent/group/phase splits:** filter by opponent, competition stage, group, round, series, or leg.
- **Rest splits:** calendar or elapsed days since the previous relevant game. Continental-only schedules cannot reveal domestic-game rest.
- **Win/loss and score-state splits:** outcome or in-game margin filters; identify the selection effect when interpreting efficiency.
- **Quarter/half/overtime and clutch splits:** filter events, preserving eligible possessions and minutes.
- **Date-range/last-N splits:** aggregate numerators and denominators over the chosen games; N counts appearances for player form unless otherwise stated.
- **Starter/bench splits:** player's role for each game, not a permanent career label.
- **Transfer-club splits:** separate the same player's records by club stint and competition.

For any lineup result, report minutes, possessions, games, and event coverage. Small samples, missing substitutions, and uneven opponent quality can dominate the result. Do not present reconstructed lineup data as official unless the organizer publishes it as such.

## 11. Standings, competition formats, and team strength

**Retrieval:** official season standings/game records for all four; men's season/round routes or women's event/GDAP data. Team-strength models are local calculations or attributed independent products.

### 11.1 Records and tournament context

- **Wins/losses (W/L):** official game outcomes within the selected phase; include administrative decisions as the competition records them.
- **Win percentage:** `100×W/(W+L)` for ordinary decided games. Handle any permitted tied game or administrative outcome explicitly.
- **Points for/against (PF/PA):** total scoring for the team and opponents.
- **Point difference:** `PF−PA`; distinct from the sum of player plus/minus.
- **Average margin of victory (MOV):** `(PF−PA)/GP`, using all included games, including losses.
- **Standing rank:** official ordered position after applicable tiebreakers. Not necessarily a simple sort by win percentage and overall point difference.
- **Classification points:** competition-defined points awarded for wins, losses, forfeits, or defaults. Retrieve the season's rules; do not hardcode one policy for all four.
- **Head-to-head record/differential:** W/L and score difference among specified tied teams; apply the actual multi-team tie procedure.
- **Home/away record:** W/L by venue designation.
- **Current streak:** consecutive official wins or losses in chronological order.
- **Group position/qualification status:** official phase-specific rank or advancement state; distinguish clinched from projected.
- **Series score:** wins in a series, when the phase uses a series format.
- **Two-leg aggregate score/margin:** sum of scores over both legs, where the competition uses aggregate ties. An individual leg can have different tie/overtime implications from a normal single game.
- **Carry-over record:** standings results retained from an earlier phase under that season's rules; do not count the same games twice in player totals.
- **Seed/bracket position:** competition metadata; not a performance formula.
- **Titles/final appearances/qualification counts:** count official outcomes with explicit competition and historical continuity rules.

Do not freeze the men's or women's current format into the statistical definition. Group stages, second rounds, finals formats, entry rounds, and movement between competitions can change. A club entering EC-W after EL-W participation needs separate competition records. The [FIBA women's event sites](https://www.fiba.basketball/en/events/eurocup-women-26-27) and relevant season regulations are the authority; the [2025-26 EC-W regulations](https://assets.fiba.basketball/image/upload/eurocup-women-208977-regulations.pdf) are a historical example, not the current rules for every season.

### 11.2 Derived strength and prediction metrics

- **Strength of schedule (SOS):** average opponent strength under a named rating system and weighting. There is no single universal SOS formula.
- **Simple Rating System (SRS):** solve `rating_i = average game margin_i + average opponent rating_i` with a centering constraint, optionally with explicit home-court adjustment. Disconnected competition graphs need special treatment.
- **Adjusted offensive/defensive efficiency:** estimate scoring efficiency after accounting for opponent strength, venue, and optionally recency. Requires a published model; raw ORtg/DRtg are not adjusted ratings.
- **Adjusted efficiency margin:** adjusted offense minus adjusted defense using compatible scales.
- **Elo rating:** sequential team rating. A common expectation is `E_A=1/[1+10^((R_B−R_A−H)/S)]`; update `R_A'=R_A+K×(result−E_A)`. Publish scale S, home term H, K, offseason regression, and treatment of margin and two-leg ties.
- **Pythagorean win expectation:** `PF^x/(PF^x+PA^x)` with fitted exponent x. No NBA exponent is automatically valid for these competitions.
- **Expected wins:** sum game win probabilities, or `GP×Pythagorean expectation` under that specified model.
- **Win residual:** actual wins minus expected wins. It reflects model error and context as well as randomness.
- **Playoff/title probability:** repeated schedule/bracket simulations using the actual format and tie rules. Model output, not a direct stat feed.
- **League-relative z-score:** `(value−reference mean)/reference standard deviation` within a stated competition-season pool.
- **Percentile:** empirical rank within that pool, with stated tie and minimum-sample rules.
- **Cross-competition strength:** a model connecting competitions through shared clubs/players or other games. Raw PIR, PPG, or a percentile cannot establish an EL-M versus EC-W equivalence.

These formulas are candidate analytical methods for all four, not evidence that each competition publishes its own SRS, Elo, or adjusted ratings.

## 12. PIR, EFF, and other composite ratings

**Retrieval:** PIR is explicit in M-BOX/M-ADV. Women's FIBA leaderboards commonly use EFF. Other composites below are calculations or publisher-specific models; none should be labeled official across all four.

### 12.1 Performance Index Rating (PIR)

Meaning: an additive summary of credited positive and negative box-score actions, commonly displayed as valuation in the men's feeds.

```text
PIR = PTS + REB + AST + STL + BLK + FD
      − (FGA − FGM) − (FTA − FTM) − TOV − BA − FC
```

It rewards volume and combines different actions with equal unit weights. It is not pace-adjusted, opponent-adjusted, or a complete measure of defense. `valuation` matched this formula for all **48 player rows** in the two sampled men's games; this is a sample reconciliation, not a full historical audit. [EL-M sample](https://api-live.euroleague.net/v2/competitions/E/seasons/E2025/games/1/stats), [EC-M sample](https://api-live.euroleague.net/v2/competitions/U/seasons/U2025/games/1/stats).

### 12.2 Efficiency (EFF)

FIBA's recommended basic efficiency convention:

```text
EFF = PTS + REB + AST + STL + BLK
      − (FGA − FGM) − (FTA − FTM) − TOV

PIR = EFF + FD − BA − FC
```

EFF and PIR are therefore different even for identical box-score lines. The generic labels **EFF**, **evaluation**, and **efficiency** may mean different formulas on other sites; retain the provider and formula. [FIBA manual, appendix C.K](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf), [official EL-W EFF leaderboard discussion](https://www.fiba.basketball/en/events/euroleague-women-25-26/news/season-in-review-who-topped-the-stats-charts).

Worked example from the EC-M sample: 4 PTS, 4 REB, 1 AST, 0 STL, 1 BLK, 1/4 FG, 2/2 FT, 1 TOV, 1 FD, 0 BA, and 2 FC yields `EFF=6` and `PIR=5`. Never use the women's EFF column as though it were already men's PIR.

### 12.3 Other summaries and models

- **PIR/EFF per game:** total index divided by GP; can also report per 40 or per 100 using matched denominators.
- **Game Score (GmSc):** a conventional weighted box summary: `PTS + 0.4×FGM − 0.7×FGA − 0.4×(FTA−FTM) + 0.7×OREB + 0.3×DREB + STL + 0.7×AST + 0.7×BLK − 0.4×FC − TOV`. A locally computed version is not an official European leaderboard, and scorer differences affect comparisons.
- **Player Impact Estimate (PIE), imported convention:** numerator `PTS+FGM+FTM−FGA−FTA+DREB+0.5×OREB+AST+STL+0.5×BLK−FC−TOV`; divide by the same expression over both teams' game totals, optionally ×100. Can be negative or undefined. The weighting and team-event treatment must be explicit; it is not PIR.
- **Player Efficiency Rating (PER):** league-normalized, pace-adjusted per-minute weighted box production. Its full calculation depends on league factors, possession value, rebound rate, pace adjustment, and a normalization generally centered at 15. Recompute those quantities for the relevant competition; do not call `PIR/MIN` PER. [Published method](https://www.basketball-reference.com/about/per.html).
- **Individual offensive/defensive rating, Oliver method:** estimated player points produced or defensive stops per possession using detailed allocation formulas. Different from the team's efficiency during the player's minutes. [Individual-rating method](https://www.basketball-reference.com/about/ratings.html).
- **Win Shares (OWS/DWS/WS):** estimated offensive and defensive contribution converted to wins through league marginal-point baselines; `WS=OWS+DWS`. Requires the full chosen method and European calibration. [Published method](https://www.basketball-reference.com/about/ws.html).
- **WS per 40:** `40×WS/MIN`; a locally chosen time-normalized rate. An NBA WS/48 field is not the same quantity.
- **Box Plus/Minus (BPM/OBPM/DBPM):** regression-based box-score estimate of impact per 100 possessions. Coefficients, role/position adjustments, and team adjustment are model-specific; importing NBA coefficients is not European validation. [Published BPM method](https://www.basketball-reference.com/about/bpm2.html).
- **Value over replacement (VORP):** replacement-relative impact integrated over playing time under a specified conversion. A commonly published NBA conversion contains NBA season-length assumptions; European versions need their own explicit baseline and season normalization.
- **Adjusted plus/minus (APM):** regress stint scoring margin on offensive/defensive player indicators, with stated possession weighting and controls.
- **Regularized adjusted plus/minus (RAPM):** minimize a weighted squared-error objective plus a penalty such as `λ×Σβ²`; coefficients estimate player impact conditional on teammates/opponents. Requires complete lineups, possessions, model choices, and enough connected samples.
- **Bayesian/box-prior RAPM:** combine stint outcomes with an explicit prior from box scores or previous seasons. Formula and training coverage are publisher-specific.
- **Net points/impact scores:** use the named publisher's documented model, not a guessed translation to PIR or BPM. [Hack a Stat](https://hackastat.eu/en/home-page-eng/) is an example of a European publisher offering such analytical families.
- **Fantasy points:** weighted sum under a named game's scoring rules, potentially with win or other bonuses. Keep the rules version and competition; the base PIR is not automatically the final fantasy score. This is an ordinary optional metric, not a recommendation to add fantasy features.
- **MVP/weekly awards:** official award outcomes, not a formula inferred from the highest PIR. Award eligibility and selection rules can differ by season and organizer.

The long-form methods linked above are their authors' definitions, not a verified European API inventory. Some Basketball-Reference pages restrict automated access; use the published explanations or the existing [NBA catalog](nba-statistics.md) for implementation detail, and label any European calculation as a local adaptation. No universal public EL-W/EC-W PER, BPM, VORP, Win Shares, tracking-impact, or RAPM feed was verified.

## 13. Player, club, and game information

**Retrieval:** men's competition/season/club/person/game records; women's official team/player/game pages and entitled GDAP products; commercial profiles where covered. These are attributes rather than formulas unless noted.

- **Player ID/name/alternate spellings:** stable provider ID plus display and alternate names. Accents, transliteration, name order, and leading zeros must survive ingestion.
- **Club ID/name/abbreviation:** stable ID with season-specific sponsored names. A sponsor change is not automatically a new club.
- **Competition/season/phase/group/round:** identifiers describing the statistical scope.
- **Roster membership:** registered association between player, club, and season, potentially with start/end dates. Membership is not proof of appearance.
- **Jersey number:** string-valued roster/game attribute; preserve `0`, `00`, and changes.
- **Position:** listed role, often guard/forward/center; not a measured defensive assignment or a universal numeric enum.
- **Height/weight:** published measurements with units and source date; missing values remain null.
- **Birth date/age:** age at a specified date calculated from birthday; not simply current year minus birth year.
- **Nationality/country of birth:** distinct attributes. Neither alone establishes domestic-player eligibility, federation status, or legal citizenship details.
- **Experience/career competitions:** counted seasons or appearances under a defined competition scope.
- **Coach/staff:** credited game/roster roles when provided.
- **Game ID/code:** provider-specific game key. The men's numeric game code needs the season and competition to be unique.
- **Scheduled tip-off/actual start:** timestamps with time zone; postponements and daylight-saving changes matter.
- **Venue/city/country/neutral flag:** game location; club home venue is not proof of the actual game venue.
- **Attendance/capacity:** reported attendance and venue capacity where supplied; occupancy is `attendance/capacity`, with date/venue accuracy required.
- **Officials:** named referee assignments, if published. Statistical splits by official do not establish bias or causation.
- **Game status:** scheduled, live, period break, suspended, postponed, canceled, finished, or validated under the provider's enum.
- **Injury/unavailability:** explicit roster/report status where supplied. DNP or a missing box row is not evidence of an injury.
- **Transactions/contracts/salaries:** separate sources; no comprehensive official public four-competition API verified. Reports or estimates are not official salary data.
- **Awards/records:** organizer-confirmed metadata with the eligible population and historical scope.
- **Images/logos/video/report links:** URLs, not statistical measurements; their availability and reuse terms are separate from numeric data.

## 14. Live APIs and tools

### 14.1 Euroleague Basketball league-hosted feeds: EL-M and EC-M

**Access:** ordinary HTTPS GET; the sampled requests required no API key. Publicly reachable league infrastructure, accessed through unofficial integrations. No published third-party SLA or complete public developer contract was established. **Transport:** polling JSON; no supported public push/WebSocket interface was verified.

Use these identifiers:

```text
EL-M: competition = E; season = E2025 for 2025-26
EC-M: competition = U; season = U2025 for 2025-26
Game: numeric game code, unique only in its competition-season context
```

The men's season code uses the **starting year**, unlike Metis's existing NBA final-year convention. Keep the raw code and a separate normalized season interval.

Documented route families, with `C=E|U`, `S=E2025|U2025`, and `G` discovered from the schedule:

```text
https://api-live.euroleague.net/v2/competitions/{C}/seasons
https://api-live.euroleague.net/v2/competitions/{C}/seasons/{S}/clubs
https://api-live.euroleague.net/v2/competitions/{C}/seasons/{S}/people
https://api-live.euroleague.net/v2/competitions/{C}/seasons/{S}/rounds
https://api-live.euroleague.net/v2/competitions/{C}/seasons/{S}/games
https://api-live.euroleague.net/v2/competitions/{C}/seasons/{S}/games/{G}
https://api-live.euroleague.net/v2/competitions/{C}/seasons/{S}/games/{G}/stats

https://live.euroleague.net/api/Header?gamecode={G}&seasoncode={S}
https://live.euroleague.net/api/Boxscore?gamecode={G}&seasoncode={S}
https://live.euroleague.net/api/PlayByPlay?gamecode={G}&seasoncode={S}
https://live.euroleague.net/api/Points?gamecode={G}&seasoncode={S}
```

The `/stats`, `PlayByPlay`, and `Points` routes were tested for both men's competitions; the other listed discovery/header routes are documented by the [hoopR EuroLeague function index](https://hoopr.sportsdataverse.org/reference/), not independently exercised here. Preserve pagination and response envelopes as returned. Do not assume a UUID game ID can replace the numeric game code.

Published season-statistics routes:

```text
https://api-live.euroleague.net/v3/competitions/{C}/statistics/players/{mode}
https://api-live.euroleague.net/v3/competitions/{C}/statistics/teams/{mode}

mode = traditional | advanced
query example:
SeasonMode=Single&SeasonCode=E2025&StatisticMode=PerGame&Limit=1&Offset=0
```

One EL-M advanced-player request with those parameters succeeded. Query names and enum values should match the documented client; do not assume every possible aggregation name works. Season leaderboards should not be treated as live game snapshots or added to current-game totals. [Player route documentation](https://hoopr.sportsdataverse.org/reference/euroleague_player_stats.html), [team route documentation](https://hoopr.sportsdataverse.org/reference/euroleague_team_stats.html).

Useful tools:

- **Native TypeScript/JavaScript `fetch`:** sufficient for these JSON endpoints; no wrapper is required. Validate schemas and preserve raw responses. This fits the repository's language if a future implementation is separately authorized.
- **Python `euroleague_api`:** [maintainer repository](https://github.com/giasemidis/euroleague_api); wrappers for men's competition data, stats, PBP, and shots. Confirm installed-version behavior and competition arguments.
- **R `hoopR`:** [function index](https://hoopr.sportsdataverse.org/reference/) lists `euroleague_games`, `euroleague_game_stats`, `euroleague_game_pbp`, `euroleague_game_points`, season/player/team functions, and related retrieval tools.
- **Python SportsDataverse:** [EuroLeague API reference](https://sportsdataverse-py.sportsdataverse.org/docs/euroleague/reference/euroleague/other) documents the same men's API families. Wrapper support is not a separately maintained full historical bulk archive.
- **TypeScript community SDK:** [aimon7/euroleague-api](https://github.com/aimon7/euroleague-api) is another unofficial client; review version, maintenance, and schema coverage before adoption. It was not installed or executed here.

None of these clients extends men's `E/U` coverage to EL-W/EC-W. A wrapper also does not confer data redistribution rights.

### 14.2 FIBA GDAP and LiveStats Integrator: EL-W and EC-W

**Access:** authenticated subscription/product entitlement from FIBA. Confirm the women's competition IDs, season IDs, live-game access, and data fields with FIBA. Exact entitled endpoint paths are available through the authenticated Swagger/product documentation; no unauthenticated guessed route is presented here.

**Transport:** GDAP documents **pull only**, including live data. It suggests polling live-game data every **5–10 seconds** as an integration example, not a latency SLA. Non-live endpoints generally return validated data. Its documentation says to use Live Stat Interface **v2**, with v1 retired October 1, 2025. Provider-dependent optional fields still require inspection. [GDAP documentation](https://gdap-portal.fiba.basketball/documentation).

Request samples for both EL-W and EC-W covering a live game, completed game, overtime, and correction. Establish whether the product includes player/team boxes, PBP, shot coordinates, starters, substitutions, clock state, rosters, and historical validated statistics. These are procurement/verification questions, not claims that every field is included by default.

**Do not use the legacy MAP API as a public alternative:** FIBA now reserves it for internal use and directs external users to GDAP. [Official MAP notice](https://gdap-portal.fiba.basketball/map-api).

### 14.3 FIBA LiveStats / Genius Sports

[FIBA LiveStats](https://about.fiba.basketball/en/services/data-and-video-solutions/fiba-live-stats) is the courtside statistics collection and publication ecosystem used by many FIBA competitions. It can publish live game centers and reports and supports data integrations. It is not simply a universal free consumer API key for every FIBA game.

For women's competition data, follow the official game-center link or obtain an authorized league/FIBA/Genius feed. Confirm the competition and venue's actual provider. A live page that displays a shot chart does not prove that a supported public shot-coordinate export exists. Do not extract embedded credentials or bypass access controls.

### 14.4 Sportradar Global Basketball

**Access:** API key and product contract/trial entitlement. Use **Global Basketball**, not an NBA-only product. Search the [coverage matrix](https://coverage-matrix.sportradar.com/) for each competition and season; verify the game `coverage` object. Women's coverage must be checked independently from the men's namesakes.

Documented REST examples:

```text
GET https://api.sportradar.com/basketball/{access_level}/v2/{language_code}/schedules/live/summaries.{format}
GET https://api.sportradar.com/basketball/{access_level}/v2/{language_code}/sport_events/{sport_event_id}/timeline.{format}
```

[Live Summaries](https://developer.sportradar.com/basketball/reference/global-basketball-live-summaries) supplies live score and available team/player statistics. [Sport Event Timeline](https://developer.sportradar.com/basketball/reference/global-basketball-sport-event-timeline) adds available PBP. Both reference pages list a one-second cache TTL; that is **not** a guarantee that arena events reach the customer within one second.

Other [Global Basketball products](https://developer.sportradar.com/basketball/reference/global-basketball-overview) include live timelines/deltas, profiles, lineups, seasonal statistics, and push events/statistics. Push access is a product capability to confirm in the contract, not a property of every REST subscription. Snapshot reconciliation is still necessary after disconnects.

The [coverage FAQ](https://developer.sportradar.com/basketball/reference/global-basketball-faq) distinguishes live coverage, post-match box scores, starting lineups, running clocks, and minute precision. A post-match `boxscore` flag alone does not prove live player statistics. No paid request or competition-specific entitlement was tested here.

### 14.5 API-Sports API-Basketball

**Access:** API key, supplied as `x-apisports-key`, with plan-dependent quotas. Use the basketball product, not API-NBA. Discover competition IDs and season coverage before retrieving games; do not reuse a men's ID for a women's competition.

Documented route families:

```text
GET https://v1.basketball.api-sports.io/leagues
GET https://v1.basketball.api-sports.io/games
GET https://v1.basketball.api-sports.io/games/statistics/teams?id={game_id}
GET https://v1.basketball.api-sports.io/games/statistics/players?id={game_id}
```

The league response's coverage describes available functions. Player game statistics are documented with a **30–120-second update interval**; do not assume a score's update interval applies to player boxes. Public docs establish the routes, not complete live support for all four requested competitions. PBP, shot coordinates, tracking, and lineup stints were not verified for this product. [API-Basketball documentation](https://api-sports.io/documentation/basketball/v1), [indexed endpoint specification](https://api-sports.io/documentation/basketball/basketball-v1.yaml).

### 14.6 Public score sites and analytical websites

Official game centers are useful for watching and cross-checking games. Independent score/stat sites can provide additional context, but no supported unrestricted public API should be inferred from a site's browser traffic. If a provider offers export access, use its documented product and terms. A data vendor's contract, a code library's license, and the underlying organizer's data rights are separate matters.

## 15. Information available during a live game

This is a **capability inventory**, not a promise that every feed supplies every item. Each item identifies the minimum data needed. For EL-M/EC-M, the completed-game samples establish field presence but not in-progress freshness. For EL-W/EC-W, verify the entitled live schema and official game's coverage.

### 15.1 Common scoreboard and box-score information

- **Game identity and context:** competition, season, phase, game ID, teams, venue, scheduled tip-off, and status; from schedule/header data.
- **Score:** home/away total and period scores; from live summary/header/box.
- **Period and clock:** current quarter/overtime and remaining game clock; a running clock requires a clock-state field or a clearly labeled extrapolation.
- **Player participation:** active game roster, starters, current minutes, DNP status where supplied; roster-only data does not establish on-court state.
- **Player counting statistics:** PTS, 2PM/2PA, 3PM/3PA, FTM/FTA, rebounds, assists, steals, turnovers, blocks, and fouls as the live collector updates them.
- **Extended box fields:** blocks against, fouls received, plus/minus, PIR or EFF, if supplied or calculable from complete inputs.
- **Team counting statistics:** both sides' totals, including unassigned team rebounds/turnovers where available.
- **Live leaders:** highest current points, rebounds, assists, PIR/EFF, etc.; derived from the current box rather than requiring a separate API.
- **Live shooting percentages:** FG%, 2P%, 3P%, FT%, eFG%, and estimated TS% from current counts, with zero-denominator handling.
- **Live per-minute/per-possession rates:** possible when current minutes/possessions are reliable; very early-game values are unstable.
- **Team comparison:** current margins in shooting, rebounds, assists, turnovers, fouls, and the declared four factors.

### 15.2 Additional information requiring events or richer feeds

- **Chronological PBP:** shot attempts/results, free throws, rebounds, assists, steals, turnovers, fouls, substitutions, timeouts, period boundaries, and any supplied reviews.
- **Actor and related player:** scorer, assister, rebounder, defender, fouled player; only where event linkage is supplied.
- **Shot map:** attempt coordinates, outcome, two/three/FT classification, zone, player, time, and score state.
- **Scoring context:** men's sampled shot rows include fast-break, second-chance, and points-off-turnover flags. Equivalent women's fields need separate confirmation.
- **Current five on court:** reconstruct from starters and every substitution; never guess from accumulated minutes.
- **Possession and shot clock:** only if explicitly provided or reliably reconstructed. A PBP event clock alone does not provide a live shot clock.
- **Possession arrow/jump-ball state:** ruleset/provider dependent; do not assume an NBA jump-ball workflow.
- **Quarter team fouls, bonus, timeouts remaining:** explicit state or rules-aware reconstruction, with historical rule versions.
- **Runs, lead changes, largest lead, time ahead, droughts:** derive from corrected scoring events and game-clock intervals.
- **Bench/paint/fast-break/second-chance/POT totals:** published summary fields or carefully reconciled event derivations.
- **Lineup and on-off rates:** derive from valid stints and possessions; label provisional until corrections settle.
- **Live win probability/expected final score:** separately licensed or local models, not part of a basic factual scoreboard.
- **Availability alerts:** explicit provider updates only; a player leaving the court does not establish an injury.
- **Officials/attendance/broadcast links:** may arrive or change late and are not universally live fields.
- **Tracking/video/scouting context:** touches, screens, defender distances, play types, and movement coordinates require separate products; not observed in the public feeds tested.

### 15.3 Synchronization and operational behavior

A useful live collector would discover the day's schedule, poll only relevant games, and retain `source`, source timestamp if supplied, retrieval timestamp, status, and coverage for every snapshot. Rate limits and permissions take precedence over a desired refresh interval. Public men's polling has no verified recommended interval here; measure responsibly or obtain a contract rather than inventing one.

Keep raw snapshots/events, update by stable identity, and allow edits, removals, and sequence corrections. Do not append every full-snapshot response as new events. Handle a late two-to-three-point correction, reassigned assist/rebound, deleted foul, and overtime without double counting. Reconcile score, box, and PBP because separate endpoints may update at different moments.

Display data age and distinguish **scheduled**, **live**, **stale**, **ended but provisional**, and **validated**. On a connection failure, retain the last good snapshot and its age. After the final buzzer, refresh the validated result and any subsequent corrections. A final status is not proof that statistical review is complete.

Measure end-to-end freshness separately from HTTP response time and cache TTL. No in-progress latency benchmark was run for this document. A ten-second polling loop cannot guarantee ten-second source latency.

## 16. Observed men's API field dictionary

The following is an **observed sample schema**, not a guaranteed contract. It was checked for `E2025/game 1` and `U2025/game 1` on November 6, 2026. Keep raw names and values alongside any normalized names.

### 16.1 v2 game `/stats`

Top level: `local` and `road`, each containing `coach`, `players`, `team`, and `total`. Each entry in `players` contains **`player` metadata and a nested `stats` object**. Reading `players[i].points` instead of `players[i].stats.points` would be wrong.

Observed `stats` keys and meanings:

- `timePlayed`: player court time in seconds in these samples; divide by 60 for decimal minutes.
- `valuation`: PIR, reconciled with section 12's formula.
- `points`: PTS.
- `fieldGoalsMade2`, `fieldGoalsAttempted2`: 2PM, 2PA.
- `fieldGoalsMade3`, `fieldGoalsAttempted3`: 3PM, 3PA.
- `freeThrowsMade`, `freeThrowsAttempted`: FTM, FTA.
- `fieldGoalsMadeTotal`, `fieldGoalsAttemptedTotal`: FGM, FGA, excluding free throws.
- `accuracyMade`, `accuracyAttempted`: do **not** map these to FGM/FGA. In the sampled side totals, the former equaled PTS and the latter equaled `2×2PA+3×3PA+FTA`. Their ratio is not standard FG%, eFG%, or TS%.
- `totalRebounds`, `defensiveRebounds`, `offensiveRebounds`: REB, DREB, OREB.
- `assistances`: AST; preserve the raw spelling.
- `steals`, `turnovers`: STL, TOV.
- `blocksFavour`, `blocksAgainst`: BLK, BA.
- `foulsCommited`, `foulsReceived`: FC, FD; `Commited` is the actual one-t spelling.
- `plusMinus`: player on-court scoring margin. The team-total version has different aggregation semantics, below.
- `dorsal`: jersey-number field in the stats record; retain the metadata's string representation too.
- `startFive`: starting-five indicator.
- `startFive2`: an additional boolean was present; its distinct meaning was not established. Preserve it without inventing a second starting lineup definition.

Important distinctions established by the samples:

1. **`team` contains unassigned team events.** It is not the full side's box score. The home `team.totalRebounds` was 4 in EL-M and 5 in EC-M.
2. **`total` contains side totals.** Do not add `team` again to `total`; it would double-count those events.
3. **`total.timePlayed` was 2,400 seconds**, the regulation game duration. The sum of player seconds was **12,000 for each side** in both games. Do not divide this team-total time by five as if it were player-minutes sum.
4. **`total.plusMinus` equaled summed player plus/minus**, 35 for the EL-M home side and 50 for the EC-M home side. Their actual winning margins were 7 and 10. Compute team scoring margin from the score, not this total field.
5. **Zero-minute roster rows exist.** One EL-M row had all-zero stats and both starter booleans false. An all-zero row does not establish an appearance or an injury reason.
6. **Identity namespaces differ.** v2 `player.person.code` had leading-zero numeric strings, while event IDs carried a `P` prefix and padding. Preserve both and verify a crosswalk before stripping prefixes or zeros.

Observed player metadata included person code and several name forms; country and birth country; height, weight, birth date; position and position name; jersey fields; club code/name/TV code; roster active/start/end dates; season code/name/year; external ID; and image/social links. A field's presence does not establish completeness or accuracy for every player. Avoid using names or jersey numbers as join keys.

### 16.2 `PlayByPlay`

Observed root fields:

```text
Live, TeamA, TeamB, CodeTeamA, CodeTeamB, ActualQuarter,
FirstQuarter, SecondQuarter, ThirdQuarter, ForthQuarter, ExtraTime
```

`ForthQuarter` is the actual misspelling. `Live=false` in both completed-game samples. Individual event fields included:

```text
TYPE, NUMBEROFPLAY, CODETEAM, PLAYER_ID, PLAYTYPE, PLAYER,
TEAM, DORSAL, MINUTE, MARKERTIME, POINTS_A, POINTS_B,
COMMENT, PLAYINFO
```

`NUMBEROFPLAY` orders events; `MARKERTIME` is a clock string. Team/player IDs contain right-padding in the observed feed. `POINTS_A` or `POINTS_B` can be null on an event; do not interpret null as a score reset. Preserve structured action codes plus text, and do not assume consecutive sequence numbers with no gaps.

Sample action codes included `BP` (begin period), `JB` (jump ball), `2FGM`, `2FGA`, `3FGM`, `3FGA`, `FTM`, `AS`, `TO`, `ST`, `O` (offensive rebound), `D` (defensive rebound), `CM` (foul), and `RV` (foul drawn). In this event vocabulary `2FGA`/`3FGA` identified **missed** attempts in the samples; made attempts have their own codes. Counting only the codes ending `FGA` would undercount total field-goal attempts. This list is not the full historical enum.

### 16.3 `Points`

Root `Rows` contains shot/scoring events with:

```text
NUM_ANOT, TEAM, ID_PLAYER, PLAYER, ID_ACTION, ACTION, POINTS,
COORD_X, COORD_Y, ZONE, FASTBREAK, SECOND_CHANCE,
POINTS_OFF_TURNOVER, MINUTE, CONSOLE, POINTS_A, POINTS_B, UTC
```

`NUM_ANOT` can be used as an event-link candidate, subject to validation. `ID_ACTION` distinguishes makes, misses, and free throws; `POINTS` is zero for observed misses. The context flags were string values such as `"0"` and `"1"`, not native booleans. `CONSOLE` contained a remaining-clock string. `UTC` was a compact timestamp string such as `20250930174549`; preserve its format and do not infer a millisecond timestamp.

The coordinate reference system and complete zone dictionary were **not** calibrated in this research. These are shot-entry locations, not continuous tracking of all players and the ball.

### 16.4 v3 advanced-player sample

A one-row request returned a root object with `total` and `players`; the observed `total` was 208 while `Limit=1` returned one player. Pagination is required for a complete result.

Observed fields included `playerRanking`, nested `player` identity/team, `gamesPlayed`, `minutesPlayed`, `effectiveFieldGoalPercentage`, `trueShootingPercentage`, `offensiveReboundsPercentage`, `defensiveReboundsPercentage`, `reboundsPercentage`, `assistsToTurnoversRatio`, `assistsRatio`, `turnoversRatio`, `twoPointAttemptsRatio`, `threePointAttemptsRatio`, `freeThrowsRate`, and **`possesions`** (raw misspelling).

Many rates arrived as strings with `%`. Preserve raw strings and explicitly normalize units. **Do not infer exact formulas from names or wrapper glossaries.** In this sample `twoPointAttemptsRatio="33%"` and `threePointAttemptsRatio="13.8%"`; they did not sum to 100%. Therefore these fields cannot safely be assigned this catalog's `2PA/FGA` and `3PA/FGA` definitions without further reconciliation. Likewise, `possesions` must not be assumed to be exact team possessions, and `trueShootingPercentage` must not automatically be assumed to use 0.44.

The sample proves these values and fields exist, not their complete statistical specification. Keep published advanced fields side by side with independently calculated values until their denominator, phase filters, and aggregation modes are established.

## 17. Historical coverage and data quality

### 17.1 Coverage must be measured separately

- **EL-M and EC-M:** enumerate each competition's available seasons and actual game list. Successful 2025-26 requests do not prove that older shot/PBP/advanced data cover every season. Early box-score availability can differ from event availability.
- **EL-W and EC-W:** inspect official historical event pages and the entitled provider's season catalog independently. A public cumulative PDF does not prove machine-readable event history.
- **Modern versus historical competition identity:** retain provider era and competition identifiers. A historical predecessor competition and a modern men's EuroLeague season may require an explicit continuity policy.
- **Qualifiers and later phases:** check every phase; main-event completeness does not establish qualifying-round coverage.
- **Canceled or administratively decided games:** preserve their status and official scoring rules; do not create ordinary player performance lines from a forfeited score.
- **Roster and club changes:** preserve season-specific identities and stints. Sponsored names and transliteration are not stable keys.
- **Raw season labels:** men's `E2025`/`U2025` means 2025-26. FIBA report-year labels and vendor season strings may follow different conventions. Map by actual season metadata, not a universal string operation.
- **Unknown versus zero:** absent BA, FD, coordinates, or lineup fields are unknown. Do not manufacture PIR from EFF when the required extra inputs are missing.
- **Publication lag:** a live score, game box, season leaderboard, and official report may refer to different validation times.

No complete freely downloadable, permissively reusable archive covering **all four competitions and all these data families** was established. Libraries that call upstream endpoints are retrieval tools, not proof of such an archive.

### 17.2 Validation rules for a future dataset

These are proposed checks, not claims that a full dataset has already passed them:

1. **Key uniqueness:** source + competition + season + game + entity/grain. Preserve raw IDs and any crosswalk confidence.
2. **Scoring arithmetic:** `2×2PM+3×3PM+FTM=PTS`; made counts do not exceed attempts. Allow only documented administrative exceptions.
3. **Shooting components:** `FGM=2PM+3PM`, `FGA=2PA+3PA`.
4. **Rebounding:** `REB=OREB+DREB` within scope; reconcile named-player plus unassigned team events to official totals.
5. **Playing time:** in a normal full five-player game, each side's summed player seconds is `5×elapsed game seconds`; use source rounding tolerance and account for exceptional short-handed play.
6. **Plus/minus:** in ordinary five-on-five play, player plus/minus sum equals five times the side's game margin. A provider's total field can store that sum rather than the margin.
7. **PIR/EFF:** recompute from the appropriate formula and inputs; no silent substitution of one index for the other.
8. **Event totals:** reconstruct score, field goals, free throws, rebounds, assists, and turnovers from corrected PBP, then compare to boxes. Do not assume event completeness from final-score agreement alone.
9. **Assists:** do not impose the NBA-style `AST≤FGM` bound where free-throw assists are credited.
10. **Shots:** compare shot-event makes/attempts to the box; report missing coordinate share and test zone geometry.
11. **Lineups:** valid player counts, no duplicate on-court player, coherent substitutions, and total stint time reconciliation. Mark irrecoverable intervals unknown.
12. **Season aggregation:** compare totals and weighted rates to the same official competition/phase filters. A rate rounded to one decimal needs an explicit display-rounding tolerance.
13. **Live corrections:** replay duplicate, reordered, updated, and deleted events; a repeated snapshot must be idempotent.
14. **Provider comparison:** publish exact-match rates and numeric tolerances by season and field, not just a global average.

For unavailable data, prefer precise reasons such as **"not included in this subscription"**, **"no shot coordinates in this game"**, **"historical event coverage unverified"**, or **"official formula not established"**. Missing values must not fail unrelated statistics or become false zeros.

## 18. Retrieval choices for these four competitions

For a **men's research prototype**, the strongest verified starting point here is the league-hosted box/PBP/shot routes. They worked with ordinary HTTP for both competitions and expose substantially more than scores. Cache and validate them, establish terms and history, and accept that unofficial access may change. The public v3 advanced fields should be retained as published until their formulas are reconciled.

For **women's research and manual verification**, use the official FIBA competition statistics and individual game pages. For **supported structured live access**, approach FIBA GDAP with explicit EL-W and EC-W requirements. The public website and supported API are different access products; the retired MAP API is not a substitute.

For **one contracted provider across all four**, evaluate Sportradar Global Basketball or API-Basketball using actual sample games and a written per-competition field/latency matrix. A provider that covers scores for all four may still lack women's live player boxes, shots, substitutions, or history. No vendor is endorsed here as having verified complete four-competition coverage.

For **deep scouting and tracking**, request a separate product with confirmed competition/season coverage and export rights. Raw public shot locations do not supply defender distances, touches, or play-type tags.

Before choosing a provider, obtain answers for the four competitions separately:

- Which seasons and phases are available, including qualification and games after competition transfers?
- Are player boxes live or post-game only? Are minutes second-accurate?
- Are PBP, starters, substitutions, shot coordinates, FD, BA, plus/minus, and EFF/PIR included?
- Are event corrections/deletions exposed, and how is a validated final identified?
- What are actual update cadence, end-to-end latency, quotas, cache rules, and outage behavior?
- Are local storage, historical retention, offline use, and redistribution permitted under the intended product?
- Can sample results be reconciled to the official boxes before purchase or integration?

These are research conclusions. Implementing European competitions in Metis would require a separate scope/decision update; this document makes no database or application changes.

## 19. Verification and source register

### 19.1 What was actually checked

**Direct public HTTP, completed games:**

- `E2025`, game 1: Anadolu Efes Istanbul 85–78 Maccabi Rapyd Tel Aviv. Retrieved v2 `/stats`, legacy `PlayByPlay`, and `Points`.
- `U2025`, game 1: Slask Wroclaw 95–85 Neptunas Klaipeda. Retrieved the same three feed families.
- Both boxes contained 24 player rows across the two sides, including zero-minute rows where present. The PIR formula matched **24/24 rows in each game**, with exact arithmetic and zero mismatches.
- Each side in both games summed to **12,000 player-seconds**; each sampled home `total.timePlayed` was **2,400 seconds**. Home summed player plus/minus was **35** and **50**, matching the corresponding total fields rather than the scoring margins.
- Both event feeds returned period-grouped PBP and shots with makes/misses, coordinates, and context flags. No complete possession/lineup reconstruction or shot-coordinate calibration was performed.
- One EL-M v3 advanced-player request returned one player and `total=208`; field presence, string percentages, the `possesions` spelling, and the non-complementary two-/three-point ratios were inspected. Its formulas were not reverse-engineered or certified.

**Documentary/web evidence:**

- Reviewed Euroleague Basketball's statistical criteria manual, including its current retrieved version metadata and free-throw-assist provision.
- Reviewed official FIBA material and indexed women's statistics. EC-W's current statistics page exposed core leaderboard fields through search; several FIBA event pages returned access errors when opened directly.
- FIBA's indexed 2024 statistical manual supplied its EFF formula; direct PDF retrieval returned 404. Linked report PDFs also returned errors. Their layouts and full contents were not verified.
- Reviewed GDAP's subscription/live distinction, LSI version notice, pull mechanism, and MAP API retirement.
- Reviewed official Sportradar and API-Sports documentation. **No authentication, paid subscription, live latency benchmark, or complete coverage audit was performed.**
- Basketball-Reference method URLs were checked but returned access restrictions. They are included as canonical methodological references, not as evidence of a successful European data retrieval.
- No browser impersonation, access-control bypass, paid purchase, new dependency installation, or bulk archive download was performed.

### 19.2 Primary references and provider documentation

Definitions and official competition material:

- [Euroleague Basketball Statistics Criteria Manual](https://ftpserver.euroleague.net/general/EB_Statistics_Criteria_Manual.pdf).
- [EuroLeague game center](https://www.euroleaguebasketball.net/euroleague/game-center/) and [EuroCup game center](https://www.euroleaguebasketball.net/eurocup/game-center/).
- [FIBA statisticians resources](https://about.fiba.basketball/en/fiba-game-officials/statisticians) and [indexed FIBA 2024 manual](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf).
- [FIBA's 2026 rules announcement](https://about.fiba.basketball/en/regions/africa/news/fiba-official-basketball-rules-2026-to-take-effect-october-1).
- [EL-W current statistics](https://www.fiba.basketball/en/events/euroleague-women-26-27/stats), [EC-W current statistics](https://www.fiba.basketball/en/events/eurocup-women-26-27/stats), and [EL-W 2025-26 statistical review](https://www.fiba.basketball/en/events/euroleague-women-25-26/news/season-in-review-who-topped-the-stats-charts).

Retrieval and live-data documentation:

- [FIBA GDAP documentation](https://gdap-portal.fiba.basketball/documentation), [MAP access change](https://gdap-portal.fiba.basketball/map-api), and [FIBA LiveStats](https://about.fiba.basketball/en/services/data-and-video-solutions/fiba-live-stats).
- [Sportradar Global Basketball overview](https://developer.sportradar.com/basketball/reference/global-basketball-overview), [coverage FAQ](https://developer.sportradar.com/basketball/reference/global-basketball-faq), [coverage matrix](https://coverage-matrix.sportradar.com/), [live summaries](https://developer.sportradar.com/basketball/reference/global-basketball-live-summaries), and [game timeline](https://developer.sportradar.com/basketball/reference/global-basketball-sport-event-timeline).
- [API-Sports basketball documentation](https://api-sports.io/documentation/basketball/v1) and [indexed specification](https://api-sports.io/documentation/basketball/basketball-v1.yaml).
- [hoopR function index](https://hoopr.sportsdataverse.org/reference/), [player statistics](https://hoopr.sportsdataverse.org/reference/euroleague_player_stats.html), and [team statistics](https://hoopr.sportsdataverse.org/reference/euroleague_team_stats.html).
- [Python EuroLeague client](https://github.com/giasemidis/euroleague_api), [SportsDataverse Python API reference](https://sportsdataverse-py.sportsdataverse.org/docs/euroleague/reference/euroleague/other), and [TypeScript community client](https://github.com/aimon7/euroleague-api).

Independent publishers are cited next to their own methods in sections 2, 6, and 12. They do not replace official scorer definitions or establish an organizer-supported API.
