/** Same-origin relative path only. Blocks protocol-relative and absolute URLs. */
export function sanitizeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s.startsWith('/') || s.startsWith('//')) return null
  if (s.includes('..') || s.includes('\\')) return null
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return null
  if (/^[a-z]+:/i.test(s)) return null

  try {
    const u = new URL(s, 'https://placeholder.invalid')
    if (u.origin !== 'https://placeholder.invalid') return null
    return `${u.pathname}${u.search}${u.hash}` || '/'
  } catch {
    return null
  }
}

/**
 * Login `callbackUrl` query values. Defaults to `/` when missing or unsafe
 * (open redirect via `https://…` or `//evil.example`).
 */
export function sanitizeLoginCallbackUrl(raw: string | null | undefined): string {
  return sanitizeInternalPath(raw) || '/'
}

/** Same-origin paths only; used for notification links from the API/DB. */
export function sanitizeNotificationLink(raw: string | null | undefined): string | null {
  const path = sanitizeInternalPath(raw)
  if (!path) return null
  const pathname = path.split(/[?#]/)[0]
  const allowed =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  if (!allowed) return null
  return path
}
