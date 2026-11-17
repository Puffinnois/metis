# Live stats: what can be read without payment

Research for Plan T1202, done on 2026-11-17. The question: does any method give in-game stats, a box score and play by play that update during a game, without payment? Nothing was built. [D31](../../decisions.md) ("No real-time or in-game data") stands until the owner reads this and decides.

## How it was checked

- **Plain client.** `curl` 8.5.0 from WSL, no browser headers, no cookies, no referer. Each data URL was tried first with the client name `metis-research (https://github.com/Puffinnois/metis)`, and where that was refused, once more with curl's own default name (`curl/8.5.0`). Both are honest names; nothing imitated a browser. A host that refused both is recorded as refusing.
- **A few requests per host,** one per URL, no loops, no polling. Times are UTC, all on 2026-11-17.
- **No request to stats.nba.com** (D7). No HTML page was read for data (D24). No account or key was created; for a provider that needs one, its public documentation and terms are reported.
- **Documentation and terms pages** were read with curl or a web fetch tool; where a page refused, that is written down.
- **No game was in progress** during the checks (the day's first game tipped at 00:30 on 2026-11-18). So the in-game update rate of the feeds that answered was not observed; what is reported is the cache headers and the timestamps inside a finished game's data.

## Summary

| Candidate                    | In-game box and play by play            | Plain client answered                                         | Key, account or payment                              | Terms on automated reading                                   |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| NBA live CDN (`cdn.nba.com`) | Yes, published                          | **No:** HTTP 403 to both client names                         | None documented                                      | NBA.com terms section 9: no live or near-live play-by-play   |
| ESPN site API                | Yes, published                          | **Partly:** 403 to `metis-research`, 200 to `curl/8.5.0`      | None                                                 | Disney terms forbid automated extraction to build a database |
| SportsDataverse releases     | No: once a day                          | Yes (GitHub)                                                  | None                                                 | CC BY 4.0 (D6); already Metis's source                       |
| balldontlie                  | Paid tier only ($39.99/month)           | 401 without a key                                             | Account and key; free tier has games only, 5 req/min | Data usable for personal or commercial use                   |
| Sportradar trial             | Yes, in the trial                       | 403 without a key                                             | Account and trial key; 30 days, 1,000 calls          | Trial: evaluation only, no display of the data               |
| API-Sports (API-NBA)         | Live game states, no play by play found | 403 without a key; docs and terms pages refuse a plain client | Account and key; free 100 req/day                    | Not read: the terms page refused                             |
| SportsDataIO trial           | Trial data is scrambled                 | 401 without a key                                             | Account; production needs a commercial licence       | Not read                                                     |
| MySportsFeeds                | Live tiers not priced publicly          | 401 without a key                                             | Account; personal plans from $5/month                | Not read                                                     |
| TheSportsDB                  | Premium only (2-minute livescore)       | Free key `123` answered; NBA query not matched                | Livescore needs $9/month                             | Not read                                                     |

## The candidates

### 1. The NBA's live CDN feeds

**What it publishes.** The JSON files listed in [nba-statistics.md](nba-statistics.md) section 2 ("NBA Live / PBP") and section 19.2: today's scoreboard, a box score per game and its play by play, under `cdn.nba.com/static/json/liveData/`. The community wrapper `nba_api` reads them as its "live" endpoints. They are the in-game data, published during the game.

**Key, account or payment.** None documented.

**Plain client.**

| URL                                                                              | Client name        | Result                   | Time     |
| -------------------------------------------------------------------------------- | ------------------ | ------------------------ | -------- |
| `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`   | `metis-research …` | HTTP 403 "Access Denied" | 16:51:16 |
| `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_0022000181.json`     | `metis-research …` | HTTP 403 "Access Denied" | 16:51:17 |
| `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_0022000181.json` | `metis-research …` | HTTP 403 "Access Denied" | 16:51:17 |
| `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`   | `metis-research`   | HTTP 403 "Access Denied" | 16:51:31 |
| `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`   | `curl/8.5.0`       | HTTP 403 "Access Denied" | 16:51:31 |

The refusal is the CDN's own HTML page with a reference number, the same as the earlier research and as NBA.com's terms pages ([data-rights.md](data-rights.md)). Getting past it would mean imitating a browser, which D7 rules out.

**Terms.** NBA.com refuses its terms pages to a plain client; the owner supplied section 9, "NBA Statistics", on 2026-11-15 ([data-rights.md](data-rights.md), "The NBA"). Its condition 6 reads: no "product or service that presents a live, near-live or archived play-by-play account of any NBA game". Condition 7 is about a database "of comprehensive, regularly updated statistics" without the NBA's express prior consent.

**Result:** refused to a plain client.

### 2. ESPN's scoreboard and summary feeds

**What it publishes.** ESPN's site API, undocumented, the source of SportsDataverse's `espn_nba_*` files.

- The **scoreboard** (`site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`, optional `?dates=YYYYMMDD`) lists the day's games with status, clock, period and score. It showed the five games of 2026-11-17, all scheduled.
- The **summary** (`…/summary?event={id}`) is one game: a team box score (made and attempted, rebounds, assists, steals, blocks, turnovers, fast-break and paint points, lead changes and more), a player box score (MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-), and the play by play (489 plays for ORL at BOS on 2026-11-16, each with period, clock, score, team, shot coordinates and a `wallclock` time). It also carries win probability, and betting lines (`odds`, `pickcenter`, `againstTheSpread`), news and video links.
- The **core API** (`sports.core.api.espn.com/v2/…`) has the same games as linked resources; the status of a finished game answered.

**How late.** The scoreboard was served with `cache-control: max-age=1` and `max-age=2`, the summary with `max-age=10`: the server lets a copy be reused for seconds, which is what a feed updated during the game looks like. The core API's status was served with `max-age=900`. The update rate during a game was not observed (no game in progress).

**Key, account or payment.** None.

**Plain client.**

| URL                                                                                                                | Client name        | Result                            | Time     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------ | --------------------------------- | -------- |
| `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`                                          | `metis-research …` | HTTP 403 "Access Denied" (Akamai) | 16:51:17 |
| `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`                                          | `metis-research`   | HTTP 403 "Access Denied" (Akamai) | 16:51:31 |
| `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`                                          | `curl/8.5.0`       | HTTP 200, 101,963 bytes JSON      | 16:51:31 |
| `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261116`                           | `curl/8.5.0`       | HTTP 200, 191,074 bytes JSON      | 16:52:00 |
| `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909994`                             | `curl/8.5.0`       | HTTP 200, 476,244 bytes JSON      | 16:52:00 |
| `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/401909994/competitions/401909994/status` | `curl/8.5.0`       | HTTP 200, 321 bytes JSON          | 16:52:01 |

So the host refuses a client that names itself `metis-research` and answers one that names itself `curl/8.5.0`. Which names it accepts was not explored further, since that would be probing its filter. An app built on this would send some name of its own; whether that name is answered is not known, and sending curl's name from an app that is not curl would be a disguise.

**Terms.** The API has no public documentation and no terms of its own were found. espn.com's "Terms of Use" link opens the Disney Terms of Use ([disneytermsofuse.com/english](https://disneytermsofuse.com/english/), read with curl, HTTP 200, 16:54:55). Among what users may not do, the text lists to "access, monitor, copy or extract the Disney Products using a robot, spider, script, or other automated means, including … for the purposes of … compiling, building, creating or contributing to any collection of data, data set or database". [data-rights.md](data-rights.md) ("ESPN") has the rest of what the terms say and do not say.

**Result:** answered to curl's default name, refused to an honest custom name; in-game box and play by play are published; the Disney terms' clause on automated access applies to the site's products. The summary also carries betting lines, which D31 keeps out.

### 3. How often the SportsDataverse releases are rebuilt

Read through the GitHub API with `gh` (authenticated, HTTP 200 on every call), 16:52 to 16:55.

**ESPN-side files** (`espn_nba_*`, built by `sportsdataverse/hoopR-nba-data`):

- The raw store `hoopR-nba-raw` receives one commit a day, "NBA Raw Updated (Start: 2027 End: 2027)", at 12:17 or 12:18 on each of 2026-11-14 to 17. Its push starts the build by a `repository_dispatch`.
- The build workflow (`.github/workflows/daily_nba.yml`) runs on those dispatches and on a schedule, `cron: '0 7 * 11-12 *'` in November and December (with matching lines for the rest of the season). The dispatched runs finished between 12:31 and 12:48 each day; the scheduled one started late, between 13:54 and 16:42.
- Release assets for the current season (`2027` = 2026-27): `player_box_2027.parquet` updated 2026-11-17 12:32:06, `play_by_play_2027.parquet` 12:31:31, `nba_schedule_2027.parquet` 12:32:39. The 2026 season's files were last touched in September and October.

**NBA-stats-side files** (`nba_stats_*`, built by `sportsdataverse/hoopR-nba-stats-data`):

- The raw store `hoopR-nba-stats-raw` receives one commit a day, "NBA Stats Update (Start: 2027 End: 2027)", at 13:12 to 13:14. The build workflow's header says the fetching "lives in hoopR-nba-stats-raw (its droplet cron owns filling the raw store)" and that the build makes "No stats.nba.com calls".
- The build (`daily_nba_stats.yml`) has the same 07:00 schedule and ran at 16:35 to 16:48 on 2026-11-16 and 17. `nba_play_by_play_2027.parquet` was updated 2026-11-17 15:16:22.

**How late.** Once a day. A game that ends around 06:30 (a late West Coast game) reaches the ESPN-side files around 12:30, about six hours later; an early game, about twelve hours. The NBA-stats-side files follow an hour to four hours after that. Nothing is rebuilt during a game night. This is what Metis's daily refresh already reads.

**Key, account or payment.** None to download. **Terms:** the dataset's CC BY 4.0 (D6, [data-rights.md](data-rights.md)).

**Result:** no in-game data; the delay is one rebuild a day, mid-morning to midday UTC.

### 4. balldontlie

**What it publishes.** An NBA API with teams, players, games, player game stats, box scores, "live box scores" and play by play. Its documentation ([docs.balldontlie.io](https://docs.balldontlie.io/), read with a web fetch tool) says of the live box scores: "Data from this endpoint is LIVE. It will return all games for the current day updated in real time", and of play by play: "Play-by-play data is only available starting from the 2025 NBA season."

**Key, account or payment.** A key from a free account, sent as `Authorization`. Tiers per league as the documentation lists them: Free, $0, 5 requests a minute, teams, players and games only; ALL-STAR, $9.99 a month, 60 a minute, adds player game stats and injuries; GOAT, $39.99 a month, 600 a minute, every endpoint, box scores (live ones included) and plays. So in-game data needs payment.

**Plain client.** `https://api.balldontlie.io/v1/games?dates[]=2026-11-16`: HTTP 401 "Unauthorized", 16:53:19. `https://api.balldontlie.io/v1/box_scores/live`: HTTP 401, 16:53:20.

**Terms.** [balldontlie.io/terms](https://www.balldontlie.io/terms) (curl, HTTP 200, 16:54:54): "You may use Data for any lawful personal or commercial purpose, including paid apps, media, analytics, AI, competing products, and resale of original or modified Data, subject to Section 6. You may not use our Data to offer a sports-data API or equivalent data feed that substitutes for the BALLDONTLIE API." Where balldontlie gets its own data is not stated in what was read.

**Result:** in-game box and play by play exist, at $39.99 a month for the NBA.

### 5. Sportradar trial

**What it publishes.** Sportradar's NBA API, a commercial feed with live box scores and play by play.

**Key, account or payment.** A trial key from an account on its marketplace. Its developer documentation gives trials 30 days and a quota of 1,000 calls at 1 query a second ([developer.sportradar.com, Getting Started](https://developer.sportradar.com/getting-started/docs/your-account), as found by search; one Golf FAQ says 90 days). Its Getting Started page says: "Sportradar's APIs are a B2B (Business-to-Business) service and are not intended to be called directly from a client application."

**Plain client.** `https://api.sportradar.com/nba/trial/v8/en/games/2026/11/16/schedule.json`: HTTP 403 "Authentication Error", 16:53:20.

**Terms.** [developer.sportradar.com/terms-and-conditions](https://developer.sportradar.com/terms-and-conditions) (web fetch, "Last Updated: November 13, 2026"): a Free Trial is "non-commercial use of the Service provided by the Company to prospective customers … for internal testing and evaluation purposes only"; section 3.1, the customer "agrees not to, use the Products in connection with any commercial use … or any use involving publication or display of the Data or Content in any form or media"; section 3.2, not to "make the Service available to any third party".

**Result:** in-game data in the trial, for evaluation only and limited to 1,000 calls; not a method for an app.

### 6. API-Sports (API-NBA and API-Basketball)

**What it publishes.** Games, live game states, standings and team and player statistics, per its own guide as reported by search; no play-by-play endpoint was found.

**Key, account or payment.** A key from an account. The free plan: 100 requests a day, reset at midnight UTC, and 10 a minute; PRO $15 a month for 7,500 a day ([api-sports.io/sports/nba](https://api-sports.io/sports/nba) and the API-NBA beginner's guide, both as reported by search, since neither page answered directly; see below). How often live data updates was not found.

**Plain client.** `https://v2.nba.api-sports.io/games?date=2026-11-16`: HTTP 403, JSON "Missing application key", 16:53:20. `https://v1.basketball.api-sports.io/games?date=2026-11-16`: the same, 16:53:20. The documentation, pricing and terms pages refused: `https://api-sports.io/sports/nba` and `https://api-sports.io/terms` HTTP 403 to curl (16:54:54); `https://api-sports.io/pricing`, `https://api-sports.io/documentation/nba/v2` and the beginner's guide on api-football.com HTTP 403 to the web fetch tool.

**Terms.** Not read: the terms page refused a plain client.

**Result:** a free key gives 100 requests a day of game states, not a play by play; a game polled through the evening would use the day's quota quickly. Terms unknown.

### 7. SportsDataIO

**What it publishes.** NBA scores, box scores and play by play, a commercial feed.

**Key, account or payment.** The free trial needs an account and agreement to its terms; its page ([sportsdata.io/free-trial](https://sportsdata.io/free-trial), web fetch) says the trial lets developers "check response structures, fields, and integration code using scrambled data", and that production access "is only available as part of a commercial licensing discussion with our Sales team".

**Plain client.** `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/2026-NOV-16`: HTTP 401, "API key missing in request", 16:53:20.

**Terms.** Not read; the trial page does not include them.

**Result:** no usable free data; the trial's numbers are scrambled.

### 8. Others found

- **MySportsFeeds.** [Its pricing page](https://www.mysportsfeeds.com/feed-pricing/) (web fetch): NBA "Personal: starting at $5 per month for CORE feeds and Non-Live access", available to those who qualify; commercial from $29; pricing ranges "from Non-Live through Near-Realtime access" with no delay figure stated; a free trial on request. `https://api.mysportsfeeds.com/v2.1/pull/nba/2026-2027-regular/date/20261116/games.json`: HTTP 401 "Authentication Required", 16:53:20. Not free; live access not priced publicly.
- **TheSportsDB.** [Its pricing page](https://www.thesportsdb.com/pricing) (web fetch): free tier "30 requests per minute", "Most queries limited"; livescores only on paid tiers, "2 min livescore (Soccer, NFL, NBA, MLB, NHL)", from $9 a month. `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=2026-11-16&l=NBA` (with its documented public test key `123`): HTTP 200, `{"events":[],"Message":"Invalid League ID passed"}`, 16:53:21. Scores, not box scores, and not free when live.

## The plain answer

**No method gives in-game stats without payment within Metis's limits.**

- The NBA's own live feeds refuse a plain client (HTTP 403). Reaching them would mean disguising the client (D7), and section 9 of NBA.com's terms excludes a live or near-live play-by-play account.
- ESPN's site API publishes an in-game box score and play by play, free and keyless, served with caches of one to ten seconds. It refused the honest name `metis-research` and answered `curl/8.5.0`, so whether an app's own client name would be answered is not established. The Disney terms that espn.com links list automated extraction to build a collection of data among what users may not do. It is the only candidate that is technically free.
- The SportsDataverse releases, Metis's source, are rebuilt once a day, roughly six to twelve hours after a game ends. No faster free bulk route exists.
- Every provider with in-game data charges for it (balldontlie $39.99 a month, the cheapest found with live box scores and play by play) or limits its trial to evaluation without display (Sportradar) or to scrambled data (SportsDataIO). Free tiers carry games and scores at most.

**What the owner would have to decide before anything is built.** Building any of this is a new task and needs D31 reopened:

1. Whether Metis shows in-game data at all (D31's "No real-time or in-game data").
2. If yes, whether Metis may read a source directly, other than the dataset's releases (D31's "The data reached only through the dataset's releases", D6, D7).
3. For ESPN: whether reading an undocumented API, under terms that list automated extraction among what users may not do, is acceptable; and which client name Metis would send, knowing the host refused one honest name. Its play by play would also meet D31's "No list or replay of a game's plays as a product" if shown as a list.
4. For a paid provider: whether payment is acceptable (no payment so far in the plan), and who would hold the key, since each user would need their own.

Not checked: the feeds' behaviour during a game (none was being played), the ESPN core API with the `metis-research` name, and the API-Sports terms and documentation (refused).
