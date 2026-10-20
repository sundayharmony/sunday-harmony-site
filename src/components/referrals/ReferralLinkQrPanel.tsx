'use client'

import { useMemo, useState } from 'react'
import { referralQrDownloadFilename } from '@/lib/referral-qr'

export default function ReferralLinkQrPanel({
  title,
  link,
  code,
  active = true,
  inactiveHint,
  downloadLabelPrefix = 'referral',
}: {
  title: string
  link: string
  code: string
  active?: boolean
  inactiveHint?: string
  downloadLabelPrefix?: string
}) {
  const [copied, setCopied] = useState(false)
  const qrSrc = useMemo(() => {
    if (!link.trim()) return ''
    return `/api/referral-qr?data=${encodeURIComponent(link.trim())}&size=500`
  }, [link])
  const downloadHref = useMemo(() => {
    if (!link.trim()) return ''
    return `/api/referral-qr?data=${encodeURIComponent(link.trim())}&size=500&download=1`
  }, [link])
  const filename = referralQrDownloadFilename(downloadLabelPrefix, code)

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (!link) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 p-4 text-sm text-brand-muted">
        {title}: no referral link yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-brand-border bg-white p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-brand-text">{title}</h3>
          {inactiveHint && !active ? (
            <p className="mt-1 text-xs text-brand-muted">{inactiveHint}</p>
          ) : null}
          <p className="mt-2 text-xs text-brand-dim">
            Code <span className="font-mono font-semibold text-brand-text">{code || '—'}</span>
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-xs text-brand-text"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="shrink-0 px-3 py-2.5 bg-brand-text text-white text-xs font-semibold rounded-lg"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <a
            href={downloadHref}
            download={filename}
            className={`mt-3 inline-flex px-3 py-2 text-xs font-semibold rounded-lg border border-brand-border hover:bg-neutral-50 ${
              active ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            Download QR code
          </a>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-2">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrSrc}
              alt={`QR code for ${title}`}
              width={200}
              height={200}
              className="rounded-lg border border-brand-border bg-white p-2"
            />
          ) : null}
          <span className="text-[10px] text-brand-dim text-center max-w-[200px]">
            Scans to your credit intake link
          </span>
        </div>
      </div>
    </div>
  )
}
