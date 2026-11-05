// ══════════════════════════════════════════════════════════
// Sales Training Data — Company info, role expectations, workflow
// ══════════════════════════════════════════════════════════

import { DISPUTE_OPS_TASK_TEMPLATES } from '@/lib/dispute-letters/dispute-lifecycle'
import { packagePriceDisplay, packages } from '@/lib/data'
import { SCORE_FACTORS, STAFF_PIPELINE_STAGES, STAGE_LABELS } from '@/lib/marketing-pipeline'

// ══════════ COMPANY OVERVIEW ══════════
export const companyInfo = {
  name: 'Sunday Harmony',
  tagline: 'Helping small businesses grow their online presence',
  mission: 'Sunday Harmony is a full-service marketing agency focused on helping small and local businesses grow their online presence and generate more leads. We partner with business owners who are ready to stop guessing and start growing.',
}

export const services = [
  {
    name: 'Local SEO',
    icon: '📍',
    description: 'Improving Google Business Profiles and helping businesses rank in local/"near me" searches.',
    keyPoints: ['Google Business Profile optimization', 'Local search rankings', 'Citation building', 'Map pack visibility'],
  },
  {
    name: 'Social Media Management',
    icon: '📱',
    description: 'Creating content, scheduling posts, and engaging with customers across platforms.',
    keyPoints: ['Content creation', 'Post scheduling', 'Community engagement', 'Brand consistency'],
  },
  {
    name: 'Google & Meta Ads',
    icon: '📊',
    description: 'Running and optimizing paid advertising campaigns to drive targeted leads.',
    keyPoints: ['Campaign setup', 'Audience targeting', 'Budget optimization', 'Performance tracking'],
  },
  {
    name: 'Review Management',
    icon: '⭐',
    description: 'Helping businesses collect and respond to Google and Yelp reviews.',
    keyPoints: ['Review collection', 'Response management', 'Reputation monitoring', 'Rating improvement'],
  },
  {
    name: 'Email Marketing',
    icon: '✉️',
    description: 'Newsletters and automated campaigns to nurture leads and retain customers.',
    keyPoints: ['Newsletter design', 'Automated sequences', 'List management', 'Campaign analytics'],
  },
  {
    name: 'Physical Marketing',
    icon: '🖨️',
    description: 'Business cards, flyers, signage, and direct mail to complement digital efforts.',
    keyPoints: ['Business cards', 'Flyers & brochures', 'Signage', 'Direct mail campaigns'],
  },
]

export const companyProcess = [
  {
    step: 1,
    title: 'Free Marketing Audit',
    description: 'We start with a comprehensive review of the business\'s current online presence, identifying gaps and opportunities.',
    color: '#3a8bc2',
  },
  {
    step: 2,
    title: 'Custom Marketing Plan',
    description: 'Based on the audit, we create a tailored strategy designed specifically for their business goals and budget.',
    color: '#4a9e7d',
  },
  {
    step: 3,
    title: 'Quick Implementation',
    description: 'We move fast to implement the plan, delivering early wins that demonstrate value within the first 30 days.',
    color: '#c9a96e',
  },
  {
    step: 4,
    title: 'Ongoing Reporting & Optimization',
    description: 'Regular performance reports and continuous optimization ensure sustained growth and ROI.',
    color: '#7b68c9',
  },
]

// ══════════ ROLE EXPECTATIONS ══════════
export const roleQualities = [
  {
    title: 'Self-Motivated',
    icon: '🎯',
    description: 'You manage your own schedule and consistently hit KPI targets without needing constant supervision.',
    details: [
      'Set and track your own daily goals',
      'Stay productive during remote/independent work',
      'Take initiative to improve your results',
      'Hold yourself accountable to commitments',
    ],
  },
  {
    title: 'Resilient',
    icon: '💪',
    description: 'You handle rejection well and remain persistent in a sales-driven environment.',
    details: [
      'View "no" as part of the process, not a personal failure',
      'Maintain positive energy after difficult calls',
      'Learn from objections to improve your pitch',
      'Stay consistent even during slow periods',
    ],
  },
  {
    title: 'Organized',
    icon: '📋',
    description: 'Strong organizational skills including accurate records and detailed reporting.',
    details: [
      'Maintain accurate call recordings and notes',
      'Keep the lead list updated in real-time',
      'Provide detailed activity and performance reports',
      'Track all prospect interactions systematically',
    ],
  },
  {
    title: 'Results-Driven',
    icon: '📈',
    description: 'You focus on outcomes and consistently work toward meeting and exceeding targets.',
    details: [
      'Understand and prioritize KPI metrics',
      'Continuously seek ways to improve conversion',
      'Celebrate wins and analyze losses',
      'Stay focused on revenue-generating activities',
    ],
  },
]

