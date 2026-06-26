import { brandColors, brandFonts } from '@/lib/brand-tokens'
import type { TemplateRenderProps } from './shared'
import {
  artboardStyle,
  bodySize,
  CtaButton,
  FooterText,
  getTemplateTheme,
  headlineSize,
  LogoBlock,
  paddingForFormat,
  safeZoneOverlayStyle,
} from './shared'

export function PackagePromoGraphic({
  copy,
  format,
  backgroundStyle,
  logoVariant,
  showSafeZone,
  backgroundImageUrl,
}: TemplateRenderProps) {
  const theme = getTemplateTheme(backgroundStyle, logoVariant)
  const pad = paddingForFormat(format)
  const isCard = format.id === 'businessCard'

  return (
    <div style={artboardStyle(format, backgroundStyle, backgroundImageUrl)} data-graphic-artboard>
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

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isCard ? 10 : 18,
            marginTop: isCard ? 12 : 24,
          }}
        >
          <div
            style={{
              display: 'inline-block',
              alignSelf: 'flex-start',
              padding: '6px 14px',
              borderRadius: 6,
              border: `2px solid ${brandColors.accent}`,
              color: brandColors.accent,
              fontSize: isCard ? 11 : 14,
              fontWeight: brandFonts.weights.bold,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {copy.tier || 'Package'}
          </div>

          <div
            style={{
              fontSize: headlineSize(format) * (isCard ? 0.85 : 1),
              fontWeight: brandFonts.weights.extrabold,
              lineHeight: 1.1,
              color: theme.textColor,
            }}
          >
            {copy.headline}
          </div>

          {copy.price && (
            <div
              style={{
                fontSize: isCard ? 32 : 48,
                fontWeight: brandFonts.weights.extrabold,
                color: brandColors.accent,
                lineHeight: 1,
              }}
            >
              {copy.price}
            </div>
          )}

          {copy.body && !isCard && (
            <div
              style={{
                fontSize: bodySize(format),
                lineHeight: 1.55,
                color: theme.mutedColor,
                maxWidth: '90%',
              }}
            >
              {copy.body}
            </div>
          )}

          {copy.ctaLabel && !isCard && format.height > 400 && (
            <div style={{ marginTop: 8 }}>
              <CtaButton label={copy.ctaLabel} compact={format.height <= 700} />
            </div>
          )}
        </div>

        {copy.footer && <FooterText text={copy.footer} mutedColor={theme.mutedColor} />}
      </div>
    </div>
  )
}
