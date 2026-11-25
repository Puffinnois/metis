// Writes the T1601.2 drive steps (the favourite colour on every screen):
// node scripts/t1601b-make-steps.mjs scripts
// Run on the T1601 profile (NBA and NCAA Men, links built) after t1601a: Shai Gilgeous-Alexander and
// the Los Angeles Lakers are NBA favourites; Cooper Flagg is starred in NCAA Men here, so the NBA
// shows him followed. Each screen: the favourite's row edged and marked, and its height and cells'
// left edges equal to an unstarred neighbour's. Then light and dark, and the read times.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]

const SGA = '1628983'
const LAL = '1610612747'
const OKC = '1610612760'
const FLAGG_NCAAM = '5041939'

const HELPERS = `
window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(10) } return false };
window.nav = async (name) => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === name); if (!b) return 'NO NAV ' + name; b.click(); await sleep(1500); return 'nav ' + name };
window.trigger = () => document.querySelector('button[aria-label^="League: "]');
window.league = () => trigger()?.getAttribute('aria-label')?.replace('League: ', '') ?? null;
window.items = () => [...document.querySelectorAll('[role=menuitemradio]')];
window.openMenu = async () => { const t = trigger(); if (!t) return false; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return until(() => items().length > 0, 3000) };
window.heading = () => document.querySelector('main h1')?.textContent ?? null;
window.pick = async (name) => { if (!(await openMenu())) return 'NO MENU'; const item = items().find((x) => x.textContent.startsWith(name)); if (!item) return 'NO ITEM ' + name; item.click(); await until(() => league() === name, 5000); await sleep(2500); return league() };
window.switchTo = async (name) => (league() === name ? name : pick(name));
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) { const t = [...document.querySelectorAll('[data-team-chooser]')].find((x) => x.dataset.teamChooser === title); if (!t) return 'NO ' + title; t.click(); await sleep(300); const o = [...document.querySelectorAll('[role=option]')].find((x) => x.dataset.value === String(value)); (o ?? t).click(); await sleep(1500); return o ? t.dataset.value : 'NO ' + value }; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.tab = async (name) => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === name); if (!t) return 'NO TAB ' + name; t.click(); await sleep(2500); return name };
window.rail = () => document.querySelector('aside[aria-label=Players]');
window.railRow = (name) => [...(rail()?.querySelectorAll('button') ?? [])].find((b) => b.querySelector('span span')?.textContent.trim() === name);
window.input = () => document.querySelector('input[aria-label="Search players"]');
window.typeIn = (text) => { const i = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, text); i.dispatchEvent(new Event('input', { bubbles: true })) };
window.searchRail = async (name) => { for (const text of [name, name.split(' ').slice(-1)[0]]) { typeIn(text); if (await until(() => railRow(name), 10000)) return true } return false };
window.careerTable = () => document.querySelector('[role=table][aria-label="Career by season"]');
window.openPlayer = async (leagueName, season, name) => { await switchTo(leagueName); await nav('Players'); await setSelect('Season', season); await setSelect('Rank by', 'pts'); await setSelect('Team', ''); if (!(await searchRail(name))) return 'NOT IN RAIL ' + name; railRow(name).click(); const last = name.split(' ').slice(-1)[0]; await until(() => (heading() ?? '').includes(last), 20000); typeIn(''); await until(() => careerTable(), 20000); await sleep(800); return { league: league(), heading: heading() } };
window.stored = async () => { const all = await window.api.favourites.all(); return Object.fromEntries(Object.entries(all).filter(([, fs]) => fs.length).map(([l, fs]) => [l, fs.map((f) => f.kind + ':' + f.id + ':' + f.name + (f.from ? ' from ' + f.from : ''))])) };
window.errors = async () => (await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200));
window.themeNow = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
window.toTheme = async (want) => { if (themeNow() !== want) document.querySelector('button[aria-label="Switch theme"]').click(); await sleep(800); return themeNow() };
window.FAV = 'Favourite';
window.marks = (root = document) => root.querySelectorAll('[role=img][aria-label=Favourite]').length;
window.edged = (el) => { const b = getComputedStyle(el).boxShadow; return /2px 0px 0px( 0px)? inset/.test(b) && (b.includes('0.62 0.14 88') || b.includes('0.79 0.16 78')) };
window.geo = (row, cell) => { const r = row.getBoundingClientRect(); return { h: Math.round(r.height), lefts: [...row.querySelectorAll(cell)].map((c) => Math.round(c.getBoundingClientRect().left)) } };
window.compareRows = (rows, isFav, cell) => { const favs = rows.filter(isFav); const width = (r) => r.querySelectorAll(cell).length; const plain = rows.filter((r) => !isFav(r) && width(r) === width(favs[0] ?? r)); if (!favs.length) return { favs: 0 }; const f = geo(favs[0], cell); const p = geo(plain[0] ?? favs[0], cell); return { favs: favs.length, rows: rows.length, heights: [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))], sameLefts: JSON.stringify(f.lefts) === JSON.stringify(p.lefts), favLefts: f.lefts.slice(0, 4), plainLefts: p.lefts.slice(0, 4), edged: favs.every((r) => edged(r) || [...r.children].some(edged)), plainEdged: plain.some((r) => edged(r) || [...r.children].some(edged)) } };
window.miniTable = (label) => { const t = document.querySelector('[role=table][aria-label="' + label + '"]'); if (!t) return 'NO TABLE ' + label; const rows = [...t.querySelectorAll(':scope > [role=row]')].slice(1); return compareRows(rows, (r) => !!r.querySelector('[aria-label=Favourite]'), ':scope > [role=cell]') };
window.homeBoards = () => { const rows = [...document.querySelectorAll('main section button.grid')]; return compareRows(rows, (r) => !!r.querySelector('[aria-label=Favourite]'), ':scope > *') };
window.board = async (which) => { await nav('Leaderboards'); await sleep(1500); const all = [...document.querySelectorAll('button[title="Open the full board"]')]; const b = which === 'last' ? all.at(-1) : all[0]; b.click(); await until(() => document.querySelectorAll('tbody tr').length > 5, 20000); await sleep(1000); return document.querySelectorAll('tbody tr').length + ' rows' };
window.leaderRows = () => { const rows = [...document.querySelectorAll('tbody tr')]; return compareRows(rows, (r) => !!r.querySelector('button[aria-pressed=true]'), ':scope > td') };
window.railRows = () => { const rows = [...rail().querySelectorAll('[class*="group/fav"] > button:not([aria-pressed])')]; return compareRows(rows, (r) => !!r.parentElement.querySelector('button[aria-pressed=true]'), ':scope > span') };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)

const screens = (theme) => [
  run(`return toTheme('${theme}')`),
  // The home boards: SGA on points, the leader's cobalt kept beside the mark.
  run(
    `await nav('Teams'); await nav('Leaderboards'); await sleep(2500); return { marks: marks(), ...homeBoards() }`
  ),
  shot(`${theme}-01-home`),
  // The full boards: SGA and the followed Flagg, the Lakers on the teams' board.
  run(`await board('first'); return leaderRows()`),
  shot(`${theme}-02-players-board`),
  run(`await board('last'); return leaderRows()`),
  shot(`${theme}-03-teams-board`),
  // The rail, SGA selected: bg-sel and the edge.
  run(
    `const p = await openPlayer('NBA', 2027, 'Shai Gilgeous-Alexander'); await searchRail('Gilgeous'); await sleep(600); const row = railRow('Shai Gilgeous-Alexander'); const r = { p, selectedEdged: edged(row), selectedBg: getComputedStyle(row).backgroundColor }; typeIn(''); await sleep(1200); return { ...r, rows: railRows() }`
  ),
  shot(`${theme}-04-player-rail`),
  // His game log (Lakers games marked), his splits by opponent.
  run(
    `await setSelect('Season', 2026); await tab('Game log'); await sleep(2500); return { marks: marks(document.querySelector('[aria-label="Game log"]')), log: miniTable('Game log') }`
  ),
  shot(`${theme}-05-game-log`),
  run(`await tab('Splits'); await sleep(2500); return miniTable('By opponent')`),
  shot(`${theme}-06-splits-opponent`),
  // Standings.
  run(
    `await nav('Standings'); await sleep(3000); const t = [...document.querySelectorAll('[role=table]')].find((x) => x.querySelector('[aria-label=Favourite]')); return t ? miniTable(t.getAttribute('aria-label')) : 'NO FAVOURITE IN STANDINGS'`
  ),
  shot(`${theme}-07-standings`),
  // The team page of OKC: SGA in Who scores and the roster; on/off; the schedule's opponent.
  run(
    `await nav('Teams'); await setSelect('Season', 2027); await setSelect('Team', '${OKC}'); await tab('Overview'); await sleep(2500); return { h1: heading(), who: miniTable('Who scores') }`
  ),
  shot(`${theme}-08-team-overview`),
  run(`await tab('Players'); await sleep(2500); return miniTable('Players')`),
  shot(`${theme}-09-team-roster`),
  run(`await tab('On/off'); await sleep(3000); return miniTable('On and off')`),
  run(
    `await tab('Schedule'); await sleep(2000); return { marks: marks(document.querySelector('[aria-label=Schedule]')), table: miniTable('Schedule') }`
  ),
  shot(`${theme}-10-team-schedule`),
  run(
    `await setSelect('Season', 2026); await tab('Splits'); await sleep(3000); const t = miniTable('By opponent'); await setSelect('Season', 2027); return t`
  ),
  // Games: a day with a Lakers game against OKC, or else any Lakers game.
  run(
    `await nav('Games'); await setSelect('Season', 2027); const games = await window.api.stats.games('nba', 2027); const both = games.filter((g) => g.played && [g.home.id, g.away.id].includes('${LAL}')); const g = both.at(-1); await setSelect('Day', g.date); await sleep(2000); const list = document.querySelector('[aria-label="The day’s games"]'); const cards = [...list.querySelectorAll('button')]; const fav = cards.find((c) => c.querySelector('[aria-label=Favourite]')); window.__game = g; return { date: g.date, game: g.away.code + ' @ ' + g.home.code, cards: cards.length, favEdged: fav ? edged(fav) : 'NO CARD', othersEdged: cards.filter((c) => c !== fav && !c.querySelector('[aria-label=Favourite]')).some(edged), heights: [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().height)))] }`
  ),
  run(
    `const list = document.querySelector('[aria-label="The day’s games"]'); [...list.querySelectorAll('button')].find((c) => c.querySelector('[aria-label=Favourite]')).click(); await sleep(4000); const header = document.querySelector('main header'); return { headerMarks: marks(header), period: miniTable('Score by period') }`
  ),
  shot(`${theme}-11-game`),
  run(
    `const boxes = [...document.querySelectorAll('[role=table][aria-label$="box score"]')].map((t) => t.getAttribute('aria-label')); return Object.fromEntries(boxes.map((b) => [b, miniTable(b)]))`
  ),
  shot(`${theme}-12-box-score`),
  // An OKC game, for SGA's row in its box score.
  run(
    `const games = await window.api.stats.games('nba', 2027); const g = games.filter((x) => x.played && [x.home.id, x.away.id].includes('${OKC}')).at(-1); await setSelect('Day', g.date); await sleep(2000); const list = document.querySelector('[aria-label="The day’s games"]'); const card = [...list.querySelectorAll('button')].find((c) => c.textContent.includes('OKC')); card.click(); await sleep(4000); return { game: g.away.code + ' @ ' + g.home.code, cardEdged: edged(card), box: miniTable('OKC box score') }`
  ),
  shot(`${theme}-12b-okc-box-score`),
  // Explore: SGA's dot in the gold, ringed, drawn above; the table row; the tooltip's mark.
  run(
    `await nav('Explore'); await tab('Chart'); await sleep(4000); const dot = document.querySelector('[data-dot="${SGA}"]'); if (!dot) return 'NO DOT'; const circles = [...dot.querySelectorAll('circle')]; const all = [...document.querySelectorAll('[data-dot]')]; const flagg = document.querySelector('[data-dot="1642843"]'); dot.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(400); const tip = document.querySelector('[role=tooltip]'); const r = { fills: circles.map((c) => c.getAttribute('fill')), rings: circles.map((c) => c.getAttribute('stroke')), index: all.indexOf(dot), of: all.length, flaggFill: flagg ? [...flagg.querySelectorAll('circle')].at(-1).getAttribute('fill') : 'no Flagg dot', tipMark: tip ? marks(tip) : 'no tooltip', rows: document.querySelector('[data-row="${SGA}"]') ? edged(document.querySelector('[data-row="${SGA}"]')) : 'no row' }; return r`
  ),
  shot(`${theme}-13-chart`),
  // Compare and Trends from his page.
  run(
    `await openPlayer('NBA', 2027, 'Shai Gilgeous-Alexander'); const c = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Compare'); c.click(); await sleep(4000); return { slotMarks: marks(document.querySelector('[data-slot="0"]')) }`
  ),
  shot(`${theme}-14-compare`),
  run(
    `await nav('Explore'); await tab('Trends'); await sleep(4000); return { title: heading(), marks: marks(document.querySelector('[data-subject]')) }`
  ),
  shot(`${theme}-15-trends`)
]

