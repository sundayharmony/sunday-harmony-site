// ══════════════════════════════════════════════════════════
// Toolkit Data — All research, competitors, scripts, roadmap
// ══════════════════════════════════════════════════════════

// ══════════ PHASE 1 — MARKET SIZING ══════════
export const marketData = [
  { label: 'Global Agency Market (2025)', value: '$20.6B' },
  { label: 'Projected by 2035', value: '$78.7B' },
  { label: 'CAGR', value: '14.3%' },
  { label: 'US Agencies', value: '60,000+' },
  { label: 'SMBs Planning to Increase Budget', value: '49%' },
  { label: 'SMBs Managing Marketing Solo', value: '54%' },
]

export const researchPhases = [
  { id: 1, title: 'Industry & Market Sizing', icon: '📊', timeframe: 'Week 1–2', color: '#3a8bc2',
    objective: 'Understand the size of the opportunity and where Sunday Harmony fits in the landscape.',
    keyFindings: [
      'The global digital marketing agency market is valued at ~$20.6B in 2025, growing at 14.3% CAGR through 2035.',
      'There are over 60,000 digital advertising agencies in the US alone — competition is intense but the pie is growing fast.',
      'North America holds ~38% market share, with social media marketing as the largest service segment.',
      '49% of SMBs plan to increase marketing budgets in 2025, and 96% of small businesses plan to advertise.',
    ],
    tasks: [
      'Define your serviceable addressable market (SAM) — which industries, geographies, and business sizes will you target?',
      'Estimate local market size: how many SMBs are in your target area and what do they spend on marketing?',
      'Identify fastest-growing service segments (AI tools, video, local SEO) to prioritize in your offerings',
      'Research average agency pricing in your tier ($1K–$5K/mo retainers for SMB-focused agencies)',
    ],
  },
  { id: 2, title: 'Target Customer Deep-Dive', icon: '🎯', timeframe: 'Week 2–3', color: '#4a9e7d',
    objective: 'Build detailed profiles of your ideal clients and understand their pain points, budget, and buying behavior.',
    keyFindings: [
      '55% of SMB owners say customer acquisition is their #1 marketing challenge.',
      '54% of small business owners manage marketing entirely by themselves — they need help but may not know it.',
      '45% of SMBs say getting new leads will be challenging in 2025; maximizing budget is their next biggest concern.',
      'SMBs using agencies rate their marketing confidence 9/10 vs. 7/10 for DIY marketers — there\'s a clear value prop.',
    ],
    tasks: [
      'Create 3 ideal customer personas (e.g., new restaurant owner, growing e-commerce brand, local service business)',
      'Survey or interview 10–15 local business owners about their marketing pain points and current spend',
      'Map the buyer journey: How do SMBs find and evaluate marketing agencies?',
      'Identify key decision triggers: What makes an SMB finally hire an agency?',
    ],
  },
  { id: 3, title: 'Competitive Analysis', icon: '⚔️', timeframe: 'Week 3–4', color: '#c9a96e',
    objective: 'Map the competitive landscape and identify Sunday Harmony\'s unique positioning opportunity.',
    keyFindings: [
      '40% of SMBs who outsource marketing churn — 56% within the first 6–12 months. Retention is a huge differentiator.',
      '60% of businesses that left an agency cited \'lack of perceived value\' as the top reason — proving ROI is critical.',
      '91% of SMBs want an all-in-one solution to combat app fatigue — bundled services win.',
      '69% of SMBs say their agency already provides AI tools; 60% of those without AI tools wish they had them.',
    ],
    tasks: [
      'Identify 5–8 direct competitors (local agencies, freelancers, platforms like Fiverr/Upwork serving your target market)',
      'Audit competitor websites: pricing, services, proof, reviews, positioning',
      'Analyze competitor Google reviews and testimonials for recurring client complaints',
      'Define Sunday Harmony\'s unique value proposition vs. each competitor type',
      'Create a competitive positioning map (price vs. service breadth)',
    ],
  },
  { id: 4, title: 'Service-Market Fit Validation', icon: '🧪', timeframe: 'Week 4–5', color: '#7b68c9',
    objective: 'Validate which services to lead with and how to package/price them for maximum traction.',
    keyFindings: [
      'Top services SMBs outsource: social media management, paid search/PPC, web design, and email marketing.',
      '72% of SMBs say SEO significantly impacts their growth — but most don\'t have the basics in place.',
      'SMBs are investing more in social media ads (51%), content marketing (51%), search advertising (47%), and video (47%).',
      'Average SMB ad budget is ~$78K/year, but 33% have under $1K/month total marketing budget.',
    ],
    tasks: [
      'Design 2–3 tiered service packages (Starter, Growth, Scale) with clear deliverables and pricing',
      'Test pricing with 5+ prospects — are they willing to pay? What objections come up?',
      'Build a \'quick win\' offer (e.g., Google Business Profile optimization + basic local SEO audit) as a foot-in-the-door',
      'Identify which services have the highest margin and shortest time-to-result for early client wins',
    ],
  },
  { id: 5, title: 'Go-to-Market Strategy', icon: '🚀', timeframe: 'Week 5–6', color: '#d4564e',
    objective: 'Build a concrete plan to acquire your first 10–20 clients based on everything you\'ve learned.',
    keyFindings: [
      'SMBs choose marketing channels based on where they believe their customers spend time — show you understand their audience.',
      'Agencies that can prove ROI in the first 6 months have dramatically better retention.',
      'Value, partnership, and innovation are the top 3 things SMBs want from agencies in 2025.',
      '43% of SMBs expect to increase budgets this year — timing is right for outreach.',
    ],
    tasks: [
      'Define your top 3 client acquisition channels (e.g., local networking, LinkedIn outreach, Google Ads for your own agency)',
      'Create a proof-of-concept from a pilot client or your own marketing results',
      'Build a referral program and strategic partnership pipeline (accountants, web developers, business coaches)',
      'Set 90-day targets: pipeline size, proposals sent, clients closed, revenue goal',
      'Design your onboarding process to deliver a \'quick win\' in the first 30 days for every new client',
    ],
  },
]

