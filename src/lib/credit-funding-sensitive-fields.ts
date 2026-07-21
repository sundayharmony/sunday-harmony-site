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

/** Drop blank ciphertexts so PostgREST does not reject inserts when optional columns are missing. */
function optionalEncryptedColumns(columns: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(columns).filter(([, value]) => Boolean(value)))
}

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
    // Omit blank CFPB columns so inserts work if migration 023 is not applied yet.
    ...optionalEncryptedColumns({
      cfpb_email_encrypted: encryptField(payload.cfpbEmail),
      cfpb_password_encrypted: encryptField(payload.cfpbPassword),
    }),
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

/** Partial encrypt for staff drafts — empty required columns use empty encrypted strings / placeholders. */
export function buildPartialEncryptedApplicationRow(
  payload: IntakeFormPayload,
  options?: { preserveSecretsFrom?: CreditFundingApplication | null }
): Record<string, unknown> {
  const existing = options?.preserveSecretsFrom
  const keepSecret = (submitted: string, existingCipher?: string | null) => {
    if (submitted.trim()) return encryptField(submitted)
    if (existingCipher) return existingCipher
    return ''
  }

  const phone = payload.phone.trim()
    ? encryptField(payload.phone)
    : existing?.phone || encryptField('')
  const address = payload.address.trim()
    ? encryptField(payload.address)
    : existing?.address || encryptField('')
  const city = payload.city.trim()
    ? encryptField(payload.city)
    : existing?.city || encryptField('')
  const state = payload.state.trim()
    ? encryptField(payload.state)
    : existing?.state || encryptField('')
  const zip = payload.zipCode.trim()
    ? encryptField(payload.zipCode)
    : existing?.zip_code || encryptField('')

  return {
    full_name: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    date_of_birth_encrypted: keepSecret(payload.dateOfBirth, existing?.date_of_birth_encrypted),
    ssn_encrypted: keepSecret(payload.ssn, existing?.ssn_encrypted),
    phone,
    address,
    city,
    state,
    zip_code: zip,
    credit_profile: encryptCreditProfileForDb(payload.creditProfile || {}),
    selected_credit_provider: payload.selectedCreditProvider || existing?.selected_credit_provider || 'Pending',
    provider_username_encrypted: keepSecret(payload.providerUsername, existing?.provider_username_encrypted),
    provider_password_encrypted: keepSecret(payload.providerPassword, existing?.provider_password_encrypted),
    experian_email_encrypted: keepSecret(payload.experianEmail, existing?.experian_email_encrypted),
    experian_password_encrypted: keepSecret(payload.experianPassword, existing?.experian_password_encrypted),
    // Omit blank CFPB columns so drafts work if migration 023 is not applied yet.
    ...optionalEncryptedColumns({
      cfpb_email_encrypted: keepSecret(payload.cfpbEmail, existing?.cfpb_email_encrypted),
      cfpb_password_encrypted: keepSecret(payload.cfpbPassword, existing?.cfpb_password_encrypted),
    }),
    credit_goals: payload.creditGoals || [],
    primary_credit_goals_text: payload.primaryCreditGoalsText.trim()
      ? encryptFieldIfPresent(payload.primaryCreditGoalsText)
      : existing?.primary_credit_goals_text || '',
    funding_amount: payload.fundingAmount || existing?.funding_amount || null,
    funding_use: payload.fundingUse || existing?.funding_use || null,
    owns_business: payload.ownsBusiness,
    business_name: payload.businessProfile.legalName || payload.businessName || existing?.business_name || null,
    funding_timeframe: payload.fundingTimeframe || existing?.funding_timeframe || null,
    goals_notes: payload.goalsNotes.trim()
      ? encryptFieldIfPresent(payload.goalsNotes)
      : existing?.goals_notes || null,
    consent_data: payload.consent || existing?.consent_data || {},
    typed_signature: payload.typedSignature.trim()
      ? encryptField(payload.typedSignature)
      : existing?.typed_signature || encryptField(''),
    signature_date: payload.signatureDate || existing?.signature_date || new Date().toISOString().slice(0, 10),
    business_profile: Object.keys(payload.businessProfile || {}).length
      ? serializeBusinessProfileForDb(payload.businessProfile)
      : existing?.business_profile || {},
  }
}

export type InviteSecretSetFlags = {
  ssnSet: boolean
  dateOfBirthSet: boolean
  providerUsernameSet: boolean
  providerPasswordSet: boolean
  experianEmailSet: boolean
  experianPasswordSet: boolean
  cfpbEmailSet: boolean
  cfpbPasswordSet: boolean
  typedSignatureSet: boolean
}

