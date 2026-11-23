# Team logos and player pictures: what they would weigh

Research for Plan T1602, done on 2026-11-22. The question: how much would Metis's disk usage grow if it showed team logos and player profile pictures? Nothing was built. Today the app shows no image at all: [D31](../../decisions.md) holds "No logos, photos or video", and this document does not change that. It gives the numbers, and the last section names the decisions that showing pictures would reopen.

## Summary

Counts are from a clean four-league load; sizes from 117 images fetched from ESPN's image host and re-encoded on this machine. MB are millions of bytes. Each figure is the sample's mean, with the range from its first to its third quartile in the sections below.

| Scenario                                | Images, four leagues | As published | Resized, WebP | Resized, PNG logos and JPEG headshots |
| --------------------------------------- | -------------------- | ------------ | ------------- | ------------------------------------- |
| (a) Logos only                          | 1,316                | 78 MB        | 16 MB         | 38 MB                                 |
| (b) Logos and this season's players     | 10,860               | 2.5 GB       | 172 MB        | 176 MB                                |
| (c) Logos and the last three seasons    | 18,753               | 4.5 GB       | 301 MB        | 290 MB                                |
| (d) Logos and every player in the files | 30,573               | 7.5 GB       | 493 MB        | 460 MB                                |
| (e) Lazy cache, per 1,000 headshots     | 1,000                | 255 MB       | 16 MB         | 15 MB                                 |
| (e) Lazy cache, per 1,000 logos         | 1,000                | 53 MB        | 12 MB         | 28 MB                                 |
| (f) Favourites, per 100 players         | 100                  | 25 MB        | 1.6 MB        | 1.5 MB                                |
| (f) Favourites, per 100 teams           | 100                  | 5.3 MB       | 1.2 MB        | 2.8 MB                                |
| For comparison: the app's files now     |                      | 14.7 GB      |               |                                       |

The app's files now are the four stats files of that load (5.34 GB NBA, 0.85 GB WNBA, 4.31 GB NCAA Men, 4.09 GB NCAA Women) and `links.duckdb` (85 MB). The 1.2.0 installer is 113 MB. "Resized" means two copies of each image, one for a table row and one for a page, at twice their display size (see "Resized to what the app would show").

In short:

- **Every image URL in the data points to one host, `a.espncdn.com`,** ESPN's image CDN. The `nba_stats_*`, `wnba_stats_*` and `ncaa_*` tables carry none. No sportsdataverse-data release publishes image files.
- **Logos are nearly complete; headshots are not.** Every team of the current season has a logo URL in all four leagues. Every NBA player of the current season has a headshot URL, 87 % of the WNBA's, and in college 94 % (men) and 88 % (women) of Division I players. Players before about 2010 mostly have none: 1,991 of the NBA's 3,153 players with an ESPN id do.
- **A player with no URL has no picture.** The four URLs built by hand for such players answered 404. No placeholder image was served for a URL in the data.
- **As published, the pictures would weigh half as much as the stats** (7.5 GB against 14.7 GB, scenario d). Resized and re-encoded they are about 15 times smaller: under 0.5 GB for every player, about 3 % of the stats.
- **College accounts for 92 % of the images** in scenario (d). The NBA and WNBA together come to 2,367 headshots and 68 logos, about 38 MB resized even for every player.

## How it was measured

