# Metis

Metis is a desktop app for basketball statistics that runs on your own computer, for the NBA, the WNBA and NCAA Division I men's and women's basketball. It downloads public data into a database per league on your machine, then lets you rank, filter, sort and compare players and teams across every season, from 1993-94 in the NBA, 1997 in the WNBA and 2021-22 in the college leagues to today. A menu beside the name switches every screen between the leagues. The stats are read from those databases, and Metis shares nothing.

**Status: version 1.1, for Windows.** [Download the latest release](https://github.com/Puffinnois/metis/releases/latest). The stages are in [Plan.md](Plan.md), the reasoning in [decisions.md](decisions.md).

## What it has

| Screen           | What it answers                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leaderboards** | Who leads on any stat, in any season, season type, date range or last N games; per game, totals, per 36, per 48 (per 40 in the WNBA and the college leagues) or per 100 possessions. Saved views and CSV |
| **Players**      | One player's dashboard: overview, scoring, shooting, a shot chart, play by play, tracking, play types, matchups, game log, splits, on/off, profile and combine                                           |
| **Teams**        | One team's dashboard: record, ratings and strength, shots, players, lineups, splits, schedule, on/off                                                                                                    |
| **Standings**    | The published standings by conference or division, with Metis's SRS, Elo and, for the season in progress, a forecast of playoff and title odds                                                           |
| **Explore**      | Chart any stat against another, compare three players or teams, and follow a stat across a career against the league each season                                                                         |
| **Games**        | Any day's games: box scores, score by period, a game-flow chart, Elo before and after, officials, and who guarded whom                                                                                   |
| **Glossary**     | Every metric: what it means, how it is computed, which seasons it covers and how stable it is from one season to the next                                                                                |

The **Data panel**, opened from the status line, shows what is loaded, lets you pause a load, and gives the data's credit.

**The statistics.** The box score from 1993-94 and the stats built on it (shooting, possessions, ratings, shares, game splits). What the NBA publishes per season: its advanced dashboards, player tracking from 2013-14, play types from 2015-16, hustle from 2016-17, matchups from 2017-18, five-man lineups from 2007-08, the draft combine and the injury reports. Counted from the play by play from 1996-97: shot zones, clutch and quarter splits, on/off and lineups of two to five, turnover and foul types, game flow. Computed by Metis from published methods: SRS, Elo, opponent-adjusted ratings, a season forecast, PER, Win Shares, BPM, VORP, league indexes (TS+) and each stat's stability.

**In the WNBA**, from 1997: the box score and the stats built on it, the league's advanced dashboards, five-man lineups, the play by play and shots (zones and charts from 2011, where every shot has a location), officials from 2004, and Metis's ratings and models fitted to the league (rates per 40 minutes). No release publishes WNBA tracking, hustle, play types, matchups, the draft combine or an injury report: those tabs are not shown, and the Glossary says why for each of their stats. The leaderboards qualify by the NBA's minimums, scaled to the WNBA's season, until the league's own are read.

**In NCAA Division I**, men's and women's, from 2021-22 (nothing older is loaded): ESPN's box scores, schedules, rosters, season stats and standings, with stats.ncaa.org's beside them for the rim, mid-range, putback, transition and assisted splits, possessions and the games ESPN lacks; stats.ncaa.org's play by play, shots, lineups and stints, so splits by half (men) and quarter (women), clutch, on/off, units and game flow; SportsDataverse's team ratings, BPM and RAPM under its name; and Metis's SRS, Elo, adjusted ratings, PER and Win Shares fitted to each league on games between Division I teams (rates per 40 minutes). Conferences, non-Division I opponents and the postseason tournaments are part of the season; the leaderboards rank Division I players by the NCAA's 75 % games rule and its makes per game. No release publishes college tracking, play types, matchups or a draft combine, and the NCAA tournament has no forecast since its field is chosen by a committee: each says why.

A stat outside its seasons reads blank with the reason, such as "Recorded from 2013-14.", never zero. Each screen is described in [docs/reference/stats-screens.md](docs/reference/stats-screens.md).

## The first run

The installer holds no data. On first launch Metis asks which leagues to download, with each one's size and the free space it needs. The WNBA alone takes about 6 minutes, a 294 MB download and an 850 MB database (Stage 13, 2026-11-18). Each college league takes about 17 minutes, an 800 MB download and a 4.4 GB (men) or 4.2 GB (women) database, at a peak of about 3.3 GB of memory (2026-11-20). The NBA, measured on the development machine (Stage 10 gate, 2026-11-14; 27 minutes again on 2026-11-18; [what was measured](docs/reference/what-was-measured.md)):

- **Time:** about 34 minutes, mostly the download, so it depends on your connection. Earlier loads on a faster connection took 12 to 21 minutes. The leaderboards are usable about 3 to 5 minutes in, while the rest loads.
- **Disk:** a first load needs 6 GB free. The database ends at 5.3 GB, in `%APPDATA%\Metis`. The download is about 1.6 GB, and each file is deleted once loaded.
- **Memory:** about 2.7 GB at its peak, across the app's processes.

You can quit during a load: it carries on from where it stopped next time. After that, Metis refreshes at launch and every 6 hours while open: the season in progress is checked daily, older seasons are kept as loaded, and a refresh with nothing new takes about 20 seconds.

These numbers come from loads in WSL on the development machine. On Windows, on a machine in use for other things, first loads took 76 minutes (about 20 of them the download) and 106 minutes, then 47 minutes once Metis asked Windows to run it at full speed; that load was short six files whose downloads failed. Each ended with a 5.3 GB file and about 2 GB of memory at the peak (2026-11-16, Plan T1104).

## Installing and updating

The Windows installer is not code-signed, so on first install Windows SmartScreen says it "protected your PC". Click **More info**, then **Run anyway**. The installer puts Metis in your user folder without admin rights; uninstalling it keeps your data in `%APPDATA%\Metis`. Updates come from this repository's published releases: Metis checks at launch and every hour, downloads a newer version in the background and checks it against the release's `latest.yml` checksum, then shows **Update to x.y.z** in the top bar. Nothing installs until you choose **Update & restart**.

Installing, uninstalling and an update were run on Windows 11 on 2026-11-16, with test builds of 0.8.1 and 0.8.2 and a local update feed. The installer asked for no admin rights, quitting did not install the update, Update & restart did, and the uninstall kept the data folder. Not yet run on Windows: SmartScreen on a browser download, an update from this repository's published releases, a differential update download, a refresh, and the installer and first run on a clean machine ([docs/reference/windows-install-check.md](docs/reference/windows-install-check.md)).

## Data and credit

- NBA data is published by [SportsDataverse](https://github.com/sportsdataverse/sportsdataverse-data) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and comes originally from [ESPN](https://www.espn.com/nba/) and [NBA.com](https://www.nba.com/stats).
- WNBA data is published by [SportsDataverse](https://github.com/sportsdataverse/sportsdataverse-data) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and comes originally from [ESPN](https://www.espn.com/wnba/) and [WNBA.com](https://www.wnba.com/stats). Metis downloads it only once you turn the WNBA on in the Data panel.
- NCAA Division I data, men's and women's, is published by [SportsDataverse](https://github.com/sportsdataverse/sportsdataverse-data), from [ESPN](https://www.espn.com/mens-college-basketball/), whose files are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and from the NCAA's [stats.ncaa.org](https://stats.ncaa.org), whose files state no licence. Metis downloads it only once you turn a college league on in the Data panel.
- Metis downloads it on your own machine, reshapes it into its own tables and computes stats from it. The installer contains no data, and Metis shares nothing.
- Whose numbers are whose: box scores, play by play, tracking and the rest are as ESPN, NBA.com, WNBA.com and stats.ncaa.org publish them; possessions, lineups and the impact models (RAPM, SPM, BPM, WAR) are SportsDataverse's calculations, labelled "(SportsDataverse)"; SRS, Elo, the adjusted ratings, the season forecast, PER, Win Shares, BPM, VORP, Oliver's ratings, the league indexes and stability are computed by Metis from published methods, and say so.
- Metis is not affiliated with or endorsed by the NBA, the WNBA, the NCAA, ESPN or SportsDataverse. Team, school and player names, and the NBA, WNBA, NCAA and ESPN names, belong to their owners.
- Metis's Apache-2.0 licence covers the app, not the data, which keeps its own terms. What was read is in [docs/reference/data-rights.md](docs/reference/data-rights.md).

**Contact and takedown.** Metis is a personal, non-commercial project. A rights holder with a concern about the data it reads can [open an issue](https://github.com/Puffinnois/metis/issues) on this repository, and the request will be answered promptly.

How the numbers agree with the sources, season by season, is in [docs/reference/what-was-measured.md](docs/reference/what-was-measured.md).

## Building from source

Electron, React, TypeScript and DuckDB. Development runs in WSL2 with Node 22 through nvm.

```bash
npm install
```

```bash
npm run dev
```

In WSL, Electron needs `ELECTRON_DISABLE_SANDBOX=1` or `--no-sandbox`. Development data goes to `~/.config/Metis/`.

| Command                             | Does                                                               |
| ----------------------------------- | ------------------------------------------------------------------ |
| `npm test`                          | The unit tests                                                     |
| `npm run typecheck`, `npm run lint` | Types and lint                                                     |
| `npm run build`                     | Builds the app; `scripts/drive.mjs` then runs it and follows steps |
| `npm run build:win`                 | A local Windows installer                                          |

How the project is organized and its rules are in [CLAUDE.md](CLAUDE.md). The previous Rust and Tauri implementation is on the [`archive/rust-tauri`](https://github.com/Puffinnois/metis/tree/archive/rust-tauri) branch.

## Read more

[docs/README.md](docs/README.md) lists every reference document and what it is for:

- [The screens](docs/reference/stats-screens.md)
- [What was measured](docs/reference/what-was-measured.md)
- [The statistics](docs/reference/nba-statistics.md)
- [The data sources and their traps](docs/reference/nba-data-sources.md)
- [The database and query engine](docs/reference/stats-database.md)

## Licence

Apache-2.0, for the app's code. The data keeps its own terms: see "Data and credit".
