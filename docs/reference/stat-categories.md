# Stat categories: reference

How Metis groups its statistics for a reader, by what each one measures (Plan T1702, D52). The owner's request of 2026-11-23: a category's name should say exactly what it holds, so that the Defense tab shows every defensive statistic of a player, whatever table it comes from, and the same for Offense, Shooting and the rest.

This is the taxonomy, written before it is built (T1702.1). It places every metric of the catalogue, in every league, players and teams, opponents' metrics included; T1702.2 puts it in the code (`src/shared/stats/categories.ts` and a `categories` field on each `MetricDef`), T1702.3 and T1702.4 put it on the screens.

## What a category is

- **A category groups metrics by what they measure**: points, shots, passes, rebounds, fouls, a defensive act, a team's results. It has an id, a label, a one-sentence definition a reader can predict its contents from, and ordered **sub-groups**, each with its own sentence.
- **A metric sits in every category it belongs to**, one sub-group in each: second-chance points are Scoring and Rebounding; a block is Defense; a steal by a team's opponents is the team's Offense (below). The first category listed is the metric's **primary** one, where the Glossary describes it in full.
- **The family stays, as the source.** `family` keeps saying which section of the reference and which kind of table a metric comes from (Tracking, Play by play, Shot zones, Impact (SportsDataverse)). It is no longer what the screens group by; it remains a filter ("From: Tracking") and a line on the metric's card.
- **Offense and Defense are umbrellas.** They hold every statistic of one end of the floor: Offense the scoring, shooting, playmaking, turnovers, offensive rebounding, fouls drawn, usage, offensive play types and offensive impact; Defense the steals and blocks, defended shots, matchups, defensive rebounding, fouls committed on defense, defensive hustle, defensive play types and defensive impact, and for a team everything its opponents did with the ball. Their sub-groups are headings that open the specific categories' sub-groups for that end (below, "Views over 40 metrics").
- **Overview is a preset, not a category.** It is today's default board (the tab's `groups` in `lib/stats/leaderboard.ts`, the dashboards' Overview tabs): the most-read numbers across categories. No metric is tagged Overview.

### The end of the floor, and opponents

Each placement rule names the end of the floor its act belongs to when the row's own player or team does it: offense (a shot, a point, a pass, a turnover, an offensive rebound, a foul drawn, a screen assist), defense (a steal, a block, a defensive rebound, a foul committed on defense, a contest, a deflection, a charge drawn, a goaltend, defensive three seconds), or neither (minutes, total rebounds, technicals, record, pace).

