import { isNegativeTradeline } from '@/lib/dispute-letters/bureau-coverage'
import type { Tradeline } from '@/lib/dispute-letters/types'

const CLOSED_RE =
  /\b(closed|paid\s*\/\s*closed|paid\s+closed|paid\s+as\s+agreed|transferred|sold|inactive)\b/i
const PAID_RE = /\bpaid\b/i
const ZERO_BALANCE_RE = /^(?:\$?\s*0(?:\.00)?|0|zero|n\/?a|none|not\s+reported|-|—)?\s*$/i

function blob(tl: Pick<Tradeline, 'status' | 'remarks' | 'account_type' | 'past_due' | 'legal_flags'>): string {
  return `${tl.status} ${tl.remarks} ${tl.account_type} ${tl.past_due} ${(tl.legal_flags || []).join(' ')}`
}

export function isClosedTradeline(tl: Tradeline): boolean {
  return CLOSED_RE.test(blob(tl))
}

export function isZeroOrBlankBalance(tl: Pick<Tradeline, 'balance'>): boolean {
  const bal = (tl.balance || '').trim()
  if (!bal) return true
  return ZERO_BALANCE_RE.test(bal)
}

function classifyCategory(tl: Tradeline): string {
  const text = blob(tl).toLowerCase()
  if (tl.is_collection || text.includes('collection') || (tl.item_category || '') === 'collection') {
    return 'collection'
  }
  if (text.includes('charge') && text.includes('off')) return 'charge_off'
  if (text.includes('inquir') || (tl.item_category || '') === 'inquiry') return 'inquiry'
  if (isClosedTradeline(tl) && isNegativeTradeline(tl)) return 'closed_derogatory'
  if (text.includes('late') || text.includes('delinquent')) return 'late_payment'
  if ((tl.legal_flags || []).includes('balance_mismatch')) return 'bureau_mismatch'
  if ((tl.legal_flags || []).includes('already_disputed')) return 'disputed'
  if (isNegativeTradeline(tl)) return 'negative'
  if (isClosedTradeline(tl)) return 'closed'
  return 'positive'
}

/** Closed/paid/obsolete negatives that should be recommended for deletion. */
export function isCleanProfileRemovalTarget(tl: Tradeline): boolean {
  const category = classifyCategory(tl)
  if (category === 'collection' || category === 'charge_off') return true
  if ((tl.legal_flags || []).some((f) => f === 'obsolete_negative' || f === 'closed_derogatory')) {
    return true
  }
  if (!isClosedTradeline(tl)) return false
  if (isNegativeTradeline(tl)) return true
  if (PAID_RE.test(blob(tl)) && isZeroOrBlankBalance(tl)) {
    if (tl.past_due || tl.remarks || tl.analysis_notes || tl.suggested_dispute_reason) return true
  }
  return false
}

/**
 * Recommended disputes: repair_priority high|medium, or clean-profile removal.
 * Distinct from negative-item chips (`isNegativeTradeline`).
 */
export function isRecommendedDispute(tl: Tradeline): boolean {
  const priority = tl.repair_priority || 'none'
  if (priority === 'high' || priority === 'medium') return true
  return isCleanProfileRemovalTarget(tl)
}

/** Keep existing checks; when none are selected, check recommended disputes. */
export function applyRecommendedSelection(tradelines: Tradeline[]): Tradeline[] {
  const anySelected = tradelines.some((t) => t.selected)
  return tradelines.map((t) => {
    const shouldSelect = t.selected || (!anySelected && isRecommendedDispute(t))
    if (!shouldSelect) return t
    return {
      ...t,
      selected: true,
      dispute_reason: t.dispute_reason || t.suggested_dispute_reason || t.dispute_reason,
    }
  })
}
