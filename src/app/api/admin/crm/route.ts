import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getCrmContactsWithStats, getCrmDashboardStats } from '@/lib/crm-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const sp = req.nextUrl.searchParams
  const view = sp.get('view')

  if (view === 'stats') {
    const stats = await getCrmDashboardStats()
    return NextResponse.json(stats)
  }

  const { contacts, stats } = await getCrmContactsWithStats({
    lead_type: sp.get('lead_type') || undefined,
    application_status: sp.get('application_status') || undefined,
    assigned_team_member: sp.get('assigned_team_member') || undefined,
    date_from: sp.get('date_from') || undefined,
    date_to: sp.get('date_to') || undefined,
    funding_amount_min: sp.get('funding_amount_min')
      ? parseFloat(sp.get('funding_amount_min')!)
      : undefined,
    business_owner: sp.get('business_owner') === 'true' ? true : undefined,
    credit_repair: sp.get('credit_repair') === 'true' ? true : undefined,
    search: sp.get('search') || undefined,
  })

  return NextResponse.json({ contacts, stats })
}
