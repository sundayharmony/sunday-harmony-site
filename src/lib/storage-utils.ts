export function extensionFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return 'bin'
  return name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

export function effectiveContentType(contentType: string, originalFileName: string, pdfMime = 'application/pdf'): string {
  let ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct && ct !== 'application/octet-stream') return ct
  if (extensionFromName(originalFileName) === 'pdf') return pdfMime
  return ct || 'application/octet-stream'
}
