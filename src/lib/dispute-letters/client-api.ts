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
    'Reading the new credit report…',
    'Extracting accounts and scores…',
    'Assessing this upload…',
    'Still assessing this upload. Scanned PDFs can take a few minutes…',
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

export async function backfillHistoricalRound1(params: {
  applicationUuid?: string
  consumerName?: string
  preferredReportDate?: string
}): Promise<{
  ok: true
  applicationUuid: string
  round1SessionId: string
  round1FileName: string
  roundId: string
  itemCount: number
  letterCount: number
  followUpCount: number
  responseCount: number
  alreadyComplete: boolean
}> {
  const res = await fetch('/api/admin/dispute-letters/lifecycle/backfill-round1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchDisputeHealth(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}/health`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ReportHealth>
}

/** Accounts already disputed in earlier rounds (soft marks for generate/plan UX). */
export async function fetchPriorDisputeMarks(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${encodeURIComponent(sessionId)}/prior-disputes`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    return {
      marks: [] as import('@/lib/dispute-letters/dispute-lifecycle').PriorDisputeMark[],
      marksByTradelineId: {} as Record<
        string,
        import('@/lib/dispute-letters/dispute-lifecycle').PriorDisputeMark
      >,
      itemCount: 0,
    }
  }
  return res.json() as Promise<{
    marks: import('@/lib/dispute-letters/dispute-lifecycle').PriorDisputeMark[]
    marksByTradelineId: Record<string, import('@/lib/dispute-letters/dispute-lifecycle').PriorDisputeMark>
    itemCount: number
  }>
}

export async function fetchDisputeSessionsForApplication(applicationUuid: string) {
  const res = await fetch(
    `/api/admin/dispute-letters/by-application?applicationUuid=${encodeURIComponent(applicationUuid)}`
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ sessions: import('@/lib/dispute-letters/types').DisputeSessionListItem[] }>
}

export async function fetchDisputeReportFileUrl(sessionId: string): Promise<{ url: string; fileName: string }> {
  const res = await fetch(`/api/admin/dispute-letters/${encodeURIComponent(sessionId)}/report-file`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ url: string; fileName: string }>
}

export async function fetchCreditFundingDocumentViewUrl(
  documentId: string,
  applicationId: string
): Promise<{ url: string; fileName: string }> {
  const res = await fetch(
    `/api/admin/credit-funding/documents/${encodeURIComponent(documentId)}?applicationId=${encodeURIComponent(applicationId)}`
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ url: string; fileName: string }>
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
      onProgress?.({ ...last, status: 'complete', title: 'Preparing download package…' })
      // Ensure ZIP is building/ready before experts land on Download ZIP.
      await prepareDisputeLettersZip(sessionId, { wait: false }).catch(() => undefined)
      await waitForLetterPackageZip(sessionId, 45_000, (status) => {
        onProgress?.({
          ...last,
          status: 'complete',
          title: status === 'ready' ? 'Download package ready' : 'Preparing download package…',
        })
      }).catch(() => undefined)
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

export function disputeLettersPrepareZipUrl(sessionId: string, wait = true) {
  const q = wait ? '' : '?wait=0'
  return `/api/admin/dispute-letters/${sessionId}/letters/prepare-zip${q}`
}

/** Client timeout for ZIP builds (server maxDuration is 120s). */
export const DISPUTE_LETTERS_ZIP_CLIENT_TIMEOUT_MS = 110_000

export type LetterPackageZipClientStatus = {
  ok?: boolean
  status?: string
  zipReady?: boolean
  packageId?: string | null
  letterCount?: number
  error?: string
  deferred?: boolean
  fromCache?: boolean
}

/** Kick off or await ZIP pregeneration for a session. */
export async function prepareDisputeLettersZip(
  sessionId: string,
  options?: { wait?: boolean }
): Promise<LetterPackageZipClientStatus> {
  const wait = options?.wait !== false
  const res = await fetch(disputeLettersPrepareZipUrl(sessionId, wait), { method: 'POST' })
  const body = (await res.json().catch(() => ({}))) as LetterPackageZipClientStatus
  if (!res.ok && res.status !== 202) {
    throw new Error(typeof body.error === 'string' ? body.error : 'ZIP prepare failed')
  }
  return body
}

export async function fetchLetterPackageZipStatus(sessionId: string): Promise<LetterPackageZipClientStatus> {
  const res = await fetch(disputeLettersPrepareZipUrl(sessionId), { cache: 'no-store' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<LetterPackageZipClientStatus>
}

/** Poll until the prebuilt ZIP is ready, failed, or the deadline elapses. */
export async function waitForLetterPackageZip(
  sessionId: string,
  timeoutMs = 90_000,
  onStatus?: (status: string) => void
): Promise<LetterPackageZipClientStatus> {
  const deadline = Date.now() + timeoutMs
  let last: LetterPackageZipClientStatus = { status: 'pending', zipReady: false }
  while (Date.now() < deadline) {
    try {
      last = await fetchLetterPackageZipStatus(sessionId)
      onStatus?.(last.status || (last.zipReady ? 'ready' : 'pending'))
      if (last.zipReady || last.status === 'ready') return last
      if (last.status === 'failed') return last
    } catch {
      /* keep polling — package row may lag generate */
    }
    await sleep(1500)
  }
  return last
}

/**
 * Fetch the letter package ZIP and trigger a browser download.
 * Prefers a prebuilt artifact; server rebuilds only if missing/stale.
 */
export async function downloadDisputeLettersZip(sessionId: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISPUTE_LETTERS_ZIP_CLIENT_TIMEOUT_MS)
  try {
    const res = await fetch(disputeLettersZipUrl(sessionId), { signal: controller.signal })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(typeof body.error === 'string' ? body.error : 'ZIP download failed')
    }
    const blob = await res.blob()
    if (!blob.size) {
      throw new Error('ZIP download was empty. Try again in a moment.')
    }
    const header = res.headers.get('content-disposition') || ''
    const matched = /filename="([^"]+)"/i.exec(header)
    const filename = matched?.[1] || 'Dispute Letters.zip'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'ZIP download timed out. The letter service may be slow — wait a few seconds and try again.'
      )
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