export const successTraits = [
  'Comfortable making 30-50+ outreach attempts per day',
  'Excellent verbal and written communication skills',
  'Ability to quickly understand client pain points',
  'Genuine interest in helping small businesses succeed',
  'Coachable and open to feedback',
  'Basic understanding of digital marketing concepts',
]

// ══════════ WORK GUIDELINES ══════════
export const workSchedule = {
  timezone: 'U.S. Eastern Time (ET)',
  hours: '10:00 AM – 7:00 PM ET',
  days: 'Monday through Friday',
  note: 'These hours align with when most small businesses are active and available to take calls.',
}

export const leadListWorkflow = {
  overview: 'You will work from an actively updated lead list that provides the types of companies we\'re targeting, along with their business and contact information whenever available.',
  responsibilities: [
    {
      title: 'Identify Prospects',
      description: 'Use the provided lead list to find qualified businesses that match our target criteria.',
      icon: '🔍',
    },
    {
      title: 'Contact & Engage',
      description: 'Reach out via phone, email, or other approved channels to introduce Sunday Harmony\'s services.',
      icon: '📞',
    },
    {
      title: 'Qualify Leads',
      description: 'Determine if prospects are a good fit based on their needs, budget, and timeline.',
      icon: '✅',
    },
    {
      title: 'Maintain Records',
      description: 'Keep all contact information and interaction notes accurate and up to date.',
      icon: '📝',
    },
  ],
}

export const recordKeepingRequirements = [
  {
    requirement: 'Call Recordings',
    description: 'Maintain accurate recordings of all sales calls for quality assurance and training purposes.',
  },
  {
    requirement: 'Activity Logs',
    description: 'Document all outreach attempts including calls, emails, and follow-ups with timestamps.',
  },
  {
    requirement: 'Lead Status Updates',
    description: 'Update lead status promptly (new, contacted, qualified, proposal sent, won, lost).',
  },
  {
    requirement: 'Performance Reports',
    description: 'Provide detailed weekly reports on activities, conversions, and pipeline status.',
  },
]

export const bestPractices = [
  {
    title: 'Research Before Calling',
    tip: 'Spend 2-3 minutes reviewing the business\'s online presence before each call. Note specific observations to personalize your pitch.',
  },
  {
    title: 'Lead with Value',
    tip: 'Focus on how Sunday Harmony can solve their specific problems, not just listing our services.',
  },
  {
    title: 'Ask Questions',
    tip: 'The best salespeople listen more than they talk. Ask about their challenges and goals.',
  },
  {
    title: 'Follow Up Consistently',
    tip: 'Most sales require 5-7 touchpoints. Create a follow-up schedule and stick to it.',
  },
  {
    title: 'Handle Objections Gracefully',
    tip: 'Acknowledge concerns, ask clarifying questions, and address them with relevant benefits.',
  },
]

// ══════════ RESOURCES (Coming Soon) ══════════
export const comingSoonResources = [
  {
    title: 'Payment Processing',
    description: 'Step-by-step guide on how to process client payments through the website.',
    icon: '💳',
  },
  {
    title: 'Website Navigation',
    description: 'Complete walkthrough of the admin dashboard and client management features.',
    icon: '🖥️',
  },
]

