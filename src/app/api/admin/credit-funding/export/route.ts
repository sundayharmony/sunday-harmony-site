import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { maskEmail, maskPhone } from '@/lib/field-encryption'
import { getCreditFundingApplications } from '@/lib/credit-funding-db'

export const dynamic = 'force-dynamic'

function csvEscape(val: string): string {
  const s = String(val ?? '').replace(/"/g, '""')
  return `"${s}"`
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''

    const applications = await getCreditFundingApplications({ status, search })

    logActivity({
      action: 'exported',
      entity_type: 'credit_funding_application',
      actor_email: session.user.email || 'admin',
      details: `Exported ${applications.length} credit funding applications to CSV`,
    })

    const headers = [
      'Application ID',
      'Full Name',
      'Email',
      'Phone',
      'Service Type',
      'Assigned Specialist',
      'Credit Goals',
      'Funding Goals',
      'Provider',
      'Status',
      'Created At',
      'Last Updated',
    ]

    const rows = applications.map((a) => [
      a.application_id,
      a.full_name,
      maskEmail(a.email),
      maskPhone(a.phone),
      a.service_type || '',
      a.assigned_specialist || '',
      (a.credit_goals || []).join('; '),
      a.funding_goals,
      a.selected_credit_provider,
      a.status,
      a.created_at,
      a.updated_at,
    ])

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="credit-funding-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/export', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
