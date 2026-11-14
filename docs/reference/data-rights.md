# Data rights and credit: what was read

Plan T1101. What the terms of the dataset, its producers and its upstreams say, read on 2026-11-14, and how Metis's use sits against them. This is a record of what the texts say and where they are silent, not a legal opinion. The points nobody can settle from the texts are at the end, as questions for the owner.

## What Metis does with the data

The same for every source below:

- **Downloads** the dataset's Parquet files from `github.com/sportsdataverse/sportsdataverse-data/releases`, on the user's own machine, with a plain client. That is the only host it fetches data from (`src/main/stats/sources.ts`).
- **Stores** them locally in `stats.duckdb`, reshapes them into its own tables and computes stats from them (Stage 10's ratings and composites).
- **Redistributes nothing.** The installer ships no data (D6, D29); nothing is uploaded or shared.
- **Shows** the numbers in a free, open-source desktop app (Apache-2.0), with no account, ads or payment.
- **Never calls ESPN or stats.nba.com,** and never disguises a client (D7). It shows no logos, photos or video: only names and numbers.

## The texts

All fetched on 2026-11-14 with `curl` and its default user agent; GitHub's raw file host and its REST API for the repositories.

| Source                                           | URL                                                                                                                                                   | Result                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| sportsdataverse-data `LICENSE`                   | https://github.com/sportsdataverse/sportsdataverse-data/blob/main/LICENSE                                                                             | Read                                                                      |
| sportsdataverse-data README                      | https://github.com/sportsdataverse/sportsdataverse-data/blob/main/README.md                                                                           | Read                                                                      |
| Release notes of the NBA tags                    | https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/nba_stats_player_boxscores, `…/espn_nba_player_boxscores`, `…/nba_player_impact` | Read                                                                      |
| hoopR-nba-data `LICENSE.md`, `DESCRIPTION`       | https://github.com/sportsdataverse/hoopR-nba-data/blob/main/LICENSE.md                                                                                | Read                                                                      |
| hoopR-nba-stats-data `LICENSE.md`, `DESCRIPTION` | https://github.com/sportsdataverse/hoopR-nba-stats-data/blob/main/LICENSE.md                                                                          | Read                                                                      |
| hoopR-nba-raw, hoopR-nba-stats-raw `LICENSE.md`  | https://github.com/sportsdataverse/hoopR-nba-raw/blob/main/LICENSE.md, https://github.com/sportsdataverse/hoopR-nba-stats-raw/blob/main/LICENSE.md    | Read                                                                      |
| hoopR `LICENSE.md`, README                       | https://github.com/sportsdataverse/hoopR/blob/main/LICENSE.md                                                                                         | Read                                                                      |
| sportsdataverse-py `LICENSE`, README             | https://github.com/sportsdataverse/sportsdataverse-py/blob/main/LICENSE                                                                               | Read                                                                      |
| ESPN's terms of use                              | https://disneytermsofuse.com/english/ (the "Terms of Use" link in espn.com's footer)                                                                  | Read; "Last Updated: May 24, 2024"                                        |
| NBA.com's terms of use                           | https://www.nba.com/termsofuse, https://www.nba.com/terms-of-use                                                                                      | **Refused:** HTTP 403 "Access Denied" from the site's CDN, both addresses |
| Basketball-Reference method pages                | https://www.basketball-reference.com/about/per.html, `…/about/ws.html`, `…/about/bpm2.html`, `…/about/glossary.html`                                  | Read                                                                      |
| Sports Reference terms and data-use page         | https://www.sports-reference.com/termsofuse.html, https://www.sports-reference.com/data_use.html                                                      | Read; terms "Last Updated: May 19, 2023"                                  |
| FiveThirtyEight's NBA Elo method                 | https://fivethirtyeight.com/features/how-we-calculate-nba-elo-ratings/                                                                                | Gone: redirects to abcnews.com                                            |

The NBA's refusal was recorded and not worked around: no other client, header or mirror was tried.

## Source by source

### sportsdataverse-data, the release store

**What the text says.** Two statements that disagree. The `LICENSE` file is the MIT licence ("Copyright (c) 2023 SportsDataverse"), written for "the Software", and GitHub's API reports the repository as MIT. The README carries a CC BY 4.0 badge linking to Creative Commons, with no sentence saying what it covers. The README calls the repository the "release store" that the SportsDataverse packages load from, and names the producer repository of each release. The release notes name each upstream ("Upstream source: ESPN NBA API", "stats.nba.com official endpoints"). The NBA Stats releases add that their pipeline runs from a residential connection because stats.nba.com blocks datacenter addresses. Nothing in the repository speaks to ESPN's or the NBA's terms, or claims to license their data.

