import {
  decryptField,
  decryptFieldOrLegacy,
  encryptField,
  encryptFieldIfPresent,
  maskSecret,
} from '@/lib/field-encryption'
import type { BusinessProfile, CreditFundingApplication, CreditProfile } from '@/lib/credit-funding-types'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'

const REDACTED = '••••••••'

export function encryptFreeTextForDb(value: string | undefined | null): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value?.trim() || ''
  return trimmed ? encryptField(trimmed) : ''
}

export function decryptFreeTextForView(value: string | undefined | null): string {
  return value ? decryptFieldOrLegacy(value) : ''
}

export function encryptCreditProfileForDb(profile: CreditProfile): CreditProfile {
  return {
    ...profile,
    monthlyGrossIncome: profile.monthlyGrossIncome
      ? encryptField(profile.monthlyGrossIncome)
      : profile.monthlyGrossIncome,
    annualIncome: profile.annualIncome ? encryptField(profile.annualIncome) : profile.annualIncome,
  }
}

export function decryptCreditProfileForAdmin(profile: CreditProfile): CreditProfile {
  return {
    ...profile,
    monthlyGrossIncome: profile.monthlyGrossIncome
      ? decryptFieldOrLegacy(profile.monthlyGrossIncome)
      : profile.monthlyGrossIncome,
    annualIncome: profile.annualIncome ? decryptFieldOrLegacy(profile.annualIncome) : profile.annualIncome,
  }
}

export function serializeBusinessProfileForDb(bp: BusinessProfile): Record<string, unknown> {
  const {
    ein,
    address,
    city,
    state,
    zipCode,
    phone,
    email,
    ...rest
  } = bp

  return {
    ...rest,
    einEncrypted: ein ? encryptField(ein.replace(/\s/g, '')) : undefined,
    addressEncrypted: encryptFieldIfPresent(address),
    cityEncrypted: encryptFieldIfPresent(city),
    stateEncrypted: encryptFieldIfPresent(state),
    zipCodeEncrypted: encryptFieldIfPresent(zipCode),
    phoneEncrypted: encryptFieldIfPresent(phone),
    emailEncrypted: encryptFieldIfPresent(email),
  }
}

export function deserializeBusinessProfileForAdmin(bp: Record<string, unknown>): BusinessProfile {
  const {
    einEncrypted,
    addressEncrypted,
    cityEncrypted,
    stateEncrypted,
    zipCodeEncrypted,
    phoneEncrypted,
    emailEncrypted,
    ein: _legacyEin,
    address: _legacyAddress,
    city: _legacyCity,
    state: _legacyState,
    zipCode: _legacyZip,
    phone: _legacyPhone,
    email: _legacyEmail,
    ...rest
  } = bp

  return {
    ...(rest as BusinessProfile),
    ein: (einEncrypted as string | undefined)
      ? decryptField(einEncrypted as string)
      : (_legacyEin as string | undefined),
    address: (addressEncrypted as string | undefined)
      ? decryptFieldOrLegacy(addressEncrypted as string)
      : (_legacyAddress as string | undefined),
    city: (cityEncrypted as string | undefined)
      ? decryptFieldOrLegacy(cityEncrypted as string)
      : (_legacyCity as string | undefined),
    state: (stateEncrypted as string | undefined)
      ? decryptFieldOrLegacy(stateEncrypted as string)
      : (_legacyState as string | undefined),
    zipCode: (zipCodeEncrypted as string | undefined)
      ? decryptFieldOrLegacy(zipCodeEncrypted as string)
      : (_legacyZip as string | undefined),
    phone: (phoneEncrypted as string | undefined)
      ? decryptFieldOrLegacy(phoneEncrypted as string)
      : (_legacyPhone as string | undefined),
    email: (emailEncrypted as string | undefined)
      ? decryptFieldOrLegacy(emailEncrypted as string)
      : (_legacyEmail as string | undefined),
  }
}

