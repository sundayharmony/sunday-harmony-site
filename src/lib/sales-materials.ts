// Sales Materials — Data for admin sales toolkit
// Company presentation, proposal template, service agreement, outreach emails, social posts

import { packages as marketingPackages } from '@/lib/data'

export interface SalesMaterial {
  id: string
  title: string
  description: string
  pdfPath: string
  category: 'presentation' | 'proposal' | 'agreement' | 'email' | 'social'
  forRoles: Array<'admin' | 'sales' | 'marketing'>
}

export const salesMaterials: SalesMaterial[] = [
  {
    id: 'company-presentation',
    title: 'Company Presentation',
    description: '7-slide deck covering who we are, services, packages, process, and CTA.',
    pdfPath: '/sales-materials/company-presentation.pdf',
    category: 'presentation',
    forRoles: ['admin', 'sales'],
  },
  {
    id: 'proposal-template',
    title: 'Client Proposal Template',
    description: '6-page proposal with audit findings, goals, package recommendation, scope, timeline, and investment.',
    pdfPath: '/sales-materials/proposal-template.pdf',
    category: 'proposal',
    forRoles: ['admin', 'sales'],
  },
  {
    id: 'service-agreement',
    title: 'Client Service Agreement',
    description: '4-page agreement covering scope, fees, payment, IP, confidentiality, and signatures.',
    pdfPath: '/sales-materials/service-agreement-template.pdf',
    category: 'agreement',
    forRoles: ['admin', 'sales'],
  },
  {
    id: 'outreach-emails',
    title: 'Outreach Email Templates',
    description: '6 plain-English emails for cold outreach, follow-ups, and closing.',
    pdfPath: '/sales-materials/outreach-emails.pdf',
    category: 'email',
    forRoles: ['admin', 'sales'],
  },
  {
    id: 'social-posts',
    title: 'Social Media Posts',
    description: '10 ready-to-design posts for Instagram and Facebook with captions and hashtags.',
    pdfPath: '/sales-materials/social-posts.pdf',
    category: 'social',
    forRoles: ['admin', 'marketing'],
  },
]

export interface OutreachEmailTemplate {
  id: string
  title: string
  useWhen: string
  whenToSend: string
  subjectOptions: string[]
  body: string
  tip: string
}

