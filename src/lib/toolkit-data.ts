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
      'Audit competitor websites: pricing, services, case studies, reviews, positioning',
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
      'Create a case study or proof-of-concept from a pilot client or your own marketing results',
      'Build a referral program and strategic partnership pipeline (accountants, web developers, business coaches)',
      'Set 90-day targets: pipeline size, proposals sent, clients closed, revenue goal',
      'Design your onboarding process to deliver a \'quick win\' in the first 30 days for every new client',
    ],
  },
]

// ══════════ PHASE 3 — POSITIONING CANVAS ══════════
export const positioningCanvas = [
  { label: 'Target Client', placeholder: 'e.g., NJ small business owners doing marketing themselves and struggling...' },
  { label: 'Problem You Solve', placeholder: "e.g., Wasting time on marketing that doesn't work, losing customers to competitors online..." },
  { label: 'Your Unique Approach', placeholder: 'e.g., All-in-one digital + physical marketing partner with clear ROI reporting...' },
  { label: 'Why You, Not Them', placeholder: 'e.g., Unlike big agencies, we treat every client like our only client...' },
  { label: 'Proof / Credibility', placeholder: 'e.g., Free audit results, testimonials, case studies, local NJ roots...' },
  { label: 'One-Liner Pitch', placeholder: "e.g., 'Sunday Harmony helps NJ businesses stop guessing and start growing.'" },
]

