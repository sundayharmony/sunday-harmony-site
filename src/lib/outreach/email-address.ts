const LOCAL_MAX = 64
const DOMAIN_MAX = 253
const EMAIL_MAX = 254

/** Syntax only. Does not check DNS. */
export function isValidEmailSyntax(raw: string): boolean {
  const email = raw.trim()
  if (!email || email.length > EMAIL_MAX) return false
  if (email.includes(' ') || email.includes('..')) return false
  const at = email.lastIndexOf('@')
  if (at <= 0 || at !== email.indexOf('@')) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!local || local.length > LOCAL_MAX) return false
  if (!domain || domain.length > DOMAIN_MAX) return false
  if (local.startsWith('.') || local.endsWith('.')) return false
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      !label.startsWith('-') &&
      !label.endsWith('-') &&
      /^[A-Za-z0-9-]+$/.test(label)
  )
}

/**
 * Conservative mailbox key: trim, lowercase domain, lowercase local-part.
 * Does not strip plus-tags or dots. Distinct mailboxes stay distinct.
 */
export function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim()
  if (!isValidEmailSyntax(trimmed)) return null
  const at = trimmed.lastIndexOf('@')
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1).toLowerCase()
  return `${local.toLowerCase()}@${domain}`
}

export function emailDomain(normalized: string): string {
  return normalized.slice(normalized.lastIndexOf('@') + 1)
}

export function normalizeBusinessName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'’&/()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
