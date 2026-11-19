#!/usr/bin/env node
// Checks the college leaderboards (D43) against the NCAA's record books: each season's individual
// champion in every category the books print, 2021-22 to 2025-26, against the engine's leader among
// qualified players, and the champion's own games and total against the app's. The books were read
// with a plain client in T1302.1 (`s3.amazonaws.com/fs.ncaa.org/Docs/stats/m_basketball_RB/
// m_basketball_RB_D1.pdf` and the women's, "Annual Individual Champions"), kept outside the
// repository in `~/.cache/metis-dev/ncaa-probe/pdf`; the champions below are transcribed from them.
// The books rank the per-game categories by the NCAA's 75 % rule and the percentages by the NCAA's
// own makes minimums, which are not read (D43): Metis asks the NBA's makes scaled, so a different
// percentage leader is a difference of rules to read, not an error.
//
// usage: node scripts/check-ncaa-leaders.mjs <folder holding stats-<league>.duckdb> --league=ncaam
// Build first with `npm run build`. Prints a Markdown report.
import { resolve } from 'node:path'
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

/**
 * [category, the engine's metric, its transform, the books' champions per season as
 * [player, team, games, total, and for a ratio the denominator]].
 */
const BOOKS = {
  ncaam: [
    [
      'Scoring average',
      'pts',
      'perGame',
      {
        2022: ['Peter Kiss', 'Bryant', 27, 680],
        2023: ['Antoine Davis', 'Detroit Mercy', 33, 930],
        2024: ['Zach Edey', 'Purdue', 39, 983],
        2025: ['Eric Dixon', 'Villanova', 35, 815],
        2026: ['AJ Dybantsa', 'BYU', 35, 894]
      }
    ],
    [
      'Field-goal percentage',
      'fg_pct',
      'totals',
      {
        2022: ['Enrique Freeman', 'Akron', 34, 175, 263],
        2023: ['Max Fiedler', 'Rice', 35, 175, 238],
        2024: ['AJ Braun', 'Wright St.', 32, 164, 238],
        2025: ['Max Brooks', 'UMass Lowell', 32, 217, 308],
        2026: ['Aidan Kehoe', 'Navy', 34, 220, 301]
      }
    ],
    [
      'Three-point field goals made per game',
      'fg3m',
      'perGame',
      {
        2022: ['Darius McGhee', 'Liberty', 33, 142],
        2023: ['Antoine Davis', 'Detroit Mercy', 33, 159],
        2024: ['Jack Gohlke', 'Oakland', 36, 137],
        2025: ['Abdi Bashir Jr.', 'Monmouth', 33, 127],
        2026: ['Jadin Booth', 'Samford', 30, 127]
      }
    ],
    [
      'Three-point field-goal percentage',
      'fg3_pct',
      'totals',
      {
        2022: ['Kyle Foster', 'Howard', 29, 105, 229],
        2023: ['Jordan Johnson', 'New Orleans', 27, 93, 193],
        2024: ['Koby Brea', 'Dayton', 33, 100, 201],
        2025: ['Tyler Lundblade', 'Belmont', 33, 104, 216],
        2026: ['Milan Momcilovic', 'Iowa St.', 37, 136, 279]
      }
    ],
    [
      'Free-throw percentage',
      'ft_pct',
      'totals',
      {
        2022: ['Foster Loyer', 'Davidson', 29, 118, 126],
        2023: ['Walter Clayton Jr.', 'Iona', 32, 102, 107],
        2024: ['DJ Davis', 'Butler', 33, 95, 100],
        2025: ['Tamar Bates', 'Missouri', 34, 87, 92],
        2026: ['Tyler Lundblade', 'Belmont', 32, 85, 91]
      }
    ],
    [
      'Rebound average',
      'reb',
      'perGame',
      {
        2022: ['Oscar Tshiebwe', 'Kentucky', 34, 515],
        2023: ['Oscar Tshiebwe', 'Kentucky', 32, 437],
        2024: ['Enrique Freeman', 'Akron', 35, 453],
        2025: ['Carson Towt', 'Northern Ariz.', 34, 423],
        2026: ['Hannes Steinbach', 'Washington', 30, 353]
      }
    ],
    [
      'Assist average',
      'ast',
      'perGame',
      {
        2022: ['Yuri Collins', 'Saint Louis', 34, 267],
        2023: ['Yuri Collins', 'Saint Louis', 32, 324],
        2024: ['Tyler Kolek', 'Marquette', 31, 239],
        2025: ['Ryan Nembhard', 'Gonzaga', 35, 344],
        2026: ['Jeremy Fears Jr.', 'Michigan St.', 35, 328]
      }
    ],
    [
      'Assist-to-turnover ratio',
      'ast_tov',
      'totals',
      {
        2022: ['CJ Fulton', 'Lafayette', 30, 99, 27],
        2023: ['Connor McCaffery', 'Iowa', 32, 117, 30],
        2024: ['CJ Fulton', 'Col. of Charleston', 35, 145, 35],
        2025: ['Garrison Keeslar', 'Chattanooga', 38, 118, 21],
        2026: ['Ryan Prather Jr.', 'Robert Morris', 33, 120, 27]
      }
    ],
    [
      'Blocked-shot average',
      'blk',
      'perGame',
      {
        2022: ['Jamarion Sharp', 'Western Ky.', 32, 148],
        2023: ['Jamarion Sharp', 'Western Ky.', 32, 131],
        2024: ['Isaiah Cozart', 'Eastern Ky.', 30, 116],
        2025: ['Obinna Anochili-Killen', 'Marshall', 32, 102],
        2026: ['Kyle Evans', 'UC Irvine', 35, 115]
      }
    ],
    [
      'Steal average',
      'stl',
      'perGame',
      {
        2022: ['Nendah Tarke', 'Coppin St.', 32, 94],
        2023: ['Kellen Tynes', 'Maine', 30, 98],
        2024: ['Arturo Dean', 'FIU', 31, 104],
        2025: ['Kellen Tynes', 'Maine', 34, 107],
        2026: ['Javontae Campbell', 'Bowling Green', 32, 97]
      }
    ],
    [
      'Double-doubles',
      'dd2',
      'totals',
      {
        2022: ['Armando Bacot', 'North Carolina', 39, 31],
        2023: ['Zach Edey', 'Purdue', 34, 27],
        2024: ['Enrique Freeman', 'Akron', 35, 31],
        2025: ['Yaxel Lendeborg', 'UAB', 37, 26],
        2026: ['Cameron Boozer', 'Duke', 38, 22]
      }
    ]
  ],
  ncaaw: [
    [
      'Scoring average',
      'pts',
      'perGame',
      {
        2022: ['Caitlin Clark', 'Iowa', 32, 863],
        2023: ['Maddy Siegrist', 'Villanova', 37, 1081],
        2024: ['Caitlin Clark', 'Iowa', 39, 1234],
        2025: ['Ta’Niya Liston', 'Florida St.', 29, 731],
        2026: ['Mikayla Blakes', 'Vanderbilt', 34, 918]
      }
    ],
    [
      'Field-goal percentage',
      'fg_pct',
      'totals',
      {
        2022: ['Monika Czinano', 'Iowa', 31, 277, 408],
        2023: ['Mya Berkman', 'Liberty', 33, 196, 282],
        2024: ['Raegan Beers', 'Oregon St.', 31, 221, 333],
        2025: ['Jordana Reisma', 'Cleveland St.', 37, 203, 300],
        2026: ['Gracie Merkle', 'Penn St.', 26, 216, 298]
      }
    ],
    [
      'Three-point field goals made per game',
      'fg3m',
      'perGame',
      {
        2022: ['Taylor Robertson', 'Oklahoma', 34, 124],
        2023: ['Caitlin Clark', 'Iowa', 38, 140],
        2024: ['Caitlin Clark', 'Iowa', 39, 201],
        2025: ['Alyssa Durazo-Frescas', 'Grand Canyon', 32, 124],
        2026: ['Briana Rivera', 'Samford', 35, 112]
      }
    ],
    [
      'Three-point field-goal percentage',
      'fg3_pct',
      'totals',
      {
        2022: ['Tess Amundsen', 'CSUN', 28, 56, 114],
        2023: ['Alex Giannaros', 'Boston U.', 25, 50, 97],
        2024: ['Te-Hina Paopao', 'South Carolina', 37, 87, 186],
        2025: ['Lauren Ross', 'Purdue Fort Wayne', 36, 111, 233],
        2026: ['Emilee Fox', 'South Dakota St.', 27, 57, 116]
      }
    ],
    [
      'Free-throw percentage',
      'ft_pct',
      'totals',
      {
        2022: ['Haley Cavinder', 'Fresno St.', 29, 109, 112],
        2023: ['Erin Houpt', 'Mercer', 28, 92, 98],
        2024: ['Maya McDermott', 'UNI', 31, 80, 83],
        2025: ['Lauren Ross', 'Purdue Fort Wayne', 36, 91, 96],
        2026: ['Allie Turner', 'Gonzaga', 34, 86, 90]
      }
    ],
    [
      'Rebound average',
      'reb',
      'perGame',
      {
        2022: ['Aneesah Morrow', 'DePaul', 33, 457],
        2023: ['Lauren Gustin', 'BYU', 33, 552],
        2024: ['Lauren Gustin', 'BYU', 33, 504],
        2025: ['Aneesah Morrow', 'LSU', 36, 485],
        2026: ['Megan Nestor', 'North Texas', 33, 464]
      }
    ],
    [
      'Assist average',
      'ast',
      'perGame',
      {
        2022: ['Caitlin Clark', 'Iowa', 32, 257],
        2023: ['Caitlin Clark', 'Iowa', 38, 327],
        2024: ['Caitlin Clark', 'Iowa', 39, 346],
        2025: ['Serena Sundell', 'Kansas St.', 36, 262],
        2026: ['Caroline Lau', 'Northwestern', 29, 245]
      }
    ],
    [
      'Assist-to-turnover ratio',
      'ast_tov',
      'totals',
      {
        2022: ['Clair Steele', 'Lehigh', 24, 131, 33],
        2023: ['Molly Masciantonio', 'La Salle', 26, 118, 25],
        2024: ['Kiara Jackson', 'UNLV', 33, 157, 45],
        2025: ['Kiara Jackson', 'UNLV', 34, 170, 46],
        2026: ['Paige Girardi', 'Quinnipiac', 28, 88, 20]
      }
    ],
    [
      'Blocked-shot average',
      'blk',
      'perGame',
      {
        2022: ['Lucy Cochrane', 'Portland', 29, 114],
        2023: ['Brooke Flowers', 'Saint Louis', 35, 133],
        2024: ['Cameron Brink', 'Stanford', 34, 127],
        2025: ['Anastasiia Boldyreva', 'Middle Tenn.', 35, 128],
        2026: ['Madison Francis', 'Mississippi St.', 31, 88]
      }
    ],
    [
      'Steal average',
      'stl',
      'perGame',
      {
        2022: ['Veronica Burton', 'Northwestern', 29, 117],
        2023: ['Ny’Ceara Pryor', 'Sacred Heart', 33, 122],
        2024: ['Hannah Hidalgo', 'Notre Dame', 35, 160],
        2025: ['Ny’Ceara Pryor', 'Sacred Heart', 29, 120],
        2026: ['Hannah Hidalgo', 'Notre Dame', 36, 202]
      }
    ],
    [
      'Triple-doubles',
      'td3',
      'totals',
      {
        2022: ['Caitlin Clark', 'Iowa', 32, 5],
        2023: ['Caitlin Clark', 'Iowa', 38, 5],
        2024: ['Caitlin Clark', 'Iowa', 39, 6],
        2025: ['Olivia Miles', 'Notre Dame', 34, 3],
        2026: ['Olivia Miles', 'TCU', 38, 8]
      }
    ],
    [
      'Double-doubles',
      'dd2',
      'totals',
      {
        2022: ['Aliyah Boston', 'South Carolina', 37, 30],
        2023: ['Angel Reese', 'LSU', 36, 34],
        2024: ['Lauren Gustin', 'BYU', 33, 30],
        2025: ['Aneesah Morrow', 'LSU', 36, 30],
        2026: ['Sharneccee Currie-Jelks', 'Murray St.', 35, 26]
      }
    ]
  ]
}

