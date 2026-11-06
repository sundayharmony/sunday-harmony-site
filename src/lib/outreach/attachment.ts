import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPublicSiteUrl } from '@/lib/public-site-url'
import { OUTREACH_ATTACHMENT_PATH, OUTREACH_ATTACHMENT_PUBLIC_PATH } from './constants'

function isPdf(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 4).toString('utf8').startsWith('%PDF')
}

function candidateDiskPaths(root: string): string[] {
  return [
    join(root, OUTREACH_ATTACHMENT_PATH),
    join(root, 'sales-materials/company-presentation.pdf'),
    join(root, OUTREACH_ATTACHMENT_PUBLIC_PATH.replace(/^\//, '')),
  ]
}

export function loadCompanyPresentationPdf(root = process.cwd()): Buffer | null {
  for (const filePath of candidateDiskPaths(root)) {
    try {
      const buf = readFileSync(filePath)
      if (isPdf(buf)) return buf
    } catch {
      continue
    }
  }
  return null
}

function publicPresentationOrigin(): string | null {
  const site = getPublicSiteUrl()
  if (/localhost|127\.0\.0\.1/i.test(site)) {
    const vercel = process.env.VERCEL_URL?.trim()
    if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
    return null
  }
  return site
}

export async function resolveCompanyPresentationPdf(root = process.cwd()): Promise<Buffer | null> {
  const fromDisk = loadCompanyPresentationPdf(root)
  if (fromDisk) return fromDisk
  const origin = publicPresentationOrigin()
  if (!origin) return null
  try {
    const response = await fetch(`${origin}${OUTREACH_ATTACHMENT_PUBLIC_PATH}`)
    if (!response.ok) return null
    const buf = Buffer.from(await response.arrayBuffer())
    return isPdf(buf) ? buf : null
  } catch {
    return null
  }
}
