import { validatePassword } from '@/lib/auth-password'

export const PARTNER_PROFESSIONS = ['mortgage', 'auto_sales', 'real_estate', 'other'] as const
export type PartnerProfession = (typeof PARTNER_PROFESSIONS)[number]

export const PARTNER_PROFESSION_LABELS: Record<PartnerProfession, string> = {
  mortgage: 'Mortgage',
  auto_sales: 'Auto sales',
  real_estate: 'Real estate',
  other: 'Other',
}

export function isPartnerProfession(value: string | null | undefined): value is PartnerProfession {
  return Boolean(value && (PARTNER_PROFESSIONS as readonly string[]).includes(value))
}

export function partnerProfessionLabel(profession: string | null | undefined): string {
  if (isPartnerProfession(profession)) return PARTNER_PROFESSION_LABELS[profession]
  const cleaned = (profession || '').trim()
  return cleaned ? cleaned.replace(/_/g, ' ') : '—'
}

export type PartnerSignupInput = {
  fullName: string
  email: string
  password: string
  phone: string
  companyName: string
  serviceArea: string
  yearsInField: number
  profession: PartnerProfession
}

export type PartnerProfileUpdateInput = Omit<PartnerSignupInput, 'email' | 'password'>

export type PartnerSignupUserPlan = 'create' | 'complete_orphan' | 'conflict'

/** Decide whether signup should create a user, finish a stranded partner login, or reject. */
export function planPartnerSignupUser(
  existing: { role: string } | null | undefined,
  hasProfile: boolean
): PartnerSignupUserPlan {
  if (!existing) return 'create'
  if (existing.role !== 'partner' || hasProfile) return 'conflict'
  return 'complete_orphan'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function parsePartnerSignup(body: Record<string, unknown>): { ok: true; value: PartnerSignupInput } | { ok: false; error: string } {
  const email = clean(body.email, 254).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'A valid email is required.' }
  const passwordError = validatePassword(password)
  if (passwordError) return { ok: false, error: passwordError }
  const fields = parsePartnerProfileFields(body)
  if (!fields.ok) return fields

  return {
    ok: true,
    value: {
      ...fields.value,
      email,
      password,
    },
  }
}

function parsePartnerProfileFields(
  body: Record<string, unknown>
): { ok: true; value: PartnerProfileUpdateInput } | { ok: false; error: string } {
  const fullName = clean(body.fullName, 120)
  const phone = clean(body.phone, 30)
  const companyName = clean(body.companyName, 160)
  const serviceArea = clean(body.serviceArea, 160)
  const profession = clean(body.profession, 40)
  const yearsRaw = typeof body.yearsInField === 'number' ? body.yearsInField : Number.parseInt(clean(body.yearsInField, 4), 10)

  if (fullName.length < 2) return { ok: false, error: 'Name is required.' }
  if (phone.length < 7) return { ok: false, error: 'Phone is required.' }
  if (companyName.length < 2) return { ok: false, error: 'Company is required.' }
  if (serviceArea.length < 2) return { ok: false, error: 'Service area is required.' }
  if (!PARTNER_PROFESSIONS.includes(profession as PartnerProfession)) {
    return { ok: false, error: 'Choose the field you work in.' }
  }
  if (!Number.isInteger(yearsRaw) || yearsRaw < 0 || yearsRaw > 80) {
    return { ok: false, error: 'Years in the field must be a number from 0 to 80.' }
  }

  return {
    ok: true,
    value: {
      fullName,
      phone,
      companyName,
      serviceArea,
      yearsInField: yearsRaw,
      profession: profession as PartnerProfession,
    },
  }
}

export function parsePartnerProfileUpdate(
  body: Record<string, unknown>
): { ok: true; value: PartnerProfileUpdateInput } | { ok: false; error: string } {
  return parsePartnerProfileFields(body)
}

export function parsePartnerPasswordChange(
  body: Record<string, unknown>
): { ok: true; value: { currentPassword: string; newPassword: string } } | { ok: false; error: string } {
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword) return { ok: false, error: 'Current password is required.' }
  const passwordError = validatePassword(newPassword)
  if (passwordError) return { ok: false, error: passwordError }
  if (currentPassword === newPassword) return { ok: false, error: 'Choose a different new password.' }
  return { ok: true, value: { currentPassword, newPassword } }
}
