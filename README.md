# Metis

A local-first NBA statistics desktop app: a very extensive database of player and team stats on your own machine, with a dashboard for filtering, sorting and comparing them.

**Status: early release.** [Download the latest release](https://github.com/Puffinnois/metis/releases/latest) for Windows. It has the leaderboards, the standings and the player, team and game dashboards from 1993-94 to now, with tracking, hustle, play types, matchups, lineups and play-by-play splits, and Metis's own ratings: SRS, Elo, opponent-adjusted ratings, a season forecast, PER, Win Shares, BPM, the league indexes (TS+) and how stable each stat is from one season to the next. The stages are in [Plan.md](Plan.md), the reasoning in [decisions.md](decisions.md). The previous Rust and Tauri implementation is on the [`archive/rust-tauri`](https://github.com/Puffinnois/metis/tree/archive/rust-tauri) branch.

- Stack: Electron, React, TypeScript, DuckDB
- Data: [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data), measured in [docs/reference/nba-data-sources.md](docs/reference/nba-data-sources.md)
- Dev (WSL2, Node 22 through nvm): `npm install && npm run dev`
- Tests: `npm test`
- Windows installer, local test build: `npm run build:win`
- License: Apache-2.0, for the app's code (see "Data and credit" for the data)

## Installing and updating

The Windows installer is not code-signed, so on first install Windows SmartScreen says it "protected your PC". Click **More info**, then **Run anyway**. The installer puts Metis in your user folder without admin rights; uninstalling it keeps your data in `%APPDATA%\Metis`. Updates come from this repository's published releases: Metis checks at launch and every hour, downloads a newer version in the background and checks it against the release's `latest.yml` checksum, then shows **Update to x.y.z** in the top bar. Nothing installs until you choose **Update & restart**.

## Data and credit

- NBA data is published by [SportsDataverse](https://github.com/sportsdataverse/sportsdataverse-data) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and comes originally from [ESPN](https://www.espn.com/nba/) and [NBA.com](https://www.nba.com/stats).
- Metis downloads it on your own machine, reshapes it into its own tables and computes stats from it. The installer contains no data, and Metis shares nothing.
- Whose numbers are whose: box scores, play by play, tracking and the rest are as ESPN and NBA.com publish them; possessions, lineups and the impact models (RAPM, SPM, BPM, WAR) are SportsDataverse's calculations, labelled "(SportsDataverse)"; SRS, Elo, the adjusted ratings, the season forecast, PER, Win Shares, BPM, VORP, Oliver's ratings, the league indexes and stability are computed by Metis from published methods, and say so.
- Metis is not affiliated with or endorsed by the NBA, ESPN or SportsDataverse. Team and player names, and the NBA and ESPN names, belong to their owners.
- Metis's Apache-2.0 licence covers the app, not the data, which keeps its own terms. What was read is in [docs/reference/data-rights.md](docs/reference/data-rights.md).

**Contact and takedown.** Metis is a personal, non-commercial project. A rights holder with a concern about the data it reads can [open an issue](https://github.com/Puffinnois/metis/issues) on this repository, and the request will be answered promptly.
