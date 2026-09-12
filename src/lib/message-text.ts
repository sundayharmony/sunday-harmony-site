const URL_RE = /https?:\/\/[^\s<>"'`]+/gi

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[),.;!?]+$/g, '')
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export type MessageTextPart =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string }

/** Split message text so https/http URLs can be rendered as links. */
export function splitMessageTextParts(text: string): MessageTextPart[] {
  if (!text) return []
  const parts: MessageTextPart[] = []
  let lastIndex = 0
  const re = new RegExp(URL_RE.source, 'gi')
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const url = trimTrailingPunctuation(raw)
    const start = match.index ?? 0
    if (start > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, start) })
    }
    if (isSafeHttpUrl(url)) {
      parts.push({ type: 'link', value: url })
      if (url.length < raw.length) {
        parts.push({ type: 'text', value: raw.slice(url.length) })
      }
    } else {
      parts.push({ type: 'text', value: raw })
    }
    lastIndex = start + raw.length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}

export const STAFF_MESSAGES_SETUP_ERROR =
  'Team chat is not set up in the database yet. Run supabase-migration-021-credit-manager-role.sql in the Supabase SQL Editor, then try again.'

export function staffMessageSetupError(
  error?: { code?: string; message?: string } | string | null
): string | null {
  if (!error) return null
  const code = typeof error === 'string' ? '' : error.code || ''
  const message = typeof error === 'string' ? error : error.message || ''
  const blob = `${code} ${message}`
  if (code === '42P01' || code === 'PGRST205') return STAFF_MESSAGES_SETUP_ERROR
  if (/42P01|PGRST205/i.test(blob)) return STAFF_MESSAGES_SETUP_ERROR
  if (/relation ["']?staff_messages["']? does not exist/i.test(blob)) {
    return STAFF_MESSAGES_SETUP_ERROR
  }
  if (/could not find the table ['"]public\.staff_messages['"]/i.test(blob)) {
    return STAFF_MESSAGES_SETUP_ERROR
  }
  return null
}
