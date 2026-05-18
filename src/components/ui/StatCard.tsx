interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export default function StatCard({ label, value, sub, color = 'default' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    default: 'text-brand-text',
    gold: 'text-accent',
    accent: 'text-accent',
    green: 'text-brand-text',
    blue: 'text-brand-text',
    purple: 'text-brand-text',
    red: 'text-brand-red',
  }

  const isHex = color.startsWith('#')
  const textClass = isHex ? '' : (colorMap[color] || 'text-brand-text')

  return (
    <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">{label}</div>
      <div
        className={`text-2xl font-bold ${textClass}`}
        style={isHex ? { color } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-brand-muted mt-1">{sub}</div>}
    </div>
  )
}
