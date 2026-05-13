export function getSiteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
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
