import {
  STATUS_LABELS,
  getWorkflowOrder,
  resolveWorkflowDisplayStatus,
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
  history: WorkflowHistoryItem[] = [],
  isBusinessOwner = true
): WorkflowStepState[] {
  const order = getWorkflowOrder(isBusinessOwner)
  const displayStatus = resolveWorkflowDisplayStatus(currentStatus, isBusinessOwner)

  // declined/archived are outside the linear path — append so the strip shows the outcome
  const stepStatuses =
    currentStatus === 'declined' || currentStatus === 'archived'
      ? [...order, currentStatus]
      : order

  let currentIndex: number
  if (currentStatus === 'declined' || currentStatus === 'archived') {
    currentIndex = stepStatuses.length - 1
  } else if (currentStatus === 'completed') {
    currentIndex = order.includes('completed') ? order.indexOf('completed') : order.length - 1
  } else {
    currentIndex = Math.max(0, order.indexOf(displayStatus))
  }

  // Non-business completed: short path is fully done with no "Completed" step
  const nonBusinessCompleted = currentStatus === 'completed' && !order.includes('completed')

  return stepStatuses.map((status, i) => {
    const historyEntry = history.find((h) => h.status === status)
    const isComplete = nonBusinessCompleted ? true : i < currentIndex
    const isCurrent = nonBusinessCompleted ? false : i === currentIndex
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
