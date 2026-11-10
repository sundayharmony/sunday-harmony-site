import type { CreditProfile, FundingAppIntake } from '@/lib/credit-funding-types'

export const FUNDING_APP_PATH = '/fundingapp'

/** Free MyFico account, linked from the funding application credential note. */
export const MYFICO_URL = 'https://www.myfico.com/'

export const FUNDING_APP_DRAFT_SOURCE = 'fundingapp'

export const FUNDING_AMOUNT_OPTIONS = [
  '$5,000 – $15,000',
  '$15,000 – $25,000',
  '$25,000 – $50,000',
  '$50,000 – $100,000',
  '$100,000 – $250,000',
  '$250,000+',
] as const

export const FUNDING_REASON_OPTIONS = [
  'Start a business',
  'Buy equipment',
  'Working capital',
  'Expand the business',
  'Inventory',
  'Real estate',
  'Pay off debt',
  'Other',
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface FundingAppInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  fundingAmount: string
  whyFunding: string
  creditScore: string
  llcCreated: string
  businessRevenue: string
  personalAccounts: string
  derogatoryAccounts: string
  monitoringUsername: string
  monitoringPassword: string
  experianSecurityAnswer: string
  experianPin: string
  authorizeExperian: boolean
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function llcMeansNoBusiness(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, '')
  return normalized === 'na' || normalized === 'none' || normalized === 'no' || normalized === 'nope'
}

export function fundingAppFromProfile(profile: unknown): FundingAppIntake | null {
  if (!profile || typeof profile !== 'object') return null
  const raw = (profile as { fundingApp?: unknown }).fundingApp
  if (!raw || typeof raw !== 'object') return null
  const intake = raw as Partial<FundingAppIntake>
  if (intake.source !== 'fundingapp') return null
  return {
    source: 'fundingapp',
    whyFunding: typeof intake.whyFunding === 'string' ? intake.whyFunding : '',
    llcCreated: typeof intake.llcCreated === 'string' ? intake.llcCreated : '',
    businessRevenue: typeof intake.businessRevenue === 'string' ? intake.businessRevenue : '',
    personalAccounts: typeof intake.personalAccounts === 'string' ? intake.personalAccounts : '',
    derogatoryAccounts: typeof intake.derogatoryAccounts === 'string' ? intake.derogatoryAccounts : '',
  }
}

/** Keep /fundingapp answers when a later staff edit rebuilds the credit profile. */
export function mergePreservedFundingApp(
  submitted: CreditProfile,
  existing?: CreditProfile | null
): CreditProfile {
  if (submitted.fundingApp?.source === 'fundingapp') return submitted
  if (existing?.fundingApp?.source !== 'fundingapp') return submitted
  return { ...submitted, fundingApp: existing.fundingApp }
}

export function parseFundingAppInput(raw: unknown): { ok: true; value: FundingAppInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Enter the application details.' }
  const body = raw as Record<string, unknown>
  const value: FundingAppInput = {
    firstName: text(body.firstName, 80),
    lastName: text(body.lastName, 80),
    email: text(body.email, 254).toLowerCase(),
    phone: text(body.phone, 30),
    fundingAmount: text(body.fundingAmount, 80),
    whyFunding: text(body.whyFunding, 80),
    creditScore: text(body.creditScore, 40),
    llcCreated: text(body.llcCreated, 40),
    businessRevenue: text(body.businessRevenue, 200),
    personalAccounts: text(body.personalAccounts, 120),
    derogatoryAccounts: text(body.derogatoryAccounts, 2000),
    monitoringUsername: text(body.monitoringUsername, 254),
    monitoringPassword: text(body.monitoringPassword, 200),
    experianSecurityAnswer: text(body.experianSecurityAnswer, 200),
    experianPin: text(body.experianPin, 8).replace(/\D/g, ''),
    authorizeExperian: body.authorizeExperian === true,
  }
  const error = validateFundingAppInput(value)
  if (error) return { ok: false, error }
  return { ok: true, value }
}

export function validateFundingAppInput(input: FundingAppInput): string | null {
  if (!input.firstName) return 'First name is required'
  if (!input.lastName) return 'Last name is required'
  if (!EMAIL_RE.test(input.email)) return 'A valid email is required'
  if (input.phone.replace(/\D/g, '').length < 10) return 'A valid phone number is required'
  if (!FUNDING_AMOUNT_OPTIONS.includes(input.fundingAmount as (typeof FUNDING_AMOUNT_OPTIONS)[number])) {
    return 'Choose how much funding you need'
  }
  if (!FUNDING_REASON_OPTIONS.includes(input.whyFunding as (typeof FUNDING_REASON_OPTIONS)[number])) {
    return 'Choose why you are looking for funding'
  }
  if (!input.creditScore) return 'Credit score is required'
  if (!input.llcCreated) return 'Enter when your LLC was created, or N/A'
  if (!input.businessRevenue) return 'Enter your business revenue, or whether it is generating revenue yet'
  if (!input.personalAccounts) return 'Enter how many personal accounts you have'
  if (!input.derogatoryAccounts) return 'Answer the derogatory accounts question'
  if (!input.monitoringUsername) return 'Credit monitoring username is required'
  if (!input.monitoringPassword) return 'Credit monitoring password is required'
  if (!input.experianSecurityAnswer) return 'Experian security question answer is required'
  if (!/^\d{4}$/.test(input.experianPin)) return 'Experian PIN must be 4 digits'
  if (!input.authorizeExperian) return 'Authorization is required'
  return null
}
