// Writes the T1304.5 drive steps (every state of the player link on four leagues, and the search):
// node scripts/t1304e-make-steps.mjs scripts
// Four files:
// - t1304e-search-steps.json: the four-league profile (paused): the search reaching every player in
//   each league, the keys reaching every row, the draft row.
// - t1304e-timing-steps.json: the search's response, the same steps on this branch and on main.
// - t1304e-nba-steps.json: a clean profile holding the NBA alone, then NCAA Men turned on (nothing
//   loaded, then loading), turned off and deleted, then a copied NCAA Men file arriving while Cooper
//   Flagg's page is open, both, and NCAA Men removed. It prints READY_FOR_COPY when the copy is due:
//   the runner copies the file into the profile then, and the next step waits for it.
// - t1304e-wnba-steps.json: a clean profile holding the WNBA alone, then NCAA Women downloaded from
//   nothing while Paige Bueckers's page is open, both, and the WNBA removed.
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
window.groupNamed = (label) => [...(rail()?.querySelectorAll('[role=group]') ?? [])].find((g) => g.getAttribute('aria-label') === label) ?? null;
window.moreGroup = () => groupNamed('Not ranked here');
window.otherGroup = () => [...(rail()?.querySelectorAll('[role=group]') ?? [])].find((g) => g.getAttribute('aria-label') !== 'Not ranked here') ?? null;
window.count = () => rail()?.querySelector(':scope > div:nth-child(2) span')?.textContent ?? null;
window.found = () => ({ count: count(), own: ownRows().map((b) => b.querySelector('span span')?.textContent.trim()), more: [...(moreGroup()?.querySelectorAll('button') ?? [])].map((b) => b.title + (b.getAttribute('aria-current') ? ' [current]' : '')), moreNote: moreGroup()?.querySelector(':scope > div:last-child:not(:first-child)')?.textContent ?? null, otherHeading: otherGroup()?.getAttribute('aria-label') ?? null, others: [...(otherGroup()?.querySelectorAll('button') ?? [])].map((b) => b.textContent + ' | ' + b.title), empty: [...(rail()?.querySelectorAll('div') ?? [])].some((d) => d.textContent === 'No player by that name.') });
window.resting = () => rail()?.querySelector('[data-cursor=true]')?.getAttribute('aria-label') ?? null;
window.press = (key, target) => { (target ?? rail()).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) };
window.careerTable = () => document.querySelector('[role=table][aria-label="Career by season"]');
window.stripEl = () => document.querySelector('section[aria-label="College and pro career"]');
window.heading = () => document.querySelector('main h1')?.textContent ?? null;
window.backBtn = () => document.querySelector('nav button[aria-label=Back]');
window.hint = () => [...document.querySelectorAll('main header button')].find((b) => b.textContent.endsWith('↓'))?.textContent ?? null;
window.stripSig = () => { const s = stripEl(); if (!s) return null; return { rows: [...s.querySelectorAll('[role=row]')].slice(1).map((r) => (r.tagName === 'BUTTON' ? '→ ' : '') + (r.getAttribute('title') ?? '')), tail: [...s.children].slice(2).map((c) => c.innerText).join(' | ') } };
window.state = () => ({ league: league(), heading: heading(), season: document.querySelector('select[title=Season]')?.value ?? null, type: document.querySelector('select[title="Season type"]')?.value ?? null, tab: document.querySelector('[role=tab][aria-selected=true]')?.textContent ?? null, canGoBack: backBtn() ? !backBtn().disabled : null, hint: hint(), strip: stripSig(), main: heading() ? null : document.querySelector('main')?.textContent.slice(0, 160) });
window.goBack = async () => { const b = backBtn(); if (!b || b.disabled) return 'NO BACK'; b.click(); await sleep(3000); await until(() => careerTable() || !heading(), 15000); await sleep(500); return state() };
window.searchRail = async (name) => { for (const text of [name, name.split(' ').slice(-1)[0]]) { typeIn(text); if (await until(() => railRow(name), 10000)) return true } return false };
window.openPlayer = async (leagueName, season, name, rank = 'pts') => { const w = await switchTo(leagueName); await nav('Players'); await setSelect('Season', season); await setSelect('Rank by', rank); await setSelect('Team', ''); if (!(await searchRail(name))) return { w, error: 'NOT IN RAIL ' + name }; railRow(name).click(); const last = name.split(' ').slice(-1)[0]; await until(() => (heading() ?? '').includes(last), 20000); typeIn(''); await until(() => (heading() ?? '').includes(last) && careerTable(), 20000); return state() };
window.linkIn = async () => { await until(() => stripEl(), 8000); await sleep(400); return state() };
window.rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',') };
window.scroller = () => { for (let p = careerTable()?.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return p } return null };
window.boxes = () => ({ header: rect(document.querySelector('main header')), h1: rect(document.querySelector('main h1')), facts: rect(document.querySelector('main header .flex-wrap')), tabs: rect(document.querySelector('main [role=tablist]')), career: rect(careerTable()), strip: rect(stripEl()), stripTable: rect(stripEl()?.querySelector('[role=table]')), scrollTop: scroller()?.scrollTop ?? null });
window.dl = async (id) => { const d = await window.api.leagues.downloads(); const l = d.leagues.find((x) => x.league === id); const s = await window.api.stats.status(id).catch(() => null); return { on: l?.on ?? null, hasFile: l?.hasFile ?? null, mb: l ? Math.round(l.fileBytes / 1e6) : null, builtAt: s?.builtAt ?? null, busy: s?.busy ?? null, progress: s?.progress ?? null, paused: s?.paused ?? null } };
window.track = (other) => { window.samples = []; window.dlNow = null; let last = ''; const t0 = performance.now(); window.trackStart = new Date().toISOString(); clearInterval(window.trackTimer); clearInterval(window.dlTimer); window.trackTimer = setInterval(() => { const sig = JSON.stringify({ b: boxes(), hint: hint(), strip: stripSig(), heading: heading(), dl: window.dlNow && { on: dlNow.on, hasFile: dlNow.hasFile, built: dlNow.builtAt !== null, busy: dlNow.busy } }); if (sig !== last) { last = sig; samples.push({ t: Math.round(performance.now() - t0), at: new Date().toISOString(), ...JSON.parse(sig) }) } }, 50); window.dlTimer = setInterval(async () => { window.dlNow = await dl(other) }, 1000); return 'tracking ' + other };
window.untrack = () => { clearInterval(window.trackTimer); clearInterval(window.dlTimer); return 'stopped' };
window.boxMoves = () => { const keys = ['header', 'h1', 'facts', 'tabs', 'career', 'strip', 'stripTable', 'scrollTop']; const out = {}; for (const k of keys) { const seen = []; for (const s of samples) { const v = s.b?.[k] ?? null; if (!seen.length || seen[seen.length - 1].v !== v) seen.push({ t: s.t, v }) } out[k] = seen } return out };
window.changes = () => samples.map((s, i) => { const p = samples[i - 1]; const d = { t: s.t, at: s.at }; for (const k of ['hint', 'heading', 'dl']) if (!p || JSON.stringify(p[k]) !== JSON.stringify(s[k])) d[k] = s[k]; if (!p || JSON.stringify(p.strip) !== JSON.stringify(s.strip)) d.strip = s.strip; if (!p || JSON.stringify(p.b) !== JSON.stringify(s.b)) d.b = s.b; return d });
window.stripButton = (start) => [...(stripEl()?.querySelectorAll('button') ?? [])].find((b) => b.textContent.startsWith(start));
window.stripRow = (start) => [...(stripEl()?.querySelectorAll('[role=row]') ?? [])].find((r) => (r.getAttribute('title') ?? '').startsWith(start));
window.dataSection = (name) => document.querySelector('section[aria-label="' + name + '"]');
window.dataLine = (name) => dataSection(name)?.querySelector('p')?.textContent ?? null;
window.dataButton = (name, start) => [...(dataSection(name)?.querySelectorAll('button') ?? [])].find((b) => b.textContent.startsWith(start));
window.profileDraft = () => [...document.querySelectorAll('main section')].find((s) => s.querySelector('h2,h3')?.textContent === 'Draft')?.innerText ?? null;
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
const search = (text) =>
  run(
    `typeIn(${JSON.stringify(text)}); await sleep(1500); return { text: ${JSON.stringify(text)}, ...found() }`
  )
