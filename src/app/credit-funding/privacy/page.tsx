import { redirect } from 'next/navigation'
import { CREDIT_PRIVACY_PATH } from '@/lib/credit-intake-routes'

export default function CreditFundingPrivacyLegacyPage() {
  redirect(CREDIT_PRIVACY_PATH)
}
