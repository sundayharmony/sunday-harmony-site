'use client'

import { BureauScoreCards } from '@/components/dispute-letters/BureauScoreCards'
import { hasAnyBureauScore } from '@/lib/dispute-letters/bureau-score-history'
import type { BureauCode, BureauScoreOrigin, BureauScores } from '@/lib/dispute-letters/types'

interface BureauScoresPanelProps {
  scores?: BureauScores | null
  origins?: Partial<Record<BureauCode, BureauScoreOrigin>>
  title?: string
  subtitle?: string
}

export function BureauScoresPanel({
  scores,
  origins,
  title = 'Credit Bureau Scores',
  subtitle,
}: BureauScoresPanelProps) {
  const hasScores = hasAnyBureauScore(scores)

  return (
    <div className="rounded-xl border border-brand-border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-brand-text">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>
        ) : !hasScores ? (
          <p className="mt-1 text-sm text-brand-muted">
            Upload a credit report to see bureau scores
          </p>
        ) : null}
      </div>
      <BureauScoreCards scores={scores} origins={origins} />
    </div>
  )
}
