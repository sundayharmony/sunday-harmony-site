'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { competitors, vulnerabilities, positioningCanvas } from '@/lib/toolkit-data'

const threatColor = { high: 'text-brand-red', medium: 'text-brand-gold', low: 'text-brand-green' }
const threatBg = { high: 'bg-red-50', medium: 'bg-amber-50', low: 'bg-green-50' }
const priorityColor = { critical: 'text-brand-red', high: 'text-brand-gold', medium: 'text-brand-blue' }

export default function CompetitorsPage() {
  const [tab, setTab] = useState<'landscape' | 'gaps' | 'positioning'>('landscape')
  const [selected, setSelected] = useState(0)
  const [canvasValues, setCanvasValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/admin/data').then(r => r.json()).then(d => {
      if (d.positioning_canvas && Object.keys(d.positioning_canvas).length > 0) setCanvasValues(d.positioning_canvas)
    }).catch(() => {})
  }, [])

  const saveCanvas = useCallback((values: Record<string, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        const res = await fetch('/api/admin/data', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positioning_canvas: values }),
        })
        if (!res.ok) throw new Error('Failed to save')
        setError('')
      } catch (err) {
        setError('Failed to save. Please try again.')
        console.error(err)
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [])

  const updateCanvas = (label: string, value: string) => {
    const updated = { ...canvasValues, [label]: value }
    setCanvasValues(updated)
    saveCanvas(updated)
  }

  const c = competitors[selected]

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Competitive Analysis</h1>
          <p className="text-sm text-brand-muted">Map the NJ landscape, find gaps, and define your positioning.</p>
        </div>
        <div className="flex items-center gap-3">
          {error ? (
            <span className="text-xs text-red-600">Error saving</span>
          ) : saving ? (
            <span className="text-xs text-brand-gold animate-pulse">Saving...</span>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {([['landscape', 'Competitors'], ['gaps', 'Market Gaps'], ['positioning', 'Positioning Canvas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-[rgba(184,148,63,0.1)] border border-brand-gold text-brand-gold' : 'bg-gray-50 border border-brand-border text-brand-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'landscape' && (
        <div className="grid grid-cols-[200px_1fr] gap-6">
          <div className="space-y-2">
            {competitors.map((comp, i) => (
              <button key={i} onClick={() => setSelected(i)}
                className={`w-full text-left p-3 rounded-lg transition-all ${selected === i
                  ? 'bg-[rgba(184,148,63,0.08)] border border-brand-gold'
                  : 'bg-gray-50 border border-brand-border hover:bg-gray-100'}`}>
                <div className="text-sm font-semibold text-brand-text">{comp.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold uppercase ${threatColor[comp.threat]}`}>{comp.threat}</span>
                  <span className="text-[10px] text-brand-dim">{comp.price}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-text">{c.name}</h2>
                <span className="text-xs text-brand-dim">{c.type}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${c.threat === 'high' ? 'bg-red-50 text-red-700' : c.threat === 'medium' ? 'bg-[rgba(184,148,63,0.1)] text-brand-gold' : 'bg-green-50 text-green-700'}`}>{c.threat} threat</span>
            </div>

            <div className="flex gap-6 mb-4">
              {[['Price', c.price], ['Founded', c.founded], ['Team', c.team]].map(([l, v]) => (
                <div key={l as string}>
                  <div className="text-[10px] font-bold uppercase text-brand-dim">{l}</div>
                  <div className="text-sm text-brand-text">{v}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {c.services.map(s => (
                <span key={s} className="px-2.5 py-0.5 rounded-full text-[10px] bg-[rgba(184,148,63,0.1)] text-brand-gold border border-brand-gold">{s}</span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase text-brand-green mb-2">Strengths</div>
                {c.strengths.map((s, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-brand-muted"><span className="text-brand-green">+</span>{s}</div>
                ))}
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase text-brand-red mb-2">Weaknesses</div>
                {c.weaknesses.map((w, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-brand-muted"><span className="text-brand-red">−</span>{w}</div>
                ))}
              </div>
            </div>

            <div className="bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-lg p-4">
              <div className="text-[10px] font-bold uppercase text-brand-gold mb-2">Your Angle Against {c.name}</div>
              <p className="text-sm text-brand-muted leading-relaxed">{c.angle}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'gaps' && (
        <div className="space-y-3">
          {vulnerabilities.map((v, i) => (
            <div key={i} className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-bold text-brand-text">{v.gap}</h3>
                <span className={`text-[10px] font-bold uppercase ${priorityColor[v.priority]}`}>{v.priority}</span>
              </div>
              <div className="text-xs text-brand-dim mb-2">{v.stat}</div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-[10px] font-bold uppercase text-brand-green mb-1">Your Opportunity</div>
                <p className="text-sm text-brand-muted">{v.opportunity}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'positioning' && (
        <div>
          <div className="bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-xl p-4 mb-6">
            <div className="text-sm font-bold text-brand-gold mb-1">Positioning Canvas</div>
            <p className="text-xs text-brand-muted">
              Fill this out to crystallize your unique position in the market. Use what you learned from your research, competitor analysis, and customer interviews.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {positioningCanvas.map((field) => (
              <div
                key={field.label}
                className="bg-white border border-brand-border rounded-xl p-4 shadow-sm"
              >
                <label className="block text-xs font-bold text-brand-text mb-2">{field.label}</label>
                <textarea
                  value={canvasValues[field.label] || ''}
                  onChange={(e) => updateCanvas(field.label, e.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  className="w-full bg-[#fafaf8] border border-brand-border rounded-lg p-3 text-sm text-brand-text outline-none focus:border-brand-gold transition-colors resize-none placeholder:text-brand-dim"
                />
              </div>
            ))}
          </div>

          {canvasValues['One-Liner Pitch'] && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-[10px] font-bold uppercase text-brand-green mb-2">Your Pitch</div>
              <p className="text-lg font-serif font-bold text-brand-text">
                &ldquo;{canvasValues['One-Liner Pitch']}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
