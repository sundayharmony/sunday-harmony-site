/** Lead-sheet headings. Other colons, such as "Google: 4.8", stay inside the paragraph. */
const NOTE_HEADINGS = ['Region', 'Opener', 'Research', 'Objection', 'Source', 'Owner'] as const

export type ProspectNoteSection = {
  label: string
  body: string
}

/**
 * Split a lead-sheet note into labeled parts.
 * Returns null when the note is freeform, so the caller can show it as one paragraph.
 */
export function prospectNoteSections(notes: string): ProspectNoteSection[] | null {
  const text = notes.replace(/\r\n/g, '\n').trim()
  if (!text) return null
  const heading = NOTE_HEADINGS.join('|')
  const re = new RegExp(`(?:^|\\n|\\s)(${heading}):\\s+`, 'g')
  const hits: Array<{ label: string; contentStart: number; headingStart: number }> = []
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    hits.push({
      label: match[1],
      headingStart: match.index + match[0].indexOf(match[1]),
      contentStart: match.index + match[0].length,
    })
  }
  if (hits.length === 0) return null
  const sections: ProspectNoteSection[] = []
  const preamble = text.slice(0, hits[0].headingStart).trim()
  if (preamble) sections.push({ label: 'Notes', body: preamble })
  hits.forEach((hit, index) => {
    const end = index + 1 < hits.length ? hits[index + 1].headingStart : text.length
    const body = text.slice(hit.contentStart, end).trim()
    if (body) sections.push({ label: hit.label, body })
  })
  return sections.length > 0 ? sections : null
}
