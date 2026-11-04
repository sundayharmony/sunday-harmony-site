import { NextRequest, NextResponse } from 'next/server'
import { roleMayEditPipeline, sendProspectAgreement } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { roleMayRunSalesActions } from '@/lib/marketing-pipeline'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayEditPipeline(session.user.role) || !roleMayRunSalesActions(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const packageTier = typeof body.packageTier === 'string' ? body.packageTier : ''
    const packagePrice = typeof body.packagePrice === 'number' ? body.packagePrice : Number(body.packagePrice)
    const priceType = typeof body.priceType === 'string' ? body.priceType : undefined
    const customScope = typeof body.customScope === 'string' ? body.customScope : undefined
    const result = await sendProspectAgreement(
      id,
      {
        packageTier,
        packagePrice: Number.isFinite(packagePrice) ? packagePrice : undefined,
        priceType,
        customScope,
      },
      marketingActor(session)
    )
    return NextResponse.json(result)
  } catch (error) {
    return marketingError(error)
  }
}
