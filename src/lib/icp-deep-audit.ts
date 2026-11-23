// Collects the public data the full audit needs. Each Google call uses its own SKU's free
// monthly allowance: Place Details for the lead, Nearby Search for 3 competitors.
import type { DeepAuditData, Social } from '@/lib/icp-audit-areas'

export type DeepAuditLead = {
  google_place_id: string | null
  website: string | null
  location_text: string | null
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const SOCIAL_RE: Record<Social, RegExp> = {
  facebook: /facebook\.com\/(?!sharer|share|plugins|tr\b|dialog)[\w.-]+/i,
  instagram: /instagram\.com\/[\w.-]+/i,
  tiktok: /tiktok\.com\/@[\w.-]+/i,
  youtube: /youtube\.com\/(@|c\/|channel\/|user\/)[\w.-]+/i,
  linkedin: /linkedin\.com\/(company|in)\/[\w.-]+/i,
  yelp: /yelp\.com\/biz\/[\w.-]+/i,
  x: /(twitter|x)\.com\/(?!share|intent)[\w]+/i,
}

const digits = (v: string) => v.replace(/\D/g, '').slice(-10)

/** Signals read from a site's home page HTML. Pure, for tests. */
export function siteSignals(html: string, opts: { city: string | null; googlePhone: string | null }): Omit<DeepAuditData['site'], 'state' | 'url' | 'https'> {
  const lower = html.toLowerCase()
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').toLowerCase()
  const city = (opts.city || '').split(',')[0].trim().toLowerCase()
  const years = Array.from(html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)).map((m) => Number(m[1]))
  const telNumbers = Array.from(html.matchAll(/href=["']tel:([^"']+)["']/gi)).map((m) => digits(m[1]))
  const googleDigits = opts.googlePhone ? digits(opts.googlePhone) : ''
  const bodyDigits = html.replace(/<[^>]+>/g, ' ').replace(/\D/g, '')
  return {
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    tapToCall: telNumbers.length > 0,
    form: /<form[\s>]|request (a )?(quote|estimate)|get (a )?(free )?(quote|estimate)|contact us/i.test(html),
    bookingSoftware: /vagaro|booksy|jobber|housecallpro|mindbody|acuityscheduling|calendly|square(up)?\.(com|site)\/appointments|schedulicity|styleseat|glossgenius|fresha|servicetitan|setmore|opentable|resy\.com|tock\.com|book (now|online|an? appointment)|schedule (service|online|now)/i.test(html),
    titleHasCity: Boolean(city) && title.includes(city),
    metaDescription: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html),
    logo: /<img[^>]+(logo)[^>]*>/i.test(html) || /class=["'][^"']*logo/i.test(html),
    favicon: /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html),
    previewImage: /<meta[^>]+property=["']og:image["']/i.test(html),
    copyrightYear: years.length ? Math.max(...years) : null,
    analytics: /googletagmanager\.com\/gtag|gtag\(['"]config['"],\s*['"]G-|googletagmanager\.com\/gtm|google-analytics\.com|plausible\.io|clarity\.ms/i.test(html),
    adsPixel: /googleadservices|AW-\d{6,}|connect\.facebook\.net|fbq\(|tiktok\.com\/i18n\/pixel|ttq\./i.test(html),
    emailSignup: /newsletter|subscribe|mailchimp|klaviyo|constantcontact|join our (email|mailing) list/i.test(lower),
    payments: /stripe\.com|js\.stripe|paypal\.com|squareup\.com|square\.site|clover\.com|pay (online|now|your (bill|invoice))/i.test(html),
    chat: /tawk\.to|intercom|livechat|tidio|drift\.com|crisp\.chat|podium|birdeye|textus|text us|sms:/i.test(html),
    phoneMatchesGoogle: !googleDigits ? null : telNumbers.includes(googleDigits) || bodyDigits.includes(googleDigits),
    socials: (Object.keys(SOCIAL_RE) as Social[]).filter((s) => SOCIAL_RE[s].test(html)),
  }
}

async function getHtml(url: string): Promise<{ state: 'ok' | 'unreadable' | 'dead'; html: string; finalUrl: string }> {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) })
    const html = (await r.text()).slice(0, 600_000)
    const finalUrl = r.url || url
    if (r.ok && html.length > 500) return { state: 'ok', html, finalUrl }
    if (r.ok || [401, 403, 429].includes(r.status)) return { state: 'unreadable', html: '', finalUrl }
    return { state: 'dead', html: '', finalUrl }
  } catch {
    return { state: 'dead', html: '', finalUrl: url }
  }
}

