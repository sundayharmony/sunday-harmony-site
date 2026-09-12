import type { Tradeline } from '@/lib/dispute-letters/types'

export function isInquiryTradeline(t: Pick<Tradeline, 'item_category' | 'status' | 'remarks' | 'account_type'>): boolean {
  if ((t.item_category || '') === 'inquiry') return true
  return /inquir/i.test(`${t.status || ''} ${t.remarks || ''} ${t.account_type || ''}`)
}

export function defaultInquiryDisputeReason(creditor: string): string {
  const name = creditor.trim() || 'this company'
  return (
    `I did not authorize this hard inquiry from ${name} and dispute it as an inquiry ` +
    'made without a permissible purpose under FCRA §604 (15 U.S.C. §1681b). ' +
    'If the inquiry cannot be verified as initiated by me, delete it from my file under ' +
    'FCRA §611 (15 U.S.C. §1681i).'
  )
}

export function resolvedDisputeReason(t: Tradeline): string {
  const existing = (t.dispute_reason || t.suggested_dispute_reason || '').trim()
  if (existing) return existing
  if (isInquiryTradeline(t)) return defaultInquiryDisputeReason(t.creditor || '')
  return (
    'I dispute this item as inaccurate and unverifiable and request deletion or correction ' +
    'of any information that cannot be verified under FCRA §611 (15 U.S.C. §1681i).'
  )
}

export function planSelectionsFromTradelines(tradelines: Tradeline[]) {
  return tradelines
    .filter((t) => t.selected)
    .map((t) => ({
      id: t.id,
      selected: true as const,
      dispute_reason: resolvedDisputeReason(t),
    }))
}
