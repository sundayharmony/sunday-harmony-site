import {
  STATUS_LABELS,
  STATUS_WORKFLOW_ORDER,
  isTerminalStatus,
  type ApplicationStatus,
} from '@/lib/credit-funding-types'

export interface WorkflowHistoryItem {
  status: ApplicationStatus
  created_at: string
  notes?: string
}

export interface WorkflowStepState {
  status: ApplicationStatus
  label: string
  isComplete: boolean
  isCurrent: boolean
  isUpcoming: boolean
  historyEntry?: WorkflowHistoryItem
}

export function buildWorkflowSteps(
  currentStatus: ApplicationStatus,
  history: WorkflowHistoryItem[] = []
): WorkflowStepState[] {
  const terminal = isTerminalStatus(currentStatus)
  const reachedIndex = terminal
    ? STATUS_WORKFLOW_ORDER.length
    : Math.max(0, STATUS_WORKFLOW_ORDER.indexOf(currentStatus))

  const stepStatuses = terminal
    ? [...STATUS_WORKFLOW_ORDER, currentStatus]
    : STATUS_WORKFLOW_ORDER

  return stepStatuses.map((status, i) => {
    const historyEntry = history.find((h) => h.status === status)
    const isComplete = terminal ? i < stepStatuses.length - 1 : i < reachedIndex
    const isCurrent = status === currentStatus
    const isUpcoming = !isComplete && !isCurrent

    return {
      status,
      label: STATUS_LABELS[status] || status,
      isComplete,
      isCurrent,
      isUpcoming,
      historyEntry,
    }
  })
}