const clear = run(`typeIn(''); await sleep(800); return 'cleared'`)
const menuShot = (name) => [ev('openMenu()'), { wait: 600 }, shot(name), ev('closeMenu()')]

// A search's unranked row opened by a click: the page and season it lands on, then Back.
const openMore = (title, last) =>
  run(
    `const b = [...(moreGroup()?.querySelectorAll('button') ?? [])].find((x) => x.title.startsWith(${JSON.stringify(title)})); if (!b) return 'NO ROW ' + ${JSON.stringify(title)}; b.click(); await until(() => (heading() ?? '').includes(${JSON.stringify(last)}) && careerTable(), 20000); await sleep(800); return state()`
  )

// The keys from the search box: ↓ to the first ranked row, then J/↓ through the unranked and the
// other league's rows, K back, and where each step rests.
const keys = run(
  `const out = []; press('ArrowDown', input()); await sleep(1500); out.push({ key: 'ArrowDown in the box', heading: heading(), resting: resting() }); let last = null; for (let i = 0; i < 80; i++) { press(i % 2 ? 'ArrowDown' : 'j'); await sleep(120); const r = resting(); if (r !== last) out.push({ step: i + 1, resting: r, heading: heading() }); if (r && r === last) break; last = r } press('k'); await sleep(300); out.push({ key: 'k', resting: resting() }); return out`
)

