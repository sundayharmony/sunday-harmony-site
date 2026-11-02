import { NextResponse } from 'next/server'
import { isGoogleWorkspaceConfigured } from '@/lib/google-workspace'
import { listMarketingProspects } from '@/lib/marketing-crm'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (session.user.role !== 'admin' && session.user.role !== 'client_relations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const prospects = (await listMarketingProspects('admin')).filter((prospect) => prospect.stage === 'won')
  return NextResponse.json({
    prospects,
    workspaceConnected: isGoogleWorkspaceConfigured(),
  })
}
