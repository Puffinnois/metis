# Stat categories: reference

How Metis groups its statistics for a reader, by what each one measures (Plan T1702, D52). The owner's request of 2026-11-23: a category's name should say exactly what it holds, so that the Defense tab shows every defensive statistic of a player, whatever table it comes from, and the same for Offense, Shooting and the rest.

The taxonomy was written and reviewed in T1702.1, which placed every metric of the catalogue, in every league, players and teams, opponents' metrics included. T1702.2 put it in the code: the registry `src/shared/stats/categories.ts`, a `categories` field on each `MetricDef` stated where the metric is defined, the Glossary by category, and D52. The code is now the one source of every placement: `node scripts/stat-categories.mjs` prints them (`--metrics` every metric, `--id=<metric>` one, `--category=<id>` one category) with the counts per category, sub-group and league. T1702.3 and T1702.4 put the categories on the other screens.

## What a category is

- **A category groups metrics by what they measure**: points, shots, passes, rebounds, fouls, a defensive act, a team's results. It has an id, a label, a one-sentence definition a reader can predict its contents from, and ordered **sub-groups**, each with its own sentence.
- **A metric sits in every category it belongs to**, one sub-group in each: second-chance points are Scoring and Rebounding; a block is Defense; a steal by a team's opponents is the team's Offense (below). The first category listed is the metric's **primary** one, where the Glossary describes it in full; an opponents' metric leads with the team's end, Offense or Defense, so "Opponent turnovers" is described under Defense.
- **The family stays, as the source.** `family` keeps saying which section of the reference and which kind of table a metric comes from (Tracking, Play by play, Shot zones, Impact (SportsDataverse)). It is no longer what the screens group by; it remains a filter ("From: Tracking") and a line on the metric's card.
- **Offense and Defense are umbrellas.** They hold every statistic of one end of the floor: Offense the scoring, shooting, playmaking, turnovers, offensive rebounding, fouls drawn, usage, offensive play types and offensive impact; Defense the steals and blocks, defended shots, matchups, defensive rebounding, fouls committed on defense, defensive hustle, defensive play types and defensive impact, and for a team everything its opponents did with the ball. Their sub-groups are headings that open the specific categories' sub-groups for that end (below, "Views over 40 metrics").
- **Overview is a preset, not a category.** It is today's default board (the tab's `groups` in `lib/stats/leaderboard.ts`, the dashboards' Overview tabs): the most-read numbers across categories. No metric is tagged Overview.

### The end of the floor, and opponents

Each placement rule names the end of the floor its act belongs to when the row's own player or team does it: offense (a shot, a point, a pass, a turnover, an offensive rebound, a foul drawn, a screen assist), defense (a steal, a block, a defensive rebound, a foul committed on defense, a contest, a deflection, a charge drawn, a goaltend, defensive three seconds), or neither (minutes, total rebounds, technicals, record, pace).

