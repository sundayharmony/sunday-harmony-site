import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireStaffDocumentAccess } from '@/lib/credit-funding-document-access'
import {
  getCreditFundingApplicationById,
  getUploadedDocumentById,
} from '@/lib/credit-funding-db'
import { downloadCreditFundingDocument } from '@/lib/credit-funding-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

function contentTypeFor(doc: { mime_type?: string | null; file_name?: string | null }): string {
  const mime = (doc.mime_type || '').trim()
  if (mime) return mime
  const name = (doc.file_name || '').toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.pdf')) return 'application/pdf'
  return 'image/jpeg'
}

/**
 * Same-origin byte stream for staff crop/preview.
 * Restricted to an existing document id + application ownership — no arbitrary URL proxy.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const access = await requireStaffDocumentAccess(req, context.params)
    if (!access.ok) return access.response
    const { id, doc } = access

    const downloaded = await downloadCreditFundingDocument(doc.storage_path)
    if (!downloaded.ok) {
      return NextResponse.json({ error: 'Could not open document' }, { status: 404 })
    }

    return new NextResponse(Buffer.from(downloaded.data), {
      status: 200,
      headers: {
        'Content-Type': contentTypeFor(doc),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/documents/[id]/content GET', error)
    return NextResponse.json({ error: 'Failed to open document' }, { status: 500 })
  }
}
