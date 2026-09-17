import { ScoreCard } from '@/components/dispute-letters/ScoreCard'
import { bureauScoreValue } from '@/lib/dispute-letters/bureau-coverage'
import { bureauScoreOriginNote } from '@/lib/dispute-letters/bureau-score-history'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'
import type { BureauCode, BureauScoreOrigin, BureauScores } from '@/lib/dispute-letters/types'

const BUREAU_ORDER: BureauCode[] = ['TUC', 'EXP', 'EQF']

export function BureauScoreCards({
  scores,
  origins,
}: {
  scores?: BureauScores | null
  origins?: Partial<Record<BureauCode, BureauScoreOrigin>>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {BUREAU_ORDER.map((bureau) => (
        <ScoreCard
          key={bureau}
          bureau={BUREAU_LABELS[bureau]}
          code={bureau}
          score={bureauScoreValue(scores, bureau)}
          note={bureauScoreOriginNote(origins?.[bureau])}
        />
      ))}
    </div>
  )
}
