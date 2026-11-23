// ICP scoring (claude/sunday-harmony-icp.md). Pure code, no AI, no network.
// 100 points: industry 25 · reviews 20 · visible gap 20 · pays for software/ads 15 · size 10 · reachable 10.
// Bands: 70+ call then email · 50–69 email only · under 50 or failed gate: don't contact.

export type IcpBand = 'call' | 'email' | 'no_contact' | 'disqualified'
export type IcpOffer = 'business_launch' | 'business_essentials' | 'marketing_partner'

export type IcpInput = {
  industry: string
  business: string
  rating: number | null
  reviewCount: number | null
  businessStatus: string | null // Places: OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  placeFound: boolean
  photoCount: number | null
  site: 'none' | 'dead' | 'ok' | 'unreadable'
  wrongLink: boolean
  hasViewport: boolean
  https: boolean
  hasBookingOrForm: boolean
  paysForSoftware: boolean
  runsAds: boolean
  email: string | null
  phone: string | null
}

export type IcpResult = {
  score: number
  band: IcpBand
  offer: IcpOffer
  factors: { industry: number; reviews: number; gap: number; spend: number; size: number; reachable: number }
  gaps: string[]
  reasons: string[]
}

const BEST_FIT =
  /hvac|plumb|electric|roof|landscap|hardscap|lawn|pool|pest|cleaning|remodel|painting|drywall|handyman|septic|irrigation|auto repair|auto body|collision|detailing|tint|wrap|transmission|tire|brake|upholster|med ?spa|dental|dentist|chiropract|lash|brow|fitness|pilates|barre|venue|event|catering|wedding|real estate|insurance|tax|bookkeep|moving|funeral|marina|boatyard|boat repair|tree/
const LOWER_FIT =
  /pizz|diner|bakery|bakeshop|baker|coffee|caf[eé]|deli|bagel|ice cream|custard|gelato|hot dog|sandwich|hoagie|sub shop|burger|convenience|grocery|liquor|barber|nail|takeout|carryout|snack|juice|smoothie|tea|donut|wings|cheesesteak|luncheonette|breakfast|farm stand|market stall/
const FRANCHISE =
  /\b(jiffy lube|midas|meineke|firestone|pep boys|valvoline|monro|goodyear|great clips|supercuts|sport clips|fantastic sams|domino'?s|papa john'?s|pizza hut|little caesars|dunkin|starbucks|subway|mcdonald'?s|wendy'?s|burger king|1-800-flowers|servpro|roto-rooter|mr\.? rooter|one hour heating|molly maid|merry maids|massage envy|european wax|orangetheory|planet fitness|anytime fitness|h&r block|jackson hewitt|state farm|allstate|re\/max|keller williams|coldwell banker|century 21)\b/

export function industryTier(industry: string): 25 | 12 | 5 {
  const text = industry.toLowerCase()
  if (BEST_FIT.test(text)) return 25
  if (LOWER_FIT.test(text)) return 5
  return 12
}

export function isFranchise(business: string): boolean {
  return FRANCHISE.test(business.toLowerCase())
}

export function provenDemand(rating: number | null, reviewCount: number | null): boolean {
  return rating != null && reviewCount != null && rating >= 4.3 && reviewCount >= 30
}

function reviewPoints(rating: number | null, count: number | null): number {
  if (!provenDemand(rating, count)) return 0
  return Math.round(10 + 10 * Math.min(1, ((count as number) - 30) / 70))
}

const BOOKING_SOFTWARE =
  /square(up)?\.(com|site)|vagaro|booksy|jobber|housecallpro|housecall pro|mindbody|acuityscheduling|calendly|toasttab|clover\.com|opentable|resy\.com|schedulicity|styleseat|glossgenius|fresha|servicetitan|setmore|getjobber|squarespace scheduling|tock\.com/i
