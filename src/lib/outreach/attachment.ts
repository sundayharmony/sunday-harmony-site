import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUTREACH_ATTACHMENT_PATH } from './constants'

export function loadCompanyPresentationPdf(root = process.cwd()): Buffer | null {
  try {
    const buf = readFileSync(join(root, OUTREACH_ATTACHMENT_PATH))
    if (buf.length < 8) return null
    if (!buf.subarray(0, 4).toString('utf8').startsWith('%PDF')) return null
    return buf
  } catch {
    return null
  }
}
