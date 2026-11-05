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

**D13. NBA ids are the primary keys** (`person_id`, `team_id`, `game_id`) from 1996-97. ESPN ids join through `nba_crosswalk` (players, teams and games, from 2001-02), with date plus team as the fallback for games. Identity for the seasons before the crosswalk is a task in Plan.md.

**D14. Sources are kept side by side, never overwritten.** Which source a metric reads is stated in the catalogue. A disagreement between sources is a measured result to report.

**D15. NBA only, no `League` abstraction.** The old rule against hardcoding league constants existed for a multi-league future that is not planned. Revisit if that changes.

**D16. Ask and the Claude connection are out of scope** until the owner asks. They were not part of the template brief.

**D17. One colour palette.** The template has a fantasy palette and a stats palette, and shared tokens resolve against the first even inside the second. Metis has one palette, the stats one.

**D18. Keep Apache-2.0.** The template's MIT code, by the same author, is compatible.

**D19. Keep the branch model:** working branches into `main`, `main` into `preprod`, `preprod` into `prod`.

## 2026-11-05: the overhaul plan

**D20. Stages are slices.** Each stage takes a slice from the data through to the screen and ends with something the owner can try, instead of all the data, then all the stats, then all the screens. _Why:_ built in layers, nothing could be judged until the end.

**D21. The first load runs in tiers:** core (100 MB), published (214 MB), events (360 MB), play by play (879 MB). Everything still loads by default, so D9 stands. _Why:_ the app is usable after the first tier, long before 1.7 GB has arrived.

**D22. Limits that stop the first full load (Plan T405):** a database file over 6 GB, a first load over an hour on the development machine, or more than 4 GB of process memory. Past any of them, the work stops and goes to the owner. _Why:_ the dataset is eight times the template's download, so its cost is unknown until measured.

**D23. A file proven to repeat others is skipped:** `*_master` and per-game files, where Plan T406 shows no information is lost. A file not proven to repeat others is loaded. This narrows "every table" in D8. _Why:_ the `*_master` files alone are 138 MB, and totals with denominators are what the policy stores anyway. Measured in Plan T406: only `*_master` qualifies; per-game files do not scale exactly to totals, so they stay.

**D24. Stats with no free bulk source stay out:** EPM, LEBRON, the NBA's Inside the Game models, Basketball-Reference and paid APIs. They are listed as unavailable with the reason. Metis does not scrape. This follows D7; revisit only if the owner asks.

**D25. The repository's shape:** `main` is the default branch. Old branches live on as tags under `archive/`. `main`, `preprod` and `prod` refuse force-pushes and require CI's `check` to pass, for admins too. A promotion can still fast-forward, because a commit on `main` has already passed `check`. _Why:_ nothing should reach the three branches unchecked.

**D26. A stage tag is not a release.** `vX.Y-stageN` marks a finished stage. A version tag such as `v1.0.0` runs the Release workflow, which requires it to match `package.json`. _Why:_ in the template every `v*` tag was a release, and a stage tag would only fail that version check.

**D27. Source tables stay as published.** `season` is only cast to an INTEGER, and `file_season` and `source_file` are added to tell files apart. Season types and team codes are mapped in the `game` and `team` tables (Plan T407, T408). _Why:_ ESPN's 2000 files hold games of 1998-99 rightly marked 1999, which a file's label would overwrite; many files have no season type column at all, so it has to come from the game anyway; and correcting a mapping should never mean downloading the files again.
