'use client'

import { useState, useEffect } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import { WorkflowStepStrip } from '@/components/credit-funding/WorkflowStepStrip'
import { buildWorkflowSteps, type WorkflowHistoryItem } from '@/lib/credit-funding-workflow-steps'
import {
  APPLICATION_STATUSES,
  STATUS_ACTION_HINTS,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  getNextWorkflowStatus,
  getPreviousWorkflowStatus,
  getWorkflowStepDistance,
  isInWorkflow,
  isTerminalStatus,
  type ApplicationStatus,
} from '@/lib/credit-funding-types'

const inputClass =
  'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent'

interface Props {
  currentStatus: ApplicationStatus
  history?: WorkflowHistoryItem[]
  statusNotes: string
  onStatusNotesChange: (notes: string) => void
  onStatusChange: (status: ApplicationStatus, notes?: string) => void
  saving?: boolean
  pendingDocCount?: number
}

export default function AdminApplicationWorkflow({
  currentStatus,
  history = [],
  statusNotes,
  onStatusNotesChange,
  onStatusChange,
  saving = false,
  pendingDocCount = 0,
}: Props) {
  const [manualStatus, setManualStatus] = useState(currentStatus)

  useEffect(() => {
    setManualStatus(currentStatus)
  }, [currentStatus])

  const steps = buildWorkflowSteps(currentStatus, history)
  const nextStatus = getNextWorkflowStatus(currentStatus)
  const prevStatus = getPreviousWorkflowStatus(currentStatus)
  const terminal = isTerminalStatus(currentStatus)
  const inWorkflow = isInWorkflow(currentStatus)
  const currentHistory = history.find((h) => h.status === currentStatus)

  const handleAdvance = () => {
    if (!nextStatus) return
    onStatusChange(nextStatus, statusNotes || undefined)
  }

  const handleBack = () => {
    if (!prevStatus) return
    onStatusChange(prevStatus, statusNotes || undefined)
  }

  const handleDecline = () => {
    if (!window.confirm('Decline this application? The client will be notified by email.')) return
    onStatusChange('declined', statusNotes || 'Application declined')
  }

  const handleComplete = () => {
    onStatusChange('completed', statusNotes || 'Application completed')
  }

  const handleArchive = () => {
    if (!window.confirm('Archive this application?')) return
    onStatusChange('archived', statusNotes || 'Application archived')
  }

  const handleManualApply = () => {
    if (manualStatus === currentStatus) return
    const distance = getWorkflowStepDistance(currentStatus, manualStatus)
    if (distance > 1 || isTerminalStatus(manualStatus)) {
      const label = STATUS_LABELS[manualStatus]
      if (!window.confirm(`Set status to "${label}"? The client will be notified by email.`)) return
    }
    onStatusChange(manualStatus, statusNotes || undefined)
  }

  const advanceLabel = nextStatus
    ? STATUS_ACTION_HINTS[currentStatus] || `Advance to ${STATUS_LABELS[nextStatus]}`
    : null

  return (
    <div className="mb-5 bg-white border border-brand-border rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-brand-text">Application Workflow</h3>
          <p className="text-xs text-brand-dim mt-0.5">Move the case forward step by step</p>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      <WorkflowStepStrip steps={steps} layout="horizontal" />

      <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-brand-border">
        <p className="text-sm font-semibold text-brand-text">
          {STATUS_LABELS[currentStatus]}
          {pendingDocCount > 0 && (
            <span className="ml-2 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
              {pendingDocCount} doc request{pendingDocCount !== 1 ? 's' : ''} pending
            </span>
          )}
        </p>
        <p className="text-xs text-brand-muted mt-1 leading-relaxed">
          {STATUS_DESCRIPTIONS[currentStatus]}
        </p>
        {currentHistory && (
          <p className="text-xs text-brand-dim mt-2">
            Last updated: {new Date(currentHistory.created_at).toLocaleString()}
            {currentHistory.notes ? ` — ${currentHistory.notes}` : ''}
          </p>
        )}

        <div className="mt-3">
          <label className="text-xs font-semibold text-brand-dim">Note for client email (optional)</label>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Included in the status update email to the applicant"
            value={statusNotes}
            onChange={(e) => onStatusNotesChange(e.target.value)}
            disabled={saving}
          />
        </div>

        {inWorkflow && !terminal && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prevStatus && (
              <button
                type="button"
                disabled={saving}
                onClick={handleBack}
                className="px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
              >
                ← {STATUS_LABELS[prevStatus]}
              </button>
            )}
            {nextStatus && (
              <button
                type="button"
                disabled={saving}
                onClick={handleAdvance}
                className="px-4 py-2 text-xs font-semibold bg-brand-text text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {advanceLabel} →
              </button>
            )}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-brand-border flex flex-wrap gap-2">
          {currentStatus === 'approved' && (
            <button
              type="button"
              disabled={saving}
              onClick={handleComplete}
              className="px-3 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
            >
              Mark completed
            </button>
          )}
          {!terminal && currentStatus !== 'declined' && (
            <button
              type="button"
              disabled={saving}
              onClick={handleDecline}
              className="px-3 py-2 text-xs font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Decline application
            </button>
          )}
          {(terminal || currentStatus === 'completed') && currentStatus !== 'archived' && (
            <button
              type="button"
              disabled={saving}
              onClick={handleArchive}
              className="px-3 py-2 text-xs font-semibold text-brand-muted border border-brand-border rounded-lg hover:bg-neutral-100 disabled:opacity-50"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      <details className="mt-3 group">
        <summary className="text-xs font-semibold text-brand-dim cursor-pointer hover:text-brand-text list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">›</span>
          Set status manually
        </summary>
        <div className="mt-2 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <select
              className={inputClass}
              value={manualStatus}
              disabled={saving}
              onChange={(e) => setManualStatus(e.target.value as ApplicationStatus)}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={saving || manualStatus === currentStatus}
            onClick={handleManualApply}
            className="px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </details>
    </div>
  )
}
