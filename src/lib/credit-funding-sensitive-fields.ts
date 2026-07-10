import { decryptField, decryptFieldOrLegacy, encryptField, encryptFieldIfPresent } from '@/lib/field-encryption'
import type { BusinessProfile, CreditFundingApplication, CreditProfile } from '@/lib/credit-funding-types'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'

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
