/**
 * Per-email abuse guards for public lead forms. Used alongside the per-IP limits
 * so a proxy pool cannot hammer one address (setup codes, booking emails).
 */
import { rateLimitDurable } from '@/lib/rate-limit-durable'

/**
 * Stable key for one inbox: lowercased, trimmed, `+tag` dropped from the local part
 * so `a+1@x.com` and `a+2@x.com` share one counter.
 */
export function emailLimitKey(email: string): string {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at <= 0) return normalized
  const local = normalized.slice(0, at).split('+')[0] || normalized.slice(0, at)
  return `${local}@${normalized.slice(at + 1)}`
}

/** Credit account starts plus anonymous intakes per address per day. */
export const CREDIT_EMAIL_LIMIT = 3
export const CREDIT_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000

/** Consultation booking attempts per address per day (backs up the one-open-booking check). */
export const CONSULTATION_EMAIL_LIMIT = 3
export const CONSULTATION_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000

export function creditEmailRateLimit(email: string) {
  return rateLimitDurable(`credit-email:${emailLimitKey(email)}`, CREDIT_EMAIL_LIMIT, CREDIT_EMAIL_WINDOW_MS)
}

export function consultationEmailRateLimit(email: string) {
  return rateLimitDurable(
    `consultation-email:${emailLimitKey(email)}`,
    CONSULTATION_EMAIL_LIMIT,
    CONSULTATION_EMAIL_WINDOW_MS
  )
}

/**
 * One response for every "this email can't start a new file" case on
 * /api/credit-funding/start, so the endpoint does not reveal whether an
 * account or application exists.
 */
export const CREDIT_START_CONFLICT = {
  status: 409,
  body: {
    error: 'We could not start a new file with this email. If you already have an account, sign in to continue.',
  },
} as const
