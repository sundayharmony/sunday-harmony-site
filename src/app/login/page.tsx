'use client'

import { useState, FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

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
      // Redirect based on role — fetch session to check
      const res = await fetch('/api/auth/session')
      const session = await res.json()
      const role = session?.user?.role

      if (role === 'admin') {
        window.location.href = '/admin'
      } else if (role === 'client') {
        window.location.href = '/dashboard'
      } else {
        window.location.href = callbackUrl
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <a href="/" className="font-serif text-3xl font-extrabold text-brand-text">
            Sunday <span className="text-brand-gold">Harmony</span>
          </a>
          <p className="text-sm text-brand-muted mt-2">Sign in to your dashboard</p>
        </div>

        {/* Form */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
          {(error || searchParams.get('error')) && (
            <div className="mb-6 p-3 rounded-lg bg-[rgba(212,86,78,0.1)] border border-[rgba(212,86,78,0.2)] text-sm text-brand-red">
              {error || 'You do not have permission to access that page.'}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                className="w-full py-3 px-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)] transition-colors"
              />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-xs text-brand-dim hover:text-brand-gold transition-colors">
            &larr; Back to website
          </a>
        </div>
      </div>
    </div>
  )
}
