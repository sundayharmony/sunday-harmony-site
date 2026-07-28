'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import BrandLogo from '@/components/BrandLogo'

const allNavItems = [
  { href: '/admin', icon: '\u{1F4CA}', label: 'Overview' },
  { href: '/admin/crm', icon: '\u{1F4CB}', label: 'CRM' },
  { href: '/admin/leads', icon: '\u{1F525}', label: 'Leads' },
  { href: '/admin/credit-funding', icon: '\u{1F4B3}', label: 'Credit Intelligence' },
  { href: '/admin/clients', icon: '\u{1F465}', label: 'Clients' },
  { href: '/admin/case-studies', icon: '\u{1F4C4}', label: 'Case Studies' },
  { href: '/admin/marketing-graphics', icon: '\u{1F3A8}', label: 'Marketing Graphics' },
  { href: '/admin/billing', icon: '\u{1F4B3}', label: 'Billing' },
  { href: '/admin/messages', icon: '\u{1F4AC}', label: 'Messages' },
  { href: '/admin/team-messages', icon: '\u{1F91D}', label: 'Team Chat' },
  { href: '/admin/tasks', icon: '\u2705', label: 'Tasks' },
  { href: '/admin/files', icon: '\u{1F4C1}', label: 'Files' },
  { href: '/admin/approvals', icon: '\u{1F44D}', label: 'Approvals' },
  { href: '/admin/revenue', icon: '\u{1F4B0}', label: 'Revenue' },
  { href: '/admin/research', icon: '\u{1F50D}', label: 'Market Research' },
  { href: '/admin/competitors', icon: '\u2694\uFE0F', label: 'Competitors' },
  { href: '/admin/packages', icon: '\u{1F4E6}', label: 'Packages' },
  { href: '/admin/roadmap', icon: '\u{1F5FA}\uFE0F', label: '90-Day Roadmap' },
  { href: '/admin/outreach', icon: '\u{1F4E8}', label: 'Outreach' },
  { href: '/admin/discovery', icon: '\u{1F3AF}', label: 'Discovery' },
  { href: '/admin/settings', icon: '\u2699\uFE0F', label: 'Settings' },
]

const creditManagerHrefs = new Set([
  '/admin/credit-funding',
  '/admin/team-messages',
  '/admin/settings',
])

interface AdminSidebarProps {
  collapsed?: boolean
  onToggleSidebar?: () => void
  hydrated?: boolean
}

export default function AdminSidebar({
  collapsed = false,
  onToggleSidebar,
  hydrated = true,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession()
  const role = session?.user?.role
  const isCreditManager = role === 'credit_manager'

  const navItems = isCreditManager
    ? allNavItems.filter((item) => creditManagerHrefs.has(item.href))
    : allNavItems

  const dashboardLabel = isCreditManager ? 'Credit Manager' : 'Admin Dashboard'
  const logoHref = isCreditManager ? '/admin/credit-funding' : '/admin'

  const desktopHidden = hydrated && collapsed

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-gray-50 border border-brand-border text-brand-text"
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {mobileOpen ? (
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {desktopHidden && onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex fixed left-4 top-4 z-[60] items-center gap-2 px-3 py-2 rounded-lg bg-white border border-brand-border text-brand-text text-xs font-semibold shadow-sm hover:bg-neutral-50 transition-colors"
          aria-label="Show admin navigation"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Menu
        </button>
      )}

      {mobileOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 bg-black/50 z-[49] cursor-default border-0 p-0"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`w-[240px] min-h-screen bg-white border-r border-brand-border flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${desktopHidden ? 'md:-translate-x-full' : 'md:translate-x-0'}`}
      >
        <div className="p-5 pb-4 border-b border-brand-border flex items-start justify-between gap-2">
          <div className="min-w-0">
            <BrandLogo href={logoHref} height={32} />
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-dim mt-1">
              {dashboardLabel}
            </div>
          </div>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden md:flex shrink-0 p-1.5 rounded-md text-brand-dim hover:text-brand-text hover:bg-neutral-100 transition-colors"
              aria-label="Hide admin navigation"
              title="Hide navigation"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M7 5L3 10L7 15M13 5L17 10L13 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-accent-soft border border-brand-border text-brand-text'
                    : 'text-brand-muted hover:text-brand-text hover:bg-neutral-50 border border-transparent'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <Link
            href="/"
            className="block text-xs text-brand-dim hover:text-brand-text mb-3 transition-colors"
          >
            ← View website
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left text-xs text-brand-dim hover:text-brand-red transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
