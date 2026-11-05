import { NextRequest, NextResponse } from 'next/server'
import { confirmUnsubscribe } from '@/lib/outreach/confirm-unsubscribe'
import { resolveOutreachStore } from '@/lib/outreach/runtime'
import { isOneClickUnsubscribeBody } from '@/lib/outreach/unsubscribe'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const ip = getClientIp(request)
  const limited = rateLimit(`unsubscribe:${ip}`, 20, 15 * 60 * 1000)
  if (!limited.allowed) {
    return new NextResponse('Too many requests', { status: 429 })
  }
  const contentType = request.headers.get('content-type') || ''
  const raw = contentType.includes('application/json') ? '' : await request.text().catch(() => '')
  const oneClick = isOneClickUnsubscribeBody(raw)
  const store = resolveOutreachStore()
  const result = await confirmUnsubscribe(store, token)
  const page = new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url)
  if (oneClick) {
    if (!result.ok) {
      return NextResponse.json({ error: 'This unsubscribe link is not valid.' }, { status: 404 })
    }
    return new NextResponse(null, { status: 200 })
  }
  if (!result.ok) {
    page.searchParams.set('invalid', '1')
    return NextResponse.redirect(page, 303)
  }
  page.searchParams.set('done', '1')
  return NextResponse.redirect(page, 303)
}
