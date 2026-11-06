'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import BrandLogo from '@/components/BrandLogo'

function PartnerTabLink({
  href,
  current,
  children,
}: {
  href: string
  current: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`flex-1 rounded-xl border px-4 py-3 text-center text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        current
          ? 'border-accent bg-accent-soft text-brand-text'
          : 'border-transparent text-brand-muted hover:bg-neutral-50 hover:text-brand-text'
      }`}
    >
      {children}
    </Link>
  )
}

export default function PartnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const onToolkit = pathname === '/partner/toolkit' || pathname.startsWith('/partner/toolkit/')

  return (
    <div className="min-h-screen bg-brand-bg-soft">
      <header className="partner-print-hide border-b border-brand-border bg-white print:hidden">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo height={32} href="/partner" />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-base font-semibold text-brand-muted hover:text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign out
          </button>
        </div>
        <nav aria-label="Partner" className="border-t border-brand-border bg-white">
          <div className="mx-auto flex max-w-[1100px] gap-2 px-4 py-2 sm:px-6">
            <PartnerTabLink href="/partner" current={!onToolkit}>
              Dashboard
            </PartnerTabLink>
            <PartnerTabLink href="/partner/toolkit" current={onToolkit}>
              Toolkit
            </PartnerTabLink>
          </div>
        </nav>
      </header>
      {children}
    </div>
  )
}
