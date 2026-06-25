'use client'

import { useEffect, useState } from 'react'

interface CaseStudyItem {
  id: string
  title: string
  pdf_url: string
  updated_at: string
}

function pdfEmbedUrl(url: string): string {
  const base = url.split('#')[0]
  return `${base}#toolbar=0&navpanes=0&scrollbar=1`
}

export default function CaseStudiesViewer() {
  const [studies, setStudies] = useState<CaseStudyItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/case-studies')
        if (!res.ok) throw new Error('Failed to load case studies')
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setStudies(list)
        if (list.length > 0) setSelectedId(list[0].id)
        setError('')
      } catch (err) {
        console.error(err)
        setError('Unable to load case studies right now.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const selected = studies.find((s) => s.id === selectedId) ?? studies[0]

  if (loading) {
    return <p className="text-sm text-brand-muted">Loading case studies…</p>
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
        {error}
      </div>
    )
  }

  if (studies.length === 0) {
    return (
      <div className="p-10 text-center rounded-xl border border-brand-border bg-white">
        <p className="text-brand-muted text-sm">Case studies will appear here soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {studies.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
          {studies.map((study) => {
            const active = study.id === selected?.id
            return (
              <button
                key={study.id}
                type="button"
                onClick={() => setSelectedId(study.id)}
                className={`shrink-0 snap-start px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                  active
                    ? 'bg-brand-text text-white border-brand-text'
                    : 'bg-white text-brand-muted border-brand-border hover:text-brand-text hover:border-neutral-300'
                }`}
              >
                {study.title}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-brand-border">
            <h2 className="font-serif text-xl font-bold text-brand-text">{selected.title}</h2>
          </div>
          <div className="bg-neutral-100">
            <iframe
              src={pdfEmbedUrl(selected.pdf_url)}
              title={`${selected.title} case study`}
              className="w-full h-[min(75vh,900px)] min-h-[420px] border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  )
}
