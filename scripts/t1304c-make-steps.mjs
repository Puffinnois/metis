// Writes the T1304.3 drive steps (the career strip): node scripts/t1304c-make-steps.mjs scripts
// Four files: the four-league profile, the professional and the college leagues alone, and the timing.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]

const HELPERS = `
window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(100) } return false };
window.nav = async (name) => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === name); if (!b) return 'NO NAV ' + name; b.click(); await sleep(1500); return 'nav ' + name };
window.trigger = () => document.querySelector('button[aria-label^="League: "]');
window.league = () => trigger()?.getAttribute('aria-label')?.replace('League: ', '') ?? null;
window.switchTo = async (name) => { if (league() === name) return name; const t = trigger(); if (!t) return 'NO MENU'; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await until(() => document.querySelectorAll('[role=menuitemradio]').length > 0, 3000); const item = [...document.querySelectorAll('[role=menuitemradio]')].find((x) => x.textContent.startsWith(name)); if (!item) return 'NO ITEM ' + name; item.click(); await until(() => league() === name, 5000); await sleep(2500); return league() };
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) return 'NO ' + title; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.railRow = (name) => [...document.querySelectorAll('aside[aria-label=Players] button')].find((b) => b.querySelector('span span')?.textContent.trim() === name);
window.searchRail = async (name) => { const input = document.querySelector('input[aria-label="Search players"]'); for (const text of [name, name.split(' ').slice(-1)[0]]) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); if (await until(() => railRow(name), 10000)) return true } return false };
window.careerTable = () => document.querySelector('[role=table][aria-label="Career by season"]');
window.stripEl = () => document.querySelector('section[aria-label="College and pro career"]');
window.rowsOf = (el) => [...(el?.querySelectorAll('[role=row]') ?? [])].map((r) => [...r.children].map((c) => c.textContent.trim()).join(' | '));
window.strip = () => { const s = stripEl(); if (!s) return null; return { head: s.querySelector('h2')?.parentElement?.textContent.trim(), rows: rowsOf(s.querySelector('[role=table]')), text: s.querySelector('p')?.textContent ?? null, notes: [...s.querySelectorAll(':scope > div')].filter((d) => d.className.includes('gap-1')).flatMap((d) => [...d.children].map((x) => x.textContent)), button: s.querySelector(':scope > button')?.textContent ?? null, opens: [...s.querySelectorAll('button[role=row]')].map((b) => b.title) } };
window.career = () => rowsOf(careerTable());
window.heading = () => document.querySelector('main h1')?.textContent ?? null;
window.openPlayer = async (leagueName, season, name, rank = 'pts') => { const w = await switchTo(leagueName); await nav('Players'); await setSelect('Season', season); await setSelect('Rank by', rank); if (!(await searchRail(name))) return { w, error: 'NOT IN RAIL ' + name }; const t0 = performance.now(); railRow(name).click(); const last = name.split(' ').slice(-1)[0]; await until(() => (heading() ?? '').includes(last) && careerTable(), 20000); const careerMs = Math.round(performance.now() - t0); await until(() => stripEl(), 3000); const stripMs = stripEl() ? Math.round(performance.now() - t0) : null; await sleep(600); return { league: w, heading: heading(), careerMs, stripMs, strip: strip(), career: career() } };
window.showStrip = async () => { const s = stripEl() ?? careerTable(); s?.scrollIntoView({ block: 'end' }); await sleep(500); return s ? 'shown' : 'nothing' };
window.openRow = async (prefix) => { const b = [...(stripEl()?.querySelectorAll('button[role=row]') ?? [])].find((x) => x.textContent.startsWith(prefix)); if (!b) return 'NO ROW ' + prefix; const t0 = performance.now(); b.click(); await until(() => careerTable() && stripEl() && league() !== null, 20000); await sleep(1500); return { ms: Math.round(performance.now() - t0), league: league(), heading: heading(), season: document.querySelector('select[title=Season]')?.value, type: document.querySelector('select[title="Season type"]')?.value, strip: strip(), career: career() } };
window.back = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true })); await sleep(3000); await until(() => careerTable(), 15000); return { league: league(), heading: heading(), strip: strip() ? 'strip' : null } };
window.theme = (dark) => { document.documentElement.classList.toggle('dark', dark); return dark ? 'dark' : 'light' };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const open = (league, season, name, rank = 'pts') =>
  ev(
    `(async () => JSON.stringify(await openPlayer(${JSON.stringify(league)}, ${season}, ${JSON.stringify(name)}, ${JSON.stringify(rank)})))()`
  )
const show = ev('showStrip()')
// A college page on every game, what the strip's college rows count, for the numbers check.
const everyGame = ev(
  `(async () => { await setSelect('Season type', 'counted'); await until(() => careerTable(), 15000); await sleep(800); return JSON.stringify({ type: document.querySelector('select[title="Season type"]')?.value, career: career(), strip: strip()?.rows }) })()`
)

const all = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  // Hold the data still: no refresh writes while the pages are read.
  ev(
    `(async () => { for (const l of ['nba', 'wnba', 'ncaam', 'ncaaw']) await window.api.stats.pause(l); await sleep(3000); return 'paused' })()`
  ),
  // A draftee with no professional game: the draft line on the college page.
  open('NCAA Men', 2025, 'Jayden Quaintance', 'blk'),
  everyGame,
  show,
  shot('p1-11-ncaam-quaintance'),
  // Both leagues of both pairs downloaded.
  open('NBA', 2027, 'Cooper Flagg'),
  show,
  shot('p1-01-nba-flagg-light'),
  ev('theme(true)'),
  { wait: 400 },
  shot('p1-02-nba-flagg-dark'),
  ev('theme(false)'),
  // Keyboard: the strip's rows in the tab order, after the career table.
  ev(
    `(async () => { const f = [...document.querySelectorAll('main button, main [tabindex="0"], main select, main input')].filter((e) => !e.disabled); const i = f.findIndex((e) => stripEl()?.contains(e)); return JSON.stringify(f.slice(Math.max(0, i - 2), i + 4).map((e) => (e.getAttribute('role') ?? e.tagName) + ': ' + (e.title || e.textContent.trim()).slice(0, 70))) })()`
  ),
  ev(
    `(async () => { const b = stripEl()?.querySelector('button[role=row]'); b?.focus(); await sleep(300); return document.activeElement?.title ?? 'none' })()`
  ),
  shot('p1-03-nba-flagg-focus'),
  // Reading order inside the strip, as a screen reader meets it.
  ev(
    `(() => { const s = stripEl(); const out = ['section: ' + s?.getAttribute('aria-label')]; const walk = (n) => { for (const c of n.children) { const role = c.getAttribute('role'); if (c.tagName === 'H2') out.push('heading: ' + c.textContent.trim()); else if (role === 'table') out.push('table: ' + c.getAttribute('aria-label') + ', ' + c.querySelectorAll('[role=row]').length + ' rows'); else if (role === 'row') { out.push('row: ' + [...c.children].map((x) => x.textContent.trim()).filter(Boolean).join(', ')); continue } else if (c.tagName === 'BUTTON' && !role) out.push('button: ' + c.textContent.trim()); else if (!c.children.length && c.textContent.trim()) out.push('text: ' + c.textContent.trim()); walk(c) } }; if (s) walk(s); return JSON.stringify(out) })()`
  ),
  // Enter on the focused row opens Flagg's NCAA Men page in 2024-25.
  { key: ['Enter', 'Enter', 13, 0, String.fromCharCode(13)] },
  { wait: 4000 },
  ev(
    `(async () => { await until(() => careerTable() && stripEl(), 15000); await sleep(800); return JSON.stringify({ league: league(), heading: heading(), season: document.querySelector('select[title=Season]')?.value, type: document.querySelector('select[title="Season type"]')?.value, strip: strip(), career: career() }) })()`
  ),
  show,
  shot('p1-04-ncaam-flagg'),
  ev('(async () => JSON.stringify(await back()))()'),
  shot('p1-05-back-nba-flagg'),
  // The WNBA with NCAA Women.
  open('WNBA', 2026, 'Paige Bueckers'),
  show,
  shot('p1-06-wnba-bueckers'),
  ev(`(async () => JSON.stringify(await openRow('NCAA Women')))()`),
  show,
  shot('p1-07-ncaaw-bueckers'),
  ev('theme(true)'),
  { wait: 400 },
  shot('p1-08-ncaaw-bueckers-dark'),
  ev('theme(false)'),
  // Linked by name and birth date (two ESPN ids).
  open('NBA', 2025, 'Jalen Hood-Schifino'),
  show,
  shot('p1-09-nba-hood-schifino'),
  ev(`(async () => JSON.stringify(await openRow('NCAA Men')))()`),
  show,
  shot('p1-10-ncaam-hood-schifino'),
  // No link, with a reason: drafted from a club; college before 2021-22.
  open('NBA', 2027, 'Alex Sarr'),
  show,
  shot('p1-12-nba-sarr'),
  open('NBA', 2027, 'Cade Cunningham'),
  show,
  shot('p1-13-nba-cunningham'),
  open('WNBA', 2026, "A'ja Wilson"),
  show,
  shot('p1-14-wnba-wilson'),
  // No link, no reason: nothing at all.
  open('NBA', 2027, 'LeBron James'),
  show,
  shot('p1-15-nba-lebron'),
  open('NCAA Women', 2025, 'JuJu Watkins'),
  show,
  shot('p1-16-ncaaw-watkins'),
  ev(`(async () => { await switchTo('NBA'); return 'NBA' })()`)
]

// Waits for the links file the launch's refresh builds: the read of a known link answers.
const linked = (league, id) =>
  ev(
    `(async () => { const t0 = Date.now(); let r = null; while (Date.now() - t0 < 900000) { r = await window.api.stats.otherCareer(${JSON.stringify(league)}, ${JSON.stringify(id)}).catch((e) => ({ error: String(e) })); if (r?.link) break; await sleep(5000) } return JSON.stringify({ s: Math.round((Date.now() - t0) / 1000), link: r?.link ?? null, source: r?.source ?? null, error: r?.error ?? null }) })()`
  )
const pause = (leagues) =>
  ev(
    `(async () => { for (const l of ${JSON.stringify(leagues)}) await window.api.stats.pause(l); await sleep(2000); return 'paused' })()`
  )
const offer = (name) => [
  ev(
    `(async () => { const b = stripEl()?.querySelector(':scope > button'); if (!b) return 'NO OFFER'; const text = b.textContent; b.click(); await until(() => document.activeElement?.textContent?.startsWith('Turn the'), 15000); await sleep(800); const s = document.querySelector('section[aria-label="${name}"]'); const r = s?.getBoundingClientRect(); return JSON.stringify({ offer: text, focused: document.activeElement?.textContent, sectionTop: r ? Math.round(r.top) : null }) })()`
  ),
  shot('offer-' + name.replace(/ /g, '-').toLowerCase())
]

// Only the professional leagues downloaded: ESPN's college totals, and a college league arriving live.
const pro = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  linked('nba', '1642843'),
  linked('wnba', '1642784'),
  pause(['nba', 'wnba']),
  open('NBA', 2027, 'Cooper Flagg'),
  show,
  shot('p2-01-nba-flagg-espn'),
  ev('theme(true)'),
  { wait: 400 },
  shot('p2-02-nba-flagg-espn-dark'),
  ev('theme(false)'),
  open('NBA', 2025, 'Jalen Hood-Schifino'),
  show,
  shot('p2-03-nba-hood-schifino-espn'),
  open('WNBA', 2026, 'Paige Bueckers'),
  show,
  shot('p2-04-wnba-bueckers-espn'),
  ...offer('NCAA Women'),
  open('NBA', 2027, 'Cooper Flagg'),
  show,
  ...offer('NCAA Men'),
  // NCAA Men arrives while Flagg's page stays open: the file is put in place from outside (a copy, so
  // no download of every season), the league turned on, and the strip watched.
  open('NBA', 2027, 'Cooper Flagg'),
  show,
  ev(`'ready-for-file'`),
  ev(
    `(async () => { const t0 = Date.now(); while (Date.now() - t0 < 600000) { const d = await window.api.leagues.downloads(); if (d.leagues.find((l) => l.league === 'ncaam')?.hasFile) return 'file in after ' + Math.round((Date.now() - t0) / 1000) + ' s'; await sleep(2000) } return 'NO FILE' })()`
  ),
  ev(
    `(async () => { await window.api.leagues.setDownloads({ ncaam: true }); await sleep(1500); return JSON.stringify(strip()) })()`
  ),
  shot('p2-05-nba-flagg-ncaam-loading'),
  ev(
    `(async () => { const t0 = Date.now(); while (Date.now() - t0 < 1500000) { const s = strip(); if (s?.notes?.some((n) => n.includes('from Metis'))) return JSON.stringify({ s: Math.round((Date.now() - t0) / 1000), heading: heading(), strip: s }); await sleep(3000) } return JSON.stringify({ timeout: true, strip: strip() }) })()`
  ),
  show,
  shot('p2-06-nba-flagg-ncaam-arrived'),
  ev(`(async () => JSON.stringify(await openRow('NCAA Men')))()`),
  show,
  shot('p2-07-ncaam-flagg-live')
]

// Only the college leagues downloaded: ESPN's professional totals and the draft from the paired files.
const college = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  linked('ncaam', '5041939'),
  linked('ncaaw', '4433730'),
  pause(['ncaam', 'ncaaw']),
  open('NCAA Men', 2025, 'Jayden Quaintance', 'blk'),
  everyGame,
  show,
  shot('p3-03-ncaam-quaintance-espn'),
  open('NCAA Men', 2025, 'Cooper Flagg'),
  everyGame,
  show,
  shot('p3-01-ncaam-flagg-espn'),
  ev('theme(true)'),
  { wait: 400 },
  shot('p3-02-ncaam-flagg-espn-dark'),
  ev('theme(false)'),
  ...offer('NBA'),
  open('NCAA Men', 2023, 'Jalen Hood-Schifino'),
  everyGame,
  show,
  shot('p3-04-ncaam-hood-schifino-espn'),
  open('NCAA Women', 2025, 'Paige Bueckers'),
  everyGame,
  show,
  shot('p3-05-ncaaw-bueckers-espn'),
  open('NCAA Women', 2025, 'JuJu Watkins'),
  show,
  shot('p3-06-ncaaw-watkins')
]
writeFileSync(join(out, 't1304c-pro-steps.json'), JSON.stringify(pro, null, 2) + '\n')
writeFileSync(join(out, 't1304c-college-steps.json'), JSON.stringify(college, null, 2) + '\n')

// The page's read time, the same steps on this branch and on main: from a click in the rail to the
// header, and to the career table, the last of the Overview to fill. Three rounds over six players.
const TIMED = [
  ['NBA', 2027, 'Cooper Flagg'],
  ['NBA', 2027, 'LeBron James'],
  ['NBA', 2025, 'Jalen Hood-Schifino'],
  ['WNBA', 2026, 'Paige Bueckers'],
  ['NCAA Men', 2025, 'Cooper Flagg'],
  ['NCAA Women', 2025, 'Paige Bueckers']
]
const timing = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  pause(['nba', 'wnba', 'ncaam', 'ncaaw']),
  ev(
    `(async () => { const want = ${JSON.stringify(TIMED)}; const out = []; for (let round = 0; round < 4; round++) for (const [l, s, n] of want) { const w = await switchTo(l); await nav('Players'); await setSelect('Season', s); const input = document.querySelector('input[aria-label="Search players"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); const rows = () => [...document.querySelectorAll('aside[aria-label=Players] button')].filter((b) => b.querySelector('span span')); await until(() => rows().length > 3, 15000); /* Someone else first, so every measure is a real change of page. */ const away = rows().find((b) => b.getAttribute('aria-current') !== 'true' && !b.textContent.includes(n)); const awayName = away?.querySelector('span span')?.textContent.trim() ?? ''; away?.click(); await until(() => careerTable() && (heading() ?? '').includes(awayName.split(' ').slice(-1)[0]), 20000); await sleep(1200); if (!(await searchRail(n))) { out.push([round, l, n, 'NOT IN RAIL']); continue } const last = n.split(' ').slice(-1)[0]; const t0 = performance.now(); railRow(n).click(); await until(() => (heading() ?? '').includes(last), 20000); const head = performance.now() - t0; await until(() => (heading() ?? '').includes(last) && careerTable(), 20000); const page = performance.now() - t0; await until(() => stripEl(), 2500); const strip = stripEl() ? performance.now() - t0 : null; out.push([round, l, n, Math.round(head), Math.round(page), strip === null ? null : Math.round(strip)]); await sleep(1200) } return JSON.stringify(out) })()`
  )
]
writeFileSync(join(out, 't1304c-timing-steps.json'), JSON.stringify(timing, null, 2) + '\n')
writeFileSync(join(out, 't1304c-strip-steps.json'), JSON.stringify(all, null, 2) + '\n')
console.log('written', all.length, 'steps')
