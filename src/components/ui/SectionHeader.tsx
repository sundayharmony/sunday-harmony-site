import type { ReactNode } from 'react'

interface Props {
  label: string
  title: ReactNode
  description?: string
  className?: string
}

export default function SectionHeader({ label, title, description, className = '' }: Props) {
  return (
    <div className={className}>
      <div className="section-label">{label}</div>
      <h2 className="font-serif text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.12] text-brand-text mb-5">
        {title}
      </h2>
      {description && (
        <p className="text-[15px] text-brand-muted leading-relaxed max-w-[580px]">{description}</p>
      )}
    </div>
  )
}
