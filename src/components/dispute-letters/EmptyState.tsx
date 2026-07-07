export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 p-8 text-center">
      <p className="font-semibold text-brand-text">{title}</p>
      <p className="mt-2 text-sm text-brand-dim">{message}</p>
    </div>
  )
}
