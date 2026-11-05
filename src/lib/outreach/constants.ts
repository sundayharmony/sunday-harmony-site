export const OUTREACH_CAMPAIGN_SLUG = 'prospect-intro'
export const OUTREACH_SENDER_EMAIL = 'sales@sundayharmony.com'
export const OUTREACH_SENDER_DISPLAY = 'Sunday Harmony Consulting'
export const OUTREACH_SIGNER_NAME = 'Mac'
export const OUTREACH_COMPANY_NAME = 'Sunday Harmony Consulting'
export const OUTREACH_TAGLINE = 'Brand, strategy, and systems.'
export const OUTREACH_CTA_LABEL = 'Pick a time'
export const OUTREACH_CTA_URL = 'https://www.sundayharmony.com/book'
export const OUTREACH_ATTACHMENT_PATH = 'public/sales-materials/company-presentation.pdf'
export const OUTREACH_ATTACHMENT_FILENAME = 'Sunday-Harmony-Consulting-company-presentation.pdf'
export const OUTREACH_INK = '#0a0a0a'
export const OUTREACH_GOLD = '#b8943f'
export const OUTREACH_CREAM = '#f0ebe3'
export const OUTREACH_LEASE_MS = 2 * 60 * 1000
export const OUTREACH_MAX_ATTEMPTS = 5
export const OUTREACH_BACKOFF_SECONDS = [60, 120, 240, 480, 960] as const

export const EMAIL_BOT_UNVERIFIED_REPORTS = [
  {
    business: 'Egypt Star',
    email: null as string | null,
    outcome: 'sent' as const,
    reportedOn: '2026-11-05',
    notes: 'Reported sent today. Unverified. Block/review by exact business name only.',
  },
  {
    business: 'Holiday Coffee',
    email: null,
    outcome: 'sent' as const,
    reportedOn: '2026-11-05',
    notes: 'Reported sent today. Unverified. Block/review by exact business name only.',
  },
  {
    business: 'Catmosphere',
    email: null,
    outcome: 'sent' as const,
    reportedOn: '2026-11-05',
    notes: 'Reported sent today. Unverified. Block/review by exact business name only.',
  },
  {
    business: 'Wise Bean',
    email: 'hey@wisebean.com',
    outcome: 'null_mx' as const,
    reportedOn: '2026-11-05',
    notes: 'Reported Null MX. Unverified. Do not treat as a permanent provider bounce.',
  },
  {
    business: "Claude's Corner",
    email: 'claudescorner@comcast.net',
    outcome: 'bounce_550' as const,
    reportedOn: '2026-11-05',
    notes: 'Reported Comcast 550. Unverified. Do not treat as a provider-confirmed bounce.',
  },
] as const
