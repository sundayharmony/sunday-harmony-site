// ══════════════════════════════════════════════════════════
// Sunday Harmony — Site Data
// All content, packages, services, and team info in one place
// ══════════════════════════════════════════════════════════

export const siteConfig = {
  name: 'Sunday Harmony',
  tagline: 'Brand, strategy, and systems.',
  email: 'sales@sundayharmony.com',
  url: 'https://www.sundayharmony.com',
}

export const heroSubtext =
  'Sunday Harmony Consulting designs the brand, implements the strategy, and builds the systems a business actually runs on.'

export const heroStats = [
  { value: 'A+', label: 'Service' },
  { value: '4+', label: 'Years of Experience' },
  { value: '150+', label: 'Businesses Served' },
]

/** Hero panel: real expectations for the free audit (replaces decorative “metrics” widget). */
export const heroAuditHighlights = [
  { id: 'gbp', text: 'Google Business Profile & local “near me” visibility' },
  { id: 'site', text: 'Website messaging, speed & conversion basics' },
  { id: 'social', text: 'Social presence & content consistency' },
  { id: 'ads', text: 'Ad spend efficiency (if you run paid ads)' },
  { id: 'roadmap', text: 'Prioritized next steps—plain English, no jargon' },
] as const

export const services = [
  {
    icon: '📈',
    title: 'Local SEO',
    description: 'Get found in "near me" searches. We optimize your Google Business Profile, build citations, and get you ranking where your customers are looking.',
  },
  {
    icon: '📱',
    title: 'Social Media Management',
    description: 'Custom content, branded graphics, strategic posting, and community engagement across Instagram, Facebook, and LinkedIn.',
  },
  {
    icon: '🎯',
    title: 'Google & Meta Ads',
    description: 'Targeted ad campaigns that drive real leads to your business. We handle setup, optimization, A/B testing, and ROI tracking.',
  },
  {
    icon: '★',
    title: 'Review Management',
    description: 'Monitor, respond to, and grow your online reviews across Google and Yelp. Your reputation is your most powerful marketing tool.',
  },
  {
    icon: '📧',
    title: 'Email Marketing',
    description: 'Newsletters, automated sequences, and promotional campaigns that keep your customers engaged and coming back.',
  },
  {
    icon: '📄',
    title: 'Physical Marketing',
    description: 'Business cards, flyers, signage, and direct mail. We bridge the gap between digital and physical that other agencies ignore.',
  },
]

export interface PackageFeature {
  text: string
  included: boolean
}

export interface Package {
  tier: string
  tagline: string
  price?: number
  priceLabel?: string
  ctaLabel?: string
  color: string
  icon: string
  ideal: string
  popular?: boolean
  features: PackageFeature[]
}

export function packagePriceDisplay(pkg: Pick<Package, 'price' | 'priceLabel'>): string {
  if (pkg.priceLabel) return pkg.priceLabel
  if (pkg.price != null) return `$${pkg.price.toLocaleString()}`
  return 'Custom'
}

export const packages: Package[] = [
  {
    tier: 'Spark',
    tagline: 'Get Found Online',
    price: 600,
    color: 'green',
    icon: '✦',
    ideal: 'For businesses that need to show up and stay consistent.',
    features: [
      { text: 'A social presence that stays active', included: true },
      { text: 'A Google listing that looks right', included: true },
      { text: 'Local search that helps people find you', included: true },
      { text: 'Reviews kept in sight', included: true },
      { text: 'A simple monthly snapshot', included: true },
    ],
  },
  {
    tier: 'Growth',
    tagline: 'Start Getting Leads',
    price: 1400,
    color: 'gold',
    icon: '◆',
    ideal: 'For businesses ready to turn attention into customers.',
    popular: true,
    features: [
      { text: 'Everything in Spark', included: true },
      { text: 'A plan built around leads', included: true },
      { text: 'Ads that run and get reviewed', included: true },
      { text: 'Reviews handled for you', included: true },
      { text: 'A monthly check-in', included: true },
      { text: 'A report you can actually follow', included: true },
    ],
  },
  {
    tier: 'Scale',
    tagline: 'Built Around You',
    priceLabel: 'Custom',
    ctaLabel: 'Book a consultation',
    color: 'purple',
    icon: '★',
    ideal: 'For businesses that want a partner, not a package.',
    features: [
      { text: 'Everything in Growth', included: true },
      { text: 'A plan built around your business', included: true },
      { text: 'More reach, more support', included: true },
      { text: 'A dedicated point of contact', included: true },
      { text: 'Room to add what you actually need', included: true },
    ],
  },
]

export const processSteps = [
  {
    num: 1,
    title: 'Free Audit',
    description: "We review your Google presence, website, and competitors — and show you exactly what to fix.",
  },
  {
    num: 2,
    title: 'Custom Plan',
    description: 'We build a strategy tailored to your business, goals, and budget. No cookie-cutter pitches.',
  },
  {
    num: 3,
    title: 'Quick Win',
    description: "Within 30 days you'll see real results — optimized profiles, first posts live, or first ads running.",
  },
  {
    num: 4,
    title: 'Grow Together',
    description: 'Monthly strategy calls, plain-English reports, and continuous optimization to keep growing.',
  },
]

export const aboutValues = [
  { icon: '💬', title: 'Radical Transparency', description: "No jargon, no vanity metrics. You'll always know what we did and why." },
  { icon: '🎯', title: 'Results First', description: 'We lead with quick wins so you see value in the first 30 days.' },
  { icon: '🤝', title: 'True Partnership', description: 'Monthly calls, shared dashboards, and a real person who knows your business.' },
  { icon: '⚡', title: 'Digital + Physical', description: "We do what other agencies won't — bridging online and offline marketing." },
]

export const team = [
  {
    initials: 'MC',
    name: 'Mac Cesar',
    role: 'CEO & Marketing Specialist',
    bio: 'Passionate about helping businesses unlock their marketing potential. Mac brings strategic vision and hands-on execution to every client relationship.',
  },
  {
    initials: 'JH',
    name: 'Jordan Hale',
    role: 'Sales Specialist',
    bio: 'Jordan bridges the gap between businesses and the marketing solutions they need. He ensures every client gets the right package for their goals and budget.',
  },
  {
    initials: 'AQ',
    name: 'Avery Quinn',
    role: 'Client Success Coordinator',
    bio: 'Avery keeps every client relationship on track — from onboarding through ongoing support — so your team always has a clear point of contact and next step.',
  },
]

export const serviceOptions = [
  'Social Media Management',
  'Local SEO & Google Business',
  'Google / Meta Ads',
  'Full-Service Marketing',
  'Website Design',
  'Not sure yet — just want the free audit',
]
