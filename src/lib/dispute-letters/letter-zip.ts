import { deflateRawSync } from 'node:zlib'

function crc32(data: Uint8Array): number {
  let crc = ~0
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function u16(value: number): Buffer {
  const buf = Buffer.alloc(2)
  buf.writeUInt16LE(value, 0)
  return buf
}

function u32(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value, 0)
  return buf
}

function safeZipStem(stem: string, fallback: string): string {
  return (stem || fallback).replace(/[<>:"/\\|?*]/g, '-').trim().slice(0, 60) || fallback
}

export function uniqueZipFolderName(stem: string, used: Set<string>): string {
  const safe = safeZipStem(stem, 'letter')
  let name = safe
  let n = 2
  while (used.has(name.toLowerCase())) {
    name = `${safe} (${n})`
    n += 1
  }
  used.add(name.toLowerCase())
  return name
}

export function uniqueZipFilename(stem: string, ext: string, used: Set<string>): string {
  const normalizedExt = (ext || 'bin').replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  return `${uniqueZipFolderName(stem, used)}.${normalizedExt}`
}

export function uniqueDocxFilename(stem: string, used: Set<string>): string {
  return uniqueZipFilename(stem || 'letter', 'docx', used)
}

export function isDocxBytes(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b
}

/** Build a ZIP of already-encoded files (deflate). */
export function zipFiles(files: { name: string; data: Uint8Array }[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const uncompressed = Buffer.from(file.data)
    const compressed = deflateRawSync(uncompressed)
    const crc = crc32(uncompressed)
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(uncompressed.length),
      u16(name.length),
      u16(0),
      name,
      compressed,
    ])
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(uncompressed.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const centralDir = Buffer.concat(centrals)
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  return Buffer.concat([...locals, centralDir, eocd])
}
