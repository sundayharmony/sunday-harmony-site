'use client'

import { useCallback, useEffect, useState } from 'react'

type PartnerRow = {
  id: string
  name: string
  email: string
  phone: string
  companyName: string
  serviceArea: string
  yearsInField: number
  profession: string
  status: string
  code: string
  createdAt: string
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/partners')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to load partners')
      setPartners(payload.partners || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partners')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const update = async (id: string, action: 'approve' | 'disable') => {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Update failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Partners</h1>
      <p className="text-sm text-brand-muted mb-6">
        Approve a partner to turn on their credit referral link. Disable it to stop new attributions.
      </p>
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}
      <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
              <tr>
                {['Partner', 'Company', 'Area', 'Field', 'Years', 'Status', 'Code', ''].map((heading) => (
                  <th key={heading || 'actions'} className="text-left p-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-brand-dim">No partner accounts yet.</td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr key={partner.id} className="border-t border-brand-border align-top">
                    <td className="p-3">
                      <div className="font-semibold text-brand-text">{partner.name}</div>
                      <div className="text-xs text-brand-muted">{partner.email}</div>
                      <div className="text-xs text-brand-dim">{partner.phone}</div>
                    </td>
                    <td className="p-3">{partner.companyName}</td>
                    <td className="p-3">{partner.serviceArea}</td>
                    <td className="p-3">{partner.profession}</td>
                    <td className="p-3">{partner.yearsInField}</td>
                    <td className="p-3 capitalize">{partner.status}</td>
                    <td className="p-3 font-mono text-xs">{partner.code || '—'}</td>
                    <td className="p-3 whitespace-nowrap">
                      {partner.status !== 'active' ? (
                        <button
                          type="button"
                          disabled={busyId === partner.id}
                          onClick={() => update(partner.id, 'approve')}
                          className="mr-2 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : null}
                      {partner.status !== 'disabled' ? (
                        <button
                          type="button"
                          disabled={busyId === partner.id}
                          onClick={() => update(partner.id, 'disable')}
                          className="text-xs font-semibold text-brand-muted hover:underline disabled:opacity-50"
                        >
                          Disable
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
