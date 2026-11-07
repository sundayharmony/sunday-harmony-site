import { NextResponse } from 'next/server'
import { buildOutreachItem } from '@/lib/outreach/console'
import { resolveOutreachStore } from '@/lib/outreach/runtime'
import { requireSalesSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const session = await requireSalesSession()
  if (session instanceof NextResponse) return session
  const { id } = await params
  try {
    const item = await buildOutreachItem(resolveOutreachStore(), id, session.user.role ?? null)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Outreach store is unavailable.' }, { status: 503 })
  }
}
