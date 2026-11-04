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
  /** Larger target for admin case workflow; default stays compact for intake forms. */
  size?: 'default' | 'prominent'
}

function hasHistoryEntry(step: StepItem): step is WorkflowStepState {
  return 'historyEntry' in step
}

export function WorkflowStepStrip({ steps, layout = 'vertical', size = 'default' }: Props) {
  const prominent = size === 'prominent'

  if (layout === 'horizontal') {
    return (
      <div className={`overflow-x-auto -mx-1 px-1 ${prominent ? 'pt-2 pb-3' : 'pt-1 pb-2'}`}>
        <ol className={`flex items-start list-none m-0 p-0 ${prominent ? 'gap-2' : 'gap-1'} min-w-max`}>
          {steps.map((step, i) => {
            const historyLabel =
              hasHistoryEntry(step) && step.historyEntry
                ? new Date(step.historyEntry.created_at).toLocaleString()
                : ''
            return (
              <li key={stepKey(step, i)} className="flex items-center">
                <div
                  className={`flex flex-col items-center ${
                    prominent ? 'w-[104px] sm:w-[120px]' : 'w-[76px] sm:w-[96px]'
                  }`}
                >
                  <div
                    className={`rounded-full flex items-center justify-center font-bold shrink-0 ${
                      prominent
                        ? 'w-11 h-11 sm:w-12 sm:h-12 text-sm sm:text-base'
                        : 'w-7 h-7 text-[10px]'
                    } ${
                      step.isComplete
                        ? 'bg-accent text-white'
                        : step.isCurrent
                          ? `bg-brand-text text-white ring-2 ring-accent ${
                              prominent ? 'ring-offset-2' : 'ring-offset-1'
                            }`
                          : 'bg-neutral-200 text-brand-dim'
                    }`}
                    title={historyLabel ? `${step.label} · ${historyLabel}` : step.label}
                    aria-current={step.isCurrent ? 'step' : undefined}
                  >
                    {step.isComplete ? '✓' : i + 1}
                  </div>
                  <p
                    className={`mt-2 text-center leading-tight line-clamp-2 ${
                      prominent
                        ? 'text-xs sm:text-sm'
                        : 'text-[9px] sm:text-[10px]'
                    } ${
                      step.isCurrent
                        ? 'font-semibold text-brand-text'
                        : step.isUpcoming
                          ? 'text-brand-dim'
                          : 'text-brand-muted'
                    }`}
                  >
                    {step.label}
                  </p>
                  {historyLabel ? (
                    <p
                      className={`mt-1 text-center text-brand-dim leading-tight line-clamp-2 ${
                        prominent ? 'text-[10px] sm:text-xs' : 'text-[8px] sm:text-[9px]'
                      }`}
                    >
                      {historyLabel}
                    </p>
                  ) : null}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`shrink-0 ${
                      prominent
                        ? `w-6 sm:w-10 h-1 mb-8 ${step.isComplete ? 'bg-accent' : 'bg-neutral-200'}`
                        : `w-4 sm:w-6 h-0.5 mb-6 ${step.isComplete ? 'bg-accent' : 'bg-neutral-200'}`
                    }`}
                    aria-hidden
                  />
                )}
              </li>
            )
          })}
        </ol>
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
