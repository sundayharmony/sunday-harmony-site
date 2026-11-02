import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GOOGLE_WORKSPACE_SCOPES,
  buildRfc822Message,
  createMeetingEvent,
  encodeBase64Url,
  proposalDocumentText,
  prospectReplied,
  sendWorkspaceEmail,
} from '../google-workspace'

describe('google workspace mappers', () => {
  it('asks for Gmail, Calendar, Drive, Docs, and Contacts on one token', () => {
    const scopes = GOOGLE_WORKSPACE_SCOPES.join(' ')
    assert.match(scopes, /gmail\.send/)
    assert.match(scopes, /gmail\.readonly/)
    assert.match(scopes, /calendar\.events/)
    assert.match(scopes, /drive\.file/)
    assert.match(scopes, /documents/)
    assert.match(scopes, /contacts/)
  })

  it('builds a base64url Gmail message and detects a prospect reply', () => {
    const raw = encodeBase64Url(
      buildRfc822Message({
        from: 'sales@sundayharmony.com',
        to: 'owner@example.com',
        subject: 'Marketing opportunity',
        body: 'Hello',
      })
    )
    assert.doesNotMatch(raw, /[+/=]/)
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    assert.match(decoded, /To: owner@example.com/)
    assert.match(decoded, /Hello/)

    const replied = prospectReplied(
      [
        { payload: { headers: [{ name: 'From', value: 'Sunday Harmony <sales@sundayharmony.com>' }] } },
        { payload: { headers: [{ name: 'From', value: 'Owner <owner@example.com>' }] } },
      ],
      'owner@example.com',
      'sales@sundayharmony.com'
    )
    assert.equal(replied, true)
    assert.equal(
      prospectReplied(
        [{ payload: { headers: [{ name: 'From', value: 'sales@sundayharmony.com' }] } }],
        'owner@example.com',
        'sales@sundayharmony.com'
      ),
      false
    )
  })

  it('sends Gmail through the Workspace token and stores the thread id', async () => {
    const calls: string[] = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`)
      if (url.includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body || '{}')) as { raw?: string }
      assert.ok(body.raw)
      return new Response(JSON.stringify({ id: 'msg-1', threadId: 'thread-9' }), { status: 200 })
    }
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'id'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret'
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh'
    process.env.GOOGLE_CALENDAR_ID = 'sales@sundayharmony.com'
    const sent = await sendWorkspaceEmail(
      { to: 'owner@example.com', subject: 'Hello', body: 'Body' },
      fetchImpl
    )
    assert.equal(sent.threadId, 'thread-9')
    assert.ok(calls.some((call) => call.includes('gmail.googleapis.com')))
    assert.match(proposalDocumentText({
      business: 'Abbs Trucking',
      contactName: 'Abbs',
      service: 'Website',
      price: '$2,500',
      scope: 'Five pages',
      deadline: 'Dec 1',
    }), /Abbs Trucking/)
  })

  it('creates a calendar meeting with an attendee invite', async () => {
    const calls: string[] = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`)
      if (url.includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body || '{}')) as {
        summary?: string
        attendees?: Array<{ email?: string }>
      }
      assert.equal(body.summary, 'Meeting: Sample Co')
      assert.equal(body.attendees?.[0]?.email, 'owner@example.com')
      return new Response(JSON.stringify({ id: 'evt-1', htmlLink: 'https://calendar.google.com/event' }), { status: 200 })
    }
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'id'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret'
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh'
    process.env.GOOGLE_CALENDAR_ID = 'sales@sundayharmony.com'
    const created = await createMeetingEvent(
      {
        summary: 'Meeting: Sample Co',
        description: 'Intro call',
        startsAt: new Date('2026-11-05T15:00:00.000Z'),
        durationMinutes: 45,
        attendeeEmail: 'owner@example.com',
      },
      fetchImpl
    )
    assert.equal(created.eventId, 'evt-1')
    assert.ok(calls.some((call) => call.includes('sendUpdates=all')))
  })
})
