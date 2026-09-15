/** Autofill-resistant trap. Do not use `website` / `companyWebsite` — browsers fill those. */
export const HONEYPOT_FIELD_NAME = 'sh_hp_field'

export const HONEYPOT_FIELD_NAMES = [HONEYPOT_FIELD_NAME, 'shHpField'] as const

export function hasHoneypotValue(input: FormData | Record<string, unknown>): boolean {
  return HONEYPOT_FIELD_NAMES.some((field) => {
    const value = input instanceof FormData ? input.get(field) : input[field]
    return typeof value === 'string' && value.trim().length > 0
  })
}