// The draft row of the strip: a click opens the Profile tab of the professional league.
const draftClick = (tag, proName = 'never') => [
  run(
    `const r = [...(stripEl()?.querySelectorAll('[role=row]') ?? [])].find((x) => / draft \\d{4}/.test(x.getAttribute('title') ?? '')); if (!r) return 'NO DRAFT ROW'; const was = { tag: r.tagName, title: r.getAttribute('title') }; if (r.tagName !== 'BUTTON') return { plain: was }; r.click(); await until(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent === 'Profile' && profileDraft(), 15000); await sleep(800); return { row: was, after: state(), draft: profileDraft() }`
  ),
  shot(tag),
  // Back where the Profile is another league's page; on the page's own league the tab changed, which
  // is not a page for Back: the Overview tab again.
  run(
    `if (league() !== was) return goBack(); [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent === 'Overview')?.click(); await until(() => careerTable(), 15000); await sleep(800); return state()`.replace(
      'was',
      JSON.stringify(proName)
    )
  )
]

// ---------------------------------------------------------------------------------------------
// The four-league profile: the search reaching every player, the keys, the draft row.
const searchSteps = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  pause(['nba', 'wnba', 'ncaam', 'ncaaw']),
  // NCAA Men 2025-26: Flagg played 2024-25, so the ranked rows lack him; Quaintance by his full name.
  run(
    `await switchTo('NCAA Men'); await nav('Players'); await setSelect('Season', 2026); return state()`
  ),
  search('Flagg'),
  shot('s-01-ncaam-2026-flagg'),
  openMore('Open Cooper Flagg', 'Flagg'),
  shot('s-02-ncaam-flagg-2025'),
  run('return goBack()'),
  search('Jayden Quaintance'),
  shot('s-03-ncaam-quaintance'),
  search('Quaintance'),
  clear,
  // The NBA: Kobe Bryant, last in 2015-16; Richie Saunders, NCAA Men's, with no NBA game; the keys.
  run(`await switchTo('NBA'); await nav('Players'); return state()`),
  search('Kobe'),
  openMore('Open Kobe Bryant', 'Bryant'),
  shot('s-04-nba-kobe-2016'),
  run('return goBack()'),
  search('saunders'),
  shot('s-05-nba-saunders'),
  search('jones'),
  keys,
  shot('s-06-nba-keys-resting'),
  run(
    `press('Enter'); await until(() => league() === 'NCAA Men' && careerTable(), 20000); await sleep(1500); return state()`
  ),
  run('return goBack()'),
  clear,
  // The WNBA: Sue Bird, last in 2022; Abbey Hsu, NCAA Women's.
  run(`await switchTo('WNBA'); await nav('Players'); return state()`),
  search('Sue Bird'),
  search('hsu'),
  shot('s-07-wnba-hsu'),
  ev('theme(true)'),
  { wait: 400 },
  shot('s-08-wnba-hsu-dark'),
  ev('theme(false)'),
  clear,
  // NCAA Women 2025-26: Bueckers played 2024-25.
  run(
    `await switchTo('NCAA Women'); await nav('Players'); await setSelect('Season', 2026); return state()`
  ),
  search('Bueckers'),
  shot('s-09-ncaaw-2026-bueckers'),
  // A search with more matches than the rows listed.
  search('jo'),
  search('johnson'),
  shot('s-10-ncaaw-johnson'),
  clear,
  // The draft row: Flagg's NBA page opens his NBA Profile; his NCAA Men page opens it too.
  open('NBA', 2027, 'Cooper Flagg'),
  run('return linkIn()'),
  ...draftClick('s-11-nba-flagg-profile', 'NBA'),
  run(`await linkIn(); return pick('NCAA Men')`),
  run('return linkIn()'),
  ...draftClick('s-12-ncaam-flagg-to-nba-profile'),
  run(`await switchTo('NBA'); return state()`)
]

