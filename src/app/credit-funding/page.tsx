import { redirect } from 'next/navigation'
import { CREDIT_INTAKE_PATH } from '@/lib/credit-intake-routes'

export default async function CreditFundingLegacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const part of value) next.append(key, part)
    } else {
      next.set(key, value)
    }
  }
  const qs = next.toString()
  redirect(qs ? `${CREDIT_INTAKE_PATH}?${qs}` : CREDIT_INTAKE_PATH)
}
