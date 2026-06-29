import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getUserById, logActivity } from '@/lib/db'
import { issueAndSendCreditManagerSetupEmail } from '@/lib/credit-manager-onboarding'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const user = await getUserById(id)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.role !== 'credit_manager') {
    return NextResponse.json({ error: 'Setup emails can only be sent to credit managers' }, { status: 403 })
  }

  try {
    const { emailSent } = await issueAndSendCreditManagerSetupEmail(user)
    logActivity({
      action: 'updated',
      entity_type: 'user',
      entity_id: user.id,
      actor_email: session.user.email || 'admin',
      details: `Sent credit manager password setup email to ${user.email}`,
    })
    return NextResponse.json({ success: true, emailSent })
  } catch (err) {
    console.error('send-setup error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send setup email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
