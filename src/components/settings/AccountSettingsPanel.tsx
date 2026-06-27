'use client'

import { useEffect, useState } from 'react'
import { validatePassword } from '@/lib/auth-password'

interface UserSettings {
  id: string
  name: string
  email: string
}

interface Props {
  title?: string
  description?: string
}

export default function AccountSettingsPanel({
  title = 'Account Settings',
  description = 'Manage your account credentials.',
}: Props) {
  const [user, setUser] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/dashboard/settings')
        if (!res.ok) throw new Error('Failed to fetch settings')
        setUser(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields')
      return
    }

    const validationError = validatePassword(newPassword)
    if (validationError) {
      setPasswordError(validationError)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to change password')
      }
      setPasswordSuccess('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 5000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-muted">Loading settings…</p>
  }

  if (error) {
    return <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">{title}</h1>
      <p className="text-sm text-brand-muted mb-8">{description}</p>

      <div className="bg-white border border-brand-border rounded-xl p-6 mb-8">
        <h2 className="text-lg font-bold text-brand-text mb-4">Profile</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-brand-dim">Name</dt>
            <dd className="text-brand-text font-medium">{user?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-brand-dim">Email</dt>
            <dd className="text-brand-text font-medium">{user?.email || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-brand-text mb-4">Change Password</h2>
        {passwordError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{passwordError}</div>
        )}
        {passwordSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {passwordSuccess}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-brand-muted mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="px-6 py-3 rounded-lg bg-brand-text text-white text-sm font-semibold disabled:opacity-60"
          >
            {changingPassword ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
