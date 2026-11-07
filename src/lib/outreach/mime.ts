import { OUTREACH_SENDER_EMAIL } from './constants'
import type { OutreachSendPayload } from './provider'
import { oneClickUrlFromPageUrl } from './unsubscribe'

function encodeUtf8Subject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

/** RFC 2045 quoted-printable. Gmail will ignore the HTML part if `=` in styles is left raw. */
export function toQuotedPrintable(input: string): string {
  const bytes = Buffer.from(input, 'utf8')
  const tokens: string[] = []
  for (const byte of bytes) {
    const printable = byte >= 33 && byte <= 126 && byte !== 61
    if (printable) {
      tokens.push(String.fromCharCode(byte))
    } else if (byte === 9 || byte === 32) {
      tokens.push(String.fromCharCode(byte))
    } else {
      tokens.push(`=${byte.toString(16).toUpperCase().padStart(2, '0')}`)
    }
  }

  const lines: string[] = []
  let current = ''
  const pushLine = (more: boolean) => {
    if (!current) return
    if (current.endsWith(' ') || current.endsWith('\t')) {
      const last = current.slice(-1)
      current = `${current.slice(0, -1)}${last === ' ' ? '=20' : '=09'}`
    }
    lines.push(more ? `${current}=` : current)
    current = ''
  }

  for (const token of tokens) {
    const extra = current.endsWith(' ') || current.endsWith('\t') ? 2 : 0
    if (current.length + extra + token.length > 75) {
      pushLine(true)
    }
    current += token
  }
  pushLine(false)
  return lines.join('\r\n')
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
    toQuotedPrintable(payload.text),
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    toQuotedPrintable(payload.html),
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
