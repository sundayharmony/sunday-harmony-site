'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type PartnerRow = {
  id: string
  name: string
  companyName: string
  status: string
  logoUrl: string | null
}

export default function AdminCaseStudyPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoNote, setLogoNote] = useState('')

  const selected = partners.find((partner) => partner.id === selectedId) || null
  const publicLogos = partners.filter((partner) => partner.status === 'active' && partner.logoUrl)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/partners')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to load case studies')
      setPartners(payload.partners || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case studies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const uploadLogo = async (file: File) => {
    if (!selectedId) return
    setLogoBusy(true)
    setLogoNote('')
    setError('')
    try {
      const body = new FormData()
      body.set('id', selectedId)
      body.set('file', file)
      const res = await fetch('/api/admin/partners/logo', { method: 'POST', body })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'The logo could not be saved.')
      setLogoNote('Logo saved. It appears on the About page while this partner is active.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The logo could not be saved.')
    } finally {
      setLogoBusy(false)
    }
  }

  const removeLogo = async () => {
    if (!selectedId) return
    setLogoBusy(true)
    setLogoNote('')
    setError('')
    try {
      const res = await fetch('/api/admin/partners/logo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'The logo could not be removed.')
      setLogoNote('Logo removed from this profile.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The logo could not be removed.')
    } finally {
      setLogoBusy(false)
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Case Study</h1>
      <p className="text-sm text-brand-muted mb-6 max-w-2xl">
        Partner logos that show on the About page. Referral links and payouts stay on{' '}
        <Link href="/admin/referrals?tab=partners" className="font-semibold text-accent hover:underline">
          Referrals
        </Link>
        .
      </p>

      <section className="mb-6 rounded-xl border border-brand-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-brand-text">About page preview</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Active partners with a logo appear in the public slideshow.
            </p>
          </div>
          <Link href="/about" className="text-sm font-semibold text-accent hover:underline">
            View About page
          </Link>
        </div>
        {publicLogos.length === 0 ? (
          <p className="mt-4 text-sm text-brand-dim">No logos are live yet. Upload one for an active partner.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-3">
            {publicLogos.map((partner) => (
              <li
                key={partner.id}
                className="flex w-[140px] flex-col items-center gap-2 rounded-2xl border border-brand-border bg-neutral-50 px-4 py-4"
              >
                {/* Logos are uploaded files, not bundled images. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.logoUrl || ''} alt={`${partner.companyName} logo`} className="h-12 w-full object-contain" />
                <span className="text-center text-xs font-semibold leading-snug text-brand-text">{partner.companyName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                <tr>
                  {['Company', 'Contact', 'Status', 'Logo'].map((heading) => (
                    <th key={heading} className="text-left p-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-brand-dim">No partner accounts yet.</td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr
                      key={partner.id}
                      className={`border-t border-brand-border cursor-pointer hover:bg-neutral-50 ${
                        selectedId === partner.id ? 'bg-accent-soft/60' : ''
                      }`}
                      onClick={() => {
                        setSelectedId(partner.id)
                        setLogoNote('')
                      }}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {partner.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={partner.logoUrl} alt="" className="h-8 w-8 object-contain" />
                          ) : null}
                          <span className="font-semibold text-brand-text">{partner.companyName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-brand-muted">{partner.name}</td>
                      <td className="p-3 capitalize">{partner.status}</td>
                      <td className="p-3">{partner.logoUrl ? 'Yes' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="rounded-xl border border-brand-border bg-white p-5 h-fit">
          {selected ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                const input = event.currentTarget.elements.namedItem('logo')
                const file = input instanceof HTMLInputElement ? input.files?.[0] : null
                if (!file) {
                  setError('Choose a logo file.')
                  return
                }
                void uploadLogo(file)
              }}
            >
              <div className="h-20 w-full bg-neutral-50 border border-brand-border rounded-xl flex items-center justify-center overflow-hidden">
                {selected.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.logoUrl} alt={`${selected.companyName} logo`} className="max-h-16 max-w-[10rem] object-contain" />
                ) : (
                  <span className="text-xs text-brand-dim">No logo</span>
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-text">{selected.companyName}</h2>
                <p className="text-xs text-brand-muted mt-1">
                  PNG, JPG, or WebP, up to 2 MB. Active partners show in the About page slideshow.
                </p>
                {logoNote ? <p className="text-xs text-brand-text mt-2">{logoNote}</p> : null}
              </div>
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={logoBusy}
                className="text-xs text-brand-muted"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={logoBusy}
                  className="px-3 py-2 bg-brand-text text-white text-xs font-semibold rounded-[10px] disabled:opacity-50"
                >
                  {logoBusy ? 'Saving…' : 'Upload logo'}
                </button>
                {selected.logoUrl ? (
                  <button
                    type="button"
                    disabled={logoBusy}
                    onClick={() => void removeLogo()}
                    className="px-3 py-2 text-xs font-semibold text-brand-muted hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="text-sm text-brand-muted">Choose a partner to add or replace their logo.</p>
          )}
        </section>
      </div>
    </div>
  )
}
