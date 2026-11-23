import { NextResponse } from 'next/server'
import { buildAuditPdf } from '@/lib/icp-audit-pdf'
import { loadAudit } from '@/lib/icp-audit-load'
import { OUTREACH_CTA_URL } from '@/lib/outreach/constants'
import { getPublicSiteUrl } from '@/lib/public-site-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await loadAudit(token).catch(() => null)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await buildAuditPdf(found.audit, { auditUrl: `${getPublicSiteUrl()}/audit/${token}`, bookUrl: OUTREACH_CTA_URL })
  const name = found.audit.business.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business'
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}-online-audit.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