// ---------------------------------------------------------------------------------------------
// The search's response on this branch and on main: from setting the text to the rail's count
// changing (its ranked rows), polled every 10 ms, 50 times a search; on this branch also when the
// unranked rows are in.
const TIMED = [
  ['NBA', 2027, 'tatum'],
  ['WNBA', 2026, 'hsu'],
  ['NCAA Men', 2026, 'quaintance'],
  ['NCAA Women', 2026, 'bueckers']
]
const timing = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  pause(['nba', 'wnba', 'ncaam', 'ncaaw']),
  run(
    `const want = ${JSON.stringify(TIMED)}; const out = []; for (const [l, s, text] of want) { await switchTo(l); await nav('Players'); await setSelect('Season', s); typeIn(''); await until(() => ownRows().length > 20, 15000); await sleep(1500); const before = count(); for (let round = 0; round < 50; round++) { typeIn(''); await until(() => count() === before, 5000); await sleep(300); const t0 = performance.now(); typeIn(text); await until(() => count() !== before, 5000); const ranked = performance.now() - t0; await until(() => moreGroup(), round === 0 ? 5000 : 500); const more = moreGroup() ? performance.now() - t0 : null; const f = found(); out.push([l, text, round, Math.round(ranked * 10) / 10, more === null ? null : Math.round(more * 10) / 10, f.own.length, f.more.length]); await sleep(200) } typeIn(''); await sleep(500) } return out`
  )
]

// ---------------------------------------------------------------------------------------------
// The states a user meets, on a clean profile.

// Waits for the links file the launch's refresh builds: the read of a known link answers.
const linked = (l, id) =>
  run(
    `const t0 = Date.now(); let r = null; while (Date.now() - t0 < 2400000) { r = await window.api.stats.otherCareer(${JSON.stringify(l)}, ${JSON.stringify(id)}).catch((e) => ({ error: String(e) })); if (r?.link) break; await sleep(2000) } return { s: Math.round((Date.now() - t0) / 1000), link: r?.link ?? null, source: r?.source ?? null, error: r?.error ?? null, dl: await dl(${JSON.stringify(l)}) }`
  )
// Waits for a league's refresh to end (and its links step, which follows it).
const idle = (l, ms = 3600000) =>
  run(
    `const t0 = Date.now(); while (Date.now() - t0 < ${ms}) { const s = await window.api.stats.status(${JSON.stringify(l)}); if (!s.busy) break; await sleep(3000) } await sleep(8000); return { s: Math.round((Date.now() - t0) / 1000), dl: await dl(${JSON.stringify(l)}) }`
  )
