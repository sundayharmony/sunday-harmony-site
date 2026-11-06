'use client'

import { useEffect, useState } from 'react'

const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-4 py-2.5 text-base font-semibold text-brand-text hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timeoutId = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`${buttonClass} shrink-0`}
      aria-label={copied ? `Copied: ${label}` : `Copy: ${label}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function PrintToolkitButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`partner-print-hide print:hidden ${buttonClass}`}
    >
      Print this page
    </button>
  )
}
