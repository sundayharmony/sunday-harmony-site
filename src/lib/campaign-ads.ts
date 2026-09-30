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

export const AD_OFFERS = ['marketing', 'credit'] as const

export type AdOffer = (typeof AD_OFFERS)[number]

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
  offer?: AdOffer
  headline: string
  body: string
  ctaLabel: string
  ctaHref?: string
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
const freeCreditCta = 'Get Your Free Credit Analysis →'
const creditIntakeHref = '/credit-funding'
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

const creditHeroAds: CampaignAd[] = [
  {
    id: 'hero-credit-stop-guessing',
    label: 'Credit: stop guessing',
    layout: 'heroQuote',
    channels: ['homepage', 'meta', 'instagram', 'google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'Free credit analysis',
    headline: 'Stop guessing at your credit.',
    accentPhrase: 'Start with a free analysis.',
    body: 'We review your 3-bureau report, show you what is working against you, and outline the first steps in plain English. No obligation.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'hero-credit-report-talking',
    label: 'Credit: report is talking',
    layout: 'heroQuote',
    channels: ['meta', 'instagram', 'linkedin'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'Free credit analysis',
    headline: 'Your credit report is talking.',
    accentPhrase: "Let's show you what it says.",
    body: 'A free analysis of your 3-bureau file: scores, negative items, and the disputes worth starting first.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'hero-credit-holding-back',
    label: 'Credit: holding you back',
    layout: 'heroQuote',
    channels: ['meta', 'google', 'linkedin'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'Credit & Funding',
    headline: "Don't wait to find out what's holding you back.",
    accentPhrase: 'Get a free credit analysis.',
    body: 'See the items, inquiries, and errors that may be blocking funding or a stronger score before you apply.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'hero-credit-negatives',
    label: 'Credit: negatives do not fix themselves',
    layout: 'heroQuote',
    channels: ['meta', 'instagram'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'Free credit analysis',
    headline: 'Negative items do not fix themselves.',
    accentPhrase: 'See what is on your report first.',
    body: 'Upload your official 3-bureau report. We flag collections, charge-offs, and late payments and explain what a dispute can actually challenge.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'hero-credit-wondering',
    label: 'Credit: stop wondering',
    layout: 'heroQuote',
    channels: ['meta', 'linkedin', 'walk-in'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'No obligation',
    headline: "Stop wondering what's on your report.",
    accentPhrase: 'Get a clear credit analysis.',
    body: 'No jargon. No black box. A practical read of your file and a next-step plan you can follow.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'hero-credit-funding-starts',
    label: 'Credit: funding starts here',
    layout: 'heroQuote',
    channels: ['linkedin', 'meta', 'google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'Credit & Funding',
    headline: 'Funding starts with your credit.',
    accentPhrase: 'Start with a free analysis.',
    body: 'We analyze your 3-bureau report first so you know what to repair before you chase a loan or a new line.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
]

const creditCtaAds: CampaignAd[] = [
  {
    id: 'cta-credit-on-report',
    label: 'Credit CTA: on your report',
    layout: 'ctaBlock',
    channels: ['homepage', 'meta', 'linkedin'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: "Ready to see what's actually",
    accentPhrase: 'on your report?',
    body: 'Get a free credit analysis. We will show you what is helping, what is hurting, and what to dispute first.',
    ctaLabel: freeCreditCta,
    footer: siteConfig.email,
  },
  {
    id: 'cta-credit-clear-plan',
    label: 'Credit CTA: clear plan',
    layout: 'ctaBlock',
    channels: ['meta', 'linkedin', 'instagram'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Want a clear credit plan, not',
    accentPhrase: 'another guess?',
    body: 'A free 3-bureau review with plain-English next steps. No long-term contract to get the analysis.',
    ctaLabel: freeCreditCta,
    footer: siteConfig.email,
  },
  {
    id: 'cta-credit-stop-guessing',
    label: 'Credit CTA: stop guessing',
    layout: 'ctaBlock',
    channels: ['meta', 'google', 'instagram'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Ready to stop guessing',
    accentPhrase: 'at your credit?',
    body: 'Upload your official report and get a free analysis of scores, negatives, and the first letters worth sending.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'cta-credit-hurting-score',
    label: 'Credit CTA: hurting your score',
    layout: 'ctaBlock',
    channels: ['meta', 'instagram', 'walk-in'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Need a free look at',
    accentPhrase: "what's hurting your score?",
    body: 'We read the 3-bureau file with you and map collections, lates, and inquiries before you spend another month guessing.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'cta-credit-follow',
    label: 'Credit CTA: you can follow',
    layout: 'ctaBlock',
    channels: ['linkedin', 'meta'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Ready for a credit analysis',
    accentPhrase: 'you can actually follow?',
    body: 'Plain-English findings, a dispute path, and a real person who stays with the file after the first review.',
    ctaLabel: freeCreditCta,
    footer: siteConfig.email,
  },
]

const creditServiceAds: CampaignAd[] = [
  {
    id: 'service-credit-analysis',
    label: 'Service: Credit Analysis',
    layout: 'serviceSpotlight',
    channels: ['instagram', 'meta', 'linkedin'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    icon: '📊',
    headline: 'Credit Analysis',
    body: 'We review your official 3-bureau report, explain what is hurting you, and map the first disputes in plain English.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'service-credit-repair',
    label: 'Service: Credit Repair',
    layout: 'serviceSpotlight',
    channels: ['instagram', 'meta', 'linkedin'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    icon: '📝',
    headline: 'Credit Repair',
    body: 'Dispute inaccurate, unverifiable, and outdated items with bureau letters after a free analysis of your file.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'service-credit-funding',
    label: 'Service: Credit & Funding',
    layout: 'serviceSpotlight',
    channels: ['linkedin', 'meta'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    icon: '💳',
    headline: 'Credit & Funding',
    body: 'Analyze the report first, repair what you can, then see how ready the file is for personal or business funding.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
]

const creditProofAds: CampaignAd[] = [
  {
    id: 'stat-credit-analysis',
    label: 'Credit proof: what you get',
    layout: 'statProof',
    channels: ['homepage', 'linkedin', 'walk-in'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: "What's in your free analysis",
    body: 'A 3-bureau read, a plain-English plan, and no obligation to move forward.',
    ctaLabel: freeCreditCta,
    footer: 'Credit & Funding',
    stats: [
      { value: '3', label: 'Bureau report' },
      { value: 'Clear', label: 'Next steps' },
      { value: 'Free', label: 'Analysis' },
    ],
  },
]

const creditSearchAds: CampaignAd[] = [
  {
    id: 'search-credit-analysis',
    label: 'Search: free credit analysis',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Free Credit Analysis',
    body: 'Upload your 3-bureau report. We show what is hurting you and what to do next. Free.',
    ctaLabel: 'Get Free Analysis',
    footer: siteHost,
  },
  {
    id: 'search-credit-on-report',
    label: 'Search: on your report',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: "See What's On Your Report",
    body: 'Free credit analysis. See your 3-bureau file and the next steps. No obligation.',
    ctaLabel: 'Get Free Analysis',
    footer: siteHost,
  },
  {
    id: 'search-credit-stop-guessing',
    label: 'Search: stop guessing credit',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Stop Guessing At Credit',
    body: 'Stop guessing at your credit. Get a free analysis and a plain-English plan.',
    ctaLabel: 'Get Free Analysis',
    footer: siteHost,
  },
  {
    id: 'search-credit-review',
    label: 'Search: credit review',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Get a Credit Analysis',
    body: 'Free review of scores, negatives, and inquiries. See sundayharmony.com/credit-funding.',
    ctaLabel: 'Get Free Analysis',
    footer: siteHost,
  },
  {
    id: 'search-credit-no-cost',
    label: 'Search: no-cost analysis',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Credit Analysis. No Cost.',
    body: 'No-cost credit analysis. 3-bureau review, clear next steps, no long-term contract needed.',
    ctaLabel: 'Get Free Analysis',
    footer: siteHost,
  },
  {
    id: 'search-credit-repair-start',
    label: 'Search: repair starts here',
    layout: 'search',
    channels: ['google'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Credit Repair Starts Here',
    body: 'Start with a free credit analysis, then dispute what does not belong on your report.',
    ctaLabel: 'Get Free Analysis',
    footer: siteHost,
  },
]

const creditSocialAds: CampaignAd[] = [
  {
    id: 'social-credit-guessing',
    label: 'Social: credit stop guessing',
    layout: 'social',
    channels: ['instagram', 'meta', 'linkedin'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: 'Stop guessing at your credit.',
    accentPhrase: 'Start with a free analysis.',
    body: 'Same voice as the homepage. Free 3-bureau review. Clear next steps. No obligation.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'social-credit-on-report',
    label: 'Social: what is on your report',
    layout: 'social',
    channels: ['instagram', 'meta'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    headline: "Ready to see what's actually",
    accentPhrase: 'on your report?',
    body: 'Free credit analysis. Upload the official 3-bureau PDF and we will tell you what to fix first.',
    ctaLabel: freeCreditCta,
    footer: siteHost,
  },
  {
    id: 'social-credit-offer',
    label: 'Social: free analysis offer',
    layout: 'social',
    channels: ['instagram', 'meta', 'walk-in'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'No obligation',
    headline: "What's in your free credit analysis",
    body: '3-bureau review, negative-item map, inquiry check, and a plain-English dispute plan.',
    ctaLabel: 'Request your free analysis',
    footer: '24hr response',
  },
  {
    id: 'social-credit-walk-in',
    label: 'Walk-in: free credit analysis',
    layout: 'social',
    channels: ['walk-in'],
    source: 'new',
    offer: 'credit',
    ctaHref: creditIntakeHref,
    badge: 'Free Credit Analysis',
    headline: 'Bring your 3-bureau report.',
    accentPhrase: 'We will show you what we see.',
    body: 'No charge for the analysis. No obligation to move into repair. Just a clear read of the file.',
    ctaLabel: freeCreditCta,
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
  ...creditHeroAds,
  ...creditCtaAds,
  ...creditServiceAds,
  ...creditProofAds,
  ...creditSearchAds,
  ...creditSocialAds,
]

export const HOMEPAGE_MID_AD_ID = 'hero-customers-searching'
export const HOMEPAGE_CREDIT_AD_ID = 'hero-credit-stop-guessing'

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

export function adOffer(ad: CampaignAd): AdOffer {
  return ad.offer ?? 'marketing'
}

export function adCtaHref(ad: CampaignAd): string {
  return ad.ctaHref ?? (adOffer(ad) === 'credit' ? '/credit-funding' : '/#contact')
}

export function adsForOffer(offer: AdOffer): CampaignAd[] {
  return campaignAds.filter((ad) => adOffer(ad) === offer)
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
