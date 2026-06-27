'use client'

import { useState, useEffect } from 'react'
import AccountSettingsPanel from '@/components/settings/AccountSettingsPanel'
import { validatePassword } from '@/lib/auth-password'

interface StaffUser {
  id: string
  name: string
  email: string
  role: string
}

function CreditManagerProvisioning() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/staff-users')
      if (res.ok) setStaff(await res.json())
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/staff-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create account')
      setStaff((prev) => [...prev, data])
      setSuccess(`Credit manager account created for ${data.email}`)
      setName('')
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-brand-border">
      <h2 className="font-serif text-xl font-bold text-brand-text mb-1">Credit Manager Access</h2>
      <p className="text-sm text-brand-muted mb-4">
        Create accounts with access to the Credit &amp; Funding panel and team chat only.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-semibold text-brand-dim mb-1">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-dim mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-dim mb-1">Initial password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
          />
          <p className="text-[11px] text-brand-dim mt-1">Share this password securely — it is not emailed.</p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-brand-text text-white text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create credit manager'}
        </button>
      </form>

      {staff.filter((s) => s.role === 'credit_manager').length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-brand-dim mb-2">Active credit managers</h3>
          <ul className="text-sm space-y-1">
            {staff
              .filter((s) => s.role === 'credit_manager')
              .map((s) => (
                <li key={s.id} className="text-brand-text">
                  {s.name} — {s.email}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

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
      {isAdmin && <CreditManagerProvisioning />}
    </div>
  )
}
