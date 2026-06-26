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

export function CtaBlockGraphic({
  copy,
  format,
  backgroundStyle,
  logoVariant,
  showSafeZone,
  backgroundImageUrl,
}: TemplateRenderProps) {
  const theme = getTemplateTheme(backgroundStyle, logoVariant)
  const pad = paddingForFormat(format)
  const isCompact = format.height <= 250

  return (
    <div
      style={{
        ...artboardStyle(format, backgroundStyle, backgroundImageUrl),
        background: backgroundImageUrl
          ? artboardStyle(format, backgroundStyle, backgroundImageUrl).background
          : backgroundStyle === 'white'
            ? brandColors.bgSoft
            : artboardStyle(format, backgroundStyle).background,
      }}
      data-graphic-artboard
    >
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
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: pad,
          boxSizing: 'border-box',
          gap: isCompact ? 10 : 20,
        }}
      >
        {!isCompact && (
          <div style={{ position: 'absolute', top: pad, left: pad }}>
            <LogoBlock format={format} logoVariant={theme.logoVariant} textColor={theme.textColor} />
          </div>
        )}

        <div style={{ maxWidth: '88%' }}>
          <div
            style={{
              fontSize: headlineSize(format) * (isCompact ? 0.85 : 1),
              fontWeight: brandFonts.weights.extrabold,
              lineHeight: 1.15,
              color: theme.textColor,
            }}
          >
            {copy.headline}{' '}
            {copy.accentPhrase && (
              <span style={{ color: brandColors.accent, fontStyle: 'italic' }}>{copy.accentPhrase}</span>
            )}
          </div>
        </div>

        {copy.body && !isCompact && (
          <div
            style={{
              fontSize: bodySize(format),
              lineHeight: 1.55,
              color: theme.mutedColor,
              maxWidth: '75%',
            }}
          >
            {copy.body}
          </div>
        )}

        {copy.ctaLabel && !isCompact && <CtaButton label={copy.ctaLabel} />}

        {copy.footer && (
          <div style={{ position: 'absolute', bottom: pad }}>
            <FooterText text={copy.footer} mutedColor={theme.mutedColor} />
          </div>
        )}
      </div>
    </div>
  )
}
