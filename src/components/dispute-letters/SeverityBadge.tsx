import type { RepairPriority } from '@/lib/dispute-letters/types'

const STYLES: Record<RepairPriority, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-900',
  low: 'bg-blue-100 text-blue-800',
  none: 'bg-green-100 text-green-800',
}

export function SeverityBadge({ priority }: { priority: RepairPriority }) {
  if (priority === 'none') return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[priority]}`}>
      {priority} priority
    </span>
  )
}
