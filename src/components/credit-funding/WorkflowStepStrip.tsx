'use client'

import type { WorkflowStepState } from '@/lib/credit-funding-workflow-steps'

export interface FormStepStripItem {
  id: string
  label: string
  isComplete: boolean
  isCurrent: boolean
  isUpcoming: boolean
}

type StepItem = WorkflowStepState | FormStepStripItem

function stepKey(step: StepItem, index: number): string {
  return 'status' in step ? step.status : step.id || String(index)
}

interface Props {
  steps: StepItem[]
  layout?: 'vertical' | 'horizontal'
}

function hasHistoryEntry(step: StepItem): step is WorkflowStepState {
  return 'historyEntry' in step
}

export function WorkflowStepStrip({ steps, layout = 'vertical' }: Props) {
  if (layout === 'horizontal') {
    return (
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex items-start gap-1 min-w-max">
          {steps.map((step, i) => (
            <div key={stepKey(step, i)} className="flex items-center">
              <div className="flex flex-col items-center w-[72px] sm:w-[88px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    step.isComplete
                      ? 'bg-accent text-white'
                      : step.isCurrent
                        ? 'bg-brand-text text-white ring-2 ring-accent ring-offset-1'
                        : 'bg-neutral-200 text-brand-dim'
                  }`}
                  title={step.label}
                >
                  {step.isComplete ? '✓' : i + 1}
                </div>
                <p
                  className={`mt-1.5 text-[9px] sm:text-[10px] text-center leading-tight line-clamp-2 ${
                    step.isCurrent ? 'font-semibold text-brand-text' : step.isUpcoming ? 'text-brand-dim' : 'text-brand-muted'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-4 sm:w-6 h-0.5 mb-5 shrink-0 ${step.isComplete ? 'bg-accent' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={stepKey(step, i)} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step.isComplete
                  ? 'bg-accent text-white'
                  : step.isCurrent
                    ? 'bg-brand-text text-white ring-2 ring-accent ring-offset-2'
                    : 'bg-neutral-200 text-brand-dim'
              }`}
            >
              {step.isComplete ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-0.5 flex-1 min-h-[24px] ${step.isComplete ? 'bg-accent' : 'bg-neutral-200'}`} />
            )}
          </div>
          <div className={`pb-5 ${step.isUpcoming ? 'opacity-50' : ''}`}>
            <p className={`text-sm font-medium ${step.isCurrent ? 'text-brand-text' : 'text-brand-muted'}`}>
              {step.label}
            </p>
            {hasHistoryEntry(step) && step.historyEntry && (
              <p className="text-xs text-brand-dim mt-0.5">
                {new Date(step.historyEntry.created_at).toLocaleString()}
              </p>
            )}
            {step.isCurrent && hasHistoryEntry(step) && step.historyEntry?.notes && (
              <p className="text-xs text-brand-muted mt-1">{step.historyEntry.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
