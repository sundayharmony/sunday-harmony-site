'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import { ProgressPanel } from '@/components/dispute-letters/ProgressPanel'
import type { LetterPlan, Tradeline } from '@/lib/dispute-letters/types'
import {
  buildDisputePlan,
  fetchDisputeReport,
  generateDisputeLetters,
  patchDisputeConsumer,
} from '@/lib/dispute-letters/client-api'
import { skippedAddressPlans, type SkippedLetterPlan } from '@/lib/dispute-letters/generate-job'
import { planSelectionsFromTradelines } from '@/lib/dispute-letters/dispute-reasons'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'
import { disputeLettersStandaloneHref } from '@/lib/dispute-letters/workflow'

const SKIPPED_STORAGE_PREFIX = 'dispute-skipped:'

export default function DisputeConfirmStep({
  sessionId,
  embedded = false,
  onStepChange,
}: {
  sessionId: string
  embedded?: boolean
  onStepChange?: (step: DisputeLetterStep) => void
}) {
  const [plans, setPlans] = useState<LetterPlan[]>([])
  const [selectedCount, setSelectedCount] = useState(0)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [consumerName, setConsumerName] = useState('')
  const [consumerAddresses, setConsumerAddresses] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return
    setPlans([])
    fetchDisputeReport(sessionId)
      .then(async (data) => {
        const selected = data.report.tradelines.filter((t: Tradeline) => t.selected)
        setSelectedCount(selected.length)
        setConsumerName(data.report.consumer?.name || '')
        setConsumerAddresses((data.report.consumer?.addresses || []).join('\n'))
        const plan = await buildDisputePlan(sessionId, planSelectionsFromTradelines(data.report.tradelines), {})
        setPlans(plan.plans)
      })
      .catch(() => setError('Failed to load plan'))
  }, [sessionId])

  const skippedNeeded = skippedAddressPlans(plans)

  async function generate() {
    setLoading(true)
    setError('')
    setStatus('Starting letter generation…')
    try {
      const overrideMap: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(overrides)) {
        if (v.trim()) overrideMap[k] = v.split('\n').map((l) => l.trim()).filter(Boolean)
      }
      const addresses = consumerAddresses
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      await patchDisputeConsumer(sessionId, { name: consumerName, addresses })
      const reportData = await fetchDisputeReport(sessionId)
      const selections = planSelectionsFromTradelines(reportData.report.tradelines)
      await buildDisputePlan(sessionId, selections, overrideMap)
      const job = await generateDisputeLetters(
        sessionId,
        { consumerName, consumerAddresses: addresses },
        (ev) => {
          if (ev.status === 'progress' || ev.status === 'generating') {
            const current = ev.current && ev.total ? `${ev.current}/${ev.total}` : ''
            setStatus(`Generating ${current}${ev.title ? `: ${ev.title}` : ''}`.trim())
          }
          if (ev.status === 'complete') setStatus('Done')
        }
      )
      const skipped = job.skipped || []
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`${SKIPPED_STORAGE_PREFIX}${sessionId}`, JSON.stringify(skipped))
      }
      if (onStepChange) onStepChange('letters')
      else window.location.assign(disputeLettersStandaloneHref(sessionId, 'letters'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const bureauPlans = plans.filter((p) => p.letter_type.startsWith('bureau_')).length

  return (
    <div className={`${embedded ? '' : 'max-w-4xl'} space-y-6`}>
      {!embedded && <DisputeLettersStepStrip sessionId={sessionId} />}

      <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-brand-text">Confirm your dispute plan</h2>
        <p className="mt-2 text-sm text-brand-dim">
          You are disputing <strong>{selectedCount}</strong> item(s) across{' '}
          <strong>{plans.length}</strong> letter(s) ({bureauPlans} bureau
          {bureauPlans === 1 ? '' : 's'} + furnishers).
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm space-y-3">
        <h3 className="font-semibold text-brand-text">Letter consumer identity</h3>
        <p className="text-sm text-brand-dim">
          Used on the Word letters. Fix OCR garbage here without re-uploading the report.
        </p>
        <label className="block text-sm">
          <span className="font-medium text-brand-text">Name</span>
          <input
            className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
            value={consumerName}
            onChange={(e) => setConsumerName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-brand-text">Address (one line per row; first is current)</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm min-h-[80px]"
            value={consumerAddresses}
            onChange={(e) => setConsumerAddresses(e.target.value)}
          />
        </label>
      </div>

      {skippedNeeded.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Address needed — these furnisher letters will be skipped until filled in:</p>
          <ul className="mt-2 list-disc pl-5">
            {skippedNeeded.map((s: SkippedLetterPlan) => (
              <li key={s.plan_id}>{s.recipient_name}</li>
            ))}
          </ul>
        </div>
      )}

      {plans.map((p) => (
        <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm" key={p.id}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-brand-text">{p.recipient_name}</h3>
            {p.missing_address && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                Address needed
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-brand-dim">
            {p.statute} · {p.items.length} item(s)
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {p.items.map((it) => (
              <li key={`${p.id}-${it.tradeline_id}`} className="rounded-lg bg-neutral-50 p-3">
                <strong>{it.creditor}</strong> — {it.account_number}
                <p className="mt-1 text-brand-dim">{it.dispute_reason}</p>
              </li>
            ))}
          </ul>
          {p.missing_address && (
            <label className="mt-3 block text-sm">
              <span className="font-medium text-brand-text">Furnisher address (one line per row)</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm min-h-[80px]"
                value={overrides[p.recipient_name] || ''}
                onChange={(e) => setOverrides({ ...overrides, [p.recipient_name]: e.target.value })}
              />
            </label>
          )}
        </div>
      ))}

      {loading && status && <ProgressPanel status={status} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          onClick={() => void generate()}
        >
          Generate letters
        </button>
        {embedded && onStepChange ? (
          <button
            type="button"
            className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
            onClick={() => onStepChange('review')}
          >
            Back
          </button>
        ) : (
          <Link
            href={disputeLettersStandaloneHref(sessionId, 'review')}
            className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
          >
            Back
          </Link>
        )}
      </div>
    </div>
  )
}
