'use client'

import { useState, FormEvent } from 'react'

type Step = 'email' | 'code' | 'success'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1: Request verification code
  const handleEmailSubmit = async (e: FormEvent) => {
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
        setStep('code')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // Step 2: Submit code + new password
  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!code.trim()) {
      setError('Please enter the verification code')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), email, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setStep('success')
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
          {step === 'email' && (
            <>
              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
                  {error}
                </div>
              )}
              <p className="text-sm text-brand-muted mb-6">
                Enter your email address and we&apos;ll send you a verification code to reset your password.
              </p>
              <form onSubmit={handleEmailSubmit}>
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Email</label>
                  <input
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
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
                  {error}
                </div>
              )}
              <p className="text-sm text-brand-muted mb-1">
                We sent a 6-digit code to <span className="text-brand-text font-medium">{email}</span>
              </p>
              <p className="text-xs text-brand-dim mb-6">
                Enter the code below along with your new password. The code expires in 15 minutes.
              </p>
              <form onSubmit={handleResetSubmit}>
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    className="w-full py-3 px-4 bg-[#fafaf8] border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-brand-gold transition-colors text-center tracking-[0.3em] text-lg font-semibold"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    className="w-full py-3 px-4 bg-[#fafaf8] border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-brand-gold transition-colors"
                  />
                  <p className="text-[10px] text-brand-dim mt-1">Must include uppercase, lowercase, and a number</p>
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
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
              <button
                onClick={() => { setStep('email'); setError(''); setCode(''); setNewPassword(''); setConfirmPassword(''); }}
                className="w-full mt-3 text-xs text-brand-dim hover:text-brand-gold transition-colors"
              >
                Didn&apos;t receive a code? Try again
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-brand-green text-xl">â</span>
              </div>
              <p className="text-sm text-brand-text font-semibold mb-2">Password reset successfully</p>
              <p className="text-xs text-brand-muted mb-6">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <a
                href="/login"
                className="inline-block py-3 px-8 rounded-xl bg-brand-gold text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(184,148,63,0.25)] transition-all"
              >
                Go to Login
              </a>
            </div>
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
