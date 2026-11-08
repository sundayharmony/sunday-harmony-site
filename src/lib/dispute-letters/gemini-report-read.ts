import { filenameBureauHint, isNegativeTradeline } from '@/lib/dispute-letters/bureau-coverage'
import type { BureauCode, BureauScores, ParsedReport, Tradeline } from '@/lib/dispute-letters/types'

export const GEMINI_REPORT_TIMEOUT_MS = 20_000
export const GEMINI_REPORT_MAX_BYTES = 7_000_000
const DEFAULT_MODEL = 'gemini-2.5-flash'

export type GeminiReportRead = {
  tradelines: Tradeline[]
  scores: Partial<BureauScores>
}

type GeminiAccount = {
  creditor?: unknown
  account_number?: unknown
  status?: unknown
  balance?: unknown
  credit_limit?: unknown
  date_opened?: unknown
  account_type?: unknown
  past_due?: unknown
  is_collection?: unknown
  bureaus?: unknown
}

const BUREAUS = new Set<BureauCode>(['TUC', 'EXP', 'EQF'])

function text(value: unknown, max = 80): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function score(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(text(value, 8))
  if (!Number.isInteger(n) || n < 300 || n > 850) return null
  return n
}

function bureausOf(value: unknown, fileName: string): BureauCode[] {
  const raw = Array.isArray(value) ? value : []
  const found = raw
    .map((item) => text(item, 8).toUpperCase())
    .filter((item): item is BureauCode => BUREAUS.has(item as BureauCode))
  if (found.length) return [...new Set(found)]
  return filenameBureauHint(fileName)
}

function blankTradeline(partial: Partial<Tradeline> & Pick<Tradeline, 'id' | 'creditor'>): Tradeline {
  return {
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: '',
    status: '',
    balance: '',
    past_due: '',
    remarks: '',
    credit_limit: '',
    high_credit: '',
    date_opened: '',
    date_of_first_delinquency: '',
    last_reported: '',
    payment_history: '',
    monthly_payment: '',
    bureaus: [],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: [],
    dispute_furnisher: true,
    legal_flags: [],
    repair_priority: 'none',
    item_category: '',
    ...partial,
  }
}

export function tradelineFromGeminiAccount(row: GeminiAccount, fileName: string): Tradeline | null {
  const creditor = text(row.creditor, 80)
  if (creditor.length < 2 || /^(unknown|n\/a|none|creditor)$/i.test(creditor)) return null
  const bureaus = bureausOf(row.bureaus, fileName)
  const account = text(row.account_number, 32)
  const status = text(row.status, 80)
  const balance = text(row.balance, 32)
  const accountType = text(row.account_type, 40)
  const opened = text(row.date_opened, 32)
  const pastDue = text(row.past_due, 32)
  if (![account, status, balance, accountType, opened, pastDue].some(Boolean)) return null
  const collection =
    row.is_collection === true || /collection|charge\s*off/i.test(`${status} ${accountType}`)
  const tradeline = blankTradeline({
    id: crypto.randomUUID(),
    creditor,
    account_type: accountType,
    status,
    balance,
    credit_limit: text(row.credit_limit, 32),
    date_opened: opened,
    past_due: pastDue,
    bureaus,
    is_collection: collection,
    item_category: collection ? 'collection' : '',
    repair_priority: collection ? 'high' : 'none',
    dispute_bureaus: bureaus,
  })
  if (account) {
    const targets = bureaus.length ? bureaus : filenameBureauHint(fileName)
    if (targets.includes('TUC') || targets.length === 0) tradeline.account_tu = account
    if (targets.includes('EXP')) tradeline.account_exp = account
    if (targets.includes('EQF')) tradeline.account_eqf = account
    if (targets.length === 1 && targets[0] === 'TUC') {
      tradeline.account_exp = ''
      tradeline.account_eqf = ''
    }
    if (targets.length === 1 && targets[0] === 'EXP') {
      tradeline.account_tu = ''
      tradeline.account_eqf = ''
    }
    if (targets.length === 1 && targets[0] === 'EQF') {
      tradeline.account_tu = ''
      tradeline.account_exp = ''
    }
  }
  return tradeline
}

