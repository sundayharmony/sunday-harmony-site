import {
  CREDIT_PROVIDERS,
  CREDIT_GOAL_OPTIONS,
  FUNDING_TIMEFRAMES,
  type CreditProfile,
  type ConsentData,
} from '@/lib/credit-funding-types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const US_STATE_RE = /^[A-Z]{2}$/i
const ZIP_RE = /^\d{5}(-\d{4})?$/

export interface IntakeFormPayload {
  fullName: string
  dateOfBirth: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  creditProfile: CreditProfile
  selectedCreditProvider: string
  providerUsername: string
  providerPassword: string
  primaryCreditGoalsText: string
  creditGoals: string[]
  fundingAmount: string
  fundingUse: string
  ownsBusiness: boolean
  businessName: string
  fundingTimeframe: string
  goalsNotes: string
  consent: ConsentData
  typedSignature: string
  signatureDate: string
}

function str(val: unknown, max: number): string {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, max)
}

function bool(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  if (val === 'true' || val === '1') return true
  return false
}

export function parseIntakePayload(raw: Record<string, unknown>): IntakeFormPayload {
  let creditProfile: CreditProfile = {}
  let creditGoals: string[] = []
  let consent: ConsentData = { accurateInfo: false, authorizeReview: false, agreeTerms: false }

  try {
    if (typeof raw.creditProfile === 'string') creditProfile = JSON.parse(raw.creditProfile)
    else if (typeof raw.creditProfile === 'object' && raw.creditProfile) creditProfile = raw.creditProfile as CreditProfile
  } catch { /* keep defaults */ }

  try {
    if (typeof raw.creditGoals === 'string') creditGoals = JSON.parse(raw.creditGoals)
    else if (Array.isArray(raw.creditGoals)) creditGoals = raw.creditGoals as string[]
  } catch { /* keep defaults */ }

  try {
    if (typeof raw.consent === 'string') consent = JSON.parse(raw.consent)
    else if (typeof raw.consent === 'object' && raw.consent) consent = raw.consent as ConsentData
  } catch { /* keep defaults */ }

  return {
    fullName: str(raw.fullName, 200),
    dateOfBirth: str(raw.dateOfBirth, 20),
    email: str(raw.email, 254).toLowerCase(),
    phone: str(raw.phone, 30),
    address: str(raw.address, 300),
    city: str(raw.city, 100),
    state: str(raw.state, 2).toUpperCase(),
    zipCode: str(raw.zipCode, 12),
    creditProfile,
    selectedCreditProvider: str(raw.selectedCreditProvider, 100),
    providerUsername: str(raw.providerUsername, 254),
    providerPassword: str(raw.providerPassword, 200),
    primaryCreditGoalsText: str(raw.primaryCreditGoalsText, 5000),
    creditGoals: creditGoals.filter((g) => CREDIT_GOAL_OPTIONS.includes(g as typeof CREDIT_GOAL_OPTIONS[number])),
    fundingAmount: str(raw.fundingAmount, 100),
    fundingUse: str(raw.fundingUse, 50),
    ownsBusiness: bool(raw.ownsBusiness),
    businessName: str(raw.businessName, 200),
    fundingTimeframe: str(raw.fundingTimeframe, 50),
    goalsNotes: str(raw.goalsNotes, 10000),
    consent,
    typedSignature: str(raw.typedSignature, 200),
    signatureDate: str(raw.signatureDate, 20),
  }
}

export function validateIntakePayload(payload: IntakeFormPayload): string | null {
  if (!payload.fullName) return 'Full legal name is required'
  if (!payload.dateOfBirth) return 'Date of birth is required'
  if (!payload.email || !EMAIL_RE.test(payload.email)) return 'Valid email address is required'
  if (!payload.phone || payload.phone.replace(/\D/g, '').length < 10) return 'Valid phone number is required'
  if (!payload.address) return 'Home address is required'
  if (!payload.city) return 'City is required'
  if (!payload.state || !US_STATE_RE.test(payload.state)) return 'Valid 2-letter state code is required'
  if (!payload.zipCode || !ZIP_RE.test(payload.zipCode)) return 'Valid ZIP code is required'

  if (!CREDIT_PROVIDERS.includes(payload.selectedCreditProvider as typeof CREDIT_PROVIDERS[number])) {
    return 'Please select a credit monitoring provider'
  }
  if (!payload.providerUsername) return 'Provider username or login email is required'
  if (!payload.providerPassword || payload.providerPassword.length < 4) return 'Provider password is required'

  if (!payload.primaryCreditGoalsText && payload.creditGoals.length === 0) {
    return 'Please describe your credit goals or select at least one goal'
  }
  if (!payload.fundingAmount) return 'Funding amount is required'
  if (!payload.fundingUse) return 'Please specify personal or business funding use'
  if (payload.ownsBusiness && !payload.businessName) return 'Business name is required when you own a business'
  if (!FUNDING_TIMEFRAMES.includes(payload.fundingTimeframe as typeof FUNDING_TIMEFRAMES[number])) {
    return 'Please select a funding timeframe'
  }

  if (!payload.consent.accurateInfo) return 'You must certify that all information is accurate'
  if (!payload.consent.authorizeReview) return 'You must authorize Sunday Harmony to review your credit information'
  if (!payload.consent.agreeTerms) return 'You must agree to the Privacy Policy and Terms of Service'
  if (!payload.typedSignature) return 'Typed signature is required'
  if (!payload.signatureDate) return 'Signature date is required'

  return null
}

export function buildFundingGoalsSummary(payload: IntakeFormPayload): string {
  const parts = [
    payload.fundingAmount && `Amount: ${payload.fundingAmount}`,
    payload.fundingUse && `Use: ${payload.fundingUse}`,
    payload.fundingTimeframe && `Timeframe: ${payload.fundingTimeframe}`,
    payload.ownsBusiness !== undefined && `Business owner: ${payload.ownsBusiness ? 'Yes' : 'No'}`,
    payload.businessName && `Business: ${payload.businessName}`,
  ].filter(Boolean)
  return parts.join(' | ')
}

export function assertHttpsSubmission(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const proto = request.headers.get('x-forwarded-proto')
  return proto === 'https'
}
