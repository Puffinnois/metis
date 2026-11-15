// Draws the app icon from build/icon.svg and writes every file the build and the window read:
//   build/icon.ico      Windows: the executable, the installer and its shortcuts (16 to 256 px)
//   build/icon.png      Linux packages, 512 px
//   resources/icon.png  the window and taskbar, 256 px
// Chromium draws the SVG at each size in a hidden window, so no image library is needed. Run it
// with Electron; in WSL set ELECTRON_DISABLE_SANDBOX=1.
// usage: npx electron scripts/make-icon.mjs
//        npx electron scripts/make-icon.mjs --sheet <out.png> <icon.svg>
// The second form draws a preview of one SVG at 256, 48, 32 and 16 px (and 16 px enlarged) on a
// light and a dark strip, which is how the candidates were compared.
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

// Runs in the hidden page: draws the SVG at each size and returns its pixels and a PNG of each.
const RASTER = `async (svg, sizes) => {
  const img = new Image()
  img.src = 'data:image/svg+xml;base64,' + btoa(svg)
  await img.decode()
  const b64 = (bytes) => {
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }
  return sizes.map((n) => {
    const c = document.createElement('canvas')
    c.width = c.height = n
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, n, n)
    return { n, rgba: b64(g.getImageData(0, 0, n, n).data), png: c.toDataURL('image/png').split(',')[1] }
  })
}`

// Runs in the hidden page: one preview strip per background, each showing the sizes side by side.
const SHEET = `async (svg) => {
  const img = new Image()
  img.src = 'data:image/svg+xml;base64,' + btoa(svg)
  await img.decode()
  const at = (n) => {
    const c = document.createElement('canvas')
    c.width = c.height = n
    c.getContext('2d').drawImage(img, 0, 0, n, n)
    return c
  }
  const sizes = [256, 48, 32, 16]
  const gap = 24
  const width = gap + sizes.reduce((s, n) => s + n + gap, 0) + 64 + gap
  const strip = 256 + 2 * gap
  const sheet = document.createElement('canvas')
  sheet.width = width
  sheet.height = 2 * strip
  const g = sheet.getContext('2d')
  ;['#fcfdfe', '#0c0f12'].forEach((bg, row) => {
    const top = row * strip
    g.fillStyle = bg
    g.fillRect(0, top, width, strip)
    let x = gap
    for (const n of sizes) {
      g.drawImage(at(n), x, top + gap + 256 - n)
      x += n + gap
    }
    // The 16 px drawing enlarged four times without smoothing, to show its pixels.
    g.imageSmoothingEnabled = false
    g.drawImage(at(16), x, top + gap + 256 - 64, 64, 64)
    g.imageSmoothingEnabled = true
  })
  return sheet.toDataURL('image/png').split(',')[1]
}`

// One ICO entry as a 32-bit DIB: BITMAPINFOHEADER, the pixels bottom-up in BGRA, then the 1-bit
// mask that older readers use instead of alpha. Bitmaps rather than PNG entries, because every
// reader accepts them, NSIS's installer icon included.
function dib(n, rgba) {
  const head = Buffer.alloc(40)
  const maskRow = Math.ceil(n / 32) * 4
  head.writeUInt32LE(40, 0)
  head.writeInt32LE(n, 4)
  head.writeInt32LE(2 * n, 8) // the height counts the pixels and the mask
  head.writeUInt16LE(1, 12)
  head.writeUInt16LE(32, 14)
  head.writeUInt32LE(n * n * 4 + maskRow * n, 20)
  const pixels = Buffer.alloc(n * n * 4)
  const mask = Buffer.alloc(maskRow * n)
  for (let y = 0; y < n; y++) {
    const row = n - 1 - y
    for (let x = 0; x < n; x++) {
      const s = (y * n + x) * 4
      const d = (row * n + x) * 4
      pixels[d] = rgba[s + 2]
      pixels[d + 1] = rgba[s + 1]
      pixels[d + 2] = rgba[s]
      pixels[d + 3] = rgba[s + 3]
      if (rgba[s + 3] < 128) mask[row * maskRow + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return Buffer.concat([head, pixels, mask])
}

function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // type 1: icon
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  const bodies = images.map(({ n, rgba }) => dib(n, rgba))
  let offset = header.length + dir.length
  images.forEach(({ n }, i) => {
    const e = i * 16
    dir.writeUInt8(n >= 256 ? 0 : n, e) // 0 means 256
    dir.writeUInt8(n >= 256 ? 0 : n, e + 1)
    dir.writeUInt16LE(1, e + 4)
    dir.writeUInt16LE(32, e + 6)
    dir.writeUInt32LE(bodies[i].length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += bodies[i].length
  })
  return Buffer.concat([header, dir, ...bodies])
}

async function main() {
  const args = process.argv.slice(process.argv.findIndex((a) => a.endsWith('make-icon.mjs')) + 1)
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await win.loadURL('about:blank')
  const run = (fn, ...a) =>
    win.webContents.executeJavaScript(`(${fn})(${a.map((x) => JSON.stringify(x)).join(',')})`)

  if (args[0] === '--sheet') {
    const [, out, svgPath] = args
    const png = await run(SHEET, readFileSync(svgPath, 'utf8'))
    writeFileSync(out, Buffer.from(png, 'base64'))
    console.log(`wrote ${out}`)
    return
  }

  const svg = readFileSync(join(ROOT, 'build/icon.svg'), 'utf8')
  const drawn = await run(RASTER, svg, [...ICO_SIZES, 512])
  const bySize = new Map(drawn.map((d) => [d.n, d]))
  const images = ICO_SIZES.map((n) => ({ n, rgba: Buffer.from(bySize.get(n).rgba, 'base64') }))
  const files = {
    'build/icon.ico': ico(images),
    'build/icon.png': Buffer.from(bySize.get(512).png, 'base64'),
    'resources/icon.png': Buffer.from(bySize.get(256).png, 'base64')
  }
  for (const [path, bytes] of Object.entries(files)) {
    writeFileSync(join(ROOT, path), bytes)
    console.log(`wrote ${path} (${bytes.length} bytes)`)
  }
}

app
  .whenReady()
  .then(main)
  .then(
    () => app.quit(),
    (err) => {
      console.error(err)
      app.exit(1)
    }
  )
