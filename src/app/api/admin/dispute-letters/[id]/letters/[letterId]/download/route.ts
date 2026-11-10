import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { buildAndStoreLetterPdf } from '@/lib/dispute-letters/letter-package-zip'
import { readStoredLetterDocxForSession } from '@/lib/dispute-letters/letter-docx-store'
import { isPdfBytes } from '@/lib/dispute-letters/letter-zip'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Stored letter PDF, or one letter built from saved text and saved account images. */
export const maxDuration = 60

type Params = { params: Promise<{ id: string; letterId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id, letterId } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const format = request.nextUrl.searchParams.get('format') || 'pdf'
  if (format !== 'pdf') {
    return NextResponse.json({ error: 'PDF is the only letter download' }, { status: 400 })
  }

  try {
    const stored = await readStoredLetterDocxForSession(id, letterId)
    const data = stored && isPdfBytes(stored) ? stored : await buildAndStoreLetterPdf(id, letterId)
    if (!data || !isPdfBytes(data)) {
      return NextResponse.json({ error: 'PDF is not ready yet' }, { status: 409 })
    }
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="letter_${letterId}.pdf"`,
      },
    })
  } catch (err) {
    console.error('letter download error:', err)
    return NextResponse.json({ error: 'PDF is not ready yet' }, { status: 409 })
  }
}