export function parseGeminiReportPayload(raw: string, fileName = ''): GeminiReportRead {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim()
  let data: unknown
  try {
    data = JSON.parse(cleaned)
  } catch {
    return { tradelines: [], scores: {} }
  }
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const scoresRaw = record.scores && typeof record.scores === 'object' ? (record.scores as Record<string, unknown>) : {}
  const rows = Array.isArray(record.tradelines) ? record.tradelines : []
  const tradelines = rows
    .slice(0, 40)
    .map((row) => (row && typeof row === 'object' ? tradelineFromGeminiAccount(row as GeminiAccount, fileName) : null))
    .filter((row): row is Tradeline => row !== null)
  return {
    tradelines,
    scores: {
      tuc: score(scoresRaw.tuc),
      exp: score(scoresRaw.exp),
      eqf: score(scoresRaw.eqf),
    },
  }
}

/**
 * Report shape that should try a Gemini scan-read.
 * Safe to call from the browser — does not inspect GEMINI_API_KEY (server-only).
 */
export function reportNeedsModelRead(report: ParsedReport | null | undefined): boolean {
  if (!report) return true
  const tls = report.tradelines || []
  if (tls.length === 0) return true
  const quality = String(report.extraction_quality || '').toLowerCase()
  if (quality === 'low' || quality === 'weak' || quality === 'ocr_poor' || quality === 'poor') {
    return true
  }
  const named = tls.filter((t) => (t.creditor || '').trim().length > 1)
  if (named.length === 0) return true
  // Credit Hero OCR sometimes keeps balances but labels creditors as "Unnamed · …"
  const provisional = tls.filter((t) => /^unnamed\b/i.test((t.creditor || '').trim()))
  if (provisional.length > 0 && provisional.length >= Math.ceil(tls.length / 2)) {
    return true
  }
  const thin = tls.filter(
    (t) =>
      !(t.account_tu || t.account_exp || t.account_eqf || t.balance || t.status || t.payment_history)
  )
  if (thin.length / tls.length >= 0.75) return true
  return false
}

/** Server-only: same as reportNeedsModelRead, but requires GEMINI_API_KEY. */
export function needsGeminiReportFallback(report: ParsedReport | null | undefined): boolean {
  if (!process.env.GEMINI_API_KEY?.trim()) return false
  return reportNeedsModelRead(report)
}

export function isProvisionalCreditor(name: string): boolean {
  const cleaned = (name || '').trim()
  if (!cleaned) return true
  if (/^unnamed\b/i.test(cleaned)) return true
  return /^(unknown|n\/a|none|creditor)$/i.test(cleaned)
}

/** Real furnisher names only — provisional "Unnamed · …" placeholders do not count. */
export function namedCreditorCount(tradelines: Tradeline[]): number {
  return tradelines.filter((t) => {
    const creditor = (t.creditor || '').trim()
    return creditor.length > 1 && !isProvisionalCreditor(creditor)
  }).length
}

function accountNumberKeys(tl: Tradeline): string[] {
  const raw = [tl.account_tu, tl.account_exp, tl.account_eqf]
  const keys: string[] = []
  for (const value of raw) {
    const digits = String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    if (digits.length >= 4) keys.push(digits)
  }
  return [...new Set(keys)]
}

/**
 * Keep local late/past-due facts; stamp real Gemini creditor names onto matching rows.
 * Falls back to Gemini's full list when local had no usable rows to merge onto.
 */
