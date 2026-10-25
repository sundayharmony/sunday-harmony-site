import { formatSsnFull } from '@/lib/ssn-utils'
import {
  DOCUMENT_TYPES,
  STATUS_LABELS,
  documentDisplayLabel,
  establishedMonthLabel,
  isStaffSharedDocument,
  type ApplicationStatus,
  type BusinessProfile,
  type ConsentData,
  type CreditProfile,
  type DocumentType,
} from '@/lib/credit-funding-types'

/** Keep the packet small enough for a staff browser download. */
export const INTAKE_PDF_MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024

export type IntakePdfField = { label: string; value: string }

export type IntakePdfSection = {
  title: string
  note?: string
  fields: IntakePdfField[]
}

export type IntakePdfModel = {
  filename: string
  heading: string
  clientName: string
  meta: string
  preparedAt: string
  sections: IntakePdfSection[]
  plainText: string
}

export type IntakeAttachmentKind = 'pdf' | 'jpeg' | 'png' | 'text' | 'unsupported'

export type IntakeAttachmentSource = {
  id: string
  document_type: string
  file_name: string
  mime_type?: string | null
  storage_path?: string | null
  scan_status?: string | null
  shared_by?: string | null
  created_at?: string | null
}

export type PlannedIntakeAttachment = {
  id: string
  label: string
  fileName: string
  storagePath: string
  mimeType: string
  kind: Exclude<IntakeAttachmentKind, 'unsupported'>
}

export type SkippedIntakeAttachment = {
  label: string
  fileName: string
  reason: string
}

export type IntakePdfFile = PlannedIntakeAttachment & {
  bytes: Uint8Array
}

export type IntakePdfAttachmentSummary = {
  included: { label: string; fileName: string }[]
  skipped: SkippedIntakeAttachment[]
}

type IntakePdfSource = {
  application_id: string
  full_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  date_of_birth: string
  ssn: string
  status: string
  created_at: string
  selected_credit_provider: string
  provider_username: string
  experian_email: string
  cfpb_email: string
  credit_goals: string[]
  funding_goals: string
  primary_credit_goals_text: string
  funding_amount: string
  funding_use: string
  funding_timeframe: string
  owns_business: boolean | null
  business_name: string
  goals_notes: string
  credit_profile: CreditProfile
  business_profile: BusinessProfile | null
  consent_data: Partial<ConsentData>
  typed_signature: string
  signature_date: string
}

const READABLE_KEYS = [
  'application_id',
  'full_name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'zip_code',
  'date_of_birth',
  'ssn',
  'status',
  'created_at',
  'selected_credit_provider',
  'provider_username',
  'experian_email',
  'cfpb_email',
  'credit_goals',
  'funding_goals',
  'primary_credit_goals_text',
  'funding_amount',
  'funding_use',
  'funding_timeframe',
  'owns_business',
  'business_name',
  'goals_notes',
  'typed_signature',
  'signature_date',
] as const

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function yesNo(value: unknown): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return ''
}

function field(label: string, value: unknown): IntakePdfField | null {
  const text = textOf(value)
  if (!text) return null
  return { label, value: text }
}

function pushField(fields: IntakePdfField[], label: string, value: unknown) {
  const next = field(label, value)
  if (next) fields.push(next)
}

export function formatIntakePdfPreparedAt(date: Date): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
  return `${formatted} ET`
}

function formatStoredDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatIntakePdfPreparedAt(date)
}

export function intakePdfFilename(fullName: string, applicationId: string): string {
  const name =
    (fullName || 'Client')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'Client'
  const id =
    (applicationId || 'application').replace(/[^a-zA-Z0-9-]+/g, '').slice(0, 40) || 'application'
  return `Intake-${name}-${id}.pdf`
}

function statusLabel(status: string): string {
  if (status in STATUS_LABELS) return STATUS_LABELS[status as ApplicationStatus]
  return status.replace(/_/g, ' ')
}

function formatSsn(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 9) return formatSsnFull(digits)
  return value.trim()
}

function addressLine(source: IntakePdfSource): string {
  const street = source.address
  const region = [source.city, source.state].filter(Boolean).join(', ')
  const cityLine = [region, source.zip_code].filter(Boolean).join(' ')
  return [street, cityLine].filter(Boolean).join(', ')
}

function profileText(profile: CreditProfile | undefined, key: keyof CreditProfile): string {
  return textOf(profile?.[key])
}

