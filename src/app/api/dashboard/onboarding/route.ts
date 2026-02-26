import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOnboardingResponse, upsertOnboardingResponse } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

    const response = await getOnboardingResponse(clientId)

    // Return proper defaults if no record exists yet
    const defaults = {
      id: '',
      client_id: clientId,
      business_goals: '',
      target_audience: '',
      brand_voice: '',
      social_accounts: {},
      google_business_url: '',
      existing_assets: '',
      competitors: '',
      additional_notes: '',
      completed: false,
    }

    return NextResponse.json(response ? { ...defaults, ...response } : defaults, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

    const body = await request.json()
    const {
      business_goals,
      target_audience,
      brand_voice,
      social_accounts,
      google_business_url,
      existing_assets,
      competitors,
      additional_notes,
      completed,
    } = body

    const updates: Record<string, unknown> = {}
    if (business_goals !== undefined) updates.business_goals = business_goals
    if (target_audience !== undefined) updates.target_audience = target_audience
    if (brand_voice !== undefined) updates.brand_voice = brand_voice
    if (social_accounts !== undefined) updates.social_accounts = social_accounts
    if (google_business_url !== undefined) updates.google_business_url = google_business_url
    if (existing_assets !== undefined) updates.existing_assets = existing_assets
    if (competitors !== undefined) updates.competitors = competitors
    if (additional_notes !== undefined) updates.additional_notes = additional_notes
    if (completed !== undefined) updates.completed = completed

    const result = await upsertOnboardingResponse(clientId, updates)
    return NextResponse.json(result, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/dashboard/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
