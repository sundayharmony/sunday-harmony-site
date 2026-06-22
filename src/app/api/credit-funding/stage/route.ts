import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { assertHttpsSubmission } from '@/lib/credit-funding-validation'
import { stageCreditFundingDocument } from '@/lib/credit-funding-storage'
import { verifyUploadSession } from '@/lib/credit-funding-upload-session'
import { DOCUMENT_TYPES, type DocumentType } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    if (!assertHttpsSubmission(req)) {
      return NextResponse.json({ error: 'HTTPS is required' }, { status: 403 })
    }

    const ip = getClientIp(req)
    const rl = rateLimit(`credit-funding-stage:${ip}`, 30, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })
    }

    const formData = await req.formData()
    const sessionId = String(formData.get('sessionId') || '').trim()
    const uploadToken = String(formData.get('uploadToken') || '').trim()
    const documentType = String(formData.get('documentType') || '').trim()
    const file = formData.get('file')

    if (!sessionId || !uploadToken || !documentType || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Session ID, upload token, document type, and file are required' }, { status: 400 })
    }

    if (!verifyUploadSession(sessionId, uploadToken)) {
      return NextResponse.json({ error: 'Invalid upload session' }, { status: 403 })
    }

    if (!DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const upload = await stageCreditFundingDocument({
      sessionId,
      documentType: documentType as DocumentType,
      buffer,
      contentType: file.type,
      originalFileName: file.name,
    })

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, file: upload.data })
  } catch (error) {
    logApiRouteError(req, 'credit-funding/stage', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
