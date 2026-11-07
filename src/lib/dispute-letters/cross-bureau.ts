import type { BureauCode, Tradeline } from '@/lib/dispute-letters/types'

export type MismatchKind = 'cross_bureau_inconsistent' | 'consistent_inaccuracy' | 'other'

export const FLAG_INCONSISTENT = 'cross_bureau_inconsistent'
export const FLAG_CONSISTENT = 'consistent_inaccuracy'

const BUREAUS: BureauCode[] = ['EQF', 'EXP', 'TUC']
const MARK_RE =
  /\b(EQF|EXP|TUC)\s*[:=]\s*(OK|C|0|30|60|90|120|CO|COL|RPO|FC|VS)(?:\s*[:=/-]\s*(\d{4}-\d{2}|\d{1,2}\/\d{4}))?/gi

export function parseBureauMarks(text: string): Record<string, { code: string; month: string }> {
  const out: Record<string, { code: string; month: string }> = {}
  const src = text || ''
  let match: RegExpExecArray | null
  MARK_RE.lastIndex = 0
  while ((match = MARK_RE.exec(src))) {
    const bureau = match[1].toUpperCase()
    let code = match[2].toUpperCase()
    if (code === 'C' || code === '0') code = 'OK'
    out[bureau] = { code, month: (match[3] || '').trim() }
  }
  return out
}

function negativeMark(code: string): boolean {
  return !['OK', 'C', '0', ''].includes(code.toUpperCase())
}

function fallbackInconsistent(tl: Pick<Tradeline, 'creditor'>): string {
  return `Payment history / status for ${tl.creditor || 'this account'} is reported inconsistently across the bureaus that list this account.`
}

function fallbackConsistent(tl: Pick<Tradeline, 'creditor'>): string {
  return `The same inaccurate or unverifiable information for ${tl.creditor || 'this account'} appears on the bureaus that report it.`
}

export function classifyMismatchKind(tl: Tradeline): { kind: MismatchKind; summary: string } {
  const flags = new Set((tl.legal_flags || []).map((f) => f.toLowerCase()))
  const summary = (tl.mismatch_summary || '').trim()
  if (flags.has(FLAG_INCONSISTENT)) {
    return { kind: 'cross_bureau_inconsistent', summary: summary || fallbackInconsistent(tl) }
  }
  if (flags.has(FLAG_CONSISTENT)) {
    return { kind: 'consistent_inaccuracy', summary: summary || fallbackConsistent(tl) }
  }

  const bureaus = [...new Set((tl.bureaus || []).map((b) => String(b).toUpperCase()))]
  // Absent reporting is not proof of error.
  if (bureaus.length < 2) return { kind: 'other', summary: '' }

  const blob = `${tl.payment_history || ''}\n${tl.analysis_notes || ''}`
  const marks = parseBureauMarks(blob)
  const reporting = BUREAUS.filter((b) => marks[b] && bureaus.includes(b))
  if (reporting.length >= 2) {
    const values = new Set(reporting.map((b) => marks[b].code.toUpperCase()))
    if (values.size > 1) {
      const parts = reporting.map(
        (b) => `${b}=${marks[b].code}${marks[b].month ? `@${marks[b].month}` : ''}`
      )
      return {
        kind: 'cross_bureau_inconsistent',
        summary: `Payment history differs across reporting bureaus: ${parts.join('; ')}`,
      }
    }
    if (reporting.every((b) => negativeMark(marks[b].code))) {
      const sample = marks[reporting[0]]
      const detail = `${sample.code}${sample.month ? ` in ${sample.month}` : ''}`
      return {
        kind: 'consistent_inaccuracy',
        summary: `Same payment-history defect (${detail}) on all reporting bureaus (${reporting.join(', ')}).`,
      }
    }
  }

  const lateBlob = `${tl.status || ''} ${tl.remarks || ''} ${tl.payment_history || ''} ${tl.analysis_notes || ''}`.toLowerCase()
  if ((lateBlob.includes('late') || lateBlob.includes('delinquent')) && bureaus.length >= 2) {
    return {
      kind: 'consistent_inaccuracy',
      summary: `Late/delinquent reporting appears on ${bureaus.sort().join(', ')} without a documented cross-bureau conflict.`,
    }
  }

  return { kind: 'other', summary: '' }
}

