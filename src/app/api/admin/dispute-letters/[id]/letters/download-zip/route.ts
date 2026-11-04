import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { getOrBuildLetterPackageZip } from '@/lib/dispute-letters/letter-package-zip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Prefers prebuilt ZIP; rebuild fallback still needs headroom for cold starts + enclosure merge. */
export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const email = session.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { buffer, filename, fromCache } = await getOrBuildLetterPackageZip(id)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'X-Letter-Zip-Cache': fromCache ? 'HIT' : 'MISS',
      },
    })
  } catch (err) {
    console.error('zip download error:', err)
    const message = err instanceof Error ? err.message : 'ZIP download failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
