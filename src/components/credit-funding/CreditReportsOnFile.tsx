'use client'

import { useState } from 'react'
import { documentDisplayLabel } from '@/lib/credit-funding-types'
import {
  fetchCreditFundingDocumentViewUrl,
  fetchDisputeReportFileUrl,
} from '@/lib/dispute-letters/client-api'

export type IntakeCreditReportDoc = {
  id: string
  file_name: string
  signedUrl?: string
  created_at?: string
  document_type?: string
}

function formatUploadedAt(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function CreditReportsOnFile({
  applicationId,
  intakeReports,
}: {
  applicationId: string
  intakeReports: IntakeCreditReportDoc[]
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const openIntakeReport = async (doc: IntakeCreditReportDoc) => {
    setError('')
    setBusyId(`intake-${doc.id}`)
    try {
      if (doc.signedUrl) {
        await openUrl(doc.signedUrl)
        return
      }
      const data = await fetchCreditFundingDocumentViewUrl(doc.id, applicationId)
      await openUrl(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open report')
    } finally {
      setBusyId(null)
    }
  }

  if (intakeReports.length === 0) return null

  return (
    <div className="rounded-xl border border-brand-border bg-neutral-50/80 p-4">
      <h4 className="text-sm font-bold text-brand-text">Credit reports from intake</h4>
      <p className="mt-1 text-xs text-brand-muted">
        PDFs the client uploaded on the Credit &amp; Funding form. Open here or re-upload in Analysis to run dispute tools.
      </p>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
      <ul className="mt-3 space-y-2">
        {intakeReports.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-brand-text truncate">
                {documentDisplayLabel(doc.document_type || 'credit_report')}
              </p>
              <p className="text-xs text-brand-dim truncate">
                {doc.file_name}
                {doc.created_at ? ` · ${formatUploadedAt(doc.created_at)}` : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === `intake-${doc.id}`}
              onClick={() => void openIntakeReport(doc)}
              className="shrink-0 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
            >
              {busyId === `intake-${doc.id}` ? 'Opening…' : 'View report'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function useViewDisputeSessionReport() {
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const viewSessionReport = async (sessionId: string) => {
    setError('')
    setBusySessionId(sessionId)
    try {
      const data = await fetchDisputeReportFileUrl(sessionId)
      await openUrl(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open report')
    } finally {
      setBusySessionId(null)
    }
  }

  return { viewSessionReport, busySessionId, viewError: error, setViewError: setError }
}