**A team's opponents' metric (`opp_*`) belongs to the other end.** What the opponents did with the ball is the team's Defense: `opp_pts` is Defense › Scoring allowed, `opp_fg3_pct` Defense › Shooting allowed, `opp_tov` Defense › Turnovers forced, `opp_oreb` Defense › Rebounding. What the opponents did on defense is the team's Offense: `opp_stl` (the team's turnovers lost to steals) is Offense › Turnovers, `opp_blk` (the team's shots blocked) Offense › Shooting, `opp_dreb` (the team's misses the opponents rebounded) Offense › Rebounding, `opp_pf` (fouls the team drew) Offense › Fouls drawn. An opponents' metric keeps its functional category too: `opp_fg3_pct` is in Shooting › Threes as well, and a team's view of a category shows the team's own metrics and its opponents' as two sides (below).

This replaces what `side` does today. `side` is documented as "which end it measures", but it is set by whose box score a column comes from: `team_stl`, `team_blk`, `team_pf` and `team_pbp_goaltend` read `side: 'offense'`, `opp_stl` reads `defense`. The categories carry the end; `side` can stay as "the team's own or its opponents'" (meanings, below).

## The categories

Fourteen categories, in the order the screens show them. A category with nothing in a league, or for players or teams, is not shown there (counts below): Predictive has no player metric in the college leagues (BOBAN's projection is the NBA's and WNBA's), Fantasy no team metric, Hustle and Play types are the NBA's alone.

| Category             | Holds, in one sentence                                                                                                                                                            | Sub-groups                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offense              | Everything a player or team does with the ball, and for a team what its opponents' defense did to it.                                                                             | Scoring; Shooting; Playmaking; Turnovers; Rebounding; Fouls drawn; Usage; Hustle; Play types; Impact; Ratings                                                                                                                                                          |
| Defense              | Everything a player or team does without the ball, and for a team everything its opponents did with it.                                                                           | Steals and blocks; Defended shots; Matchups; Rebounding; Fouls and violations; Hustle; Play types; Impact; Scoring allowed; Shooting allowed; Playmaking allowed; Turnovers forced; Ratings                                                                            |
| Scoring              | Points: how many, from which shots, in which situations, and how the baskets came.                                                                                                | Points; Points by shot; Points by situation; Assisted and unassisted; Starters and bench; Share of team                                                                                                                                                                |
| Shooting             | Shots taken and made: attempts, makes and percentages, by kind of shot, zone, distance and situation, free throws included.                                                       | Field goals; Twos; Threes; Free throws; Efficiency; Shot selection; Share of team; Restricted area and paint; Mid-range; Corner threes; Above the break and backcourt; Distances; Shot types; Catch-and-shoot and pull-up; Drives and touches; Transition and putbacks |
| Playmaking           | Making plays for others and keeping the ball: passes and assists, the shots created beyond them, handling the ball, and turnovers.                                                | Passing; Creation; Ball handling; Turnovers                                                                                                                                                                                                                            |
| Rebounding           | Rebounds at either end: how many, what share of the chances, contested or not, and the box outs behind them.                                                                      | Offensive; Defensive; All rebounds; Box outs                                                                                                                                                                                                                           |
| Fouls                | Fouls and violations: those committed, those drawn, and the flagrants, technicals and ejections.                                                                                  | Committed; Drawn; Violations; Flagrants, technicals and ejections                                                                                                                                                                                                      |
| Hustle and movement  | Effort and activity: the hustle plays the NBA counts (contests, deflections, loose balls, charges drawn, screen assists, box outs) and how far and how fast a player moved.       | Contests; Loose balls and deflections; Charges; Screens; Box outs; Movement                                                                                                                                                                                            |
| Play types           | How a player's plays ended, by the kind of play, on offense and on defense: possessions, frequency and results of each.                                                           | One a play type: Isolation, Transition, Pick-and-roll ball handler, Pick-and-roll roll man, Post-up, Spot-up, Handoff, Cut, Off screen, Putbacks, Miscellaneous; then the seven defended, "Isolation defense" to "Off screen defense"                                  |
| Impact               | How much a player adds to the team's results: the team's margin with them on the floor and off it, and the all-in-one models and composites built from box scores and plus-minus. | On court; Plus-minus models; Box-score models; Box-score composites; Individual ratings; All-around production                                                                                                                                                         |
| Predictive           | Numbers that look ahead: a season's forecast for a team, a projection for a player, each named as its maker's estimate.                                                           | Season forecast; Player projections                                                                                                                                                                                                                                    |
| Results and strength | Winning and how strong a team is: record, margin, ratings, pace and possessions, ratings adjusted for opponents, Elo, Pythagorean record, schedule, game flow and forecast.       | Record; Margin; Ratings; Pace and possessions; Adjusted ratings; Elo; Pythagorean; Schedule; Game flow; Forecast; Rankings and seeds                                                                                                                                   |
| Playing time         | How much a player was on the floor: games, starts, minutes, possessions, and the games they missed.                                                                               | Games and minutes; Possessions; Games missed                                                                                                                                                                                                                           |
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

- _Field goals_, _Twos_, _Threes_, _Free throws_: makes, attempts, misses and percentages of each (free throws with the free-throw rate, also in Fouls › Drawn, and the and-ones and shooting-foul trips); the player's own shots blocked (`nba_blka`) are Field goals.
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
- _Drawn_: fouls drawn, free-throw attempt rate, shooting fouls drawn, and-ones, two- and three-shot trips, trips per attempt, the fouls drawn on drives and touches, charges drawn.
- _Violations_: defensive three seconds, defensive goaltending, kicked balls.
- _Flagrants, technicals and ejections_.

**Hustle and movement**: _Contests_ (contested shots, twos and threes), _Loose balls and deflections_, _Charges_, _Screens_ (screen assists and their points), _Box outs_, _Movement_ (distance and average speed, on offense and defense).

**Play types**: one sub-group a play type, each with its 13 metrics (possessions, frequency, points, points per possession, FG, FG%, eFG%, free-throw, turnover, shooting-foul, and-one and score frequencies); the seven defended types after the eleven on offense.

**Impact**

- _On court_: the team with the player on the floor and off it: plus-minus (box score and plays), on, off and on-less-off ratings, pace, the team's eFG%, turnover and rebound rates on court, the opponents' points by situation on court, the NBA's on-court ratings, minutes and possessions on court.
- _Plus-minus models_: RAPM and its kin, REML RAPM among them, as SportsDataverse publishes them; BOBAN's skill estimate; DARKO's, unavailable since the dataset dropped it.
- _Box-score models_: PER, Win Shares, BPM, VORP, SPM and WAR, Metis's and SportsDataverse's side by side, SportsDataverse's box prior, the NBA's defensive win shares.
- _Box-score composites_: Efficiency (EFF), Game Score, PIE.
- _Individual ratings_: Dean Oliver's individual offensive and defensive ratings, points produced, scoring possessions, floor percentage, stops and stop percentage.
- _All-around production_: double-doubles, triple-doubles, quadruple-doubles, five-by-fives, and the combined counts (points, rebounds and assists together, and their pairs; T1703.2).

**Predictive**: _Season forecast_ (projected wins and losses, playoff, play-in, round and title odds, mean seed, and how many runs the forecast made), _Player projections_ (BOBAN's next season and its spread in the NBA and WNBA; DARKO's, unavailable in every league; T1703 adds more).

**Results and strength**

- _Record_: wins, losses and win percentage (for a player, the team's in the games they played).
- _Margin_: point differential, margin of victory.
- _Ratings_: offensive, defensive and net ratings and points per possession, each source's beside Metis's.
- _Pace and possessions_: pace and the possession estimates, each source's beside Metis's.
- _Adjusted ratings_: SRS, strength of schedule, the adjusted ratings and home court, SportsDataverse's adjusted efficiency for the colleges.
- _Elo_, _Pythagorean_: the rating and the wins it expects; the Pythagorean record and the wins over it.
- _Schedule_: games left and the strength of schedule left.
- _Game flow_: lead changes, times tied, time leading or tied, largest lead and deficit, best runs, droughts.
- _Forecast_: the season forecast, also here.
- _Rankings and seeds_: NET, quadrants, polls and seeds, listed as unavailable (D44).

**Playing time**: _Games and minutes_ (games, starts, minutes, minutes on court from the plays), _Possessions_ (possessions played, the NBA's), _Games missed_ (injury or illness, other reasons).

## The hard cases

How the cases that could go more than one way were decided. The rule behind most of them: **a metric is placed by the act it counts** (a point, a shot, a pass, a rebound, a foul, a defensive act, a result), and by the end of the floor that act belongs to.

1. **A turnover is Playmaking and Offense.** Playmaking › Turnovers, since keeping the ball is half of making plays, and Offense › Turnovers as a heading of its own, not folded into Offense › Playmaking, so a reader of Offense sees ball security beside scoring. The opponents' turnovers are the team's Defense › Turnovers forced.
2. **Plus-minus is Impact › On court.** The manager's list had "On court and lineups" and "Impact and all-in-one" apart. Raw plus-minus, on-off and on-court ratings are the simplest measure of impact and the input of the plus-minus models, and a reader looking for impact expects plus-minus; two categories would split one question. So On court is a sub-group of Impact. Lineups are a screen of their own with no catalogue metric, so nothing is lost by the name. A player's own rates counted from the plays while on court (usage, AST%, rebound, steal and block percentages "on court") are placed by their act, not in Impact: `onc_usg_pct` is Offense › Usage, `onc_ast_pct` Playmaking › Passing.
3. **The league indexes go with their rate**, not in a category of their own: TS+ and eFG+ are Shooting › Efficiency, 3P+ Shooting › Threes, TOV%+ Playmaking › Turnovers, AST%+ Playmaking › Passing, ORB%+ Rebounding › Offensive, STL%+ and BLK%+ Defense › Steals and blocks, USG%+ Offense › Usage. An index says how a rate compares with the league; what it measures is the rate's. Their family (`indexes`) stays, so "League indexes" remains a source filter.
4. **Opponents' defensive acts are the team's Offense** (above), where the manager's starting list put "for teams everything their opponents did" under Defense. Opponents' steals, blocks, defensive rebounds, fouls and violations measure the team's ball security, shots blocked, misses lost and fouls drawn, which a reader of Defense would not expect to find there. Approved in the manager's review; an opponents' metric's primary category is that end.
5. **Fouls are a category of their own.** Defense cannot hold them all: offensive fouls are committed with the ball (Offense › Turnovers), technicals, ejections and loose-ball fouls belong to neither end, and fouls drawn are offense. Fouls committed on defense (personal, shooting, non-shooting, take, clear path) and the defensive violations (three seconds, goaltending, kicked balls) are also Defense › Fouls and violations. **Personal fouls (`pf`) count as defensive** though they include offensive fouls (counted apart, `pbp_pf_offensive`), since nearly all are committed on defense and a reader of Defense expects them; the shooting share of fouls and the loose-ball fouls have no end.
6. **Usage is Offense › Usage alone.** It is neither scoring nor playmaking: it is the share of the team's plays a player finishes, by shot, free throw or turnover. Possessions used (`poss_used`) sits with it.
7. **Tracking is a source, not a category.** The manager's list had "Tracking and movement". Tracking holds drives, touches, passes, rebound chances, catch-and-shoot, pull-ups and rim protection: by what they measure they are Playmaking, Shooting, Rebounding and Defense, and a reader of Shooting looking for catch-and-shoot 3P% should find it there. Distance and speed are Hustle and movement › Movement. A tracking dashboard's outcomes are spread by the act each counts: a drive's FG% is Shooting › Drives and touches, its points Scoring › Points by situation, its passes and assists Playmaking › Passing, its turnovers Playmaking › Turnovers, its fouls Fouls › Drawn; the drives themselves Playmaking › Creation.
8. **Play types stay whole**, unlike tracking dashboards: 234 metrics, 13 for each of 18 play types, would swamp Scoring and Shooting, and the NBA, Synergy and every reader treat a play type as one unit. They are in Play types and in Offense › Play types or Defense › Play types.
9. **Hustle stays a category**, as the NBA names and publishes it, named Hustle and movement since distance and speed join it (the manager's review: "Playing time" does not predict average speed; both are the NBA's alone, so the label holds wherever the tab shows), and each hustle statistic also sits in its own category: contests in Defense › Defended shots, deflections and defensive loose balls in Defense › Hustle, charges drawn in Defense › Hustle and Fouls › Drawn, box outs in Rebounding › Box outs, screen assists in Playmaking › Creation and Offense › Hustle.
10. **Availability is Playing time › Games missed.** Two metrics, NBA only (games out for injury or illness, and for other reasons), are a part of how much a player played, not a tab.
11. **Double-doubles and the rest are Impact › All-around production** (named All-around games until T1703.2 added the combined counts). They count games of all-round production, which is what "all-in-one" means; they measure no one act.
12. **Pace and possessions.** A team's are Results and strength › Pace and possessions, with no end: pace is both ends'. A player's possessions played are Playing time › Possessions; the pace with a player on the floor is Impact › On court.
13. **Ratings.** A team's offensive rating is Results › Ratings and Offense › Ratings, its defensive rating also Defense › Ratings, its net rating Results alone; the same for the adjusted ratings and SportsDataverse's college ratings. A player's on-court ratings (the NBA's `nba_ortg` and Metis's `onc_ortg`) are Impact › On court with the end.
14. **Game flow** is Results and strength; best runs and droughts are also Offense › Scoring (the team's) or Defense › Scoring allowed (the opponents'). Largest lead, largest deficit and time leading have no end.
15. **Season forecasts** are Predictive › Season forecast and Results › Forecast, so they are shown under the name a reader looks for ahead and beside the record. DARKO's skill estimate is Impact › Plus-minus models and Predictive › Player projections; BOBAN's, a rating rather than a forecast, is Impact › Plus-minus models alone, and its next-season projection and spread Predictive › Player projections (T1703.2).
16. **A player's wins and losses** are Results › Record: the team's record in the games they played.
17. **Assisted and unassisted makes** are Scoring › Assisted and unassisted (how the baskets came); a team's assisted share is also Playmaking › Passing, the usual measure of ball movement.
18. **Shares of the team** (`share_*`, the NBA's on-court `nba_share_*`) go with their act: share of rebounds is Rebounding, of steals Defense, of fouls Fouls, of points Scoring.
19. **Second-chance points and putbacks** are Scoring › Points by situation and Rebounding › Offensive. Points off turnovers and fast-break points are Scoring only; the opponents' are Defense › Scoring allowed.
20. **Free-throw rate is Shooting › Free throws and Fouls › Drawn**, and Offense › Fouls drawn: it is free-throw attempts per shot, and the usual measure of getting to the line (the manager's review). The opponents' is the team's Defense › Fouls and violations. And-ones and shooting-foul trips are both Fouls › Drawn and Shooting › Free throws.
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

A query takes at most 40 metrics (`MAX_COLUMNS`). Every **sub-group** is at most 40 for one kind and one side in every league today (counts above: the largest are Shooting › Distances and Corner threes, 32 and 27 a side, and Playmaking › Turnovers, 30 for NBA players). So a category's view is shown **one sub-group at a time**: the category's tab shows its sub-groups as presets, and choosing one fills the board with all its metrics. A team's view of a category has two sides, the team's own and its opponents', each a set of presets (today's Offense and Defense team tabs become those sides). An umbrella's sub-groups over 40 (Offense › Shooting, 226 for NBA players; Offense › Play types, 143) open the specific category's sub-groups for that end: Offense › Shooting › Corner threes is Shooting › Corner threes with the offense metrics.

T1702.3 adds a test that every sub-group is at most 40 a kind and side in each league, so a PR adding metrics past it must split the sub-group.

The category's tab opens on its **headline preset**: its `core` metrics, then `extended` ones read from games, up to 12, as `familyMetrics` does today for a family.

### Leaderboards

- **Category tabs** replace the family preset menu: Overview, then the categories with metrics for the kind on screen. NBA players see Overview and all 14 (Predictive and Fantasy since T1703.2); WNBA players 12; NCAA players 11 (no Predictive); NBA teams Overview and 11.
- **Positions** (All, Guards, Forwards, Centers) stay, as a compact control beside the category tabs, since the two are independent; T1701's filters can later carry position as an attribute, but that is T1701's decision, not this one.
- **Teams**: the Offense and Defense tabs become the Offense and Defense categories, which hold their end whoever's columns hold it; every other category has a Team side and an Opponents side. **Which side a team metric shows on** (the manager's review of T1702.3): in the categories about what a side does with the ball, Scoring, Shooting and Playmaking, the side of the metric's end of the floor, its Offense or Defense placement, so the team's shots blocked (`opp_blk`) and turnovers lost to steals (`opp_stl`) show on the Team side beside its field goals and turnovers, and the opponents' turnovers and FG% (`opp_tov`, `opp_fg_pct`) on the Opponents side; in the categories whose acts happen at both ends (Rebounding, Fouls, Hustle and movement and the rest) the side is whose box score it is. The rule moves three metrics in the catalogue of 1.3.0, `opp_stl`, `opp_blk` and `opp_ncaa_rim_blocks`, and no team metric in those three categories lacks an end, so it has no gap (`teamSide` in `lib/stats/categoryViews.ts`, tested on those four).
- **Key stats** open every category, Offense and Defense too: a specific category's core metrics, then those read from games, twelve at most; Offense and Defense open on their own, chosen lists (`UMBRELLA_KEY_STATS` in `lib/stats/categoryViews.ts`, the manager's review of T1702.3), a metric the league lacks skipped and the next taken, twelve at most: for teams the rating and the four factors lead at both ends (ORtg, PTS, eFG%, TS%, TOV%, ORB%, FT rate, then FG%, 3PM, 3P%, AST and the adjusted offence where the league has it; DRtg, Opp PTS, Opp eFG%, Opp TS%, Opp TOV%, DRB%, Opp FT rate, then Opp FG%, Opp 3P%, STL, BLK and the adjusted defence); for players PTS, TS%, eFG%, FG%, 3PM, 3P%, FT%, AST, AST%, TOV%, USG%, then the offensive on-court rating or model, and STL, BLK, STL%, BLK%, DREB, DRB%, rim FG% allowed, deflections, contested shots, then the defensive on-court rating and models.
- **Sub-group presets** under the tabs, as chips; the column groups in the table header name the sub-group (`columnGroups`), not the family.

### Column picker

Grouped by category, then sub-group, in the registry's order, a metric listed under each category it sits in (picking it once adds it once). The search stays. A "From" filter shows the families as sources (Tracking, Play by play, SportsDataverse). Today's grouping by family label goes.

### Glossary

By category, then sub-group: each metric described in full under its primary category, and named with a link under the others ("Also in Defense › Rebounding"). The category filter replaces the family filter; the family is a line of each entry ("From: Tracking"). Metrics a league does not have stay listed with their reason, as today.

### Player page

Today's tabs: Overview, Scoring, Shooting, Shots, Play by play, Playmaking, Rebounding, Defense, Tracking, Play types, Matchups, Game log, Splits, On/off, Profile.

- Overview stays. **Scoring, Shooting, Playmaking, Rebounding, Defense, Fouls, Hustle and movement, Play types, Impact, Playing time** become category tabs, each with its sub-groups as sections, every metric of the category reachable. **Offense** is a tab too, its sections the umbrella's sub-groups; long sections start folded.
- **Shots** goes into Shooting: the shot chart heads its zone sections. **Play by play** and **Tracking** go (sources), their metrics spread by category. **Matchups** goes into Defense, its per-opponent table as the Matchups section.
- Game log, Splits, On/off and Profile stay: they are views of a player, not categories. Old `drive.mjs` step files click tabs by place (the comment in `PLAYER_DASH_TABS`): T1702.4 rewrites the steps that do.
- Predictive and Fantasy appear when they have a player metric.

### Team page

Today's tabs: Overview, Offense, Defense, Shots, Play by play, Players, Lineups, Splits, Schedule, On/off. Overview stays; Offense and Defense become the umbrella categories; **Scoring, Shooting, Playmaking, Rebounding, Fouls, Hustle and movement, Impact, Predictive, Results and strength** are added as category tabs, each with the team's side and the opponents'. Shots goes into Shooting (the chart heads the zones); Play by play goes. Players, Lineups, Splits, Schedule and On/off stay.

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

## Decisions of the manager's review (2026-11-23)

1. **Opponents' defensive acts in Offense** (hard case 4): approved. An opponents' metric's primary category is the team's end, Offense or Defense.
2. **The list changed from the starting one**: approved. Overview is a preset; Tracking is a source (hard case 7); On court is a sub-group of Impact (hard case 2); Availability is in Playing time (hard case 10); Fouls is added (hard case 5); Results and strength, since players have a record too. With these changes: Movement leaves Playing time for **Hustle and movement** (id `hustle`); Results and strength's "Efficiency and pace" splits into **Ratings** and **Pace and possessions**; free-throw attempt rate is also **Fouls › Drawn** (hard case 20); All-around production (then All-around games) stays in Impact. Fourteen categories, of which a screen shows at most 12 today.
3. **Positions** stay as a control beside the category tabs on the players' board: approved.
4. **The primary category** is the first listed, with the rule in 1: approved.
5. **The appendix**, the reviewed list of every metric's placements, was removed by T1702.2: the code is the one source, `scripts/stat-categories.mjs` prints it and the Glossary shows it. The rules, hard cases and counts stay, the counts dated with their commit. It is in this file's history at the merge of T1702.1 (#126).
6. **The meanings**: all approved, applied in T1702.2. `eff` is "Efficiency (EFF)"; the family labels read as sources ("Box-score rates", "Splits and shares"); `side` is documented as the team's own or its opponents', with no rename in code.

## Counts

Generated from `CATALOGUE` at 3ac033b (1.3.0) with the placements as reviewed, the catalogue T1702.2 started from; `node scripts/stat-categories.mjs` prints them for any later commit. Each league is read through `catalogueInfo` (`src/main/stats/engine/registry.ts`) as the screens read it. A metric counts in a league where it is not unavailable there; the games columns (`gp`, `team_gp`) are left out of the screen counts, as `appliesTo` leaves them out of the boards. NCAA Men and NCAA Women have the same metrics.

1622 metrics in the catalogue; 2 stored (`bpm_position`, `bpm_role`), placed nowhere since no screen shows them; 1620 placed; **0 unplaced**.

1313 metrics sit in more than one category; a metric sits in 1 to 3 categories, 1.90 on average.

9 placed metrics are in no league today (each reads unavailable with its reason): `gp`, `team_gp`, `sdv_darko_skill`, `sdv_darko_next`, `sdv_darko_sd`, `team_net_rank`, `team_quadrant1`, `team_poll_rank`, `team_tournament_seed`.

### By category and league

Metrics shown in each category; a metric in several categories counts in each, so the columns add up to more than the last row.

| Category             | NBA players | NBA teams | WNBA players | WNBA teams | NCAA Men players | NCAA Men teams | NCAA Women players | NCAA Women teams |
| -------------------- | ----------: | --------: | -----------: | ---------: | ---------------: | -------------: | -----------------: | ---------------: |
| Offense              |         564 |       281 |          299 |        277 |              239 |            238 |                239 |              238 |
| Defense              |         190 |       265 |           50 |        258 |               38 |            237 |                 38 |              237 |
| Scoring              |          46 |        65 |           33 |         65 |               22 |             58 |                 22 |               58 |
| Shooting             |         235 |       360 |          194 |        360 |              156 |            304 |                156 |              304 |
| Playmaking           |          82 |        56 |           37 |         54 |               33 |             57 |                 33 |               57 |
| Rebounding           |          54 |        22 |           22 |         18 |               20 |             22 |                 20 |               22 |
| Fouls                |          43 |        63 |           34 |         62 |               21 |             40 |                 21 |               40 |
| Hustle and movement  |          25 |        15 |            – |          – |                – |              – |                  – |                – |
| Play types           |         234 |         – |            – |          – |                – |              – |                  – |                – |
| Impact               |          86 |        11 |           70 |         10 |               49 |              9 |                 49 |                9 |
| Predictive           |           6 |        11 |            2 |          8 |                – |              – |                  – |                – |
| Results and strength |           3 |        88 |            3 |         84 |                3 |             56 |                  3 |               56 |
| Playing time         |           8 |         – |            6 |          – |                5 |              – |                  5 |                – |
| Fantasy              |           5 |         – |            5 |          – |                3 |              – |                  3 |                – |
| Shown in the league  |         821 |       624 |          398 |        604 |              292 |            489 |                292 |              489 |

### By sub-group

The most metrics any sub-group shows in one view: players, and teams as the team's own / its opponents' (one side each). NCAA Women equals NCAA Men. Over 40 in bold: only the umbrellas' headings, which open the specific sub-groups.

| Category             | Sub-group                           |   NBA P |       NBA T |  WNBA P |      WNBA T |  NCAA P |      NCAA T |
| -------------------- | ----------------------------------- | ------: | ----------: | ------: | ----------: | ------: | ----------: |
| Offense              | Scoring                             |  **46** |  **43** / – |      33 |  **43** / – |      22 |      33 / – |
| Offense              | Shooting                            | **226** | **171** / 1 | **185** | **171** / 1 | **147** | **141** / 4 |
| Offense              | Playmaking                          |  **50** |       7 / – |      15 |       7 / – |      13 |       6 / – |
| Offense              | Turnovers                           |      31 |      21 / 1 |      23 |      21 / 1 |      21 |      21 / 3 |
| Offense              | Rebounding                          |      15 |       4 / 1 |       7 |       4 / 1 |       7 |       5 / 3 |
| Offense              | Fouls drawn                         |      21 |      12 / 9 |      13 |      12 / 9 |      11 |      11 / 3 |
| Offense              | Usage                               |       6 |           – |       6 |           – |       4 |           – |
| Offense              | Hustle                              |       4 |       4 / – |       – |           – |       – |           – |
| Offense              | Play types                          | **143** |           – |       – |           – |       – |           – |
| Offense              | Impact                              |      22 |       2 / – |      17 |       2 / – |      14 |       2 / – |
| Offense              | Ratings                             |       – |       5 / – |       – |       5 / – |       – |       6 / – |
| Defense              | Steals and blocks                   |      13 |       2 / – |      13 |       2 / – |      16 |       7 / – |
| Defense              | Defended shots                      |       6 |       3 / – |       – |           – |       – |           – |
| Defense              | Matchups                            |      26 |           – |       – |           – |       – |           – |
| Defense              | Rebounding                          |      15 |       4 / 2 |       7 |       4 / 2 |       7 |       5 / 3 |
| Defense              | Fouls and violations                |      11 |      9 / 12 |      11 |      9 / 12 |       4 |      3 / 11 |
| Defense              | Hustle                              |       4 |       4 / – |       – |           – |       – |           – |
| Defense              | Play types                          |  **91** |           – |       – |           – |       – |           – |
| Defense              | Impact                              |      24 |       1 / 2 |      19 |       1 / 2 |      11 |       1 / 2 |
| Defense              | Scoring allowed                     |       – |      – / 28 |       – |      – / 28 |       – |      – / 31 |
| Defense              | Shooting allowed                    |       – | – / **168** |       – | – / **168** |       – | – / **141** |
| Defense              | Playmaking allowed                  |       – |       – / 4 |       – |       – / 4 |       – |       – / 6 |
| Defense              | Turnovers forced                    |       – |      – / 21 |       – |      – / 21 |       – |      – / 21 |
| Defense              | Ratings                             |       – |       4 / 1 |       – |       4 / 1 |       – |       4 / 2 |
| Scoring              | Points                              |       1 |       1 / 1 |       1 |       1 / 1 |       1 |       1 / 1 |
| Scoring              | Points by shot                      |      10 |      10 / 6 |      10 |      10 / 6 |       6 |       6 / 6 |
| Scoring              | Points by situation                 |      20 |     13 / 10 |       7 |     13 / 10 |       4 |     10 / 10 |
| Scoring              | Assisted and unassisted             |      13 |      14 / 8 |      13 |      14 / 8 |      10 |     11 / 11 |
| Scoring              | Starters and bench                  |       – |       2 / – |       – |       2 / – |       – |       2 / – |
| Scoring              | Share of team                       |       2 |           – |       2 |           – |       1 |           – |
| Shooting             | Field goals                         |       6 |       5 / 6 |       6 |       5 / 6 |       7 |      7 / 10 |
| Shooting             | Twos                                |       4 |       4 / 4 |       4 |       4 / 4 |       4 |       4 / 4 |
| Shooting             | Threes                              |       4 |       4 / 4 |       4 |       4 / 4 |       5 |       5 / 5 |
| Shooting             | Free throws                         |      15 |     16 / 16 |      15 |     16 / 16 |      15 |     15 / 15 |
| Shooting             | Efficiency                          |      13 |     12 / 11 |      12 |     12 / 11 |      10 |     10 / 10 |
| Shooting             | Shot selection                      |       6 |       6 / 4 |       6 |       6 / 4 |       4 |       4 / 4 |
| Shooting             | Share of team                       |      13 |           – |      13 |           – |       6 |           – |
| Shooting             | Restricted area and paint           |      18 |     18 / 18 |      18 |     18 / 18 |      19 |     19 / 20 |
| Shooting             | Mid-range                           |       9 |       9 / 9 |       9 |       9 / 9 |      11 |     11 / 11 |
| Shooting             | Corner threes                       |      27 |     27 / 27 |      27 |     27 / 27 |      24 |     24 / 24 |
| Shooting             | Above the break and backcourt       |      18 |     18 / 18 |      18 |     18 / 18 |      16 |     16 / 16 |
| Shooting             | Distances                           |      32 |     32 / 32 |      32 |     32 / 32 |      32 |     32 / 32 |
| Shooting             | Shot types                          |      30 |     30 / 30 |      30 |     30 / 30 |       – |           – |
| Shooting             | Catch-and-shoot and pull-up         |      16 |           – |       – |           – |       – |           – |
| Shooting             | Drives and touches                  |      24 |           – |       – |           – |       – |           – |
| Shooting             | Transition and putbacks             |       – |           – |       – |           – |       3 |       3 / 3 |
| Playmaking           | Passing                             |      35 |       7 / 4 |      14 |       7 / 4 |      12 |       6 / 6 |
| Playmaking           | Creation                            |       8 |       3 / 1 |       1 |       1 / 1 |       1 |       1 / 1 |
| Playmaking           | Ball handling                       |       9 |           – |       – |           – |       – |           – |
| Playmaking           | Turnovers                           |      30 |     20 / 21 |      22 |     20 / 21 |      20 |     20 / 23 |
| Rebounding           | Offensive                           |      16 |       5 / 3 |       8 |       5 / 3 |       8 |       6 / 4 |
| Rebounding           | Defensive                           |      15 |       4 / 1 |       7 |       4 / 1 |       7 |       5 / 3 |
| Rebounding           | All rebounds                        |      15 |       4 / 1 |       7 |       4 / 1 |       5 |       3 / 1 |
| Rebounding           | Box outs                            |       8 |       4 / – |       – |           – |       – |           – |
| Fouls                | Committed                           |      13 |     11 / 11 |      13 |     11 / 11 |       9 |       8 / 8 |
| Fouls                | Drawn                               |      22 |     13 / 12 |      13 |     12 / 12 |      11 |     11 / 11 |
| Fouls                | Violations                          |       3 |       3 / 3 |       3 |       3 / 3 |       – |           – |
| Fouls                | Flagrants, technicals and ejections |       5 |       5 / 5 |       5 |       5 / 5 |       1 |       1 / 1 |
| Hustle and movement  | Contests                            |       3 |       3 / – |       – |           – |       – |           – |
| Hustle and movement  | Loose balls and deflections         |       5 |       5 / – |       – |           – |       – |           – |
| Hustle and movement  | Charges                             |       1 |       1 / – |       – |           – |       – |           – |
| Hustle and movement  | Screens                             |       2 |       2 / – |       – |           – |       – |           – |
| Hustle and movement  | Box outs                            |       8 |       4 / – |       – |           – |       – |           – |
| Hustle and movement  | Movement                            |       6 |           – |       – |           – |       – |           – |
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
| Impact               | Plus-minus models                   |      13 |           – |       7 |           – |       6 |           – |
| Impact               | Box-score models                    |      23 |       4 / – |      13 |       3 / – |       8 |       3 / – |
| Impact               | Box-score composites                |       4 |       4 / 2 |       4 |       4 / 2 |       3 |       3 / 2 |
| Impact               | Individual ratings                  |       7 |       1 / – |       7 |       1 / – |       7 |       1 / – |
| Impact               | All-around production               |       8 |           – |       8 |           – |       8 |           – |
| Predictive           | Season forecast                     |       – |      11 / – |       – |       8 / – |       – |           – |
| Predictive           | Player projections                  |       6 |           – |       2 |           – |       – |           – |
| Results and strength | Record                              |       3 |      26 / – |       3 |      26 / – |       3 |       3 / – |
| Results and strength | Margin                              |       – |       2 / – |       – |       2 / – |       – |       2 / – |
| Results and strength | Ratings                             |       – |      10 / 1 |       – |      10 / 1 |       – |       5 / 2 |
| Results and strength | Pace and possessions                |       – |       9 / 1 |       – |       8 / 1 |       – |       6 / 3 |
| Results and strength | Adjusted ratings                    |       – |       6 / – |       – |       6 / – |       – |      13 / – |
| Results and strength | Elo                                 |       – |       3 / – |       – |       3 / – |       – |       3 / – |
| Results and strength | Pythagorean                         |       – |       4 / – |       – |       4 / – |       – |       4 / – |
| Results and strength | Schedule                            |       – |       2 / – |       – |       2 / – |       – |       2 / – |
| Results and strength | Game flow                           |       – |       8 / 5 |       – |       8 / 5 |       – |       8 / 5 |
| Results and strength | Forecast                            |       – |      11 / – |       – |       8 / – |       – |           – |
| Results and strength | Rankings and seeds                  |       – |           – |       – |           – |       – |           – |
| Playing time         | Games and minutes                   |       3 |           – |       3 |           – |       3 |           – |
| Playing time         | Possessions                         |       3 |           – |       3 |           – |       2 |           – |
| Playing time         | Games missed                        |       2 |           – |       – |           – |       – |           – |
| Fantasy              | Points                              |       5 |           – |       5 |           – |       3 |           – |
