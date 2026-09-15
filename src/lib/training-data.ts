// ══════════════════════════════════════════════════════════
// Sales Training Data — Company info, role expectations, workflow
// ══════════════════════════════════════════════════════════

import { DISPUTE_OPS_TASK_TEMPLATES } from '@/lib/dispute-letters/dispute-lifecycle'

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
        'Escalate stubborn verified/no-response items toward CFPB complaint drafts. Release mailed rounds to the client portal so they can see status and upload bureau replies. Staff still print/mail letters from Credit Intelligence; the portal does not download the ZIP.',
    },
  ],
  taskTemplates: DISPUTE_OPS_TASK_TEMPLATES,
  tips: [
    'Never store client consumerfinance.gov passwords — clients submit CFPB complaints themselves.',
    'Mark rounds mailed / awaiting response before opening the next round.',
    'Release to client only after letters are ready or mailed so the portal shows round status and can accept bureau-reply uploads.',
  ],
}