// ══════════ CREDIT REPAIR / DISPUTE OPS (Phase 7) ══════════
export const disputeOpsTraining = {
  title: 'Credit Repair / Dispute Ops',
  overview:
    'Dispute ops runs Round 1 → Round N letters against the bureaus and furnishers, logs outcomes, and escalates stubborn items (including CFPB drafts). Use the Dispute Letters workflow plus the rounds panel on each credit-funding application.',
  narrative: [
    {
      round: 'Round 1',
      summary:
        'Select a focused set of tradelines (max 5 per bureau). Generate bureau + furnisher letters, print the packet with ID/address proof, mail certified/priority, log tracking, and set the 30-day response deadline from delivery (or mail date).',
    },
    {
      round: 'Round 2',
      summary:
        'Log outcomes (deleted / verified / updated / no response). Route verified → method of verification, no response → warning/intent, collections → debt validation. Keep one primary item per bureau letter, then mail and refresh the deadline.',
    },
    {
      round: 'Round 3+',
      summary:
        'Escalate stubborn verified/no-response items toward CFPB complaint drafts. Staff still print/mail letters from Credit Intelligence. Follow-up bureau reports go in Report history.',
    },
  ],
  taskTemplates: DISPUTE_OPS_TASK_TEMPLATES,
  tips: [
    'Never store client consumerfinance.gov passwords — clients submit CFPB complaints themselves.',
    'Mark rounds mailed / awaiting response before opening the next round.',
    'Upload follow-up bureau reports in Report history. Those files are the round responses.',
  ],
}

// ══════════ CLOSER SOP (interactive Training hub) ══════════
export const CLOSER_TRAINING_PDF_PATH = '/sales-materials/closer-training-sop.pdf'
export const CLOSER_QUIZ_PASS_SCORE = 6

export type CloserSopLink = {
  href: string
  label: string
  external?: boolean
}

export type CloserSopModule = {
  id: string
  title: string
  icon: string
  sopSections: string
  summary: string
  bullets: string[]
  links: CloserSopLink[]
}

export type CloserQuizOption = { id: string; label: string }
export type CloserQuizQuestion = {
  id: string
  prompt: string
  options: CloserQuizOption[]
  correctId: string
}

export type TrainingProgress = {
  modulesCompleted: string[]
  quizScore?: number
  quizPassedAt?: string
}

function packageLine(tier: string, fallback: string): string {
  const pkg = packages.find((item) => item.tier === tier)
  if (!pkg) return fallback
  const price = packagePriceDisplay(pkg)
  if (pkg.priceSuffix === 'quote') return `${pkg.tier} — ${price}. ${pkg.tagline}`
  const suffix = pkg.priceSuffix === 'monthly' ? '/mo' : ' one-time'
  const investment = /^from /i.test(price) ? `${price}${suffix}` : `from ${price}${suffix}`
  return `${pkg.tier} — ${investment}. ${pkg.tagline}`
}

