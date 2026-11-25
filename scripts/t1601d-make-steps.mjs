// Writes the T1601.3 drive steps (the favourites filters):
// node scripts/t1601d-make-steps.mjs scripts
// On the T1601 profile (NBA and NCAA Men), after t1601b: SGA and the Lakers are NBA favourites and
// Cooper Flagg is starred in NCAA Men, so followed in the NBA. `t1601d-filters-steps.json` stars an
// NBA player deep on the board and an NCAA Men player past the board's 1,000 fetched rows, then
// drives each toggle; `t1601d-relaunch-steps.json` reopens a filtered view after a relaunch;
// `t1601d-timing-steps.json` times the board and the chart, and runs on origin/main as well.
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
window.pick = async (name) => { if (!(await openMenu())) return 'NO MENU'; const item = items().find((x) => x.textContent.startsWith(name)); if (!item) return 'NO ITEM ' + name; item.click(); await until(() => league() === name, 5000); await sleep(2500); return league() };
window.switchTo = async (name) => (league() === name ? name : pick(name));
window.setSelect = async (title, value) => { const el = [...document.querySelectorAll('select')].find((x) => x.title === title); if (!el) { const t = [...document.querySelectorAll('[data-team-chooser]')].find((x) => x.dataset.teamChooser === title); if (!t) return 'NO ' + title; t.click(); await sleep(300); const o = [...document.querySelectorAll('[role=option]')].find((x) => x.dataset.value === String(value)); (o ?? t).click(); await sleep(1500); return o ? t.dataset.value : 'NO ' + value }; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); return el.value };
window.toggle = (name) => [...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.replace('✓', '').trim() === name);
window.setToggle = async (name, on) => { const t = toggle(name); if (!t) return 'NO TOGGLE ' + name; if ((t.getAttribute('aria-pressed') === 'true') !== on) t.click(); await sleep(1200); return toggle(name).getAttribute('aria-pressed') };
window.errors = async () => (await window.api.dev.recentErrors()).map((e) => e.message.slice(0, 200));
window.themeNow = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
window.toTheme = async (want) => { if (themeNow() !== want) document.querySelector('button[aria-label="Switch theme"]').click(); await sleep(800); return themeNow() };
window.board = async () => { await nav('Leaderboards'); await sleep(1500); document.querySelector('button[title="Open the full board"]').click(); await until(() => document.querySelectorAll('tbody tr').length > 5, 20000); await sleep(1000); return document.querySelectorAll('tbody tr').length };
window.expand = async () => { for (let i = 0; i < 40; i++) { const more = [...document.querySelectorAll('footer button')].find((b) => /^Show \\d+ more$/.test(b.textContent.trim())); if (!more) break; more.click(); await sleep(250) } return document.querySelectorAll('tbody tr').length };
window.nameOf = (tr) => tr.querySelector('td div div button[title^="Open"], td div div span.truncate')?.textContent.trim();
window.ranks = () => Object.fromEntries([...document.querySelectorAll('tbody tr')].map((tr) => [nameOf(tr), tr.querySelector('td div > span')?.textContent.trim()]));
window.footer = () => document.querySelector('footer span')?.textContent.trim();
window.sortBy = async (label) => { const th = [...document.querySelectorAll('th[data-metric-head]')].find((x) => x.textContent.trim().startsWith(label)); if (!th) return 'NO HEAD ' + label; th.click(); await until(() => document.querySelectorAll('tbody tr').length > 0, 20000); await sleep(1500); return th.getAttribute('aria-sort') };
window.compare = (all, filtered) => Object.entries(filtered).map(([n, r]) => [n, r, all[n] ?? 'absent', String(all[n]) === r]);
'helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const run = (js) => ev(`(async () => JSON.stringify(await (async () => { ${js} })()))()`)

// The board's ranks with the filter off (every row shown) and on, under one sort.
const boardCheck = (tag) =>
  run(
    `await setToggle('Favourites', false); await sleep(800); await expand(); const all = ranks(); await setToggle('Favourites', true); await sleep(1000); const filtered = ranks(); window.__last = { all, filtered }; return { tag: '${tag}', rows: Object.keys(all).length, footer: footer(), compare: compare(all, filtered) }`
  )

