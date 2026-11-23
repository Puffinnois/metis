// Writes the Stage 16 gate's drive steps (favourites, T1601; the gate in Plan.md):
// node scripts/stage16-make-steps.mjs scripts
//   stage16-wnba-load-steps.json        a clean profile: the first-run question answered with the WNBA alone
//   stage16-wnba-favourites-steps.json  the same profile: stars, the mark, the filters, the page, on the WNBA
//   stage16-upgrade-steps.json          a 1.2.0 four-league profile on 1.3.0: views and settings kept, then
//                                       stars in all four leagues, the mark, the filters and the page
//   stage16-heavy-steps.json            the same profile: 100 favourite players and 30 teams through the IPC,
//                                       Games' filter with more than 64, the page timed
// Each league's favourites are found at run time: its leading qualified scorers and the first one's team.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
const NL = String.fromCharCode(10)

// Stage 13's load helpers (settle, families, the dialog's buttons), as its first load used them.
const LOAD_HELPERS = JSON.parse(readFileSync(join(out, 'stage13-first-load-steps.json'), 'utf8'))[2]
  .eval

const HELPERS = `
window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.until = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(20) } return false };
window.check = (label, ok, got) => (ok ? 'OK ' : 'MISMATCH ') + label + ' got ' + JSON.stringify(got);
window.nav = async (name) => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === name); if (!b) return 'NO NAV ' + name; b.click(); await sleep(1200); return 'nav ' + name };
window.trigger = () => document.querySelector('button[aria-label^="League: "]');
window.league = () => trigger()?.getAttribute('aria-label')?.replace('League: ', '') ?? null;
window.items = () => [...document.querySelectorAll('[role=menuitemradio]')];
window.openMenu = async () => { const t = trigger(); if (!t) return false; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return until(() => items().length > 0, 5000) };
window.pick = async (name) => { if (league() === name) return name; if (!(await openMenu())) return 'NO MENU'; const item = items().find((x) => x.textContent.startsWith(name)); if (!item) return 'NO ITEM ' + name; item.click(); await until(() => league() === name, 8000); await sleep(3000); return league() };
window.heading = () => document.querySelector('main h1')?.textContent ?? null;
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) return 'NO ' + title; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.tab = async (name) => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === name); if (!t) return 'NO TAB ' + name; t.click(); await sleep(2500); return name };
window.toggle = (name) => [...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.replace('✓', '').trim() === name);
window.setToggle = async (name, on) => { const t = toggle(name); if (!t) return 'NO TOGGLE ' + name; if ((t.getAttribute('aria-pressed') === 'true') !== on) t.click(); await sleep(1500); return toggle(name).getAttribute('aria-pressed') };
window.rail = () => document.querySelector('aside[aria-label=Players]');
window.railRow = (name) => [...(rail()?.querySelectorAll('button') ?? [])].find((b) => b.querySelector('span span')?.textContent.trim() === name);
window.input = () => document.querySelector('input[aria-label="Search players"]');
window.typeIn = (text) => { const i = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, text); i.dispatchEvent(new Event('input', { bubbles: true })) };
window.searchRail = async (name) => { for (const text of [name, name.split(' ').slice(-1)[0]]) { typeIn(text); if (await until(() => railRow(name), 10000)) return true } return false };
window.openPlayer = async (n, season, name) => { await pick(n); await nav('Players'); await setSelect('Season', season); await setSelect('Rank by', 'pts'); await setSelect('Team', ''); if (!(await searchRail(name))) return 'NOT IN RAIL ' + name; railRow(name).click(); const last = name.split(' ').slice(-1)[0]; await until(() => (heading() ?? '').includes(last), 20000); typeIn(''); await sleep(1500); return heading() };
window.headerStar = () => document.querySelector('main header button[aria-pressed]');
window.starOn = async () => { const b = headerStar(); if (!b) return 'NO STAR'; if (b.getAttribute('aria-pressed') !== 'true') b.click(); await sleep(1500); return headerStar().getAttribute('aria-pressed') };
window.edged = (el) => { const b = getComputedStyle(el).boxShadow; const before = getComputedStyle(el, '::before').backgroundColor; return (/2px 0px 0px( 0px)? inset/.test(b) && (b.includes('0.62 0.14 88') || b.includes('0.79 0.16 78'))) || before.includes('0.62 0.14 88') || before.includes('0.79 0.16 78') };
window.marks = (root = document) => root.querySelectorAll('[role=img][aria-label=Favourite]').length;
window.board = async (which) => { await nav('Leaderboards'); await sleep(1500); const all = [...document.querySelectorAll('button[title="Open the full board"]')]; const b = which === 'last' ? all.at(-1) : all[0]; if (!b) return 'NO BOARD'; b.click(); await until(() => document.querySelectorAll('tbody tr').length > 3, 20000); await sleep(1000); return document.querySelectorAll('tbody tr').length };
window.expand = async () => { for (let i = 0; i < 40; i++) { const more = [...document.querySelectorAll('footer button')].find((b) => /^Show \\d+ more$/.test(b.textContent.trim())); if (!more) break; more.click(); await sleep(200) } return document.querySelectorAll('tbody tr').length };
window.nameOf = (tr) => tr.querySelector('td div div button[title^="Open"], td div div span.truncate')?.textContent.trim();
window.ranks = () => Object.fromEntries([...document.querySelectorAll('tbody tr')].map((tr) => [nameOf(tr), tr.querySelector('td div > span')?.textContent.trim()]));
window.rowEdged = (name) => { const tr = [...document.querySelectorAll('tbody tr')].find((x) => nameOf(x) === name); return tr ? [...tr.children].some(edged) : 'absent' };
window.miniEdged = (label, name) => { const t = document.querySelector('[role=table][aria-label="' + label + '"]'); if (!t) return 'NO TABLE ' + label; const r = [...t.querySelectorAll(':scope > [role=row]')].find((x) => x.textContent.includes(name)); return r ? { edged: edged(r), mark: marks(r) } : 'absent' };
window.errors = async () => (await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200));
window.themeNow = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
window.toTheme = async (want) => { if (themeNow() !== want) document.querySelector('button[aria-label="Switch theme"]').click(); await sleep(800); return themeNow() };
window.settled = () => document.querySelectorAll('section[data-league]').length > 0 && !document.querySelector('[data-loading]');
window.openFavourites = async () => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === 'Favourites'); const t0 = performance.now(); b.click(); await until(() => document.querySelector('[data-day]')?.dataset.day && settled(), 60000); const ms = Math.round(performance.now() - t0); await sleep(500); return ms };
window.page = () => ({ day: document.querySelector('[data-day]')?.dataset.day ?? null, sub: document.querySelector('[data-day]')?.textContent.trim(), sections: [...document.querySelectorAll('section[data-league]')].map((s) => ({ league: s.dataset.league, ms: s.dataset.ms, through: s.querySelector('[data-through]')?.textContent ?? null, foot: s.querySelector('[data-absent]')?.textContent ?? null, rows: [...s.querySelectorAll('[role=row][data-state]')].map((r) => r.dataset.state + ': ' + r.innerText.replace(/\\s+/g, ' ').trim().slice(0, 90)) })) });
// A league's favourites, found from its data: the leading qualified scorers of its latest season, per game,
// and the first one's team.
window.findFavs = async (L, N) => { const seasons = await window.api.stats.seasons(L); const s = seasons[0]; const r = await window.api.stats.query(L, { entity: 'player', metrics: ['pts', 'min'], scope: { seasons: [s.season] }, sort: { metric: 'pts', dir: 'desc' }, transform: 'perGame', limit: 60 }); const q = r.rows.filter((x) => x.values.min.qualified && x.team); const p1 = q[0]; const p2 = q[1]; const team = s.teams.find((t) => t.code === p1.team); return { L, N, season: s.season, p1: { id: p1.id, name: p1.name }, p2: { id: p2.id, name: p2.name }, team: { id: team.id, name: team.name, code: team.code } } };
// Stars a league's favourites through the app: the first player on their page, the second on the full
// board's row, the team on its page.
window.starLeague = async (f) => { const a = await openPlayer(f.N, f.season, f.p1.name); const s1 = await starOn(); await board('first'); await expand(); const tr = [...document.querySelectorAll('tbody tr')].find((x) => nameOf(x) === f.p2.name); let s2 = 'not on the board'; if (tr) { const b = tr.querySelector('button[aria-pressed]'); if (b.getAttribute('aria-pressed') !== 'true') b.click(); await sleep(1200); s2 = tr.querySelector('button[aria-pressed]').getAttribute('aria-pressed') } await nav('Teams'); await setSelect('Season', f.season); await setSelect('Team', f.team.id); await tab('Overview'); const s3 = await starOn(); return { league: f.N, player: [a, s1], board: [f.p2.name, s2], team: [heading(), s3] } };
// The mark on a league's screens, with the favourites found above.
window.markLeague = async (f) => { await pick(f.N); const out = {}; await nav('Leaderboards'); await sleep(2000); out.home = marks(document.querySelector('main')); await board('first'); await expand(); out.playersBoard = { p1: rowEdged(f.p1.name), p2: rowEdged(f.p2.name) }; await board('last'); out.teamsBoard = rowEdged(f.team.name) === 'absent' ? rowEdged(f.team.code) : rowEdged(f.team.name); await nav('Standings'); await sleep(2500); const st = [...document.querySelectorAll('[role=table]')].find((t) => t.textContent.includes(f.team.name)); out.standings = st ? miniEdged(st.getAttribute('aria-label'), f.team.name) : 'no standings table names the team'; await nav('Teams'); await setSelect('Team', f.team.id); await tab('Players'); out.roster = miniEdged('Players', f.p1.name); await nav('Games'); await setSelect('Season', f.season); const games = await window.api.stats.games(f.L, f.season); const g = games.filter((x) => x.played && x.hasBox && [x.home.id, x.away.id].includes(f.team.id)).at(-1); if (g) { await setSelect('Day', g.date); await sleep(1500); const card = [...document.querySelector('[aria-label="The day’s games"]').querySelectorAll('button')].find((c) => c.querySelector('[aria-label=Favourite]')); out.gameCard = card ? edged(card) : 'no marked card'; card?.click(); await sleep(4000); out.boxScore = miniEdged(f.team.code + ' box score', f.p1.name) } await nav('Explore'); await tab('Chart'); await sleep(4000); const dot = document.querySelector('[data-dot="' + f.p1.id + '"] circle:last-child'); out.chartDot = dot ? dot.getAttribute('fill') : 'no dot'; return { league: f.N, ...out } };
// The three filters on a league: the board's ranks against the unfiltered board, the chart's dots, the games.
window.filterLeague = async (f) => { await pick(f.N); const out = {}; await board('first'); await setToggle('Favourites', false); await expand(); const all = ranks(); await setToggle('Favourites', true); await sleep(1000); const fav = ranks(); out.board = Object.entries(fav).map(([n, r]) => [n, r, all[n] ?? 'absent', String(all[n]) === r]); await setToggle('Favourites', false); await nav('Explore'); await tab('Chart'); await sleep(3000); const before = document.querySelectorAll('[data-dot]').length; await setToggle('Favourites', true); await sleep(1200); out.chart = { before, after: document.querySelectorAll('[data-dot]').length, caption: document.querySelector('[data-summary]')?.textContent.trim() }; await setToggle('Favourites', false); await nav('Games'); const g = (await window.api.stats.games(f.L, f.season)).filter((x) => x.played && [x.home.id, x.away.id].includes(f.team.id)).at(-1); if (g) { await setSelect('Season', f.season); await setSelect('Day', g.date); await sleep(1200); const list = () => document.querySelector('[aria-label="The day’s games"]').querySelectorAll('button').length; const n0 = list(); await setToggle('Favourites', true); await sleep(2500); out.games = { day: g.date, all: n0, favourites: list() }; await setToggle('Favourites', false) } return { league: f.N, ...out } };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)

const wnbaLoad = [
  { size: [1500, 950] },
  { wait: 6000 },
  ev(LOAD_HELPERS),
  ev(
    `(async () => { const d = await window.api.leagues.downloads(); const dialog = document.querySelector('[role=dialog]')?.innerText ?? ''; return check('a clean profile asks which leagues to download, and nothing has started', !d.decided && d.leagues.every((l) => !l.on && !l.hasFile) && /Which leagues should Metis download/.test(dialog), { dialog: dialog.slice(0, 400) }) })()`
  ),
  shot('wnba-01-first-run'),
  ev(
    `(async () => { const labels = [...document.querySelectorAll('[role=dialog] label')]; const box = (name) => labels.find((l) => l.innerText.split('\\n')[0].trim().split(' · ')[0] === name)?.querySelector('input[type=checkbox]'); for (const l of labels) { const b = l.querySelector('input[type=checkbox]'); if (b && b.checked) b.click() } await sleep(200); box('WNBA').click(); await sleep(300); const ticked = labels.filter((l) => l.querySelector('input[type=checkbox]')?.checked).map((l) => l.innerText.split('\\n')[0]); return check('the WNBA alone is ticked', ticked.length === 1 && /^WNBA/.test(ticked[0]), ticked) })()`
  ),
  ev(
    `(async () => { button('Download').click(); window.started = performance.now(); const started = await until(async () => (await window.api.stats.status('wnba')).busy, 60000); const d = await window.api.leagues.downloads(); return check('the WNBA alone starts loading', started && d.decided && d.leagues.filter((l) => l.on).map((l) => l.league).join() === 'wnba', d.leagues.map((l) => [l.league, l.on])) })()`
  ),
  ev(
    `(async () => { const r = await settle('wnba', 40); const d = await dl('wnba'); const f = await families('wnba'); return check('WNBA loaded and built from nothing', r.minutes !== null && d.hasFile && f.failed.length === 0, { minutes: r.minutes, maxTotal: r.maxTotal, fileBytes: d.fileBytes, through: r.status?.through, builtAt: r.status?.builtAt, families: f, log: r.log }) })()`
  ),
  ev(
    `(async () => { document.querySelector('[title="See what is loaded"]').click(); await until(() => section('WNBA'), 20000); await sleep(1500); const t = section('WNBA')?.innerText ?? ''; return check('the Data panel shows the WNBA loaded, with no failure', /On ·/.test(t) && !/[Ff]ailed/.test(t), t.split('\\n').filter(Boolean).slice(0, 10)) })()`
  ),
  shot('wnba-02-data'),
  ev(
    `(async () => JSON.stringify((await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200))))()`
  )
]

const wnbaFavourites = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(`await toTheme('light'); window.F = await findFavs('wnba', 'WNBA'); return window.F`),
  run(`return starLeague(window.F)`),
  run(
    `return { stored: (await window.api.favourites.all()).wnba.map((f) => f.kind + ':' + f.name) }`
  ),
  run(`return markLeague(window.F)`),
  shot('wnba-03-chart-marked'),
  run(`return filterLeague(window.F)`),
  run(`const ms = await openFavourites(); return { firstPaint: ms, ...page() }`),
  shot('wnba-04-favourites-light'),
  run(`await toTheme('dark'); await sleep(500); return page().day`),
  shot('wnba-05-favourites-dark'),
  run(`await toTheme('light'); return { errors: await errors() }`)
]

const LEAGUES = [
  ['nba', 'NBA'],
  ['wnba', 'WNBA'],
  ['ncaam', 'NCAA Men'],
  ['ncaaw', 'NCAA Women']
]

const upgrade = [
  { size: [1500, 950] },
  { wait: 12000 },
  ev(HELPERS),
  // What the 1.2.0 profile held, as the 1.3.0 build reads it: its saved views and settings, no download.
  run(
    `const views = {}; for (const [l] of ${JSON.stringify(LEAGUES)}) views[l] = (await window.api.stats.views(l)).map((v) => v.name); const d = await window.api.leagues.downloads(); const status = {}; for (const [l] of ${JSON.stringify(LEAGUES)}) { const s = await window.api.stats.status(l); status[l] = { busy: s.busy, progress: s.progress, through: s.through?.date, builtAt: s.builtAt } } return { theme: themeNow(), views, downloads: d.leagues.map((l) => [l.league, l.on, l.hasFile]), status, favourites: await window.api.favourites.all() }`
  ),
  shot('up-01-launch'),
  run(
    `await toTheme('light'); window.FS = []; for (const [l, n] of ${JSON.stringify(LEAGUES)}) window.FS.push(await findFavs(l, n)); return window.FS`
  ),
  ...LEAGUES.map((_, i) => run(`return starLeague(window.FS[${i}])`)),
  run(
    `const all = await window.api.favourites.all(); return Object.fromEntries(Object.entries(all).map(([l, f]) => [l, f.map((x) => x.kind + ':' + x.name + (x.from ? ' (from ' + x.from + ')' : ''))]))`
  ),
  ...LEAGUES.flatMap((_, i) => [
    run(`return markLeague(window.FS[${i}])`),
    shot(`up-02-chart-${LEAGUES[i][0]}`)
  ]),
  ...LEAGUES.map((_, i) => run(`return filterLeague(window.FS[${i}])`)),
  // The page with favourites in all four leagues, the league on screen the NBA: the WNBA's data behind.
  run(`await pick('NBA'); const ms = await openFavourites(); return { firstPaint: ms, ...page() }`),
  shot('up-03-favourites-light'),
  run(`await toTheme('dark'); await sleep(500); return page().sub`),
  shot('up-04-favourites-dark'),
  run(
    `await board('first'); await setToggle('Favourites', true); await sleep(800); return ranks()`
  ),
  shot('up-05-board-filtered-dark'),
  run(
    `await setToggle('Favourites', false); await toTheme('light'); return { errors: await errors() }`
  )
]

// 100 favourite players and 30 teams across the leagues, through the IPC: 70 of the NBA's season's
// players by minutes, 10 in each other league, and 10 teams in three leagues. Then Games' filter on a day,
// for the independent count, and the page timed.
const heavy = [
  { size: [1500, 950] },
  { wait: 12000 },
  ev(HELPERS),
  run(
    `const plan = { nba: [70, 10], wnba: [10, 10], ncaam: [10, 10], ncaaw: [10, 0] }; const added = {}; for (const [l, [np, nt]] of Object.entries(plan)) { const s = (await window.api.stats.seasons(l))[0]; const r = await window.api.stats.query(l, { entity: 'player', metrics: ['min'], scope: { seasons: [s.season] }, sort: { metric: 'min', dir: 'desc' }, limit: np + 5 }); let p = 0; for (const row of r.rows) { if (p >= np) break; await window.api.favourites.add(l, 'player', row.id, row.name); p++ } let t = 0; for (const team of s.teams) { if (t >= nt) break; await window.api.favourites.add(l, 'team', team.id, team.name); t++ } added[l] = { players: p, teams: t, season: s.season } } const all = await window.api.favourites.all(); return { added, stored: Object.fromEntries(Object.entries(all).map(([l, f]) => [l, { players: f.filter((x) => x.kind === 'player').length, teams: f.filter((x) => x.kind === 'team').length }])) }`
  ),
  // The provider reads the favourites again on a league switch.
  run(
    `await pick('WNBA'); await pick('NBA'); const t0 = performance.now(); await window.api.favourites.all(); return { favouritesAllMs: Math.round(performance.now() - t0) }`
  ),
  run(
    `await nav('Games'); const s = (await window.api.stats.seasons('nba'))[0]; await setSelect('Season', s.season); const games = await window.api.stats.games('nba', s.season); const day = games.filter((g) => g.played).at(-1).date; await setSelect('Day', day); await sleep(1200); const list = () => [...document.querySelector('[aria-label="The day’s games"]').querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()); const all = list(); const t0 = performance.now(); await setToggle('Favourites', true); await until(() => list().length !== all.length, 8000); const ms = Math.round(performance.now() - t0); await sleep(1500); const fav = list(); await setToggle('Favourites', false); return { day, season: s.season, all: all.length, favourites: fav.length, kept: fav, filterMs: ms }`
  ),
  shot('heavy-01-games-filtered'),
  // UCF on NCAA Men's 365-team board, every row shown.
  run(
    `await pick('NCAA Men'); await board('last'); await expand(); const r = rowEdged('UCF Knights'); await pick('NBA'); return { ucf: r }`
  ),
  run(
    `const ms = await openFavourites(); return { firstPaint: ms, ...page(), rowsShown: document.querySelectorAll('[role=row][data-state]').length }`
  ),
  shot('heavy-02-favourites'),
  run(`return { errors: await errors() }`)
]

// The mark and the filters again on the upgraded profile, each league on screen, and the page opened
// twice (the second time with every league's worker open).
const again = [
  { size: [1500, 950] },
  { wait: 12000 },
  ev(HELPERS),
  run(
    `await toTheme('light'); window.FS = []; for (const [l, n] of ${JSON.stringify(LEAGUES)}) window.FS.push(await findFavs(l, n)); return window.FS.map((f) => [f.N, f.p1.name, f.p2.name, f.team.name])`
  ),
  ...LEAGUES.flatMap((_, i) => [
    run(`return markLeague(window.FS[${i}])`),
    shot(`again-mark-${LEAGUES[i][0]}`)
  ]),
  ...LEAGUES.map((_, i) => run(`return filterLeague(window.FS[${i}])`)),
  run(
    `await pick('NBA'); const first = await openFavourites(); const sections1 = page().sections.map((x) => [x.league, x.ms]); await nav('Glossary'); await sleep(1500); const second = await openFavourites(); return { first, sections1, second, sections2: page().sections.map((x) => [x.league, x.ms]) }`
  ),
  run(
    `await toTheme('dark'); await board('first'); await setToggle('Favourites', true); await sleep(800); return ranks()`
  ),
  shot('again-board-filtered-dark'),
  run(
    `await setToggle('Favourites', false); await toTheme('light'); return { errors: await errors() }`
  )
]
writeFileSync(join(out, 'stage16-again-steps.json'), JSON.stringify(again, null, 2) + '\n')

// Games past 64 favourite players, a test that can fail: the NBA's favourites become 70 players only,
// the first 64 from four teams and the last 6 all from a fifth, so that fifth team's game is listed on a
// day only if the players past the 64th are read. The other leagues' favourites stay.
const past64 = [
  { size: [1500, 950] },
  { wait: 12000 },
  ev(HELPERS),
  run(
    `const s = (await window.api.stats.seasons('nba'))[0]; for (const f of (await window.api.favourites.all()).nba) await window.api.favourites.remove('nba', f.kind, f.id); const r = await window.api.stats.query('nba', { entity: 'player', metrics: ['min'], scope: { seasons: [s.season] }, sort: { metric: 'min', dir: 'desc' }, limit: 1000 }); const byTeam = new Map(); for (const row of r.rows) { if (!row.team) continue; byTeam.set(row.team, [...(byTeam.get(row.team) ?? []), row]) } const teams = [...byTeam.keys()].filter((t) => byTeam.get(t).length >= 6); const first = []; let used = 0; while (first.length < 64) { const t = teams[used++]; for (const row of byTeam.get(t)) if (first.length < 64) first.push(row) } const firstTeams = [...new Set(first.map((x) => x.team))]; const tail = teams.find((t) => !firstTeams.includes(t)); const last = byTeam.get(tail).slice(0, 6); for (const row of [...first, ...last]) await window.api.favourites.add('nba', 'player', row.id, row.name); const stored = (await window.api.favourites.all()).nba; window.__tail = tail; window.__firstTeams = firstTeams; return { firstTeams, tail, lastSix: last.map((x) => x.name), stored: stored.length, kinds: [...new Set(stored.map((f) => f.kind))], order: stored.slice(62, 70).map((f) => f.name) }`
  ),
  run(
    `await pick('WNBA'); await pick('NBA'); return (await window.api.favourites.all()).nba.length`
  ),
  run(
    `const s = (await window.api.stats.seasons('nba'))[0]; const code = (id) => s.teams.find((t) => t.id === id)?.code; const games = (await window.api.stats.games('nba', s.season)).filter((g) => g.played); const tailDays = games.filter((g) => [code(g.home.id), code(g.away.id)].includes(window.__tail) && ![code(g.home.id), code(g.away.id)].some((c) => window.__firstTeams.includes(c))); const g = tailDays.at(-1); await nav('Games'); await setSelect('Season', s.season); await setSelect('Day', g.date); await sleep(1500); const list = () => [...document.querySelector('[aria-label="The day’s games"]').querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()); const all = list(); const t0 = performance.now(); await setToggle('Favourites', true); await until(() => list().length !== all.length, 15000); const ms = Math.round(performance.now() - t0); await sleep(1500); const fav = list(); await setToggle('Favourites', false); return { day: g.date, tailGame: code(g.away.id) + ' @ ' + code(g.home.id), all: all.length, kept: fav, filterMs: ms }`
  ),
  shot('past64-games'),
  run(
    `const first = await openFavourites(); await nav('Glossary'); await sleep(1500); const second = await openFavourites(); return { first, second, sections: page().sections.map((x) => [x.league, x.ms, x.rows.length]) }`
  ),
  run(`return { errors: await errors() }`)
]
writeFileSync(join(out, 'stage16-past64-steps.json'), JSON.stringify(past64, null, 2) + NL)

writeFileSync(join(out, 'stage16-wnba-load-steps.json'), JSON.stringify(wnbaLoad, null, 2) + '\n')
writeFileSync(
  join(out, 'stage16-wnba-favourites-steps.json'),
  JSON.stringify(wnbaFavourites, null, 2) + '\n'
)
writeFileSync(join(out, 'stage16-upgrade-steps.json'), JSON.stringify(upgrade, null, 2) + '\n')
writeFileSync(join(out, 'stage16-heavy-steps.json'), JSON.stringify(heavy, null, 2) + '\n')

// Each favourites read, timed through the IPC three times on the full files: the favourites with a linked
// player (the links worker's pairedIds), an NCAA Men board and its places read for a favourite 3,000 rows
// deep, the Games filter's player teams for 70 NBA players, the page's NBA section games for those 70, and
// the injury report's listings.
const reads = [
  { size: [1500, 950] },
  { wait: 12000 },
  ev(HELPERS),
  run(
    `const time = async (f) => { const t0 = performance.now(); const r = await f(); const rows = Array.isArray(r) ? r.reduce((n, x) => n + (x.rows?.length ?? 1), 0) : (r?.rows?.length ?? null); return [Math.round(performance.now() - t0), rows] }; await window.api.favourites.add('ncaam', 'player', '5041939', 'Cooper Flagg'); const s = (await window.api.stats.seasons('ncaam'))[0]; const base = { entity: 'player', metrics: ['pts', 'min', 'reb', 'ast', 'stl', 'blk', 'fg_pct', 'fg3_pct', 'ft_pct', 'ts_pct', 'tov'], scope: { seasons: [s.season] }, sort: { metric: 'pts', dir: 'desc' }, transform: 'perGame', limit: 1000 }; const full = await window.api.stats.query('ncaam', { ...base, limit: 5000 }); const deep = full.rows[3000]; const ids = (await window.api.favourites.all()).nba.filter((f) => f.kind === 'player').map((f) => f.id); const ns = (await window.api.stats.seasons('nba'))[0]; const batches = [ids.slice(0, 64), ids.slice(64)]; const games = (await window.api.stats.games('nba', ns.season)).filter((x) => x.played).slice(-20).map((x) => x.id); const out = { favouritesAll: [], board: [], places: [], gamesTeams: [], sectionGames: [], listings: [] }; for (let i = 0; i < 3; i++) { out.favouritesAll.push(await time(() => window.api.favourites.all())); out.board.push(await time(() => window.api.stats.query('ncaam', base))); out.places.push(await time(() => window.api.stats.query('ncaam', { ...base, places: { ids: [deep.id], standing: 'pts' } }))); out.gamesTeams.push(await time(() => Promise.all(batches.map((b) => window.api.stats.query('nba', { entity: 'player', metrics: ['pts'], scope: { seasons: [ns.season], players: b }, limit: b.length, ranks: false }))))); out.sectionGames.push(await time(() => Promise.all(batches.map((b) => window.api.stats.query('nba', { entity: 'player', metrics: ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'plus_minus', 'games_out_injury', 'games_out_other'], scope: { seasons: [ns.season], gameTypes: ['regular'], players: b }, groupBy: ['game'], limit: 5000, ranks: false }))))); out.listings.push(await time(() => window.api.stats.gameListings('nba', games, ids))) } const placed = (await window.api.stats.query('ncaam', { ...base, places: { ids: [deep.id], standing: 'pts' } })).rows[0]?.place; await window.api.favourites.remove('ncaam', 'player', '5041939'); return { deep: deep.name, placed, ...out }`
  ),
  run(`return { errors: await errors() }`)
]
writeFileSync(join(out, 'stage16-reads-steps.json'), JSON.stringify(reads, null, 2) + '\n')
console.log('written')
