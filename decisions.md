# Decisions

Short log of decisions and why. Newest last. The previous implementation's log (Rust, Tauri) is in `decisions.md` on the `archive/rust-tauri` branch.

## 2026-11-05: the restart

**D1. Restart Metis as a TypeScript app.** The Rust/Python/Tauri implementation is archived at branch `archive/rust-tauri`, tag `archive/rust-tauri-final`. _Why:_ the owner chose to rebuild on the stack and approach that already worked in `fantasy-football-companion`.

**D2. Stack: Electron, React, TypeScript, Tailwind, DuckDB (`@duckdb/node-api`), `node:sqlite` for settings, npm, Vitest.** Same as the template, so its code and patterns carry over.

**D3. `fantasy-football-companion` is a read-only template for three things:** the user interface, the database structure, and the policy of a very extensive stats database. Nothing is ever changed in that project.

**D4. No fantasy features.** No leagues, rosters, trades, waivers, lineups, projections or advice. Fantasy-related stats on players and teams are allowed, as ordinary metrics.

**D5. Code is copied when something needs it, not all at once.** The template's screens and query layer are bound to its NFL catalogue; copied now they would be an NFL app under a new name. Each stage brings its files and tests across and rewrites what is football-specific. The copy has no link back and no fantasy-project history.

**D6. Data comes from sportsdataverse-data releases.** Free, keyless, Parquet, updated daily: the nflverse of basketball. Measurements are in `docs/reference/nba-data-sources.md`. The repository's licence file says MIT and its README shows CC BY 4.0; neither speaks for the upstream data from ESPN or the NBA. Read the terms and add the credit before a public release (Plan T1101).

**D7. No direct calls to stats.nba.com.** It refuses plain clients, and getting past that means imitating a browser (the archived adapter did). If the dataset ever lacks something, raise it with the owner rather than working around the site.

**D8. The extensive-data policy, as in the template:** every table a source publishes, every column as published and typed, zeros kept; rates stored as numerator and denominator; a missing source reads as NULL and never fails a rebuild; computed totals checked against published ones. D23 narrows "every table".

**D9. Every season each table offers,** not a recent window: box scores from 1993-94, play by play from 2001-02. Re-open only if the measured size or build time makes it impractical. Anything before 1993-94 needs another source and is out for now.

**D10. Seasons keep the source's label, the final year** (`2026` = 2025-26), in the data; the screens show `2025-26`.

**D11. The grain is the game, not the week.** The NBA has no weeks, so the template's week range becomes a date range and last N games. The nav's status names a date.

**D12. Season types are one set, mapped from each source:** regular, play-in, playoffs, NBA Cup final, All-Star, preseason. Stats default to the regular season; All-Star and preseason never count toward anything by default.

**D13. NBA ids are the primary keys** (`person_id`, `team_id`, `game_id`) from 1996-97. ESPN ids join through `nba_crosswalk` (players, teams and games, from 2001-02), with date plus team as the fallback for games. Who has no NBA id is in D28.

**D14. Sources are kept side by side, never overwritten.** Which source a metric reads is stated in the catalogue. A disagreement between sources is a measured result to report.

**D15. NBA only, no `League` abstraction.** The old rule against hardcoding league constants existed for a multi-league future that is not planned. Revisit if that changes. Replaced by D34.

**D16. Ask and the Claude connection are out of scope** until the owner asks. They were not part of the template brief.

**D17. One colour palette.** The template has a fantasy palette and a stats palette, and shared tokens resolve against the first even inside the second. Metis has one palette, the stats one.

**D18. Keep Apache-2.0.** The template's MIT code, by the same author, is compatible.

**D19. Keep the branch model:** working branches into `main`, `main` into `preprod`, `preprod` into `prod`. Replaced by D30.

## 2026-11-05: the overhaul plan

**D20. Stages are slices.** Each stage takes a slice from the data through to the screen and ends with something the owner can try, instead of all the data, then all the stats, then all the screens. _Why:_ built in layers, nothing could be judged until the end.

**D21. The first load runs in tiers:** core (100 MB), published (214 MB), events (360 MB), play by play (879 MB). Everything still loads by default, so D9 stands. _Why:_ the app is usable after the first tier, long before 1.7 GB has arrived.