const filters = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await toTheme('light'); await switchTo('NBA'); return { stored: Object.fromEntries(Object.entries(await window.api.favourites.all()).map(([l, f]) => [l, f.map((x) => x.name + (x.from ? ' (from ' + x.from + ')' : ''))])) }`
  ),
  // An NBA player deep on the points board: the 230th row, starred with its own star.
  run(
    `await board(); await expand(); const tr = [...document.querySelectorAll('tbody tr')][229]; const name = nameOf(tr); const star = tr.querySelector('button[aria-pressed]'); if (star.getAttribute('aria-pressed') === 'false') star.click(); await sleep(1500); window.__deep = name; return { deep: name, rank: tr.querySelector('td div > span').textContent.trim(), starred: tr.querySelector('button[aria-pressed]').getAttribute('aria-pressed') }`
  ),
  // Points, best first: every favourite at its rank on the whole board.
  boardCheck('points'),
  shot('01-players-filtered-points'),
  // Another sort: assists.
  run(`await setToggle('Favourites', false); return sortBy('AST')`),
  boardCheck('assists'),
  shot('02-players-filtered-assists'),
  // Qualified only off: the deep player still at their place among every row.
  run(
    `await setToggle('Qualified only', false); await sleep(1500); const r = await (async () => { await setToggle('Favourites', false); await expand(); const all = ranks(); await setToggle('Favourites', true); await sleep(800); return compare(all, ranks()) })(); await setToggle('Qualified only', true); return r`
  ),
  // The position tab and the team filter work on the filtered board; the search too.
  run(
    `const g = [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.trim() === 'Guards'); g.click(); await sleep(2500); await setToggle('Favourites', true); return { guards: ranks(), footer: footer() }`
  ),
  run(
    `const a = [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.trim() === 'All players'); a.click(); await sleep(2500); await setToggle('Favourites', true); await setSelect('Team', '1610612760'); const r = ranks(); await setSelect('Team', ''); return { okcOnly: r }`
  ),
  // Saved as a view with the filter on.
  run(
    `await setToggle('Favourites', true); document.querySelector('button[title="Saved views"]').click(); await sleep(600); const input = document.querySelector('input[aria-label="View name"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'My favourites: scoring'); input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300); [...document.querySelectorAll('form button')].find((b) => b.textContent.trim() === 'Save').click(); await sleep(1500); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const views = await window.api.stats.views('nba'); return views.map((v) => ({ name: v.name, favourites: v.board.favourites ?? null }))`
  ),
  // The Teams board.
  run(
    `await nav('Leaderboards'); await sleep(1500); const all = [...document.querySelectorAll('button[title="Open the full board"]')]; all.at(-1).click(); await until(() => document.querySelectorAll('tbody tr').length > 5, 20000); await sleep(1000); const before = ranks(); await setToggle('Favourites', true); await sleep(800); return compare(before, ranks())`
  ),
  shot('03-teams-filtered'),
  // Dark, the players board filtered.
  run(
    `await toTheme('dark'); await board(); await setToggle('Favourites', true); await sleep(800); return ranks()`
  ),
  shot('04-players-filtered-dark'),
  run(`return toTheme('light')`),
  // The chart: the favourites' dots do not move; the caption counts them.
  run(
    `await nav('Explore'); const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === 'Chart'); t.click(); await sleep(4000); await setToggle('Favourites', false); await sleep(800); const at = (id) => { const g = document.querySelector('[data-dot="' + id + '"] circle:last-child'); return g ? [g.getAttribute('cx'), g.getAttribute('cy')] : null }; const before = { sga: at('1628983'), flagg: at('1642843'), dots: document.querySelectorAll('[data-dot]').length, caption: document.querySelector('[data-summary]').textContent.trim(), ticks: [...document.querySelectorAll('svg text')].map((x) => x.textContent).filter((x) => /%|^[0-9.]+$/.test(x)).join('|') }; await setToggle('Favourites', true); await sleep(1000); const after = { sga: at('1628983'), flagg: at('1642843'), dots: document.querySelectorAll('[data-dot]').length, caption: document.querySelector('[data-summary]').textContent.trim(), rows: document.querySelectorAll('[data-row]').length, ticks: [...document.querySelectorAll('svg text')].map((x) => x.textContent).filter((x) => /%|^[0-9.]+$/.test(x)).join('|') }; return { before, after, sameTicks: before.ticks === after.ticks }`
  ),
  shot('05-chart-filtered'),
  run(`await setToggle('Favourites', false); return 'chart off'`),
  // Games: a day with a Lakers or Thunder game, and a day with none.
  run(
    `await nav('Games'); await setSelect('Season', 2027); const games = await window.api.stats.games('nba', 2027); const played = games.filter((g) => g.played); const favTeams = ['1610612747', '1610612760', '1610612742']; const withFav = played.filter((g) => favTeams.includes(g.home.id) || favTeams.includes(g.away.id)).at(-1); const days = [...new Set(played.map((g) => g.date))]; const without = days.reverse().find((d) => !played.some((g) => g.date === d && (favTeams.includes(g.home.id) || favTeams.includes(g.away.id)))); await setSelect('Day', withFav.date); await sleep(1500); const list = () => [...document.querySelector('[aria-label="The day’s games"]').querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()); const off = list(); await setToggle('Favourites', true); await sleep(2500); const on = list(); window.__without = without; return { day: withFav.date, off, on, count: document.querySelector('aside[aria-label=Games] span.font-mono')?.textContent }`
  ),
  shot('06-games-filtered'),
  run(
    `await setSelect('Day', window.__without); await sleep(2000); return { day: window.__without, list: document.querySelector('[aria-label="The day’s games"]').querySelectorAll('button').length, empty: document.querySelector('[data-empty=favourites]')?.textContent.trim() ?? null, stepper: !document.querySelector('button[title="The day after"]').disabled || !document.querySelector('button[title="The day before"]').disabled }`
  ),
  shot('07-games-day-without'),
  run(`await setToggle('Favourites', false); return 'games off'`),
  // NCAA Men: a player past the board's 1,000 fetched rows, placed by the engine.
  run(
    `await switchTo('NCAA Men'); const res = await window.api.stats.query('ncaam', { entity: 'player', metrics: ['pts', 'min'], scope: { seasons: [2027] }, sort: { metric: 'pts', dir: 'desc' }, limit: 5000 }); const pickRow = res.rows.filter((r) => r.values.min.qualified)[1500]; await window.api.favourites.add('ncaam', 'player', pickRow.id, pickRow.name); window.__ncaa = pickRow.name; await switchTo('NBA'); await switchTo('NCAA Men'); return { total: res.total, picked: pickRow.name, id: pickRow.id, pts: pickRow.values.pts.value }`
  ),
  run(
    `await board(); await setToggle('Favourites', false); await expand(); const all = ranks(); const last = Object.entries(all).at(-1); const t0 = performance.now(); await setToggle('Favourites', true); await until(() => Object.keys(ranks()).includes(window.__ncaa), 15000); const ms = Math.round(performance.now() - t0); return { fetched: Object.keys(all).length, lastFetched: last, filtered: ranks(), placedIn: ms, deepInFetched: window.__ncaa in all }`
  ),
  shot('08-ncaam-filtered-placed'),
  run(`await setToggle('Favourites', false); return { errors: await errors() }`)
]

