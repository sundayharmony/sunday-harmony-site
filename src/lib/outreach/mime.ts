import { OUTREACH_SENDER_EMAIL } from './constants'
import type { OutreachSendPayload } from './provider'
import { oneClickUrlFromPageUrl } from './unsubscribe'

function encodeUtf8Subject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

export function buildOutreachMime(payload: OutreachSendPayload): string {
  const mixed = `mix_${Buffer.from(payload.idempotencyKey).toString('hex').slice(0, 24)}`
  const alt = `alt_${Buffer.from(payload.payloadSha256).toString('hex').slice(0, 24)}`
  const from = payload.from.includes('<') ? payload.from : `Sunday Harmony Consulting <${OUTREACH_SENDER_EMAIL}>`
  const pdf = payload.attachment.content.toString('base64').replace(/(.{76})/g, '$1\r\n')
  return [
    `From: ${from}`,
    `To: ${payload.to}`,
    `Subject: ${encodeUtf8Subject(payload.subject)}`,
    'MIME-Version: 1.0',
    `List-Unsubscribe: <${oneClickUrlFromPageUrl(payload.unsubscribeUrl)}>`,
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    payload.text,
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    payload.html,
    `--${alt}--`,
    `--${mixed}`,
    `Content-Type: ${payload.attachment.contentType}; name="${payload.attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${payload.attachment.filename}"`,
    '',
    pdf,
    `--${mixed}--`,
  ].join('\r\n')
}

export function mimeContainsAttachment(raw: string, filename: string): boolean {
  return raw.includes(`filename="${filename}"`) && raw.includes('Content-Disposition: attachment')
}
