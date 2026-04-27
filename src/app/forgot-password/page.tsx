'use client'

import { useState, FormEvent } from 'react'

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
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <a href="/" className="font-serif text-3xl font-extrabold text-brand-text">
            Sunday <span className="text-brand-gold">Harmony</span>
          </a>
          <p className="text-sm text-brand-muted mt-2">Reset your password</p>
        </div>

        <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-brand-green text-xl">✓</span>
              </div>
              <p className="text-sm text-brand-text font-semibold mb-2">Check your email</p>
              <p className="text-xs text-brand-muted">
                If an account exists with <span className="text-brand-text">{email}</span>, we sent a password reset link. It expires in 1 hour.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
                  {error}
                </div>
              )}
              <p className="text-sm text-brand-muted mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label htmlFor="forgot-email" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    required
                    className="w-full py-3 px-4 bg-[#fafaf8] border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-brand-gold transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-brand-gold text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(184,148,63,0.25)] transition-all disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <a href="/login" className="text-xs text-brand-dim hover:text-brand-gold transition-colors">
            &larr; Back to login
          </a>
        </div>
      </div>
    </div>
  )
}
