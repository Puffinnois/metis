// Writes the T1304.4 drive steps (the same player across the league switch, and search):
// node scripts/t1304d-make-steps.mjs scripts
// Three files: the four-league profile, the professional leagues alone, and the search's timing.
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
window.closeMenu = async () => { document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await until(() => items().length === 0, 3000); await sleep(200) };
window.menu = async () => { await openMenu(); const r = items().map((x) => ({ text: x.textContent, title: x.title || null, h: Math.round(x.getBoundingClientRect().height) })); await closeMenu(); return r };
window.pick = async (name) => { const was = league(); if (!(await openMenu())) return 'NO MENU'; const item = items().find((x) => x.textContent.startsWith(name)); if (!item) return 'NO ITEM ' + name; const text = item.textContent; item.click(); await until(() => league() === name, 5000); await until(() => heading() !== null || document.querySelector('main')?.textContent.length > 0, 8000); await sleep(2500); return { from: was, item: text, ...state() } };
window.switchTo = async (name) => { if (league() === name) return name; const r = await pick(name); return typeof r === 'string' ? r : league() };
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) return 'NO ' + title; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.rail = () => document.querySelector('aside[aria-label=Players]');
window.ownRows = () => [...(rail()?.querySelectorAll(':scope > div > button') ?? [])].filter((b) => b.querySelector('span span'));
window.railRow = (name) => ownRows().find((b) => b.querySelector('span span')?.textContent.trim() === name);
window.input = () => document.querySelector('input[aria-label="Search players"]');
window.typeIn = (text) => { const i = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, text); i.dispatchEvent(new Event('input', { bubbles: true })) };
window.searchRail = async (name) => { for (const text of [name, name.split(' ').slice(-1)[0]]) { typeIn(text); if (await until(() => railRow(name), 10000)) return true } return false };
window.group = () => rail()?.querySelector('[role=group]') ?? null;
window.found = () => ({ count: rail()?.querySelector(':scope > div:nth-child(2) span')?.textContent ?? null, own: ownRows().map((b) => b.querySelector('span span')?.textContent.trim()), heading: group()?.getAttribute('aria-label') ?? null, others: [...(group()?.querySelectorAll('button') ?? [])].map((b) => ({ text: b.textContent, title: b.title })), empty: [...(rail()?.querySelectorAll('div') ?? [])].find((d) => d.textContent === 'No player by that name.') ? 'No player by that name.' : null });
window.careerTable = () => document.querySelector('[role=table][aria-label="Career by season"]');
window.stripEl = () => document.querySelector('section[aria-label="College and pro career"]');
window.heading = () => document.querySelector('main h1')?.textContent ?? null;
window.backBtn = () => document.querySelector('nav button[aria-label=Back]');
window.state = () => ({ league: league(), heading: heading(), season: document.querySelector('select[title=Season]')?.value ?? null, type: document.querySelector('select[title="Season type"]')?.value ?? null, tab: document.querySelector('[role=tab][aria-selected=true]')?.textContent ?? null, canGoBack: backBtn() ? !backBtn().disabled : null, strip: stripEl() ? 'strip' : null, main: heading() ? null : document.querySelector('main')?.textContent.slice(0, 120) });
window.goBack = async () => { const b = backBtn(); if (!b || b.disabled) return 'NO BACK'; b.click(); await sleep(3000); await until(() => careerTable() || !heading(), 15000); await sleep(500); return state() };
window.openPlayer = async (leagueName, season, name, rank = 'pts') => { const w = await switchTo(leagueName); await nav('Players'); await setSelect('Season', season); await setSelect('Rank by', rank); await setSelect('Team', ''); if (!(await searchRail(name))) return { w, error: 'NOT IN RAIL ' + name }; railRow(name).click(); const last = name.split(' ').slice(-1)[0]; await until(() => (heading() ?? '').includes(last), 20000); typeIn(''); await until(() => (heading() ?? '').includes(last) && careerTable(), 20000); return state() };
window.linkIn = async () => { await until(() => stripEl(), 6000); await sleep(400); return state() };
window.theme = (dark) => { document.documentElement.classList.toggle('dark', dark); return dark ? 'dark' : 'light' };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)
const pause = (leagues) =>
  run(
    `for (const l of ${JSON.stringify(leagues)}) await window.api.stats.pause(l); await sleep(2000); return 'paused'`
  )
const open = (l, season, name) =>
  run(`return openPlayer(${JSON.stringify(l)}, ${season}, ${JSON.stringify(name)})`)
