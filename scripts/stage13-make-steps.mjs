// Writes Stage 13's gate steps for every screen on four leagues: node scripts/stage13-make-steps.mjs
// One file, run on a profile holding all four leagues: T1301.9's steps (the NBA and the WNBA), T1302.9's
// (both college leagues), then the player link in each state with a check each: the strip, the hint, the
// league menu's move both ways, the search's rows from the paired league, and Back.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const read = (name) => JSON.parse(readFileSync(join(DIR, name), 'utf8'))

// The helpers T1304.4 drove the switch and the search with, taken from its generator as written.
const made = readFileSync(join(DIR, 't1304d-make-steps.mjs'), 'utf8')
const HELPERS = made.match(/const HELPERS = `([\s\S]*?)`\n/)[1]
const EXTRA = `
window.hint = () => [...document.querySelectorAll('main header button')].find((b) => b.textContent.endsWith('↓')) ?? null;
window.check = (label, ok, got) => (ok ? 'OK ' : 'MISMATCH ') + label + ' got ' + JSON.stringify(got);
window.tab = (name) => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent === name);
'link helpers ready'`

const ev = (js) => ({ eval: js })
const shot = (name) => ({ shot: name })
const step = (label, body, ok) =>
  ev(
    `(async () => { const got = await (async () => { ${body} })(); return check(${JSON.stringify(label)}, (${ok})(got), got) })()`
  )

// A linked player both ways: the page's strip and hint, the hint from another tab, the menu naming
// them on the paired league, the move, Back, and the strip on the college side.
const pair = (pro, proSeason, college, name, hintRe, stripRe, tag) => [
  step(
    `${pro}: ${name}'s page shows the strip and the hint to ${college}`,
    `await openPlayer(${JSON.stringify(pro)}, ${proSeason}, ${JSON.stringify(name)}); tab('Overview')?.click(); await sleep(1500); const s = await linkIn(); await until(() => hint(), 8000); return { ...s, hint: hint()?.textContent ?? null, stripText: stripEl()?.innerText.slice(0, 400) ?? null }`,
    `(g) => g.strip === 'strip' && ${hintRe}.test(g.hint ?? '') && ${stripRe}.test(g.stripText ?? '')`
  ),
  shot(`${tag}-01-${pro.toLowerCase()}-strip`),
  step(
    `${pro}: the hint, used from the Scoring tab, opens the Overview on the strip`,
    `tab('Scoring')?.click(); await sleep(1500); const h = hint(); if (!h) return { error: 'NO HINT' }; h.click(); await until(() => stripEl(), 8000); await sleep(800); return state()`,
    `(g) => g.tab === 'Overview' && g.strip === 'strip'`
  ),
  step(
    `${pro}: the league menu names ${name} on the ${college} item`,
    `return await menu()`,
    `(g) => Array.isArray(g) && g.some((x) => x.text.startsWith(${JSON.stringify(college)}) && x.text.includes(${JSON.stringify(name.split(' ').at(-1))}))`
  ),
  step(
    `${pro} to ${college}: the menu opens ${name}'s college page`,
    `return await pick(${JSON.stringify(college)})`,
    `(g) => g.league === ${JSON.stringify(college)} && (g.heading ?? '').includes(${JSON.stringify(name.split(' ').at(-1))})`
  ),
  shot(`${tag}-02-${college.replace(' ', '-').toLowerCase()}-page`),
  step(
    `${college}: ${name}'s college page shows the strip with the ${pro} seasons`,
    `const s = await linkIn(); return { ...s, stripText: stripEl()?.innerText.slice(0, 600) ?? null }`,
    `(g) => g.strip === 'strip' && /${pro}/.test(g.stripText ?? '')`
  ),
  step(
    `Back returns to ${name} in the ${pro}`,
    `return await goBack()`,
    `(g) => g.league === ${JSON.stringify(pro)} && (g.heading ?? '').includes(${JSON.stringify(name.split(' ').at(-1))})`
  )
]

// The search in a professional league finds a drafted player with no game there among the paired
// college league's players, and the row opens their college page; Back returns.
const search = (pro, college, text, name, tag) => [
  step(
    `${pro}: searching "${text}" lists ${name} under ${college}`,
    `await switchTo(${JSON.stringify(pro)}); await nav('Players'); typeIn(${JSON.stringify(text)}); await until(() => group(), 10000); await sleep(800); return found()`,
    `(g) => /${college}/.test(g.heading ?? '') && g.others.some((x) => x.text.includes(${JSON.stringify(name)}))`
  ),
  shot(`${tag}-01-${pro.toLowerCase()}-search`),
  step(
    `${pro}: the search row opens ${name}'s ${college} page`,
    `const b = [...(group()?.querySelectorAll('button') ?? [])].find((x) => x.textContent.includes(${JSON.stringify(name)})); if (!b) return { error: 'NO ROW' }; b.click(); await until(() => league() === ${JSON.stringify(college)} && careerTable(), 15000); await sleep(1500); return state()`,
    `(g) => g.league === ${JSON.stringify(college)} && (g.heading ?? '').includes(${JSON.stringify(name.split(' ').at(-1))})`
  ),
  step(
    `Back returns to the ${pro}`,
    `const s = await goBack(); typeIn(''); await sleep(800); return s`,
    `(g) => g.league === ${JSON.stringify(pro)}`
  )
]

