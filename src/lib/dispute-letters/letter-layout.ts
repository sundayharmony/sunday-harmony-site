import type { LetterPreviewBlock, LetterPreviewLayout, LetterPreviewVariant } from '@/lib/dispute-letters/types'

const SECTION_HEADINGS = new Set([
  'Consumer Identification',
  'Disputed Tradelines',
  'Statutory Reinvestigation Requirements',
  'Requested Outcome',
  'CONSUMER INFORMATION',
  'DISPUTED ITEMS',
  'STATUTORY REINVESTIGATION REQUIREMENTS',
  'REQUESTED OUTCOME',
])

const BULLET_RE = /^(?:●|•|▪|◦|[-*+])\s+/
const FIELD_LABEL_RE =
  /^(Full Name|Date of Birth|Current Address|Additional Addresses on File|Account Number|Reported Status|Reported Balance|Basis of Dispute)\s*:/i
const DATE_LINE_RE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s*$/

export function normalizeLetterSource(text: string): string {
  let next = text.trim()
  next = next.replace(/```[\w]*\n?/g, '').replace(/```/g, '')
  next = next.replace(/^#{1,6}\s+/gm, '')
  next = next.replace(/^[-*_]{3,}\s*$/gm, '')
  next = next.replace(/^(\s*)(?:[•▪◦]|\-|\*|\+)\s+/gm, '$1● ')
  next = next.replace(/\n{3,}/g, '\n\n')
  return next.trim()
}

function indentLevel(line: string): number {
  if (!line.trim()) return 0
  const leading = line.length - line.trimStart().length
  if (leading >= 8) return 2
  if (leading >= 4) return 1
  return 0
}

function isFieldLabelLine(line: string): boolean {
  return FIELD_LABEL_RE.test(line.trim())
}

function isSectionHeading(line: string): boolean {
  const stripped = line.trim()
  if (!stripped || stripped.endsWith(':') || stripped.includes('**')) return false
  if (isFieldLabelLine(stripped)) return false
  if (SECTION_HEADINGS.has(stripped)) return true
  if (/\d/.test(stripped)) return false
  if (stripped === stripped.toUpperCase()) return false
  const words = stripped.split(/\s+/)
  if (words.length < 2 || stripped.length > 55) return false
  const small = new Set(['of', 'and', 'the', 'or', 'to', 'a', 'an'])
  return words.every((w) => small.has(w.toLowerCase()) || /^[A-Z]/.test(w))
}

function isNameLine(line: string, index: number): boolean {
  const stripped = line.trim()
  if (index > 6 || !stripped || stripped.length > 60) return false
  if (/\d/.test(stripped)) return false
  const letters = stripped.replace(/[^A-Za-z]/g, '')
  if (letters.length < 4) return false
  return stripped === stripped.toUpperCase() && stripped.includes(' ')
}

function isTightLine(display: string, heading: boolean, nameLine: boolean, fieldLine: boolean): boolean {
  return fieldLine || (!heading && !nameLine && display.length < 70 && !display.includes(':'))
}

function extractLetterDate(body: string): string {
  for (const line of body.split('\n').slice(0, 8)) {
    if (DATE_LINE_RE.test(line.trim())) return line.trim()
  }
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Same structure the Python formatter uses for .docx / HTML / preview. */
export function letterLayout(text: string): LetterPreviewLayout {
  const body = normalizeLetterSource(text || '')
  const date = extractLetterDate(body)
  const lines = body.split('\n')
  let start = 0
  if (lines[0] && DATE_LINE_RE.test(lines[0].trim())) {
    start = 1
    if (start < lines.length && !lines[start].trim()) start += 1
  }

  const blocks: LetterPreviewBlock[] = []
  let prevBlank = true
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      if (!prevBlank) blocks.push({ kind: 'spacer' })
      prevBlank = true
      continue
    }
    prevBlank = false
    const display = line.trim()
    if (BULLET_RE.test(display)) {
      blocks.push({ kind: 'bullet', text: display.replace(BULLET_RE, '').trim() })
      continue
    }
    const heading = isSectionHeading(display)
    const nameLine = isNameLine(display, i)
    const fieldLine = isFieldLabelLine(display) || display.trim().toLowerCase().replace(/:$/, '') === 'basis of dispute'
    const tight = isTightLine(display, heading, nameLine, fieldLine)
    let variant: LetterPreviewVariant = 'body'
    if (heading) variant = 'heading'
    else if (nameLine) variant = 'name'
    else if (fieldLine) variant = 'field'
    else if (tight) variant = 'tight'
    blocks.push({ kind: 'line', text: display, variant, indent: indentLevel(line) })
  }
  return { date, blocks }
}