- **Counts** from `~/.cache/metis-dev/gate13c`, the clean four-league load of the Stage 13 gate, opened read-only (`@duckdb/node-api` with `access_mode: 'READ_ONLY'`, from scripts run in WSL; the shared college logos counted in an in-memory database that attached both college files read-only). The current season is the latest in `player_season`: 2026-27 for the NBA and both college leagues (just begun), 2026 for the WNBA (finished). "Last three seasons" counts the current one and the two before.
- **The sample:** 124 GET and 2 HEAD requests to `a.espncdn.com`, about 04:30 UTC on 2026-11-23 (the evening of 2026-11-22 in the owner's time zone), with `curl` 8.5.0 from WSL: its default user agent, no other header, redirects not followed, 1.5 seconds between requests. The URLs were drawn from the load in a fixed hash order: 78 headshots (NBA 18 players of the last three seasons and 6 older, WNBA 12 and 2, NCAA Men 22, NCAA Women 18); 39 logos (NBA 11, WNBA 9, college 19; of them 8 in the `500-dark` variant and 3 by ESPN's `guid` path); 4 headshot URLs built by hand for players with none in the data; 3 requests to ESPN's resizing service. The NCAA Women's logo picks were already in the men's sample, since both leagues use the same logo URLs, so the college logos are one group.
- **Resizing** with Pillow 12.2.0 (the Windows Python already on the machine; nothing was added to the repository). Logos were fitted inside a square, keeping their transparency. Headshots were cropped square from the top for the row and scaled whole for the page. WebP at quality 90 (logos) and 80 (headshots), method 6; WebP lossless for logos as well; PNG optimised; JPEG at quality 80 on a white background, since JPEG has no transparency.
- The sample images were measured by their files and deleted at the end. No image, database or data file is in the repository.

## How many images

Teams with a logo URL in any ESPN table of the file, and players with a headshot URL, per league. An image counts once per URL: an athlete has exactly one headshot URL in each file, whatever the season or team.

| League       | Teams this season | Teams with a logo URL, any season | Players ever | With a URL | This season | With a URL | Last three seasons | With a URL |
| ------------ | ----------------- | --------------------------------- | ------------ | ---------- | ----------- | ---------- | ------------------ | ---------- |
| NBA          | 30                | 44                                | 3,602        | 2,004      | 473         | 473        | 745                | 725        |
| WNBA         | 15                | 24                                | 1,240        | 363        | 238         | 208        | 300                | 265        |
| NCAA Men     | 750 (365 D-I)     | 655                               | 43,481       | 14,674     | 8,194       | 4,859      | 19,584             | 8,929      |
| NCAA Women   | 682 (363 D-I)     | 593                               | 31,740       | 12,216     | 6,908       | 4,004      | 15,689             | 7,518      |
| Four leagues |                   | 1,316 (791 distinct)              | 80,063       | 29,257     | 15,813      | 9,544      | 36,318             | 17,437     |

