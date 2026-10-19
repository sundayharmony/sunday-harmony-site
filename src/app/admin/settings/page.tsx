'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AccountSettingsPanel from '@/components/settings/AccountSettingsPanel'
import CreditExpertsPanel from '@/components/credit-funding/CreditExpertsPanel'
import StaffMfaPanel from '@/components/settings/StaffMfaPanel'
import PasskeyPanel from '@/components/settings/PasskeyPanel'

export default function AdminSettingsPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isStaff, setIsStaff] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        const role = data?.user?.role
        setIsAdmin(role === 'admin')
        setIsStaff(role === 'admin' || role === 'credit_manager')
      }
    })()
  }, [])

  return (
    <div>
      <AccountSettingsPanel title="Settings" description="Manage your account and security" />
      {isStaff && (
        <>
          <StaffMfaPanel />
          <PasskeyPanel />
        </>
      )}
      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-brand-border space-y-8">
          <div>
            <h2 className="text-sm font-bold text-brand-text mb-3">Reference</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { href: '/admin/consultations', label: 'Booking hours', detail: 'What visitors see on the booking page' },
                { href: '/admin/clients', label: 'Client editor', detail: 'Deliverables, notes, and delete' },
                { href: '/admin/research', label: 'Market research', detail: 'Notes and sources' },
                { href: '/admin/packages', label: 'Packages', detail: 'Catalog of plans' },
                { href: '/admin/roadmap', label: '90-day roadmap', detail: 'Launch plan' },
                { href: '/admin/training', label: 'Sales training', detail: 'Internal guide' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg border border-brand-border bg-white px-3 py-3 hover:border-accent"
                >
                  <div className="text-sm font-medium text-brand-text">{item.label}</div>
                  <div className="text-xs text-brand-muted">{item.detail}</div>
                </Link>
              ))}
            </div>
          </div>
          <CreditExpertsPanel defaultExpanded />
        </div>
      )}
    </div>
  )
}