/**
 * Leaders the app keeps where the book names another, each with why (the manager's decision of
 * 2026-11-19): the groups file is the Division I list (D40), and both families agree on the line.
 */
const STATED = {
  ncaam: {
    'blk 2025': {
      leader: 'Malcolm Wilson',
      why: 'Malcolm Wilson of Queens leads, 115 blocks in 35 games, equal in both families. Queens was reclassifying to Division I; the record book appears to leave reclassifying schools out of its rankings, and names Obinna Anochili-Killen (102 in 32).'
    }
  }
}

/** The counts each metric's champion is checked on: its total, and a ratio's denominator. */
const PARTS = {
  pts: ['pts'],
  fg_pct: ['fgm', 'fga'],
  fg3m: ['fg3m'],
  fg3_pct: ['fg3m', 'fg3a'],
  ft_pct: ['ftm', 'fta'],
  reb: ['reb'],
  ast: ['ast'],
  ast_tov: ['ast', 'tov'],
  blk: ['blk'],
  stl: ['stl'],
  dd2: ['dd2'],
  td3: ['td3']
}

/**
 * Names the books print otherwise than ESPN does, each checked by its line: Ta'Niya Latson (731
 * points in 29 games) is "Ta’Niya Liston" in the women's book, and Sharnecce Currie-Jelks
 * "Sharneccee".
 */
