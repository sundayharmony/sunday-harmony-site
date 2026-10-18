import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { clearPartnerLogo, savePartnerLogo } from '@/lib/partner-logos'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function partnerIdFrom(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const limited = await rateLimitDurable(`partner-logo:${getClientIp(req)}`, 30, 15 * 60 * 1000)
  if (!limited.allowed) return rateLimitResponse(limited.resetIn)

  try {
    const formData = await req.formData()
    const id = partnerIdFrom(formData.get('id'))
    const fileEntry = formData.get('file')
    if (!id) return NextResponse.json({ error: 'Partner is required.' }, { status: 400 })
    if (!fileEntry || typeof fileEntry === 'string' || !('arrayBuffer' in fileEntry)) {
      return NextResponse.json({ error: 'Choose a logo file.' }, { status: 400 })
    }
    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    const result = await savePartnerLogo(id, buffer)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, logoUrl: result.logoUrl })
  } catch (error) {
    logApiRouteError(req, 'admin/partners/logo', error)
    return NextResponse.json({ error: 'The logo could not be saved.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
    const id = partnerIdFrom(body.id)
    if (!id) return NextResponse.json({ error: 'Partner is required.' }, { status: 400 })
    const result = await clearPartnerLogo(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, logoUrl: null })
  } catch (error) {
    logApiRouteError(req, 'admin/partners/logo', error)
    return NextResponse.json({ error: 'The logo could not be removed.' }, { status: 500 })
  }
}
