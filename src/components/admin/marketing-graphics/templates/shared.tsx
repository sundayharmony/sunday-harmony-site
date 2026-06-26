import {
  brandBackgrounds,
  brandColors,
  brandFonts,
  brandLogos,
  resolveBackground,
  type BackgroundStyle,
  type LogoVariant,
} from '@/lib/brand-tokens'
import type { GraphicCopy, GraphicFormat } from '@/lib/marketing-graphics/types'

export interface TemplateRenderProps {
  copy: GraphicCopy
  format: GraphicFormat
  backgroundStyle: BackgroundStyle
  logoVariant: LogoVariant
  showSafeZone?: boolean
  /** AI background image (composite mode) */
  backgroundImageUrl?: string | null
}

export function getTemplateTheme(backgroundStyle: BackgroundStyle, logoOverride?: LogoVariant) {
  const resolved = resolveBackground(backgroundStyle)
  const logoVariant =
    logoOverride === 'hidden'
      ? 'hidden'
      : logoOverride && logoOverride !== 'black'
        ? logoOverride
        : logoOverride === 'black'
          ? 'black'
          : resolved.logoVariant

  return { ...resolved, logoVariant }
}

export function logoWidthForFormat(format: GraphicFormat): number {
  if (format.category === 'print') return Math.min(format.width * 0.28, 280)
  if (format.height <= 200) return 120
  if (format.height >= 1600) return 220
  return 160
}

export function paddingForFormat(format: GraphicFormat): number {
  if (format.safeMargin) return format.safeMargin
  if (format.height <= 200) return 24
  if (format.width >= 1200 && format.height <= 700) return 48
  return 64
}

export function headlineSize(format: GraphicFormat): number {
  const min = Math.min(format.width, format.height)
  if (format.id === 'businessCard') return 28
  if (format.height <= 200) return 22
  if (min <= 1080) return Math.round(min * 0.055)
  return 56
}

export function bodySize(format: GraphicFormat): number {
  if (format.id === 'businessCard') return 14
  if (format.height <= 200) return 12
  if (format.height >= 1600) return 22
  return 18
}

export function artboardStyle(
  format: GraphicFormat,
  backgroundStyle: BackgroundStyle,
  backgroundImageUrl?: string | null
): React.CSSProperties {
  const theme = getTemplateTheme(backgroundStyle)
  return {
    width: format.width,
    height: format.height,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: brandFonts.family,
    background: backgroundImageUrl
      ? `url(${backgroundImageUrl}) center/cover no-repeat`
      : theme.background,
    color: theme.textColor,
    boxSizing: 'border-box',
  }
}

export function gridOverlayStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    backgroundImage: brandBackgrounds.gridPattern,
    backgroundSize: '48px 48px',
    pointerEvents: 'none',
    opacity: 0.6,
  }
}

export function radialGlowStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    top: '-20%',
    right: '-10%',
    width: '60%',
    height: '60%',
    background: brandBackgrounds.radialGlow,
    pointerEvents: 'none',
  }
}

export function safeZoneOverlayStyle(format: GraphicFormat): React.CSSProperties | null {
  if (!format.safeMargin) return null
  const m = format.safeMargin
  return {
    position: 'absolute',
    top: m,
    left: m,
    right: m,
    bottom: m,
    border: '2px dashed rgba(184, 148, 63, 0.45)',
    borderRadius: 8,
    pointerEvents: 'none',
    boxSizing: 'border-box',
  }
}

export function LogoBlock({
  format,
  logoVariant,
  textColor,
}: {
  format: GraphicFormat
  logoVariant: LogoVariant
  textColor: string
}) {
  if (logoVariant === 'hidden') return null
  const w = logoWidthForFormat(format)
  const h = w / brandLogos.aspectRatio
  const src = logoVariant === 'white' ? brandLogos.white : brandLogos.black

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Sunday Harmony"
      width={w}
      height={h}
      style={{ display: 'block', objectFit: 'contain' }}
      crossOrigin="anonymous"
    />
  )
}

export function Badge({ children, textColor }: { children: React.ReactNode; textColor?: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 999,
        background: brandColors.accentSoft,
        border: `1px solid ${brandColors.border}`,
        color: brandColors.accent,
        fontSize: 13,
        fontWeight: brandFonts.weights.semibold,
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: brandColors.accent,
          flexShrink: 0,
        }}
      />
      <span style={{ color: textColor ? brandColors.accent : undefined }}>{children}</span>
    </div>
  )
}

export function CtaButton({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: compact ? '10px 20px' : '14px 28px',
        borderRadius: 8,
        background: brandColors.text,
        color: brandColors.white,
        fontSize: compact ? 13 : 15,
        fontWeight: brandFonts.weights.semibold,
      }}
    >
      {label}
    </div>
  )
}

export function FooterText({ text, mutedColor }: { text: string; mutedColor: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: brandFonts.weights.medium,
        color: mutedColor,
        letterSpacing: '0.02em',
      }}
    >
      {text}
    </div>
  )
}
