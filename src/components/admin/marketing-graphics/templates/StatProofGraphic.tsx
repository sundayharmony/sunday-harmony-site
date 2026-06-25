import { brandColors, brandFonts } from '@/lib/brand-tokens'
import type { TemplateRenderProps } from './shared'
import {
  artboardStyle,
  FooterText,
  getTemplateTheme,
  headlineSize,
  LogoBlock,
  paddingForFormat,
  safeZoneOverlayStyle,
} from './shared'

function StatBlock({
  value,
  label,
  textColor,
  mutedColor,
  compact,
}: {
  value: string
  label: string
  textColor: string
  mutedColor: string
  compact?: boolean
}) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div
        style={{
          fontSize: compact ? 28 : 42,
          fontWeight: brandFonts.weights.extrabold,
          color: brandColors.accent,
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: compact ? 11 : 14,
          fontWeight: brandFonts.weights.medium,
          color: mutedColor,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  )
}

export function StatProofGraphic({
  copy,
  format,
  backgroundStyle,
  logoVariant,
  showSafeZone,
}: TemplateRenderProps) {
  const theme = getTemplateTheme(backgroundStyle, logoVariant)
  const pad = paddingForFormat(format)
  const compact = format.height <= 700 || format.id === 'businessCard'
  const stats = [
    { value: copy.stat1Value, label: copy.stat1Label },
    { value: copy.stat2Value, label: copy.stat2Label },
    { value: copy.stat3Value, label: copy.stat3Label },
  ].filter((s) => s.value && s.label)

  return (
    <div style={artboardStyle(format, backgroundStyle)} data-graphic-artboard>
      {showSafeZone && safeZoneOverlayStyle(format) && (
        <div style={safeZoneOverlayStyle(format)!} />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: pad,
          boxSizing: 'border-box',
        }}
      >
        <LogoBlock format={format} logoVariant={theme.logoVariant} textColor={theme.textColor} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: compact ? 20 : 36 }}>
          {copy.headline && (
            <div
              style={{
                fontSize: headlineSize(format) * 0.75,
                fontWeight: brandFonts.weights.extrabold,
                color: theme.textColor,
                textAlign: 'center',
              }}
            >
              {copy.headline}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: compact && format.height > format.width ? 'column' : 'row',
              gap: compact ? 16 : 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {stats.map((s, i) => (
              <StatBlock
                key={i}
                value={s.value!}
                label={s.label!}
                textColor={theme.textColor}
                mutedColor={theme.mutedColor}
                compact={compact}
              />
            ))}
          </div>
        </div>

        {copy.footer && <FooterText text={copy.footer} mutedColor={theme.mutedColor} />}
      </div>
    </div>
  )
}
