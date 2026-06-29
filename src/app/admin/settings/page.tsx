'use client'

import { useState, useEffect } from 'react'
import AccountSettingsPanel from '@/components/settings/AccountSettingsPanel'
import CreditExpertsPanel from '@/components/credit-funding/CreditExpertsPanel'

export default function AdminSettingsPage() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        setIsAdmin(data?.user?.role === 'admin')
      }
    })()
  }, [])

  return (
    <div>
      <AccountSettingsPanel title="Settings" description="Manage your account and security" />
      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-brand-border">
          <CreditExpertsPanel defaultExpanded />
        </div>
      )}
    </div>
  )
}
