import { readFile } from 'fs/promises'
import path from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { brandLogos, type LogoVariant } from '@/lib/brand-tokens'
import { buildGeminiPrompt } from './gemini-brand-brief'
import { getGeminiAspectRatio, getGeminiImageSize } from './gemini-aspect-ratio'
import { getFormatById } from './formats'
import type {
  GeminiGenerationMode,
  GeneratedGeminiImage,
  GraphicCopy,
  GraphicFormatId,
  GraphicTemplateId,
} from './types'

const DEFAULT_MODEL = 'gemini-2.5-flash-image-preview'

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured. Add it in .env.local and Vercel.')
  }
  return key
}

function getModelName(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_MODEL
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

function extractImagesFromResponse(response: Awaited<ReturnType<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>>): {
  mimeType: string
  data: string
}[] {
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

export async function generateGeminiMarketingImages(params: {
  copy: GraphicCopy
  templateId: GraphicTemplateId
  formatId: GraphicFormatId
  mode: GeminiGenerationMode
  logoVariant: LogoVariant
  variantCount: number
}): Promise<{ images: GeneratedGeminiImage[]; model: string; promptSample: string }> {
  const format = getFormatById(params.formatId)
  if (!format) throw new Error('Invalid format')

  const apiKey = getApiKey()
  const modelName = getModelName()
  const genAI = new GoogleGenerativeAI(apiKey)

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: getGeminiAspectRatio(format),
        imageSize: getGeminiImageSize(format),
      },
    } as Record<string, unknown>,
  })

  const logoInline = params.mode === 'full' ? await loadLogoInline(params.logoVariant) : null
  const count = Math.min(Math.max(params.variantCount, 1), 4)
  const images: GeneratedGeminiImage[] = []
  let promptSample = ''

  for (let i = 0; i < count; i++) {
    const prompt = buildGeminiPrompt({
      copy: params.copy,
      templateId: params.templateId,
      formatId: params.formatId,
      mode: params.mode,
      logoVariant: params.logoVariant,
      variantIndex: i + 1,
      variantTotal: count,
    })
    if (i === 0) promptSample = prompt

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }]
    if (logoInline) {
      parts.push({ inlineData: logoInline })
    }

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
    const extracted = extractImagesFromResponse(result)

    if (extracted.length === 0) {
      const text = result.response.text?.()
      throw new Error(
        text
          ? `Model returned text instead of an image: ${text.slice(0, 200)}`
          : 'No image returned. Try GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview or enable billing in Google AI Studio.'
      )
    }

    const img = extracted[0]
    images.push({
      id: `gemini-${Date.now()}-${i}`,
      mimeType: img.mimeType,
      dataUrl: `data:${img.mimeType};base64,${img.data}`,
    })
  }

  return { images, model: modelName, promptSample }
}
