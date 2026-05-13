/** Same-origin paths only; used for notification links from the API/DB. */
export function sanitizeNotificationLink(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s.startsWith('/') || s.startsWith('//')) return null
  if (s.includes('..') || s.includes('\\')) return null
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return null
  if (/^[a-z]+:/i.test(s)) return null

  let pathname: string
  let search = ''
  let hash = ''
  try {
    const u = new URL(s, 'https://placeholder.invalid')
    pathname = u.pathname
    search = u.search
    hash = u.hash
  } catch {
    return null
  }

  const allowed =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  if (!allowed) return null

  return `${pathname}${search}${hash}`
}
