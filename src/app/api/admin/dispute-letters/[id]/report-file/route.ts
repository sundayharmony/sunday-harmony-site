import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { getDisputeLetterSignedDownloadUrl } from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Signed URL to open the original uploaded credit report file for a dispute session. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const storagePath = access.session.storage_path?.trim()
  if (!storagePath) {
    return NextResponse.json({ error: 'Report file not available' }, { status: 404 })
  }

  const url = await getDisputeLetterSignedDownloadUrl(storagePath)
  if (!url) {
    return NextResponse.json({ error: 'Could not open report file' }, { status: 404 })
  }

  return NextResponse.json({
    url,
    fileName: access.session.file_name,
  })
}
