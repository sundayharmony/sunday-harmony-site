import { createLead, logActivity } from '@/lib/db'
import { getResendClient } from '@/lib/resend-client'
import { escHtml, getAdminNotifyEmail, sanitizeEmailSubjectPart, sendEmail } from '@/lib/smtp-mail'

interface ReceivedEmailMeta {
  email_id: string
  from: string
  to: string[]
  subject?: string
}

function parseFromAddress(from: string): { email: string; name: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() }
  return { name: '', email: from.trim() }
}

export async function processInboundEmail(meta: ReceivedEmailMeta): Promise<void> {
  const resend = getResendClient()
  const { data: email, error } = await resend.emails.receiving.get(meta.email_id)
  if (error || !email) {
    throw new Error(error?.message || 'Failed to fetch received email')
  }

  const { email: senderEmail, name: senderName } = parseFromAddress(meta.from)
  const subject = meta.subject || email.subject || '(no subject)'
  const bodyHtml = email.html || `<pre>${escHtml(email.text || '')}</pre>`
  const bodyText = email.text || ''
  const toList = meta.to.join(', ')

  await sendEmail({
    to: getAdminNotifyEmail(),
    replyTo: senderEmail || undefined,
    subject: sanitizeEmailSubjectPart(`Inbound: ${subject}`, 200),
    html: `
      <div style="font-family:'Montserrat',Arial,sans-serif;max-width:640px;margin:0 auto">
        <h2 style="color:#b8943f;border-bottom:2px solid #b8943f;padding-bottom:8px">Inbound Email</h2>
        <p><strong>From:</strong> ${escHtml(meta.from)}</p>
        <p><strong>To:</strong> ${escHtml(toList)}</p>
        <p><strong>Subject:</strong> ${escHtml(subject)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
        ${bodyHtml}
        <p style="font-size:12px;color:#999;margin-top:24px">Reply to this email to respond directly to the sender.</p>
      </div>
    `,
  })

  if (senderEmail) {
    const parts = senderName.split(/\s+/).filter(Boolean)
    const lead = await createLead({
      first_name: parts[0] || 'Inbound',
      last_name: parts.slice(1).join(' '),
      email: senderEmail,
      business: 'Inbound email',
      service: 'Inbound Email',
      message: bodyText.slice(0, 5000) || subject,
      source: 'inbound',
    })
    if (lead) {
      await logActivity({
        action: 'created',
        entity_type: 'lead',
        entity_id: lead.id,
        actor_email: senderEmail,
        details: `Lead from inbound email: ${subject}`,
      })
    }
  }
}
