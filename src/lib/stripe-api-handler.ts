import { NextResponse } from 'next/server'
import { mapStripeError } from '@/lib/stripe-errors'

export function isServiceError(result: unknown): result is { error: string; status: number } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    'status' in result &&
    typeof (result as { error: unknown }).error === 'string' &&
    typeof (result as { status: unknown }).status === 'number'
  )
}

export async function withStripeHandler<T>(
  fn: () => Promise<T | { error: string; status: number }>
): Promise<T | NextResponse> {
  try {
    const result = await fn()
    if (isServiceError(result)) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return result as T
  } catch (err) {
    const mapped = mapStripeError(err)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