export function mergeGeminiNamesOntoLocal(local: Tradeline[], gemini: Tradeline[]): Tradeline[] {
  if (!local.length) return gemini
  if (!gemini.length) return local

  const byKey = new Map<string, Tradeline>()
  for (const row of gemini) {
    if (isProvisionalCreditor(row.creditor || '')) continue
    for (const key of accountNumberKeys(row)) {
      if (!byKey.has(key)) byKey.set(key, row)
    }
  }

  let renamed = 0
  const usedGemini = new Set<Tradeline>()
  const merged = local.map((row) => {
    let match: Tradeline | undefined
    for (const key of accountNumberKeys(row)) {
      match = byKey.get(key)
      if (match) break
    }
    if (!match) return row
    usedGemini.add(match)
    const gemCreditor = (match.creditor || '').trim()
    if (!gemCreditor || isProvisionalCreditor(gemCreditor)) return row
    if ((row.creditor || '').trim() === gemCreditor) return row
    renamed += 1
    return {
      ...row,
      creditor: gemCreditor,
      // Prefer Gemini account type only when local never captured one.
      account_type: row.account_type?.trim() ? row.account_type : match.account_type || row.account_type,
    }
  })

  if (renamed > 0) return merged
  // No account-number overlap — if Gemini has more real names, take its rows wholesale.
  if (namedCreditorCount(gemini) > namedCreditorCount(local)) return gemini
  return local
}

export function applyGeminiRead(report: ParsedReport, read: GeminiReportRead): ParsedReport {
  if (!read.tradelines.length) return report
  const local = report.tradelines || []
  // For weak nonempty local parses, only replace/merge when Gemini returns a richer named set.
  if (local.length > 0) {
    const localNamed = namedCreditorCount(local)
    const geminiNamed = namedCreditorCount(read.tradelines)
    if (geminiNamed <= localNamed) return report
  }

  const tradelines =
    local.length > 0 ? mergeGeminiNamesOntoLocal(local, read.tradelines) : read.tradelines

  const scores = {
    tuc: read.scores.tuc ?? report.credit_health?.scores?.tuc ?? null,
    exp: read.scores.exp ?? report.credit_health?.scores?.exp ?? null,
    eqf: read.scores.eqf ?? report.credit_health?.scores?.eqf ?? null,
  }
  const next: ParsedReport = {
    ...report,
    source: 'gemini',
    analysis_summary: `Read ${tradelines.length} account(s) from the scan.`,
    tradelines,
    credit_health: {
      ...report.credit_health,
      scores,
      total_accounts: tradelines.length,
      negative_count: tradelines.filter(isNegativeTradeline).length,
      collection_count: tradelines.filter((tl) => tl.is_collection).length,
      high_priority_count: tradelines.filter((tl) => tl.repair_priority === 'high').length,
      repair_summary: report.credit_health?.repair_summary || 'Accounts were read from the uploaded scan.',
      recommended_actions: report.credit_health?.recommended_actions || [],
    },
  }
  return next
}

export function geminiReportMimeType(fileName: string): string | null {
  const name = fileName.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

export function geminiReportRequest(pdfBase64: string, mimeType: string): Record<string, unknown> {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              'This is a consumer credit report the local parser could not read.',
              'Return JSON only with scores and tradelines you can actually see.',
              'Do not invent accounts. Do not include the consumer name, address, date of birth, or SSN.',
              'scores uses tuc, exp, and eqf as integers from 300 to 850, or null.',
              'Each tradeline needs creditor plus at least one of account_number, status, balance, credit_limit, date_opened, account_type, past_due.',
              'bureaus is an array of TUC, EXP, EQF. is_collection is true only for collections or charge-offs.',
            ].join(' '),
          },
          { inlineData: { mimeType, data: pdfBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  }
}

export async function readReportWithGemini(params: {
  bytes: Buffer
  mimeType: string
  fileName: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}): Promise<GeminiReportRead> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return { tradelines: [], scores: {} }
  if (!params.bytes.length || params.bytes.length > GEMINI_REPORT_MAX_BYTES) {
    return { tradelines: [], scores: {} }
  }
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
  const fetchImpl = params.fetchImpl || fetch
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(geminiReportRequest(params.bytes.toString('base64'), params.mimeType)),
      signal: AbortSignal.timeout(params.timeoutMs ?? GEMINI_REPORT_TIMEOUT_MS),
    }
  )
  if (!response.ok) {
    throw new Error(`Gemini report read failed (${response.status})`)
  }
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const textPart = body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
  return parseGeminiReportPayload(textPart, params.fileName)
}
