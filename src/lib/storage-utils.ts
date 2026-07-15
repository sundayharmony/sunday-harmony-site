export function extensionFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return 'bin'
  return name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

export function effectiveContentType(contentType: string, originalFileName: string, pdfMime = 'application/pdf'): string {
  let ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct && ct !== 'application/octet-stream') return ct
  const ext = extensionFromName(originalFileName)
  if (ext === 'pdf') return pdfMime
  if (ext === 'txt') return 'text/plain'
  return ct || 'application/octet-stream'
}

export function scanPdfBuffer(buffer: Buffer): { ok: true } | { ok: false; reason: string } {
  if (buffer.length < 5) return { ok: false, reason: 'File too small or empty' }
  if (buffer.subarray(0, 5).toString() !== '%PDF-') {
    return { ok: false, reason: 'File content does not match declared PDF type' }
  }

  const mzIndex = buffer.indexOf(Buffer.from('MZ'))
  if (mzIndex >= 0 && mzIndex < buffer.length - 64) {
    const peOffset = buffer.readUInt32LE(mzIndex + 0x3c)
    if (peOffset > 0 && peOffset < buffer.length - 4) {
      const peSignature = buffer.subarray(peOffset, peOffset + 4).toString()
      if (peSignature === 'PE\0\0') {
        return { ok: false, reason: 'Executable content detected' }
      }
    }
  }

  return { ok: true }
}

export function hasSafeStoragePathSegments(storagePath: string): boolean {
  if (!storagePath || storagePath.includes('\\')) return false
  return storagePath
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}
