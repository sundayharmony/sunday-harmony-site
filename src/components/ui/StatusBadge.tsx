const styles: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-blue-50', text: 'text-brand-blue' },
  contacted: { bg: 'bg-amber-50', text: 'text-brand-gold' },
  audit_sent: { bg: 'bg-purple-50', text: 'text-brand-purple' },
  proposal: { bg: 'bg-amber-50', text: 'text-brand-gold' },
  won: { bg: 'bg-green-50', text: 'text-brand-green' },
  lost: { bg: 'bg-red-50', text: 'text-brand-red' },
  active: { bg: 'bg-green-50', text: 'text-brand-green' },
  paused: { bg: 'bg-amber-50', text: 'text-brand-gold' },
  churned: { bg: 'bg-red-50', text: 'text-brand-red' },
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
    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-[0.08em] uppercase ${s.bg} ${s.text}`}>
      {labels[status] || status}
    </span>
  )
}
