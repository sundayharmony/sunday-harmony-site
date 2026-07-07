import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import { getDisputeSession } from '@/lib/dispute-letters/db'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { disputeLettersZipDownloadName } from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const email = session.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await disputeLettersFetch(`/internal/letters/${id}/download.zip`)
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text || 'ZIP download failed' }, { status: res.status })
    }

    const row = await getDisputeSession(id, email)
    const filename = disputeLettersZipDownloadName(row?.report_json?.consumer?.name)

    const headers = new Headers()
    headers.set('Content-Type', 'application/zip')
    headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`)
    return new Response(res.body, { status: 200, headers })
  } catch (err) {
    console.error('zip download error:', err)
    return NextResponse.json({ error: 'ZIP download failed' }, { status: 502 })
  }
}
