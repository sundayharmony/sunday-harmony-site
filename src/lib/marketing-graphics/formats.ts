import type { GraphicFormat } from './types'

export const GRAPHIC_FORMATS: GraphicFormat[] = [
  {
    id: 'instagramPost',
    label: 'Instagram / Facebook Post',
    width: 1080,
    height: 1080,
    category: 'social',
  },
  {
    id: 'storyReel',
    label: 'Story / Reel',
    width: 1080,
    height: 1920,
    category: 'social',
  },
  {
    id: 'linkedinPost',
    label: 'LinkedIn Post',
    width: 1200,
    height: 627,
    category: 'social',
  },
  {
    id: 'ogShare',
    label: 'OG / Link Share',
    width: 1200,
    height: 630,
    category: 'web',
  },
  {
    id: 'emailHeader',
    label: 'Email Header',
    width: 600,
    height: 200,
    category: 'web',
  },
  {
    id: 'flyer',
    label: 'Flyer (8.5×11 @150dpi)',
    width: 1275,
    height: 1650,
    category: 'print',
    safeMargin: 72,
  },
  {
    id: 'businessCard',
    label: 'Business Card (3.5×2 @300dpi)',
    width: 1050,
    height: 600,
    category: 'print',
    safeMargin: 48,
  },
  {
    id: 'onePager',
    label: 'One-Pager (8.5×11 @150dpi)',
    width: 1275,
    height: 1650,
    category: 'print',
    safeMargin: 72,
  },
]

export function getFormatById(id: string): GraphicFormat | undefined {
  return GRAPHIC_FORMATS.find((f) => f.id === id)
}

export function formatsByCategory(category: GraphicFormat['category']): GraphicFormat[] {
  return GRAPHIC_FORMATS.filter((f) => f.category === category)
}
