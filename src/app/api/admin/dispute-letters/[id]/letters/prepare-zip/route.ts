import { after, NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { prepareLetterPackageZip } from '@/lib/dispute-letters/letter-package-zip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Full DOCX+enclosure package build after Generate Letters. */
export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

/**
 * Build and persist the Download ZIP for this session.
 * Prefer awaiting this after generate; Download ZIP will rebuild if the artifact is missing.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const wait = request.nextUrl.searchParams.get('wait') !== '0'

  try {
    if (!wait) {
      after(() => {
        prepareLetterPackageZip(id).catch((err) => {
          console.error('background prepareLetterPackageZip failed:', err)
        })
      })
      return NextResponse.json({ ok: true, status: 'building', deferred: true }, { status: 202 })
    }

    const result = await prepareLetterPackageZip(id)
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch (err) {
    console.error('prepare-zip error:', err)
    const message = err instanceof Error ? err.message : 'ZIP prepare failed'
    return NextResponse.json({ ok: false, status: 'failed', error: message }, { status: 502 })
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const { loadLetterPackageForSession } = await import('@/lib/dispute-letters/dispute-lifecycle-db')
    const snapshot = await loadLetterPackageForSession(id)
    const pkg = snapshot.package
    return NextResponse.json({
      ok: true,
      status: pkg?.zipStatus || 'pending',
      zipReady: Boolean(pkg?.zipReady),
      error: pkg?.zipError || pkg?.package.zip_error || null,
      packageId: pkg?.package.id || null,
      letterCount: pkg?.generatedCount || 0,
    })
  } catch (err) {
    console.error('prepare-zip status error:', err)
    return NextResponse.json({ error: 'Failed to load ZIP status' }, { status: 502 })
  }
}
