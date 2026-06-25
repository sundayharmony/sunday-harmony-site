'use client'

import { useEffect, useRef, useState } from 'react'
import { getFormatById } from '@/lib/marketing-graphics/formats'
import { GraphicTemplateRenderer } from './templates'
import type { GraphicFormat, GraphicState } from '@/lib/marketing-graphics/types'

interface GraphicPreviewProps {
  state: GraphicState
  exportRef?: React.Ref<HTMLDivElement>
}

export default function GraphicPreview({ state, exportRef }: GraphicPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const format = getFormatById(state.formatId)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !format) return

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth
      const padding = 32
      const maxW = width - padding
      const maxH = 520
      const scaleW = maxW / format.width
      const scaleH = maxH / format.height
      setScale(Math.min(scaleW, scaleH, 1))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [format])

  if (!format) return null

  const isPrint = format.category === 'print'

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center gap-3">
      <div className="text-xs text-brand-dim font-semibold">
        {format.width} × {format.height} — {format.label}
        {isPrint && ' · Safe zone shown'}
      </div>
      <div
        className="relative overflow-hidden rounded-xl border border-brand-border bg-neutral-100 shadow-sm"
        style={{
          width: format.width * scale,
          height: format.height * scale,
        }}
      >
        <div
          ref={exportRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: format.width,
            height: format.height,
          }}
        >
          <GraphicTemplateRenderer
            templateId={state.templateId}
            copy={state.copy}
            format={format}
            backgroundStyle={state.backgroundStyle}
            logoVariant={state.logoVariant}
            showSafeZone={isPrint}
          />
        </div>
      </div>
    </div>
  )
}

export type { GraphicFormat }