**A team's opponents' metric (`opp_*`) belongs to the other end.** What the opponents did with the ball is the team's Defense: `opp_pts` is Defense › Scoring allowed, `opp_fg3_pct` Defense › Shooting allowed, `opp_tov` Defense › Turnovers forced, `opp_oreb` Defense › Rebounding. What the opponents did on defense is the team's Offense: `opp_stl` (the team's turnovers lost to steals) is Offense › Turnovers, `opp_blk` (the team's shots blocked) Offense › Shooting, `opp_dreb` (the team's misses the opponents rebounded) Offense › Rebounding, `opp_pf` (fouls the team drew) Offense › Fouls drawn. An opponents' metric keeps its functional category too: `opp_fg3_pct` is in Shooting › Threes as well, and a team's view of a category shows the team's own metrics and its opponents' as two sides (below).

This replaces what `side` does today. `side` is documented as "which end it measures", but it is set by whose box score a column comes from: `team_stl`, `team_blk`, `team_pf` and `team_pbp_goaltend` read `side: 'offense'`, `opp_stl` reads `defense`. The categories carry the end; `side` can stay as "the team's own or its opponents'" (meanings, below).

## The categories

Fourteen categories, in the order the screens show them. A category with nothing in a league, or for players or teams, is not shown there (counts below): today Fantasy is empty everywhere, Predictive has no player metric in any league, Hustle and Play types are the NBA's alone.

| Category             | Holds, in one sentence                                                                                                                                                            | Sub-groups                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offense              | Everything a player or team does with the ball, and for a team what its opponents' defense did to it.                                                                             | Scoring; Shooting; Playmaking; Turnovers; Rebounding; Fouls drawn; Usage; Hustle; Play types; Impact; Ratings                                                                                                                                                          |
| Defense              | Everything a player or team does without the ball, and for a team everything its opponents did with it.                                                                           | Steals and blocks; Defended shots; Matchups; Rebounding; Fouls and violations; Hustle; Play types; Impact; Scoring allowed; Shooting allowed; Playmaking allowed; Turnovers forced; Ratings                                                                            |
| Scoring              | Points: how many, from which shots, in which situations, and how the baskets came.                                                                                                | Points; Points by shot; Points by situation; Assisted and unassisted; Starters and bench; Share of team                                                                                                                                                                |
| Shooting             | Shots taken and made: attempts, makes and percentages, by kind of shot, zone, distance and situation, free throws included.                                                       | Field goals; Twos; Threes; Free throws; Efficiency; Shot selection; Share of team; Restricted area and paint; Mid-range; Corner threes; Above the break and backcourt; Distances; Shot types; Catch-and-shoot and pull-up; Drives and touches; Transition and putbacks |
| Playmaking           | Making plays for others and keeping the ball: passes and assists, the shots created beyond them, handling the ball, and turnovers.                                                | Passing; Creation; Ball handling; Turnovers                                                                                                                                                                                                                            |
| Rebounding           | Rebounds at either end: how many, what share of the chances, contested or not, and the box outs behind them.                                                                      | Offensive; Defensive; All rebounds; Box outs                                                                                                                                                                                                                           |
| Fouls                | Fouls and violations: those committed, those drawn, and the flagrants, technicals and ejections.                                                                                  | Committed; Drawn; Violations; Flagrants, technicals and ejections                                                                                                                                                                                                      |
| Hustle               | The effort plays the NBA counts as hustle: contests, deflections, loose balls, charges drawn, screen assists and box outs.                                                        | Contests; Loose balls and deflections; Charges; Screens; Box outs                                                                                                                                                                                                      |
| Play types           | How a player's plays ended, by the kind of play, on offense and on defense: possessions, frequency and results of each.                                                           | One a play type: Isolation, Transition, Pick-and-roll ball handler, Pick-and-roll roll man, Post-up, Spot-up, Handoff, Cut, Off screen, Putbacks, Miscellaneous; then the seven defended, "Isolation defense" to "Off screen defense"                                  |
| Impact               | How much a player adds to the team's results: the team's margin with them on the floor and off it, and the all-in-one models and composites built from box scores and plus-minus. | On court; Plus-minus models; Box-score models; Box-score composites; Individual ratings; All-around games                                                                                                                                                              |
| Predictive           | Numbers that look ahead: a season's forecast for a team, a projection for a player, each named as its maker's estimate.                                                           | Season forecast; Player projections                                                                                                                                                                                                                                    |
| Results and strength | Winning and how strong a team is: record, margin, efficiency and pace, ratings adjusted for opponents, Elo, Pythagorean record, schedule, game flow and forecast.                 | Record; Margin; Efficiency and pace; Adjusted ratings; Elo; Pythagorean; Schedule; Game flow; Forecast; Rankings and seeds                                                                                                                                             |
| Playing time         | How much a player was on the floor and how much they moved: games, starts, minutes, possessions, distance and speed, and the games they missed.                                   | Games and minutes; Possessions; Movement; Games missed                                                                                                                                                                                                                 |
| Fantasy              | Fantasy points under the common scoring systems, as ordinary metrics (D4, T1201); nothing about rosters or advice.                                                                | Points (by scoring system), added by T1703.2                                                                                                                                                                                                                           |

### The sub-groups

**Offense** and **Defense**: each sub-group is the metrics of that end in the category of the same name (Offense › Shooting is Shooting's metrics that are offense), plus those only the umbrella holds: Usage (usage percentage and possessions used, on the box score, on court and as the NBA publishes it), Ratings (offensive or defensive rating, adjusted or not), Steals and blocks, Defended shots (contests, the rim protection dashboard), Matchups (the NBA's matchup files), Impact (the offensive or defensive part of a model, on-court rating or individual rating).

**Scoring**

- _Points_: points scored.
- _Points by shot_: points from twos, threes and free throws, and each one's share of the points.
- _Points by situation_: points in the paint, on the fast break, off turnovers, second-chance, in transition, putbacks, and the points of a tracking dashboard (catch-and-shoot, pull-up, drives, touches).
- _Assisted and unassisted_: how the made shots came, assisted or not, as counts and shares.
- _Starters and bench_: a team's points by starters and by the bench.
- _Share of team_: a player's share of the team's points, over the whole game or on court as the NBA publishes it.

**Shooting**

- _Field goals_, _Twos_, _Threes_, _Free throws_: makes, attempts, misses and percentages of each (free throws with the free-throw rate, and-ones and shooting-foul trips); the player's own shots blocked (`nba_blka`) are Field goals.
- _Efficiency_: shooting that counts the three and the free throw: eFG%, TS%, points per attempt, points above the league by location.
- _Shot selection_: where the attempts come from: three- and two-point attempt rates, share of attempts from two and three, average shot distance.
- _Share of team_: a player's share of the team's makes and attempts.
- _Restricted area and paint_, _Mid-range_, _Corner threes_, _Above the break and backcourt_: the shot-chart zones, each with attempts, makes, FG%, frequency, eFG%, points per shot, both against the league, and the assisted share; the colleges' rim and mid-range splits sit here.
- _Distances_: the same by distance band (under 8 feet, 8 to 16, 16 to 24, 24 and beyond).
- _Shot types_: dunks, tips, layups, hooks, floaters and jump shots.
- _Catch-and-shoot and pull-up_: the tracking dashboards of those shots.
- _Drives and touches_: shots and free throws off drives and off elbow, post and paint touches.
- _Transition and putbacks_: the colleges' transition eFG% and putback FG%.

**Playmaking**

- _Passing_: assists, the assist rates and ratios, passes made, assists on twos and threes, free-throw and adjusted assists, the passes and assists off drives and touches; a team's assisted share of its field goals.
- _Creation_: the shots made for others beyond the assist: potential and secondary assists, assist points, drives, screen assists.
- _Ball handling_: touches, time of possession, seconds and dribbles per touch, passes received, elbow, post and paint touches.
- _Turnovers_: turnovers, turnover rates and ratios, each kind of turnover from the plays, live-ball and dead-ball, off drives and touches, the team's turnovers no player is charged with.

**Rebounding**

- _Offensive_, _Defensive_: rebounds at that end, their rates, the player's share of the team's, the tracking dashboards' contested, uncontested, chances, deferred and distance; second-chance points and putbacks are Offensive too.
- _All rebounds_: the same for both ends together.
- _Box outs_: box outs, at either end, and the rebounds after them.

**Fouls**

- _Committed_: personal fouls and their kinds: shooting, non-shooting, offensive, loose-ball, take, transition take, clear path; the shooting share of fouls; the offensive-foul turnovers.
- _Drawn_: fouls drawn, shooting fouls drawn, and-ones, two- and three-shot trips, trips per attempt, the fouls drawn on drives and touches, charges drawn.
- _Violations_: defensive three seconds, defensive goaltending, kicked balls.
- _Flagrants, technicals and ejections_.

**Hustle**: _Contests_ (contested shots, twos and threes), _Loose balls and deflections_, _Charges_, _Screens_ (screen assists and their points), _Box outs_.

**Play types**: one sub-group a play type, each with its 13 metrics (possessions, frequency, points, points per possession, FG, FG%, eFG%, free-throw, turnover, shooting-foul, and-one and score frequencies); the seven defended types after the eleven on offense.

**Impact**

- _On court_: the team with the player on the floor and off it: plus-minus (box score and plays), on, off and on-less-off ratings, pace, the team's eFG%, turnover and rebound rates on court, the opponents' points by situation on court, the NBA's on-court ratings, minutes and possessions on court.
- _Plus-minus models_: RAPM and its kin, as SportsDataverse publishes them; DARKO's skill estimate.
- _Box-score models_: PER, Win Shares, BPM, VORP, SPM and WAR, Metis's and SportsDataverse's side by side, the NBA's defensive win shares.
- _Box-score composites_: Efficiency (EFF), Game Score, PIE.
- _Individual ratings_: Dean Oliver's individual offensive and defensive ratings, points produced, scoring possessions, floor percentage, stops and stop percentage.
- _All-around games_: double-doubles, triple-doubles, quadruple-doubles, five-by-fives.

**Predictive**: _Season forecast_ (projected wins and losses, playoff, play-in, round and title odds, mean seed, and how many runs the forecast made), _Player projections_ (DARKO's next season and its spread, today unavailable in every league; T1703 adds more).

**Results and strength**

- _Record_: wins, losses and win percentage (for a player, the team's in the games they played).
- _Margin_: point differential, margin of victory.
- _Efficiency and pace_: offensive, defensive and net ratings, points per possession, pace and possessions, each source's beside Metis's.
- _Adjusted ratings_: SRS, strength of schedule, the adjusted ratings and home court, SportsDataverse's adjusted efficiency for the colleges.
- _Elo_, _Pythagorean_: the rating and the wins it expects; the Pythagorean record and the wins over it.
- _Schedule_: games left and the strength of schedule left.
- _Game flow_: lead changes, times tied, time leading or tied, largest lead and deficit, best runs, droughts.
- _Forecast_: the season forecast, also here.
- _Rankings and seeds_: NET, quadrants, polls and seeds, listed as unavailable (D44).

**Playing time**: _Games and minutes_ (games, starts, minutes, minutes on court from the plays), _Possessions_ (possessions played, the NBA's), _Movement_ (distance and average speed, on offense and defense), _Games missed_ (injury or illness, other reasons).

## The hard cases

How the cases that could go more than one way were decided. The rule behind most of them: **a metric is placed by the act it counts** (a point, a shot, a pass, a rebound, a foul, a defensive act, a result), and by the end of the floor that act belongs to.

1. **A turnover is Playmaking and Offense.** Playmaking › Turnovers, since keeping the ball is half of making plays, and Offense › Turnovers as a heading of its own, not folded into Offense › Playmaking, so a reader of Offense sees ball security beside scoring. The opponents' turnovers are the team's Defense › Turnovers forced.
2. **Plus-minus is Impact › On court.** The manager's list had "On court and lineups" and "Impact and all-in-one" apart. Raw plus-minus, on-off and on-court ratings are the simplest measure of impact and the input of the plus-minus models, and a reader looking for impact expects plus-minus; two categories would split one question. So On court is a sub-group of Impact. Lineups are a screen of their own with no catalogue metric, so nothing is lost by the name. A player's own rates counted from the plays while on court (usage, AST%, rebound, steal and block percentages "on court") are placed by their act, not in Impact: `onc_usg_pct` is Offense › Usage, `onc_ast_pct` Playmaking › Passing.
3. **The league indexes go with their rate**, not in a category of their own: TS+ and eFG+ are Shooting › Efficiency, 3P+ Shooting › Threes, TOV%+ Playmaking › Turnovers, AST%+ Playmaking › Passing, ORB%+ Rebounding › Offensive, STL%+ and BLK%+ Defense › Steals and blocks, USG%+ Offense › Usage. An index says how a rate compares with the league; what it measures is the rate's. Their family (`indexes`) stays, so "League indexes" remains a source filter.
4. **Opponents' defensive acts are the team's Offense** (above), where the manager's starting list put "for teams everything their opponents did" under Defense. Opponents' steals, blocks, defensive rebounds, fouls and violations measure the team's ball security, shots blocked, misses lost and fouls drawn, which a reader of Defense would not expect to find there. **For the manager's decision.**
5. **Fouls are a category of their own.** Defense cannot hold them all: offensive fouls are committed with the ball (Offense › Turnovers), technicals, ejections and loose-ball fouls belong to neither end, and fouls drawn are offense. Fouls committed on defense (personal, shooting, non-shooting, take, clear path) and the defensive violations (three seconds, goaltending, kicked balls) are also Defense › Fouls and violations. **Personal fouls (`pf`) count as defensive** though they include offensive fouls (counted apart, `pbp_pf_offensive`), since nearly all are committed on defense and a reader of Defense expects them; the shooting share of fouls and the loose-ball fouls have no end.
6. **Usage is Offense › Usage alone.** It is neither scoring nor playmaking: it is the share of the team's plays a player finishes, by shot, free throw or turnover. Possessions used (`poss_used`) sits with it.
7. **Tracking is a source, not a category.** The manager's list had "Tracking and movement". Tracking holds drives, touches, passes, rebound chances, catch-and-shoot, pull-ups and rim protection: by what they measure they are Playmaking, Shooting, Rebounding and Defense, and a reader of Shooting looking for catch-and-shoot 3P% should find it there. Distance and speed are Playing time › Movement. A tracking dashboard's outcomes are spread by the act each counts: a drive's FG% is Shooting › Drives and touches, its points Scoring › Points by situation, its passes and assists Playmaking › Passing, its turnovers Playmaking › Turnovers, its fouls Fouls › Drawn; the drives themselves Playmaking › Creation.
8. **Play types stay whole**, unlike tracking dashboards: 234 metrics, 13 for each of 18 play types, would swamp Scoring and Shooting, and the NBA, Synergy and every reader treat a play type as one unit. They are in Play types and in Offense › Play types or Defense › Play types.
9. **Hustle stays a category**, as the NBA names and publishes it, and each hustle statistic also sits in its own category: contests in Defense › Defended shots, deflections and defensive loose balls in Defense › Hustle, charges drawn in Defense › Hustle and Fouls › Drawn, box outs in Rebounding › Box outs, screen assists in Playmaking › Creation and Offense › Hustle.
10. **Availability is Playing time › Games missed.** Two metrics, NBA only (games out for injury or illness, and for other reasons), are a part of how much a player played, not a tab.
11. **Double-doubles and the rest are Impact › All-around games.** They count games of all-round production, which is what "all-in-one" means; they measure no one act.
12. **Pace and possessions.** A team's are Results and strength › Efficiency and pace, with no end: pace is both ends'. A player's possessions played are Playing time › Possessions; the pace with a player on the floor is Impact › On court.
13. **Ratings.** A team's offensive rating is Results › Efficiency and pace and Offense › Ratings, its defensive rating also Defense › Ratings, its net rating Results alone; the same for the adjusted ratings and SportsDataverse's college ratings. A player's on-court ratings (the NBA's `nba_ortg` and Metis's `onc_ortg`) are Impact › On court with the end.
14. **Game flow** is Results and strength; best runs and droughts are also Offense › Scoring (the team's) or Defense › Scoring allowed (the opponents'). Largest lead, largest deficit and time leading have no end.
15. **Season forecasts** are Predictive › Season forecast and Results › Forecast, so they are shown under the name a reader looks for ahead and beside the record. DARKO's skill estimate is Impact › Plus-minus models and Predictive › Player projections.
16. **A player's wins and losses** are Results › Record: the team's record in the games they played.
17. **Assisted and unassisted makes** are Scoring › Assisted and unassisted (how the baskets came); a team's assisted share is also Playmaking › Passing, the usual measure of ball movement.
18. **Shares of the team** (`share_*`, the NBA's on-court `nba_share_*`) go with their act: share of rebounds is Rebounding, of steals Defense, of fouls Fouls, of points Scoring.
19. **Second-chance points and putbacks** are Scoring › Points by situation and Rebounding › Offensive. Points off turnovers and fast-break points are Scoring only; the opponents' are Defense › Scoring allowed.
20. **Free-throw rate is Shooting › Free throws**, not Fouls: it is free-throw attempts per shot. And-ones and shooting-foul trips are both Fouls › Drawn and Shooting › Free throws.
21. **Matchups are Defense › Matchups only**, even "assists allowed" or "turnovers forced" in matchups: every matchup figure is about the defender's assignment.
22. **The NBA's published twins** (`nba_*`, and the colleges' stats.ncaa.org splits) sit in the same sub-group as Metis's own figure, side by side (policy 5): `nba_ts_pct` beside `ts_pct` in Shooting › Efficiency.
23. **Blocks at the rim (colleges) are Defense.** The catalogue files `ncaa_rim_blocks` under Scoring and words it "Blocked shots taken at the rim". Measured on the 2024-25 men's stats.ncaa.org player box (`src_ncaa_player_box`, read-only on the gate13c load): rim, mid-range and three-point blocks add up to the player's own blocks on 125,341 of 127,466 lines, and no line has zone blocks without blocks. They are shots the player blocked. The opponents' version is the team's Offense › Shooting.
24. **Total rebounds have no end**: Rebounding › All rebounds alone, neither Offense nor Defense.

## Meanings

Labels and descriptions that would mislead a reader about what a metric measures, or that name one thing two ways. Each is a proposal for T1702.2, where the categories land; a change of label leaves the id alone, so saved views keep working.

| Metric                                                       | Today                                                                                                                                        | What misleads                                                                                                                                                   | Proposed                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ncaa_rim_blocks` and team, opp                              | "Blocks at the rim": "Blocked shots taken at the rim", family Scoring                                                                        | Reads as the player's own rim attempts that were blocked; they are blocks the player made (measured, hard case 23)                                              | "Blocks at the rim": "Shots the player blocked at the rim." Family stays (source); category Defense                                           |
| `pbp_ft_trip2`, `pbp_ft_trip3` and team, opp                 | "Two-shot fouls", "Three-shot fouls"                                                                                                         | Reads as fouls committed; they are trips the shooter earned                                                                                                     | "Two-shot fouls drawn", "Three-shot fouls drawn"                                                                                              |
| `nba_blka`                                                   | "Shots blocked (NBA)"                                                                                                                        | Reads as blocks made; it is the player's attempts blocked                                                                                                       | "Own shots blocked (NBA)"; short `BLKA` stays                                                                                                 |
| `team_ast_share`, `opp_ast_share`                            | "Assisted field goals"                                                                                                                       | A share, labelled like a count                                                                                                                                  | "Share of field goals assisted"                                                                                                               |
| `team_nba_ast_pct`                                           | "Assist percentage (NBA)"                                                                                                                    | For a player, assist percentage is the share of teammates' makes they assisted; this team figure is the share of its makes assisted, `team_ast_share`'s measure | "Share of field goals assisted (NBA)"                                                                                                         |
| `nba_ast_to`, `team_nba_ast_to`                              | "Assists per turnover (NBA)"                                                                                                                 | The same measure as `ast_tov`, "Assist-to-turnover ratio", under another name                                                                                   | "Assist-to-turnover ratio (NBA)"                                                                                                              |
| `nba_reb_pct`, `team_nba_reb_pct`                            | "Rebound percentage (NBA)"                                                                                                                   | `trb_pct` is "Total rebound percentage"                                                                                                                         | "Total rebound percentage (NBA)"                                                                                                              |
| `matchup_team_pts`                                           | "Team points in matchups"                                                                                                                    | Reads as the player's own team's points; it is the other team's points while the player was assigned                                                            | "Opponent team points in matchups"                                                                                                            |
| `team_pbp_tov_team`, `opp_pbp_tov_team`                      | "Team turnovers"                                                                                                                             | On a team's row every turnover is the team's; these are those charged to no player                                                                              | "Turnovers charged to the team"                                                                                                               |
| `team_poss_sym`                                              | "Possessions per team"                                                                                                                       | Reads as a count per team; it is the mean of both teams' estimates, which ratings divide by                                                                     | "Possessions, both teams' mean"                                                                                                               |
| `fg_pts_per_fga`, `pts_per_fga`                              | "Field-goal points per attempt", "Points per field-goal attempt"                                                                             | Two labels a word apart for two measures: free-throw points out, and in                                                                                         | "Points per shot, field goals only" and "Points per shot, free throws included"                                                               |
| `eff`, `team_eff`, `opp_eff`                                 | "Efficiency"                                                                                                                                 | The word names Shooting's Efficiency sub-group and the ratings' "efficiency"; this is the NBA's old EFF composite                                               | "Efficiency (EFF)", or "Box-score efficiency"                                                                                                 |
| `opp_gmsc`                                                   | "Opponent game Score"                                                                                                                        | Capitals                                                                                                                                                        | "Opponent Game Score"                                                                                                                         |
| `pbp_ast_pts`, `ast_pts_created`                             | "Assist points", "Assist points created"                                                                                                     | One measure from two sources (the plays, tracking), named as if two                                                                                             | "Assist points, from plays" and "Assist points (tracking)"                                                                                    |
| `eff_catch_shoot_pts`, `eff_pull_up_pts`, `eff_*_fg_pct`     | "… (efficiency dashboard)"                                                                                                                   | The NBA's dashboard name, which says nothing to a reader; they differ from the catch-and-shoot dashboard's on a third to a half of players                      | "… (tracking efficiency)", and the description leads with the difference                                                                      |
| `team_paint_pts`, `team_fast_break_pts`, `team_turnover_pts` | "Points in the paint", "Fast-break points", "Points off turnovers"                                                                           | They sit beside the NBA's figures, "… (NBA)", in the same sub-group, and read as the same thing; they are ESPN's box score                                      | "Points in the paint (box score)" and so on                                                                                                   |
| every team metric's `side`                                   | `side: 'offense' \| 'defense'`, "which end it measures"                                                                                      | Set by whose box score: `team_stl`, `team_blk`, `team_pf`, `team_pbp_goaltend` read offense, `opp_stl` defense                                                  | Document `side` as "the team's own or its opponents'" (rename in code is optional); the end comes from the categories                         |
| the family labels                                            | "Shooting" (holds AST%, TOV%, rebound percentages, usage), "Scoring" (holds shares of rebounds, steals, fouls, and the colleges' rim blocks) | Shown on every metric card and in the Glossary as if they said what a metric measures                                                                           | Shown as the source: "Box-score rates" for `shooting`, "Splits and shares" for `scoring`; the others already name a source or a kind of table |

Not changed, though they look alike: the ESPN box score's and the NBA's published versions of the same measure (`ts_pct` and `nba_ts_pct`) differ by source and say so; on-court and whole-game shares (`share_pts` and `nba_share_pts`) are different measures and their descriptions say which; RAPM and RAPM within team are different estimands (D44) and the description says so.

## What each screen shows

**The rule for every screen:** a category's view reaches every metric of that category the league has, for the row's kind (players or teams), without a search. A category with nothing in the league is not shown; a sub-group with nothing is not shown.

### Views over 40 metrics

A query takes at most 40 metrics (`MAX_COLUMNS`). Every **sub-group** is at most 40 for one kind and one side in every league today (counts above: the largest are Shooting › Distances and Corner threes, 32 and 27 a side, and Playmaking › Turnovers, 30 for NBA players). So a category's view is shown **one sub-group at a time**: the category's tab shows its sub-groups as presets, and choosing one fills the board with all its metrics. A team's view of a category has two sides, the team's own and its opponents', each a set of presets (today's Offense and Defense team tabs become those sides). An umbrella's sub-groups over 40 (Offense › Shooting, 228 for NBA players; Offense › Play types, 143) open the specific category's sub-groups for that end: Offense › Shooting › Corner threes is Shooting › Corner threes with the offense metrics.

T1702.3 adds a test that every sub-group is at most 40 a kind and side in each league, so a PR adding metrics past it must split the sub-group.

The category's tab opens on its **headline preset**: its `core` metrics, then `extended` ones read from games, up to 12, as `familyMetrics` does today for a family.

### Leaderboards

- **Category tabs** replace the family preset menu: Overview, then the categories with metrics for the kind on screen. NBA players see Overview and 12 (no Predictive, no Fantasy today); WNBA players 10; NCAA players 10; NBA teams Overview and 11.
- **Positions** (All, Guards, Forwards, Centers) stay, as a compact control beside the category tabs, since the two are independent; T1701's filters can later carry position as an attribute, but that is T1701's decision, not this one.
- **Teams**: the Offense and Defense tabs become the Offense and Defense categories; every other category shows the team's metrics and a switch to its opponents'.
- **Sub-group presets** under the tabs, as chips; the column groups in the table header name the sub-group (`columnGroups`), not the family.

### Column picker

Grouped by category, then sub-group, in the registry's order, a metric listed under each category it sits in (picking it once adds it once). The search stays. A "From" filter shows the families as sources (Tracking, Play by play, SportsDataverse). Today's grouping by family label goes.

### Glossary

By category, then sub-group: each metric described in full under its primary category, and named with a link under the others ("Also in Defense › Rebounding"). The category filter replaces the family filter; the family is a line of each entry ("From: Tracking"). Metrics a league does not have stay listed with their reason, as today.

### Player page

Today's tabs: Overview, Scoring, Shooting, Shots, Play by play, Playmaking, Rebounding, Defense, Tracking, Play types, Matchups, Game log, Splits, On/off, Profile.

- Overview stays. **Scoring, Shooting, Playmaking, Rebounding, Defense, Fouls, Hustle, Play types, Impact, Playing time** become category tabs, each with its sub-groups as sections, every metric of the category reachable. **Offense** is a tab too, its sections the umbrella's sub-groups; long sections start folded.
- **Shots** goes into Shooting: the shot chart heads its zone sections. **Play by play** and **Tracking** go (sources), their metrics spread by category. **Matchups** goes into Defense, its per-opponent table as the Matchups section.
- Game log, Splits, On/off and Profile stay: they are views of a player, not categories. Old `drive.mjs` step files click tabs by place (the comment in `PLAYER_DASH_TABS`): T1702.4 rewrites the steps that do.
- Predictive and Fantasy appear when they have a player metric.

### Team page

Today's tabs: Overview, Offense, Defense, Shots, Play by play, Players, Lineups, Splits, Schedule, On/off. Overview stays; Offense and Defense become the umbrella categories; **Scoring, Shooting, Playmaking, Rebounding, Fouls, Hustle, Impact, Predictive, Results and strength** are added as category tabs, each with the team's side and the opponents'. Shots goes into Shooting (the chart heads the zones); Play by play goes. Players, Lineups, Splits, Schedule and On/off stay.

### Explore, Compare and Trends

Their metric pickers (`lib/stats/chart.ts`, `compare.ts`, `trends.ts`, which group by family today) group by category: a category select, then the metric select listing every metric of that category for the kind on screen, sub-groups as option groups. Compare's default rows (`DEFAULT_FAMILIES`) become default categories, the same metrics.

### Home

The home boards stay a fixed set of eight (points, rebounds, assists, threes, steals, blocks, true shooting, net rating): they are an overview, not a category's view. Each board's "All →" opens the leaderboard on the board metric's primary category, sorted by it.

### Views saved by 1.3.0

A saved view holds the board (`LeaderboardBoard`): its kind, tab, columns, sort and mode. **No family preset is saved**: the preset menu works it out from the columns (`familyOf`). So every 1.3.0 view opens with the same columns and sort as before. A player view's tab (All, G, F, C) is still the position; a team view's tab (`offense`, `defense`) opens the Offense or Defense category with its saved columns. A view whose columns were a family preset reads as custom columns, since no category preset is the same list; nothing is lost. T1702.3 adds the category (and sub-group) to the board as optional fields, absent in older views, as `split` and `favouritesOnly` were added. Metrics a view names keep their ids, whatever their labels become.

## What is coming

- **T1701's attributes** (position, height, weight, age, birth date, country, school, draft, jersey, the combine, a college player's class) are **filters, not metrics**: they get no category. The Filters control is its own component beside the category tabs. A metric filter ("at least 5 assists") chooses from the same category picker.
- **T1703's metrics** each arrive with their categories, and the test of T1702.2 fails a metric with none. Where they fit:
  - **BOBAN** and other published player ratings: Impact › Box-score models or Plus-minus models by how they are fitted, and Predictive › Player projections when they forecast; named as SportsDataverse's.
  - **Fantasy points**: Fantasy › Points, one metric a scoring system; ordinary metrics, nothing about rosters (D4).
  - **Computed metrics** go by what they measure, like every other: a new rate of shooting is Shooting, an estimated defensive metric Defense › Impact.
  - **Predictive metrics with no published formula** (T1703.4, Metis's estimates): Predictive › Player projections, or Season forecast for teams; a game forecast would be a new sub-group, Game forecasts.
  - A new sub-group is a change to the registry, reviewed with the PR that needs it; a sub-group past 40 metrics a kind and side splits.
- **The audit** of T1703.1 is `docs/reference/stats-gap-audit.md`.

## Open decisions for the manager

1. **Opponents' defensive acts in Offense** (hard case 4), rather than every opponents' metric in Defense.
2. **The list changed from the manager's starting one:** Overview is a preset; Tracking and movement is not a category (hard case 7, Movement in Playing time); On court is a sub-group of Impact (hard case 2); Availability is in Playing time (hard case 10); Fouls is added (hard case 5); "Team results and strength" is Results and strength, since players have a record too. Fourteen categories, of which a screen shows at most 12 today.
3. **Positions** stay as a control beside the category tabs on the players' board.
4. **The primary category** is the first listed, the one the Glossary describes a metric under.
5. **The appendix** below is generated from the catalogue by a script kept out of the repository for this part (`classify.mjs` and `gen.mjs`, in the worktree's ignored `.claude/`). Once T1702.2 puts the categories in the code, the appendix could be regenerated from the registry by a checked-in script, or dropped for the Glossary, which then shows the same. Which?
6. **The meanings** above are applied in T1702.2, or in a PR of their own after it, to keep T1702.2 small (it must merge before any metric is added).

## Counts

Generated from `CATALOGUE` on `main` at 3ac033b (1.3.0), each league read through `catalogueInfo` (`src/main/stats/engine/registry.ts`) as the screens read it. A metric counts in a league where it is not unavailable there; the games columns (`gp`, `team_gp`) are left out of the screen counts, as `appliesTo` leaves them out of the boards. NCAA Men and NCAA Women have the same metrics.

1515 metrics in the catalogue; 2 stored (`bpm_position`, `bpm_role`), placed nowhere since no screen shows them; 1513 placed; **0 unplaced**.

1313 metrics sit in more than one category; a metric sits in 1 to 3 categories, 1.90 on average.

9 placed metrics are in no league today (each reads unavailable with its reason): `gp`, `team_gp`, `sdv_darko_skill`, `sdv_darko_next`, `sdv_darko_sd`, `team_net_rank`, `team_quadrant1`, `team_poll_rank`, `team_tournament_seed`.

### By category and league

Metrics shown in each category; a metric in several categories counts in each, so the columns add up to more than the last row.

| Category             | NBA players | NBA teams | WNBA players | WNBA teams | NCAA Men players | NCAA Men teams | NCAA Women players | NCAA Women teams |
| -------------------- | ----------: | --------: | -----------: | ---------: | ---------------: | -------------: | -----------------: | ---------------: |
| Offense              |         560 |       281 |          299 |        277 |              227 |            220 |                227 |              220 |
| Defense              |         185 |       265 |           49 |        258 |               31 |            219 |                 31 |              219 |
| Scoring              |          46 |        65 |           33 |         65 |               21 |             56 |                 21 |               56 |
| Shooting             |         235 |       360 |          194 |        360 |              150 |            290 |                150 |              290 |
| Playmaking           |          82 |        56 |           37 |         54 |               30 |             49 |                 30 |               49 |
| Rebounding           |          54 |        22 |           22 |         18 |               16 |             14 |                 16 |               14 |
| Fouls                |          41 |        57 |           32 |         56 |               19 |             36 |                 19 |               36 |
| Hustle               |          19 |        15 |            – |          – |                – |              – |                  – |                – |
| Play types           |         234 |         – |            – |          – |                – |              – |                  – |                – |
| Impact               |          69 |        11 |           65 |         10 |               45 |              9 |                 45 |                9 |
| Predictive           |           – |        11 |            – |          8 |                – |              – |                  – |                – |
| Results and strength |           3 |        65 |            3 |         61 |                3 |             54 |                  3 |               54 |
| Playing time         |          14 |         – |            6 |          – |                5 |              – |                  5 |                – |
| Fantasy              |           – |         – |            – |          – |                – |              – |                  – |                – |
| Shown in the league  |         821 |       624 |          398 |        604 |              292 |            489 |                292 |              489 |

### By sub-group

The most metrics any sub-group shows in one view: players, and teams as the team's own / its opponents' (one side each). NCAA Women equals NCAA Men. Over 40 in bold: only the umbrellas' headings, which open the specific sub-groups.

| Category             | Sub-group                           |   NBA P |       NBA T |  WNBA P |      WNBA T |  NCAA P |      NCAA T |
| -------------------- | ----------------------------------- | ------: | ----------: | ------: | ----------: | ------: | ----------: |
| Offense              | Scoring                             |  **46** |  **43** / – |      33 |  **43** / – |      21 |      32 / – |
| Offense              | Shooting                            | **228** | **174** / 1 | **187** | **174** / 1 | **143** | **137** / 2 |
| Offense              | Playmaking                          |  **50** |       7 / – |      15 |       7 / – |      11 |       4 / – |
| Offense              | Turnovers                           |      31 |      21 / 1 |      23 |      21 / 1 |      20 |      20 / 1 |
| Offense              | Rebounding                          |      15 |       4 / 1 |       7 |       4 / 1 |       5 |       3 / 1 |
| Offense              | Fouls drawn                         |      19 |       9 / 9 |      11 |       9 / 9 |       9 |       9 / 3 |
| Offense              | Usage                               |       6 |           – |       6 |           – |       4 |           – |
| Offense              | Hustle                              |       4 |       4 / – |       – |           – |       – |           – |
| Offense              | Play types                          | **143** |           – |       – |           – |       – |           – |
| Offense              | Impact                              |      18 |       2 / – |      17 |       2 / – |      14 |       2 / – |
| Offense              | Ratings                             |       – |       5 / – |       – |       5 / – |       – |       6 / – |
| Defense              | Steals and blocks                   |      12 |       2 / – |      12 |       2 / – |      11 |       3 / – |
| Defense              | Defended shots                      |       6 |       3 / – |       – |           – |       – |           – |
| Defense              | Matchups                            |      26 |           – |       – |           – |       – |           – |
| Defense              | Rebounding                          |      15 |       4 / 2 |       7 |       4 / 2 |       5 |       3 / 1 |
| Defense              | Fouls and violations                |      11 |       9 / 9 |      11 |       9 / 9 |       4 |       3 / 9 |
| Defense              | Hustle                              |       4 |       4 / – |       – |           – |       – |           – |
| Defense              | Play types                          |  **91** |           – |       – |           – |       – |           – |
| Defense              | Impact                              |      20 |       1 / 2 |      19 |       1 / 2 |      11 |       1 / 2 |
| Defense              | Scoring allowed                     |       – |      – / 28 |       – |      – / 28 |       – |      – / 30 |
| Defense              | Shooting allowed                    |       – | – / **171** |       – | – / **171** |       – | – / **137** |
| Defense              | Playmaking allowed                  |       – |       – / 4 |       – |       – / 4 |       – |       – / 4 |
| Defense              | Turnovers forced                    |       – |      – / 21 |       – |      – / 21 |       – |      – / 20 |
| Defense              | Ratings                             |       – |       4 / 1 |       – |       4 / 1 |       – |       4 / 2 |
| Scoring              | Points                              |       1 |       1 / 1 |       1 |       1 / 1 |       1 |       1 / 1 |
| Scoring              | Points by shot                      |      10 |      10 / 6 |      10 |      10 / 6 |       6 |       6 / 6 |
| Scoring              | Points by situation                 |      20 |     13 / 10 |       7 |     13 / 10 |       3 |       9 / 9 |
| Scoring              | Assisted and unassisted             |      13 |      14 / 8 |      13 |      14 / 8 |      10 |     11 / 11 |
| Scoring              | Starters and bench                  |       – |       2 / – |       – |       2 / – |       – |       2 / – |
| Scoring              | Share of team                       |       2 |           – |       2 |           – |       1 |           – |
| Shooting             | Field goals                         |       6 |       5 / 6 |       6 |       5 / 6 |       5 |       5 / 6 |
| Shooting             | Twos                                |       4 |       4 / 4 |       4 |       4 / 4 |       4 |       4 / 4 |
| Shooting             | Threes                              |       4 |       4 / 4 |       4 |       4 / 4 |       4 |       4 / 4 |
| Shooting             | Free throws                         |      15 |     16 / 16 |      15 |     16 / 16 |      15 |     15 / 15 |
| Shooting             | Efficiency                          |      13 |     12 / 11 |      12 |     12 / 11 |      10 |     10 / 10 |
| Shooting             | Shot selection                      |       6 |       6 / 4 |       6 |       6 / 4 |       4 |       4 / 4 |
| Shooting             | Share of team                       |      13 |           – |      13 |           – |       6 |           – |
| Shooting             | Restricted area and paint           |      18 |     18 / 18 |      18 |     18 / 18 |      18 |     18 / 19 |
| Shooting             | Mid-range                           |       9 |       9 / 9 |       9 |       9 / 9 |      10 |     10 / 10 |
| Shooting             | Corner threes                       |      27 |     27 / 27 |      27 |     27 / 27 |      24 |     24 / 24 |
| Shooting             | Above the break and backcourt       |      18 |     18 / 18 |      18 |     18 / 18 |      16 |     16 / 16 |
| Shooting             | Distances                           |      32 |     32 / 32 |      32 |     32 / 32 |      32 |     32 / 32 |
| Shooting             | Shot types                          |      30 |     30 / 30 |      30 |     30 / 30 |       – |           – |
| Shooting             | Catch-and-shoot and pull-up         |      16 |           – |       – |           – |       – |           – |
| Shooting             | Drives and touches                  |      24 |           – |       – |           – |       – |           – |
| Shooting             | Transition and putbacks             |       – |           – |       – |           – |       2 |       2 / 2 |
| Playmaking           | Passing                             |      35 |       7 / 4 |      14 |       7 / 4 |      10 |       4 / 4 |
| Playmaking           | Creation                            |       8 |       3 / 1 |       1 |       1 / 1 |       1 |       1 / 1 |
| Playmaking           | Ball handling                       |       9 |           – |       – |           – |       – |           – |
| Playmaking           | Turnovers                           |      30 |     20 / 21 |      22 |     20 / 21 |      19 |     19 / 20 |
| Rebounding           | Offensive                           |      16 |       5 / 3 |       8 |       5 / 3 |       6 |       4 / 2 |
| Rebounding           | Defensive                           |      15 |       4 / 1 |       7 |       4 / 1 |       5 |       3 / 1 |
| Rebounding           | All rebounds                        |      15 |       4 / 1 |       7 |       4 / 1 |       5 |       3 / 1 |
| Rebounding           | Box outs                            |       8 |       4 / – |       – |           – |       – |           – |
| Fouls                | Committed                           |      13 |     11 / 11 |      13 |     11 / 11 |       9 |       8 / 8 |
| Fouls                | Drawn                               |      20 |      10 / 9 |      11 |       9 / 9 |       9 |       9 / 9 |
| Fouls                | Violations                          |       3 |       3 / 3 |       3 |       3 / 3 |       – |           – |
| Fouls                | Flagrants, technicals and ejections |       5 |       5 / 5 |       5 |       5 / 5 |       1 |       1 / 1 |
| Hustle               | Contests                            |       3 |       3 / – |       – |           – |       – |           – |
| Hustle               | Loose balls and deflections         |       5 |       5 / – |       – |           – |       – |           – |
| Hustle               | Charges                             |       1 |       1 / – |       – |           – |       – |           – |
| Hustle               | Screens                             |       2 |       2 / – |       – |           – |       – |           – |
| Hustle               | Box outs                            |       8 |       4 / – |       – |           – |       – |           – |
| Play types           | Isolation                           |      13 |           – |       – |           – |       – |           – |
| Play types           | Transition                          |      13 |           – |       – |           – |       – |           – |
| Play types           | Pick-and-roll ball handler          |      13 |           – |       – |           – |       – |           – |
| Play types           | Pick-and-roll roll man              |      13 |           – |       – |           – |       – |           – |
| Play types           | Post-up                             |      13 |           – |       – |           – |       – |           – |
| Play types           | Spot-up                             |      13 |           – |       – |           – |       – |           – |
| Play types           | Handoff                             |      13 |           – |       – |           – |       – |           – |
| Play types           | Cut                                 |      13 |           – |       – |           – |       – |           – |
| Play types           | Off screen                          |      13 |           – |       – |           – |       – |           – |
| Play types           | Putbacks                            |      13 |           – |       – |           – |       – |           – |
| Play types           | Miscellaneous                       |      13 |           – |       – |           – |       – |           – |
| Play types           | Isolation defense                   |      13 |           – |       – |           – |       – |           – |
| Play types           | Pick-and-roll ball handler defense  |      13 |           – |       – |           – |       – |           – |
| Play types           | Pick-and-roll roll man defense      |      13 |           – |       – |           – |       – |           – |
| Play types           | Post-up defense                     |      13 |           – |       – |           – |       – |           – |
| Play types           | Spot-up defense                     |      13 |           – |       – |           – |       – |           – |
| Play types           | Handoff defense                     |      13 |           – |       – |           – |       – |           – |
| Play types           | Off screen defense                  |      13 |           – |       – |           – |       – |           – |
| Impact               | On court                            |      31 |           – |      31 |           – |      17 |           – |
| Impact               | Plus-minus models                   |       6 |           – |       6 |           – |       6 |           – |
| Impact               | Box-score models                    |      17 |       4 / – |      13 |       3 / – |       8 |       3 / – |
| Impact               | Box-score composites                |       4 |       4 / 2 |       4 |       4 / 2 |       3 |       3 / 2 |
| Impact               | Individual ratings                  |       7 |       1 / – |       7 |       1 / – |       7 |       1 / – |
| Impact               | All-around games                    |       4 |           – |       4 |           – |       4 |           – |
| Predictive           | Season forecast                     |       – |      11 / – |       – |       8 / – |       – |           – |
| Predictive           | Player projections                  |       – |           – |       – |           – |       – |           – |
| Results and strength | Record                              |       3 |       3 / – |       3 |       3 / – |       3 |       3 / – |
| Results and strength | Margin                              |       – |       2 / – |       – |       2 / – |       – |       2 / – |
| Results and strength | Efficiency and pace                 |       – |      19 / 2 |       – |      18 / 2 |       – |      10 / 4 |
| Results and strength | Adjusted ratings                    |       – |       6 / – |       – |       6 / – |       – |      13 / – |
| Results and strength | Elo                                 |       – |       3 / – |       – |       3 / – |       – |       3 / – |
| Results and strength | Pythagorean                         |       – |       4 / – |       – |       4 / – |       – |       4 / – |
| Results and strength | Schedule                            |       – |       2 / – |       – |       2 / – |       – |       2 / – |
| Results and strength | Game flow                           |       – |       8 / 5 |       – |       8 / 5 |       – |       8 / 5 |
| Results and strength | Forecast                            |       – |      11 / – |       – |       8 / – |       – |           – |
| Results and strength | Rankings and seeds                  |       – |           – |       – |           – |       – |           – |
| Playing time         | Games and minutes                   |       3 |           – |       3 |           – |       3 |           – |
| Playing time         | Possessions                         |       3 |           – |       3 |           – |       2 |           – |
| Playing time         | Movement                            |       6 |           – |       – |           – |       – |           – |
| Playing time         | Games missed                        |       2 |           – |       – |           – |       – |           – |

## Appendix: every metric

Every catalogue metric, by family (the source), with its categories and sub-group in order, the primary first. Who: the player's, the team's own, or its opponents' (`opp`). Leagues: N the NBA, W the WNBA, M NCAA Men, F NCAA Women, · where the league does not have it.

### traditional (87)

| Metric            | Label                           | Who    | Leagues | Categories                                         |
| ----------------- | ------------------------------- | ------ | ------- | -------------------------------------------------- |
| `gp`              | Games played                    | player | NWMF    | Playing time › Games and minutes                   |
| `gs`              | Games started                   | player | NWMF    | Playing time › Games and minutes                   |
| `min`             | Minutes                         | player | NWMF    | Playing time › Games and minutes                   |
| `w`               | Wins                            | player | NWMF    | Results and strength › Record                      |
| `l`               | Losses                          | player | NWMF    | Results and strength › Record                      |
| `win_pct`         | Win percentage                  | player | NWMF    | Results and strength › Record                      |
| `team_gp`         | Games played                    | team   | NWMF    | Playing time › Games and minutes                   |
| `team_w`          | Wins                            | team   | NWMF    | Results and strength › Record                      |
| `team_l`          | Losses                          | team   | NWMF    | Results and strength › Record                      |
| `team_win_pct`    | Win percentage                  | team   | NWMF    | Results and strength › Record                      |
| `team_pts`        | Points                          | team   | NWMF    | Scoring › Points; Offense › Scoring                |
| `opp_pts`         | Points allowed                  | opp    | NWMF    | Scoring › Points; Defense › Scoring allowed        |
| `team_point_diff` | Point differential              | team   | NWMF    | Results and strength › Margin                      |
| `pts`             | Points                          | player | NWMF    | Scoring › Points; Offense › Scoring                |
| `fgm`             | Field goals made                | player | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `team_fgm`        | Field goals made                | team   | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `opp_fgm`         | Opponent field goals made       | opp    | NWMF    | Shooting › Field goals; Defense › Shooting allowed |
| `fga`             | Field-goal attempts             | player | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `team_fga`        | Field-goal attempts             | team   | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `opp_fga`         | Opponent field-goal attempts    | opp    | NWMF    | Shooting › Field goals; Defense › Shooting allowed |
| `fg_pct`          | Field-goal percentage           | player | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `team_fg_pct`     | Field-goal percentage           | team   | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `opp_fg_pct`      | Opponent field-goal percentage  | opp    | NWMF    | Shooting › Field goals; Defense › Shooting allowed |
| `fg_miss`         | Missed field goals              | player | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `team_fg_miss`    | Missed field goals              | team   | NWMF    | Shooting › Field goals; Offense › Shooting         |
| `opp_fg_miss`     | Opponent missed field goals     | opp    | NWMF    | Shooting › Field goals; Defense › Shooting allowed |
| `fg2m`            | Twos made                       | player | NWMF    | Shooting › Twos; Offense › Shooting                |
| `team_fg2m`       | Twos made                       | team   | NWMF    | Shooting › Twos; Offense › Shooting                |
| `opp_fg2m`        | Opponent twos made              | opp    | NWMF    | Shooting › Twos; Defense › Shooting allowed        |
| `fg2a`            | Two-point attempts              | player | NWMF    | Shooting › Twos; Offense › Shooting                |
| `team_fg2a`       | Two-point attempts              | team   | NWMF    | Shooting › Twos; Offense › Shooting                |
| `opp_fg2a`        | Opponent two-point attempts     | opp    | NWMF    | Shooting › Twos; Defense › Shooting allowed        |
| `fg2_pct`         | Two-point percentage            | player | NWMF    | Shooting › Twos; Offense › Shooting                |
| `team_fg2_pct`    | Two-point percentage            | team   | NWMF    | Shooting › Twos; Offense › Shooting                |
| `opp_fg2_pct`     | Opponent two-point percentage   | opp    | NWMF    | Shooting › Twos; Defense › Shooting allowed        |
| `fg3m`            | Threes made                     | player | NWMF    | Shooting › Threes; Offense › Shooting              |
| `team_fg3m`       | Threes made                     | team   | NWMF    | Shooting › Threes; Offense › Shooting              |
| `opp_fg3m`        | Opponent threes made            | opp    | NWMF    | Shooting › Threes; Defense › Shooting allowed      |
| `fg3a`            | Three-point attempts            | player | NWMF    | Shooting › Threes; Offense › Shooting              |
| `team_fg3a`       | Three-point attempts            | team   | NWMF    | Shooting › Threes; Offense › Shooting              |
| `opp_fg3a`        | Opponent three-point attempts   | opp    | NWMF    | Shooting › Threes; Defense › Shooting allowed      |
| `fg3_pct`         | Three-point percentage          | player | NWMF    | Shooting › Threes; Offense › Shooting              |
| `team_fg3_pct`    | Three-point percentage          | team   | NWMF    | Shooting › Threes; Offense › Shooting              |
| `opp_fg3_pct`     | Opponent three-point percentage | opp    | NWMF    | Shooting › Threes; Defense › Shooting allowed      |
| `ftm`             | Free throws made                | player | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `team_ftm`        | Free throws made                | team   | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `opp_ftm`         | Opponent free throws made       | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed |
| `fta`             | Free-throw attempts             | player | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `team_fta`        | Free-throw attempts             | team   | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `opp_fta`         | Opponent free-throw attempts    | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed |
| `ft_pct`          | Free-throw percentage           | player | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `team_ft_pct`     | Free-throw percentage           | team   | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `opp_ft_pct`      | Opponent free-throw percentage  | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed |
| `ft_miss`         | Missed free throws              | player | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `team_ft_miss`    | Missed free throws              | team   | NWMF    | Shooting › Free throws; Offense › Shooting         |
| `opp_ft_miss`     | Opponent missed free throws     | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed |
| `oreb`            | Offensive rebounds              | player | NWMF    | Rebounding › Offensive; Offense › Rebounding       |
| `team_oreb`       | Offensive rebounds              | team   | NWMF    | Rebounding › Offensive; Offense › Rebounding       |
| `opp_oreb`        | Opponent offensive rebounds     | opp    | NWMF    | Rebounding › Offensive; Defense › Rebounding       |
| `dreb`            | Defensive rebounds              | player | NWMF    | Rebounding › Defensive; Defense › Rebounding       |
| `team_dreb`       | Defensive rebounds              | team   | NWMF    | Rebounding › Defensive; Defense › Rebounding       |
| `opp_dreb`        | Opponent defensive rebounds     | opp    | NWMF    | Rebounding › Defensive; Offense › Rebounding       |
| `reb`             | Rebounds                        | player | NWMF    | Rebounding › All rebounds                          |
| `team_reb`        | Rebounds                        | team   | NWMF    | Rebounding › All rebounds                          |
| `opp_reb`         | Opponent rebounds               | opp    | NWMF    | Rebounding › All rebounds                          |
| `ast`             | Assists                         | player | NWMF    | Playmaking › Passing; Offense › Playmaking         |
| `team_ast`        | Assists                         | team   | NWMF    | Playmaking › Passing; Offense › Playmaking         |
| `opp_ast`         | Opponent assists                | opp    | NWMF    | Playmaking › Passing; Defense › Playmaking allowed |
| `tov`             | Turnovers                       | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers        |
| `team_tov`        | Turnovers                       | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers        |
| `opp_tov`         | Opponent turnovers              | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced |
| `stl`             | Steals                          | player | NWMF    | Defense › Steals and blocks                        |
| `team_stl`        | Steals                          | team   | NWMF    | Defense › Steals and blocks                        |
| `opp_stl`         | Opponent steals                 | opp    | NWMF    | Offense › Turnovers; Playmaking › Turnovers        |
| `blk`             | Blocks                          | player | NWMF    | Defense › Steals and blocks                        |
| `team_blk`        | Blocks                          | team   | NWMF    | Defense › Steals and blocks                        |
| `opp_blk`         | Opponent blocks                 | opp    | NWMF    | Offense › Shooting; Shooting › Field goals         |
| `pf`              | Personal fouls                  | player | NWMF    | Fouls › Committed; Defense › Fouls and violations  |
| `team_pf`         | Personal fouls                  | team   | NWMF    | Fouls › Committed; Defense › Fouls and violations  |
| `opp_pf`          | Opponent personal fouls         | opp    | NWMF    | Fouls › Committed; Offense › Fouls drawn           |
| `plus_minus`      | Plus-minus                      | player | NW··    | Impact › On court                                  |
| `dd2`             | Double-doubles                  | player | NWMF    | Impact › All-around games                          |
| `td3`             | Triple-doubles                  | player | NWMF    | Impact › All-around games                          |
| `qd4`             | Quadruple-doubles               | player | NWMF    | Impact › All-around games                          |
| `five_by_five`    | Five-by-fives                   | player | NWMF    | Impact › All-around games                          |
| `nba_blka`        | Shots blocked (NBA)             | player | NW··    | Shooting › Field goals; Offense › Shooting         |
| `nba_pfd`         | Fouls drawn (NBA)               | player | NW··    | Fouls › Drawn; Offense › Fouls drawn               |

### shooting (89)

| Metric                | Label                                          | Who    | Leagues | Categories                                                                         |
| --------------------- | ---------------------------------------------- | ------ | ------- | ---------------------------------------------------------------------------------- |
| `efg_pct`             | Effective field-goal percentage                | player | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_efg_pct`        | Effective field-goal percentage                | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `opp_efg_pct`         | Opponent effective field-goal percentage       | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `tsa`                 | True shooting attempts                         | player | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_tsa`            | True shooting attempts                         | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `opp_tsa`             | Opponent true shooting attempts                | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `ts_pct`              | True shooting percentage                       | player | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_ts_pct`         | True shooting percentage                       | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `opp_ts_pct`          | Opponent true shooting percentage              | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `pts_per_tsa`         | Points per true shooting attempt               | player | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_pts_per_tsa`    | Points per true shooting attempt               | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `opp_pts_per_tsa`     | Opponent points per true shooting attempt      | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `fg_pts_per_fga`      | Field-goal points per attempt                  | player | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_fg_pts_per_fga` | Field-goal points per attempt                  | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `opp_fg_pts_per_fga`  | Opponent field-goal points per attempt         | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `pts_per_fga`         | Points per field-goal attempt                  | player | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_pts_per_fga`    | Points per field-goal attempt                  | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                                          |
| `opp_pts_per_fga`     | Opponent points per field-goal attempt         | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `fg3a_rate`           | Three-point attempt rate                       | player | NWMF    | Shooting › Shot selection; Offense › Shooting                                      |
| `team_fg3a_rate`      | Three-point attempt rate                       | team   | NWMF    | Shooting › Shot selection; Offense › Shooting                                      |
| `opp_fg3a_rate`       | Opponent three-point attempt rate              | opp    | NWMF    | Shooting › Shot selection; Defense › Shooting allowed                              |
| `fg2a_rate`           | Two-point attempt rate                         | player | NWMF    | Shooting › Shot selection; Offense › Shooting                                      |
| `team_fg2a_rate`      | Two-point attempt rate                         | team   | NWMF    | Shooting › Shot selection; Offense › Shooting                                      |
| `opp_fg2a_rate`       | Opponent two-point attempt rate                | opp    | NWMF    | Shooting › Shot selection; Defense › Shooting allowed                              |
| `fta_rate`            | Free-throw attempt rate                        | player | NWMF    | Shooting › Free throws; Offense › Shooting                                         |
| `team_fta_rate`       | Free-throw attempt rate                        | team   | NWMF    | Shooting › Free throws; Offense › Shooting                                         |
| `opp_fta_rate`        | Opponent free-throw attempt rate               | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed                                 |
| `ftm_per_fga`         | Free throws made per attempt                   | player | NWMF    | Shooting › Free throws; Offense › Shooting                                         |
| `team_ftm_per_fga`    | Free throws made per attempt                   | team   | NWMF    | Shooting › Free throws; Offense › Shooting                                         |
| `opp_ftm_per_fga`     | Opponent free throws made per attempt          | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed                                 |
| `ast_tov`             | Assist-to-turnover ratio                       | player | NWMF    | Playmaking › Passing; Offense › Playmaking                                         |
| `team_ast_tov`        | Assist-to-turnover ratio                       | team   | NWMF    | Playmaking › Passing; Offense › Playmaking                                         |
| `opp_ast_tov`         | Opponent assist-to-turnover ratio              | opp    | NWMF    | Playmaking › Passing; Defense › Playmaking allowed                                 |
| `ast_ratio`           | Assist ratio                                   | player | NWMF    | Playmaking › Passing; Offense › Playmaking                                         |
| `team_ast_ratio`      | Assist ratio                                   | team   | NWMF    | Playmaking › Passing; Offense › Playmaking                                         |
| `opp_ast_ratio`       | Opponent assist ratio                          | opp    | NWMF    | Playmaking › Passing; Defense › Playmaking allowed                                 |
| `tov_pct`             | Turnover percentage                            | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                                        |
| `team_tov_pct`        | Turnover percentage                            | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                                        |
| `opp_tov_pct`         | Opponent turnover percentage                   | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                                 |
| `ast_pct`             | Assist percentage                              | player | NWMF    | Playmaking › Passing; Offense › Playmaking                                         |
| `orb_pct`             | Offensive rebound percentage                   | player | NWMF    | Rebounding › Offensive; Offense › Rebounding                                       |
| `drb_pct`             | Defensive rebound percentage                   | player | NWMF    | Rebounding › Defensive; Defense › Rebounding                                       |
| `trb_pct`             | Total rebound percentage                       | player | NWMF    | Rebounding › All rebounds                                                          |
| `stl_pct`             | Steal percentage                               | player | NWMF    | Defense › Steals and blocks                                                        |
| `blk_pct`             | Block percentage                               | player | NWMF    | Defense › Steals and blocks                                                        |
| `usg_pct`             | Usage percentage                               | player | NWMF    | Offense › Usage                                                                    |
| `team_ast_share`      | Assisted field goals                           | team   | NWMF    | Scoring › Assisted and unassisted; Playmaking › Passing; Offense › Scoring         |
| `opp_ast_share`       | Opponent assisted field goals                  | opp    | NWMF    | Scoring › Assisted and unassisted; Playmaking › Passing; Defense › Scoring allowed |
| `team_orb_pct`        | Offensive rebound percentage                   | team   | NWMF    | Rebounding › Offensive; Offense › Rebounding                                       |
| `team_drb_pct`        | Defensive rebound percentage                   | team   | NWMF    | Rebounding › Defensive; Defense › Rebounding                                       |
| `team_trb_pct`        | Total rebound percentage                       | team   | NWMF    | Rebounding › All rebounds                                                          |
| `nba_ast_pct`         | Assist percentage (NBA)                        | player | NW··    | Playmaking › Passing; Offense › Playmaking                                         |
| `nba_ast_to`          | Assists per turnover (NBA)                     | player | NW··    | Playmaking › Passing; Offense › Playmaking                                         |
| `nba_ast_ratio`       | Assist ratio (NBA)                             | player | NW··    | Playmaking › Passing; Offense › Playmaking                                         |
| `nba_oreb_pct`        | Offensive rebound percentage (NBA)             | player | NW··    | Rebounding › Offensive; Offense › Rebounding                                       |
| `nba_dreb_pct`        | Defensive rebound percentage (NBA)             | player | NW··    | Rebounding › Defensive; Defense › Rebounding                                       |
| `nba_reb_pct`         | Rebound percentage (NBA)                       | player | NW··    | Rebounding › All rebounds                                                          |
| `nba_efg_pct`         | Effective field-goal percentage (NBA)          | player | NW··    | Shooting › Efficiency; Offense › Shooting                                          |
| `nba_ts_pct`          | True shooting percentage (NBA)                 | player | NW··    | Shooting › Efficiency; Offense › Shooting                                          |
| `nba_tov_ratio`       | Turnover ratio (NBA)                           | player | NW··    | Playmaking › Turnovers; Offense › Turnovers                                        |
| `nba_e_tov_ratio`     | Estimated turnover ratio (NBA)                 | player | NW··    | Playmaking › Turnovers; Offense › Turnovers                                        |
| `nba_usg_pct`         | Usage percentage (NBA)                         | player | NW··    | Offense › Usage                                                                    |
| `nba_e_usg_pct`       | Estimated usage percentage (NBA)               | player | NW··    | Offense › Usage                                                                    |
| `team_nba_ast_pct`    | Assist percentage (NBA)                        | team   | NW··    | Playmaking › Passing; Offense › Playmaking                                         |
| `team_nba_ast_to`     | Assists per turnover (NBA)                     | team   | NW··    | Playmaking › Passing; Offense › Playmaking                                         |
| `team_nba_ast_ratio`  | Assist ratio (NBA)                             | team   | NW··    | Playmaking › Passing; Offense › Playmaking                                         |
| `team_nba_oreb_pct`   | Offensive rebound percentage (NBA)             | team   | NW··    | Rebounding › Offensive; Offense › Rebounding                                       |
| `team_nba_dreb_pct`   | Defensive rebound percentage (NBA)             | team   | NW··    | Rebounding › Defensive; Defense › Rebounding                                       |
| `team_nba_reb_pct`    | Rebound percentage (NBA)                       | team   | NW··    | Rebounding › All rebounds                                                          |
| `team_nba_efg_pct`    | Effective field-goal percentage (NBA)          | team   | NW··    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_nba_ts_pct`     | True shooting percentage (NBA)                 | team   | NW··    | Shooting › Efficiency; Offense › Shooting                                          |
| `team_nba_tov_pct`    | Turnover percentage (NBA)                      | team   | NW··    | Playmaking › Turnovers; Offense › Turnovers                                        |
| `team_nba_fta_rate`   | Free-throw attempt rate (NBA)                  | team   | NW··    | Shooting › Free throws; Offense › Shooting                                         |
| `opp_nba_efg_pct`     | Opponent effective field-goal percentage (NBA) | opp    | NW··    | Shooting › Efficiency; Defense › Shooting allowed                                  |
| `opp_nba_fta_rate`    | Opponent free-throw attempt rate (NBA)         | opp    | NW··    | Shooting › Free throws; Defense › Shooting allowed                                 |
| `opp_nba_tov_pct`     | Opponent turnover percentage (NBA)             | opp    | NW··    | Playmaking › Turnovers; Defense › Turnovers forced                                 |
| `opp_nba_oreb_pct`    | Opponent offensive rebound percentage (NBA)    | opp    | NW··    | Rebounding › Offensive; Defense › Rebounding                                       |
| `ncaa_rim_pct`        | Field-goal percentage at the rim               | player | ··MF    | Shooting › Restricted area and paint; Offense › Shooting                           |
| `team_ncaa_rim_pct`   | Field-goal percentage at the rim               | team   | ··MF    | Shooting › Restricted area and paint; Offense › Shooting                           |
| `opp_ncaa_rim_pct`    | Opponent field-goal percentage at the rim      | opp    | ··MF    | Shooting › Restricted area and paint; Defense › Shooting allowed                   |
| `ncaa_rim_rate`       | Share of shots at the rim                      | player | ··MF    | Shooting › Restricted area and paint; Offense › Shooting                           |
| `team_ncaa_rim_rate`  | Share of shots at the rim                      | team   | ··MF    | Shooting › Restricted area and paint; Offense › Shooting                           |
| `opp_ncaa_rim_rate`   | Opponent share of shots at the rim             | opp    | ··MF    | Shooting › Restricted area and paint; Defense › Shooting allowed                   |
| `ncaa_mid_pct`        | Mid-range field-goal percentage                | player | ··MF    | Shooting › Mid-range; Offense › Shooting                                           |
| `team_ncaa_mid_pct`   | Mid-range field-goal percentage                | team   | ··MF    | Shooting › Mid-range; Offense › Shooting                                           |
| `opp_ncaa_mid_pct`    | Opponent mid-range field-goal percentage       | opp    | ··MF    | Shooting › Mid-range; Defense › Shooting allowed                                   |
| `ncaa_mid_rate`       | Share of shots from mid-range                  | player | ··MF    | Shooting › Mid-range; Offense › Shooting                                           |
| `team_ncaa_mid_rate`  | Share of shots from mid-range                  | team   | ··MF    | Shooting › Mid-range; Offense › Shooting                                           |
| `opp_ncaa_mid_rate`   | Opponent share of shots from mid-range         | opp    | ··MF    | Shooting › Mid-range; Defense › Shooting allowed                                   |

### possessions (36)

| Metric            | Label                                                | Who    | Leagues | Categories                                                    |
| ----------------- | ---------------------------------------------------- | ------ | ------- | ------------------------------------------------------------- |
| `team_poss`       | Possessions, simple estimate                         | team   | NWMF    | Results and strength › Efficiency and pace                    |
| `opp_poss`        | Opponent possessions, simple estimate                | opp    | NWMF    | Results and strength › Efficiency and pace                    |
| `team_poss_sym`   | Possessions per team                                 | team   | NWMF    | Results and strength › Efficiency and pace                    |
| `team_poss_bref`  | Possessions, rebound-adjusted                        | team   | NWMF    | Results and strength › Efficiency and pace                    |
| `team_ortg`       | Offensive rating                                     | team   | NWMF    | Results and strength › Efficiency and pace; Offense › Ratings |
| `team_drtg`       | Defensive rating                                     | team   | NWMF    | Results and strength › Efficiency and pace; Defense › Ratings |
| `team_nrtg`       | Net rating                                           | team   | NWMF    | Results and strength › Efficiency and pace                    |
| `team_pace`       | Pace                                                 | team   | NWMF    | Results and strength › Efficiency and pace                    |
| `team_pace40`     | Pace per 40                                          | team   | N···    | Results and strength › Efficiency and pace                    |
| `team_ppp`        | Points per possession                                | team   | NWMF    | Results and strength › Efficiency and pace; Offense › Ratings |
| `opp_ppp`         | Opponent points per possession                       | opp    | NWMF    | Results and strength › Efficiency and pace; Defense › Ratings |
| `player_on_poss`  | Possessions played                                   | player | NWMF    | Playing time › Possessions                                    |
| `nba_ortg`        | On-court offensive rating (NBA)                      | player | NW··    | Impact › On court; Offense › Impact                           |
| `nba_drtg`        | On-court defensive rating (NBA)                      | player | NW··    | Impact › On court; Defense › Impact                           |
| `nba_nrtg`        | On-court net rating (NBA)                            | player | NW··    | Impact › On court                                             |
| `nba_e_ortg`      | Estimated offensive rating (NBA)                     | player | NW··    | Impact › On court; Offense › Impact                           |
| `nba_e_drtg`      | Estimated defensive rating (NBA)                     | player | NW··    | Impact › On court; Defense › Impact                           |
| `nba_e_nrtg`      | Estimated net rating (NBA)                           | player | NW··    | Impact › On court                                             |
| `nba_pace`        | Pace (NBA)                                           | player | NW··    | Impact › On court                                             |
| `nba_pace40`      | Pace per 40 (NBA)                                    | player | NW··    | Impact › On court                                             |
| `nba_e_pace`      | Estimated pace (NBA)                                 | player | NW··    | Impact › On court                                             |
| `nba_poss`        | Possessions played (NBA)                             | player | NW··    | Playing time › Possessions                                    |
| `team_nba_ortg`   | Offensive rating (NBA)                               | team   | NW··    | Results and strength › Efficiency and pace; Offense › Ratings |
| `team_nba_drtg`   | Defensive rating (NBA)                               | team   | NW··    | Results and strength › Efficiency and pace; Defense › Ratings |
| `team_nba_nrtg`   | Net rating (NBA)                                     | team   | NW··    | Results and strength › Efficiency and pace                    |
| `team_nba_e_ortg` | Estimated offensive rating (NBA)                     | team   | NW··    | Results and strength › Efficiency and pace; Offense › Ratings |
| `team_nba_e_drtg` | Estimated defensive rating (NBA)                     | team   | NW··    | Results and strength › Efficiency and pace; Defense › Ratings |
| `team_nba_e_nrtg` | Estimated net rating (NBA)                           | team   | NW··    | Results and strength › Efficiency and pace                    |
| `team_nba_pace`   | Pace (NBA)                                           | team   | NW··    | Results and strength › Efficiency and pace                    |
| `team_nba_pace40` | Pace per 40 (NBA)                                    | team   | NW··    | Results and strength › Efficiency and pace                    |
| `team_nba_e_pace` | Estimated pace (NBA)                                 | team   | NW··    | Results and strength › Efficiency and pace                    |
| `team_nba_poss`   | Possessions (NBA)                                    | team   | NW··    | Results and strength › Efficiency and pace                    |
| `team_ncaa_poss`  | Possessions (stats.ncaa.org)                         | team   | ··MF    | Results and strength › Efficiency and pace                    |
| `opp_ncaa_poss`   | Opponent possessions (stats.ncaa.org)                | opp    | ··MF    | Results and strength › Efficiency and pace                    |
| `team_ncaa_rtg`   | Points per 100 possessions (stats.ncaa.org)          | team   | ··MF    | Results and strength › Efficiency and pace; Offense › Ratings |
| `opp_ncaa_rtg`    | Opponent points per 100 possessions (stats.ncaa.org) | opp    | ··MF    | Results and strength › Efficiency and pace; Defense › Ratings |

### on_court (24)

| Metric            | Label                                              | Who    | Leagues | Categories                                          |
| ----------------- | -------------------------------------------------- | ------ | ------- | --------------------------------------------------- |
| `onc_min`         | Minutes on court, from plays                       | player | NWMF    | Playing time › Games and minutes; Impact › On court |
| `onc_poss`        | Possessions on court                               | player | NWMF    | Playing time › Possessions; Impact › On court       |
| `onc_plus_minus`  | Plus-minus, from plays                             | player | NWMF    | Impact › On court                                   |
| `onc_ortg`        | Offensive rating, on court                         | player | NWMF    | Impact › On court; Offense › Impact                 |
| `onc_drtg`        | Defensive rating, on court                         | player | NWMF    | Impact › On court; Defense › Impact                 |
| `onc_net`         | Net rating, on court                               | player | NWMF    | Impact › On court                                   |
| `offc_ortg`       | Offensive rating, off court                        | player | NWMF    | Impact › On court; Offense › Impact                 |
| `offc_drtg`       | Defensive rating, off court                        | player | NWMF    | Impact › On court; Defense › Impact                 |
| `offc_net`        | Net rating, off court                              | player | NWMF    | Impact › On court                                   |
| `onoff_ortg`      | Offensive rating, on less off                      | player | NWMF    | Impact › On court; Offense › Impact                 |
| `onoff_drtg`      | Defensive rating, on less off                      | player | NWMF    | Impact › On court; Defense › Impact                 |
| `onoff_net`       | Net rating, on less off                            | player | NWMF    | Impact › On court                                   |
| `onc_pace`        | Pace, on court                                     | player | NWMF    | Impact › On court                                   |
| `onc_efg_pct`     | Effective field-goal percentage, on court          | player | NWMF    | Impact › On court; Offense › Impact                 |
| `onc_opp_efg_pct` | Opponent effective field-goal percentage, on court | player | NWMF    | Impact › On court; Defense › Impact                 |
| `onc_tm_tov_pct`  | Team turnover percentage, on court                 | player | NWMF    | Impact › On court; Offense › Impact                 |
| `onc_tm_orb_pct`  | Team offensive rebound percentage, on court        | player | NWMF    | Impact › On court; Offense › Impact                 |
| `onc_usg_pct`     | Usage, on court                                    | player | NWMF    | Offense › Usage                                     |
| `onc_ast_pct`     | Assist percentage, on court                        | player | NWMF    | Playmaking › Passing; Offense › Playmaking          |
| `onc_orb_pct`     | Offensive rebound percentage, on court             | player | NWMF    | Rebounding › Offensive; Offense › Rebounding        |
| `onc_drb_pct`     | Defensive rebound percentage, on court             | player | NWMF    | Rebounding › Defensive; Defense › Rebounding        |
| `onc_trb_pct`     | Total rebound percentage, on court                 | player | NWMF    | Rebounding › All rebounds                           |
| `onc_stl_pct`     | Steal percentage, on court                         | player | NWMF    | Defense › Steals and blocks                         |
| `onc_blk_pct`     | Block percentage, on court                         | player | NWMF    | Defense › Steals and blocks                         |

### scoring (137)

| Metric                       | Label                                                  | Who    | Leagues | Categories                                                                       |
| ---------------------------- | ------------------------------------------------------ | ------ | ------- | -------------------------------------------------------------------------------- |
| `pts_2pt`                    | Two-point scoring                                      | player | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_pts_2pt`               | Two-point scoring                                      | team   | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `opp_pts_2pt`                | Opponent two-point scoring                             | opp    | NWMF    | Scoring › Points by shot; Defense › Scoring allowed                              |
| `pts_3pt`                    | Three-point scoring                                    | player | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_pts_3pt`               | Three-point scoring                                    | team   | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `opp_pts_3pt`                | Opponent three-point scoring                           | opp    | NWMF    | Scoring › Points by shot; Defense › Scoring allowed                              |
| `pts_ft`                     | Free-throw scoring                                     | player | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_pts_ft`                | Free-throw scoring                                     | team   | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `opp_pts_ft`                 | Opponent free-throw scoring                            | opp    | NWMF    | Scoring › Points by shot; Defense › Scoring allowed                              |
| `share_pts_2pt`              | Share of points from twos                              | player | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_share_pts_2pt`         | Share of points from twos                              | team   | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `opp_share_pts_2pt`          | Opponent share of points from twos                     | opp    | NWMF    | Scoring › Points by shot; Defense › Scoring allowed                              |
| `share_pts_3pt`              | Share of points from threes                            | player | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_share_pts_3pt`         | Share of points from threes                            | team   | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `opp_share_pts_3pt`          | Opponent share of points from threes                   | opp    | NWMF    | Scoring › Points by shot; Defense › Scoring allowed                              |
| `share_pts_ft`               | Share of points from free throws                       | player | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_share_pts_ft`          | Share of points from free throws                       | team   | NWMF    | Scoring › Points by shot; Offense › Scoring                                      |
| `opp_share_pts_ft`           | Opponent share of points from free throws              | opp    | NWMF    | Scoring › Points by shot; Defense › Scoring allowed                              |
| `team_paint_pts`             | Points in the paint                                    | team   | NWMF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_paint_pts`              | Opponent points in the paint                           | opp    | NWMF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `team_fast_break_pts`        | Fast-break points                                      | team   | NWMF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_fast_break_pts`         | Opponent fast-break points                             | opp    | NWMF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `team_turnover_pts`          | Points off turnovers                                   | team   | NWMF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_turnover_pts`           | Opponent points off turnovers                          | opp    | NWMF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `team_share_pts_paint`       | Share of points in the paint                           | team   | NWMF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_share_pts_paint`        | Opponent share of points in the paint                  | opp    | NWMF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `team_share_pts_fb`          | Share of points on the fast break                      | team   | NWMF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_share_pts_fb`           | Opponent share of points on the fast break             | opp    | NWMF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `team_share_pts_tov`         | Share of points off turnovers                          | team   | NWMF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_share_pts_tov`          | Opponent share of points off turnovers                 | opp    | NWMF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `team_starter_pts`           | Starter points                                         | team   | NWMF    | Scoring › Starters and bench; Offense › Scoring                                  |
| `team_bench_pts`             | Bench points                                           | team   | NWMF    | Scoring › Starters and bench; Offense › Scoring                                  |
| `share_pts`                  | Share of team points                                   | player | NWMF    | Scoring › Share of team; Offense › Scoring                                       |
| `share_fgm`                  | Share of team field goals made                         | player | NWMF    | Shooting › Share of team; Offense › Shooting                                     |
| `share_fga`                  | Share of team field-goal attempts                      | player | NWMF    | Shooting › Share of team; Offense › Shooting                                     |
| `share_fg3m`                 | Share of team threes made                              | player | NWMF    | Shooting › Share of team; Offense › Shooting                                     |
| `share_fg3a`                 | Share of team three-point attempts                     | player | NWMF    | Shooting › Share of team; Offense › Shooting                                     |
| `share_ftm`                  | Share of team free throws made                         | player | NWMF    | Shooting › Share of team; Offense › Shooting                                     |
| `share_fta`                  | Share of team free-throw attempts                      | player | NWMF    | Shooting › Share of team; Offense › Shooting                                     |
| `share_oreb`                 | Share of team offensive rebounds                       | player | NWMF    | Rebounding › Offensive; Offense › Rebounding                                     |
| `share_dreb`                 | Share of team defensive rebounds                       | player | NWMF    | Rebounding › Defensive; Defense › Rebounding                                     |
| `share_reb`                  | Share of team rebounds                                 | player | NWMF    | Rebounding › All rebounds                                                        |
| `share_ast`                  | Share of team assists                                  | player | NWMF    | Playmaking › Passing; Offense › Playmaking                                       |
| `share_tov`                  | Share of team turnovers                                | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                                      |
| `share_stl`                  | Share of team steals                                   | player | NWMF    | Defense › Steals and blocks                                                      |
| `share_blk`                  | Share of team blocks                                   | player | NWMF    | Defense › Steals and blocks                                                      |
| `share_pf`                   | Share of team personal fouls                           | player | NWMF    | Fouls › Committed; Defense › Fouls and violations                                |
| `nba_pts_off_tov`            | Points off turnovers (NBA)                             | player | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `nba_on_opp_pts_off_tov`     | Opponent points off turnovers on court (NBA)           | player | NW··    | Impact › On court; Defense › Impact                                              |
| `team_nba_pts_off_tov`       | Points off turnovers (NBA)                             | team   | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_nba_pts_off_tov`        | Opponent points off turnovers (NBA)                    | opp    | NW··    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `nba_pts_2_nd_chance`        | Second-chance points (NBA)                             | player | NW··    | Scoring › Points by situation; Rebounding › Offensive; Offense › Scoring         |
| `nba_on_opp_pts_2_nd_chance` | Opponent second-chance points on court (NBA)           | player | NW··    | Impact › On court; Defense › Impact                                              |
| `team_nba_pts_2_nd_chance`   | Second-chance points (NBA)                             | team   | NW··    | Scoring › Points by situation; Rebounding › Offensive; Offense › Scoring         |
| `opp_nba_pts_2_nd_chance`    | Opponent second-chance points (NBA)                    | opp    | NW··    | Scoring › Points by situation; Rebounding › Offensive; Defense › Scoring allowed |
| `nba_pts_fb`                 | Fast-break points (NBA)                                | player | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `nba_on_opp_pts_fb`          | Opponent fast-break points on court (NBA)              | player | NW··    | Impact › On court; Defense › Impact                                              |
| `team_nba_pts_fb`            | Fast-break points (NBA)                                | team   | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_nba_pts_fb`             | Opponent fast-break points (NBA)                       | opp    | NW··    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `nba_pts_paint`              | Points in the paint (NBA)                              | player | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `nba_on_opp_pts_paint`       | Opponent points in the paint on court (NBA)            | player | NW··    | Impact › On court; Defense › Impact                                              |
| `team_nba_pts_paint`         | Points in the paint (NBA)                              | team   | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_nba_pts_paint`          | Opponent points in the paint (NBA)                     | opp    | NW··    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `nba_share_fga_2pt`          | Share of attempts from two (NBA)                       | player | NW··    | Shooting › Shot selection; Offense › Shooting                                    |
| `team_nba_share_fga_2pt`     | Share of attempts from two (NBA)                       | team   | NW··    | Shooting › Shot selection; Offense › Shooting                                    |
| `nba_share_fga_3pt`          | Share of attempts from three (NBA)                     | player | NW··    | Shooting › Shot selection; Offense › Shooting                                    |
| `team_nba_share_fga_3pt`     | Share of attempts from three (NBA)                     | team   | NW··    | Shooting › Shot selection; Offense › Shooting                                    |
| `nba_share_pts_2pt`          | Share of points from twos (NBA)                        | player | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_nba_share_pts_2pt`     | Share of points from twos (NBA)                        | team   | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `nba_share_pts_mid`          | Share of points from midrange (NBA)                    | player | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_nba_share_pts_mid`     | Share of points from midrange (NBA)                    | team   | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `nba_share_pts_3pt`          | Share of points from threes (NBA)                      | player | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_nba_share_pts_3pt`     | Share of points from threes (NBA)                      | team   | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `nba_share_pts_ft`           | Share of points from free throws (NBA)                 | player | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `team_nba_share_pts_ft`      | Share of points from free throws (NBA)                 | team   | NW··    | Scoring › Points by shot; Offense › Scoring                                      |
| `nba_share_pts_fb`           | Share of points on the fast break (NBA)                | player | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `team_nba_share_pts_fb`      | Share of points on the fast break (NBA)                | team   | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `nba_share_pts_off_tov`      | Share of points off turnovers (NBA)                    | player | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `team_nba_share_pts_off_tov` | Share of points off turnovers (NBA)                    | team   | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `nba_share_pts_paint`        | Share of points in the paint (NBA)                     | player | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `team_nba_share_pts_paint`   | Share of points in the paint (NBA)                     | team   | NW··    | Scoring › Points by situation; Offense › Scoring                                 |
| `nba_share_ast_2pm`          | Assisted share of made twos (NBA)                      | player | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_nba_share_ast_2pm`     | Assisted share of made twos (NBA)                      | team   | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `nba_share_uast_2pm`         | Unassisted share of made twos (NBA)                    | player | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_nba_share_uast_2pm`    | Unassisted share of made twos (NBA)                    | team   | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `nba_share_ast_3pm`          | Assisted share of made threes (NBA)                    | player | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_nba_share_ast_3pm`     | Assisted share of made threes (NBA)                    | team   | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `nba_share_uast_3pm`         | Unassisted share of made threes (NBA)                  | player | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_nba_share_uast_3pm`    | Unassisted share of made threes (NBA)                  | team   | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `nba_share_ast_fgm`          | Assisted share of field goals (NBA)                    | player | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_nba_share_ast_fgm`     | Assisted share of field goals (NBA)                    | team   | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `nba_share_uast_fgm`         | Unassisted share of field goals (NBA)                  | player | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_nba_share_uast_fgm`    | Unassisted share of field goals (NBA)                  | team   | NW··    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `nba_share_fgm`              | Share of team field goals made on court (NBA)          | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_fga`              | Share of team field-goal attempts on court (NBA)       | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_fg3m`             | Share of team threes made on court (NBA)               | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_fg3a`             | Share of team three-point attempts on court (NBA)      | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_ftm`              | Share of team free throws made on court (NBA)          | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_fta`              | Share of team free-throw attempts on court (NBA)       | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_oreb`             | Share of team offensive rebounds on court (NBA)        | player | NW··    | Rebounding › Offensive; Offense › Rebounding                                     |
| `nba_share_dreb`             | Share of team defensive rebounds on court (NBA)        | player | NW··    | Rebounding › Defensive; Defense › Rebounding                                     |
| `nba_share_reb`              | Share of team rebounds on court (NBA)                  | player | NW··    | Rebounding › All rebounds                                                        |
| `nba_share_ast`              | Share of team assists on court (NBA)                   | player | NW··    | Playmaking › Passing; Offense › Playmaking                                       |
| `nba_share_tov`              | Share of team turnovers on court (NBA)                 | player | NW··    | Playmaking › Turnovers; Offense › Turnovers                                      |
| `nba_share_stl`              | Share of team steals on court (NBA)                    | player | NW··    | Defense › Steals and blocks                                                      |
| `nba_share_blk`              | Share of team blocks on court (NBA)                    | player | NW··    | Defense › Steals and blocks                                                      |
| `nba_share_blka`             | Share of team shots blocked on court (NBA)             | player | NW··    | Shooting › Share of team; Offense › Shooting                                     |
| `nba_share_pf`               | Share of team fouls on court (NBA)                     | player | NW··    | Fouls › Committed; Defense › Fouls and violations                                |
| `nba_share_pfd`              | Share of team fouls drawn on court (NBA)               | player | NW··    | Fouls › Drawn; Offense › Fouls drawn                                             |
| `nba_share_pts`              | Share of team points on court (NBA)                    | player | NW··    | Scoring › Share of team; Offense › Scoring                                       |
| `ncaa_putbacks`              | Putbacks made                                          | player | ··MF    | Scoring › Points by situation; Rebounding › Offensive; Offense › Scoring         |
| `team_ncaa_putbacks`         | Putbacks made                                          | team   | ··MF    | Scoring › Points by situation; Rebounding › Offensive; Offense › Scoring         |
| `opp_ncaa_putbacks`          | Opponent putbacks made                                 | opp    | ··MF    | Scoring › Points by situation; Rebounding › Offensive; Defense › Scoring allowed |
| `ncaa_putback_pct`           | Putback field-goal percentage                          | player | ··MF    | Shooting › Transition and putbacks; Offense › Shooting                           |
| `team_ncaa_putback_pct`      | Putback field-goal percentage                          | team   | ··MF    | Shooting › Transition and putbacks; Offense › Shooting                           |
| `opp_ncaa_putback_pct`       | Opponent putback field-goal percentage                 | opp    | ··MF    | Shooting › Transition and putbacks; Defense › Shooting allowed                   |
| `ncaa_rim_blocks`            | Blocks at the rim                                      | player | ··MF    | Defense › Steals and blocks                                                      |
| `team_ncaa_rim_blocks`       | Blocks at the rim                                      | team   | ··MF    | Defense › Steals and blocks                                                      |
| `opp_ncaa_rim_blocks`        | Opponent blocks at the rim                             | opp    | ··MF    | Offense › Shooting; Shooting › Restricted area and paint                         |
| `ncaa_trans_rate`            | Share of shots in transition                           | player | ··MF    | Scoring › Points by situation; Offense › Scoring                                 |
| `team_ncaa_trans_rate`       | Share of shots in transition                           | team   | ··MF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_ncaa_trans_rate`        | Opponent share of shots in transition                  | opp    | ··MF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `ncaa_trans_pts`             | Points in transition                                   | player | ··MF    | Scoring › Points by situation; Offense › Scoring                                 |
| `team_ncaa_trans_pts`        | Points in transition                                   | team   | ··MF    | Scoring › Points by situation; Offense › Scoring                                 |
| `opp_ncaa_trans_pts`         | Opponent points in transition                          | opp    | ··MF    | Scoring › Points by situation; Defense › Scoring allowed                         |
| `ncaa_trans_efg_pct`         | Effective field-goal percentage in transition          | player | ··MF    | Shooting › Transition and putbacks; Offense › Shooting                           |
| `team_ncaa_trans_efg_pct`    | Effective field-goal percentage in transition          | team   | ··MF    | Shooting › Transition and putbacks; Offense › Shooting                           |
| `opp_ncaa_trans_efg_pct`     | Opponent effective field-goal percentage in transition | opp    | ··MF    | Shooting › Transition and putbacks; Defense › Shooting allowed                   |
| `ncaa_assisted_pct`          | Share of field goals assisted                          | player | ··MF    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_ncaa_assisted_pct`     | Share of field goals assisted                          | team   | ··MF    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `opp_ncaa_assisted_pct`      | Opponent share of field goals assisted                 | opp    | ··MF    | Scoring › Assisted and unassisted; Defense › Scoring allowed                     |
| `ncaa_assisted_3pm_pct`      | Share of threes assisted                               | player | ··MF    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_ncaa_assisted_3pm_pct` | Share of threes assisted                               | team   | ··MF    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `opp_ncaa_assisted_3pm_pct`  | Opponent share of threes assisted                      | opp    | ··MF    | Scoring › Assisted and unassisted; Defense › Scoring allowed                     |
| `ncaa_assisted_rim_pct`      | Share of rim makes assisted                            | player | ··MF    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `team_ncaa_assisted_rim_pct` | Share of rim makes assisted                            | team   | ··MF    | Scoring › Assisted and unassisted; Offense › Scoring                             |
| `opp_ncaa_assisted_rim_pct`  | Opponent share of rim makes assisted                   | opp    | ··MF    | Scoring › Assisted and unassisted; Defense › Scoring allowed                     |

### composite (11)

| Metric         | Label                        | Who    | Leagues | Categories                                      |
| -------------- | ---------------------------- | ------ | ------- | ----------------------------------------------- |
| `eff`          | Efficiency                   | player | NWMF    | Impact › Box-score composites                   |
| `team_eff`     | Efficiency                   | team   | NWMF    | Impact › Box-score composites                   |
| `opp_eff`      | Opponent efficiency          | opp    | NWMF    | Impact › Box-score composites; Defense › Impact |
| `gmsc`         | Game Score                   | player | NWMF    | Impact › Box-score composites                   |
| `team_gmsc`    | Game Score                   | team   | NWMF    | Impact › Box-score composites                   |
| `opp_gmsc`     | Opponent game Score          | opp    | NWMF    | Impact › Box-score composites; Defense › Impact |
| `pie`          | Player Impact Estimate       | player | NWMF    | Impact › Box-score composites                   |
| `team_pie`     | Team Impact Estimate         | team   | NWMF    | Impact › Box-score composites                   |
| `nba_pie`      | Player Impact Estimate (NBA) | player | NW··    | Impact › Box-score composites                   |
| `team_nba_pie` | Team Impact Estimate (NBA)   | team   | NW··    | Impact › Box-score composites                   |
| `nba_def_ws`   | Defensive win shares (NBA)   | player | NW··    | Impact › Box-score models; Defense › Impact     |

### tracking (138)

| Metric                      | Label                                           | Who    | Leagues | Categories                                                 |
| --------------------------- | ----------------------------------------------- | ------ | ------- | ---------------------------------------------------------- |
| `dist_miles`                | Distance run                                    | player | N···    | Playing time › Movement                                    |
| `dist_miles_off`            | Distance run on offense                         | player | N···    | Playing time › Movement                                    |
| `dist_miles_def`            | Distance run on defense                         | player | N···    | Playing time › Movement                                    |
| `avg_speed`                 | Average speed                                   | player | N···    | Playing time › Movement                                    |
| `avg_speed_off`             | Average speed on offense                        | player | N···    | Playing time › Movement                                    |
| `avg_speed_def`             | Average speed on defense                        | player | N···    | Playing time › Movement                                    |
| `touches`                   | Touches                                         | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `front_ct_touches`          | Frontcourt touches                              | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `time_of_poss`              | Time of possession                              | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `sec_per_touch`             | Seconds per touch                               | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `drib_per_touch`            | Dribbles per touch                              | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `pts_per_touch`             | Points per touch                                | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `drives`                    | Drives                                          | player | N···    | Playmaking › Creation; Offense › Playmaking                |
| `drive_fgm`                 | Drive field goals made                          | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `drive_fga`                 | Drive field-goal attempts                       | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `drive_fg_pct`              | Drive field-goal percentage                     | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `drive_ftm`                 | Drive free throws made                          | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `drive_fta`                 | Drive free-throw attempts                       | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `drive_ft_pct`              | Drive free-throw percentage                     | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `drive_pts`                 | Drive points                                    | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `drive_pts_per_drive`       | Points per drive                                | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `drive_passes`              | Drive passes                                    | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `drive_passes_pct`          | Drive passes per drive                          | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `drive_ast`                 | Drive assists                                   | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `drive_ast_pct`             | Drive assists per drive                         | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `drive_tov`                 | Drive turnovers                                 | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `drive_tov_pct`             | Drive turnovers per drive                       | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `drive_pf`                  | Drive fouls drawn                               | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `drive_pf_pct`              | Drive fouls drawn per drive                     | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `passes_made`               | Passes made                                     | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `passes_received`           | Passes received                                 | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `potential_ast`             | Potential assists                               | player | N···    | Playmaking › Creation; Offense › Playmaking                |
| `secondary_ast`             | Secondary assists                               | player | N···    | Playmaking › Creation; Offense › Playmaking                |
| `ft_ast`                    | Free-throw assists                              | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `ast_pts_created`           | Assist points created                           | player | N···    | Playmaking › Creation; Offense › Playmaking                |
| `ast_adj`                   | Adjusted assists                                | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `ast_per_pass`              | Assists per pass                                | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `ast_adj_per_pass`          | Adjusted assists per pass                       | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `potential_ast_conv`        | Potential assists converted                     | player | N···    | Playmaking › Creation; Offense › Playmaking                |
| `reb_contest`               | Contested rebounds                              | player | N···    | Rebounding › All rebounds                                  |
| `reb_uncontest`             | Uncontested rebounds                            | player | N···    | Rebounding › All rebounds                                  |
| `reb_chances`               | Rebound chances                                 | player | N···    | Rebounding › All rebounds                                  |
| `reb_chance_defer`          | Deferred rebound chances                        | player | N···    | Rebounding › All rebounds                                  |
| `reb_contest_pct`           | Contested rebound share                         | player | N···    | Rebounding › All rebounds                                  |
| `reb_chance_pct`            | Rebound chance percentage                       | player | N···    | Rebounding › All rebounds                                  |
| `reb_chance_pct_adj`        | Adjusted rebound chance percentage              | player | N···    | Rebounding › All rebounds                                  |
| `avg_reb_dist`              | Average rebound distance                        | player | N···    | Rebounding › All rebounds                                  |
| `oreb_contest`              | Contested offensive rebounds                    | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `oreb_uncontest`            | Uncontested offensive rebounds                  | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `oreb_chances`              | Offensive rebound chances                       | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `oreb_chance_defer`         | Deferred offensive rebound chances              | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `oreb_contest_pct`          | Contested offensive rebound share               | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `oreb_chance_pct`           | Offensive rebound chance percentage             | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `oreb_chance_pct_adj`       | Adjusted offensive rebound chance percentage    | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `avg_oreb_dist`             | Average offensive rebound distance              | player | N···    | Rebounding › Offensive; Offense › Rebounding               |
| `dreb_contest`              | Contested defensive rebounds                    | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `dreb_uncontest`            | Uncontested defensive rebounds                  | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `dreb_chances`              | Defensive rebound chances                       | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `dreb_chance_defer`         | Deferred defensive rebound chances              | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `dreb_contest_pct`          | Contested defensive rebound share               | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `dreb_chance_pct`           | Defensive rebound chance percentage             | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `dreb_chance_pct_adj`       | Adjusted defensive rebound chance percentage    | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `avg_dreb_dist`             | Average defensive rebound distance              | player | N···    | Rebounding › Defensive; Defense › Rebounding               |
| `catch_shoot_fgm`           | Catch-and-shoot field goals made                | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_fga`           | Catch-and-shoot field-goal attempts             | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_fg_pct`        | Catch-and-shoot field-goal percentage           | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_fg3m`          | Catch-and-shoot threes made                     | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_fg3a`          | Catch-and-shoot three-point attempts            | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_fg3_pct`       | Catch-and-shoot three-point percentage          | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_efg_pct`       | Catch-and-shoot effective field-goal percentage | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `catch_shoot_pts`           | Catch-and-shoot points                          | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `pull_up_fgm`               | Pull-up field goals made                        | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_fga`               | Pull-up field-goal attempts                     | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_fg_pct`            | Pull-up field-goal percentage                   | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_fg3m`              | Pull-up threes made                             | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_fg3a`              | Pull-up three-point attempts                    | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_fg3_pct`           | Pull-up three-point percentage                  | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_efg_pct`           | Pull-up effective field-goal percentage         | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `pull_up_pts`               | Pull-up points                                  | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `elbow_touches`             | Elbow touches                                   | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `elbow_touch_fgm`           | Elbow touch field goals made                    | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `elbow_touch_fga`           | Elbow touch field-goal attempts                 | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `elbow_touch_fg_pct`        | Elbow touch field-goal percentage               | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `elbow_touch_ftm`           | Elbow touch free throws made                    | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `elbow_touch_fta`           | Elbow touch free-throw attempts                 | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `elbow_touch_ft_pct`        | Elbow touch free-throw percentage               | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `elbow_touch_pts`           | Elbow touch points                              | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `elbow_touch_pts_per_touch` | Points per elbow touch                          | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `elbow_touch_passes`        | Elbow touch passes                              | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `elbow_touch_pass_pct`      | Elbow touch pass rate                           | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `elbow_touch_ast`           | Elbow touch assists                             | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `elbow_touch_ast_pct`       | Elbow touch assist rate                         | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `elbow_touch_tov`           | Elbow touch turnovers                           | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `elbow_touch_tov_pct`       | Elbow touch turnover rate                       | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `elbow_touch_fouls`         | Elbow touch fouls drawn                         | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `elbow_touch_foul_pct`      | Elbow touch foul rate                           | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `post_touches`              | Post touches                                    | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `post_touch_fgm`            | Post touch field goals made                     | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `post_touch_fga`            | Post touch field-goal attempts                  | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `post_touch_fg_pct`         | Post touch field-goal percentage                | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `post_touch_ftm`            | Post touch free throws made                     | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `post_touch_fta`            | Post touch free-throw attempts                  | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `post_touch_ft_pct`         | Post touch free-throw percentage                | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `post_touch_pts`            | Post touch points                               | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `post_touch_pts_per_touch`  | Points per post touch                           | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `post_touch_passes`         | Post touch passes                               | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `post_touch_pass_pct`       | Post touch pass rate                            | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `post_touch_ast`            | Post touch assists                              | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `post_touch_ast_pct`        | Post touch assist rate                          | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `post_touch_tov`            | Post touch turnovers                            | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `post_touch_tov_pct`        | Post touch turnover rate                        | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `post_touch_fouls`          | Post touch fouls drawn                          | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `post_touch_foul_pct`       | Post touch foul rate                            | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `paint_touches`             | Paint touches                                   | player | N···    | Playmaking › Ball handling; Offense › Playmaking           |
| `paint_touch_fgm`           | Paint touch field goals made                    | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `paint_touch_fga`           | Paint touch field-goal attempts                 | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `paint_touch_fg_pct`        | Paint touch field-goal percentage               | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `paint_touch_ftm`           | Paint touch free throws made                    | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `paint_touch_fta`           | Paint touch free-throw attempts                 | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `paint_touch_ft_pct`        | Paint touch free-throw percentage               | player | N···    | Shooting › Drives and touches; Offense › Shooting          |
| `paint_touch_pts`           | Paint touch points                              | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `paint_touch_pts_per_touch` | Points per paint touch                          | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `paint_touch_passes`        | Paint touch passes                              | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `paint_touch_pass_pct`      | Paint touch pass rate                           | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `paint_touch_ast`           | Paint touch assists                             | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `paint_touch_ast_pct`       | Paint touch assist rate                         | player | N···    | Playmaking › Passing; Offense › Playmaking                 |
| `paint_touch_tov`           | Paint touch turnovers                           | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `paint_touch_tov_pct`       | Paint touch turnover rate                       | player | N···    | Playmaking › Turnovers; Offense › Turnovers                |
| `paint_touch_fouls`         | Paint touch fouls drawn                         | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `paint_touch_foul_pct`      | Paint touch foul rate                           | player | N···    | Fouls › Drawn; Offense › Fouls drawn                       |
| `eff_catch_shoot_pts`       | Catch-and-shoot points (efficiency dashboard)   | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `eff_catch_shoot_fg_pct`    | Catch-and-shoot FG% (efficiency dashboard)      | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `eff_pull_up_pts`           | Pull-up points (efficiency dashboard)           | player | N···    | Scoring › Points by situation; Offense › Scoring           |
| `eff_pull_up_fg_pct`        | Pull-up FG% (efficiency dashboard)              | player | N···    | Shooting › Catch-and-shoot and pull-up; Offense › Shooting |
| `eff_efg_pct`               | Effective field-goal percentage (tracking)      | player | N···    | Shooting › Efficiency; Offense › Shooting                  |
| `def_rim_fgm`               | Rim field goals allowed                         | player | N···    | Defense › Defended shots                                   |
| `def_rim_fga`               | Rim attempts defended                           | player | N···    | Defense › Defended shots                                   |
| `def_rim_fg_pct`            | Rim field-goal percentage allowed               | player | N···    | Defense › Defended shots                                   |

### hustle (34)

| Metric                     | Label                                 | Who    | Leagues | Categories                                                 |
| -------------------------- | ------------------------------------- | ------ | ------- | ---------------------------------------------------------- |
| `contested_shots`          | Contested shots                       | player | N···    | Defense › Defended shots; Hustle › Contests                |
| `contested_shots_2pt`      | Contested twos                        | player | N···    | Defense › Defended shots; Hustle › Contests                |
| `contested_shots_3pt`      | Contested threes                      | player | N···    | Defense › Defended shots; Hustle › Contests                |
| `deflections`              | Deflections                           | player | N···    | Defense › Hustle; Hustle › Loose balls and deflections     |
| `charges_drawn`            | Charges drawn                         | player | N···    | Defense › Hustle; Hustle › Charges; Fouls › Drawn          |
| `screen_assists`           | Screen assists                        | player | N···    | Hustle › Screens; Playmaking › Creation; Offense › Hustle  |
| `screen_ast_pts`           | Screen-assist points                  | player | N···    | Hustle › Screens; Playmaking › Creation; Offense › Hustle  |
| `loose_balls`              | Loose balls recovered                 | player | N···    | Hustle › Loose balls and deflections                       |
| `off_loose_balls`          | Offensive loose balls recovered       | player | N···    | Hustle › Loose balls and deflections; Offense › Hustle     |
| `def_loose_balls`          | Defensive loose balls recovered       | player | N···    | Defense › Hustle; Hustle › Loose balls and deflections     |
| `box_outs`                 | Box outs                              | player | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `off_box_outs`             | Offensive box outs                    | player | N···    | Rebounding › Box outs; Hustle › Box outs; Offense › Hustle |
| `def_box_outs`             | Defensive box outs                    | player | N···    | Rebounding › Box outs; Hustle › Box outs; Defense › Hustle |
| `off_loose_balls_pct`      | Offensive share of loose balls        | player | N···    | Hustle › Loose balls and deflections                       |
| `off_box_outs_pct`         | Offensive share of box outs           | player | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `box_out_team_rebs`        | Box outs leading to a team rebound    | player | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `box_out_rebs`             | Box outs leading to their own rebound | player | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `box_out_team_reb_pct`     | Team rebound rate after box outs      | player | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `box_out_reb_pct`          | Own rebound rate after box outs       | player | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `team_contested_shots`     | Contested shots                       | team   | N···    | Defense › Defended shots; Hustle › Contests                |
| `team_contested_shots_2pt` | Contested twos                        | team   | N···    | Defense › Defended shots; Hustle › Contests                |
| `team_contested_shots_3pt` | Contested threes                      | team   | N···    | Defense › Defended shots; Hustle › Contests                |
| `team_deflections`         | Deflections                           | team   | N···    | Defense › Hustle; Hustle › Loose balls and deflections     |
| `team_charges_drawn`       | Charges drawn                         | team   | N···    | Defense › Hustle; Hustle › Charges; Fouls › Drawn          |
| `team_screen_assists`      | Screen assists                        | team   | N···    | Hustle › Screens; Playmaking › Creation; Offense › Hustle  |
| `team_screen_ast_pts`      | Screen-assist points                  | team   | N···    | Hustle › Screens; Playmaking › Creation; Offense › Hustle  |
| `team_loose_balls`         | Loose balls recovered                 | team   | N···    | Hustle › Loose balls and deflections                       |
| `team_off_loose_balls`     | Offensive loose balls recovered       | team   | N···    | Hustle › Loose balls and deflections; Offense › Hustle     |
| `team_def_loose_balls`     | Defensive loose balls recovered       | team   | N···    | Defense › Hustle; Hustle › Loose balls and deflections     |
| `team_box_outs`            | Box outs                              | team   | N···    | Rebounding › Box outs; Hustle › Box outs                   |
| `team_off_box_outs`        | Offensive box outs                    | team   | N···    | Rebounding › Box outs; Hustle › Box outs; Offense › Hustle |
| `team_def_box_outs`        | Defensive box outs                    | team   | N···    | Rebounding › Box outs; Hustle › Box outs; Defense › Hustle |
| `team_off_loose_balls_pct` | Offensive share of loose balls        | team   | N···    | Hustle › Loose balls and deflections                       |
| `team_off_box_outs_pct`    | Offensive share of box outs           | team   | N···    | Rebounding › Box outs; Hustle › Box outs                   |

### play_types (234)

| Metric                       | Label                                                      | Who    | Leagues | Categories                                                            |
| ---------------------------- | ---------------------------------------------------------- | ------ | ------- | --------------------------------------------------------------------- |
| `pt_iso_poss`                | Isolation possessions                                      | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_freq`                | Isolation frequency                                        | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_pts`                 | Isolation points                                           | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_ppp`                 | Isolation points per possession                            | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_fgm`                 | Isolation field goals made                                 | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_fga`                 | Isolation field-goal attempts                              | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_fg_pct`              | Isolation FG%                                              | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_efg_pct`             | Isolation eFG%                                             | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_ft_freq`             | Isolation free-throw frequency                             | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_tov_freq`            | Isolation turnover frequency                               | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_sf_freq`             | Isolation shooting-foul frequency                          | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_and1_freq`           | Isolation and-one frequency                                | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_iso_score_freq`          | Isolation score frequency                                  | player | N···    | Play types › Isolation; Offense › Play types                          |
| `pt_transition_poss`         | Transition possessions                                     | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_freq`         | Transition frequency                                       | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_pts`          | Transition points                                          | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_ppp`          | Transition points per possession                           | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_fgm`          | Transition field goals made                                | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_fga`          | Transition field-goal attempts                             | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_fg_pct`       | Transition FG%                                             | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_efg_pct`      | Transition eFG%                                            | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_ft_freq`      | Transition free-throw frequency                            | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_tov_freq`     | Transition turnover frequency                              | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_sf_freq`      | Transition shooting-foul frequency                         | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_and1_freq`    | Transition and-one frequency                               | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_transition_score_freq`   | Transition score frequency                                 | player | N···    | Play types › Transition; Offense › Play types                         |
| `pt_pnr_bh_poss`             | Pick-and-roll ball handler possessions                     | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_freq`             | Pick-and-roll ball handler frequency                       | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_pts`              | Pick-and-roll ball handler points                          | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_ppp`              | Pick-and-roll ball handler points per possession           | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_fgm`              | Pick-and-roll ball handler field goals made                | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_fga`              | Pick-and-roll ball handler field-goal attempts             | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_fg_pct`           | Pick-and-roll ball handler FG%                             | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_efg_pct`          | Pick-and-roll ball handler eFG%                            | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_ft_freq`          | Pick-and-roll ball handler free-throw frequency            | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_tov_freq`         | Pick-and-roll ball handler turnover frequency              | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_sf_freq`          | Pick-and-roll ball handler shooting-foul frequency         | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_and1_freq`        | Pick-and-roll ball handler and-one frequency               | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_bh_score_freq`       | Pick-and-roll ball handler score frequency                 | player | N···    | Play types › Pick-and-roll ball handler; Offense › Play types         |
| `pt_pnr_roll_poss`           | Pick-and-roll roll man possessions                         | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_freq`           | Pick-and-roll roll man frequency                           | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_pts`            | Pick-and-roll roll man points                              | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_ppp`            | Pick-and-roll roll man points per possession               | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_fgm`            | Pick-and-roll roll man field goals made                    | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_fga`            | Pick-and-roll roll man field-goal attempts                 | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_fg_pct`         | Pick-and-roll roll man FG%                                 | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_efg_pct`        | Pick-and-roll roll man eFG%                                | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_ft_freq`        | Pick-and-roll roll man free-throw frequency                | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_tov_freq`       | Pick-and-roll roll man turnover frequency                  | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_sf_freq`        | Pick-and-roll roll man shooting-foul frequency             | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_and1_freq`      | Pick-and-roll roll man and-one frequency                   | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_pnr_roll_score_freq`     | Pick-and-roll roll man score frequency                     | player | N···    | Play types › Pick-and-roll roll man; Offense › Play types             |
| `pt_post_up_poss`            | Post-up possessions                                        | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_freq`            | Post-up frequency                                          | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_pts`             | Post-up points                                             | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_ppp`             | Post-up points per possession                              | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_fgm`             | Post-up field goals made                                   | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_fga`             | Post-up field-goal attempts                                | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_fg_pct`          | Post-up FG%                                                | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_efg_pct`         | Post-up eFG%                                               | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_ft_freq`         | Post-up free-throw frequency                               | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_tov_freq`        | Post-up turnover frequency                                 | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_sf_freq`         | Post-up shooting-foul frequency                            | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_and1_freq`       | Post-up and-one frequency                                  | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_post_up_score_freq`      | Post-up score frequency                                    | player | N···    | Play types › Post-up; Offense › Play types                            |
| `pt_spot_up_poss`            | Spot-up possessions                                        | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_freq`            | Spot-up frequency                                          | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_pts`             | Spot-up points                                             | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_ppp`             | Spot-up points per possession                              | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_fgm`             | Spot-up field goals made                                   | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_fga`             | Spot-up field-goal attempts                                | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_fg_pct`          | Spot-up FG%                                                | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_efg_pct`         | Spot-up eFG%                                               | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_ft_freq`         | Spot-up free-throw frequency                               | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_tov_freq`        | Spot-up turnover frequency                                 | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_sf_freq`         | Spot-up shooting-foul frequency                            | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_and1_freq`       | Spot-up and-one frequency                                  | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_spot_up_score_freq`      | Spot-up score frequency                                    | player | N···    | Play types › Spot-up; Offense › Play types                            |
| `pt_handoff_poss`            | Handoff possessions                                        | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_freq`            | Handoff frequency                                          | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_pts`             | Handoff points                                             | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_ppp`             | Handoff points per possession                              | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_fgm`             | Handoff field goals made                                   | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_fga`             | Handoff field-goal attempts                                | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_fg_pct`          | Handoff FG%                                                | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_efg_pct`         | Handoff eFG%                                               | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_ft_freq`         | Handoff free-throw frequency                               | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_tov_freq`        | Handoff turnover frequency                                 | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_sf_freq`         | Handoff shooting-foul frequency                            | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_and1_freq`       | Handoff and-one frequency                                  | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_handoff_score_freq`      | Handoff score frequency                                    | player | N···    | Play types › Handoff; Offense › Play types                            |
| `pt_cut_poss`                | Cut possessions                                            | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_freq`                | Cut frequency                                              | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_pts`                 | Cut points                                                 | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_ppp`                 | Cut points per possession                                  | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_fgm`                 | Cut field goals made                                       | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_fga`                 | Cut field-goal attempts                                    | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_fg_pct`              | Cut FG%                                                    | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_efg_pct`             | Cut eFG%                                                   | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_ft_freq`             | Cut free-throw frequency                                   | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_tov_freq`            | Cut turnover frequency                                     | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_sf_freq`             | Cut shooting-foul frequency                                | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_and1_freq`           | Cut and-one frequency                                      | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_cut_score_freq`          | Cut score frequency                                        | player | N···    | Play types › Cut; Offense › Play types                                |
| `pt_off_screen_poss`         | Off screen possessions                                     | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_freq`         | Off screen frequency                                       | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_pts`          | Off screen points                                          | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_ppp`          | Off screen points per possession                           | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_fgm`          | Off screen field goals made                                | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_fga`          | Off screen field-goal attempts                             | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_fg_pct`       | Off screen FG%                                             | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_efg_pct`      | Off screen eFG%                                            | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_ft_freq`      | Off screen free-throw frequency                            | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_tov_freq`     | Off screen turnover frequency                              | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_sf_freq`      | Off screen shooting-foul frequency                         | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_and1_freq`    | Off screen and-one frequency                               | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_off_screen_score_freq`   | Off screen score frequency                                 | player | N···    | Play types › Off screen; Offense › Play types                         |
| `pt_putback_poss`            | Putback possessions                                        | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_freq`            | Putback frequency                                          | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_pts`             | Putback points                                             | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_ppp`             | Putback points per possession                              | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_fgm`             | Putback field goals made                                   | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_fga`             | Putback field-goal attempts                                | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_fg_pct`          | Putback FG%                                                | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_efg_pct`         | Putback eFG%                                               | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_ft_freq`         | Putback free-throw frequency                               | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_tov_freq`        | Putback turnover frequency                                 | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_sf_freq`         | Putback shooting-foul frequency                            | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_and1_freq`       | Putback and-one frequency                                  | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_putback_score_freq`      | Putback score frequency                                    | player | N···    | Play types › Putbacks; Offense › Play types                           |
| `pt_misc_poss`               | Miscellaneous possessions                                  | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_freq`               | Miscellaneous frequency                                    | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_pts`                | Miscellaneous points                                       | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_ppp`                | Miscellaneous points per possession                        | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_fgm`                | Miscellaneous field goals made                             | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_fga`                | Miscellaneous field-goal attempts                          | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_fg_pct`             | Miscellaneous FG%                                          | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_efg_pct`            | Miscellaneous eFG%                                         | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_ft_freq`            | Miscellaneous free-throw frequency                         | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_tov_freq`           | Miscellaneous turnover frequency                           | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_sf_freq`            | Miscellaneous shooting-foul frequency                      | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_and1_freq`          | Miscellaneous and-one frequency                            | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_misc_score_freq`         | Miscellaneous score frequency                              | player | N···    | Play types › Miscellaneous; Offense › Play types                      |
| `pt_d_iso_poss`              | Isolation defense possessions                              | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_freq`              | Isolation defense frequency                                | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_pts`               | Isolation defense points                                   | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_ppp`               | Isolation defense points per possession                    | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_fgm`               | Isolation defense field goals made                         | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_fga`               | Isolation defense field-goal attempts                      | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_fg_pct`            | Isolation defense FG%                                      | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_efg_pct`           | Isolation defense eFG%                                     | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_ft_freq`           | Isolation defense free-throw frequency                     | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_tov_freq`          | Isolation defense turnover frequency                       | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_sf_freq`           | Isolation defense shooting-foul frequency                  | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_and1_freq`         | Isolation defense and-one frequency                        | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_iso_score_freq`        | Isolation defense score frequency                          | player | N···    | Play types › Isolation defense; Defense › Play types                  |
| `pt_d_pnr_bh_poss`           | Pick-and-roll ball handler defense possessions             | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_freq`           | Pick-and-roll ball handler defense frequency               | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_pts`            | Pick-and-roll ball handler defense points                  | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_ppp`            | Pick-and-roll ball handler defense points per possession   | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_fgm`            | Pick-and-roll ball handler defense field goals made        | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_fga`            | Pick-and-roll ball handler defense field-goal attempts     | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_fg_pct`         | Pick-and-roll ball handler defense FG%                     | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_efg_pct`        | Pick-and-roll ball handler defense eFG%                    | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_ft_freq`        | Pick-and-roll ball handler defense free-throw frequency    | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_tov_freq`       | Pick-and-roll ball handler defense turnover frequency      | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_sf_freq`        | Pick-and-roll ball handler defense shooting-foul frequency | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_and1_freq`      | Pick-and-roll ball handler defense and-one frequency       | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_bh_score_freq`     | Pick-and-roll ball handler defense score frequency         | player | N···    | Play types › Pick-and-roll ball handler defense; Defense › Play types |
| `pt_d_pnr_roll_poss`         | Pick-and-roll roll man defense possessions                 | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_freq`         | Pick-and-roll roll man defense frequency                   | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_pts`          | Pick-and-roll roll man defense points                      | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_ppp`          | Pick-and-roll roll man defense points per possession       | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_fgm`          | Pick-and-roll roll man defense field goals made            | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_fga`          | Pick-and-roll roll man defense field-goal attempts         | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_fg_pct`       | Pick-and-roll roll man defense FG%                         | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_efg_pct`      | Pick-and-roll roll man defense eFG%                        | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_ft_freq`      | Pick-and-roll roll man defense free-throw frequency        | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_tov_freq`     | Pick-and-roll roll man defense turnover frequency          | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_sf_freq`      | Pick-and-roll roll man defense shooting-foul frequency     | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_and1_freq`    | Pick-and-roll roll man defense and-one frequency           | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_pnr_roll_score_freq`   | Pick-and-roll roll man defense score frequency             | player | N···    | Play types › Pick-and-roll roll man defense; Defense › Play types     |
| `pt_d_post_up_poss`          | Post-up defense possessions                                | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_freq`          | Post-up defense frequency                                  | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_pts`           | Post-up defense points                                     | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_ppp`           | Post-up defense points per possession                      | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_fgm`           | Post-up defense field goals made                           | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_fga`           | Post-up defense field-goal attempts                        | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_fg_pct`        | Post-up defense FG%                                        | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_efg_pct`       | Post-up defense eFG%                                       | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_ft_freq`       | Post-up defense free-throw frequency                       | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_tov_freq`      | Post-up defense turnover frequency                         | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_sf_freq`       | Post-up defense shooting-foul frequency                    | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_and1_freq`     | Post-up defense and-one frequency                          | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_post_up_score_freq`    | Post-up defense score frequency                            | player | N···    | Play types › Post-up defense; Defense › Play types                    |
| `pt_d_spot_up_poss`          | Spot-up defense possessions                                | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_freq`          | Spot-up defense frequency                                  | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_pts`           | Spot-up defense points                                     | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_ppp`           | Spot-up defense points per possession                      | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_fgm`           | Spot-up defense field goals made                           | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_fga`           | Spot-up defense field-goal attempts                        | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_fg_pct`        | Spot-up defense FG%                                        | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_efg_pct`       | Spot-up defense eFG%                                       | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_ft_freq`       | Spot-up defense free-throw frequency                       | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_tov_freq`      | Spot-up defense turnover frequency                         | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_sf_freq`       | Spot-up defense shooting-foul frequency                    | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_and1_freq`     | Spot-up defense and-one frequency                          | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_spot_up_score_freq`    | Spot-up defense score frequency                            | player | N···    | Play types › Spot-up defense; Defense › Play types                    |
| `pt_d_handoff_poss`          | Handoff defense possessions                                | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_freq`          | Handoff defense frequency                                  | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_pts`           | Handoff defense points                                     | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_ppp`           | Handoff defense points per possession                      | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_fgm`           | Handoff defense field goals made                           | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_fga`           | Handoff defense field-goal attempts                        | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_fg_pct`        | Handoff defense FG%                                        | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_efg_pct`       | Handoff defense eFG%                                       | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_ft_freq`       | Handoff defense free-throw frequency                       | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_tov_freq`      | Handoff defense turnover frequency                         | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_sf_freq`       | Handoff defense shooting-foul frequency                    | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_and1_freq`     | Handoff defense and-one frequency                          | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_handoff_score_freq`    | Handoff defense score frequency                            | player | N···    | Play types › Handoff defense; Defense › Play types                    |
| `pt_d_off_screen_poss`       | Off screen defense possessions                             | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_freq`       | Off screen defense frequency                               | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_pts`        | Off screen defense points                                  | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_ppp`        | Off screen defense points per possession                   | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_fgm`        | Off screen defense field goals made                        | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_fga`        | Off screen defense field-goal attempts                     | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_fg_pct`     | Off screen defense FG%                                     | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_efg_pct`    | Off screen defense eFG%                                    | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_ft_freq`    | Off screen defense free-throw frequency                    | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_tov_freq`   | Off screen defense turnover frequency                      | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_sf_freq`    | Off screen defense shooting-foul frequency                 | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_and1_freq`  | Off screen defense and-one frequency                       | player | N···    | Play types › Off screen defense; Defense › Play types                 |
| `pt_d_off_screen_score_freq` | Off screen defense score frequency                         | player | N···    | Play types › Off screen defense; Defense › Play types                 |

### matchups (26)

| Metric                  | Label                              | Who    | Leagues | Categories         |
| ----------------------- | ---------------------------------- | ------ | ------- | ------------------ |
| `matchup_min`           | Matchup minutes                    | player | N···    | Defense › Matchups |
| `matchup_poss`          | Matchup possessions                | player | N···    | Defense › Matchups |
| `matchup_pts`           | Points allowed in matchups         | player | N···    | Defense › Matchups |
| `matchup_pts_per_100`   | Matchup points allowed per 100     | player | N···    | Defense › Matchups |
| `matchup_team_pts`      | Team points in matchups            | player | N···    | Defense › Matchups |
| `matchup_fgm`           | Matchup field goals allowed        | player | N···    | Defense › Matchups |
| `matchup_fga`           | Matchup field-goal attempts faced  | player | N···    | Defense › Matchups |
| `matchup_fg_pct`        | Matchup FG% allowed                | player | N···    | Defense › Matchups |
| `matchup_fg3m`          | Matchup threes allowed             | player | N···    | Defense › Matchups |
| `matchup_fg3a`          | Matchup threes faced               | player | N···    | Defense › Matchups |
| `matchup_fg3_pct`       | Matchup 3P% allowed                | player | N···    | Defense › Matchups |
| `matchup_ftm`           | Matchup free throws allowed        | player | N···    | Defense › Matchups |
| `matchup_fta`           | Matchup free throws faced          | player | N···    | Defense › Matchups |
| `matchup_ast`           | Matchup assists allowed            | player | N···    | Defense › Matchups |
| `matchup_tov`           | Matchup turnovers forced           | player | N···    | Defense › Matchups |
| `matchup_blk`           | Matchup blocks                     | player | N···    | Defense › Matchups |
| `matchup_sfl`           | Matchup shooting fouls             | player | N···    | Defense › Matchups |
| `matchup_g_time_pct`    | Matchup time on guards             | player | N···    | Defense › Matchups |
| `matchup_g_pts_per_100` | Points allowed per 100 to guards   | player | N···    | Defense › Matchups |
| `matchup_g_fg_pct`      | FG% allowed to guards              | player | N···    | Defense › Matchups |
| `matchup_f_time_pct`    | Matchup time on forwards           | player | N···    | Defense › Matchups |
| `matchup_f_pts_per_100` | Points allowed per 100 to forwards | player | N···    | Defense › Matchups |
| `matchup_f_fg_pct`      | FG% allowed to forwards            | player | N···    | Defense › Matchups |
| `matchup_c_time_pct`    | Matchup time on centers            | player | N···    | Defense › Matchups |
| `matchup_c_pts_per_100` | Points allowed per 100 to centers  | player | N···    | Defense › Matchups |
| `matchup_c_fg_pct`      | FG% allowed to centers             | player | N···    | Defense › Matchups |

### impact (25)

| Metric                | Label                                          | Who    | Leagues | Categories                                                  |
| --------------------- | ---------------------------------------------- | ------ | ------- | ----------------------------------------------------------- |
| `sdv_rapm`            | RAPM (SportsDataverse)                         | player | NW··    | Impact › Plus-minus models                                  |
| `sdv_o_rapm`          | Offensive RAPM (SportsDataverse)               | player | NW··    | Impact › Plus-minus models; Offense › Impact                |
| `sdv_d_rapm`          | Defensive RAPM (SportsDataverse)               | player | NW··    | Impact › Plus-minus models; Defense › Impact                |
| `sdv_adj_rapm`        | Adjusted RAPM (SportsDataverse)                | player | NW··    | Impact › Plus-minus models                                  |
| `sdv_o_adj_rapm`      | Offensive adjusted RAPM (SportsDataverse)      | player | NW··    | Impact › Plus-minus models; Offense › Impact                |
| `sdv_d_adj_rapm`      | Defensive adjusted RAPM (SportsDataverse)      | player | NW··    | Impact › Plus-minus models; Defense › Impact                |
| `sdv_spm`             | SPM (SportsDataverse)                          | player | NW··    | Impact › Box-score models                                   |
| `sdv_ospm`            | Offensive SPM (SportsDataverse)                | player | NW··    | Impact › Box-score models; Offense › Impact                 |
| `sdv_dspm`            | Defensive SPM (SportsDataverse)                | player | NW··    | Impact › Box-score models; Defense › Impact                 |
| `sdv_bpm`             | BPM (SportsDataverse)                          | player | NW··    | Impact › Box-score models                                   |
| `sdv_obpm`            | Offensive BPM (SportsDataverse)                | player | NW··    | Impact › Box-score models; Offense › Impact                 |
| `sdv_dbpm`            | Defensive BPM (SportsDataverse)                | player | NW··    | Impact › Box-score models; Defense › Impact                 |
| `sdv_war`             | Wins above replacement (SportsDataverse)       | player | NW··    | Impact › Box-score models                                   |
| `sdv_darko_skill`     | DARKO skill (SportsDataverse)                  | player | ····    | Impact › Plus-minus models; Predictive › Player projections |
| `sdv_darko_next`      | DARKO next-season projection (SportsDataverse) | player | ····    | Predictive › Player projections                             |
| `sdv_darko_sd`        | DARKO projection spread (SportsDataverse)      | player | ····    | Predictive › Player projections                             |
| `sdv_box_bpm`         | Box Plus/Minus (SportsDataverse)               | player | ··MF    | Impact › Box-score models                                   |
| `sdv_box_obpm`        | Offensive Box Plus/Minus (SportsDataverse)     | player | ··MF    | Impact › Box-score models; Offense › Impact                 |
| `sdv_box_dbpm`        | Defensive Box Plus/Minus (SportsDataverse)     | player | ··MF    | Impact › Box-score models; Defense › Impact                 |
| `sdv_ncaa_rapm`       | RAPM (SportsDataverse)                         | player | ··MF    | Impact › Plus-minus models                                  |
| `sdv_ncaa_orapm`      | Offensive RAPM (SportsDataverse)               | player | ··MF    | Impact › Plus-minus models; Offense › Impact                |
| `sdv_ncaa_drapm`      | Defensive RAPM (SportsDataverse)               | player | ··MF    | Impact › Plus-minus models; Defense › Impact                |
| `sdv_ncaa_team_rapm`  | RAPM within team (SportsDataverse)             | player | ··MF    | Impact › Plus-minus models                                  |
| `sdv_ncaa_team_orapm` | Offensive RAPM within team (SportsDataverse)   | player | ··MF    | Impact › Plus-minus models; Offense › Impact                |
| `sdv_ncaa_team_drapm` | Defensive RAPM within team (SportsDataverse)   | player | ··MF    | Impact › Plus-minus models; Defense › Impact                |

### availability (2)

| Metric             | Label                        | Who    | Leagues | Categories                  |
| ------------------ | ---------------------------- | ------ | ------- | --------------------------- |
| `games_out_injury` | Games out, injury or illness | player | N···    | Playing time › Games missed |
| `games_out_other`  | Games out, other reasons     | player | N···    | Playing time › Games missed |

### shots (411)

| Metric                     | Label                                                                | Who    | Leagues | Categories                                                           |
| -------------------------- | -------------------------------------------------------------------- | ------ | ------- | -------------------------------------------------------------------- |
| `shot_ra_fga`              | Restricted area attempts                                             | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_fgm`              | Restricted area makes                                                | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_fg_pct`           | Restricted area FG%                                                  | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_freq`             | Restricted area frequency                                            | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_pps`              | Restricted area points per shot                                      | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_efg_pct`          | Restricted area eFG%                                                 | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_fg_rel`           | Restricted area FG% vs league                                        | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_pps_rel`          | Restricted area points per shot vs league                            | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_ra_ast_pct`          | Restricted area assisted share                                       | player | NW··    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_fga`           | Paint outside the restricted area attempts                           | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_fgm`           | Paint outside the restricted area makes                              | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_fg_pct`        | Paint outside the restricted area FG%                                | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_freq`          | Paint outside the restricted area frequency                          | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_pps`           | Paint outside the restricted area points per shot                    | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_efg_pct`       | Paint outside the restricted area eFG%                               | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_fg_rel`        | Paint outside the restricted area FG% vs league                      | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_pps_rel`       | Paint outside the restricted area points per shot vs league          | player | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_paint_ast_pct`       | Paint outside the restricted area assisted share                     | player | NW··    | Shooting › Restricted area and paint; Offense › Shooting             |
| `shot_mid_fga`             | Mid-range attempts                                                   | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_fgm`             | Mid-range makes                                                      | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_fg_pct`          | Mid-range FG%                                                        | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_freq`            | Mid-range frequency                                                  | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_pps`             | Mid-range points per shot                                            | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_efg_pct`         | Mid-range eFG%                                                       | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_fg_rel`          | Mid-range FG% vs league                                              | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_pps_rel`         | Mid-range points per shot vs league                                  | player | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_mid_ast_pct`         | Mid-range assisted share                                             | player | NW··    | Shooting › Mid-range; Offense › Shooting                             |
| `shot_c3_fga`              | Corner three attempts                                                | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_fgm`              | Corner three makes                                                   | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_fg_pct`           | Corner three FG%                                                     | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_freq`             | Corner three frequency                                               | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_pps`              | Corner three points per shot                                         | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_efg_pct`          | Corner three eFG%                                                    | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_fg_rel`           | Corner three FG% vs league                                           | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_pps_rel`          | Corner three points per shot vs league                               | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3_ast_pct`          | Corner three assisted share                                          | player | NW··    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_fga`             | Left corner three attempts                                           | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_fgm`             | Left corner three makes                                              | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_fg_pct`          | Left corner three FG%                                                | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_freq`            | Left corner three frequency                                          | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_pps`             | Left corner three points per shot                                    | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_efg_pct`         | Left corner three eFG%                                               | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_fg_rel`          | Left corner three FG% vs league                                      | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_pps_rel`         | Left corner three points per shot vs league                          | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3l_ast_pct`         | Left corner three assisted share                                     | player | NW··    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_fga`             | Right corner three attempts                                          | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_fgm`             | Right corner three makes                                             | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_fg_pct`          | Right corner three FG%                                               | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_freq`            | Right corner three frequency                                         | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_pps`             | Right corner three points per shot                                   | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_efg_pct`         | Right corner three eFG%                                              | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_fg_rel`          | Right corner three FG% vs league                                     | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_pps_rel`         | Right corner three points per shot vs league                         | player | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_c3r_ast_pct`         | Right corner three assisted share                                    | player | NW··    | Shooting › Corner threes; Offense › Shooting                         |
| `shot_atb3_fga`            | Above-the-break three attempts                                       | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_fgm`            | Above-the-break three makes                                          | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_fg_pct`         | Above-the-break three FG%                                            | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_freq`           | Above-the-break three frequency                                      | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_pps`            | Above-the-break three points per shot                                | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_efg_pct`        | Above-the-break three eFG%                                           | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_fg_rel`         | Above-the-break three FG% vs league                                  | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_pps_rel`        | Above-the-break three points per shot vs league                      | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_atb3_ast_pct`        | Above-the-break three assisted share                                 | player | NW··    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_fga`            | Backcourt attempts                                                   | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_fgm`            | Backcourt makes                                                      | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_fg_pct`         | Backcourt FG%                                                        | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_freq`           | Backcourt frequency                                                  | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_pps`            | Backcourt points per shot                                            | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_efg_pct`        | Backcourt eFG%                                                       | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_fg_rel`         | Backcourt FG% vs league                                              | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_pps_rel`        | Backcourt points per shot vs league                                  | player | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_back_ast_pct`        | Backcourt assisted share                                             | player | NW··    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `shot_lt8_fga`             | Less than 8 feet attempts                                            | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_fgm`             | Less than 8 feet makes                                               | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_fg_pct`          | Less than 8 feet FG%                                                 | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_freq`            | Less than 8 feet frequency                                           | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_pps`             | Less than 8 feet points per shot                                     | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_efg_pct`         | Less than 8 feet eFG%                                                | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_fg_rel`          | Less than 8 feet FG% vs league                                       | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_lt8_pps_rel`         | Less than 8 feet points per shot vs league                           | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_fga`           | 8 to 16 feet attempts                                                | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_fgm`           | 8 to 16 feet makes                                                   | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_fg_pct`        | 8 to 16 feet FG%                                                     | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_freq`          | 8 to 16 feet frequency                                               | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_pps`           | 8 to 16 feet points per shot                                         | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_efg_pct`       | 8 to 16 feet eFG%                                                    | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_fg_rel`        | 8 to 16 feet FG% vs league                                           | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d8_16_pps_rel`       | 8 to 16 feet points per shot vs league                               | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_fga`          | 16 to 24 feet attempts                                               | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_fgm`          | 16 to 24 feet makes                                                  | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_fg_pct`       | 16 to 24 feet FG%                                                    | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_freq`         | 16 to 24 feet frequency                                              | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_pps`          | 16 to 24 feet points per shot                                        | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_efg_pct`      | 16 to 24 feet eFG%                                                   | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_fg_rel`       | 16 to 24 feet FG% vs league                                          | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d16_24_pps_rel`      | 16 to 24 feet points per shot vs league                              | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_fga`            | 24 feet and beyond attempts                                          | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_fgm`            | 24 feet and beyond makes                                             | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_fg_pct`         | 24 feet and beyond FG%                                               | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_freq`           | 24 feet and beyond frequency                                         | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_pps`            | 24 feet and beyond points per shot                                   | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_efg_pct`        | 24 feet and beyond eFG%                                              | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_fg_rel`         | 24 feet and beyond FG% vs league                                     | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_d24p_pps_rel`        | 24 feet and beyond points per shot vs league                         | player | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `shot_dunk_fga`            | Dunk attempts                                                        | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_dunk_fgm`            | Dunk makes                                                           | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_dunk_fg_pct`         | Dunk FG%                                                             | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_dunk_freq`           | Dunk frequency                                                       | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_dunk_fg_rel`         | Dunk FG% vs league                                                   | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_tip_fga`             | Tip attempts                                                         | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_tip_fgm`             | Tip makes                                                            | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_tip_fg_pct`          | Tip FG%                                                              | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_tip_freq`            | Tip frequency                                                        | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_tip_fg_rel`          | Tip FG% vs league                                                    | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_layup_fga`           | Layup attempts                                                       | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_layup_fgm`           | Layup makes                                                          | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_layup_fg_pct`        | Layup FG%                                                            | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_layup_freq`          | Layup frequency                                                      | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_layup_fg_rel`        | Layup FG% vs league                                                  | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_hook_fga`            | Hook attempts                                                        | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_hook_fgm`            | Hook makes                                                           | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_hook_fg_pct`         | Hook FG%                                                             | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_hook_freq`           | Hook frequency                                                       | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_hook_fg_rel`         | Hook FG% vs league                                                   | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_floater_fga`         | Floater attempts                                                     | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_floater_fgm`         | Floater makes                                                        | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_floater_fg_pct`      | Floater FG%                                                          | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_floater_freq`        | Floater frequency                                                    | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_floater_fg_rel`      | Floater FG% vs league                                                | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_jumper_fga`          | Jump shot attempts                                                   | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_jumper_fgm`          | Jump shot makes                                                      | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_jumper_fg_pct`       | Jump shot FG%                                                        | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_jumper_freq`         | Jump shot frequency                                                  | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_jumper_fg_rel`       | Jump shot FG% vs league                                              | player | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `shot_avg_dist`            | Average shot distance                                                | player | NWMF    | Shooting › Shot selection; Offense › Shooting                        |
| `shot_pts_above`           | Points above league by location                                      | player | NWMF    | Shooting › Efficiency; Offense › Shooting                            |
| `shot_pps_above`           | Points per shot above league by location                             | player | NWMF    | Shooting › Efficiency; Offense › Shooting                            |
| `team_shot_ra_fga`         | Restricted area attempts                                             | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_fgm`         | Restricted area makes                                                | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_fg_pct`      | Restricted area FG%                                                  | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_freq`        | Restricted area frequency                                            | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_pps`         | Restricted area points per shot                                      | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_efg_pct`     | Restricted area eFG%                                                 | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_fg_rel`      | Restricted area FG% vs league                                        | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_pps_rel`     | Restricted area points per shot vs league                            | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_ra_ast_pct`     | Restricted area assisted share                                       | team   | NW··    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_fga`      | Paint outside the restricted area attempts                           | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_fgm`      | Paint outside the restricted area makes                              | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_fg_pct`   | Paint outside the restricted area FG%                                | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_freq`     | Paint outside the restricted area frequency                          | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_pps`      | Paint outside the restricted area points per shot                    | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_efg_pct`  | Paint outside the restricted area eFG%                               | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_fg_rel`   | Paint outside the restricted area FG% vs league                      | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_pps_rel`  | Paint outside the restricted area points per shot vs league          | team   | NWMF    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_paint_ast_pct`  | Paint outside the restricted area assisted share                     | team   | NW··    | Shooting › Restricted area and paint; Offense › Shooting             |
| `team_shot_mid_fga`        | Mid-range attempts                                                   | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_fgm`        | Mid-range makes                                                      | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_fg_pct`     | Mid-range FG%                                                        | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_freq`       | Mid-range frequency                                                  | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_pps`        | Mid-range points per shot                                            | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_efg_pct`    | Mid-range eFG%                                                       | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_fg_rel`     | Mid-range FG% vs league                                              | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_pps_rel`    | Mid-range points per shot vs league                                  | team   | NWMF    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_mid_ast_pct`    | Mid-range assisted share                                             | team   | NW··    | Shooting › Mid-range; Offense › Shooting                             |
| `team_shot_c3_fga`         | Corner three attempts                                                | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_fgm`         | Corner three makes                                                   | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_fg_pct`      | Corner three FG%                                                     | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_freq`        | Corner three frequency                                               | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_pps`         | Corner three points per shot                                         | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_efg_pct`     | Corner three eFG%                                                    | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_fg_rel`      | Corner three FG% vs league                                           | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_pps_rel`     | Corner three points per shot vs league                               | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3_ast_pct`     | Corner three assisted share                                          | team   | NW··    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_fga`        | Left corner three attempts                                           | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_fgm`        | Left corner three makes                                              | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_fg_pct`     | Left corner three FG%                                                | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_freq`       | Left corner three frequency                                          | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_pps`        | Left corner three points per shot                                    | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_efg_pct`    | Left corner three eFG%                                               | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_fg_rel`     | Left corner three FG% vs league                                      | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_pps_rel`    | Left corner three points per shot vs league                          | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3l_ast_pct`    | Left corner three assisted share                                     | team   | NW··    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_fga`        | Right corner three attempts                                          | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_fgm`        | Right corner three makes                                             | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_fg_pct`     | Right corner three FG%                                               | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_freq`       | Right corner three frequency                                         | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_pps`        | Right corner three points per shot                                   | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_efg_pct`    | Right corner three eFG%                                              | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_fg_rel`     | Right corner three FG% vs league                                     | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_pps_rel`    | Right corner three points per shot vs league                         | team   | NWMF    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_c3r_ast_pct`    | Right corner three assisted share                                    | team   | NW··    | Shooting › Corner threes; Offense › Shooting                         |
| `team_shot_atb3_fga`       | Above-the-break three attempts                                       | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_fgm`       | Above-the-break three makes                                          | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_fg_pct`    | Above-the-break three FG%                                            | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_freq`      | Above-the-break three frequency                                      | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_pps`       | Above-the-break three points per shot                                | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_efg_pct`   | Above-the-break three eFG%                                           | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_fg_rel`    | Above-the-break three FG% vs league                                  | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_pps_rel`   | Above-the-break three points per shot vs league                      | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_atb3_ast_pct`   | Above-the-break three assisted share                                 | team   | NW··    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_fga`       | Backcourt attempts                                                   | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_fgm`       | Backcourt makes                                                      | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_fg_pct`    | Backcourt FG%                                                        | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_freq`      | Backcourt frequency                                                  | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_pps`       | Backcourt points per shot                                            | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_efg_pct`   | Backcourt eFG%                                                       | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_fg_rel`    | Backcourt FG% vs league                                              | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_pps_rel`   | Backcourt points per shot vs league                                  | team   | NWMF    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_back_ast_pct`   | Backcourt assisted share                                             | team   | NW··    | Shooting › Above the break and backcourt; Offense › Shooting         |
| `team_shot_lt8_fga`        | Less than 8 feet attempts                                            | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_fgm`        | Less than 8 feet makes                                               | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_fg_pct`     | Less than 8 feet FG%                                                 | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_freq`       | Less than 8 feet frequency                                           | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_pps`        | Less than 8 feet points per shot                                     | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_efg_pct`    | Less than 8 feet eFG%                                                | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_fg_rel`     | Less than 8 feet FG% vs league                                       | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_lt8_pps_rel`    | Less than 8 feet points per shot vs league                           | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_fga`      | 8 to 16 feet attempts                                                | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_fgm`      | 8 to 16 feet makes                                                   | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_fg_pct`   | 8 to 16 feet FG%                                                     | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_freq`     | 8 to 16 feet frequency                                               | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_pps`      | 8 to 16 feet points per shot                                         | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_efg_pct`  | 8 to 16 feet eFG%                                                    | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_fg_rel`   | 8 to 16 feet FG% vs league                                           | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d8_16_pps_rel`  | 8 to 16 feet points per shot vs league                               | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_fga`     | 16 to 24 feet attempts                                               | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_fgm`     | 16 to 24 feet makes                                                  | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_fg_pct`  | 16 to 24 feet FG%                                                    | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_freq`    | 16 to 24 feet frequency                                              | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_pps`     | 16 to 24 feet points per shot                                        | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_efg_pct` | 16 to 24 feet eFG%                                                   | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_fg_rel`  | 16 to 24 feet FG% vs league                                          | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d16_24_pps_rel` | 16 to 24 feet points per shot vs league                              | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_fga`       | 24 feet and beyond attempts                                          | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_fgm`       | 24 feet and beyond makes                                             | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_fg_pct`    | 24 feet and beyond FG%                                               | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_freq`      | 24 feet and beyond frequency                                         | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_pps`       | 24 feet and beyond points per shot                                   | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_efg_pct`   | 24 feet and beyond eFG%                                              | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_fg_rel`    | 24 feet and beyond FG% vs league                                     | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_d24p_pps_rel`   | 24 feet and beyond points per shot vs league                         | team   | NWMF    | Shooting › Distances; Offense › Shooting                             |
| `team_shot_dunk_fga`       | Dunk attempts                                                        | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_dunk_fgm`       | Dunk makes                                                           | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_dunk_fg_pct`    | Dunk FG%                                                             | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_dunk_freq`      | Dunk frequency                                                       | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_dunk_fg_rel`    | Dunk FG% vs league                                                   | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_tip_fga`        | Tip attempts                                                         | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_tip_fgm`        | Tip makes                                                            | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_tip_fg_pct`     | Tip FG%                                                              | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_tip_freq`       | Tip frequency                                                        | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_tip_fg_rel`     | Tip FG% vs league                                                    | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_layup_fga`      | Layup attempts                                                       | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_layup_fgm`      | Layup makes                                                          | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_layup_fg_pct`   | Layup FG%                                                            | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_layup_freq`     | Layup frequency                                                      | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_layup_fg_rel`   | Layup FG% vs league                                                  | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_hook_fga`       | Hook attempts                                                        | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_hook_fgm`       | Hook makes                                                           | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_hook_fg_pct`    | Hook FG%                                                             | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_hook_freq`      | Hook frequency                                                       | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_hook_fg_rel`    | Hook FG% vs league                                                   | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_floater_fga`    | Floater attempts                                                     | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_floater_fgm`    | Floater makes                                                        | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_floater_fg_pct` | Floater FG%                                                          | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_floater_freq`   | Floater frequency                                                    | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_floater_fg_rel` | Floater FG% vs league                                                | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_jumper_fga`     | Jump shot attempts                                                   | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_jumper_fgm`     | Jump shot makes                                                      | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_jumper_fg_pct`  | Jump shot FG%                                                        | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_jumper_freq`    | Jump shot frequency                                                  | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_jumper_fg_rel`  | Jump shot FG% vs league                                              | team   | NW··    | Shooting › Shot types; Offense › Shooting                            |
| `team_shot_avg_dist`       | Average shot distance                                                | team   | NWMF    | Shooting › Shot selection; Offense › Shooting                        |
| `team_shot_pts_above`      | Points above league by location                                      | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                            |
| `team_shot_pps_above`      | Points per shot above league by location                             | team   | NWMF    | Shooting › Efficiency; Offense › Shooting                            |
| `opp_shot_ra_fga`          | Opponent restricted area attempts                                    | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_fgm`          | Opponent restricted area makes                                       | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_fg_pct`       | Opponent restricted area FG%                                         | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_freq`         | Opponent restricted area frequency                                   | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_pps`          | Opponent restricted area points per shot                             | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_efg_pct`      | Opponent restricted area eFG%                                        | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_fg_rel`       | Opponent restricted area FG% vs league                               | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_pps_rel`      | Opponent restricted area points per shot vs league                   | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_ra_ast_pct`      | Opponent restricted area assisted share                              | opp    | NW··    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_fga`       | Opponent paint outside the restricted area attempts                  | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_fgm`       | Opponent paint outside the restricted area makes                     | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_fg_pct`    | Opponent paint outside the restricted area FG%                       | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_freq`      | Opponent paint outside the restricted area frequency                 | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_pps`       | Opponent paint outside the restricted area points per shot           | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_efg_pct`   | Opponent paint outside the restricted area eFG%                      | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_fg_rel`    | Opponent paint outside the restricted area FG% vs league             | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_pps_rel`   | Opponent paint outside the restricted area points per shot vs league | opp    | NWMF    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_paint_ast_pct`   | Opponent paint outside the restricted area assisted share            | opp    | NW··    | Shooting › Restricted area and paint; Defense › Shooting allowed     |
| `opp_shot_mid_fga`         | Opponent mid-range attempts                                          | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_fgm`         | Opponent mid-range makes                                             | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_fg_pct`      | Opponent mid-range FG%                                               | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_freq`        | Opponent mid-range frequency                                         | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_pps`         | Opponent mid-range points per shot                                   | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_efg_pct`     | Opponent mid-range eFG%                                              | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_fg_rel`      | Opponent mid-range FG% vs league                                     | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_pps_rel`     | Opponent mid-range points per shot vs league                         | opp    | NWMF    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_mid_ast_pct`     | Opponent mid-range assisted share                                    | opp    | NW··    | Shooting › Mid-range; Defense › Shooting allowed                     |
| `opp_shot_c3_fga`          | Opponent corner three attempts                                       | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_fgm`          | Opponent corner three makes                                          | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_fg_pct`       | Opponent corner three FG%                                            | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_freq`         | Opponent corner three frequency                                      | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_pps`          | Opponent corner three points per shot                                | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_efg_pct`      | Opponent corner three eFG%                                           | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_fg_rel`       | Opponent corner three FG% vs league                                  | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_pps_rel`      | Opponent corner three points per shot vs league                      | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3_ast_pct`      | Opponent corner three assisted share                                 | opp    | NW··    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_fga`         | Opponent left corner three attempts                                  | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_fgm`         | Opponent left corner three makes                                     | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_fg_pct`      | Opponent left corner three FG%                                       | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_freq`        | Opponent left corner three frequency                                 | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_pps`         | Opponent left corner three points per shot                           | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_efg_pct`     | Opponent left corner three eFG%                                      | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_fg_rel`      | Opponent left corner three FG% vs league                             | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_pps_rel`     | Opponent left corner three points per shot vs league                 | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3l_ast_pct`     | Opponent left corner three assisted share                            | opp    | NW··    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_fga`         | Opponent right corner three attempts                                 | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_fgm`         | Opponent right corner three makes                                    | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_fg_pct`      | Opponent right corner three FG%                                      | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_freq`        | Opponent right corner three frequency                                | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_pps`         | Opponent right corner three points per shot                          | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_efg_pct`     | Opponent right corner three eFG%                                     | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_fg_rel`      | Opponent right corner three FG% vs league                            | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_pps_rel`     | Opponent right corner three points per shot vs league                | opp    | NWMF    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_c3r_ast_pct`     | Opponent right corner three assisted share                           | opp    | NW··    | Shooting › Corner threes; Defense › Shooting allowed                 |
| `opp_shot_atb3_fga`        | Opponent above-the-break three attempts                              | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_fgm`        | Opponent above-the-break three makes                                 | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_fg_pct`     | Opponent above-the-break three FG%                                   | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_freq`       | Opponent above-the-break three frequency                             | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_pps`        | Opponent above-the-break three points per shot                       | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_efg_pct`    | Opponent above-the-break three eFG%                                  | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_fg_rel`     | Opponent above-the-break three FG% vs league                         | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_pps_rel`    | Opponent above-the-break three points per shot vs league             | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_atb3_ast_pct`    | Opponent above-the-break three assisted share                        | opp    | NW··    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_fga`        | Opponent backcourt attempts                                          | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_fgm`        | Opponent backcourt makes                                             | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_fg_pct`     | Opponent backcourt FG%                                               | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_freq`       | Opponent backcourt frequency                                         | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_pps`        | Opponent backcourt points per shot                                   | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_efg_pct`    | Opponent backcourt eFG%                                              | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_fg_rel`     | Opponent backcourt FG% vs league                                     | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_pps_rel`    | Opponent backcourt points per shot vs league                         | opp    | NWMF    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_back_ast_pct`    | Opponent backcourt assisted share                                    | opp    | NW··    | Shooting › Above the break and backcourt; Defense › Shooting allowed |
| `opp_shot_lt8_fga`         | Opponent less than 8 feet attempts                                   | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_fgm`         | Opponent less than 8 feet makes                                      | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_fg_pct`      | Opponent less than 8 feet FG%                                        | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_freq`        | Opponent less than 8 feet frequency                                  | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_pps`         | Opponent less than 8 feet points per shot                            | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_efg_pct`     | Opponent less than 8 feet eFG%                                       | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_fg_rel`      | Opponent less than 8 feet FG% vs league                              | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_lt8_pps_rel`     | Opponent less than 8 feet points per shot vs league                  | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_fga`       | Opponent 8 to 16 feet attempts                                       | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_fgm`       | Opponent 8 to 16 feet makes                                          | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_fg_pct`    | Opponent 8 to 16 feet FG%                                            | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_freq`      | Opponent 8 to 16 feet frequency                                      | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_pps`       | Opponent 8 to 16 feet points per shot                                | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_efg_pct`   | Opponent 8 to 16 feet eFG%                                           | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_fg_rel`    | Opponent 8 to 16 feet FG% vs league                                  | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d8_16_pps_rel`   | Opponent 8 to 16 feet points per shot vs league                      | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_fga`      | Opponent 16 to 24 feet attempts                                      | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_fgm`      | Opponent 16 to 24 feet makes                                         | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_fg_pct`   | Opponent 16 to 24 feet FG%                                           | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_freq`     | Opponent 16 to 24 feet frequency                                     | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_pps`      | Opponent 16 to 24 feet points per shot                               | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_efg_pct`  | Opponent 16 to 24 feet eFG%                                          | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_fg_rel`   | Opponent 16 to 24 feet FG% vs league                                 | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d16_24_pps_rel`  | Opponent 16 to 24 feet points per shot vs league                     | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_fga`        | Opponent 24 feet and beyond attempts                                 | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_fgm`        | Opponent 24 feet and beyond makes                                    | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_fg_pct`     | Opponent 24 feet and beyond FG%                                      | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_freq`       | Opponent 24 feet and beyond frequency                                | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_pps`        | Opponent 24 feet and beyond points per shot                          | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_efg_pct`    | Opponent 24 feet and beyond eFG%                                     | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_fg_rel`     | Opponent 24 feet and beyond FG% vs league                            | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_d24p_pps_rel`    | Opponent 24 feet and beyond points per shot vs league                | opp    | NWMF    | Shooting › Distances; Defense › Shooting allowed                     |
| `opp_shot_dunk_fga`        | Opponent dunk attempts                                               | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_dunk_fgm`        | Opponent dunk makes                                                  | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_dunk_fg_pct`     | Opponent dunk FG%                                                    | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_dunk_freq`       | Opponent dunk frequency                                              | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_dunk_fg_rel`     | Opponent dunk FG% vs league                                          | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_tip_fga`         | Opponent tip attempts                                                | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_tip_fgm`         | Opponent tip makes                                                   | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_tip_fg_pct`      | Opponent tip FG%                                                     | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_tip_freq`        | Opponent tip frequency                                               | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_tip_fg_rel`      | Opponent tip FG% vs league                                           | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_layup_fga`       | Opponent layup attempts                                              | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_layup_fgm`       | Opponent layup makes                                                 | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_layup_fg_pct`    | Opponent layup FG%                                                   | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_layup_freq`      | Opponent layup frequency                                             | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_layup_fg_rel`    | Opponent layup FG% vs league                                         | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_hook_fga`        | Opponent hook attempts                                               | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_hook_fgm`        | Opponent hook makes                                                  | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_hook_fg_pct`     | Opponent hook FG%                                                    | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_hook_freq`       | Opponent hook frequency                                              | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_hook_fg_rel`     | Opponent hook FG% vs league                                          | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_floater_fga`     | Opponent floater attempts                                            | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_floater_fgm`     | Opponent floater makes                                               | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_floater_fg_pct`  | Opponent floater FG%                                                 | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_floater_freq`    | Opponent floater frequency                                           | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_floater_fg_rel`  | Opponent floater FG% vs league                                       | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_jumper_fga`      | Opponent jump shot attempts                                          | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_jumper_fgm`      | Opponent jump shot makes                                             | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_jumper_fg_pct`   | Opponent jump shot FG%                                               | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_jumper_freq`     | Opponent jump shot frequency                                         | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_jumper_fg_rel`   | Opponent jump shot FG% vs league                                     | opp    | NW··    | Shooting › Shot types; Defense › Shooting allowed                    |
| `opp_shot_avg_dist`        | Opponent average shot distance                                       | opp    | NWMF    | Shooting › Shot selection; Defense › Shooting allowed                |
| `opp_shot_pts_above`       | Opponent points above league by location                             | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                    |
| `opp_shot_pps_above`       | Opponent points per shot above league by location                    | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed                    |

### plays (162)

| Metric                         | Label                                      | Who    | Leagues | Categories                                                            |
| ------------------------------ | ------------------------------------------ | ------ | ------- | --------------------------------------------------------------------- |
| `pbp_tov_bad_pass`             | Bad pass turnovers                         | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_bad_pass`        | Bad pass turnovers                         | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_bad_pass`         | Opponent bad pass turnovers                | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_lost_ball`            | Lost ball turnovers                        | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_lost_ball`       | Lost ball turnovers                        | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_lost_ball`        | Opponent lost ball turnovers               | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_off_foul`             | Offensive foul turnovers                   | player | NWMF    | Playmaking › Turnovers; Fouls › Committed; Offense › Turnovers        |
| `team_pbp_tov_off_foul`        | Offensive foul turnovers                   | team   | NWMF    | Playmaking › Turnovers; Fouls › Committed; Offense › Turnovers        |
| `opp_pbp_tov_off_foul`         | Opponent offensive foul turnovers          | opp    | NWMF    | Playmaking › Turnovers; Fouls › Committed; Defense › Turnovers forced |
| `pbp_tov_travel`               | Traveling turnovers                        | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_travel`          | Traveling turnovers                        | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_travel`           | Opponent traveling turnovers               | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_shot_clock`           | Shot clock turnovers                       | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_shot_clock`      | Shot clock turnovers                       | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_shot_clock`       | Opponent shot clock turnovers              | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_out_of_bounds`        | Stepped out of bounds turnovers            | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_out_of_bounds`   | Stepped out of bounds turnovers            | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_out_of_bounds`    | Opponent stepped out of bounds turnovers   | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_violation`            | Other violation turnovers                  | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_violation`       | Other violation turnovers                  | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_violation`        | Opponent other violation turnovers         | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_other`                | Other turnovers                            | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_other`           | Other turnovers                            | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_other`            | Opponent other turnovers                   | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_live`                 | Live-ball turnovers                        | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_live`            | Live-ball turnovers                        | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_live`             | Opponent live-ball turnovers               | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_dead`                 | Dead-ball turnovers                        | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_dead`            | Dead-ball turnovers                        | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_dead`             | Opponent dead-ball turnovers               | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_live_share`           | Live-ball turnover share                   | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_live_share`      | Live-ball turnover share                   | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_live_share`       | Opponent live-ball turnover share          | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_bad_pass_share`       | Bad pass share of turnovers                | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_bad_pass_share`  | Bad pass share of turnovers                | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_bad_pass_share`   | Opponent bad pass share of turnovers       | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_lost_ball_share`      | Lost ball share of turnovers               | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_lost_ball_share` | Lost ball share of turnovers               | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_lost_ball_share`  | Opponent lost ball share of turnovers      | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_tov_off_foul_share`       | Offensive foul share of turnovers          | player | NWMF    | Playmaking › Turnovers; Fouls › Committed; Offense › Turnovers        |
| `team_pbp_tov_off_foul_share`  | Offensive foul share of turnovers          | team   | NWMF    | Playmaking › Turnovers; Fouls › Committed; Offense › Turnovers        |
| `opp_pbp_tov_off_foul_share`   | Opponent offensive foul share of turnovers | opp    | NWMF    | Playmaking › Turnovers; Fouls › Committed; Defense › Turnovers forced |
| `pbp_tov_travel_share`         | Traveling share of turnovers               | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `team_pbp_tov_travel_share`    | Traveling share of turnovers               | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_travel_share`     | Opponent traveling share of turnovers      | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `team_pbp_tov_team`            | Team turnovers                             | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers                           |
| `opp_pbp_tov_team`             | Opponent team turnovers                    | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced                    |
| `pbp_pf_shooting`              | Shooting fouls                             | player | NWMF    | Fouls › Committed; Defense › Fouls and violations                     |
| `team_pbp_pf_shooting`         | Shooting fouls                             | team   | NWMF    | Fouls › Committed; Defense › Fouls and violations                     |
| `opp_pbp_pf_shooting`          | Opponent shooting fouls                    | opp    | NWMF    | Fouls › Committed; Offense › Fouls drawn                              |
| `pbp_pf_personal`              | Non-shooting fouls                         | player | NWMF    | Fouls › Committed; Defense › Fouls and violations                     |
| `team_pbp_pf_personal`         | Non-shooting fouls                         | team   | NWMF    | Fouls › Committed; Defense › Fouls and violations                     |
| `opp_pbp_pf_personal`          | Opponent non-shooting fouls                | opp    | NWMF    | Fouls › Committed; Offense › Fouls drawn                              |
| `pbp_pf_offensive`             | Offensive fouls                            | player | NWMF    | Fouls › Committed; Offense › Turnovers                                |
| `team_pbp_pf_offensive`        | Offensive fouls                            | team   | NWMF    | Fouls › Committed; Offense › Turnovers                                |
| `opp_pbp_pf_offensive`         | Opponent offensive fouls                   | opp    | NWMF    | Fouls › Committed; Defense › Turnovers forced                         |
| `pbp_pf_loose_ball`            | Loose ball fouls                           | player | NWMF    | Fouls › Committed                                                     |
| `team_pbp_pf_loose_ball`       | Loose ball fouls                           | team   | NWMF    | Fouls › Committed                                                     |
| `opp_pbp_pf_loose_ball`        | Opponent loose ball fouls                  | opp    | NWMF    | Fouls › Committed                                                     |
| `pbp_pf_take`                  | Take fouls                                 | player | NW··    | Fouls › Committed; Defense › Fouls and violations                     |
| `team_pbp_pf_take`             | Take fouls                                 | team   | NW··    | Fouls › Committed; Defense › Fouls and violations                     |
| `opp_pbp_pf_take`              | Opponent take fouls                        | opp    | NW··    | Fouls › Committed; Offense › Fouls drawn                              |
| `pbp_pf_transition_take`       | Transition take fouls                      | player | NW··    | Fouls › Committed; Defense › Fouls and violations                     |
| `team_pbp_pf_transition_take`  | Transition take fouls                      | team   | NW··    | Fouls › Committed; Defense › Fouls and violations                     |
| `opp_pbp_pf_transition_take`   | Opponent transition take fouls             | opp    | NW··    | Fouls › Committed; Offense › Fouls drawn                              |
| `pbp_pf_clear_path`            | Clear path fouls                           | player | NW··    | Fouls › Committed; Defense › Fouls and violations                     |
| `team_pbp_pf_clear_path`       | Clear path fouls                           | team   | NW··    | Fouls › Committed; Defense › Fouls and violations                     |
| `opp_pbp_pf_clear_path`        | Opponent clear path fouls                  | opp    | NW··    | Fouls › Committed; Offense › Fouls drawn                              |
| `pbp_pf_flagrant1`             | Flagrant 1 fouls                           | player | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `team_pbp_pf_flagrant1`        | Flagrant 1 fouls                           | team   | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `opp_pbp_pf_flagrant1`         | Opponent flagrant 1 fouls                  | opp    | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `pbp_pf_flagrant2`             | Flagrant 2 fouls                           | player | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `team_pbp_pf_flagrant2`        | Flagrant 2 fouls                           | team   | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `opp_pbp_pf_flagrant2`         | Opponent flagrant 2 fouls                  | opp    | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `pbp_pf_shooting_share`        | Shooting share of fouls                    | player | NWMF    | Fouls › Committed                                                     |
| `team_pbp_pf_shooting_share`   | Shooting share of fouls                    | team   | NWMF    | Fouls › Committed                                                     |
| `opp_pbp_pf_shooting_share`    | Opponent shooting share of fouls           | opp    | NWMF    | Fouls › Committed                                                     |
| `pbp_flagrant`                 | Flagrant fouls                             | player | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `team_pbp_flagrant`            | Flagrant fouls                             | team   | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `opp_pbp_flagrant`             | Opponent flagrant fouls                    | opp    | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `pbp_tech`                     | Technical fouls                            | player | NWMF    | Fouls › Flagrants, technicals and ejections                           |
| `team_pbp_tech`                | Technical fouls                            | team   | NWMF    | Fouls › Flagrants, technicals and ejections                           |
| `opp_pbp_tech`                 | Opponent technical fouls                   | opp    | NWMF    | Fouls › Flagrants, technicals and ejections                           |
| `pbp_def3`                     | Defensive three seconds                    | player | NW··    | Fouls › Violations; Defense › Fouls and violations                    |
| `team_pbp_def3`                | Defensive three seconds                    | team   | NW··    | Fouls › Violations; Defense › Fouls and violations                    |
| `opp_pbp_def3`                 | Opponent defensive three seconds           | opp    | NW··    | Fouls › Violations; Offense › Fouls drawn                             |
| `pbp_ejections`                | Ejections                                  | player | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `team_pbp_ejections`           | Ejections                                  | team   | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `opp_pbp_ejections`            | Opponent ejections                         | opp    | NW··    | Fouls › Flagrants, technicals and ejections                           |
| `pbp_fd`                       | Fouls drawn                                | player | NWMF    | Fouls › Drawn; Offense › Fouls drawn                                  |
| `team_pbp_fd`                  | Fouls drawn                                | team   | NWMF    | Fouls › Drawn; Offense › Fouls drawn                                  |
| `opp_pbp_fd`                   | Opponent fouls drawn                       | opp    | NWMF    | Fouls › Drawn; Defense › Fouls and violations                         |
| `pbp_fd_shooting`              | Shooting fouls drawn                       | player | NWMF    | Fouls › Drawn; Offense › Fouls drawn                                  |
| `team_pbp_fd_shooting`         | Shooting fouls drawn                       | team   | NWMF    | Fouls › Drawn; Offense › Fouls drawn                                  |
| `opp_pbp_fd_shooting`          | Opponent shooting fouls drawn              | opp    | NWMF    | Fouls › Drawn; Defense › Fouls and violations                         |
| `pbp_and1`                     | And-ones                                   | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_and1`                | And-ones                                   | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_and1`                 | Opponent and-ones                          | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_and1_ftm`                 | And-ones converted                         | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_and1_ftm`            | And-ones converted                         | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_and1_ftm`             | Opponent and-ones converted                | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_and1_pct`                 | And-one conversion                         | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_and1_pct`            | And-one conversion                         | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_and1_pct`             | Opponent and-one conversion                | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_and1_rate`                | And-ones per make                          | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_and1_rate`           | And-ones per make                          | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_and1_rate`            | Opponent and-ones per make                 | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_ft_trip2`                 | Two-shot fouls                             | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_ft_trip2`            | Two-shot fouls                             | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_ft_trip2`             | Opponent two-shot fouls                    | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_ft_trip3`                 | Three-shot fouls                           | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_ft_trip3`            | Three-shot fouls                           | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_ft_trip3`             | Opponent three-shot fouls                  | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_trip_rate`                | Shooting-foul trips per FGA                | player | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `team_pbp_trip_rate`           | Shooting-foul trips per FGA                | team   | NWMF    | Fouls › Drawn; Shooting › Free throws; Offense › Fouls drawn          |
| `opp_pbp_trip_rate`            | Opponent shooting-foul trips per FGA       | opp    | NWMF    | Fouls › Drawn; Shooting › Free throws; Defense › Fouls and violations |
| `pbp_made2_ast`                | Assisted twos                              | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_made2_ast`           | Assisted twos                              | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_made2_ast`            | Opponent assisted twos                     | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_made2_unast`              | Unassisted twos                            | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_made2_unast`         | Unassisted twos                            | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_made2_unast`          | Opponent unassisted twos                   | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_made3_ast`                | Assisted threes                            | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_made3_ast`           | Assisted threes                            | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_made3_ast`            | Opponent assisted threes                   | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_made3_unast`              | Unassisted threes                          | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_made3_unast`         | Unassisted threes                          | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_made3_unast`          | Opponent unassisted threes                 | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_ast2_share`               | Assisted share of twos                     | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_ast2_share`          | Assisted share of twos                     | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_ast2_share`           | Opponent assisted share of twos            | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_ast3_share`               | Assisted share of threes                   | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_ast3_share`          | Assisted share of threes                   | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_ast3_share`           | Opponent assisted share of threes          | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_unast_share`              | Unassisted share of makes                  | player | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `team_pbp_unast_share`         | Unassisted share of makes                  | team   | NWMF    | Scoring › Assisted and unassisted; Offense › Scoring                  |
| `opp_pbp_unast_share`          | Opponent unassisted share of makes         | opp    | NWMF    | Scoring › Assisted and unassisted; Defense › Scoring allowed          |
| `pbp_goaltend`                 | Defensive goaltending                      | player | NW··    | Fouls › Violations; Defense › Fouls and violations                    |
| `team_pbp_goaltend`            | Defensive goaltending                      | team   | NW··    | Fouls › Violations; Defense › Fouls and violations                    |
| `opp_pbp_goaltend`             | Opponent defensive goaltending             | opp    | NW··    | Fouls › Violations; Offense › Fouls drawn                             |
| `pbp_kicked`                   | Kicked balls                               | player | NW··    | Fouls › Violations; Defense › Fouls and violations                    |
| `team_pbp_kicked`              | Kicked balls                               | team   | NW··    | Fouls › Violations; Defense › Fouls and violations                    |
| `opp_pbp_kicked`               | Opponent kicked balls                      | opp    | NW··    | Fouls › Violations; Offense › Fouls drawn                             |
| `pbp_ast2`                     | Assists on twos                            | player | NWMF    | Playmaking › Passing; Offense › Playmaking                            |
| `pbp_ast3`                     | Assists on threes                          | player | NWMF    | Playmaking › Passing; Offense › Playmaking                            |
| `pbp_ast_pts`                  | Assist points                              | player | NWMF    | Playmaking › Creation; Offense › Playmaking                           |
| `pbp_ast_to3_share`            | Share of assists on threes                 | player | NWMF    | Playmaking › Passing; Offense › Playmaking                            |
| `team_pbp_ast_pts`             | Assist points                              | team   | NWMF    | Playmaking › Creation; Offense › Playmaking                           |
| `opp_pbp_ast_pts`              | Opponent assist points                     | opp    | NWMF    | Playmaking › Creation; Defense › Playmaking allowed                   |
| `team_pbp_lead_changes`        | Lead changes                               | team   | NWMF    | Results and strength › Game flow                                      |
| `team_pbp_times_tied`          | Times tied                                 | team   | NWMF    | Results and strength › Game flow                                      |
| `team_pbp_tied_share`          | Time tied                                  | team   | NWMF    | Results and strength › Game flow                                      |
| `team_pbp_largest_lead`        | Largest lead                               | team   | NWMF    | Results and strength › Game flow                                      |
| `team_pbp_lead_share`          | Time leading                               | team   | NWMF    | Results and strength › Game flow                                      |
| `team_pbp_best_run`            | Best run                                   | team   | NWMF    | Results and strength › Game flow; Offense › Scoring                   |
| `team_pbp_drought`             | Longest scoring drought                    | team   | NWMF    | Results and strength › Game flow; Offense › Scoring                   |
| `team_pbp_drought_fg`          | Longest field-goal drought                 | team   | NWMF    | Results and strength › Game flow; Offense › Scoring                   |
| `opp_pbp_largest_lead`         | Largest deficit                            | opp    | NWMF    | Results and strength › Game flow                                      |
| `opp_pbp_lead_share`           | Time trailing                              | opp    | NWMF    | Results and strength › Game flow                                      |
| `opp_pbp_best_run`             | Opponent best run                          | opp    | NWMF    | Results and strength › Game flow; Defense › Scoring allowed           |
| `opp_pbp_drought`              | Opponent longest scoring drought           | opp    | NWMF    | Results and strength › Game flow; Defense › Scoring allowed           |
| `opp_pbp_drought_fg`           | Opponent longest field-goal drought        | opp    | NWMF    | Results and strength › Game flow; Defense › Scoring allowed           |

### ratings (38)

| Metric                 | Label                                                                    | Who  | Leagues | Categories                                                    |
| ---------------------- | ------------------------------------------------------------------------ | ---- | ------- | ------------------------------------------------------------- |
| `team_mov`             | Margin of victory                                                        | team | NWMF    | Results and strength › Margin                                 |
| `team_srs`             | Simple Rating System                                                     | team | NWMF    | Results and strength › Adjusted ratings                       |
| `team_elo`             | Elo rating                                                               | team | NWMF    | Results and strength › Elo                                    |
| `team_adj_nrtg`        | Adjusted net rating                                                      | team | NWMF    | Results and strength › Adjusted ratings                       |
| `team_proj_w`          | Projected wins                                                           | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_playoff_pct`     | Playoff odds                                                             | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_pyth_w`          | Pythagorean wins                                                         | team | NWMF    | Results and strength › Pythagorean                            |
| `team_win_resid`       | Wins over Pythagorean                                                    | team | NWMF    | Results and strength › Pythagorean                            |
| `team_sos`             | Strength of schedule                                                     | team | NWMF    | Results and strength › Adjusted ratings                       |
| `team_adj_ortg`        | Adjusted offensive rating                                                | team | NWMF    | Results and strength › Adjusted ratings; Offense › Ratings    |
| `team_adj_drtg`        | Adjusted defensive rating                                                | team | NWMF    | Results and strength › Adjusted ratings; Defense › Ratings    |
| `team_elo_exp_w`       | Expected wins by Elo                                                     | team | NWMF    | Results and strength › Elo                                    |
| `team_pyth_pct`        | Pythagorean winning percentage                                           | team | NWMF    | Results and strength › Pythagorean                            |
| `team_sos_left`        | Strength of schedule left                                                | team | NWMF    | Results and strength › Schedule                               |
| `team_pyth_l`          | Pythagorean losses                                                       | team | NWMF    | Results and strength › Pythagorean                            |
| `team_games_left`      | Games left                                                               | team | NWMF    | Results and strength › Schedule                               |
| `team_elo_w_over`      | Wins over Elo                                                            | team | NWMF    | Results and strength › Elo                                    |
| `team_adj_home`        | Home court, per 100 possessions                                          | team | NWMF    | Results and strength › Adjusted ratings                       |
| `team_title_pct`       | Title odds                                                               | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_proj_l`          | Projected losses                                                         | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_mean_seed`       | Mean seed                                                                | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_top6_pct`        | Top-six odds                                                             | team | N···    | Predictive › Season forecast; Results and strength › Forecast |
| `team_play_in_pct`     | Play-in odds                                                             | team | N···    | Predictive › Season forecast; Results and strength › Forecast |
| `team_round2_pct`      | Second-round odds                                                        | team | N···    | Predictive › Season forecast; Results and strength › Forecast |
| `team_conf_finals_pct` | Conference finals odds                                                   | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_finals_pct`      | Finals odds                                                              | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `team_forecast_runs`   | Forecast runs                                                            | team | NW··    | Predictive › Season forecast; Results and strength › Forecast |
| `sdv_adj_o`            | Adjusted offensive rating (SportsDataverse)                              | team | ··MF    | Results and strength › Adjusted ratings; Offense › Ratings    |
| `sdv_adj_d`            | Adjusted defensive rating (SportsDataverse)                              | team | ··MF    | Results and strength › Adjusted ratings; Defense › Ratings    |
| `sdv_adj_em`           | Adjusted efficiency margin (SportsDataverse)                             | team | ··MF    | Results and strength › Adjusted ratings                       |
| `sdv_adj_tempo`        | Adjusted tempo (SportsDataverse)                                         | team | ··MF    | Results and strength › Adjusted ratings                       |
| `sdv_raw_o`            | Offensive rating, unadjusted (SportsDataverse)                           | team | ··MF    | Results and strength › Adjusted ratings; Offense › Ratings    |
| `sdv_raw_d`            | Defensive rating, unadjusted (SportsDataverse)                           | team | ··MF    | Results and strength › Adjusted ratings; Defense › Ratings    |
| `sdv_adj_em_blend`     | Adjusted efficiency margin, blended with the preseason (SportsDataverse) | team | ··MF    | Results and strength › Adjusted ratings                       |
| `team_net_rank`        | NET ranking                                                              | team | ····    | Results and strength › Rankings and seeds                     |
| `team_quadrant1`       | Quadrant 1 record                                                        | team | ····    | Results and strength › Rankings and seeds                     |
| `team_poll_rank`       | Poll ranking                                                             | team | ····    | Results and strength › Rankings and seeds                     |
| `team_tournament_seed` | NCAA tournament seed                                                     | team | ····    | Results and strength › Rankings and seeds                     |

### box_composites (24)

| Metric         | Label                         | Who    | Leagues | Categories                                    |
| -------------- | ----------------------------- | ------ | ------- | --------------------------------------------- |
| `per`          | Player Efficiency Rating      | player | NWMF    | Impact › Box-score models                     |
| `ows`          | Offensive Win Shares          | player | NWMF    | Impact › Box-score models; Offense › Impact   |
| `dws`          | Defensive Win Shares          | player | NWMF    | Impact › Box-score models; Defense › Impact   |
| `ws`           | Win Shares                    | player | NWMF    | Impact › Box-score models                     |
| `ws_48`        | Win Shares per 48 minutes     | player | NWMF    | Impact › Box-score models                     |
| `bpm`          | Box Plus/Minus                | player | N···    | Impact › Box-score models                     |
| `obpm`         | Offensive Box Plus/Minus      | player | N···    | Impact › Box-score models; Offense › Impact   |
| `dbpm`         | Defensive Box Plus/Minus      | player | N···    | Impact › Box-score models; Defense › Impact   |
| `vorp`         | Value Over Replacement Player | player | N···    | Impact › Box-score models                     |
| `pprod`        | Points produced               | player | NWMF    | Impact › Individual ratings; Offense › Impact |
| `poss_used`    | Possessions used              | player | NWMF    | Offense › Usage                               |
| `scoring_poss` | Scoring possessions           | player | NWMF    | Impact › Individual ratings; Offense › Impact |
| `floor_pct`    | Floor percentage              | player | NWMF    | Impact › Individual ratings; Offense › Impact |
| `ortg_ind`     | Individual offensive rating   | player | NWMF    | Impact › Individual ratings; Offense › Impact |
| `drtg_ind`     | Individual defensive rating   | player | NWMF    | Impact › Individual ratings; Defense › Impact |
| `stops`        | Stops                         | player | NWMF    | Impact › Individual ratings; Defense › Impact |
| `stop_pct`     | Stop percentage               | player | NWMF    | Impact › Individual ratings; Defense › Impact |
| `bpm_position` | BPM position estimate         | player | N···    | stored: not shown                             |
| `bpm_role`     | BPM offensive role            | player | N···    | stored: not shown                             |
| `team_ws`      | Win Shares                    | team   | NWMF    | Impact › Box-score models                     |
| `team_ows`     | Offensive Win Shares          | team   | NWMF    | Impact › Box-score models; Offense › Impact   |
| `team_dws`     | Defensive Win Shares          | team   | NWMF    | Impact › Box-score models; Defense › Impact   |
| `team_vorp`    | Value Over Replacement Player | team   | N···    | Impact › Box-score models                     |
| `team_pprod`   | Points produced               | team   | NWMF    | Impact › Individual ratings; Offense › Impact |

### indexes (37)

| Metric                | Label                                          | Who    | Leagues | Categories                                            |
| --------------------- | ---------------------------------------------- | ------ | ------- | ----------------------------------------------------- |
| `ts_pct_plus`         | True shooting percentage index                 | player | NWMF    | Shooting › Efficiency; Offense › Shooting             |
| `efg_pct_plus`        | Effective field-goal percentage index          | player | NWMF    | Shooting › Efficiency; Offense › Shooting             |
| `fg_pct_plus`         | Field-goal percentage index                    | player | NWMF    | Shooting › Field goals; Offense › Shooting            |
| `fg2_pct_plus`        | Two-point percentage index                     | player | NWMF    | Shooting › Twos; Offense › Shooting                   |
| `fg3_pct_plus`        | Three-point percentage index                   | player | NWMF    | Shooting › Threes; Offense › Shooting                 |
| `ft_pct_plus`         | Free-throw percentage index                    | player | NWMF    | Shooting › Free throws; Offense › Shooting            |
| `fg3a_rate_plus`      | Three-point attempt rate index                 | player | NWMF    | Shooting › Shot selection; Offense › Shooting         |
| `fta_rate_plus`       | Free-throw attempt rate index                  | player | NWMF    | Shooting › Free throws; Offense › Shooting            |
| `tov_pct_plus`        | Turnover percentage index                      | player | NWMF    | Playmaking › Turnovers; Offense › Turnovers           |
| `ast_pct_plus`        | Assist percentage index                        | player | NWMF    | Playmaking › Passing; Offense › Playmaking            |
| `orb_pct_plus`        | Offensive rebound percentage index             | player | NWMF    | Rebounding › Offensive; Offense › Rebounding          |
| `drb_pct_plus`        | Defensive rebound percentage index             | player | NWMF    | Rebounding › Defensive; Defense › Rebounding          |
| `trb_pct_plus`        | Total rebound percentage index                 | player | NWMF    | Rebounding › All rebounds                             |
| `stl_pct_plus`        | Steal percentage index                         | player | NWMF    | Defense › Steals and blocks                           |
| `blk_pct_plus`        | Block percentage index                         | player | NWMF    | Defense › Steals and blocks                           |
| `usg_pct_plus`        | Usage percentage index                         | player | NWMF    | Offense › Usage                                       |
| `team_ts_pct_plus`    | True shooting percentage index                 | team   | NWMF    | Shooting › Efficiency; Offense › Shooting             |
| `opp_ts_pct_plus`     | Opponent true shooting percentage index        | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed     |
| `team_efg_pct_plus`   | Effective field-goal percentage index          | team   | NWMF    | Shooting › Efficiency; Offense › Shooting             |
| `opp_efg_pct_plus`    | Opponent effective field-goal percentage index | opp    | NWMF    | Shooting › Efficiency; Defense › Shooting allowed     |
| `team_fg_pct_plus`    | Field-goal percentage index                    | team   | NWMF    | Shooting › Field goals; Offense › Shooting            |
| `opp_fg_pct_plus`     | Opponent field-goal percentage index           | opp    | NWMF    | Shooting › Field goals; Defense › Shooting allowed    |
| `team_fg2_pct_plus`   | Two-point percentage index                     | team   | NWMF    | Shooting › Twos; Offense › Shooting                   |
| `opp_fg2_pct_plus`    | Opponent two-point percentage index            | opp    | NWMF    | Shooting › Twos; Defense › Shooting allowed           |
| `team_fg3_pct_plus`   | Three-point percentage index                   | team   | NWMF    | Shooting › Threes; Offense › Shooting                 |
| `opp_fg3_pct_plus`    | Opponent three-point percentage index          | opp    | NWMF    | Shooting › Threes; Defense › Shooting allowed         |
| `team_ft_pct_plus`    | Free-throw percentage index                    | team   | NWMF    | Shooting › Free throws; Offense › Shooting            |
| `opp_ft_pct_plus`     | Opponent free-throw percentage index           | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed    |
| `team_fg3a_rate_plus` | Three-point attempt rate index                 | team   | NWMF    | Shooting › Shot selection; Offense › Shooting         |
| `opp_fg3a_rate_plus`  | Opponent three-point attempt rate index        | opp    | NWMF    | Shooting › Shot selection; Defense › Shooting allowed |
| `team_fta_rate_plus`  | Free-throw attempt rate index                  | team   | NWMF    | Shooting › Free throws; Offense › Shooting            |
| `opp_fta_rate_plus`   | Opponent free-throw attempt rate index         | opp    | NWMF    | Shooting › Free throws; Defense › Shooting allowed    |
| `team_tov_pct_plus`   | Turnover percentage index                      | team   | NWMF    | Playmaking › Turnovers; Offense › Turnovers           |
| `opp_tov_pct_plus`    | Opponent turnover percentage index             | opp    | NWMF    | Playmaking › Turnovers; Defense › Turnovers forced    |
| `team_orb_pct_plus`   | Offensive rebound percentage index             | team   | NWMF    | Rebounding › Offensive; Offense › Rebounding          |
| `team_drb_pct_plus`   | Defensive rebound percentage index             | team   | NWMF    | Rebounding › Defensive; Defense › Rebounding          |
| `team_trb_pct_plus`   | Total rebound percentage index                 | team   | NWMF    | Rebounding › All rebounds                             |