const ALIASES = {
  'Ta’Niya Liston': "Ta'Niya Latson",
  'Sharneccee Currie-Jelks': 'Sharnecce Currie-Jelks'
}

/** A name to compare: no accents, punctuation, suffixes or case ("Walter Clayton Jr." is "walterclayton"). */
const key = (raw) =>
  (ALIASES[raw] ?? raw)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

const [folder] = positional().map((p) => resolve(p))
const league = leagueArg()
if (!folder || !BOOKS[league]) {
  console.error('usage: node scripts/check-ncaa-leaders.mjs <folder> --league=ncaam|ncaaw')
  process.exit(2)
}
const { query, read, close } = openStatsWorker(folder, { league })

/**
 * Every player's season over every counted game, with the counts checked: the season table's rows of
 * no team, one per type, added up, the exhibitions left out.
 */
async function seasonRows(season) {
  const counts = [...new Set(Object.values(PARTS).flat())]
  const rows = await read(`SELECT p.player_id, any_value(pl.name) AS name,
      sum(p.games)::INTEGER AS games, ${counts.map((c) => `sum(p.${c})::INTEGER AS ${c}`).join(', ')}
    FROM player_season p JOIN player pl USING (player_id)
    WHERE p.season = ${Number(season)} AND p.team_id IS NULL AND p.game_type <> 'preseason'
    GROUP BY p.player_id`)
  return rows.map((r) => ({ ...r, key: key(r.name) }))
}

