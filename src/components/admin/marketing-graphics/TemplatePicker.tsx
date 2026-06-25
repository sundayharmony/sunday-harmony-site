'use client'

import { GRAPHIC_TEMPLATES } from '@/lib/marketing-graphics/templates'
import type { GraphicTemplateId } from '@/lib/marketing-graphics/types'

interface TemplatePickerProps {
  value: GraphicTemplateId
  onChange: (id: GraphicTemplateId) => void
}

export default function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dim">Template</h3>
      <div className="space-y-1.5">
        {GRAPHIC_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
              value === t.id
                ? 'border-accent bg-accent-soft text-brand-text'
                : 'border-brand-border bg-white hover:bg-neutral-50 text-brand-muted'
            }`}
          >
            <div className="font-semibold text-brand-text">{t.label}</div>
            <div className="text-[11px] text-brand-dim mt-0.5">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
