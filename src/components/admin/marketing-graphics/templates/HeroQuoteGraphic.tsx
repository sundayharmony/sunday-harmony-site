import { brandColors, brandFonts } from '@/lib/brand-tokens'
import type { TemplateRenderProps } from './shared'
import {
  artboardStyle,
  Badge,
  bodySize,
  CtaButton,
  FooterText,
  getTemplateTheme,
  gridOverlayStyle,
  headlineSize,
  LogoBlock,
  paddingForFormat,
  radialGlowStyle,
  safeZoneOverlayStyle,
} from './shared'

export function HeroQuoteGraphic({
  copy,
  format,
  backgroundStyle,
  logoVariant,
  showSafeZone,
  backgroundImageUrl,
}: TemplateRenderProps) {
  const theme = getTemplateTheme(backgroundStyle, logoVariant)
  const pad = paddingForFormat(format)
  const isVertical = format.height > format.width
  const isCompact = format.height <= 630 || format.id === 'businessCard'

  return (
    <div style={artboardStyle(format, backgroundStyle, backgroundImageUrl)} data-graphic-artboard>
      {!backgroundImageUrl && <div style={gridOverlayStyle()} />}
      {!backgroundImageUrl && <div style={radialGlowStyle()} />}
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
          justifyContent: 'space-between',
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
            gap: isCompact ? 12 : 20,
            padding: isVertical ? '24px 0' : '12px 0',
          }}
        >
          {copy.badge && !isCompact && <Badge>{copy.badge}</Badge>}

          <div>
            <div
              style={{
                fontSize: headlineSize(format),
                fontWeight: brandFonts.weights.extrabold,
                lineHeight: 1.05,
                color: theme.textColor,
                marginBottom: copy.accentPhrase ? 8 : 0,
              }}
            >
              {copy.headline}
            </div>
            {copy.accentPhrase && (
              <div
                style={{
                  fontSize: Math.round(headlineSize(format) * 0.92),
                  fontWeight: brandFonts.weights.extrabold,
                  fontStyle: 'italic',
                  color: brandColors.accent,
                  lineHeight: 1.1,
                }}
              >
                {copy.accentPhrase}
              </div>
            )}
          </div>

          {copy.body && !isCompact && (
            <div
              style={{
                fontSize: bodySize(format),
                lineHeight: 1.55,
                color: theme.mutedColor,
                maxWidth: isVertical ? '100%' : '85%',
              }}
            >
              {copy.body}
            </div>
          )}

          {copy.ctaLabel && !isCompact && (
            <CtaButton label={copy.ctaLabel} compact={format.height <= 700} />
          )}
        </div>

        {copy.footer && <FooterText text={copy.footer} mutedColor={theme.mutedColor} />}
      </div>
    </div>
  )
}
