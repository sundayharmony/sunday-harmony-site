'use client'

import { formatsByCategory } from '@/lib/marketing-graphics/formats'
import type { GraphicFormatId } from '@/lib/marketing-graphics/types'

interface FormatPickerProps {
  value: GraphicFormatId
  onChange: (id: GraphicFormatId) => void
}

const CATEGORIES = [
  { key: 'social' as const, label: 'Social' },
  { key: 'web' as const, label: 'Web' },
  { key: 'print' as const, label: 'Print' },
]

export default function FormatPicker({ value, onChange }: FormatPickerProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dim">Format / Size</h3>
      {CATEGORIES.map(({ key, label }) => {
        const formats = formatsByCategory(key)
        if (formats.length === 0) return null
        return (
          <div key={key}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-dim mb-1.5">{label}</div>
            <div className="space-y-1">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChange(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                    value === f.id
                      ? 'border-accent bg-accent-soft font-semibold text-brand-text'
                      : 'border-brand-border bg-white hover:bg-neutral-50 text-brand-muted'
                  }`}
                >
                  {f.label}
                  <span className="block text-[10px] text-brand-dim font-normal mt-0.5">
                    {f.width} × {f.height}px
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
