import type { BackgroundStyle, LogoVariant } from '@/lib/brand-tokens'

export type GraphicTemplateId =
  | 'heroQuote'
  | 'ctaBlock'
  | 'serviceSpotlight'
  | 'statProof'
  | 'packagePromo'

export type GraphicFormatId =
  | 'instagramPost'
  | 'storyReel'
  | 'linkedinPost'
  | 'ogShare'
  | 'emailHeader'
  | 'flyer'
  | 'businessCard'
  | 'onePager'

export interface GraphicFormat {
  id: GraphicFormatId
  label: string
  width: number
  height: number
  category: 'social' | 'web' | 'print'
  /** Safe margin in px from edges (print formats) */
  safeMargin?: number
}

export interface GraphicCopy {
  badge?: string
  headline: string
  accentPhrase?: string
  subheadline?: string
  body?: string
  ctaLabel?: string
  footer?: string
  icon?: string
  stat1Value?: string
  stat1Label?: string
  stat2Value?: string
  stat2Label?: string
  stat3Value?: string
  stat3Label?: string
  price?: string
  tier?: string
}

export interface GraphicState {
  templateId: GraphicTemplateId
  formatId: GraphicFormatId
  copy: GraphicCopy
  backgroundStyle: BackgroundStyle
  logoVariant: LogoVariant
}

export interface GraphicTemplateMeta {
  id: GraphicTemplateId
  label: string
  description: string
}

export interface GraphicPreset {
  id: string
  label: string
  templateId: GraphicTemplateId
  copy: Partial<GraphicCopy>
}