const search = (text) => run(`typeIn(${JSON.stringify(text)}); await sleep(1500); return found()`)
const clear = run(`typeIn(''); await sleep(800); return 'cleared'`)
const menuShot = (name) => [ev('openMenu()'), { wait: 600 }, shot(name), ev('closeMenu()')]

// A linked player both ways: the menu reads their name on the paired item only once the link is in,
// the switch opens their page there on the Overview in their last season, Back returns, and choosing
// the league again repeats the move (the app has no Forward: Back only, Alt+← and the mouse button).
const both = (proLeague, proSeason, collegeLeague, collegeSeason, name, before, tag) => [
  // Another player first, so the second Back shows the switch left one entry, not two.
  open(proLeague, proSeason, before),
  // The link is not read until the page's own reads are done: a menu opened at once switches as before.
  run(
    `await nav('Players'); if (!(await searchRail(${JSON.stringify(name)}))) return 'NOT IN RAIL'; railRow(${JSON.stringify(name)}).click(); await until(() => (heading() ?? '').includes(${JSON.stringify(name.split(' ').at(-1))}), 20000); const early = await menu(); typeIn(''); await until(() => careerTable(), 20000); return { early, state: state() }`
  ),
  run('const s = await linkIn(); return { state: s, menu: await menu() }'),
  ...menuShot(`${tag}-01-${proLeague}-menu`),
  run(`return pick(${JSON.stringify(collegeLeague)})`),
  shot(`${tag}-02-${collegeLeague}-after-switch`),
  run('return goBack()'),
  shot(`${tag}-03-back-${proLeague}`),
  run('const s = await goBack(); return { secondBack: s }'),
  // The move again, as Forward would.
  open(proLeague, proSeason, name),
  run('await linkIn(); return pick(' + JSON.stringify(collegeLeague) + ')'),
  // From the college page to the professional one.
  run('const s = await linkIn(); return { state: s, menu: await menu() }'),
  ...menuShot(`${tag}-04-${collegeLeague}-menu`),
  run(`return pick(${JSON.stringify(proLeague)})`),
  shot(`${tag}-05-${proLeague}-after-switch`),
  run('return goBack()'),
  run(`return { collegeSeasonAsked: ${collegeSeason} }`)
]

const all = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  pause(['nba', 'wnba', 'ncaam', 'ncaaw']),
  ...both('NBA', 2027, 'NCAA Men', 2025, 'Cooper Flagg', 'LeBron James', 'a'),
  ...both('WNBA', 2026, 'NCAA Women', 2025, 'Paige Bueckers', "A'ja Wilson", 'b'),
  // A player with no link: the menu as it was, and the switch as before (the league's own player).
  open('NBA', 2027, 'LeBron James'),
  run('await sleep(2500); return { state: state(), menu: await menu() }'),
  run(`return pick('NCAA Men')`),
  shot('c-01-lebron-to-ncaam'),
  run('return goBack()'),
  // A league outside the pair, from Flagg's page: as before.
  open('NBA', 2027, 'Cooper Flagg'),
  run(`await linkIn(); return pick('WNBA')`),
  shot('c-02-flagg-to-wnba'),
  run('return goBack()'),
  // Search in each league. The NBA: Flagg once, his own row; Richie Saunders, drafted with no NBA
  // game, as the NCAA Men's.
  run(`await nav('Players'); return state()`),
  search('Flagg'),
  search('Saunders'),
  shot('d-01-nba-search-saunders'),
  ev('theme(true)'),
  { wait: 400 },
  shot('d-02-nba-search-saunders-dark'),
  ev('theme(false)'),
  run(
    `const b = group()?.querySelector('button'); if (!b) return 'NO ROW'; b.click(); await until(() => league() === 'NCAA Men' && careerTable(), 15000); await sleep(1500); return state()`
  ),
  shot('d-03-ncaam-saunders'),
  run('return goBack()'),
  clear,
  // The WNBA: Abbey Hsu, drafted in 2024 with no WNBA game.
  run(`await switchTo('WNBA'); await nav('Players'); return state()`),
  search('Bueckers'),
  search('Hsu'),
  shot('d-04-wnba-search-hsu'),
  run(
    `const b = group()?.querySelector('button'); if (!b) return 'NO ROW'; b.click(); await until(() => league() === 'NCAA Women' && careerTable(), 15000); await sleep(1500); return state()`
  ),
  shot('d-05-ncaaw-hsu'),
  run('return goBack()'),
  clear,
  // The college leagues: their own rows, never anyone of the professional league.
  run(
    `await switchTo('NCAA Men'); await nav('Players'); await setSelect('Season', 2025); return state()`
  ),
  search('Flagg'),
  search('Saunders'),
  shot('d-06-ncaam-search'),
  clear,
  run(
    `await switchTo('NCAA Women'); await nav('Players'); await setSelect('Season', 2025); return state()`
  ),
  search('Bueckers'),
  search('Hsu'),
  shot('d-07-ncaaw-search'),
  clear,
  run(`await switchTo('NBA'); return state()`)
]

