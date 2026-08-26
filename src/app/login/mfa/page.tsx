'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput from '@/components/auth/AuthInput'

function MfaVerifyForm() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)

  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn())
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }
    if (status !== 'authenticated' || !session?.user) return
    if (session.user.mfaVerified) {
      if (session.user.role === 'admin') router.replace('/admin')
      else if (session.user.role === 'credit_manager') router.replace('/admin/credit-funding')
      else router.replace('/dashboard')
      return
    }
    if (session.user.mfaEnrollmentRequired) {
      router.replace('/login/mfa/setup')
    }
  }, [status, session, router])

  const leaveMfa = async (href: string) => {
    await signOut({ redirect: false })
    router.replace(href)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const email = session?.user?.email
    const challenge = session?.mfaChallenge
    if (!email || !challenge) {
      setError('Session expired. Sign in again.')
      setLoading(false)
      return
    }

    const result = await signIn('mfa', {
      email,
      code,
      challenge,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid authenticator or backup code. Password-reset emails use a different page.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/auth/session')
    const next = await res.json()
    const role = next?.user?.role
    if (role === 'admin') router.push('/admin')
    else if (role === 'credit_manager') router.push('/admin/credit-funding')
    else router.push('/dashboard')
  }

  const handlePasskeyMfa = async () => {
    setError('')
    setPasskeyLoading(true)

    const email = session?.user?.email
    const challenge = session?.mfaChallenge
    if (!email || !challenge) {
      setError('Session expired. Sign in again.')
      setPasskeyLoading(false)
      return
    }

    try {
      const optionsRes = await fetch('/api/auth/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!optionsRes.ok) {
        throw new Error('Failed to get passkey options')
      }

      const { options, challengeId } = await optionsRes.json()

      const assertion = await startAuthentication({ optionsJSON: options })

      const result = await signIn('passkey-mfa', {
        email,
        response: JSON.stringify(assertion),
        challengeId,
        challenge,
        redirect: false,
      })

      if (result?.error) {
        setError('Passkey verification failed')
        setPasskeyLoading(false)
        return
      }

      const res = await fetch('/api/auth/session')
      const next = await res.json()
      const role = next?.user?.role
      if (role === 'admin') router.push('/admin')
      else if (role === 'credit_manager') router.push('/admin/credit-funding')
      else router.push('/dashboard')
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey verification was cancelled')
      } else {
        setError('Passkey verification failed')
      }
      setPasskeyLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthPageShell title="Two-factor authentication" subtitle="Loading…">
        <p className="text-sm text-brand-muted text-center">Please wait</p>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app">
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
          {error}
        </div>
      )}

      {passkeySupported && session?.user?.passkeyEnabled && (
        <>
          <button
            type="button"
            onClick={handlePasskeyMfa}
            disabled={passkeyLoading || loading}
            className="w-full py-3.5 rounded-xl bg-white border-2 border-brand-border text-brand-text text-sm font-bold tracking-wide hover:border-accent hover:bg-accent-soft transition-all disabled:opacity-60 flex items-center justify-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z" />
              <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M18 8v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" />
              <path d="M6 8a6 6 0 0 1 12 0" />
            </svg>
            {passkeyLoading ? 'Verifying…' : 'Use passkey instead'}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-brand-dim">or use authenticator</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <AuthInput
          id="mfa-code"
          label="Authenticator code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          required
        />
        <p className="text-[11px] text-brand-dim mb-4 -mt-2">
          Use your authenticator app or a backup code — not the code from a password-reset email.
        </p>
        <button
          type="submit"
          disabled={loading || passkeyLoading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <div className="mt-6 space-y-3 text-center">
        <button
          type="button"
          onClick={() => leaveMfa('/login')}
          className="text-xs text-brand-dim hover:text-accent transition-colors"
        >
          ← Back to sign in
        </button>
        <p className="text-[11px] text-brand-dim">
          Need a new password?{' '}
          <button
            type="button"
            onClick={() => leaveMfa('/forgot-password')}
            className="text-accent hover:underline"
          >
            Reset password
          </button>
          {' '}(emailed codes go there, not here).
        </p>
        <p className="text-[11px] text-brand-dim">
          Already have a reset code?{' '}
          <button
            type="button"
            onClick={() =>
              leaveMfa(
                session?.user?.email
                  ? `/reset-password?email=${encodeURIComponent(session.user.email)}`
                  : '/reset-password'
              )
            }
            className="text-accent hover:underline"
          >
            Enter it here
          </button>
          .
        </p>
      </div>
    </AuthPageShell>
  )
}

export default function MfaVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
          <p className="text-sm text-brand-muted">Loading...</p>
        </div>
      }
    >
      <MfaVerifyForm />
    </Suspense>
  )
}
