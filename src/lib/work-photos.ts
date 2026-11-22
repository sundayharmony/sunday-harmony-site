/**
 * Public-page photographs. `src` stays empty until a generated file is dropped in.
 * Alt text is the accessible name; `label` is the short caption under the frame.
 */
export const workPhotos = [
  {
    id: 'fit-table',
    label: 'On the table',
    alt: 'Sunlit wooden table with warm cream business cards, a paper color palette, and a small plant.',
    src: '',
  },
  {
    id: 'work-cards',
    label: 'Cards',
    alt: 'A hand holding warm cream business cards with a simple gold-edged mark, over linen in afternoon light.',
    src: '',
  },
  {
    id: 'work-window',
    label: 'The window',
    alt: 'A small shop window with a hand-lettered welcome sign, warm wood, and soft daylight on the glass.',
    src: '',
  },
  {
    id: 'work-board',
    label: 'The board',
    alt: 'Hands arranging a mood board of warm paper, cloth swatches, and a pencil logo sketch.',
    src: '',
  },
  {
    id: 'about-desk',
    label: 'The desk',
    alt: 'A welcoming studio desk with brand guidelines open beside a plant and morning light.',
    src: '',
  },
  {
    id: 'services-guides',
    label: 'Guidelines',
    alt: 'Brand guidelines, warm color chips, and a logo sketch laid out on cream paper.',
    src: '',
  },
  {
    id: 'contact-note',
    label: 'A note',
    alt: 'A handwritten note and a brand booklet on a sunlit desk, set for a conversation.',
    src: '',
  },
  {
    id: 'book-tea',
    label: 'Before the call',
    alt: 'An open paper calendar and a cup of tea beside brand samples in a bright, warm room.',
    src: '',
  },
  {
    id: 'fund-kitchen',
    label: 'At the table',
    alt: 'Warm printed brand pages spread on a kitchen table in late-day light, ready to review.',
    src: '',
  },
  {
    id: 'credit-linen',
    label: 'Printed work',
    alt: 'Careful printed brand pieces resting on warm linen, with soft window light and no harsh contrast.',
    src: '',
  },
  {
    id: 'funding-paper',
    label: 'Paper samples',
    alt: 'Warm paper samples and a simple logo print stacked on a light wood desk.',
    src: '',
  },
  {
    id: 'privacy-shelf',
    label: 'The shelf',
    alt: 'A neat shelf of warm brand booklets and envelopes in a bright, quiet studio corner.',
    src: '',
  },
  {
    id: 'cancel-light',
    label: 'Studio light',
    alt: 'A quiet studio corner with warm paper, a pencil, and soft daylight on a wooden sill.',
    src: '',
  },
] as const

export type WorkPhotoId = (typeof workPhotos)[number]['id']

export function workPhoto(id: WorkPhotoId) {
  const photo = workPhotos.find((item) => item.id === id)
  if (!photo) throw new Error(`Unknown work photo: ${id}`)
  return photo
}
