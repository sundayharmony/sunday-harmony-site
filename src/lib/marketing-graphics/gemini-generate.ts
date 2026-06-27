import { readFile } from 'fs/promises'
import path from 'path'
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { brandLogos, type LogoVariant } from '@/lib/brand-tokens'
import { buildGeminiPrompt } from './gemini-brand-brief'
import { getGeminiAspectRatio } from './gemini-aspect-ratio'
import { getFormatById } from './formats'
import type {
  GeminiGenerationMode,
  GeneratedGeminiImage,
  GraphicCopy,
  GraphicFormatId,
  GraphicTemplateId,
} from './types'

const DEFAULT_MODEL = 'gemini-2.5-flash-image'

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured. Add it in .env.local and Vercel.')
  }
  return key
}

function getModelName(): string {
  const configured = process.env.GEMINI_IMAGE_MODEL?.trim()
  if (configured && configured.includes('preview')) {
    return 'gemini-2.5-flash-image'
  }
  return configured || DEFAULT_MODEL
}

async function loadLogoInline(logoVariant: LogoVariant): Promise<{ mimeType: string; data: string } | null> {
  if (logoVariant === 'hidden') return null
  const file = logoVariant === 'white' ? brandLogos.white : brandLogos.black
  const filePath = path.join(process.cwd(), 'public', file.replace(/^\//, ''))
  const buffer = await readFile(filePath)
  return {
    mimeType: 'image/png',
    data: buffer.toString('base64'),
  }
}

function createImageModel(genAI: GoogleGenerativeAI, modelName: string, formatId: GraphicFormatId): GenerativeModel {
  const format = getFormatById(formatId)
  if (!format) throw new Error('Invalid format')

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: getGeminiAspectRatio(format),
      },
    } as Record<string, unknown>,
  })
}

function extractImagesFromResponse(
  response: Awaited<ReturnType<GenerativeModel['generateContent']>>
): { mimeType: string; data: string }[] {
  const images: { mimeType: string; data: string }[] = []
  const candidates = response.response?.candidates ?? []
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if ('inlineData' in part && part.inlineData?.data) {
        images.push({
          mimeType: part.inlineData.mimeType || 'image/png',
          data: part.inlineData.data,
        })
      }
    }
  }
  return images
}

function formatGeminiError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes('404') && msg.includes('not found')) {
      return 'Gemini image model not found. Set GEMINI_IMAGE_MODEL=gemini-2.5-flash-image in Vercel or remove an outdated override.'
    }
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
      return 'Invalid GEMINI_API_KEY. Check the key in Google AI Studio and Vercel environment variables.'
    }
    if (msg.includes('quota') || msg.includes('429')) {
      return 'Gemini rate limit reached. Wait a moment and try again, or reduce variants to 1.'
    }
    return msg
  }
  return 'Generation failed'
}

async function generateOneVariant(
  model: GenerativeModel,
  prompt: string,
  logoInline: { mimeType: string; data: string } | null,
  index: number
): Promise<GeneratedGeminiImage> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  if (logoInline) {
    parts.push({ inlineData: logoInline })
  }
  parts.push({ text: prompt })

  let result: Awaited<ReturnType<GenerativeModel['generateContent']>>
  try {
    result = await model.generateContent({ contents: [{ role: 'user', parts }] })
  } catch (err) {
    throw new Error(formatGeminiError(err))
  }

  const extracted = extractImagesFromResponse(result)
  if (extracted.length === 0) {
    const text = result.response.text?.()
    throw new Error(
      text
        ? `Model returned text instead of an image: ${text.slice(0, 200)}`
        : 'No image returned. Enable billing for image models in Google AI Studio.'
    )
  }

  const img = extracted[0]
  return {
    id: `gemini-${Date.now()}-${index}`,
    mimeType: img.mimeType,
    dataUrl: `data:${img.mimeType};base64,${img.data}`,
  }
}

export async function generateGeminiMarketingImages(params: {
  copy: GraphicCopy
  templateId: GraphicTemplateId
  formatId: GraphicFormatId
  mode: GeminiGenerationMode
  logoVariant: LogoVariant
  variantCount: number
  customPrompt?: string
}): Promise<{ images: GeneratedGeminiImage[]; model: string; promptSample: string }> {
  const format = getFormatById(params.formatId)
  if (!format) throw new Error('Invalid format')

  const apiKey = getApiKey()
  const modelName = getModelName()
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = createImageModel(genAI, modelName, params.formatId)

  const logoInline = params.mode === 'full' ? await loadLogoInline(params.logoVariant) : null
  const count = Math.min(Math.max(params.variantCount, 1), 4)

  const prompts = Array.from({ length: count }, (_, i) =>
    buildGeminiPrompt({
      copy: params.copy,
      templateId: params.templateId,
      formatId: params.formatId,
      mode: params.mode,
      logoVariant: params.logoVariant,
      variantIndex: i + 1,
      variantTotal: count,
      customPrompt: params.customPrompt,
    })
  )

  const images: GeneratedGeminiImage[] = []
  const concurrency = 2
  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency)
    const batchImages = await Promise.all(
      batch.map((prompt, j) => generateOneVariant(model, prompt, logoInline, i + j))
    )
    images.push(...batchImages)
  }

  return { images, model: modelName, promptSample: prompts[0] }
}
