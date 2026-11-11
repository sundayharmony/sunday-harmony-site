import { randomUUID } from 'node:crypto'
import {
  EMAIL_BOT_UNVERIFIED_REPORTS,
  OUTREACH_CAMPAIGN_SLUG,
  OUTREACH_COMPANY_NAME,
  OUTREACH_CTA_LABEL,
  OUTREACH_CTA_URL,
  OUTREACH_MAILING_ADDRESS,
  OUTREACH_MAX_ATTEMPTS,
  OUTREACH_SENDER_DISPLAY,
  OUTREACH_SENDER_EMAIL,
  OUTREACH_SIGNER_NAME,
} from './constants'
import { draftContentSha256 } from './draft-shell'
import { normalizeBusinessName, normalizeEmail } from './email-address'
import { leadIsReadyQueueCandidate } from './eligibility'
import type {
  AuditEvent,
  AttemptOutcome,
  BookingSnapshot,
  LeadSnapshot,
  OutreachAttempt,
  OutreachCampaign,
  OutreachSettings,
  OutreachTemplateVersion,
  QueueItem,
  QueueStatus,
  ReconciliationItem,
  Suppression,
} from './types'

export type QueueSummaryQuery = {
  statuses?: QueueStatus[]
  limit?: number
  offset?: number
  /** queue: next attempt time ascending. recent: accepted time descending. */
  order?: 'queue' | 'recent'
}

export type LeadCandidateQuery = {
  limit?: number
  offset?: number
  /** Skip leads that already have no email or were already contacted. */
  untouched?: boolean
}