export function buildEncryptedApplicationRow(payload: IntakeFormPayload, link?: { userId?: string; clientId?: string }) {
  return {
    full_name: payload.fullName,
    date_of_birth_encrypted: encryptField(payload.dateOfBirth),
    ssn_encrypted: encryptField(payload.ssn),
    email: payload.email,
    phone: encryptField(payload.phone),
    address: encryptField(payload.address),
    city: encryptField(payload.city),
    state: encryptField(payload.state),
    zip_code: encryptField(payload.zipCode),
    credit_profile: encryptCreditProfileForDb(payload.creditProfile),
    selected_credit_provider: payload.selectedCreditProvider,
    provider_username_encrypted: encryptField(payload.providerUsername),
    provider_password_encrypted: encryptField(payload.providerPassword),
    experian_email_encrypted: encryptField(payload.experianEmail),
    experian_password_encrypted: encryptField(payload.experianPassword),
    cfpb_email_encrypted: encryptField(payload.cfpbEmail),
    cfpb_password_encrypted: encryptField(payload.cfpbPassword),
    credit_goals: payload.creditGoals,
    primary_credit_goals_text: encryptFieldIfPresent(payload.primaryCreditGoalsText),
    funding_amount: payload.fundingAmount,
    funding_use: payload.fundingUse,
    owns_business: payload.ownsBusiness,
    business_name: payload.businessProfile.legalName || payload.businessName || null,
    funding_timeframe: payload.fundingTimeframe,
    goals_notes: encryptFieldIfPresent(payload.goalsNotes),
    consent_data: payload.consent,
    typed_signature: encryptField(payload.typedSignature),
    signature_date: payload.signatureDate,
    business_profile: serializeBusinessProfileForDb(payload.businessProfile),
    user_id: link?.userId || null,
    client_id: link?.clientId || null,
  }
}

export function buildEncryptedInvitationRow(params: {
  fullName: string
  email: string
  phone: string
  clientId?: string
  inviteExpiresAt: Date
  personalMessage?: string
}) {
  return {
    full_name: params.fullName.trim(),
    email: params.email.trim().toLowerCase(),
    phone: encryptField(params.phone),
    address: encryptField('Pending'),
    city: encryptField('Pending'),
    state: encryptField('XX'),
    zip_code: encryptField('00000'),
    credit_profile: {},
    selected_credit_provider: 'Pending',
    credit_goals: [],
    funding_goals: '',
    consent_data: {},
    typed_signature: encryptField('Pending'),
    signature_date: new Date().toISOString().slice(0, 10),
    status: 'invitation_pending',
    service_type: 'credit_and_funding',
    credit_funding_client_status: 'intake_started',
    client_id: params.clientId || null,
    invite_expires_at: params.inviteExpiresAt.toISOString(),
    invite_personal_message: encryptFreeTextForDb(params.personalMessage) || null,
  }
}

export function decryptApplicationSensitiveFields(app: CreditFundingApplication) {
  return {
    ...app,
    phone: decryptFieldOrLegacy(app.phone),
    address: decryptFieldOrLegacy(app.address),
    city: decryptFieldOrLegacy(app.city),
    state: decryptFieldOrLegacy(app.state),
    zip_code: decryptFieldOrLegacy(app.zip_code),
    date_of_birth: decryptField(app.date_of_birth_encrypted || ''),
    ssn: decryptField(app.ssn_encrypted || ''),
    provider_username: decryptField(app.provider_username_encrypted || ''),
    provider_password: decryptField(app.provider_password_encrypted || ''),
    experian_email: decryptField(app.experian_email_encrypted || ''),
    experian_password: decryptField(app.experian_password_encrypted || ''),
    cfpb_email: decryptField(app.cfpb_email_encrypted || ''),
    cfpb_password: decryptField(app.cfpb_password_encrypted || ''),
    internal_notes: decryptFreeTextForView(app.internal_notes),
    client_notes: decryptFreeTextForView(app.client_notes),
    next_steps: decryptFreeTextForView(app.next_steps),
    invite_personal_message: decryptFreeTextForView(app.invite_personal_message),
    primary_credit_goals_text: app.primary_credit_goals_text
      ? decryptFieldOrLegacy(app.primary_credit_goals_text)
      : app.primary_credit_goals_text,
    goals_notes: app.goals_notes ? decryptFieldOrLegacy(app.goals_notes) : app.goals_notes,
    typed_signature: decryptFieldOrLegacy(app.typed_signature),
    credit_profile: decryptCreditProfileForAdmin(app.credit_profile || {}),
    business_profile: app.business_profile
      ? deserializeBusinessProfileForAdmin(app.business_profile as Record<string, unknown>)
      : app.business_profile,
    date_of_birth_encrypted: undefined,
    ssn_encrypted: undefined,
    provider_username_encrypted: undefined,
    provider_password_encrypted: undefined,
    experian_email_encrypted: undefined,
    experian_password_encrypted: undefined,
    cfpb_email_encrypted: undefined,
    cfpb_password_encrypted: undefined,
  }
}

