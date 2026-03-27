interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export default function StatCard({ label, value, sub, color = 'gold' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    gold: 'text-brand-gold',
    green: 'text-brand-green',
    blue: 'text-brand-blue',
    purple: 'text-brand-purple',
    red: 'text-brand-red',
  }

  // Support both named colors (e.g. 'gold') and hex values (e.g. '#3a8bc2')
  const isHex = color.startsWith('#')
  const textClass = isHex ? '' : (colorMap[color] || 'text-brand-gold')

  return (
    <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">{label}</div>
      <div
        className={`font-serif text-2xl sm:text-3xl font-extrabold ${textClass}`}
        style={isHex ? { color } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-brand-dim mt-1">{sub}</div>}
    </div>
  )
}
