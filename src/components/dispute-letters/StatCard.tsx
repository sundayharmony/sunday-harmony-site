export function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-brand-dim">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-brand-dim">{hint}</p>}
    </div>
  )
}
