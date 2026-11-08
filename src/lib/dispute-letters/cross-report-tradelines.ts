import { isProvisionalCreditor } from '@/lib/dispute-letters/gemini-report-read'
import type { BureauCode, DisputeSessionListItem, Tradeline } from '@/lib/dispute-letters/types'

const BUREAUS: BureauCode[] = ['TUC', 'EXP', 'EQF']

/** Collapse masked account ids so 601100XXXXXX matches across bureau PDFs. */
export function accountMatchKey(tl: Pick<Tradeline, 'account_tu' | 'account_exp' | 'account_eqf'>): string {
  const raw = [tl.account_tu, tl.account_exp, tl.account_eqf]
    .map((value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
  for (const token of raw) {
    const core = token.replace(/X+$/g, '')
    if (core.length >= 4) return core
    if (token.length >= 4) return token
  }
  return ''
}

/** Prefer fuller furnisher names from sibling bureau uploads over truncated/provisional ones. */
export function creditorQuality(name: string): number {
  const cleaned = (name || '').trim()
  if (!cleaned || isProvisionalCreditor(cleaned)) return 0
  const letters = cleaned.replace(/[^A-Za-z]/g, '')
  // Slightly prefer names without truncation markers like "/" mid-token leftovers.
  const slashPenalty = cleaned.includes('/') ? 2 : 0
  return letters.length * 10 - slashPenalty
}

function unionBureaus(...lists: Array<BureauCode[] | undefined>): BureauCode[] {
  const found = new Set<BureauCode>()
  for (const list of lists) {
    for (const bureau of list || []) {
      const code = String(bureau).toUpperCase() as BureauCode
      if (BUREAUS.includes(code)) found.add(code)
    }
  }
  return BUREAUS.filter((b) => found.has(b))
}

/**
 * When staff uploads TU + EXP + EQF as separate sessions, Health still opens one
 * session. Carry better creditor names and union bureau tags from sibling reports
 * matched by account number (same pattern as score merge across reports).
 */
export function enrichTradelinesAcrossReports(
  primary: Tradeline[],
  sessions: DisputeSessionListItem[],
  selectedSessionId: string
): Tradeline[] {
  const donors: Tradeline[] = []
  for (const session of sessions) {
    if (session.id === selectedSessionId) continue
    if (session.status && session.status !== 'ready') continue
    const tls = session.report_json?.tradelines || []
    donors.push(...tls)
  }
  if (!donors.length) return primary

  return primary.map((row) => {
    const key = accountMatchKey(row)
    if (!key) return row
    const matches = donors.filter((d) => accountMatchKey(d) === key)
    if (!matches.length) return row

    const bestName = [...matches, row].sort(
      (a, b) => creditorQuality(b.creditor || '') - creditorQuality(a.creditor || '')
    )[0]
    const nextCreditor =
      creditorQuality(bestName?.creditor || '') > creditorQuality(row.creditor || '')
        ? (bestName?.creditor || row.creditor)
        : row.creditor

    const bureaus = unionBureaus(
      row.bureaus,
      ...matches.map((m) => m.bureaus),
      row.dispute_bureaus,
      ...matches.map((m) => m.dispute_bureaus)
    )
    const disputeBureaus = unionBureaus(row.dispute_bureaus?.length ? row.dispute_bureaus : row.bureaus, bureaus)

    if (nextCreditor === row.creditor && bureaus.join() === (row.bureaus || []).join()) {
      return row
    }

    return {
      ...row,
      creditor: nextCreditor,
      bureaus,
      dispute_bureaus: disputeBureaus.length ? disputeBureaus : bureaus,
      account_tu: row.account_tu || matches.find((m) => m.account_tu)?.account_tu || '',
      account_exp: row.account_exp || matches.find((m) => m.account_exp)?.account_exp || '',
      account_eqf: row.account_eqf || matches.find((m) => m.account_eqf)?.account_eqf || '',
    }
  })
}
