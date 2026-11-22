import { getUsers } from '@/lib/db'
import { createStaffTodo } from '@/lib/staff-todos'
import { getSupabase } from '@/lib/supabase'
import {
  getAdminNotifyEmail,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'

export function letterMailTaskCopy(input: {
  sessionId: string
  consumerName: string
  receivers: string[]
  senderEmail: string
}): { title: string; description: string } {
  const who = input.consumerName.trim() || 'the client'
  const receivers = input.receivers.length > 0 ? input.receivers : ['See each letter in the ZIP']
  return {
    title: `Print and mail dispute letters for ${who}`,
    description: [
      `session:${input.sessionId}`,
      `Sender: Sunday Harmony (${input.senderEmail})`,
      'Receivers:',
      ...receivers.map((name) => `- ${name}`),
      'Download the ZIP in Credit & Funding, then print and mail each letter.',
    ].join('\n'),
  }
}

/** Best-effort admin todo after letters generate. Never throws. */
export async function queueAdminLetterMailTask(sessionId: string): Promise<void> {
  try {
    if (!sessionId) return
    const users = await getUsers()
    const admin = users.find((user) => user.role === 'admin')
    if (!admin) return

    const { data: open } = await getSupabase()
      .from('staff_todos')
      .select('id')
      .eq('status', 'open')
      .ilike('description', `%session:${sessionId}%`)
      .limit(1)
    if (open && open.length > 0) return

    const { data: letters } = await getSupabase()
      .from('dispute_letters')
      .select('title')
      .eq('session_id', sessionId)
    const receivers = Array.from(
      new Set(
        (letters || [])
          .map((row) => String((row as { title?: string }).title || '').trim())
          .filter(Boolean)
      )
    )

    let consumerName = ''
    const { data: session } = await getSupabase()
      .from('dispute_sessions')
      .select('file_name, application_uuid')
      .eq('id', sessionId)
      .maybeSingle()
    const applicationId = (session as { application_uuid?: string } | null)?.application_uuid
    if (applicationId) {
      const { data: app } = await getSupabase()
        .from('credit_funding_applications')
        .select('full_name')
        .eq('id', applicationId)
        .maybeSingle()
      consumerName = String((app as { full_name?: string } | null)?.full_name || '')
    }
    if (!consumerName) {
      consumerName = String((session as { file_name?: string } | null)?.file_name || '')
    }

    const senderEmail = getAdminNotifyEmail()
    const copy = letterMailTaskCopy({ sessionId, consumerName, receivers, senderEmail })
    await createStaffTodo({
      title: copy.title,
      description: copy.description,
      priority: 'high',
      created_by: admin.id,
      assignee_id: admin.id,
    })

    if (isEmailConfigured()) {
      sendHtmlMailNonBlocking({
        to: senderEmail,
        subject: sanitizeEmailSubjectPart(copy.title),
        html: staffPortalEmailHtml({
          heading: copy.title,
          bodyParagraphs: copy.description.split('\n'),
          pathWithQuery: '/admin/todos',
          buttonLabel: 'Open the mail task',
        }),
        logLabel: 'dispute-mail-task',
      })
    }
  } catch (err) {
    console.error('queueAdminLetterMailTask failed:', err)
  }
}
