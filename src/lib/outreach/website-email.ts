import { emailDomain, isJunkMailbox, normalizeEmail } from './email-address'

const EMBEDDED_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PREFERRED_LOCAL = ['info', 'hello', 'contact', 'owner', 'office', 'inquiries', 'inquiry', 'sales']

export function usableWebsite(value: string | null | undefined): string | null {
  const raw = (value || '').trim()
  if (!raw || /^(n\/a|na|none|not found|unknown|no website|-)$/i.test(raw)) return null
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withProto)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null
  if (isPrivateAddress(host)) return null
  url.hash = ''
  url.search = ''
  return url.toString()
}

function isPrivateAddress(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false
  const parts = match.slice(1).map((part) => Number(part))
  if (parts.some((part) => part > 255)) return true
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function websiteHost(website: string): string {
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function sameSite(email: string, host: string): boolean {
  if (!host) return false
  const domain = emailDomain(email).replace(/^www\./, '')
  return domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`)
}

/** Pick a published contact address from a page. Prefer the business's own domain. */
export function pickPublishedEmail(html: string, website: string): string | null {
  const host = websiteHost(website)
  const found = new Set<string>()
  const mailto = html.matchAll(/mailto:([^"'?\s>]+)/gi)
  for (const match of mailto) {
    let raw = match[1]
    try {
      raw = decodeURIComponent(raw)
    } catch {
      raw = match[1]
    }
    const email = normalizeEmail(raw)
    if (email && !isJunkMailbox(email)) found.add(email)
  }
  const plain = html.match(EMBEDDED_EMAIL) || []
  for (const match of plain) {
    const email = normalizeEmail(match)
    if (email && !isJunkMailbox(email)) found.add(email)
  }
  const list = [...found]
  if (list.length === 0) return null
  const onSite = list.filter((email) => sameSite(email, host))
  const pool = onSite.length ? onSite : list.length === 1 ? list : []
  if (pool.length === 0) return null
  const preferred = pool.find((email) => PREFERRED_LOCAL.includes(email.slice(0, email.indexOf('@'))))
  return preferred || pool[0]
}

function pageUrls(website: string): string[] {
  const origin = usableWebsite(website)
  if (!origin) return []
  const root = new URL(origin)
  const contact = new URL('/contact', root)
  const contactUs = new URL('/contact-us', root)
  return [...new Set([root.toString(), contact.toString(), contactUs.toString()])]
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html',
        'user-agent': 'SundayHarmonyOutreach/1.0',
      },
    })
    if (!response.ok) return null
    const type = response.headers.get('content-type') || ''
    if (type && !type.includes('text/html') && !type.includes('text/plain')) return null
    return (await response.text()).slice(0, 400_000)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Read a public contact address from the business site. Returns null when none is published. */
export async function discoverEmailFromWebsite(website: string): Promise<string | null> {
  for (const url of pageUrls(website)) {
    const html = await fetchHtml(url)
    if (!html) continue
    const email = pickPublishedEmail(html, website)
    if (email) return email
  }
  return null
}
