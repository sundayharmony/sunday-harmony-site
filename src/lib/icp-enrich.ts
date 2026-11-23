// Looks a lead up on Google Places, checks its website, finds an email, then scores it.
// Public business data only. Uses GOOGLE_PLACES_API_KEY, else GOOGLE_API_KEY (Places API (New)).
import { promises as dns } from 'node:dns'
import { htmlSignals, pickEmail, scoreLead, type IcpResult } from '@/lib/icp-score'

export type LeadForIcp = {
  id: string
  business: string
  industry: string | null
  location_text: string | null
  website: string | null
  email: string | null
  phone: string | null
}

export type IcpEnrichment = {
  result: IcpResult
  place: {
    id: string
    name: string
    rating: number | null
    reviewCount: number | null
    status: string | null
    website: string | null
    phone: string | null
    address: string | null
    photoCount: number
  } | null
  siteUrl: string | null
  emailFound: string | null
  emailMx: boolean | null
}

const PLACES_FIELDS = [
  'places.id',
  'places.displayName',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.formattedAddress',
  'places.photos',
].join(',')

const STOP = new Set(['the', 'and', 'of', 'llc', 'inc', 'co', 'shop', 'store', '&'])
function tokens(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t))
}

async function lookupPlace(lead: LeadForIcp, key: string): Promise<IcpEnrichment['place']> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELDS },
    body: JSON.stringify({ textQuery: [lead.business, lead.location_text].filter(Boolean).join(' '), maxResultCount: 1 }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Places ${response.status}`)
  const data = (await response.json()) as { places?: Array<Record<string, any>> }
  const p = data.places?.[0]
  if (!p) return null
  const name: string = p.displayName?.text || ''
  const want = tokens(lead.business)
  if (want.length && !tokens(name).some((t) => want.includes(t))) return null
  return {
    id: p.id,
    name,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    status: p.businessStatus || null,
    website: p.websiteUri || null,
    phone: p.nationalPhoneNumber || null,
    address: p.formattedAddress || null,
    photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

/** ok: readable page · blocked: answers but shows bots a challenge (site works) · dead: no answer or 404/5xx. */
async function getHtml(url: string): Promise<{ state: 'ok' | 'blocked' | 'dead'; html: string; finalUrl: string }> {
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) })
    const html = (await response.text()).slice(0, 400_000)
    const finalUrl = response.url || url
    if (response.ok && html.length > 500) return { state: 'ok', html, finalUrl }
    if (response.ok || [401, 403, 429].includes(response.status)) return { state: 'blocked', html: '', finalUrl }
    return { state: 'dead', html: '', finalUrl }
  } catch {
    return { state: 'dead', html: '', finalUrl: url }
  }
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

async function hasMx(email: string): Promise<boolean> {
  try {
    return (await dns.resolveMx(email.split('@')[1])).length > 0
  } catch {
    return false
  }
}

export async function enrichLead(lead: LeadForIcp, key: string): Promise<IcpEnrichment> {
  const place = await lookupPlace(lead, key)
  const leadHost = hostOf(lead.website)
  const placeHost = hostOf(place?.website || null)
  const siteUrl = lead.website || place?.website || null
  const wrongLink = Boolean(leadHost && placeHost && leadHost !== placeHost)

  let site: 'none' | 'dead' | 'ok' | 'unreadable' = 'none'
  let signals = { hasViewport: false, hasBookingOrForm: false, paysForSoftware: false, runsAds: false }
  let https = false
  let emailFound: string | null = null
  if (siteUrl) {
    const home = await getHtml(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`)
    site = home.state === 'ok' ? 'ok' : home.state === 'blocked' ? 'unreadable' : 'dead'
    https = home.finalUrl.startsWith('https://')
    if (home.state === 'ok') {
      signals = htmlSignals(home.html)
      const host = hostOf(home.finalUrl)
      emailFound = pickEmail(home.html, host)
      if (!emailFound) {
        const contact = await getHtml(new URL('/contact', home.finalUrl).toString())
        if (contact.state === 'ok') emailFound = pickEmail(contact.html, host)
      }
    }
  }

  const email = lead.email || emailFound
  const emailMx = email ? await hasMx(email) : null
  const result = scoreLead({
    industry: lead.industry || '',
    business: lead.business,
    rating: place?.rating ?? null,
    reviewCount: place?.reviewCount ?? null,
    businessStatus: place?.status ?? null,
    placeFound: Boolean(place),
    photoCount: place?.photoCount ?? null,
    site,
    wrongLink,
    https,
    ...signals,
    email: email && emailMx ? email : null,
    phone: lead.phone || place?.phone || null,
  })
  return { result, place, siteUrl, emailFound, emailMx }
}
