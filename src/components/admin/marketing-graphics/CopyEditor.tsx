'use client'

import type { BackgroundStyle, LogoVariant } from '@/lib/brand-tokens'
import { presetsForTemplate } from '@/lib/marketing-graphics/templates'
import type { GraphicCopy, GraphicTemplateId } from '@/lib/marketing-graphics/types'

interface CopyEditorProps {
  templateId: GraphicTemplateId
  copy: GraphicCopy
  backgroundStyle: BackgroundStyle
  logoVariant: LogoVariant
  onCopyChange: (copy: GraphicCopy) => void
  onBackgroundChange: (style: BackgroundStyle) => void
  onLogoChange: (variant: LogoVariant) => void
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  const cls =
    'w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-accent/30'
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-brand-dim uppercase tracking-wide">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input type="text" className={cls} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

export default function CopyEditor({
  templateId,
  copy,
  backgroundStyle,
  logoVariant,
  onCopyChange,
  onBackgroundChange,
  onLogoChange,
}: CopyEditorProps) {
  const presets = presetsForTemplate(templateId)
  const set = (key: keyof GraphicCopy, value: string) => onCopyChange({ ...copy, [key]: value })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dim mb-2">Presets</h3>
        <select
          className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm text-brand-text"
          defaultValue=""
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value)
            if (preset) onCopyChange({ ...copy, ...preset.copy })
            e.target.value = ''
          }}
        >
          <option value="" disabled>
            Load preset copy…
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-brand-dim uppercase tracking-wide">Background</span>
          <select
            className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm"
            value={backgroundStyle}
            onChange={(e) => onBackgroundChange(e.target.value as BackgroundStyle)}
          >
            <option value="white">White</option>
            <option value="soft">Soft gradient</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-brand-dim uppercase tracking-wide">Logo</span>
          <select
            className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm"
            value={logoVariant}
            onChange={(e) => onLogoChange(e.target.value as LogoVariant)}
          >
            <option value="black">Black logo</option>
            <option value="white">White logo</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {(templateId === 'heroQuote' || templateId === 'packagePromo') && (
          <Field label="Badge / Tier" value={copy.badge || copy.tier || ''} onChange={(v) => set(templateId === 'packagePromo' ? 'tier' : 'badge', v)} />
        )}
        {templateId === 'serviceSpotlight' && (
          <Field label="Icon (emoji)" value={copy.icon || ''} onChange={(v) => set('icon', v)} />
        )}
        <Field label="Headline" value={copy.headline} onChange={(v) => set('headline', v)} />
        {(templateId === 'heroQuote' || templateId === 'ctaBlock') && (
          <Field label="Accent phrase" value={copy.accentPhrase || ''} onChange={(v) => set('accentPhrase', v)} />
        )}
        {templateId === 'packagePromo' && (
          <Field label="Price" value={copy.price || ''} onChange={(v) => set('price', v)} />
        )}
        {templateId !== 'statProof' && (
          <Field label="Body" value={copy.body || ''} onChange={(v) => set('body', v)} multiline />
        )}
        {templateId === 'statProof' && (
          <>
            <Field label="Stat 1 value" value={copy.stat1Value || ''} onChange={(v) => set('stat1Value', v)} />
            <Field label="Stat 1 label" value={copy.stat1Label || ''} onChange={(v) => set('stat1Label', v)} />
            <Field label="Stat 2 value" value={copy.stat2Value || ''} onChange={(v) => set('stat2Value', v)} />
            <Field label="Stat 2 label" value={copy.stat2Label || ''} onChange={(v) => set('stat2Label', v)} />
            <Field label="Stat 3 value" value={copy.stat3Value || ''} onChange={(v) => set('stat3Value', v)} />
            <Field label="Stat 3 label" value={copy.stat3Label || ''} onChange={(v) => set('stat3Label', v)} />
          </>
        )}
        {(templateId === 'heroQuote' || templateId === 'ctaBlock' || templateId === 'packagePromo') && (
          <Field label="CTA label" value={copy.ctaLabel || ''} onChange={(v) => set('ctaLabel', v)} />
        )}
        <Field label="Footer (URL / email)" value={copy.footer || ''} onChange={(v) => set('footer', v)} />
      </div>
    </div>
  )
}
