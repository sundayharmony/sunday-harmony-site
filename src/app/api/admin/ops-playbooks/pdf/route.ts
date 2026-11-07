import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { buildOpsPlaybooksPdf } from '@/lib/ops-playbooks-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** ADMIN ONLY — staff ops PDF. Never expose as a public asset. */
export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const pdf = await buildOpsPlaybooksPdf()
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="sunday-harmony-credit-ops-playbooks-staff.pdf"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('ops playbooks pdf failed:', err instanceof Error ? err.name : 'error')
    return NextResponse.json({ error: 'Unable to build staff playbooks PDF' }, { status: 500 })
  }
}
