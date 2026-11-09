import { isCreditFundingStaffRole } from '@/lib/staff-roles'

/** Body flag staff can send to generate letters without every identity enclosure. */
export const LETTER_IDENTITY_BYPASS_FLAG = 'bypass_missing_identity'

export function wantsLetterIdentityBypass(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const value = (body as Record<string, unknown>)[LETTER_IDENTITY_BYPASS_FLAG]
  return value === true || value === 'true' || value === 1
}

/**
 * Keep this module free of server-only imports — Confirm is a client component.
 * Role check lives in staff-roles (no stripe-admin-auth / nodemailer).
 */
export function canBypassLetterIdentityRequirements(role?: string | null): boolean {
  return isCreditFundingStaffRole(role)
}

export function letterIdentityBypassAllowed(body: unknown, role?: string | null): boolean {
  return wantsLetterIdentityBypass(body) && canBypassLetterIdentityRequirements(role)
}
