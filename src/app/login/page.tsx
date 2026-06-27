'use client'

import Link from 'next/link'
import { useState, FormEvent, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthPageShell from '@/components/auth/AuthPageShell'
import AuthInput from '@/components/auth/AuthInput'

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
      try {
        const res = await fetch('/api/auth/session')
        const session = await res.json()
        const role = session?.user?.role

        if (role === 'admin') {
          router.push('/admin')
        } else if (role === 'credit_manager') {
          router.push('/admin/credit-funding')
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
    <AuthPageShell title="Sign in" subtitle="Access your dashboard">
      {(error || searchParams.get('error')) && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
          {error || 'You do not have permission to access that page.'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <AuthInput
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          required
        />
        <AuthInput
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          labelExtra={
            <Link href="/forgot-password" className="text-[10px] text-accent hover:underline">
              Forgot password?
            </Link>
          }
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
          <p className="text-sm text-brand-muted">Loading...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