// ══════════ PHASE 4 — DETAILED PACKAGES ══════════
export interface DetailedPackage {
  tier: string
  tagline: string
  price?: number
  priceLabel?: string
  color: string
  icon: string
  popular?: boolean
  ideal: string
  services: { name: string; included: boolean; note?: string }[]
  quickWin: string
  margin: string
}

export const detailedPackages: DetailedPackage[] = [
  { tier: 'Spark', tagline: 'Clarify the brand', price: 600, color: '#4a9e7d', icon: '✦',
    ideal: 'For businesses defining how they want to be seen and heard.',
    services: [
      { name: 'A clear story customers recognize', included: true },
      { name: 'Outreach that looks and sounds like you', included: true },
      { name: 'A presence that stays active and on-brand', included: true },
      { name: 'First impressions and reputation in sight', included: true },
      { name: 'A simple monthly pulse on how you land', included: true },
    ],
    quickWin: 'Brand story and presence aligned in the first week.',
    margin: 'Entry plan. At 10 clients = $6,000/mo.',
  },
  { tier: 'Growth', tagline: 'Expand your reach', price: 1400, color: '#c9a96e', icon: '◆', popular: true,
    ideal: 'For businesses ready to reach more of the right people.',
    services: [
      { name: 'Everything in Spark', included: true },
      { name: 'Outreach planned with purpose', included: true },
      { name: 'More ways to show up where buyers look', included: true },
      { name: 'Brand consistency as you scale up', included: true },
      { name: 'A monthly rhythm to stay on message', included: true },
      { name: 'Plain-language insight you can act on', included: true },
    ],
    quickWin: 'Outreach plan and first push in motion in the first two weeks.',
    margin: 'Core plan. At 10 clients = $14,000/mo.',
  },
  { tier: 'Scale', tagline: 'Built around you', priceLabel: 'Custom', color: '#7b68c9', icon: '★',
    ideal: 'For businesses that want a branding partner, not a checklist.',
    services: [
      { name: 'Everything in Growth', included: true },
      { name: 'Brand and outreach shaped to your goals', included: true },
      { name: 'Broader reach with hands-on support', included: true },
      { name: 'A dedicated partner on your story', included: true },
      { name: 'Room to evolve as the business grows', included: true },
    ],
    quickWin: 'Consultation first. Then brand and outreach built around their business.',
    margin: 'Custom after consult. Price to the work, not a menu.',
  },
]

