'use client'

import { useEffect, useState, useCallback } from 'react'
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'

interface Passkey {
  id: string
  friendlyName: string | null
  deviceType: string | null
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

export default function PasskeyPanel() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [supported, setSupported] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newPasskeyName, setNewPasskeyName] = useState('')
  const [showRegisterForm, setShowRegisterForm] = useState(false)

  useEffect(() => {
    setSupported(browserSupportsWebAuthn())
  }, [])

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/webauthn/credentials')
      if (!res.ok) {
        if (res.status === 403) {
          setError('Complete MFA verification to manage passkeys')
          return
        }
        throw new Error('Failed to load passkeys')
      }
      const data = await res.json()
      setPasskeys(data.credentials || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passkeys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPasskeys()
  }, [loadPasskeys])

  const handleRegister = async () => {
    setError('')
    setSuccess('')
    setRegistering(true)

    try {
      const optionsRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
      })

      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        throw new Error(data.error || 'Failed to start registration')
      }

      const { options } = await optionsRes.json()

      const attestation = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/webauthn/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: attestation,
          friendlyName: newPasskeyName.trim() || undefined,
        }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        throw new Error(data.error || 'Failed to register passkey')
      }

      setSuccess('Passkey registered successfully')
      setNewPasskeyName('')
      setShowRegisterForm(false)
      await loadPasskeys()
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Registration was cancelled')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to register passkey')
      }
    } finally {
      setRegistering(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this passkey?')) return

    setError('')
    setSuccess('')
    setDeletingId(id)

    try {
      const res = await fetch(`/api/auth/webauthn/credentials?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete passkey')
      }

      setSuccess('Passkey removed')
      await loadPasskeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete passkey')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!supported) {
    return (
      <div className="mt-10 pt-8 border-t border-brand-border">
        <h2 className="text-lg font-bold text-brand-text mb-1">Passkeys</h2>
        <p className="text-sm text-brand-muted mb-4">
          Your browser does not support passkeys. Try a modern browser like Chrome, Safari, or Edge.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-10 pt-8 border-t border-brand-border">
        <h2 className="text-lg font-bold text-brand-text mb-1">Passkeys</h2>
        <p className="text-sm text-brand-muted">Loading passkeys…</p>
      </div>
    )
  }

  return (
    <div className="mt-10 pt-8 border-t border-brand-border">
      <h2 className="text-lg font-bold text-brand-text mb-1">Passkeys</h2>
      <p className="text-sm text-brand-muted mb-4">
        Passkeys let you sign in quickly and securely using your device&apos;s biometrics (fingerprint, face) or PIN — no authenticator app needed.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-brand-border bg-white overflow-hidden">
        {passkeys.length === 0 ? (
          <div className="p-4 text-sm text-brand-muted">
            No passkeys registered. Add one to enable faster, passwordless sign-in.
          </div>
        ) : (
          <ul className="divide-y divide-brand-border">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-text truncate">
                    {passkey.friendlyName || 'Passkey'}
                    {passkey.backedUp && (
                      <span className="ml-2 text-xs text-brand-muted">(synced)</span>
                    )}
                  </p>
                  <p className="text-xs text-brand-muted">
                    Added {formatDate(passkey.createdAt)}
                    {passkey.lastUsedAt && ` • Last used ${formatDate(passkey.lastUsedAt)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(passkey.id)}
                  disabled={deletingId === passkey.id}
                  className="text-xs text-brand-red hover:underline disabled:opacity-50"
                >
                  {deletingId === passkey.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showRegisterForm ? (
          <div className="p-4 border-t border-brand-border bg-neutral-50">
            <label htmlFor="passkey-name" className="block text-sm font-medium text-brand-text mb-2">
              Passkey name (optional)
            </label>
            <input
              id="passkey-name"
              type="text"
              value={newPasskeyName}
              onChange={(e) => setNewPasskeyName(e.target.value)}
              placeholder="e.g., MacBook Pro, iPhone 15"
              className="w-full px-3 py-2 rounded-lg border border-brand-border text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRegister}
                disabled={registering}
                className="px-4 py-2 rounded-lg bg-brand-text text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {registering ? 'Registering…' : 'Register passkey'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterForm(false)
                  setNewPasskeyName('')
                }}
                disabled={registering}
                className="px-4 py-2 rounded-lg border border-brand-border text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-brand-border">
            <button
              type="button"
              onClick={() => setShowRegisterForm(true)}
              className="text-sm font-medium text-accent hover:underline"
            >
              + Add a passkey
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
