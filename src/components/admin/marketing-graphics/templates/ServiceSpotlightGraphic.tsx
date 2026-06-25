import { brandColors, brandFonts } from '@/lib/brand-tokens'
import type { TemplateRenderProps } from './shared'
import {
  artboardStyle,
  bodySize,
  FooterText,
  getTemplateTheme,
  headlineSize,
  LogoBlock,
  paddingForFormat,
  safeZoneOverlayStyle,
} from './shared'

export function ServiceSpotlightGraphic({
  copy,
  format,
  backgroundStyle,
  logoVariant,
  showSafeZone,
}: TemplateRenderProps) {
  const theme = getTemplateTheme(backgroundStyle, logoVariant)
  const pad = paddingForFormat(format)
  const isCard = format.id === 'businessCard'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isCard ? 16 : 32 }}>
          <LogoBlock format={format} logoVariant={theme.logoVariant} textColor={theme.textColor} />
          {copy.icon && (
            <div style={{ fontSize: isCard ? 32 : 48, lineHeight: 1 }}>{copy.icon}</div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isCard ? 10 : 20 }}>
          <div
            style={{
              fontSize: headlineSize(format) * (isCard ? 0.9 : 1),
              fontWeight: brandFonts.weights.extrabold,
              lineHeight: 1.1,
              color: theme.textColor,
            }}
          >
            {copy.headline}
          </div>

          {copy.body && (
            <div
              style={{
                fontSize: bodySize(format),
                lineHeight: 1.55,
                color: theme.mutedColor,
                maxWidth: '92%',
              }}
            >
              {copy.body}
            </div>
          )}

          <div
            style={{
              width: 48,
              height: 4,
              borderRadius: 2,
              background: brandColors.accent,
              marginTop: 8,
            }}
          />
        </div>

        {copy.footer && (
          <FooterText text={copy.footer} mutedColor={theme.mutedColor} />
        )}
      </div>
    </div>
  )
}
