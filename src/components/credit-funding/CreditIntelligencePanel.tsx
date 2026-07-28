'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import CreditIntelligenceDashboard from '@/components/dispute-letters/CreditIntelligenceDashboard'
import { ProgressPanel } from '@/components/dispute-letters/ProgressPanel'
import { DISPUTE_LETTER_MAX_MB } from '@/lib/dispute-letters-storage'
import {
  fetchDisputeSessionsForApplication,
  rebuildDisputeIntelligence,
  streamAnalyzeReport,
} from '@/lib/dispute-letters/client-api'
import { uploadDisputeLetterToSignedUrl } from '@/lib/dispute-letters/upload-client'
import type {
  CreditIntelligenceReport,
  DisputeSessionListItem,
  FundingContextPayload,
} from '@/lib/dispute-letters/types'

function intelligenceFromSession(s: DisputeSessionListItem): CreditIntelligenceReport | null {
  return (
    s.intelligence_json ||
    s.report_json?.credit_intelligence ||
    null
  )
}

export default function CreditIntelligencePanel({
  applicationId,
  fundingContext,
}: {
  applicationId: string
  fundingContext: FundingContextPayload
}) {
  const [sessions, setSessions] = useState<DisputeSessionListItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [intelligence, setIntelligence] = useState<CreditIntelligenceReport | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDisputeSessionsForApplication(applicationId)
      const list = data.sessions || []
      setSessions(list)
      const preferred = list.find((s) => s.status === 'ready') || list[0]
      if (preferred) {
        setActiveId(preferred.id)
        const existing = intelligenceFromSession(preferred)
        setIntelligence(existing)
        // #region agent log
        fetch('http://127.0.0.1:7413/ingest/b41535e0-0f57-49e9-94f2-079fcf155127',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'148064'},body:JSON.stringify({sessionId:'148064',hypothesisId:'D',location:'CreditIntelligencePanel.tsx:load',message:'loaded linked dispute session',data:{sessionIdPrefix:preferred.id.slice(0,8),status:preferred.status,hasIntelligence:Boolean(existing),hasReportJson:Boolean(preferred.report_json),tradelineCount:preferred.report_json?.tradelines?.length||0},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      } else {
        setActiveId(null)
        setIntelligence(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load credit intelligence')
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    load()
  }, [load])

  function selectSession(id: string) {
    setActiveId(id)
    const s = sessions.find((x) => x.id === id)
    setIntelligence(s ? intelligenceFromSession(s) : null)
  }

  async function onFile(file: File) {
    setError('')
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

      // Merge funding/intake context into intelligence
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
    try {
      const rebuilt = await rebuildDisputeIntelligence(activeId, fundingContext)
      setIntelligence(rebuilt.credit_intelligence)
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh intelligence'
      // #region agent log
      fetch('http://127.0.0.1:7413/ingest/b41535e0-0f57-49e9-94f2-079fcf155127',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'148064'},body:JSON.stringify({sessionId:'148064',hypothesisId:'A',location:'CreditIntelligencePanel.tsx:refresh',message:'rebuild intelligence failed',data:{error:msg.slice(0,300)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-dim">Loading Credit Intelligence…</p>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-border bg-white p-4">
        <h3 className="text-base font-bold text-brand-text">Credit Intelligence Engine</h3>
        <p className="mt-1 text-sm text-brand-muted">
          Import a credit report to analyze payment history, utilization, mix, inquiries, derogatories,
          funding readiness, and dispute recommendations — using this application&apos;s intake profile.
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
      </div>

      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-brand-dim uppercase">Reports</span>
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSession(s.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                activeId === s.id
                  ? 'border-accent bg-accent/10 text-brand-text'
                  : 'border-brand-border text-brand-dim hover:bg-neutral-50'
              }`}
            >
              {(s.report_json?.consumer?.name || s.file_name).slice(0, 28)} · {s.status}
            </button>
          ))}
          {activeId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshWithFundingContext()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-border text-brand-text hover:bg-neutral-50 disabled:opacity-50"
            >
              {intelligence ? 'Refresh with funding context' : 'Generate Credit Intelligence'}
            </button>
          )}
          {activeId && (
            <Link
              href={`/admin/dispute-letters/${activeId}/health`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-border text-brand-text hover:bg-neutral-50"
            >
              Dispute letters workflow →
            </Link>
          )}
        </div>
      )}

      {intelligence ? (
        <CreditIntelligenceDashboard intelligence={intelligence} sessionId={activeId || undefined} />
      ) : (
        <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 p-8 text-center">
          <p className="text-sm font-semibold text-brand-text">No credit analysis yet</p>
          <p className="mt-1 text-sm text-brand-dim">
            Upload this client&apos;s credit report to generate a full profile analysis and dispute plan.
          </p>
        </div>
      )}
    </div>
  )
}
