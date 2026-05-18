import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getAdminData, updateAdminData } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
    const updates = await request.json()
    const data = await updateAdminData(updates)
    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/admin/data error:', error)
    return NextResponse.json({ error: 'Failed to update admin data' }, { status: 500 })
  }
}
