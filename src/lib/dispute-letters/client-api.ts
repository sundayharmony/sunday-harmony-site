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

export function streamAnalyzeReport(
  sessionId: string,
  storagePath: string,
  fileName: string,
  onEvent: (data: Record<string, unknown>) => void
): Promise<{ session_id: string; report: ParsedReport }> {
  return new Promise((resolve, reject) => {
    fetch(`/api/admin/dispute-letters/${sessionId}/analyze/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath, fileName }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '')
          let errMsg = 'Analyze stream failed'
          if (errText) {
            try {
              const parsed = JSON.parse(errText) as { error?: string }
              errMsg = parsed.error || errText
            } catch {
              errMsg = errText
            }
          }
          throw new Error(errMsg.slice(0, 200))
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              reject(new Error('Analyze stream ended unexpectedly'))
              return
            }
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n\n')
            buffer = parts.pop() || ''
            for (const part of parts) {
              if (!part.startsWith('data: ')) continue
              try {
                const data = JSON.parse(part.slice(6)) as Record<string, unknown>
                onEvent(data)
                if (data.error) {
                  reject(new Error(String(data.error)))
                  return
                }
                if (data.status === 'complete') {
                  resolve({
                    session_id: data.session_id as string,
                    report: data.report as ParsedReport,
                  })
                  return
                }
              } catch {
                /* ignore */
              }
            }
            return pump()
          })

        return pump()
      })
      .catch(reject)
  })
}

export async function fetchDisputeReport(sessionId: string) {
  const res = await fetch(`/api/admin/dispute-letters/${sessionId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ session_id: string; report: ParsedReport }>
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
