import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { formatApplicationForAdmin } from '@/lib/credit-funding-admin'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { applyWorkflowStatusUpdate } from '@/lib/credit-funding-workflow'
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
} from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'

const MAX_ATTACHMENTS = 5

export async function POST(req: NextRequest) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const formData = await req.formData()
    const id = formData.get('id')?.toString()
    const status = formData.get('status')?.toString()
    const statusNotes = formData.get('status_notes')?.toString()
    const notifyRaw = formData.get('notify_client')?.toString()
    const notifyClient = notifyRaw !== 'false'

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    if (!APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existing = await getCreditFundingApplicationById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const staffEmail = session.user.email || 'admin'
    const staffName = session.user.name || 'Sunday Harmony Team'

    const attachments: Array<{
      buffer: Buffer
      contentType: string
      originalFileName: string
      displayTitle?: string
    }> = []
    const files = formData.getAll('attachments').filter((entry): entry is File => entry instanceof File)
    const titleEntries = formData.getAll('attachment_titles').map((entry) => entry.toString())

    if (files.length > MAX_ATTACHMENTS) {
      return NextResponse.json({ error: `Maximum ${MAX_ATTACHMENTS} attachments allowed` }, { status: 400 })
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size <= 0) continue
      const buffer = Buffer.from(await file.arrayBuffer())
      const displayTitle = titleEntries[i]?.trim() || undefined
      attachments.push({
        buffer,
        contentType: file.type,
        originalFileName: file.name,
        displayTitle,
      })
    }

    const result = await applyWorkflowStatusUpdate({
      application: existing,
      status: status as ApplicationStatus,
      staffEmail,
      staffName,
      statusNotes,
      attachments,
      notifyClient,
    })

    if (!result) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    logActivity({
      action: 'status_changed',
      entity_type: 'credit_funding_application',
      entity_id: id,
      actor_email: staffEmail,
      details: `Status changed to ${STATUS_LABELS[status as ApplicationStatus] || status} for ${existing.application_id}${
        result.attachmentNames.length ? ` (${result.attachmentNames.length} attachment(s))` : ''
      }`,
    })

    return NextResponse.json(formatApplicationForAdmin(result.app))
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/workflow POST', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workflow step' },
      { status: 500 }
    )
  }
}
