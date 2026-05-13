import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getActivityLog } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const logs = await getActivityLog(30)
  return NextResponse.json(logs)
}