const ADS_SIGNALS = /googleadservices|gtag\(['"]config['"],\s*['"]AW-|AW-\d{6,}|connect\.facebook\.net|fbq\(/i
const BOOKING_OR_FORM = /<form[\s>]|book (now|online|an? appointment)|request (a )?(quote|estimate)|schedule (service|online|now)|get (a )?(free )?(quote|estimate)/i

/** Signals read from a site's HTML. */
export function htmlSignals(html: string): { hasViewport: boolean; hasBookingOrForm: boolean; paysForSoftware: boolean; runsAds: boolean } {
  return {
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasBookingOrForm: BOOKING_OR_FORM.test(html) || BOOKING_SOFTWARE.test(html),
    paysForSoftware: BOOKING_SOFTWARE.test(html),
    runsAds: ADS_SIGNALS.test(html),
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|@(sentry|wixpress|example|domain|email)\.|^(noreply|no-reply|donotreply)@/i

/** Picks the best contact email from page text, preferring the site's own domain. */
export function pickEmail(html: string, siteHost: string | null): string | null {
  const found = Array.from(new Set((html.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))).filter((e) => !BAD_EMAIL.test(e))
  if (!found.length) return null
  const host = (siteHost || '').replace(/^www\./, '')
  return found.find((e) => host && e.endsWith(`@${host}`)) || found[0]
}

export function bandFor(score: number): IcpBand {
  if (score >= 70) return 'call'
  if (score >= 50) return 'email'
  return 'no_contact'
}

export function scoreLead(input: IcpInput): IcpResult {
  const reasons: string[] = []
  const gaps: string[] = []

  const industry = industryTier(input.industry)
  const reviews = reviewPoints(input.rating, input.reviewCount)

  if (input.site === 'none') gaps.push('No website')
  if (input.site === 'dead') gaps.push('Website is down')
  if (input.wrongLink) gaps.push('Google listing links to the wrong website')
  if (input.site === 'ok') {
    if (!input.hasViewport) gaps.push('Website not built for phones')
    if (!input.hasBookingOrForm) gaps.push('No booking or quote form')
    if (!input.https) gaps.push('Website not secure (no https)')
  }
  if (input.placeFound && (input.photoCount ?? 0) < 5) gaps.push('Few photos on Google profile')

  let gap = 0
  if (input.site === 'none' || input.site === 'dead' || input.wrongLink) gap = 20
  else if (input.site === 'ok') {
    if (!input.hasViewport) gap += 10
    if (!input.hasBookingOrForm) gap += 5
    if (!input.https) gap += 5
  }
  if (input.placeFound && (input.photoCount ?? 0) < 5) gap += 5
  gap = Math.min(20, gap)

  const spend = (input.paysForSoftware ? 8 : 0) + (input.runsAds ? 7 : 0)
  // Places has no headcount, so review volume stands in for size until we check locations/staff.
  const count = input.reviewCount ?? 0
  const size = count >= 200 ? 10 : count >= 100 ? 5 : 0
  const reachable = input.email ? 10 : input.phone ? 5 : 0

  const score = industry + reviews + gap + spend + size + reachable
  let band = bandFor(score)

  if (input.businessStatus && input.businessStatus !== 'OPERATIONAL') {
    band = 'disqualified'
    reasons.push(`Google says ${input.businessStatus.toLowerCase().replace(/_/g, ' ')}`)
  } else if (isFranchise(input.business)) {
    band = 'disqualified'
    reasons.push('Franchise or chain')
  } else if (!input.email && !input.phone) {
    band = 'disqualified'
    reasons.push('No phone or email')
  } else if (!input.placeFound) {
    if (band !== 'no_contact') reasons.push('No Google listing found, so demand is unproven')
    band = 'no_contact'
  } else if (!provenDemand(input.rating, input.reviewCount)) {
    if (band !== 'no_contact') reasons.push('Under 4.3★ or 30 reviews, so demand is unproven')
    band = 'no_contact'
  } else if (band === 'email' && !input.email) {
    reasons.push('Email band but no email found; call instead')
  }

  const offer: IcpOffer =
    input.site === 'none' || input.site === 'dead' || input.wrongLink
      ? 'business_launch'
      : gap >= 10 || input.site === 'unreadable'
        ? 'business_essentials'
        : 'marketing_partner'

  return { score, band, offer, factors: { industry, reviews, gap, spend, size, reachable }, gaps, reasons }
}