**What Metis does.** Downloads its NBA releases (`espn_nba_*`, `nba_stats_*`, `nba_player_impact`, `nba_crosswalk` and the reference tables) as above.

**Covered?** Either licence permits use, copying and adaptation; both ask for a notice or credit, which the app and README give. **Unclear:** which of the two licences applies to the files, and nothing here can grant rights SportsDataverse does not hold in ESPN's or the NBA's data.

### hoopR-nba-data and hoopR-nba-stats-data, the producers

**What the text says.** The repositories that build the NBA releases (`espn_nba_*` and `nba_crosswalk` from hoopR-nba-data, `nba_stats_*` and `nba_player_impact` from hoopR-nba-stats-data), and the raw repositories behind them, each carry a `LICENSE.md` putting their contents, "(data, code, and documentation)", under CC BY 4.0; their `DESCRIPTION` files say `License: CC BY 4.0`. The terms they restate: credit, a link to the licence, an indication of changes, and no suggestion that the licensor endorses the user. They do not mention ESPN's or the NBA's terms.

**What Metis does.** Reads what these repositories publish, through the release store. The app's credit names SportsDataverse, links CC BY 4.0, says Metis reshapes the data and computes from it, and says it is not endorsed.

**Covered?** **Looks covered** for SportsDataverse's own contribution: CC BY 4.0 permits any use, commercial or not, with credit. The credit in the app and README follows the four terms above. The licence covers only what the producers hold rights in.

### hoopR and sportsdataverse-py, the packages

