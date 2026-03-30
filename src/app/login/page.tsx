'use client'

import { useState, FormEvent, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
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
      try {
        const res = await fetch('/api/auth/session')
        const session = await res.json()
        const role = session?.user?.role

        if (role === 'admin') {
          router.push('/admin')
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

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-10">
        <a href="/" className="font-serif text-3xl font-extrabold text-brand-text">
          Sunday <span className="text-brand-gold">Harmony</span>
        </a>
        <p className="text-sm text-brand-muted mt-2">Sign in to your dashboard</p>
      </div>

      {/* Form */}
      <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">
        {(error || searchParams.get('error')) && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
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
              className="w-full py-3 px-4 bg-[#fafaf8] border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-brand-gold transition-colors"
            />
          </div>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-brand-muted tracking-wide">Password</label>
              <a href="/forgot-password" className="text-[10px] text-brand-gold hover:underline">Forgot password?</a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center px-6">
      <Suspense fallback={
        <div cla