/** Copy the intake answers that belong in a downloaded packet. */
export function intakePdfSourceFromApplication(app: object): IntakePdfSource {
  const record = app as Record<string, unknown>
  const profile =
    record.credit_profile && typeof record.credit_profile === 'object'
      ? (record.credit_profile as CreditProfile)
      : {}
  const businessRaw = record.business_profile
  const business =
    businessRaw && typeof businessRaw === 'object' ? (businessRaw as BusinessProfile) : null
  const consentRaw = record.consent_data
  const consent =
    consentRaw && typeof consentRaw === 'object' ? (consentRaw as Partial<ConsentData>) : {}

  const source = {
    application_id: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    date_of_birth: '',
    ssn: '',
    status: '',
    created_at: '',
    selected_credit_provider: '',
    provider_username: '',
    experian_email: '',
    cfpb_email: '',
    credit_goals: [] as string[],
    funding_goals: '',
    primary_credit_goals_text: '',
    funding_amount: '',
    funding_use: '',
    funding_timeframe: '',
    owns_business: null as boolean | null,
    business_name: '',
    goals_notes: '',
    credit_profile: {
      creditScore: textOf(profile.creditScore),
      openCreditCards: textOf(profile.openCreditCards),
      inquiries: textOf(profile.inquiries),
      monthlyGrossIncome: textOf(profile.monthlyGrossIncome),
      annualIncome: textOf(profile.annualIncome),
      bankruptcy: profile.bankruptcy,
      collections: profile.collections,
      chargeOffs: profile.chargeOffs,
      latePayments24Months: profile.latePayments24Months,
      employed: profile.employed,
      businessOwner: profile.businessOwner,
    },
    business_profile: business
      ? {
          legalName: textOf(business.legalName),
          dba: textOf(business.dba),
          ein: textOf(business.ein),
          entityType: textOf(business.entityType),
          industry: textOf(business.industry),
          monthEstablished: textOf(business.monthEstablished),
          yearEstablished: textOf(business.yearEstablished),
          numberOfEmployees: textOf(business.numberOfEmployees),
          annualRevenue: textOf(business.annualRevenue),
          address: textOf(business.address),
          city: textOf(business.city),
          state: textOf(business.state),
          zipCode: textOf(business.zipCode),
          phone: textOf(business.phone),
          email: textOf(business.email),
          website: textOf(business.website),
          businessDescription: textOf(business.businessDescription),
          fundingPurposes: Array.isArray(business.fundingPurposes)
            ? business.fundingPurposes.map((item) => textOf(item)).filter(Boolean)
            : [],
        }
      : null,
    consent_data: {
      accurateInfo: consent.accurateInfo,
      authorizeReview: consent.authorizeReview,
      agreeTerms: consent.agreeTerms,
    },
    typed_signature: '',
    signature_date: '',
  }

  for (const key of READABLE_KEYS) {
    if (key === 'credit_goals') {
      source.credit_goals = Array.isArray(record.credit_goals)
        ? record.credit_goals.map((item) => textOf(item)).filter(Boolean)
        : []
      continue
    }
    if (key === 'owns_business') {
      source.owns_business = typeof record.owns_business === 'boolean' ? record.owns_business : null
      continue
    }
    const value = record[key]
    if (typeof value === 'string') {
      ;(source as Record<string, unknown>)[key] = value.trim()
    }
  }

  return source
}

function businessAddress(profile: BusinessProfile): string {
  return [profile.address, profile.city, profile.state, profile.zipCode].map((part) => textOf(part)).filter(Boolean).join(', ')
}

function hasBusinessContent(source: IntakePdfSource): boolean {
  if (source.owns_business === true || source.business_name) return true
  const profile = source.business_profile
  if (!profile) return false
  return Object.values(profile).some((value) => {
    if (Array.isArray(value)) return value.length > 0
    return textOf(value).length > 0
  })
}

