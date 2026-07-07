export function ProgressPanel({ status }: { status: string }) {
  return (
    <div className="mt-4 rounded-xl border border-brand-border bg-accent-soft/30 p-4">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm font-medium text-brand-text">{status}</p>
      </div>
    </div>
  )
}
