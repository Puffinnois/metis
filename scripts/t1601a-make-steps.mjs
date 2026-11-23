// Writes the T1601.1 drive steps (the favourites store and the star):
// node scripts/t1601a-make-steps.mjs scripts
// Two files, run one after the other on the same profile (NBA and NCAA Men, links built): the stars
// given, then a relaunch that finds them kept.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]

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
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) return 'NO ' + title; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.rail = () => document.querySelector('aside[aria-label=Players]');
window.railRow = (name) => [...(rail()?.querySelectorAll('button') ?? [])].find((b) => b.querySelector('span span')?.textContent.trim() === name);
window.input = () => document.querySelector('input[aria-label="Search players"]');
window.typeIn = (text) => { const i = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, text); i.dispatchEvent(new Event('input', { bubbles: true })) };
window.searchRail = async (name) => { for (const text of [name, name.split(' ').slice(-1)[0]]) { typeIn(text); if (await until(() => railRow(name), 10000)) return true } return false };
window.careerTable = () => document.querySelector('[role=table][aria-label="Career by season"]');
window.openPlayer = async (leagueName, season, name) => { await switchTo(leagueName); await nav('Players'); await setSelect('Season', season); await setSelect('Rank by', 'pts'); await setSelect('Team', ''); if (!(await searchRail(name))) return 'NOT IN RAIL ' + name; railRow(name).click(); const last = name.split(' ').slice(-1)[0]; await until(() => (heading() ?? '').includes(last), 20000); typeIn(''); await until(() => careerTable(), 20000); await sleep(800); return { league: league(), heading: heading() } };
window.headerStar = () => document.querySelector('main header button[aria-pressed]');
window.starState = (b) => b ? { label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), opacity: getComputedStyle(b).opacity, colour: getComputedStyle(b).color, fill: b.querySelector('svg')?.getAttribute('fill') } : 'NO STAR';
window.stored = async () => { const all = await window.api.favourites.all(); return Object.fromEntries(Object.entries(all).map(([l, fs]) => [l, fs.map((f) => f.kind + ':' + f.id + ':' + f.name + (f.from ? ' from ' + f.from : ''))])) };
window.clickHeaderStar = async () => { const b = headerStar(); if (!b) return 'NO STAR'; const before = starState(b); b.click(); await sleep(1500); return { before, after: starState(headerStar()), stored: await stored() } };
window.board = async (title) => { await nav('Leaderboards'); await sleep(1500); const all = [...document.querySelectorAll('button[title="Open the full board"]')]; const i = title === 'last' ? all.length - 1 : 0; if (!all[i]) return 'NO BOARD'; all[i].click(); await until(() => document.querySelectorAll('tbody tr').length > 5, 20000); await sleep(1000); return document.querySelectorAll('tbody tr').length + ' rows' };
window.rows = () => [...document.querySelectorAll('tbody tr')];
window.rowOf = (name) => rows().find((tr) => tr.querySelector('button[aria-pressed]')?.getAttribute('aria-label')?.includes(name));
window.tableState = () => { const rs = rows(); const heights = [...new Set(rs.map((r) => Math.round(r.getBoundingClientRect().height)))]; const on = rs.filter((r) => r.querySelector('button[aria-pressed=true]')).map((r) => r.querySelector('button[aria-pressed]').getAttribute('aria-label')); const firstOff = rs.find((r) => r.querySelector('button[aria-pressed=false]')); return { rows: rs.length, heights, on, offStar: starState(firstOff?.querySelector('button[aria-pressed]')), nameLeft: [...new Set(rs.slice(0, 20).map((r) => Math.round(r.querySelector('td div div button, td div div span')?.getBoundingClientRect().left ?? -1)))] } };
window.errors = async () => (await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200));
window.themeNow = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
window.toTheme = async (want) => { if (themeNow() !== want) document.querySelector('button[aria-label="Switch theme"]').click(); await sleep(800); return themeNow() };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)

const SGA = 'Shai Gilgeous-Alexander'