**D22. Limits that stop the first full load (Plan T405):** a database file over 6 GB, a first load over an hour on the development machine, or more than 4 GB of process memory. Past any of them, the work stops and goes to the owner. _Why:_ the dataset is eight times the template's download, so its cost is unknown until measured.

**D23. A file proven to repeat others is skipped:** `*_master` and per-game files, where Plan T406 shows no information is lost. A file not proven to repeat others is loaded. This narrows "every table" in D8. _Why:_ the `*_master` files alone are 138 MB, and totals with denominators are what the policy stores anyway. Measured in Plan T406: only `*_master` qualifies; per-game files do not scale exactly to totals, so they stay.

**D24. Stats with no free bulk source stay out:** EPM, LEBRON, the NBA's Inside the Game models, Basketball-Reference and paid APIs. They are listed as unavailable with the reason. Metis does not scrape. This follows D7; revisit only if the owner asks.

**D25. The repository's shape:** `main` is the default branch. Old branches live on as tags under `archive/`. `main`, `preprod` and `prod` refuse force-pushes and require CI's `check` to pass, for admins too. A promotion can still fast-forward, because a commit on `main` has already passed `check`. _Why:_ nothing should reach the three branches unchecked. Since D30 this covers `main` alone.

**D26. A stage tag is not a release.** `vX.Y-stageN` marks a finished stage. A version tag such as `v1.0.0` runs the Release workflow, which requires it to match `package.json`. _Why:_ in the template every `v*` tag was a release, and a stage tag would only fail that version check. Stage tags end with `v0.6-stage8` (D30).

**D27. Source tables stay as published.** `season` is only cast to an INTEGER, and `file_season` and `source_file` are added to tell files apart. Season types and team codes are mapped in the `game` and `team` tables (Plan T407, T408). _Why:_ ESPN's 2000 files hold games of 1998-99 rightly marked 1999, which a file's label would overwrite; many files have no season type column at all, so it has to come from the game anyway; and correcting a mapping should never mean downloading the files again.

**D28. Every game and player has a key, whatever the sources know.** NBA ids stay the keys (D13). A game before 1996-97 is `espn:<id>`, and a player the NBA's data does not know gets the negative of their ESPN id. _Why:_ one type of key for every join, no chance of a collision, and those rows stay in the app instead of dropping out: 200 players, nearly all from before 1996-97.

**D29. The first public release comes before Stage 11.** On 2026-11-06 the owner asked for a release at the end of Stage 6 and chose to publish `v0.4.0`, knowing T1101 was still open. The dataset's licence file says MIT and its README shows CC BY 4.0; neither speaks for ESPN or the NBA. _Why:_ the installer holds no data, since each user downloads it from the source, and the app and README already credit that source. T1101 stays open and still has to be settled before `v1.0.0`. The installer is unsigned, and the install and update checks of T1103 and T1104 have not been run. D26 still holds: this version tag runs the Release workflow, and it matches `package.json`.

## 2026-11-11: one trunk

**D30. `main` is the only long-lived branch, and a stage ends with one tag.** `preprod` and `prod` are deleted. A stage closes with one PR that records the gate, ticks the stage and sets the version in `package.json`; on the owner's word it is merged and that commit is tagged `vX.Y.0`, which marks the stage and runs the Release workflow. This replaces D19 and narrows D25 and D26: the `vX.Y-stageN` tags stop at `v0.6-stage8`, and the Release workflow still ignores them. _Why:_ through eight stages both branches were only ever fast-forwarded to a commit already on `main`, so they checked nothing that `check` and the gate had not. Closing a stage took three PRs, two branch pushes and two tags; it now takes one PR and one tag. What shipped is still exact, because the tag names the commit.

## 2026-11-15: the lines Metis holds

**D31. The lines Metis holds,** the owner's decision. No money, ads, sponsorship, or donations tied to features. No gambling or odds. No fantasy features (D4). No real-time or in-game data. No logos, photos or video. "NBA", "WNBA" or "NCAA" never in the app's name, icon or domain. No list or replay of a game's plays as a product. NBA.com and ESPN credited as the sources. The data reached only through the dataset's releases (D6, D7). _Why:_ Metis is a personal project that shows statistics for private, non-commercial use, and these lines keep it one. Its use of the data stays as it is; the question is reopened if that use changes (`docs/reference/data-rights.md`, Plan T1101).

