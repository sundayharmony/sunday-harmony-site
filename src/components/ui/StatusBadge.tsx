const styles: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-[rgba(58,139,194,0.15)]', text: 'text-brand-blue' },
  contacted: { bg: 'bg-[rgba(201,169,110,0.15)]', text: 'text-brand-gold' },
  audit_sent: { bg: 'bg-[rgba(123,104,201,0.15)]', text: 'text-brand-purple' },
  proposal: { bg: 'bg-[rgba(201,169,110,0.2)]', text: 'text-brand-gold' },
  won: { bg: 'bg-[rgba(74,158,125,0.15)]', text: 'text-brand-green' },
  lost: { bg: 'bg-[rgba(212,86,78,0.15)]', text: 'text-brand-red' },
  active: { bg: 'bg-[rgba(74,158,125,0.15)]', text: 'text-brand-green' },
  paused: { bg: 'bg-[rgba(201,169,110,0.15)]', text: 'text-brand-gold' },
  churned: { bg: 'bg-[rgba(212,86,78,0.15)]', text: 'text-brand-red' },
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
