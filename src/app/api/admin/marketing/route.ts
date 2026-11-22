import { NextResponse } from 'next/server'
import { loadMarketingDesk, roleMayUsePipeline } from '@/lib/marketing-crm'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    return NextResponse.json(await loadMarketingDesk(session.user.role))
  } catch (error) {
    console.error('marketing desk error:', error)
    return NextResponse.json({ error: 'Could not load the marketing desk' }, { status: 500 })
  }
}
