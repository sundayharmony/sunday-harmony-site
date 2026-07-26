'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import type { GeneratedLetter } from '@/lib/dispute-letters/types'
import {
  disputeLetterDownloadUrl,
  disputeLettersZipUrl,
  fetchDisputeLetters,
} from '@/lib/dispute-letters/client-api'

const SECTION_HEADINGS = new Set([
  'Consumer Identification',
  'Disputed Tradelines',
  'Statutory Reinvestigation Requirements',
  'Requested Outcome',
  'CONSUMER INFORMATION',
  'DISPUTED ITEMS',
])

function renderInlineMarkup(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function classifyLetterLine(line: string, index: number): string {
  const trimmed = line.trim()
  if (!trimmed) return 'spacer'
  if (/^[●•▪◦]\s+/.test(trimmed) || /^[-*+]\s+/.test(trimmed)) return 'bullet'
  if (SECTION_HEADINGS.has(trimmed)) return 'heading'
  if (
    index < 7 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    trimmed.includes(' ') &&
    !/\d/.test(trimmed) &&
    trimmed.length < 60
  ) {
    return 'name'
  }
  if (
    /^(Full Name|Date of Birth|Current Address|Additional Addresses on File|Account Number|Reported Status|Reported Balance|Basis of Dispute)\s*:/i.test(
      trimmed
    )
  ) {
    return 'field'
  }
  if (/^Re:\s+/i.test(trimmed)) return 're'
  return 'body'
}

function LetterPreview({ text }: { text: string }) {
  const lines = useMemo(() => text.replace(/\r\n/g, '\n').split('\n'), [text])

  return (
    <article
      className="mx-auto max-w-[720px] bg-[#fbfaf7] px-8 py-10 shadow-sm sm:px-12"
      style={{ fontFamily: '"Times New Roman", Times, "Liberation Serif", serif' }}
    >
      <div className="space-y-0 text-[15px] leading-[1.55] text-[#1a1a1a]">
        {lines.map((line, i) => {
          const kind = classifyLetterLine(line, i)
          if (kind === 'spacer') {
            return <div key={i} className="h-3" aria-hidden />
          }
          if (kind === 'bullet') {
            const content = line.trim().replace(/^[●•▪◦\-*+]\s+/, '')
            return (
              <p key={i} className="mb-1 pl-5 -indent-4">
                ● {renderInlineMarkup(content)}
              </p>
            )
          }
          if (kind === 'heading') {
            return (
              <p key={i} className="mb-2 mt-5 font-bold tracking-wide">
                {renderInlineMarkup(line.trim())}
              </p>
            )
          }
          if (kind === 'name') {
            return (
              <p key={i} className="mb-0.5 font-bold tracking-wide">
                {renderInlineMarkup(line.trim())}
              </p>
            )
          }
          if (kind === 're') {
            return (
              <p key={i} className="mb-3 mt-1">
                {renderInlineMarkup(line.trim())}
              </p>
            )
          }
          if (kind === 'field') {
            return (
              <p key={i} className="mb-0.5">
                {renderInlineMarkup(line.trim())}
              </p>
            )
          }
          return (
            <p key={i} className="mb-2">
              {renderInlineMarkup(line.trim())}
            </p>
          )
        })}
      </div>
    </article>
  )
}

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

  const previewText = active?.markdown || active?.plain_text || ''

  return (
    <div className="max-w-5xl space-y-6">
      <DisputeLettersStepStrip sessionId={sessionId} />

      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-xl font-semibold text-green-900">Letters ready</h2>
        <p className="mt-2 text-sm text-green-800">
          Mail disputes within 30 days. Keep copies of every letter and your report. Certified mail
          with return receipt is recommended for bureaus. Download the .docx for print-ready
          formatting.
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
        <div className="overflow-auto rounded-xl border border-brand-border bg-neutral-100/80 p-4 shadow-sm min-h-[400px]">
          {active ? (
            <LetterPreview text={previewText} />
          ) : (
            <p className="text-brand-dim">No letters yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
