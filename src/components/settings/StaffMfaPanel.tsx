'use client'

import { useEffect, useState } from 'react'

export default function StaffMfaPanel() {
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [mfaVerified, setMfaVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/auth/mfa/setup')
        if (!res.ok) throw new Error('Could not load MFA status')
        const data = await res.json()
        setTotpEnabled(Boolean(data.totpEnabled))
        setMfaVerified(Boolean(data.mfaVerified))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load MFA status')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return <p className="text-sm text-brand-muted">Loading security settings…</p>
  }

  return (
    <div className="mt-10 pt-8 border-t border-brand-border">
      <h2 className="text-lg font-bold text-brand-text mb-1">Two-factor authentication</h2>
      <p className="text-sm text-brand-muted mb-4">
        Staff accounts require two-factor authentication. Use an authenticator app, or add a passkey
        below to sign in with this computer instead of a 6-digit code.
      </p>
      {error && (
        <p className="text-sm text-brand-red mb-3">{error}</p>
      )}
      <div className="rounded-xl border border-brand-border bg-white p-4 text-sm">
        <p className="text-brand-text">
          Status:{' '}
          <span className="font-semibold">
            {totpEnabled ? (mfaVerified ? 'Enabled and verified this session' : 'Enabled') : 'Not enrolled'}
          </span>
        </p>
        {!totpEnabled && (
          <a
            href="/login/mfa/setup"
            className="inline-block mt-3 text-accent hover:underline font-medium"
          >
            Set up authenticator →
          </a>
        )}
        {totpEnabled && !mfaVerified && (
          <a href="/login/mfa" className="inline-block mt-3 text-accent hover:underline font-medium">
            Verify authenticator →
          </a>
        )}
      </div>
    </div>
  )
}