export const outreachEmailTemplates: OutreachEmailTemplate[] = [
  {
    id: 'established-outdated',
    title: 'Established business with an outdated website',
    useWhen: 'The business is clearly established (good reviews, years open) but the website or branding looks dated, is hard to use on a phone, or tells an old story.',
    whenToSend: 'Day 1. Tuesday to Thursday morning tends to work well.',
    subjectOptions: [
      "A free look at [Business Name]'s website",
      "Quick idea for [Business Name]'s site",
      "[First name], your reviews deserve a better website",
    ],
    body: `Hi [First name],

I came across [Business Name] while looking at [service] in [town]. Your reviews say a lot: [specific detail, e.g. "people keep mentioning how fast you respond"]. Your website doesn't quite show that yet. [One honest observation, e.g. "On a phone, the call button is hard to find."]

I'd like to send you a free audit of your online presence: your website, Google Business Profile, social pages, and the next steps that would make the biggest difference. It's written in plain English, takes about a business day, and comes with no obligation.

Want me to send it over?

Thanks,
[Your Name]`,
    tip: 'Lead with what they do well, then one specific, fixable issue. Never insult the current site; someone they know may have built it.',
  },
  {
    id: 'weak-presence',
    title: 'Small local business with weak presence',
    useWhen: "No website, a thin or unclaimed Google Business Profile, or social pages that haven't posted in months.",
    whenToSend: "Day 1. Mention a nearby landmark or town to show you're local.",
    subjectOptions: [
      'People are searching for [service] in [town]',
      'Free audit for [Business Name], no strings',
      "A neighbor's take on [Business Name]'s online presence",
    ],
    body: `Hi [First name],

I'm with Sunday Harmony Consulting, a marketing agency here in South Jersey. I searched "[service] near me" from [town] and noticed [Business Name] [e.g. doesn't show up in the map results / has no website listed / last posted on Instagram in March]. Customers are already searching. It's worth making sure they find you.

I'll put together a free audit for you: your Google Business Profile, website or lack of one, social pages, and a short list of what to fix first. It's in plain English, usually ready in about a business day, and you're free to do it all yourself.

Would that be helpful?

Best,
[Your Name]`,
    tip: "Keep the observation factual and screenshot-able. Small owners respond to \"I'm local and I looked,\" not to industry terms.",
  },
  {
    id: 'startup-launch',
    title: 'Startup launch: newly registered or about to open',
    useWhen: 'A newly registered business, a "coming soon" sign, a new storefront, or a new business filing or social page with little on it yet.',
    whenToSend: 'Day 1, ideally 4 to 8 weeks before opening day.',
    subjectOptions: [
      'Congrats on [Business Name], and a free launch audit',
      'Opening soon? A quick plan for [Business Name]',
      'Before [Business Name] opens its doors',
    ],
    body: `Hi [First name],

Congratulations on [Business Name]! I saw [where you heard, e.g. the coming-soon sign on Main Street / your new Instagram page] and wanted to reach out before opening day gets busy.

Starting from zero is a good place to be: you can get it right the first time. I'd like to send you a free launch audit covering what you have so far, what customers will look for first, and a simple order of operations so you're found from day one.

If it helps, our Business Launch package covers your brand, website, Google Business Profile, and launch graphics in one go. No pressure. The audit is yours to keep.

Want me to put it together?

Cheers,
[Your Name]`,
    tip: 'New owners are overwhelmed. Make the audit feel like a checklist that saves them time, not another thing to manage.',
  },
  {
    id: 'walk-in-followup',
    title: 'Walk-in follow-up',
    useWhen: 'You stopped by in person, dropped off a card, or met the owner or manager at the counter or a local event.',
    whenToSend: 'Same day or next morning, while the visit is fresh.',
    subjectOptions: [
      'Great meeting you at [Business Name] today',
      'Following up from my visit, [First name]',
      'The free audit I mentioned',
    ],
    body: `Hi [First name],

Thanks for taking a minute with me at [Business Name] [today / yesterday]. [Personal detail, e.g. "Good luck with the patio opening next month."]

As promised, I'd be glad to send you a free audit of your online presence: your Google Business Profile, website, social pages, and the few changes that would bring in the most [customers / calls / bookings]. It's in plain English, about a business day to prepare, with no obligation.

Just reply "yes" and I'll get started. Or, if it's easier, tell me a good time to stop back in and walk you through it.

Thanks again,
[Your Name]`,
    tip: 'Name the person you spoke with and one thing they said. If you met a manager, ask who handles marketing decisions.',
  },
  {
    id: 'followup-1',
    title: 'General follow-up #1',
    useWhen: 'No reply to any of the first emails above.',
    whenToSend: '4 to 5 business days after the first email. Reply in the same thread.',
    subjectOptions: [
      'Re: (keep the original subject line)',
      'Still happy to send that audit, [First name]',
      "One quick thing I noticed about [Business Name]",
    ],
    body: `Hi [First name],

Just bringing this back to the top of your inbox. I know running the business comes first.

While I was looking, I noticed one quick fix you could make today, free: [one specific, useful tip, e.g. "your Google profile lists closing at 5, but your website says 7. Matching them helps customers and Google trust the listing."]

The full audit has a few more like that, ranked by what will make the biggest difference. Want me to send it?

Best,
[Your Name]`,
    tip: 'Always give something useful in a follow-up. A free, specific tip shows how we work: we show our work.',
  },
  {
    id: 'final-followup',
    title: 'Final follow-up',
    useWhen: 'No reply after the first email and follow-up #1. This is the last message.',
    whenToSend: '10 to 14 days after the first email. Then stop and note it in your tracker.',
    subjectOptions: [
      'Should I close your file, [First name]?',
      "Last note about [Business Name]'s audit",
      'Closing the loop',
    ],
    body: `Hi [First name],

I haven't heard back, so I'll assume the timing isn't right, and that's completely fine. This will be my last email.

If you ever want a second set of eyes on [Business Name]'s Google profile, website, or social pages, the free audit offer stands. Just reply to this email or reach us at sales@sundayharmony.com and we'll get back to you within about a business day.

Wishing you a great season,
[Your Name]`,
    tip: 'Keep it warm and short, with no guilt and no pressure. A graceful exit is often what earns the reply, sometimes months later.',
  },
]

