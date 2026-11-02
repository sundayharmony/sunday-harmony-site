'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDocumentStatusBadge } from '@/lib/service-documents'

interface DocumentData {
  id: string
  document_type: 'agreement' | 'proposal'
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled'
  document_number: string
  client_name: string
  business_name: string
  package_tier: string
  package_price: number
  price_type: 'one-time' | 'monthly' | 'custom'
  created_at: string
  sent_at?: string
  signed_at?: string
}

export default function ClientDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch('/api/dashboard/documents')
        if (res.ok) {
          const data = await res.json()
          setDocuments(data)
        }
      } catch (err) {
        console.error('Failed to load documents', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading your documents...</div>
      </div>
    )
  }

  const agreements = documents.filter(d => d.document_type === 'agreement')
  const proposals = documents.filter(d => d.document_type === 'proposal')

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">
          Your Documents
        </h1>
        <p className="text-sm text-brand-muted">
          View and sign agreements and proposals from your team.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-brand-border p-8 text-center">
          <div className="text-4xl mb-4">📄</div>
          <h2 className="text-lg font-bold text-brand-text mb-2">No Documents Yet</h2>
          <p className="text-sm text-brand-muted">
            When your team sends you an agreement or proposal, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Service Agreements */}
          {agreements.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-brand-text mb-4">Service Agreements</h2>
              <div className="space-y-3">
                {agreements.map(doc => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          )}

          {/* Proposals */}
          {proposals.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-brand-text mb-4">Marketing Proposals</h2>
              <div className="space-y-3">
                {proposals.map(doc => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Card */}
      <div className="mt-8 bg-accent-soft border border-accent/20 rounded-2xl p-4 sm:p-5">
        <h3 className="font-serif text-sm font-bold text-brand-text mb-1">Questions About a Document?</h3>
        <p className="text-xs text-brand-muted mb-3">
          If you have questions about any agreement or proposal, reach out to your team.
        </p>
        <Link
          href="/dashboard/messages"
          className="text-xs font-bold text-accent hover:underline"
        >
          Send us a message &rarr;
        </Link>
      </div>
    </div>
  )
}

function DocumentCard({ document: doc }: { document: DocumentData }) {
  const badge = formatDocumentStatusBadge(doc.status)
  const docTypeLabel = doc.document_type === 'agreement' ? 'Service Agreement' : 'Marketing Proposal'
  const needsSignature = doc.status === 'sent' || doc.status === 'viewed'

  return (
    <div className="bg-white rounded-xl border border-brand-border p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{doc.document_type === 'agreement' ? '📝' : '📋'}</span>
            <h3 className="font-bold text-brand-text">{docTypeLabel}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <div className="text-sm text-brand-muted">
            {doc.document_number} · {doc.package_tier}
          </div>
          <div className="text-xs text-brand-dim mt-1">
            {doc.signed_at ? (
              <>Signed {new Date(doc.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            ) : doc.sent_at ? (
              <>Sent {new Date(doc.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            ) : (
              <>Created {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doc.status === 'signed' && (
            <Link
              href={`/api/documents/${doc.id}/download`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-brand-text hover:bg-neutral-200 transition-colors"
            >
              Download PDF
            </Link>
          )}
          {needsSignature && (
            <Link
              href={`/sign/${doc.id}?from=dashboard`}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-brand-text text-white hover:bg-neutral-800 transition-colors"
            >
              Review & Sign
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
