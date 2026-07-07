import type { BureauCode } from '@/lib/dispute-letters/types'

function scoreBand(score: number | null) {
  if (score == null) return { label: 'Not in report', className: 'text-brand-dim' }
  if (score < 580) return { label: 'Poor', className: 'text-red-600' }
  if (score < 670) return { label: 'Fair', className: 'text-amber-600' }
  if (score < 740) return { label: 'Good', className: 'text-blue-600' }
  return { label: 'Excellent', className: 'text-green-600' }
}

export function ScoreCard({
  bureau,
  code,
  score,
}: {
  bureau: string
  code: BureauCode
  score: number | null
}) {
  const band = scoreBand(score)
  return (
    <div className="rounded-xl border border-brand-border bg-white p-5 flex flex-col items-center text-center shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">{bureau}</p>
      <p className="mt-2 text-4xl font-bold text-brand-text">{score ?? '—'}</p>
      <p className={`mt-1 text-sm font-medium ${band.className}`}>{band.label}</p>
      <span className="mt-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-brand-dim">{code}</span>
    </div>
  )
}
