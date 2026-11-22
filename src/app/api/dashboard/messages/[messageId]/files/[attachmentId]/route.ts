import { NextResponse } from 'next/server'
import { getClientIdFromSession, requireClientSession } from '@/lib/client-auth'
import { streamMessageAttachment } from '@/lib/portal-message-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ messageId: string; attachmentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session
  const { messageId, attachmentId } = await context.params
  return streamMessageAttachment(messageId, attachmentId, getClientIdFromSession(session))
}
