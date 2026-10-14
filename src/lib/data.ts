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
    tagline: 'Clarify the brand',
    price: 600,
    color: 'green',
    icon: '✦',
    ideal: 'For businesses defining how they want to be seen and heard.',
    features: [
      { text: 'A clear story customers recognize', included: true },
      { text: 'Outreach that looks and sounds like you', included: true },
      { text: 'A presence that stays active and on-brand', included: true },
      { text: 'First impressions and reputation in sight', included: true },
      { text: 'A simple monthly pulse on how you land', included: true },
    ],
  },
  {
    tier: 'Growth',
    tagline: 'Expand your reach',
    price: 1400,
    color: 'gold',
    icon: '◆',
    ideal: 'For businesses ready to reach more of the right people.',
    popular: true,
    features: [
      { text: 'Everything in Spark', included: true },
      { text: 'Outreach planned with purpose', included: true },
      { text: 'More ways to show up where buyers look', included: true },
      { text: 'Brand consistency as you scale up', included: true },
      { text: 'A monthly rhythm to stay on message', included: true },
      { text: 'Plain-language insight you can act on', included: true },
    ],
  },
  {
    tier: 'Scale',
    tagline: 'Built around you',
    priceLabel: 'Custom',
    ctaLabel: 'Book a consultation',
    color: 'purple',
    icon: '★',
    ideal: 'For businesses that want a branding partner, not a checklist.',
    features: [
      { text: 'Everything in Growth', included: true },
      { text: 'Brand and outreach shaped to your goals', included: true },
      { text: 'Broader reach with hands-on support', included: true },
      { text: 'A dedicated partner on your story', included: true },
      { text: 'Room to evolve as the business grows', included: true },
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