// Waits for the other career to read from Metis's own lines (the links step after the paired league's
// refresh has handed them over).
const metis = (l, id, ms) =>
  run(
    `const t0 = Date.now(); let r = null; while (Date.now() - t0 < ${ms}) { r = await window.api.stats.otherCareer(${JSON.stringify(l)}, ${JSON.stringify(id)}).catch(() => null); if (r?.source?.kind === 'metis') break; await sleep(2000) } return { s: Math.round((Date.now() - t0) / 1000), source: r?.source ?? null, at: new Date().toISOString() }`
  )
// The strip's offer, then the Data panel's on/off button it focuses, then Back to the page.
const turnOnFromStrip = (name) =>
  run(
    `const b = stripButton('Download ${name}'); if (!b) return 'NO OFFER'; b.click(); await until(() => dataButton(${JSON.stringify(name)}, 'Turn the'), 15000); await sleep(1200); const t = dataButton(${JSON.stringify(name)}, 'Turn the'); const focused = document.activeElement === t; const before = t.textContent; t.click(); await until(() => dataButton(${JSON.stringify(name)}, 'Turn the')?.textContent.endsWith('off'), 10000); await sleep(1500); return { focused, before, after: dataButton(${JSON.stringify(name)}, 'Turn the')?.textContent, line: dataLine(${JSON.stringify(name)}) }`
  )
// Off and deleted from the Data panel, as a user would.
const removeLeague = (name, id) =>
  run(
    `document.querySelector('nav button[title="See what is loaded"]').click(); await until(() => dataSection(${JSON.stringify(name)}), 10000); await sleep(1500); const t = dataButton(${JSON.stringify(name)}, 'Turn the'); if (t?.textContent.endsWith('off')) { t.click(); await until(() => dataButton(${JSON.stringify(name)}, 'Delete its data'), 15000) } await sleep(1500); const d = dataButton(${JSON.stringify(name)}, 'Delete its data'); if (!d) return 'NO DELETE'; d.click(); await until(() => [...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent === 'Delete'), 5000); [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Delete').click(); await until(async () => !(await dl(${JSON.stringify(id)})).hasFile, 60000); await sleep(3000); return { line: dataLine(${JSON.stringify(name)}), dl: await dl(${JSON.stringify(id)}) }`
  )
const snap = (other) =>
  run(
    `return { state: state(), boxes: boxes(), dl: await dl(${JSON.stringify(other)}), menu: await menu() }`
  )

