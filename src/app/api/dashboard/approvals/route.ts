import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getApprovalsByClient, updateApproval, getApprovalById, getClientById } from '@/lib/db'
import {
  getAdminNotifyEmail,
  isSmtpConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

    const approvals = await getApprovalsByClient(clientId)
    return NextResponse.json(approvals, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

    const body = await request.json()
    const { id, status, client_feedback } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing approval id' }, { status: 400 })
    }

    // Verify approval belongs to this client before updating (IDOR protection)
    const existing = await getApprovalById(id)
    if (!existing || existing.client_id !== clientId) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    if (!status || !['approved', 'revision_requested'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "revision_requested"' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = { status }
    if (client_feedback !== undefined) updates.client_feedback = client_feedback

    const result = await updateApproval(id, updates)
    if (!result) {
      return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
    }

    if (isSmtpConfigured()) {
      try {
        const c = await getClientById(clientId)
        const who =
          c && (c.name || c.business)
            ? `${c.name || 'Client'}${c.business ? ` (${c.business})` : ''}`
            : 'A client'
        const statusLabel = status === 'approved' ? 'Approved' : 'Revision requested'
        const fbRaw =
          typeof client_feedback === 'string' ? client_feedback.trim().slice(0, 500) : ''
        const bodyParagraphs = [
          `${who} updated an approval in the client portal.`,
          `Item: ${existing.title}`,
          `Decision: ${statusLabel}`,
        ]
        if (fbRaw) bodyParagraphs.push(`Feedback: ${fbRaw}`)
        const html = staffPortalEmailHtml({
          heading: 'Client approval update',
          bodyParagraphs,
          pathWithQuery: `/admin/approvals?client=${encodeURIComponent(clientId)}`,
        })
        sendHtmlMailNonBlocking({
          to: getAdminNotifyEmail(),
          subject: sanitizeEmailSubjectPart(`Approval ${statusLabel}: ${existing.title}`),
          html,
          logLabel: 'dashboard-approval-to-staff',
        })
      } catch (e: unknown) {
        console.error('Dashboard approval: staff notify email failed:', e)
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/dashboard/approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