const out = [
  `# ${league === 'ncaam' ? "Men's" : "Women's"} champions against the NCAA's record books`,
  '',
  'The engine leads each category among qualified players over every counted game (D45), under the 75 % rule for the per-game categories and D37\'s scaled makes for the percentages (D43). "Leader" says whether its first row is the champion; "Line" whether the champion\'s games and totals equal the book\'s.',
  '',
  '| Category | Season | Champion (book) | Book line | Leader | App leader | App line for the champion | Line |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |'
]
const tally = { leader: 0, line: 0, all: 0 }
const notes = []
const byCategory = new Map()
for (const [category, metric, transform, seasons] of BOOKS[league]) {
  for (const [season, [name, team, games, total, under]] of Object.entries(seasons)) {
    const result = await query({
      entity: 'player',
      metrics: [metric],
      ...(transform === 'perGame' ? { transform } : {}),
      scope: { seasons: [Number(season)], qualifiedOnly: true },
      sort: { metric, dir: 'desc' },
      limit: 1
    })
    const top = result.rows[0]
    const rows = await seasonRows(season)
    const mine = rows.filter((r) => r.key === key(name))
    const parts = PARTS[metric]
    const book = [games, total, ...(under === undefined ? [] : [under])]
    const appLine = (r) => [r.games, ...parts.map((c) => r[c])]
    const line = mine.find((r) => appLine(r).join('/') === book.join('/'))
    const leader = top && key(top.name) === key(name)
    const stated = !leader && top ? STATED[league]?.[`${metric} ${season}`] : undefined
    if (stated && key(top.name) === key(stated.leader))
      notes.push(`- ${category}, ${season}: ${stated.why}`)
    tally.all++
    if (leader) tally.leader++
    if (line) tally.line++
    const c = byCategory.get(category) ?? [0, 0, 0]
    byCategory.set(category, [c[0] + (leader ? 1 : 0), c[1] + (line ? 1 : 0), c[2] + 1])
    out.push(
      `| ${category} | ${season} | ${name}, ${team} | ${book.join(' / ')} | ${leader ? 'same' : 'differs'} | ${
        leader ? '' : top ? `${top.name} ${top.values[metric].value?.toFixed(3) ?? '–'}` : '–'
      } | ${mine.length ? mine.map((r) => appLine(r).join(' / ')).join('; ') : 'not found'} | ${line ? 'equal' : 'differs'} |`
    )
  }
}
await close()
out.push(
  '',
  '| Category | Same leader | Same line |',
  '| --- | --- | --- |',
  ...[...byCategory].map(([cat, [l, n, all]]) => `| ${cat} | ${l} of ${all} | ${n} of ${all} |`),
  `| Every category | ${tally.leader} of ${tally.all} | ${tally.line} of ${tally.all} |`,
  ...(notes.length ? ['', 'Stated differences: the app keeps its leader.', '', ...notes] : [])
)
console.log(out.join('\n'))
