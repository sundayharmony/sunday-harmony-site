import { brandColors, brandFonts, type LogoVariant } from '@/lib/brand-tokens'
import { siteConfig } from '@/lib/data'
import { getFormatById } from './formats'
import type { GeminiGenerationMode, GraphicCopy, GraphicFormatId, GraphicTemplateId } from './types'

const BRAND_SYSTEM = `You are a professional marketing designer for Sunday Harmony, an all-in-one marketing partner for businesses.

BRAND RULES (follow strictly):
- Style: Minimal, premium, monochrome base with a single gold accent. Clean whitespace. No clutter.
- Colors (use exactly): accent gold ${brandColors.accent}, soft gold ${brandColors.accentSoft}, text ${brandColors.text}, muted ${brandColors.muted}, white ${brandColors.bg}, border ${brandColors.border}.
- Typography: Bold sans-serif similar to ${brandFonts.family} — extrabold headlines, medium body, semibold labels.
- Mood: Trustworthy, local, professional. No cheesy stock-photo smiles, no fake awards, no competitor logos.
- Do NOT add watermarks, platform logos, or URLs not provided in the copy block.`

function copyBlock(copy: GraphicCopy, templateId: GraphicTemplateId): string {
  const lines: string[] = ['EXACT COPY (render verbatim — do not paraphrase or omit):']

  if (copy.badge) lines.push(`Badge: "${copy.badge}"`)
  if (copy.tier) lines.push(`Tier label: "${copy.tier}"`)
  if (copy.icon) lines.push(`Icon/emoji (optional decorative): ${copy.icon}`)
  lines.push(`Headline: "${copy.headline}"`)
  if (copy.accentPhrase) lines.push(`Accent phrase (gold, italic or emphasized): "${copy.accentPhrase}"`)
  if (copy.subheadline) lines.push(`Subheadline: "${copy.subheadline}"`)
  if (copy.body) lines.push(`Body: "${copy.body}"`)
  if (copy.price) lines.push(`Price: "${copy.price}"`)
  if (copy.ctaLabel) lines.push(`CTA button: "${copy.ctaLabel}"`)
  if (copy.footer) lines.push(`Footer: "${copy.footer}"`)
  if (copy.stat1Value) lines.push(`Stat 1: ${copy.stat1Value} — ${copy.stat1Label}`)
  if (copy.stat2Value) lines.push(`Stat 2: ${copy.stat2Value} — ${copy.stat2Label}`)
  if (copy.stat3Value) lines.push(`Stat 3: ${copy.stat3Value} — ${copy.stat3Label}`)

  lines.push(`Template style hint: ${templateId}`)
  return lines.join('\n')
}

export function buildGeminiPrompt(params: {
  copy: GraphicCopy
  templateId: GraphicTemplateId
  formatId: GraphicFormatId
  mode: GeminiGenerationMode
  logoVariant: LogoVariant
  variantIndex?: number
  variantTotal?: number
  customPrompt?: string
}): string {
  const format = getFormatById(params.formatId)
  const dimensions = format ? `${format.width}×${format.height}px (${format.label})` : params.formatId

  const variantNote =
    params.variantTotal && params.variantTotal > 1
      ? `\nThis is design variant ${params.variantIndex ?? 1} of ${params.variantTotal}. Use a distinct composition while keeping the same copy and brand rules.`
      : ''

  const custom =
    params.customPrompt?.trim()
      ? `\n\nADDITIONAL CREATIVE DIRECTION (follow unless it conflicts with brand rules or exact copy):\n${params.customPrompt.trim()}`
      : ''

  if (params.mode === 'background') {
    return `${BRAND_SYSTEM}

TASK: Generate a BACKGROUND ONLY for a marketing graphic (${dimensions}).
- Abstract/minimal background: soft white-to-gray gradient, subtle grid or radial glow, gold accent hints (#b8943f).
- NO text, NO logos, NO buttons, NO typography of any kind.
- Leave clear space in center and edges for text overlay.
- Match Sunday Harmony website hero aesthetic.${variantNote}${custom}`
  }

  return `${BRAND_SYSTEM}

TASK: Generate a complete marketing ad graphic (${dimensions}) for ${siteConfig.name}.
- Use the attached logo image exactly as provided (top-left or top-center). Do not redraw or replace it.
- Layout: Logo + headline dominant + gold accent on key phrase + body + dark CTA pill button + footer URL/email if provided.
- Render all copy below EXACTLY as written.

${copyBlock(params.copy, params.templateId)}${variantNote}${custom}`
}
