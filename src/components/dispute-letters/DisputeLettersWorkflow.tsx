'use client'

import { useRef } from 'react'
import DisputeConfirmStep from '@/components/dispute-letters/DisputeConfirmStep'
import DisputeHealthStep from '@/components/dispute-letters/DisputeHealthStep'
import DisputeLettersResultStep from '@/components/dispute-letters/DisputeLettersResultStep'
import DisputeReviewStep from '@/components/dispute-letters/DisputeReviewStep'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'

export default function DisputeLettersWorkflow({
  sessionId,
  step,
  onStepChange,
  onBackToAnalysis,
}: {
  sessionId: string
  step: DisputeLetterStep
  onStepChange: (step: DisputeLetterStep) => void
  onBackToAnalysis?: () => void
}) {
  const persistRef = useRef<(() => Promise<void>) | null>(null)

  return (
    <div className="space-y-4 rounded-xl border border-brand-border bg-white p-4">
      <div>
        <h3 className="text-sm font-bold text-brand-text">Dispute letters</h3>
        <p className="mt-1 text-sm text-brand-muted">
          Select accounts, confirm the plan, and generate bureau/furnisher letters for this report —
          without leaving Credit Intelligence.
        </p>
      </div>

      <DisputeLettersStepStrip
        sessionId={sessionId}
        embedded
        activeStep={step}
        onStepChange={onStepChange}
        persistBeforeNavigate={async () => {
          await persistRef.current?.()
        }}
      />

      {step === 'health' && (
        <DisputeHealthStep
          sessionId={sessionId}
          embedded
          onStepChange={onStepChange}
          persistRef={persistRef}
        />
      )}
      {step === 'review' && (
        <DisputeReviewStep
          sessionId={sessionId}
          embedded
          onStepChange={onStepChange}
          persistRef={persistRef}
        />
      )}
      {step === 'confirm' && (
        <DisputeConfirmStep sessionId={sessionId} embedded onStepChange={onStepChange} />
      )}
      {step === 'letters' && (
        <DisputeLettersResultStep
          sessionId={sessionId}
          embedded
          onStepChange={onStepChange}
          onBackToAnalysis={onBackToAnalysis}
        />
      )}
    </div>
  )
}
