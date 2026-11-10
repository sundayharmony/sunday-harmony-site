import { deriveIntakeClassification } from '@/lib/credit-funding-classify'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'
import { buildFundingGoalsSummary } from '@/lib/credit-funding-validation'
import {
  FUNDING_APP_DRAFT_SOURCE,
  llcMeansNoBusiness,
  type FundingAppInput,
} from '@/lib/fundingapp-fields'

const NOT_COLLECTED = 'Not collected'

export function buildFundingAppSubmission(input: FundingAppInput): {
  payload: IntakeFormPayload
  draftSource: typeof FUNDING_APP_DRAFT_SOURCE
  fundingGoals: string
} {
  const ownsBusiness = !llcMeansNoBusiness(input.llcCreated)
  const fundingUse = ownsBusiness ? 'Business' : 'Personal'
  const creditGoals = ownsBusiness
    ? ['Credit Repair', 'Business Funding']
    : ['Credit Repair', 'Personal Funding']
  const fullName = `${input.firstName} ${input.lastName}`.trim()
  const payload: IntakeFormPayload = {
    fullName,
    dateOfBirth: '',
    ssn: '',
    email: input.email,
    phone: input.phone,
    address: NOT_COLLECTED,
    city: NOT_COLLECTED,
    state: NOT_COLLECTED,
    zipCode: NOT_COLLECTED,
    creditProfile: {
      creditScore: input.creditScore,
      businessOwner: ownsBusiness,
      fundingApp: {
        source: 'fundingapp',
        whyFunding: input.whyFunding,
        llcCreated: input.llcCreated,
        businessRevenue: input.businessRevenue,
        personalAccounts: input.personalAccounts,
        derogatoryAccounts: input.derogatoryAccounts,
      },
    },
    selectedCreditProvider: 'Experian',
    providerUsername: input.monitoringUsername,
    providerPassword: input.monitoringPassword,
    experianEmail: input.monitoringUsername,
    experianPassword: input.monitoringPassword,
    experianSecurityAnswer: input.experianSecurityAnswer,
    experianPin: input.experianPin,
    cfpbEmail: '',
    cfpbPassword: '',
    primaryCreditGoalsText: '',
    creditGoals,
    fundingAmount: input.fundingAmount,
    fundingUse,
    ownsBusiness,
    businessName: '',
    fundingTimeframe: '',
    goalsNotes: '',
    referredBy: '',
    businessProfile: {},
    consent: {
      accurateInfo: true,
      authorizeReview: true,
      agreeTerms: true,
    },
    typedSignature: fullName,
    signatureDate: new Date().toISOString().slice(0, 10),
  }
  const classification = deriveIntakeClassification(payload.creditGoals, payload.fundingUse)
  if (classification.serviceType !== 'credit_and_funding') {
    throw new Error('Funding application must be classified as credit and funding')
  }
  return {
    payload,
    draftSource: FUNDING_APP_DRAFT_SOURCE,
    fundingGoals: `Why: ${input.whyFunding} | ${buildFundingGoalsSummary(payload)}`,
  }
}
