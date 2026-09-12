export type SkippedLetterPlan = {
  plan_id: string
  recipient_name: string
  reason: string
}

export type GeneratedLetterSummary = {
  id?: string
  plan_id?: string
  title?: string
}

export type LetterGenerateJob = {
  status?: string
  session_id?: string
  current?: number
  total?: number
  title?: string
  letters?: GeneratedLetterSummary[]
  skipped?: SkippedLetterPlan[]
  error_message?: string | null
  error?: string
  job_running?: boolean
  message?: string
}

export function emptyLettersError(skipped: SkippedLetterPlan[] | undefined): string {
  const items = skipped || []
  if (items.length) {
    const names = items.map((s) => s.recipient_name || 'furnisher').join(', ')
    return `No letters generated. Address needed for: ${names}.`
  }
  return 'No letters were generated.'
}

/** Staff-facing error if the job failed or completed with zero letters. */
export function letterGenerateFailure(job: LetterGenerateJob): string | null {
  if (job.error) {
    return job.error_message || job.error || 'Letter generation failed'
  }
  const status = job.status || ''
  if (status === 'failed' || status === 'error') {
    return job.error_message || job.error || 'Letter generation failed'
  }
  if (status === 'complete') {
    const n = job.letters?.length ?? 0
    if (n === 0) return emptyLettersError(job.skipped)
  }
  return null
}

export function isLetterGenerateTerminal(job: LetterGenerateJob): boolean {
  const status = job.status || ''
  return status === 'complete' || status === 'failed' || status === 'error'
}

export function skippedAddressPlans(plans: { missing_address?: boolean; recipient_name: string; id: string }[]) {
  return plans
    .filter((p) => p.missing_address)
    .map((p) => ({
      plan_id: p.id,
      recipient_name: p.recipient_name,
      reason: 'missing_address',
    }))
}
