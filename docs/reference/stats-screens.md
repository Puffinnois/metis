# Stats screens: reference

What each screen shows and where its numbers come from. Screens are added here as they are built; the data they read is in [stats-database.md](stats-database.md).

## Shell

- **Nav:** Leaderboards, Players, Teams, Explore, Games, Glossary. These screens are not built yet, and say what is loaded.
- **Status line** (`stats.status()`), read again as a load goes, at most once a second:

| It says                                               | When                                      |
| ----------------------------------------------------- | ----------------------------------------- |
| No stats yet                                          | Nothing is loaded, and nothing is running |
| Loading the stats · 412 of 3,070 files                | The first load, before any box score      |
| Data through Nov 4, 2026 · updating 71 of 3,070 files | A load or a refresh is running            |
| Data through Nov 4, 2026 · updated 2 h ago            | Nothing is running                        |
| Data through Nov 4, 2026 · paused, or Loading paused  | The owner paused                          |
| Not enough disk space                                 | The first load could not start            |
| Stats unavailable                                     | The stats database cannot be read         |

The status line opens the Data panel.

## Data panel

What is loaded, from `stats.data()`. It reads again as a load goes.

- **Header:** files loaded of those published, the database's size on disk, the free space beside it. Pause while something is running; Resume while paused.
- **Pause** stops a load at once and holds off any other, across launches, until Resume. The step it stopped is not counted as an attempt.
- **Not enough room:** a first load needs 6 GB free, the limit in D22, less what is already on disk. Without it, the load does not start and the panel says what it needs and what is free. Once the database has passed 4 GB, a refresh needs no check.
- **One row per release of the dataset,** grouped by load tier, in load order: its name, the seasons held, files loaded of those published, the size as downloaded, when it was last fetched, its state.
- **State:** Loaded, Part loaded, Waiting, or Failed with the latest error still standing. A file not published yet, such as the current season's playoffs, does not count as missing.
- **Credit:** the data's source, with a link.
