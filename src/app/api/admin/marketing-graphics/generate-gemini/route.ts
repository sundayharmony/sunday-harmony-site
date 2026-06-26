import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { generateGeminiMarketingImages } from '@/lib/marketing-graphics/gemini-generate'
import type {
  GeminiGenerationMode,
  GraphicCopy,
  GraphicFormatId,
  GraphicTemplateId,
} from '@/lib/marketing-graphics/types'
import type { LogoVariant } from '@/lib/brand-tokens'

const TEMPLATE_IDS = new Set<GraphicTemplateId>([
  'heroQuote',
  'ctaBlock',
  'serviceSpotlight',
  'statProof',
  'packagePromo',
])

const FORMAT_IDS = new Set<GraphicFormatId>([
  'instagramPost',
  'storyReel',
  'linkedinPost',
  'ogShare',
  'emailHeader',
  'flyer',
  'businessCard',
  'onePager',
])

function parseCopy(raw: unknown): GraphicCopy | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.headline !== 'string' || !o.headline.trim()) return null
  return {
    badge: typeof o.badge === 'string' ? o.badge : undefined,
    headline: o.headline.trim(),
    accentPhrase: typeof o.accentPhrase === 'string' ? o.accentPhrase : undefined,
    subheadline: typeof o.subheadline === 'string' ? o.subheadline : undefined,
    body: typeof o.body === 'string' ? o.body : undefined,
    ctaLabel: typeof o.ctaLabel === 'string' ? o.ctaLabel : undefined,
    footer: typeof o.footer === 'string' ? o.footer : undefined,
    icon: typeof o.icon === 'string' ? o.icon : undefined,
    stat1Value: typeof o.stat1Value === 'string' ? o.stat1Value : undefined,
    stat1Label: typeof o.stat1Label === 'string' ? o.stat1Label : undefined,
    stat2Value: typeof o.stat2Value === 'string' ? o.stat2Value : undefined,
    stat2Label: typeof o.stat2Label === 'string' ? o.stat2Label : undefined,
    stat3Value: typeof o.stat3Value === 'string' ? o.stat3Value : undefined,
    stat3Label: typeof o.stat3Label === 'string' ? o.stat3Label : undefined,
    price: typeof o.price === 'string' ? o.price : undefined,
    tier: typeof o.tier === 'string' ? o.tier : undefined,
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const copy = parseCopy(body.copy)
    if (!copy) {
      return NextResponse.json({ error: 'Headline is required in copy' }, { status: 400 })
    }

    const templateId = body.templateId as GraphicTemplateId
    const formatId = body.formatId as GraphicFormatId
    if (!TEMPLATE_IDS.has(templateId) || !FORMAT_IDS.has(formatId)) {
      return NextResponse.json({ error: 'Invalid templateId or formatId' }, { status: 400 })
    }

    const mode: GeminiGenerationMode = body.mode === 'background' ? 'background' : 'full'
    const logoVariant: LogoVariant =
      body.logoVariant === 'white' || body.logoVariant === 'hidden' ? body.logoVariant : 'black'

    const variantCount =
      typeof body.variantCount === 'number' ? body.variantCount : Number(body.variantCount) || 2

    const result = await generateGeminiMarketingImages({
      copy,
      templateId,
      formatId,
      mode,
      logoVariant,
      variantCount,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/admin/marketing-graphics/generate-gemini error:', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
