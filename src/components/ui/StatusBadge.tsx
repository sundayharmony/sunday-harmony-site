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
  submitted: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border border-yellow-200' },
  under_review: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border border-blue-200' },
  approved: { bg: 'bg-green-50', text: 'text-green-800', border: 'border border-green-200' },
  denied: { bg: 'bg-red-50', text: 'text-brand-red', border: 'border border-red-100' },
  archived: { bg: 'bg-neutral-50', text: 'text-brand-muted', border: 'border border-neutral-200' },
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
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  denied: 'Denied',
  archived: 'Archived',
}

export default function StatusBadge({ status }: { status: string }) {
  const s = styles[status] || styles.new
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-[0.08em] uppercase ${s.bg} ${s.text} ${s.border}`}>
      {labels[status] || status}
    </span>
  )
}
