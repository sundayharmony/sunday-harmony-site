export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/contacts',
] as const

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export function isGoogleWorkspaceConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim() &&
      process.env.GOOGLE_CALENDAR_ID?.trim()
  )
}

export function workspaceMailbox(): string {
  return process.env.GOOGLE_CALENDAR_ID?.trim() || 'sales@sundayharmony.com'
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export async function getGoogleAccessToken(fetchImpl: FetchLike = fetch): Promise<string> {
  const body = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CALENDAR_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
    refresh_token: requiredEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  })
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || 'Google token refresh failed')
  }
  return payload.access_token
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function buildRfc822Message(input: {
  from: string
  to: string
  subject: string
  body: string
}): string {
  const subject = `=?UTF-8?B?${Buffer.from(input.subject, 'utf8').toString('base64')}?=`
  return [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
  ].join('\r\n')
}

type GmailHeader = { name?: string; value?: string }

export function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const match = (headers || []).find((header) => header.name?.toLowerCase() === name.toLowerCase())
  return match?.value || ''
}

export function addressIncludes(header: string, email: string): boolean {
  return header.toLowerCase().includes(email.trim().toLowerCase())
}

export function prospectReplied(
  messages: Array<{ payload?: { headers?: GmailHeader[] } }>,
  prospectEmail: string,
  mailbox: string
): boolean {
  const prospect = prospectEmail.trim().toLowerCase()
  if (!prospect) return false
  return messages.some((message) => {
    const from = headerValue(message.payload?.headers, 'From')
    return addressIncludes(from, prospect) && !addressIncludes(from, mailbox)
  })
}

async function googleJson<T>(
  token: string,
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike
): Promise<T> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } | string }
  if (!response.ok) {
    const message =
      typeof payload.error === 'string' ? payload.error : payload.error?.message || 'Google request failed'
    throw new Error(message)
  }
  return payload
}

export async function sendWorkspaceEmail(
  input: { to: string; subject: string; body: string; threadId?: string | null },
  fetchImpl: FetchLike = fetch
): Promise<{ id: string; threadId: string }> {
  const token = await getGoogleAccessToken(fetchImpl)
  const mailbox = workspaceMailbox()
  const raw = encodeBase64Url(
    buildRfc822Message({ from: mailbox, to: input.to, subject: input.subject, body: input.body })
  )
  const payload = await googleJson<{ id?: string; threadId?: string }>(
    token,
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      body: JSON.stringify({ raw, threadId: input.threadId || undefined }),
    },
    fetchImpl
  )
  if (!payload.id || !payload.threadId) throw new Error('Gmail did not return a thread')
  return { id: payload.id, threadId: payload.threadId }
}

export type ThreadMessage = {
  from: string
  subject: string
  date: string
  snippet: string
}

export async function readWorkspaceThread(
  threadId: string,
  prospectEmail: string,
  fetchImpl: FetchLike = fetch
): Promise<{ messages: ThreadMessage[]; replied: boolean }> {
  const token = await getGoogleAccessToken(fetchImpl)
  const payload = await googleJson<{
    messages?: Array<{ snippet?: string; payload?: { headers?: GmailHeader[] } }>
  }>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    { method: 'GET' },
    fetchImpl
  )
  const raw = payload.messages || []
  const messages = raw.map((message) => ({
    from: headerValue(message.payload?.headers, 'From'),
    subject: headerValue(message.payload?.headers, 'Subject'),
    date: headerValue(message.payload?.headers, 'Date'),
    snippet: message.snippet || '',
  }))
  return { messages, replied: prospectReplied(raw, prospectEmail, workspaceMailbox()) }
}

export function threadHasProspectReply(
  messages: Array<{ payload?: { headers?: GmailHeader[] } }>,
  prospectEmail: string
): boolean {
  return prospectReplied(messages, prospectEmail, workspaceMailbox())
}

export async function upsertFollowUpEvent(
  input: {
    eventId?: string | null
    summary: string
    description: string
    startsAt: Date
    timeZone?: string
  },
  fetchImpl: FetchLike = fetch
): Promise<{ eventId: string; htmlLink: string }> {
  const token = await getGoogleAccessToken(fetchImpl)
  const calendarId = encodeURIComponent(requiredEnv('GOOGLE_CALENDAR_ID'))
  const endsAt = new Date(input.startsAt.getTime() + 30 * 60 * 1000)
  const body = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone || 'America/New_York' },
    end: { dateTime: endsAt.toISOString(), timeZone: input.timeZone || 'America/New_York' },
  }
  const existing = input.eventId?.trim()
  const url = existing
    ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(existing)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  const payload = await googleJson<{ id?: string; htmlLink?: string }>(
    token,
    url,
    { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(body) },
    fetchImpl
  )
  if (!payload.id) throw new Error('Calendar did not return an event')
  return { eventId: payload.id, htmlLink: payload.htmlLink || '' }
}

