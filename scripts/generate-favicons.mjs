import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import toIco from 'to-ico'

const root = path.resolve(import.meta.dirname, '..')
const logoPath = path.join(root, 'public/logo-white.png')
const outPublic = path.join(root, 'public')
const outApp = path.join(root, 'src/app')

/** Square crop centered on the SH monogram (top of brand mark). */
async function monogramSquare() {
  const meta = await sharp(logoPath).metadata()
  const size = Math.min(meta.width ?? 587, meta.height ?? 587)
  const left = Math.max(0, Math.floor(((meta.width ?? size) - size) / 2))
  return sharp(logoPath).extract({ left, top: 0, width: size, height: size }).png()
}

async function writePng(pipeline, filePath, size) {
  const buf = await pipeline.clone().resize(size, size, { fit: 'cover' }).png().toBuffer()
  await writeFile(filePath, buf)
  return buf
}

async function main() {
  await mkdir(outPublic, { recursive: true })
  await mkdir(outApp, { recursive: true })

  const square = await monogramSquare()
  const png16 = await writePng(square, path.join(outPublic, 'favicon-16x16.png'), 16)
  const png32 = await writePng(square, path.join(outPublic, 'favicon-32x32.png'), 32)
  await writePng(square, path.join(outPublic, 'apple-touch-icon.png'), 180)

  const ico = await toIco([png16, png32])
  await writeFile(path.join(outPublic, 'favicon.ico'), ico)
  await writeFile(path.join(outApp, 'favicon.ico'), ico)

  // Next.js file convention for Apple touch icon
  await writeFile(path.join(outApp, 'apple-icon.png'), await square.clone().resize(180, 180).png().toBuffer())

  console.log('Generated favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
