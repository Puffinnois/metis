# NBA statistics reference

Research date: **November 5, 2026**. Scope: NBA players, teams, games, lineups, possessions, shots, tracking, scouting, and widely used external models.

This catalog provides statistic names, meanings, formulas or calculation methods, and retrieval routes. It covers the major official public statistical families and major independent metrics. There is no finite universal list of _every_ NBA statistic: vendors add private metrics, researchers publish new models, and any measure can be split across thousands of situations. Related variants are listed together, with rules for constructing the family. Proprietary or incompletely documented formulas are identified rather than guessed.

**Evidence and limits.** Provider documentation, API schemas, methodology articles, and this repository's existing dataset audit were consulted. A documented endpoint is a retrieval route, not a claim that a live request succeeded today. Coverage and access can differ by metric, season, and subscription. Some Basketball-Reference methodology pages blocked direct retrieval; indexed extracts were available, and the original pages are linked. This document does not certify every endpoint or historical season.

## Contents

1. [Notation and calculation rules](#1-notation-and-calculation-rules)
2. [Where to retrieve the data](#2-where-to-retrieve-the-data)
3. [Traditional box scores and participation](#3-traditional-box-scores-and-participation)
4. [Shooting efficiency and opportunity rates](#4-shooting-efficiency-and-opportunity-rates)
5. [Possessions, pace, and efficiency ratings](#5-possessions-pace-and-efficiency-ratings)
6. [Scoring composition and shares of team production](#6-scoring-composition-and-shares-of-team-production)
7. [Shot location and shot-context statistics](#7-shot-location-and-shot-context-statistics)
8. [Player tracking](#8-player-tracking)
9. [Hustle and box outs](#9-hustle-and-box-outs)
10. [Defense and individual matchups](#10-defense-and-individual-matchups)
11. [Play types](#11-play-types)
12. [Lineups, on-off, clutch, and situational splits](#12-lineups-on-off-clutch-and-situational-splits)
13. [Team strength, standings, and game flow](#13-team-strength-standings-and-game-flow)
14. [Composite and impact metrics](#14-composite-and-impact-metrics)
15. [New NBA tracking models](#15-new-nba-tracking-models)
16. [Play-by-play-derived statistics](#16-play-by-play-derived-statistics)
17. [Player measurements and draft combine](#17-player-measurements-and-draft-combine)
18. [Fantasy and other statistical families](#18-fantasy-and-other-statistical-families)
19. [Retrieval examples and implementation notes](#19-retrieval-examples-and-implementation-notes)
20. [Historical coverage and interpretation traps](#20-historical-coverage-and-interpretation-traps)
21. [Mapping to this project's datasets](#21-mapping-to-this-projects-datasets)
22. [Source index and maintenance](#22-source-index-and-maintenance)

## 1. Notation and calculation rules

- `P`, `T`, `O`, and `L` mean player, player's team, opponent, and league. Unless explicitly written `on`, team values are for the full matching sample.
- `MP` or `MIN` means minutes played. `T_MP` in BRef-style formulas is the **sum of all team player minutes**. `T_MP / 5` is team elapsed playing time: ordinarily 48 minutes in regulation. For a lineup, use its actual elapsed minutes.
- `T_X_on` means team statistic X during the player's actual court time; it is not the full-game total. `O_X_on` is the opponent equivalent.
- `FGM/FG` = made field goals; `FGA` = field-goal attempts; `3PM/3P/FG3M` = made threes; `3PA/FG3A` = three-point attempts; `FTM/FT` = made free throws; `FTA` = attempts; `OREB/ORB`, `DREB/DRB`, `REB/TRB` are offensive, defensive, and total rebounds; `TOV/TO` = turnovers.
- Percentage formulas use `100 × numerator / denominator`. A JSON field may store a **fraction**, such as `0.625`, instead of `62.5`. A difference between 62% and 57% is **5 percentage points**, not a 5% relative increase.
- Counts have no separate algebraic formula: they are recorded events or sums of those events. Tracking counts require classified tracking events; box scores cannot recreate them.
- For count `X`: total = `ΣX`; per game = `ΣX / GP`; per minute = `ΣX / ΣMP`; per 36 = `36ΣX / ΣMP`; per 48 = `48ΣX / ΣMP`; per 100 possessions = `100ΣX / relevant possessions`. For player per-100 production, specify actual on-court team possessions versus a minutes-based estimate. Do not substitute individual used plays.
- Aggregate percentages from **summed numerators and denominators**, not unweighted averages of percentages. Aggregate ratings using possession denominators.
- Zero denominators produce undefined rates. Preserve `null` and a reason: no attempts, unavailable tracking, unsupported season, etc. Missing is not zero.
- **Recorded** = event count/measurement; **derived** = arithmetic; **estimated** = approximation; **model** = fitted calculation. A public formula does not imply public access to its inputs.
- `_RANK` fields and percentiles depend on the comparison population, qualification threshold, tie handling, and direction of improvement. They are not additional basketball events.

## 2. Where to retrieve the data

Every section specifies a retrieval route inherited by its entries unless an exception is given. Route names refer to the sources below.

### NBA Base / Advanced / Misc / Scoring / Usage / Four Factors / Opponent / Defense

Public tables: [player traditional stats](https://www.nba.com/stats/players/traditional), [team traditional stats](https://www.nba.com/stats/teams/traditional), and their other measure views.

Machine access: `leaguedashplayerstats` and `leaguedashteamstats`. Select `MeasureType=Base`, `Advanced`, `Misc`, `Scoring`, `Usage`, `Four Factors`, `Opponent`, or `Defense` where supported. Player/team schemas differ. The community Python package `nba_api` wraps NBA services; it is **not an official NBA API product**. [Player schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerstats.md), [team schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashteamstats.md).

### NBA Game

Use the appropriate `boxscore...` endpoint in the [endpoint inventory](https://github.com/swar/nba_api/tree/master/docs/nba_api/stats/endpoints). Examples: `boxscoretraditionalv3`, `boxscoreadvancedv3`, `boxscorescoringv3`, `boxscoreusagev3`, `boxscoreplayertrackv3`, `boxscorematchupsv3`. V2/V3 denote schema versions, not identical coverage. `playergamelog`, `playergamelogs`, `teamgamelog`, and `leaguegamelog` supply game logs.

### NBA Live / PBP

Documented JSON patterns: `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{GAME_ID}.json` and `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_{GAME_ID}.json`. Wrappers: `nba_api.live.nba.endpoints.boxscore` and `playbyplay`. Historical Stats feeds include `playbyplayv3`. The live CDN is not a guaranteed complete historical archive. [Live box schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/boxscore.md), [action schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/playbyplay.md).

### NBA Shots

[Shooting tables](https://www.nba.com/stats/players/shooting), [shot dashboard](https://www.nba.com/stats/players/shots-general). Endpoints: `shotchartdetail` for events/league zone averages; `leaguedashplayershotlocations` / `leaguedashteamshotlocations` for zones; `playerdashboardbyshootingsplits`; `playerdashptshots`, `leaguedashplayerptshot`, and `leaguedashteamptshot` for tracked context. [Shot-event schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/shotchartdetail.md), [tracked-shot schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playerdashptshots.md).

### NBA Tracking

[Tracking tables](https://www.nba.com/stats/players/drives). Endpoint `leaguedashptstats`, with `PlayerOrTeam=Player/Team` and `PtMeasureType` including `Drives`, `Passing`, `Possessions`, `SpeedDistance`, `Rebounding`, `CatchShoot`, `PullUpShot`, `Defense`, `ElbowTouch`, `PostTouch`, `PaintTouch`, `Efficiency`. Columns change with the measure. `playerdashptpass` and `playerdashptreb` add breakdowns. [Parameters](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashptstats.md), [passing schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playerdashptpass.md), [rebounding schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playerdashptreb.md).

### NBA Hustle

[Hustle](https://www.nba.com/stats/players/hustle), [box-outs](https://www.nba.com/stats/players/box-outs). Endpoints `leaguehustlestatsplayer`, `leaguehustlestatsteam`, and game hustle endpoints. [Player fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguehustlestatsplayer.md), [team fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguehustlestatsteam.md).

### NBA Defending / Matchups

[Defensive dashboard](https://www.nba.com/stats/players/defense-dash-overall). Endpoints `leaguedashptdefend`, `leaguedashptteamdefend`, `playerdashptshotdefend`, `leagueseasonmatchups`, `matchupsrollup`, `boxscorematchupsv3`, `boxscoredefensivev2`. Closest-defender shots and assigned matchups use different attribution systems. [Shot-defense fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashptdefend.md), [matchup fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leagueseasonmatchups.md), [defensive box](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoredefensivev2.md).

### NBA Play Types

[Play-type tables](https://www.nba.com/stats/players/isolation), based on Synergy classifications. Endpoint `synergyplaytypes`; choose `PlayType`, `PlayerOrTeam=P/T`, `TypeGrouping=offensive/defensive`, and `SeasonYear`. Public summaries do not include the full licensed video/tagging product. [Schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/synergyplaytypes.md).

### NBA Lineups / Clutch / On-Off

[Lineups](https://www.nba.com/stats/lineups/traditional), [clutch](https://www.nba.com/stats/players/clutch-traditional). Endpoints `leaguedashlineups`, `teamdashlineups`, `leaguedashplayerclutch`, `leaguedashteamclutch`, `teamplayeronoffsummary`, `teamplayeronoffdetails`. [Lineup schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashlineups.md), [clutch parameters](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerclutch.md), [on-off schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/teamplayeronoffdetails.md).

### NBA Standings / Bios / Combine

[Standings](https://www.nba.com/standings), [bios](https://www.nba.com/stats/players/bio), [combine](https://www.nba.com/stats/draft/combine-anthro). Endpoints `leaguestandingsv3`, `commonplayerinfo`, `commonteamroster`, `leaguedashplayerbiostats`, `drafthistory`, `draftcombinestats`, `draftcombineplayeranthro`, `draftcombinedrillresults`, `draftcombinespotshooting`, `draftcombinenonstationaryshooting`. [Combine schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/draftcombinestats.md).

### Basketball-Reference (BRef) / Stathead

[Basketball-Reference](https://www.basketball-reference.com/) provides historical player/team, shooting, advanced, and play-by-play tables. [Stathead](https://stathead.com/basketball/) supplies subscription research/search tools. Use table exports where offered. No documented general-purpose public BRef API was found; a scraper is not an official API. [Glossary/formulas](https://www.basketball-reference.com/about/glossary.html), [qualification rules](https://www.basketball-reference.com/about/rate_stat_req.html).

### PBP Stats

[PBP Stats](https://www.pbpstats.com/) and its [API](https://api.pbpstats.com/docs) expose possession, lineup, on-off, shot, and assist-network analyses. The [open-source parser](https://pbpstats.readthedocs.io/en/latest/) can rebuild enriched possessions from supported feeds. Definitions may differ from published NBA totals; preserve provenance.

### Model publishers

- **Dunks & Threes:** [EPM methodology](https://dunksandthrees.com/about/epm), [EPM tables](https://dunksandthrees.com/epm). Publisher-specific access/API arrangements.
- **BBall Index:** [LEBRON methodology](https://www.bball-index.com/lebron-introduction/), [dashboard](https://www.bball-index.com/lebron-database/), [glossary](https://www.bball-index.com/glossary/). Public and subscription tools coexist.
- **DARKO:** [current site](https://www.darko.app/), [methodology](https://www.darko.app/about). Keep model version and as-of date when retrieving projections/exports.
- **FiveThirtyEight archives:** [RAPTOR CSVs](https://github.com/fivethirtyeight/data/tree/master/nba-raptor), [Elo archive](https://github.com/fivethirtyeight/data/tree/master/nba-elo). Historical products, not a dependable current-season service.
- **NBA Inside the Game:** [portal](https://www.nba.com/inside-the-game), [AWS overview](https://aws.amazon.com/sports/nba/). Public displays may have no documented supported public API.

### Bulk data and commercial APIs

- **SportsDataverse:** [release repository](https://github.com/sportsdataverse/sportsdataverse-data/releases), [dataset inventory](https://github.com/sportsdataverse/sportsdataverse-data#nba-stats-api). Published assets include Parquet. It mixes upstream data and derived products; a metric name does not establish model authorship. See [this project's earlier audit](nba-data-sources.md).
- **Sportradar:** [integration](https://developer.sportradar.com/basketball/docs/nba-ig-api-basics), [statistic inventory](https://developer.sportradar.com/basketball/reference/nba-statistics-summary). Authenticated commercial game, seasonal, split, and related feeds; confirm contracted fields/seasons.
- **SportsDataIO:** [NBA API](https://sportsdata.io/developers/api-documentation/nba). Authenticated commercial boxes and season data; final-game statistics can receive corrections.
- **BALLDONTLIE:** [NBA API](https://docs.balldontlie.io/). API-key access with tier-dependent basic/advanced statistics, shots, PBP, and related products. Do not assume every endpoint is free.
- **Licensed tracking/scouting:** richer Synergy/Second Spectrum/Genius Sports and other vendor data may require a contract. Raw continuous player, ball, and limb coordinates are not generally a public NBA Stats download.

## 3. Traditional box scores and participation

**Retrieve all entries:** NBA Base/Game; NBA Live adds team/game details. BRef is a historical alternative. Field inventory: [dashboard schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerstats.md), [live box schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/boxscore.md). Elementary meanings and arithmetic are stated in original wording.

- **Games played (`GP`, `G`)** — games with actual participation, or team games played. Count. A roster listing/DNP does not by itself count.
- **Games started (`GS`)** — starts. Count starter flags; retrieve season summaries or aggregate NBA Live starters. Not every dashboard returns GS.
- **Minutes (`MIN`, `MP`)** — court time. Sum stint durations or recorded minutes; decode clock strings before arithmetic.
- **Wins (`W`) / losses (`L`)** — team results. Player dashboard records concern games in which the player appeared. Counts.
- **Win percentage (`W_PCT`, `W-L%`)** — `100W/(W+L)`; sometimes displayed as a fraction.
- **Points (`PTS`)** — scoring credited. `2FGM + 3PM + FTM`.
- **Field goals made (`FGM`, `FG`)** — made twos and threes, excluding free throws. Count.
- **Field-goal attempts (`FGA`)** — recorded two-/three-point attempts. A missed shot with a shooting foul ordinarily is not an FGA; a made and-one is.
- **Field-goal percentage (`FG%`, `FG_PCT`)** — `100FGM/FGA`.
- **Missed field goals (`FGMX`)** — `FGA-FGM`.
- **Two-pointers made (`2PM`, `FG2M`)** — `FGM-3PM`.
- **Two-point attempts (`2PA`, `FG2A`)** — `FGA-3PA`.
- **Two-point percentage (`2P%`, `FG2_PCT`)** — `100(2PM)/(2PA)`.
- **Three-pointers made (`3PM`, `FG3M`)** — count of made threes.
- **Three-point attempts (`3PA`, `FG3A`)** — count of recorded three-point attempts.
- **Three-point percentage (`3P%`, `FG3_PCT`)** — `100(3PM)/(3PA)`.
- **Free throws made (`FTM`, `FT`)** — count of successful free throws.
- **Free-throw attempts (`FTA`)** — recorded attempts; repeated/nullified attempts need provider treatment.
- **Free-throw percentage (`FT%`, `FT_PCT`)** — `100FTM/FTA`.
- **Missed free throws** — `FTA-FTM`.
- **Offensive rebounds (`OREB`, `ORB`)** — credited recoveries of eligible misses by the shooting side. Count.
- **Defensive rebounds (`DREB`, `DRB`)** — credited recoveries of eligible misses by the defending side. Count.
- **Total player rebounds (`REB`, `TRB`)** — `OREB+DREB`.
- **Team rebounds / team offensive rebounds / team defensive rebounds** — rebounds assigned to a team rather than a player. Counts. NBA Live: `reboundsTeam`, `reboundsTeamOffensive`, `reboundsTeamDefensive`; distinguish them from sums of individual rebounds.
- **Assists (`AST`)** — scorer-credited passes leading to made field goals. Judged event count, not algebraically recoverable from shooting totals.
- **Turnovers (`TOV`, `TO`)** — possession losses charged to a player. Count; not every turnover generates a steal.
- **Team turnovers / total turnovers** — unassigned team losses and combined losses. Where the schema specifies it, total = player turnovers + team turnovers. NBA Live exposes `turnovers`, `turnoversTeam`, `turnoversTotal`; check scope before adding fields.
- **Steals (`STL`)** — credited defensive actions causing opponent turnovers. Count.
- **Blocks (`BLK`)** — credited legal deflections of shot attempts. Count; the offense may recover the ball.
- **Blocks against (`BLKA`, `blocksReceived`)** — own attempts blocked by opponents. Count.
- **Personal fouls (`PF`)** — personal fouls charged. Count.
- **Fouls drawn (`PFD`, `foulsDrawn`)** — opponent personal fouls drawn. Count; not necessarily shooting fouls.
- **Offensive fouls (`foulsOffensive`)** — count; often also produce turnovers, so do not count the same possession loss twice.
- **Technical fouls / team technical fouls** — recorded technicals by attribution. Retrieve Live/PBP; they do not all behave like personal fouls for penalty purposes.
- **Flagrant fouls / ejections / disqualifications** — corresponding event/status counts. Retrieve PBP or a commercial event feed; not universal season-table columns.
- **Team fouls (`foulsTeam`) / bonus status (`inBonus`)** — period-specific foul count/penalty state. Recorded state, not simply season PF.
- **Plus-minus (`+/-`, `PLUS_MINUS`)** — own-team points minus opponent points during court time. Full-game team value is final margin. It does not isolate an individual's causal contribution.
- **Points for (`plus`) / points against (`minus`) while on court** — scoring components of plus-minus. Sum score changes during stints; retrieve NBA Live or reconstruct.
- **Double-doubles (`DD2`)** — number of games with at least 10 in two or more of points, rebounds, assists, steals, blocks.
- **Triple-doubles (`TD3`)** — number of games with at least 10 in three or more of those categories. Mathematically also double-doubles; fantasy bonuses may use different stacking rules.
- **Quadruple-doubles / five-by-fives** — at least 10 in four categories / at least five in all five. Derive from boxes or search BRef/Stathead.
- **PPG / RPG / APG / SPG / BPG / TOPG** — points/rebounds/assists/steals/blocks/turnovers divided by GP. Every other count can use the same per-game transformation.

## 4. Shooting efficiency and opportunity rates

**Retrieve:** NBA Advanced/Four Factors, BRef advanced/shooting, or derive. Keep BRef estimates distinct from actual on-court rates. References: [BRef glossary](https://www.basketball-reference.com/about/glossary.html), [advanced schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoreadvancedv3.md), [four-factor schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscorefourfactorsv3.md).

- **Effective field-goal percentage (`eFG%`)** — extra credit for threes: `100(FGM+0.5×3PM)/FGA`; excludes free throws.
- **True shooting attempts (`TSA`)** — conventional estimated scoring attempts: `FGA+0.44FTA`. The coefficient approximates free-throw trips; it is not an exact count.
- **True shooting percentage (`TS%`)** — `100PTS/[2(FGA+0.44FTA)]` under the conventional box-score definition. Can exceed 100% in small samples.
- **Points per true shooting attempt** — `PTS/(FGA+0.44FTA)`, twice TS as a fraction. Sometimes called PPS, but that abbreviation has other denominators.
- **Field-goal points per attempt** — `(2FGM+3PM)/FGA = 2×eFG_fraction`; excludes free throws.
- **Total points per FGA (`PTS/FGA`)** — includes free-throw points but no free-throw attempts in the denominator. A distinct derived measure.
- **Three-point attempt rate (`3PAr`)** — `3PA/FGA` as a fraction; multiply by 100 for percent. NBA Scoring/BRef.
- **Two-point attempt rate** — `2PA/FGA`; complementary to 3PAr.
- **Free-throw attempt rate (`FTr`, `FTA_RATE`)** — `FTA/FGA`. NBA Four Factors.
- **Free throws made per FGA (`FT/FGA`)** — `FTM/FGA`. BRef Four Factors uses this made-shot formulation; it differs from FTA/FGA. [Four Factors](https://www.basketball-reference.com/about/factors.html).
- **Assist-to-turnover ratio (`AST/TO`, `AST_TOV`)** — `AST/TOV`; undefined when TOV is zero absent a display convention.
- **Player assist percentage, actual on-court** — `100P_AST/(T_FGM_on-P_FGM)`: teammate makes assisted by the player. Use the provider's published denominator where implementation differs.
- **Player assist percentage, BRef estimate (`AST%`)** — `100P_AST/[(P_MP/(T_MP/5))×T_FGM-P_FGM]`. Full-sample team totals approximate court-time opportunity.
- **Team assist percentage** — `100T_AST/T_FGM`.
- **Assist ratio (`AST_RATIO`)** — conventional play-based expression `100AST/(FGA+0.44FTA+AST+TOV)`. Different from AST% and AST/TO; NBA publishes its own computed field.
- **Player turnover percentage, BRef (`TOV%`)** — `100TOV/(FGA+0.44FTA+TOV)`; estimated used plays ending in turnovers.
- **Team turnover percentage (`TM_TOV_PCT`)** — `100T_TOV/T_POSS`, using the provider's turnover and possession definitions. An estimated four-factor version can instead use `FGA+0.44FTA+TOV` as denominator; retain the formula version.
- **Turnover ratio (`TOV_RATIO`, `turnoverRatio`)** — provider-specific turnover rate. Some NBA schemas expose it separately from team turnover percentage. Import the provider's value; do not automatically substitute BRef TOV% or AST_RATIO's denominator. Exact reproduction requires the endpoint's method.
- **Team offensive rebound percentage** — `100T_OREB/(T_OREB+O_DREB)`, with consistent rebound accounting.
- **Team defensive rebound percentage** — `100T_DREB/(T_DREB+O_OREB)`.
- **Team total rebound percentage** — `100T_REB/(T_REB+O_REB)`.
- **Player offensive rebound percentage, actual** — `100P_OREB/(T_OREB_on+O_DREB_on)` over eligible on-court rebounds.
- **Player defensive rebound percentage, actual** — `100P_DREB/(T_DREB_on+O_OREB_on)`.
- **Player total rebound percentage, actual** — `100P_REB/(T_REB_on+O_REB_on)`.
- **Player offensive rebound percentage, BRef (`ORB%`)** — `100P_ORB×(T_MP/5)/[P_MP×(T_ORB+O_DRB)]`.
- **Player defensive rebound percentage, BRef (`DRB%`)** — `100P_DRB×(T_MP/5)/[P_MP×(T_DRB+O_ORB)]`.
- **Player total rebound percentage, BRef (`TRB%`)** — `100P_TRB×(T_MP/5)/[P_MP×(T_TRB+O_TRB)]`.
- **Steal percentage (`STL%`)** — BRef estimate `100P_STL×(T_MP/5)/(P_MP×O_POSS)`. Actual on-court version: `100P_STL/O_POSS_on`.
- **Block percentage (`BLK%`)** — BRef estimate `100P_BLK×(T_MP/5)/[P_MP×(O_FGA-O_3PA)]`. Its denominator uses opponent two-point attempts; do not silently substitute all FGA.
- **Usage percentage, BRef (`USG%`)** — `100(P_FGA+0.44P_FTA+P_TOV)×(T_MP/5)/[P_MP×(T_FGA+0.44T_FTA+T_TOV)]`. Estimated finished plays, not possession time, passes, or all creation.
- **NBA usage / estimated usage (`USG_PCT`, `E_USG_PCT`)** — distinct published used-play-share fields. Retrieve NBA values; the BRef expression must not be asserted to reproduce both. Court-time, free-throw, and team-turnover treatments matter; exact endpoint formulas were not established here.
- **Relative TS / relative eFG (`rTS%`, `rEFG%`)** — player percentage minus a specified league percentage, in percentage points. Derive with an explicit season/baseline.
- **Shooting indexes (`TS+`, `eFG+`, `FG+`, `2P+`, `3P+`, `FT+`)** — ratio-to-league convention: `100×player_rate/league_rate`. BRef adjusted shooting. 100 is league average, not 100% accuracy. In Metis (Plan T1006) these and the rate indexes are the League indexes family, the league rate being the league's totals over the same games; a rate where lower is better (turnover percentage, the opponents' shooting) reads `100×(2−rate/league)`, so above 100 is better.
- **True-shooting points added (`TS Add`)** — `2×TSA×(TS_fraction-league_TS_fraction)`. BRef adjusted shooting or derive with matching baselines.
- **Field-goal points added (`FG Add`)** — `2×FGA×(eFG_fraction-league_eFG_fraction)`.

## 5. Possessions, pace, and efficiency ratings

**Retrieve:** NBA Advanced/Game, BRef, PBP Stats, or derive. [Advanced schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoreadvancedv3.md), [individual-rating method](https://www.basketball-reference.com/about/ratings.html), [PBP possession implementation](https://pbpstats.readthedocs.io/en/latest/_modules/pbpstats/resources/possessions/possession.html).

- **Possessions (`POSS`)** — offensive opportunities under a stated parser. Offensive rebounds normally continue a possession. Technical free throws, end-of-period events, and substitutions require rules; there is no universally exact box-score-only formula.
- **Simple estimated possessions** — `FGA+0.44FTA-OREB+TOV`.
- **Symmetric estimated possessions** — `0.5×(simple_estimate_T+simple_estimate_O)`; common game denominator, not exact separate team possessions.
- **BRef-style estimated possessions** — `0.5×{T_FGA+0.4T_FTA-1.07×[T_ORB/(T_ORB+O_DRB)]×(T_FGA-T_FGM)+T_TOV + O_FGA+0.4O_FTA-1.07×[O_ORB/(O_ORB+T_DRB)]×(O_FGA-O_FGM)+O_TOV}`. A separate approximation with rebound adjustments.
- **Offensive / defensive possessions** — own/opponent possession counts for the sample. They may differ slightly within a game or stint.
- **Offensive rating, team/lineup/on-court (`OffRtg`, `OFF_RATING`)** — `100×team points/offensive possessions`. A player's NBA OffRtg measures team scoring while that player is on court.
- **Defensive rating, team/lineup/on-court (`DefRtg`, `DEF_RATING`)** — `100×opponent points/defensive possessions`; lower is better.
- **Net rating (`NetRtg`, `NET_RATING`)** — `OffRtg-DefRtg`. Different offensive/defensive denominators can make it differ from margin per one common possession count.
- **Estimated offensive / defensive / net rating (`E_OFF_RATING`, `E_DEF_RATING`, `E_NET_RATING`)** — analogous rates using NBA estimated possessions. Estimated net = estimated offense minus estimated defense. Do not assume the NBA estimate uses the simple formula above.
- **Pace (`PACE`)** — possessions per 48 elapsed minutes: `48×(T_POSS+O_POSS)/(2×elapsed_minutes)` with a symmetric convention. Include overtime. Player/lineup values use its court time.
- **Estimated pace (`E_PACE`)** — pace with the provider's estimated possession denominator.
- **Pace per 40 (`PACE_PER40`)** — `PACE×40/48` for the same sample.
- **Points per possession (`PPP`)** — `PTS/POSS`; equals ORtg/100 only with identical points and possessions. Synergy uses a play-classified denominator.
- **Points produced (`PProd`, Oliver)** — estimated scoring contribution through shooting, assists, and offensive rebounds. Multistage published method; not identical to PTS.
- **Individual possessions (`TotPoss`, Oliver)** — estimated scoring, missed-attempt, and turnover possessions with rebound adjustments. Not identical to `FGA+0.44FTA+TOV`.
- **Individual offensive rating, BRef/Oliver** — `100PProd/TotPoss`. Use the full [published input calculations](https://www.basketball-reference.com/about/ratings.html); this is individual box-score efficiency, not NBA on-court ORtg.
- **Individual defensive rating, BRef/Oliver** — `T_DRtg+0.2×[100×D_Pts_per_ScPoss×(1-Stop%)-T_DRtg]`. `Stop%` and opponent points per scoring possession are intermediate estimates in the linked method. They cannot be replaced by ordinary steal percentage and PPP. Full sub-calculations are delegated to the source, not reproduced here.
- **Four Factors** — a set: eFG%, named turnover rate, OREB%, named free-throw rate. No universal official weighted sum combines them into one number.
- **Opponent Four Factors** — apply those same calculations to opponent inputs. Lower opponent eFG/FT/OREB rates and higher forced turnover rates generally favor the defense.

## 6. Scoring composition and shares of team production

**Retrieve:** NBA Misc, Scoring, Usage, Game, and PBP. [Scoring schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscorescoringv3.md), [usage schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoreusagev3.md), [live fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/boxscore.md).

- **Two-point scoring (`2PT PTS`)** — `2×2PM`.
- **Three-point scoring (`3PT PTS`)** — `3×3PM`.
- **Free-throw scoring (`FT PTS`)** — `FTM`.
- **Points in the paint (`PITP`, `PTS_PAINT`)** — field-goal points from the paint under provider location coding. Sum eligible shot values; excludes free throws.
- **Midrange points (`PTS_2PT_MR`)** — scoring on classified midrange twos. Sum shot values; zone conventions matter.
- **Fast-break points (`FBPS`, `PTS_FB`)** — points tagged as fast-break scoring. Recorded classification; it is not automatically every shot early in the clock.
- **Second-chance points (`SCP`, `PTS_2ND_CHANCE`)** — scoring credited to second opportunities after offensive rebounds. Use the source's possession and foul/free-throw rules; not all are putback shots.
- **Points off turnovers (`PTS_OFF_TOV`)** — scoring on opportunities following opponent turnovers. Requires possession linkage, not simply points scored by a stealing player.
- **Bench points / starter points** — points by nonstarters/starters in each game. Sum individual PTS using that game's starter status.
- **Opponent paint / fast-break / second-chance / turnover points** — corresponding opponent counts over a team or player's on-court sample. NBA Misc/Defense; these are not necessarily points individually conceded by the player.
- **Two-/three-point FGA shares (`PCT_FGA_2PT`, `PCT_FGA_3PT`)** — `100×2PA/FGA`, `100×3PA/FGA`.
- **Two-/three-point scoring shares (`PCT_PTS_2PT`, `PCT_PTS_3PT`)** — `100×2×2PM/PTS`, `100×3×3PM/PTS`.
- **Free-throw scoring share (`PCT_PTS_FT`)** — `100FTM/PTS`.
- **Midrange / paint / fast-break / turnover scoring shares (`PCT_PTS_2PT_MR`, `PCT_PTS_PAINT`, `PCT_PTS_FB`, `PCT_PTS_OFF_TOV`)** — `100×category points/PTS` for each named category.
- **Second-chance scoring share** — `100×second-chance points/PTS`; derive if not returned.
- **Assisted made twos / threes / all field goals** — counts of makes with a credited assist, by shot value; derive from PBP or use shooting splits.
- **Unassisted made twos / threes / all field goals** — corresponding made-shot total minus assisted makes.
- **Assisted two-point make percentage (`PCT_AST_2PM`)** — `100×assisted_2PM/2PM`.
- **Unassisted two-point make percentage (`PCT_UAST_2PM`)** — `100×unassisted_2PM/2PM`.
- **Assisted / unassisted three-point make percentages (`PCT_AST_3PM`, `PCT_UAST_3PM`)** — respective counts divided by 3PM, multiplied by 100.
- **Assisted / unassisted field-goal make percentages (`PCT_AST_FGM`, `PCT_UAST_FGM`)** — respective counts divided by FGM, multiplied by 100.
- **Player share of team field goals made / attempted (`%FGM`, `%FGA`)** — `100P_FGM/T_FGM_on`, `100P_FGA/T_FGA_on`.
- **Player share of team threes made / attempted (`%3PM`, `%3PA`)** — `100P_3PM/T_3PM_on`, `100P_3PA/T_3PA_on`.
- **Player share of team free throws made / attempted (`%FTM`, `%FTA`)** — `100P_FTM/T_FTM_on`, `100P_FTA/T_FTA_on`.
- **Player share of team offensive / defensive / total rebounds (`%OREB`, `%DREB`, `%REB`)** — `100P_X/T_X_on` for each rebound type. Different from percentage of _available_ rebounds.
- **Player share of team assists / turnovers / steals / blocks (`%AST`, `%TOV`, `%STL`, `%BLK`)** — `100P_X/T_X_on` for each event. `%AST` here is not Advanced AST%.
- **Player share of team blocks received / fouls / fouls drawn (`%BLKA`, `%PF`, `%PFD`)** — same team-share formula for the named event.
- **Player share of team points (`%PTS`)** — `100P_PTS/T_PTS_on`.

**Overlap:** 2PT, 3PT, and FT scoring form a partition. Paint, fast break, second chance, and off-turnover categories can overlap; do not sum their percentages to obtain 100%. Likewise, team-share denominators must match actual on-court intervals.

## 7. Shot location and shot-context statistics

**Retrieve:** NBA Shots/Tracking and shot-event PBP; BRef shooting is a historical alternative. Field inventory: [shot events](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/shotchartdetail.md), [tracked shot splits](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playerdashptshots.md).

For every bucket below, available or derivable measures include **FGM, FGA, FG%, 2PM, 2PA, 2P%, 3PM, 3PA, 3P%, eFG%, points, and attempt frequency**. Use the standard formulas restricted to that bucket. Frequency is `100×bucket FGA/all FGA in the reference sample`, unless a column explicitly uses only 2PA or 3PA as denominator. This rule defines each bucket-stat combination without inventing a distinct formula for every combination.

- **Restricted-area shooting** — attempts assigned to the restricted-area zone.
- **Paint non-restricted-area shooting** — paint attempts outside that zone.
- **Midrange shooting** — two-point attempts outside the paint under the source's zone map.
- **Left-corner / right-corner / combined-corner threes** — threes by corner zone. Combine counts before calculating a combined percentage.
- **Above-the-break threes** — three-point attempts outside the corner zones.
- **Backcourt shots / heaves** — source-classified long/backcourt attempts. A heave's distance/time cutoff is provider-specific; do not remove them without documenting a rule.
- **Distance-band shooting** — e.g. 0–3, 3–10, 10–16 feet, 16 feet to the arc on BRef, or NBA-specific bins. These different zone systems are not interchangeable.
- **Shot distance (`SHOT_DISTANCE`) / average shot distance** — recorded distance from the basket; average = sum of shot distances divided by measured attempts. Units and rounding depend on feed.
- **Shot coordinates (`LOC_X`, `LOC_Y`, live `x`, `y`, `xLegacy`, `yLegacy`)** — recorded location, not a performance rating. Preserve coordinate system, units, origin, and orientation. Legacy shot-chart units and live normalized values must not be mixed.
- **Shot action/type** — jump shot, layup, dunk, hook, tip, fadeaway, stepback, turnaround, floater, alley-oop, etc. Use event classifications; types may overlap or have detailed subtypes.
- **Dunks made / attempted / dunk percentage** — count dunk events; `100dunks_made/dunk_attempts` for accuracy. BRef's dunk attempt share instead divides attempts by all FGA; distinguish the two.
- **Layup / hook / tip-in accuracy** — corresponding made/attempted shot counts and percentages.
- **Catch-and-shoot shooting** — classified catch-and-shoot jumpers; a ball-receipt-to-shot context, not simply all assisted shots. NBA Tracking `CatchShoot`.
- **Pull-up shooting** — classified jumpers after dribbling. NBA Tracking `PullUpShot`; not all unassisted shots are pull-ups.
- **Drives versus shooting off a drive** — drive events and their shot outcomes are distinct denominators; see section 8.
- **Closest-defender-distance shooting** — buckets commonly labeled very tight (0–2 ft), tight (2–4), open (4–6), and wide open (6+). Keep exact returned interval labels. Nearest defender distance is not a comprehensive measure of defensive quality.
- **Contested / uncontested shooting** — source-classified contested and uncontested makes/attempts and percentages. A tracking proximity classification need not equal a hustle shot contest.
- **Dribble-count shooting** — shots grouped by dribbles before release, e.g. zero, one, two, 3–6, 7+; use returned bins.
- **Touch-time shooting** — shots grouped by duration of the preceding touch, e.g. under two seconds, two to six, over six; preserve boundaries from the source.
- **Shot-clock shooting** — attempts grouped by remaining shot-clock time. This is different from period/game clock; preserve shot-clock-off/unknown buckets.
- **Assisted versus unassisted shooting** — conventional assisted share classifies _made_ baskets. An assist does not exist on a miss; pass-to-shot datasets are needed for assisted-opportunity accuracy.
- **Shot quality / expected shooting / shooting over expected** — model-based, not determined by coordinates alone. See section 15 for the NBA model and section 18 for vendor alternatives.
- **Zone relative FG% / zone points above average** — derive `player_zone_FG%-league_zone_FG%`; expected field-goal points = `Σattempts_zone×league_zone_make_probability×shot_value`. Actual minus expected is a location-only residual, not full tracking-adjusted shot quality.

## 8. Player tracking

**Retrieve all subsections:** NBA Tracking with the stated `PtMeasureType`, plus game `boxscoreplayertrackv3` where supplied. [Tracking endpoint](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashptstats.md), [game tracking fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoreplayertrackv3.md). These are processed optical-tracking results, not reconstructions from ordinary boxes. Preserve tracked games/minutes as exposure.

### 8.1 Speed and distance (`SpeedDistance`)

- **Distance traveled (`DIST_FEET`, `DIST_MILES`)** — length of the tracked movement path; conceptually `Σdistance(position_t, position_t+1)`. Raw positions/smoothing are needed to reproduce exactly.
- **Offensive / defensive distance (`DIST_MILES_OFF`, `DIST_MILES_DEF`)** — tracked movement restricted to each phase.
- **Average speed (`AVG_SPEED`)** — tracked distance divided by tracked active time, with unit conversion and provider exclusions.
- **Offensive / defensive average speed (`AVG_SPEED_OFF`, `AVG_SPEED_DEF`)** — respective distance divided by respective tracked time. Do not average the two speeds without time weighting.
- **Distance per game / minute** — distance divided by tracked GP/MP. Derived; do not divide by untracked games.

### 8.2 Touches and ball possession (`Possessions`)

- **Touches (`TOUCHES`)** — classified occasions controlling the ball. Count; multiple touches can occur in one team possession.
- **Frontcourt touches (`FRONT_CT_TOUCHES`)** — touches classified in the attacking half.
- **Time of possession (`TIME_OF_POSS`)** — total time controlling the ball. Tracking measurement, distinct from team possession count.
- **Average seconds per touch (`AVG_SEC_PER_TOUCH`)** — ball-control seconds/touches.
- **Average dribbles per touch (`AVG_DRIB_PER_TOUCH`)** — recorded dribbles/touches.
- **Points per touch (`PTS_PER_TOUCH`)** — player points/touches using the dashboard's matching scoring and touch sample. A workload-efficiency ratio, not PPP.
- **Elbow touches / post touches / paint touches** — touches in provider-defined elbow, post, and interior paint situations. These contextual definitions can overlap and are not inferred reliably from final shot location.

### 8.3 Drives (`Drives`)

A drive starts at least 20 feet away, reaches within 10 feet, includes a dribble, and excludes fast breaks. [NBA definition](https://www.nba.com/stats/help/glossary).

- **Drives (`DRIVES`)** — count classified drive events.
- **Drive FGM / FGA / FG%** — makes, attempts, and `100drive_FGM/drive_FGA` on drive shots.
- **Drive FTM / FTA / FT%** — corresponding drive-attributed free throws and `100drive_FTM/drive_FTA`.
- **Drive points (`DRIVE_PTS`)** — own scoring credited to drives; sum provider-attributed shot/free-throw points.
- **Drive points percentage (`DRIVE_PTS_PCT`)** — dashboard scoring per drive, `100drive_PTS/drives`; this is points normalized by events, not a probability of scoring, and can exceed 100%.
- **Drive passes (`DRIVE_PASSES`) / pass percentage** — pass outcomes and `100drive_passes/drives`.
- **Drive assists (`DRIVE_AST`) / assist percentage** — credited assists from drives and `100drive_AST/drives`. Different from overall AST%.
- **Drive turnovers (`DRIVE_TOV`) / turnover percentage** — turnovers on drives and `100drive_TOV/drives`.
- **Drive fouls (`DRIVE_PF`) / foul percentage** — fouls drawn in drive outcomes and `100drive_fouls/drives`; confirm the specific schema's attribution.
- **Drive points per drive** — `drive_PTS/drives`; derived, distinct from shot FG% and team points created by passes.

### 8.4 Passing and creation (`Passing`, `playerdashptpass`)

[Passing breakdown fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playerdashptpass.md).

- **Passes made / received** — tracked pass counts by direction.
- **Potential assists** — qualifying passes leading to shot attempts, including misses, under the provider's time/dribble rules. Event count; not every pass followed eventually by a shot.
- **Secondary assists (`SECONDARY_AST`)** — qualifying passes to the player who then assists; often called hockey assists. Count under tracking rules.
- **Free-throw assists (`FT_AST`)** — qualifying passes leading to a teammate's shooting foul/free-throw outcome. Count under tracking rules; not an official box-score assist.
- **Assist points created (`AST_PTS_CREATED`)** — scoring value credited to assisted outcomes under the tracking method. Retrieve the published field; handling of free throws and and-ones must match the provider.
- **Adjusted assists (`AST_ADJ`)** — tracking combination of regular assists, secondary assists, and free-throw assists under the provider's definition; commonly `AST+SECONDARY_AST+FT_AST`.
- **Assists per pass / adjusted assists per pass** — `AST/passes` and `adjusted_AST/passes`; multiply by 100 when displayed as percentages. Use matching samples.
- **Potential-assist conversion rate** — `100AST/potential_assists`; derive and label explicitly. Scorer assists and tracking opportunity attribution can cause sample differences.
- **Pass-to teammate counts / pass-from teammate counts (`PASS`)** — directed passer-receiver edge counts.
- **Pass frequency (`FREQUENCY`)** — passes to/from a selected teammate divided by all eligible passes in the same direction, times 100.
- **Assists to/from a teammate** — credited assists on that passer-shooter relationship.
- **FGM/FGA/FG%, 2PM/2PA/2P%, 3PM/3PA/3P% after a pass** — outcomes of eligible pass-to-shot sequences, using standard made/attempted formulas. Do not confuse pass frequency with shot frequency.

### 8.5 Rebounding (`Rebounding`, `playerdashptreb`)

[Rebounding breakdown fields](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playerdashptreb.md).

- **Rebound chances / offensive chances / defensive chances** — tracking opportunities to collect an eligible miss, under provider proximity rules. More than one player can have a chance on one miss.
- **Rebound chance percentage** — `100rebounds/rebound_chances`; offensive/defensive versions use matching counts.
- **Deferred rebound chances** — tracked chances in which a player leaves the rebound to a teammate. Recorded classification.
- **Adjusted rebound chance percentage** — `100rebounds/(chances-deferred_chances)` where that is the provider's adjustment; preserve the published field when underlying deferrals are unavailable.
- **Contested rebounds (`C_REB`) / contested offensive (`C_OREB`) / contested defensive (`C_DREB`)** — rebounds with opponent contest under tracking criteria.
- **Uncontested rebounds (`UC_REB`) / offensive (`UC_OREB`) / defensive (`UC_DREB`)** — corresponding rebounds without a qualifying contest.
- **Contested / uncontested rebound percentage** — `100C_REB/REB`, `100UC_REB/REB`; not chance-conversion rate.
- **Average rebound distance** — mean basket distance at the rebound event; measured, not original shot distance.
- **Rebound frequency (`REB_FREQUENCY`) by bucket** — `100bucket_REB/all_REB` for the selected breakdown.
- **Rebounds by number of contesting players** — counts split by tracked opponent contest count.
- **Rebounds by rebound distance / original shot distance / shot type** — counts/rates grouped by each separate dimension.

### 8.6 Elbow, post, and paint outcomes (`ElbowTouch`, `PostTouch`, `PaintTouch`)

Each named touch category has its own **touch count, FGM, FGA, FG%, FTM, FTA, FT%, points, points per touch, passes, pass%, assists, assist%, turnovers, turnover%, and fouls drawn/foul%**, where returned by that view. They inherit the definitions below; these are separate fields for elbow, post, and paint, not one combined measure.

- **Touch-category shot/FT counts and accuracy** — count attributed outcomes; percentage = `100makes/attempts`.
- **Touch-category points / points per touch** — scoring credited to that touch type; `points/touches`.
- **Touch-category scoring percentage** — if the field normalizes points by touches, `100points/touches`; do not interpret it as probability of a scoring possession.
- **Touch-category pass / assist / turnover / foul counts** — corresponding outcomes from the touch type.
- **Touch-category pass% / assist% / turnover% / foul%** — `100outcome_count/touch_count`, unless the source explicitly specifies a different denominator. Rates can overlap; they need not sum to 100%.

### 8.7 Tracking scoring efficiency (`Efficiency`, `CatchShoot`, `PullUpShot`)

- **Catch-and-shoot points / FGM / FGA / FG% / 3PM / 3PA / 3P% / eFG%** — standard counts/formulas restricted to this classification.
- **Pull-up points / FGM / FGA / FG% / 3PM / 3PA / 3P% / eFG%** — same for pull-ups.
- **Drive / paint-touch / post-touch / elbow-touch scoring totals and efficiency** — category scoring fields supplied together by the efficiency dashboard. Their classifications overlap; do not add them as disjoint scoring components.

## 9. Hustle and box outs

**Retrieve:** NBA Hustle/Game. Fields verified against [player hustle](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguehustlestatsplayer.md) and [team hustle](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguehustlestatsteam.md). These are tagged actions, so they cannot be computed from basic box scores.

- **Deflections (`DEFLECTIONS`)** — credited disruptions/touches of the opponent's ball movement; a deflection need not produce a steal. Count.
- **Charges drawn (`CHARGES_DRAWN`)** — offensive charging fouls drawn. Count; not all offensive fouls are charges.
- **Screen assists (`SCREEN_ASSISTS`)** — screens credited with directly helping a teammate make a field goal. Count; separate from passing assists.
- **Screen-assist points (`SCREEN_AST_PTS`)** — points from those credited baskets, using each basket's two-/three-point value.
- **Contested shots (`CONTESTED_SHOTS`)** — recorded defensive shot challenges. Count; not identical to all shots with a nearby defender.
- **Contested two-point / three-point shots (`CONTESTED_SHOTS_2PT`, `CONTESTED_SHOTS_3PT`)** — contests split by shot value. For an exhaustive consistent split, total = two-point + three-point contests.
- **Loose balls recovered (`LOOSE_BALLS_RECOVERED`)** — recoveries of classified loose-ball situations.
- **Offensive / defensive loose-ball recoveries (`OFF_LOOSE_BALLS_RECOVERED`, `DEF_LOOSE_BALLS_RECOVERED`)** — recoveries in each phase; total is their sum.
- **Offensive / defensive share of loose-ball recoveries** — `100offensive_recoveries/all_recoveries` and the defensive equivalent. These describe the distribution, not the fraction of all loose balls won.
- **Box outs (`BOX_OUTS`)** — actions establishing rebounding position against opponents; count.
- **Offensive / defensive box outs (`OFF_BOXOUTS`, `DEF_BOXOUTS`)** — phase-specific counts; total = their sum for a consistent classification.
- **Offensive / defensive share of box outs (`PCT_BOX_OUTS_OFF`, `PCT_BOX_OUTS_DEF`)** — `100phase_boxouts/all_boxouts`.
- **Box outs leading to a team rebound (`BOX_OUT_PLAYER_TEAM_REBS`)** — qualifying box-out events on which the player's team secures the rebound. Count.
- **Box outs leading to the player's own rebound (`BOX_OUT_PLAYER_REBS`)** — corresponding events ending in that player's rebound. Count.
- **Team rebound percentage after box outs (`PCT_BOX_OUTS_TEAM_REB`)** — `100team_rebounds_after_boxouts/eligible_boxouts` with the provider's event counting.
- **Player rebound percentage after box outs (`PCT_BOX_OUTS_REB`)** — `100player_rebounds_after_boxouts/eligible_boxouts`. It is not ordinary rebound percentage or rebound-chance percentage.

Multiple defenders can contest one attempt or multiple players can box out on one miss; naive team sums can therefore differ from distinct shot/rebound-event counts.

## 10. Defense and individual matchups

**Retrieve:** NBA Defending/Matchups/Defense, tracking `Defense`, and NBA Game. [Shot-defense schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashptdefend.md), [matchup schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leagueseasonmatchups.md), [defensive box schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoredefensivev2.md), [position rollup](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/matchupsrollup.md).

### 10.1 Defended shots

- **Defended field goals made (`D_FGM`) / attempted (`D_FGA`)** — opponent makes/attempts attributed to the defender by the tracking assignment. Counts.
- **Defended FG% (`D_FG_PCT`, `DFG%`)** — `100D_FGM/D_FGA`; lower is generally better.
- **Normal opponent FG% (`NORMAL_FG_PCT`)** — the dashboard's baseline for the matched shooters and shot category. Retrieve it; an unweighted mean of opponent season FG% need not reproduce it.
- **Defended FG differential (`PCT_PLUSMINUS`, `DIFF%`)** — defended FG% minus the dashboard baseline, in percentage points. Negative indicates lower shooting against the defender.
- **Defended-shot frequency (`FREQ`)** — category defended attempts/all defended attempts in the dashboard sample, times 100.
- **Defended 2P% / 3P% / distance-category FG%** — the same calculation on the named defended-shot subset. Common defensive dashboard categories include twos, threes, under six feet, under ten feet, and over fifteen feet; these overlap.
- **Rim defended makes / attempts / FG%** — tracking-attributed at-rim shots and `100rim_makes/rim_attempts`. Game tracking fields include `defendedAtRimFieldGoalsMade`, `...Attempted`, `...Percentage`.
- **Opponent FGM/FGA/FG%, 3PM/3PA/3P%, FTM/FTA/FT%, OREB/DREB/REB, AST/TOV/STL/BLK/PF/PTS** — the full **Opponent** family of basic stats with the opposing side as subject. Apply standard formulas. On a player dashboard, these can be team results during the player's court time, not individual matchup concessions.

### 10.2 Matchup assignment

- **Matchup minutes (`MATCHUP_MIN`, `matchupMinutes`)** — tracking time assigned to an offensive-defensive player pair; sum measured assignment duration.
- **Partial possessions (`PARTIAL_POSS`, `partialPossessions`)** — fractional possession exposure assigned across defenders as matchups change. Sum provider allocations, not a count of whole team possessions.
- **Matchup share of time (`PERCENT_OF_TIME`)** — `100pair_or_category_matchup_time/total_eligible_matchup_time`.
- **Switches onto a player (`switchesOn`)** — tracked assignment changes onto an offensive player. Count; not inferable from substitutions.
- **Matchup player points (`PLAYER_PTS`, `playerPoints`)** — points credited to the offensive player while assigned to that defender under the provider's attribution rules.
- **Matchup team points (`TEAM_PTS`)** — team scoring during the matchup sample. Not the same as the matched player's scoring.
- **Matchup FGM / FGA / FG%** — assigned opponent's shot counts and `100matchup_FGM/matchup_FGA`.
- **Matchup 3PM / 3PA / 3P%** — corresponding three-point outcomes and percentage.
- **Matchup FTM / FTA** — free throws assigned to the pairing. Accuracy can be derived where both counts are available.
- **Matchup assists (`MATCHUP_AST`)** — assists by the matched offensive player under the assignment.
- **Matchup turnovers (`MATCHUP_TOV`)** — turnovers attributed to the matched offensive player; not necessarily steals by the assigned defender.
- **Matchup blocks (`MATCHUP_BLK`)** — blocks credited in the matchup.
- **Help blocks (`HELP_BLK`)** — blocks classified as help defense. Separate from directly assigned matchup blocks.
- **Help-defense FGM / FGA / FG% (`HELP_FGM`, `HELP_FGA`, `HELP_FG_PERC`)** — shot outcomes in help situations; `100help_FGM/help_FGA`.
- **Shooting fouls (`SFL`)** — shooting fouls attributed within the matchup. Count.
- **Position matchup distribution** — time/partial possessions against guard, forward, center or source-specific positions; percentage = category exposure/total exposure ×100.
- **Points per matchup possession** — `matchup_player_points/partial_possessions` if deliberately defined; label it derived. It is not a clean standalone defensive rating because help, switches, and shared attribution affect both terms.

Defender assignment is a measurement convention. Small-sample DFG% includes shooter quality, help, scheme, shot mix, and shooting variation; it is not a causal estimate of all defense.

## 11. Play types

**Retrieve every play type and output below:** NBA Play Types, endpoint `synergyplaytypes`; richer breakdowns through licensed Synergy. [Schema and parameters](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/synergyplaytypes.md). Classification is supplied by the vendor, not uniquely recoverable from the basic PBP description.

### 11.1 Possession categories

- **Isolation (`Isolation`)** — offensive player attacks an individual defender in an isolation action.
- **Transition (`Transition`)** — offense attacks before the defense is set. Not necessarily identical to official fast-break points.
- **Pick-and-roll ball handler (`PRBallHandler`)** — the ball handler finishes a classified ball-screen action.
- **Pick-and-roll roll man (`PRRollman`)** — the screener finishes after rolling, slipping, or popping according to the vendor classification.
- **Post-up (`Postup`)** — possession finished from a post-up action.
- **Spot-up (`Spotup`)** — action initiated from a spot-up opportunity, potentially including a drive; not synonymous with catch-and-shoot jumpers.
- **Handoff (`Handoff`)** — possession finished through a handoff action.
- **Cut (`Cut`)** — off-ball movement toward a scoring opportunity finishes the play.
- **Off screen (`OffScreen`)** — action using an off-ball screen to create the finishing opportunity.
- **Putback (`OffRebound`)** — immediate offensive-rebound follow-up action; not all second-chance scoring.
- **Miscellaneous (`Misc`)** — tagged finishes outside the principal categories.

Each type has offensive and, where available, defensive views for players and teams. Counts apply to tagged play endings, not every action within a possession. A ball-handler pass leading to a teammate's spot-up may be assigned to the finishing type rather than the original ball-screen creator.

### 11.2 Statistics within every type

- **Possessions (`POSS`)** — number of classified finished plays/possessions under Synergy's accounting.
- **Possession frequency (`POSS_PCT`)** — `100type_possessions/all_classified_possessions` for the subject and side.
- **Points (`PTS`)** — points attributed to those plays, including their assigned free-throw outcomes.
- **Points per possession (`PPP`)** — `PTS/POSS`.
- **FGM / FGA / missed FGs (`FGMX`)** — recorded shots in the category; `FGMX=FGA-FGM`.
- **FG% (`FG_PCT`)** — `100FGM/FGA`.
- **eFG% (`EFG_PCT`)** — `100(FGM+0.5×3PM)/FGA`; if 3PM is absent from the public result, import the supplied eFG% rather than pretending to fully recalculate it.
- **Free-throw possession percentage (`FT_POSS_PCT`)** — `100possessions_with_FT_outcome/POSS`.
- **Turnover possession percentage (`TOV_POSS_PCT`)** — `100turnover_possessions/POSS`.
- **Shooting-foul possession percentage (`SF_POSS_PCT`)** — `100shooting_foul_possessions/POSS`.
- **And-one percentage (`PLUSONE_POSS_PCT`)** — `100and_one_possessions/POSS`.
- **Score frequency (`SCORE_POSS_PCT`)** — `100possessions_with_any_points/POSS`. Unlike PPP, this is a scoring-outcome frequency.
- **PPP percentile (`PERCENTILE`)** — location in the provider's comparison distribution. Import it with sample restrictions; no unique formula exists without the ranking population and tie rule. Defensive ranking direction may be inverted.
- **Possessions / points per game** — corresponding totals divided by the view's GP, not necessarily every team game if tracking coverage differs.

Foul, free-throw, and and-one categories overlap. Do not sum their percentages as if they partition possessions.

## 12. Lineups, on-off, clutch, and situational splits

**Retrieve:** NBA Lineups/On-Off/Clutch; PBP Stats; derived possession and stint data. [Lineup endpoint](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashlineups.md), [on-off endpoint](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/teamplayeronoffdetails.md), [clutch endpoint](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerclutch.md), [PBP Stats API](https://api.pbpstats.com/docs).

- **Lineup minutes / possessions / games** — time and possessions with a specified group together, plus distinct games in which it appears.
- **Five-man lineup counts, shooting, rates, and ratings** — every applicable team statistic restricted to the five-player unit. Standard formulas, using unit exposure.
- **Two-/three-/four-player combination statistics** — restrict to stints containing all group members, irrespective of remaining teammates. Combinations overlap; summing their minutes overcounts team minutes.
- **On-court offensive / defensive / net rating** — team rates with the selected player on court.
- **Off-court offensive / defensive / net rating** — team rates with that player off court. Specify games included: only games the player played versus all team games changes the result.
- **Offensive on-off differential** — `ORtg_on-ORtg_off`; positive indicates better team scoring with the player.
- **Defensive on-off differential** — `DRtg_on-DRtg_off`; negative indicates fewer points allowed on court. Some sites reverse this sign to make positive mean better defense.
- **Net on-off differential** — `NetRtg_on-NetRtg_off`. Descriptive, without automatic adjustment for teammate/opponent strength.
- **On-off statistical differential** — apply the same subtraction to rebounding rate, turnover rate, shot frequency, etc. Percentage differences use percentage points.
- **With-or-without-you (`WOWY`)** — compare outcomes with selected player combinations present/absent. Restrict stints first, then recompute rates; not simply subtract season averages.
- **Clutch minutes / possessions / PTS / shooting / AST / TOV / ratings / wins-losses** — standard stats restricted to the chosen clutch definition. NBA's familiar default is the final five minutes of the fourth quarter or overtime with the score within five points; the endpoint permits alternate settings. Record the actual settings.
- **Last-minute / last-two-minute / final-shot statistics** — distinct time/score filters; do not present as the same sample as default clutch.
- **Garbage-time-filtered statistics** — exclude possessions under a stated time/score/win-probability rule. No universal cutoff. Retrieve a provider's filtered table or derive using a published rule.
- **Quarter / half / overtime splits** — same metrics restricted to the chosen period.
- **Home/away / opponent / conference / division / win/loss splits** — same calculations on matching games.
- **Starter/bench splits** — classify by game starting status, not permanently by player.
- **Month / date range / last N games / pre-/post-All-Star / rest-day splits** — standard metrics on that sample. Last N _player appearances_ and last N _team games_ are different.
- **Regular season / postseason / play-in / preseason / All-Star / NBA Cup splits** — preserve game-type identity. Avoid treating all these as ordinary regular-season competition.
- **Career / season / rolling-window / opponent-career totals** — aggregations with explicit date and team scope. For traded players, do not sum an all-team total row together with its team splits.

## 13. Team strength, standings, and game flow

**Retrieve:** NBA Standings/Base/Live/PBP; BRef team tables; model publisher for ratings. [Standings schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguestandingsv3.md), [live game schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/boxscore.md), [BRef glossary](https://www.basketball-reference.com/about/glossary.html), [historical Elo data](https://github.com/fivethirtyeight/data/tree/master/nba-elo).

- **Games behind (`GB`)** — `[(leader_W-team_W)+(team_L-leader_L)]/2` against the stated reference leader. Can be a half-game.
- **Conference / division rank, playoff seed** — ordinal position under the season's competition/tiebreak rules; not determined by win% alone.
- **Home / road / conference / division / last-ten records** — W/L counts and win% in each sample.
- **Win streak / loss streak** — consecutive results ending at the selected date; count in reverse until the outcome changes.
- **Points for / against (`PF`, `PA` in standings)** — team and opponent scoring totals. Here PF means points for, not personal fouls; preserve namespace.
- **Point differential** — `team_PTS-opponent_PTS`; season total or per game as labeled.
- **Margin of victory (`MOV`)** — `(team_PTS-opponent_PTS)/GP`, including losses as negative margins.
- **Strength of schedule (`SOS`)** — opponent-quality estimate. In SRS, average opponent SRS over the games played; other providers may use win% or different ratings.
- **Simple Rating System (`SRS`)** — `SRS_i=MOV_i+average_opponent_SRS_i`, solved jointly with a league-centering constraint. Units: points per game above average. Retrieve BRef or solve from game margins; not pace-adjusted unless explicitly modified.
- **Pythagorean winning percentage / wins** — `PF^x/(PF^x+PA^x)`; expected wins = that probability ×GP. BRef glossary uses `x=14` for NBA; alternative exponents define different models.
- **Pythagorean losses** — `GP-expected_wins`.
- **Win residual / luck estimate** — `actual_W-expected_W` under a stated model. A residual is not proof that the difference was entirely luck.
- **Elo rating** — sequential team-strength estimate. Basic update `R_new=R_old+K×(result-expected_result)`, with `expected_A=1/[1+10^((R_B-R_A-H)/400)]` in a common convention. Home advantage H, K, margin multiplier, and offseason regression are model choices; this skeleton does not reproduce all FiveThirtyEight adjustments.
- **Adjusted offensive / defensive / net rating** — estimates controlling for opponent, venue, schedule, and possibly lineup availability. Model-specific regression, not a single NBA-standard formula.
- **Win probability (`WP`)** — model probability of eventually winning from current game state. Inputs commonly include time, score, possession, and prior strength; use the named model.
- **Win probability added (`WPA`)** — `WP_after-WP_before`; cumulative sum over credited events. Attribution to individuals is model-specific.
- **Largest lead (`biggestLead`)** — maximum own-team scoring margin at any point.
- **Largest scoring run (`biggestScoringRun`)** — maximum unanswered scoring sequence under the source's convention.
- **Lead changes (`leadChanges`)** — number of changes in which team leads; tie transitions need a stated counting rule.
- **Times tied (`timesTied`)** — count of equal-score states/events under the provider rule.
- **Time leading / tied / trailing** — sum elapsed clock intervals in each score state. Do not double-count time elapsed while the game clock is stopped.
- **Quarter / half / overtime scores** — scoring sums within each period.
- **Attendance / game duration** — recorded crowd and elapsed real-world game time; no basketball-performance formula.

## 14. Composite and impact metrics

These answer different questions: box-score production, retrospective impact, future ability, or accumulated value. Equal units do not make their values interchangeable. Retrieval and methodology are stated for each metric.

### 14.1 Transparent box-score composites

- **Efficiency (`EFF`)** — simple counting composite: `PTS+REB+AST+STL+BLK-(FGA-FGM)-(FTA-FTM)-TOV`. Derive from boxes. It is not PER and has no universal pace/opponent adjustment.
- **Game Score (`GmSc`)** — Hollinger single-game production: `PTS+0.4FGM-0.7FGA-0.4(FTA-FTM)+0.7OREB+0.3DREB+STL+0.7AST+0.7BLK-0.4PF-TOV`. Retrieve BRef game logs or calculate. [BRef glossary](https://www.basketball-reference.com/about/glossary.html).
- **Player Impact Estimate (`PIE`)** — share of a game box-score contribution total. Define `C=PTS+FGM+FTM-FGA-FTA+DREB+0.5OREB+AST+STL+0.5BLK-PF-TOV`; then `PIE=100×C_player/C_both_teams`. Retrieve NBA Advanced (`PIE`) or compute with all game inputs. Use the provider's aggregation across games; do not substitute the player's on-court sample for whole-game totals. [NBA field](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoreadvancedv3.md).
- **Player Efficiency Rating (`PER`)** — pace-adjusted per-minute box production, normalized to league average 15. Retrieve BRef. The modern calculation is below; historical missing-stat adjustments must follow [BRef's PER method](https://www.basketball-reference.com/about/per.html).

Using all shooting variables as counts, set `a=T_AST/T_FGM`, `d=(L_REB-L_OREB)/L_REB`, `v=L_PTS/(L_FGA-L_OREB+L_TOV+0.44L_FTA)`, and `f=2/3-0.25×(L_AST/L_FGM)×(L_FTM/L_FGM)`:

```text
uPER = [3PM + (2/3)AST + (2-f*a)FGM
        + 0.5FTM*(2-a/3)
        - v*TOV - v*d*(FGA-FGM)
        - v*0.44*(0.44+0.56d)*(FTA-FTM)
        + v*(1-d)*DREB + v*d*OREB
        + v*STL + v*d*BLK
        - PF*(L_FTM/L_PF - 0.44*(L_FTA/L_PF)*v)] / MP
aPER = uPER * L_Pace/T_Pace
PER  = 15*aPER / minute_weighted_league_mean(aPER)
```

This formula's `d` is a league rebound fraction, not the player's DRB%. Early seasons require estimates for statistics that were not recorded.

### 14.2 Win Shares and box plus-minus

- **Offensive Win Shares (`OWS`)** — estimated offensive wins: `(PProd-0.92×L_PPP×TotPoss)/MPW`.
- **Defensive Win Shares (`DWS`)** — estimated defensive wins: `[(P_MP/T_MP)×T_POSS×(1.08×L_PPP-P_DRtg/100)]/MPW`.
- **Win Shares (`WS`)** — `OWS+DWS`.
- **Win Shares per 48 (`WS/48`)** — `48WS/MP`.

For these expressions, `MPW=0.32×league_points_per_team_game×(T_Pace/L_Pace)`, `L_PPP` is league points per possession, and `PProd`, `TotPoss`, and individual `P_DRtg` come from Oliver's multistage calculations. `T_MP` is summed player minutes, as defined in section 1. Retrieve BRef advanced tables and use its [Win Shares method](https://www.basketball-reference.com/about/ws.html) for era adjustments. WS is an allocation estimate; it need not sum exactly to actual team wins and is not wins above replacement.

- **Box Plus/Minus (`BPM`, version 2)** — box-score model of contribution in points per 100 possessions relative to average. General calculation: `raw_BPM=Σcoefficient(position,role)×adjusted_box_rate + position/role adjustments`; apply the team adjustment specified by the model. The position/role estimates, coefficient tables, scoring adjustments, and team reconciliation are integral parts of the formula. Retrieve BRef; use the complete [BPM 2 method](https://www.basketball-reference.com/about/bpm2.html) for implementation. A one-line unweighted box sum cannot reproduce it.
- **Offensive BPM (`OBPM`)** — offense-specific fitted box model with its own coefficients and adjustments; retrieve BRef.
- **Defensive BPM (`DBPM`)** — `BPM-OBPM`; not a direct observed count of defensive stops.
- **Value Over Replacement Player (`VORP`)** — `(BPM+2.0)×share_of_team_possessions_played×(team_games/82)` in BRef's formulation. Court-time share is often used as an approximation to possession share. Replacement baseline is -2.0 BPM. Retrieve BRef; match its exposure convention and handling of traded players.

The linked BPM article contains the full coefficient specification; this catalog states the calculation structure and VORP identity rather than reproducing all fitted tables.

### 14.3 Adjusted plus-minus model family

**Retrieve:** a named model publisher, historical research release, or calculate from validated lineup/possession data. [Original APM discussion](https://www.82games.com/comm30.htm), [EPM's description of RAPM](https://dunksandthrees.com/about/epm). A metric called RAPM is not guaranteed to match another publisher's RAPM.

- **Adjusted Plus-Minus (`APM`)** — regression adjusting stint outcomes for all players on court. General fit: minimize `Σ_s w_s(y_s-X_sβ)^2`. `y_s` is scoring margin per 100 possessions, `w_s` possession weight, and X encodes players and optional context. Identification constraints are required.
- **Regularized Adjusted Plus-Minus (`RAPM`)** — add shrinkage: minimize `Σ_s w_s(y_s-X_sβ)^2 + λΣ_j(β_j-μ_j)^2`. With ridge assumptions, `β=(X'WX+λI)^(-1)(X'Wy+λμ)` for the penalized coefficient block. Handle the intercept separately. λ, prior μ, stint construction, seasons, and recency weights define the implementation.
- **Offensive RAPM / defensive RAPM (`ORAPM`, `DRAPM`)** — separate offensive and defensive player coefficients. Under the common positive-is-good convention, total = offense + defense; verify signs.
- **Non-prior-informed RAPM (`NPI RAPM`)** — shrinks toward a generic baseline, commonly zero, rather than a box-score-informed prior.
- **Prior-informed RAPM / xRAPM family** — uses player-specific priors or extra information. Not one fixed formula beyond the regularized model structure; specify publisher/version.
- **Luck-adjusted RAPM / on-off** — adjusts outcomes for selected unstable components before or during fitting. The adjustment and its assumptions are publisher-specific, not just a universally corrected plus-minus.
- **Statistical Plus-Minus (`SPM`)** — fitted function `β0+Σβk×stat_k` or another model predicting impact from statistical features. It is a family, not a universal set of coefficients.

### 14.4 Current publisher-specific models

**EPM family — retrieve [Dunks & Threes](https://dunksandthrees.com/epm), [methodology/API information](https://dunksandthrees.com/about/epm).**

- **Estimated Plus-Minus (`EPM`)** — impact per 100 possessions from RAPM with an estimated-skill statistical prior. Full fitted parameters/input pipeline are not provided here.
- **Offensive / defensive EPM** — components; total is their sum under the publisher's sign convention.
- **Expected EPM** — dated forecast of player impact.
- **Actual EPM** — season assessment from games played. Different target from Expected EPM.
- **Estimated Skills** — model estimates of underlying shooting, usage, turnovers, and other skills; not raw season averages.
- **Estimated Game Production (`EGP`)** — weighted single-game box production, measured in scoring-margin points; use the publisher's fitted weights and seasonal scaling.
- **Estimated wins / wins above replacement, where exposed** — accumulated value after exposure and baseline conversion; require the specific product's conversion, not a generic EPM multiplier.

**LEBRON family — retrieve [BBall Index](https://www.bball-index.com/lebron-database/), [methodology](https://www.bball-index.com/lebron-introduction/).**

- **LEBRON** — impact per 100 possessions using a stabilized, role-informed box prior and luck-adjusted regularized on-off data. Model; no complete scalar box-score formula.
- **O-LEBRON / D-LEBRON** — offensive and defensive components; total = their sum.
- **BoxLEBRON** — box-prior component before the full on-off calculation.
- **LEBRON Wins Added** — playing-time-sensitive conversion to cumulative wins; use the publisher's baseline/conversion rather than assuming WS or VORP equivalence.

**DARKO family — retrieve [DARKO](https://www.darko.app/), [methodology](https://www.darko.app/about).**

- **Daily Plus Minus (`DPM`)** — next-game projected impact in points per 100 possessions; zero is average.
- **Offensive / defensive DPM (`O-DPM`, `D-DPM`)** — components; higher is better for both.
- **Box DPM / On-Off DPM** — box-projection and on-off-based estimates feeding the system.
- **DARKO skill projections** — dated forecasts of individual box-score rates/percentages, with learned recency weighting and regression.
- **Projected minutes** — forecast minutes when playing, not guaranteed availability.
- **DARKO RAPM / WOWY RAPM** — separately published fitted impact estimates; the latter uses with-or-without information. Preserve source/version rather than equating them with DPM.
- **Fair salary / surplus value** — publisher conversion from projected contribution and minutes to financial value; surplus = modeled fair salary minus actual salary. Model-dependent, not a contract appraisal formula.

### 14.5 Historical or less consistently accessible models

- **RAPTOR** — FiveThirtyEight impact model combining box/tracking and on-off components. **Offensive, defensive, total, box-only, and on-off RAPTOR** are distinct outputs; total offensive + defensive components use a positive-is-good convention. Retrieve [archived CSVs and definitions](https://github.com/fivethirtyeight/data/tree/master/nba-raptor). Historical eras use different available inputs, so they are not one homogeneous tracking dataset.
- **RAPTOR WAR** — accumulated wins above replacement derived from RAPTOR and exposure. Use archived published values/methodology; not BRef WS.
- **Real Plus-Minus (`RPM`, `ORPM`, `DRPM`, RPM Wins)** — ESPN's historical adjusted-impact product. Model details were not fully public; treat access as archival/unconfirmed for current seasons. Historical route: [ESPN RPM](https://www.espn.com/nba/statistics/rpm); [BBall Index's model comparison](https://www.bball-index.com/lebron-introduction/) discusses its limited transparency.
- **Player Impact Plus-Minus (`PIPM`, `O-PIPM`, `D-PIPM`)** — box production plus luck-adjusted on-off model. [Creator methodology and coefficients](https://www.bball-index.com/player-impact-plus-minus/) provide the historical specification. No dependable current public refresh is assumed.
- **PIPM Wins Added** — cumulative PIPM-based value using minutes and the creator's replacement/Pythagorean conversion; retrieve historical releases.
- **Wins Above Replacement (`WAR`, `WARP`) / Wins Added / Estimated Wins** — a family, not one cross-provider statistic. General structure: accumulated contribution above a named baseline, converted from points to wins. Baseline, minutes/possessions, nonlinear win conversion, and season length must be specified. Retrieve the author of the particular field.

## 15. New NBA tracking models

Public retrieval is through NBA Inside the Game or its linked dashboards. Complete production model parameters, training data, and a stable supported public API were **not verified**. Conceptual formulas below must not be mistaken for a reimplementation of the NBA model. [AWS product overview](https://aws.amazon.com/sports/nba/).

- **Expected field-goal percentage / Shot Difficulty (`xFG%`)** — modeled make probability for an average player given tracking context. Retrieve [Shot Difficulty](https://www.nba.com/inside-the-game/player/shot-difficulty). Full model unavailable here.
- **Defensive Pressure** — tracking-derived measure of how tightly a player is guarded; proprietary calculation. Retrieve Inside the Game. [AWS overview](https://aws.amazon.com/sports/nba/).
- **Gravity** — defensive attention above what floor spacing predicts. Proprietary model; retrieve the [Gravity dashboard](https://www.nba.com/inside-the-game/player/gravity).
- **Leverage Score** — model-allocated contribution to changes in win probability. Retrieve [Leverage](https://www.nba.com/inside-the-game/player/leverage); full credit-allocation formula unavailable here.
- **Handle Score** — modeled effectiveness of dribbling through the defense. Full formula unavailable; retrieve [Handle Score](https://www.nba.com/inside-the-game/player/handle-score).
- **Zone Defense statistics** — team zone-defense analysis; retrieve [Zone Defense](https://www.nba.com/inside-the-game/team/zonedefense). Detailed model/schema was not exposed in the retrieved page.
- **Dunk Score** — tracking-based composite of a dunk's execution. Proprietary; retrieve [NBA Dunk Score](https://www.nba.com/stats/dunk-scores). [NBA introduction](https://www.nba.com/news/what-is-the-dunk-score).

For the newest component names and eligibility definitions, consult the [Inside the Game glossary](https://www.nba.com/news/inside-the-game-stat-glossary). The linked glossary supplies finer component-level labels; the model families above are verified, while their full production calculations remain unavailable here.

**Useful derived measures if shot probabilities are available:** these are mathematical constructions, not claims that a provider publishes every field under these names.

- **Mean expected FG%** — `100Σp_i/N`, where `p_i` is a per-shot make probability as a fraction.
- **FG percentage above expected** — `100×(FGM/N-Σp_i/N)`, in percentage points. A plus suffix can mean a _difference_ here, unlike BRef's ratio-based shooting indexes.
- **Expected field-goal points** — `Σv_i p_i`, with shot value `v_i` equal to 2 or 3.
- **Expected eFG%** — `100Σv_i p_i/(2N)`.
- **Field-goal points over expected** — `Σv_i(y_i-p_i)`, with make indicator `y_i` equal to 0 or 1.
- **Expected shooting on twos / threes / made shots / missed shots** — apply `100mean(p_i)` to the specified shot subset. These conditional samples answer different questions.
- **Most difficult made shot** — minimum modeled make probability among makes, if difficulty is defined as lower probability.

## 16. Play-by-play-derived statistics

**Retrieve:** NBA PBP, PBP Stats, shot feeds, or a commercial event feed; many below require calculation rather than a precomputed NBA table. [Action schema](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/playbyplay.md), [parser documentation](https://pbpstats.readthedocs.io/en/latest/pbpstats.html).

- **Live-ball / dead-ball turnovers** — turnovers after which the ball remains live versus play stops. Count classified events; do not equate all turnovers with steals.
- **Bad-pass / lost-ball / offensive-foul / traveling / shot-clock / out-of-bounds turnovers** — subtype counts from event tags. Categories depend on the feed's taxonomy.
- **Shooting / nonshooting / offensive / loose-ball / take / transition-take / clear-path / technical / flagrant fouls** — event subtype counts. Season-specific rules and tagging matter.
- **And-one opportunities / conversions** — made shots with an associated additional free throw; count opportunities and made awarded free throws. Conversion rate = `100converted/opportunities` under a stated nullified-attempt rule.
- **Two-shot / three-shot foul trips** — grouped eligible free-throw sequences; count trips, not individual attempts.
- **Free-throw trip rate** — `100qualifying_trips/possessions` or `/FGA`, explicitly labeled. It is not automatically `0.44FTA`.
- **Actual scoring attempts / possession-ending free-throw trips** — FGA plus qualified ending trips, with and-one and retained-ball exceptions explicitly handled. An event-based denominator can replace estimated TSA only if named as a different method.
- **Assisted two-point / three-point points (`assist points`)** — `2×assisted_twos+3×assisted_threes` attributed to the passer. This PBP construction does not automatically include tracking free-throw assists.
- **Assist networks** — passer-shooter pair counts, points, and shares. Sum edges by passer or receiver; PBP Stats exposes assist-network routes.
- **Unassisted rim / midrange / three-point makes** — unassisted made-shot counts restricted by zone. Use shot and assist tags together.
- **Blocked-shot recovery rate** — `100blocked_shots_recovered_by_defense/eligible_blocks`; distinguish defense recovery from blocks that merely go out of bounds.
- **Offensive rebound retention rate / second-chance PPP** — possession-chain outcomes after offensive rebounds. PPP = chain points/eligible second-chance sequences; document whether multiple rebounds restart a sequence.
- **Transition after steal / defensive rebound / made basket** — classify start reason and the provider's transition timing rule; report count, frequency, and points per event/possession.
- **Half-court frequency / half-court PPP** — qualified half-court possessions/all possessions and half-court points/half-court possessions. Classification is provider-specific; not universally the complement of official fast-break points.
- **Average offensive / defensive possession duration** — elapsed live game-clock seconds across eligible possessions divided by count. Free-throw and dead-ball handling must be explicit.
- **After-timeout (`ATO`) efficiency** — points/qualified possessions beginning after timeout. Define whether only the first possession or a broader sequence counts.
- **After-dead-ball / sideline-out-of-bounds / baseline-out-of-bounds efficiency** — points per tagged restart opportunity; reliable tagging may require licensed video data.
- **Jump balls won / lost / win%** — outcomes and `100won/(won+lost)`. Distinguish tip winner from the teammate recovering it.
- **Goaltending / basket interference / other violations** — classified event counts; credited points may belong to the shooter/team rather than the violator.
- **Substitutions / stints / rotation lengths** — event count, continuous lineup intervals, and elapsed stint duration. Reconstruct starters and substitution ordering carefully.
- **Timeouts taken / remaining** — recorded events and state; not a shooting/performance statistic.
- **Coach's challenges / successful challenges / success%** — `100successful/decided_challenges`; retrieve review events or official reports when tagged. Coverage is feed/season-dependent.
- **Buzzer-beaters / game winners / go-ahead shots** — derived shot/game outcomes. Define buzzer clock tolerance, final-score condition, and whether a later tie/lead change invalidates the label.
- **Scoring drought / longest run / lead-preserving possessions** — derive ordered game-state intervals with explicit start/end rules.

Event order corrections, replay reversals, team rebounds, technical free throws, and substitutions at the same clock can break naive parsers. Validate derived scores and minutes against official boxes before trusting these measures.

## 17. Player measurements and draft combine

**Retrieve:** NBA Bios/Combine/Draft endpoints and historical combine tables. [Combine field inventory](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/draftcombinestats.md). These are measurements or metadata, not estimates of on-court impact. Do not merge combine measurements from one date with current roster measurements without a date/source label.

- **Age (`AGE`)** — elapsed years since birth at the provider's reference date. Season-age conventions differ; a displayed integer may not be age on game day.
- **Date of birth / experience / draft year / round / pick** — recorded biography; experience is credited NBA seasons under the source convention, not age minus draft age.
- **Position** — roster label or model-estimated playing position. Categorical; NBA G/F/C labels differ from PG/SG/SF/PF/C and from tracking roles.
- **Height without shoes (`HEIGHT_WO_SHOES`)** — measured barefoot height, usually inches in combine data.
- **Height with shoes (`HEIGHT_W_SHOES`)** — separate measured height; do not treat it as barefoot height.
- **Weight (`WEIGHT`)** — measured/listed body mass, commonly pounds.
- **Wingspan (`WINGSPAN`)** — fingertip-to-fingertip span with arms extended.
- **Standing reach (`STANDING_REACH`)** — highest reach from standing without a jump.
- **Body-fat percentage (`BODY_FAT_PCT`)** — measured body-fat estimate from the testing method; no box-score formula.
- **Hand length (`HAND_LENGTH`) / hand width (`HAND_WIDTH`)** — combine hand dimensions, usually inches.
- **Standing vertical leap (`STANDING_VERTICAL_LEAP`)** — vertical jump displacement from a stationary start under test protocol.
- **Maximum vertical leap (`MAX_VERTICAL_LEAP`)** — maximum tested jump displacement with permitted approach.
- **Lane agility time (`LANE_AGILITY_TIME`)** — seconds to complete the prescribed agility course; lower is faster.
- **Modified lane agility / shuttle time (`MODIFIED_LANE_AGILITY_TIME`)** — a distinct test protocol and elapsed time; do not combine with lane agility.
- **Three-quarter-court sprint (`THREE_QUARTER_SPRINT`)** — measured sprint time; lower is faster.
- **Bench press (`BENCH_PRESS`)** — completed repetitions at the combine's prescribed load. Verify the year/protocol rather than treating rep counts across all tests as comparable.
- **Standing/max reach after jump, derived** — standing reach + corresponding measured vertical, when test definitions are compatible.
- **Wingspan-to-height / reach-to-height ratios** — respective measurements divided by height in the same units; analyst-derived proportions.
- **Spot-up shooting: 15-foot, college three, NBA three** — test makes/attempts/accuracy by distance and left corner, left break, top, right break, right corner when available. `100makes/attempts`; do not assume equal attempt counts across years.
- **Off-dribble shooting** — test shooting outcomes at specified distances and left/top/right locations. Same accuracy formula, different drill.
- **On-the-move / nonstationary shooting** — recorded outcomes for movement drills; preserve attempt volume and drill protocol.
- **Combine scrimmage statistics** — ordinary box-score counts and rates from scrimmage games. Keep separate from official NBA competition.

Combine missingness can mean the player did not attend, declined a drill, or the test did not exist that year. Zero would falsely imply a measured result.

## 18. Fantasy and other statistical families

### 18.1 Fantasy and combined box-score statistics

- **NBA fantasy points (`NBA_FANTASY_PTS`)** — commonly published weighting `PTS+1.2REB+1.5AST+3STL+3BLK-TOV`. Retrieve NBA Base or derive; preserve the source's scoring version. [NBA field inventory](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerstats.md).
- **FanDuel basketball fantasy points** — `PTS+1.2REB+1.5AST+3STL+3BLK-TOV` for the ordinary listed basketball scoring. Retrieve the platform or calculate from boxes; special contest formats may differ. [Official rules](https://www.fanduel.com/rules).
- **DraftKings NBA Classic fantasy points** — `PTS+0.5×3PM+1.25REB+1.5AST+2STL+2BLK-0.5TOV+1.5×DD_bonus+3×TD_bonus`, with game-level binary bonuses under the contest rules. Retrieve the platform or calculate. [Official Classic rules](https://www.draftkings.com/help/rules/nba/classic).
- **Custom fantasy points** — `Σweight_k×stat_k+bonuses`. Store league/contest-specific weights; there is no universal ESPN/Yahoo/custom-league score.
- **Fantasy points per minute (`FPPM`) / per game (`FPPG`)** — fantasy total/MP or /GP, under one scoring system.
- **Points + rebounds + assists (`PRA`)** — `PTS+REB+AST`.
- **Points + rebounds (`PR`) / points + assists (`PA`) / rebounds + assists (`RA`)** — respective sums.
- **Steals + blocks (`stocks`, `STL+BLK`)** — `STL+BLK`; an informal combined count, not an official complete defense metric.
- **Category z-score / fantasy value** — `z=(x-population_mean)/population_SD`; reverse undesirable categories such as turnovers. Percentage-category value usually needs attempt-volume treatment. Population, weighting, and exclusions make this model-specific.

### 18.2 Additional published analytics

- **DRIP / offensive DRIP / defensive DRIP** — Opta's daily projected impact per 100 possessions. Fitted model, not a single box-score equation. Retrieve [Opta's player rankings](https://theanalyst.com/articles/nba-stats-and-player-projections); [creator introduction](https://theanalyst.com/articles/nba-drip-daily-updated-rating-of-individual-performance), [version changes](https://theanalyst.com/articles/changes-in-the-way-drip-is-calculated).
- **CraftedOPM / CraftedDPM / CraftedPM** — standardized impact blends. Published blend stages: `O=(2z_ODARKO+z_OLEBRON+z_ODRIP+z_OBPM+z_OLA3RAPM)/6`; `D=(2z_DDARKO+z_DLEBRON+z_DDRIP+0.5z_DBPM+2z_DLA3RAPM)/6.5`. Publisher rescaling follows; full population standardization is needed. Retrieve [CraftedNBA glossary/tables](https://craftednba.com/glossary).
- **Box Creation** — estimated teammate opportunities created per 100. Published expression: `0.1843AST+0.0969(PTS+TOV)-2.3021q+0.0582AST(PTS+TOV)q-1.1942`, with per-100 counting inputs and `q=(2/(1+exp(-3PA_per100))-1)×3P_fraction` under the published convention. Retrieve [CraftedNBA's specification and attribution](https://craftednba.com/glossary); it is estimated creation, not recorded potential assists.
- **Offensive Load** — creation-inclusive involvement: `0.75(AST-0.38BoxCreation)+FGA+0.44FTA+BoxCreation+TOV`, using matching per-100 inputs. [Published specification](https://craftednba.com/glossary).
- **Passer Rating / Portability / Shooting Quality (`SQ`, CraftedNBA)** — publisher-standardized passing, contextual fit, and shooting composites. Full formulas and rescaling: [CraftedNBA glossary](https://craftednba.com/glossary). Names do not denote universal NBA standards.
- **Defensive versatility, matchup concentration** — `sqrt(Σposition_share_k^2)` before normalization, with shares summing to one. Lower raw concentration means more balanced position coverage. Retrieve matchup data and calculate; [creator's method](https://fansided.com/2018/05/31/nba-playoffs-defensive-versatility-cavaliers-warriors-jeff-green/). It measures assignment variety, not success against those assignments.
- **Cleaning the Glass usage** — creation-adjusted used plays, with half credit shifted from assisted makes to assists: define `U=FGA+TOV+non_and_one_FT_trips-0.5assisted_FGM+0.5AST`; usage = `100U/team_used_plays_on`. Retrieve [CTG Offensive Overview](https://cleaningtheglass.com/stats/guide/player_offensive_overview); distinct from BRef USG%.
- **CTG points per 100 shot attempts (`PSA`)** — `100×(points excluding technical FTs)/(FGA+eligible_non_and_one_FT_trips)`. Uses actual trips, not the 0.44 FTA approximation. Same [CTG source](https://cleaningtheglass.com/stats/guide/player_offensive_overview).
- **Assist-to-usage ratio (`AST:Usg`)** — `AST%/usage%`; keep the same provider's definitions. [CTG source](https://cleaningtheglass.com/stats/guide/player_offensive_overview).
- **CTG turnover percentage** — `100TOV/U` using its creation-adjusted used-play count above. Same [CTG source](https://cleaningtheglass.com/stats/guide/player_offensive_overview).
- **BBall Index Perimeter Shooting / Finishing / Playmaking / One-on-One / Post Play / Off-Ball Movement / Screening and Rolling grades** — provider skill estimates for those named capabilities. Retrieve [skill tools](https://www.bball-index.com/skills-application/) and [offensive-grade methodology](https://www.bball-index.com/explaining-offensive-talent-grades/); exact production weights/normalizations are not established here.
- **BBall Index Perimeter Defense / Interior Defense / Offensive Rebounding / Defensive Rebounding grades** — corresponding role-aware skill evaluations, not the raw box-score rates. Retrieve the same [skill tools](https://www.bball-index.com/skills-application/); model/grade calculations are publisher-specific.
- **Shot Making / Shot Quality, BBall Index** — shooting proficiency adjusted for opportunity difficulty / quality of the opportunities. Retrieve [publisher analysis/tools](https://www.bball-index.com/predicting-future-shooting-performance-shooting-percentages-vs-shot-making/); not automatically identical to NBA xFG or a location-only expected-points calculation.
- **ShotQuality expected points / expected PPP / adjusted efficiency** — predicted shot/possession outcomes from the vendor's probability models. Generic aggregation is sum of expected point values, optionally divided by possessions; the underlying model is proprietary. Retrieve vendor products under their access terms; [model whitepaper](https://info.shotquality.com/hubfs/Shot%20Probability%20Model%20Whitepaper.pdf).
- **Expected Possession Value (`EPV`)** — `E[points at possession end | information available at time t]`. A spatial-temporal model covering non-shot actions, not merely expected value of the shot eventually taken. Retrieve research implementations or licensed tracking/model outputs; [original research](https://arxiv.org/abs/1408.0777).
- **EPV added / action value** — change in EPV due to an action, potentially relative to a counterfactual alternative. Model and attribution choices are essential; simple before-after difference is a descriptive variant.
- **Offensive/defensive role labels, archetypes, matchup difficulty, spacing and gravity variants** — vendor classifications or fitted scores. Retrieve the named provider; do not invent numeric equivalence between a role grade, NBA Gravity, and a shooting-volume proxy.

### 18.3 Availability, awards, and other metadata

- **Games available / missed / started / inactive / DNP** — count roster/game statuses under a stated eligibility rule. Retrieve NBA rosters, injury reports, game boxes, or commercial feeds. Injury-report entries can repeat; count distinct relevant games rather than reports.
  - _In Metis (Plan T709):_ **games missed to injury or illness** and **games out for other reasons** are available from 2019-20 (`games_out_injury`, `games_out_other`), counted by game from the official injury reports: the last report that lists the player decides, only an Out counts, and only for players with a box-score line that season. **Not available:** games started and games not played for any reason are in the box scores, not these counts; inactive and DNP are not read; before 2019-20 the reports are incomplete.
- **Minutes share / games-played share** — `100P_MP/(T_MP/5)` and `100P_GP/T_GP`. Specify tenure for traded players.
- **Awards, All-Star selections, All-NBA selections, titles, MVP voting share** — recorded results/counts; voting share = awarded vote points/maximum possible points under that award's rules. Retrieve NBA award releases, BRef awards, or commercial award feeds. These are not box-score performance formulas.
- **Salary / cap hit / payroll / cost per modeled win** — financial context. Cost per win = selected dollar measure/selected value metric, but salary and cap hit are not interchangeable. Retrieve a licensed salary source and current contract records; no salary database was audited for this document.
- **Referee foul/FT/challenge tendencies** — event counts or rates conditional on officiating crew. Retrieve officials plus PBP/commercial game data. A difference in raw rates is not evidence of referee bias without accounting for game context.
  - _In Metis (Plan T709):_ **not available.** The Games screen names a game's officials from the NBA's file; rates by crew are Plan T906, and any tendency needs the game context this entry asks for.
- **Season highs / career highs / consecutive-game streaks / threshold games** — max, ordered run length, or count above a threshold over eligible game logs. Any count statistic can generate these variants.

## 19. Retrieval examples and implementation notes

These are **illustrative retrieval patterns**, not live endpoint tests performed for this report. The repository currently favors bulk SportsDataverse files; documenting direct NBA routes does not change that architecture.

### 19.1 NBA dashboard access with nba_api

The wrapper exposes NBA Stats endpoints whose behavior can change. Source: [wrapper repository](https://github.com/swar/nba_api), [dashboard parameters](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerstats.md).

```python
from nba_api.stats.endpoints import leaguedashplayerstats

result = leaguedashplayerstats.LeagueDashPlayerStats(
    season="2025-26",
    season_type_all_star="Regular Season",
    measure_type_detailed_defense="Advanced",
    per_mode_detailed="Totals",
    timeout=60,
)
players = result.get_data_frames()[0]
print(players.columns.tolist())  # Inspect; do not assume one immutable schema.
```

Preserve season, season type, date filters, `MeasureType`, `PerMode`, and other parameters with each retrieved dataset. Different measure types can return the same player multiple times. Public NBA services can restrict automated requests or fail; use permitted published assets or a licensed API when appropriate rather than building a dependency on bypassing access controls.

### 19.2 Public NBA live box score

```python
import json
from urllib.request import urlopen

# Historical example from the wrapper documentation; not a current-game ID.
game_id = "0022000181"
url = f"https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json"
with urlopen(url, timeout=30) as response:
    payload = json.load(response)
for side in ("homeTeam", "awayTeam"):
    team = payload["game"][side]
    print(team["teamId"], team["statistics"])
```

Preserve the original JSON and retrieval timestamp. Confirm game status and later corrections before treating the box as final. See [live schema and example ID](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/boxscore.md).

### 19.3 Bulk SportsDataverse discovery

GitHub release tags identify dataset families. Discover actual asset names rather than assuming a naming convention will never change:

```python
import json
from urllib.request import Request, urlopen

repo = "sportsdataverse/sportsdataverse-data"
tag = "nba_stats_player_season_stats"
url = f"https://api.github.com/repos/{repo}/releases/tags/{tag}"
request = Request(url, headers={"Accept": "application/vnd.github+json"})
with urlopen(request, timeout=30) as response:
    release = json.load(response)
assets = [a for a in release["assets"] if a["name"].endswith(".parquet")]
for asset in assets:
    print(asset["name"], asset["size"], asset["browser_download_url"])
```

Download the selected asset, then inspect its schema in DuckDB/Python/R. For Parquet already on disk:

```sql
DESCRIBE SELECT * FROM read_parquet('chosen_asset.parquet');
SELECT * FROM read_parquet('chosen_asset.parquet') LIMIT 5;
```

The quoted path is an example to replace. No new bulk download or database ingestion was performed as part of this reference. [Release inventory](https://github.com/sportsdataverse/sportsdataverse-data/releases).

### 19.4 Metric dictionary fields worth preserving

For each application metric, retain:

- Stable internal ID; display name; abbreviation; provider/source-column name; category; subject grain (player/team/lineup/shot/possession/game).
- Definition; units; direction of improvement, if meaningful; exact numerator/denominator or model version; estimated-versus-observed flag.
- Aggregation rule: sum, ratio of sums, possession-weighted mean, last observation, percentile recomputation, or nonaggregable model output.
- Source URL/endpoint, request parameters, upstream publisher, bulk-dataset lineage, retrieval time, publication/as-of date, and correction version.
- Supported seasons/game types; tracked game/minute exposure; qualification threshold; missing-value reason; access/license status.

Examples: distinguish `nba.oncourt_off_rating` from `bref.individual_ortg`; distinguish `nba.usage.pct_ast` from `nba.advanced.ast_pct`; distinguish `nba.xfg_above_expected` from `bref.fg_plus_index`. These are proposed internal names, not claims about upstream field names.

### 19.5 Access and rights

A publicly readable webpage, an open-source wrapper license, and permission to redistribute underlying sports data are different things. Check the dataset's current terms and upstream conditions for the intended use. For example, the SportsDataverse README currently advertises a data license while the repository also contains software licensing; use the applicable artifact's terms. This is an access distinction, not a legal assessment. [Dataset README](https://github.com/sportsdataverse/sportsdataverse-data), [nba_api license](https://github.com/swar/nba_api/blob/master/LICENSE).

## 20. Historical coverage and interpretation traps

### 20.1 Coverage is metric-specific

- NBA-era recorded-stat milestones: rebounds **1950-51**, minutes **1951-52**, offensive/defensive rebounds, steals and blocks **1973-74**, player turnovers **1977-78**, three-pointers **1979-80**. Sources: [NBA FAQ](https://www.nba.com/stats/help/faq), [BRef historical PER adjustments](https://www.basketball-reference.com/about/per.html). These are collection milestones, not guarantees that every current endpoint contains those years.
- Basic historical game/player tables can extend much earlier than detailed shot, PBP, lineup, or tracking data. BRef's BAA/NBA/ABA combinations need explicit league filtering.
- Detailed NBA Stats PBP/shot/lineup datasets commonly target the era beginning around **1996-97**, but availability and completeness must be checked by product and season. The project's audit measured some releases beginning with ending-year label 1997; it did not certify all rows in all seasons.
- Modern league-wide optical-tracking summaries generally begin with **2013-14**; some earlier research/partial-team data exist, but they are not equivalent to full coverage. [RAPTOR's documented historical input eras](https://github.com/fivethirtyeight/data/tree/master/nba-raptor).
- Hustle, box-out, matchup, and newer Inside the Game fields start at different dates. A bulk archive's earliest filename can contain partial coverage rather than an entire comparable regular season. The existing project audit records hustle labels starting in 2016 and matchups in 2018; validate actual rows and seasons before exposing a first-supported-season promise.
- Historical PER, BPM, PIPM, RAPTOR, and other long-run metrics may use reduced-input estimates for early eras. A number being present does not mean modern raw inputs were recorded then.
- Dated projections and retrospective estimates differ. Save the actual historical publication snapshot for backtesting; a current model's reconstructed history may include different training/calibration from what was available at the time.

### 20.2 Comparability checklist

1. **Same subject and denominator:** player production, team-on-court output, assigned matchup output, and closest-defender output are different subjects.
2. **Same scope:** season, game type, date range, team tenure, and selected games must match.
3. **Same exposure:** tracking GP/MP may be lower than official GP/MP; do not use full-season denominators with partial tracking numerators.
4. **Same possession parser:** offensive rebounds, free throws, technicals, end-of-period events, and team turnovers affect totals.
5. **Same units:** percentages versus fractions, percentage points versus percent changes, feet versus legacy coordinates, seconds versus minutes.
6. **Same aggregate method:** use ratios of summed counts; do not sum precomputed percentages or average ranks.
7. **Same model version:** BPM revisions, EPM variants, DARKO as-of dates, and vendor retraining can change historical values.
8. **Same missingness policy:** untracked or not recorded is not zero, and DNP is not an ordinary zero-minute appearance.
9. **Same qualification:** rankings and percentiles may require minutes, attempts, possessions, or games. Store the threshold with the ranking.
10. **Same accounting:** player rebounds versus team rebounds; player turnovers versus team/total turnovers; technical versus personal fouls.
11. **Same correction state:** final boxes and PBP can be revised. Preserve source timestamps and re-fetch policy.
12. **No false additivity:** overlapping scoring categories, tracking actions, player combinations, and hierarchical leverage components cannot automatically be summed.

## 21. Mapping to this project's datasets

The existing [NBA data-source audit](nba-data-sources.md) was read for project context. The mappings below use that audit's measured inventory; the Parquet files were **not re-downloaded or re-measured for this document**. Treat this as a retrieval plan, not a new ingestion implementation.

- **Traditional player/team/game statistics:** `espn_nba_player_boxscores`, `espn_nba_team_boxscores`, `nba_stats_player_boxscores`, `nba_stats_team_boxscores`.
- **Season Base/Advanced/Misc/Scoring/Usage and team summaries:** `nba_stats_player_season_stats`, `nba_stats_team_season_stats`, and `nba_stats_leaguedash`. Inspect actual `measure_type` and `per_mode` before selecting rows; don't assume one player-season row.
- **Tracking:** inspect the relevant `nba_stats_leaguedash` assets and measure types. The existence of the family does not prove every tracking subtype or field is present.
- **Shot locations and shooting splits:** `nba_stats_shots`, `espn_nba_shots`; tracking detail requires appropriate dashboards, not just shot coordinates.
- **Possession rates / on-off / lineup reconstruction:** `nba_stats_possessions`, `nba_stats_game_lineups`, `nba_stats_lineups`, and available PBP. The local audit found derived-possession discrepancies; do not label recomputed rates as exact official NBA values without reconciliation.
- **Play types:** `nba_stats_synergy`.
- **Hustle / box outs:** `nba_stats_hustle`; inspect per-season fields and exposure.
- **Assigned defense:** `nba_stats_matchups`, `nba_stats_game_matchups`.
- **Impact models:** `nba_player_impact`. Identify the originating calculation for every RAPM/SPM/BPM/WAR/DARKO column; names alone do not prove that they are the original publisher's product or current version. EPM and LEBRON availability must be checked separately.
- **Bios and combine:** `nba_stats_rosters`, `nba_stats_draft_combine`; additional measurements depend on retained columns.
- **Availability:** `nba_stats_injury_report` plus roster/game records. Distinguish repeated report snapshots from distinct missed games.
- **Game classification and time context:** `nba_stats_schedules`, `espn_nba_schedules`.
- **Identity joins:** `nba_crosswalk` where covered. NBA and ESPN IDs differ; store NBA game IDs as strings to retain leading zeros.
- **New proprietary NBA models / publisher skill grades / licensed continuous tracking:** no confirmed complete dataset in the audit. Keep unavailable until the relevant public export or licensed feed is verified.

The local audit's season asset label is the **ending year**: `2026` represents 2025-26. NBA API strings typically use `2025-26`. Explicitly map these conventions; the current 2026-27 season may appear as `2027` in bulk assets. The audit also identified different game-type codings and a misleadingly named game-log release; use its measured schema, not the filename, to decide grain.

Practical acquisition order for this repository: preserve the bulk source tables; build formulas from box/possession inputs; import tracking/hustle/play-type measures with coverage flags; import externally fitted models as versioned published observations. This preserves the ability to explain each number and compare providers without silently merging unlike statistics.

## 22. Source index and maintenance

References are attached to the relevant definitions and retrieval families throughout the document. The main authority groups are:

- **Official display and definition checks:** [NBA Stats](https://www.nba.com/stats), [NBA statistical glossary](https://www.nba.com/stats/help/glossary), [Inside the Game](https://www.nba.com/inside-the-game). Individual newer dashboards are linked in section 15.
- **Machine-readable field/parameter inventory:** [nba_api endpoint documentation](https://github.com/swar/nba_api/tree/master/docs/nba_api/stats/endpoints), [live endpoint documentation](https://github.com/swar/nba_api/tree/master/docs/nba_api/live/endpoints). Schema names are from these primary project documents; old examples and validation dates are not uptime guarantees.
- **Historical formulas:** [BRef glossary](https://www.basketball-reference.com/about/glossary.html), [PER](https://www.basketball-reference.com/about/per.html), [individual ratings](https://www.basketball-reference.com/about/ratings.html), [Win Shares](https://www.basketball-reference.com/about/ws.html), [BPM 2](https://www.basketball-reference.com/about/bpm2.html).
- **Possession processing:** [PBP Stats documentation](https://pbpstats.readthedocs.io/en/latest/), [public API documentation](https://api.pbpstats.com/docs).
- **Model authors:** Dunks & Threes, BBall Index, DARKO, Opta, CraftedNBA, Cleaning the Glass, and the original research/archives linked alongside their metrics. These provide model identity and methodology, not universal interchangeable definitions.
- **Retrieval alternatives:** SportsDataverse, Sportradar, SportsDataIO, and BALLDONTLIE documentation in section 2; verify access, coverage, and terms at integration time.
- **Project-specific evidence:** [existing measured source audit](nba-data-sources.md), which is distinct from this literature/schema review.

**What remains open:** a complete inventory of private vendor metrics; full reproduction of proprietary model parameters; independent verification of every newest NBA component-level column; every historical season's field coverage; live access tests for every listed endpoint; and publisher-specific export/licensing arrangements. These are explicitly outside the verified portion rather than implied to be solved.

**Keeping the catalog current:** record a new research date, diff provider schemas, verify formulas against a small published sample, inspect new dashboard categories, and update first/last-supported seasons from actual data. Add a new provider namespace whenever a familiar abbreviation acquires a different definition.
