import type { BureauCode, Tradeline } from '@/lib/dispute-letters/types'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'
import { SeverityBadge } from '@/components/dispute-letters/SeverityBadge'

type TradelineCardProps = {
  tradeline: Tradeline
  selected?: boolean
  onSelect?: (checked: boolean) => void
  onChange?: (patch: Partial<Tradeline>) => void
  onToggleBureau?: (bureau: BureauCode, checked: boolean) => void
  showTargets?: boolean
  showReason?: boolean
  compact?: boolean
}

export function TradelineCard({
  tradeline: t,
  selected,
  onSelect,
  onChange,
  onToggleBureau,
  showTargets = false,
  showReason = false,
  compact = false,
}: TradelineCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        selected ? 'border-accent ring-1 ring-accent/30' : 'border-brand-border'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {onSelect && (
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-accent"
              checked={!!selected}
              onChange={(e) => onSelect(e.target.checked)}
            />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-brand-text">{t.creditor || 'Unknown creditor'}</h3>
              <SeverityBadge priority={t.repair_priority || 'none'} />
              {t.item_category && (
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs capitalize text-brand-dim">
                  {t.item_category.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-brand-dim">
              {t.status || '—'} · Balance {t.balance || '—'}
              {t.past_due ? ` · Past due ${t.past_due}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.bureaus.map((b) => (
                <span key={b} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-brand-dim">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {t.analysis_notes && !compact && (
        <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-brand-text">{t.analysis_notes}</p>
      )}

      {showReason && onChange && (
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-brand-text">Dispute reason</span>
          <textarea
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-accent/40"
            value={t.dispute_reason}
            placeholder={t.suggested_dispute_reason || 'Enter dispute reason…'}
            onChange={(e) => onChange({ dispute_reason: e.target.value })}
          />
        </label>
      )}

      {showTargets && onToggleBureau && onChange && (
        <fieldset className="mt-3 rounded-lg border border-brand-border p-3">
          <legend className="px-1 text-sm font-medium text-brand-text">Letter targets</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {(['EQF', 'EXP', 'TUC'] as BureauCode[]).map((b) => (
              <label key={b} className="flex items-center gap-2 text-brand-text">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={t.dispute_bureaus.includes(b)}
                  disabled={!t.bureaus.includes(b)}
                  onChange={(e) => onToggleBureau(b, e.target.checked)}
                />
                {BUREAU_LABELS[b]}
              </label>
            ))}
            <label className="flex items-center gap-2 text-brand-text">
              <input
                type="checkbox"
                className="accent-accent"
                checked={t.dispute_furnisher}
                onChange={(e) => onChange({ dispute_furnisher: e.target.checked })}
              />
              Furnisher
            </label>
          </div>
        </fieldset>
      )}
    </div>
  )
}
