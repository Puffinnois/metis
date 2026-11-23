// Writes the T1601.2 review drive steps (the small tables' edge in a gutter; the chart's colour-by):
// node scripts/t1601c-make-steps.mjs scripts
// `t1601c-cells-steps.json` runs on this branch and on origin/main alike: it records every cell's left
// edge in four small tables, so the two builds can be compared; on this branch it also measures the
// edge's room before the first cell and shoots both themes. `t1601c-chart-steps.json` drives Explore's
// chart with a colour-by. The T1601 profile, after t1601b (SGA and the Lakers starred).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
const OKC = '1610612760'
const SGA = '1628983'

const HELPERS = `
window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(10) } return false };
window.nav = async (name) => { const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim() === name); if (!b) return 'NO NAV ' + name; b.click(); await sleep(1500); return 'nav ' + name };
window.heading = () => document.querySelector('main h1')?.textContent ?? null;
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) return 'NO ' + title; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.tab = async (name) => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === name); if (!t) return 'NO TAB ' + name; t.click(); await sleep(2500); return name };
window.rail = () => document.querySelector('aside[aria-label=Players]');
window.railRow = (name) => [...(rail()?.querySelectorAll('button') ?? [])].find((b) => b.querySelector('span span')?.textContent.trim() === name);
window.input = () => document.querySelector('input[aria-label="Search players"]');
window.typeIn = (text) => { const i = input(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, text); i.dispatchEvent(new Event('input', { bubbles: true })) };
window.searchRail = async (name) => { for (const text of [name, name.split(' ').slice(-1)[0]]) { typeIn(text); if (await until(() => railRow(name), 10000)) return true } return false };
window.themeNow = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
window.toTheme = async (want) => { if (themeNow() !== want) document.querySelector('button[aria-label="Switch theme"]').click(); await sleep(800); return themeNow() };
window.errors = async () => (await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200));
// Every row's cells' left edges, and for a favourite row the edge bar's place and its room before the
// first cell's text.
window.cells = (label) => { const t = document.querySelector('[role=table][aria-label="' + label + '"]'); if (!t) return 'NO TABLE ' + label; const rows = [...t.querySelectorAll(':scope > [role=row]')]; const lefts = rows.map((r) => [...r.querySelectorAll(':scope > [role=cell], :scope > [role=columnheader]')].map((c) => Math.round(c.getBoundingClientRect().left)).join(',')); const fav = rows.find((r) => getComputedStyle(r, '::before').backgroundColor.includes('oklch')); let edge = null; if (fav) { const b = getComputedStyle(fav, '::before'); const rowLeft = fav.getBoundingClientRect().left; const barLeft = rowLeft + parseFloat(b.left); const firstText = fav.querySelector(':scope > [role=cell]').getBoundingClientRect().left; edge = { barLeft: Math.round(barLeft), barWidth: b.width, room: Math.round(firstText - (barLeft + parseFloat(b.width))), colour: b.backgroundColor } } return { rows: rows.length, lefts, edge } };
window.openSga = async () => { await nav('Players'); await setSelect('Season', 2026); await setSelect('Rank by', 'pts'); await setSelect('Team', ''); await searchRail('Shai Gilgeous-Alexander'); railRow('Shai Gilgeous-Alexander').click(); await until(() => (heading() ?? '').includes('Gilgeous'), 20000); typeIn(''); await sleep(1500); return heading() };
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)

const tables = (tag) => [
  run(
    `await nav('Standings'); await setSelect('Season', 2027); await sleep(2500); const t = [...document.querySelectorAll('[role=table]')].find((x) => x.textContent.includes('Lakers')); return { standings: cells(t.getAttribute('aria-label')) }`
  ),
  shot(`${tag}-standings`),
  run(
    `await nav('Games'); await setSelect('Season', 2027); const games = await window.api.stats.games('nba', 2027); const g = games.filter((x) => x.played && [x.home.id, x.away.id].includes('${OKC}')).at(-1); await setSelect('Day', g.date); await sleep(2000); const list = document.querySelector('[aria-label="The day’s games"]'); [...list.querySelectorAll('button')].find((c) => c.textContent.includes('OKC')).click(); await sleep(4000); document.querySelector('[aria-label="OKC box score"]').scrollIntoView(); await sleep(400); return { game: g.away.code + ' @ ' + g.home.code, box: cells('OKC box score') }`
  ),
  shot(`${tag}-box-score`),
  run(
    `await nav('Teams'); await setSelect('Season', 2027); await setSelect('Team', '${OKC}'); await tab('Players'); await sleep(2500); return { players: cells('Players') }`
  ),
  shot(`${tag}-team-players`),
  run(
    `await openSga(); await tab('Splits'); await sleep(3000); document.querySelector('[aria-label="By opponent"]').scrollIntoView(); await sleep(400); return { splits: cells('By opponent') }`
  ),
  shot(`${tag}-splits-opponent`)
]

const cellsSteps = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(`return toTheme('light')`),
  ...tables('light'),
  run(`return toTheme('dark')`),
  ...tables('dark'),
  run(`await toTheme('light'); return { errors: await errors() }`)
]

const chart = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await nav('Explore'); await tab('Chart'); await setSelect('Season', 2027); await sleep(3000); return 'chart'`
  ),
  ...['', '@position', '#metric'].map((colour) =>
    run(
      `const sel = [...document.querySelectorAll('select')].find((x) => x.title === 'Colour by'); const want = '${colour}' === '#metric' ? sel.options[2].value : '${colour}'; const set = await setSelect('Colour by', want); await sleep(2500); const paint = (id) => { const g = document.querySelector('[data-dot="' + id + '"]'); if (!g) return 'NO DOT ' + id; const cs = [...g.querySelectorAll('circle')]; return { fill: cs.at(-1).getAttribute('fill'), ring: cs.length > 1 ? cs[0].getAttribute('stroke') : null, ringWidth: cs.length > 1 ? cs[0].getAttribute('stroke-width') : null } }; const other = [...document.querySelectorAll('[data-dot]')].find((g) => !['${SGA}', '1642843'].includes(g.getAttribute('data-dot')) && g.parentElement && g.querySelectorAll('circle').length === 1); return { colourBy: set, sga: paint('${SGA}'), flagg: paint('1642843'), other: other ? other.querySelector('circle').getAttribute('fill') : null }`
    )
  ),
  shot('chart-colour-by-metric'),
  run(`await setSelect('Colour by', '@position'); await sleep(2000); return 'position'`),
  shot('chart-colour-by-position'),
  run(`await setSelect('Colour by', ''); return { errors: await errors() }`)
]

writeFileSync(join(out, 't1601c-cells-steps.json'), JSON.stringify(cellsSteps, null, 2) + '\n')
writeFileSync(join(out, 't1601c-chart-steps.json'), JSON.stringify(chart, null, 2) + '\n')
console.log('written')
