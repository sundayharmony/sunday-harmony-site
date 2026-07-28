'use client'

import StatusBadge from '@/components/ui/StatusBadge'
import { WorkflowStepStrip } from '@/components/credit-funding/WorkflowStepStrip'
import { buildWorkflowSteps, type WorkflowHistoryItem } from '@/lib/credit-funding-workflow-steps'
import type { ApplicationStatus } from '@/lib/credit-funding-types'

interface Props {
  currentStatus: ApplicationStatus
  history?: WorkflowHistoryItem[]
  needsFunding?: boolean
}

export default function CreditFundingStatusTracker({
  currentStatus,
  history = [],
  needsFunding = false,
}: Props) {
  const steps = buildWorkflowSteps(currentStatus, history, needsFunding)

  return (
    <div className="bg-white border border-brand-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-brand-text">Application Progress</h3>
        <StatusBadge status={currentStatus} />
      </div>
      <WorkflowStepStrip steps={steps} layout="vertical" />
    </div>
  )
}
