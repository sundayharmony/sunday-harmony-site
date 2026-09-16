import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import { getCreditFundingSigningSecret, signCreditFundingPayload, verifyCreditFundingSignature } from '@/lib/credit-funding-signing'
import {
  REFERRAL_COOKIE_NAME,
  referralAttributionTtlMs,
  type AttributionPayload,
} from '@/lib/referrals'

function encodePayload(data: AttributionPayload): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
}

function decodePayload(raw: string): AttributionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as AttributionPayload
    if (!parsed?.code || !parsed?.profileId || typeof parsed.issuedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function signReferralAttribution(payload: AttributionPayload): string {
  const secret = getCreditFundingSigningSecret('referral-attribution')
  const body = encodePayload(payload)
  const sig = signCreditFundingPayload(secret, body)
  return `${body}.${sig}`
}

export function verifyReferralAttribution(token: string | undefined | null): AttributionPayload | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const secret = getCreditFundingSigningSecret('referral-attribution')
  if (!verifyCreditFundingSignature(secret, body, sig)) return null
  const payload = decodePayload(body)
  if (!payload) return null
  if (Date.now() - payload.issuedAt > referralAttributionTtlMs()) return null
  return payload
}

export function referralCookieOptions() {
  const maxAge = Math.floor(referralAttributionTtlMs() / 1000)
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export function setReferralAttributionCookie(res: NextResponse, payload: AttributionPayload): void {
  res.cookies.set(REFERRAL_COOKIE_NAME, signReferralAttribution(payload), referralCookieOptions())
}

export function readReferralAttributionFromRequest(req: NextRequest): AttributionPayload | null {
  return verifyReferralAttribution(req.cookies.get(REFERRAL_COOKIE_NAME)?.value)
}

export async function readReferralAttributionFromCookies(): Promise<AttributionPayload | null> {
  const store = await cookies()
  return verifyReferralAttribution(store.get(REFERRAL_COOKIE_NAME)?.value)
}
