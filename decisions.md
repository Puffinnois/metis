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