const nba = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  // The NBA alone: its launch refresh, then its links step, which fetches NCAA Men's season lines.
  run(
    `return { dl: await window.api.leagues.downloads(), status: await window.api.stats.status('nba') }`
  ),
  linked('nba', '1642843'),
  idle('nba'),
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return { state: state(), boxes: boxes(), menu: await menu() }'),
  shot('a-01-nba-alone-flagg'),
  ...menuShot('a-02-nba-alone-menu'),
  ...draftClick('a-03-nba-alone-draft-profile', 'NBA'),
  run(`await nav('Players'); return state()`),
  search('saunders'),
  shot('a-04-nba-alone-saunders'),
  clear,
  // NCAA Men turned on from the strip's offer, with nothing loaded: the page's boxes before and after.
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return { boxes: boxes(), strip: stripSig() }'),
  turnOnFromStrip('NCAA Men'),
  shot('a-05-ncaam-turned-on-data'),
  run(
    `const s = await goBack(); await linkIn(); track('ncaam'); return { state: s, boxes: boxes(), dl: await dl('ncaam') }`
  ),
  shot('a-06-ncaam-loading-strip'),
  ...menuShot('a-07-ncaam-loading-menu'),
  run(`await nav('Players'); typeIn('saunders'); await sleep(1500); return found()`),
  shot('a-08-ncaam-loading-rail'),
  clear,
  // Loaded with its tables not built: the file is there, the tables are not.
  run(
    `await until(async () => (await dl('ncaam')).hasFile && (await dl('ncaam')).mb > 50, 900000); return { dl: await dl('ncaam') }`
  ),
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return { state: state(), boxes: boxes(), menu: await menu() }'),
  shot('a-09-ncaam-loaded-not-built'),
  run(
    `document.querySelector('nav button[title="See what is loaded"]').click(); await sleep(2000); return { line: dataLine('NCAA Men') }`
  ),
  shot('a-10-ncaam-downloading-data'),
  run('untrack(); return { moves: boxMoves(), changes: changes() }'),
  // Off and deleted: back to ESPN's totals and the offer.
  removeLeague('NCAA Men', 'ncaam'),
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return { state: state(), boxes: boxes() }'),
  // The copied file goes in now (the runner watches for this line), with NCAA Men off.
  run(`return 'READY_FOR_COPY'`),
  run(
    `await until(async () => (await dl('ncaam')).hasFile, 1800000); await sleep(3000); return { dl: await dl('ncaam') }`
  ),
  // It arrives while Flagg's page is open: turned on, its worker opens the built file, its refresh
  // runs and the links step hands its lines over. Every box sampled every 50 ms throughout.
  run(
    `track('ncaam'); await sleep(1500); await window.api.leagues.setDownloads({ ncaam: true }); return { at: new Date().toISOString() }`
  ),
  run(
    `await until(() => (stripSig()?.rows ?? []).some((r) => r.startsWith('→ Open Cooper Flagg’s NCAA Men page')), 600000); await sleep(1000); return { state: state(), boxes: boxes(), dl: await dl('ncaam') }`
  ),
  shot('a-11-ncaam-arrived-rows-open'),
  metis('nba', '1642843', 3600000),
  idle('ncaam'),
  run('await sleep(3000); untrack(); return { moves: boxMoves(), changes: changes() }'),
  snap('ncaam'),
  shot('a-12-both-flagg-nba'),
  ...menuShot('a-13-both-menu'),
  // Both: the switch, the draft row from the college page, the college search.
  run(`return pick('NCAA Men')`),
  run('return linkIn()'),
  shot('a-14-both-flagg-ncaam'),
  ...draftClick('a-15-both-ncaam-draft-nba-profile'),
  run(`await nav('Players'); await setSelect('Season', 2026); return state()`),
  search('Flagg'),
  search('Jayden Quaintance'),
  shot('a-16-both-ncaam-search'),
  clear,
  run(`await switchTo('NBA'); return state()`),
  // NCAA Men removed: its lines kept in the links file still read, from Metis.
  removeLeague('NCAA Men', 'ncaam'),
  open('NBA', 2027, 'Cooper Flagg'),
  run(
    'await linkIn(); await sleep(1500); return { state: state(), boxes: boxes(), menu: await menu() }'
  ),
  shot('a-17-ncaam-removed-flagg'),
  run(`await nav('Players'); typeIn('saunders'); await sleep(1500); return found()`),
  clear,
  idle('nba', 600000)
]

