export type BillingMetricsClient = {
  status: string
  is_potential?: boolean
  monthly_price: number
  billing_status?: string
  stripe_subscription_id?: string
}

export type BillingMetrics = {
  contractedMrr: number
  stripeMrr: number
  activePayingCount: number
  atRiskCount: number
  potentialCount: number
}

/** Contracted MRR from plan on file (active, billing enabled, not potential). */
export function computeContractedMrr(clients: BillingMetricsClient[]): number {
  return clients
    .filter(c => c.status === 'active' && !c.is_potential)
    .reduce((sum, c) => sum + (c.monthly_price || 0), 0)
}

/** Stripe MRR proxy: same clients with paid/trial billing and a subscription id. */
export function computeStripeMrr(clients: BillingMetricsClient[]): number {
  return clients
    .filter(
      c =>
        c.status === 'active' &&
        !c.is_potential &&
        c.stripe_subscription_id?.trim() &&
        (c.billing_status === 'paid' || c.billing_status === 'trial')
    )
    .reduce((sum, c) => sum + (c.monthly_price || 0), 0)
}

export function computeBillingMetrics(clients: BillingMetricsClient[]): BillingMetrics {
  const active = clients.filter(c => c.status === 'active')
  return {
    contractedMrr: computeContractedMrr(clients),
    stripeMrr: computeStripeMrr(clients),
    activePayingCount: active.filter(
      c => !c.is_potential && c.billing_status === 'paid' && c.stripe_subscription_id?.trim()
    ).length,
    atRiskCount: clients.filter(c => c.billing_status === 'past_due' || c.billing_status === 'unpaid').length,
    potentialCount: clients.filter(c => c.is_potential).length,
  }
}