/** Merge client-submitted secrets with values already stored on a draft/invitation row. */
export function mergeIntakePayloadWithExistingSecrets(
  payload: IntakeFormPayload,
  existing: CreditFundingApplication,
  keepFlags?: Partial<InviteSecretSetFlags>
): IntakeFormPayload {
  const decrypted = decryptApplicationSensitiveFields(existing)
  const keep = (submitted: string, existingValue: string | undefined, flag?: boolean) => {
    if (submitted.trim()) return submitted
    if (flag === false) return ''
    return existingValue || ''
  }

  return {
    ...payload,
    dateOfBirth: keep(payload.dateOfBirth, decrypted.date_of_birth, keepFlags?.dateOfBirthSet),
    ssn: keep(payload.ssn, decrypted.ssn, keepFlags?.ssnSet),
    phone: payload.phone.trim() || decrypted.phone || '',
    address: payload.address.trim() || decrypted.address || '',
    city: payload.city.trim() || decrypted.city || '',
    state: payload.state.trim() || decrypted.state || '',
    zipCode: payload.zipCode.trim() || decrypted.zip_code || '',
    selectedCreditProvider:
      payload.selectedCreditProvider && payload.selectedCreditProvider !== 'Pending'
        ? payload.selectedCreditProvider
        : existing.selected_credit_provider !== 'Pending'
          ? existing.selected_credit_provider
          : payload.selectedCreditProvider,
    providerUsername: keep(payload.providerUsername, decrypted.provider_username, keepFlags?.providerUsernameSet),
    providerPassword: keep(payload.providerPassword, decrypted.provider_password, keepFlags?.providerPasswordSet),
    experianEmail: keep(payload.experianEmail, decrypted.experian_email, keepFlags?.experianEmailSet),
    experianPassword: keep(payload.experianPassword, decrypted.experian_password, keepFlags?.experianPasswordSet),
    cfpbEmail: keep(payload.cfpbEmail, decrypted.cfpb_email, keepFlags?.cfpbEmailSet),
    cfpbPassword: keep(payload.cfpbPassword, decrypted.cfpb_password, keepFlags?.cfpbPasswordSet),
    typedSignature: keep(payload.typedSignature, decrypted.typed_signature, keepFlags?.typedSignatureSet),
    signatureDate: payload.signatureDate.trim() || existing.signature_date || '',
    primaryCreditGoalsText:
      payload.primaryCreditGoalsText.trim() || decrypted.primary_credit_goals_text || '',
    goalsNotes: payload.goalsNotes.trim() || decrypted.goals_notes || '',
    fundingAmount: payload.fundingAmount || existing.funding_amount || '',
    fundingUse: payload.fundingUse || existing.funding_use || '',
    fundingTimeframe: payload.fundingTimeframe || existing.funding_timeframe || '',
    businessName: payload.businessName || existing.business_name || '',
    creditGoals: payload.creditGoals.length ? payload.creditGoals : existing.credit_goals || [],
    creditProfile: Object.keys(payload.creditProfile || {}).length
      ? payload.creditProfile
      : decrypted.credit_profile || {},
    businessProfile: (() => {
      const submitted = payload.businessProfile || {}
      const existingBp = (decrypted.business_profile as BusinessProfile) || {}
      if (!Object.keys(submitted).length) return existingBp
      return {
        ...existingBp,
        ...submitted,
        ein: submitted.ein?.trim() ? submitted.ein : existingBp.ein,
      }
    })(),
  }
}