// Waits for the links file the launch's refresh builds: the read of a known link answers.
const linked = (l, id) =>
  run(
    `const t0 = Date.now(); let r = null; while (Date.now() - t0 < 900000) { r = await window.api.stats.otherCareer(${JSON.stringify(l)}, ${JSON.stringify(id)}).catch((e) => ({ error: String(e) })); if (r?.link) break; await sleep(5000) } return { s: Math.round((Date.now() - t0) / 1000), link: r?.link ?? null, source: r?.source ?? null, error: r?.error ?? null }`
  )

// Only the professional leagues downloaded: the switch as before, and the search's rows to the Data panel.
const pro = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  // A pause is kept in each league's file: a profile left paused never refreshes, so never links.
  run(`for (const l of ['nba', 'wnba']) await window.api.stats.resume(l); return 'resumed'`),
  linked('nba', '1642843'),
  linked('wnba', '1642784'),
  pause(['nba', 'wnba']),
  open('NBA', 2027, 'Cooper Flagg'),
  run('const s = await linkIn(); return { state: s, menu: await menu() }'),
  ...menuShot('p-01-nba-flagg-menu'),
  run(`return pick('NCAA Men')`),
  shot('p-02-ncaam-off'),
  run('return goBack()'),
  open('WNBA', 2026, 'Paige Bueckers'),
  run('const s = await linkIn(); return { state: s, menu: await menu() }'),
  run(`return pick('NCAA Women')`),
  run('return goBack()'),
  run(`await switchTo('NBA'); await nav('Players'); return state()`),
  search('Flagg'),
  search('Saunders'),
  shot('p-03-nba-search-saunders'),
  run(
    `const b = group()?.querySelector('button'); if (!b) return 'NO ROW'; b.click(); await until(() => document.querySelector('section[aria-label="NCAA Men"]'), 15000); await sleep(1500); return { focused: document.activeElement?.textContent ?? null, data: !!document.querySelector('section[aria-label="NCAA Men"]'), league: league() }`
  ),
  shot('p-04-data-ncaam'),
  run(`await switchTo('WNBA'); await nav('Players'); return state()`),
  search('Hsu'),
  shot('p-05-wnba-search-hsu'),
  clear,
  // The college leagues hold nothing here: no rail, no search.
  run(`await switchTo('NCAA Men'); await nav('Players'); return state()`),
  run(`await switchTo('NCAA Women'); await nav('Players'); return state()`),
  run(`await switchTo('NBA'); return state()`)
]

// The search's response, the same steps on this branch and on main: from setting the text to the
// rail showing its rows, polled every 10 ms, 25 times each over three searches. On this branch, also
// when the paired league's rows are in.
const TIMED = [
  ['NBA', 2027, 'tatum'],
  ['NBA', 2027, 'saunders'],
  ['WNBA', 2026, 'hsu']
]
const timing = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  pause(['nba', 'wnba', 'ncaam', 'ncaaw']),
  run(
    `const want = ${JSON.stringify(TIMED)}; const out = []; for (const [l, s, text] of want) { await switchTo(l); await nav('Players'); await setSelect('Season', s); typeIn(''); await until(() => ownRows().length > 20, 15000); await sleep(1500); const before = found().count; for (let round = 0; round < 25; round++) { typeIn(''); await until(() => found().count === before, 5000); await sleep(300); const t0 = performance.now(); typeIn(text); await until(() => found().count !== before, 5000); const rail = performance.now() - t0; await until(() => group(), round === 0 ? 3000 : 300); const others = group() ? performance.now() - t0 : null; out.push([l, text, round, Math.round(rail * 10) / 10, others === null ? null : Math.round(others * 10) / 10, found().own.length, found().others.length]); await sleep(200) } typeIn(''); await sleep(500) } return out`
  )
]

writeFileSync(join(out, 't1304d-switch-steps.json'), JSON.stringify(all, null, 2) + '\n')
writeFileSync(join(out, 't1304d-pro-steps.json'), JSON.stringify(pro, null, 2) + '\n')
writeFileSync(join(out, 't1304d-timing-steps.json'), JSON.stringify(timing, null, 2) + '\n')
console.log('written', all.length, pro.length, timing.length, 'steps')