export interface SocialPostTemplate {
  id: string
  number: number
  title: string
  category: string
  platform: string
  format: string
  designDirection: string
  caption: string
  hashtags: string
}

export const socialPostTemplates: SocialPostTemplate[] = [
  {
    id: 'brand-story',
    number: 1,
    title: 'Does your business look like one business?',
    category: 'Pillar · Brand & Story',
    platform: 'Instagram + Facebook',
    format: 'Single image · 1080×1350 (4:5)',
    designDirection: 'Cream background (#F0EBE3), black serif headline (Cormorant Garamond), small gold eyebrow label. Optional: a 2×2 grid of muted, desaturated photos (storefront sign, website on phone, business card, Instagram profile) behind a cream overlay to show "patchwork." SH monogram + wordmark top left; sundayharmony.com bottom. Lots of white space.',
    caption: `Your sign says one thing. Your website says another. Your Instagram has a logo from three years ago.

Customers notice, even if they can't say why.

Brand & Story is where we start: who you are, what you stand for, and how you should look and sound, so every touchpoint feels like the same business.

Not sure how consistent you look right now? We'll show you in a free audit. Link in bio.`,
    hashtags: '#BrandStrategy #SmallBusinessBranding #LogoDesign #BrandIdentity #MarketingAgency #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #EggHarborTownship',
  },
  {
    id: 'outreach-presence',
    number: 2,
    title: 'Show up where customers already look',
    category: 'Pillar · Outreach & Presence',
    platform: 'Instagram + Facebook',
    format: 'Carousel · 3 slides · 1080×1350',
    designDirection: 'Slide 1: black background, gold radial glow top right, white serif headline, gold numbered list. Slide 2: four simple line icons (map pin, browser, phone, storefront) in gold on black, one short line each. Slide 3: "Free audit: see where you show up." CTA with sundayharmony.com and "Link in bio."',
    caption: `You don't need to be everywhere. You need to be where your customers already look.

For most South Jersey businesses, that's Google, your website, a social page or two, and out in the community.

Outreach & Presence means showing up in those places consistently and on purpose, without drowning in tactics. Digital and physical, one brand.

Want to know where you're missing customers? Start with a free audit. Link in bio.`,
    hashtags: '#LocalMarketing #GoogleBusinessProfile #SocialMediaMarketing #DigitalMarketing #SmallBusinessTips #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #AtlanticCityNJ',
  },
  {
    id: 'strategy-rhythm',
    number: 3,
    title: 'A plan you can actually run',
    category: 'Pillar · Strategy & Rhythm',
    platform: 'Instagram + Facebook',
    format: 'Single image · 1080×1350',
    designDirection: 'White background with a thin gold rule. Bold black serif headline across three lines. Below: a minimal weekly planner graphic (three rows, gold day labels) to suggest rhythm. Keep icons line-only. Brand mark top left; no stock photos.',
    caption: `Most owners don't need more marketing ideas. They need a simple plan and a steady rhythm.

What to say. Where to show up. How to keep it going while you run the business.

That's Strategy & Rhythm: we turn your brand into a plan you can actually follow, then meet with you monthly to see what's working and adjust. Plain English. No jargon.

Ready to stop doing it all yourself? Free audit, link in bio.`,
    hashtags: '#MarketingStrategy #SmallBusinessOwner #BusinessGrowth #MarketingPlan #Entrepreneur #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #GallowayNJ',
  },
  {
    id: 'free-audit-5things',
    number: 4,
    title: 'Free audit: five things we look at',
    category: 'Free Audit',
    platform: 'Instagram + Facebook',
    format: 'Single image · 1080×1350',
    designDirection: 'Black background, gold "FREE" tag top right, white serif headline. Numbered list in gold numerals with thin gold dividers (mirrors the contact page). Footer: "Reply in about 1 business day · sundayharmony.com."',
    caption: `Before we recommend anything, we look. And we show you what we found.

Our free audit covers:
1. Your Google Business Profile and "near me" visibility
2. Your website's message, speed, and basics
3. Your social presence and consistency
4. Your ad spend, if you run ads
5. Prioritized next steps, in plain English

Free. No obligation. You'll hear back in about 1 business day. Request yours at sundayharmony.com (link in bio).`,
    hashtags: '#FreeAudit #MarketingAudit #GoogleBusinessProfile #WebsiteTips #SmallBusinessMarketing #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #HammontonNJ',
  },
  {
    id: 'free-audit-whats',
    number: 5,
    title: "What's working, what's not, what to fix first",
    category: 'Free Audit',
    platform: 'Instagram + Facebook',
    format: 'Single image or Reel cover · 1080×1350',
    designDirection: 'Solid brand gold background (#B8943F), black serif headline stacked on three lines. Optional Reel: 3 quick text cards over a slow pan of a laptop with a Google Maps listing. Keep the CTA as text, not a button graphic.',
    caption: `Customers are already searching. Are they finding you?

Send us a quick note with your name, your business, and what feels stuck. We'll review your Google listing, website, and social pages and send back a written audit: what's working, what's not, and what to fix first.

It takes about a business day. It's free. And you can do the fixes yourself, with us, or not at all. No pressure.

Serving Atlantic County, South Jersey, and remote clients. Link in bio.`,
    hashtags: '#FreeMarketingAudit #LocalBusiness #SmallBusinessSupport #GrowYourBusiness #MarketingHelp #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #ACNJ #CapeMayCounty',
  },
  {
    id: 'gbp-fixes',
    number: 6,
    title: '5 Google Business Profile fixes',
    category: 'Tip · Google Business Profile',
    platform: 'Instagram + Facebook',
    format: 'Carousel · 6 slides · 1080×1350',
    designDirection: 'Slide 1: cream background, serif headline, numbered checklist preview. Slides 2–6: one tip per slide; large gold numeral, short headline, one sentence. Use a simple phone outline showing a map listing. Final slide: "Want us to check yours? Free audit · link in bio." Add a "Save this" bookmark icon on slide 1.',
    caption: `When someone searches "near me," your Google Business Profile is often the first thing they see.

Five fixes you can do this week:
1. Make your hours match your website and your door
2. Choose the most accurate primary category
3. Add real photos of your space, team, and work
4. Reply to every review, good or bad, kindly and quickly
5. Post an update or offer once a week

Save this for later. Want us to check yours? Free audit, link in bio.`,
    hashtags: '#GoogleBusinessProfile #GoogleMaps #LocalSEO #SmallBusinessTips #NearMe #MarketingTips #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #VinelandNJ',
  },
  {
    id: 'website-test',
    number: 7,
    title: 'The 5-second website test',
    category: 'Tip · Website basics',
    platform: 'Instagram + Facebook',
    format: 'Carousel · 6 slides · 1080×1350',
    designDirection: 'Slide 1: white background, serif question headline, short checklist preview. Inner slides: a clean phone mockup with a simple wireframe; gold circles highlight the area each tip refers to. Optional stopwatch icon on slide 1 for "5 seconds." End with free audit CTA slide.',
    caption: `Pull up your website on your phone and count to five. Can a stranger tell what you do, where you are, and how to reach you?

The basics that matter most:
1. Say what you do and where, right at the top
2. Make it easy to use on a phone
3. One clear button: call, book, or get a quote
4. Fast loading (big photos slow you down)
5. Phone, address, and hours on every page

Not sure how yours stacks up? We'll check it in your free audit. Link in bio.`,
    hashtags: '#WebsiteDesign #SmallBusinessWebsite #WebDesignTips #MobileFriendly #WebsiteTips #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #MaysLandingNJ',
  },
  {
    id: 'process',
    number: 8,
    title: 'From first call to first results',
    category: 'Process',
    platform: 'Instagram + Facebook',
    format: 'Carousel · 5 slides · 1080×1350',
    designDirection: 'Slide 1: black, gold glow bottom left, four numbered steps. Slides 2–5: one step per slide, a large gold numeral, the step name in serif, one sentence, and a thin gold line connecting to the next slide. Final slide CTA: "Step one is free."',
    caption: `Here's exactly what happens when you reach out:

1. Free Audit: we review your Google presence, website, and competitors, and show you what to fix.
2. Custom Plan: a strategy built for your business, goals, and budget. No cookie-cutter pitches.
3. Quick Win: within 30 days you'll see real results, like an optimized profile, first posts live, or first ads running.
4. Grow Together: monthly strategy calls, plain-English reports, and steady improvements.

No long-term contracts. We show our work. Start with step one, link in bio.`,
    hashtags: '#HowWeWork #MarketingProcess #MarketingAgency #SmallBusinessGrowth #ClientExperience #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #SomersPointNJ',
  },
  {
    id: 'packages',
    number: 9,
    title: 'A package for every stage',
    category: 'Packages',
    platform: 'Instagram + Facebook',
    format: 'Carousel · 5 slides · 1080×1350',
    designDirection: 'Slide 1: cream background, serif headline, four packages listed with gold bullets. Slides 2–5: one package per slide; name in serif, "from" price in gold Montserrat bold, 4–5 key inclusions. Marketing Partner slide inverted (black background) as the featured plan. Small footnote on the last slide: "Printing, hosting, ad spend, and video not included unless quoted."',
    caption: `Wherever your business is, there's a starting point:

Business Essentials, from $599 one-time: logo, colors, fonts, brand guidelines, business card, and social branding.

Business Launch, from $1,799 one-time: brand identity, a website up to 5 pages, Google Business Profile, and launch graphics.

Marketing Partner, from $799/month: monthly strategy, social posts and graphics, website updates, and Google upkeep.

Custom Solutions: e-commerce, print, apparel, vehicle wraps, ads, and more.

Not sure which fits? Your free audit will tell you. Link in bio.`,
    hashtags: '#MarketingPackages #BrandingPackage #WebsiteDesign #SmallBusinessMarketing #StartupBranding #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #NorthfieldNJ',
  },
  {
    id: 'why-sh',
    number: 10,
    title: 'We treat every client like our only client',
    category: 'Why Sunday Harmony',
    platform: 'Instagram + Facebook',
    format: 'Single image (founder photo) · 1080×1350',
    designDirection: 'Top half: a warm, natural photo of the founder at work (desk, laptop, or with a client at a local storefront). Swap the placeholder before posting. Bottom half: black panel, gold eyebrow, white serif quote, stats line in small caps. Caption can switch to first person if the founder posts it from a personal account.',
    caption: `Why Sunday Harmony?

Because running a business is enough work on its own. You shouldn't also have to be your own designer, web developer, and social media manager.

We speak plain English. We show our work. We start with a free audit and aim for a quick win in your first 30 days. And we treat every client like our only client.

150+ businesses served over 4+ years, right here in South Jersey and beyond.

Ready to stop doing it all yourself? Say hello, link in bio.`,
    hashtags: '#WhySundayHarmony #MeetTheFounder #SmallBusinessOwner #SmallBusinessSupport #LocalAgency #SouthJersey #AtlanticCounty #SouthJerseyBusiness #SJBusiness #ShopLocalNJ #NJSmallBusiness #AtlanticCityNJ',
  },
]

export interface PackageOption {
  tier: string
  scopeDescription: string
  startingPrice: string
  priceType: 'one-time' | 'monthly' | 'custom'
}

export function getPackageOptionsForAgreement(): PackageOption[] {
  return marketingPackages.map((pkg) => ({
    tier: pkg.tier,
    scopeDescription: pkg.features.filter(f => f.included).map(f => f.text).join('; '),
    startingPrice: pkg.priceLabel || (pkg.price ? `$${pkg.price.toLocaleString()}` : 'Custom'),
    priceType: pkg.priceSuffix === 'monthly' ? 'monthly' : pkg.priceSuffix === 'one-time' ? 'one-time' : 'custom',
  }))
}
