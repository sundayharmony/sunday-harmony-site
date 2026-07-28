'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import { ProgressPanel } from '@/components/dispute-letters/ProgressPanel'
import type { LetterPlan, Tradeline } from '@/lib/dispute-letters/types'
import {
  buildDisputePlan,
  fetchDisputeReport,
  streamGenerateDisputeLetters,
} from '@/lib/dispute-letters/client-api'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'
import { disputeLettersStandaloneHref } from '@/lib/dispute-letters/workflow'

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
        const selections = selected
          .map((t: Tradeline) => ({
            id: t.id,
            selected: true,
            dispute_reason: t.dispute_reason?.trim() || t.suggested_dispute_reason?.trim() || '',
          }))
          .filter((t: { dispute_reason: string }) => t.dispute_reason)
        const plan = await buildDisputePlan(sessionId, selections, {})
        setPlans(plan.plans)
      })
      .catch(() => setError('Failed to load plan'))
  }, [sessionId])

  async function generate() {
    setLoading(true)
    setError('')
    setStatus('Starting letter generation…')
    try {
      const overrideMap: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(overrides)) {
        if (v.trim()) overrideMap[k] = v.split('\n').map((l) => l.trim()).filter(Boolean)
      }
      const reportData = await fetchDisputeReport(sessionId)
      const selections = reportData.report.tradelines
        .filter((t: Tradeline) => t.selected)
        .map((t: Tradeline) => ({
          id: t.id,
          selected: true,
          dispute_reason: t.dispute_reason?.trim() || t.suggested_dispute_reason?.trim() || '',
        }))
        .filter((t: { dispute_reason: string }) => t.dispute_reason)
      await buildDisputePlan(sessionId, selections, overrideMap)
      await streamGenerateDisputeLetters(sessionId, (ev) => {
        if (ev.status === 'progress') {
          setStatus(`Generating ${ev.current}/${ev.total}: ${ev.title}`)
        }
        if (ev.status === 'complete') setStatus('Done')
      })
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
