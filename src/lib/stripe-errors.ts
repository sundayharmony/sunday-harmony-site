import type Stripe from 'stripe'

type StripeErrorLike = { type?: string; message?: string; code?: string }

export function mapStripeError(err: unknown): { error: string; status: number } {
  if (err && typeof err === 'object' && 'type' in err) {
    const stripeErr = err as StripeErrorLike
    const message = stripeErr.message || 'Payment provider error'
    switch (stripeErr.type) {
      case 'StripeCardError':
        return { error: message, status: 402 }
      case 'StripeInvalidRequestError':
        return { error: message, status: 400 }
      case 'StripeAuthenticationError':
      case 'StripePermissionError':
        return { error: 'Billing service configuration error', status: 500 }
      case 'StripeRateLimitError':
        return { error: 'Too many requests. Please try again shortly.', status: 429 }
      default:
        return { error: message, status: 500 }
    }
  }
  if (err instanceof Error) {
    return { error: err.message, status: 500 }
  }
  return { error: 'Something went wrong', status: 500 }
}

export function isStripeMissingResource(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    return code === 'resource_missing'
  }
  return false
}
