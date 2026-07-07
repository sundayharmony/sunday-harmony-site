'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import type { GeneratedLetter } from '@/lib/dispute-letters/types'
import {
  disputeLetterDownloadUrl,
  disputeLettersZipUrl,
  fetchDisputeLetters,
} from '@/lib/dispute-letters/client-api'

export default function DisputeLettersResultPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [letters, setLetters] = useState<GeneratedLetter[]>([])
  const [active, setActive] = useState<GeneratedLetter | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return
    fetchDisputeLetters(sessionId)
      .then((d) => {
        setLetters(d.letters)
        if (d.letters[0]) setActive(d.letters[0])
      })
      .catch(() => setError('Failed to load letters'))
  }, [sessionId])

  if (!sessionId) return null

  return (
    <div className="max-w-5xl space-y-6">
      <DisputeLettersStepStrip sessionId={sessionId} />

      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-xl font-semibold text-green-900">Letters ready</h2>
        <p className="mt-2 text-sm text-green-800">
          Mail disputes within 30 days. Keep copies of every letter and your report. Certified mail
          with return receipt is recommended for bureaus.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            href={disputeLettersZipUrl(sessionId)}
          >
            Download all (ZIP)
          </a>
          <Link
            href="/admin/dispute-letters"
            className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
          >
            New report
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {letters.map((l) => (
            <div key={l.id} className="rounded-xl border border-brand-border bg-white p-3 shadow-sm">
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active?.id === l.id ? 'bg-accent-soft/50 font-medium' : 'hover:bg-neutral-50'
                }`}
                onClick={() => setActive(l)}
              >
                {l.title}
              </button>
              <div className="mt-2 flex gap-2 text-xs">
                <a href={disputeLetterDownloadUrl(sessionId, l.id, 'txt')} className="text-accent hover:underline">
                  Download .txt
                </a>
                <a href={disputeLetterDownloadUrl(sessionId, l.id, 'docx')} className="text-accent hover:underline">
                  Download .docx
                </a>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-brand-border bg-white p-6 overflow-auto shadow-sm min-h-[400px]">
          {active ? (
            active.html ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: active.html }} />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-brand-text">{active.plain_text || active.markdown}</div>
            )
          ) : (
            <p className="text-brand-dim">No letters yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
