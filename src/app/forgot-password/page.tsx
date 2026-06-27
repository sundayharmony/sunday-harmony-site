'use client'

import Link from 'next/link'
import { useState, FormEvent } from 'react'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput from '@/components/auth/AuthInput'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <AuthPageShell title="Reset password" subtitle="We'll email you a 6-digit code" backHref="/login" backLabel="← Back to login">
      {sent ? (
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-brand-green text-xl">✓</span>
          </div>
          <p className="text-sm text-brand-text font-semibold mb-2">Check your email</p>
          <p className="text-xs text-brand-muted mb-4">
            If an account exists with <span className="text-brand-text">{email}</span>, we sent a{' '}
            <strong className="text-brand-text">6-digit code</strong>. It expires in{' '}
            <strong className="text-brand-text">15 minutes</strong>.
          </p>
          <Link
            href={`/reset-password?email=${encodeURIComponent(email)}`}
            className="inline-block w-full py-3 rounded-xl bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
          >
            Enter code &amp; new password
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
              {error}
            </div>
          )}
          <p className="text-sm text-brand-muted mb-6">
            Enter your email address and we&apos;ll send you a 6-digit code to reset your password.
          </p>
          <form onSubmit={handleSubmit}>
            <AuthInput
              id="forgot-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>
        </>
      )}
    </AuthPageShell>
  )
}
