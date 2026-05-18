import type { Client } from '@/lib/db'

export function getSiteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
}

export type PackageTier = Client['package_tier']

export const PACKAGE_TIERS: PackageTier[] = [
  'free',
  'social_essentials',
  'spark',
  'growth',
  'scale',
]

/** Paid tiers that map to Stripe prices (excludes free). */
export const STRIPE_BILLABLE_TIERS = PACKAGE_TIERS.filter(
  (t): t is Exclude<PackageTier, 'free'> => t !== 'free'
)

export const TIER_LABELS: Record<PackageTier, string> = {
  free: 'Free (Testing)',
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

/** Default list prices (USD/mo) when not yet synced from Stripe. Free is always $0. */
export const TIER_LIST_PRICES: Record<PackageTier, number> = {
  free: 0,
  social_essentials: 250,
  spark: 500,
  growth: 1800,
  scale: 3500,
}

const TIER_ENV_KEYS: Record<Exclude<PackageTier, 'free'>, string> = {
  social_essentials: 'STRIPE_PRICE_SOCIAL_ESSENTIALS',
  spark: 'STRIPE_PRICE_SPARK',
  growth: 'STRIPE_PRICE_GROWTH',
  scale: 'STRIPE_PRICE_SCALE',
}

export function isFreeTier(tier: string): boolean {
  return tier === 'free'
}

export function isStripeBillableTier(tier: string): tier is Exclude<PackageTier, 'free'> {
  return STRIPE_BILLABLE_TIERS.includes(tier as Exclude<PackageTier, 'free'>)
}

export function formatTierListPrice(tier: PackageTier): string {
  if (isFreeTier(tier)) return 'Free'
  return `$${TIER_LIST_PRICES[tier].toLocaleString()}`
}

export function getStripePriceIdForTier(tier: string): string | undefined {
  if (isFreeTier(tier)) return undefined
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
  for (const tier of STRIPE_BILLABLE_TIERS) {
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
