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

  return (
    <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">{label}</div>
      <div className={`font-serif text-3xl font-extrabold ${colorMap[color] || 'text-brand-gold'}`}>{value}</div>
      {sub && <div className="text-xs text-brand-dim mt-1">{sub}</div>}
    </div>
  )
}
