'use client'

import { FormEvent, useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput from '@/components/auth/AuthInput'

export default function MfaSetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }
    if (status !== 'authenticated' || !session?.user) return
    if (session.user.mfaVerified) {
      router.replace(session.user.role === 'credit_manager' ? '/admin/credit-funding' : '/admin')
      return
    }
    if (session.user.mfaPending && !session.user.mfaEnrollmentRequired) {
      router.replace('/login/mfa')
      return
    }

    void (async () => {
      try {
        const res = await fetch('/api/auth/mfa/setup', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not start setup')
        setSecret(data.secret)
        setQrDataUrl(data.qrDataUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start setup')
      } finally {
        setStarting(false)
      }
    })()
  }, [status, session, router])

  const finishWithMfaSignIn = async (totpCode: string) => {
    // After enable, challenge still on session — signIn mfa to upgrade JWT
    // Password re-auth not needed; challenge proves password step.
    // But totp_enabled just flipped — use challenge from session; mfa provider requires totp_enabled.
    const email = session?.user?.email
    let challenge = session?.mfaChallenge
    // Refresh session for new challenge after enrollment
    const sessRes = await fetch('/api/auth/session')
    const sess = await sessRes.json()
    challenge = sess?.mfaChallenge || challenge
    if (!email || !challenge) {
      router.replace('/login')
      return
    }
    const result = await signIn('mfa', { email, code: totpCode, challenge, redirect: false })
    if (result?.error) {
      // Enrollment succeeded; ask them to sign in again via verify page
      router.replace('/login')
      return
    }
    const role = sess?.user?.role || session?.user?.role
    router.push(role === 'credit_manager' ? '/admin/credit-funding' : '/admin')
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Confirmation failed')
      setBackupCodes(data.backupCodes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
      setLoading(false)
    }
  }

  const handleContinue = async () => {
    setLoading(true)
    await finishWithMfaSignIn(code)
  }

  if (status === 'loading' || starting) {
    return (
      <AuthPageShell title="Set up authenticator" subtitle="Loading…">
        <p className="text-sm text-brand-muted text-center">Please wait</p>
      </AuthPageShell>
    )
  }

  if (backupCodes) {
    return (
      <AuthPageShell
        title="Save backup codes"
        subtitle="Store these somewhere safe. Each code works once."
        backHref="/login"
        backLabel="← Sign in"
      >
        <ul className="mb-6 grid grid-cols-2 gap-2 font-mono text-sm">
          {backupCodes.map((c) => (
            <li key={c} className="bg-neutral-50 border border-brand-border rounded-lg px-3 py-2 text-center">
              {c}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
        >
          {loading ? 'Continuing…' : 'I saved my codes — continue'}
        </button>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="Set up two-factor authentication"
      subtitle="Scan the QR code with Google Authenticator, 1Password, or Authy"
      backHref="/login"
      backLabel="← Back to sign in"
    >
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
          {error}
        </div>
      )}
      {qrDataUrl && (
        <div className="flex flex-col items-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="MFA QR code" className="w-[220px] h-[220px]" />
          <p className="mt-3 text-[11px] text-brand-dim text-center break-all px-2">
            Manual key: <span className="font-mono text-brand-text">{secret}</span>
          </p>
        </div>
      )}
      <form onSubmit={handleConfirm}>
        <AuthInput
          id="mfa-setup-code"
          label="Enter code to confirm"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
        >
          {loading ? 'Enabling…' : 'Enable MFA'}
        </button>
      </form>
    </AuthPageShell>
  )
}
