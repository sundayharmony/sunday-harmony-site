'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  DISPUTE_LETTER_STEPS,
  type DisputeLetterStep,
  disputeLettersStandaloneHref,
} from '@/lib/dispute-letters/workflow'

type Props = {
  sessionId?: string
  /** When set, strip is controlled (embedded in Credit Intelligence). Upload step is omitted. */
  activeStep?: DisputeLetterStep
  onStepChange?: (step: DisputeLetterStep) => void
  embedded?: boolean
}

export function DisputeLettersStepStrip({
  sessionId,
  activeStep,
  onStepChange,
  embedded = false,
}: Props) {
  const pathname = usePathname()

  const steps = embedded
    ? DISPUTE_LETTER_STEPS
    : [{ slug: '' as const, label: 'Upload' }, ...DISPUTE_LETTER_STEPS]

  const activeIndex = (() => {
    if (embedded && activeStep) {
      return DISPUTE_LETTER_STEPS.findIndex((s) => s.slug === activeStep)
    }
    if (!sessionId) return 0
    if (pathname.includes('/letters')) return embedded ? 3 : 4
    if (pathname.includes('/confirm')) return embedded ? 2 : 3
    if (pathname.includes('/review')) return embedded ? 1 : 2
    if (pathname.includes('/health')) return embedded ? 0 : 1
    return 0
  })()

  return (
    <div className={`${embedded ? 'mb-4' : 'mb-8'} overflow-x-auto pb-1`}>
      <div className="flex items-start gap-1 min-w-max">
        {steps.map((step, i) => {
          const slug = step.slug
          const isLetterStep = slug === 'health' || slug === 'review' || slug === 'confirm' || slug === 'letters'
          const href =
            embedded || !sessionId
              ? undefined
              : !isLetterStep
                ? '/admin/dispute-letters'
                : disputeLettersStandaloneHref(sessionId, slug)

          const isComplete = i < activeIndex
          const isCurrent = i === activeIndex
          const isUpcoming = i > activeIndex

          const circle = (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isComplete
                  ? 'bg-accent text-white'
                  : isCurrent
                    ? 'bg-brand-text text-white ring-2 ring-accent ring-offset-1'
                    : 'bg-neutral-200 text-brand-dim'
              }`}
            >
              {isComplete ? '✓' : i + 1}
            </div>
          )

          const interactive =
            embedded && onStepChange && isLetterStep && !isUpcoming ? (
              <button
                type="button"
                className="hover:opacity-90"
                onClick={() => onStepChange(slug)}
              >
                {circle}
              </button>
            ) : href && !isUpcoming ? (
              <Link href={href} className="hover:opacity-90">
                {circle}
              </Link>
            ) : (
              circle
            )

          return (
            <div key={slug || 'upload'} className="flex items-center">
              <div className="flex flex-col items-center w-20 sm:w-24">
                {interactive}
                <p
                  className={`mt-1.5 text-[10px] sm:text-xs text-center leading-tight ${
                    isCurrent ? 'font-semibold text-brand-text' : 'text-brand-dim'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-6 sm:w-10 h-0.5 mb-5 shrink-0 ${isComplete ? 'bg-accent' : 'bg-neutral-200'}`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
