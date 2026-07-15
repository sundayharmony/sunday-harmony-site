export const HONEYPOT_FIELD_NAMES = ['companyWebsite', 'website'] as const

export function hasHoneypotValue(input: FormData | Record<string, unknown>): boolean {
  return HONEYPOT_FIELD_NAMES.some((field) => {
    const value = input instanceof FormData ? input.get(field) : input[field]
    return typeof value === 'string' && value.trim().length > 0
  })
}
