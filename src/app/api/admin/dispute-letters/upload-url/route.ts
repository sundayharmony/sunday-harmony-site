import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  createDisputeLetterSignedUploadUrl,
  newDisputeSessionId,
} from '@/lib/dispute-letters-storage'
import { createDisputeSession } from '@/lib/dispute-letters/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const email = session.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    const sessionId = newDisputeSessionId()
    const upload = await createDisputeLetterSignedUploadUrl({
      sessionId,
      originalFileName: fileName,
      contentType: contentType || 'application/octet-stream',
      fileSize,
    })

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 })
    }

    const created = await createDisputeSession({
      id: sessionId,
      adminUserId: email,
      storagePath: upload.data.path,
      fileName,
    })

    if (!created.ok) {
      const hint =
        created.error.includes('dispute_sessions') && created.error.toLowerCase().includes('schema')
          ? ' Run supabase-migration-022-dispute-letters.sql in the Supabase SQL Editor for project hvsoeezsbvwsrdobvgaz.'
          : ''
      return NextResponse.json({ error: `${created.error}${hint}` }, { status: 500 })
    }

    return NextResponse.json({
      sessionId: upload.data.sessionId,
      signedUrl: upload.data.signedUrl,
      path: upload.data.path,
      token: upload.data.token,
    })
  } catch (err) {
    console.error('POST /api/admin/dispute-letters/upload-url error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