const timing = (label, n) =>
  run(
    `const out = { home: [], board: [] }; for (let i = 0; i < ${n}; i++) { await nav('Glossary'); await sleep(500); const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === 'Leaderboards'); const t0 = performance.now(); b.click(); await until(() => [...document.querySelectorAll('main section')].filter((s) => s.querySelectorAll('button.grid').length >= 6).length >= 8, 20000); out.home.push(Math.round(performance.now() - t0)); const all = document.querySelector('button[title="Open the full board"]'); const t1 = performance.now(); all.click(); await until(() => document.querySelectorAll('tbody tr').length >= 50, 20000); out.board.push(Math.round(performance.now() - t1)); } const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]; return { label: '${label}', homeMedian: med(out.home), boardMedian: med(out.board), ...out }`
  )

const colour = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  // Flagg starred on the college side; the switch to the NBA reads him in as followed.
  run(
    `await switchTo('NCAA Men'); await window.api.favourites.add('ncaam', 'player', '${FLAGG_NCAAM}', 'Cooper Flagg'); await switchTo('NBA'); return { stored: await stored(), errors: await errors() }`
  ),
  ...screens('light'),
  ...screens('dark'),
  run(`await toTheme('light'); return 'light'`),
  timing('favourites', 15),
  run(`return { errors: await errors() }`)
]

