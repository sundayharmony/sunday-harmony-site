import { heroStats, heroSubtext, packages, services, siteConfig } from '@/lib/data'

export const SEARCH_HEADLINE_MAX = 30
export const SEARCH_DESCRIPTION_MAX = 90

export const AD_LAYOUTS = [
  'heroQuote',
  'ctaBlock',
  'serviceSpotlight',
  'statProof',
  'packagePromo',
  'search',
  'social',
] as const

export type AdLayout = (typeof AD_LAYOUTS)[number]

export const AD_CHANNELS = [
  'homepage',
  'meta',
  'google',
  'instagram',
  'linkedin',
  'walk-in',
] as const

export type AdChannel = (typeof AD_CHANNELS)[number]

export interface CampaignAdStat {
  value: string
  label: string
}

export interface CampaignAd {
  id: string
  label: string
  layout: AdLayout
  channels: AdChannel[]
  source: 'live' | 'new'
  headline: string
  body: string
  ctaLabel: string
  badge?: string
  accentPhrase?: string
  footer?: string
  icon?: string
  tier?: string
  price?: string
  stats?: CampaignAdStat[]
}

const siteHost = siteConfig.url.replace(/^https?:\/\//, '')
const freeAuditCta = 'Get Your Free Audit →'
const proofStats: CampaignAdStat[] = heroStats.map((stat) => ({
  value: stat.value,
  label: stat.label,
}))

const liveAds: CampaignAd[] = [
  {
    id: 'hero-homepage',
    label: 'Hero (homepage)',
    layout: 'heroQuote',
    channels: ['homepage', 'meta', 'instagram'],
    source: 'live',
    badge: siteConfig.tagline,
    headline: 'Stop guessing at marketing.',
    accentPhrase: 'Start growing with clarity.',
    body: heroSubtext,
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'cta-homepage',
    label: 'CTA banner (homepage)',
    layout: 'ctaBlock',
    channels: ['homepage', 'meta', 'linkedin'],
    source: 'live',
    headline: 'Ready to stop doing it all',
    accentPhrase: 'yourself?',
    body: "Get a free audit of your online presence — we'll show you exactly what's working, what's not, and how to fix it. No strings attached.",
    ctaLabel: freeAuditCta,
    footer: siteConfig.email,
  },
]

const newHeroAds: CampaignAd[] = [
  {
    id: 'hero-customers-searching',
    label: 'Customers are searching',
    layout: 'heroQuote',
    channels: ['homepage', 'meta', 'instagram', 'google'],
    source: 'new',
    badge: siteConfig.tagline,
    headline: 'Customers are already searching.',
    accentPhrase: 'Make sure they find you.',
    body: 'A practical review of how people find you today, and the highest-impact fixes first. No long-term contracts. No jargon.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-stop-posting',
    label: 'Stop posting and hoping',
    layout: 'heroQuote',
    channels: ['meta', 'instagram', 'linkedin'],
    source: 'new',
    badge: siteConfig.tagline,
    headline: 'Stop posting and hoping.',
    accentPhrase: 'Start a plan that brings customers.',
    body: 'We handle strategy, content, and reporting so you can get back to running the business.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-one-partner',
    label: 'One partner',
    layout: 'heroQuote',
    channels: ['meta', 'linkedin'],
    source: 'new',
    badge: siteConfig.tagline,
    headline: "You don't need more tools.",
    accentPhrase: 'You need one partner who runs them.',
    body: 'Local SEO, social, ads, and reviews in one place, with plain-English updates you can actually use.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-agency-vanish',
    label: 'Agencies that vanish',
    layout: 'heroQuote',
    channels: ['meta', 'linkedin'],
    source: 'new',
    badge: 'Real local growth',
    headline: 'Tired of agencies that vanish after the pitch?',
    accentPhrase: 'Work with people who show their work.',
    body: 'Transparent reporting, monthly strategy, and a real person who knows your business.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-busy-owner',
    label: 'Too busy to market',
    layout: 'heroQuote',
    channels: ['meta', 'instagram', 'walk-in'],
    source: 'new',
    badge: siteConfig.tagline,
    headline: 'Too busy running the business',
    accentPhrase: 'to figure out marketing too.',
    body: 'One partner for strategy, execution, and reporting. You stay focused. We keep the pipeline moving.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-ads-spend',
    label: 'Ads you can explain',
    layout: 'heroQuote',
    channels: ['meta', 'google', 'linkedin'],
    source: 'new',
    badge: 'Paid ads with a plan',
    headline: "Stop buying ads you can't explain.",
    accentPhrase: 'Start spending with a plan.',
    body: 'We set up, test, and track Google and Meta campaigns so every dollar has a job.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-google-overnight',
    label: 'Google listing overnight',
    layout: 'heroQuote',
    channels: ['google', 'meta', 'walk-in'],
    source: 'new',
    badge: 'Local SEO',
    headline: 'Your Google listing works overnight.',
    accentPhrase: 'Or it costs you customers.',
    body: 'We tighten your Google Business Profile, reviews, and local search so nearby buyers can find you.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'hero-reviews',
    label: 'Reviews are your best ad',
    layout: 'heroQuote',
    channels: ['meta', 'instagram', 'google'],
    source: 'new',
    badge: 'Reputation',
    headline: 'Your reviews are your best ad.',
    accentPhrase: "Let's make sure they keep coming.",
    body: 'Monitor, respond, and grow reviews on Google and Yelp so trust works for you, not against you.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
]

const newCtaAds: CampaignAd[] = [
  {
    id: 'cta-whats-working',
    label: "See what's working",
    layout: 'ctaBlock',
    channels: ['homepage', 'meta', 'linkedin'],
    source: 'new',
    headline: "Ready to see what's actually",
    accentPhrase: 'working?',
    body: "Get a free audit of your online presence. We'll show you what's helping, what's hurting, and what to fix first.",
    ctaLabel: freeAuditCta,
    footer: siteConfig.email,
  },
  {
    id: 'cta-clear-plan',
    label: 'Clear plan',
    layout: 'ctaBlock',
    channels: ['meta', 'linkedin', 'instagram'],
    source: 'new',
    headline: 'Want a clear plan, not',
    accentPhrase: 'another guess?',
    body: 'No jargon. No vanity metrics. A prioritized list of next steps tailored to your market and goals.',
    ctaLabel: freeAuditCta,
    footer: siteConfig.email,
  },
  {
    id: 'cta-midnight-social',
    label: 'Social at midnight',
    layout: 'ctaBlock',
    channels: ['instagram', 'meta'],
    source: 'new',
    headline: 'Still doing social at',
    accentPhrase: 'midnight?',
    body: 'Hand off the posting, the calendar, and the comments. Keep the customers. Get your evenings back.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'cta-understand',
    label: 'Marketing you can follow',
    layout: 'ctaBlock',
    channels: ['linkedin', 'meta'],
    source: 'new',
    headline: 'Ready for marketing you can',
    accentPhrase: 'actually follow?',
    body: 'Plain-English reports, real next steps, and a partner who does not disappear after the kickoff call.',
    ctaLabel: freeAuditCta,
    footer: siteConfig.email,
  },
  {
    id: 'cta-more-customers',
    label: 'More customers',
    layout: 'ctaBlock',
    channels: ['meta', 'google', 'walk-in'],
    source: 'new',
    headline: 'Need more customers without',
    accentPhrase: 'another late night?',
    body: 'Get a free audit. We will show you exactly how people find you today and the fastest path to more of the right ones.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
]

const serviceAds: CampaignAd[] = services.map((service, index) => ({
  id: `service-${index}-${slug(service.title)}`,
  label: `Service: ${service.title}`,
  layout: 'serviceSpotlight' as const,
  channels: ['instagram', 'meta', 'linkedin'] as AdChannel[],
  source: 'new' as const,
  icon: service.icon,
  headline: service.title,
  body: service.description,
  ctaLabel: freeAuditCta,
  footer: siteHost,
}))

const packageAds: CampaignAd[] = packages.map((pkg, index) => ({
  id: `package-${index}-${slug(pkg.tier)}`,
  label: `Package: ${pkg.tier}`,
  layout: 'packagePromo' as const,
  channels: ['meta', 'linkedin', 'walk-in'] as AdChannel[],
  source: 'new' as const,
  tier: pkg.tier,
  headline: pkg.tagline,
  price: `$${pkg.price}/mo`,
  body: pkg.ideal,
  ctaLabel: 'See Packages →',
  footer: siteHost,
}))

const proofAds: CampaignAd[] = [
  {
    id: 'stat-why-sunday-harmony',
    label: 'Why Sunday Harmony',
    layout: 'statProof',
    channels: ['homepage', 'linkedin', 'walk-in'],
    source: 'new',
    headline: 'Why Sunday Harmony?',
    body: 'No long-term contracts. Transparent reporting. Real local growth.',
    ctaLabel: freeAuditCta,
    footer: siteConfig.tagline,
    stats: proofStats,
  },
  {
    id: 'stat-proof-clarity',
    label: 'Proof with clarity',
    layout: 'statProof',
    channels: ['meta', 'linkedin'],
    source: 'new',
    headline: 'Clarity over guesswork.',
    body: 'A+ service, years in the work, and 150+ businesses that wanted a partner, not another black box.',
    ctaLabel: freeAuditCta,
    footer: siteConfig.tagline,
    stats: proofStats,
  },
]

const searchAds: CampaignAd[] = [
  {
    id: 'search-stop-guessing',
    label: 'Search: stop guessing',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    headline: 'Stop Guessing at Marketing',
    body: 'Free audit of your online presence. See what to fix first. No long-term contracts.',
    ctaLabel: 'Get Your Free Audit',
    footer: siteHost,
  },
  {
    id: 'search-free-audit',
    label: 'Search: free audit',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    headline: 'Get Your Free Audit',
    body: "We'll show what's working, what's not, and how to grow. Plain English. No strings.",
    ctaLabel: 'Request Free Audit',
    footer: siteHost,
  },
  {
    id: 'search-get-found',
    label: 'Search: get found',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    headline: 'Get Found Near You',
    body: 'Local SEO, Google Business, and reviews that help nearby customers choose you.',
    ctaLabel: 'See How You Show Up',
    footer: siteHost,
  },
  {
    id: 'search-one-partner',
    label: 'Search: one partner',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    headline: 'One Partner. Real Growth.',
    body: 'Strategy, ads, social, and reporting from one team. Start with a free audit.',
    ctaLabel: 'Get Your Free Audit',
    footer: siteHost,
  },
  {
    id: 'search-stop-yourself',
    label: 'Search: stop doing it all',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    headline: 'Stop Doing It All Yourself',
    body: 'Hand off marketing to a partner who shows the work. Free audit. No obligation.',
    ctaLabel: 'Get Your Free Audit',
    footer: siteHost,
  },
  {
    id: 'search-clarity',
    label: 'Search: grow with clarity',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    headline: 'Grow With Clarity',
    body: 'All-in-one marketing with transparent reporting and a 24-hour response.',
    ctaLabel: 'Get Your Free Audit',
    footer: siteHost,
  },
]

const socialAds: CampaignAd[] = [
  {
    id: 'social-near-me',
    label: 'Social: near me',
    layout: 'social',
    channels: ['instagram', 'meta'],
    source: 'new',
    headline: 'They are searching “near me.”',
    accentPhrase: 'Are you showing up?',
    body: 'Free audit of your Google presence. 15 minutes. No pitch deck. Just what to fix.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'social-guessing',
    label: 'Social: stop guessing',
    layout: 'social',
    channels: ['instagram', 'meta', 'linkedin'],
    source: 'new',
    headline: 'Stop guessing at marketing.',
    accentPhrase: 'Start growing with clarity.',
    body: 'Same promise as the homepage. One partner. Free audit. Clear next steps.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'social-yourself',
    label: 'Social: do it yourself',
    layout: 'social',
    channels: ['instagram', 'meta'],
    source: 'new',
    headline: 'Ready to stop doing it all',
    accentPhrase: 'yourself?',
    body: 'If marketing is still on your plate every night, it is time for a partner.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
  {
    id: 'social-audit-offer',
    label: 'Social: free audit offer',
    layout: 'social',
    channels: ['instagram', 'meta', 'walk-in'],
    source: 'new',
    badge: 'No obligation',
    headline: "What's in your free audit",
    body: 'Google Business, website basics, social consistency, ad spend, and a plain-English roadmap.',
    ctaLabel: 'Request your free audit',
    footer: '24hr response',
  },
  {
    id: 'social-walk-in',
    label: 'Walk-in card',
    layout: 'social',
    channels: ['walk-in'],
    source: 'new',
    badge: 'Free Marketing Audit',
    headline: 'We already looked you up.',
    accentPhrase: 'Want to see what we found?',
    body: 'No charge. No obligation. A short review of your Google listing and the fastest fixes.',
    ctaLabel: freeAuditCta,
    footer: siteHost,
  },
]

export const campaignAds: CampaignAd[] = [
  ...liveAds,
  ...newHeroAds,
  ...newCtaAds,
  ...serviceAds,
  ...packageAds,
  ...proofAds,
  ...searchAds,
  ...socialAds,
]

export const HOMEPAGE_MID_AD_ID = 'hero-customers-searching'

export function getCampaignAd(id: string): CampaignAd {
  const ad = campaignAds.find((item) => item.id === id)
  if (!ad) {
    throw new Error(`Unknown campaign ad: ${id}`)
  }
  return ad
}

export function adsForLayout(layout: AdLayout): CampaignAd[] {
  return campaignAds.filter((ad) => ad.layout === layout)
}

export function adsForChannel(channel: AdChannel): CampaignAd[] {
  return campaignAds.filter((ad) => ad.channels.includes(channel))
}

export function adsForSource(source: CampaignAd['source']): CampaignAd[] {
  return campaignAds.filter((ad) => ad.source === source)
}

export function formatCampaignAdText(ad: CampaignAd): string {
  const lines = [
    ad.badge,
    [ad.headline, ad.accentPhrase].filter(Boolean).join(' '),
    ad.tier && ad.price ? `${ad.tier} · ${ad.price}` : ad.price,
    ad.stats?.map((stat) => `${stat.value} ${stat.label}`).join(' · '),
    ad.body,
    ad.ctaLabel,
    ad.footer,
  ]
  return lines.filter((line) => Boolean(line && String(line).trim())).join('\n\n')
}

export function searchAdWithinLimits(ad: CampaignAd): boolean {
  if (ad.layout !== 'search') return true
  return ad.headline.length <= SEARCH_HEADLINE_MAX && ad.body.length <= SEARCH_DESCRIPTION_MAX
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