export function buildIntakePdfModel(
  app: object,
  attachments?: IntakePdfAttachmentSummary,
  preparedAt: Date = new Date()
): IntakePdfModel {
  const source = intakePdfSourceFromApplication(app)
  const prepared = formatIntakePdfPreparedAt(preparedAt)
  const sections: IntakePdfSection[] = []

  const personal: IntakePdfField[] = []
  pushField(personal, 'Full name', source.full_name)
  pushField(personal, 'Date of birth', source.date_of_birth)
  pushField(personal, 'Social Security number', source.ssn ? formatSsn(source.ssn) : '')
  pushField(personal, 'Email', source.email)
  pushField(personal, 'Phone', source.phone)
  pushField(personal, 'Address', addressLine(source))
  sections.push({ title: 'Personal information', fields: personal })

  const credit: IntakePdfField[] = []
  pushField(credit, 'Credit score', profileText(source.credit_profile, 'creditScore'))
  pushField(credit, 'Open credit cards', profileText(source.credit_profile, 'openCreditCards'))
  pushField(credit, 'Inquiries', profileText(source.credit_profile, 'inquiries'))
  pushField(credit, 'Monthly gross income', profileText(source.credit_profile, 'monthlyGrossIncome'))
  pushField(credit, 'Annual income', profileText(source.credit_profile, 'annualIncome'))
  pushField(credit, 'Bankruptcy', yesNo(source.credit_profile.bankruptcy))
  pushField(credit, 'Collections', yesNo(source.credit_profile.collections))
  pushField(credit, 'Charge-offs', yesNo(source.credit_profile.chargeOffs))
  pushField(credit, 'Late payments (24 mo)', yesNo(source.credit_profile.latePayments24Months))
  pushField(credit, 'Employed', yesNo(source.credit_profile.employed))
  pushField(credit, 'Business owner', yesNo(source.credit_profile.businessOwner))
  if (credit.length) sections.push({ title: 'Credit profile', fields: credit })

  const monitoring: IntakePdfField[] = []
  pushField(monitoring, 'Provider', source.selected_credit_provider)
  pushField(monitoring, 'Username', source.provider_username)
  pushField(monitoring, 'Experian.com email', source.experian_email)
  pushField(monitoring, 'CFPB portal email', source.cfpb_email)
  sections.push({
    title: 'Credit monitoring',
    note: 'Passwords, security answers, and the Experian PIN stay on the admin intake screen.',
    fields: monitoring,
  })

  const goals: IntakePdfField[] = []
  pushField(goals, 'Primary goals', source.primary_credit_goals_text)
  pushField(goals, 'Selected goals', source.credit_goals.join(', '))
  pushField(goals, 'Funding amount', source.funding_amount)
  pushField(goals, 'Funding use', source.funding_use)
  pushField(goals, 'Timeframe', source.funding_timeframe)
  pushField(goals, 'Owns business', yesNo(source.owns_business))
  pushField(goals, 'Business name', source.business_name)
  pushField(goals, 'Funding goals', source.funding_goals)
  pushField(goals, 'Additional notes', source.goals_notes)
  if (goals.length) sections.push({ title: 'Goals and funding', fields: goals })

  if (hasBusinessContent(source) && source.business_profile) {
    const profile = source.business_profile
    const business: IntakePdfField[] = []
    pushField(business, 'Legal name', profile.legalName)
    pushField(business, 'DBA', profile.dba)
    pushField(business, 'EIN', profile.ein)
    pushField(business, 'Entity type', profile.entityType)
    pushField(business, 'Industry', profile.industry)
    pushField(business, 'Month opened', establishedMonthLabel(profile.monthEstablished))
    pushField(business, 'Year established', profile.yearEstablished)
    pushField(business, 'Employees', profile.numberOfEmployees)
    pushField(business, 'Annual revenue', profile.annualRevenue)
    pushField(business, 'Business address', businessAddress(profile))
    pushField(business, 'Business phone', profile.phone)
    pushField(business, 'Business email', profile.email)
    pushField(business, 'Website', profile.website)
    pushField(business, 'Description', profile.businessDescription)
    pushField(business, 'Funding purposes', (profile.fundingPurposes || []).join(', '))
    if (business.length) sections.push({ title: 'Business information', fields: business })
  }

  const consent: IntakePdfField[] = []
  pushField(consent, 'Accurate information', yesNo(source.consent_data.accurateInfo))
  pushField(consent, 'Authorize review', yesNo(source.consent_data.authorizeReview))
  pushField(consent, 'Agree to terms', yesNo(source.consent_data.agreeTerms))
  pushField(consent, 'Typed signature', source.typed_signature)
  pushField(consent, 'Signature date', source.signature_date)
  if (consent.length) sections.push({ title: 'Consent and signature', fields: consent })

  if (attachments) {
    const files: IntakePdfField[] = []
    if (attachments.included.length === 0 && attachments.skipped.length === 0) {
      files.push({ label: 'Files', value: 'No client files are attached to this application.' })
    }
    for (const file of attachments.included) {
      files.push({ label: 'Included', value: `${file.label} (${file.fileName})` })
    }
    for (const file of attachments.skipped) {
      files.push({ label: 'Left in the portal', value: `${file.label} (${file.fileName}) — ${file.reason}` })
    }
    sections.push({ title: 'Uploaded files', fields: files })
  }

  const clientName = source.full_name || 'Client'
  const submitted = formatStoredDate(source.created_at)
  const meta = [source.application_id, statusLabel(source.status), submitted].filter(Boolean).join(' · ')
  const plainText = [
    'Sunday Harmony',
    'Client intake',
    clientName,
    meta,
    `Prepared ${prepared}`,
    ...sections.flatMap((section) => [
      section.title,
      section.note || '',
      ...section.fields.map((item) => `${item.label}: ${item.value}`),
    ]),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    filename: intakePdfFilename(clientName, source.application_id),
    heading: 'Client intake',
    clientName,
    meta,
    preparedAt: prepared,
    sections,
    plainText,
  }
}