// ══════════ PHASE 4 — DETAILED PACKAGES ══════════
export const detailedPackages = [
  { tier: 'Social Essentials', tagline: 'Stay Active Online', price: 250, color: '#3a8bc2', icon: '◇',
    ideal: 'Brand-new businesses, side hustles, or anyone who knows they should be posting but never do.',
    services: [
      { name: 'Social media management (2 platforms)', included: true, note: 'Facebook + Instagram or LinkedIn' },
      { name: '8 custom posts/month (2/week)', included: true, note: 'Branded graphics, captions, hashtags' },
      { name: 'Content calendar (planned monthly)', included: true },
      { name: 'Basic community engagement', included: true, note: 'Comments and DMs' },
      { name: 'Monthly snapshot (key metrics)', included: true },
      { name: 'Google Business Profile', included: false, note: '+$100/mo' },
      { name: 'Local SEO', included: false },
      { name: 'Google Ads / PPC', included: false },
    ],
    quickWin: 'Content calendar + first 2 weeks of posts within 5 days of signing.',
    margin: 'Highest margin per hour. At 15 clients = $3,750/mo.',
  },
  { tier: 'Spark', tagline: 'Get Found Online', price: 500, color: '#4a9e7d', icon: '✦',
    ideal: 'Solo operators, new restaurants, tradespeople ready to get serious about local visibility.',
    services: [
      { name: 'Everything in Social Essentials', included: true },
      { name: 'Google Business Profile setup & optimization', included: true },
      { name: 'Basic local SEO (citations, NAP)', included: true },
      { name: '12 social media posts/month (3/week)', included: true },
      { name: 'Review monitoring & alerts', included: true },
      { name: 'Monthly performance snapshot', included: true },
      { name: 'Website design/redesign', included: false, note: 'Add-on: $1,500–$3,000' },
      { name: 'Google Ads / PPC', included: false },
    ],
    quickWin: 'Optimized Google Business Profile live within 7 days.',
    margin: 'High margin. At 10 clients = $5,000/mo.',
  },
  { tier: 'Growth', tagline: 'Start Generating Leads', price: 1800, color: '#c9a96e', icon: '◆', popular: true,
    ideal: 'Law firms, accountants, established restaurants, home service companies doing $300K–$2M/year.',
    services: [
      { name: 'Everything in Spark', included: true },
      { name: 'Full local SEO strategy & execution', included: true },
      { name: 'Google Ads management (up to $2K spend)', included: true },
      { name: 'Review management & response', included: true },
      { name: 'Monthly strategy call (30 min)', included: true },
      { name: 'Monthly report with actionable insights', included: true },
      { name: 'Email marketing', included: false, note: '+$300–$500/mo' },
      { name: 'Physical marketing', included: false, note: 'Project-based' },
    ],
    quickWin: 'First Google Ads campaign live within 14 days.',
    margin: 'Strong margin at scale. At 10 clients = $18,000/mo.',
  },
  { tier: 'Scale', tagline: 'Full-Service Partner', price: 3500, color: '#7b68c9', icon: '★',
    ideal: 'Multi-location businesses, ambitious practices, companies doing $1M–$5M+.',
    services: [
      { name: 'Everything in Growth', included: true },
      { name: 'Complete SEO + content marketing', included: true },
      { name: '20+ social posts/month + reels', included: true },
      { name: 'Google + Meta Ads (up to $5K spend)', included: true },
      { name: 'Email marketing (2 campaigns/mo)', included: true },
      { name: 'Physical marketing design', included: true },
      { name: 'Website updates (monthly)', included: true },
      { name: 'Bi-weekly strategy calls', included: true },
      { name: 'Dedicated account manager', included: true },
    ],
    quickWin: 'Full marketing audit + 90-day plan in week 1.',
    margin: 'Highest absolute margin. At 5 clients = $17,500/mo.',
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

// ══════════ COMPETITORS ══════════
export const competitors = [
  { name: 'SmartSites', type: 'Enterprise NJ Agency', threat: 'high' as const, price: '$1K–$10K+/mo', founded: '2011', team: '100+',
    services: ['SEO', 'PPC', 'Web Design', 'Social Media', 'Email/SMS'],
    strengths: ["1,000+ 5-star reviews, America's #1 rated agency", 'Google Premier Partner, 9x Inc5000 winner', 'Managed $500M+ in paid search', 'Serves Fortune 500 down to local SMBs'],
    weaknesses: ['Premium pricing exceeds smallest SMBs', 'Large agency — clients may feel like a number', 'Some reviews mention communication issues'],
    angle: "Position as the personal, hands-on alternative. You're the local partner who knows their name, not a ticket number.",
  },
  { name: 'Adapting Social', type: 'Full-Service NJ Agency', threat: 'high' as const, price: '$1K–$5K/mo', founded: '~2000', team: '10–25',
    services: ['Social Media', 'SEO', 'Web Design', 'Email', 'PPC', 'Graphic Design'],
    strengths: ['25+ years experience', 'True full-service multi-channel', 'Deep NJ local knowledge', 'Strong creative capabilities'],
    weaknesses: ['Slower to adopt newer tactics (AI, short-form video)', 'Generalist positioning', 'Higher overhead = higher prices'],
    angle: "Lead with AI-powered efficiency and modern tactics they're slower to adopt. Be nimble while they're process-heavy.",
  },
  { name: 'Wowbix', type: 'Budget NJ Agency', threat: 'medium' as const, price: 'Low-cost', founded: '2015', team: 'Small',
    services: ['Web Design', 'SEO', 'Social Media', 'Digital Solutions'],
    strengths: ["Positioned as 'most affordable' in NJ", 'Local Paramus footprint', 'Good budget-tier reviews'],
    weaknesses: ['Low-cost = potential quality concerns', 'Limited strategic consulting', 'May struggle retaining growing clients'],
    angle: "Don't compete on price — compete on value and outcomes.",
  },
  { name: 'Digital Marketing NJ', type: 'Local Specialist', threat: 'medium' as const, price: '$1K–$3K/mo', founded: '~2024', team: 'Small',
    services: ['SEO', 'PPC', 'Web Design', 'Local SEO'],
    strengths: ['Hyper-local NJ positioning', 'BBB A+ accredited', 'Founder story resonates'],
    weaknesses: ['Very new — limited track record', 'Narrow service focus', 'Direct competitor model'],
    angle: 'Differentiate with broader all-in-one services, stronger branding, and physical marketing capabilities.',
  },
  { name: 'Freelancers (Upwork/Fiverr)', type: 'Gig Economy', threat: 'high' as const, price: '$200–$2K/mo', founded: 'N/A', team: 'Individual',
    services: ['Varies — social, design, SEO, web'],
    strengths: ['Extremely cheap', 'Fast turnaround', 'Huge supply', 'No long-term commitments'],
    weaknesses: ['No strategy', 'Inconsistent quality', 'Client manages everything', 'Each freelancer is a silo'],
    angle: "You're the strategist + executor in one. SMBs don't need 5 freelancers — they need one partner.",
  },
  { name: 'DIY Tools (Canva, Wix)', type: 'Self-Service', threat: 'medium' as const, price: '$0–$100/mo', founded: 'N/A', team: 'N/A',
    services: ['Templates', 'Website builders', 'Basic email', 'Social scheduling'],
    strengths: ['Free or cheap', 'Full control', 'Good for early-stage', 'Improving with AI'],
    weaknesses: ['Takes massive time', 'Poor results without expertise', 'Looks DIY', 'No strategy or growth plan'],
    angle: "Position as the expert upgrade. 'You've outgrown DIY — let us take it from here.'",
  },
]

export const vulnerabilities = [
  { gap: 'Agencies overpromise, underdeliver', stat: "60% of SMBs left their agency due to 'lack of perceived value'", opportunity: "Lead with radical transparency: show exactly what you'll do, set realistic timelines, and over-communicate results.", priority: 'critical' as const },
  { gap: 'Clients feel ignored after signing', stat: '56% of SMBs churn within 6–12 months', opportunity: "Design a 'first 90 days' onboarding with weekly check-ins, a shared dashboard, and a quick win in the first 30 days.", priority: 'critical' as const },
  { gap: 'Jargon and confusing reports', stat: "Many SMBs can't understand agency deliverables", opportunity: "Report in plain English: 'You got 47 calls this month from Google, up from 31. Here's what we did.'", priority: 'high' as const },
  { gap: 'No physical marketing integration', stat: 'Most digital agencies ignore offline entirely', opportunity: 'Sunday Harmony offers BOTH digital and physical marketing. This is rare. Lean into bundled online + offline campaigns.', priority: 'high' as const },
  { gap: 'Cookie-cutter packages', stat: "SMBs feel treated like 'smaller versions of enterprise clients'", opportunity: 'Customize every proposal. Start with an audit specific to THEIR business.', priority: 'high' as const },
  { gap: 'No AI tools or innovation', stat: "60% of SMBs whose agency doesn't offer AI wish they did", opportunity: "Integrate AI into your workflow and position it as a value-add.", priority: 'medium' as const },
  { gap: 'Google Business Profile neglect', stat: 'Agencies often break GBP listings when offboarding', opportunity: "Make GBP optimization your signature 'quick win' entry offer.", priority: 'medium' as const },
]

export const roadmapWeeks = [
  { week: 'Week 1–2', title: 'Foundation & First Outreach', color: '#3a8bc2',
    tasks: [
      'Finalize 4 service packages (PDF one-pager)',
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
      'Create first case study',
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

export const channels = [
  { name: 'Free Audits → In-Person Pitch', effort: 'high', cost: 'Free', timeline: 'Immediate', conversion: '30–40%', priority: 1,
    description: "Walk in or reach out, deliver a free Google Business audit, then present packages. Your #1 weapon.",
    steps: ['Identify 5 businesses/day via Google Maps', 'Screenshot listing, run PageSpeed, check reviews', 'Package into branded audit PDF (15 min each)', 'Deliver in person, end with package recommendation'] },
  { name: 'Personal Network & Referrals', effort: 'low', cost: 'Free', timeline: 'Immediate', conversion: '50%+', priority: 1,
    description: "Highest-converting channel. Tell everyone what you're doing and ask for introductions.",
    steps: ['List every business owner you know', 'Send personal messages about your consultancy', 'Offer $50 credit per referral that signs', 'Follow up every referral within 24 hours'] },
  { name: 'Local Networking', effort: 'medium', cost: '$0–$500/yr', timeline: '2–4 weeks', conversion: '15–25%', priority: 1,
    description: 'BNI chapters, Chamber events, SCORE. Strong NJ business communities.',
    steps: ['Find local BNI chapter, attend as visitor', 'Join county Chamber, attend every mixer', "Give free 'Marketing Tips' presentations", 'Always bring cards and audit offer'] },
  { name: 'LinkedIn Content', effort: 'medium', cost: 'Free', timeline: '2–6 weeks', conversion: '5–15%', priority: 2,
    description: 'Post 3–5x/week with tips, insights, case studies. Builds authority.',
    steps: ['Post Mon/Wed/Fri with tips and wins', "Comment on 10 local owners' posts daily", 'Personalized connection requests (no pitch)', 'After connecting, share a tip or free audit'] },
  { name: 'Instagram & Facebook', effort: 'medium', cost: 'Free', timeline: '2–4 weeks', conversion: '5–10%', priority: 2,
    description: 'Great for restaurants, salons, home services. Show work, share tips, DM prospects.',
    steps: ['Follow and engage with local businesses', 'Post under-60s reels with marketing tips', 'DM with genuine observations', 'Use local hashtags and location tags'] },
  { name: 'Google Ads (Your Own)', effort: 'low', cost: '$300–$1K/mo', timeline: '1–2 weeks', conversion: '10–20%', priority: 3,
    description: "Run ads targeting 'marketing agency NJ.' Your inbound engine once you have budget.",
    steps: ['$10–$20/day, NJ geo + service keywords', "Landing page with 'Get Free Audit' CTA", 'Track leads with free CRM', 'Scale once ROI is proven'] },
  { name: 'Strategic Partnerships', effort: 'medium', cost: 'Free', timeline: '4–8 weeks', conversion: '20–30%', priority: 2,
    description: 'Partner with web devs, accountants, coaches. They refer you, you refer them.',
    steps: ['Identify 5 complementary NJ businesses', 'Propose mutual referral agreement', 'Create co-branded referral sheet', 'Monthly check-ins to keep pipeline active'] },
]

export const outreachScripts = [
  { title: 'Cold DM / Email', body: `Hi [Name],

I'm [Your name] from Sunday Harmony — I help [industry] businesses in NJ get more customers through smart online marketing.

I took a quick look at your Google presence and noticed a few things that could be costing you customers (like [specific observation]).

I put together a free, no-strings audit — takes 15 minutes and I'll show you exactly what to fix.

Would you be open to a quick chat this week?

[Your name]
Sunday Harmony | sundayharmony.com` },
  { title: 'Walk-In Script', body: `"Hi! I'm [Name] — I run a local marketing company here in [City]. I help businesses like yours get found on Google and get more customers.

I looked up your business before coming in, and I noticed [specific thing: missing photos, wrong hours, no recent reviews].

I'd love to put together a quick free audit — no charge, no obligation. Can I grab your email?"

[Hand them a card with 'FREE MARKETING AUDIT' on back]` },
  { title: 'Follow-Up After Audit', body: `Hi [Name],

Thanks for letting me dig into your online presence!

Based on what I found, our [Spark/Growth] package would be the best fit because it directly addresses [top 2 issues].

Here's what the first 30 days would look like:
• [Quick win 1]
• [Quick win 2]
• [Quick win 3]

Would you have 15 minutes this week to talk through it?

[Your name]
Sunday Harmony` },
  { title: 'Referral Ask', body: `"Hey [Client Name], glad things are going well! Do you know any other business owners who might be struggling with marketing?

I'll give them the same free audit I did for you, and I'll give you [incentive: $50 off / free add-on] as a thank you for the introduction."` },
]

export const prospectList = [
  { type: '🍽️ Restaurant', examples: 'Local restaurants, cafés, bakeries, food trucks', where: 'Yelp, Google Maps, Instagram hashtags, local food blogs', approach: 'Walk in during slow hours, bring a printed mini-audit of their Google listing' },
  { type: '⚖️ Law Firm', examples: 'Family law, personal injury, immigration, estate planning', where: 'Avvo, Google Business, NJ Bar Association directory, LinkedIn', approach: 'LinkedIn message or email with a specific observation about their online presence' },
  { type: '📊 Accountant/CPA', examples: 'Tax prep, bookkeeping, advisory firms', where: 'CPA Society directory, Google, BNI groups', approach: 'Attend local BNI/networking event, offer a free consultation during tax off-season' },
  { type: '🔧 Home Services', examples: 'Plumbers, electricians, HVAC, landscapers, cleaners', where: 'Angi, Thumbtack, Google Local Services, Nextdoor', approach: 'Reference their existing listing and offer to help them rank higher locally' },
  { type: '💇 Salons/Wellness', examples: 'Hair salons, barbershops, spas, yoga studios', where: 'Instagram, Google Maps, Yelp, local community boards', approach: 'DM on Instagram with a compliment + observation about growth opportunity' },
  { type: '🏠 Real Estate', examples: 'Independent agents, small brokerages', where: 'Realtor.com, Zillow, local RE associations, LinkedIn', approach: 'Offer a social media content audit — agents live on social but most do it poorly' },
]

export const interviewScript = [
  { section: 'Warm-Up', time: '2 min', color: '#4a9e7d',
    questions: [
      { q: 'Thanks for taking the time! Before we dive in — tell me a bit about your business and how things are going right now.', why: 'Gets them talking comfortably. Listen for signals about growth stage, stress level, and priorities.', listen: 'Are they growing, stagnant, or struggling? What do they sound excited or frustrated about?' },
    ] },
  { section: 'Current Marketing', time: '5 min', color: '#c9a96e',
    questions: [
      { q: "Walk me through how you currently get new customers. What's working and what isn't?", why: 'Reveals their actual acquisition channels vs. what they think works.', listen: 'Do they have a system, or is it random? Are they tracking anything?' },
      { q: 'How much time do you personally spend on marketing each week? And how does that feel?', why: '54% of NJ SMB owners do all marketing themselves. This surfaces the time-pain.', listen: "If they say 'too much' or seem stressed — that's your opening." },
      { q: 'Do you have a website, Google Business listing, and social media presence? How are they performing?', why: "Baseline audit question. Many SMBs have these but don't maintain them.", listen: "If they say 'I have a website but nobody finds us on Google' — hot lead." },
    ] },
  { section: 'Pain Points', time: '7 min', color: '#d4564e',
    questions: [
      { q: "What's the single biggest challenge holding your business back from growing right now?", why: 'The #1 answer is customer acquisition (55%). If they say this, you have product-market fit.', listen: 'Their exact words become your marketing copy. Write them down verbatim.' },
      { q: 'Have you ever tried hiring someone or an agency to help with marketing? How did that go?', why: '40% of SMBs churn from agencies within 12 months. Understand why to position against it.', listen: "Common complaints: 'didn't see results,' 'couldn't understand reports,' 'felt ignored.'" },
      { q: "If you could wave a magic wand and fix one thing about how people find your business, what would it be?", why: 'Bypasses rational thinking and gets to their emotional desire.', listen: 'This is often the real problem. Note the difference from their first answer.' },
    ] },
  { section: 'Budget & Decision-Making', time: '4 min', color: '#7b68c9',
    questions: [
      { q: 'Roughly speaking, how much are you investing in marketing right now — including your own time, tools, ads?', why: 'Establishes current spend baseline. Most NJ SMBs spend $500–$3K/month.', listen: 'If they spend $0 externally, your entry price needs to be low. $2K+ = warm prospect.' },
      { q: 'If something was clearly generating more customers, what would you feel comfortable investing monthly?', why: "Tests willingness to pay without anchoring to a number.", listen: '$500+ = viable client. Under $500 may need a DIY or one-time project approach.' },
      { q: 'When it comes to hiring a marketing partner, is that your call alone or do you discuss with anyone?', why: 'Identifies the decision-making unit.', listen: 'Multiple decision-makers = you need materials they can share internally.' },
    ] },
  { section: 'Close & Next Steps', time: '2 min', color: '#3a8bc2',
    questions: [
      { q: "This has been super helpful. Would you be open to me putting together a quick audit of your online presence — totally free — and walking you through what I find?", why: "The 'free audit' is your foot-in-the-door offer. Demonstrates value before asking for money.", listen: "A 'yes' = warm lead. Schedule the follow-up before you leave." },
      { q: 'Do you know any other business owners who might find this kind of conversation helpful?', why: 'Referrals are the #1 growth channel for new agencies. Ask every single time.', listen: "Even if they don't have names now, plant the seed. Follow up in a week." },
    ] },
]
