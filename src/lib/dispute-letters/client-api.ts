import type {
  AppConfig,
  GeneratedLetter,
  LetterPlan,
  ParsedReport,
  ReportHealth,
  Tradeline,
} from '@/lib/dispute-letters/types'

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return typeof data.error === 'string' ? data.error : res.statusText
  } catch {
    return res.statusText || 'Request failed'
  }
}

export async function fetchDisputeConfig(): Promise<AppConfig> {
  const res = await fetch('/api/admin/dispute-letters/config')
  if (!res.ok) return { cursor_api_configured: false }
  return res.json()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Start background analysis on the Python API, then poll session status until ready/failed.
 * Avoids SSE through Vercel→Render, which often drops mid-run ("stream ended unexpectedly").
 */
export async function analyzeReport(
  sessionId: string,
  storagePath: string,
  fileName: string,
  onProgress?: (message: string) => void
): Promise<{ session_id: string; report: ParsedReport }> {
  onProgress?.('Starting Credit Intelligence analysis…')

  const startRes = await fetch(`/api/admin/dispute-letters/${sessionId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath, fileName }),
  })

  if (!startRes.ok) {
    throw new Error(await parseError(startRes))
  }

  const deadline = Date.now() + 8 * 60 * 1000
  let attempt = 0
  const progressMessages = [
    'Reading credit report…',
    'Extracting text (OCR if needed)…',
    'Running Credit Intelligence analysis…',
    'Still analyzing — large image PDFs take a few minutes…',
    'Almost done…',
  ]

  while (Date.now() < deadline) {
    attempt += 1
    onProgress?.(progressMessages[Math.min(attempt - 1, progressMessages.length - 1)])

    await sleep(attempt < 3 ? 2000 : 3000)

    const statusRes = await fetch(`/api/admin/dispute-letters/${sessionId}/status`, {
      cache: 'no-store',
    })
    if (!statusRes.ok) {
      throw new Error(await parseError(statusRes))
    }

    const statusBody = (await statusRes.json()) as {
      status?: string
      error_message?: string | null
    }
    const status = statusBody.status || ''

    if (status === 'ready') {
      onProgress?.('Loading analysis results…')
      return fetchDisputeReport(sessionId)
    }

    if (status === 'failed') {
      throw new Error(
        statusBody.error_message?.trim() ||
          'Analysis failed. Check Render logs for dispute-letters-api.'
      )
    }
  }

  throw new Error(
    'Analysis timed out after 8 minutes. Open the Render service logs — OOM on the free plan is the usual cause for image-heavy Credit Hero PDFs.'
  )
}

/** @deprecated Prefer analyzeReport (start + poll). Kept for any leftover callers. */
export function streamAnalyzeReport(
  sessionId: string,
  storagePath: string,
  fileName: string,
  onEvent: (data: Record<string, unknown>) => void
): Promise<{ session_id: string; report: ParsedReport }> {
  return analyzeReport(sessionId, storagePath, fileName, (message) => {
    onEvent({ status: 'analyzing', message })
  })
}

export async function fetchDisputeReport(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ session_id: string; report: ParsedReport }>
}

/** Permanently remove a report history session and its stored files. */
export async function deleteDisputeSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function fetchDisputeHealth(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/health`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ReportHealth>
}

export async function fetchDisputeSessionsForApplication(applicationUuid: string) {
  const res = await fetch(
    `/api/admin/dispute-letters/by-application?applicationUuid=${encodeURIComponent(applicationUuid)}`
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ sessions: import('@/lib/dispute-letters/types').DisputeSessionListItem[] }>
}

export async function rebuildDisputeIntelligence(
  sessionId: string,
  fundingContext?: import('@/lib/dispute-letters/types').FundingContextPayload
) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ funding_context: fundingContext || null }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    session_id: string
    credit_intelligence: import('@/lib/dispute-letters/types').CreditIntelligenceReport
  }>
}

export async function patchDisputeTradelines(sessionId: string, tradelines: Tradeline[]) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/tradelines`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tradelines }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function buildDisputePlan(
  sessionId: string,
  selections: { id: string; selected: boolean; dispute_reason: string }[],
  overrides: Record<string, string[]>
) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      selections,
      furnisher_address_overrides: overrides,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ session_id: string; plans: LetterPlan[] }>
}

export function streamGenerateDisputeLetters(
  sessionId: string,
  onEvent: (data: Record<string, unknown>) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    fetch(`/api/admin/dispute-letters/${sessionId}/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((res) => {
        if (!res.ok || !res.body) throw new Error('Stream failed')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              resolve()
              return
            }
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n\n')
            buffer = parts.pop() || ''
            for (const part of parts) {
              if (part.startsWith('data: ')) {
                try {
                  onEvent(JSON.parse(part.slice(6)))
                } catch {
                  /* ignore */
                }
              }
            }
            return pump()
          })

        return pump()
      })
      .catch(reject)
  })
}

export async function fetchDisputeLetters(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/letters`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ letters: GeneratedLetter[] }>
}

export function disputeLetterDownloadUrl(sessionId: string, letterId: string, format = 'txt') {
  return `/api/admin/dispute-letters/${sessionId}/letters/${letterId}/download?format=${format}`
}

export function disputeLettersZipUrl(sessionId: string) {
  return `/api/admin/dispute-letters/${sessionId}/letters/download-zip`
}
