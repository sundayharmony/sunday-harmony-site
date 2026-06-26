'use client'

import { useState } from 'react'
import { downloadDataUrl } from '@/lib/marketing-graphics/download-data-url'
import { buildExportFilename } from '@/lib/marketing-graphics/export-graphic'
import type {
  GeminiGenerationMode,
  GeneratedGeminiImage,
  GraphicState,
} from '@/lib/marketing-graphics/types'

interface GeminiGeneratorPanelProps {
  state: GraphicState
  onUseAsBackground: (dataUrl: string) => void
  onSwitchToTemplate: () => void
}

export default function GeminiGeneratorPanel({
  state,
  onUseAsBackground,
  onSwitchToTemplate,
}: GeminiGeneratorPanelProps) {
  const [mode, setMode] = useState<GeminiGenerationMode>('full')
  const [variantCount, setVariantCount] = useState(2)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<GeneratedGeminiImage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState('')

  const selected = images.find((img) => img.id === selectedId) ?? null

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setImages([])
    setSelectedId(null)
    try {
      const res = await fetch('/api/admin/marketing-graphics/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copy: state.copy,
          templateId: state.templateId,
          formatId: state.formatId,
          mode,
          logoVariant: state.logoVariant,
          variantCount,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Generation failed')
        return
      }
      const list = (body.images ?? []) as GeneratedGeminiImage[]
      setImages(list)
      setModelUsed(typeof body.model === 'string' ? body.model : '')
      if (list.length > 0) setSelectedId(list[0].id)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadSelected = () => {
    if (!selected) return
    const ext = selected.mimeType.includes('jpeg') ? 'jpg' : 'png'
    const base = buildExportFilename(state.templateId, state.formatId, 1).replace(/\.png$/, '')
    downloadDataUrl(selected.dataUrl, `${base}-gemini.${ext}`)
  }

  const handleUseBackground = () => {
    if (!selected) return
    onUseAsBackground(selected.dataUrl)
    onSwitchToTemplate()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-brand-dim uppercase tracking-wide">Generation mode</span>
          <select
            className="block px-3 py-2 rounded-lg border border-brand-border bg-white text-sm min-w-[200px]"
            value={mode}
            onChange={(e) => setMode(e.target.value as GeminiGenerationMode)}
          >
            <option value="full">Full ad (logo + exact copy in image)</option>
            <option value="background">Background only (composite with template)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-brand-dim uppercase tracking-wide">Variants</span>
          <select
            className="block px-3 py-2 rounded-lg border border-brand-border bg-white text-sm"
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="px-5 py-2.5 rounded-lg bg-brand-text text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
        >
          {generating ? 'Generating with Gemini…' : 'Generate with Gemini'}
        </button>
      </div>

      <p className="text-xs text-brand-muted leading-relaxed max-w-3xl">
        Sends your exact copy, brand colors, and logo PNG to Gemini. Review every variant before publishing.
        {mode === 'background' && ' After selecting a variant, use “Apply as template background” then export from the Template tab.'}
      </p>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">{error}</div>
      )}

      {modelUsed && images.length > 0 && (
        <p className="text-[10px] text-brand-dim font-semibold uppercase tracking-wide">Model: {modelUsed}</p>
      )}

      {images.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedId(img.id)}
                className={`rounded-xl border-2 overflow-hidden text-left transition-all ${
                  selectedId === img.id ? 'border-accent ring-2 ring-accent/20' : 'border-brand-border hover:border-neutral-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt="Gemini variant" className="w-full h-auto block bg-neutral-100" />
                <div className="px-3 py-2 text-xs font-semibold text-brand-muted bg-white">
                  {selectedId === img.id ? 'Selected for review' : 'Click to select'}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-brand-border">
            <button
              type="button"
              disabled={!selected}
              onClick={handleDownloadSelected}
              className="px-4 py-2 rounded-lg bg-brand-text text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              Approve &amp; download PNG
            </button>
            {mode === 'background' && (
              <button
                type="button"
                disabled={!selected}
                onClick={handleUseBackground}
                className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
              >
                Apply as template background
              </button>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="px-4 py-2 rounded-lg border border-brand-border text-sm font-semibold text-brand-muted hover:bg-neutral-50 disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>

          <div className="rounded-lg bg-accent-soft border border-brand-border px-4 py-3 text-xs text-brand-muted">
            <strong className="text-brand-text">Review checklist:</strong> Logo correct? Copy matches exactly? Colors
            on-brand? No typos or extra text? Safe margins for Story/Reel?
          </div>
        </>
      )}
    </div>
  )
}
