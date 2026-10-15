import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { listPartnersForAdmin, setPartnerApproval } from '@/lib/partner-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const partners = await listPartnersForAdmin()
  return NextResponse.json({ partners })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const action = body.action === 'approve' || body.action === 'disable' ? body.action : null
    if (!id || !action) {
      return NextResponse.json({ error: 'Partner and action are required.' }, { status: 400 })
    }
    const result = await setPartnerApproval(id, action)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    logApiRouteError(req, 'admin/partners', error)
    return NextResponse.json({ error: 'Unable to update the partner.' }, { status: 500 })
  }
}
