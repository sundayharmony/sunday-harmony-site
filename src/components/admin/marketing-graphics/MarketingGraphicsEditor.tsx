'use client'

import { useCallback, useRef, useState } from 'react'
import { buildExportFilename, exportGraphicToPng } from '@/lib/marketing-graphics/export-graphic'
import { getDefaultCopy } from '@/lib/marketing-graphics/templates'
import type { GraphicFormatId, GraphicState, GraphicTemplateId } from '@/lib/marketing-graphics/types'
import CopyEditor from './CopyEditor'
import FormatPicker from './FormatPicker'
import GeminiGeneratorPanel from './GeminiGeneratorPanel'
import GraphicPreview from './GraphicPreview'
import TemplatePicker from './TemplatePicker'

type EditorTab = 'template' | 'gemini'

export default function MarketingGraphicsEditor() {
  const exportRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<EditorTab>('template')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const [state, setState] = useState<GraphicState>(() => ({
    templateId: 'heroQuote',
    formatId: 'instagramPost',
    copy: getDefaultCopy('heroQuote'),
    backgroundStyle: 'soft',
    logoVariant: 'black',
    aiBackgroundDataUrl: null,
  }))

  const handleTemplateChange = useCallback((templateId: GraphicTemplateId) => {
    setState((prev) => ({
      ...prev,
      templateId,
      copy: getDefaultCopy(templateId),
    }))
  }, [])

  const handleFormatChange = useCallback((formatId: GraphicFormatId) => {
    setState((prev) => ({ ...prev, formatId }))
  }, [])

  const handleBackgroundChange = useCallback((backgroundStyle: GraphicState['backgroundStyle']) => {
    setState((prev) => {
      const autoLogo =
        prev.logoVariant === 'hidden'
          ? 'hidden'
          : backgroundStyle === 'dark'
            ? 'white'
            : backgroundStyle === 'white' || backgroundStyle === 'soft'
              ? 'black'
              : prev.logoVariant
      return { ...prev, backgroundStyle, logoVariant: autoLogo as GraphicState['logoVariant'] }
    })
  }, [])

  const handleExport = async (pixelRatio: number) => {
    const node = exportRef.current?.querySelector('[data-graphic-artboard]') as HTMLElement | null
    if (!node) {
      setError('Preview not ready')
      return
    }
    setExporting(true)
    setError('')
    try {
      const filename = buildExportFilename(state.templateId, state.formatId, pixelRatio)
      await exportGraphicToPng(node, filename, pixelRatio)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl w-fit border border-brand-border">
        <button
          type="button"
          onClick={() => setTab('template')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'template' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          Template editor
        </button>
        <button
          type="button"
          onClick={() => setTab('gemini')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'gemini' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          AI generator (Gemini)
        </button>
      </div>

      {state.aiBackgroundDataUrl && tab === 'template' && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 rounded-lg bg-accent-soft border border-brand-border text-xs text-brand-muted">
          <span>AI background applied.</span>
          <button
            type="button"
            className="font-semibold text-accent hover:underline"
            onClick={() => setState((prev) => ({ ...prev, aiBackgroundDataUrl: null }))}
          >
            Remove background
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_300px] gap-6">
        <aside className="space-y-6 bg-white border border-brand-border rounded-2xl p-4 h-fit">
          <TemplatePicker value={state.templateId} onChange={handleTemplateChange} />
          <FormatPicker value={state.formatId} onChange={handleFormatChange} />
        </aside>

        <section className="bg-white border border-brand-border rounded-2xl p-6 min-h-[560px] flex flex-col">
          {tab === 'template' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-serif text-lg font-extrabold text-brand-text">Preview</h2>
                  <p className="text-xs text-brand-dim">Live preview scales to fit; export uses full resolution.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExport(1)}
                    className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold text-brand-text hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {exporting ? 'Exporting…' : 'Download PNG (1×)'}
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExport(2)}
                    className="px-4 py-2 rounded-lg bg-brand-text text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Download PNG (2×)
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">
                  {error}
                </div>
              )}

              <div className="flex-1 flex items-center justify-center">
                <GraphicPreview state={state} exportRef={exportRef} />
              </div>
            </>
          ) : (
            <GeminiGeneratorPanel
              state={state}
              onUseAsBackground={(dataUrl) => setState((prev) => ({ ...prev, aiBackgroundDataUrl: dataUrl }))}
              onSwitchToTemplate={() => setTab('template')}
            />
          )}
        </section>

        <aside className="bg-white border border-brand-border rounded-2xl p-4 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dim mb-3">Copy &amp; Style</h3>
          <CopyEditor
            templateId={state.templateId}
            copy={state.copy}
            backgroundStyle={state.backgroundStyle}
            logoVariant={state.logoVariant}
            onCopyChange={(copy) => setState((prev) => ({ ...prev, copy }))}
            onBackgroundChange={handleBackgroundChange}
            onLogoChange={(logoVariant) => setState((prev) => ({ ...prev, logoVariant }))}
          />
        </aside>
      </div>
    </div>
  )
}
