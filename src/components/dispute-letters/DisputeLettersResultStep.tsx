'use client'

import { useEffect, useState } from 'react'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import type { GeneratedLetter, LetterPreviewBlock, LetterPreviewLayout } from '@/lib/dispute-letters/types'
import {
  disputeLetterDownloadUrl,
  disputeLettersZipUrl,
  fetchDisputeLetters,
} from '@/lib/dispute-letters/client-api'
import { letterLayout } from '@/lib/dispute-letters/letter-layout'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'
import './letter-preview.css'

function renderInlineMarkup(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function lineClassName(block: Extract<LetterPreviewBlock, { kind: 'line' }>) {
  const classes = ['letter-line']
  const indent = block.indent || 0
  if (indent) classes.push(`letter-indent-${indent}`)
  if (block.variant === 'heading') classes.push('letter-heading')
  else if (block.variant === 'name') classes.push('letter-name')
  else if (block.variant === 'field') classes.push('letter-field')
  else if (block.variant === 'tight') classes.push('letter-tight')
  return classes.join(' ')
}

function LetterPreview({ layout, fallbackText }: { layout?: LetterPreviewLayout; fallbackText: string }) {
  const date = layout?.date || ''
  const blocks = layout?.blocks

  return (
    <article className="letter-page shadow-sm">
      <div className="letter-header">
        <span className="letter-header-date">{date}</span>
        <span className="letter-header-page">Page 1/1</span>
      </div>
      <div className="letter-body">
        {blocks?.map((block, i) => {
          if (block.kind === 'spacer') {
            return <p key={i} className="letter-spacer" aria-hidden>
              {'\u00a0'}
            </p>
          }
          if (block.kind === 'bullet') {
            return (
              <p key={i} className="letter-line letter-bullet">
                ● {renderInlineMarkup(block.text)}
              </p>
            )
          }
          return (
            <p key={i} className={lineClassName(block)}>
              {renderInlineMarkup(block.text)}
            </p>
          )
        })}
        {!blocks && fallbackText
          ? fallbackText.split('\n').map((line, i) =>
              line.trim() ? (
                <p key={`fallback-${i}`} className="letter-line">
                  {renderInlineMarkup(line)}
                </p>
              ) : (
                <p key={`fallback-${i}`} className="letter-spacer" aria-hidden>
                  {'\u00a0'}
                </p>
              )
            )
          : null}
      </div>
    </article>
  )
}

export default function DisputeLettersResultStep({
  sessionId,
  embedded = false,
  onStepChange,
  onBackToAnalysis,
}: {
  sessionId: string
  embedded?: boolean
  onStepChange?: (step: DisputeLetterStep) => void
  onBackToAnalysis?: () => void
}) {
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
    <div className={`${embedded ? '' : 'max-w-5xl'} space-y-6`}>
      {!embedded && <DisputeLettersStepStrip sessionId={sessionId} />}

      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-xl font-semibold text-green-900">Letters ready</h2>
        <p className="mt-2 text-sm text-green-800">
          Mail disputes within 30 days. Keep copies of every letter and your report. Certified mail
          with return receipt is recommended for bureaus. The ZIP contains print-ready Word (.docx)
          files so formatting is preserved.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            href={disputeLettersZipUrl(sessionId)}
          >
            Download all (ZIP)
          </a>
          {embedded && onBackToAnalysis ? (
            <button
              type="button"
              onClick={onBackToAnalysis}
              className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
            >
              Back to analysis
            </button>
          ) : embedded && onStepChange ? (
            <button
              type="button"
              onClick={() => onStepChange('confirm')}
              className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
            >
              Back to confirm
            </button>
          ) : (
            <a
              href="/admin/credit-funding"
              className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
            >
              Back to Credit Intelligence
            </a>
          )}
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
                <a href={disputeLetterDownloadUrl(sessionId, l.id, 'docx')} className="text-accent hover:underline">
                  Download .docx
                </a>
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-auto rounded-xl border border-brand-border bg-neutral-100/80 p-4 shadow-sm min-h-[400px]">
          {active ? (
            <LetterPreview
              layout={active.preview || letterLayout(active.markdown || active.plain_text || '')}
              fallbackText=""
            />
          ) : (
            <p className="text-brand-dim">No letters yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
