import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import type { BillingAuth } from '@/lib/billing-access'

type BillingRateLimitOptions = {
  operation: string
  limit: number
  windowMs: number
}

export async function enforceBillingRateLimit(
  auth: BillingAuth,
  options: BillingRateLimitOptions
): Promise<Response | null> {
  const actor = auth.actorEmail.toLowerCase()
  const key = `billing:${options.operation}:${auth.clientId}:${actor}`
  const result = await rateLimitDurable(key, options.limit, options.windowMs)
  return result.allowed ? null : rateLimitResponse(result.resetIn)
}
