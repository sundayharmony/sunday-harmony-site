import type { GraphicFormat } from './types'

/** Map export format to Gemini-supported aspect ratios. */
export function getGeminiAspectRatio(format: GraphicFormat): string {
  const ratio = format.width / format.height
  if (ratio >= 2.8) return '21:9'
  if (ratio >= 1.6) return '16:9'
  if (ratio >= 1.2) return '4:3'
  if (ratio <= 0.65) return '9:16'
  if (ratio <= 0.85) return '3:4'
  return '1:1'
}

export function getGeminiImageSize(format: GraphicFormat): '512' | '1K' | '2K' {
  const maxDim = Math.max(format.width, format.height)
  if (maxDim >= 1600) return '2K'
  if (maxDim <= 600) return '512'
  return '1K'
}
