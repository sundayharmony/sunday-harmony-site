'use client'

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

  return (
    <aside className="w-[240px] min-h-screen bg-[rgba(255,255,255,0.02)] border-r border-[rgba(255,255,255,0.06)] flex flex-col fixed left-0 top-0 bottom-0 z-50">
      <div className="p-5 pb-4 border-b border-[rgba(255,255,255,0.06)]">
        <Link href="/dashboard" className="font-serif text-lg font-extrabold text-brand-text">
          Sunday <span className="text-brand-gold">Harmony</span>
        </Link>
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-green mt-1">Client Dashboard</div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-[13px] font-medium transition-all ${
                active
                  ? 'bg-[rgba(74,158,125,0.1)] border border-[rgba(74,158,125,0.2)] text-brand-green'
                  : 'text-brand-muted hover:text-brand-text hover:bg-[rgba(255,255,255,0.03)] border border-transparent'
              }`}>
              <span className="text-base">{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-[rgba(255,255,255,0.06)]">
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left text-xs text-brand-dim hover:text-brand-red transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  )
}