export async function listWorkspaceEvents(
  input: { timeMin: string; timeMax: string },
  fetchImpl: FetchLike = fetch
): Promise<Array<{ id: string; summary: string; start: string; htmlLink: string }>> {
  const token = await getGoogleAccessToken(fetchImpl)
  const calendarId = encodeURIComponent(requiredEnv('GOOGLE_CALENDAR_ID'))
  const params = new URLSearchParams({
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })
  const payload = await googleJson<{
    items?: Array<{ id?: string; summary?: string; htmlLink?: string; start?: { dateTime?: string; date?: string } }>
  }>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { method: 'GET' },
    fetchImpl
  )
  return (payload.items || [])
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id || '',
      summary: item.summary || 'Calendar event',
      start: item.start?.dateTime || item.start?.date || '',
      htmlLink: item.htmlLink || '',
    }))
}

export async function upsertWorkspaceContact(
  input: {
    resourceName?: string | null
    givenName: string
    familyName: string
    email?: string
    phone?: string
    business: string
  },
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const token = await getGoogleAccessToken(fetchImpl)
  const person = {
    names: [{ givenName: input.givenName, familyName: input.familyName }],
    emailAddresses: input.email ? [{ value: input.email }] : [],
    phoneNumbers: input.phone ? [{ value: input.phone }] : [],
    organizations: [{ name: input.business }],
    biographies: [{ value: 'Sunday Harmony marketing prospect' }],
  }
  if (input.resourceName) {
    const params = new URLSearchParams({
      updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations,biographies',
    })
    const payload = await googleJson<{ resourceName?: string }>(
      token,
      `https://people.googleapis.com/v1/${input.resourceName}:updateContact?${params}`,
      { method: 'PATCH', body: JSON.stringify(person) },
      fetchImpl
    )
    return payload.resourceName || input.resourceName
  }
  const created = await googleJson<{ resourceName?: string }>(
    token,
    'https://people.googleapis.com/v1/people:createContact',
    { method: 'POST', body: JSON.stringify(person) },
    fetchImpl
  )
  if (!created.resourceName) throw new Error('Contacts did not return a person')
  return created.resourceName
}

export async function ensureDriveFolder(
  input: { name: string; existingId?: string | null },
  fetchImpl: FetchLike = fetch
): Promise<{ id: string; url: string }> {
  if (input.existingId) {
    return { id: input.existingId, url: `https://drive.google.com/drive/folders/${input.existingId}` }
  }
  const token = await getGoogleAccessToken(fetchImpl)
  const created = await googleJson<{ id?: string }>(
    token,
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    },
    fetchImpl
  )
  if (!created.id) throw new Error('Drive did not return a folder')
  return { id: created.id, url: `https://drive.google.com/drive/folders/${created.id}` }
}

export async function uploadDriveFile(
  input: { folderId: string; name: string; mimeType: string; data: Buffer },
  fetchImpl: FetchLike = fetch
): Promise<{ id: string; url: string }> {
  const token = await getGoogleAccessToken(fetchImpl)
  const boundary = `sundayharmony${Date.now()}`
  const meta = JSON.stringify({ name: input.name, parents: [input.folderId] })
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`
    ),
    input.data,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const response = await fetchImpl(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!response.ok || !payload.id) throw new Error(payload.error?.message || 'Drive upload failed')
  return { id: payload.id, url: `https://drive.google.com/file/d/${payload.id}/view` }
}

export function proposalDocumentText(input: {
  business: string
  contactName: string
  service: string
  price: string
  scope: string
  deadline: string
}): string {
  return [
    `Sunday Harmony proposal for ${input.business}`,
    '',
    `Prepared for ${input.contactName || input.business}`,
    `Recommended service: ${input.service || 'Marketing services'}`,
    `Investment: ${input.price || 'To be confirmed'}`,
    `Deadline: ${input.deadline || 'To be confirmed'}`,
    '',
    'Scope',
    input.scope || 'Scope will be confirmed on the consultation.',
    '',
    'This proposal explains the work, the price, and the timeline. It becomes the agreement once both sides sign and the first payment is recorded in the CRM.',
  ].join('\n')
}

export async function createProposalDocument(
  input: {
    title: string
    folderId: string
    text: string
    templateId?: string | null
  },
  fetchImpl: FetchLike = fetch
): Promise<{ id: string; url: string }> {
  const token = await getGoogleAccessToken(fetchImpl)
  const templateId = input.templateId || process.env.GOOGLE_PROPOSAL_TEMPLATE_ID?.trim()
  if (templateId) {
    const copied = await googleJson<{ id?: string }>(
      token,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateId)}/copy`,
      {
        method: 'POST',
        body: JSON.stringify({ name: input.title, parents: [input.folderId] }),
      },
      fetchImpl
    )
    if (!copied.id) throw new Error('Drive did not copy the proposal template')
    return { id: copied.id, url: `https://docs.google.com/document/d/${copied.id}/edit` }
  }

  const created = await googleJson<{ id?: string }>(
    token,
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [input.folderId],
      }),
    },
    fetchImpl
  )
  if (!created.id) throw new Error('Drive did not create the proposal')
  await googleJson(
    token,
    `https://docs.googleapis.com/v1/documents/${created.id}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: input.text } }],
      }),
    },
    fetchImpl
  )
  return { id: created.id, url: `https://docs.google.com/document/d/${created.id}/edit` }
}
