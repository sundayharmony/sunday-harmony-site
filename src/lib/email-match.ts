/**
 * Escape `%`, `_`, and `\` so Postgres ILIKE is an exact, case-insensitive match.
 * Unescaped `_` is a single-character wildcard (e.g. `john_doe@x.com` matches `johnXdoe@x.com`).
 */
export function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Pattern for `.ilike('email', …)` exact lookups. Trims; ILIKE already ignores case. */
export function emailIlikePattern(email: string): string {
  return escapeIlikeExact(email.trim())
}