export function applyCrossBureauEnrichment<T extends Tradeline>(tl: T): T {
  const { kind, summary } = classifyMismatchKind(tl)
  const flags = (tl.legal_flags || []).filter((f) => f !== FLAG_INCONSISTENT && f !== FLAG_CONSISTENT)
  let repair_priority = tl.repair_priority
  if (kind === 'cross_bureau_inconsistent') {
    flags.push(FLAG_INCONSISTENT)
    if (repair_priority === 'none' || repair_priority === 'low' || repair_priority === 'medium') {
      repair_priority = 'high'
    }
  } else if (kind === 'consistent_inaccuracy') {
    flags.push(FLAG_CONSISTENT)
    if (repair_priority === 'none') repair_priority = 'medium'
  }
  return {
    ...tl,
    legal_flags: flags,
    repair_priority,
    mismatch_summary: (tl.mismatch_summary || '').trim() || summary || tl.mismatch_summary,
  }
}

export function mismatchSortKey(tl: Tradeline): [number, string, string] {
  const { kind } = classifyMismatchKind(tl)
  const order = kind === 'cross_bureau_inconsistent' ? 0 : kind === 'other' ? 1 : 2
  return [order, (tl.creditor || '').toLowerCase(), tl.id]
}

export function inconsistentDisputeReason(tl: Tradeline): string {
  const summary = (tl.mismatch_summary || '').trim() || fallbackInconsistent(tl)
  return (
    `${summary} This is an inaccurate and inconsistent reporting of my payment history across ` +
    'credit bureaus that report this account. Under FCRA §611 (15 U.S.C. §1681i), please ' +
    'reinvestigate and update or delete any payment-history information that cannot be verified ' +
    'as accurate and complete. Absence of the account on another bureau is not my claim — only ' +
    'conflicting information among bureaus that already report this account.'
  )
}

export function consistentInaccuracyDisputeReason(tl: Tradeline): string {
  const summary = (tl.mismatch_summary || '').trim() || fallbackConsistent(tl)
  return (
    `${summary} I dispute this information as inaccurate and unverifiable as reported. ` +
    'Under FCRA §611 (15 U.S.C. §1681i), please reinvestigate and delete or correct any ' +
    'information that cannot be verified.'
  )
}

const CLEARED = new Set(['deleted', 'updated', 'removed', 'completed', 'resolved', 'cleared'])

export function itemStatusCleared(status?: string | null): boolean {
  return CLEARED.has(String(status || '').trim().toLowerCase())
}

export function openInconsistenciesRemain(
  tradelines: Tradeline[],
  itemStatuses: Record<string, string> = {}
): boolean {
  for (const tl of tradelines) {
    const enriched = applyCrossBureauEnrichment(tl)
    if (!(enriched.legal_flags || []).includes(FLAG_INCONSISTENT)) continue
    if (!itemStatusCleared(itemStatuses[tl.id])) return true
  }
  return false
}

/**
 * Round 1: inconsistency-first order (no silent drop — router paginates ≤7/letter).
 * Round 2+: consistent inaccuracies only after mismatches cleared; else open mismatches.
 */
export function selectForRound(
  tradelines: Tradeline[],
  opts: { roundNumber: number; itemStatuses?: Record<string, string> }
): Tradeline[] {
  const roundNumber = Math.max(1, opts.roundNumber || 1)
  const statuses = opts.itemStatuses || {}
  const enriched = tradelines.map((tl) => applyCrossBureauEnrichment(tl))
  if (roundNumber <= 1) {
    const sorted = [...enriched].sort((a, b) => {
      const ka = mismatchSortKey(a)
      const kb = mismatchSortKey(b)
      return ka[0] - kb[0] || ka[1].localeCompare(kb[1])
    })
    const preferred = sorted.filter((tl) => (tl.legal_flags || []).includes(FLAG_INCONSISTENT))
    const preferredIds = new Set(preferred.map((t) => t.id))
    const fillers = sorted.filter(
      (tl) =>
        !preferredIds.has(tl.id) &&
        (tl.repair_priority === 'high' ||
          tl.repair_priority === 'medium' ||
          (tl.legal_flags || []).includes(FLAG_CONSISTENT))
    )
    return [...preferred, ...fillers]
  }
  if (openInconsistenciesRemain(enriched, statuses)) {
    return enriched
      .filter(
        (tl) =>
          (tl.legal_flags || []).includes(FLAG_INCONSISTENT) && !itemStatusCleared(statuses[tl.id])
      )
      .sort((a, b) => (a.creditor || '').localeCompare(b.creditor || ''))
  }
  return enriched
    .filter((tl) => (tl.legal_flags || []).includes(FLAG_CONSISTENT))
    .sort((a, b) => (a.creditor || '').localeCompare(b.creditor || ''))
}
