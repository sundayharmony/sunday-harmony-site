/**
 * Real photographs used on public pages. Files are clean crops of generated
 * studio photos (the free-plan frames had a center watermark, so only the
 * unmarked regions are published).
 */
const shots = {
  hand: {
    src: '/work/hand.webp',
    width: 700,
    height: 480,
    label: 'At the table',
    alt: 'A hand beside a ceramic vase of small white flowers and a book on a sunlit wood table.',
  },
  table: {
    src: '/work/table.webp',
    width: 812,
    height: 484,
    label: 'Paper',
    alt: 'A stack of warm blank paper and a ceramic cup on a sunlit oak table, with a leaf shadow across the wood.',
  },
  linen: {
    src: '/work/linen.webp',
    width: 892,
    height: 564,
    label: 'Linen',
    alt: 'Oatmeal linen folded over blank warm paper on a wood table.',
  },
  cards: {
    src: '/work/cards.webp',
    width: 792,
    height: 484,
    label: 'Cards',
    alt: 'The edge of a thick stack of warm cotton cards resting on linen.',
  },
  window: {
    src: '/work/window.webp',
    width: 820,
    height: 444,
    label: 'Window',
    alt: 'A weathered white shop window with a leafy plant in warm afternoon light.',
  },
} as const

export type StoryShotId = keyof typeof shots

export const storyShotIds = ['table', 'linen', 'cards', 'window'] as const satisfies readonly StoryShotId[]

export function storyShot(id: StoryShotId) {
  return shots[id]
}

const pageShots = {
  'fit-table': 'table',
  'work-cards': 'cards',
  'work-window': 'window',
  'work-board': 'linen',
  'about-desk': 'hand',
  'services-guides': 'cards',
  'contact-note': 'linen',
  'book-tea': 'hand',
  'fund-kitchen': 'table',
  'credit-linen': 'linen',
  'funding-paper': 'table',
  'privacy-shelf': 'window',
  'cancel-light': 'window',
} as const

export const workPhotos = (Object.keys(pageShots) as (keyof typeof pageShots)[]).map((id) => ({
  id,
  ...shots[pageShots[id]],
}))

export type WorkPhotoId = (typeof workPhotos)[number]['id']

export function workPhoto(id: WorkPhotoId) {
  const photo = workPhotos.find((item) => item.id === id)
  if (!photo) throw new Error(`Unknown work photo: ${id}`)
  return photo
}
