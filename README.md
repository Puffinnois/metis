# Metis

A local-first NBA statistics desktop app: a very extensive database of player and team stats on your own machine, with a dashboard for filtering, sorting and comparing them.

**Status: early release.** [Download the latest release](https://github.com/Puffinnois/metis/releases/latest) for Windows. It has the leaderboards, the standings and the player, team and game dashboards from 1993-94 to now, with tracking, hustle, play types, matchups, lineups and play-by-play splits, and Metis's own ratings: SRS, Elo, opponent-adjusted ratings, a season forecast, PER, Win Shares, BPM, the league indexes (TS+) and how stable each stat is from one season to the next. The installer is unsigned, so Windows SmartScreen warns about it. The stages are in [Plan.md](Plan.md), the reasoning in [decisions.md](decisions.md). The previous Rust and Tauri implementation is on the [`archive/rust-tauri`](https://github.com/Puffinnois/metis/tree/archive/rust-tauri) branch.

- Stack: Electron, React, TypeScript, DuckDB
- Data: [sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data), measured in [docs/reference/nba-data-sources.md](docs/reference/nba-data-sources.md)
- Dev (WSL2, Node 22 through nvm): `npm install && npm run dev`
- Tests: `npm test`
- Windows installer, local test build: `npm run build:win`
- License: Apache-2.0
