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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <a href="/" className="font-serif text-3xl font-extrabold text-brand-text">
            Sunday <span className="text-brand-gold">Harmony</span>
          </a>
          <p className="text-sm text-brand-muted mt-2">Reset your password</p>
        </div>

        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[rgba(74,158,125,0.15)] flex items-center justify-center mx-auto mb-4">
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
                <div className="mb-6 p-3 rounded-lg bg-[rgba(212,86,78,0.1)] border border-[rgba(212,86,78,0.2)] text-sm text-brand-red">
                  {error}
                </div>
              )}
              <p className="text-sm text-brand-muted mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    required
                    className="w-full py-3 px-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(201,169,110,0.25)] transition-all disabled:opacity-60"
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
