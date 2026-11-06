import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { clearCaseStudyLogo, saveCaseStudyLogo } from '@/lib/case-studies'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function studyId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const limited = await rateLimitDurable(`case-study-logo:${getClientIp(req)}`, 30, 15 * 60 * 1000)
  if (!limited.allowed) return rateLimitResponse(limited.resetIn)

  try {
    const formData = await req.formData()
    const id = studyId(formData.get('id'))
    const fileEntry = formData.get('file')
    if (!id) return NextResponse.json({ error: 'Case study is required.' }, { status: 400 })
    if (!fileEntry || typeof fileEntry === 'string' || !('arrayBuffer' in fileEntry)) {
      return NextResponse.json({ error: 'Choose a logo file.' }, { status: 400 })
    }
    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    const result = await saveCaseStudyLogo(id, buffer)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, logoUrl: result.logoUrl })
  } catch (error) {
    logApiRouteError(req, 'admin/case-studies/logo', error)
    return NextResponse.json({ error: 'The logo could not be saved.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
    const id = studyId(body.id)
    if (!id) return NextResponse.json({ error: 'Case study is required.' }, { status: 400 })
    const result = await clearCaseStudyLogo(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, logoUrl: null })
  } catch (error) {
    logApiRouteError(req, 'admin/case-studies/logo', error)
    return NextResponse.json({ error: 'The logo could not be removed.' }, { status: 500 })
  }
}
