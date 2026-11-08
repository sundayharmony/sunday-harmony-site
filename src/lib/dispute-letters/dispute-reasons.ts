import {
  FLAG_CONSISTENT,
  FLAG_INCONSISTENT,
  classifyMismatchKind,
  consistentInaccuracyDisputeReason,
  inconsistentDisputeReason,
} from '@/lib/dispute-letters/cross-bureau'
import { isCleanProfileRemovalTarget, isClosedTradeline } from '@/lib/dispute-letters/dispute-selection'
import type { Tradeline } from '@/lib/dispute-letters/types'

const STALE_CLEAN_PROFILE_RE =
  /clean credit profile|no longer useful to a clean|does not belong on a clean|not useful to a clean credit profile/i

export function isInquiryTradeline(t: Pick<Tradeline, 'item_category' | 'status' | 'remarks' | 'account_type'>): boolean {
  if ((t.item_category || '') === 'inquiry') return true
  return /inquir/i.test(`${t.status || ''} ${t.remarks || ''} ${t.account_type || ''}`)
}

export function usesStaleCleanProfileLanguage(text: string): boolean {
  return STALE_CLEAN_PROFILE_RE.test(text || '')
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

export function defaultRemovalDisputeReason(t: Tradeline): string {
  const status = (t.status || 'this account').trim()
  const category = (t.item_category || '').toLowerCase()
  if (t.is_collection || category === 'collection') {
    return (
      `This collection tradeline is reported as ${status}. I dispute the accuracy and ` +
      'completeness of this collection reporting and request that it be deleted if the ' +
      'furnisher cannot verify every reported field as accurate and complete under ' +
      'FCRA §611 (15 U.S.C. §1681i) and §623 (15 U.S.C. §1681s-2).'
    )
  }
  if (isClosedTradeline(t)) {
    const lateBits: string[] = []
    if (/late|delinquent|past\s+due|times\s+late/i.test(`${t.status} ${t.payment_history || ''}`)) {
      lateBits.push('reported late-payment / delinquency history')
    }
    const pastDue = (t.past_due || '').trim()
    if (pastDue && !/^\$?0+(?:\.0+)?$/i.test(pastDue.replace(/,/g, ''))) {
      lateBits.push(`past-due amount of ${pastDue}`)
    }
    const focus = lateBits.length ? `, including ${lateBits.join(' and ')}` : ''
    return (
      `This account is reported as ${status}. I dispute the accuracy and completeness of ` +
      `the remaining negative information on this closed account${focus}. Under FCRA §611 ` +
      '(15 U.S.C. §1681i) and §623 (15 U.S.C. §1681s-2), please verify every reported field ' +
      'with the furnisher. If the status, balance, past-due amount, payment history, or any ' +
      'other field cannot be verified as accurate and complete, delete the tradeline in full.'
    )
  }
  return (
    'I dispute this tradeline as inaccurate and unverifiable and request deletion or ' +
    'correction of any information that cannot be verified under FCRA §611 (15 U.S.C. §1681i).'
  )
}

export function defaultDisputeReason(t: Tradeline): string {
  if (isInquiryTradeline(t)) return defaultInquiryDisputeReason(t.creditor || '')
  if (isCleanProfileRemovalTarget(t)) return defaultRemovalDisputeReason(t)
  return (
    'I dispute this item as inaccurate and unverifiable and request deletion or correction ' +
    'of any information that cannot be verified under FCRA §611 (15 U.S.C. §1681i).'
  )
}

/** Prefer stored reason unless it still uses the old clean-profile boilerplate. */
export function resolvedDisputeReason(t: Tradeline): string {
  const existing = (t.dispute_reason || t.suggested_dispute_reason || '').trim()
  if (existing && !usesStaleCleanProfileLanguage(existing)) return existing

  const flags = new Set((t.legal_flags || []).map((f) => f.toLowerCase()))
  const { kind } = classifyMismatchKind(t)
  if (kind === 'cross_bureau_inconsistent' || flags.has(FLAG_INCONSISTENT)) {
    return inconsistentDisputeReason(t)
  }
  if (kind === 'consistent_inaccuracy' || flags.has(FLAG_CONSISTENT)) {
    return consistentInaccuracyDisputeReason(t)
  }
  return defaultDisputeReason(t)
}

/** Rewrite stale clean-profile templates on tradelines already saved in report_json. */
export function sanitizeTradelineDisputeReasons(tradelines: Tradeline[]): Tradeline[] {
  return tradelines.map((t) => {
    const suggested = (t.suggested_dispute_reason || '').trim()
    const dispute = (t.dispute_reason || '').trim()
    const suggestedStale = usesStaleCleanProfileLanguage(suggested)
    const disputeStale = usesStaleCleanProfileLanguage(dispute)
    if (!suggestedStale && !disputeStale) return t
    const next = resolvedDisputeReason({
      ...t,
      dispute_reason: disputeStale ? '' : dispute,
      suggested_dispute_reason: suggestedStale ? '' : suggested,
    })
    return {
      ...t,
      suggested_dispute_reason: suggestedStale ? next : t.suggested_dispute_reason,
      dispute_reason: disputeStale || !dispute ? next : t.dispute_reason,
    }
  })
}

export function planSelectionsFromTradelines(tradelines: Tradeline[]) {
  return sanitizeTradelineDisputeReasons(tradelines)
    .filter((t) => t.selected)
    .map((t) => ({
      id: t.id,
      selected: true as const,
      dispute_reason: resolvedDisputeReason(t),
    }))
}
