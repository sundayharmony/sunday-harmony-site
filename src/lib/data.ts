// ══════════════════════════════════════════════════════════
// Sunday Harmony — Site Data
// All content, packages, services, and team info in one place
// ══════════════════════════════════════════════════════════

export const siteConfig = {
  name: 'Sunday Harmony',
  tagline: 'Your All-in-One Marketing Partner',
  email: 'sales@sundayharmony.com',
  url: 'https://www.sundayharmony.com',
  location: 'New Jersey',
  founded: '2023',
}

export const heroSubtext =
  'We help businesses get found online, generate better leads, and grow revenue with one partner handling strategy, execution, and reporting.'

export const heroStats = [
  { value: 'A+', label: 'Service' },
  { value: '4+', label: 'Years of Experience' },
  { value: '150', label: 'Businesses Served' },
]

/** Hero panel: real expectations for the free audit (replaces decorative “metrics” widget). */
export const heroAuditHighlights = [
  { id: 'gbp', text: 'Google Business Profile & local “near me” visibility' },
  { id: 'site', text: 'Website messaging, speed & conversion basics' },
  { id: 'social', text: 'Social presence & content consistency' },
  { id: 'ads', text: 'Ad spend efficiency (if you run paid ads)' },
  { id: 'roadmap', text: 'Prioritized next steps—plain English, no jargon' },
] as const

export const proofItems = [
  { icon: '★', label: 'Google Premier Tools' },
  { icon: '◈', label: 'AI-Powered Workflows' },
  { icon: '✓', label: 'Digital + Physical Marketing' },
  { icon: '♢', label: 'Plain English Reporting' },
]

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
  price: number
  color: string
  icon: string
  ideal: string
  popular?: boolean
  features: PackageFeature[]
}

export const packages: Package[] = [
  {
    tier: 'Social Essentials',
    tagline: 'Stay Active Online',
    price: 250,
    color: 'blue',
    icon: '◇',
    ideal: 'For new businesses & side hustles that need a social presence.',
    features: [
      { text: 'Social media (2 platforms)', included: true },
      { text: '8 custom posts/month', included: true },
      { text: 'Content calendar', included: true },
      { text: 'Community engagement', included: true },
      { text: 'Monthly metrics snapshot', included: true },
      { text: 'Google Business Profile', included: false },
      { text: 'Local SEO', included: false },
      { text: 'Google Ads', included: false },
    ],
  },
  {
    tier: 'Spark',
    tagline: 'Get Found Online',
    price: 500,
    color: 'green',
    icon: '✦',
    ideal: 'For businesses ready to show up in local search results.',
    features: [
      { text: 'Everything in Essentials', included: true },
      { text: 'Google Business optimization', included: true },
      { text: 'Basic local SEO', included: true },
      { text: '12 posts/month (3/week)', included: true },
      { text: 'Review monitoring', included: true },
      { text: 'Performance snapshot', included: true },
      { text: 'Google Ads', included: false },
      { text: 'Email marketing', included: false },
    ],
  },
  {
    tier: 'Growth',
    tagline: 'Start Generating Leads',
    price: 1800,
    color: 'gold',
    icon: '◆',
    ideal: 'For established businesses ready to invest in real growth.',
    popular: true,
    features: [
      { text: 'Everything in Spark', included: true },
      { text: 'Full local SEO strategy', included: true },
      { text: 'Google Ads (up to $2K)', included: true },
      { text: 'Review management', included: true },
      { text: 'Monthly strategy call', included: true },
      { text: 'Actionable monthly report', included: true },
      { text: 'Email marketing', included: false },
      { text: 'Physical marketing', included: false },
    ],
  },
  {
    tier: 'Scale',
    tagline: 'Full-Service Partner',
    price: 3500,
    color: 'purple',
    icon: '★',
    ideal: 'For ambitious businesses wanting a complete marketing partner.',
    features: [
      { text: 'Everything in Growth', included: true },
      { text: 'SEO + content marketing', included: true },
      { text: 'Google + Meta Ads ($5K)', included: true },
      { text: 'Email marketing', included: true },
      { text: 'Physical marketing', included: true },
      { text: '20+ posts + reels', included: true },
      { text: 'Bi-weekly strategy calls', included: true },
      { text: 'Dedicated account manager', included: true },
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
    initials: 'BO',
    name: 'Benjamin G. Ouckama',
    role: 'Sales Specialist',
    bio: 'Benjamin bridges the gap between businesses and the marketing solutions they need. He ensures every client gets the right package for their goals and budget.',
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
