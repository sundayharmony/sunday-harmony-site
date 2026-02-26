import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOnboardingResponse } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id query parameter' }, { status: 400 })
    }

    const response = await getOnboardingResponse(clientId)
    return NextResponse.json(response || {}, { status: 200 })
  } catch (error: any) {
    console.error('GET /api/admin/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
