'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MATERIAL_CATEGORY_LABELS, salesMaterials, outreachEmailTemplates, type OutreachEmailTemplate } from '@/lib/sales-materials'
import type { ServiceDocument } from '@/lib/service-documents'
import type { DocumentStatus } from '@/lib/document-status'

type Tab = 'materials' | 'documents' | 'emails'

export default function SalesKitPage() {
  const [activeTab, setActiveTab] = useState<Tab>('materials')
  const [documents, setDocuments] = useState<ServiceDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    try {
      const res = await fetch('/api/admin/service-documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingDocs(false)
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const saleMaterials = salesMaterials.filter(m => m.forRoles.includes('sales'))

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Sales Kit</h1>
        <p className="text-sm text-brand-muted">
          Presentations, proposals, agreements, and outreach templates.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-brand-border">
        {[
          { id: 'materials' as Tab, label: 'Materials' },
          { id: 'documents' as Tab, label: 'Agreements & Proposals' },
          { id: 'emails' as Tab, label: 'Outreach Emails' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-accent border-accent'
                : 'text-brand-muted border-transparent hover:text-brand-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {saleMaterials.map(material => (
            <div
              key={material.id}
              className="rounded-xl border border-brand-border bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold text-brand-text">{material.title}</h3>
                  <p className="text-xs text-brand-muted mt-1">{material.description}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-accent-soft text-accent uppercase tracking-wide">
                  {MATERIAL_CATEGORY_LABELS[material.category]}
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                <a
                  href={material.pdfPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs font-semibold py-2 rounded-lg border border-brand-border hover:bg-neutral-50 transition-colors"
                >
                  View PDF
                </a>
                <a
                  href={material.pdfPath}
                  download
                  className="flex-1 text-center text-xs font-semibold py-2 rounded-lg bg-brand-text text-white hover:bg-neutral-800 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-brand-text">Recent Documents</h2>
            <div className="flex gap-2">
              <Link
                href="/admin/sales-kit/proposal/new"
                className="text-xs font-semibold px-4 py-2 rounded-lg border border-brand-border hover:bg-neutral-50 transition-colors"
              >
                + New Proposal
              </Link>
              <Link
                href="/admin/sales-kit/agreement/new"
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand-text text-white hover:bg-neutral-800 transition-colors"
              >
                + New Agreement
              </Link>
            </div>
          </div>

          {loadingDocs ? (
            <div className="text-sm text-brand-muted py-8 text-center">Loading...</div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-brand-border bg-white p-8 text-center">
              <p className="text-brand-muted mb-4">No documents yet.</p>
              <p className="text-sm text-brand-dim">
                Create a proposal or agreement to send to a client for e-signature.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-brand-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-brand-text">Document</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-text">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-text">Package</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-text">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-text">Date</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id} className="border-b border-brand-border last:border-0 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-brand-text">{doc.document_number}</div>
                        <div className="text-xs text-brand-dim capitalize">{doc.document_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-brand-text">{doc.business_name}</div>
                        <div className="text-xs text-brand-dim">{doc.client_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-brand-text">{doc.package_tier}</div>
                        <div className="text-xs text-brand-dim">
                          ${doc.package_price.toLocaleString()}{doc.price_type === 'monthly' ? '/mo' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-brand-dim">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {doc.status === 'signed' && (
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              className="text-xs font-semibold text-brand-muted hover:text-brand-text"
                            >
                              Download
                            </a>
                          )}
                          <Link
                            href={`/admin/sales-kit/${doc.document_type}/${doc.id}`}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Outreach Emails Tab */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-white p-5 mb-6">
            <h3 className="font-bold text-brand-text mb-2">How to use these templates</h3>
            <ul className="text-sm text-brand-muted space-y-1">
              <li>• Lead with the free audit, not the pitch</li>
              <li>• Personalize one real detail (check their Google profile, website, or social first)</li>
              <li>• Keep it under 150 words, one ask: &ldquo;Want me to send it over?&rdquo;</li>
              <li>• Day 1 first email, Day 4–5 follow-up #1, Day 10–14 final follow-up, then stop</li>
            </ul>
            <div className="mt-4">
              <a
                href="/sales-materials/outreach-emails.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Download full PDF with tips →
              </a>
            </div>
          </div>

          {outreachEmailTemplates.map(template => (
            <EmailTemplateCard
              key={template.id}
              template={template}
              copiedId={copiedId}
              onCopy={copyToClipboard}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles: Record<DocumentStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-yellow-100 text-yellow-700',
    signed: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded capitalize ${styles[status]}`}>
      {status}
    </span>
  )
}

function EmailTemplateCard({
  template,
  copiedId,
  onCopy,
}: {
  template: OutreachEmailTemplate
  copiedId: string | null
  onCopy: (text: string, id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-brand-border bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div>
          <h3 className="font-bold text-brand-text">{template.title}</h3>
          <p className="text-xs text-brand-muted mt-1">{template.useWhen}</p>
        </div>
        <span className="text-brand-dim text-lg">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-brand-border pt-4">
          <div className="mb-4">
            <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-2">When to send</div>
            <p className="text-sm text-brand-muted">{template.whenToSend}</p>
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-2">Subject lines</div>
            <div className="space-y-1">
              {template.subjectOptions.map((subject, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="text-sm bg-neutral-100 px-2 py-1 rounded flex-1">{subject}</code>
                  <button
                    onClick={() => onCopy(subject, `${template.id}-subject-${i}`)}
                    className="text-xs text-accent hover:underline"
                  >
                    {copiedId === `${template.id}-subject-${i}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide">Email body</div>
              <button
                onClick={() => onCopy(template.body, `${template.id}-body`)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                {copiedId === `${template.id}-body` ? 'Copied!' : 'Copy body'}
              </button>
            </div>
            <pre className="text-sm bg-neutral-100 p-4 rounded-lg whitespace-pre-wrap font-sans text-brand-muted leading-relaxed">
              {template.body}
            </pre>
          </div>

          <div className="rounded-lg bg-accent-soft/50 border border-accent/20 p-3">
            <div className="text-xs font-semibold text-accent mb-1">💡 Tip</div>
            <p className="text-xs text-brand-muted">{template.tip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
