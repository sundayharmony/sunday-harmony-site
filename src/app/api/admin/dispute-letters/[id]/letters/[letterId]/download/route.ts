import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import { fetchLetterPdfForInteractiveDownload } from '@/lib/dispute-letters/letter-identity-attachments'
import {
  readStoredLetterDocxForSession,
  storeGeneratedLetterDocx,
} from '@/lib/dispute-letters/letter-docx-store'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Letter + identity PDFs; same payload the ZIP packages. */
export const maxDuration = 120

type Params = { params: Promise<{ id: string; letterId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id, letterId } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const format = request.nextUrl.searchParams.get('format') || 'pdf'

  try {
    if (format === 'pdf') {
      // Same PDF the ZIP uses: letter body + identity docs (no account screenshots).
      let data = await readStoredLetterDocxForSession(id, letterId)
      if (!data) {
        data = await fetchLetterPdfForInteractiveDownload(id, letterId)
        // Cache so Download all (ZIP) can zip these instantly instead of regenerating.
        await storeGeneratedLetterDocx({ sessionId: id, letterId, data })
      }
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="letter_${letterId}.pdf"`,
        },
      })
    }

    const res = await disputeLettersFetch(
      `/internal/letters/${id}/${letterId}/download?format=${encodeURIComponent(format)}&include_evidence=false`
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
