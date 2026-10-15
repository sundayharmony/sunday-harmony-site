import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import toIco from 'to-ico'

const root = path.resolve(import.meta.dirname, '..')
const logoPath = path.join(root, 'public/logo-white.png')
const outPublic = path.join(root, 'public')
const outApp = path.join(root, 'src/app')

/** Crop to the white SH monogram, leaving the wordmark out of the favicon. */
async function monogramSquare() {
  const { data, info } = await sharp(logoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const rowHasInk = (y) => {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] > 40 && data[i] > 180) return true
    }
    return false
  }
  let top = 0
  while (top < height && !rowHasInk(top)) top++
  let bottom = top
  let gap = 0
  for (let y = top; y < height; y++) {
    if (rowHasInk(y)) {
      bottom = y
      gap = 0
    } else {
      gap++
      if (gap > 12) break
    }
  }
  let left = width
  let right = 0
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] > 40 && data[i] > 180) {
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  const pad = 8
  const extractLeft = Math.max(0, left - pad)
  const extractTop = Math.max(0, top - pad)
  const extractWidth = Math.min(width - extractLeft, right - left + 1 + pad * 2)
  const extractHeight = Math.min(height - extractTop, bottom - top + 1 + pad * 2)
  return sharp(logoPath).extract({
    left: extractLeft,
    top: extractTop,
    width: extractWidth,
    height: extractHeight,
  }).png()
}

/** White monogram on an opaque black tile with rounded corners. */
async function onBlackRounded(size) {
  const radius = Math.max(2, Math.round(size * 0.22))
  const pad = Math.max(1, Math.round(size * 0.14))
  const inner = Math.max(1, size - pad * 2)
  const logo = await (await monogramSquare())
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#000000"/>
    </svg>`
  )
  return sharp(plate).composite([{ input: logo, gravity: 'centre' }]).png().toBuffer()
}

async function writePng(filePath, size) {
  const buf = await onBlackRounded(size)
  await writeFile(filePath, buf)
  return buf
}

async function main() {
  await mkdir(outPublic, { recursive: true })
  await mkdir(outApp, { recursive: true })

  const png16 = await writePng(path.join(outPublic, 'favicon-16x16.png'), 16)
  const png32 = await writePng(path.join(outPublic, 'favicon-32x32.png'), 32)
  const png48 = await writePng(path.join(outPublic, 'favicon-48x48.png'), 48)
  await writePng(path.join(outPublic, 'apple-touch-icon.png'), 180)
  await writePng(path.join(outApp, 'apple-icon.png'), 180)
  await writePng(path.join(outApp, 'icon.png'), 192)

  const ico = await toIco([png16, png32, png48])
  await writeFile(path.join(outPublic, 'favicon.ico'), ico)
  await writeFile(path.join(outApp, 'favicon.ico'), ico)

  console.log('Generated favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
