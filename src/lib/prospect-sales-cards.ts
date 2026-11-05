import {
  meetingEndMs,
  meetingStillJoinable,
  safeMeetHref,
  type StoredMeetingRow,
} from '@/lib/joinable-meetings'

export type ProspectAgreementStatus = 'none' | 'sent' | 'signed'
export type ProspectMeetingCardState = 'upcoming' | 'past' | 'none'

export type AgreementDocumentRef = {
  document_type?: string | null
  status?: string | null
  document_number?: string | null
  sent_at?: string | null
  signed_at?: string | null
  client_signed_at?: string | null
}

export type ProspectAgreementCard = {
  status: ProspectAgreementStatus
  documentNumber?: string
  signedAt?: string | null
  sentAt?: string | null
  href?: string | null
}

const SIGNED_DOC_STATUSES = new Set(['signed'])
const SENT_DOC_STATUSES = new Set(['sent', 'viewed'])

function isAgreementDoc(doc: AgreementDocumentRef): boolean {
  return !doc.document_type || doc.document_type === 'agreement'
}

function documentSignedAt(doc: AgreementDocumentRef): string | null {
  return doc.signed_at || doc.client_signed_at || null
}

function documentIsSigned(doc: AgreementDocumentRef): boolean {
  if (SIGNED_DOC_STATUSES.has(doc.status || '')) return true
  return Boolean(documentSignedAt(doc))
}

function documentIsSent(doc: AgreementDocumentRef): boolean {
  if (documentIsSigned(doc)) return true
  if (SENT_DOC_STATUSES.has(doc.status || '')) return true
  return Boolean(doc.sent_at)
}

/** Signed wins over sent. CRM `agreementSignedAt` counts as signed; e-sign rows also count because they do not write that column. */
export function prospectAgreementCard(input: {
  agreementSignedAt?: string | null
  proposalDocUrl?: string | null
  documents?: AgreementDocumentRef[] | null
}): ProspectAgreementCard {
  const agreements = (input.documents || []).filter(isAgreementDoc)
  const signedDoc = agreements.find(documentIsSigned)
  const sentDoc = agreements.find(documentIsSent)
  const href = safeMeetHref(input.proposalDocUrl || '') || null

  if (input.agreementSignedAt || signedDoc) {
    return {
      status: 'signed',
      documentNumber: signedDoc?.document_number || undefined,
      signedAt: documentSignedAt(signedDoc || {}) || input.agreementSignedAt || null,
      sentAt: signedDoc?.sent_at || sentDoc?.sent_at || null,
      href,
    }
  }

  if (sentDoc) {
    return {
      status: 'sent',
      documentNumber: sentDoc.document_number || undefined,
      signedAt: null,
      sentAt: sentDoc.sent_at || null,
      href,
    }
  }

  return { status: 'none', href }
}

function latestStoredMeeting(rows: StoredMeetingRow[]): StoredMeetingRow | null {
  const scheduled = rows.filter((row) => !row.status || row.status === 'scheduled')
  if (scheduled.length === 0) return null
  return scheduled.reduce((latest, row) =>
    (row.scheduled_at || '') > (latest.scheduled_at || '') ? row : latest
  )
}

export type ProspectMeetingCard = {
  state: ProspectMeetingCardState
  latestStartsAt?: string | null
  joinable: boolean
}

/**
 * Card state is based on stored meetings / follow-up history, including rows that
 * have passed the Join cutoff. Join eligibility stays on `meetingStillJoinable`.
 */
export function prospectMeetingCardState(input: {
  storedMeetings?: StoredMeetingRow[] | null
  followUpAt?: string | null
  stage?: string | null
  now?: number
}): ProspectMeetingCard {
  const now = input.now ?? Date.now()
  const stored = (input.storedMeetings || []).filter((row) => !row.status || row.status === 'scheduled')
  const latest = latestStoredMeeting(stored)
  const followUpAt = input.followUpAt || null

  const candidates: Array<{ startsAt: string; durationMinutes?: number | null }> = stored.map((row) => ({
    startsAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
  }))
  if (followUpAt && !candidates.some((row) => row.startsAt === followUpAt)) {
    candidates.push({ startsAt: followUpAt })
  }

  const upcoming = candidates.find((row) => {
    const start = new Date(row.startsAt).getTime()
    if (Number.isNaN(start)) return false
    if (start > now) return true
    return meetingStillJoinable(row, now)
  })

  if (upcoming) {
    return {
      state: 'upcoming',
      latestStartsAt: upcoming.startsAt,
      joinable: meetingStillJoinable(upcoming, now),
    }
  }

  if (candidates.length > 0) {
    const latestStart = latest?.scheduled_at || followUpAt
    return {
      state: 'past',
      latestStartsAt: latestStart,
      joinable: false,
    }
  }

  if (input.stage === 'meeting_scheduled') {
    return { state: 'upcoming', latestStartsAt: followUpAt, joinable: false }
  }

  return { state: 'none', latestStartsAt: null, joinable: false }
}

export function isProspectAgreementStatus(value: unknown): value is ProspectAgreementStatus {
  return value === 'none' || value === 'sent' || value === 'signed'
}

export function isProspectMeetingCardState(value: unknown): value is ProspectMeetingCardState {
  return value === 'upcoming' || value === 'past' || value === 'none'
}

export { meetingEndMs }
