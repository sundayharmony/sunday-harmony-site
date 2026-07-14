'use client'

import { useState, useEffect } from 'react'
import AccountSettingsPanel from '@/components/settings/AccountSettingsPanel'
import CreditExpertsPanel from '@/components/credit-funding/CreditExpertsPanel'
import StaffMfaPanel from '@/components/settings/StaffMfaPanel'

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
      {isStaff && <StaffMfaPanel />}
      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-brand-border">
          <CreditExpertsPanel defaultExpanded />
        </div>
      )}
    </div>
  )
}
