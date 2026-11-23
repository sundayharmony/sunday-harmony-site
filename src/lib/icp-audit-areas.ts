// The full audit template: every business is checked across the same 6 areas.
// Pure code from public data collected by icp-deep-audit.ts. No AI, no prices.

export type Social = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'yelp' | 'x'

export type DeepAuditData = {
  collectedAt: string
  google: {
    found: boolean
    rating: number | null
    reviews: number | null
    photos: number | null
    hasHours: boolean
    hasWebsite: boolean
    hasPhone: boolean
    phone: string | null
    primaryType: string | null
    location: { latitude: number; longitude: number } | null
  }
  site: {
    state: 'none' | 'dead' | 'ok' | 'unreadable'
    url: string | null
    https: boolean
    viewport: boolean
    tapToCall: boolean
    form: boolean
    bookingSoftware: boolean
    titleHasCity: boolean
    metaDescription: boolean
    logo: boolean
    favicon: boolean
    previewImage: boolean
    copyrightYear: number | null
    analytics: boolean
    adsPixel: boolean
    emailSignup: boolean
    payments: boolean
    chat: boolean
    phoneMatchesGoogle: boolean | null
    socials: Social[]
  }
  speed: number | null
  competitors: Array<{ name: string; rating: number | null; reviews: number | null }>
  brandReview?: { verdict: 'strong' | 'dated' | 'inconsistent'; note: string } | null
}

export type CheckStatus = 'pass' | 'fail' | 'unknown'
export type AuditCheck = { label: string; status: CheckStatus; note: string }
export type AreaKey = 'google' | 'website' | 'branding' | 'social' | 'marketing' | 'systems'
export type PackageName = 'Business Launch' | 'Business Essentials' | 'Marketing Partner' | 'Custom Solutions'
export type AuditArea = { key: AreaKey; title: string; score: number | null; checks: AuditCheck[]; fixedBy: PackageName; why: string }

const pass = (label: string, note = ''): AuditCheck => ({ label, status: 'pass', note })
const fail = (label: string, note: string): AuditCheck => ({ label, status: 'fail', note })
const unknown = (label: string, note: string): AuditCheck => ({ label, status: 'unknown', note })
const check = (ok: boolean, label: string, failNote: string, passNote = ''): AuditCheck => (ok ? pass(label, passNote) : fail(label, failNote))

function areaScore(checks: AuditCheck[]): number | null {
  const scored = checks.filter((c) => c.status !== 'unknown')
  if (!scored.length) return null
  return Math.round((100 * scored.filter((c) => c.status === 'pass').length) / scored.length)
}

const SOCIAL_NAMES: Record<Social, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', yelp: 'Yelp', x: 'X',
}

