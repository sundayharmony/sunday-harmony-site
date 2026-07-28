import {
  CREDIT_PROVIDERS,
  CREDIT_GOAL_OPTIONS,
  FUNDING_TIMEFRAMES,
  ENTITY_TYPES,
  FUNDING_PURPOSE_OPTIONS,
  FUNDING_USE_OPTIONS,
  isSeekingFunding,
  requiresBusinessSection,
  type BusinessProfile,
  type CreditProfile,
  type ConsentData,
} from '@/lib/credit-funding-types'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn-utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const US_STATE_RE = /^[A-Z]{2}$/i
const ZIP_RE = /^\d{5}(-\d{4})?$/

export interface IntakeFormPayload {
  fullName: string
  dateOfBirth: string
  ssn: string
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
  experianEmail: string
  experianPassword: string
  cfpbEmail: string
  cfpbPassword: string
  primaryCreditGoalsText: string
  creditGoals: string[]
  fundingAmount: string
  fundingUse: string
  ownsBusiness: boolean
  businessName: string
  fundingTimeframe: string
  goalsNotes: string
  businessProfile: BusinessProfile
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

function parseJsonField<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as T
    if (typeof raw === 'object' && raw) return raw as T
  } catch { /* keep fallback */ }
  return fallback
}

export function parseBusinessProfile(raw: unknown): BusinessProfile {
  const bp = parseJsonField<BusinessProfile>(raw, {})
  return {
    legalName: str(bp.legalName, 200),
    dba: str(bp.dba, 200),
    ein: str(bp.ein, 20),
    address: str(bp.address, 300),
    city: str(bp.city, 100),
    state: str(bp.state, 2).toUpperCase(),
    zipCode: str(bp.zipCode, 12),
    phone: str(bp.phone, 30),
    email: str(bp.email, 254).toLowerCase(),
    website: str(bp.website, 300),
    industry: str(bp.industry, 200),
    entityType: str(bp.entityType, 100),
    yearEstablished: str(bp.yearEstablished, 10),
    numberOfEmployees: str(bp.numberOfEmployees, 20),
    annualRevenue: str(bp.annualRevenue, 50),
    businessDescription: str(bp.businessDescription, 5000),
    businessCreditScore: str(bp.businessCreditScore, 20),
    businessCreditCards: str(bp.businessCreditCards, 20),
    businessLoans: typeof bp.businessLoans === 'boolean' ? bp.businessLoans : undefined,
    businessCollections: typeof bp.businessCollections === 'boolean' ? bp.businessCollections : undefined,
    paydexScore: str(bp.paydexScore, 20),
    fundingPurposes: Array.isArray(bp.fundingPurposes)
      ? bp.fundingPurposes.filter((p) => FUNDING_PURPOSE_OPTIONS.includes(p as typeof FUNDING_PURPOSE_OPTIONS[number]))
      : [],
    existingBusinessDebt: typeof bp.existingBusinessDebt === 'boolean' ? bp.existingBusinessDebt : undefined,
    collateralAvailable: typeof bp.collateralAvailable === 'boolean' ? bp.collateralAvailable : undefined,
    priorBusinessFunding: typeof bp.priorBusinessFunding === 'boolean' ? bp.priorBusinessFunding : undefined,
    taxLiensOrJudgments: typeof bp.taxLiensOrJudgments === 'boolean' ? bp.taxLiensOrJudgments : undefined,
  }
}

export function parseIntakePayload(raw: Record<string, unknown>): IntakeFormPayload {
  const creditProfile = parseJsonField<CreditProfile>(raw.creditProfile, {})
  const creditGoals = parseJsonField<string[]>(raw.creditGoals, []).filter((g) =>
    CREDIT_GOAL_OPTIONS.includes(g as typeof CREDIT_GOAL_OPTIONS[number])
  )
  const consent = parseJsonField<ConsentData>(raw.consent, {
    accurateInfo: false,
    authorizeReview: false,
    agreeTerms: false,
  })

  return {
    fullName: str(raw.fullName, 200),
    dateOfBirth: str(raw.dateOfBirth, 20),
    ssn: normalizeSsnDigits(str(raw.ssn, 11)),
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
    experianEmail: str(raw.experianEmail, 254).toLowerCase(),
    experianPassword: str(raw.experianPassword, 200),
    cfpbEmail: str(raw.cfpbEmail, 254).toLowerCase(),
    cfpbPassword: str(raw.cfpbPassword, 200),
    primaryCreditGoalsText: str(raw.primaryCreditGoalsText, 5000),
    creditGoals,
    fundingAmount: str(raw.fundingAmount, 100),
    fundingUse: str(raw.fundingUse, 50),
    ownsBusiness: bool(raw.ownsBusiness),
    businessName: str(raw.businessName, 200),
    fundingTimeframe: str(raw.fundingTimeframe, 50),
    goalsNotes: str(raw.goalsNotes, 10000),
    businessProfile: parseBusinessProfile(raw.businessProfile),
    consent,
    typedSignature: str(raw.typedSignature, 200),
    signatureDate: str(raw.signatureDate, 20),
  }
}

