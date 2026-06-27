import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getAdminData, updateAdminData, type AdminData } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ADMIN_DATA_KEYS: (keyof AdminData)[] = [
  'roadmap_tasks',
  'positioning_canvas',
  'research_tasks',
  'weekly_activity',
]

function pickAdminDataUpdates(body: Record<string, unknown>): Partial<AdminData> {
  const updates: Record<string, unknown> = {}
  for (const key of ADMIN_DATA_KEYS) {
    if (key in body) {
      updates[key] = body[key]
    }
  }
  return updates as Partial<AdminData>
}

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const data = await getAdminData()
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const body = (await request.json()) as Record<string, unknown>
    const updates = pickAdminDataUpdates(body)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    const data = await updateAdminData(updates)
    if (!data) {
      return NextResponse.json({ error: 'Failed to update admin data' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/admin/data error:', error)
    return NextResponse.json({ error: 'Failed to update admin data' }, { status: 500 })
  }
}
