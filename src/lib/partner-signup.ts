import { validatePassword } from '@/lib/auth-password'

export const PARTNER_PROFESSIONS = ['mortgage', 'auto_sales', 'real_estate', 'other'] as const
export type PartnerProfession = (typeof PARTNER_PROFESSIONS)[number]

export const PARTNER_PROFESSION_LABELS: Record<PartnerProfession, string> = {
  mortgage: 'Mortgage',
  auto_sales: 'Auto sales',
  real_estate: 'Real estate',
  other: 'Other',
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function parsePartnerSignup(body: Record<string, unknown>): { ok: true; value: PartnerSignupInput } | { ok: false; error: string } {
  const fullName = clean(body.fullName, 120)
  const email = clean(body.email, 254).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const phone = clean(body.phone, 30)
  const companyName = clean(body.companyName, 160)
  const serviceArea = clean(body.serviceArea, 160)
  const profession = clean(body.profession, 40)
  const yearsRaw = typeof body.yearsInField === 'number' ? body.yearsInField : Number.parseInt(clean(body.yearsInField, 4), 10)

  if (fullName.length < 2) return { ok: false, error: 'Name is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'A valid email is required.' }
  const passwordError = validatePassword(password)
  if (passwordError) return { ok: false, error: passwordError }
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
      email,
      password,
      phone,
      companyName,
      serviceArea,
      yearsInField: yearsRaw,
      profession: profession as PartnerProfession,
    },
  }
}