const wnba = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `return { dl: await window.api.leagues.downloads(), status: await window.api.stats.status('wnba') }`
  ),
  linked('wnba', '1642784'),
  idle('wnba'),
  open('WNBA', 2026, 'Paige Bueckers'),
  run('await linkIn(); return { state: state(), boxes: boxes(), menu: await menu() }'),
  shot('b-01-wnba-alone-bueckers'),
  ...draftClick('b-02-wnba-alone-draft-profile', 'WNBA'),
  run(`await nav('Players'); return state()`),
  search('hsu'),
  search('Sue Bird'),
  shot('b-03-wnba-alone-search'),
  clear,
  // NCAA Women from nothing, turned on from the strip's offer, arriving while Bueckers's page is open.
  open('WNBA', 2026, 'Paige Bueckers'),
  run('await linkIn(); return { boxes: boxes(), strip: stripSig() }'),
  turnOnFromStrip('NCAA Women'),
  shot('b-04-ncaaw-turned-on-data'),
  run(
    `const s = await goBack(); await linkIn(); track('ncaaw'); return { state: s, boxes: boxes(), dl: await dl('ncaaw') }`
  ),
  shot('b-05-ncaaw-nothing-loaded'),
  ...menuShot('b-06-ncaaw-loading-menu'),
  // The rail's loading rows, then straight back to the page, which stays open from here on.
  run(`await nav('Players'); typeIn('hsu'); await sleep(1500); return found()`),
  shot('b-07-ncaaw-loading-rail'),
  // Back from the rail would go to the page before Bueckers's (the search is not a page): open hers
  // again. In the run of 2026-11-21 this step was Back, and her page was opened over DevTools
  // at 03:23:48Z, at 125 of 185 files with no tables built, before anything arrived.
  clear,
  open('WNBA', 2026, 'Paige Bueckers'),
  run('await linkIn(); return { state: state(), boxes: boxes() }'),
  run(
    `await until(async () => (await dl('ncaaw')).hasFile && (await dl('ncaaw')).mb > 50, 1800000); return { dl: await dl('ncaaw'), state: state(), boxes: boxes() }`
  ),
  shot('b-08-ncaaw-loaded-not-built'),
  // Its tables built: the rows open its pages.
  run(
    `const t0 = Date.now(); await until(async () => (await dl('ncaaw')).builtAt !== null, 14400000); return { s: Math.round((Date.now() - t0) / 1000), dl: await dl('ncaaw') }`
  ),
  run(
    `await until(() => (stripSig()?.rows ?? []).some((r) => r.startsWith('→ ')), 60000); await sleep(1000); return { state: state(), boxes: boxes() }`
  ),
  shot('b-09-ncaaw-built-rows-open'),
  metis('wnba', '1642784', 7200000),
  idle('ncaaw', 7200000),
  run('await sleep(3000); untrack(); return { moves: boxMoves(), changes: changes() }'),
  snap('ncaaw'),
  shot('b-10-both-bueckers-wnba'),
  ...menuShot('b-11-both-menu'),
  run(`return pick('NCAA Women')`),
  run('return linkIn()'),
  shot('b-12-both-bueckers-ncaaw'),
  ...draftClick('b-13-both-ncaaw-draft-wnba-profile'),
  run(`await nav('Players'); await setSelect('Season', 2026); return state()`),
  search('Bueckers'),
  shot('b-14-both-ncaaw-search'),
  clear,
  // The WNBA removed: its lines kept in the links file still read on the college page, from Metis.
  removeLeague('WNBA', 'wnba'),
  open('NCAA Women', 2025, 'Paige Bueckers'),
  run(
    'await linkIn(); await sleep(1500); return { state: state(), boxes: boxes(), menu: await menu() }'
  ),
  shot('b-15-wnba-removed-bueckers-ncaaw'),
  idle('ncaaw', 600000)
]

// The NBA profile once both are in: NCAA Men removed from the Data panel, its lines kept in the
// links file still read on Flagg's page, from Metis.
const nbaRemoved = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  idle('nba', 1800000),
  idle('ncaam', 1800000),
  // Read times through the app's IPC, 20 each: a player's other career, and each league's index.
  run(
    `const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]; const time = async (f) => { const ms = []; for (let i = 0; i < 20; i++) { const t0 = performance.now(); await f(); ms.push(Math.round((performance.now() - t0) * 10) / 10) } return { first: ms[0], median: med(ms.slice(1)) } }; const rows = { nba: (await window.api.stats.playerIndex('nba')).length, ncaam: (await window.api.stats.playerIndex('ncaam')).length }; return { otherCareerNba: await time(() => window.api.stats.otherCareer('nba', '1642843')), otherCareerNcaam: await time(() => window.api.stats.otherCareer('ncaam', '5041939')), indexNba: await time(() => window.api.stats.playerIndex('nba')), indexNcaam: await time(() => window.api.stats.playerIndex('ncaam')), rows }`
  ),
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return { state: state(), boxes: boxes(), menu: await menu() }'),
  removeLeague('NCAA Men', 'ncaam'),
  open('NBA', 2027, 'Cooper Flagg'),
  run(
    'await linkIn(); await sleep(1500); return { state: state(), boxes: boxes(), menu: await menu() }'
  ),
  shot('a-17-ncaam-removed-flagg'),
  ...menuShot('a-18-ncaam-removed-menu'),
  run(`await nav('Players'); typeIn('saunders'); await sleep(1500); return found()`),
  clear,
  idle('nba', 600000)
]

