// Runs the built app on a scratch profile with remote debugging, follows a list of steps over the
// DevTools protocol and saves screenshots. Build first; in WSL set ELECTRON_DISABLE_SANDBOX=1.
// example: node scripts/drive.mjs /tmp/metis-profile scripts/smoke-steps.json /tmp/metis-shots
// usage: node drive.mjs <profile dir> <steps.json> <shots dir>
// steps: {size:[w,h]} {wait:ms} {click:"text or selector"} {hover:"exact text"} {type:"text"}
//        {select:["select title", "value"]} {eval:"js"} {shot:"name"}
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [profile, stepsFile, shots] = process.argv.slice(2).map((p) => resolve(p))
const APP = resolve(process.env.APP ?? '.')
mkdirSync(shots, { recursive: true })
const port = 9333
const args = [
  APP,
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  '--ozone-platform=x11'
]
const child = spawn(join(APP, 'node_modules/.bin/electron'), args, {
  stdio: ['ignore', 'pipe', 'pipe']
})
let log = ''
child.stdout.on('data', (d) => (log += d))
child.stderr.on('data', (d) => (log += d))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500)
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    target = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
  } catch {
    // not listening yet
  }
}
if (!target) {
  console.log('the app did not start\n', log.slice(-2000))
  child.kill()
  process.exit(1)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id
    pending.set(n, r)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description
}
const find = (what) => `(() => {
  const want = ${JSON.stringify(what)}
  let el = null
  try { el = document.querySelector(want) } catch {}
  const named = (sel) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === want)
  // Controls first: a wrapper whose only text is its button's would match too.
  return el ?? named('button,[role=tab]') ?? named('th,label,span,div')
})()`

for (const s of JSON.parse(readFileSync(stepsFile, 'utf8'))) {
  if (s.size)
    await send('Emulation.setDeviceMetricsOverride', {
      width: s.size[0],
      height: s.size[1],
      deviceScaleFactor: 1,
      mobile: false
    })
  if (s.wait) await sleep(s.wait)
  if (s.click)
    console.log(
      s.click,
      await evaluate(
        `(() => { const el = ${find(s.click)}; if (!el) return 'NOT FOUND'; el.click(); return 'clicked' })()`
      )
    )
  if (s.hover) {
    const at = await evaluate(
      `(() => { const el = ${find(s.hover)}; if (!el) return null; const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })()`
    )
    if (!at) console.log(s.hover, 'NOT FOUND')
    else
      for (const dx of [-3, 0])
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at[0] + dx, y: at[1] })
  }
  if (s.type) await send('Input.insertText', { text: s.type })
  // {key:["KeyN", "N", 78, modifiers]} modifiers: alt 1, ctrl 2, meta 4, shift 8
  if (s.key) {
    const [code, key, vk, modifiers] = s.key
    for (const type of ['rawKeyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', {
        type,
        code,
        key,
        windowsVirtualKeyCode: vk,
        modifiers
      })
  }
  // {drag:[x1,y1,x2,y2]}
  if (s.drag) {
    const [x1, y1, x2, y2] = s.drag
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1 })
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: x1,
      y: y1,
      button: 'left',
      buttons: 1,
      clickCount: 1
    })
    for (let i = 1; i <= 8; i++)
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: x1 + ((x2 - x1) * i) / 8,
        y: y1 + ((y2 - y1) * i) / 8,
        button: 'left',
        buttons: 1
      })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: x2,
      y: y2,
      button: 'left',
      buttons: 0,
      clickCount: 1
    })
  }
  if (s.select)
    console.log(
      s.select.join(' = '),
      await evaluate(`(() => {
      const el = [...document.querySelectorAll('select')].find((x) => x.title === ${JSON.stringify(s.select[0])})
      if (!el) return 'NOT FOUND'
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(s.select[1])})
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return 'set'
    })()`)
    )
  if (s.eval) console.log('eval:', JSON.stringify(await evaluate(s.eval)))
  if (s.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(shots, `${s.shot}.png`), Buffer.from(r.result.data, 'base64'))
    console.log('shot', s.shot)
  }
}
ws.close()
child.kill('SIGTERM')
await sleep(1500)
child.kill('SIGKILL')
writeFileSync(join(shots, 'app.log'), log)
