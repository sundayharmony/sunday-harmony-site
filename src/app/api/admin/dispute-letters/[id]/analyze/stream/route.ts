import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { proxyDisputeLettersStream } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { updateDisputeSessionStatus } from '@/lib/dispute-letters/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath is required' }, { status: 400 })
    }

    await updateDisputeSessionStatus(id, 'analyzing')

    return proxyDisputeLettersStream('/internal/analyze/stream', {
      session_id: id,
      storage_path: storagePath,
      file_name: fileName,
    })
  } catch (err) {
    console.error('POST analyze/stream error:', err)
    await updateDisputeSessionStatus(id, 'failed', 'Analysis failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
