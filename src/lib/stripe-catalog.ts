import type { Client } from '@/lib/db'

export function getSiteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
}

export type PackageTier = Client['package_tier']

export const TIER_LABELS: Record<PackageTier, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

/** Default list prices (USD/mo) when not yet synced from Stripe. */
export const TIER_LIST_PRICES: Record<PackageTier, number> = {
  social_essentials: 250,
  spark: 500,
  growth: 1800,
  scale: 3500,
}

const TIER_ENV_KEYS: Record<PackageTier, string> = {
  social_essentials: 'STRIPE_PRICE_SOCIAL_ESSENTIALS',
  spark: 'STRIPE_PRICE_SPARK',
  growth: 'STRIPE_PRICE_GROWTH',
  scale: 'STRIPE_PRICE_SCALE',
}

export function getStripePriceIdForTier(tier: string): string | undefined {
  const map: Record<string, string | undefined> = {
    social_essentials: process.env.STRIPE_PRICE_SOCIAL_ESSENTIALS,
    spark: process.env.STRIPE_PRICE_SPARK,
    growth: process.env.STRIPE_PRICE_GROWTH,
    scale: process.env.STRIPE_PRICE_SCALE,
  }
  const id = map[tier]
  return id?.trim() || undefined
}

export function getTierFromPriceId(priceId: string): PackageTier | undefined {
  const trimmed = priceId.trim()
  for (const tier of Object.keys(TIER_ENV_KEYS) as PackageTier[]) {
    if (getStripePriceIdForTier(tier) === trimmed) return tier
  }
  return undefined
}

export function monthlyPriceFromStripeUnitAmount(unitAmountCents: number | null | undefined): number | undefined {
  if (unitAmountCents == null || Number.isNaN(unitAmountCents)) return undefined
  return unitAmountCents / 100
}

export function getPublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  }
  return key
}