export const footInDoorOffer = {
  name: 'Free Google Business Audit',
  price: 'FREE',
  description: "Your signature lead magnet. A 15-minute audit delivered as a professional PDF showing exactly what's wrong with their online presence.",
  steps: [
    'Search for the business on Google — screenshot their listing, reviews, and search results',
    'Check their Google Business Profile: hours, photos, categories, posts, Q&A',
    'Run their website through PageSpeed Insights — screenshot the score',
    "Check their top 3 competitors' Google presence for comparison",
    'Package findings in a branded 1-page PDF with 3–5 recommendations',
    'Deliver in person or via a 15-minute Zoom walk-through',
    "Close with: 'I can handle all of this — here's how our Spark/Growth package works'",
  ],
  conversionRate: '30–40% of audits convert to paid clients when delivered in person.',
}

export const roadmapWeeks = [
  { week: 'Week 1–2', title: 'Foundation & First Outreach', color: '#3a8bc2',
    tasks: [
      'Finalize 3 service packages (PDF one-pager)',
      'Set up invoicing (Stripe, Square, or QuickBooks)',
      'Build free Google Business audit template',
      'Optimize YOUR own Google Business Profile',
      'Update website with services + contact form',
      'Create LinkedIn profile as NJ marketing consultant',
      'Identify 20 target businesses',
      'Research each: Google listing, website, social',
      'Reach out to 10 prospects (DM, email, walk-ins)',
      'Ask network for 3 warm introductions',
    ],
    milestone: '20 outreach attempts, 5+ conversations, sales assets ready.',
    kpis: ['Outreach: 20', 'Conversations: 5+', 'Audits: 3+'],
  },
  { week: 'Week 3–4', title: 'Deliver Value & Close', color: '#4a9e7d',
    tasks: [
      'Deliver 2–3 free audits',
      'Follow up with all Week 1–2 prospects',
      'Present packages to audit recipients',
      'Send proposals to warm leads',
      '10 new prospects from different industry',
      'Post first case-content on LinkedIn',
      'Attend networking event (Chamber, BNI, SCORE)',
      'Collect 5+ cards, schedule follow-ups',
      'Review pipeline, follow up personally',
      'Ask everyone for one referral',
    ],
    milestone: '2–4 paying clients, first work delivered, 10+ warm prospects.',
    kpis: ['Clients: 2–4', 'MRR: $500–$3,600+', 'Pipeline: 10+'],
  },
  { week: 'Week 5–8', title: 'Quick Wins & Proof', color: '#c9a96e',
    tasks: [
      'Deliver 30-day quick win for every client',
      'Document before/after screenshots',
      'Collect the first client testimonial',
      'Post weekly on LinkedIn and Instagram',
      '10 new prospects/week minimum',
      '2+ free audits/week',
      'Set up referral incentive',
      'Join 2 local business groups',
      '30-day client check-ins, ask for testimonials',
      'Evaluate best-performing tiers',
    ],
    milestone: '5–8 paying clients, first testimonial, predictable outreach rhythm.',
    kpis: ['Clients: 5–8', 'MRR: $2K–$7K+', 'Testimonials: 2+'],
  },
  { week: 'Week 9–12', title: 'Scale & Systematize', color: '#7b68c9',
    tasks: [
      'Build client onboarding SOP',
      'Create reusable reporting templates',
      'Launch your own Google Ads',
      'Set up email sequence for cold leads',
      'Upsell existing clients (90-day review)',
      'Pitch add-on services',
      'Formalize 3 referral partnerships',
      'Propose mutual referral agreements',
      '90-day business review',
      'Set Q2 goals from real data',
    ],
    milestone: '8–12 clients, $4K–$12K+ MRR, repeatable system.',
    kpis: ['Clients: 8–12', 'MRR: $4K–$12K+', 'Retention: 85%+', 'Partnerships: 3+'],
  },
]