async function placeDetails(id: string, key: string) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'id,rating,userRatingCount,photos,regularOpeningHours,websiteUri,nationalPhoneNumber,primaryType,location',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new Error(`Place Details ${r.status}`)
  return (await r.json()) as Record<string, any>
}

async function nearbyCompetitors(selfId: string, type: string, location: { latitude: number; longitude: number }, key: string) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount' },
    body: JSON.stringify({
      includedTypes: [type],
      maxResultCount: 6,
      rankPreference: 'POPULARITY',
      locationRestriction: { circle: { center: location, radius: 8000 } },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) return []
  const data = (await r.json()) as { places?: Array<Record<string, any>> }
  return (data.places || [])
    .filter((p) => p.id !== selfId)
    .map((p) => ({ name: p.displayName?.text || 'Nearby business', rating: p.rating ?? null, reviews: p.userRatingCount ?? null }))
    .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))
    .slice(0, 3)
}

async function pageSpeed(url: string, key: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${key}`,
      { signal: AbortSignal.timeout(45_000) }
    )
    if (!r.ok) return null
    const d = (await r.json()) as { lighthouseResult?: { categories?: { performance?: { score?: number } } } }
    const score = d.lighthouseResult?.categories?.performance?.score
    return typeof score === 'number' ? Math.round(score * 100) : null
  } catch {
    return null
  }
}

export async function collectDeepAudit(lead: DeepAuditLead, keys: { places: string; pagespeed: string }): Promise<DeepAuditData> {
  const details = lead.google_place_id ? await placeDetails(lead.google_place_id, keys.places).catch(() => null) : null
  const google: DeepAuditData['google'] = {
    found: Boolean(details),
    rating: details?.rating ?? null,
    reviews: details?.userRatingCount ?? null,
    photos: Array.isArray(details?.photos) ? details.photos.length : null,
    hasHours: Boolean(details?.regularOpeningHours),
    hasWebsite: Boolean(details?.websiteUri),
    hasPhone: Boolean(details?.nationalPhoneNumber),
    phone: details?.nationalPhoneNumber || null,
    primaryType: details?.primaryType || null,
    location: details?.location || null,
  }

  const siteUrl = lead.website || details?.websiteUri || null
  const url = siteUrl ? (siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`) : null
  const [home, speed, competitors] = await Promise.all([
    url ? getHtml(url) : Promise.resolve(null),
    url ? pageSpeed(url, keys.pagespeed) : Promise.resolve(null),
    google.primaryType && google.location && details?.id
      ? nearbyCompetitors(details.id, google.primaryType, google.location, keys.places).catch(() => [])
      : Promise.resolve([]),
  ])

  const empty = siteSignals('', { city: null, googlePhone: null })
  const site: DeepAuditData['site'] = home
    ? {
        ...(home.state === 'ok' ? siteSignals(home.html, { city: lead.location_text, googlePhone: google.phone }) : empty),
        state: home.state,
        url: home.finalUrl,
        https: home.finalUrl.startsWith('https://'),
      }
    : { ...empty, state: 'none', url: null, https: false, phoneMatchesGoogle: null }

  return { collectedAt: new Date().toISOString(), google, site, speed: home?.state === 'ok' ? speed : null, competitors }
}
