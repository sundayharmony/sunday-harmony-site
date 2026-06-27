import type { ReactNode } from 'react'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

interface Props {
  title: string
  subtitle?: string
  children: ReactNode
  backHref?: string
  backLabel?: string
}

export default function AuthPageShell({ title, subtitle, children, backHref = '/', backLabel = '← Back to website' }: Props) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <BrandLogo height={40} href="/" />
        </div>
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-8">
          <h1 className="text-2xl font-extrabold text-brand-text mb-2 text-center">{title}</h1>
          {subtitle && <p className="text-sm text-brand-muted text-center mb-6">{subtitle}</p>}
          {children}
        </div>
        <div className="text-center mt-6">
          <Link href={backHref} className="text-xs text-brand-dim hover:text-accent transition-colors">
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
