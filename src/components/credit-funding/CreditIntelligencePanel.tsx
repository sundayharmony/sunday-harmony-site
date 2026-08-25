'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BureauScoresPanel } from '@/components/dispute-letters/BureauScoresPanel'
import CreditIntelligenceDashboard from '@/components/dispute-letters/CreditIntelligenceDashboard'
import CreditProgressPanel from '@/components/dispute-letters/CreditProgressPanel'
import DisputeLettersWorkflow from '@/components/dispute-letters/DisputeLettersWorkflow'
import { ProgressPanel } from '@/components/dispute-letters/ProgressPanel'
import { DISPUTE_LETTER_MAX_MB } from '@/lib/dispute-letters-storage'
import {
  fetchDisputeSessionsForApplication,
  rebuildDisputeIntelligence,
  streamAnalyzeReport,
} from '@/lib/dispute-letters/client-api'
import {
  buildCreditProgressDiff,
  formatProgressDate,
  snapshotFromSession,
} from '@/lib/dispute-letters/credit-progress'
import { uploadDisputeLetterToSignedUrl } from '@/lib/dispute-letters/upload-client'
import type {
  BureauScores,
  CreditIntelligenceReport,
  DisputeSessionListItem,
  FundingContextPayload,
} from '@/lib/dispute-letters/types'
import { type DisputeLetterStep } from '@/lib/dispute-letters/workflow'

function intelligenceFromSession(s: DisputeSessionListItem): CreditIntelligenceReport | null {
  return (
    s.intelligence_json ||
    s.report_json?.credit_intelligence ||
    null
  )
}

function bureauScoresFromSession(s: DisputeSessionListItem | null): BureauScores | null {
  if (!s?.report_json?.credit_health?.scores) return null
  return s.report_json.credit_health.scores
}

function shortFileName(name: string): string {
  if (name.length <= 28) return name
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  return `${name.slice(0, 24 - ext.length)}…${ext}`
}

type PanelView = 'analysis' | 'letters'

