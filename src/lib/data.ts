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
    icon: '✦',
    title: 'Brand & Story',
    description:
      'Clarify who you are, what you stand for, and how you should look and sound — so every touchpoint feels like the same business, not a patchwork.',
  },
  {
    icon: '◎',
    title: 'Outreach & Presence',
    description:
      'Show up where your customers already look with a consistent, intentional presence — online and in the community — without drowning in tactics.',
  },
  {
    icon: '◇',
    title: 'Strategy & Rhythm',
    description:
      'Turn the brand into a simple plan and a weekly rhythm: what to say, where to show up, and how to keep outreach steady while you run the business.',
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
  priceSuffix?: 'one-time' | 'monthly' | 'quote'
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
    tier: 'Business Essentials',
    tagline: 'Your brand foundation',
    priceLabel: 'From $599',
    priceSuffix: 'one-time',
    color: 'green',
    icon: '✦',
    ideal: 'Businesses launching or refreshing a cohesive brand identity.',
    features: [
      { text: 'Logo design or redesign', included: true },
      { text: 'Logo variations for different uses', included: true },
      { text: 'Color palette and typography', included: true },
      { text: 'Basic brand guidelines', included: true },
      { text: 'Business card design', included: true },
      { text: 'Social profile branding', included: true },
      { text: 'All files delivered', included: true },
    ],
  },
  {
    tier: 'Business Launch',
    tagline: 'Brand and web ready to go',
    priceLabel: 'From $1,799',
    priceSuffix: 'one-time',
    color: 'blue',
    icon: '◆',
    ideal: 'Businesses ready to launch or relaunch with a polished presence.',
    popular: true,
    features: [
      { text: 'Complete brand identity', included: true },
      { text: 'Responsive website (up to 5 pages)', included: true },
      { text: 'Contact and lead forms', included: true },
      { text: 'Basic SEO setup', included: true },
      { text: 'Google Business Profile setup', included: true },
      { text: 'Social profile setup', included: true },
      { text: '3 promo graphics', included: true },
      { text: 'Launch assets delivered', included: true },
    ],
  },
  {
    tier: 'Marketing Partner',
    tagline: 'Ongoing marketing support',
    price: 799,
    priceSuffix: 'monthly',
    color: 'gold',
    icon: '★',
    ideal: 'Businesses that want steady marketing without the in-house overhead.',
    features: [
      { text: 'Monthly strategy and planning', included: true },
      { text: 'Strategy call and report', included: true },
      { text: 'Up to 12 social posts per month', included: true },
      { text: '3 campaign graphics per month', included: true },
      { text: '3 hours of website updates', included: true },
      { text: 'SEO and Google Business Profile upkeep', included: true },
      { text: 'Dedicated client relations contact', included: true },
    ],
  },
  {
    tier: 'Custom Solutions',
    tagline: 'Built around your goals',
    priceLabel: 'Custom quote',
    priceSuffix: 'quote',
    ctaLabel: 'Book a consultation',
    color: 'purple',
    icon: '◇',
    ideal: 'Businesses with specialized needs or larger projects.',
    features: [
      { text: 'E-commerce and web apps', included: true },
      { text: 'Print and collateral', included: true },
      { text: 'Apparel and merchandise', included: true },
      { text: 'Vehicle wraps', included: true },
      { text: 'SEO and paid ads', included: true },
      { text: 'Business systems and workflows', included: true },
      { text: 'Campaigns and launches', included: true },
      { text: 'Milestone payments available', included: true },
    ],
  },
]

export const packageDisclaimer =
  'Printing, hosting, ad spend, and video production are not included unless quoted.'

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
