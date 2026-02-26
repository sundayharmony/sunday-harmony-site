'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
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
        body: JSON.stringify({ token, password }),
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

  if (!token) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="font-serif text-3xl font-extrabold text-brand-text mb-4">
          Sunday <span className="text-brand-gold">Harmony</span>
        </div>
        <div className="bg-[rgba(212,86,78,0.1)] border border-[rgba(212,86,78,0.2)] rounded-xl p-6">
          <p className="text-sm text-brand-red">Invalid reset link. Please request a new password reset.</p>
        </div>
        <a href="/login" className="inline-block mt-6 text-xs text-brand-dim hover:text-brand-gold transition-colors">
          &larr; Back to login
        </a>
      </div>
    )
  }

  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="font-serif text-3xl font-extrabold text-brand-text mb-4">
          Sunday <span className="text-brand-gold">Harmony</span>
        </div>
        <div className="bg-[rgba(74,158,125,0.1)] border border-[rgba(74,158,125,0.2)] rounded-xl p-6">
          <p className="text-sm text-brand-green font-semibold mb-2">Password Reset Successful</p>
          <p className="text-sm text-brand-muted">Your password has been updated. You can now sign in with your new password.</p>
        </div>
        <a href="/login" className="inline-block mt-6 px-6 py-3 rounded-xl bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-bold hover:-translate-y-0.5 transition-all">
          Sign In
        </a>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-10">
        <a href="/" className="font-serif text-3xl font-extrabold text-brand-text">
          Sunday <span className="text-brand-gold">Harmony</span>
        </a>
        <p className="text-sm text-brand-muted mt-2">Set your new password</p>
      </div>

      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-[rgba(212,86,78,0.1)] border border-[rgba(212,86,78,0.2)] text-sm text-brand-red">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              className="w-full py-3 px-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)] transition-colors"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full py-3 px-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(201,169,110,0.25)] transition-all disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>

      <div className="text-center mt-6">
        <a href="/login" className="text-xs text-brand-dim hover:text-brand-gold transition-colors">
          &larr; Back to login
        </a>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-sm text-brand-muted">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
