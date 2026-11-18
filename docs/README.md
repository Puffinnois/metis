# Metis documentation

Where to look, by question. The project's rules are in [CLAUDE.md](../CLAUDE.md), the decisions behind it in [decisions.md](../decisions.md) and the work, stage by stage with what each check found, in [Plan.md](../Plan.md).

## What the app does

| Document                                         | For                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [stats-screens.md](reference/stats-screens.md)   | Each screen: what it shows, where each number comes from, what a gap says, and how fast each click is                                   |
| [nba-statistics.md](reference/nba-statistics.md) | The statistics themselves: what each means, its formula and where it is published. Sections 3 to 18 are the 443 entries the plan covers |
| [stats-database.md](reference/stats-database.md) | The database: the source tables, the identity, game, season, play and model tables, the query engine, the refresh                       |

## What was measured

| Document                                                   | For                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [what-was-measured.md](reference/what-was-measured.md)     | **Start here.** The headline numbers with their dates: the first load, disk, memory, speed, agreement, and what is not measured yet                           |
| [nba-data-sources.md](reference/nba-data-sources.md)       | The dataset: its tables and sizes, the first full load tier by tier, the per-season checks of each stage, and the traps in the data                           |
| [nba-agreement.md](reference/nba-agreement.md)             | Box scores, identity, season tables, formulas and published tables against the sources, per season. Written by `scripts/check-agreement.mjs`                  |
| [nba-plays-agreement.md](reference/nba-plays-agreement.md) | Both play-by-play feeds rebuilt into box scores, per season. Written by `scripts/check-plays.mjs`                                                             |
| [nba-coverage.md](reference/nba-coverage.md)               | The first season each table really holds values; column by column in [nba-coverage.tsv](reference/nba-coverage.tsv). Written by `scripts/coverage-report.mjs` |
| [wnba-data-sources.md](reference/wnba-data-sources.md)     | The WNBA's releases: their tables, seasons and sizes, the first load, every family's checks per season, the playoff format and the traps                      |
| [wnba-agreement.md](reference/wnba-agreement.md)           | The WNBA's box scores, season tables, published tables, plays and models against the sources, per season                                                      |

## Shipping

| Document                                                       | For                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [data-rights.md](reference/data-rights.md)                     | The terms read for the dataset and its sources, the credit given, and the owner's decisions |
| [windows-install-check.md](reference/windows-install-check.md) | The install and update checklist, what was run on Windows on 2026-11-16 and what was not    |
| [icon/](icon/README.md)                                        | The app icon and how it is drawn                                                            |

## Research for other leagues

Metis covers the NBA and the WNBA (D34, which replaced D15 on 2026-11-17). These two catalogue statistics for competitions it does not load yet, as research for Plan T1302 and T1303; they change nothing in the app.

| Document                                                                         | For                                   |
| -------------------------------------------------------------------------------- | ------------------------------------- |
| [european-basketball-statistics.md](reference/european-basketball-statistics.md) | EuroLeague and EuroCup, men and women |
| [ncaa-d1-basketball-statistics.md](reference/ncaa-d1-basketball-statistics.md)   | NCAA Division I, men and women        |
