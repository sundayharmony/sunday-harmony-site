import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getClientById, getLeadById, getUserByEmail, createNotification, logActivity } from '@/lib/db'
import {
  createMeeting,
  getMeetingsForContact,
  getMeetingById,
  updateMeeting,
  logCrmActivity,
} from '@/lib/crm-db'
import { resolveMeetLinkForMeeting } from '@/lib/google-meet'
import { MEETING_TYPES } from '@/lib/crm-types'
import {
  escHtml,
  getPublicSiteUrl,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
} from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const clientId = req.nextUrl.searchParams.get('client_id')
  const leadId = req.nextUrl.searchParams.get('lead_id')

  if (clientId) {
    return NextResponse.json(await getMeetingsForContact({ clientId }))
  }
  if (leadId) {
    return NextResponse.json(await getMeetingsForContact({ leadId }))
  }

  return NextResponse.json({ error: 'client_id or lead_id required' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const {
    client_id,
    lead_id,
    application_uuid,
    title,
    meeting_type,
    scheduled_at,
    duration_minutes,
    notes,
    assigned_staff,
    google_meet_link,
  } = body

  if (!title?.trim() || !scheduled_at) {
    return NextResponse.json({ error: 'title and scheduled_at are required' }, { status: 400 })
  }
  if (!client_id && !lead_id) {
    return NextResponse.json({ error: 'client_id or lead_id is required' }, { status: 400 })
  }

  const meetLink = await resolveMeetLinkForMeeting({ existingLink: google_meet_link })

  const meeting = await createMeeting({
    client_id: client_id || null,
    lead_id: lead_id || null,
    application_uuid: application_uuid || null,
    title: title.trim(),
    meeting_type: MEETING_TYPES.includes(meeting_type) ? meeting_type : 'consultation',
    scheduled_at,
    duration_minutes: duration_minutes || 30,
    notes: notes || '',
    assigned_staff: assigned_staff || session.user.email,
    google_meet_link: meetLink,
    status: 'scheduled',
    created_by: session.user.email || 'admin',
  })

  if (!meeting) {
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }

  const entityType = client_id ? 'client' : 'lead'
  const entityId = client_id || lead_id

  await logCrmActivity({
    action: 'meeting_scheduled',
    entity_type: entityType,
    entity_id: entityId,
    actor_email: session.user.email || 'admin',
    details: `Meeting scheduled: ${meeting.title} at ${new Date(meeting.scheduled_at).toLocaleString()}`,
  })

  let recipientEmail: string | undefined
  let recipientName = 'there'
  if (client_id) {
    const client = await getClientById(client_id)
    recipientEmail = client?.email
    recipientName = client?.name?.split(/\s+/)[0] || recipientName
  } else if (lead_id) {
    const lead = await getLeadById(lead_id)
    recipientEmail = lead?.email
    recipientName = lead?.first_name || recipientName
  }

  if (recipientEmail) {
    sendHtmlMailNonBlocking({
      to: recipientEmail,
      subject: sanitizeEmailSubjectPart(`Meeting Scheduled — ${meeting.title}`, 200),
      html: `
        <div style="font-family:'Montserrat',Arial,sans-serif;max-width:600px">
          <h2 style="color:#b8943f">Your Meeting Is Scheduled</h2>
          <p>Hi ${escHtml(recipientName)},</p>
          <p><strong>${escHtml(meeting.title)}</strong></p>
          <p>Date: ${escHtml(new Date(meeting.scheduled_at).toLocaleString())}</p>
          <p>Duration: ${meeting.duration_minutes} minutes</p>
          ${meeting.assigned_staff ? `<p>With: ${escHtml(meeting.assigned_staff)}</p>` : ''}
          ${meetLink ? `<p><a href="${escHtml(meetLink)}" style="color:#b8943f;font-weight:bold">Join Google Meet</a></p>` : ''}
          ${notes ? `<p>${escHtml(notes)}</p>` : ''}
          <p><a href="${escHtml(getPublicSiteUrl())}/dashboard/meetings">View in your portal</a></p>
        </div>
      `,
      logLabel: 'meeting-invite',
    })

    const user = await getUserByEmail(recipientEmail)
    if (user) {
      await createNotification({
        user_id: user.id,
        title: 'Meeting Scheduled',
        message: `${meeting.title} on ${new Date(meeting.scheduled_at).toLocaleDateString()}`,
        type: 'info',
        link: '/dashboard/meetings',
      })
    }
  }

  return NextResponse.json(meeting)
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { id, status, google_meet_link, notes, scheduled_at } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await getMeetingById(id)
  if (!existing) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  const updates: Parameters<typeof updateMeeting>[1] = {}
  if (status) updates.status = status
  if (google_meet_link !== undefined) updates.google_meet_link = google_meet_link
  if (notes !== undefined) updates.notes = notes
  if (scheduled_at) updates.scheduled_at = scheduled_at

  const updated = await updateMeeting(id, updates)
  if (!updated) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  if (status === 'completed') {
    const entityType = existing.client_id ? 'client' : 'lead'
    const entityId = existing.client_id || existing.lead_id
    await logCrmActivity({
      action: 'meeting_completed',
      entity_type: entityType || 'client',
      entity_id: entityId || undefined,
      actor_email: session.user.email || 'admin',
      details: `Meeting completed: ${updated.title}`,
    })
  }

  return NextResponse.json(updated)
}
