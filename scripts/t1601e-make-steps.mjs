// Writes the T1601.4 drive steps (the Favourites page):
// node scripts/t1601e-make-steps.mjs scripts
// `t1601e-page-steps.json` on the T1601 profile (NBA and NCAA Men; favourites in both, a team in each,
// Cooper Flagg followed into the NBA): the opening day, each row's state, the stepper, a click into the
// other league's section and Back, both themes. `t1601e-nofile-steps.json` on a profile without NCAA
// Men's file; `t1601e-empty-steps.json` on one with no favourites.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]

const HELPERS = `
window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.until = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(20) } return false };
window.nav = async (name) => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === name); if (!b) return 'NO NAV ' + name; b.click(); await sleep(800); return 'nav ' + name };
window.trigger = () => document.querySelector('button[aria-label^="League: "]');
window.league = () => trigger()?.getAttribute('aria-label')?.replace('League: ', '') ?? null;
window.items = () => [...document.querySelectorAll('[role=menuitemradio]')];
window.openMenu = async () => { const t = trigger(); if (!t) return false; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return until(() => items().length > 0, 5000) };
window.pick = async (name) => { if (league() === name) return name; if (!(await openMenu())) return 'NO MENU'; const item = items().find((x) => x.textContent.startsWith(name)); if (!item) return 'NO ITEM ' + name; item.click(); await until(() => league() === name, 5000); await sleep(2500); return league() };
window.settled = () => document.querySelectorAll('section[data-league]').length > 0 && !document.querySelector('[data-loading]');
window.openPage = async () => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === 'Favourites'); const t0 = performance.now(); b.click(); await until(() => document.querySelector('[data-day]') && settled(), 30000); const ms = Math.round(performance.now() - t0); await sleep(500); return ms };
window.day = () => document.querySelector('[data-day]')?.dataset.day ?? null;
window.rows = () => [...document.querySelectorAll('section[data-league] [role=row][data-state]')].map((r) => ({ league: r.closest('section').dataset.league, state: r.dataset.state, text: r.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160) }));
window.page = () => ({ day: day(), sections: [...document.querySelectorAll('section[data-league]')].map((s) => ({ league: s.dataset.league, ms: s.dataset.ms, through: s.querySelector('[data-through]')?.textContent ?? null, foot: s.querySelector('[data-absent]')?.textContent ?? null, notDownloaded: s.innerText.includes('Not downloaded') })), rows: rows() });
window.step = async (by) => { const b = document.querySelector(by < 0 ? 'button[title^="The day before"]' : 'button[title^="The day after"]'); if (!b || b.disabled) return null; b.click(); await sleep(400); await until(settled, 20000); await sleep(300); return day() };
window.cellTitles = (name) => { const r = [...document.querySelectorAll('[role=row][data-state=played]')].find((x) => x.innerText.includes(name)); return r ? [...r.querySelectorAll('[role=cell]')].map((c) => ({ text: c.textContent.trim(), heat: c.dataset.heat ?? null, title: c.title })) : null };
window.errors = async () => (await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200));
window.themeNow = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
window.toTheme = async (want) => { if (themeNow() !== want) document.querySelector('button[aria-label="Switch theme"]').click(); await sleep(800); return themeNow() };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)

const pageSteps = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  // Luka Dončić, who missed two of the Lakers' games: a favourite with a day of "Did not play". The
  // switch away and back reads the favourites again.
  run(
    `await window.api.favourites.add('nba', 'player', '1629029', 'Luka Dončić'); await pick('NCAA Men'); await pick('NBA'); return 'starred'`
  ),
  run(
    `await toTheme('light'); return { league: await pick('NBA'), favourites: Object.fromEntries(Object.entries(await window.api.favourites.all()).map(([l, f]) => [l, f.map((x) => x.kind + ':' + x.name + (x.from ? ' (from ' + x.from + ')' : ''))])) }`
  ),
  // The opening day and the first paint with both leagues.
  run(`const paint = await openPage(); return { paint, ...page() }`),
  shot('01-opening-day'),
  // Back day by day with a favourite's game until Shai Gilgeous-Alexander played: the days visited
  // show the empty ones skipped.
  run(
    `const seen = [day()]; for (let i = 0; i < 12; i++) { if (rows().some((r) => r.state === 'played' && r.text.includes('Gilgeous'))) break; const d = await step(-1); if (!d) break; seen.push(d) } window.__sgaDay = day(); return { visited: seen, ...page() }`
  ),
  shot('02-sga-played'),
  run(`return { sga: cellTitles('Gilgeous'), team: cellTitles('Lakers') ?? cellTitles('Duke') }`),
  // A day with a "Did not play" and a "No game" on screen, stepping back further if needed.
  run(
    `for (let i = 0; i < 20; i++) { const r = rows(); if (r.some((x) => x.state === 'dnp') && r.some((x) => x.state === 'nogame') && r.some((x) => x.state === 'played')) break; if (!(await step(-1))) break } return page()`
  ),
  shot('03-each-state'),
  // The day picker: any day, as Games does.
  run(
    `const sel = [...document.querySelectorAll('select')].find((x) => x.title === 'Day'); const opts = [...sel.options].map((o) => o.value); const skipped = []; for (let d = new Date(opts[0] + 'T00:00:00Z'); d <= new Date(opts.at(-1) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) { const iso = d.toISOString().slice(0, 10); if (!opts.includes(iso)) skipped.push(iso) } const from = window.__sgaDay; return { days: opts.length, first: opts[0], last: opts.at(-1), skipped }`
  ),
  // Into the other league's section: the Duke Blue Devils' page in NCAA Men, then Back.
  run(
    `await sleep(500); const before = { league: league(), day: day() }; const b = [...document.querySelectorAll('section[data-league=ncaam] button')].find((x) => x.textContent.trim() === 'Duke Blue Devils'); if (!b) return 'NO DUKE'; b.click(); await until(() => league() === 'NCAA Men' && (document.querySelector('main h1')?.textContent ?? '').length > 0, 15000); await sleep(1500); const there = { league: league(), h1: document.querySelector('main h1')?.textContent }; document.querySelector('nav button[aria-label=Back]').click(); await until(() => league() === 'NBA' && settled(), 20000); await sleep(1500); return { before, there, back: { league: league(), day: day(), screen: document.querySelector('main h1')?.textContent } }`
  ),
  shot('04-back-from-ncaam'),
  // Dark.
  run(`await toTheme('dark'); await sleep(500); return page().day`),
  shot('05-dark'),
  run(`await toTheme('light'); return { errors: await errors() }`)
]

const nofile = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(`await pick('NBA'); const paint = await openPage(); return { paint, ...page() }`),
  shot('06-ncaam-not-downloaded'),
  run(
    `const b = [...document.querySelectorAll('section[data-league=ncaam] button')].find((x) => x.textContent.includes('Data panel')); b.click(); await sleep(2000); return { h1: document.querySelector('main h1')?.textContent ?? document.querySelector('main')?.innerText.slice(0, 80) }`
  ),
  run(`return { errors: await errors() }`)
]

const empty = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await nav('Favourites'); await sleep(2500); return { empty: document.querySelector('[data-empty]')?.textContent ?? null, opensOn: 'Leaderboards' }`
  ),
  shot('07-no-favourites'),
  run(`return { errors: await errors() }`)
]

