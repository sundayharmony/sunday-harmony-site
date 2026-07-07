'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const STEPS = [
  { slug: '', label: 'Upload' },
  { slug: 'health', label: 'Health' },
  { slug: 'review', label: 'Disputes' },
  { slug: 'confirm', label: 'Confirm' },
  { slug: 'letters', label: 'Letters' },
]

export function DisputeLettersStepStrip({ sessionId }: { sessionId?: string }) {
  const pathname = usePathname()

  const activeIndex = (() => {
    if (!sessionId) return 0
    if (pathname.includes('/letters')) return 4
    if (pathname.includes('/confirm')) return 3
    if (pathname.includes('/review')) return 2
    if (pathname.includes('/health')) return 1
    return 0
  })()

  return (
    <div className="mb-8 overflow-x-auto pb-1">
      <div className="flex items-start gap-1 min-w-max">
        {STEPS.map((step, i) => {
          const href =
            i === 0
              ? '/admin/dispute-letters'
              : sessionId
                ? `/admin/dispute-letters/${sessionId}/${step.slug}`
                : undefined
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

          return (
            <div key={step.slug || 'upload'} className="flex items-center">
              <div className="flex flex-col items-center w-20 sm:w-24">
                {href && !isUpcoming ? (
                  <Link href={href} className="hover:opacity-90">
                    {circle}
                  </Link>
                ) : (
                  circle
                )}
                <p
                  className={`mt-1.5 text-[10px] sm:text-xs text-center leading-tight ${
                    isCurrent ? 'font-semibold text-brand-text' : 'text-brand-dim'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mb-5 shrink-0 ${isComplete ? 'bg-accent' : 'bg-neutral-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
