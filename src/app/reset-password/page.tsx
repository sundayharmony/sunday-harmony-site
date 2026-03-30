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

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number')
      setLoading(false)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      setLoading(false)
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <p className="text-sm text-brand-green font-semibold mb-2">Password Reset Successful</p>
          <p className="text-sm text-brand-muted">Your password has been updated. You can now sign in with your new password.</p>
        </div>
        <a href="/login" className="inline-block mt-6 px-6 py-3 rounded-xl bg-brand-gold text-white text-sm font-bold hover:-translate-y-0.5 transition-all">
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

      <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
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
              placeholder="At least 8 characters (A-Z, a-z, 0-9)"
              required
              className="w-full py-3 px-4 bg-[#fafaf8] border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-brand-gold transition-colors"
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
              className="w-full py-3 px-4 bg-[#fafaf8] border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-brand-gold transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-gold text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(184,148,63,0.25)] transition-all disabled:opacity-60"
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
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-sm text-brand-muted">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