**What the text says.** Both are under the MIT licence ("Copyright (c) 2020 hoopR authors"; sportsdataverse-py's own file). hoopR's README asks that publications cite the package. Their READMEs list the APIs they wrap: the NBA Stats API, ESPN, Basketball-Reference and others. The NBA impact models are built by Python in hoopR-nba-stats-data (`python/nba_model_*`), which the release card attributes to `sportsdataverse.nba` functions.

**What Metis does.** Neither package is used, installed or shipped. Metis reads the files they produce.

**Covered?** **Not applicable:** the MIT licence covers copies of the code, and Metis has none. The citation request is for publications.

### ESPN

**What the text says.** espn.com's "Terms of Use" link opens the Disney Terms of Use. They grant a personal, non-commercial licence to use Disney products, and list what users may not do without written permission, among them commercial use, use that suggests an association with Disney's brands, derivative works, and automated access to copy or extract the products for "compiling, building, creating or contributing to any collection of data, data set or database". They are silent on whether game statistics are Disney's content, and on people who never use an ESPN product but use a copy someone else made. No separate terms for ESPN's site API (the source of the `espn_nba_*` files) were found; it has no public documentation.

**What Metis does.** Never contacts ESPN. Its users download SportsDataverse's copy of ESPN's NBA data.

**Covered?** **Unclear.** The terms bind those who use ESPN's products; on their face, building a data set from ESPN by script is what the restriction names, and that is how the `espn_nba_*` files were made, by SportsDataverse, not Metis. Whether that reaches someone who uses the result, and whether box-score facts are covered at all, the text does not say.

### The NBA (stats.nba.com, NBA.com)

**What the text says.** Not read: NBA.com refused both terms addresses to a plain client (HTTP 403). What is known from elsewhere: stats.nba.com refuses plain clients (D7), and SportsDataverse's release notes say it blocks datacenter addresses, so its pipeline runs from a residential connection. The NBA's tie-break procedures Metis implements (T1003) are rules, read from nba.com earlier.

**What Metis does.** Never contacts stats.nba.com or NBA.com. Its users download SportsDataverse's copy of the NBA's data (`nba_stats_*`), which supplies most of Metis's tracking, hustle, play types, matchups, lineups and play by play. Team and player names, the NBA's name and its team names appear as text.

**Covered?** **Unclear: not read.** Someone has to read NBA.com's terms in a browser before `v1.0.0` (question 2).

### Basketball-Reference and the published methods

**What the text says.** The method pages describe PER (John Hollinger's), Win Shares (after Bill James and Dean Oliver), BPM 2.0 (written by its developer, Daniel Myers) and VORP, with formulas and constants. Each page carries the Sports Reference copyright notice and a trademark line, and states no terms for using the methods. Sports Reference's terms forbid, among other things, automated access that harms the site, using its content to build a database or service that substitutes for its own, and using it for AI training. Its data-use page notes that facts cannot be copyrighted.

**What Metis takes.** The methods only: the formulas and constants, rewritten in Metis's own code from these pages, computed on SportsDataverse's box scores, and labelled "Computed by Metis from the published method". It never fetches Basketball-Reference. Some published values (one player's PER, Win Shares and VORP line; SRS, MOV and SOS for every team of four seasons) are typed by hand into `tests/main/stats/models/composites.test.ts` and `scripts/check-team-strength.mjs` to check the formulas against. D24 keeps Basketball-Reference's data out.

**Covered?** **Looks covered:** the terms restrict use of the site and its content, not implementing a described formula; the checked values are facts typed by hand to test against, not a database the app reads. The names PER, Win Shares, BPM and VORP are used as the names of the methods.

### Other methods

FiveThirtyEight's NBA Elo method (T1002), Dean Oliver's ratings (from Basketball-Reference's pages and his book, T1005) and the SRS (T1001) are methods, implemented in Metis's own code with nothing of their authors' data. FiveThirtyEight's method page no longer exists (it redirects to abcnews.com), so its terms could not be read. The dataset no longer publishes DARKO (its fit of Kostya Medvedovsky's model): its impact file has had no `darko_*` columns since the November 2026 load, so the catalogue marks those metrics unavailable and the credit does not name it.

## The credit given

- **In the app:** the Data screen, reached from the load status in the nav, ends with "Data and credit" (`src/renderer/src/lib/stats/credit.ts`, checked by `tests/renderer/lib/statsCredit.test.ts`): SportsDataverse linked, CC BY 4.0 linked, ESPN and the NBA named as the origin, what Metis changes, whose each number is, no affiliation or endorsement, names belong to their owners, and Apache-2.0 kept apart from the data's terms.
- **In the README:** a "Data and credit" section with the same facts.
- **Attribution form:** CC BY 4.0 asks for credit "in any reasonable manner", a licence link and a note of changes; neither the release store nor the producers ask for a set wording. hoopR asks for a citation only in publications.

## Open questions for the owner

Questions 2 and 3 are open for the owner. Questions 1, 4 and 5 were decided by the manager of Stage 11.

1. **Which licence covers the files: MIT or CC BY 4.0?** The release store's licence file is MIT; its README badge and every producer repository say CC BY 4.0. The credit follows CC BY 4.0's terms; MIT's condition is about copies of the software, and Metis makes none. Options: (a) keep crediting under CC BY 4.0, as now; (b) credit under both; (c) ask SportsDataverse which applies, through an issue on sportsdataverse-data, before `v1.0.0`. **Decided by the manager, 2026-11-14: (a) keep crediting under CC BY 4.0.**
2. **NBA.com's terms were not read.** The site refused a plain client. Options: (a) the owner reads https://www.nba.com/termsofuse in a browser and records what it says on data and automated access here; (b) ask the NBA; (c) release without reading them, as `v0.4.0` to `v0.8.0` did (D29).
3. **ESPN's and the NBA's data reach Metis through a third party.** ESPN's terms forbid building a data set from its products by script, and the NBA's site blocks the datacenter clients SportsDataverse's pipeline avoids by running from a home connection. Neither text speaks to a user of the resulting copy, and Metis never contacts either site. Options: (a) release as now, crediting the source and redistributing nothing; (b) get advice from a lawyer before `v1.0.0`; (c) narrow what Metis downloads (for example, leave out the `nba_stats_*` or `espn_nba_*` families), which would remove most of the app's depth. This task changes nothing in what is downloaded.
4. **Should Metis say it is unofficial more prominently?** The disclaimer of affiliation is on the Data screen and in the README. Options: (a) keep it there; (b) add a line to the first-run screen or the installer (T1103). **Decided by the manager, 2026-11-14: (a) for now; a line in the installer is left to T1103.**
5. **The Basketball-Reference values in tests and check scripts.** A few hundred published numbers are typed by hand to check the formulas; Sports Reference's data-use page says facts may be reused. Options: (a) keep them; (b) replace them with values worked by hand from the formulas. **Decided by the manager, 2026-11-14: (a) keep them.**