export const closerSopModules: CloserSopModule[] = [
  {
    id: 'how-to-use-admin',
    title: 'How to use admin',
    icon: '🖥️',
    sopSections: '01, 06, 07',
    summary: 'Your daily workspace is Sunday Harmony admin: Today, Pipeline, Sales Kit, and Messages.',
    bullets: [
      'Today (/admin) is the start-of-day hub: overdue todos, follow-ups, and billing cues for Active clients.',
      'Pipeline is the prospect board and file. Score, stage, notes, and handoffs live here.',
      'Sales Kit holds Materials (PDFs), Agreements & Proposals, and Outreach Emails. Use the Closer Training Manual from Materials when you need the full SOP.',
      'Messages is your inbox. Settings is account and security. Todos are personal follow-ups.',
      'Daily rhythm: clear Today → work high scores and Contacted / Proposal stages → log every contact → follow up honestly, never invent audit results.',
      'As a closer you mainly work leads handed to sales. Procurement owns early research; you own replies through close.',
    ],
    links: [
      { href: '/admin', label: 'Open Today' },
      { href: '/admin/pipeline', label: 'Open Pipeline' },
      { href: '/admin/sales-kit', label: 'Open Sales Kit' },
      { href: '/admin/messages', label: 'Open Messages' },
    ],
  },
  {
    id: 'packages-pitching',
    title: 'Packages & pitching',
    icon: '✦',
    sopSections: '04',
    summary: 'Sell a solution, not a laundry list. Primary close is Business Launch; add Marketing Partner when they need steady monthly help.',
    bullets: [
      packageLine('Business Essentials', 'Business Essentials from $599 one-time — brand foundation.'),
      packageLine('Business Launch', 'Business Launch from $1,799 one-time — brand identity plus a website up to 5 pages, GBP, and launch graphics.'),
      packageLine('Marketing Partner', 'Marketing Partner from $799/mo — monthly strategy, social, website updates, and GBP upkeep.'),
      packageLine('Custom Solutions', 'Custom Solutions by quote — e-commerce, print, apparel, wraps, ads, and systems.'),
      'Map what they need: better website / from zero → Launch. No branding yet → Essentials. Ongoing support → Partner. Promo or specialty work → Custom / production quote.',
      'Prices are starting points. The free audit shapes the final quote. Printing, hosting, domains, plugins, stock, ad spend, and video are not included unless quoted. Monthly work is month-to-month with 30 days’ written notice.',
    ],
    links: [
      { href: '/admin/sales-kit', label: 'Open Sales Kit' },
      { href: CLOSER_TRAINING_PDF_PATH, label: 'Open training PDF', external: true },
    ],
  },
  {
    id: 'audit-to-agreement',
    title: 'Audit → discovery → proposal → agreement',
    icon: '📝',
    sopSections: '03, 05, 09, 10',
    summary: 'Every outreach opens with a free written audit. Goal of each email is one reply — then discovery, a specific proposal, and a signed agreement.',
    bullets: [
      'The audit covers five areas: Google Business Profile and “near me” visibility; website messaging, speed, and conversion; social presence and consistency; ad spend if they run ads; prioritized next steps in plain English.',
      'Reply in about one business day. They can implement with us, on their own, or pause. No obligation. Hook: free audit up front + a quick win within 30 days once they hire us.',
      'After they reply, do not send a price list. Ask how they handle marketing now, whether they are satisfied with the site, the biggest challenge attracting customers, stalled projects, and the one thing they would improve.',
      'Recommend a package from what they said plus audit findings. Send the Client Proposal (Sales Kit), then the Client Service Agreement when they say yes.',
      'One-time work: about 50% deposit before work; ownership transfers on full payment. Monthly: billed in advance; first month before work begins. Never guarantee rankings, leads, or sales.',
      'Before Client Relations takes over, fill handoff fields: services, scope, deliverables, deadline, promises, expectations, agreement signed, payment status, and proposal link.',
    ],
    links: [
      { href: '/admin/sales-kit', label: 'Open Sales Kit' },
      { href: '/admin/pipeline', label: 'Open Pipeline' },
    ],
  },
  {
    id: 'scoring-pipeline',
    title: 'Scoring & pipeline stages',
    icon: '📈',
    sopSections: '05, 06',
    summary: 'Score five factors from 0–2 (total 0–10). Move the live stage as the deal actually moves — never skip logging.',
    bullets: [
      `Five factors, each 0–2: ${SCORE_FACTORS.map((factor) => factor.label.replace(/^Has an? /i, '').replace(/^Appears /i, '')).join('; ')}.`,
      '8–10 is high priority, 5–7 is medium, 0–4 is hold. Move to Ready to contact when research is done.',
      `Stages: ${STAFF_PIPELINE_STAGES.map((stage) => STAGE_LABELS[stage]).join(' → ')}.`,
      'Researching = identified but not contacted. Ready to contact = qualified and researched. Contacted = outreach sent. Book a Google Meet from the meeting card without changing stage. Proposal sent = pricing presented. Negotiation = discussing the opportunity. Active (Won) = signed and paid. Inactive (Lost / Nurture) = not moving forward; keep for later.',
      'Confirm lane labels on the live Pipeline board. Log every contact; mark Lost / Nurture honestly when the timing is wrong.',
    ],
    links: [
      { href: '/admin/pipeline', label: 'Open Pipeline' },
    ],
  },
  {
    id: 'outreach-cadence',
    title: 'Outreach rules + cadence',
    icon: '✉️',
    sopSections: '08',
    summary: 'Three emails, then stop. Personalize one real detail, stay under 150 words, and ask for one reply.',
    bullets: [
      'Day 1: first email (established / weak presence / startup / walk-in follow-up — pick the matching Sales Kit template).',
      'Day 4–5: follow-up #1 in the same thread. Always give one free, specific tip.',
      'Day 10–14: final follow-up, then stop and note it in Pipeline. A graceful exit often earns the later reply.',
      'Always: personalize one real detail, keep it under 150 words, one ask, honor opt-outs immediately. Stay on marketing — brand, website, Google, social, print.',
      'Sound like us: calm, confident, plain English. Include a mailing address in the signature and a real reply-to. Copy templates from Sales Kit → Outreach Emails.',
    ],
    links: [
      { href: '/admin/sales-kit', label: 'Open Outreach Emails' },
      { href: CLOSER_TRAINING_PDF_PATH, label: 'Open training PDF', external: true },
    ],
  },
]

