'use client'

import Link from 'next/link'
import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

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
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number')
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
      <div className="w-full max-w-md text-center">
        <div className="font-serif text-3xl font-extrabold text-brand-text mb-4">
          Sunday <span className="text-accent">Harmony</span>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <p className="text-sm text-brand-green font-semibold mb-2">Password Reset Successful</p>
          <p className="text-sm text-brand-muted">Your password has been updated. You can now sign in with your new password.</p>
        </div>
        <Link href="/login" className="inline-block mt-6 px-6 py-3 rounded-xl bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all">
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-10">
        <Link href="/" className="font-serif text-3xl font-extrabold text-brand-text">
          Sunday <span className="text-accent">Harmony</span>
        </Link>
        <p className="text-sm text-brand-muted mt-2">Enter your code and new password</p>
      </div>

      <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
            {error}
          </div>
        )}

        <p className="text-xs text-brand-muted mb-6">
          Use the 6-digit code from your email (valid for 15 minutes). Then choose a new password.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="reset-email" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Email</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              required
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="mb-5">
            <label htmlFor="reset-code" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Verification code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              required
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-xl text-brand-text text-sm tracking-widest outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="mb-5">
            <label htmlFor="reset-password-new" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">New password</label>
            <input
              id="reset-password-new"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters (A-Z, a-z, 0-9)"
              required
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="reset-password-confirm" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Confirm password</label>
            <input
              id="reset-password-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>

      <div className="text-center mt-6 space-y-2">
        <Link href="/forgot-password" className="block text-xs text-brand-dim hover:text-accent transition-colors">
          Request a new code
        </Link>
        <Link href="/login" className="block text-xs text-brand-dim hover:text-accent transition-colors">
          &larr; Back to login
        </Link>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-sm text-brand-muted">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
