import { isCreditFundingStaffRole } from '@/lib/stripe-admin-auth'

/** Body flag staff can send to generate letters without every identity enclosure. */
export const LETTER_IDENTITY_BYPASS_FLAG = 'bypass_missing_identity'

export function wantsLetterIdentityBypass(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const value = (body as Record<string, unknown>)[LETTER_IDENTITY_BYPASS_FLAG]
  return value === true || value === 'true' || value === 1
}

export function canBypassLetterIdentityRequirements(role?: string | null): boolean {
  return isCreditFundingStaffRole(role)
}

export function letterIdentityBypassAllowed(body: unknown, role?: string | null): boolean {
  return wantsLetterIdentityBypass(body) && canBypassLetterIdentityRequirements(role)
}