export function buildInvitePrefillFromApplication(app: CreditFundingApplication) {
  const decrypted = decryptApplicationSensitiveFields(app)
  const isPlaceholder = (value: string | undefined | null) =>
    !value || value === 'Pending' || value === 'XX' || value === '00000'

  const secretSetFlags: InviteSecretSetFlags = {
    ssnSet: Boolean(app.ssn_encrypted && decryptField(app.ssn_encrypted || '')),
    dateOfBirthSet: Boolean(app.date_of_birth_encrypted && decryptField(app.date_of_birth_encrypted || '')),
    providerUsernameSet: Boolean(app.provider_username_encrypted && decryptField(app.provider_username_encrypted || '')),
    providerPasswordSet: Boolean(app.provider_password_encrypted && decryptField(app.provider_password_encrypted || '')),
    experianEmailSet: Boolean(app.experian_email_encrypted && decryptField(app.experian_email_encrypted || '')),
    experianPasswordSet: Boolean(app.experian_password_encrypted && decryptField(app.experian_password_encrypted || '')),
    cfpbEmailSet: Boolean(app.cfpb_email_encrypted && decryptField(app.cfpb_email_encrypted || '')),
    cfpbPasswordSet: Boolean(app.cfpb_password_encrypted && decryptField(app.cfpb_password_encrypted || '')),
    typedSignatureSet: Boolean(
      app.typed_signature && decryptFieldOrLegacy(app.typed_signature) && decryptFieldOrLegacy(app.typed_signature) !== 'Pending'
    ),
  }

  const creditProfile = { ...(decrypted.credit_profile || {}) }
  delete creditProfile.monthlyGrossIncome
  delete creditProfile.annualIncome

  const businessProfile = { ...((decrypted.business_profile as BusinessProfile) || {}) }
  const einSet = Boolean(businessProfile.ein)
  delete businessProfile.ein

  return {
    fullName: app.full_name,
    // Invitee already received mail at this address; needed to lock the matching email on submit.
    email: app.email,
    phone: isPlaceholder(decrypted.phone) ? '' : decrypted.phone,
    address: isPlaceholder(decrypted.address) ? '' : decrypted.address,
    city: isPlaceholder(decrypted.city) ? '' : decrypted.city,
    state: isPlaceholder(decrypted.state) ? '' : decrypted.state,
    zipCode: isPlaceholder(decrypted.zip_code) ? '' : decrypted.zip_code,
    selectedCreditProvider:
      app.selected_credit_provider && app.selected_credit_provider !== 'Pending'
        ? app.selected_credit_provider
        : '',
    primaryCreditGoalsText: decrypted.primary_credit_goals_text || '',
    creditGoals: app.credit_goals || [],
    fundingAmount: app.funding_amount || '',
    fundingUse: app.funding_use || '',
    ownsBusiness: Boolean(app.owns_business),
    businessName: app.business_name || '',
    fundingTimeframe: app.funding_timeframe || '',
    goalsNotes: decrypted.goals_notes || '',
    creditProfile,
    businessProfile,
    einSet,
    consent: app.consent_data || { accurateInfo: false, authorizeReview: false, agreeTerms: false },
    signatureDate: app.signature_date || new Date().toISOString().slice(0, 10),
    ...secretSetFlags,
    // High-sensitivity fields: presence flags only — never plaintext over the public invite API
    dateOfBirth: '',
    ssn: '',
    providerUsername: '',
    providerPassword: '',
    experianEmail: '',
    experianPassword: '',
    cfpbEmail: '',
    cfpbPassword: '',
    typedSignature: '',
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

/** Draft editor payload: operational fields readable; secrets are redacted with presence flags. */
export function formatDraftForStaffEditor(app: CreditFundingApplication) {
  const redacted = redactApplicationSecretsForDefaultAdmin(app)
  return {
    ...redacted,
    ssnSet: Boolean(app.ssn_encrypted && decryptField(app.ssn_encrypted || '')),
    dateOfBirthSet: Boolean(app.date_of_birth_encrypted && decryptField(app.date_of_birth_encrypted || '')),
    providerUsernameSet: Boolean(app.provider_username_encrypted && decryptField(app.provider_username_encrypted || '')),
    providerPasswordSet: Boolean(app.provider_password_encrypted && decryptField(app.provider_password_encrypted || '')),
    experianEmailSet: Boolean(app.experian_email_encrypted && decryptField(app.experian_email_encrypted || '')),
    experianPasswordSet: Boolean(app.experian_password_encrypted && decryptField(app.experian_password_encrypted || '')),
    cfpbEmailSet: Boolean(app.cfpb_email_encrypted && decryptField(app.cfpb_email_encrypted || '')),
    cfpbPasswordSet: Boolean(app.cfpb_password_encrypted && decryptField(app.cfpb_password_encrypted || '')),
    typedSignatureSet: Boolean(
      app.typed_signature &&
        decryptFieldOrLegacy(app.typed_signature) &&
        decryptFieldOrLegacy(app.typed_signature) !== 'Pending'
    ),
    // Clear redacted placeholder strings so the editor does not treat masks as editable values
    date_of_birth: '',
    ssn: '',
    provider_username: '',
    provider_password: '',
    experian_email: '',
    experian_password: '',
    cfpb_email: '',
    cfpb_password: '',
    typed_signature: '',
  }
}
