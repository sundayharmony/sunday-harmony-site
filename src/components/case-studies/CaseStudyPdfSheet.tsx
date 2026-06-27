'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  url: string
  title: string
}

export default function CaseStudyPdfSheet({ url, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setStatus('loading')
        setErrorMsg('')

        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

        const container = containerRef.current
        if (!container || cancelled) return

        container.innerHTML = ''

        const pdf = await pdfjs.getDocument({ url }).promise
        if (cancelled) return

        const containerWidth = container.clientWidth || container.offsetWidth || 800
        const maxPages = Math.min(pdf.numPages, 20)

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          if (cancelled) return

          const page = await pdf.getPage(pageNum)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = containerWidth / baseViewport.width
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.className = 'block w-full h-auto bg-white'
          canvas.setAttribute('aria-label', `${title} — page ${pageNum}`)

          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Could not create canvas')

          await page.render({ canvasContext: ctx, viewport }).promise
          container.appendChild(canvas)

          if (pageNum < pdf.numPages) {
            const gap = document.createElement('div')
            gap.className = 'h-px bg-brand-border'
            gap.setAttribute('aria-hidden', 'true')
            container.appendChild(gap)
          }
        }

        if (!cancelled) setStatus('ready')
      } catch (err) {
        console.error('PDF render error:', err)
        if (!cancelled) {
          setStatus('error')
          setErrorMsg('Unable to display this PDF inline.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url, title])

  return (
    <div className="bg-white">
      {status === 'loading' && (
        <p className="p-8 text-sm text-brand-muted text-center">Loading case study…</p>
      )}
      {status === 'error' && (
        <div className="p-8 text-center">
          <p className="text-sm text-brand-muted mb-3">{errorMsg}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent underline"
          >
            Open PDF in new tab
          </a>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
