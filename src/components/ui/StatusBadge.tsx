const styles: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: 'bg-neutral-100', text: 'text-brand-text', border: 'border border-neutral-200' },
  contacted: { bg: 'bg-neutral-100', text: 'text-brand-text', border: 'border border-neutral-200' },
  audit_sent: { bg: 'bg-neutral-100', text: 'text-brand-text', border: 'border border-neutral-200' },
  proposal: { bg: 'bg-neutral-100', text: 'text-brand-text', border: 'border border-neutral-200' },
  won: { bg: 'bg-neutral-100', text: 'text-brand-text', border: 'border border-neutral-300' },
  lost: { bg: 'bg-red-50', text: 'text-brand-red', border: 'border border-red-100' },
  active: { bg: 'bg-neutral-100', text: 'text-brand-text', border: 'border border-neutral-300' },
  paused: { bg: 'bg-neutral-50', text: 'text-brand-muted', border: 'border border-neutral-200' },
  churned: { bg: 'bg-red-50', text: 'text-brand-red', border: 'border border-red-100' },
}

const labels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  audit_sent: 'Audit Sent',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
  active: 'Active',
  paused: 'Paused',
  churned: 'Churned',
}

export default function StatusBadge({ status }: { status: string }) {
  const s = styles[status] || styles.new
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-[0.08em] uppercase ${s.bg} ${s.text} ${s.border}`}>
      {labels[status] || status}
    </span>
  )
}