export const CLOSER_SOP_MODULE_IDS = closerSopModules.map((module) => module.id)

export const closerSopQuiz: CloserQuizQuestion[] = [
  {
    id: 'goal-outreach',
    prompt: 'What is the goal of every outreach email?',
    options: [
      { id: 'a', label: 'Book a paid consult on the first send' },
      { id: 'b', label: 'One reply — lead with the free audit, not the pitch' },
      { id: 'c', label: 'Send the full price list so they can self-select' },
      { id: 'd', label: 'Get a signed agreement before the discovery call' },
    ],
    correctId: 'b',
  },
  {
    id: 'launch-price',
    prompt: 'Name the primary one-time package we lead with, and its starting price.',
    options: [
      { id: 'a', label: 'Business Essentials, from $599 one-time' },
      { id: 'b', label: 'Marketing Partner, from $799/mo' },
      { id: 'c', label: 'Business Launch, from $1,799 one-time' },
      { id: 'd', label: 'Custom Solutions, from $1,799/mo' },
    ],
    correctId: 'c',
  },
  {
    id: 'audit-areas',
    prompt: 'Which five areas does the free audit cover?',
    options: [
      { id: 'a', label: 'Payroll, bookkeeping, inventory, HR, and legal filings' },
      { id: 'b', label: 'GBP / local visibility; website messaging, speed, and conversion; social consistency; ad spend if any; prioritized next steps' },
      { id: 'c', label: 'Logo only, print menu, vehicle wrap, apparel, and paid ads' },
      { id: 'd', label: 'Credit score, dispute letters, funding, referrals, and invoices' },
    ],
    correctId: 'b',
  },
  {
    id: 'score-factors',
    prompt: 'What are the five scoring factors, and what total is high priority?',
    options: [
      { id: 'a', label: 'Weakness, operating, need, decision-maker, ability to invest — each 0–2. High = 8–10' },
      { id: 'b', label: 'Calls, emails, meetings, proposals, closes — each 0–5. High = 20+' },
      { id: 'c', label: 'Website, ads, social, print, referrals — each 1–10. High = 40+' },
      { id: 'd', label: 'Fit, budget, timeline only — each 0–3. High = 9' },
    ],
    correctId: 'a',
  },
  {
    id: 'sales-kit-path',
    prompt: 'Which admin path holds the PDF library and copyable outreach templates?',
    options: [
      { id: 'a', label: '/admin/content-kit — Content Kit tab' },
      { id: 'b', label: '/admin/settings — Reference tab' },
      { id: 'c', label: '/admin/sales-kit — Materials for PDFs, Outreach Emails for templates' },
      { id: 'd', label: '/admin/clients — Files tab' },
    ],
    correctId: 'c',
  },
  {
    id: 'cadence',
    prompt: 'Day 1 → Day 4–5 → Day 10–14. What happens at each step?',
    options: [
      { id: 'a', label: 'Proposal → agreement → invoice, then weekly forever' },
      { id: 'b', label: 'Call, then voicemail, then a same-day drop-in' },
      { id: 'c', label: 'LinkedIn connect, then a pitch deck, then a discount' },
      { id: 'd', label: 'First email → follow-up #1 with a free tip → final follow-up, then stop' },
    ],
    correctId: 'd',
  },
  {
    id: 'package-map',
    prompt: 'A website from scratch maps to which package? Ongoing monthly help?',
    options: [
      { id: 'a', label: 'Website from scratch → Business Launch. Ongoing monthly → Marketing Partner' },
      { id: 'b', label: 'Website from scratch → Business Essentials. Ongoing monthly → Custom Solutions' },
      { id: 'c', label: 'Website from scratch → Marketing Partner. Ongoing monthly → Business Launch' },
      { id: 'd', label: 'Both needs map to Custom Solutions only' },
    ],
    correctId: 'a',
  },
  {
    id: 'ownership',
    prompt: 'When does ownership of deliverables transfer to the client?',
    options: [
      { id: 'a', label: 'When the proposal is viewed' },
      { id: 'b', label: 'On full payment of fees for that deliverable' },
      { id: 'c', label: 'On the discovery call, before any deposit' },
      { id: 'd', label: 'Thirty days after the first email, automatically' },
    ],
    correctId: 'b',
  },
]

