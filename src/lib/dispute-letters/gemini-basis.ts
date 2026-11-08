/**
 * Optional Gemini rewrite of Basis-of-Dispute paragraphs from confirmed facts only.
 * Never send DOB / SSN / street address. Mock-friendly; live calls gated by env.
 */

export const GEMINI_BASIS_TIMEOUT_MS = 12_000
export const GEMINI_BASIS_ENV = 'GEMINI_LETTER_BASIS'

export type BasisFact = {
  tradeline_id: string
  creditor: string
  bureau?: string
  mismatch_kind?: string
  mismatch_summary?: string
  status?: string
  /** Payment-history evidence string already confirmed by staff/parsers — not free invention. */
  evidence?: string
}

export type BasisRewriteResult = {
  byTradelineId: Record<string, string>
  usedGemini: boolean
  error?: string
}

function stripIdentifiers(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted-ssn]')
    .replace(/\b\d{9}\b/g, '[redacted]')
    .replace(/\b(?:dob|date of birth)\s*[:=]?\s*[^\n,;]+/gi, '[redacted-dob]')
}

export function geminiBasisEnabled(): boolean {
  const flag = process.env[GEMINI_BASIS_ENV]?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on'
}

export function buildBasisPrompt(facts: BasisFact[]): string {
  const safe = facts.map((f) => ({
    tradeline_id: f.tradeline_id,
    creditor: f.creditor,
    bureau: f.bureau || '',
    mismatch_kind: f.mismatch_kind || '',
    mismatch_summary: stripIdentifiers(f.mismatch_summary || ''),
    status: stripIdentifiers(f.status || ''),
    evidence: stripIdentifiers(f.evidence || ''),
  }))
  return [
    'Rewrite Basis of Dispute paragraphs for credit bureau letters.',
    'Return JSON only: {"items":[{"tradeline_id":"...","basis":"..."}]}',
    'Use ONLY the facts provided. Do not invent bureaus, months, balances, or accounts.',
    'Do not include SSN, DOB, or street addresses.',
    'Keep each basis under 600 characters.',
    'Write ONE concise paragraph per item. Do not repeat the same dispute opener or the same FCRA cite.',
    'Do not say an account is "not useful to a clean credit profile."',
    'Facts:',
    JSON.stringify(safe),
  ].join('\n')
}

export function parseBasisRewritePayload(raw: string, allowedIds: Set<string>): Record<string, string> {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return {}
  }
  const items = (parsed as { items?: unknown })?.items
  if (!Array.isArray(items)) return {}
  const out: Record<string, string> = {}
  for (const row of items) {
    if (!row || typeof row !== 'object') continue
    const id = String((row as { tradeline_id?: unknown }).tradeline_id || '').trim()
    const basis = stripIdentifiers(String((row as { basis?: unknown }).basis || '').trim())
    if (!id || !allowedIds.has(id) || basis.length < 20 || basis.length > 800) continue
    // Reject invented bureau codes not present in original facts path — soft check via bare hallucination markers.
    if (/\b(I assume|probably|might have|invented)\b/i.test(basis)) continue
    out[id] = basis
  }
  return out
}

/** Merge Gemini basis text into selection dispute_reason map (facts-only; no-op when disabled). */
export function mergeBasisIntoReasons(
  current: Record<string, string>,
  rewritten: Record<string, string>
): Record<string, string> {
  const out = { ...current }
  for (const [id, basis] of Object.entries(rewritten)) {
    if (!basis || basis.length < 20) continue
    out[id] = basis
  }
  return out
}

export async function rewriteBasisWithGemini(params: {
  facts: BasisFact[]
  timeoutMs?: number
  fetchImpl?: typeof fetch
  /** When false, skip network even if API key present (tests / default economical mode). */
  allowLive?: boolean
}): Promise<BasisRewriteResult> {
  const allowed = new Set(params.facts.map((f) => f.tradeline_id))
  if (!params.facts.length) return { byTradelineId: {}, usedGemini: false }
  if (!geminiBasisEnabled() || !params.allowLive) {
    return { byTradelineId: {}, usedGemini: false, error: 'gemini_basis_disabled' }
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return { byTradelineId: {}, usedGemini: false, error: 'missing_api_key' }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
  const fetchImpl = params.fetchImpl || fetch
  try {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildBasisPrompt(params.facts) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(params.timeoutMs ?? GEMINI_BASIS_TIMEOUT_MS),
      }
    )
    if (!response.ok) {
      return { byTradelineId: {}, usedGemini: false, error: `http_${response.status}` }
    }
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
    const byTradelineId = parseBasisRewritePayload(text, allowed)
    return { byTradelineId, usedGemini: Object.keys(byTradelineId).length > 0 }
  } catch (err) {
    return {
      byTradelineId: {},
      usedGemini: false,
      error: err instanceof Error ? err.name : 'error',
    }
  }
}
