'use client'

import type { ActivityLog } from '@/lib/db'

const ACTION_LABELS: Record<string, string> = {
  lead_created: 'Lead Created',
  created: 'Created',
  application_submitted: 'Application Submitted',
  submitted: 'Application Submitted',
  documents_uploaded: 'Documents Uploaded',
  status_changed: 'Status Changed',
  updated: 'Updated',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_completed: 'Meeting Completed',
  notes_added: 'Notes Added',
  funding_recommendations_added: 'Funding Recommendations Added',
  viewed: 'Viewed',
  deleted: 'Deleted',
}

export default function ActivityTimeline({ items }: { items: ActivityLog[] }) {
  if (!items.length) {
    return <p className="text-sm text-brand-dim py-4">No activity yet.</p>
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-3 pb-4 relative">
          {i < items.length - 1 && (
            <span className="absolute left-[7px] top-4 bottom-0 w-px bg-brand-border" aria-hidden />
          )}
          <span className="w-4 h-4 rounded-full bg-accent-soft border border-accent shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-brand-text">
              {ACTION_LABELS[item.action] || item.action.replace(/_/g, ' ')}
            </div>
            {item.details && (
              <div className="text-xs text-brand-muted mt-0.5">{item.details}</div>
            )}
            <div className="text-[10px] text-brand-dim mt-1">
              {new Date(item.created_at).toLocaleString()} · {item.actor_email}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
