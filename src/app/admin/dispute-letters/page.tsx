'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import { ProgressPanel } from '@/components/dispute-letters/ProgressPanel'
import { DISPUTE_LETTER_MAX_MB } from '@/lib/dispute-letters-storage'
import { fetchDisputeConfig, streamAnalyzeReport } from '@/lib/dispute-letters/client-api'
import { uploadDisputeLetterToSignedUrl } from '@/lib/dispute-letters/upload-client'
import type { DisputeSessionListItem } from '@/lib/dispute-letters/types'

function sessionLabel(s: DisputeSessionListItem) {
  const name = s.report_json?.consumer?.name
  if (name) return name
  return s.file_name || 'Credit report'
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ready: 'bg-green-100 text-green-800',
    analyzing: 'bg-blue-100 text-blue-800',
    uploaded: 'bg-neutral-100 text-brand-dim',
    failed: 'bg-red-100 text-red-800',
  }
  return styles[status] || 'bg-neutral-100 text-brand-dim'
}

export default function DisputeLettersPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<DisputeSessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)

  const loadSessions = useCallback(() => {
    fetch('/api/admin/dispute-letters')
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadSessions()
    fetchDisputeConfig()
      .then((c) => setApiConfigured(c.cursor_api_configured))
      .catch(() => setApiConfigured(false))
  }, [loadSessions])

  async function onFile(file: File) {
    setError('')
    if (file.size > DISPUTE_LETTER_MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${DISPUTE_LETTER_MAX_MB} MB)`)
      return
    }
    setUploading(true)
    setUploadStatus('Preparing upload…')
    try {
      const urlRes = await fetch('/api/admin/dispute-letters/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }),
      })
      if (!urlRes.ok) {
        const d = await urlRes.json().catch(() => ({}))
        throw new Error(d.error || 'Upload URL failed')
      }
      const { sessionId, signedUrl, path, token } = await urlRes.json()

      setUploadStatus('Uploading report…')
      await uploadDisputeLetterToSignedUrl(signedUrl, token, file, (pct) => {
        setUploadStatus(`Uploading report… ${pct}%`)
      })

      setUploadStatus('Analyzing with AI…')
      await streamAnalyzeReport(sessionId, path, file.name, (ev) => {
        if (ev.status === 'ingesting') setUploadStatus('Reading file…')
        if (ev.status === 'analyzing') setUploadStatus('Building credit health summary…')
        if (ev.message) setUploadStatus(String(ev.message))
      })

      router.push(`/admin/dispute-letters/${sessionId}/health`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadStatus('')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-text">Dispute Letters</h1>
        <p className="mt-1 text-sm text-brand-dim">
          Upload credit reports, analyze with AI, and generate FCRA dispute letters.
        </p>
      </div>

      <DisputeLettersStepStrip />

      <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-text">Start a new repair plan</h2>
        <p className="mt-2 text-sm text-brand-dim">
          Upload a 3-bureau credit report. We analyze negative items and recommend disputes.
        </p>

        {apiConfigured === false && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Cursor AI is not configured on the dispute letters service. Set <code>CURSOR_API_KEY</code> on
            Railway and redeploy.
          </p>
        )}

        <div
          className={`mt-6 rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? 'border-accent bg-accent-soft/20' : 'border-neutral-300'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="font-medium text-brand-text">Drop your report here</p>
          <p className="mt-1 text-sm text-brand-dim">HTML, PDF, TXT, DOC, DOCX, PNG, JPEG (max {DISPUTE_LETTER_MAX_MB} MB)</p>
          <label className="mt-4 inline-block cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Choose file
            <input
              type="file"
              className="hidden"
              accept=".html,.htm,.pdf,.txt,.doc,.docx,.png,.jpg,.jpeg"
              disabled={uploading || apiConfigured === false}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
              }}
            />
          </label>
        </div>

        {uploading && uploadStatus && <ProgressPanel status={uploadStatus} />}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-brand-text mb-3">Recent sessions</h2>
        {loading ? (
          <p className="text-sm text-brand-dim">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-brand-dim">No sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-brand-border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-text">{sessionLabel(s)}</p>
                  <p className="text-xs text-brand-dim mt-0.5">
                    {new Date(s.created_at).toLocaleString()} · {s.file_name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(s.status)}`}>
                    {s.status}
                  </span>
                  {s.status === 'ready' && (
                    <Link
                      href={`/admin/dispute-letters/${s.id}/health`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Continue
                    </Link>
                  )}
                  {s.status === 'failed' && (
                    <span className="text-xs text-red-600 max-w-[200px] truncate" title={s.error_message || ''}>
                      {s.error_message || 'Failed'}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 text-xs text-brand-dim">
        Not legal advice. Review all letters before sending. Statutory references are for drafting assistance only.
      </p>
    </div>
  )
}