// Back after a move to another season or league returns to the page as it was left, its scope
// included; a plain Back is as it always was. Also the rail's count line over found rows.
const back = run(`const s = await goBack(); return { ...s, strip: undefined }`)
const stripTo = (start) =>
  run(
    `const r = stripRow(${JSON.stringify(start)}); if (!r) return 'NO ROW ' + ${JSON.stringify(start)}; r.click(); await sleep(3000); await until(() => careerTable(), 20000); await sleep(800); return { ...state(), strip: undefined }`
  )
const backSteps = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  pause(['nba', 'wnba', 'ncaam', 'ncaaw']),
  // A plain Back: Flagg, then LeBron James from the rail in the same season, then Back: Flagg in
  // 2026-27 as before. Then LeBron again, his season changed to 2025-26 on his page, then Back:
  // Flagg in 2025-26, the scope as it was left, as Back has always done.
  open('NBA', 2027, 'Cooper Flagg'),
  open('NBA', 2027, 'LeBron James'),
  back,
  open('NBA', 2027, 'LeBron James'),
  run(
    `await setSelect('Season', 2026); await sleep(1500); return { ...state(), strip: undefined }`
  ),
  back,
  // The search into another season: Kobe Bryant (2015-16) from Flagg's page in 2026-27, then Back.
  open('NBA', 2027, 'Cooper Flagg'),
  run(`await setSelect('Season type', 'regular'); return { ...state(), strip: undefined }`),
  search('Kobe'),
  run('return { count: count() }'),
  shot('r-01-nba-kobe-count'),
  openMore('Open Kobe Bryant', 'Bryant'),
  run('return { ...state(), strip: undefined }'),
  back,
  shot('r-02-nba-back-from-kobe'),
  clear,
  // The strip's row to the other league, then Back, both pairs.
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return { ...state(), strip: undefined }'),
  stripTo('Open Cooper Flagg’s NCAA Men page'),
  back,
  open('WNBA', 2026, 'Paige Bueckers'),
  run('await linkIn(); return { ...state(), strip: undefined }'),
  stripTo('Open Paige Bueckers’s NCAA Women page, 2024-25'),
  // On the college page, its season type changed before the move back to the WNBA and Back again.
  run(
    `await setSelect('Season type', 'regular'); await linkIn(); return { ...state(), strip: undefined }`
  ),
  stripTo('Open Paige Bueckers’s WNBA page, 2025'),
  back,
  back,
  // The league menu's move, then Back, both pairs.
  open('NBA', 2027, 'Cooper Flagg'),
  run('await linkIn(); return pick("NCAA Men")'),
  back,
  open('WNBA', 2026, 'Paige Bueckers'),
  run('await linkIn(); return pick("NCAA Women")'),
  back,
  shot('r-03-wnba-back-from-menu-move'),
  // The count line: no ranked row, and the paired league's row alone.
  run(
    `await switchTo('NCAA Men'); await nav('Players'); await setSelect('Season', 2026); return state()`
  ),
  search('Flagg'),
  run('return { count: count() }'),
  shot('r-04-ncaam-flagg-count'),
  clear,
  run(`await switchTo('NBA'); await nav('Players'); return state()`),
  search('saunders'),
  run('return { count: count() }'),
  shot('r-05-nba-saunders-count'),
  clear
]

const write = (name, steps) => writeFileSync(join(out, name), JSON.stringify(steps, null, 2) + '\n')
write('t1304e-search-steps.json', searchSteps)
write('t1304e-timing-steps.json', timing)
write('t1304e-nba-steps.json', nba)
write('t1304e-wnba-steps.json', wnba)
write('t1304e-nba-removed-steps.json', nbaRemoved)
write('t1304e-back-steps.json', backSteps)
console.log('written', searchSteps.length, timing.length, nba.length, wnba.length, 'steps')
