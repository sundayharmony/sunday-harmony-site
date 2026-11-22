import { NextResponse } from 'next/server'
import { getMessageById } from '@/lib/db'
import { staffMayUseClient } from '@/lib/people-db'
import { streamMessageAttachment } from '@/lib/portal-message-server'
import { requireStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ messageId: string; attachmentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session
  const { messageId, attachmentId } = await context.params
  const message = await getMessageById(messageId)
  if (!message || !(await staffMayUseClient(session.user.role, message.client_id, session.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return streamMessageAttachment(messageId, attachmentId, message.client_id)
}
