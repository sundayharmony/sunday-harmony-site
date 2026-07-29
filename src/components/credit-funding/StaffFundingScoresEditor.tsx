'use client'

import type { FundingScores } from '@/lib/credit-funding-types'

const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'

const SCORE_FIELDS = [
  { key: 'revenue_score' as const, label: 'Revenue score (0–100)' },
  { key: 'funding_readiness' as const, label: 'Staff funding readiness (0–100)' },
  { key: 'credit_readiness' as const, label: 'Staff credit readiness (0–100)' },
]

export default function StaffFundingScoresEditor({
  fundingScores,
  onChange,
  onSave,
  saving,
  engineHint,
}: {
  fundingScores: FundingScores
  onChange: (next: FundingScores) => void
  onSave: () => void | Promise<void>
  saving?: boolean
  /** Optional advisory line from Credit Intelligence for context */
  engineHint?: string | null
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-white px-4 py-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-brand-text">Staff assessment</h3>
        <p className="mt-1 text-sm text-brand-muted">
          Scores and recommendations shown on the client portal. Separate from report analysis on the Analysis tab.
        </p>
        {engineHint ? (
          <p className="mt-2 text-xs text-brand-dim">
            Report funding readiness (advisory):{' '}
            <span className="font-semibold text-brand-text">{engineHint}</span>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCORE_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-brand-dim">{label}</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={fundingScores[key] ?? ''}
              onChange={(e) =>
                onChange({
                  ...fundingScores,
                  [key]: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold text-brand-dim">Estimated funding range</label>
        <input
          className={inputClass}
          placeholder="e.g. $50,000 – $150,000"
          value={fundingScores.estimated_range || ''}
          onChange={(e) => onChange({ ...fundingScores, estimated_range: e.target.value })}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-brand-dim">Recommended programs (comma-separated)</label>
        <input
          className={inputClass}
          value={(fundingScores.recommended_programs || []).join(', ')}
          onChange={(e) =>
            onChange({
              ...fundingScores,
              recommended_programs: e.target.value
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-brand-dim">Specialist recommendations</label>
        <textarea
          className={`${inputClass} min-h-[100px]`}
          value={fundingScores.specialist_notes || ''}
          onChange={(e) => onChange({ ...fundingScores, specialist_notes: e.target.value })}
        />
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave()}
        className="px-4 py-2 bg-brand-text text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save staff assessment'}
      </button>
    </div>
  )
}
