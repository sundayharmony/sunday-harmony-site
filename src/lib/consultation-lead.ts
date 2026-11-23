/**
 * What a public booking may change on a lead that already exists for the same email.
 * The booking form is unauthenticated, so it never overwrites pipeline stage, status,
 * phone, business or message. It only appends a note that staff can review.
 */

const MAX_NOTE_FIELD = 500
const MAX_NOTES_TOTAL = 20000

function clip(value: string, max = MAX_NOTE_FIELD): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

export function consultationBookingNote(input: {
  whenLabel: string
  name: string
  phone: string
  business: string
  note: string
  now: Date
}): string {
  const lines = [
    `[${input.now.toISOString().slice(0, 10)}] Website consultation booked for ${clip(input.whenLabel, 120)}.`,
    `Entered on the booking form (unverified): name ${clip(input.name, 120) || '—'}; business ${clip(input.business, 200) || '—'}; phone ${clip(input.phone, 30) || '—'}.`,
  ]
  const note = clip(input.note)
  if (note) lines.push(`Note: ${note}`)
  return lines.join('\n')
}

/** Only `notes` changes. Older text is kept; the oldest is trimmed if notes grow very large. */
export function existingLeadUpdateForBooking(
  existingNotes: string | null | undefined,
  bookingNote: string
): { notes: string } {
  const previous = (existingNotes || '').trim()
  let notes = previous ? `${previous}\n\n${bookingNote}` : bookingNote
  if (notes.length > MAX_NOTES_TOTAL) notes = notes.slice(notes.length - MAX_NOTES_TOTAL)
  return { notes }
}