export default function CreditIntelligencePanel({
  applicationId,
  fundingContext,
  initialView = 'analysis',
  initialLetterStep = 'health',
  initialSessionId = null,
}: {
  applicationId: string
  fundingContext: FundingContextPayload
  initialView?: PanelView
  initialLetterStep?: DisputeLetterStep
  initialSessionId?: string | null
}) {
  const [sessions, setSessions] = useState<DisputeSessionListItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(initialSessionId)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [intelligence, setIntelligence] = useState<CreditIntelligenceReport | null>(null)
  const [view, setView] = useState<PanelView>(initialView)
  const [letterStep, setLetterStep] = useState<DisputeLetterStep>(initialLetterStep)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDisputeSessionsForApplication(applicationId)
      const list = data.sessions || []
      setSessions(list)
      const preferred =
        (initialSessionId && list.find((s) => s.id === initialSessionId)) ||
        list.find((s) => s.status === 'ready') ||
        list[0]
      if (preferred) {
        setActiveId(preferred.id)
        setIntelligence(intelligenceFromSession(preferred))
      } else {
        setActiveId(null)
        setIntelligence(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load credit intelligence')
    } finally {
      setLoading(false)
    }
  }, [applicationId, initialSessionId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setView(initialView)
    setLetterStep(initialLetterStep)
    if (initialSessionId) setActiveId(initialSessionId)
  }, [initialView, initialLetterStep, initialSessionId])

  function selectSession(id: string) {
    setActiveId(id)
    const s = sessions.find((x) => x.id === id)
    setIntelligence(s ? intelligenceFromSession(s) : null)
    setSuccess('')
  }

  function openLetters(step: DisputeLetterStep = 'health') {
    if (!activeId) return
    setLetterStep(step)
    setView('letters')
  }

  const progress = useMemo(
    () => buildCreditProgressDiff(sessions, activeId),
    [sessions, activeId]
  )

  const bureauScores = useMemo(() => {
    const activeSession = sessions.find((s) => s.id === activeId) || null
    return bureauScoresFromSession(activeSession)
  }, [sessions, activeId])

  const readyChronological = useMemo(() => {
    return sessions
      .filter((s) => s.status === 'ready' && snapshotFromSession(s))
      .slice()
      .sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
  }, [sessions])

  const firstReadyId = readyChronological[0]?.id ?? null
  const latestReadyId = readyChronological[readyChronological.length - 1]?.id ?? null
  const previousReadyId =
    activeId && readyChronological.length > 1
      ? (() => {
          const idx = readyChronological.findIndex((s) => s.id === activeId)
          return idx > 0 ? readyChronological[idx - 1].id : null
        })()
      : null

  async function onFile(file: File) {
    setError('')
    setSuccess('')
    if (file.size > DISPUTE_LETTER_MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${DISPUTE_LETTER_MAX_MB} MB)`)
      return
    }
    setBusy(true)
    setStatus('Preparing upload…')
    try {
      const urlRes = await fetch('/api/admin/dispute-letters/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
          applicationUuid: applicationId,
        }),
      })
      if (!urlRes.ok) {
        const d = await urlRes.json().catch(() => ({}))
        throw new Error(d.error || 'Upload URL failed')
      }
      const { sessionId, signedUrl, path, token } = await urlRes.json()

      setStatus('Uploading credit report…')
      await uploadDisputeLetterToSignedUrl(signedUrl, token, file, (pct) => {
        setStatus(`Uploading credit report… ${pct}%`)
      })

      setStatus('Running Credit Intelligence analysis…')
      const result = await streamAnalyzeReport(sessionId, path, file.name, (evt) => {
        if (typeof evt.message === 'string') setStatus(evt.message)
      })

      setStatus('Merging funding application context…')
      try {
        const rebuilt = await rebuildDisputeIntelligence(sessionId, fundingContext)
        setIntelligence(rebuilt.credit_intelligence)
      } catch {
        setIntelligence(result.report.credit_intelligence || null)
      }

      setActiveId(sessionId)
      await load()
      setStatus('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload/analysis failed')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function refreshWithFundingContext() {
    if (!activeId) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const rebuilt = await rebuildDisputeIntelligence(activeId, fundingContext)
      setIntelligence(rebuilt.credit_intelligence)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh intelligence')
    } finally {
      setBusy(false)
    }
  }

  async function downloadPdf() {
    if (!activeId) return
    setBusy(true)
    setError('')
    setSuccess('')
    setStatus('Generating PDF…')
    try {
      const res = await fetch(`/api/admin/dispute-letters/${activeId}/intelligence/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funding_context: fundingContext }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] || 'Credit-Analysis.pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setSuccess('PDF downloaded.')
      setStatus('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download PDF')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function sendPdfToClient() {
    if (!activeId) return
    const confirmed = window.confirm(
      'Share this Credit Profile Analysis PDF to the client portal and email the client?'
    )
    if (!confirmed) return

    setBusy(true)
    setError('')
    setSuccess('')
    setStatus('Generating and sending PDF…')
    try {
      const res = await fetch(`/api/admin/credit-funding/${applicationId}/send-intelligence-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeId,
          notifyEmail: true,
          funding_context: fundingContext,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send PDF')
      }
      setSuccess(
        data.emailed
          ? `PDF shared to portal and emailed (${data.fileName || 'Credit Analysis'}).`
          : `PDF shared to portal (${data.fileName || 'Credit Analysis'}).`
      )
      setStatus('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send PDF')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-dim">Loading credit analysis…</p>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-border bg-white p-4">
        <h3 className="text-base font-bold text-brand-text">Credit analysis</h3>
        <p className="mt-1 text-sm text-brand-muted">
          Upload reports, review the profile analysis, and prepare dispute letters. Staff funding scores live on the Funding tab.
        </p>

        <label className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-border bg-neutral-50 px-4 py-8 cursor-pointer hover:bg-neutral-100 transition-colors">
          <span className="text-sm font-semibold text-brand-text">
            {busy ? 'Working…' : 'Upload credit report'}
          </span>
          <span className="text-xs text-brand-dim">PDF, HTML, DOCX, images · max {DISPUTE_LETTER_MAX_MB} MB</span>
          <input
            type="file"
            className="hidden"
            disabled={busy}
            accept=".pdf,.html,.htm,.docx,.doc,.png,.jpg,.jpeg,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </label>

        {busy && status && <div className="mt-3"><ProgressPanel status={status} /></div>}
        {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}
      </div>

      {sessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-brand-dim uppercase">Report history</span>
            {sessions.map((s) => {
              const intel = intelligenceFromSession(s)
              const reportDate =
                intel?.report_date || s.report_json?.report_date || s.created_at
              const badges: string[] = []
              if (s.id === firstReadyId) badges.push('First')
              if (s.id === previousReadyId && s.id !== firstReadyId) badges.push('Previous')
              if (s.id === latestReadyId && sessions.filter((x) => x.status === 'ready').length > 1) {
                badges.push('Latest')
              }
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSession(s.id)}
                  className={`px-3 py-2 text-left text-xs font-semibold rounded-lg border ${
                    activeId === s.id
                      ? 'border-accent bg-accent/10 text-brand-text'
                      : 'border-brand-border text-brand-dim hover:bg-neutral-50'
                  }`}
                >
                  <span className="block">{formatProgressDate(reportDate)}</span>
                  <span className="block font-medium text-[11px] opacity-80">
                    {shortFileName(s.file_name)} · {s.status}
                  </span>
                  {badges.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {badges.map((b) => (
                        <span
                          key={b}
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-neutral-100 text-brand-dim"
                        >
                          {b}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {activeId && (
              <div className="flex rounded-lg border border-brand-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setView('analysis')}
                  className={`px-3 py-1.5 text-xs font-semibold ${
                    view === 'analysis'
                      ? 'bg-brand-text text-white'
                      : 'bg-white text-brand-dim hover:bg-neutral-50'
                  }`}
                >
                  Analysis
                </button>
                <button
                  type="button"
                  disabled={!(activeId && sessions.some((s) => s.id === activeId && s.status === 'ready'))}
                  onClick={() => openLetters('health')}
                  className={`px-3 py-1.5 text-xs font-semibold border-l border-brand-border disabled:opacity-40 ${
                    view === 'letters'
                      ? 'bg-brand-text text-white'
                      : 'bg-white text-brand-dim hover:bg-neutral-50'
                  }`}
                >
                  Dispute letters
                </button>
              </div>
            )}
            {activeId && view === 'analysis' && (
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refreshWithFundingContext()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-text text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {intelligence ? 'Refresh analysis' : 'Generate analysis'}
                </button>
                {intelligence && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void downloadPdf()}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-border text-brand-text hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void sendPdfToClient()}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-border text-brand-text hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Send to client
                    </button>
                    <button
                      type="button"
                      onClick={() => openLetters('health')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-border text-brand-text hover:bg-neutral-50"
                    >
                      Prepare letters
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {progress.readyCount >= 1 && view === 'analysis' && (
        <CreditProgressPanel progress={progress} />
      )}

      {view === 'letters' && activeId ? (
        <DisputeLettersWorkflow
          sessionId={activeId}
          step={letterStep}
          onStepChange={setLetterStep}
          onBackToAnalysis={() => setView('analysis')}
        />
      ) : (
        <>
          <BureauScoresPanel
            scores={bureauScores}
            title="Credit Bureau Scores"
            subtitle={bureauScores ? undefined : 'Upload a credit report to see bureau scores'}
          />

          {intelligence ? (
            <CreditIntelligenceDashboard
              intelligence={intelligence}
              sessionId={activeId || undefined}
              onOpenDisputeWorkflow={() => openLetters('health')}
              fundingBlockTitle="Report funding readiness (advisory)"
              fundingBlockSubtitle="Generated from the credit report — does not replace staff assessment on the Funding tab."
            />
          ) : (
            <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 p-8 text-center">
              <p className="text-sm font-semibold text-brand-text">No credit analysis yet</p>
              <p className="mt-1 text-sm text-brand-dim">
                Upload this client&apos;s credit report to generate a full profile analysis and dispute plan.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