const relaunch = [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await switchTo('NBA'); await board(); document.querySelector('button[title="Saved views"]').click(); await sleep(600); const v = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('My favourites: scoring')); v.click(); await sleep(2500); return { toggle: toggle('Favourites').getAttribute('aria-pressed'), ranks: ranks(), footer: footer() }`
  ),
  shot('09-view-reopened'),
  // The empty states: a league with no favourite (none starred in it is simulated by none of the kind:
  // the Teams board of NCAA Men has none), and the chart's.
  run(
    `await switchTo('NCAA Men'); await nav('Leaderboards'); await sleep(1500); const all = [...document.querySelectorAll('button[title="Open the full board"]')]; all.at(-1).click(); await until(() => document.querySelectorAll('tbody tr').length > 5, 20000); await setToggle('Favourites', true); await sleep(1000); return { empty: document.querySelector('main .py-16')?.textContent.trim() ?? null }`
  ),
  shot('10-empty-teams'),
  run(`await setToggle('Favourites', false); return { errors: await errors() }`)
]

// The board and the chart, timed: the board opened from the home (off), the toggle turned on, and the
// chart's toggle. On origin/main only the board's opening is timed.
const timing = (withToggle) => [
  { size: [1500, 950] },
  { wait: 9000 },
  ev(HELPERS),
  run(
    `await switchTo('NBA'); const out = { open: [], on: [] }; for (let i = 0; i < 15; i++) { await nav('Glossary'); await sleep(400); await nav('Leaderboards'); await sleep(800); const b = document.querySelector('button[title="Open the full board"]'); const t0 = performance.now(); b.click(); await until(() => document.querySelectorAll('tbody tr').length >= 50, 20000); out.open.push(Math.round(performance.now() - t0)); ${withToggle ? `const t = toggle('Favourites'); const t1 = performance.now(); t.click(); await until(() => document.querySelectorAll('tbody tr').length < 50, 20000); out.on.push(Math.round(performance.now() - t1)); t.click(); await sleep(300);` : ''} } const med = (a) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null; return { openMedian: med(out.open), onMedian: med(out.on), ...out }`
  ),
  ...(withToggle
    ? [
        // NCAA Men: the toggle turned on, until the player placed past the fetched rows shows.
        run(
          `await switchTo('NCAA Men'); await board(); const fav = await window.api.favourites.all(); const deep = fav.ncaam.find((f) => f.name !== 'Cooper Flagg'); const out = []; for (let i = 0; i < 10; i++) { const t = toggle('Favourites'); const t0 = performance.now(); t.click(); await until(() => Object.keys(ranks()).includes(deep.name), 15000); out.push(Math.round(performance.now() - t0)); t.click(); await sleep(400) } const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]; return { ncaamPlacedMedian: med(out), out }`
        )
      ]
    : []),
  run(`return { errors: await errors() }`)
]

writeFileSync(join(out, 't1601d-filters-steps.json'), JSON.stringify(filters, null, 2) + '\n')
writeFileSync(join(out, 't1601d-relaunch-steps.json'), JSON.stringify(relaunch, null, 2) + '\n')
writeFileSync(join(out, 't1601d-timing-steps.json'), JSON.stringify(timing(true), null, 2) + '\n')
writeFileSync(
  join(out, 't1601d-timing-main-steps.json'),
  JSON.stringify(timing(false), null, 2) + '\n'
)
console.log('written')