export const liveTrainingResources: Array<{
  title: string
  description: string
  href: string
  icon: string
  external?: boolean
}> = [
  {
    title: 'Closer Training Manual',
    description: 'Full SOP PDF: admin dashboard, packages, outreach, discovery, proposal, and close.',
    href: CLOSER_TRAINING_PDF_PATH,
    icon: '📘',
    external: true,
  },
  {
    title: 'Sales Kit Materials',
    description: 'Download the training manual next to the presentation, proposal, agreement, and outreach PDFs.',
    href: '/admin/sales-kit',
    icon: '💼',
  },
  {
    title: 'Pipeline board',
    description: 'Score prospects, move stages, and log follow-ups on the live board.',
    href: '/admin/pipeline',
    icon: '📈',
  },
]

export function emptyTrainingProgress(): TrainingProgress {
  return { modulesCompleted: [] }
}

export function trainingProgressStorageKey(userId: string): string {
  return `sh-training-progress:${userId}`
}

export function parseTrainingProgress(raw: string | null | undefined): TrainingProgress {
  const empty = emptyTrainingProgress()
  if (!raw) return empty
  try {
    const parsed = JSON.parse(raw) as Partial<TrainingProgress>
    if (!parsed || !Array.isArray(parsed.modulesCompleted)) return empty
    return {
      modulesCompleted: parsed.modulesCompleted.filter((id): id is string => typeof id === 'string'),
      quizScore: typeof parsed.quizScore === 'number' ? parsed.quizScore : undefined,
      quizPassedAt: typeof parsed.quizPassedAt === 'string' ? parsed.quizPassedAt : undefined,
    }
  } catch {
    return empty
  }
}

export function toggleTrainingModule(progress: TrainingProgress, moduleId: string): TrainingProgress {
  const completed = new Set(progress.modulesCompleted)
  if (completed.has(moduleId)) completed.delete(moduleId)
  else completed.add(moduleId)
  return { ...progress, modulesCompleted: CLOSER_SOP_MODULE_IDS.filter((id) => completed.has(id)) }
}

export function gradeCloserQuiz(answers: Record<string, string>): {
  score: number
  total: number
  passed: boolean
  results: Array<{ id: string; correct: boolean; correctId: string }>
} {
  const results = closerSopQuiz.map((question) => ({
    id: question.id,
    correct: answers[question.id] === question.correctId,
    correctId: question.correctId,
  }))
  const score = results.filter((result) => result.correct).length
  return {
    score,
    total: closerSopQuiz.length,
    passed: score >= CLOSER_QUIZ_PASS_SCORE,
    results,
  }
}

export function applyQuizResult(progress: TrainingProgress, result: ReturnType<typeof gradeCloserQuiz>, passedAt: string): TrainingProgress {
  return {
    ...progress,
    quizScore: result.score,
    quizPassedAt: result.passed ? passedAt : undefined,
  }
}

export function closerTrainingComplete(progress: TrainingProgress): boolean {
  return (
    CLOSER_SOP_MODULE_IDS.every((id) => progress.modulesCompleted.includes(id)) &&
    Boolean(progress.quizPassedAt)
  )
}
