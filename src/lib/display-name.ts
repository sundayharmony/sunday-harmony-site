const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getDisplayFirstName(options: { name?: string | null; email?: string | null }): string {
  const name = options.name?.trim()
  if (name && !EMAIL_RE.test(name)) {
    return name.split(/\s+/)[0] || 'there'
  }

  const email = options.email?.trim()
  if (email) {
    const local = email.split('@')[0] || ''
    const cleaned = local.replace(/[._+-]/g, ' ').trim()
    if (cleaned) {
      return cleaned.split(/\s+/)[0] || 'there'
    }
  }

  return 'there'
}
