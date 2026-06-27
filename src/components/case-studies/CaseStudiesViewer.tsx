'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const CaseStudyPdfSheet = dynamic(() => import('@/components/case-studies/CaseStudyPdfSheet'), {
  ssr: false,
  loading: () => <p className="p-8 text-sm text-brand-muted text-center">Loading PDF viewer…</p>,
})

export interface CaseStudyItem {
  id: string
  title: string
  pdf_url: string
  updated_at: string
}

interface Props {
  initialStudies: CaseStudyItem[]
}

export default function CaseStudiesViewer({ initialStudies }: Props) {
  const [studies] = useState<CaseStudyItem[]>(initialStudies)
  const [selectedId, setSelectedId] = useState<string | null>(initialStudies[0]?.id ?? null)

  const selected = studies.find((s) => s.id === selectedId) ?? studies[0]

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
          <CaseStudyPdfSheet key={selected.id} url={selected.pdf_url} title={selected.title} />
        </div>
      )}
    </div>
  )
}
