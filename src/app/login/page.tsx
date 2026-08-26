'use client'

import Link from 'next/link'
import { useState, FormEvent, Suspense, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput from '@/components/auth/AuthInput'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn())
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      try {
        const res = await fetch('/api/auth/session')
        const session = await res.json()
        const role = session?.user?.role
        const mfaVerified = session?.user?.mfaVerified
        const mfaEnrollmentRequired = session?.user?.mfaEnrollmentRequired

        if ((role === 'admin' || role === 'credit_manager') && !mfaVerified) {
          router.push(mfaEnrollmentRequired ? '/login/mfa/setup' : '/login/mfa')
          return
        }

        if (role === 'admin') {
          router.push('/admin')
        } else if (role === 'credit_manager') {
          router.push('/admin/credit-funding')
        } else if (role === 'client') {
          router.push('/dashboard')
        } else {
          router.push(callbackUrl)
        }
      } catch {
        router.push(callbackUrl)
      }
    }
  }

  const handlePasskeyLogin = async () => {
    setError('')
    setPasskeyLoading(true)

    try {
      const optionsRes = await fetch('/api/auth/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined }),
      })

      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        throw new Error(data.error || 'Failed to start passkey login')
      }

      const { options, challengeId } = await optionsRes.json()

      const assertion = await startAuthentication({ optionsJSON: options })

      const result = await signIn('passkey', {
        response: JSON.stringify(assertion),
        challengeId,
        redirect: false,
      })

      if (result?.error) {
        setError('Passkey authentication failed')
        setPasskeyLoading(false)
        return
      }

      const res = await fetch('/api/auth/session')
      const session = await res.json()
      const role = session?.user?.role

      if (role === 'admin') {
        router.push('/admin')
      } else if (role === 'credit_manager') {
        router.push('/admin/credit-funding')
      } else {
        router.push(callbackUrl)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled')
      } else {
        setError(err instanceof Error ? err.message : 'Passkey authentication failed')
      }
      setPasskeyLoading(false)
    }
  }

  return (
    <AuthPageShell title="Sign in" subtitle="Access your dashboard">
      {(error || searchParams.get('error')) && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
          {error || 'You do not have permission to access that page.'}
        </div>
      )}

      {passkeySupported && (
        <>
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading || loading}
            className="w-full py-3.5 rounded-xl bg-white border-2 border-brand-border text-brand-text text-sm font-bold tracking-wide hover:border-accent hover:bg-accent-soft transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z" />
              <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M18 8v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" />
              <path d="M6 8a6 6 0 0 1 12 0" />
            </svg>
            {passkeyLoading ? 'Authenticating...' : 'Sign in with passkey'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-brand-dim">or use email & password</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <AuthInput
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          required
        />
        <AuthInput
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          labelExtra={
            <Link href="/forgot-password" className="text-[10px] text-accent hover:underline">
              Forgot password?
            </Link>
          }
        />
        <button
          type="submit"
          disabled={loading || passkeyLoading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
          <p className="text-sm text-brand-muted">Loading...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
