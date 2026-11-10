import { after, NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { getOrBuildLetterPackageZip, openReadyLetterPackageZip } from '@/lib/dispute-letters/letter-package-zip'
import { publicLetterFailure } from '@/lib/dispute-letters/letter-pdf-render'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Ready ZIPs stream from storage. A cold build still needs headroom for letters that were never saved. */
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
    const ready = await openReadyLetterPackageZip(id)
    if (ready) {
      const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${ready.filename.replace(/"/g, '')}"`,
        'X-Letter-Zip-Cache': 'HIT',
        'Cache-Control': 'no-store',
      })
      if (ready.byteSize && ready.byteSize > 0) headers.set('Content-Length', String(ready.byteSize))
      return new Response(ready.stream, { status: 200, headers })
    }

    const { buffer, filename, fromCache, storePackage } = await getOrBuildLetterPackageZip(id)
    if (storePackage) {
      after(() => {
        storePackage().catch((err) => console.error('store package zip after download failed:', err))
      })
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Content-Length': String(buffer.length),
        'X-Letter-Zip-Cache': fromCache ? 'HIT' : 'MISS',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = publicLetterFailure(err, 'ZIP download failed')
    if (/still being prepared/i.test(message)) {
      return NextResponse.json({ ok: true, status: 'building', error: message }, { status: 202 })
    }
    console.error('zip download error:', err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
