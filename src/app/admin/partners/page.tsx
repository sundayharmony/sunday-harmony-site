'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

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
  clicks: number
  submitted: number
  inProgress: number
  completed: number
}

type ReferralRow = {
  id: string
  date: string
  applicant: string
  email: string
  phone: string
  stage: string
  updatedAt: string
  disputeRound: number | null
  applicationId: string
  applicationUuid: string
}

type PartnerDetail = {
  partner: PartnerRow & { link: string; linkActive: boolean }
  summary: { clicks: number; submitted: number; inProgress: number; completed: number }
  referrals: ReferralRow[]
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<PartnerDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteNote, setInviteNote] = useState('')

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

  const openPartner = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/partners?id=${encodeURIComponent(id)}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to load referrals')
      setDetail(payload)
    } catch (err) {
      setDetail(null)
      setError(err instanceof Error ? err.message : 'Failed to load referrals')
    } finally {
      setDetailLoading(false)
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
      if (selectedId === id) await openPartner(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId('')
    }
  }

  const sendInvite = async () => {
    setInviteBusy(true)
    setInviteNote('')
    setError('')
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', email: inviteEmail, firstName: inviteName }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Could not send the email')
      setInviteNote(`Signup link sent to ${inviteEmail.trim()}.`)
      setInviteEmail('')
      setInviteName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email')
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Partners</h1>
      <p className="text-sm text-brand-muted mb-6">
        Click a partner to see everyone they referred and open that credit file.
      </p>
      <form
        className="mb-6 bg-white border border-brand-border rounded-xl p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void sendInvite()
        }}
      >
        <h2 className="text-sm font-bold text-brand-text mb-1">Email a signup link</h2>
        <p className="text-xs text-brand-muted mb-4">
          Sends the partner signup page in an email styled like the public site.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            placeholder="First name (optional)"
            className="sm:w-48 py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm"
          />
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="name@company.com"
            className="flex-1 py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm"
          />
          <button
            type="submit"
            disabled={inviteBusy}
            className="px-4 py-3 bg-brand-text text-white text-sm font-semibold rounded-[10px] disabled:opacity-50"
          >
            {inviteBusy ? 'Sending…' : 'Send signup link'}
          </button>
        </div>
        {inviteNote ? <p className="mt-3 text-sm text-brand-text">{inviteNote}</p> : null}
      </form>
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}
      <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
              <tr>
                {['Partner', 'Company', 'Area', 'Field', 'Clicks', 'Applications', 'In progress', 'Status', ''].map((heading) => (
                  <th key={heading || 'actions'} className="text-left p-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 && !loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-brand-dim">No partner accounts yet.</td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr
                    key={partner.id}
                    className={`border-t border-brand-border align-top cursor-pointer hover:bg-neutral-50 ${
                      selectedId === partner.id ? 'bg-accent-soft/60' : ''
                    }`}
                    onClick={() => void openPartner(partner.id)}
                  >
                    <td className="p-3">
                      <div className="font-semibold text-brand-text">{partner.name}</div>
                      <div className="text-xs text-brand-muted">{partner.email}</div>
                      <div className="text-xs text-brand-dim">{partner.phone}</div>
                    </td>
                    <td className="p-3">{partner.companyName}</td>
                    <td className="p-3">{partner.serviceArea}</td>
                    <td className="p-3">{partner.profession}</td>
                    <td className="p-3">{partner.clicks}</td>
                    <td className="p-3">{partner.submitted}</td>
                    <td className="p-3">{partner.inProgress}</td>
                    <td className="p-3 capitalize">{partner.status}</td>
                    <td className="p-3 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
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

      {selectedId ? (
        <section className="mt-6 bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-brand-border flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-brand-text">
                {detail?.partner.companyName || 'Referrals'}
              </h2>
              <p className="text-xs text-brand-muted mt-1">
                {detail
                  ? `${detail.partner.name} · code ${detail.partner.code || '—'} · ${detail.summary.completed} completed`
                  : 'Loading referrals…'}
              </p>
            </div>
            {detail?.partner.link ? (
              <p className="text-xs text-brand-dim max-w-md break-all">{detail.partner.link}</p>
            ) : null}
          </div>
          {detailLoading ? <p className="p-5 text-sm text-brand-muted">Loading referrals…</p> : null}
          {detail && !detailLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                  <tr>
                    {['Submitted', 'Client', 'Stage', 'Updated', 'Round', 'File'].map((heading) => (
                      <th key={heading} className="text-left p-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.referrals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-brand-dim">
                        No one has submitted through this partner link yet.
                      </td>
                    </tr>
                  ) : (
                    detail.referrals.map((row) => (
                      <tr key={row.id} className="border-t border-brand-border">
                        <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="p-3">
                          <div className="font-semibold text-brand-text">{row.applicant}</div>
                          <div className="text-xs text-brand-muted">{row.email}</div>
                          <div className="text-xs text-brand-dim">{row.phone}</div>
                        </td>
                        <td className="p-3">{row.stage}</td>
                        <td className="p-3">{new Date(row.updatedAt).toLocaleDateString()}</td>
                        <td className="p-3">{row.disputeRound ? `Round ${row.disputeRound}` : '—'}</td>
                        <td className="p-3">
                          <Link
                            href={`/admin/credit-funding?id=${encodeURIComponent(row.applicationUuid)}`}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            Open {row.applicationId}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
