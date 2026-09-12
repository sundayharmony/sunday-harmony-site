/** Keep the latest letter per recipient/plan so re-generation does not accumulate copies. */

const ITEM_COUNT_SUFFIX = /\s+[—–-]\s+\d+\s+item\(s\)\s*$/i

export type LetterIdentityFields = {
  id?: string
  plan_id?: string
  title?: string
  recipient_name?: string
}

export function letterIdentityKey(letter: LetterIdentityFields): string {
  const raw = (letter.recipient_name || letter.title || '').trim()
  const recipient = raw.replace(ITEM_COUNT_SUFFIX, '').trim()
  if (recipient) return `recipient:${recipient.toLowerCase()}`
  const planId = (letter.plan_id || '').trim()
  if (planId) return `plan:${planId}`
  return `title:${(letter.title || letter.id || 'letter').trim().toLowerCase()}`
}

export function letterIdentityKeys(letter: LetterIdentityFields): string[] {
  const keys = new Set<string>([letterIdentityKey(letter)])
  const planId = (letter.plan_id || '').trim()
  if (planId) keys.add(`plan:${planId}`)
  return [...keys]
}

/**
 * Letters must be oldest-first. Returns one current letter per recipient (and per plan_id),
 * keeping later generations. Distinct recipients (Experian vs Kikoff, bureau vs furnisher) stay.
 */
export function currentLetters<T extends LetterIdentityFields>(letters: T[]): T[] {
  const surviving = new Map<string, T>()
  const occupant = new Map<string, string>()

  const rowId = (letter: T, index: number) => letter.id || `idx:${index}`

  letters.forEach((letter, index) => {
    const id = rowId(letter, index)
    const keys = letterIdentityKeys(letter)
    const evict = new Set<string>()
    for (const key of keys) {
      const existingId = occupant.get(key)
      if (existingId) evict.add(existingId)
    }
    for (const existingId of evict) {
      const previous = surviving.get(existingId)
      surviving.delete(existingId)
      if (!previous) continue
      for (const key of letterIdentityKeys(previous)) {
        if (occupant.get(key) === existingId) occupant.delete(key)
      }
    }
    surviving.set(id, letter)
    for (const key of keys) occupant.set(key, id)
  })

  const keep = new Set(surviving.values())
  return letters.filter((letter) => keep.has(letter))
}
