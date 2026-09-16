import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import {
  fetchLetterDocxWithEnclosures,
  loadLetterIdentityAttachments,
} from '@/lib/dispute-letters/letter-identity-attachments'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type Params = { params: Promise<{ id: string; letterId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id, letterId } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const format = request.nextUrl.searchParams.get('format') || 'docx'

  try {
    if (format === 'docx') {
      const attachments = await loadLetterIdentityAttachments(access.session.application_uuid)
      const data = await fetchLetterDocxWithEnclosures(id, letterId, attachments)
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="letter_${letterId}.docx"`,
        },
      })
    }

    const res = await disputeLettersFetch(
      `/internal/letters/${id}/${letterId}/download?format=${encodeURIComponent(format)}`
    )
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text || 'Download failed' }, { status: res.status })
    }
    const headers = new Headers()
    const disposition = res.headers.get('Content-Disposition')
    const contentType = res.headers.get('Content-Type')
    if (disposition) headers.set('Content-Disposition', disposition)
    if (contentType) headers.set('Content-Type', contentType)
    return new Response(res.body, { status: 200, headers })
  } catch (err) {
    console.error('letter download error:', err)
    return NextResponse.json({ error: 'Download failed' }, { status: 502 })
  }
}
