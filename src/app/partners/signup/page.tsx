'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput, { AuthErrorAlert } from '@/components/auth/AuthInput'
import { PARTNER_PROFESSION_LABELS, PARTNER_PROFESSIONS } from '@/lib/partner-signup'

export default function PartnerSignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [yearsInField, setYearsInField] = useState('')
  const [profession, setProfession] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/partners/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone,
          companyName,
          serviceArea,
          yearsInField,
          profession,
          shHpField: honeypot,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Could not create the account.')
        setLoading(false)
        return
      }
      const signedIn = await signIn('credentials', { email, password, redirect: false })
      if (signedIn?.error) {
        window.location.assign('/login')
        return
      }
      window.location.assign('/partner')
    } catch {
      setError('Could not create the account.')
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      title="Partner signup"
      subtitle="For mortgage, auto, and real estate professionals who refer clients for credit repair."
      backHref="/login"
      backLabel="Already have an account? Sign in"
    >
      <form onSubmit={handleSubmit}>
        <div className="hidden" aria-hidden="true">
          <label htmlFor="partner-hp">Office fax</label>
          <input id="partner-hp" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
        </div>
        <AuthErrorAlert message={error} />
        <AuthInput id="partner-name" label="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <AuthInput id="partner-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <AuthInput id="partner-password" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <AuthInput id="partner-phone" label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <AuthInput id="partner-company" label="Company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        <AuthInput
          id="partner-area"
          label="Area you serve"
          value={serviceArea}
          onChange={(e) => setServiceArea(e.target.value)}
          placeholder="City, region, or market"
          required
        />
        <AuthInput
          id="partner-years"
          label="Years in your field"
          type="number"
          min={0}
          max={80}
          value={yearsInField}
          onChange={(e) => setYearsInField(e.target.value)}
          required
        />
        <div className="mb-5">
          <label htmlFor="partner-profession" className="block text-xs font-semibold text-brand-muted tracking-wide mb-1.5">
            Field
          </label>
          <select
            id="partner-profession"
            required
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-lg text-sm text-brand-text"
          >
            <option value="">Select one</option>
            {PARTNER_PROFESSIONS.map((value) => (
              <option key={value} value={value}>
                {PARTNER_PROFESSION_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 transition-all disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create partner account'}
        </button>
        <p className="mt-4 text-xs text-brand-dim text-center leading-relaxed">
          Your referral link stays off until Sunday Harmony approves the account.{' '}
          <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthPageShell>
  )
}
