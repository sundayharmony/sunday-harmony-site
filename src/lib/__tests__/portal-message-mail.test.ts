import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  attachmentContentDisposition,
  collectGmailContent,
  decideInboundReply,
  decodeGmailBytes,
  isImageAttachment,
  parseThreadPayload,
  portalRefFromSubject,
  portalSubject,
  publicAttachments,
  safeObjectPath,
  visibleReplyText,
} from '../portal-message-mail'

const clientId = '11111111-1111-4111-8111-111111111111'
const client = { id: clientId, email: 'ada@client.test', name: 'Ada Client' }

function encode(value: string): string {
  return Buffer.from(value).toString('base64url')
}

describe('portal thread mail', () => {
  it('keeps a client ref in the subject and reads it back', () => {
    const subject = portalSubject('New message from Sunday Harmony', clientId)
    assert.equal(portalRefFromSubject(subject), clientId)
    assert.equal(portalRefFromSubject(`Re: ${subject}`), clientId)
    assert.equal(portalSubject('x'.repeat(400), clientId).length <= 200, true)
  })

  it('keeps the reply and drops the quoted thread', () => {
    const text = visibleReplyText('Thanks for the update.\n\nOn Sun, Nov 22, 2026 at 8:00 AM Sunday Harmony <sales@sundayharmony.com> wrote:\n> older note')
    assert.equal(text, 'Thanks for the update.')
  })

  it('accepts a client or staff reply and rejects strangers and our own notice', () => {
    const subject = `Re: New message from Sunday Harmony [portal:${clientId}]`
    const clientReply = decideInboundReply({
      subject,
      from: 'Ada Client <Ada@client.test>',
      headers: [],
      text: 'Here is the file.',
      hasFiles: true,
      client,
      staffEmails: ['sales@sundayharmony.com'],
    })
    assert.equal(clientReply.ok && clientReply.from_role, 'client')

    const staffReply = decideInboundReply({
      subject,
      from: 'Sunday Harmony <sales@sundayharmony.com>',
      headers: [{ name: 'In-Reply-To', value: '<abc@mail>' }],
      text: '',
      hasFiles: true,
      client,
      staffEmails: ['sales@sundayharmony.com'],
    })
    assert.equal(staffReply.ok && staffReply.text, 'Sent an attachment.')
    assert.equal(staffReply.ok && staffReply.from_role, 'admin')

    const stranger = decideInboundReply({
      subject,
      from: 'Other <other@example.com>',
      headers: [],
      text: 'nope',
      hasFiles: false,
      client,
      staffEmails: ['sales@sundayharmony.com'],
    })
    assert.equal(stranger.ok, false)

    const notice = decideInboundReply({
      subject,
      from: 'Ada Client <ada@client.test>',
      headers: [{ name: 'X-SH-Portal-Auto', value: '1' }],
      text: 'New message',
      hasFiles: false,
      client,
      staffEmails: [],
    })
    assert.deepEqual(notice, { ok: false, reason: 'auto' })
  })

  it('reads nested Gmail text and file parts without a public url', () => {
    const content = collectGmailContent({
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: encode('See the scan.') } },
            { mimeType: 'text/html', body: { data: encode('<p>ignored</p>') } },
          ],
        },
        {
          mimeType: 'application/pdf',
          filename: 'scan.pdf',
          body: { attachmentId: 'att-1', size: 12 },
        },
      ],
    })
    assert.equal(content.text, 'See the scan.')
    assert.equal(content.files.length, 1)
    assert.equal(content.files[0].filename, 'scan.pdf')
    assert.equal(content.files[0].attachmentId, 'att-1')
    assert.equal(decodeGmailBytes(encode('Hi')).toString(), 'Hi')
  })

  it('strips storage paths from the thread payload', () => {
    const shown = publicAttachments([
      { id: 'a', name: 'scan.pdf', type: 'pdf', size: 4, path: `${clientId}/secret.pdf` },
    ])
    assert.deepEqual(shown, [{ id: 'a', name: 'scan.pdf', type: 'pdf', size: 4 }])
    assert.equal('path' in shown[0], false)
    const parsed = parseThreadPayload({
      messages: [{ id: 'm', text: 'Hi', from_role: 'client', from_name: 'Ada', created_at: 't', client_id: clientId, attachments: shown }],
      files: [{ id: 'f', name: 'logo.png' }, { id: 1, name: 'nope' }],
    })
    assert.equal(parsed.messages.length, 1)
    assert.deepEqual(parsed.files, [{ id: 'f', name: 'logo.png' }])
  })

  it('refuses a file path that leaves the client folder', () => {
    assert.equal(safeObjectPath(`${clientId}/file.pdf`, clientId), `${clientId}/file.pdf`)
    assert.equal(safeObjectPath(`${clientId}/../other/file.pdf`, clientId), null)
    assert.equal(safeObjectPath(`other/${clientId}/file.pdf`, clientId), null)
    assert.equal(attachmentContentDisposition('scan".pdf\r\nBcc: x', 'application/pdf'), 'attachment; filename="scan.pdfBcc: x"')
    assert.equal(isImageAttachment('image/svg+xml', 'pic.svg'), false)
    assert.equal(isImageAttachment('image/png', 'pic.png'), true)
  })

  it('keeps downloads on the signed-in thread routes', () => {
    const dashboard = readFileSync('src/app/api/dashboard/messages/route.ts', 'utf8')
    const admin = readFileSync('src/app/api/admin/messages/route.ts', 'utf8')
    const clientFile = readFileSync('src/app/api/dashboard/messages/[messageId]/files/[attachmentId]/route.ts', 'utf8')
    const adminFile = readFileSync('src/app/api/admin/messages/[messageId]/files/[attachmentId]/route.ts', 'utf8')
    const server = readFileSync('src/lib/portal-message-server.ts', 'utf8')
    const cron = readFileSync('vercel.json', 'utf8')
    assert.match(dashboard, /requireClientSession/)
    assert.match(admin, /staffMayUseClient/)
    assert.match(clientFile, /requireClientSession/)
    assert.match(adminFile, /staffMayUseClient/)
    assert.match(server, /X-SH-Portal-Auto/)
    assert.match(server, /in:inbox OR in:sent/)
    assert.doesNotMatch(`${dashboard}\n${admin}\n${server}`, /createSignedUrl|getPublicUrl|signedUrl/)
    assert.match(cron, /\/api\/internal\/portal-message-replies/)
    assert.match(readFileSync('src/app/api/internal/portal-message-replies/route.ts', 'utf8'), /Bearer \$\{cronSecret\}/)
  })
})