// Waits until no league is refreshing for 20 s, then 20 s more for the links step after the last.
const settle = ev(
  `(async () => { const t0 = performance.now(); let quiet = null; while (performance.now() - t0 < 900000) { const s = await Promise.all(['nba', 'wnba', 'ncaam', 'ncaaw'].map((l) => window.api.stats.status(l))); if (s.some((x) => x.busy)) quiet = null; else { quiet ??= performance.now(); if (performance.now() - quiet > 20000) break } await new Promise((r) => setTimeout(r, 1000)) } await new Promise((r) => setTimeout(r, 20000)); return 'every league settled after ' + Math.round((performance.now() - t0) / 1000) + ' s' })()`
)

const links = [
  { size: [1500, 950] },
  ev(HELPERS),
  ev(EXTRA),
  ...pair('NBA', 2027, 'NCAA Men', 'Cooper Flagg', '/^NCAA Men: Duke/', '/2024-25/', 'link-a'),
  ...pair('WNBA', 2026, 'NCAA Women', 'Paige Bueckers', '/^NCAA Women: /', '/2024-25/', 'link-b'),
  step(
    'NBA: a player with no link has no strip, no hint and the menu as before',
    `await openPlayer('NBA', 2027, 'LeBron James'); await sleep(3000); return { ...state(), hint: hint()?.textContent ?? null, menu: await menu() }`,
    `(g) => g.strip === null && g.hint === null && !g.menu.some((x) => x.text.includes('James'))`
  ),
  ...search('NBA', 'NCAA Men', 'Saunders', 'Richie Saunders', 'link-c'),
  ...search('WNBA', 'NCAA Women', 'Hsu', 'Abbey Hsu', 'link-d'),
  step(
    'NCAA Men: the search lists its own players, those ranked and those not ranked here, and none of the NBA’s',
    `await switchTo('NCAA Men'); await nav('Players'); await setSelect('Season', 2025); typeIn('Flagg'); await sleep(2000); const f = found(); typeIn(''); await sleep(800); return f`,
    `(g) => g.own.includes('Cooper Flagg') && !/NBA/.test(g.heading ?? '') && g.others.every((x) => !/NBA/.test(x.text + ' ' + x.title))`
  ),
  ev(`(async () => { await switchTo('NBA'); return 'back on the NBA' })()`),
  settle
]

// The launch's refresh of each league, and the links step after it, run before the screens are read
// and are done before the app closes: a pause would interrupt them, and so would closing the app
// under them (each logs that its step failed and the next refresh tries again).
const [size, wait, ...pro] = read('t1301i-every-screen-steps.json')
const [cSize, cWait, ...college] = read('t1302i-every-screen-steps.json')
// T1302.9's check that a college screen names no NBA word or rule reads the page's text; since T1304
// a linked player's page names the NBA on purpose, in the header's hint and the career strip, so its
// text leaves those two out: hidden for the moment of the read, which innerText then skips. Its Data
// panel step reads a helper of its first-load steps.
const COLLEGE_EXTRA = `
window.text = () => { const link = [...document.querySelectorAll('main section[aria-label="College and pro career"]'), ...[...document.querySelectorAll('main header button')].filter((b) => b.textContent.endsWith('\u2193'))]; const was = link.map((x) => x.style.display); link.forEach((x) => (x.style.display = 'none')); const t = main(); link.forEach((x, i) => (x.style.display = was[i])); return t.replace(/\\s+/g, ' ') };
window.section = (name) => document.querySelector('section[aria-label="' + name + '"]');
'college helpers ready'`
const helpersEnd =
  college.findLastIndex((s, i) => i < 6 && /window\.(text|noNba)\s*=/.test(s.eval ?? '')) + 1
college.splice(helpersEnd, 0, ev(COLLEGE_EXTRA))
// Since T1304.3 a college scope starts on "Every game": AJ Dybantsa's 2025-26 page reads 894 points in
// 35 games, 25.5 a game, his NCAA tournament game with his 859 in 34 of the regular season (25.3).
const dybantsa = college.find((s) => String(s.eval ?? '').includes('AJ Dybantsa’s dashboard'))
dybantsa.eval = dybantsa.eval
  .replace(
    '25.3 points a game in the regular season (raw: 859 in 34)',
    '25.5 points a game over every game (raw: 859 in 34 of the regular season, 35 in 1 tournament game)'
  )
  .replace('/25\\.3/.test(text())', '/25\\.5/.test(text())')
if (!dybantsa.eval.includes('/25\\.5/')) throw new Error('the Dybantsa check was not rewritten')
const steps = [size, wait, settle, ...pro, cSize, cWait, ...college, ...links]
writeFileSync(join(DIR, 'stage13-every-screen-steps.json'), JSON.stringify(steps, null, 1) + '\n')
console.log(`stage13-every-screen-steps.json: ${steps.length} steps`)
