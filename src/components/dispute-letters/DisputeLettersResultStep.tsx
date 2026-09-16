'use client'

import { useCallback, useEffect, useState } from 'react'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import type { GeneratedLetter, LetterPreviewBlock, LetterPreviewLayout } from '@/lib/dispute-letters/types'
import {
  confirmLetterPackageSent,
  disputeLetterDownloadUrl,
  disputeLettersZipUrl,
  fetchDisputeLetters,
  fetchLetterGenerateStatus,
  fetchLetterPackageForSession,
} from '@/lib/dispute-letters/client-api'
import type { LetterPackageSnapshot } from '@/lib/dispute-letters/dispute-lifecycle'
import { letterPackageDisplayCode } from '@/lib/dispute-letters/dispute-lifecycle'
import type { SkippedLetterPlan } from '@/lib/dispute-letters/generate-job'
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
  const [skipped, setSkipped] = useState<SkippedLetterPlan[]>([])
  const [pkg, setPkg] = useState<LetterPackageSnapshot | null>(null)
  const [busy, setBusy] = useState<'zip' | 'sent' | null>(null)

  const refreshPackage = useCallback(async () => {
    try {
      const snapshot = await fetchLetterPackageForSession(sessionId)
      setPkg(snapshot.package)
    } catch {
      /* package table may not be migrated yet */
    }
  }, [sessionId])

  async function downloadZip() {
    setBusy('zip')
    setError('')
    try {
      const res = await fetch(disputeLettersZipUrl(sessionId))
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'ZIP download failed')
      }
      const blob = await res.blob()
      const header = res.headers.get('content-disposition') || ''
      const matched = /filename="([^"]+)"/i.exec(header)
      const filename = matched?.[1] || 'Dispute Letters.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      await refreshPackage()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ZIP download failed')
    } finally {
      setBusy(null)
    }
  }

  async function confirmAllSent() {
    setBusy('sent')
    setError('')
    try {
      const result = await confirmLetterPackageSent({
        packageId: pkg?.package.id,
        sessionId,
      })
      const sentAt = result.sentAt || new Date().toISOString()
      setLetters((prev) => prev.map((letter) => ({ ...letter, sent_at: letter.sent_at || sentAt })))
      await refreshPackage()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm letters sent')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!sessionId) return
    fetchDisputeLetters(sessionId)
      .then((d) => {
        setLetters(d.letters)
        if (d.letters[0]) setActive(d.letters[0])
      })
      .catch(() => setError('Failed to load letters'))
    fetchLetterGenerateStatus(sessionId)
      .then((job) => {
        if (job.skipped?.length) setSkipped(job.skipped)
      })
      .catch(() => {
        /* job status is optional */
      })
    void refreshPackage()
    try {
      const raw = sessionStorage.getItem(`dispute-skipped:${sessionId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as SkippedLetterPlan[]
        if (Array.isArray(parsed) && parsed.length) setSkipped(parsed)
      }
    } catch {
      /* ignore */
    }
  }, [sessionId, refreshPackage])

  if (!sessionId) return null

  const generatedCount = pkg?.generatedCount || letters.length
  const sentCount = pkg?.sentCount ?? letters.filter((letter) => letter.sent_at).length
  const downloaded = Boolean(pkg?.downloaded)
  const allSent = pkg?.allSent || (generatedCount > 0 && sentCount >= generatedCount)
  const workflowLabel = pkg?.workflow.label || (allSent ? 'Complete' : downloaded ? 'Ready to Send' : 'Letters generated')

  return (
    <div className={`${embedded ? '' : 'max-w-5xl'} space-y-6`}>
      {!embedded && <DisputeLettersStepStrip sessionId={sessionId} />}

      <div className={`rounded-xl border p-6 ${letters.length ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <h2 className={`text-xl font-semibold ${letters.length ? 'text-green-900' : 'text-amber-950'}`}>
          {letters.length ? `Round letter package${pkg ? ` · ${letterPackageDisplayCode(pkg.package.id)}` : ''}` : 'No letters generated'}
        </h2>
        <p className={`mt-2 text-sm ${letters.length ? 'text-green-800' : 'text-amber-900'}`}>
          {letters.length
            ? 'Generate, download the ZIP, then confirm the package was mailed. Each letter folder includes the Word letter plus copies of the client\'s government photo ID and proof of address. Downloading does not mark items Sent.'
            : 'Add missing furnisher addresses on Confirm and generate again.'}
        </p>
        {letters.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-green-900">
            <li>
              <span className="font-semibold">{generatedCount} dispute letter{generatedCount === 1 ? '' : 's'} generated</span>
            </li>
            <li>{downloaded ? 'ZIP Downloaded ✓' : 'ZIP not downloaded yet'}</li>
            <li>
              {allSent
                ? 'All letters confirmed Sent'
                : `${workflowLabel}${sentCount ? ` · ${sentCount} of ${generatedCount} Sent` : ''}`}
            </li>
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {letters.length > 0 && (
            <button
              type="button"
              disabled={busy === 'zip'}
              onClick={() => void downloadZip()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'zip' ? 'Downloading…' : downloaded ? 'Download again' : 'Download all (ZIP)'}
            </button>
          )}
          {letters.length > 0 && !allSent && (
            <button
              type="button"
              disabled={busy === 'sent'}
              onClick={() => void confirmAllSent()}
              className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
            >
              {busy === 'sent' ? 'Saving…' : 'Confirm All Letters Sent'}
            </button>
          )}
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

      {skipped.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Skipped — furnisher address needed:</p>
          <ul className="mt-2 list-disc pl-5">
            {skipped.map((s) => (
              <li key={s.plan_id || s.recipient_name}>{s.recipient_name}</li>
            ))}
          </ul>
        </div>
      )}

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
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <a href={disputeLetterDownloadUrl(sessionId, l.id, 'docx')} className="text-accent hover:underline">
                  Download .docx
                </a>
                {l.sent_at || pkg?.members.some((member) => member.letter_id === l.id && member.sent_at) ? (
                  <span className="font-medium text-green-800">
                    Sent
                    {l.sent_at ? ` ${new Date(l.sent_at).toLocaleDateString()}` : ''}
                  </span>
                ) : (
                  <span className="font-medium text-brand-dim">Generated</span>
                )}
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
