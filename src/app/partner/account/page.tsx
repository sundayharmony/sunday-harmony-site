'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import AuthInput, { AuthErrorAlert } from '@/components/auth/AuthInput'
import { PARTNER_PROFESSION_LABELS, PARTNER_PROFESSIONS } from '@/lib/partner-signup'

type AccountProfile = {
  name: string
  email: string
  phone: string
  companyName: string
  serviceArea: string
  professionValue: string
  yearsInField: number
}

export default function PartnerAccountPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [yearsInField, setYearsInField] = useState('')
  const [profession, setProfession] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const applyProfile = useCallback((next: AccountProfile) => {
    setProfile(next)
    setFullName(next.name)
    setPhone(next.phone)
    setCompanyName(next.companyName)
    setServiceArea(next.serviceArea)
    setYearsInField(String(next.yearsInField))
    setProfession(next.professionValue)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/partner')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.profile) {
        setError(payload.error || 'Unable to load your account.')
        return
      }
      applyProfile(payload.profile)
      setError('')
    } catch {
      setError('Unable to load your account.')
    } finally {
      setLoading(false)
    }
  }, [applyProfile])

  useEffect(() => {
    void load()
  }, [load])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNote('')
    setSavingProfile(true)
    try {
      const res = await fetch('/api/partner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'profile',
          fullName,
          phone,
          companyName,
          serviceArea,
          yearsInField,
          profession,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Could not save your account.')
        return
      }
      if (payload.profile) applyProfile(payload.profile)
      setNote('Account details saved.')
    } catch {
      setError('Could not save your account.')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNote('')
    setSavingPassword(true)
    try {
      const res = await fetch('/api/partner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password',
          currentPassword,
          newPassword,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Could not update your password.')
        return
      }
      await signOut({ callbackUrl: '/login' })
    } catch {
      setError('Could not update your password.')
      setSavingPassword(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1100px] min-w-0 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Account</h1>
      <p className="text-sm text-brand-muted mb-6">
        Update the details on your partner dashboard. Email stays the sign-in address.
      </p>
      {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}
      <AuthErrorAlert message={error} />
      {note ? <p className="mb-4 text-sm text-brand-text">{note}</p> : null}
      {profile ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="rounded-xl border border-brand-border bg-white p-5">
            <h2 className="text-sm font-bold text-brand-text mb-4">Company details</h2>
            <AuthInput id="partner-account-name" label="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <AuthInput id="partner-account-email" label="Email" value={profile.email} readOnly />
            <AuthInput id="partner-account-phone" label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <AuthInput id="partner-account-company" label="Company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            <AuthInput
              id="partner-account-area"
              label="Area you serve"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              required
            />
            <AuthInput
              id="partner-account-years"
              label="Years in your field"
              type="number"
              min={0}
              max={80}
              value={yearsInField}
              onChange={(e) => setYearsInField(e.target.value)}
              required
            />
            <div className="mb-5">
              <label htmlFor="partner-account-profession" className="block text-xs font-semibold text-brand-muted tracking-wide mb-1.5">
                Field
              </label>
              <select
                id="partner-account-profession"
                required
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-lg text-sm text-brand-text"
              >
                {PARTNER_PROFESSIONS.map((value) => (
                  <option key={value} value={value}>
                    {PARTNER_PROFESSION_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide disabled:opacity-60"
            >
              {savingProfile ? 'Saving…' : 'Save details'}
            </button>
          </form>
          <form onSubmit={savePassword} className="rounded-xl border border-brand-border bg-white p-5">
            <h2 className="text-sm font-bold text-brand-text mb-4">Password</h2>
            <AuthInput
              id="partner-current-password"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <AuthInput
              id="partner-new-password"
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="mb-4 text-xs text-brand-dim">
              Changing your password signs you out. You can also use{' '}
              <Link href="/forgot-password" className="text-accent hover:underline">
                forgot password
              </Link>
              .
            </p>
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full py-3.5 rounded-xl border border-brand-border bg-white text-sm font-bold text-brand-text tracking-wide disabled:opacity-60"
            >
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  )
}