// The box score again, its favourite row against another player's (a divider has one cell).
const box = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await switchTo('NBA'); await nav('Games'); await setSelect('Season', 2027); const games = await window.api.stats.games('nba', 2027); const g = games.filter((x) => x.played && [x.home.id, x.away.id].includes('${OKC}')).at(-1); await setSelect('Day', g.date); await sleep(2000); const list = document.querySelector('[aria-label="The day’s games"]'); [...list.querySelectorAll('button')].find((c) => c.textContent.includes('OKC')).click(); await sleep(4000); return { game: g.away.code + ' @ ' + g.home.code, box: miniTable('OKC box score') }`
  ),
  shot('okc-box-score'),
  run(`return { errors: await errors() }`)
]
writeFileSync(join(out, 't1601b-box-steps.json'), JSON.stringify(box, null, 2) + '\n')

// The same timing on a build without favourites (origin/main before T1601.2's marks), or with none.
const timingOnly = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(`await switchTo('NBA'); return 'NBA'`),
  timing('compare', 15),
  run(`return { errors: await errors() }`)
]

writeFileSync(join(out, 't1601b-colour-steps.json'), JSON.stringify(colour, null, 2) + '\n')
writeFileSync(join(out, 't1601b-timing-steps.json'), JSON.stringify(timingOnly, null, 2) + '\n')
console.log('written')
