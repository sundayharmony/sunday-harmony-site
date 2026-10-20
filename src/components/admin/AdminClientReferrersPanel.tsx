'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ReferralLinkQrPanel from '@/components/referrals/ReferralLinkQrPanel'

type ClientReferrerRow = {
  clientId: string
  name: string
  email: string
  code: string
  link: string
  status: string
}

export default function AdminClientReferrersPanel() {
  const [rows, setRows] = useState<ClientReferrerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/referrals')
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || 'Failed to load client referrers')
        const clients = Array.isArray(payload.clients) ? payload.clients : []
        setRows(
          clients.map((row: ClientReferrerRow) => ({
            clientId: row.clientId,
            name: row.name,
            email: row.email,
            code: row.code,
            link: row.link || '',
            status: row.status,
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load client referrers')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [row.name, row.email, row.code, row.status].join(' ').toLowerCase().includes(q)
    )
  }, [rows, query])

  if (loading) return <p className="text-sm text-brand-muted">Loading client referral links…</p>
  if (error) return <p className="text-sm text-red-700">{error}</p>

  return (
    <div>
      <p className="text-sm text-brand-muted mb-4">
        Credit repair clients who refer others earn commissions. Copy links or download QR codes for print and email.
      </p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, email, or code"
        className="w-full max-w-md mb-4 py-2.5 px-3 bg-white border border-brand-border rounded-lg text-sm"
      />
      <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
            <tr>
              {['Client', 'Code', 'Status', ''].map((heading) => (
                <th key={heading || 'actions'} className="text-left p-3 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-brand-dim">No client referrers match.</td>
              </tr>
            ) : (
              filtered.map((row) => {
                const link = row.link || ''
                const open = expandedId === row.clientId
                return (
                  <Fragment key={row.clientId}>
                    <tr className="border-t border-brand-border align-top">
                      <td className="p-3">
                        <div className="font-semibold text-brand-text">{row.name}</div>
                        <div className="text-xs text-brand-muted">{row.email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{row.code || '—'}</td>
                      <td className="p-3 capitalize">{row.status.replace(/_/g, ' ')}</td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? '' : row.clientId)}
                          className="text-xs font-semibold text-accent hover:underline mr-3"
                        >
                          {open ? 'Hide QR' : 'Link & QR'}
                        </button>
                        <Link
                          href={`/admin/referrals/${encodeURIComponent(row.clientId)}`}
                          className="text-xs font-semibold text-brand-muted hover:underline"
                        >
                          Commissions
                        </Link>
                      </td>
                    </tr>
                    {open && link ? (
                      <tr key={`${row.clientId}-qr`} className="border-t border-brand-border bg-neutral-50/50">
                        <td colSpan={4} className="p-4">
                          <ReferralLinkQrPanel
                            title="Client referral link"
                            link={link}
                            code={row.code}
                            active={row.status === 'active'}
                            downloadLabelPrefix={row.name}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
