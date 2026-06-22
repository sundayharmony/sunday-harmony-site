import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getCrmReportMetrics } from '@/lib/crm-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const metrics = await getCrmReportMetrics()
  return NextResponse.json(metrics)
}
