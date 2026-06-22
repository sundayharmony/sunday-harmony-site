'use client'

import { STATUS_LABELS, STATUS_WORKFLOW_ORDER, type ApplicationStatus } from '@/lib/credit-funding-types'
import StatusBadge from '@/components/ui/StatusBadge'

interface StatusHistoryItem {
  status: ApplicationStatus
  created_at: string
  notes?: string
}

interface Props {
  currentStatus: ApplicationStatus
  history?: StatusHistoryItem[]
}

export default function CreditFundingStatusTracker({ currentStatus, history = [] }: Props) {
  const terminalStatuses: ApplicationStatus[] = ['declined', 'archived', 'completed']
  const isTerminal = terminalStatuses.includes(currentStatus)

  const reachedIndex = isTerminal
    ? STATUS_WORKFLOW_ORDER.length
    : Math.max(0, STATUS_WORKFLOW_ORDER.indexOf(currentStatus))

  const steps = isTerminal
    ? [...STATUS_WORKFLOW_ORDER, currentStatus]
    : STATUS_WORKFLOW_ORDER

  return (
    <div className="bg-white border border-brand-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-brand-text">Application Progress</h3>
        <StatusBadge status={currentStatus} />
      </div>

      <div className="space-y-0">
        {steps.map((status, i) => {
          const historyEntry = history.find((h) => h.status === status)
          const isComplete = isTerminal ? i < steps.length - 1 : i < reachedIndex
          const isCurrent = status === currentStatus
          const isUpcoming = !isComplete && !isCurrent

          return (
            <div key={status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isComplete
                      ? 'bg-accent text-white'
                      : isCurrent
                        ? 'bg-brand-text text-white ring-2 ring-accent ring-offset-2'
                        : 'bg-neutral-200 text-brand-dim'
                  }`}
                >
                  {isComplete ? '✓' : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[24px] ${isComplete ? 'bg-accent' : 'bg-neutral-200'}`} />
                )}
              </div>
              <div className={`pb-5 ${isUpcoming ? 'opacity-50' : ''}`}>
                <p className={`text-sm font-medium ${isCurrent ? 'text-brand-text' : 'text-brand-muted'}`}>
                  {STATUS_LABELS[status] || status}
                </p>
                {historyEntry && (
                  <p className="text-xs text-brand-dim mt-0.5">
                    {new Date(historyEntry.created_at).toLocaleString()}
                  </p>
                )}
                {isCurrent && historyEntry?.notes && (
                  <p className="text-xs text-brand-muted mt-1">{historyEntry.notes}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