function extensionOf(name: string): string {
  const base = name.split('?')[0] || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function intakeAttachmentKind(mimeType: string, fileName: string): IntakeAttachmentKind {
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase()
  const ext = extensionOf(fileName)
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime === 'image/jpeg' || mime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (mime === 'image/png' || ext === 'png') return 'png'
  if (mime === 'text/plain' || ext === 'txt') return 'text'
  return 'unsupported'
}

function documentOrder(documentType: string): number {
  const index = DOCUMENT_TYPES.indexOf(documentType as DocumentType)
  return index === -1 ? DOCUMENT_TYPES.length + 1 : index
}

export function planIntakeAttachments(docs: IntakeAttachmentSource[]): {
  include: PlannedIntakeAttachment[]
  skipped: SkippedIntakeAttachment[]
} {
  const include: PlannedIntakeAttachment[] = []
  const skipped: SkippedIntakeAttachment[] = []
  const ordered = [...docs].sort((a, b) => {
    const byType = documentOrder(a.document_type) - documentOrder(b.document_type)
    if (byType !== 0) return byType
    return (a.created_at || '').localeCompare(b.created_at || '')
  })

  for (const doc of ordered) {
    const label = documentDisplayLabel(doc.document_type)
    const fileName = (doc.file_name || 'file').trim() || 'file'
    if (
      isStaffSharedDocument({
        document_type: doc.document_type,
        shared_by: doc.shared_by,
        storage_path: doc.storage_path || undefined,
      })
    ) {
      skipped.push({
        label,
        fileName,
        reason: 'Specialist file. It stays in the application documents.',
      })
      continue
    }
    if (doc.scan_status === 'rejected') {
      skipped.push({
        label,
        fileName,
        reason: 'This file did not pass the safety check.',
      })
      continue
    }
    const kind = intakeAttachmentKind(doc.mime_type || '', fileName)
    if (kind === 'unsupported') {
      skipped.push({
        label,
        fileName,
        reason: 'This file type stays in the application documents.',
      })
      continue
    }
    const storagePath = (doc.storage_path || '').trim()
    if (!storagePath) {
      skipped.push({
        label,
        fileName,
        reason: 'This file could not be read.',
      })
      continue
    }
    include.push({
      id: doc.id,
      label,
      fileName,
      storagePath,
      mimeType: (doc.mime_type || '').split(';')[0].trim().toLowerCase(),
      kind,
    })
  }

  return { include, skipped }
}

export async function collectIntakePdfFiles(
  docs: IntakeAttachmentSource[],
  download: (storagePath: string) => Promise<Uint8Array | null>,
  maxBytes = INTAKE_PDF_MAX_ATTACHMENT_BYTES
): Promise<{ files: IntakePdfFile[]; skipped: SkippedIntakeAttachment[] }> {
  const plan = planIntakeAttachments(docs)
  const files: IntakePdfFile[] = []
  const skipped = [...plan.skipped]
  let used = 0

  for (const item of plan.include) {
    let bytes: Uint8Array | null = null
    try {
      bytes = await download(item.storagePath)
    } catch {
      bytes = null
    }
    if (!bytes || bytes.byteLength === 0) {
      skipped.push({
        label: item.label,
        fileName: item.fileName,
        reason: 'This file could not be read.',
      })
      continue
    }
    if (used + bytes.byteLength > maxBytes) {
      skipped.push({
        label: item.label,
        fileName: item.fileName,
        reason: 'This file stays in the application documents so the PDF can be downloaded.',
      })
      continue
    }
    used += bytes.byteLength
    files.push({ ...item, bytes })
  }

  return { files, skipped }
}
