'use client'

import StatusBadge from '@/components/ui/StatusBadge'
import { LEAD_TYPE_LABELS, type LeadType } from '@/lib/crm-types'
import type { ContactProfileSummary } from '@/lib/crm-db'

export default function ContactProfileHeader({ profile }: { profile: ContactProfileSummary }) {
  const leadTypeLabel = LEAD_TYPE_LABELS[profile.lead_type as LeadType] || profile.lead_type

  return (
    <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm mb-6">
      <div className="flex flex-wrap justify-between gap-4 mb-4">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-brand-text">{profile.name}</h1>
          <p className="text-sm text-brand-muted">{profile.business}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-[0.08em] uppercase bg-accent-soft text-accent border border-accent">
            {leadTypeLabel}
          </span>
          <StatusBadge status={profile.current_status} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[
          ['Credit Repair', profile.credit_repair_program],
          ['Funding Program', profile.funding_program],
          ['Assigned To', profile.assigned_team_member],
          ['Next Meeting', profile.next_meeting
            ? new Date(profile.next_meeting.scheduled_at).toLocaleString()
            : null],
          ['Funding Goal', profile.funding_goal],
          ['Est. Funding Potential', profile.estimated_funding_potential],
          ['Email', profile.email],
          ['Phone', profile.phone],
          ['Source', profile.source?.toUpperCase()],
        ].map(([label, val]) =>
          val ? (
            <div key={label as string}>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-0.5">{label}</div>
              <div className="text-brand-text">{val}</div>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