export function validateIntakePayload(payload: IntakeFormPayload): string | null {
  if (!payload.fullName) return 'Full legal name is required'
  if (!payload.dateOfBirth) return 'Date of birth is required'
  if (!isValidSsn(payload.ssn)) return 'Valid 9-digit Social Security Number is required'
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
  if (!payload.experianEmail || !EMAIL_RE.test(payload.experianEmail)) {
    return 'Valid Experian.com email is required'
  }
  if (!payload.experianPassword || payload.experianPassword.length < 4) {
    return 'Experian.com password is required'
  }
  if (!payload.cfpbEmail || !EMAIL_RE.test(payload.cfpbEmail)) {
    return 'Valid CFPB portal email is required'
  }
  if (!payload.cfpbPassword || payload.cfpbPassword.length < 4) {
    return 'CFPB portal password is required'
  }

  if (!payload.primaryCreditGoalsText && payload.creditGoals.length === 0) {
    return 'Please describe your credit goals or select at least one goal'
  }

  const seekingFunding = isSeekingFunding(payload.creditGoals, payload.fundingUse)
  if (seekingFunding) {
    if (!payload.fundingAmount) return 'Funding amount is required'
    if (!payload.fundingUse || !FUNDING_USE_OPTIONS.includes(payload.fundingUse as (typeof FUNDING_USE_OPTIONS)[number])) {
      return 'Please specify personal or business funding use'
    }
    if (!FUNDING_TIMEFRAMES.includes(payload.fundingTimeframe as typeof FUNDING_TIMEFRAMES[number])) {
      return 'Please select a funding timeframe'
    }
  } else if (payload.fundingUse && !FUNDING_USE_OPTIONS.includes(payload.fundingUse as (typeof FUNDING_USE_OPTIONS)[number])) {
    return 'Invalid funding use'
  } else if (
    payload.fundingTimeframe &&
    !FUNDING_TIMEFRAMES.includes(payload.fundingTimeframe as typeof FUNDING_TIMEFRAMES[number])
  ) {
    return 'Invalid funding timeframe'
  }

  if (payload.ownsBusiness && !payload.businessName) return 'Business name is required when you own a business'

  if (requiresBusinessSection(payload.ownsBusiness, payload.fundingUse, payload.creditProfile)) {
    const bp = payload.businessProfile
    if (!bp.legalName) return 'Legal business name is required for business funding'
    if (!bp.ein || !/^\d{2}-?\d{7}$/.test(bp.ein.replace(/\s/g, ''))) {
      return 'Valid EIN is required for business funding (format: XX-XXXXXXX)'
    }
    if (!bp.address) return 'Business address is required'
    if (!bp.city) return 'Business city is required'
    if (!bp.state || !US_STATE_RE.test(bp.state)) return 'Valid business state is required'
    if (!bp.industry) return 'Business industry is required'
    if (!bp.entityType || !ENTITY_TYPES.includes(bp.entityType as typeof ENTITY_TYPES[number])) {
      return 'Please select a business entity type'
    }
    if (!bp.fundingPurposes?.length) return 'Select at least one funding purpose'
  }

  if (!payload.consent.accurateInfo) return 'You must certify that all information is accurate'
  if (!payload.consent.authorizeReview) return 'You must authorize Sunday Harmony to review your credit information'
  if (!payload.consent.agreeTerms) return 'You must agree to the Privacy Policy and authorize processing'
  if (!payload.typedSignature) return 'Typed signature is required'
  if (!payload.signatureDate) return 'Signature date is required'

  return null
}

/** Staff draft saves only require identity for lookup; everything else is optional until finalize. */
export function validateDraftPayload(payload: IntakeFormPayload): string | null {
  if (!payload.fullName.trim()) return 'Full legal name is required'
  if (!payload.email || !EMAIL_RE.test(payload.email)) return 'Valid email address is required'
  if (payload.ssn && !isValidSsn(payload.ssn)) return 'SSN must be a valid 9-digit number when provided'
  if (payload.email && payload.email.length > 254) return 'Email is too long'
  if (payload.state && !US_STATE_RE.test(payload.state)) return 'State must be a 2-letter code when provided'
  if (payload.zipCode && !ZIP_RE.test(payload.zipCode)) return 'ZIP code is invalid'
  if (payload.phone && payload.phone.replace(/\D/g, '').length > 0 && payload.phone.replace(/\D/g, '').length < 10) {
    return 'Phone number must have at least 10 digits when provided'
  }
  if (
    payload.selectedCreditProvider &&
    !CREDIT_PROVIDERS.includes(payload.selectedCreditProvider as typeof CREDIT_PROVIDERS[number])
  ) {
    return 'Invalid credit monitoring provider'
  }
  if (
    payload.fundingTimeframe &&
    !FUNDING_TIMEFRAMES.includes(payload.fundingTimeframe as typeof FUNDING_TIMEFRAMES[number])
  ) {
    return 'Invalid funding timeframe'
  }
  if (
    payload.fundingUse &&
    !FUNDING_USE_OPTIONS.includes(payload.fundingUse as (typeof FUNDING_USE_OPTIONS)[number])
  ) {
    return 'Invalid funding use'
  }
  return null
}

export function buildFundingGoalsSummary(payload: IntakeFormPayload): string {
  const parts = [
    payload.fundingAmount && `Amount: ${payload.fundingAmount}`,
    payload.fundingUse && `Use: ${payload.fundingUse}`,
    payload.fundingTimeframe && `Timeframe: ${payload.fundingTimeframe}`,
    payload.ownsBusiness !== undefined && `Business owner: ${payload.ownsBusiness ? 'Yes' : 'No'}`,
    payload.businessName && `Business: ${payload.businessName}`,
    payload.businessProfile?.legalName && `Legal entity: ${payload.businessProfile.legalName}`,
  ].filter(Boolean)
  return parts.join(' | ')
}

export function assertHttpsSubmission(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const proto = request.headers.get('x-forwarded-proto')
  return proto === 'https'
}
