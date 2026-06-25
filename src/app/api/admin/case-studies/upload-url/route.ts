import { NextRequest, NextResponse } from 'next/server'
import { createCaseStudySignedUploadUrl } from '@/lib/client-case-studies-storage'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : ''
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize)

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize is required' }, { status: 400 })
    }

    const result = await createCaseStudySignedUploadUrl({
      originalFileName: fileName,
      contentType: contentType || 'application/pdf',
      fileSize,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result.data)
  } catch (err) {
    console.error('POST /api/admin/case-studies/upload-url error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
