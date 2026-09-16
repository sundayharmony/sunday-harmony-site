import { isCreditRepairBillingClient } from '@/lib/credit-repair-billing'
import {
  formatTierListPrice,
  PACKAGE_TIERS,
  TIER_LABELS,
  type PackageTier,
} from '@/lib/stripe-catalog'

export const CREDIT_REPAIR_PACKAGE = 'credit_repair' as const
export type BillingPackageKey = PackageTier | typeof CREDIT_REPAIR_PACKAGE

export const BILLING_PACKAGE_KEYS: BillingPackageKey[] = [CREDIT_REPAIR_PACKAGE, ...PACKAGE_TIERS]

export function isCreditRepairPackage(key: string): key is typeof CREDIT_REPAIR_PACKAGE {
  return key === CREDIT_REPAIR_PACKAGE
}

export function isMarketingPackage(key: string): key is PackageTier {
  return PACKAGE_TIERS.includes(key as PackageTier)
}

export function billingPackageLabel(key: string): string {
  if (isCreditRepairPackage(key)) return 'Credit Repair'
  if (isMarketingPackage(key)) return TIER_LABELS[key]
  return key.replace(/_/g, ' ')
}

export function billingPackagePriceLabel(key: BillingPackageKey): string {
  if (isCreditRepairPackage(key)) return 'one-time'
  return formatTierListPrice(key)
}

export function currentBillingPackage(client: {
  billing_model?: string | null
  lead_type?: string | null
  package_tier?: string | null
}): BillingPackageKey {
  if (isCreditRepairBillingClient(client)) return CREDIT_REPAIR_PACKAGE
  if (isMarketingPackage(client.package_tier || '')) return client.package_tier as PackageTier
  return 'spark'
}
