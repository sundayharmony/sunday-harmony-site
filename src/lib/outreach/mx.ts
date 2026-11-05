import { emailDomain } from './email-address'

export type MxLookupResult =
  | { kind: 'ok' }
  | { kind: 'null_mx' }
  | { kind: 'no_mx' }
  | { kind: 'uncertain'; reason: string }

export type MxResolver = (domain: string) => Promise<Array<{ priority: number; exchange: string }>>

function isNullMx(records: Array<{ priority: number; exchange: string }>): boolean {
  if (records.length !== 1) return false
  const exchange = records[0].exchange.replace(/\.$/, '').trim()
  return records[0].priority === 0 && (exchange === '' || exchange === '.')
}

export async function lookupMx(
  emailOrDomain: string,
  resolver?: MxResolver
): Promise<MxLookupResult> {
  const domain = emailOrDomain.includes('@') ? emailDomain(emailOrDomain) : emailOrDomain.toLowerCase()
  if (!domain) return { kind: 'no_mx' }
  try {
    const resolve =
      resolver ||
      (async (name: string) => {
        const dns = await import('node:dns/promises')
        return dns.resolveMx(name)
      })
    const records = await resolve(domain)
    if (!records || records.length === 0) return { kind: 'no_mx' }
    if (isNullMx(records)) return { kind: 'null_mx' }
    return { kind: 'ok' }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { kind: 'no_mx' }
    return { kind: 'uncertain', reason: code || 'mx_lookup_failed' }
  }
}

/** Null MX is not deliverable. Network uncertainty is not a bounce. */
export function mxBlocksSend(result: MxLookupResult): boolean {
  return result.kind === 'null_mx' || result.kind === 'no_mx'
}

export function mxIsPermanentBounce(result: MxLookupResult): boolean {
  return false
}