const star = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await toTheme('light'); return { errors: await errors(), stored: await stored(), theme: themeNow() }`
  ),
  // A player starred from their page.
  run(`return openPlayer('NBA', 2027, ${JSON.stringify(SGA)})`),
  run(`return clickHeaderStar()`),
  shot('1-player-page-starred'),
  // The rail's row filled, the others hidden until hovered, every row 40 px.
  run(
    `await searchRail('Gilgeous'); await sleep(800); const row = railRow(${JSON.stringify(SGA)}); const star = row?.parentElement.querySelector('button[aria-pressed]'); return { star: starState(star), rowHeight: Math.round(row.getBoundingClientRect().height) }`
  ),
  shot('2-rail-search-starred'),
  run(
    `typeIn(''); await sleep(1500); const rs = [...rail().querySelectorAll('[class*="group/fav"]')]; return { rows: rs.length, heights: [...new Set(rs.map((r) => Math.round(r.getBoundingClientRect().height)))], on: rs.filter((r) => r.querySelector('button[aria-pressed=true]')).map((r) => r.querySelector('button[aria-pressed]').getAttribute('aria-label')), firstOff: starState(rs.find((r) => r.querySelector('button[aria-pressed=false]'))?.querySelector('button[aria-pressed]')) }`
  ),
  // The full points leaderboard: the row filled, the others' stars hidden, no row taller than 30 px.
  run(`return board('first')`),
  run(`return tableState()`),
  { hover: 'tbody tr:nth-child(2) td' },
  { wait: 400 },
  run(`return starState(rows()[1].querySelector('button[aria-pressed]'))`),
  shot('3-leaderboard-starred-and-hover'),
  // A click on another row's star stars them and opens nothing: the row is not selected.
  run(
    `const tr = rows()[1]; const b = tr.querySelector('button[aria-pressed]'); const name = b.getAttribute('aria-label'); const sel = tr.getAttribute('aria-selected'); b.click(); await sleep(1500); const after = { star: starState(rows()[1].querySelector('button[aria-pressed]')), selected: rows()[1].getAttribute('aria-selected'), selectedBefore: sel, rowsStill: rows().length, h1: heading() }; rows()[1].querySelector('button[aria-pressed]').click(); await sleep(1500); return { name, after, undone: starState(rows()[1].querySelector('button[aria-pressed]')), stored: await stored() }`
  ),
  // A team, from its page, then on the teams' board.
  run(
    `await nav('Teams'); await sleep(3000); return { h1: heading(), star: starState(headerStar()) }`
  ),
  run(`return clickHeaderStar()`),
  shot('4-team-page-starred'),
  run(`return board('last')`),
  run(`return tableState()`),
  shot('5-teams-board-starred'),
  // Dark: the same stars.
  run(`return toTheme('dark')`),
  run(`return tableState()`),
  shot('6-teams-board-dark'),
  run(`return openPlayer('NBA', 2027, ${JSON.stringify(SGA)})`),
  run(`return starState(headerStar())`),
  shot('7-player-page-dark'),
  run(`await searchRail('Gilgeous'); await sleep(800); return 'searched'`),
  shot('8-rail-dark'),
  run(`typeIn(''); return toTheme('light')`),
  // A linked player starred in NCAA Men is starred in the NBA, and unstarred from there.
  run(`return openPlayer('NCAA Men', 2025, 'Cooper Flagg')`),
  run(`return clickHeaderStar()`),
  shot('9-flagg-ncaam-starred'),
  run(`return openPlayer('NBA', 2027, 'Cooper Flagg')`),
  run(`return { star: starState(headerStar()), stored: await stored() }`),
  shot('10-flagg-nba-followed'),
  run(`return clickHeaderStar()`),
  run(`return openPlayer('NCAA Men', 2025, 'Cooper Flagg')`),
  run(`return { star: starState(headerStar()), stored: await stored() }`),
  shot('11-flagg-ncaam-after-unstar'),
  // Starred again from the college side, for the relaunch to find in both leagues.
  run(`return clickHeaderStar()`),
  run(`await switchTo('NBA'); return { errors: await errors(), stored: await stored() }`)
]

const relaunch = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(`return { theme: themeNow(), stored: await stored() }`),
  run(`return openPlayer('NBA', 2027, ${JSON.stringify(SGA)})`),
  run(`return starState(headerStar())`),
  shot('12-relaunch-player-page'),
  run(`return board('first')`),
  run(`return tableState()`),
  shot('13-relaunch-leaderboard'),
  run(`return openPlayer('NBA', 2027, 'Cooper Flagg')`),
  run(`return starState(headerStar())`),
  run(`return openPlayer('NCAA Men', 2025, 'Cooper Flagg')`),
  run(`return starState(headerStar())`),
  // Unstarred from the NBA side again, so the profile ends with the college star gone too.
  run(`await openPlayer('NBA', 2027, 'Cooper Flagg'); return clickHeaderStar()`),
  run(
    `await nav('Teams'); await sleep(3000); return { h1: heading(), star: starState(headerStar()) }`
  ),
  run(`return { errors: await errors() }`)
]

writeFileSync(join(out, 't1601a-star-steps.json'), JSON.stringify(star, null, 2) + '\n')
writeFileSync(join(out, 't1601a-relaunch-steps.json'), JSON.stringify(relaunch, null, 2) + '\n')
console.log('written')
