'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import FileUploadField from '@/components/credit-funding/FileUploadField'
import CreditFundingStatusTracker from '@/components/credit-funding/CreditFundingStatusTracker'
import StatusBadge from '@/components/ui/StatusBadge'
import { type ApplicationStatus } from '@/lib/credit-funding-types'

interface ApplicationData {
  id: string
  application_id: string
  full_name: string
  email: string
  status: ApplicationStatus
  service_type?: string
  assigned_specialist?: string
  client_notes?: string
  next_steps?: string
  funding_scores?: {
    revenue_score?: number | null
    funding_readiness?: number | null
    credit_readiness?: number | null
    recommended_programs?: string[]
    estimated_range?: string
  }
  created_at: string
  updated_at: string
}

interface DocRequest {
  id: string
  document_type: string
  label: string
  notes?: string
  status: string
}

interface Message {
  id: string
  from_role: 'admin' | 'applicant'
  from_name: string
  text: string
  created_at: string
}

export default function ClientCreditFundingPage() {
  const [data, setData] = useState<{
    application: ApplicationData
    history: { status: ApplicationStatus; created_at: string; notes?: string }[]
    documents: { id: string; label: string; file_name: string; signedUrl?: string }[]
    teamDocuments: { id: string; label: string; file_name: string; signedUrl?: string; created_at: string }[]
    docRequests: DocRequest[]
    messages: Message[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const r = await fetch('/api/dashboard/credit-funding')
      if (r.status === 404) {
        setError('No application found for your account. Apply at the Credit & Funding intake form using this email.')
        return
      }
      if (!r.ok) throw new Error('Failed to load')
      setData(await r.json())
      setError('')
    } catch {
      setError('Failed to load your application')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages])

  const uploadDoc = async (request: DocRequest, file: File) => {
    setUploading(request.id)
    const fd = new FormData()
    fd.append('documentType', request.document_type)
    fd.append('requestId', request.id)
    fd.append('file', file)
    try {
      const r = await fetch('/api/dashboard/credit-funding/upload', { method: 'POST', body: fd })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'Upload failed')
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || sending) return
    setSending(true)
    try {
      const r = await fetch('/api/dashboard/credit-funding/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newMsg.trim() }),
      })
      if (!r.ok) throw new Error('Failed to send')
      setNewMsg('')
      await load()
    } catch {
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-dim">Loading your application…</p>
  }

  if (error || !data) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-brand-text mb-4">Credit &amp; Funding</h1>
        <div className="bg-white border border-brand-border rounded-xl p-6">
          <p className="text-sm text-brand-muted mb-4">{error || 'No application found.'}</p>
          <Link href="/credit-funding" className="text-sm font-semibold text-accent hover:underline">
            Submit an application →
          </Link>
        </div>
      </div>
    )
  }

  const { application, history, documents, teamDocuments, docRequests, messages } = data
  const pendingDocs = docRequests.filter((d) => d.status === 'pending')
  const scores = application.funding_scores

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-text">Credit &amp; Funding</h1>
        <p className="text-sm text-brand-muted mt-1">Track your application status and communicate with our team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold text-brand-dim uppercase tracking-wide">Application ID</p>
              <p className="font-bold text-brand-text">{application.application_id}</p>
            </div>
            <StatusBadge status={application.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-brand-dim">Submitted</p>
              <p className="text-brand-text">{new Date(application.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-brand-dim">Last Updated</p>
              <p className="text-brand-text">{new Date(application.updated_at).toLocaleDateString()}</p>
            </div>
            {application.assigned_specialist && (
              <div className="col-span-2">
                <p className="text-xs text-brand-dim">Assigned Specialist</p>
                <p className="text-brand-text">{application.assigned_specialist}</p>
              </div>
            )}
          </div>
        </div>

        {(scores?.revenue_score != null || scores?.estimated_range) && (
          <div className="bg-white border border-brand-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-brand-text mb-3">Funding Indicators</h3>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              {[
                ['Revenue', scores?.revenue_score],
                ['Funding Ready', scores?.funding_readiness],
                ['Credit Ready', scores?.credit_readiness],
              ].map(([label, val]) => (
                <div key={label as string} className="p-2 bg-neutral-50 rounded-lg">
                  <p className="text-lg font-bold text-accent">{val ?? '—'}</p>
                  <p className="text-[10px] text-brand-dim uppercase">{label}</p>
                </div>
              ))}
            </div>
            {scores?.estimated_range && (
              <p className="text-sm text-brand-muted">
                <span className="font-semibold">Est. Range:</span> {scores.estimated_range}
              </p>
            )}
            {scores?.recommended_programs?.length ? (
              <p className="text-xs text-brand-dim mt-2">
                Programs: {scores.recommended_programs.join(', ')}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mb-6">
        <CreditFundingStatusTracker currentStatus={application.status} history={history} />
      </div>

      {application.next_steps && (
        <div className="bg-accent-soft/30 border border-brand-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-brand-text mb-2">Next Steps</h3>
          <p className="text-sm text-brand-muted whitespace-pre-wrap">{application.next_steps}</p>
        </div>
      )}

      {application.client_notes && (
        <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-brand-text mb-2">Team Notes</h3>
          <p className="text-sm text-brand-muted whitespace-pre-wrap">{application.client_notes}</p>
        </div>
      )}

      {pendingDocs.length > 0 && (
        <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-brand-text mb-3">Requested Documents</h3>
          <div className="space-y-4">
            {pendingDocs.map((req) => (
              <div key={req.id} className="p-4 bg-neutral-50 rounded-xl border border-brand-border">
                <p className="text-sm font-medium text-brand-text">{req.label}</p>
                {req.notes && <p className="text-xs text-brand-dim mt-1">{req.notes}</p>}
                <div className="mt-3">
                  <FileUploadField
                    label="Upload requested document"
                    name={`doc-${req.id}`}
                    required
                    value={null}
                    onChange={(file) => {
                      if (file) void uploadDoc(req, file)
                    }}
                    error={uploading === req.id ? undefined : undefined}
                  />
                  {uploading === req.id && (
                    <p className="text-xs text-brand-dim mt-2">Uploading securely…</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {teamDocuments.length > 0 && (
        <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-brand-text mb-3">Documents from Your Specialist</h3>
          <div className="space-y-2">
            {teamDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-accent-soft/20 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{doc.file_name}</p>
                  <p className="text-xs text-brand-dim">
                    Shared {new Date(doc.created_at).toLocaleString()}
                  </p>
                </div>
                {doc.signedUrl && (
                  <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent hover:underline">
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-brand-text mb-3">Your Documents</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-brand-dim">No documents on file yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{doc.label}</p>
                  <p className="text-xs text-brand-dim">{doc.file_name}</p>
                </div>
                {doc.signedUrl && (
                  <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent hover:underline">
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-brand-text mb-3">Messages</h3>
        <div className="max-h-[320px] overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 ? (
            <p className="text-sm text-brand-dim">No messages yet. Send a message to our team.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg text-sm ${
                  m.from_role === 'admin' ? 'bg-accent-soft/40 ml-0 mr-8' : 'bg-neutral-50 ml-8 mr-0'
                }`}
              >
                <p className="text-xs font-semibold text-brand-dim mb-1">
                  {m.from_name} · {new Date(m.created_at).toLocaleString()}
                </p>
                <p className="text-brand-muted whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            className="flex-1 py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
            placeholder="Type a message…"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
          />
          <button
            type="submit"
            disabled={sending || !newMsg.trim()}
            className="px-4 py-2 bg-brand-text text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