export function buildAreas(d: DeepAuditData, now = new Date()): AuditArea[] {
  const g = d.google
  const s = d.site
  const live = s.state === 'ok'
  const hasSite = s.state === 'ok' || s.state === 'unreadable'
  const noSiteNote = 'There is no working website to check.'

  const google: AuditCheck[] = g.found
    ? [
        check((g.rating ?? 0) >= 4.3, 'Rating of 4.3 stars or better', `Rated ${g.rating ?? '?'} stars. Below 4.3 loses clicks to better-rated shops.`, `${g.rating?.toFixed(1)} stars`),
        check((g.reviews ?? 0) >= 30, 'At least 30 reviews', `${g.reviews ?? 0} reviews. More reviews build trust fast.`, `${g.reviews} reviews`),
        check((g.photos ?? 0) >= 10, 'At least 10 photos', `Only ${g.photos ?? 0} photos. Photos are one of the first things people look at.`, `${g.photos}+ photos`),
        check(g.hasHours, 'Opening hours listed', 'No hours listed, so people are not sure when to call or visit.'),
        check(g.hasWebsite, 'Website linked', 'No website linked, so people who find you have nowhere to learn more or book.'),
        check(g.hasPhone, 'Phone number listed', 'No phone number on the listing.'),
      ]
    : [fail('Google listing found', 'We could not find a Google listing for this business, so local searchers will not find you.')]

  const year = now.getFullYear()
  const website: AuditCheck[] = !hasSite
    ? [fail('Has a working website', s.state === 'dead' ? 'The website does not load, so visitors hit a dead end.' : 'No website, so you depend on Google alone.')]
    : !live
      ? [pass('Has a working website', 'The site loads, but blocked our deeper checks.')]
      : [
          pass('Has a working website'),
          check(s.viewport, 'Works on phones', 'Not set up for phone screens. Most local searches happen on a phone.'),
          d.speed == null ? unknown('Loads fast on phones', 'Speed test did not finish.') : check(d.speed >= 50, 'Loads fast on phones', `Google speed score ${d.speed}/100 on phones. Slow sites lose visitors before they load.`, `Google speed score ${d.speed}/100`),
          check(s.https, 'Secure (https)', 'Browsers show "Not secure", which makes some visitors leave.'),
          check(s.tapToCall, 'Tap-to-call phone number', 'No tap-to-call link, so phone visitors have to copy your number.'),
          check(s.titleHasCity, 'City in the page title', 'Your city is not in the page title, which helps you show up in local search.'),
          check(s.metaDescription, 'Search description written', 'No search description, so Google picks random text to show under your name.'),
          s.copyrightYear == null
            ? unknown('Updated recently', 'No date found on the site.')
            : check(year - s.copyrightYear <= 1, 'Updated recently', `The site still says ${s.copyrightYear}, so it looks out of date.`),
        ]

  const branding: AuditCheck[] = [
    ...(live
      ? [
          check(s.logo, 'Logo on the website', 'No logo found on the site, so the brand is easy to forget.'),
          check(s.favicon, 'Icon in the browser tab', 'No browser-tab icon, a small sign the site was not finished.'),
          check(s.previewImage, 'Branded preview when the link is shared', 'Shared links show no image, so they look bare on Facebook and in texts.'),
          s.phoneMatchesGoogle == null
            ? unknown('Same phone on Google and website', 'Could not compare.')
            : check(s.phoneMatchesGoogle, 'Same phone on Google and website', 'The phone on your site and on Google do not match, which confuses customers and Google.'),
        ]
      : [fail('A website that carries your brand', hasSite ? 'The site blocked our brand checks.' : 'Without a website, your brand lives only in your sign and Google photos.')]),
    d.brandReview
      ? check(d.brandReview.verdict === 'strong', 'Brand looks current and consistent', d.brandReview.note, d.brandReview.note)
      : unknown('Brand looks current and consistent', 'Reviewed on your free call.'),
  ]

  const found = s.socials
  const social: AuditCheck[] = live
    ? [
        check(found.includes('facebook'), 'Facebook page', 'No Facebook page linked from your website.'),
        check(found.includes('instagram'), 'Instagram', 'No Instagram linked. It is where people check your recent work.'),
        check(found.includes('tiktok') || found.includes('youtube'), 'Video (TikTok or YouTube)', 'No video channel. Short videos are the cheapest way to get seen locally.'),
        check(found.includes('yelp'), 'Yelp listing linked', 'No Yelp link. Many customers check Yelp before calling.'),
      ]
    : [fail('Social pages linked from Google or a website', 'Customers who find you on Google have no path to your social pages.')]

  const comp = d.competitors.filter((c) => c.reviews != null)
  const topReviews = comp.length ? Math.max(...comp.map((c) => c.reviews as number)) : null
  const marketing: AuditCheck[] = [
    live ? check(s.analytics, 'Tracks website visitors', 'No analytics, so there is no way to know where customers come from.') : fail('Tracks website visitors', noSiteNote),
    live ? check(s.adsPixel, 'Running online ads', 'No ad tracking found, so you are likely not running Google or Facebook ads.') : unknown('Running online ads', 'Could not check without a website.'),
    live ? check(s.emailSignup, 'Collects customer emails', 'No email signup, so past customers are never reminded to come back.') : fail('Collects customer emails', noSiteNote),
    topReviews == null || g.reviews == null
      ? unknown('Reviews vs nearby competitors', 'No nearby competitors to compare.')
      : check(g.reviews >= topReviews, 'Reviews vs nearby competitors', `The top nearby competitor has ${topReviews} reviews to your ${g.reviews}.`, `You lead nearby competitors with ${g.reviews} reviews`),
  ]

  const systems: AuditCheck[] = live
    ? [
        check(s.bookingSoftware, 'Online booking', 'No online booking, so after-hours customers have to call back.'),
        check(s.form, 'Quote or contact form', 'No form to request a quote or ask a question.'),
        check(s.payments, 'Online payments', 'No way to pay or leave a deposit online.'),
        check(s.chat, 'Instant message or chat', 'No chat or text-us button to catch quick questions.'),
      ]
    : [
        fail('Online booking', noSiteNote),
        fail('Quote or contact form', noSiteNote),
        fail('Online payments', noSiteNote),
      ]

  const launch: PackageName = hasSite ? 'Business Essentials' : 'Business Launch'
  return [
    { key: 'google', title: 'Google profile', checks: google, score: areaScore(google), fixedBy: launch, why: 'Set up and fill in your Google profile so it turns searches into calls.' },
    { key: 'website', title: 'Website', checks: website, score: areaScore(website), fixedBy: launch, why: hasSite ? 'Fix the site you have so it works on phones and gets found.' : 'A fast website you own, built to turn visitors into calls and bookings.' },
    { key: 'branding', title: 'Branding', checks: branding, score: areaScore(branding), fixedBy: hasSite ? 'Business Essentials' : 'Business Launch', why: 'A logo, colors and look that match the quality of your work, everywhere.' },
    { key: 'social', title: 'Social media', checks: social, score: areaScore(social), fixedBy: 'Marketing Partner', why: 'Set up and post on the channels your customers use, every month.' },
    { key: 'marketing', title: 'Marketing', checks: marketing, score: areaScore(marketing), fixedBy: 'Marketing Partner', why: 'Tracking, reviews and simple campaigns so you know what brings customers in.' },
    { key: 'systems', title: 'Systems', checks: systems, score: areaScore(systems), fixedBy: hasSite ? 'Custom Solutions' : 'Business Launch', why: 'Booking, forms and payments that capture customers even when you are busy.' },
  ]
}

export function overallScore(areas: AuditArea[]): number | null {
  const scored = areas.filter((a) => a.score != null)
  if (!scored.length) return null
  return Math.round(scored.reduce((sum, a) => sum + (a.score as number), 0) / scored.length)
}

/** Packages that fix the weak areas (score under 70), in order of first weak area. */
export function planFor(areas: AuditArea[]): Array<{ name: PackageName; areas: string[]; why: string[] }> {
  const plan = new Map<PackageName, { areas: string[]; why: string[] }>()
  for (const area of areas) {
    if (area.score == null || area.score >= 70) continue
    const entry = plan.get(area.fixedBy) || { areas: [], why: [] }
    entry.areas.push(area.title)
    entry.why.push(area.why)
    plan.set(area.fixedBy, entry)
  }
  return Array.from(plan, ([name, v]) => ({ name, ...v }))
}

export function socialName(s: Social): string {
  return SOCIAL_NAMES[s]
}
