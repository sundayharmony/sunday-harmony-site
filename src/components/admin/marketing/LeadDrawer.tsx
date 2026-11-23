'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import ProspectActivity from '@/components/admin/marketing/ProspectActivity'
import { formatWhen } from '@/components/admin/marketing/ProspectActivity'
import { prospectNoteSections } from '@/lib/prospect-notes'
import {
  SOURCE_LABELS,
  STAGE_LABELS,
  isLeadSource,
  roleMayOpenProspectFile,
  staffStageChoices,
  type PipelineStage,
} from '@/lib/marketing-pipeline'
import { followUpAfter } from '@/lib/marketing-workspace'

type DrawerProspect = {
  id: string
  business: string
  contactName: string
  email: string
  phone: string
  industry: string
  website: string
  location: string
  source: string
  stage: PipelineStage
  score: number | null
  estimatedValue: number | null
  followUpAt: string | null
  opportunity: string
  recommendedService: string
  notes: string
  clientId: string | null
}

export type DrawerStep = { id: string; business: string }

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function websiteHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

const pill = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition'

export default function LeadDrawer({
  id,
  role,
  canEdit,
  sequence,
  onClose,
  onOpen,
  onChanged,
}: {
  id: string | null
  role: string
  canEdit: boolean
  sequence: DrawerStep[]
  onClose: () => void
  onOpen: (id: string) => void
  onChanged: () => void
}) {
  const [prospect, setProspect] = useState<DrawerProspect | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setProspect(null)
    setError('')
    setNotice('')
    void fetch(`/api/admin/pipeline/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) setError(typeof data.error === 'string' ? data.error : 'Could not open this lead.')
        else setProspect(data.prospect)
      })
      .catch(() => {
        if (!cancelled) setError('Could not open this lead.')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const open = Boolean(id)
  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      returnFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!id || !mounted) return null

  const position = sequence.findIndex((step) => step.id === id)
  const next = position >= 0 ? sequence[position + 1] : undefined

  async function patch(body: Record<string, unknown>, done: string) {
    if (!prospect) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/pipeline/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setProspect(data.prospect)
      setNotice(data.warning || done)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const noteSections = prospect ? prospectNoteSections(prospect.notes) : null
  const source = prospect ? (prospect.source === 'inbound' ? 'website' : prospect.source) : ''

  // Portal to <body>: the admin shell has transformed ancestors that would trap a fixed panel.
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button type="button" aria-label="Close lead" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-brand-text/30" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-brand-bg shadow-[0_0_60px_-20px_rgba(27,26,23,0.5)] sm:max-w-[480px] sm:border-l sm:border-brand-border"
      >
        <header className="shrink-0 border-b border-brand-border bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink">
                {prospect ? STAGE_LABELS[prospect.stage] : 'Lead'}
                {prospect?.score != null ? ` · Score ${prospect.score}` : ''}
                {prospect && money(prospect.estimatedValue) ? ` · ${money(prospect.estimatedValue)}` : ''}
              </p>
              <h2 id="lead-drawer-title" className="mt-1 truncate font-serif text-2xl text-brand-text">
                {prospect?.business || (error ? 'Lead' : 'Loading…')}
              </h2>
              {prospect && (
                <p className="truncate text-sm text-brand-muted">
                  {[prospect.contactName || 'No contact name', prospect.industry, prospect.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-muted hover:bg-brand-bg-soft hover:text-brand-text"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {prospect && (
            <div className="mt-4 flex flex-wrap gap-2">
              {prospect.phone && (
                <a href={`tel:${prospect.phone}`} className={`${pill} bg-brand-text text-white`}>Call {prospect.phone}</a>
              )}
              {prospect.email && (
                <a href={`mailto:${prospect.email}`} className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>Email</a>
              )}
              {prospect.website && (
                <a href={websiteHref(prospect.website)} target="_blank" rel="noreferrer" className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>Website</a>
              )}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          {error && <p className="text-sm text-brand-red">{error}</p>}
          {prospect && (
            <>
              {canEdit && (
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-brand-text">Stage</span>
                    <select
                      className="w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                      value={prospect.stage}
                      disabled={saving}
                      onChange={(event) => void patch({ stage: event.target.value }, 'Stage saved.')}
                    >
                      {staffStageChoices(role, prospect.stage).map((stage) => (
                        <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                      ))}
                    </select>
                  </label>
                  <div className="text-sm">
                    <span className="mb-1 block font-medium text-brand-text">Follow-up</span>
                    <p className="text-sm text-brand-muted">{prospect.followUpAt ? formatWhen(prospect.followUpAt) : 'None set'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {([['Tomorrow', 1], ['3 days', 3], ['Next week', 7]] as const).map(([label, days]) => (
                        <button
                          key={label}
                          type="button"
                          disabled={saving}
                          onClick={() => void patch({ followUpAt: followUpAfter(days, new Date()) }, `Follow-up set for ${formatWhen(followUpAfter(days, new Date()))}.`)}
                          className="min-h-9 rounded-full border border-brand-border bg-white px-3 text-xs font-semibold text-brand-text hover:border-accent"
                        >
                          {label}
                        </button>
                      ))}
                      {prospect.followUpAt && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void patch({ followUpAt: null }, 'Follow-up cleared.')}
                          className="min-h-9 rounded-full px-3 text-xs font-semibold text-brand-muted hover:text-brand-text"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {notice && <p className="text-sm text-brand-muted sm:col-span-2" role="status">{notice}</p>}
                </section>
              )}

              <ProspectActivity
                prospectId={prospect.id}
                canEdit={canEdit}
                phone={prospect.phone}
                onLogged={(result) => {
                  if (result.prospect) {
                    setProspect((current) => (current ? { ...current, ...result.prospect, stage: result.prospect!.stage as PipelineStage } : current))
                  }
                  onChanged()
                }}
              />

              <section className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink">About the business</p>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {prospect.opportunity && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-brand-dim">Opportunity</dt>
                      <dd className="mt-0.5 text-brand-text">{prospect.opportunity}</dd>
                    </div>
                  )}
                  {prospect.recommendedService && (
                    <div>
                      <dt className="text-xs font-semibold text-brand-dim">Recommended</dt>
                      <dd className="mt-0.5 text-brand-text">{prospect.recommendedService}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-semibold text-brand-dim">Source</dt>
                    <dd className="mt-0.5 text-brand-text">{isLeadSource(source) ? SOURCE_LABELS[source] : source}</dd>
                  </div>
                  {prospect.email && (
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold text-brand-dim">Email</dt>
                      <dd className="mt-0.5 truncate text-brand-text">{prospect.email}</dd>
                    </div>
                  )}
                </dl>
                {noteSections ? (
                  <div className="space-y-3 rounded-2xl border border-brand-border bg-white p-4">
                    {noteSections.map((section, index) => (
                      <div key={`${section.label}-${index}`}>
                        <p className="text-xs font-semibold text-brand-dim">{section.label}</p>
                        <p className="mt-0.5 text-sm leading-6 text-brand-text">{section.body}</p>
                      </div>
                    ))}
                  </div>
                ) : prospect.notes ? (
                  <p className="whitespace-pre-wrap rounded-2xl border border-brand-border bg-white p-4 text-sm leading-6 text-brand-text">{prospect.notes}</p>
                ) : null}
              </section>
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-brand-border bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {roleMayOpenProspectFile(role) ? (
            <Link href={`/admin/pipeline/${id}`} className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>
              Open full file
            </Link>
          ) : prospect?.clientId ? (
            <Link href={`/admin/clients?client=${prospect.clientId}`} className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>
              Open client record
            </Link>
          ) : <span />}
          {next && (
            <button type="button" onClick={() => onOpen(next.id)} className={`${pill} bg-accent-soft text-brand-text hover:bg-accent hover:text-white`}>
              <span className="max-w-[12rem] truncate">Next: {next.business}</span>
              <span aria-hidden>→</span>
            </button>
          )}
        </footer>
      </aside>
    </div>,
    document.body
  )
}
