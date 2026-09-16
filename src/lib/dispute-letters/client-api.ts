import type {
  AppConfig,
  GeneratedLetter,
  LetterPlan,
  ParsedReport,
  ReportHealth,
  Tradeline,
} from '@/lib/dispute-letters/types'
import {
  letterGenerateFailure,
  type LetterGenerateJob,
} from '@/lib/dispute-letters/generate-job'

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

/** Delete all reports, generated letters, rounds, and item history for an application. */
export async function resetApplicationDisputeWork(applicationUuid: string): Promise<{
  sessionsDeleted: number
  caseDeleted: boolean
}> {
  const res = await fetch(`/api/admin/credit-funding/${applicationUuid}/reset-dispute-work`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ sessionsDeleted: number; caseDeleted: boolean }>
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
  overrides: Record<string, string[]>,
  tradelines?: Tradeline[]
) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      selections,
      furnisher_address_overrides: overrides,
      ...(tradelines ? { tradelines } : {}),
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ session_id: string; plans: LetterPlan[]; dispute_round?: { id: string; round_number: number } | null }>
}

export function streamGenerateDisputeLetters(
  sessionId: string,
  onEvent: (data: Record<string, unknown>) => void,
  options?: GenerateDisputeLettersOptions
): Promise<LetterGenerateJob> {
  return generateDisputeLetters(sessionId, options, (job) => {
    onEvent(job as Record<string, unknown>)
  })
}

export type GenerateDisputeLettersOptions = {
  planIds?: string[] | null
  consumerName?: string
  consumerAddresses?: string[]
}

export async function generateDisputeLetters(
  sessionId: string,
  options?: GenerateDisputeLettersOptions,
  onProgress?: (job: LetterGenerateJob) => void
): Promise<LetterGenerateJob> {
  onProgress?.({ status: 'generating', title: 'Starting letter generation…' })

  const startRes = await fetch(`/api/admin/dispute-letters/${sessionId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      plan_ids: options?.planIds ?? null,
      consumer_name: options?.consumerName ?? null,
      consumer_addresses: options?.consumerAddresses ?? null,
    }),
  })
  if (!startRes.ok) {
    throw new Error(await parseError(startRes))
  }

  const deadline = Date.now() + 8 * 60 * 1000
  let attempt = 0
  let last: LetterGenerateJob = { status: 'generating' }

  while (Date.now() < deadline) {
    attempt += 1
    await sleep(attempt < 3 ? 1500 : 2500)

    const statusRes = await fetch(`/api/admin/dispute-letters/${sessionId}/generate`, {
      cache: 'no-store',
    })
    if (!statusRes.ok) {
      throw new Error(await parseError(statusRes))
    }

    last = (await statusRes.json()) as LetterGenerateJob
    onProgress?.(last)

    const failure = letterGenerateFailure(last)
    if (failure) throw new Error(failure)

    if (last.status === 'complete') {
      return last
    }
  }

  throw new Error('Letter generation timed out. Check Render logs for dispute-letters-api.')
}

export async function fetchLetterGenerateStatus(sessionId: string): Promise<LetterGenerateJob> {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/generate`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<LetterGenerateJob>
}

export async function patchDisputeConsumer(
  sessionId: string,
  consumer: { name?: string; addresses?: string[] }
) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/consumer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consumer),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchDisputeLetters(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/letters`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ letters: GeneratedLetter[] }>
}

export async function markDisputeLetterSent(letterId: string) {
  const res = await fetch('/api/admin/dispute-letters/lifecycle', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ letterId, sent: true }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; sentAt?: string; roundComplete?: boolean }>
}

export async function fetchLetterPackageForSession(sessionId: string) {
  const res = await fetch(
    `/api/admin/dispute-letters/lifecycle?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    round: import('@/lib/dispute-letters/dispute-lifecycle').DisputeRoundRow | null
    package: import('@/lib/dispute-letters/dispute-lifecycle').LetterPackageSnapshot | null
    letters: import('@/lib/dispute-letters/dispute-lifecycle').DisputeRoundLetter[]
  }>
}

export async function confirmLetterPackageSent(params: { packageId?: string; sessionId?: string }) {
  const res = await fetch('/api/admin/dispute-letters/lifecycle', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageId: params.packageId,
      sessionId: params.sessionId,
      confirmAllSent: true,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    ok: boolean
    sentAt?: string
    roundComplete?: boolean
    itemCount?: number
  }>
}

export function disputeLetterDownloadUrl(sessionId: string, letterId: string, format = 'docx') {
  return `/api/admin/dispute-letters/${sessionId}/letters/${letterId}/download?format=${format}`
}

export function disputeLettersZipUrl(sessionId: string) {
  return `/api/admin/dispute-letters/${sessionId}/letters/download-zip`
}