export type OutreachStore = {
  now: () => Date
  getSettings(): Promise<OutreachSettings>
  updateSettings(patch: Partial<OutreachSettings>): Promise<OutreachSettings>
  recordActivation(actorId: string, at: Date): Promise<OutreachSettings | null>
  getCampaignBySlug(slug: string): Promise<OutreachCampaign | null>
  getLatestTemplate(campaignId: string): Promise<OutreachTemplateVersion | null>
  approveTemplate(templateId: string, actorId: string, expectedSha: string, at: Date): Promise<OutreachTemplateVersion | null>
  unapproveLatestTemplate(campaignId: string, reason: string, actorId: string | null): Promise<OutreachTemplateVersion | null>
  findUnsubscribeTokenByQueueId(queueId: string): Promise<{
    tokenHash: string
    emailNormalized: string
    leadId: string | null
    queueId: string | null
    confirmedAt: string | null
  } | null>
  markReconProviderConfirmed(id: string, providerMessageId: string): Promise<ReconciliationItem | null>
  listSuppressions(): Promise<Suppression[]>
  findSuppression(emailNormalized: string): Promise<Suppression | null>
  addSuppression(row: Omit<Suppression, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Suppression>
  listReconciliationItems(): Promise<ReconciliationItem[]>
  findReconciliationForLead(input: { emailNormalized: string | null; businessNormalized: string }): Promise<ReconciliationItem | null>
  getQueueItem(id: string): Promise<QueueItem | null>
  findQueueByLead(campaignId: string, leadId: string): Promise<QueueItem | null>
  findLatestQueueForLead(leadId: string): Promise<QueueItem | null>
  findQueueByEmail(campaignId: string, emailNormalized: string): Promise<QueueItem | null>
  listQueue(): Promise<QueueItem[]>
  listQueueSummaries(query?: QueueSummaryQuery): Promise<QueueItem[]>
  countQueueByStatus(status: QueueStatus): Promise<number>
  listQueuedLeadKeys(): Promise<Array<{ leadId: string; emailNormalized: string }>>
  insertQueue(item: QueueItem): Promise<{ ok: true; item: QueueItem } | { ok: false; reason: 'duplicate' }>
  compareAndSwap(
    id: string,
    expectedStatus: QueueStatus,
    patch: Partial<QueueItem>
  ): Promise<QueueItem | null>
  addAttempt(row: OutreachAttempt): Promise<OutreachAttempt>
  updateAttempt(id: string, patch: Partial<OutreachAttempt>): Promise<void>
  listAttempts(queueId: string): Promise<OutreachAttempt[]>
  addAudit(row: Omit<AuditEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<AuditEvent>
  listAudit(limit?: number): Promise<AuditEvent[]>
  getLead(id: string): Promise<LeadSnapshot | null>
  listEligibleLeadCandidates(query?: LeadCandidateQuery): Promise<LeadSnapshot[]>
  markLeadContacted(input: {
    leadId: string
    contactedAt: string
    pipelineStage: string
    gmailThreadId?: string | null
  }): Promise<void>
  getBooking(leadId: string, emailNormalized: string): Promise<BookingSnapshot>
  putUnsubscribeToken(input: { tokenHash: string; emailNormalized: string; leadId: string | null; queueId: string | null }): Promise<void>
  findUnsubscribeToken(tokenHash: string): Promise<{
    tokenHash: string
    emailNormalized: string
    leadId: string | null
    queueId: string | null
    confirmedAt: string | null
  } | null>
  confirmUnsubscribeToken(tokenHash: string, at: string): Promise<void>
  acceptedCountSince(sinceIso: string): Promise<number>
}

let _store: OutreachStore | null = null

export function setOutreachStoreForTests(store: OutreachStore | null) {
  _store = store
}

export function getOutreachStore(): OutreachStore {
  if (_store) return _store
  throw new Error('Outreach store is not configured')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createMemoryOutreachStore(options?: {
  now?: () => Date
  leads?: LeadSnapshot[]
  bookings?: Array<BookingSnapshot & { leadId: string; emailNormalized: string }>
}): OutreachStore & { leads: LeadSnapshot[]; leadContacted: Array<Record<string, unknown>> } {
  const nowFn = options?.now || (() => new Date())
  const iso = () => nowFn().toISOString()
  let settings: OutreachSettings = {
    id: 1,
    killSwitch: true,
    activatedAt: null,
    activationApprovedBy: null,
    physicalMailingAddress: OUTREACH_MAILING_ADDRESS,
    senderEmail: OUTREACH_SENDER_EMAIL,
    senderDisplayName: OUTREACH_SENDER_DISPLAY,
    signerName: OUTREACH_SIGNER_NAME,
    companyName: OUTREACH_COMPANY_NAME,
    ctaLabel: OUTREACH_CTA_LABEL,
    ctaUrl: OUTREACH_CTA_URL,
    dailySendLimit: 0,
    maxAttempts: OUTREACH_MAX_ATTEMPTS,
    historyReconciliationStatus: 'unverified_reports_loaded',
    providerHistoryVerifiedAt: null,
    optOutVerifiedAt: null,
    settingsVersion: 1,
  }
  const campaign: OutreachCampaign = {
    id: 'camp-prospect-intro',
    slug: OUTREACH_CAMPAIGN_SLUG,
    name: 'Prospect intro (unapproved draft)',
  }
  let template: OutreachTemplateVersion = {
    id: 'tpl-prospect-intro-v1',
    campaignId: campaign.id,
    version: 1,
    subjectTemplate: '{business}: a note from Sunday Harmony',
    preheaderTemplate: 'A short note and our company presentation.',
    contentSha256: draftContentSha256(),
    approved: false,
    approvedAt: null,
    approvedBy: null,
    approvedSettingsVersion: null,
  }
  const suppressions: Suppression[] = []
  const recon: ReconciliationItem[] = EMAIL_BOT_UNVERIFIED_REPORTS.map((row, index) => ({
    id: `recon-${index + 1}`,
    business: row.business,
    businessNormalized: normalizeBusinessName(row.business),
    email: row.email,
    emailNormalized: row.email ? normalizeEmail(row.email) : null,
    outcome: row.outcome,
    reportedOn: row.reportedOn,
    matchMethod: row.email ? 'exact_email' : 'exact_business',
    treatment: 'block_review',
    providerConfirmed: false,
    notes: row.notes,
  }))
  const queue: QueueItem[] = []
  const attempts: OutreachAttempt[] = []
  const audit: AuditEvent[] = []
  const leads = options?.leads ? [...options.leads] : []
  const leadContacted: Array<Record<string, unknown>> = []
  const tokens: Array<{
    tokenHash: string
    emailNormalized: string
    leadId: string | null
    queueId: string | null
    confirmedAt: string | null
  }> = []
  let lock = Promise.resolve()

  async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    let release: () => void = () => {}
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    const prev = lock
    lock = prev.then(() => wait)
    await prev
    try {
      return await fn()
    } finally {
      release()
    }
  }

  const store: OutreachStore & { leads: LeadSnapshot[]; leadContacted: Array<Record<string, unknown>> } = {
    leads,
    leadContacted,
    now: nowFn,
    async getSettings() {
      return clone(settings)
    },
    async updateSettings(patch) {
      settings = { ...settings, ...patch, id: 1 }
      return clone(settings)
    },
    async recordActivation(actorId, at) {
      if (settings.activatedAt) return null
      settings = {
        ...settings,
        activatedAt: at.toISOString(),
        activationApprovedBy: actorId,
      }
      return clone(settings)
    },
    async getCampaignBySlug(slug) {
      return slug === campaign.slug ? clone(campaign) : null
    },
    async getLatestTemplate(campaignId) {
      return campaignId === template.campaignId ? clone(template) : null
    },
    async approveTemplate(templateId, actorId, expectedSha, at) {
      if (template.id !== templateId) return null
      if (template.contentSha256 !== expectedSha) return null
      template = {
        ...template,
        approved: true,
        approvedAt: at.toISOString(),
        approvedBy: actorId,
        approvedSettingsVersion: settings.settingsVersion,
      }
      return clone(template)
    },
    async unapproveLatestTemplate(campaignId, reason, actorId) {
      if (template.campaignId !== campaignId) return null
      template = {
        ...template,
        approved: false,
        approvedAt: null,
        approvedBy: null,
        approvedSettingsVersion: null,
      }
      audit.unshift({
        id: randomUUID(),
        createdAt: iso(),
        actorType: actorId ? 'staff' : 'system',
        actorId,
        action: 'template_invalidated',
        entityType: 'template',
        entityId: template.id,
        payload: { reason },
      })
      return clone(template)
    },
    async listSuppressions() {
      return clone(suppressions)
    },
    async findSuppression(emailNormalized) {
      const hit = suppressions.find((row) => row.emailNormalized === emailNormalized)
      return hit ? clone(hit) : null
    },
    async addSuppression(row) {
      const existing = suppressions.find(
        (item) => item.emailNormalized === row.emailNormalized && item.reason === row.reason
      )
      if (existing) return clone(existing)
      const created: Suppression = {
        id: row.id || randomUUID(),
        createdAt: row.createdAt || iso(),
        ...row,
      }
      suppressions.push(created)
      return clone(created)
    },
    async listReconciliationItems() {
      return clone(recon)
    },
    async findReconciliationForLead(input) {
      if (input.emailNormalized) {
        const byEmail = recon.find((row) => row.emailNormalized === input.emailNormalized)
        if (byEmail) return clone(byEmail)
      }
      const byName = recon.find(
        (row) => !row.emailNormalized && row.businessNormalized === input.businessNormalized
      )
      return byName ? clone(byName) : null
    },
    async getQueueItem(id) {
      const item = queue.find((row) => row.id === id)
      return item ? clone(item) : null
    },
    async findQueueByLead(campaignId, leadId) {
      const item = queue.find((row) => row.campaignId === campaignId && row.leadId === leadId)
      return item ? clone(item) : null
    },
    async findLatestQueueForLead(leadId) {
      const matches = queue
        .filter((row) => row.leadId === leadId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return matches[0] ? clone(matches[0]) : null
    },
    async findQueueByEmail(campaignId, emailNormalized) {
      const item = queue.find(
        (row) => row.campaignId === campaignId && row.emailNormalized === emailNormalized
      )
      return item ? clone(item) : null
    },
    async listQueue() {
      return clone(queue)
    },
    async listQueueSummaries(query) {
      let rows = clone(queue).map((item) => ({ ...item, htmlBody: '', textBody: '', preheader: '' }))
      if (query?.statuses?.length) {
        const allowed = new Set(query.statuses)
        rows = rows.filter((item) => allowed.has(item.status))
      }
      if (query?.order === 'recent') {
        rows.sort(
          (a, b) =>
            (b.acceptedAt || b.createdAt).localeCompare(a.acceptedAt || a.createdAt) ||
            b.id.localeCompare(a.id)
        )
      } else if (query?.order === 'queue') {
        rows.sort((a, b) => {
          const aKey = a.nextAttemptAt || a.createdAt
          const bKey = b.nextAttemptAt || b.createdAt
          return aKey.localeCompare(bKey) || a.id.localeCompare(b.id)
        })
      }
      const offset = Math.max(query?.offset ?? 0, 0)
      if (query?.limit && query.limit > 0) return rows.slice(offset, offset + query.limit)
      if (offset > 0) return rows.slice(offset)
      return rows
    },
    async countQueueByStatus(status) {
      return queue.filter((item) => item.status === status).length
    },
    async listQueuedLeadKeys() {
      return queue.map((item) => ({ leadId: item.leadId, emailNormalized: item.emailNormalized }))
    },
    async insertQueue(item) {
      if (
        queue.some(
          (row) =>
            (row.campaignId === item.campaignId && row.leadId === item.leadId) ||
            (row.campaignId === item.campaignId && row.emailNormalized === item.emailNormalized) ||
            row.providerIdempotencyKey === item.providerIdempotencyKey
        )
      ) {
        return { ok: false, reason: 'duplicate' }
      }
      queue.push(clone(item))
      return { ok: true, item: clone(item) }
    },
    async compareAndSwap(id, expectedStatus, patch) {
      return withLock(() => {
        const index = queue.findIndex((row) => row.id === id)
        if (index < 0) return null
        if (queue[index].status !== expectedStatus) return null
        queue[index] = {
          ...queue[index],
          ...patch,
          id: queue[index].id,
          updatedAt: iso(),
        }
        return clone(queue[index])
      })
    },
    async addAttempt(row) {
      attempts.push(clone(row))
      return clone(row)
    },
    async updateAttempt(id, patch) {
      const index = attempts.findIndex((row) => row.id === id)
      if (index >= 0) attempts[index] = { ...attempts[index], ...patch }
    },
    async listAttempts(queueId) {
      return clone(attempts.filter((row) => row.queueId === queueId))
    },
    async addAudit(row) {
      const event: AuditEvent = {
        id: row.id || randomUUID(),
        createdAt: row.createdAt || iso(),
        ...row,
      }
      audit.unshift(event)
      return clone(event)
    },
    async listAudit(limit = 100) {
      return clone(audit.slice(0, limit))
    },
    async getLead(id) {
      const lead = leads.find((row) => row.id === id)
      return lead ? clone(lead) : null
    },
    async listEligibleLeadCandidates(query) {
      let rows = leads
      if (query?.untouched) rows = rows.filter(leadIsReadyQueueCandidate)
      const offset = Math.max(query?.offset ?? 0, 0)
      const sliced = rows.slice(offset)
      if (query?.limit && query.limit > 0) return clone(sliced.slice(0, query.limit))
      return clone(sliced)
    },
    async markLeadContacted(input) {
      leadContacted.push({ ...input })
      const lead = leads.find((row) => row.id === input.leadId)
      if (lead) {
        lead.lastContactedAt = input.contactedAt
        lead.pipelineStage = input.pipelineStage
        if (input.gmailThreadId) lead.gmailThreadId = input.gmailThreadId
      }
    },
    async getBooking(leadId, emailNormalized) {
      const hit = (options?.bookings || []).find(
        (row) => row.leadId === leadId || row.emailNormalized === emailNormalized
      )
      return hit
        ? { status: hit.status, startsAt: hit.startsAt, meetLink: hit.meetLink }
        : { status: 'none', startsAt: null, meetLink: null }
    },
    async putUnsubscribeToken(input) {
      tokens.push({ ...input, confirmedAt: null })
    },
    async findUnsubscribeToken(tokenHash) {
      return tokens.find((row) => row.tokenHash === tokenHash) || null
    },
    async findUnsubscribeTokenByQueueId(queueId) {
      const row = [...tokens].reverse().find((item) => item.queueId === queueId)
      return row || null
    },
    async markReconProviderConfirmed(id, providerMessageId) {
      const row = recon.find((item) => item.id === id)
      if (!row) return null
      row.providerConfirmed = true
      row.notes = `${row.notes} Provider message ${providerMessageId}.`
      return clone(row)
    },
    async confirmUnsubscribeToken(tokenHash, at) {
      const row = tokens.find((item) => item.tokenHash === tokenHash)
      if (row) row.confirmedAt = at
    },
    async acceptedCountSince(sinceIso) {
      return queue.filter((row) => row.acceptedAt && row.acceptedAt >= sinceIso).length
    },
  }
  return store
}

export function newIdempotencyKey(queueId: string): string {
  return `prospect-intro/${queueId}`
}

export function emptyAttemptOutcome(outcome: AttemptOutcome): AttemptOutcome {
  return outcome
}