## 2026-11-16: unsigned releases

**D32. The installer and its updates are unsigned,** the owner's decision of 2026-11-16: Metis has no code-signing certificate. What an update is checked against instead: the app reads it over HTTPS from the repository's latest published GitHub release, and the downloaded installer must match the sha512 in that release's `latest.yml`. What follows: no publisher is checked (`app-update.yml` has no `publisherName`); Windows SmartScreen warns on the first install, and the README says how to go past it; a tag's Release workflow leaves a draft, which no installed copy sees until the owner publishes it (D30). This is an exception to "signed updates" in Plan.md's goal (Plan T1103, Stage 11 gate).

## 2026-11-17: the NBA's minimums

**D33. Leaderboards qualify by the NBA's statistical minimums,** the owner's decision of 2026-11-17 (Plan T1204), for the statistics the NBA publishes leaders in, each by its own minimum alone. Per 82 games: **58 games** for points, rebounds, assists, steals and blocks per game; **300 field goals made** for FG%, **82 threes made** for 3P%, **125 free throws made** for FT%. They were the 1,000-minute row qualifier plus 500 field-goal attempts, 200 three-point attempts and 125 free-throw attempts, and 70 % of the games on the home boards. A metric names the column its minimum counts (`qualifyBy`), since the NBA counts makes and games where a rate's sample is its attempts, and such a metric qualifies without the row qualifier: the screens rank it, and keep its rows under "Qualified only", by its own flag. The minimums scale with the team games in scope and are rounded to a whole count, which is how the NBA scales them in a shortened season (1998-99, 2011-12, and "on pace" in 2019-20 and 2020-21). _Source:_ Basketball-Reference's "Rate Statistic Requirements" page, read with a plain client on 2026-11-17; NBA.com's `stats/help/statminimums` and `pr.nba.com` refused it (HTTP 403), so the NBA's own page was not read (`docs/reference/nba-qualifying-minimums.md`). _What it does not cover:_ the rule is the NBA's since 2013-14, applied to every season; before it the NBA asked 70 games or a total, and 55 threes from 1997-98 to 2012-13, which Metis does not follow. Minutes per game, the one category the source lists that Metis does not hold to 58 games, stays on 1,000 minutes: `min` is the row qualifier of every other player metric, and one metric cannot qualify two ways. Measured over 1996-97 to 2026-27, it names the same leader as 58 games would in 29 of 31 seasons. Every other metric keeps its Stage 5 minimum and, for players, the 1,000 minutes: the other shooting rates, the estimated rates and composites, tracking, hustle, play types, matchups, shots, plays, on-court and impact metrics.

## 2026-11-17: more than one league

**D34. Metis covers more than one league, starting with the WNBA,** the owner's decision of 2026-11-17 (Plan Stage 13). This replaces D15. Leagues are designed for any number, not just two: the WNBA first (T1301), then NCAA Division I and the EuroLeague (T1302, T1303). The "leagues" D4 rules out are fantasy leagues; real basketball leagues are what this adds. The data policy, D7's and D24's limits and D31's lines hold for every league. _Why:_ the owner wants stats from several leagues, and the reference notes for European and NCAA basketball are already written. The WNBA's sources are measured in `docs/reference/wnba-data-sources.md`.

**D35. The whole app shows one league at a time.** A league menu beside the mark switches every screen, board, search and glossary entry to that league, and keeps you on the same screen. Each league remembers its own scope, settings and saved views; views saved before this belong to the NBA. The Data panel lists every league's releases, grouped by league, and a first run asks which leagues to download. One palette still (D17): the league is shown by name, not colour. Season labels (`2026` for the WNBA, `2025-26` for the NBA), per-minute rates (per 40 in a 40-minute league), season types, qualifying minimums and coverage notes follow the league. _Why:_ ranking players across leagues with different game lengths, pace and schedules says little, and a league filter on every screen would add a control for a comparison almost nobody wants. Comparing leagues can come later as a screen of its own.

