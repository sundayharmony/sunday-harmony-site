'use client'

import Link from 'next/link'
import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput from '@/components/auth/AuthInput'
import { validatePassword } from '@/lib/auth-password'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const emailFromUrl = searchParams.get('email') || ''
  const [email, setEmail] = useState(emailFromUrl)

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl)
  }, [emailFromUrl])

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!code.trim()) {
      setError('Enter the 6-digit code from your email')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim().replace(/\s/g, ''),
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (success) {
    return (
      <AuthPageShell title="Password updated" subtitle="You're all set" backHref="/login" backLabel="← Back to login">
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <p className="text-sm text-brand-green font-semibold mb-2">Password Reset Successful</p>
            <p className="text-sm text-brand-muted">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block mt-6 px-6 py-3 rounded-xl bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
          >
            Sign In
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell title="Reset password" subtitle="Enter your code and new password" backHref="/login" backLabel="← Back to login">
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
          {error}
        </div>
      )}

      <p className="text-xs text-brand-muted mb-6">
        Use the 6-digit code from your email (valid for 15 minutes). Then choose a new password.
      </p>

      <form onSubmit={handleSubmit}>
        <AuthInput
          id="reset-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          required
        />
        <AuthInput
          id="reset-code"
          label="Verification code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          required
          className="tracking-widest"
        />
        <AuthInput
          id="reset-password-new"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters (A-Z, a-z, 0-9)"
          required
        />
        <AuthInput
          id="reset-password-confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
        >
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      <div className="text-center mt-6">
        <Link href="/forgot-password" className="text-xs text-brand-dim hover:text-accent transition-colors">
          Request a new code
        </Link>
      </div>
    </AuthPageShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 flex items-center justify-center text-sm text-brand-muted">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
