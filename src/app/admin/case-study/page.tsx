'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CASE_STUDY_BLURB_MAX,
  CASE_STUDY_NAME_MAX,
  type CaseStudyAdmin,
  type CaseStudyFields,
} from '@/lib/case-study-fields'

export default function AdminCaseStudyPage() {
  const [studies, setStudies] = useState<CaseStudyAdmin[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<CaseStudyFields>({ companyName: '', blurb: '', published: true })
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)

  const selected = studies.find((study) => study.id === selectedId) || null
  const publicCards = studies.filter((study) => study.published && (study.logoUrl || study.blurb))

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/case-studies')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to load case studies')
      const next = (payload.caseStudies || []) as CaseStudyAdmin[]
      setStudies(next)
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case studies')
      return [] as CaseStudyAdmin[]
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectStudy = (study: CaseStudyAdmin) => {
    setSelectedId(study.id)
    setDraft({
      companyName: study.companyName,
      blurb: study.blurb,
      published: study.published,
    })
    setNote('')
    setError('')
  }

  const saveDetails = async () => {
    if (!selectedId) return
    setSaving(true)
    setError('')
    setNote('')
    try {
      const res = await fetch('/api/admin/case-studies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId, ...draft }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'The case study could not be saved.')
      setNote('Saved. The About page uses this company name, note, and logo.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The case study could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (file: File) => {
    if (!selectedId) return
    setLogoBusy(true)
    setNote('')
    setError('')
    try {
      const body = new FormData()
      body.set('id', selectedId)
      body.set('file', file)
      const res = await fetch('/api/admin/case-studies/logo', { method: 'POST', body })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'The logo could not be saved.')
      setNote('Logo saved. It shows on the About page while this case study is public.')
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
    setNote('')
    setError('')
    try {
      const res = await fetch('/api/admin/case-studies/logo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'The logo could not be removed.')
      setNote('Logo removed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The logo could not be removed.')
    } finally {
      setLogoBusy(false)
    }
  }

  const removeStudy = async () => {
    if (!selectedId) return
    setSaving(true)
    setError('')
    setNote('')
    try {
      const res = await fetch('/api/admin/case-studies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'The case study could not be removed.')
      setSelectedId('')
      setDraft({ companyName: '', blurb: '', published: true })
      setNote('Case study removed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The case study could not be removed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Case Study</h1>
      <p className="text-sm text-brand-muted mb-6 max-w-2xl">
        Add the company name and a short note here. That is what the About page shows. This is not a partner login.
        Partner referral links stay on{' '}
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
              Public case studies with a logo or a note appear on the About page.
            </p>
          </div>
          <Link href="/about" className="text-sm font-semibold text-accent hover:underline">
            View About page
          </Link>
        </div>
        {publicCards.length === 0 ? (
          <p className="mt-4 text-sm text-brand-dim">Nothing is live yet. Add a company below.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {publicCards.map((study) => (
              <li
                key={study.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-brand-border bg-neutral-50 px-4 py-4"
              >
                {study.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={study.logoUrl} alt={`${study.companyName} logo`} className="h-12 w-full object-contain" />
                ) : null}
                <span className="text-center text-xs font-semibold leading-snug text-brand-text">{study.companyName}</span>
                {study.blurb ? (
                  <p className="text-center text-xs text-brand-muted leading-relaxed whitespace-pre-wrap">{study.blurb}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {note ? <p className="mb-4 text-sm text-brand-text">{note}</p> : null}
      {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-brand-border bg-white p-5">
            <h2 className="text-sm font-bold text-brand-text mb-1">Add a company</h2>
            <p className="text-xs text-brand-muted mb-4">
              Type the name people should see, then a short note about the work. You can add a logo after you save.
            </p>
            <AddCompanyForm
              busy={saving}
              onAdd={async (next) => {
                setSaving(true)
                setError('')
                setNote('')
                try {
                  const res = await fetch('/api/admin/case-studies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(next),
                  })
                  const payload = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(payload.error || 'The case study could not be saved.')
                  const created = payload.caseStudy as CaseStudyAdmin
                  setNote('Company added. You can still add a logo.')
                  const loaded = await load()
                  selectStudy(loaded.find((study) => study.id === created.id) || created)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'The case study could not be saved.')
                } finally {
                  setSaving(false)
                }
              }}
            />
          </section>

          <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                  <tr>
                    {['Company', 'Note', 'Public', 'Logo'].map((heading) => (
                      <th key={heading} className="text-left p-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studies.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-brand-dim">No companies yet. Add one above.</td>
                    </tr>
                  ) : (
                    studies.map((study) => (
                      <tr
                        key={study.id}
                        className={`border-t border-brand-border ${
                          selectedId === study.id ? 'bg-accent-soft/60' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => selectStudy(study)}
                            className="flex items-center gap-2 text-left"
                          >
                            {study.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={study.logoUrl} alt="" className="h-8 w-8 object-contain" />
                            ) : null}
                            <span className="font-semibold text-brand-text">{study.companyName}</span>
                          </button>
                        </td>
                        <td className="p-3 text-brand-muted">{study.blurb ? 'Yes' : 'No'}</td>
                        <td className="p-3">{study.published ? 'Yes' : 'No'}</td>
                        <td className="p-3">{study.logoUrl ? 'Yes' : 'No'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-brand-border bg-white p-5 h-fit">
          {selected ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void saveDetails()
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
              <label className="block">
                <span className="text-xs font-semibold text-brand-text">Company name</span>
                <input
                  value={draft.companyName}
                  onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))}
                  maxLength={CASE_STUDY_NAME_MAX}
                  required
                  className="mt-1 w-full py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-brand-text">What to say on the About page</span>
                <textarea
                  value={draft.blurb}
                  onChange={(event) => setDraft((current) => ({ ...current, blurb: event.target.value }))}
                  maxLength={CASE_STUDY_BLURB_MAX}
                  rows={5}
                  placeholder="A short note about this company and the work you did together."
                  className="mt-1 w-full py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                />
                <span className="mt-1 block text-[11px] text-brand-dim">
                  {draft.blurb.length}/{CASE_STUDY_BLURB_MAX}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))}
                />
                Show on the About page
              </label>
              <button
                type="submit"
                disabled={saving || logoBusy}
                className="px-3 py-2 bg-brand-text text-white text-xs font-semibold rounded-[10px] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save company info'}
              </button>
              <label className="block">
                <span className="text-xs font-semibold text-brand-text">Upload logo</span>
                <p className="text-xs text-brand-muted mt-1 mb-2">PNG, JPG, or WebP, up to 2 MB. Optional.</p>
                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={logoBusy}
                  className="text-xs text-brand-muted"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) void uploadLogo(file)
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {selected.logoUrl ? (
                  <button
                    type="button"
                    disabled={logoBusy}
                    onClick={() => void removeLogo()}
                    className="px-3 py-2 text-xs font-semibold text-brand-muted hover:underline disabled:opacity-50"
                  >
                    Remove logo
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void removeStudy()}
                  className="px-3 py-2 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                >
                  Remove company
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-brand-muted">Add a company, or choose one from the list to edit the note and logo.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function AddCompanyForm({
  busy,
  onAdd,
}: {
  busy: boolean
  onAdd: (draft: CaseStudyFields) => Promise<void>
}) {
  const [companyName, setCompanyName] = useState('')
  const [blurb, setBlurb] = useState('')

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void onAdd({ companyName, blurb, published: true }).then(() => {
          setCompanyName('')
          setBlurb('')
        })
      }}
    >
      <label className="block">
        <span className="text-xs font-semibold text-brand-text">Company name</span>
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          maxLength={CASE_STUDY_NAME_MAX}
          required
          placeholder="Company people will see"
          className="mt-1 w-full py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-brand-text">What to say on the About page</span>
        <textarea
          value={blurb}
          onChange={(event) => setBlurb(event.target.value)}
          maxLength={CASE_STUDY_BLURB_MAX}
          rows={4}
          placeholder="A short note about this company and the work you did together."
          className="mt-1 w-full py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="self-start px-4 py-2.5 bg-brand-text text-white text-sm font-semibold rounded-[10px] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Add company'}
      </button>
    </form>
  )
}