- **The NBA's 44 logo teams** are the 30 franchises, the All-Star and rookie-game teams, and a few former codes. Its players start in 1993-94; the 2,004 headshot URLs include 13 athletes the player table does not match.
- **The college files hold more than Division I.** Their team table has every opponent ESPN lists (750 men's teams this season, 365 of them in a conference), and their player table has those teams' players from both families of source. On Division I teams only: 5,059 men's players this season (4,777 with a URL, 94 %), 9,192 over three seasons (8,782, 96 %), 14,183 ever (13,608); 4,496 women's players this season (3,941, 88 %), 8,099 over three seasons (7,432, 92 %), 12,451 ever (11,626). Every Division I team of the season has a logo URL.
- **The two college leagues share their logos.** A school has the same ESPN id and the same logo URL in both files (all 363 women's Division I schools are among the men's 365), so a shared store would hold 723 distinct college logos, not 1,248, and 791 for the four leagues.
- **Headshot coverage by season** rises from almost none to nearly all: NBA 4 of 403 players in 1993-94, 403 of 442 in 2009-10, 448 of 452 in 2010-11; WNBA none before 2002 and 151 of 155 in 2021. In college it is 51 to 65 % of the file's players each season from 2021-22 to 2026-27, since many of them are on teams outside Division I.

## Where an image could come from

### The columns that carry URLs

All in ESPN's tables (`src_espn_*`), the same in the four files. No `nba_stats_*`, `wnba_stats_*` or `ncaa_*` table carries an image or colour column.

| What                       | Columns                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player headshot            | `src_espn_player_core.headshot_href`, `src_espn_player_box.athlete_headshot_href`, `src_espn_game_rosters.athlete_headshot`, `src_espn_rosters.headshot_href` (and `headshot_alt`)  |
| Draft headshot (NBA, WNBA) | `src_espn_draft.athlete_headshot_href`                                                                                                                                              |
| Team logo                  | `team_logo` in `src_espn_team_box`, `src_espn_player_box`, `src_espn_rosters`, `src_espn_standings`, `src_espn_team_season` and `src_espn_draft`; `opponent_team_logo` in the boxes |
| Team logo, light and dark  | `home_logo`, `away_logo`, `home_logo_dark`, `away_logo_dark` in `src_espn_schedule`, `src_espn_schedule_master`, `src_espn_games_in_repo` (the college masters have no dark)        |
| Team colours (not logos)   | `team_color` and `team_alternate_color` (and their `home_`, `away_`, `opponent_` forms) beside every logo column, as six-digit hex such as `00471b`                                 |

The URL shapes, all on `https://a.espncdn.com`:

- Headshots: `/i/headshots/<nba|wnba|mens-college-basketball|womens-college-basketball>/players/full/<athlete id>.png`.
- Logos: `/i/teamlogos/<nba|wnba>/500/<code>.png`, also `/500-dark/` and `/500/scoreboard/`; college `/i/teamlogos/ncaa/500/<team id>.png` and `/500-dark/`; for a few teams (All-Star teams, renamed or former franchises) `/guid/<uuid>/logos/default.png`.

**Team colours are published as data:** a primary and an alternate colour for every NBA (30) and WNBA (15) team in the box scores, and for 722 men's and 765 women's college teams. They are text, already in the stats files, and the app reads none of them today.

### No image files in the releases

Read through the GitHub API on 2026-11-22: the sportsdataverse-data repository has 388 releases listing 24,808 assets, all Parquet, RDS, CSV, gzip, JSON, text and a few model files. None is an image by extension, and no asset or release name mentions logos, headshots or photos. The releases carry the URLs only.

## What an image weighs

### As published

All 120 images answered HTTP 200 with `image/png`; nothing was refused or redirected. The two HEAD requests (one headshot, one logo) answered with `content-length`, an `ETag`, a `Last-Modified` date and, for the headshot, `server: AmazonS3`.

| Kind                | Pixels    | Sample | Median | Mean   | First to third quartile | Smallest to largest |
| ------------------- | --------- | ------ | ------ | ------ | ----------------------- | ------------------- |
| NBA headshot        | 600 × 436 | 24     | 218 KB | 220 KB | 184–254 KB              | 158–288 KB          |
| WNBA headshot       | 600 × 436 | 14     | 299 KB | 313 KB | 274–342 KB              | 239–448 KB          |
| NCAA Men headshot   | 600 × 436 | 22     | 224 KB | 231 KB | 198–261 KB              | 171–318 KB          |
| NCAA Women headshot | 600 × 436 | 18     | 281 KB | 283 KB | 247–316 KB              | 186–384 KB          |
| NBA logo            | 500 × 500 | 11     | 48 KB  | 50 KB  | 27–66 KB                | 17–96 KB            |
| WNBA logo           | 500 × 500 | 9      | 35 KB  | 41 KB  | 33–48 KB                | 8–89 KB             |
| NCAA logo           | 500 × 500 | 19     | 56 KB  | 60 KB  | 38–75 KB                | 18–130 KB           |

Every headshot is a 600 × 436 PNG with a transparent background; every logo a 500 × 500 PNG with transparency.

**No photo.** The 4 headshot URLs built for players with none in the data (two WNBA, one in each college league) answered HTTP 404 with an HTML page, so a missing URL means no picture rather than an unlisted one. Among the 78 headshots from the data's own URLs there was no placeholder: no two of the 117 files were the same.

**Resolutions offered.** The URLs in the data take no size parameter; the `500` in the logo path is the only size they name. ESPN's resizing service takes one, `https://a.espncdn.com/combiner/i?img=<path>&w=<px>&h=<px>`: asked for `w=200&h=146` it returned a 200 × 146 PNG of 31 KB, and for `w=64&h=64` a 64 × 64 logo of 3.1 KB. Without a size it re-encodes the original, larger (252 KB for a headshot whose own file is 206 KB). It is a second, undocumented route on the same host; nothing in the data points to it.

### Resized to what the app would show

Proposed sizes, each stored at twice its display size for high-density screens:

- **Logo:** 32 px in a row (stored 64 × 64), 96 px on a page (192 × 192).
- **Headshot:** a 40 px round avatar in a row (80 × 80, cropped square from the top), 192 px wide on a page (384 × 279, the whole picture).

Per image, the two sizes together:

| Kind                | Sample | WebP    | PNG      | JPEG    | WebP lossless |
| ------------------- | ------ | ------- | -------- | ------- | ------------- |
| NBA logo            | 11     | 12.6 KB | 26.3 KB  |         | 17.3 KB       |
| WNBA logo           | 9      | 11.5 KB | 27.1 KB  |         | 16.9 KB       |
| NCAA logo           | 19     | 12.5 KB | 29.0 KB  |         | 19.8 KB       |
| NBA headshot        | 24     | 15.5 KB | 99.4 KB  | 14.0 KB |               |
| WNBA headshot       | 14     | 17.8 KB | 117.0 KB | 15.5 KB |               |
| NCAA Men headshot   | 22     | 15.9 KB | 100.3 KB | 13.9 KB |               |
| NCAA Women headshot | 18     | 16.8 KB | 111.6 KB | 15.1 KB |               |

Separately: a row logo is 2.5 to 2.8 KB in WebP and 5.0 to 5.4 KB in PNG, a page logo 9.0 to 9.8 KB and 21 to 24 KB. A row headshot is 2.4 to 2.6 KB in WebP and 1.9 to 2.0 KB in JPEG, a page headshot 13 to 15 KB in WebP and 12 to 13.5 KB in JPEG. A photo resized as PNG stays large (90 to 106 KB on the page), so PNG suits only the logos, and JPEG gives up the transparent background, which WebP keeps at about JPEG's size.

**On disk, as files,** each is rounded up to a 4 KB cluster on NTFS: a 2.5 KB row image takes 4 KB and a 13 KB page image 16 KB, so a WebP pair takes about 20 KB for a headshot and 16 KB for a logo, about 22 % more than its bytes. Blobs in a database file are not rounded that way.

## Totals per scenario and per league

Each total is the count times the sample's mean per image, with the range from the first-quartile to the third-quartile image. The counts are images with a URL: logos of every team with one in the file (NBA 44, WNBA 24, NCAA Men 655, NCAA Women 593), and the headshots of the scenario (this season 473, 208, 4,859 and 4,004; three seasons 725, 265, 8,929 and 7,518; ever 2,004, 363, 14,674 and 12,216). The four-league row adds the leagues as separate stores, so it counts the shared college logos twice (525 logos, about 31 MB as published and 7 MB in WebP); a shared store holds 791 logos.

**As published** (MB):

| League       | (a) Logos     | (b) + this season   | (c) + three seasons | (d) + every player  | Stats file now |
| ------------ | ------------- | ------------------- | ------------------- | ------------------- | -------------- |
| NBA          | 2.2 (1.2–2.9) | 106 (88–123)        | 162 (135–187)       | 443 (370–512)       | 5,339          |
| WNBA         | 1.0 (0.8–1.2) | 66 (58–72)          | 84 (74–92)          | 115 (100–125)       | 852            |
| NCAA Men     | 39 (25–49)    | 1,163 (986–1,318)   | 2,104 (1,792–2,381) | 3,432 (2,929–3,882) | 4,308          |
| NCAA Women   | 35 (22–45)    | 1,170 (1,010–1,308) | 2,165 (1,877–2,417) | 3,496 (3,036–3,899) | 4,085          |
| Four leagues | 78 (49–98)    | 2,505 (2,142–2,822) | 4,514 (3,877–5,077) | 7,485 (6,435–8,418) | 14,584         |

**Resized, WebP, two sizes each** (MB):

| League       | (a) Logos     | (b) + this season | (c) + three seasons | (d) + every player |
| ------------ | ------------- | ----------------- | ------------------- | ------------------ |
| NBA          | 0.6 (0.5–0.6) | 7.9 (6.9–8.5)     | 11.8 (10.3–12.6)    | 31.7 (27.6–33.9)   |
| WNBA         | 0.3 (0.3–0.3) | 4.0 (3.5–4.4)     | 5.0 (4.4–5.5)       | 6.7 (6.0–7.4)      |
| NCAA Men     | 8.2 (6.8–9.6) | 86 (75–97)        | 151 (133–170)       | 242 (214–274)      |
| NCAA Women   | 7.4 (6.2–8.7) | 75 (67–81)        | 134 (120–144)       | 213 (192–228)      |
| Four leagues | 16 (14–19)    | 172 (153–190)     | 301 (268–332)       | 493 (439–543)      |

As files on disk, about 22 % more: 21, 212, 369 and 604 MB for the four leagues. Resized as PNG logos and JPEG headshots: 38, 176, 290 and 460 MB. Counted on Division I players only, the college headshots fall by 1 to 2 % this season and over three seasons, and by 5 to 7 % for every player, since the file's players without a URL already cost nothing.

**(e) A lazy cache** holding only what the user has opened, mixed across the four leagues' samples: per 1,000 headshots, 255 MB as published (202–286), 16 MB in WebP (14–18), 15 MB in JPEG; per 1,000 logos, 53 MB as published (33–66), 12 MB in WebP, 28 MB in PNG.

**(f) Favourites only:** per 100 players, 25 MB as published (20–29) or 1.6 MB in WebP (1.4–1.8); per 100 teams, 5.3 MB or 1.2 MB.

**Against what the app uses now and D22.** The stats files are 5.34, 0.85, 4.31 and 4.09 GB on that load and `links.duckdb` 85 MB, together 14.67 GB; the 1.2.0 installer (`Metis-Setup-1.2.0.exe`, the latest GitHub release) is 113 MB. D22 stops the work at a database file over 6 GB, a first load over an hour, or more than 4 GB of process memory. Images kept in a folder add to disk use but to no database file. Kept as blobs in a league's stats file, NCAA Men's (d) as published would take that file from 4.31 to about 7.7 GB, past 6 GB, and resized to 4.55 GB; the NBA's 5.34 GB file would reach 5.78 GB as published and 5.37 GB resized.

## What else it costs

- **Downloads on first load.** One request per image: about 1,300 for logos, 10,900 for (b), 18,800 for (c), 30,600 for (d). Measured from the sample's file times, one request at a time with a new connection each, a request took 0.26 s in the median (0.11 to 0.54). The app downloads 4 files at once (`PARALLEL_DOWNLOADS` in `src/main/stats/sync.ts`); at that rate, before counting the bytes, the pictures would take about 1.5 minutes for logos, 12 minutes for (b), 20 for (c) and 33 for (d). The bytes come on top: 2.5 GB as published for (b), 7.5 GB for (d). No host serves Metis's sizes, so each image would be resized on the user's machine after its download; ESPN's resizing service could do it on the way, as a second route on the same host. D22's hour is for a league's first load, and the NBA's stats alone took 26.9 minutes at the Stage 12 gate, so the pictures would be a separate step after the stats.
- **Refresh.** A headshot URL is keyed by ESPN's athlete id alone, not the team, so a traded player keeps the same URL and needs no new download. New players appear in the daily files with a new id and URL; only those would be fetched. In college that is about 1,900 new men's and 1,500 new women's headshot URLs a season (14,674 and 12,216 URLs across 2021-22 to 2026-27, against 5,189 and 4,807 players with one in 2021-22 alone), about 55 MB a year resized, 0.9 GB as published. A changed photo arrives at the same URL: the host gives `ETag` and `Last-Modified`, with a `cache-control` of 91 seconds on the headshot and 4.5 hours on the logo, so a refresh would check with one conditional request per image kept, or check less often.
- **Where they would live.** The shapes, with their facts:
  - A cache folder per league beside the stats files (for example `images-nba/` next to `stats-nba.duckdb`), deletable like them and refilled by the next refresh. Files pay the cluster rounding (about 22 % for resized WebP), and 30,000 small files are slow to copy or delete on Windows. The renderer would read them through a custom protocol or a `file:` URL.
  - Blobs in a database: one file per league, no cluster rounding, but read only through the worker (rule 3 of `CLAUDE.md`) and counted against D22's 6 GB a file. In `metis.db` (settings and saved views, SQLite) they would take that file from its current size to hundreds of megabytes.
  - Not a store of Metis's own: the renderer loading ESPN's URLs directly and Chromium's HTTP cache keeping them. That is a request to ESPN from the screen on every first view, with the cache's size and life left to Chromium.
- **The installer.** Bundling resized logos for every team of the four leagues would add about 10 MB in WebP (791 logos), 9 % of the 113 MB installer; headshots are too many to bundle at any useful size. Bundling means Metis distributing ESPN's files itself: D6 and D29 rest on the installer holding no data, and `data-rights.md` on Metis redistributing nothing.

## The decisions it would need

Stated as what each line says today. This document draws no conclusion on them and is not a decision.

- **D31,** the owner's decision: "No logos, photos or video." Each of scenarios (a) to (f) shows logos or photos, so each needs it reopened by the owner. Team colours, already in the stats files, are not logos; D31 does not mention them.
- **D7 and `data-rights.md`.** `data-rights.md` says the release store on GitHub is the only host Metis fetches data from, that it never calls ESPN, and that "It shows no logos, photos or video: only names and numbers." Every image URL in the data is on `a.espncdn.com`, ESPN's host, so each scenario means Metis, on each user's machine, making requests to ESPN for the first time. D7 is written about stats.nba.com, which refuses a plain client; ESPN's image host answered all 126 of this research's requests.
- **D6 and D29,** on bundling: the installer ships no data. Bundled logos would be files Metis distributes.
- **What the terms already read say.** `data-rights.md` records ESPN's terms (the Disney Terms of Use, read 2026-11-14) as a personal, non-commercial licence that lists, among what users may not do without written permission, commercial use, use that suggests an association with Disney's brands, derivative works, and automated access to copy or extract the products for building a collection of data. The record does not mention logos or photos as such. The NBA's section 9, as the owner supplied it, covers statistics and does not mention logos or photos. No terms of the leagues', teams' or schools' own about their marks were read for `data-rights.md`, and none was read for this research. The credit's line that names belong to their owners is the only text in Metis that speaks to marks.
- **D22,** only if the images were stored in a stats file (above).

## What could not be checked

- **The sample is small:** 117 images of about 30,600. Logos vary more than headshots (8 to 130 KB as published), so the logo totals are the less certain; they are also the smallest.
- **Throughput at four at once** was not measured, to keep the sample to one request at a time; the download times above divide the one-at-a-time median by four.
- **How often ESPN changes a photo** was not observed: it would need the same URLs fetched over weeks.
- **The images were not viewed** one by one, so whether some show an old team's uniform, or a drawn silhouette in an otherwise unique file, is not known.
- **How many dark or `guid` logos a screen would need** depends on a design that does not exist. Each dark variant would add about one logo's weight per team.
- **Players with no URL** were sampled with 4 hand-built URLs, all 404; a larger sample might find a picture ESPN has that the data lacks.
