'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', icon: '◈', label: 'Home' },
  { href: '/dashboard/performance', icon: '📊', label: 'Performance' },
  { href: '/dashboard/package', icon: '📦', label: 'My Package' },
  { href: '/dashboard/messages', icon: '💬', label: 'Messages' },
  { href: '/dashboard/billing', icon: '💳', label: 'Billing' },
]

export default function ClientSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-white border border-brand-border text-brand-text"
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {open ? (
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[49]" onClick={() => setOpen(false)} />
      )}

      <aside className={`w-[240px] min-h-screen bg-white border-r border-brand-border flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-5 pb-4 border-b border-brand-border">
          <Link href="/dashboard" className="font-serif text-lg font-extrabold text-brand-text">
            Sunday <span className="text-brand-gold">Harmony</span>
          </Link>
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-green mt-1">Client Dashboard</div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-[rgba(184,148,63,0.08)] border border-brand-gold text-brand-text'
                    : 'text-brand-muted hover:text-brand-text hover:bg-gray-50 border border-transparent'
                }`}>
                <span className="text-base">{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left text-xs text-brand-dim hover:text-brand-red transition-colors">
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