export function decryptApplicationOperationalFields(app: CreditFundingApplication) {
  return {
    ...app,
    phone: decryptFieldOrLegacy(app.phone),
    address: decryptFieldOrLegacy(app.address),
    city: decryptFieldOrLegacy(app.city),
    state: decryptFieldOrLegacy(app.state),
    zip_code: decryptFieldOrLegacy(app.zip_code),
    internal_notes: decryptFreeTextForView(app.internal_notes),
    client_notes: decryptFreeTextForView(app.client_notes),
    next_steps: decryptFreeTextForView(app.next_steps),
    invite_personal_message: decryptFreeTextForView(app.invite_personal_message),
    primary_credit_goals_text: app.primary_credit_goals_text
      ? decryptFieldOrLegacy(app.primary_credit_goals_text)
      : app.primary_credit_goals_text,
    goals_notes: app.goals_notes ? decryptFieldOrLegacy(app.goals_notes) : app.goals_notes,
    credit_profile: decryptCreditProfileForAdmin(app.credit_profile || {}),
    business_profile: app.business_profile
      ? deserializeBusinessProfileForAdmin(app.business_profile as Record<string, unknown>)
      : app.business_profile,
    date_of_birth_encrypted: undefined,
    ssn_encrypted: undefined,
    provider_username_encrypted: undefined,
    provider_password_encrypted: undefined,
    experian_email_encrypted: undefined,
    experian_password_encrypted: undefined,
    cfpb_email_encrypted: undefined,
    cfpb_password_encrypted: undefined,
  }
}

export function redactApplicationSecretsForDefaultAdmin(app: CreditFundingApplication) {
  const operational = decryptApplicationOperationalFields(app)
  return {
    ...operational,
    date_of_birth: app.date_of_birth_encrypted ? maskSecret(app.date_of_birth_encrypted) : '',
    ssn: app.ssn_encrypted ? REDACTED : '',
    provider_username: app.provider_username_encrypted ? REDACTED : '',
    provider_password: app.provider_password_encrypted ? REDACTED : '',
    experian_email: app.experian_email_encrypted ? REDACTED : '',
    experian_password: app.experian_password_encrypted ? REDACTED : '',
    cfpb_email: app.cfpb_email_encrypted ? REDACTED : '',
    cfpb_password: app.cfpb_password_encrypted ? REDACTED : '',
    typed_signature: app.typed_signature ? REDACTED : '',
    credit_profile: {
      ...(operational.credit_profile || {}),
      monthlyGrossIncome: operational.credit_profile?.monthlyGrossIncome ? REDACTED : '',
      annualIncome: operational.credit_profile?.annualIncome ? REDACTED : '',
    },
    business_profile: operational.business_profile
      ? {
          ...operational.business_profile,
          ein: operational.business_profile.ein ? REDACTED : '',
        }
      : operational.business_profile,
  }
}
