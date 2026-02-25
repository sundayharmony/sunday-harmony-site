'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/admin', icon: '◈', label: 'Overview' },
  { href: '/admin/leads', icon: '📥', label: 'Leads' },
  { href: '/admin/clients', icon: '👥', label: 'Clients' },
  { href: '/admin/messages', icon: '💬', label: 'Messages' },
  { href: '/admin/revenue', icon: '💰', label: 'Revenue' },
  { href: '/admin/research', icon: '📊', label: 'Market Research' },
  { href: '/admin/competitors', icon: '⚔️', label: 'Competitors' },
  { href: '/admin/packages', icon: '📦', label: 'Packages' },
  { href: '/admin/roadmap', icon: '🗺️', label: '90-Day Roadmap' },
  { href: '/admin/outreach', icon: '📨', label: 'Outreach' },
  { href: '/admin/discovery', icon: '🎯', label: 'Discovery' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-brand-text"
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

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[49]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-[240px] min-h-screen bg-[#0c0c14] border-r border-[rgba(255,255,255,0.06)] flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="p-5 pb-4 border-b border-[rgba(255,255,255,0.06)]">
          <Link href="/admin" className="font-serif text-lg font-extrabold text-brand-text">
            Sunday <span className="text-brand-gold">Harmony</span>
          </Link>
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-gold mt-1">Admin Dashboard</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-[rgba(201,169,110,0.1)] border border-[rgba(201,169,110,0.2)] text-brand-gold'
                    : 'text-brand-muted hover:text-brand-text hover:bg-[rgba(255,255,255,0.03)] border border-transparent'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.06)]">
          <Link href="/" className="block text-xs text-brand-dim hover:text-brand-gold mb-3 transition-colors">
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