// The page re-shot after review: the opening day and a day stepped back, in both themes, with the
// line under the title, the MIN cells (plain) and the row of a game not loaded yet.
const facts = run(
  `const sub = document.querySelector('[data-day]')?.textContent.trim(); const minCells = [...document.querySelectorAll('[role=row][data-state=played]')].map((r) => r.querySelectorAll('[role=cell]')[0]).filter(Boolean).map((c) => ({ text: c.textContent.trim(), heat: c.dataset.heat, title: c.title })); const pending = [...document.querySelectorAll('[role=row][data-state=pending] [role=cell]')].map((c) => ({ text: c.textContent.trim(), title: c.title })); return { day: day(), sub, minCells, pending }`
)
const shots = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(`await toTheme('light'); await pick('NBA'); return openPage()`),
  facts,
  shot('11-opening-light'),
  run(`return toTheme('dark')`),
  shot('12-opening-dark'),
  run(
    `const sel = [...document.querySelectorAll('select')].find((x) => x.title === 'Day'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, '2026-11-08'); sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return day()`
  ),
  facts,
  shot('13-stepped-back-dark'),
  run(`return toTheme('light')`),
  shot('14-stepped-back-light'),
  run(`return { errors: await errors() }`)
]

writeFileSync(join(out, 't1601e-shots-steps.json'), JSON.stringify(shots, null, 2) + '\n')
writeFileSync(join(out, 't1601e-page-steps.json'), JSON.stringify(pageSteps, null, 2) + '\n')
writeFileSync(join(out, 't1601e-nofile-steps.json'), JSON.stringify(nofile, null, 2) + '\n')
writeFileSync(join(out, 't1601e-empty-steps.json'), JSON.stringify(empty, null, 2) + '\n')
console.log('written')
