import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getOnboardingResponse } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id query parameter' }, { status: 400 })
    }

    const response = await getOnboardingResponse(clientId)
    return NextResponse.json(response || {}, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/admin/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
