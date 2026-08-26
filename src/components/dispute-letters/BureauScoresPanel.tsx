'use client'

import { ScoreCard } from '@/components/dispute-letters/ScoreCard'
import type { BureauScores } from '@/lib/dispute-letters/types'

interface BureauScoresPanelProps {
  scores?: BureauScores | null
  title?: string
  subtitle?: string
}

export function BureauScoresPanel({
  scores,
  title = 'Credit Bureau Scores',
  subtitle,
}: BureauScoresPanelProps) {
  const hasScores = scores && (scores.tuc !== null || scores.exp !== null || scores.eqf !== null)

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
      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreCard bureau="TransUnion" code="TUC" score={scores?.tuc ?? null} />
        <ScoreCard bureau="Experian" code="EXP" score={scores?.exp ?? null} />
        <ScoreCard bureau="Equifax" code="EQF" score={scores?.eqf ?? null} />
      </div>
    </div>
  )
}
