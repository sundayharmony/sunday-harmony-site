// Free online audit built from a lead's ICP score data. Pure code, public business data only.
import { createHmac } from 'node:crypto'
import { provenDemand, type IcpOffer } from '@/lib/icp-score'
import { buildAreas, overallScore, planFor, type AuditArea, type DeepAuditData, type PackageName } from '@/lib/icp-audit-areas'
import { getPublicSiteUrl } from '@/lib/public-site-url'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export type AuditLead = {
  id: string
  business: string
  location_text: string | null
  icp_score: number | null
  icp_data: {
    gaps?: string[]
    offer?: IcpOffer
    place?: { rating?: number | null; reviewCount?: number | null; address?: string | null; photoCount?: number | null } | null
    audit?: DeepAuditData | null
  } | null
}

/** hook: the finding as one plain sentence for the email, e.g. "your Google listing has no website". */
export type AuditFinding = { title: string; detail: string; fix: string; hook: string }

export type Audit = {
  business: string
  location: string | null
  rating: number | null
  reviewCount: number | null
  strengths: string[]
  findings: AuditFinding[]
  nextStep: { name: string; detail: string }
  /** Full 6-area audit, present once icp_data.audit has been collected. */
  areas: AuditArea[] | null
  overall: number | null
  plan: Array<{ name: PackageName; areas: string[]; why: string[] }>
  competitors: DeepAuditData['competitors']
}

const FINDINGS: Record<string, Omit<AuditFinding, 'title'> & { title?: string }> = {
  'No website': {
    hook: 'your Google listing has no website',
    detail: 'People who find you on Google have nowhere to read about your services or book.',
    fix: 'A simple site you own with your services, photos, reviews and a clear way to call or book.',
  },
  'Website is down': {
    hook: 'the website on your Google listing does not load',
    title: 'Your website does not load',
    detail: 'The site linked from your Google listing does not open, so people who click it hit a dead end.',
    fix: 'Bring the site back, or replace it with a fast one you own and control.',
  },
  'Google listing links to the wrong website': {
    hook: 'your Google listing links to the wrong website',
    detail: 'The website on your Google listing is not the one you use, so clicks go to the wrong place.',
    fix: 'Point your Google listing at the right site.',
  },
  'Website not built for phones': {
    hook: 'your website is hard to use on a phone',
    detail: 'Your site is not set up for phone screens, so text and buttons are hard to use on a phone.',
    fix: 'A layout that works on phones, with tap-to-call up top.',
  },
  'No booking or quote form': {
    hook: 'there is no way to book or ask for a quote on your website',
    detail: 'There is no way to book or ask for a quote on the site, so visitors after hours have to remember to call back.',
    fix: 'Add online booking or a short quote form that reaches you right away.',
  },
  'Website not secure (no https)': {
    hook: 'browsers mark your website as "Not secure"',
    detail: 'Browsers mark your site as "Not secure", which makes some visitors leave.',
    fix: 'Turn on https so the site shows as secure.',
  },
  'Few photos on Google profile': {
    hook: 'your Google profile has only a few photos',
    detail: 'Your Google profile has only a few photos, and photos are one of the first things people look at.',
    fix: 'Add recent photos of your work, your team and your location.',
  },
}

const NEXT_STEP: Record<IcpOffer, { name: string; detail: string }> = {
  business_launch: {
    name: 'Business Launch',
    detail: 'A new website and Google profile set up together, so people who find you can book you.',
  },
  business_essentials: {
    name: 'Business Essentials',
    detail: 'Fix the gaps above on your current site and Google profile.',
  },
  marketing_partner: {
    name: 'Marketing Partner',
    detail: 'Monthly help keeping your site, Google profile and reviews working for you.',
  },
}

export function buildAudit(lead: AuditLead): Audit {
  const data = lead.icp_data || {}
  const rating = data.place?.rating ?? null
  const reviewCount = data.place?.reviewCount ?? null
  const findings = (data.gaps || [])
    .filter((gap) => FINDINGS[gap])
    .map((gap) => ({ title: FINDINGS[gap].title || gap, detail: FINDINGS[gap].detail, fix: FINDINGS[gap].fix, hook: FINDINGS[gap].hook }))
  const strengths: string[] = []
  if (provenDemand(rating, reviewCount)) {
    strengths.push(`${rating!.toFixed(1)} stars from ${reviewCount} Google reviews. Customers already like your work.`)
  }
  if (!(data.gaps || []).length) strengths.push('No major gaps found on your website or Google profile.')
  const deep = data.audit || null
  const areas = deep ? buildAreas(deep) : null
  return {
    business: lead.business,
    location: lead.location_text || null,
    rating,
    reviewCount,
    strengths,
    findings,
    nextStep: NEXT_STEP[data.offer || 'business_essentials'],
    areas,
    overall: areas ? overallScore(areas) : null,
    plan: areas ? planFor(areas) : [],
    competitors: deep?.competitors || [],
  }
}

function auditSecret(): string {
  const secret = (process.env.AUDIT_LINK_SECRET || process.env.NEXTAUTH_SECRET || '').trim()
  if (!secret) throw new Error('AUDIT_LINK_SECRET or NEXTAUTH_SECRET must be set')
  return secret
}

function sign(leadId: string, secret: string): string {
  return createHmac('sha256', secret).update(`audit:${leadId}`).digest('base64url').slice(0, 24)
}

/** Unguessable link token for one lead's audit: `<leadId>.<signature>`. */
export function auditToken(leadId: string, secret = auditSecret()): string {
  return `${leadId}.${sign(leadId, secret)}`
}

/** Returns the lead id if the token is valid, else null. */
export function verifyAuditToken(token: string, secret = auditSecret()): string | null {
  const [leadId, sig, extra] = decodeURIComponent(token).split('.')
  if (!leadId || !sig || extra !== undefined || !/^[0-9a-f-]{36}$/i.test(leadId)) return null
  return timingSafeStringEqual(sig, sign(leadId, secret)) ? leadId : null
}

export function auditUrl(leadId: string, siteUrl = getPublicSiteUrl()): string {
  return `${siteUrl}/audit/${auditToken(leadId)}`
}