**D36. Each league has its own stats file** in the data folder: `stats-nba.duckdb`, `stats-wnba.duckdb`. An existing `stats.duckdb` becomes `stats-nba.duckdb` without a new download, in the development profile and in the installer's data folder alike. Tables carry no league column, and only the worker opens the files (`CLAUDE.md` rule 3). `metis.db` stays one file for the app, with settings and saved views keyed by league. _Why:_ the NBA file and its queries stay as they are; a query cannot mix leagues or collide on ESPN or negative ids (D28) across them; one league's refresh never waits behind another's write; and a league can be deleted, and its size shown, as a file. Cross-league queries remain possible later through DuckDB's `ATTACH`.

## 2026-11-17: the WNBA's minimums

**D37. The WNBA's leaderboards qualify by the NBA's rule (D33), scaled, until the league's own rule is read** (Plan T1301.6, provisional). The minimums stay stated per 82 team games (`League.minimumsGames` is 82 in both leagues) and scale with the team games in scope, so a share of the season is asked whatever its length: 58 games of 82 asks 24 games of a 34-game season (2003 to 2019) and 31 of a 44-game one (2025, 2026); 300 field goals made asks 124 and 161, 82 threes 34 and 44, 125 free throws 52 and 67. A minimum counted in minutes scales by the game length as well (`minimumsMinutes` 48, T1301.2): the 1,000-minute row qualifier is 833 minutes over 82 games, 346 in a 34-game season and 447 in a 44-game one. A row grouped by opponent or month qualifies on the league's season shape (`League.seasonShape`): 11 opponents, the twelve-team seasons of 2010 to 2024, and four months, against the NBA's 29 and six. The screens say the rule is the NBA's scaled until the WNBA's own is read (`minimumsNote`). _Why:_ WNBA.com's "Qualifications for League Leaders" refused a plain client (HTTP 403) and stats.wnba.com is not called (D7), so the league's rule is not read; a search's summaries of those pages disagree with each other. A share of team games is what D33 already asks, and 70 % of a 44-game season is the 31 games those summaries give. _Measured_ (`scripts/check-wnba-leaders.mjs`, every season 1997 to 2026, against Basketball-Reference's season pages, whose own requirements are 20 games and 85 field goals made, 35 free throws, 20 threes): the per-game leader is the same in 29 of 30 seasons for points, 28 for rebounds and assists, 26 for steals and 29 for blocks; for the shooting percentages 22 of 30 (FG%), 15 (3P%) and 21 (FT%), since the NBA's makes, scaled by games alone, ask about twice B-R's counts (`wnba-data-sources.md`, "Qualifying minimums"). _Open:_ the owner reads the league's page, as for T1204, and a decision names the WNBA's rule; scaling the makes by the game length as the minutes are is the alternative left to that decision.

## 2026-11-18: NCAA Division I

Written in Plan T1302.1 and decided in its review; the measurements are in `docs/reference/ncaa-data-sources.md`. D43 stays provisional for the makes minimums only.

**D38. NCAA Division I is two leagues, men and women, each with its own stats file, sharing one college league shape in code.** `ncaam` and `ncaaw` in the league menu (D35), `stats-ncaam.duckdb` and `stats-ncaaw.duckdb` (D36). What they share sits in one place, so neither copies the other: the season label (`2025-26`), November to April, 40 minutes and per-40 rates, the three-point line (22 feet 1¾ inches for both across D39's seasons), conferences by season, non-Division I opponents, the tournaments as season types, players across transfers. What differs comes from the registry by league: the men's two halves against the women's four quarters, the releases, and the event names (D45). _Why:_ the starting position, unchanged by the measurements. stats.ncaa.org's 13 releases are the same for both, column for column, and ESPN's differ in depth, not in shape. Rankings across the two say nothing, as D35 has it for leagues.

**D39. The NCAA leagues start at the 2021-22 season (`2022`) and run to now, for men and women alike,** the owner's decision of 2026-11-18. Nothing older is loaded. This is an exception to the data policy's "every season each table offers" (D8, D9), as D9 limits the NBA to 1993-94 on. Rows of earlier seasons in files that hold every season (ESPN's schedule masters and `games_in_data_repo`) are left out at load. The coverage table in `ncaa-data-sources.md` still lists every season the releases offer (ESPN from 2001-02, stats.ncaa.org from 2009-10). A metric outside the window reads "Loaded from 2021-22". _Why:_ the owner's choice. Measured: every season would be about twice D22's 6 GB a league (12.7–14.5 GB of source tables for the men, 10.7–11.7 GB for the women). Before 2021-22 the women's ESPN box scores are a sample, stats.ncaa.org's first season is broken, the women's game crosswalk is missing, and the rules differ (the women's halves to 2014-15, two three-point lines). In the window both families cover every game and agree on 99.4–100 % of player lines.

**D40. Both families load side by side, ESPN's ids are the keys, and the catalogue says which source each table reads.** Policy 5 and D14. Keys: ESPN's `game_id`, `team_id` and `athlete_id`, which hold across seasons and transfers (12,173 men and 6,684 women have lines for more than one team). stats.ncaa.org's rows join through its own `espn_game_id`, from 2022-23 for the men and 2023-24 for the women, or else the crosswalks. They are never keys, since its player and team ids change every season. The 8–12 % of its player lines with no ESPN athlete in the crosswalk are matched by box score or get D28's keys. Read by default, from the measurements in the window:

- **Games:** ESPN's, with stats.ncaa.org's filling the games ESPN lacks (ESPN's 2024-25 women's schedule is short by about 300).
- **Box-score counts:** ESPN's (starters, did-not-play, its ids). stats.ncaa.org's provide the rim, mid-range, putback, transition and assisted splits, the possessions and the games ESPN lacks. The two equal each other on 99.4–100 % of paired lines.
- **Play by play, possessions, lineups, stints and shots:** stats.ncaa.org's. Every game, the ten players on the floor, every shot located; ESPN locates shots only from 2025-26.
- **Season stats and standings:** ESPN's, as published values.
- **Conferences:** the groups file, by season.

Non-Division I teams' games count for the Division I team, as the NCAA counts every game but exhibitions. Their players and teams are kept out of the leaderboards and ranks; the Division I list is the groups file's, by season. _Why:_ each source has what the other lacks, and they agree where both hold a game. ESPN's ids are the only ones that last.

**D41. The stats.ncaa.org releases are loaded, on the same footing as the `nba_stats_*` releases under D31,** the manager's decision of 2026-11-18 under D31 (the owner delegated this work's decisions; the owner may reverse it). The footing is the owner's rights decision of 2026-11-15:

- personal, non-commercial use;
- the sources credited;
- a takedown paragraph;
- a way to ship without the releases within a day.

So each NCAA league can be shipped and run without the `ncaa_*` releases, on ESPN's tables alone, and every metric that reads them then gives its reason. The facts: their producer repositories (`ncaa-mbb-hoops-data`, `ncaa-wbb-hoops-data`) have no licence file, unlike the ESPN producers' CC BY 4.0. Their upstream, stats.ncaa.org, refused a plain client (HTTP 403). The producer says it captures it under a rate budget, as the NBA's `nba_stats_*` releases capture stats.nba.com. `data-rights.md` gains an NCAA entry with these facts before the leagues ship. Without the releases the leagues lose the play by play with players on the floor, the possessions, lineups, stints, located shots before 2025-26 and RAPM; the box scores, from ESPN, remain. _Why:_ D6 and D31 take the data from the dataset's releases, and Metis makes no request to stats.ncaa.org (D7's reasoning).

**D42. ESPN's NCAA play by play is not loaded; each NCAA league loads every other table of D39's seasons.** The manager's decision of 2026-11-18. It is listed in the Data panel and the reference as left out, with its reason: no metric reads it, and D22's limit. It is revisited only if a metric needs it. Measured from DuckDB's bytes a row on 2021-22 and 2025-26 files. Every table of the window comes to about 5.9 GB (men) and 5.7 GB (women) with built tables. That is inside D22's 6 GB today and past it by April 2027, about 6.8 and 6.6 GB, since a full season adds about 1.05 GB. Without ESPN's play by play: about 4.1 and 3.9 GB now and 4.8 and 4.6 GB by April 2027. A season then adds about 0.8 GB, so 6 GB is reached around 2028-29. Downloads are 818 and 763 MB, about 5 minutes each, and the play rows (15.3 and 14.8 million) are well under the NBA's 34.9 million, so the hour holds. stats.ncaa.org's play by play is the one the play-built tables read (D40): every game, the ten players, 469 plays a game against ESPN's 319 in 2021-22, the final score equal on 99.9–100 % of games. ESPN's would sit beside it unread by any metric, at 1.45 GB. The alternatives measured were every table, with a larger limit for these leagues (about 7 GB each by April and a gigabyte more a season), and no play by play at all (about 1.8 and 1.7 GB, with lineups, stints and possessions kept). _Why:_ every table would pass D22's limit within the season, and a source no metric reads is not worth that. Leaving out a source that is not a repeat narrows policy 5 the way D23 does for repeats, which is why it is written here.

**D43. NCAA leaderboards qualify by the NCAA's games rule, 75 % of the team's games, and by D37's scaled makes until the NCAA's category minimums are read.** The NCAA's Statistics Policies and Guidelines, read with a plain client on 2026-11-18: "To be ranked, a student-athlete must appear in 75 percent of the team's games". A game is any game the player appeared in. This replaces D33's 58 of 82 for the per-game boards in these leagues, as the league's own rule. The makes minimums for the shooting percentages stay D37's: the NBA's counts per 82 team games, scaled to the team games in scope (about 113 field goals made and 47 free throws made in a 31-game season), and minutes by 40 over 48. The screens say the makes are the NBA's rule, scaled, until the NCAA's own are read. _Why:_ the NCAA publishes its per-category minimums only with its rankings on stats.ncaa.org, which refused a plain client, and its record books print champions without them. Checked: AJ Dybantsa's 894 points in 35 of BYU's games (2025-26) and Hannah Hidalgo's 202 steals in 36 equal the record book's champions. _Open:_ the owner reads stats.ncaa.org's footnotes in a browser, as for T1204, and a decision names the makes.

**D44. College sources with no free bulk route stay out, NET and quadrants among them (D24); SportsDataverse's published models load under its name.** Listed in the app as unavailable, each with its reason:

- KenPom: a paid API.
- Bart Torvik: its pages refused a plain client (HTTP 403) in the research.
- EvanMiya and Her Hoop Stats: subscriptions.
- Synergy, Sportradar, SportsDataIO and Genius: licensed feeds.
- CBB Analytics: no export.
- College Basketball Data: needs a key, and covers the men only.
- ESPN's BPI and SOR: not in the releases.
- NET and quadrants: no release holds them, stats.ncaa.org refuses a plain client, and ncaa.com's NET page answered a plain client only some of the time. That page holds the latest snapshot alone, with no history and no game-day ranks for quadrants.
- Polls and committee seeds: not in the releases.

Loaded as published values, labelled as SportsDataverse's and never as Metis's or another publisher's, as the WNBA's impact file is:

- The team ratings (`*_ratings`): opponent-adjusted offence and defence per 100 possessions, from sdv-py over ESPN's schedule and team box scores.
- The box-score BPM (`*_player_value`): team-constrained, from sdv-py over ESPN's player box scores.
- RAPM (`ncaa_*_rapm`): one ridge per season over all Division I possessions, from `ncaa-mbb-hoops-data` over stats.ncaa.org's possessions, checked by its maker against Torvik's AdjEM at a team rank correlation of 0.94–0.98.
- RAPM within team: a different estimand, never mixed with RAPM.

_Why:_ D7 and D24, unchanged. The models are computed and published by the dataset, like the WNBA's impact file.

**D45. College season types are the events, mapped from ESPN's schedule.** Regular season holds the conference tournaments and early-season events, each flagged by its `tournament_id`. Then the NCAA tournament, the NIT and WNIT, and the other postseason events of the window: CBI (2021-22 to 2024-25), CIT (2023-24), The Basketball Classic (2021-22), College Basketball Crown (2024-25, 2025-26), WBI (2021-22, 2022-23), WBIT (2023-24 on). Type 3 games are read by a rule over `notes_headline`, since ESPN spells the NCAA tournament two ways in the window ("Men's Basketball Championship", then "NCAA Men's Basketball Championship" in 2025-26). The default scope is every game, as the NCAA's official statistics include "postseason contests including conference and/or NCAA tournaments". Choosing the regular season alone, or leaving out a tournament, is a filter. There are no exhibitions in the data. _Why:_ ESPN files conference tournaments as regular season and every other event as postseason, and NBA playoff rules do not carry over (the research's section 18). Counting every game is what the NCAA's records do, and what its record book's champions were checked against.
